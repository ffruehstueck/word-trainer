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
}

export interface SessionStats {
  totalWords: number;
  correctWords: number;
  incorrectWords: number;
  accuracy: number;
  unknownWords: Word[];
}

