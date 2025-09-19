import React, { useState, useMemo } from 'react';
import {
  Copy,
  Check,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { MonacoEditor } from '../Editor/MonacoEditor';

interface CueViewerProps {
  /** CUE source code to display */
  cueSource: string;
  /** Optional title for the viewer */
  title?: string;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show copy button */
  showCopyButton?: boolean;
  /** Whether to show line numbers */
  showLineNumbers?: boolean;
  /** Validation errors to highlight */
  validationErrors?: ValidationError[];
  /** Whether to allow editing */
  editable?: boolean;
  /** Callback when CUE content changes */
  onChange?: (content: string) => void;
  /** Display mode */
  mode?: 'view' | 'edit' | 'split';
  /** Optional resolved data to show alongside */
  resolvedData?: any;
}

interface ValidationError {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export const CueViewer: React.FC<CueViewerProps> = ({
  cueSource,
  title,
  className = '',
  showCopyButton = true,
  showLineNumbers = true,
  validationErrors = [],
  editable = false,
  onChange,
  mode = 'view',
  resolvedData,
}) => {
  const [copied, setCopied] = useState(false);
  const [currentContent, setCurrentContent] = useState(cueSource);
  const [showValidationDetails, setShowValidationDetails] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleContentChange = (content: string) => {
    setCurrentContent(content);
    onChange?.(content);
  };

  // Analyze CUE content for metadata
  const cueMetadata = useMemo(() => {
    const lines = currentContent.split('\n');
    const packageMatch = lines.find(line => line.startsWith('package '));
    const importLines = lines.filter(line => line.trim().startsWith('import '));
    const commentLines = lines.filter(line => line.trim().startsWith('//'));

    // Count top-level definitions
    const definitions = lines.filter(line => {
      const trimmed = line.trim();
      return (
        trimmed &&
        !trimmed.startsWith('//') &&
        !trimmed.startsWith('import ') &&
        !trimmed.startsWith('package ') &&
        trimmed.includes(':') &&
        !trimmed.includes(':{')
      );
    }).length;

    return {
      package: packageMatch?.replace('package ', '').trim(),
      imports: importLines.length,
      comments: commentLines.length,
      definitions,
      lines: lines.length,
    };
  }, [currentContent]);

  const validationSummary = useMemo(() => {
    const errors = validationErrors.filter(e => e.severity === 'error').length;
    const warnings = validationErrors.filter(e => e.severity === 'warning').length;
    const info = validationErrors.filter(e => e.severity === 'info').length;

    return { errors, warnings, info, total: validationErrors.length };
  }, [validationErrors]);

  const ValidationSummary = () => {
    if (validationErrors.length === 0) {
      return (
        <div className="flex items-center text-green-600 text-sm">
          <CheckCircle className="w-4 h-4 mr-2" />
          <span>No validation issues</span>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <button
          onClick={() => setShowValidationDetails(!showValidationDetails)}
          className="flex items-center text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          {showValidationDetails ? (
            <ChevronDown className="w-4 h-4 mr-1" />
          ) : (
            <ChevronRight className="w-4 h-4 mr-1" />
          )}
          Validation Issues ({validationSummary.total})
        </button>

        <div className="flex items-center space-x-4 text-xs">
          {validationSummary.errors > 0 && (
            <div className="flex items-center text-red-600">
              <XCircle className="w-3 h-3 mr-1" />
              {validationSummary.errors} errors
            </div>
          )}
          {validationSummary.warnings > 0 && (
            <div className="flex items-center text-yellow-600">
              <AlertTriangle className="w-3 h-3 mr-1" />
              {validationSummary.warnings} warnings
            </div>
          )}
          {validationSummary.info > 0 && (
            <div className="flex items-center text-blue-600">
              <Info className="w-3 h-3 mr-1" />
              {validationSummary.info} info
            </div>
          )}
        </div>

        {showValidationDetails && (
          <div className="border border-gray-200 rounded-md bg-gray-50 max-h-48 overflow-y-auto">
            <div className="p-3 space-y-2">
              {validationErrors.map((error, index) => (
                <div key={index} className="flex items-start space-x-2 text-xs">
                  <div className="flex-shrink-0 mt-0.5">
                    {error.severity === 'error' && <XCircle className="w-3 h-3 text-red-500" />}
                    {error.severity === 'warning' && (
                      <AlertTriangle className="w-3 h-3 text-yellow-500" />
                    )}
                    {error.severity === 'info' && <Info className="w-3 h-3 text-blue-500" />}
                  </div>
                  <div className="flex-1">
                    <div className="font-mono text-gray-500">
                      Line {error.line}, Column {error.column}
                    </div>
                    <div className="text-gray-700">{error.message}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const MetadataPanel = () => (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
      <h4 className="text-sm font-semibold text-gray-700">CUE Metadata</h4>

      <div className="grid grid-cols-2 gap-4 text-xs">
        <div>
          <div className="text-gray-500">Package</div>
          <div className="font-mono text-blue-600">{cueMetadata.package || 'none'}</div>
        </div>
        <div>
          <div className="text-gray-500">Lines</div>
          <div className="font-mono">{cueMetadata.lines}</div>
        </div>
        <div>
          <div className="text-gray-500">Imports</div>
          <div className="font-mono">{cueMetadata.imports}</div>
        </div>
        <div>
          <div className="text-gray-500">Definitions</div>
          <div className="font-mono">{cueMetadata.definitions}</div>
        </div>
      </div>

      <ValidationSummary />
    </div>
  );

  const EditorPanel = () => (
    <div className="h-full border border-gray-200 rounded-lg overflow-hidden">
      {editable ? (
        <MonacoEditor
          value={currentContent}
          onChange={handleContentChange}
          language="cue"
          theme="cue-light"
          options={{
            lineNumbers: showLineNumbers ? 'on' : 'off',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            readOnly: !editable,
            wordWrap: 'on',
          }}
        />
      ) : (
        <div className="bg-gray-900 text-gray-100 h-full overflow-auto">
          <MonacoEditor
            value={currentContent}
            onChange={() => {}} // No-op for read-only
            language="cue"
            theme="cue-dark"
            options={{
              lineNumbers: showLineNumbers ? 'on' : 'off',
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              readOnly: true,
              wordWrap: 'on',
            }}
          />
        </div>
      )}
    </div>
  );

  const ResolvedDataPanel = () => {
    if (!resolvedData) return null;

    return (
      <div className="h-full border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-white h-full">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h4 className="text-sm font-semibold text-gray-700">Resolved Data</h4>
          </div>
          <div className="p-4 h-full overflow-auto">
            <pre className="text-xs font-mono bg-gray-50 p-3 rounded border overflow-auto">
              {JSON.stringify(resolvedData, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          {title && <h3 className="text-lg font-medium text-gray-900">{title}</h3>}
          <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
            <span>CUE Specification</span>
            {cueMetadata.package && (
              <span>
                Package:{' '}
                <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">
                  {cueMetadata.package}
                </code>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {showCopyButton && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-3 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
              title={copied ? 'Copied!' : 'Copy CUE source'}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {mode === 'split' ? (
        <div className="grid grid-cols-2 gap-4 h-96">
          <div className="space-y-4">
            <MetadataPanel />
            <EditorPanel />
          </div>
          <ResolvedDataPanel />
        </div>
      ) : (
        <div className="space-y-4">
          <MetadataPanel />
          <div className="h-96">
            <EditorPanel />
          </div>
          {resolvedData && (
            <div className="h-64">
              <ResolvedDataPanel />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CueViewer;
