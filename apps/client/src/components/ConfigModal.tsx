import { X } from 'lucide-react';
import React from 'react';
import { ConfigScreen } from '../pages/ConfigScreen';

interface ConfigModalProps {
  onClose: () => void;
}

export function ConfigModal({ onClose }: ConfigModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[95vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 p-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Configuration</h2>
              <p className="text-sm text-gray-500">Webhook and handler settings</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Save button will be inside ConfigScreen, but if needed, can move */}
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <ConfigScreen isModal onClose={onClose} />
        </div>
      </div>
    </div>
  );
}
