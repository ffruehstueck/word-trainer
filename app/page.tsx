"use client";

import { useState, useEffect } from "react";
import WordCard from "@/components/WordCard";
import SessionComplete from "@/components/SessionComplete";
import StatsModal from "@/components/StatsModal";
import { Word, WordProgress, SessionStats } from "@/types";

const BATCH_SIZE = 20; // Suggested batch size

interface FileOption {
  value: string;
  label: string;
}

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
  const [selectedFile, setSelectedFile] = useState<string>("words.json");
  const [isLoading, setIsLoading] = useState(false);
  const [availableFiles, setAvailableFiles] = useState<FileOption[]>([]);

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
          { value: "words.json", label: "Words" },
        ]);
      });
  }, []);

  const loadWords = async (fileSelection: string) => {
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
      setBatchNumber(1);
      setAllProgress(new Map());
      if (batches.length > 0) {
        initializeBatch(batches[0]);
      }
    } catch (err) {
      console.error("Error loading words:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (availableFiles.length > 0 && selectedFile) {
      loadWords(selectedFile);
    }
  }, [selectedFile, availableFiles.length]);

  // Reset revealed state whenever the word index changes
  useEffect(() => {
    setIsRevealed(false);
  }, [currentIndex]);

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

  if (sessionComplete && stats) {
    return <SessionComplete stats={stats} onRestart={() => window.location.reload()} />;
  }

  if (isLoading || currentBatch.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading words...</p>
        </div>
      </div>
    );
  }

  const currentWordProgress = currentBatch[currentIndex];
  const remainingInBatch = currentBatch.filter((wp) => !wp.isCorrect).length;
  const currentStats = calculateCurrentStats();

  return (
    <>
      {showStats && (
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
              <div className="w-32">
                <select
                  value={selectedFile}
                  onChange={(e) => setSelectedFile(e.target.value)}
                  className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                  disabled={isLoading || availableFiles.length === 0}
                >
                  {availableFiles.map((file) => (
                    <option key={file.value} value={file.value}>
                      {file.label}
                    </option>
                  ))}
                  <option value="all">All Files</option>
                </select>
              </div>
              <button
                onClick={() => setShowStats(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 flex items-center gap-2 shadow-md"
                title="Show Stats"
              >
                <span>📊</span>
                <span className="hidden sm:inline">Stats</span>
              </button>
            </div>
            <div className="flex justify-center items-center gap-4 text-sm text-gray-600">
              <span>Batch {batchNumber} of {allBatches.length}</span>
              <span>•</span>
              <span>{remainingInBatch} remaining in batch</span>
            </div>
          </div>

        {/* Progress Bar */}
        <div className="mb-8 bg-white rounded-full h-3 shadow-sm">
          <div
            className="bg-blue-600 h-3 rounded-full transition-all duration-300"
            style={{
              width: `${((currentBatch.length - remainingInBatch) / currentBatch.length) * 100}%`,
            }}
          />
        </div>

        {/* Word Card */}
        <WordCard
          key={currentWordProgress.word.id}
          word={currentWordProgress.word}
          isRevealed={isRevealed}
          onReveal={handleReveal}
          onAnswer={handleAnswer}
        />
      </div>
    </div>
    </>
  );
}

