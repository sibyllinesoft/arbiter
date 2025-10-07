import Editor from "@monaco-editor/react";
import type { Monaco } from "@monaco-editor/react";
import { editor, languages } from "monaco-editor";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

const GHERKIN_LANGUAGE_ID = "gherkin";

const GHERKIN_LANGUAGE_CONFIGURATION: languages.LanguageConfiguration = {
  comments: {
    lineComment: "#",
  },
  brackets: [
    ["{", "}"],
    ["[", "]"],
    ["(", ")"],
  ] as languages.CharacterPair[],
  autoClosingPairs: [
    { open: '"', close: '"' },
    { open: "'", close: "'" },
    { open: "(", close: ")" },
    { open: "[", close: "]" },
    { open: "{", close: "}" },
  ] as languages.IAutoClosingPair[],
  surroundingPairs: [
    { open: '"', close: '"' },
    { open: "'", close: "'" },
    { open: "(", close: ")" },
    { open: "[", close: "]" },
    { open: "{", close: "}" },
  ] as languages.IAutoClosingPair[],
};

const GHERKIN_TOKENIZER: languages.IMonarchLanguage = {
  defaultToken: "",
  tokenPostfix: ".gherkin",
  keywords: [
    "Feature",
    "Background",
    "Scenario",
    "Scenario Outline",
    "Examples",
    "Given",
    "When",
    "Then",
    "And",
    "But",
  ],
  tokenizer: {
    root: [
      [/^\s*#.*/, "comment"],
      [/^\s*@[^\s]+/, "tag"],
      [/^\s*(Scenario Outline|Scenario|Feature|Background|Examples)(?=\s*:)/, "keyword"],
      [/^\s*(Given|When|Then|And|But)(?=\s+)/, "keyword"],
      [/"[^"]*"/, "string"],
      [/`[^`]*`/, "string"],
      [/\|[^|]*\|/, "variable"],
      [/^\s*:?-.*/, "number"],
      [/^\s+/, "white"],
      [/[^#\s]+/, ""],
    ] as languages.IMonarchLanguageRule[],
  },
};

function ensureGherkinLanguage(monaco: Monaco) {
  const isRegistered = monaco.languages
    .getLanguages()
    .some((language) => language.id === GHERKIN_LANGUAGE_ID);

  if (!isRegistered) {
    monaco.languages.register({ id: GHERKIN_LANGUAGE_ID });
    monaco.languages.setMonarchTokensProvider(GHERKIN_LANGUAGE_ID, GHERKIN_TOKENIZER);
    monaco.languages.setLanguageConfiguration(GHERKIN_LANGUAGE_ID, GHERKIN_LANGUAGE_CONFIGURATION);
  }
}

export interface GherkinEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: number;
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
}

export function GherkinEditor({
  value,
  onChange,
  height = 260,
  readOnly = false,
  placeholder,
  className,
}: GherkinEditorProps) {
  const [theme, setTheme] = useState<"vs" | "vs-dark">("vs");
  const hasRegistered = useRef(false);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const updateTheme = () => {
      const prefersDark = document.documentElement.classList.contains("dark");
      setTheme(prefersDark ? "vs-dark" : "vs");
    };

    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  const options = useMemo<editor.IStandaloneEditorConstructionOptions>(
    () => ({
      minimap: { enabled: false },
      glyphMargin: false,
      folding: true,
      readOnly,
      fontLigatures: true,
      smoothScrolling: true,
      wordWrap: "on",
      guides: { indentation: true },
      renderLineHighlight: "all",
      padding: { top: 8, bottom: 8 },
      "semanticHighlighting.enabled": true,
    }),
    [readOnly],
  );

  const handleMount = useCallback(
    (_editorInstance: editor.IStandaloneCodeEditor, monaco: Monaco) => {
      if (!hasRegistered.current) {
        ensureGherkinLanguage(monaco);
        hasRegistered.current = true;
      }

      if (placeholder && !_editorInstance.getValue()) {
        _editorInstance.getModel()?.setValue(placeholder);
      }
    },
    [placeholder],
  );

  const handleChange = useCallback(
    (nextValue: string | undefined) => {
      onChange(nextValue ?? "");
    },
    [onChange],
  );

  return (
    <Editor
      className={className ?? ""}
      value={value}
      language={GHERKIN_LANGUAGE_ID}
      theme={theme}
      height={height}
      options={options}
      onMount={handleMount}
      onChange={handleChange}
    />
  );
}

export default GherkinEditor;
