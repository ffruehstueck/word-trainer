"use client";

import { useState, useEffect, useCallback } from "react";
import WordCard from "@/components/WordCard";
import TrainingCard from "@/components/TrainingCard";
import SessionComplete from "@/components/SessionComplete";
import StatsModal from "@/components/StatsModal";
import InactivityModal from "@/components/InactivityModal";
import { Word, WordProgress, SessionStats } from "@/types";
import { FileOption } from "@/lib/data";
import { getWordsForFile } from "@/lib/data";

interface TrainingSessionProps {
  initialAvailableFiles: FileOption[];
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

export default function TrainingSession({ initialAvailableFiles }: TrainingSessionProps) {
  const [words, setWords] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [revealStartTime, setRevealStartTime] = useState<number | null>(null);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [allProgress, setAllProgress] = useState<Map<number, WordProgress>>(new Map());
  const [showStats, setShowStats] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string>(
    process.env.NEXT_PUBLIC_DEFAULT_WORD_FILE || 
    (process.env.NODE_ENV === 'development' ? 'test.json' : 'unit-8.json')
  );
  const [isLoading, setIsLoading] = useState(false);
  const [availableFiles] = useState<FileOption[]>(initialAvailableFiles);
  const [reverseDirection, setReverseDirection] = useState(false);
  const [mode, setMode] = useState<"exam" | "training" | null>(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  
  // Timer state
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [lastInteractionTime, setLastInteractionTime] = useState<number | null>(null);
  const [sessionTime, setSessionTime] = useState<number>(0);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [breakEndTime, setBreakEndTime] = useState<number | null>(null);
  const [highScore, setHighScore] = useState<number>(0);
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
  const saveProgress = useCallback((file: string, currentMode: "exam" | "training") => {
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
  }, [allProgress, currentIndex, reverseDirection]);

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
      const checkTranslation = () => {
        const hasGoogleTranslate = 
          document.getElementById("google_translate_element") ||
          document.querySelector('.goog-te-banner-frame') ||
          document.body.classList.contains('translated-ltr') ||
          document.body.classList.contains('translated-rtl') ||
          (document.documentElement && document.documentElement.getAttribute('translated') === 'yes');
        
        if (hasGoogleTranslate) {
          setShowTranslationWarning(true);
        } else {
          setShowTranslationWarning(false);
        }
      };

      checkTranslation();
      const interval = setInterval(checkTranslation, 1000);
      
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

  // Timer logic: track session time and check for inactivity/breaks
  useEffect(() => {
    if (isOnBreak) {
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
      const interval = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - sessionStartTime) / 1000);
        setSessionTime(elapsed);
        
        // Check for inactivity (2 minute = 120 seconds)
        if (lastInteractionTime && (now - lastInteractionTime) > 120000) {
          setSessionStartTime(null);
          setSessionTime(0);
          setLastInteractionTime(null);
          setShowInactivityModal(true);
          return;
        }
        
        // Check for forced break (15 minutes = 900 seconds)
        if (elapsed >= 900) {
          setIsOnBreak(true);
          setBreakEndTime(now + 300000);
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

  // Load saved progress when file/mode changes
  useEffect(() => {
    if (words.length === 0) return;
    if (!mode || !sessionStarted) return;
    
    const saved = loadProgress(selectedFile, mode);
    if (saved && saved.selectedFile === selectedFile && saved.mode === mode) {
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

  const loadWords = useCallback(async (fileSelection: string, resetProgress = false, targetMode?: "exam" | "training" | null) => {
    if (availableFiles.length === 0) return;
    
    setIsLoading(true);
    try {
      // Fetch words from API route (client-side fetch)
      const response = await fetch(`/api/words?file=${encodeURIComponent(fileSelection)}`);
      if (!response.ok) {
        throw new Error(`Failed to load ${fileSelection}`);
      }
      let allWords: Word[] = await response.json();

      // Use targetMode if provided, otherwise fall back to current mode state
      const modeToUse = targetMode !== undefined ? targetMode : mode;

      // Transform words for exam mode: if source has 3 parts separated by " - ", split them
      if (modeToUse === "exam") {
        allWords = allWords.map((word) => {
          const sourceParts = word.source.split(' - ').map(part => part.trim());
          if (sourceParts.length === 3) {
            // Keep first part as source, combine last two parts with target
            return {
              ...word,
              source: sourceParts[0],
              target: `${sourceParts[1]} - ${sourceParts[2]} / ${word.target}`
            };
          }
          return word;
        });
      }

      // Ensure unique IDs
      allWords = allWords.map((word, index) => ({
        ...word,
        id: index + 1,
      }));

      // For exam mode: check if we should filter to remaining words or start fresh
      let wordsToShow = allWords;
      if (modeToUse === "exam" && !resetProgress) {
        const saved = loadProgress(fileSelection, "exam");
        if (saved && saved.allProgress.length > 0) {
          const progressMap = new Map(saved.allProgress);
          
          // Check if all words are completed
          const allCompleted = allWords.every((word) => {
            const progress = progressMap.get(word.id);
            return progress && progress.isCorrect;
          });
          
          if (!allCompleted) {
            // Filter to only words that aren't correct yet
            wordsToShow = allWords.filter((word) => {
              const progress = progressMap.get(word.id);
              return !progress || !progress.isCorrect;
            });
          } else {
            // All completed - reset progress to start over
            resetProgress = true;
          }
        }
      }
      
      // Shuffle words only in exam mode (after filtering)
      if (modeToUse === "exam") {
        wordsToShow = shuffleArray(wordsToShow);
      }

      // Check if we got any words
      if (allWords.length === 0) {
        console.error(`No words found in file: ${fileSelection}`);
        setWords([]);
        setIsLoading(false);
        return;
      }

      setWords(wordsToShow);
      
      if (resetProgress) {
        setAllProgress(new Map());
        setCurrentIndex(0);
        setIsRevealed(false);
      } else if (modeToUse === "exam" && wordsToShow.length !== allWords.length) {
        // If we filtered words in exam mode, reset index to 0 since we have a new filtered/shuffled list
        setCurrentIndex(0);
        setIsRevealed(false);
      }
      
      // Initialize progress for all words (not just filtered ones)
      // This ensures progress tracking works for all words, even if not currently shown
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
      setWords([]);
    } finally {
      setIsLoading(false);
    }
  }, [availableFiles, mode, shuffleArray]);

  useEffect(() => {
    if (availableFiles.length > 0 && selectedFile && !sessionStarted) {
      loadWords(selectedFile, false);
    }
  }, [selectedFile, availableFiles.length, sessionStarted, loadWords]);

  // Reset revealed state whenever the word index changes (exam mode only)
  useEffect(() => {
    if (mode === "exam") {
      setIsRevealed(false);
      setRevealStartTime(null);
    }
  }, [currentIndex, mode]);

  // Reset current index when switching modes
  useEffect(() => {
    if (mode === "training") {
      setCurrentIndex(0);
      setIsRevealed(false);
    }
  }, [mode]);

  const handleInteraction = useCallback(() => {
    if (!sessionStartTime) {
      setSessionStartTime(Date.now());
    }
    setLastInteractionTime(Date.now());
  }, [sessionStartTime]);

  const handleReveal = () => {
    const now = Date.now();
    setIsRevealed(true);
    setRevealStartTime(now);
    setLastInteractionTime(now);
  };

  // Check if a file/mode is already completed
  const isFileCompleted = useCallback((file: string, currentMode: "exam" | "training"): boolean => {
    if (words.length === 0) {
      // If words aren't loaded yet, check from saved progress
      const saved = loadProgress(file, currentMode);
      if (!saved || saved.allProgress.length === 0) return false;
      
      // We can't fully verify without words, but if we have progress saved, 
      // we can check if all saved progress entries are marked correct
      const progressMap = new Map(saved.allProgress);
      const allProgressEntries = Array.from(progressMap.values());
      if (allProgressEntries.length === 0) return false;
      
      // Check if all saved progress entries are marked as correct
      return allProgressEntries.every((progress) => progress.isCorrect);
    }
    
    const saved = loadProgress(file, currentMode);
    if (!saved || saved.allProgress.length === 0) return false;
    
    const progressMap = new Map(saved.allProgress);
    // Check if all words are marked as correct
    const allCompleted = words.every((word) => {
      const progress = progressMap.get(word.id);
      return progress && progress.isCorrect;
    });
    return allCompleted;
  }, [words]);

  const handleStartSession = (selectedMode: "exam" | "training") => {
    setMode(selectedMode);
    setSessionStarted(true);
    const now = Date.now();
    setSessionStartTime(now);
    setLastInteractionTime(now);
    setShowInactivityModal(false);
    // Reload words for the current selected file to ensure we have the latest data
    // For training mode, always reset. For exam mode, loadWords will check if we should reset
    if (selectedFile && availableFiles.length > 0) {
      const shouldReset = selectedMode === "training"; // Always reset for training mode
      loadWords(selectedFile, shouldReset, selectedMode);
    }
  };

  const handleRedo = (selectedMode: "exam" | "training") => {
    // Clear progress and start fresh
    if (selectedFile) {
      clearProgress(selectedFile, selectedMode);
      setAllProgress(new Map());
      setCurrentIndex(0);
      setIsRevealed(false);
      setSessionComplete(false);
      handleStartSession(selectedMode);
    }
  };

  const handleResumeFromInactivity = () => {
    const now = Date.now();
    setSessionStartTime(now);
    setLastInteractionTime(now);
    setShowInactivityModal(false);
  };

  const handleRestartFromInactivity = () => {
    setShowInactivityModal(false);
    handleRestart();
  };

  const handleAnswer = (isCorrect: boolean) => {
    if (!isRevealed) return;

    const now = Date.now();
    setLastInteractionTime(now);

    const duration = revealStartTime ? now - revealStartTime : null;

    setIsRevealed(false);
    setRevealStartTime(null);

    const currentWord = words[currentIndex];
    if (!currentWord) return;
    
    setAllProgress((prev) => {
      const newMap = new Map(prev);
      const existingProgress = newMap.get(currentWord.id) || {
        word: currentWord,
        isCorrect: false,
        attempts: 0,
        durations: [],
      };
      
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
    
    moveToNextWord();
  };

  const moveToNextWord = () => {
    const progressArray: WordProgress[] = words.map((word) => {
      return allProgress.get(word.id) || {
        word,
        isCorrect: false,
        attempts: 0,
        durations: [],
      };
    });
    
    const remainingWords = progressArray.filter((wp) => !wp.isCorrect);
    
    if (remainingWords.length === 0) {
      calculateFinalStats();
      setSessionComplete(true);
    } else {
      const currentWordId = words[currentIndex]?.id;
      let nextIndex = -1;
      
      for (let i = currentIndex + 1; i < words.length; i++) {
        const progress = progressArray[i];
        if (!progress.isCorrect) {
          nextIndex = i;
          break;
        }
      }
      
      if (nextIndex === -1) {
        for (let i = 0; i < currentIndex; i++) {
          const progress = progressArray[i];
          if (!progress.isCorrect) {
            nextIndex = i;
            break;
          }
        }
      }
      
      if (nextIndex === -1) {
        nextIndex = progressArray.findIndex((wp) => !wp.isCorrect);
      }
      
      if (nextIndex !== -1) {
        setCurrentIndex(nextIndex);
      }
    }
  };

  const calculateCurrentStats = (): SessionStats => {
    // Calculate stats from all words in progress, not just the filtered words array
    // This ensures stats reflect overall progress even when words array is filtered
    const progressArray: WordProgress[] = Array.from(allProgress.values());
    
    const correctWords = progressArray.filter((wp) => wp.isCorrect);
    const unknownWords = progressArray.filter((wp) => !wp.isCorrect).map((wp) => wp.word);
    
    const totalWords = progressArray.length;
    const correctCount = correctWords.length;
    const incorrectCount = unknownWords.length;
    const accuracy = totalWords > 0 ? (correctCount / totalWords) * 100 : 0;

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

  const handleStop = () => {
    // Show stats modal when stopping (works for both exam and training modes)
    const currentStats = calculateCurrentStats();
    setStats(currentStats);
    setShowStats(true);
  };

  const handleResume = () => {
    // Resume the session from stats modal
    setShowStats(false);
    // Timer will continue from where it left off if sessionStartTime is still set
  };

  const handleStopFromModal = () => {
    // Actually stop the session and return to start screen (keep progress)
    setSessionStartTime(null);
    setSessionTime(0);
    setLastInteractionTime(null);
    setIsOnBreak(false);
    setBreakEndTime(null);
    setMode(null);
    setSessionStarted(false);
    setIsRevealed(false);
    setShowStats(false);
    setShowInactivityModal(false);
  };

  const handleRestart = () => {
    clearProgress(selectedFile, mode || "exam");
    setSessionComplete(false);
    setStats(null);
    setAllProgress(new Map());
    setCurrentIndex(0);
    setIsRevealed(false);
    setSessionStartTime(null);
    setSessionTime(0);
    setLastInteractionTime(null);
    setIsOnBreak(false);
    setBreakEndTime(null);
    setMode(null);
    setSessionStarted(false);
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

  // Show mode selection screen if session hasn't started
  if (!sessionStarted || !mode) {
    // Only show loading screen if actively loading and we don't have words yet
    if (isLoading && words.length === 0) {
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

    const examCompleted = isFileCompleted(selectedFile, "exam");
    const trainingCompleted = isFileCompleted(selectedFile, "training");

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
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="relative">
              <button
                onClick={() => handleStartSession("exam")}
                disabled={isLoading}
                className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all duration-200 border-2 border-blue-200 hover:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed w-full"
              >
                <div className="text-5xl mb-4">🎯</div>
                <h2 className="text-2xl font-bold text-gray-800 mb-3">Exam Mode</h2>
                {examCompleted && (
                  <div className="mb-3 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold inline-block">
                    ✓ Already Done
                  </div>
                )}
                <p className="text-gray-600 mb-4">
                  Test your knowledge! Words are hidden and shuffled. Mark your answers as correct or incorrect.
                </p>
                <div className="text-sm text-gray-500">
                  • Words are scrambled<br/>
                  • Track your progress<br/>
                  • Review missed words
                </div>
              </button>
              {examCompleted && (
                <button
                  onClick={() => handleRedo("exam")}
                  className="mt-3 w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 shadow-md"
                >
                  🔄 Redo Exam
                </button>
              )}
            </div>

            <div className="relative">
            <button
              onClick={() => handleStartSession("training")}
              disabled={isLoading}
              className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all duration-200 border-2 border-green-200 hover:border-green-400 disabled:opacity-50 disabled:cursor-not-allowed w-full"
            >
                <div className="text-5xl mb-4">📚</div>
                <h2 className="text-2xl font-bold text-gray-800 mb-3">Training Mode</h2>
                {trainingCompleted && (
                  <div className="mb-3 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold inline-block">
                    ✓ Already Done
                  </div>
                )}
                <p className="text-gray-600 mb-4">
                  Learn at your own pace! Both source and target are visible. Navigate through words freely.
                </p>
                <div className="text-sm text-gray-500">
                  • All translations visible<br/>
                  • Navigate freely<br/>
                  • No shuffling
                </div>
              </button>
              {trainingCompleted && (
                <button
                  onClick={() => handleRedo("training")}
                  className="mt-3 w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 shadow-md"
                >
                  🔄 Redo Training
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Only show loading screen if actively loading, not if words array is empty after loading
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading words...</p>
        </div>
      </div>
    );
  }

  // If we're not loading but have no words and session has started, show error
  if ((mode === "exam" && words.length === 0 && sessionStarted) || (mode === "training" && words.length === 0 && sessionStarted)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">No Words Found</h2>
          <p className="text-gray-600 mb-6">
            The selected file ({selectedFile}) appears to be empty or could not be loaded.
          </p>
          <button
            onClick={() => {
              setMode(null);
              setSessionStarted(false);
              setCurrentIndex(0);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors duration-200"
          >
            Back to Start
          </button>
        </div>
      </div>
    );
  }

  const currentWord = words[currentIndex] || null;
  const currentWordProgress = mode === "exam" && currentWord ? 
    (allProgress.get(currentWord.id) || { word: currentWord, isCorrect: false, attempts: 0, durations: [] }) : null;
  
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
      {showStats && (currentStats || stats) && (
        <StatsModal
          stats={currentStats || stats!}
          onClose={handleStopFromModal}
          onResume={mode && sessionStarted ? handleResume : undefined}
          onStop={handleStopFromModal}
          isComplete={false}
        />
      )}
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          {showTranslationWarning && (
            <div className="mb-4 bg-yellow-100 border-2 border-yellow-400 rounded-lg p-4 text-center notranslate">
              <p className="text-yellow-800 font-semibold">
                ⚠️ Browser auto-translation detected! Please disable it for the best learning experience.
              </p>
            </div>
          )}
          <div className="mb-8 text-center notranslate">
            <h1 className="text-4xl font-bold text-gray-800 mb-4">Word Trainer</h1>
            {sessionStartTime && !isOnBreak && (
              <div className="mb-4 flex justify-center items-center gap-4 flex-wrap">
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
                <button
                  onClick={() => {
                    setReverseDirection(!reverseDirection);
                    handleInteraction();
                  }}
                  disabled={mode === "exam" && !isRevealed}
                  className={`font-semibold py-2 px-4 rounded-lg transition-colors duration-200 flex items-center gap-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${
                    reverseDirection
                      ? "bg-indigo-500 hover:bg-indigo-600 text-white disabled:hover:bg-indigo-500"
                      : "bg-gray-200 hover:bg-gray-300 text-gray-700 disabled:hover:bg-gray-200"
                  }`}
                  title={mode === "exam" && !isRevealed ? "Reveal translation first" : "Reverse translation direction"}
                >
                  <span className="text-lg transform rotate-90">⇄</span>
                  <span className="hidden sm:inline">Reverse</span>
                </button>
                <button
                  onClick={handleStop}
                  className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 flex items-center gap-2 shadow-md"
                  title="Stop Session"
                >
                  <span>⏹</span>
                  <span className="hidden sm:inline">Stop</span>
                </button>
              </div>
            )}
          </div>

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

          {mode === "exam" && currentWordProgress ? (
            <WordCard
              key={`${currentWordProgress.word.id}-${reverseDirection}`}
              word={currentWordProgress.word}
              isRevealed={isRevealed}
              onReveal={handleReveal}
              onAnswer={handleAnswer}
              reverseDirection={reverseDirection}
            />
          ) : words.length > 0 && words[currentIndex] ? (
            <TrainingCard
              key={`${words[currentIndex].id}-${reverseDirection}`}
              word={words[currentIndex]}
              reverseDirection={reverseDirection}
              onPrevious={() => {
                setCurrentIndex(Math.max(0, currentIndex - 1));
                handleInteraction();
              }}
              onNext={() => {
                setCurrentIndex(Math.min(words.length - 1, currentIndex + 1));
                handleInteraction();
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

