import type { Word, WordProgress } from '../types';

export const REVIEW_COUNT = 8;
export const REVIEW_HISTORY_KEY = 'word-trainer-review-history';
export type ReviewHistory = Record<string, { correct: number; incorrect: number }>;

export function wordKey(word: Word): string {
  return JSON.stringify([word.sourceLanguage, word.targetLanguage, word.source, word.target]);
}

// Recover difficulty from older saved exams, even before history tracking existed.
export function readReviewHistory(storage: Storage): ReviewHistory {
  let history: ReviewHistory = {};
  try {
    history = JSON.parse(storage.getItem(REVIEW_HISTORY_KEY) || '{}');
    if (!history || typeof history !== 'object' || Array.isArray(history)) history = {};
  } catch { /* A damaged history must not prevent starting an exam. */ }
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith('word-trainer-progress-') || !key.endsWith('-exam')) continue;
    try {
      const saved = JSON.parse(storage.getItem(key) || '{}');
      for (const [, progress] of saved.allProgress || []) {
        const p = progress as WordProgress;
        if (!p.word || !p.attempts) continue;
        const identity = wordKey(p.word);
        if (history[identity]) continue;
        history[identity] = {
          correct: p.isCorrect ? 1 : 0,
          incorrect: Math.max(0, p.attempts - (p.isCorrect ? 1 : 0)),
        };
      }
    } catch { /* Ignore invalid saved sessions. */ }
  }
  return history;
}

export function selectReviewWords(pool: Word[], current: Word[], history: ReviewHistory, random = Math.random): Word[] {
  const seen = new Set(current.map(wordKey));
  return pool.filter(word => {
    const key = wordKey(word);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(word => {
    const stats = history[wordKey(word)];
    const incorrect = Math.max(0, Number(stats?.incorrect) || 0);
    const correct = Math.max(0, Number(stats?.correct) || 0);
    return { word, score: incorrect / (correct + incorrect + 1), tie: random() };
  }).sort((a, b) => b.score - a.score || a.tie - b.tie)
    .slice(0, REVIEW_COUNT).map(({ word }) => word);
}
