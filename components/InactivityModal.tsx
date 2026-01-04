"use client";

interface InactivityModalProps {
  onResume: () => void;
  onRestart: () => void;
}

export default function InactivityModal({ onResume, onRestart }: InactivityModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="p-6">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="text-5xl mb-4">⏸️</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Session Paused
            </h2>
            <p className="text-gray-600">
              Your session was paused due to inactivity. Would you like to resume?
            </p>
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-3">
            <button
              onClick={onResume}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
            >
              Resume Training
            </button>
            <button
              onClick={onRestart}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
            >
              Start New Session
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

