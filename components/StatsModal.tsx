"use client";

import { SessionStats } from "@/types";

interface StatsModalProps {
  stats: SessionStats;
  onClose: () => void;
  onResume?: () => void;
  onStop?: () => void;
  isComplete?: boolean;
}

export default function StatsModal({ stats, onClose, onResume, onStop, isComplete = false }: StatsModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-gray-800">
              {isComplete ? "Session Complete!" : "Current Stats"}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 rounded-xl p-6 text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">
                {stats.totalWords}
              </div>
              <div className="text-sm text-gray-600 uppercase tracking-wider">
                Total Words
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-6 text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">
                {stats.correctWords}
              </div>
              <div className="text-sm text-gray-600 uppercase tracking-wider">
                Correct
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-6 text-center">
              <div className="text-3xl font-bold text-red-600 mb-2">
                {stats.incorrectWords}
              </div>
              <div className="text-sm text-gray-600 uppercase tracking-wider">
                Unknown
              </div>
            </div>
          </div>

          {/* Accuracy */}
          <div className="bg-gray-50 rounded-xl p-6 mb-6">
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

          {/* Translation Duration Stats */}
          {stats.averageDuration !== undefined && (
            <div className="bg-gray-50 rounded-xl p-6 mb-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Translation Speed</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg p-4 text-center border border-gray-200">
                  <div className="text-sm text-gray-600 mb-1">Quickest</div>
                  <div className="text-2xl font-bold text-green-600">
                    {(stats.quickestDuration! / 1000).toFixed(1)}s
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4 text-center border border-gray-200">
                  <div className="text-sm text-gray-600 mb-1">Average</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {(stats.averageDuration / 1000).toFixed(1)}s
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4 text-center border border-gray-200">
                  <div className="text-sm text-gray-600 mb-1">Slowest</div>
                  <div className="text-2xl font-bold text-orange-600">
                    {(stats.slowestDuration! / 1000).toFixed(1)}s
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Unknown Words */}
          {stats.unknownWords.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-6 mb-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                Words to Review ({stats.unknownWords.length})
              </h3>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {stats.unknownWords.map((word) => (
                  <div
                    key={word.id}
                    className="flex justify-between items-center p-4 bg-white rounded-lg border border-gray-200"
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

          {/* Action Buttons */}
          {!isComplete && (
            <div className="flex gap-3 justify-center flex-wrap">
              {onResume && (
                <button
                  onClick={onResume}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg flex items-center gap-2"
                >
                  <span>▶</span>
                  <span>Resume</span>
                </button>
              )}
              {!onResume && (
                <button
                  onClick={onClose}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
                >
                  Continue Training
                </button>
              )}
              {onStop && (
                <button
                  onClick={onStop}
                  className="bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg flex items-center gap-2"
                >
                  <span>⏹</span>
                  <span>Stop</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

