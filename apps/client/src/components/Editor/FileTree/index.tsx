/**
 * File tree component for fragment navigation - Enhanced with Elegant Graphite Design System
 * Professional hierarchy styling with smooth animations and accessibility
 */

import type { Fragment } from "@/types/api";
import { buildFileTree } from "@/utils/file-tree";
import { Folder, Plus } from "lucide-react";
import React, { useState, useCallback } from "react";
import { toast } from "react-toastify";
import { useEditorActions, useEditorState, useStatus } from "../../../contexts/AppContext";
import { useCurrentProject } from "../../../contexts/ProjectContext";
import { Button, Input, cn } from "../../../design-system";
import { apiService } from "../../../services/api";

import { FileTreeItem } from "./components/FileTreeItem";
import type { FileTreeProps, FileTreeRef } from "./types";

export const FileTree = React.forwardRef<FileTreeRef, FileTreeProps>(function FileTree(
  { className, multiSelect = false, onSelectionChange },
  ref,
) {
  const editorState = useEditorState();
  const { setActiveFragment, deleteFragment, setFragments } = useEditorActions();
  const { setError } = useStatus();
  const currentProject = useCurrentProject();

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newFragmentPath, setNewFragmentPath] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  const fileTree = buildFileTree(editorState.fragments, editorState.unsavedChanges);

  // Handle folder toggle
  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders((prev) => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(path)) {
        newExpanded.delete(path);
      } else {
        newExpanded.add(path);
      }
      return newExpanded;
    });
  }, []);

  // Helper: update selection and notify parent
  const updateSelection = useCallback(
    (newSelection: Set<string>) => {
      setSelectedFiles(newSelection);
      onSelectionChange?.(Array.from(newSelection));
    },
    [onSelectionChange],
  );

  // Helper: toggle single file in selection
  const toggleFileSelection = useCallback(
    (fragmentId: string) => {
      setSelectedFiles((prev) => {
        const newSelection = new Set(prev);
        if (newSelection.has(fragmentId)) {
          newSelection.delete(fragmentId);
        } else {
          newSelection.add(fragmentId);
        }
        onSelectionChange?.(Array.from(newSelection));
        return newSelection;
      });
    },
    [onSelectionChange],
  );

  // Helper: range selection between last selected and current
  const selectRange = useCallback(
    (fragmentId: string, fragments: Fragment[]) => {
      const currentIndex = fragments.findIndex((f) => f.id === fragmentId);
      const lastSelectedId = Array.from(selectedFiles).pop();
      const lastIndex = fragments.findIndex((f) => f.id === lastSelectedId);

      if (currentIndex === -1 || lastIndex === -1) return;

      const start = Math.min(currentIndex, lastIndex);
      const end = Math.max(currentIndex, lastIndex);
      const rangeIds = fragments.slice(start, end + 1).map((f) => f.id);

      setSelectedFiles((prev) => {
        const newSelection = new Set([...prev, ...rangeIds]);
        onSelectionChange?.(Array.from(newSelection));
        return newSelection;
      });
    },
    [selectedFiles, onSelectionChange],
  );

  // Handle file selection with support for multi-select modes
  const handleFileSelect = useCallback(
    (fragmentId: string, event?: React.MouseEvent) => {
      if (multiSelect && event) {
        const isToggle = event.ctrlKey || event.metaKey;
        const isRange = event.shiftKey && selectedFiles.size > 0;

        if (isToggle) {
          toggleFileSelection(fragmentId);
        } else if (isRange) {
          selectRange(fragmentId, editorState.fragments);
        } else {
          updateSelection(new Set([fragmentId]));
        }
      } else if (!multiSelect) {
        updateSelection(new Set());
      }

      setActiveFragment(fragmentId);
    },
    [
      setActiveFragment,
      multiSelect,
      selectedFiles,
      editorState.fragments,
      toggleFileSelection,
      selectRange,
      updateSelection,
    ],
  );

  // Expose methods via ref
  const getSelectedFiles = useCallback(() => {
    return Array.from(selectedFiles);
  }, [selectedFiles]);

  const clearSelection = useCallback(() => {
    setSelectedFiles(new Set());
    if (onSelectionChange) {
      onSelectionChange([]);
    }
  }, [onSelectionChange]);

  const selectFiles = useCallback(
    (fileIds: string[]) => {
      setSelectedFiles(new Set(fileIds));
      if (onSelectionChange) {
        onSelectionChange(fileIds);
      }
    },
    [onSelectionChange],
  );

  // Expose methods via ref
  React.useImperativeHandle(
    ref,
    () => ({
      getSelectedFiles,
      clearSelection,
      selectFiles,
    }),
    [getSelectedFiles, clearSelection, selectFiles],
  );

  // Notify parent of selection changes
  React.useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(Array.from(selectedFiles));
    }
  }, [selectedFiles, onSelectionChange]);

  // Handle create new fragment
  const handleCreateFragment = useCallback(async () => {
    if (!currentProject || !newFragmentPath.trim()) {
      return;
    }

    try {
      const response = await apiService.createFragment(currentProject.id, {
        path: newFragmentPath.trim(),
        content: "// New CUE fragment\n",
      });

      // Add to fragments list
      const newFragment: Fragment = {
        id: response.id,
        project_id: currentProject.id,
        path: response.path,
        content: "// New CUE fragment\n",
        created_at: response.created_at,
        updated_at: response.created_at,
      };

      setFragments(editorState.fragments.concat(newFragment));
      setActiveFragment(response.id);
      setShowCreateForm(false);
      setNewFragmentPath("");

      toast.success(`Created fragment: ${response.path}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create fragment";
      setError(message);
      toast.error(message);
    }
  }, [
    currentProject,
    newFragmentPath,
    setFragments,
    editorState.fragments,
    setActiveFragment,
    setError,
  ]);

  // Handle delete fragment
  const handleDeleteFragment = useCallback(
    async (fragmentId: string, fragmentPath: string) => {
      if (!currentProject) return;

      if (!confirm(`Are you sure you want to delete "${fragmentPath}"?`)) {
        return;
      }

      try {
        await apiService.deleteFragment(currentProject.id, fragmentId);
        deleteFragment(fragmentId);

        toast.success(`Deleted fragment: ${fragmentPath}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to delete fragment";
        setError(message);
        toast.error(message);
      }
    },
    [currentProject, deleteFragment, setError],
  );

  return (
    <div className={cn("h-full flex flex-col bg-white", className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-graphite-200 bg-gradient-to-r from-graphite-50 to-white rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Folder className="h-4 w-4 text-graphite-500" />
            <h3 className="font-semibold text-sm text-graphite-800">Explorer</h3>
            <span className="px-2 py-0.5 bg-graphite-200 text-graphite-600 text-xs rounded-full font-medium">
              {editorState.fragments.length}
            </span>
          </div>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setShowCreateForm(!showCreateForm)}
            className={cn(
              "text-graphite-500 hover:text-graphite-700 hover:bg-graphite-100/80",
              "transition-all duration-200 rounded-md",
              showCreateForm && "bg-blue-50 text-blue-700 hover:text-blue-800 hover:bg-blue-100",
            )}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Create form */}
        {showCreateForm && (
          <div className="mt-4 space-y-3 p-3 bg-white border border-graphite-200 rounded-lg shadow-sm">
            <div className="space-y-2">
              <label className="block text-xs font-medium text-graphite-700">Fragment Path</label>
              <Input
                size="sm"
                placeholder="api/routes.cue"
                value={newFragmentPath}
                onChange={(e) => setNewFragmentPath(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreateFragment();
                  } else if (e.key === "Escape") {
                    setShowCreateForm(false);
                    setNewFragmentPath("");
                  }
                }}
                autoFocus
                className="text-sm"
              />
              <p className="text-xs text-graphite-500">
                Use forward slashes to create nested folders
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewFragmentPath("");
                }}
                className="text-graphite-600 hover:text-graphite-800"
              >
                Cancel
              </Button>
              <Button
                size="xs"
                onClick={handleCreateFragment}
                disabled={!newFragmentPath.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Create Fragment
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* File tree */}
      <div className="flex-1 min-h-0 overflow-hidden p-2">
        {fileTree.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="w-16 h-16 bg-graphite-100 rounded-2xl flex items-center justify-center mb-4">
              <Folder className="h-8 w-8 text-graphite-400" />
            </div>
            <h4 className="text-sm font-medium text-graphite-900 mb-2">No fragments yet</h4>
            <p className="text-xs text-graphite-600 mb-4 max-w-xs">
              Create your first CUE fragment to start building specifications
            </p>
            <Button
              size="sm"
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="h-3 w-3 mr-1" />
              Create Fragment
            </Button>
          </div>
        ) : (
          <div className="space-y-0.5">
            {fileTree.map((item) => (
              <FileTreeItem
                key={item.id}
                item={item}
                level={0}
                expandedFolders={expandedFolders}
                activeFragmentId={editorState.activeFragmentId}
                selectedFiles={selectedFiles}
                multiSelect={multiSelect}
                onToggleFolder={toggleFolder}
                onFileSelect={handleFileSelect}
                onDeleteFragment={handleDeleteFragment}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export default FileTree;
export type { FileTreeProps, FileTreeRef };
