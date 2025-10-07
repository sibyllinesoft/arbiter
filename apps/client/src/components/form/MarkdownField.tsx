import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';

import MarkdownPreview from '@uiw/react-markdown-preview';
import MDEditor, { commands } from '@uiw/react-md-editor';
import { clsx } from 'clsx';
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

  const handleToggleMode = () => {
    setMode(prev => (prev === 'preview' ? 'edit' : 'preview'));
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
        <button
          type="button"
          onClick={handleToggleMode}
          className="text-xs font-medium text-blue-600 hover:text-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 dark:text-blue-300"
        >
          {mode === 'preview' ? 'Edit Markdown' : 'Preview Markdown'}
        </button>
      </div>

      {mode === 'preview' ? (
        <div
          id={id}
          className={clsx(
            'rounded-md border border-gray-200 bg-white p-4 shadow-sm transition-colors',
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
                '[&>*]:prose [&>*]:max-w-none prose-sm prose-slate dark:prose-invert'
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
