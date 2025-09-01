/**
 * Monaco editor component with CUE syntax highlighting
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import Editor from '@monaco-editor/react';
import { editor } from 'monaco-editor';
import { clsx } from 'clsx';
import type { EditorProps } from '../../types/ui';

// CUE language definition for Monaco
const CUE_LANGUAGE_CONFIG = {
  // Language configuration
  comments: {
    lineComment: '//',
    blockComment: ['/*', '*/'],
  },
  brackets: [
    ['{', '}'],
    ['[', ']'],
    ['(', ')'],
  ],
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"', notIn: ['string'] },
    { open: "'", close: "'", notIn: ['string'] },
  ],
  surroundingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
  folding: {
    markers: {
      start: new RegExp('^\\s*//\\s*#?region\\b'),
      end: new RegExp('^\\s*//\\s*#?endregion\\b'),
    },
  },
};

// CUE tokenizer
const CUE_TOKENIZER = {
  root: [
    // Comments
    [/\/\/.*$/, 'comment'],
    [/\/\*/, 'comment', '@comment'],

    // Keywords
    [/\b(package|import|if|for|in|let)\b/, 'keyword'],
    
    // Built-in types
    [/\b(string|int|float|bool|bytes|null|top|bottom)\b/, 'keyword.type'],
    
    // Built-in functions and operators
    [/\b(len|close|and|or|div|mod|quo|rem)\b/, 'keyword.operator'],
    
    // Numbers
    [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
    [/\d+([eE][\-+]?\d+)?/, 'number'],
    
    // Strings
    [/"([^"\\]|\\.)*$/, 'string.invalid'],  // non-terminated string
    [/"/, 'string', '@string_double'],
    [/'([^'\\]|\\.)*$/, 'string.invalid'],  // non-terminated string
    [/'/, 'string', '@string_single'],
    [/`/, 'string', '@string_backtick'],
    
    // Characters
    [/'[^\\']'/, 'string'],
    [/(')(@escapes)(')/, ['string', 'string.escape', 'string']],
    [/'/, 'string.invalid'],

    // Identifiers and references
    [/#[a-zA-Z_$][\w$]*/, 'variable.name'],
    [/[a-zA-Z_$][\w$]*/, 'identifier'],
    
    // Field references
    [/\$[a-zA-Z_][\w]*/, 'variable'],
    
    // Operators
    [/[{}()\[\]]/, '@brackets'],
    [/[<>](?!@symbols)/, '@brackets'],
    [/@symbols/, 'operator'],
    
    // Whitespace
    [/[ \t\r\n]+/, ''],
  ],

  comment: [
    [/[^\/*]+/, 'comment'],
    [/\*\//, 'comment', '@pop'],
    [/[\/*]/, 'comment'],
  ],

  string_double: [
    [/[^\\"]+/, 'string'],
    [/@escapes/, 'string.escape'],
    [/\\./, 'string.escape.invalid'],
    [/"/, 'string', '@pop'],
  ],

  string_single: [
    [/[^\\']+/, 'string'],
    [/@escapes/, 'string.escape'],
    [/\\./, 'string.escape.invalid'],
    [/'/, 'string', '@pop'],
  ],

  string_backtick: [
    [/[^\\`]+/, 'string'],
    [/@escapes/, 'string.escape'],
    [/\\./, 'string.escape.invalid'],
    [/`/, 'string', '@pop'],
  ],
};

// Escape sequences
const escapes = /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/;

export interface MonacoEditorProps extends EditorProps {
  fragmentId?: string;
  onEditorReady?: (editor: editor.IStandaloneCodeEditor) => void;
}

export function MonacoEditor({
  value,
  onChange,
  onSave,
  fragmentId,
  language = 'cue',
  theme = 'vs',
  options = {},
  className,
  onEditorReady,
}: MonacoEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);

  // Default editor options optimized for CUE
  const defaultOptions: editor.IStandaloneEditorConstructionOptions = {
    automaticLayout: true,
    fontSize: 14,
    fontFamily: "'Fira Code', 'Consolas', 'Monaco', 'Courier New', monospace",
    lineHeight: 21,
    minimap: { enabled: true, scale: 0.7 },
    scrollBeyondLastLine: false,
    wordWrap: 'on',
    wordWrapColumn: 100,
    lineNumbers: 'on',
    renderLineHighlight: 'line',
    cursorStyle: 'line',
    cursorBlinking: 'blink',
    folding: true,
    foldingStrategy: 'indentation',
    showFoldingControls: 'mouseover',
    matchBrackets: 'always',
    autoIndent: 'advanced',
    formatOnPaste: true,
    formatOnType: true,
    tabSize: 2,
    insertSpaces: true,
    detectIndentation: true,
    trimAutoWhitespace: true,
    scrollbar: {
      verticalScrollbarSize: 10,
      horizontalScrollbarSize: 10,
    },
    ...options,
  };

  // Register CUE language on mount
  useEffect(() => {
    import('monaco-editor').then((monaco) => {
      // Check if CUE language is already registered
      const languages = monaco.languages.getLanguages();
      const cueExists = languages.some(lang => lang.id === 'cue');
      
      if (!cueExists) {
        // Register CUE language
        monaco.languages.register({ id: 'cue' });
        
        // Set language configuration
        monaco.languages.setLanguageConfiguration('cue', CUE_LANGUAGE_CONFIG);
        
        // Set tokenizer
        monaco.languages.setMonarchTokensProvider('cue', {
          ...CUE_TOKENIZER,
          escapes,
          symbols: /[=><!~?:&|+\-*\/\^%]+/,
        });

        // Define CUE theme
        monaco.editor.defineTheme('cue-light', {
          base: 'vs',
          inherit: true,
          rules: [
            { token: 'comment', foreground: '6A9955' },
            { token: 'keyword', foreground: '0000FF', fontStyle: 'bold' },
            { token: 'keyword.type', foreground: '1976D2', fontStyle: 'bold' },
            { token: 'keyword.operator', foreground: '7C4DFF' },
            { token: 'string', foreground: 'CE9178' },
            { token: 'string.escape', foreground: 'D7BA7D' },
            { token: 'number', foreground: '098658' },
            { token: 'number.float', foreground: '098658' },
            { token: 'variable.name', foreground: '795548', fontStyle: 'italic' },
            { token: 'variable', foreground: '9C27B0' },
            { token: 'identifier', foreground: '212121' },
          ],
          colors: {
            'editor.background': '#fafafa',
            'editor.lineHighlightBackground': '#f5f5f5',
            'editorLineNumber.foreground': '#999999',
            'editorIndentGuide.background': '#e0e0e0',
          },
        });
      }
    });
  }, []);

  // Handle editor mount
  const handleEditorDidMount = useCallback((
    editor: editor.IStandaloneCodeEditor,
    monaco: typeof import('monaco-editor')
  ) => {
    editorRef.current = editor;
    setIsEditorReady(true);

    // Add save keyboard shortcut
    if (onSave) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        onSave();
      });
    }

    // Enable format on save
    editor.getModel()?.onDidChangeContent(() => {
      // Debounced auto-format could go here
    });

    // Add custom completions for CUE
    monaco.languages.registerCompletionItemProvider('cue', {
      provideCompletionItems: (model, position) => {
        const suggestions = [
          {
            label: 'package',
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: 'package ${1:name}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Define a package',
          },
          {
            label: 'import',
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: 'import "${1:path}"',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Import a package',
          },
          {
            label: 'if',
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: 'if ${1:condition} {\n\t$0\n}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Conditional expression',
          },
          {
            label: 'for',
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: 'for ${1:key}, ${2:value} in ${3:object} {\n\t$0\n}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'For loop',
          },
          {
            label: 'let',
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: 'let ${1:name} = ${2:value}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Let binding',
          },
        ];

        return { suggestions };
      },
    });

    // Add hover provider for built-ins
    monaco.languages.registerHoverProvider('cue', {
      provideHover: (model, position) => {
        const word = model.getWordAtPosition(position);
        if (!word) return;

        const builtins: Record<string, string> = {
          'string': 'Built-in string type',
          'int': 'Built-in integer type',
          'float': 'Built-in floating point type',
          'bool': 'Built-in boolean type',
          'bytes': 'Built-in bytes type',
          'len': 'Returns the length of a string, list, or object',
          'close': 'Closes a struct, preventing addition of new fields',
        };

        const documentation = builtins[word.word];
        if (documentation) {
          return {
            range: {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: word.startColumn,
              endColumn: word.endColumn,
            },
            contents: [{ value: documentation }],
          };
        }

        return null;
      },
    });

    // Call external ready handler
    onEditorReady?.(editor);
  }, [onSave, onEditorReady]);

  // Handle value change
  const handleChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      onChange(value);
    }
  }, [onChange]);

  return (
    <div className={clsx('h-full w-full', className)}>
      <Editor
        height="100%"
        language={language}
        theme={theme === 'vs' ? 'cue-light' : theme}
        value={value}
        options={defaultOptions}
        onMount={handleEditorDidMount}
        onChange={handleChange}
        loading={
          <div className="h-full w-full flex items-center justify-center">
            <div className="text-center">
              <div className="spinner h-6 w-6 mb-2 mx-auto"></div>
              <p className="text-sm text-gray-500">Loading editor...</p>
            </div>
          </div>
        }
      />
    </div>
  );
}

export default MonacoEditor;