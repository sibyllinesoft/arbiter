import { clsx } from 'clsx';
import { X } from 'lucide-react';
import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl';
  maxHeight?: string;
  backdropClass?: string;
  hasBlur?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  className = '',
  maxWidth = '4xl',
  maxHeight = '90vh',
  hasBlur = true,
  backdropClass,
}) => {
  if (!isOpen) return null;

  const maxWidthClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    '7xl': 'max-w-7xl',
  }[maxWidth];

  return (
    <div
      className={clsx(
        'fixed inset-0 z-50 p-4 flex items-center justify-center',
        backdropClass || (hasBlur ? 'bg-black/20 backdrop-blur-sm' : 'bg-black/20'),
        className
      )}
      onClick={onClose}
    >
      <div
        className={clsx(
          'bg-white rounded-lg shadow-2xl w-full flex flex-col overflow-hidden',
          maxWidthClass,
          `max-h-[${maxHeight}]`
        )}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        {(title || true) && (
          <div className="sticky top-0 z-10 bg-white border-b border-gray-200 p-8 flex justify-between items-center">
            <div className="flex items-center gap-3">
              {title && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
                  {title === 'Configuration' && (
                    <p className="text-sm text-gray-500">Webhook and handler settings</p>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        {/* Body */}
        <div className="flex-1 overflow-y-auto p-8">{children}</div>
      </div>
    </div>
  );
};
