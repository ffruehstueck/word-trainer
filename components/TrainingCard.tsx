"use client";

import { Word } from "@/types";

interface TrainingCardProps {
  word: Word;
  reverseDirection?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
}

export default function TrainingCard({
  word,
  reverseDirection = false,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
}: TrainingCardProps) {
  const displaySource = reverseDirection ? word.target : word.source;
  const displayTarget = reverseDirection ? word.source : word.target;
  const displaySourceLanguage = reverseDirection ? word.targetLanguage : word.sourceLanguage;
  const displayTargetLanguage = reverseDirection ? word.sourceLanguage : word.targetLanguage;

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
        </div>

        {/* Target Language */}
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            {displayTargetLanguage}
          </div>
              <div className="text-4xl font-bold text-indigo-600 text-center py-8 hyphens-auto break-words">
                {displayTarget}
              </div>
        </div>
      </div>

      {/* Sticky buttons at bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-indigo-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4 z-50">
        <div className="max-w-2xl mx-auto">
          <div className="flex gap-4">
            <button
              onClick={onPrevious}
              disabled={!hasPrevious}
              className="flex-1 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed text-gray-700 font-semibold py-4 px-6 rounded-lg transition-colors duration-200 border-2 border-gray-300"
            >
              ← Previous
            </button>
            <button
              onClick={onNext}
              disabled={!hasNext}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-lg transition-colors duration-200 shadow-md"
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

