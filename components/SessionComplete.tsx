"use client";

import { SessionStats } from "@/types";

interface SessionCompleteProps {
  stats: SessionStats;
  onRestart: () => void;
}

export default function SessionComplete({ stats, onRestart }: SessionCompleteProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Session Complete!</h1>
          <p className="text-gray-600">Great job completing the training session</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">
              {stats.totalWords}
            </div>
            <div className="text-sm text-gray-600 uppercase tracking-wider">
              Total Words
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <div className="text-3xl font-bold text-green-600 mb-2">
              {stats.correctWords}
            </div>
            <div className="text-sm text-gray-600 uppercase tracking-wider">
              Correct
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <div className="text-3xl font-bold text-red-600 mb-2">
              {stats.incorrectWords}
            </div>
            <div className="text-sm text-gray-600 uppercase tracking-wider">
              Unknown
            </div>
          </div>
        </div>

        {/* Accuracy */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <span className="text-lg font-semibold text-gray-800">Accuracy</span>
            <span className="text-2xl font-bold text-indigo-600">
              {stats.accuracy.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className="bg-gradient-to-r from-blue-500 to-indigo-600 h-4 rounded-full transition-all duration-500"
              style={{ width: `${stats.accuracy}%` }}
            />
          </div>
        </div>

        {/* Unknown Words */}
        {stats.unknownWords.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Words to Review ({stats.unknownWords.length})
            </h2>
            <div className="space-y-3">
              {stats.unknownWords.map((word) => (
                <div
                  key={word.id}
                  className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800">{word.source}</div>
                    <div className="text-sm text-gray-500">{word.sourceLanguage}</div>
                  </div>
                  <div className="text-2xl text-gray-300 mx-4">→</div>
                  <div className="flex-1 text-right">
                    <div className="font-semibold text-indigo-600">{word.target}</div>
                    <div className="text-sm text-gray-500">{word.targetLanguage}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Restart Button */}
        <div className="text-center">
          <button
            onClick={onRestart}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-8 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg text-lg"
          >
            Start New Session
          </button>
        </div>
      </div>
    </div>
  );
}

