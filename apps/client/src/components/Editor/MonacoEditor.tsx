/**
 * Monaco editor component with CUE syntax highlighting
 */

import Editor from "@monaco-editor/react";
import { clsx } from "clsx";
import { editor } from "monaco-editor";
import React, { useRef, useEffect, useCallback, useState } from "react";
import type { EditorProps } from "../../types/ui";
import { createLogger } from "../../utils/logger";

const log = createLogger("MonacoEditor");

// Enhanced CUE language definition for Monaco
const CUE_LANGUAGE_CONFIG = {
  // Language configuration
  comments: {
    lineComment: "//",
    blockComment: ["/*", "*/"],
  },
  brackets: [
    ["{", "}"],
    ["[", "]"],
    ["(", ")"],
    ["<", ">"], // For template brackets
  ],
  autoClosingPairs: [
    { open: "{", close: "}" },
    { open: "[", close: "]" },
    { open: "(", close: ")" },
    { open: "<", close: ">" },
    { open: '"', close: '"', notIn: ["string"] },
    { open: "'", close: "'", notIn: ["string"] },
    { open: "`", close: "`", notIn: ["string"] },
  ],
  surroundingPairs: [
    { open: "{", close: "}" },
    { open: "[", close: "]" },
    { open: "(", close: ")" },
    { open: "<", close: ">" },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
    { open: "`", close: "`" },
  ],
  folding: {
    markers: {
      start: new RegExp("^\\s*//\\s*#?region\\b"),
      end: new RegExp("^\\s*//\\s*#?endregion\\b"),
    },
  },
  wordPattern: /(-?\d*\.\d\w*)|([^`~!@#%^&*()\-=+\[\{}\|;:'",.<>/?\\s]+)/g,
  indentationRules: {
    increaseIndentPattern: /^((?!\/\/).)*(\{[^}"'`]*|\([^)"'`]*|\[[^\]"'`]*)$/,
    decreaseIndentPattern: /^((?!.*?\/\*).*\*)?\s*[)}\]]/,
  },
};

// Simplified CUE tokenizer to avoid regex parsing errors
const CUE_TOKENIZER = {
  defaultToken: "",

  keywords: ["package", "import", "if", "for", "in", "let", "true", "false", "null"],

  typeKeywords: ["string", "int", "float", "bool", "bytes", "number", "top", "bottom"],

  builtins: ["len", "close", "and", "or", "div", "mod", "quo", "rem", "list", "struct"],

  escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

  tokenizer: {
    root: [
      // Comments
      [/\/\/.*$/, "comment"],
      [/\/\*/, "comment", "@comment"],

      // Keywords
      [/\b(?:if|for|in|let)\b/, "keyword.control"],
      [/\b(?:package|import)\b/, "keyword"],

      // Types and constants
      [/\b(?:string|int|float|bool|bytes|null|number|top|bottom|_)\b/, "type"],
      [/\b(?:true|false)\b/, "constant.language.boolean"],
      [/\bnull\b/, "constant.language.null"],

      // Built-in functions
      [/\b(?:len|close|and|or|div|mod|quo|rem|list|struct)\b/, "support.function"],

      // Numbers
      [/\d*\.\d+(?:[eE][\-+]?\d+)?/, "number.float"],
      [/0[xX][0-9a-fA-F]+/, "number.hex"],
      [/0[oO][0-7]+/, "number.octal"],
      [/0[bB][01]+/, "number.binary"],
      [/\d+/, "number"],

      // Strings
      [/"/, "string", "@string_double"],
      [/'/, "string", "@string_single"],
      [/`/, "string", "@string_backtick"],

      // Operators
      [/(?:\?=|\?:|\*=|=~|!~|!=|<=|>=|==)/, "keyword.operator.comparison"],
      [/(?:\.\.\.|\.\.<)/, "keyword.operator.range"],
      [/[&|](?![&|])/, "keyword.operator.unification"],
      [/!(?!=)/, "keyword.operator.logical"],

      // Identifiers
      [/@[a-zA-Z_]\w*/, "decorator"],
      [/_[a-zA-Z_]\w*/, "variable.other.constant"],
      [/#[a-zA-Z_$][\w$]*/, "variable.name"],
      [/\$[a-zA-Z_]\w*/, "variable.parameter"],
      [/\.[a-zA-Z_]\w*/, "variable.other.property"],
      [/[a-zA-Z_$][\w$]*/, "identifier"],

      // Brackets and delimiters
      [/[{}()\[\]]/, "@brackets"],
      [/[<>]/, "@brackets"],
      [/[=+\-*/%<>!&|^~?:,;.]/, "operator"],

      // Whitespace
      [/[ \t\r\n]+/, ""],
    ],

    comment: [
      [/[^/*]+/, "comment"],
      [/\*\//, "comment", "@pop"],
      [/[/*]/, "comment"],
    ],

    string_double: [
      [/[^\\"]+/, "string"],
      [/@escapes/, "string.escape"],
      [/\\./, "string.escape.invalid"],
      [/"/, "string", "@pop"],
    ],

    string_single: [
      [/[^\\']+/, "string"],
      [/@escapes/, "string.escape"],
      [/\\./, "string.escape.invalid"],
      [/'/, "string", "@pop"],
    ],

    string_backtick: [
      [/[^\\`]+/, "string"],
      [/@escapes/, "string.escape"],
      [/\\./, "string.escape.invalid"],
      [/`/, "string", "@pop"],
    ],
  },
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
  language = "cue",
  theme = "vs",
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
    wordWrap: "on",
    wordWrapColumn: 100,
    lineNumbers: "on",
    renderLineHighlight: "line",
    cursorStyle: "line",
    cursorBlinking: "blink",
    folding: true,
    foldingStrategy: "indentation",
    showFoldingControls: "mouseover",
    matchBrackets: "always",
    autoIndent: "advanced",
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
    quickSuggestions: { other: true, comments: false, strings: false },
    parameterHints: { enabled: true },
    suggest: { showWords: true },
    hover: { enabled: true },
    semanticHighlighting: { enabled: true },
    ...options,
  };

  // Register CUE language before mount
  const handleEditorWillMount = useCallback((monaco: any) => {
    // Check if CUE language is already registered
    const languages = monaco.languages.getLanguages();
    const cueExists = languages.some((lang: any) => lang.id === "cue");

    if (!cueExists) {
      log.debug("Registering CUE language with Monaco Editor...");

      // Register CUE language
      monaco.languages.register({ id: "cue" });

      // Set language configuration
      monaco.languages.setLanguageConfiguration("cue", CUE_LANGUAGE_CONFIG);

      // Set tokenizer with proper structure
      monaco.languages.setMonarchTokensProvider("cue", CUE_TOKENIZER);

      // Define enhanced CUE themes
      monaco.editor.defineTheme("cue-light", {
        base: "vs",
        inherit: true,
        rules: [
          // Comments
          { token: "comment", foreground: "6A9955", fontStyle: "italic" },

          // Keywords and control flow
          { token: "keyword", foreground: "0000FF", fontStyle: "bold" },
          { token: "keyword.control", foreground: "C586C0", fontStyle: "bold" },
          { token: "keyword.operator", foreground: "7C4DFF" },
          { token: "keyword.operator.logical", foreground: "FF6B6B", fontStyle: "bold" },
          { token: "keyword.operator.comparison", foreground: "4ECDC4" },
          { token: "keyword.operator.unification", foreground: "FF9F43", fontStyle: "bold" },
          { token: "keyword.operator.range", foreground: "45B7D1" },
          { token: "keyword.operator.optional", foreground: "FFC107" },
          { token: "keyword.operator.required", foreground: "F44336" },

          // Types and constants
          { token: "type", foreground: "1976D2", fontStyle: "bold" },
          { token: "constant.language.boolean", foreground: "569CD6" },
          { token: "constant.language.null", foreground: "808080" },
          { token: "support.function", foreground: "DCDCAA" },

          // Strings and literals
          { token: "string", foreground: "CE9178" },
          { token: "string.escape", foreground: "D7BA7D" },
          { token: "string.raw", foreground: "D69E2E" },
          { token: "regexp", foreground: "D16969" },

          // Numbers
          { token: "number", foreground: "098658" },
          { token: "number.float", foreground: "098658" },
          { token: "number.hex", foreground: "3DC9B3" },
          { token: "number.octal", foreground: "3DC9B3" },
          { token: "number.binary", foreground: "3DC9B3" },

          // Variables and identifiers
          { token: "variable.name", foreground: "9CDCFE", fontStyle: "italic" },
          { token: "variable.parameter", foreground: "9C27B0" },
          { token: "variable.other.property", foreground: "4FC1FF" },
          { token: "variable.other.constant", foreground: "795548", fontStyle: "italic" },
          { token: "decorator", foreground: "C586C0" },
          { token: "namespace", foreground: "4EC9B0", fontStyle: "bold" },
          { token: "identifier", foreground: "212121" },

          // Delimiters and operators
          { token: "delimiter", foreground: "D4D4D4" },
          { token: "operator", foreground: "D4D4D4" },
        ],
        colors: {
          "editor.background": "#FAFAFA",
          "editor.foreground": "#383A42",
          "editor.lineHighlightBackground": "#F5F5F5",
          "editorLineNumber.foreground": "#999999",
          "editorLineNumber.activeForeground": "#0184BC",
          "editorIndentGuide.background": "#E0E0E0",
          "editorIndentGuide.activeBackground": "#C0C0C0",
          "editor.selectionBackground": "#ADD6FF4D",
          "editor.selectionHighlightBackground": "#ADD6FF26",
          "editorBracketMatch.background": "#0064001A",
          "editorBracketMatch.border": "#B9B9B9",
        },
      });

      // Define dark CUE theme
      monaco.editor.defineTheme("cue-dark", {
        base: "vs-dark",
        inherit: true,
        rules: [
          // Comments
          { token: "comment", foreground: "7F7F7F", fontStyle: "italic" },

          // Keywords and control flow
          { token: "keyword", foreground: "569CD6", fontStyle: "bold" },
          { token: "keyword.control", foreground: "C586C0", fontStyle: "bold" },
          { token: "keyword.operator", foreground: "D7BA7D" },
          { token: "keyword.operator.logical", foreground: "FF6B6B", fontStyle: "bold" },
          { token: "keyword.operator.comparison", foreground: "4ECDC4" },
          { token: "keyword.operator.unification", foreground: "FF9F43", fontStyle: "bold" },
          { token: "keyword.operator.range", foreground: "45B7D1" },
          { token: "keyword.operator.optional", foreground: "FFC107" },
          { token: "keyword.operator.required", foreground: "F44336" },

          // Types and constants
          { token: "type", foreground: "4EC9B0", fontStyle: "bold" },
          { token: "constant.language.boolean", foreground: "569CD6" },
          { token: "constant.language.null", foreground: "9CDCFE" },
          { token: "support.function", foreground: "DCDCAA" },

          // Strings and literals
          { token: "string", foreground: "CE9178" },
          { token: "string.escape", foreground: "D7BA7D" },
          { token: "string.raw", foreground: "D69E2E" },
          { token: "regexp", foreground: "D16969" },

          // Numbers
          { token: "number", foreground: "B5CEA8" },
          { token: "number.float", foreground: "B5CEA8" },
          { token: "number.hex", foreground: "3DC9B3" },
          { token: "number.octal", foreground: "3DC9B3" },
          { token: "number.binary", foreground: "3DC9B3" },

          // Variables and identifiers
          { token: "variable.name", foreground: "9CDCFE", fontStyle: "italic" },
          { token: "variable.parameter", foreground: "D19A66" },
          { token: "variable.other.property", foreground: "4FC1FF" },
          { token: "variable.other.constant", foreground: "795548", fontStyle: "italic" },
          { token: "decorator", foreground: "C586C0" },
          { token: "namespace", foreground: "4EC9B0", fontStyle: "bold" },
          { token: "identifier", foreground: "CCCCCC" },

          // Delimiters and operators
          { token: "delimiter", foreground: "D4D4D4" },
          { token: "operator", foreground: "D4D4D4" },
        ],
        colors: {
          "editor.background": "#1E1E1E",
          "editor.foreground": "#D4D4D4",
          "editor.lineHighlightBackground": "#2D2D30",
          "editorGutter.background": "#1E1E1E",
          "editorLineNumber.foreground": "#858585",
          "editorLineNumber.activeForeground": "#C6A0F6",
          "editorIndentGuide.background": "#404040",
          "editorIndentGuide.activeBackground": "#707070",
          "editor.selectionBackground": "#264F78",
          "editor.selectionHighlightBackground": "#264F7840",
          "editorBracketMatch.background": "#0064001A",
          "editorBracketMatch.border": "#888888",
          "minimap.background": "#1E1E1E",
          "minimapGutter.background": "#1E1E1E",
          "minimap.selectionHighlightBackground": "#264F78",
          "minimap.errorBackground": "#F44747",
          "minimap.warningBackground": "#FFCC00",
        },
      });

      log.info("CUE language successfully registered with Monaco Editor");
    } else {
      log.debug("CUE language already registered");
    }
  }, []);

  // Handle editor mount
  const handleEditorDidMount = useCallback(
    (editor: editor.IStandaloneCodeEditor, monaco: typeof import("monaco-editor")) => {
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

      // Basic CUE language features (hover and completion disabled to avoid worker issues)
      log.debug("CUE language features initialized (advanced features disabled for stability)");

      // Call external ready handler
      onEditorReady?.(editor);
    },
    [onSave, onEditorReady],
  );

  // Handle value change
  const handleChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined) {
        onChange(value);
      }
    },
    [onChange],
  );

  return (
    <div className={clsx("h-full w-full", className)}>
      <Editor
        height="100%"
        language={language}
        theme={language === "cue" ? (theme === "vs-dark" ? "cue-dark" : "cue-light") : theme}
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
