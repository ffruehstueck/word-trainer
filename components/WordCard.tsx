"use client";

import { Word } from "@/types";
import { useState, useEffect } from "react";

interface WordCardProps {
  word: Word;
  isRevealed: boolean;
  onReveal: () => void;
  onAnswer: (isCorrect: boolean) => void;
}

export default function WordCard({ word, isRevealed, onReveal, onAnswer }: WordCardProps) {
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    setLastScrollY(window.scrollY);
    
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      // Auto-reveal when user scrolls up (scroll position decreases by more than 100px)
      if (lastScrollY > 0 && currentScrollY < lastScrollY - 100 && !isRevealed) {
        onReveal();
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isRevealed, onReveal, lastScrollY]);

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
      {/* Source Language */}
      <div className="mb-6">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          {word.sourceLanguage}
        </div>
        <div className="text-4xl font-bold text-gray-800 text-center py-8">
          {word.source}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200 my-6"></div>

      {/* Target Language */}
      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          {word.targetLanguage}
        </div>
        <div
          className={`text-4xl font-bold text-center py-8 ${
            isRevealed
              ? "text-indigo-600 opacity-100 transition-colors duration-200"
              : "text-gray-300 opacity-50 blur-sm"
          }`}
        >
          {word.target}
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
          <p className="text-xs text-gray-500 mt-2">or scroll up to reveal</p>
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

