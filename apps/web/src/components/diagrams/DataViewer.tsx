import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface DataViewerProps {
  data: string | object;
  language?: 'yaml' | 'json' | 'javascript' | 'typescript';
  title?: string;
  className?: string;
  showCopyButton?: boolean;
}

export const DataViewer: React.FC<DataViewerProps> = ({
  data,
  language = 'yaml',
  title,
  className = '',
  showCopyButton = true,
}) => {
  const [copied, setCopied] = useState(false);

  const dataString = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(dataString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getLanguageClass = () => {
    switch (language) {
      case 'json':
        return 'language-json';
      case 'javascript':
        return 'language-javascript';
      case 'typescript':
        return 'language-typescript';
      default:
        return 'language-yaml';
    }
  };

  return (
    <div className={`relative ${className}`}>
      {title && (
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-700">{title}</h4>
          {showCopyButton && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
              title={copied ? 'Copied!' : 'Copy to clipboard'}
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  Copy
                </>
              )}
            </button>
          )}
        </div>
      )}

      <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto max-h-96 text-sm font-mono">
        <pre className={getLanguageClass()}>
          <code>{dataString}</code>
        </pre>
      </div>
    </div>
  );
};

export default DataViewer;