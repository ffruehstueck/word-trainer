"use client";

import { useState, useEffect, useCallback } from "react";
import WordCard from "@/components/WordCard";
import TrainingCard from "@/components/TrainingCard";
import SessionComplete from "@/components/SessionComplete";
import StatsModal from "@/components/StatsModal";
import { Word, WordProgress, SessionStats } from "@/types";

const BATCH_SIZE = 20; // Suggested batch size

interface FileOption {
  value: string;
  label: string;
}

interface PersistedProgress {
  allProgress: Array<[number, WordProgress]>;
  currentBatch: WordProgress[];
  currentIndex: number;
  batchNumber: number;
  selectedFile: string;
  mode: "exam" | "training";
  reverseDirection: boolean;
  timestamp: number;
}

const STORAGE_KEY_PREFIX = "word-trainer-progress";

export default function Home() {
  const [words, setWords] = useState<Word[]>([]);
  const [currentBatch, setCurrentBatch] = useState<WordProgress[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [batchNumber, setBatchNumber] = useState(1);
  const [allBatches, setAllBatches] = useState<Word[][]>([]);
  const [allProgress, setAllProgress] = useState<Map<number, WordProgress>>(new Map());
  const [showStats, setShowStats] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string>("unit-8.json");
  const [isLoading, setIsLoading] = useState(false);
  const [availableFiles, setAvailableFiles] = useState<FileOption[]>([]);
  const [reverseDirection, setReverseDirection] = useState(false);
  const [mode, setMode] = useState<"exam" | "training">("exam");

  // Helper to get storage key
  const getStorageKey = (file: string, mode: string) => `${STORAGE_KEY_PREFIX}-${file}-${mode}`;

  // Load progress from localStorage
  const loadProgress = (file: string, currentMode: "exam" | "training"): PersistedProgress | null => {
    if (typeof window === "undefined") return null;
    try {
      const key = getStorageKey(file, currentMode);
      const stored = localStorage.getItem(key);
      if (!stored) return null;
      
      const data: PersistedProgress = JSON.parse(stored);
      return data;
    } catch (err) {
      console.error("Error loading progress from localStorage:", err);
      return null;
    }
  };

  // Save progress to localStorage
  const saveProgress = (file: string, currentMode: "exam" | "training") => {
    if (typeof window === "undefined") return;
    try {
      const key = getStorageKey(file, currentMode);
      const data: PersistedProgress = {
        allProgress: Array.from(allProgress.entries()),
        currentBatch,
        currentIndex,
        batchNumber,
        selectedFile: file,
        mode: currentMode,
        reverseDirection,
        timestamp: Date.now(),
      };
      localStorage.setItem(key, JSON.stringify(data));
    } catch (err) {
      console.error("Error saving progress to localStorage:", err);
    }
  };

  // Clear progress for a specific file/mode
  const clearProgress = (file: string, currentMode: "exam" | "training") => {
    if (typeof window === "undefined") return;
    try {
      const key = getStorageKey(file, currentMode);
      localStorage.removeItem(key);
    } catch (err) {
      console.error("Error clearing progress from localStorage:", err);
    }
  };

  useEffect(() => {
    // Load available files list
    fetch("/data/files.json")
      .then((res) => res.json())
      .then((files: FileOption[]) => {
        setAvailableFiles(files);
        if (files.length > 0 && !selectedFile) {
          setSelectedFile(files[0].value);
        }
      })
      .catch((err) => {
        console.error("Error loading files list:", err);
        // Fallback to default files if manifest doesn't exist
        setAvailableFiles([
          { value: "unit-8.json", label: "Unit-8" },
        ]);
      });
  }, []);

  // Load saved progress when file/mode changes (but only after words are loaded)
  useEffect(() => {
    if (words.length === 0 || allBatches.length === 0) return;
    
    const saved = loadProgress(selectedFile, mode);
    if (saved && saved.selectedFile === selectedFile && saved.mode === mode) {
      // Restore progress
      setAllProgress(new Map(saved.allProgress));
      setBatchNumber(saved.batchNumber);
      setReverseDirection(saved.reverseDirection);
      
      if (mode === "exam") {
        // Reconstruct the current batch from saved progress
        const currentBatchNum = saved.batchNumber - 1;
        if (currentBatchNum >= 0 && currentBatchNum < allBatches.length) {
          const currentBatchWords = allBatches[currentBatchNum];
          const progressMap = new Map(saved.allProgress);
          const restoredBatch = currentBatchWords.map((word) => {
            const progress = progressMap.get(word.id);
            if (progress) {
              return progress;
            }
            return {
              word,
              isCorrect: false,
              attempts: 0,
            };
          });
          setCurrentBatch(restoredBatch);
          setCurrentIndex(Math.min(saved.currentIndex, restoredBatch.length - 1));
        }
      } else if (mode === "training") {
        setCurrentIndex(Math.min(saved.currentIndex, words.length - 1));
      }
    }
  }, [selectedFile, mode, words.length, allBatches.length]);

  // Save progress whenever it changes
  useEffect(() => {
    if (words.length === 0 || allBatches.length === 0) return;
    saveProgress(selectedFile, mode);
  }, [allProgress, currentBatch, currentIndex, batchNumber, selectedFile, mode, reverseDirection, words.length, allBatches.length]);

  // Fisher-Yates shuffle algorithm
  const shuffleArray = useCallback(<T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, []);

  const loadWords = useCallback(async (fileSelection: string, resetProgress = false) => {
    if (availableFiles.length === 0) return; // Wait for files list to load
    
    setIsLoading(true);
    try {
      let allWords: Word[] = [];
      
      if (fileSelection === "all") {
        // Load all files and combine them
        const filePromises = availableFiles.map((file) =>
          fetch(`/data/${file.value}`)
            .then((res) => res.json())
            .catch(() => []) // Skip files that don't exist
        );
        const fileResults = await Promise.all(filePromises);
        allWords = fileResults.flat();
      } else {
        // Load single file
        const response = await fetch(`/data/${fileSelection}`);
        if (!response.ok) {
          throw new Error(`Failed to load ${fileSelection}`);
        }
        allWords = await response.json();
      }

      // Shuffle words only in exam mode
      if (mode === "exam") {
        allWords = shuffleArray(allWords);
      }

      // Ensure unique IDs across all words (renumber sequentially to avoid conflicts)
      allWords = allWords.map((word, index) => ({
        ...word,
        id: index + 1,
      }));

      setWords(allWords);
      // Split into batches
      const batches: Word[][] = [];
      for (let i = 0; i < allWords.length; i += BATCH_SIZE) {
        batches.push(allWords.slice(i, i + BATCH_SIZE));
      }
      setAllBatches(batches);
      
      // Only reset progress if explicitly requested (new session)
      if (resetProgress) {
        clearProgress(fileSelection, mode);
        setBatchNumber(1);
        setAllProgress(new Map());
        if (batches.length > 0) {
          initializeBatch(batches[0]);
        }
      } else {
        // Always initialize batch first - progress will be restored by useEffect if it exists
        if (batches.length > 0) {
          initializeBatch(batches[0]);
        }
      }
    } catch (err) {
      console.error("Error loading words:", err);
    } finally {
      setIsLoading(false);
    }
  }, [availableFiles, mode, shuffleArray]);

  useEffect(() => {
    if (availableFiles.length > 0 && selectedFile) {
      // Check if file/mode changed - if so, clear old progress for previous file/mode
      loadWords(selectedFile, false);
    }
  }, [selectedFile, availableFiles.length, mode, loadWords]);

  // Reset revealed state whenever the word index changes (exam mode only)
  useEffect(() => {
    if (mode === "exam") {
      setIsRevealed(false);
    }
  }, [currentIndex, mode]);

  // Reset current index when switching modes
  useEffect(() => {
    if (mode === "training") {
      setCurrentIndex(0);
      setIsRevealed(false);
    }
  }, [mode]);

  const initializeBatch = (batchWords: Word[]) => {
    const batchProgress: WordProgress[] = batchWords.map((word) => ({
      word,
      isCorrect: false,
      attempts: 0,
    }));
    setCurrentBatch(batchProgress);
    setCurrentIndex(0);
    setIsRevealed(false);
  };

  const handleReveal = () => {
    setIsRevealed(true);
  };

  const handleAnswer = (isCorrect: boolean) => {
    if (!isRevealed) return;

    // Reset revealed state immediately to prevent showing next word's answer
    setIsRevealed(false);

    const updatedBatch = [...currentBatch];
    const currentWordProgress = updatedBatch[currentIndex];
    
    currentWordProgress.attempts += 1;
    
    if (isCorrect) {
      currentWordProgress.isCorrect = true;
    } else {
      currentWordProgress.isCorrect = false;
    }
    
    updatedBatch[currentIndex] = currentWordProgress;
    setCurrentBatch(updatedBatch);
    
    // Update global progress tracking
    setAllProgress((prev) => {
      const newMap = new Map(prev);
      newMap.set(currentWordProgress.word.id, currentWordProgress);
      return newMap;
    });
    
    // Move to next word or check if batch is complete
    moveToNextWord(updatedBatch);
  };

  const moveToNextWord = (batch: WordProgress[]) => {
    // Find next word that hasn't been answered correctly
    const remainingWords = batch.filter((wp) => !wp.isCorrect);
    
    if (remainingWords.length === 0) {
      // All words in current batch are correct
      handleBatchComplete();
    } else {
      // Find next incorrect word (cycling through)
      const currentWordId = batch[currentIndex].word.id;
      let nextIndex = -1;
      
      // Try to find next incorrect word after current index
      for (let i = currentIndex + 1; i < batch.length; i++) {
        if (!batch[i].isCorrect) {
          nextIndex = i;
          break;
        }
      }
      
      // If not found, wrap around
      if (nextIndex === -1) {
        for (let i = 0; i < currentIndex; i++) {
          if (!batch[i].isCorrect) {
            nextIndex = i;
            break;
          }
        }
      }
      
      // If still not found, take first incorrect word
      if (nextIndex === -1) {
        nextIndex = batch.findIndex((wp) => !wp.isCorrect);
      }
      
      setCurrentIndex(nextIndex);
    }
  };

  const handleBatchComplete = () => {
    // Check if there are more batches
    if (batchNumber < allBatches.length) {
      // Move to next batch
      const nextBatch = allBatches[batchNumber];
      setBatchNumber(batchNumber + 1);
      initializeBatch(nextBatch);
    } else {
      // All batches complete - calculate stats
      calculateFinalStats();
      setSessionComplete(true);
    }
  };

  const calculateCurrentStats = (): SessionStats => {
    // Build complete progress map from allProgress and currentBatch
    const progressMap = new Map(allProgress);
    currentBatch.forEach((wp) => {
      // Current batch progress takes precedence (most recent)
      progressMap.set(wp.word.id, wp);
    });
    
    // Get all words from batches processed so far (including current batch)
    const allWordsProcessed: Word[] = [];
    for (let i = 0; i < batchNumber; i++) {
      if (i < allBatches.length) {
        allWordsProcessed.push(...allBatches[i]);
      }
    }
    
    const progressArray: WordProgress[] = allWordsProcessed.map((word) => {
      const progress = progressMap.get(word.id);
      return progress || {
        word,
        isCorrect: false,
        attempts: 0,
      };
    });
    
    const correctWords = progressArray.filter((wp) => wp.isCorrect);
    const unknownWords = progressArray.filter((wp) => !wp.isCorrect).map((wp) => wp.word);
    
    const totalWords = progressArray.length;
    const correctCount = correctWords.length;
    const incorrectCount = unknownWords.length;
    const accuracy = totalWords > 0 ? (correctCount / totalWords) * 100 : 0;

    return {
      totalWords,
      correctWords: correctCount,
      incorrectWords: incorrectCount,
      accuracy,
      unknownWords,
    };
  };

  const calculateFinalStats = () => {
    const currentStats = calculateCurrentStats();
    setStats(currentStats);
  };

  const handleRestart = () => {
    clearProgress(selectedFile, mode);
    setSessionComplete(false);
    setStats(null);
    setBatchNumber(1);
    setAllProgress(new Map());
    setCurrentIndex(0);
    setIsRevealed(false);
    // Reload words to reset everything
    loadWords(selectedFile, true);
  };

  if (sessionComplete && stats) {
    return <SessionComplete stats={stats} onRestart={handleRestart} />;
  }

  if (isLoading || (mode === "exam" && currentBatch.length === 0) || (mode === "training" && words.length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading words...</p>
        </div>
      </div>
    );
  }

  const currentWordProgress = mode === "exam" && currentBatch.length > 0 ? currentBatch[currentIndex] : null;
  const remainingInBatch = mode === "exam" ? currentBatch.filter((wp) => !wp.isCorrect).length : 0;
  const currentStats = mode === "exam" ? calculateCurrentStats() : null;

  return (
    <>
      {showStats && currentStats && (
        <StatsModal
          stats={currentStats}
          onClose={() => setShowStats(false)}
          isComplete={false}
        />
      )}
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold text-gray-800 mb-4">Word Trainer</h1>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <select
                  value={selectedFile}
                  onChange={(e) => setSelectedFile(e.target.value)}
                  className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer w-32"
                  disabled={isLoading || availableFiles.length === 0}
                >
                  {availableFiles.map((file) => (
                    <option key={file.value} value={file.value}>
                      {file.label}
                    </option>
                  ))}
                  <option value="all">All Files</option>
                </select>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as "exam" | "training")}
                  className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                  disabled={isLoading}
                >
                  <option value="exam">Exam Mode</option>
                  <option value="training">Training Mode</option>
                </select>
              </div>
              {mode === "exam" && (
                <button
                  onClick={() => setShowStats(true)}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 flex items-center gap-2 shadow-md"
                  title="Show Stats"
                >
                  <span>📊</span>
                  <span className="hidden sm:inline">Stats</span>
                </button>
              )}
            </div>
            {mode === "exam" && (
              <div className="flex justify-center items-center gap-4 text-sm text-gray-600">
                <span>Batch {batchNumber} of {allBatches.length}</span>
                <span>•</span>
                <span>{remainingInBatch} remaining in batch</span>
              </div>
            )}
            {mode === "training" && (
              <div className="flex justify-center items-center gap-4 text-sm text-gray-600">
                <span>Word {currentIndex + 1} of {words.length}</span>
              </div>
            )}
          </div>

        {/* Progress Bar - Only in exam mode */}
        {mode === "exam" && (
          <div className="mb-8 bg-white rounded-full h-3 shadow-sm">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{
                width: `${((currentBatch.length - remainingInBatch) / currentBatch.length) * 100}%`,
              }}
            />
          </div>
        )}
        {mode === "training" && (
          <div className="mb-8 bg-white rounded-full h-3 shadow-sm">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{
                width: `${((currentIndex + 1) / words.length) * 100}%`,
              }}
            />
          </div>
        )}

        {/* Word Card */}
        {mode === "exam" && currentWordProgress ? (
          <WordCard
            key={`${currentWordProgress.word.id}-${reverseDirection}`}
            word={currentWordProgress.word}
            isRevealed={isRevealed}
            onReveal={handleReveal}
            onAnswer={handleAnswer}
            reverseDirection={reverseDirection}
            onReverseDirection={() => setReverseDirection(!reverseDirection)}
          />
        ) : words.length > 0 && words[currentIndex] ? (
          <TrainingCard
            key={`${words[currentIndex].id}-${reverseDirection}`}
            word={words[currentIndex]}
            reverseDirection={reverseDirection}
            onReverseDirection={() => setReverseDirection(!reverseDirection)}
            onPrevious={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
            onNext={() => setCurrentIndex(Math.min(words.length - 1, currentIndex + 1))}
            hasPrevious={currentIndex > 0}
            hasNext={currentIndex < words.length - 1}
          />
        ) : null}
      </div>
    </div>
    </>
  );
}

