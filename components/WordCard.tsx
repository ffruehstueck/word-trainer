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
      {!isRevealed ? (
        // Clickable card before reveal
        <div 
          className="bg-white rounded-2xl shadow-xl p-8 mb-24 notranslate cursor-pointer hover:shadow-2xl transition-shadow duration-200"
          onClick={onReveal}
        >
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
          </div>

          {/* Target Language */}
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              {displayTargetLanguage}
            </div>
            <div
              className="text-4xl font-bold text-center py-8 hyphens-auto text-gray-300 opacity-50 blur-sm break-all"
              style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}
            >
              {scrambledTarget}
            </div>
          </div>
          
          {/* Hint text */}
          <div className="text-center mt-6 text-gray-400 text-sm">
            Click to reveal translation
          </div>
        </div>
      ) : (
        // Split card after reveal - single card with two clickable halves
        <div className="mb-24 relative rounded-2xl shadow-xl overflow-hidden notranslate bg-white">
          {/* Left half - Incorrect (clickable) */}
          <div 
            className="absolute left-0 top-0 bottom-0 w-1/2 cursor-pointer group z-20"
            onClick={() => onAnswer(false)}
          >
            {/* Red gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-red-500/30 to-transparent"></div>
          </div>

          {/* Right half - Correct (clickable) */}
          <div 
            className="absolute right-0 top-0 bottom-0 w-1/2 cursor-pointer group z-20 border-l border-gray-200"
            onClick={() => onAnswer(true)}
          >
            {/* Green gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-l from-green-500/30 to-transparent"></div>
          </div>

          {/* Content - shown once in center */}
          <div className="relative z-10 bg-white p-8 flex flex-col">
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
              {onReverseDirection && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white px-2 z-30">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onReverseDirection();
                    }}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-1.5 px-3 rounded-lg transition-colors duration-200 flex items-center gap-2 text-lg transform rotate-90 text-center"
                    title="Reverse translation direction"
                  >
                    ⇄
                  </button>
                </div>
              )}
            </div>

            {/* Target Language */}
            <div className="flex-1 mb-4">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                {displayTargetLanguage}
              </div>
              <div
                className="text-4xl font-bold text-center py-8 hyphens-auto text-indigo-600 opacity-100 transition-colors duration-200 break-words"
                style={{ overflowWrap: 'break-word' }}
              >
                {displayTarget}
              </div>
            </div>
            
            {/* Buttons at bottom - split across halves */}
            <div className="flex gap-0 relative z-30">
              {/* Incorrect Button - left half */}
              <div 
                className="w-1/2 pr-2 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onAnswer(false);
                }}
              >
                <div className="bg-red-100 group-hover:bg-red-200 text-red-700 font-semibold py-4 px-6 rounded-lg transition-colors duration-200 border-2 border-red-300 text-center">
                  ✗ Incorrect
                </div>
              </div>
              
              {/* Correct Button - right half */}
              <div 
                className="w-1/2 pl-2 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onAnswer(true);
                }}
              >
                <div className="bg-green-100 group-hover:bg-green-200 text-green-700 font-semibold py-4 px-6 rounded-lg transition-colors duration-200 border-2 border-green-300 text-center">
                  ✓ Correct
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

