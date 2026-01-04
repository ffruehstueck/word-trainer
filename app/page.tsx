"use client";

import { useState, useEffect, useCallback } from "react";
import WordCard from "@/components/WordCard";
import TrainingCard from "@/components/TrainingCard";
import SessionComplete from "@/components/SessionComplete";
import StatsModal from "@/components/StatsModal";
import InactivityModal from "@/components/InactivityModal";
import { Word, WordProgress, SessionStats } from "@/types";

interface FileOption {
  value: string;
  label: string;
}

interface PersistedProgress {
  allProgress: Array<[number, WordProgress]>;
  currentIndex: number;
  selectedFile: string;
  mode: "exam" | "training";
  reverseDirection: boolean;
  timestamp: number;
}

const STORAGE_KEY_PREFIX = "word-trainer-progress";

// Format time in seconds to MM:SS
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

export default function Home() {
  const [words, setWords] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [revealStartTime, setRevealStartTime] = useState<number | null>(null); // Track when translation was revealed
  const [sessionComplete, setSessionComplete] = useState(false);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [allProgress, setAllProgress] = useState<Map<number, WordProgress>>(new Map());
  const [showStats, setShowStats] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string>("unit-8.json");
  const [isLoading, setIsLoading] = useState(false);
  const [availableFiles, setAvailableFiles] = useState<FileOption[]>([]);
  const [reverseDirection, setReverseDirection] = useState(false);
  const [mode, setMode] = useState<"exam" | "training" | null>(null); // null means not started yet
  const [sessionStarted, setSessionStarted] = useState(false);
  
  // Timer state
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [lastInteractionTime, setLastInteractionTime] = useState<number | null>(null);
  const [sessionTime, setSessionTime] = useState<number>(0); // in seconds
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [breakEndTime, setBreakEndTime] = useState<number | null>(null);
  const [highScore, setHighScore] = useState<number>(0); // in seconds
  const [showInactivityModal, setShowInactivityModal] = useState(false);

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
        currentIndex,
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

  // Detect browser auto-translation and show warning
  const [showTranslationWarning, setShowTranslationWarning] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      // Check for Google Translate overlay
      const checkTranslation = () => {
        // Google Translate adds elements with specific IDs/classes
        const hasGoogleTranslate = 
          document.getElementById("google_translate_element") ||
          document.querySelector('.goog-te-banner-frame') ||
          document.body.classList.contains('translated-ltr') ||
          document.body.classList.contains('translated-rtl') ||
          // Check for translation attribute changes
          (document.documentElement && document.documentElement.getAttribute('translated') === 'yes');
        
        if (hasGoogleTranslate) {
          setShowTranslationWarning(true);
        }
      };

      // Check immediately and periodically
      checkTranslation();
      const interval = setInterval(checkTranslation, 1000);
      
      // Also check on DOM mutations (Google Translate modifies the DOM)
      const observer = new MutationObserver(checkTranslation);
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ['class'],
        childList: true,
        subtree: true
      });

      return () => {
        clearInterval(interval);
        observer.disconnect();
      };
    }
  }, []);

  // Load high score from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("word-trainer-highscore");
        if (saved) {
          setHighScore(parseInt(saved, 10));
        }
      } catch (err) {
        console.error("Error loading high score:", err);
      }
    }
  }, []);

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
  
  // Timer logic: track session time and check for inactivity/breaks
  useEffect(() => {
    if (isOnBreak) {
      // Break timer
      const interval = setInterval(() => {
        if (breakEndTime) {
          const now = Date.now();
          if (now >= breakEndTime) {
            setIsOnBreak(false);
            setBreakEndTime(null);
            setSessionStartTime(null);
            setSessionTime(0);
            setLastInteractionTime(null);
          }
        }
      }, 1000);
      return () => clearInterval(interval);
    } else if (sessionStartTime) {
      // Active learning timer
      const interval = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - sessionStartTime) / 1000);
        setSessionTime(elapsed);
        
        // Check for inactivity (2 minute = 120 seconds)
        if (lastInteractionTime && (now - lastInteractionTime) > 120000) {
          // 2 minutes of inactivity - pause timer and show modal
          setSessionStartTime(null);
          setSessionTime(0);
          setLastInteractionTime(null);
          setShowInactivityModal(true);
          return;
        }
        
        // Check for forced break (15 minutes = 900 seconds)
        if (elapsed >= 900) {
          setIsOnBreak(true);
          setBreakEndTime(now + 300000); // 5 minutes = 300000ms
          // Update high score if this session is longer
          if (elapsed > highScore) {
            const newHighScore = elapsed;
            setHighScore(newHighScore);
            try {
              localStorage.setItem("word-trainer-highscore", newHighScore.toString());
            } catch (err) {
              console.error("Error saving high score:", err);
            }
          }
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [sessionStartTime, lastInteractionTime, isOnBreak, breakEndTime, highScore]);

  // Load saved progress when file/mode changes (but only after words are loaded and session has started)
  useEffect(() => {
    if (words.length === 0) return;
    if (!mode || !sessionStarted) return; // Don't restore if session hasn't started
    
    const saved = loadProgress(selectedFile, mode);
    if (saved && saved.selectedFile === selectedFile && saved.mode === mode) {
      // Restore progress
      setAllProgress(new Map(saved.allProgress));
      setReverseDirection(saved.reverseDirection);
      setCurrentIndex(Math.min(saved.currentIndex, words.length - 1));
    }
  }, [selectedFile, mode, sessionStarted, words.length]);

  // Save progress whenever it changes
  useEffect(() => {
    if (words.length === 0) return;
    if (mode) {
      saveProgress(selectedFile, mode);
    }
  }, [allProgress, currentIndex, selectedFile, mode, reverseDirection, words.length, saveProgress]);

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

      // Shuffle words only in exam mode (if mode is set)
      if (mode === "exam") {
        allWords = shuffleArray(allWords);
      }

      // Ensure unique IDs across all words (renumber sequentially to avoid conflicts)
      allWords = allWords.map((word, index) => ({
        ...word,
        id: index + 1,
      }));

      setWords(allWords);
      
      // Only reset progress if explicitly requested (new session)
      if (resetProgress) {
        setAllProgress(new Map());
        setCurrentIndex(0);
        setIsRevealed(false);
      }
      
      // Initialize progress for all words if not already in allProgress
      if (allWords.length > 0) {
        setAllProgress((prev) => {
          const newMap = new Map(prev);
          allWords.forEach((word) => {
            if (!newMap.has(word.id)) {
              newMap.set(word.id, {
                word,
                isCorrect: false,
                attempts: 0,
                durations: [],
              });
            }
          });
          return newMap;
        });
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


  const handleReveal = () => {
    const now = Date.now();
    setIsRevealed(true);
    setRevealStartTime(now); // Start tracking duration for this translation
    
    // Update last interaction time
    setLastInteractionTime(now);
  };
  
  const handleStartSession = (selectedMode: "exam" | "training") => {
    setMode(selectedMode);
    setSessionStarted(true);
    // Start timer when session starts
    const now = Date.now();
    setSessionStartTime(now);
    setLastInteractionTime(now);
    setShowInactivityModal(false);
  };

  const handleResumeFromInactivity = () => {
    // Resume the timer
    const now = Date.now();
    setSessionStartTime(now);
    setLastInteractionTime(now);
    setShowInactivityModal(false);
  };

  const handleRestartFromInactivity = () => {
    // Start a new session
    setShowInactivityModal(false);
    handleRestart();
  };

  const handleAnswer = (isCorrect: boolean) => {
    if (!isRevealed) return;

    const now = Date.now();
    // Update last interaction time
    setLastInteractionTime(now);

    // Calculate duration if we have a start time
    const duration = revealStartTime ? now - revealStartTime : null;

    // Reset revealed state immediately to prevent showing next word's answer
    setIsRevealed(false);
    setRevealStartTime(null);

    const currentWord = words[currentIndex];
    if (!currentWord) return;
    
    // Update progress for current word
    setAllProgress((prev) => {
      const newMap = new Map(prev);
      const existingProgress = newMap.get(currentWord.id) || {
        word: currentWord,
        isCorrect: false,
        attempts: 0,
        durations: [],
      };
      
      // Add duration to the durations array if available
      const updatedDurations = existingProgress.durations ? [...existingProgress.durations] : [];
      if (duration !== null) {
        updatedDurations.push(duration);
      }
      
      const updatedProgress: WordProgress = {
        ...existingProgress,
        attempts: existingProgress.attempts + 1,
        isCorrect: isCorrect,
        durations: updatedDurations,
      };
      
      newMap.set(currentWord.id, updatedProgress);
      return newMap;
    });
    
    // Move to next word or check if all words are complete
    moveToNextWord();
  };

  const moveToNextWord = () => {
    // Get all words with their progress
    const progressArray: WordProgress[] = words.map((word) => {
      return allProgress.get(word.id) || {
        word,
        isCorrect: false,
        attempts: 0,
        durations: [],
      };
    });
    
    // Find next word that hasn't been answered correctly
    const remainingWords = progressArray.filter((wp) => !wp.isCorrect);
    
    if (remainingWords.length === 0) {
      // All words are correct - session complete
      calculateFinalStats();
      setSessionComplete(true);
    } else {
      // Find next incorrect word (cycling through)
      const currentWordId = words[currentIndex]?.id;
      let nextIndex = -1;
      
      // Try to find next incorrect word after current index
      for (let i = currentIndex + 1; i < words.length; i++) {
        const progress = progressArray[i];
        if (!progress.isCorrect) {
          nextIndex = i;
          break;
        }
      }
      
      // If not found, wrap around
      if (nextIndex === -1) {
        for (let i = 0; i < currentIndex; i++) {
          const progress = progressArray[i];
          if (!progress.isCorrect) {
            nextIndex = i;
            break;
          }
        }
      }
      
      // If still not found, take first incorrect word
      if (nextIndex === -1) {
        nextIndex = progressArray.findIndex((wp) => !wp.isCorrect);
      }
      
      if (nextIndex !== -1) {
        setCurrentIndex(nextIndex);
      }
    }
  };

  const calculateCurrentStats = (): SessionStats => {
    // Get progress for all words
    const progressArray: WordProgress[] = words.map((word) => {
      return allProgress.get(word.id) || {
        word,
        isCorrect: false,
        attempts: 0,
        durations: [],
      };
    });
    
    const correctWords = progressArray.filter((wp) => wp.isCorrect);
    const unknownWords = progressArray.filter((wp) => !wp.isCorrect).map((wp) => wp.word);
    
    const totalWords = progressArray.length;
    const correctCount = correctWords.length;
    const incorrectCount = unknownWords.length;
    const accuracy = totalWords > 0 ? (correctCount / totalWords) * 100 : 0;

    // Calculate duration statistics
    const allDurations: number[] = [];
    progressArray.forEach((wp) => {
      if (wp.durations && wp.durations.length > 0) {
        allDurations.push(...wp.durations);
      }
    });

    let quickestDuration: number | undefined;
    let slowestDuration: number | undefined;
    let averageDuration: number | undefined;

    if (allDurations.length > 0) {
      quickestDuration = Math.min(...allDurations);
      slowestDuration = Math.max(...allDurations);
      averageDuration = allDurations.reduce((sum, d) => sum + d, 0) / allDurations.length;
    }

    return {
      totalWords,
      correctWords: correctCount,
      incorrectWords: incorrectCount,
      accuracy,
      unknownWords,
      quickestDuration,
      slowestDuration,
      averageDuration,
    };
  };

  const calculateFinalStats = () => {
    const currentStats = calculateCurrentStats();
    setStats(currentStats);
  };

  const handleRestart = () => {
    clearProgress(selectedFile, mode || "exam");
    setSessionComplete(false);
    setStats(null);
    setAllProgress(new Map());
    setCurrentIndex(0);
    setIsRevealed(false);
    // Reset timer and session
    setSessionStartTime(null);
    setSessionTime(0);
    setLastInteractionTime(null);
    setIsOnBreak(false);
    setBreakEndTime(null);
    setMode(null);
    setSessionStarted(false);
    // Reload words to reset everything
    loadWords(selectedFile, true);
  };

  // Break screen
  if (isOnBreak && breakEndTime) {
    const now = Date.now();
    const remainingSeconds = Math.ceil((breakEndTime - now) / 1000);
    const remainingTime = formatTime(Math.max(0, remainingSeconds));
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-100 flex items-center justify-center py-8 px-4">
        <div className="max-w-2xl mx-auto text-center bg-white rounded-2xl shadow-xl p-8">
          <div className="text-6xl mb-4">☕</div>
          <h1 className="text-4xl font-bold text-gray-800 mb-4">Take a Break!</h1>
          <p className="text-lg text-gray-600 mb-6">
            You've been learning for 15 minutes. Please take a 5-minute break before continuing.
          </p>
          <div className="text-6xl font-bold text-indigo-600 mb-6">{remainingTime}</div>
          <p className="text-sm text-gray-500">
            Your longest learning session: {formatTime(highScore)}
          </p>
        </div>
      </div>
    );
  }

  if (sessionComplete && stats) {
    return <SessionComplete stats={stats} onRestart={handleRestart} />;
  }

  // Show mode selection screen if session hasn't started (check this BEFORE loading check)
  if (!sessionStarted || !mode) {
    // Show loading state on start screen if words aren't loaded yet
    if (isLoading || words.length === 0) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-8 px-4">
          <div className="max-w-2xl mx-auto w-full">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-gray-800 mb-4">Word Trainer</h1>
              <div className="flex justify-center items-center gap-3 mb-8">
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
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading words...</p>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-8 px-4">
        <div className="max-w-2xl mx-auto w-full">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-4">Word Trainer</h1>
            <div className="flex justify-center items-center gap-3 mb-8">
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
            <p className="text-lg text-gray-600 mb-8">Choose your learning mode:</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Exam Mode Button */}
            <button
              onClick={() => handleStartSession("exam")}
              disabled={isLoading}
              className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all duration-200 border-2 border-blue-200 hover:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="text-5xl mb-4">🎯</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-3">Exam Mode</h2>
              <p className="text-gray-600 mb-4">
                Test your knowledge! Words are hidden and shuffled. Mark your answers as correct or incorrect.
              </p>
              <div className="text-sm text-gray-500">
                • Words are scrambled<br/>
                • Track your progress<br/>
                • Review missed words
              </div>
            </button>

            {/* Training Mode Button */}
            <button
              onClick={() => handleStartSession("training")}
              disabled={isLoading || words.length === 0}
              className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all duration-200 border-2 border-green-200 hover:border-green-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="text-5xl mb-4">📚</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-3">Training Mode</h2>
              <p className="text-gray-600 mb-4">
                Learn at your own pace! Both source and target are visible. Navigate through words freely.
              </p>
              <div className="text-sm text-gray-500">
                • All translations visible<br/>
                • Navigate freely<br/>
                • No shuffling
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Get current word progress for exam mode
  const currentWord = words[currentIndex] || null;
  const currentWordProgress = mode === "exam" && currentWord ? 
    (allProgress.get(currentWord.id) || { word: currentWord, isCorrect: false, attempts: 0 }) : null;
  
  // Calculate stats and remaining words for exam mode
  const currentStats = mode === "exam" ? calculateCurrentStats() : null;
  const totalWords = words.length;
  const correctWordsCount = currentStats ? currentStats.correctWords : 0;
  const remainingWords = totalWords - correctWordsCount;

  return (
    <>
      {showInactivityModal && (
        <InactivityModal
          onResume={handleResumeFromInactivity}
          onRestart={handleRestartFromInactivity}
        />
      )}
      {showStats && currentStats && (
        <StatsModal
          stats={currentStats}
          onClose={() => setShowStats(false)}
          isComplete={false}
        />
      )}
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Translation Warning */}
          {showTranslationWarning && (
            <div className="mb-4 bg-yellow-100 border-2 border-yellow-400 rounded-lg p-4 text-center notranslate">
              <p className="text-yellow-800 font-semibold">
                ⚠️ Browser auto-translation detected! Please disable it for the best learning experience.
              </p>
            </div>
          )}
          {/* Header */}
          <div className="mb-8 text-center notranslate">
            <h1 className="text-4xl font-bold text-gray-800 mb-4">Word Trainer</h1>
            {/* Timer display */}
            {sessionStartTime && !isOnBreak && (
              <div className="mb-4 flex justify-center items-center gap-4">
                <div className="bg-white rounded-lg px-4 py-2 shadow-sm border border-gray-200">
                  <span className="text-sm text-gray-600 mr-2">⏱️ Learning time:</span>
                  <span className="text-lg font-bold text-indigo-600">{formatTime(sessionTime)}</span>
                </div>
                {highScore > 0 && (
                  <div className="bg-white rounded-lg px-4 py-2 shadow-sm border border-gray-200">
                    <span className="text-sm text-gray-600 mr-2">🏆 Best:</span>
                    <span className="text-lg font-bold text-gray-700">{formatTime(highScore)}</span>
                  </div>
                )}
              </div>
            )}
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
          </div>

        {/* Progress Bar - Shows progress across all words */}
        {mode === "exam" && (
          <div className="mb-8">
            <div className="text-xs text-gray-600 text-center mb-2">
              {correctWordsCount} / {totalWords}
            </div>
            <div className="bg-white rounded-full h-3 shadow-sm">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                style={{
                  width: `${totalWords > 0 ? (correctWordsCount / totalWords) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        )}
        {mode === "training" && (
          <div className="mb-8">
            <div className="text-xs text-gray-600 text-center mb-2">
              {currentIndex + 1} / {words.length}
            </div>
            <div className="bg-white rounded-full h-3 shadow-sm">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                style={{
                  width: `${((currentIndex + 1) / words.length) * 100}%`,
                }}
              />
            </div>
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
            onReverseDirection={() => {
              setReverseDirection(!reverseDirection);
              setLastInteractionTime(Date.now());
            }}
          />
            ) : words.length > 0 && words[currentIndex] ? (
              <TrainingCard
                key={`${words[currentIndex].id}-${reverseDirection}`}
                word={words[currentIndex]}
                reverseDirection={reverseDirection}
                onReverseDirection={() => {
                  setReverseDirection(!reverseDirection);
                  setLastInteractionTime(Date.now());
                }}
                onPrevious={() => {
                  setCurrentIndex(Math.max(0, currentIndex - 1));
                  setLastInteractionTime(Date.now());
                }}
                onNext={() => {
                  setCurrentIndex(Math.min(words.length - 1, currentIndex + 1));
                  setLastInteractionTime(Date.now());
                }}
                hasPrevious={currentIndex > 0}
                hasNext={currentIndex < words.length - 1}
              />
            ) : null}
      </div>
    </div>
    </>
  );
}

