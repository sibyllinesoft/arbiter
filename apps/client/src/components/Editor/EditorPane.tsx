/**
 * Editor pane combining file tree and Monaco editor
 */

import { clsx } from "clsx";
import { CheckCircle2, Circle, Code2, FileText, Save } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { useActiveFragment, useApp, useEditorContent } from "../../contexts/AppContext";
import { useCurrentProject } from "../../contexts/ProjectContext";
import { apiService } from "../../services/api";
import SplitPane from "../Layout/SplitPane";
import FileTree from "./FileTree";
import MonacoEditor from "./MonacoEditor";

export interface EditorPaneProps {
  className?: string;
}

export function EditorPane({ className }: EditorPaneProps) {
  const { state, updateEditorContent, markUnsaved, markSaved, setError, dispatch } = useApp();

  const currentProject = useCurrentProject();
  const activeFragment = useActiveFragment();
  const editorContent = useEditorContent(activeFragment?.id || "");

  const [isDark, setIsDark] = useState(false);

  // Detect dark mode from document class (Tailwind dark mode)
  useEffect(() => {
    const updateTheme = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };

    updateTheme(); // Initial check

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  // Load fragment content when active fragment changes
  useEffect(() => {
    if (!activeFragment || editorContent !== "") {
      return; // Already loaded or no fragment selected
    }

    // Load content if not in editor state
    updateEditorContent(activeFragment.id, activeFragment.content);
  }, [activeFragment, editorContent, updateEditorContent]);

  // Handle editor content change
  const handleEditorChange = useCallback(
    (value: string) => {
      if (!activeFragment) return;

      updateEditorContent(activeFragment.id, value);

      // Mark as unsaved if content differs from original
      if (value !== activeFragment.content) {
        markUnsaved(activeFragment.id);
      } else {
        markSaved(activeFragment.id);
      }
    },
    [activeFragment, updateEditorContent, markUnsaved, markSaved],
  );

  // Handle save (Ctrl+S or manual save)
  const handleSave = useCallback(async () => {
    if (!currentProject || !activeFragment) {
      return;
    }

    const content = state.editorContent[activeFragment.id];
    if (content === undefined || content === activeFragment.content) {
      return; // No changes to save
    }

    try {
      const updatedFragment = await apiService.updateFragment(
        currentProject.id,
        activeFragment.id,
        content,
      );

      // Update fragment in state
      dispatch({ type: "UPDATE_FRAGMENT", payload: updatedFragment });

      // Mark as saved
      markSaved(activeFragment.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save fragment";
      setError(message);
    }
  }, [currentProject, activeFragment, state.editorContent, dispatch, markSaved, setError]);

  // Handle editor ready
  const handleEditorReady = useCallback(
    (editor: any) => {
      // Configure editor for auto-save on blur
      editor.onDidBlurEditorText(() => {
        if (activeFragment && state.unsavedChanges.has(activeFragment.id)) {
          // Auto-save after short delay when editor loses focus
          setTimeout(() => {
            if (state.unsavedChanges.has(activeFragment.id)) {
              handleSave();
            }
          }, 250);
        }
      });
    },
    [activeFragment, state.unsavedChanges, handleSave],
  );

  if (!currentProject) {
    return (
      <div
        className={clsx(
          "h-full flex items-center justify-center",
          "bg-gradient-to-br from-graphite-50 via-white to-graphite-50",
          className,
        )}
      >
        <div className="text-center p-8 max-w-md">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-graphite-100 flex items-center justify-center">
            <Code2 className="w-8 h-8 text-graphite-400" />
          </div>
          <h2 className="text-xl font-semibold text-graphite-800 mb-3">Build something</h2>
          <p className="text-graphite-600 leading-relaxed">
            Select a project from the sidebar to get started
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={clsx("h-full bg-graphite-50 dark:bg-graphite-900", className)}>
      <SplitPane
        split="horizontal"
        defaultSize="40%"
        minSize="200px"
        maxSize="70%"
        resizerStyle={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(71, 85, 105, 0.1) 50%, transparent 100%)",
          borderTop: "1px solid rgba(71, 85, 105, 0.1)",
          borderBottom: "1px solid rgba(71, 85, 105, 0.1)",
          height: "1px",
        }}
      >
        {/* Top: File Tree */}
        <FileTree />

        {/* Bottom: Monaco Editor */}
        <div className="h-full bg-white dark:bg-graphite-950 border-t border-graphite-200 dark:border-graphite-700 shadow-sm">
          {activeFragment ? (
            <div className="h-full flex flex-col">
              {/* Editor header with filename */}
              <div className="px-6 py-3 bg-gradient-to-r from-graphite-50 to-white dark:from-graphite-800 dark:to-graphite-900 border-b border-graphite-100 dark:border-graphite-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded flex items-center justify-center bg-purple-100 dark:bg-purple-900/20">
                    <Code2 className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                  </div>
                  <span className="font-medium text-sm text-graphite-800 dark:text-graphite-100 tracking-wide">
                    {activeFragment.path}
                  </span>
                  {state.unsavedChanges.has(activeFragment.id) ? (
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-full">
                      <Circle className="w-2 h-2 fill-amber-500 dark:fill-amber-400 text-amber-500 dark:text-amber-400" />
                      <span className="text-amber-700 dark:text-amber-300 text-xs font-medium">
                        Modified
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-full">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-emerald-700 dark:text-emerald-300 text-xs font-medium">
                        Saved
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden sm:flex items-center gap-2 text-[11px] text-graphite-400 uppercase tracking-wide">
                    <span className="px-2 py-0.5 rounded-full bg-graphite-100/60 dark:bg-graphite-800/80 border border-graphite-200 dark:border-graphite-700">
                      {(activeFragment.path.split(".").pop() || "file").toUpperCase()}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-graphite-100/60 dark:bg-graphite-800/80 border border-graphite-200 dark:border-graphite-700">
                      UTF-8
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-graphite-100/60 dark:bg-graphite-800/80 border border-graphite-200 dark:border-graphite-700">
                      LF
                    </span>
                  </div>
                  <button
                    onClick={handleSave}
                    className={clsx(
                      "p-1.5 rounded-lg transition-all duration-200",
                      state.unsavedChanges.has(activeFragment.id)
                        ? "bg-blue-100 dark:bg-blue-900/20 hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-600 dark:text-blue-400"
                        : "bg-graphite-100 dark:bg-graphite-800 text-graphite-400 dark:text-graphite-500 cursor-default",
                    )}
                    disabled={!state.unsavedChanges.has(activeFragment.id)}
                  >
                    <Save className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Monaco Editor */}
              <div className="flex-1 bg-white dark:bg-graphite-950">
                <MonacoEditor
                  value={editorContent}
                  onChange={handleEditorChange}
                  onSave={handleSave}
                  onEditorReady={handleEditorReady}
                  fragmentId={activeFragment.id}
                  language="cue"
                  theme={isDark ? "vs-dark" : "vs"}
                  options={{
                    automaticLayout: true,
                    wordWrap: "on",
                    lineNumbers: "on",
                    minimap: { enabled: true },
                    folding: true,
                    bracketMatching: "always",
                    autoIndent: "advanced",
                    formatOnType: true,
                    formatOnPaste: true,
                    fontSize: 14,
                    lineHeight: 1.6,
                    fontFamily: '"JetBrains Mono", "Fira Code", "Monaco", Consolas, monospace',
                    padding: { top: 16, bottom: 16 },
                    scrollBeyondLastLine: false,
                    renderWhitespace: "selection",
                    renderLineHighlight: "gutter",
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center bg-gradient-to-br from-graphite-25 via-white to-graphite-25 dark:from-graphite-800 dark:via-graphite-950 dark:to-graphite-800">
              <div className="text-center p-12 max-w-lg">
                <div className="w-20 h-20 mx-auto mb-8 rounded-2xl bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/20 dark:to-blue-900/20 flex items-center justify-center shadow-sm">
                  <FileText className="w-10 h-10 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-xl font-semibold text-graphite-800 dark:text-graphite-100 mb-4">
                  Ready to Code
                </h3>
                <p className="text-graphite-600 dark:text-graphite-300 leading-relaxed mb-2">
                  Select a fragment from the file tree to start editing your CUE specification
                </p>
                {state.fragments.length === 0 && (
                  <p className="text-sm text-graphite-500 dark:text-graphite-400 bg-graphite-50 dark:bg-graphite-800 px-4 py-2 rounded-lg border border-graphite-100 dark:border-graphite-700 mt-6 inline-block">
                    💡 Create your first fragment using the + button in the file tree
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </SplitPane>
    </div>
  );
}

export default EditorPane;
