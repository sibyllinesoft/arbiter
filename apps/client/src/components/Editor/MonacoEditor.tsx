/**
 * Monaco editor component with CUE syntax highlighting
 */

import { CUE_LANGUAGE_CONFIG, CUE_TOKENIZER } from "@/lib/monaco-cue";
import Editor from "@monaco-editor/react";
import { clsx } from "clsx";
import { editor } from "monaco-editor";
import React, { useCallback, useEffect, useRef, useState } from "react";
import type { EditorProps } from "../../types/ui";
import { createLogger } from "../../utils/logger";

const log = createLogger("MonacoEditor");

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
    renderWhitespace: "selection",
    smoothScrolling: true,
    mouseWheelZoom: true,
  };

  const handleBeforeMount = useCallback((monaco: typeof import("monaco-editor")) => {
    if (!monaco || !monaco.languages) {
      log.warn("Monaco instance not provided; skipping language registration");
      return;
    }

    // Register CUE language configuration once before mount
    if (!monaco.languages.getLanguages().some((lang) => lang.id === "cue")) {
      monaco.languages.register({ id: "cue" });
      monaco.languages.setLanguageConfiguration("cue", CUE_LANGUAGE_CONFIG);
      monaco.languages.setMonarchTokensProvider("cue", CUE_TOKENIZER as any);
      monaco.editor.defineTheme("cue-dark", {
        base: "vs-dark",
        inherit: true,
        rules: [],
        colors: {},
      });
    }
  }, []);

  const handleEditorMount = useCallback(
    (monacoEditor: editor.IStandaloneCodeEditor, monaco?: typeof import("monaco-editor")) => {
      editorRef.current = monacoEditor;
      setIsEditorReady(true);

      if (monaco) {
        monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
          onSave?.();
        });
      }

      onEditorReady?.(monacoEditor);
    },
    [onSave, onEditorReady],
  );

  // Handle theme changes
  useEffect(() => {
    if (!isEditorReady || !editorRef.current) return;
    try {
      editor.setTheme(theme === "vs-dark" || theme === "cue-dark" ? theme : "vs");
    } catch (error) {
      log.warn("Failed to set theme", error);
    }
  }, [isEditorReady, theme]);

  // Update value when fragment changes
  useEffect(() => {
    const monacoEditor = editorRef.current;
    if (!monacoEditor) return;
    const model = monacoEditor.getModel();
    if (model && typeof model.getValue === "function" && value !== model.getValue()) {
      model.setValue(value ?? "");
    }
  }, [fragmentId, value]);

  return (
    <div className={clsx("h-full", className)}>
      <Editor
        height="100%"
        defaultLanguage={language}
        value={value}
        theme={theme}
        options={{ ...defaultOptions, ...options }}
        beforeMount={handleBeforeMount}
        onMount={handleEditorMount}
        onChange={(val) => onChange?.(val ?? "")}
      />
    </div>
  );
}

export default MonacoEditor;
