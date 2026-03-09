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

export interface SessionWordAggregate {
  wordId: number;
  incorrectCount: number;
  correctCount: number;
}

export interface LoggingIdentity {
  systemFingerprintHash?: string;
  anonymousClientId?: string;
}

export interface TrainingAnswerEventPayload extends LoggingIdentity {
  sessionId: string;
  timestamp: string;
  mode: "exam";
  selectedFile: string;
  wordId: number;
  source?: string;
  target?: string;
  isCorrect: boolean;
  attemptNumber: number;
  durationMs: number | null;
  reverseDirection: boolean;
}

export interface TrainingSessionFinalizePayload extends LoggingIdentity {
  sessionId: string;
  startedAt: string;
  endedAt: string;
  mode: "exam";
  selectedFile: string;
  knownCount: number;
  unknownCount: number;
  totalAnswers: number;
  unknownByWord: SessionWordAggregate[];
}
