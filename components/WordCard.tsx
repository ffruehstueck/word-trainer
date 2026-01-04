"use client";

import { Word } from "@/types";
import { useMemo } from "react";

interface WordCardProps {
  word: Word;
  isRevealed: boolean;
  onReveal: () => void;
  onAnswer: (isCorrect: boolean) => void;
  reverseDirection?: boolean;
  onReverseDirection?: () => void;
}

// Scramble letters in a string (deterministic based on word id for consistency)
const scrambleText = (text: string, seed: number): string => {
  // Create a simple seeded random function
  let random = seed;
  const seededRandom = () => {
    random = (random * 9301 + 49297) % 233280;
    return random / 233280;
  };
  
  // Split by words to preserve word boundaries and spacing
  return text
    .split(/(\s+)/)
    .map((part) => {
      // Only scramble if it's a word (not whitespace)
      if (part.trim().length === 0) return part;
      
      // Split word into characters, scramble using seeded random, and rejoin
      const chars = part.split('');
      for (let i = chars.length - 1; i > 0; i--) {
        const j = Math.floor(seededRandom() * (i + 1));
        [chars[i], chars[j]] = [chars[j], chars[i]];
      }
      return chars.join('');
    })
    .join('');
};

export default function WordCard({ word, isRevealed, onReveal, onAnswer, reverseDirection = false, onReverseDirection }: WordCardProps) {
  const displaySource = reverseDirection ? word.target : word.source;
  const displayTarget = reverseDirection ? word.source : word.target;
  const displaySourceLanguage = reverseDirection ? word.targetLanguage : word.sourceLanguage;
  const displayTargetLanguage = reverseDirection ? word.sourceLanguage : word.targetLanguage;
  
  // Scramble the target text when not revealed (memoized for consistency)
  const scrambledTarget = useMemo(() => {
    if (isRevealed) return displayTarget;
    return scrambleText(displayTarget, word.id);
  }, [displayTarget, word.id, isRevealed]);

  return (
    <>
      <div className="bg-white rounded-2xl shadow-xl p-8 mb-24 notranslate">
        {/* Source Language */}
        <div className="mb-6">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            {displaySourceLanguage}
          </div>
              <div className="text-4xl font-bold text-gray-800 text-center py-8 hyphens-auto break-words">
                {displaySource}
              </div>
        </div>

        {/* Divider */}
        <div className="relative my-6">
          <div className="border-t border-gray-200"></div>
          {isRevealed && onReverseDirection && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white px-2">
              <button
                onClick={onReverseDirection}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-1.5 px-3 rounded-lg transition-colors duration-200 flex items-center gap-2 text-lg transform rotate-90 text-center"
                title="Reverse translation direction"
              >
                ⇄
              </button>
            </div>
          )}
        </div>

        {/* Target Language */}
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            {displayTargetLanguage}
          </div>
              <div
                className={`text-4xl font-bold text-center py-8 hyphens-auto ${
                  isRevealed
                    ? "text-indigo-600 opacity-100 transition-colors duration-200 break-words"
                    : "text-gray-300 opacity-50 blur-sm break-all"
                }`}
                style={isRevealed ? { overflowWrap: 'break-word' } : { wordBreak: 'break-all', overflowWrap: 'anywhere' }}
              >
                {isRevealed ? displayTarget : scrambledTarget}
              </div>
        </div>
      </div>

      {/* Sticky buttons at bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg p-4 z-50">
        <div className="max-w-2xl mx-auto">
          {isRevealed ? (
            <div className="flex gap-4">
              <button
                onClick={() => onAnswer(false)}
                className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 font-semibold py-4 px-6 rounded-lg transition-colors duration-200 border-2 border-red-300"
              >
                ✗ Incorrect
              </button>
              <button
                onClick={() => onAnswer(true)}
                className="flex-1 bg-green-100 hover:bg-green-200 text-green-700 font-semibold py-4 px-6 rounded-lg transition-colors duration-200 border-2 border-green-300"
              >
                ✓ Correct
              </button>
            </div>
          ) : (
            <div className="text-center">
              <button
                onClick={onReveal}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
              >
                Show Translation
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

