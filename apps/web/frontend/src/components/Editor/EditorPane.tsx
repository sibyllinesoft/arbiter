/**
 * Editor pane combining file tree and Monaco editor
 */

import React, { useCallback, useEffect } from 'react';
import { clsx } from 'clsx';
import { Code2, FileText, Save, Circle, CheckCircle2 } from 'lucide-react';
import {
  useApp,
  useCurrentProject,
  useActiveFragment,
  useEditorContent,
} from '../../contexts/AppContext';
import { apiService } from '../../services/api';
import FileTree from './FileTree';
import MonacoEditor from './MonacoEditor';
import SplitPane from '../Layout/SplitPane';

export interface EditorPaneProps {
  className?: string;
}

export function EditorPane({ className }: EditorPaneProps) {
  const { state, updateEditorContent, markUnsaved, markSaved, setError, dispatch } = useApp();

  const currentProject = useCurrentProject();
  const activeFragment = useActiveFragment();
  const editorContent = useEditorContent(activeFragment?.id || '');

  // Load fragment content when active fragment changes
  useEffect(() => {
    if (!activeFragment || editorContent !== '') {
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
    [activeFragment, updateEditorContent, markUnsaved, markSaved]
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
        content
      );

      // Update fragment in state
      dispatch({ type: 'UPDATE_FRAGMENT', payload: updatedFragment });

      // Mark as saved
      markSaved(activeFragment.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save fragment';
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
    [activeFragment, state.unsavedChanges, handleSave]
  );

  if (!currentProject) {
    return (
      <div
        className={clsx(
          'h-full flex items-center justify-center',
          'bg-gradient-to-br from-graphite-50 via-white to-graphite-50',
          className
        )}
      >
        <div className="text-center p-8 max-w-md">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-graphite-100 flex items-center justify-center">
            <Code2 className="w-8 h-8 text-graphite-400" />
          </div>
          <h2 className="text-xl font-semibold text-graphite-800 mb-3">No Project Selected</h2>
          <p className="text-graphite-600 leading-relaxed">
            Select a project from the sidebar to start editing specifications
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('h-full bg-graphite-50', className)}>
      <SplitPane
        split="horizontal"
        defaultSize="40%"
        minSize="200px"
        maxSize="70%"
        resizerStyle={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(71, 85, 105, 0.1) 50%, transparent 100%)',
          borderTop: '1px solid rgba(71, 85, 105, 0.1)',
          borderBottom: '1px solid rgba(71, 85, 105, 0.1)',
          height: '1px',
        }}
      >
        {/* Top: File Tree */}
        <FileTree />

        {/* Bottom: Monaco Editor */}
        <div className="h-full bg-white border-t border-graphite-200 shadow-sm">
          {activeFragment ? (
            <div className="h-full flex flex-col">
              {/* Editor header with filename */}
              <div className="px-6 py-3 bg-gradient-to-r from-graphite-50 to-white border-b border-graphite-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded flex items-center justify-center bg-purple-100">
                    <Code2 className="w-3 h-3 text-purple-600" />
                  </div>
                  <span className="font-medium text-sm text-graphite-800 tracking-wide">
                    {activeFragment.path}
                  </span>
                  {state.unsavedChanges.has(activeFragment.id) ? (
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 border border-amber-200 rounded-full">
                      <Circle className="w-2 h-2 fill-amber-500 text-amber-500" />
                      <span className="text-amber-700 text-xs font-medium">Modified</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 border border-emerald-200 rounded-full">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-700 text-xs font-medium">Saved</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSave}
                    className={clsx(
                      'p-1.5 rounded-lg transition-all duration-200',
                      state.unsavedChanges.has(activeFragment.id)
                        ? 'bg-blue-100 hover:bg-blue-200 text-blue-600'
                        : 'bg-graphite-100 text-graphite-400 cursor-default'
                    )}
                    disabled={!state.unsavedChanges.has(activeFragment.id)}
                  >
                    <Save className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Monaco Editor */}
              <div className="flex-1 bg-white">
                <MonacoEditor
                  value={editorContent}
                  onChange={handleEditorChange}
                  onSave={handleSave}
                  onEditorReady={handleEditorReady}
                  fragmentId={activeFragment.id}
                  language="cue"
                  theme="cue-light"
                  options={{
                    automaticLayout: true,
                    wordWrap: 'on',
                    lineNumbers: 'on',
                    minimap: { enabled: true },
                    folding: true,
                    bracketMatching: 'always',
                    autoIndent: 'advanced',
                    formatOnType: true,
                    formatOnPaste: true,
                    fontSize: 14,
                    lineHeight: 1.6,
                    fontFamily: '"JetBrains Mono", "Fira Code", "Monaco", Consolas, monospace',
                    padding: { top: 16, bottom: 16 },
                    scrollBeyondLastLine: false,
                    renderWhitespace: 'selection',
                    renderLineHighlight: 'gutter',
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center bg-gradient-to-br from-graphite-25 via-white to-graphite-25">
              <div className="text-center p-12 max-w-lg">
                <div className="w-20 h-20 mx-auto mb-8 rounded-2xl bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center shadow-sm">
                  <FileText className="w-10 h-10 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold text-graphite-800 mb-4">Ready to Code</h3>
                <p className="text-graphite-600 leading-relaxed mb-2">
                  Select a fragment from the file tree to start editing your CUE specification
                </p>
                {state.fragments.length === 0 && (
                  <p className="text-sm text-graphite-500 bg-graphite-50 px-4 py-2 rounded-lg border border-graphite-100 mt-6 inline-block">
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
