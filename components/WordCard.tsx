"use client";

import { Word } from "@/types";

interface WordCardProps {
  word: Word;
  isRevealed: boolean;
  onReveal: () => void;
  onAnswer: (isCorrect: boolean) => void;
  reverseDirection?: boolean;
  onReverseDirection?: () => void;
}

export default function WordCard({ word, isRevealed, onReveal, onAnswer, reverseDirection = false, onReverseDirection }: WordCardProps) {
  const displaySource = reverseDirection ? word.target : word.source;
  const displayTarget = reverseDirection ? word.source : word.target;
  const displaySourceLanguage = reverseDirection ? word.targetLanguage : word.sourceLanguage;
  const displayTargetLanguage = reverseDirection ? word.sourceLanguage : word.targetLanguage;

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
      {/* Source Language */}
      <div className="mb-6">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          {displaySourceLanguage}
        </div>
        <div className="text-4xl font-bold text-gray-800 text-center py-8">
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
          className={`text-4xl font-bold text-center py-8 ${
            isRevealed
              ? "text-indigo-600 opacity-100 transition-colors duration-200"
              : "text-gray-300 opacity-50 blur-sm"
          }`}
        >
          {displayTarget}
        </div>
      </div>

      {/* Reveal Button */}
      {!isRevealed && (
        <div className="mt-6 text-center">
          <button
            onClick={onReveal}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
          >
            Show Translation
          </button>
        </div>
      )}

      {/* Answer Buttons */}
      {isRevealed && (
        <div className="mt-8 flex gap-4">
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
      )}
    </div>
  );
}

