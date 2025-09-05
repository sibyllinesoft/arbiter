/**
 * Monaco editor component with CUE syntax highlighting
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import Editor from '@monaco-editor/react';
import { editor } from 'monaco-editor';
import { clsx } from 'clsx';
import type { EditorProps } from '../../types/ui';

// Enhanced CUE language definition for Monaco
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
    ['<', '>'], // For template brackets
  ],
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '<', close: '>' },
    { open: '"', close: '"', notIn: ['string'] },
    { open: "'", close: "'", notIn: ['string'] },
    { open: '`', close: '`', notIn: ['string'] },
  ],
  surroundingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '<', close: '>' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
    { open: '`', close: '`' },
  ],
  folding: {
    markers: {
      start: new RegExp('^\\s*//\\s*#?region\\b'),
      end: new RegExp('^\\s*//\\s*#?endregion\\b'),
    },
  },
  wordPattern: /(-?\d*\.\d\w*)|([^`~!@#%^&*()\-=+\[\{}\|;:'",.<>/?\\s]+)/g,
  indentationRules: {
    increaseIndentPattern: /^((?!\/\/).)*(\{[^}"'`]*|\([^)"'`]*|\[[^\]"'`]*)$/,
    decreaseIndentPattern: /^((?!.*?\/\*).*\*)?\s*[)}\]]/,
  },
};

// Enhanced CUE tokenizer with better CUE-specific patterns
const CUE_TOKENIZER = {
  // Default tokens
  defaultToken: 'invalid',
  
  // Keywords
  keywords: [
    'package', 'import', 'if', 'for', 'in', 'let', 'true', 'false', 'null'
  ],
  
  // Built-in types
  typeKeywords: [
    'string', 'int', 'float', 'bool', 'bytes', 'number', 'top', 'bottom'
  ],
  
  // Built-in functions
  builtins: [
    'len', 'close', 'and', 'or', 'div', 'mod', 'quo', 'rem', 'list', 'struct'
  ],
  
  // Operators
  operators: [
    '=', '!=', '<', '<=', '>', '>=', '=~', '!~',
    '&', '|', '!', '+', '-', '*', '/', '%',
    '?', ':', '?:', '?=', '*=', '..', '..<'
  ],
  
  // Common regular expressions
  escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
  
  // Token rules
  tokenizer: {
    root: [
      // Comments
      [/\/\/.*$/, 'comment'],
      [/\/\*/, 'comment', '@comment'],

      // Package and import statements
      [/\bpackage\s+([a-zA-Z_][\w]*)\b/, ['keyword', 'namespace']],
      [/\bimport\b/, 'keyword', '@import'],

      // Keywords
      [/\b(if|for|in|let)\b/, 'keyword.control'],
      [/\b(package|import)\b/, 'keyword'],
      
      // Built-in types and constants
      [/\b(string|int|float|bool|bytes|null|number|top|bottom|_)\b/, 'type'],
      [/\b(true|false)\b/, 'constant.language.boolean'],
      [/\bnull\b/, 'constant.language.null'],
      
      // Built-in functions
      [/\b(len|close|and|or|div|mod|quo|rem|list|struct)\b/, 'support.function'],
      
      // Template expressions and interpolation
      [/\\[(]/, 'delimiter', '@interpolation'],
      
      // Numbers with units and scientific notation
      [/\d+(\.\d+)?([KMGTPE]i?|[munpfazy])?\b/, 'number'],
      [/0[xX][0-9a-fA-F]+/, 'number.hex'],
      [/0[oO][0-7]+/, 'number.octal'],
      [/0[bB][01]+/, 'number.binary'],
      [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
      [/\d+([eE][\-+]?\d+)?/, 'number'],
      
      // Strings
      [/"([^"\\]|\\.)*$/, 'string.invalid'],  // non-terminated string
      [/"/, 'string', '@string_double'],
      [/'([^'\\]|\\.)*$/, 'string.invalid'],  // non-terminated string
      [/'/, 'string', '@string_single'],
      [/`/, 'string', '@string_backtick'],
      [/#"/, 'string.raw', '@string_raw'],
      
      // Regular expressions
      [/=~\s*"/, 'regexp', '@regexp'],
      [/!~\s*"/, 'regexp', '@regexp'],
      
      // CUE-specific operators and constraints
      [/(\?=|\?:|\*=|=~|!~|!=|<=|>=|==)/, 'keyword.operator.comparison'],
      [/(\.\.\.|\.\.\<)/, 'keyword.operator.range'],
      [/(&|\|)(?![&|])/, 'keyword.operator.unification'],
      [/[!](?!=)/, 'keyword.operator.logical'],
      
      // Field definitions and references
      [/([a-zA-Z_][\w]*)(\s*)([:])/, ['variable.name', '', 'delimiter']],
      [/([a-zA-Z_][\w]*)(\s*)([?])(?![:=])/, ['variable.name', '', 'keyword.operator.optional']],
      [/([a-zA-Z_][\w]*)(\s*)([!])(?![:=~])/, ['variable.name', '', 'keyword.operator.required']],
      
      // Attributes and tags
      [/@[a-zA-Z_][\w]*/, 'decorator'],
      
      // Hidden fields and special identifiers
      [/_[a-zA-Z_][\w]*/, 'variable.other.constant'],
      [/#[a-zA-Z_$][\w$]*/, 'variable.name'],
      [/\$[a-zA-Z_][\w]*/, 'variable.parameter'],
      [/\.[a-zA-Z_][\w]*/, 'variable.other.property'],
      
      // Regular identifiers
      [/[a-zA-Z_$][\w$]*/, 'identifier'],
      
      // Brackets and delimiters
      [/[{}()\[\]]/, '@brackets'],
      [/[<>]/, '@brackets'],
      [/[=+\-*/%<>!&|^~?:,;.]/, 'operator'],
      
      // Whitespace
      [/[ \t\r\n]+/, ''],
    ],

    import: [
      [/"([^"]*)"/, 'string', '@pop'],
      [/[^\s"]+/, 'string', '@pop'],
      [/\s+/, ''],
      [/$/, '', '@pop'],
    ],

    interpolation: [
      [/[)]/, 'delimiter', '@pop'],
      { include: '@root' },
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

    string_raw: [
      [/[^#"]+/, 'string'],
      [/#"/, 'string.raw', '@pop'],
    ],

    regexp: [
      [/[^\\"]/, 'regexp'],
      [/\\./, 'regexp.escape'],
      [/"/, 'regexp', '@pop'],
    ],
  }
};

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

  // Register CUE language before mount
  const handleEditorWillMount = useCallback((monaco: any) => {
    // Check if CUE language is already registered
    const languages = monaco.languages.getLanguages();
    const cueExists = languages.some((lang: any) => lang.id === 'cue');
    
    if (!cueExists) {
      console.log('🔧 Registering CUE language with Monaco Editor...');
      
      // Register CUE language
      monaco.languages.register({ id: 'cue' });
      
      // Set language configuration
      monaco.languages.setLanguageConfiguration('cue', CUE_LANGUAGE_CONFIG);
      
      // Set tokenizer with proper structure
      monaco.languages.setMonarchTokensProvider('cue', CUE_TOKENIZER);

      // Define enhanced CUE themes
      monaco.editor.defineTheme('cue-light', {
          base: 'vs',
          inherit: true,
          rules: [
            // Comments
            { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
            
            // Keywords and control flow
            { token: 'keyword', foreground: '0000FF', fontStyle: 'bold' },
            { token: 'keyword.control', foreground: 'C586C0', fontStyle: 'bold' },
            { token: 'keyword.operator', foreground: '7C4DFF' },
            { token: 'keyword.operator.logical', foreground: 'FF6B6B', fontStyle: 'bold' },
            { token: 'keyword.operator.comparison', foreground: '4ECDC4' },
            { token: 'keyword.operator.unification', foreground: 'FF9F43', fontStyle: 'bold' },
            { token: 'keyword.operator.range', foreground: '45B7D1' },
            { token: 'keyword.operator.optional', foreground: 'FFC107' },
            { token: 'keyword.operator.required', foreground: 'F44336' },
            
            // Types and constants
            { token: 'type', foreground: '1976D2', fontStyle: 'bold' },
            { token: 'constant.language.boolean', foreground: '569CD6' },
            { token: 'constant.language.null', foreground: '808080' },
            { token: 'support.function', foreground: 'DCDCAA' },
            
            // Strings and literals
            { token: 'string', foreground: 'CE9178' },
            { token: 'string.escape', foreground: 'D7BA7D' },
            { token: 'string.raw', foreground: 'D69E2E' },
            { token: 'regexp', foreground: 'D16969' },
            
            // Numbers
            { token: 'number', foreground: '098658' },
            { token: 'number.float', foreground: '098658' },
            { token: 'number.hex', foreground: '3DC9B3' },
            { token: 'number.octal', foreground: '3DC9B3' },
            { token: 'number.binary', foreground: '3DC9B3' },
            
            // Variables and identifiers
            { token: 'variable.name', foreground: '9CDCFE', fontStyle: 'italic' },
            { token: 'variable.parameter', foreground: '9C27B0' },
            { token: 'variable.other.property', foreground: '4FC1FF' },
            { token: 'variable.other.constant', foreground: '795548', fontStyle: 'italic' },
            { token: 'decorator', foreground: 'C586C0' },
            { token: 'namespace', foreground: '4EC9B0', fontStyle: 'bold' },
            { token: 'identifier', foreground: '212121' },
            
            // Delimiters and operators
            { token: 'delimiter', foreground: 'D4D4D4' },
            { token: 'operator', foreground: 'D4D4D4' },
          ],
          colors: {
            'editor.background': '#FAFAFA',
            'editor.foreground': '#383A42',
            'editor.lineHighlightBackground': '#F5F5F5',
            'editorLineNumber.foreground': '#999999',
            'editorLineNumber.activeForeground': '#0184BC',
            'editorIndentGuide.background': '#E0E0E0',
            'editorIndentGuide.activeBackground': '#C0C0C0',
            'editor.selectionBackground': '#ADD6FF4D',
            'editor.selectionHighlightBackground': '#ADD6FF26',
            'editorBracketMatch.background': '#0064001A',
            'editorBracketMatch.border': '#B9B9B9',
          },
        });

        // Define dark CUE theme
        monaco.editor.defineTheme('cue-dark', {
          base: 'vs-dark',
          inherit: true,
          rules: [
            // Comments
            { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
            
            // Keywords and control flow
            { token: 'keyword', foreground: '569CD6', fontStyle: 'bold' },
            { token: 'keyword.control', foreground: 'C586C0', fontStyle: 'bold' },
            { token: 'keyword.operator', foreground: 'D7BA7D' },
            { token: 'keyword.operator.logical', foreground: 'FF6B6B', fontStyle: 'bold' },
            { token: 'keyword.operator.comparison', foreground: '4ECDC4' },
            { token: 'keyword.operator.unification', foreground: 'FF9F43', fontStyle: 'bold' },
            { token: 'keyword.operator.range', foreground: '45B7D1' },
            { token: 'keyword.operator.optional', foreground: 'FFC107' },
            { token: 'keyword.operator.required', foreground: 'F44336' },
            
            // Types and constants
            { token: 'type', foreground: '4EC9B0', fontStyle: 'bold' },
            { token: 'constant.language.boolean', foreground: '569CD6' },
            { token: 'constant.language.null', foreground: '808080' },
            { token: 'support.function', foreground: 'DCDCAA' },
            
            // Strings and literals
            { token: 'string', foreground: 'CE9178' },
            { token: 'string.escape', foreground: 'D7BA7D' },
            { token: 'string.raw', foreground: 'D69E2E' },
            { token: 'regexp', foreground: 'D16969' },
            
            // Numbers
            { token: 'number', foreground: 'B5CEA8' },
            { token: 'number.float', foreground: 'B5CEA8' },
            { token: 'number.hex', foreground: '3DC9B3' },
            { token: 'number.octal', foreground: '3DC9B3' },
            { token: 'number.binary', foreground: '3DC9B3' },
            
            // Variables and identifiers
            { token: 'variable.name', foreground: '9CDCFE', fontStyle: 'italic' },
            { token: 'variable.parameter', foreground: 'D19A66' },
            { token: 'variable.other.property', foreground: '4FC1FF' },
            { token: 'variable.other.constant', foreground: '795548', fontStyle: 'italic' },
            { token: 'decorator', foreground: 'C586C0' },
            { token: 'namespace', foreground: '4EC9B0', fontStyle: 'bold' },
            { token: 'identifier', foreground: 'D4D4D4' },
            
            // Delimiters and operators
            { token: 'delimiter', foreground: 'D4D4D4' },
            { token: 'operator', foreground: 'D4D4D4' },
          ],
          colors: {
            'editor.background': '#1E1E1E',
            'editor.foreground': '#D4D4D4',
            'editor.lineHighlightBackground': '#2D2D30',
            'editorLineNumber.foreground': '#858585',
            'editorLineNumber.activeForeground': '#C6C6C6',
            'editorIndentGuide.background': '#404040',
            'editorIndentGuide.activeBackground': '#707070',
            'editor.selectionBackground': '#264F78',
            'editor.selectionHighlightBackground': '#264F7840',
            'editorBracketMatch.background': '#0064001A',
            'editorBracketMatch.border': '#888888',
          },
        });
      
      console.log('✅ CUE language successfully registered with Monaco Editor');
    } else {
      console.log('🔄 CUE language already registered');
    }
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

    // Add comprehensive CUE completions
    monaco.languages.registerCompletionItemProvider('cue', {
      provideCompletionItems: (model, position) => {
        const suggestions = [
          // Basic keywords
          {
            label: 'package',
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: 'package ${1:name}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Define a package name',
          },
          {
            label: 'import',
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: 'import "${1:path}"',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Import a package from a path',
          },
          
          // Control flow
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
            documentation: 'Iterate over object or list',
          },
          {
            label: 'let',
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: 'let ${1:name} = ${2:value}\n$0',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Create a let binding',
          },

          // Built-in types
          {
            label: 'string',
            kind: monaco.languages.CompletionItemKind.TypeParameter,
            insertText: 'string',
            documentation: 'Built-in string type',
          },
          {
            label: 'int',
            kind: monaco.languages.CompletionItemKind.TypeParameter,
            insertText: 'int',
            documentation: 'Built-in integer type',
          },
          {
            label: 'float',
            kind: monaco.languages.CompletionItemKind.TypeParameter,
            insertText: 'float',
            documentation: 'Built-in floating point type',
          },
          {
            label: 'bool',
            kind: monaco.languages.CompletionItemKind.TypeParameter,
            insertText: 'bool',
            documentation: 'Built-in boolean type',
          },
          {
            label: 'bytes',
            kind: monaco.languages.CompletionItemKind.TypeParameter,
            insertText: 'bytes',
            documentation: 'Built-in bytes type',
          },
          {
            label: 'number',
            kind: monaco.languages.CompletionItemKind.TypeParameter,
            insertText: 'number',
            documentation: 'Union of int and float',
          },

          // CUE-specific constructs
          {
            label: 'struct definition',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '${1:StructName}: {\n\t${2:field}: ${3:type}\n\t$0\n}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Define a struct with fields',
          },
          {
            label: 'constraint',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '${1:field}: ${2:type} & ${3:constraint}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Add constraint to a field',
          },
          {
            label: 'optional field',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '${1:field}?: ${2:type}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Define an optional field',
          },
          {
            label: 'required field',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '${1:field}!: ${2:type}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Define a required field',
          },

          // Built-in functions
          {
            label: 'len',
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: 'len(${1:value})',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Returns the length of a string, list, or object',
          },
          {
            label: 'close',
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: 'close({\n\t$0\n})',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Close a struct to prevent additional fields',
          },

          // Validation patterns
          {
            label: 'range constraint',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '${1:field}: >${2:min} & <${3:max}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Numeric range constraint',
          },
          {
            label: 'regex constraint',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '${1:field}: =~"${2:pattern}"',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Regular expression constraint',
          },
          {
            label: 'enum constraint',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '${1:field}: "${2:option1}" | "${3:option2}" | "${4:option3}"',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Enumeration constraint',
          },

          // Common patterns
          {
            label: 'list definition',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '${1:field}: [...${2:type}]',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Define a list of specific type',
          },
          {
            label: 'map definition',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '${1:field}: [${2:KeyType}]: ${3:ValueType}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Define a map with key-value types',
          },
          
          // Template and interpolation
          {
            label: 'template',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '${1:template}: {\n\t${2:field}: "\\(${3:variable})"\n\t$0\n}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Create a template with string interpolation',
          },
        ];

        return { suggestions };
      },
    });

    // Add comprehensive hover provider for CUE
    monaco.languages.registerHoverProvider('cue', {
      provideHover: (model, position) => {
        const word = model.getWordAtPosition(position);
        if (!word) return;

        const builtins: Record<string, string> = {
          // Built-in types
          'string': '**string** - Built-in string type for text values',
          'int': '**int** - Built-in integer type for whole numbers',
          'float': '**float** - Built-in floating point type for decimal numbers',
          'bool': '**bool** - Built-in boolean type (true/false)',
          'bytes': '**bytes** - Built-in bytes type for binary data',
          'number': '**number** - Union type of int and float',
          'null': '**null** - Represents absence of a value',
          'top': '**top** - The universal type that all values satisfy',
          'bottom': '**bottom** - The empty type that no values satisfy',
          
          // Built-in functions
          'len': '**len(value)** - Returns the length of a string, list, or object',
          'close': '**close(struct)** - Closes a struct, preventing addition of new fields',
          'and': '**and(a, b)** - Logical AND operation',
          'or': '**or(a, b)** - Logical OR operation',
          'div': '**div(a, b)** - Integer division',
          'mod': '**mod(a, b)** - Modulo operation',
          'quo': '**quo(a, b)** - Quotient operation',
          'rem': '**rem(a, b)** - Remainder operation',
          
          // Control flow keywords
          'package': '**package** - Defines the package name for this CUE file',
          'import': '**import** - Imports another package or module',
          'if': '**if** - Conditional expression for control flow',
          'for': '**for** - Iteration over lists and objects',
          'let': '**let** - Creates a local binding',
          'in': '**in** - Used in for loops to iterate over collections',
          
          // Constants
          'true': '**true** - Boolean constant representing truth',
          'false': '**false** - Boolean constant representing falsehood',
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

        // Check for operators and constraints
        const line = model.getLineContent(position.lineNumber);
        const wordStart = word.startColumn - 1;
        const wordEnd = word.endColumn - 1;
        
        // Check for constraint operators around the cursor
        const beforeWord = line.substring(0, wordStart);
        const afterWord = line.substring(wordEnd);
        
        if (beforeWord.includes('=~')) {
          return {
            range: {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: word.startColumn,
              endColumn: word.endColumn,
            },
            contents: [{ value: '**Regular Expression Constraint** - The value must match this pattern' }],
          };
        }
        
        if (beforeWord.includes('!~')) {
          return {
            range: {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: word.startColumn,
              endColumn: word.endColumn,
            },
            contents: [{ value: '**Negative Regular Expression Constraint** - The value must NOT match this pattern' }],
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
        theme={
          language === 'cue' 
            ? theme === 'vs-dark' ? 'cue-dark' : 'cue-light'
            : theme
        }
        value={value}
        options={defaultOptions}
        beforeMount={handleEditorWillMount}
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