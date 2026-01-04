export interface Word {
  id: number;
  source: string;
  target: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export interface WordProgress {
  word: Word;
  isCorrect: boolean;
  attempts: number;
  durations?: number[]; // Duration in milliseconds for each attempt
}

export interface SessionStats {
  totalWords: number;
  correctWords: number;
  incorrectWords: number;
  accuracy: number;
  unknownWords: Word[];
  quickestDuration?: number; // in milliseconds
  slowestDuration?: number; // in milliseconds
  averageDuration?: number; // in milliseconds
}

