import React from 'react';

interface FeedbackModalProps {
  message: string;
  onClose: () => void;
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({ message, onClose }) => {
  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-80 backdrop-blur-sm flex flex-col items-center justify-center z-50 text-white p-4">
      <div className="w-full max-w-sm bg-gray-800 border border-gray-700 rounded-xl shadow-2xl p-8 text-center">
        <div className="mb-2 text-5xl">🎉</div>
        <h3 className="text-xl font-bold text-white mb-4">對時完成！</h3>
        <p className="text-gray-300 mb-6">{message}</p>
        <button
          onClick={onClose}
          className="w-full px-4 py-2 text-sm font-bold text-gray-900 bg-[#a6a6a6] hover:bg-[#999999] border border-white/50 rounded-lg transition-colors"
        >
          繼續預覽
        </button>
      </div>
    </div>
  );
};

export default FeedbackModal;