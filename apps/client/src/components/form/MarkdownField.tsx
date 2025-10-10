import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';

import MarkdownPreview from '@uiw/react-markdown-preview';
import MDEditor, { commands } from '@uiw/react-md-editor';
import { clsx } from 'clsx';
import { Eye, Pencil } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

export interface MarkdownFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  description?: string;
  error?: string;
}

const MINIMAL_COMMANDS = [
  commands.bold,
  commands.italic,
  commands.strikethrough,
  commands.code,
  commands.link,
  commands.unorderedListCommand,
  commands.orderedListCommand,
  commands.codeBlock,
  commands.quote,
];

export const MarkdownField: React.FC<MarkdownFieldProps> = ({
  id,
  label,
  value,
  onChange,
  placeholder,
  required = false,
  description,
  error,
}) => {
  const [mode, setMode] = useState<'preview' | 'edit'>('preview');
  const [colorMode, setColorMode] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const updateMode = () => {
      const prefersDark = document.documentElement.classList.contains('dark');
      setColorMode(prefersDark ? 'dark' : 'light');
    };

    updateMode();

    const observer = new MutationObserver(updateMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, []);

  const displayValue = useMemo(() => value ?? '', [value]);
  const showEmptyState = !displayValue.trim();

  useEffect(() => {
    if (!displayValue.trim() && mode !== 'edit') {
      setMode('edit');
    }
  }, [displayValue, mode]);

  const handleSelectMode = (nextMode: 'preview' | 'edit') => {
    setMode(nextMode);
  };

  const handleChange = (nextValue?: string) => {
    onChange(nextValue ?? '');
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={id}
          className="text-sm font-medium text-graphite-700 dark:text-graphite-100"
        >
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
        </label>
        <div role="tablist" aria-label="Toggle markdown view" className="flex items-center gap-1">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'edit'}
            onClick={() => handleSelectMode('edit')}
            className={clsx(
              'flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors',
              mode === 'edit'
                ? 'text-blue-600 dark:text-blue-300'
                : 'text-graphite-400 hover:text-blue-600 dark:text-graphite-500 dark:hover:text-blue-300'
            )}
          >
            <Pencil className="h-3.5 w-3.5" />
            <span>Edit</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'preview'}
            onClick={() => handleSelectMode('preview')}
            disabled={!displayValue.trim()}
            className={clsx(
              'flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors',
              !displayValue.trim()
                ? 'text-graphite-300 dark:text-graphite-600 cursor-not-allowed'
                : mode === 'preview'
                  ? 'text-blue-600 dark:text-blue-300'
                  : 'text-graphite-400 hover:text-blue-600 dark:text-graphite-500 dark:hover:text-blue-300'
            )}
          >
            <Eye className="h-3.5 w-3.5" />
            <span>View</span>
          </button>
        </div>
      </div>

      {mode === 'preview' ? (
        <div
          id={id}
          className={clsx(
            'rounded-md border border-gray-200 bg-white shadow-sm transition-colors',
            'dark:border-graphite-600 dark:bg-graphite-900'
          )}
        >
          {showEmptyState ? (
            <p className="text-sm italic text-graphite-400 dark:text-graphite-500">
              {placeholder || 'No description yet. Switch to edit to add details.'}
            </p>
          ) : (
            <MarkdownPreview
              className={clsx(
                'p-4 [&>*]:my-0 [&>*:not(:first-child)]:mt-4 [&>*:not(:last-child)]:mb-4',
                'prose-sm prose-slate dark:prose-invert'
              )}
              source={displayValue}
            />
          )}
        </div>
      ) : (
        <div
          data-color-mode={colorMode}
          className={clsx(
            'rounded-md border border-gray-200 shadow-sm transition-colors',
            'dark:border-graphite-600'
          )}
        >
          <MDEditor
            value={displayValue}
            onChange={handleChange}
            height={240}
            preview="edit"
            commands={MINIMAL_COMMANDS}
            extraCommands={[commands.codePreview, commands.fullscreen]}
            visibleDragbar={false}
            textareaProps={{
              id,
              placeholder,
              spellCheck: true,
            }}
          />
        </div>
      )}

      {description && (
        <p className="text-xs text-graphite-500 dark:text-graphite-300">{description}</p>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
};

export default MarkdownField;
