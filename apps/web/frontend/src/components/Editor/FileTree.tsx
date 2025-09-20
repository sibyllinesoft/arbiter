/**
 * File tree component for fragment navigation - Enhanced with Elegant Graphite Design System
 * Professional hierarchy styling with smooth animations and accessibility
 */

import React, { useState, useCallback } from 'react';
import { clsx } from 'clsx';
import {
  File,
  Folder,
  FolderOpen,
  Plus,
  MoreHorizontal,
  Trash2,
  Edit,
  ChevronRight,
  ChevronDown,
  FileText,
  Code,
  Settings,
  Database,
  Image,
  Archive,
} from 'lucide-react';
import { useApp, useCurrentProject } from '../../contexts/AppContext';
import { apiService } from '../../services/api';
import { toast } from 'react-toastify';
import type { Fragment } from '../../types/api';
import type { FileTreeItem } from '../../types/ui';
import { Button, Input, cn } from '../../design-system';

// File type detection for better icons
const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'cue':
      return Code;
    case 'json':
      return FileText;
    case 'yaml':
    case 'yml':
      return Settings;
    case 'md':
      return FileText;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'svg':
    case 'gif':
      return Image;
    case 'zip':
    case 'tar':
    case 'gz':
      return Archive;
    case 'sql':
      return Database;
    default:
      return File;
  }
};

export interface FileTreeProps {
  className?: string;
  multiSelect?: boolean;
  onSelectionChange?: (selectedFiles: string[]) => void;
}

export interface FileTreeRef {
  getSelectedFiles: () => string[];
  clearSelection: () => void;
  selectFiles: (fileIds: string[]) => void;
}

export const FileTree = React.forwardRef<FileTreeRef, FileTreeProps>(function FileTree(
  { className, multiSelect = false, onSelectionChange },
  ref
) {
  const { state, dispatch, setActiveFragment, setError } = useApp();
  const currentProject = useCurrentProject();

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newFragmentPath, setNewFragmentPath] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  // Build tree structure from flat fragment list
  const buildFileTree = useCallback(
    (fragments: Fragment[]): FileTreeItem[] => {
      const tree: FileTreeItem[] = [];
      const pathMap = new Map<string, FileTreeItem>();

      // Sort fragments by path
      const sortedFragments = [...fragments].sort((a, b) => a.path.localeCompare(b.path));

      for (const fragment of sortedFragments) {
        const parts = fragment.path.split('/').filter(Boolean);
        let currentPath = '';
        let currentLevel = tree;

        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          currentPath = currentPath ? `${currentPath}/${part}` : part;
          const isFile = i === parts.length - 1;

          // Check if item already exists at this level
          let existingItem = currentLevel.find(item => item.path === currentPath);

          if (!existingItem) {
            const newItem: FileTreeItem = {
              id: isFile ? fragment.id : currentPath,
              path: currentPath,
              type: isFile ? 'file' : 'directory',
              children: isFile ? undefined : [],
              hasUnsavedChanges: isFile ? state.unsavedChanges.has(fragment.id) : undefined,
            };

            currentLevel.push(newItem);
            pathMap.set(currentPath, newItem);
            existingItem = newItem;
          }

          // Update unsaved changes status for files
          if (isFile && existingItem.hasUnsavedChanges !== state.unsavedChanges.has(fragment.id)) {
            existingItem.hasUnsavedChanges = state.unsavedChanges.has(fragment.id);
          }

          // Move to next level for directories
          if (!isFile && existingItem.children) {
            currentLevel = existingItem.children;
          }
        }
      }

      return tree;
    },
    [state.unsavedChanges]
  );

  const fileTree = buildFileTree(state.fragments);

  // Handle folder toggle
  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(path)) {
        newExpanded.delete(path);
      } else {
        newExpanded.add(path);
      }
      return newExpanded;
    });
  }, []);

  // Handle file selection
  const handleFileSelect = useCallback(
    (fragmentId: string, event?: React.MouseEvent) => {
      if (multiSelect && event) {
        if (event.ctrlKey || event.metaKey) {
          // Toggle selection for ctrl/cmd+click
          setSelectedFiles(prev => {
            const newSelection = new Set(prev);
            if (newSelection.has(fragmentId)) {
              newSelection.delete(fragmentId);
            } else {
              newSelection.add(fragmentId);
            }
            // Notify parent of selection change
            if (onSelectionChange) {
              onSelectionChange(Array.from(newSelection));
            }
            return newSelection;
          });
        } else if (event.shiftKey && selectedFiles.size > 0) {
          // Range selection for shift+click
          const fragments = state.fragments.filter(f => f.type === 'file');
          const currentIndex = fragments.findIndex(f => f.id === fragmentId);
          const lastSelectedId = Array.from(selectedFiles).pop();
          const lastIndex = fragments.findIndex(f => f.id === lastSelectedId);

          if (currentIndex !== -1 && lastIndex !== -1) {
            const start = Math.min(currentIndex, lastIndex);
            const end = Math.max(currentIndex, lastIndex);
            const rangeIds = fragments.slice(start, end + 1).map(f => f.id);

            setSelectedFiles(prev => {
              const newSelection = new Set([...prev, ...rangeIds]);
              if (onSelectionChange) {
                onSelectionChange(Array.from(newSelection));
              }
              return newSelection;
            });
          }
        } else {
          // Single selection
          setSelectedFiles(new Set([fragmentId]));
          if (onSelectionChange) {
            onSelectionChange([fragmentId]);
          }
        }
      } else if (!multiSelect) {
        // Clear selection when not in multiSelect mode
        setSelectedFiles(new Set());
        if (onSelectionChange) {
          onSelectionChange([]);
        }
      }

      // Always set active fragment for editing
      setActiveFragment(fragmentId);
    },
    [setActiveFragment, multiSelect, selectedFiles, state.fragments, onSelectionChange]
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
    [onSelectionChange]
  );

  // Expose methods via ref
  React.useImperativeHandle(
    ref,
    () => ({
      getSelectedFiles,
      clearSelection,
      selectFiles,
    }),
    [getSelectedFiles, clearSelection, selectFiles]
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
        content: '// New CUE fragment\n',
      });

      // Add to fragments list
      const newFragment: Fragment = {
        id: response.id,
        project_id: currentProject.id,
        path: response.path,
        content: '// New CUE fragment\n',
        created_at: response.created_at,
        updated_at: response.created_at,
      };

      dispatch({ type: 'UPDATE_FRAGMENT', payload: newFragment });
      setActiveFragment(response.id);
      setShowCreateForm(false);
      setNewFragmentPath('');

      toast.success(`Created fragment: ${response.path}`, {
        position: 'top-right',
        autoClose: 2000,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create fragment';
      setError(message);
      toast.error(message, {
        position: 'top-right',
        autoClose: 5000,
      });
    }
  }, [currentProject, newFragmentPath, dispatch, setActiveFragment, setError]);

  // Handle delete fragment
  const handleDeleteFragment = useCallback(
    async (fragmentId: string, fragmentPath: string) => {
      if (!currentProject) return;

      if (!confirm(`Are you sure you want to delete "${fragmentPath}"?`)) {
        return;
      }

      try {
        await apiService.deleteFragment(currentProject.id, fragmentId);
        dispatch({ type: 'DELETE_FRAGMENT', payload: fragmentId });

        toast.success(`Deleted fragment: ${fragmentPath}`, {
          position: 'top-right',
          autoClose: 2000,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete fragment';
        setError(message);
        toast.error(message, {
          position: 'top-right',
          autoClose: 5000,
        });
      }
    },
    [currentProject, dispatch, setError]
  );

  return (
    <div className={cn('h-full flex flex-col bg-white', className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-graphite-200 bg-gradient-to-r from-graphite-50 to-white rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Folder className="h-4 w-4 text-graphite-500" />
            <h3 className="font-semibold text-sm text-graphite-800">Explorer</h3>
            <span className="px-2 py-0.5 bg-graphite-200 text-graphite-600 text-xs rounded-full font-medium">
              {state.fragments.length}
            </span>
          </div>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setShowCreateForm(!showCreateForm)}
            className={cn(
              'text-graphite-500 hover:text-graphite-700 hover:bg-graphite-100/80',
              'transition-all duration-200 rounded-md',
              showCreateForm && 'bg-blue-50 text-blue-700 hover:text-blue-800 hover:bg-blue-100'
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
                onChange={e => setNewFragmentPath(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateFragment();
                  } else if (e.key === 'Escape') {
                    setShowCreateForm(false);
                    setNewFragmentPath('');
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
                  setNewFragmentPath('');
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
            {fileTree.map(item => (
              <FileTreeItemComponent
                key={item.id}
                item={item}
                level={0}
                expandedFolders={expandedFolders}
                activeFragmentId={state.activeFragmentId}
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

interface FileTreeItemComponentProps {
  item: FileTreeItem;
  level: number;
  expandedFolders: Set<string>;
  activeFragmentId: string | null;
  selectedFiles: Set<string>;
  multiSelect: boolean;
  onToggleFolder: (path: string) => void;
  onFileSelect: (fragmentId: string, event?: React.MouseEvent) => void;
  onDeleteFragment: (fragmentId: string, fragmentPath: string) => void;
}

function FileTreeItemComponent({
  item,
  level,
  expandedFolders,
  activeFragmentId,
  selectedFiles,
  multiSelect,
  onToggleFolder,
  onFileSelect,
  onDeleteFragment,
}: FileTreeItemComponentProps) {
  const isExpanded = expandedFolders.has(item.path);
  const isActive = item.type === 'file' && activeFragmentId === item.id;
  const isSelected = item.type === 'file' && selectedFiles.has(item.id);
  const [showActions, setShowActions] = useState(false);

  const handleClick = (event: React.MouseEvent) => {
    if (item.type === 'directory') {
      onToggleFolder(item.path);
    } else {
      onFileSelect(item.id, event);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteFragment(item.id, item.path);
  };

  const fileName = item.path.split('/').pop() || item.path;
  const FileIcon = item.type === 'file' ? getFileIcon(fileName) : null;

  // Enhanced indentation with connecting lines
  const indentationElements = [];
  for (let i = 0; i < level; i++) {
    indentationElements.push(
      <div
        key={i}
        className="w-4 flex justify-center"
        style={{ marginLeft: i === 0 ? '0px' : '0px' }}
      >
        <div className="w-px bg-graphite-200 h-full"></div>
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          'group relative flex items-center gap-1.5 py-1 px-2 text-sm cursor-pointer rounded-lg',
          'hover:bg-graphite-50 active:bg-graphite-100',
          'transition-all duration-200 ease-out',
          'focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-graphite-50',
          // Active state for files (editing)
          isActive && [
            'bg-gradient-to-r from-blue-50 to-blue-50/30',
            'border border-blue-200/60',
            'shadow-sm shadow-blue-100/50',
            'text-blue-700',
          ],
          // Selected state for files (multi-select)
          multiSelect &&
            isSelected &&
            !isActive && [
              'bg-gradient-to-r from-green-50 to-green-50/30',
              'border border-green-200/60',
              'shadow-sm shadow-green-100/50',
              'text-green-700',
            ],
          // Directory styling
          item.type === 'directory' && 'font-medium',
          // Unsaved changes styling
          item.hasUnsavedChanges && 'bg-amber-50/50 border border-amber-200/50'
        )}
        onClick={handleClick}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
        tabIndex={0}
        role="button"
        aria-expanded={item.type === 'directory' ? isExpanded : undefined}
        aria-label={`${item.type === 'directory' ? 'Folder' : 'File'} ${fileName}`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        {/* Hierarchy connector line */}
        {level > 0 && (
          <div className="absolute left-0 top-0 bottom-0 flex">{indentationElements}</div>
        )}

        {/* Expand/collapse chevron for directories */}
        {item.type === 'directory' && (
          <div className="flex-shrink-0 p-0.5 rounded transition-transform duration-200">
            {isExpanded ? (
              <ChevronDown className="h-3 w-3 text-graphite-500" />
            ) : (
              <ChevronRight className="h-3 w-3 text-graphite-500" />
            )}
          </div>
        )}

        {/* Icon */}
        <div
          className={cn(
            'flex-shrink-0 transition-all duration-200',
            item.type === 'directory' ? 'text-graphite-600' : 'text-graphite-500'
          )}
        >
          {item.type === 'directory' ? (
            isExpanded ? (
              <FolderOpen className={cn('h-4 w-4', isExpanded && 'text-blue-600')} />
            ) : (
              <Folder className="h-4 w-4" />
            )
          ) : (
            FileIcon && (
              <FileIcon
                className={cn(
                  'h-4 w-4',
                  isActive ? 'text-blue-600' : 'text-graphite-500',
                  // Special styling for CUE files
                  fileName.endsWith('.cue') && 'text-purple-500'
                )}
              />
            )
          )}
        </div>

        {/* Name */}
        <span
          className={cn(
            'flex-1 truncate transition-colors duration-200',
            isActive ? 'text-blue-800 font-medium' : 'text-graphite-700',
            item.type === 'directory' && 'font-medium',
            item.hasUnsavedChanges && 'text-amber-800 font-semibold'
          )}
        >
          {fileName}
        </span>

        {/* Multi-select checkbox */}
        {multiSelect && item.type === 'file' && (
          <div className="flex-shrink-0 flex items-center mr-2">
            <div
              className={cn(
                'w-4 h-4 border-2 rounded transition-all duration-200 flex items-center justify-center',
                isSelected
                  ? 'bg-green-500 border-green-500 text-white'
                  : 'border-graphite-300 hover:border-green-400'
              )}
            >
              {isSelected && (
                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>
          </div>
        )}

        {/* Unsaved changes indicator */}
        {item.hasUnsavedChanges && (
          <div className="flex-shrink-0 flex items-center gap-1">
            <div className="w-2 h-2 bg-amber-500 rounded-full shadow-sm"></div>
          </div>
        )}

        {/* Actions */}
        {item.type === 'file' && (
          <div
            className={cn(
              'flex-shrink-0 flex items-center gap-0.5 transition-all duration-200',
              showActions ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'
            )}
          >
            <button
              type="button"
              className={cn(
                'p-1.5 rounded-md transition-all duration-200',
                'text-graphite-400 hover:text-red-600 hover:bg-red-50',
                'focus:outline-none focus:ring-1 focus:ring-red-500/50',
                'shadow-sm hover:shadow'
              )}
              onClick={handleDelete}
              title="Delete fragment"
              aria-label={`Delete ${fileName}`}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* File type badge for special files */}
        {item.type === 'file' && fileName.endsWith('.cue') && (
          <div className="flex-shrink-0">
            <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded">
              CUE
            </span>
          </div>
        )}
      </div>

      {/* Children with smooth animation */}
      {item.type === 'directory' && item.children && (
        <div
          className={cn(
            'overflow-hidden transition-all duration-300 ease-out',
            isExpanded ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
          )}
          style={{
            transitionProperty: 'max-height, opacity',
          }}
        >
          <div className="space-y-0.5">
            {item.children.map(child => (
              <FileTreeItemComponent
                key={child.id}
                item={child}
                level={level + 1}
                expandedFolders={expandedFolders}
                activeFragmentId={activeFragmentId}
                selectedFiles={selectedFiles}
                multiSelect={multiSelect}
                onToggleFolder={onToggleFolder}
                onFileSelect={onFileSelect}
                onDeleteFragment={onDeleteFragment}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default FileTree;
