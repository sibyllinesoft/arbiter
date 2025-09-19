/**
 * Top navigation bar with project controls - Enhanced with Graphite Design System
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import {
  Save,
  CheckCircle,
  AlertCircle,
  Loader2,
  Lock,
  RefreshCw,
  ChevronDown,
  Wifi,
  WifiOff,
  GitBranch,
  Clock,
  User,
} from 'lucide-react';
import {
  useApp,
  useCurrentProject,
  useConnectionStatus,
  useValidationState,
  useCueFileState,
} from '../../contexts/AppContext';
import { apiService } from '../../services/api';
import { toast } from 'react-toastify';
import { Button, StatusBadge, cn } from '../../design-system';
import { createLogger } from '../../utils/logger';

const log = createLogger('TopBar');

export interface TopBarProps {
  className?: string;
}

export function TopBar({ className }: TopBarProps) {
  const { state, setLoading, setError, dispatch, setSelectedCueFile } = useApp();

  const currentProject = useCurrentProject();
  const { isConnected, reconnectAttempts, lastSync } = useConnectionStatus();
  const { isValidating, errors, warnings, specHash } = useValidationState();
  const { selectedCueFile, availableCueFiles } = useCueFileState();

  const [isSaving, setIsSaving] = useState(false);
  const [isFreezing, setIsFreezing] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Initialize default CUE file selection
  useEffect(() => {
    if (!selectedCueFile && availableCueFiles.length > 0) {
      setSelectedCueFile(availableCueFiles[0]);
      log.debug('Auto-selected first CUE file:', availableCueFiles[0]);
    }
  }, [selectedCueFile, availableCueFiles, setSelectedCueFile]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  // Save all unsaved fragments
  const handleSave = useCallback(async () => {
    if (!currentProject || state.unsavedChanges.size === 0) {
      return;
    }

    setIsSaving(true);
    try {
      const savePromises = Array.from(state.unsavedChanges).map(async fragmentId => {
        const content = state.editorContent[fragmentId];
        if (content !== undefined) {
          await apiService.updateFragment(currentProject.id, fragmentId, content);
          dispatch({ type: 'MARK_SAVED', payload: fragmentId });
        }
      });

      await Promise.all(savePromises);

      toast.success(`Saved ${savePromises.length} fragment(s)`, {
        position: 'top-right',
        autoClose: 2000,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save fragments';
      setError(message);
      toast.error(message, {
        position: 'top-right',
        autoClose: 5000,
      });
    } finally {
      setIsSaving(false);
    }
  }, [currentProject, state.unsavedChanges, state.editorContent, dispatch, setError]);

  // Validate project
  const handleValidate = useCallback(async () => {
    if (!currentProject) return;

    setLoading(true);
    dispatch({
      type: 'SET_VALIDATION_STATE',
      payload: {
        errors: [],
        warnings: [],
        isValidating: true,
        lastValidation: null,
        specHash: specHash,
      },
    });

    try {
      const result = await apiService.validateProject(currentProject.id, { force: true });

      dispatch({
        type: 'SET_VALIDATION_STATE',
        payload: {
          errors: result.errors,
          warnings: result.warnings,
          isValidating: false,
          lastValidation: new Date().toISOString(),
          specHash: result.spec_hash,
        },
      });

      if (result.success) {
        toast.success('Validation completed successfully', {
          position: 'top-right',
          autoClose: 3000,
        });
      } else {
        toast.warning(
          `Validation found ${result.errors.length} errors and ${result.warnings.length} warnings`,
          {
            position: 'top-right',
            autoClose: 5000,
          }
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Validation failed';
      setError(message);

      dispatch({
        type: 'SET_VALIDATION_STATE',
        payload: {
          errors: [],
          warnings: [],
          isValidating: false,
          lastValidation: null,
          specHash: specHash,
        },
      });

      toast.error(message, {
        position: 'top-right',
        autoClose: 5000,
      });
    } finally {
      setLoading(false);
    }
  }, [currentProject, setLoading, setError, dispatch, specHash]);

  // Freeze current version
  const handleFreeze = useCallback(async () => {
    if (!currentProject) return;

    const versionName = prompt('Enter version name:');
    if (!versionName) return;

    const description = prompt('Enter description (optional):') || undefined;

    setIsFreezing(true);
    try {
      const result = await apiService.freezeVersion(currentProject.id, {
        version_name: versionName,
        description,
      });

      toast.success(`Version "${versionName}" frozen successfully`, {
        position: 'top-right',
        autoClose: 3000,
      });

      log.debug('Version frozen:', result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to freeze version';
      setError(message);
      toast.error(message, {
        position: 'top-right',
        autoClose: 5000,
      });
    } finally {
      setIsFreezing(false);
    }
  }, [currentProject, setError]);

  // Handle CUE file change
  const handleCueFileChange = useCallback(
    (fileName: string) => {
      try {
        setSelectedCueFile(fileName);
        log.debug('CUE file changed to:', fileName);

        // Optionally trigger re-validation when CUE file changes
        if (currentProject && fileName) {
          toast.info(`Switched to ${fileName}`, {
            position: 'top-right',
            autoClose: 2000,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to change CUE file';
        setError(message);
        log.error('Failed to change CUE file:', error);
      }
    },
    [setSelectedCueFile, currentProject, setError]
  );

  // Get validation status
  const getValidationStatus = () => {
    if (isValidating) {
      return { icon: Loader2, text: 'Validating...', color: 'text-blue-600', spinning: true };
    }

    if (errors.length > 0) {
      return {
        icon: AlertCircle,
        text: `${errors.length} error${errors.length > 1 ? 's' : ''}`,
        color: 'text-red-600',
        spinning: false,
      };
    }

    if (warnings.length > 0) {
      return {
        icon: AlertCircle,
        text: `${warnings.length} warning${warnings.length > 1 ? 's' : ''}`,
        color: 'text-yellow-600',
        spinning: false,
      };
    }

    return {
      icon: CheckCircle,
      text: 'Valid',
      color: 'text-green-600',
      spinning: false,
    };
  };

  const validationStatus = getValidationStatus();
  const hasUnsavedChanges = state.unsavedChanges.size > 0;

  return (
    <div
      className={cn(
        'flex items-center justify-between h-16 px-6',
        'bg-gradient-to-r from-white via-graphite-25 to-white',
        'border-b border-graphite-200 shadow-sm',
        'backdrop-blur-sm relative z-30',
        className
      )}
    >
      {/* Subtle top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent" />

      {/* Left section - Project & Status */}
      <div className="flex items-center gap-6">
        {/* Project selector */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-sm">
            <GitBranch className="w-4 h-4 text-white" />
          </div>
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 font-semibold text-graphite-800 hover:text-graphite-900',
                'hover:bg-graphite-100 border border-transparent hover:border-graphite-200',
                'transition-all duration-200 rounded-lg bg-transparent'
              )}
            >
              {currentProject ? (
                <span className="flex items-center gap-2">
                  {currentProject.name}
                  <span className="text-xs text-graphite-500 font-normal">spec</span>
                </span>
              ) : (
                'Select Project'
              )}
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-graphite-500 transition-transform duration-200',
                  showDropdown && 'rotate-180'
                )}
              />
            </button>

            {showDropdown && (
              <div className="absolute left-0 top-full mt-2 w-64 rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 z-50 animate-in fade-in-0 zoom-in-95 duration-100">
                <div className="p-1">
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                    Available Projects ({state.projects.length})
                  </div>
                  {state.projects.length > 0 ? (
                    state.projects.map(project => (
                      <button
                        key={project.id}
                        onClick={() => {
                          dispatch({ type: 'SET_CURRENT_PROJECT', payload: project });
                          setShowDropdown(false);
                          log.debug('Selected project:', project.name);
                        }}
                        className={cn(
                          'group flex w-full items-center rounded-md px-3 py-2 text-sm transition-colors hover:bg-gray-100',
                          currentProject?.id === project.id
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-700'
                        )}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="text-left">
                            <div className="font-medium">{project.name}</div>
                            <div className="text-xs text-gray-500">{project.id}</div>
                          </div>
                          {currentProject?.id === project.id && (
                            <CheckCircle className="h-4 w-4 text-blue-600" />
                          )}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-gray-500">No projects available</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CUE selector */}
        <div className="flex items-center gap-3 pl-6 border-l border-graphite-200">
          <span className="text-sm font-medium text-graphite-600">CUE:</span>
          <select
            value={selectedCueFile || ''}
            onChange={e => handleCueFileChange(e.target.value)}
            className="px-3 py-1.5 text-sm border border-graphite-200 rounded-md bg-white hover:border-graphite-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            disabled={!currentProject}
          >
            {availableCueFiles.length === 0 ? (
              <option value="">No CUE files available</option>
            ) : (
              availableCueFiles.map(fileName => (
                <option key={fileName} value={fileName}>
                  {fileName}
                </option>
              ))
            )}
          </select>
          {selectedCueFile && (
            <div className="text-xs text-graphite-400 font-mono bg-graphite-50 px-2 py-1 rounded border">
              {selectedCueFile.split('.')[0]}
            </div>
          )}
        </div>
      </div>

      {/* Right section - Validation & Actions */}
      <div className="flex items-center gap-8">
        {/* Validation status - Enhanced */}
        <div className="flex items-center gap-4">
          <StatusBadge
            variant={
              isValidating
                ? 'info'
                : errors.length > 0
                  ? 'error'
                  : warnings.length > 0
                    ? 'warning'
                    : 'success'
            }
            size="sm"
            icon={
              isValidating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : errors.length > 0 ? (
                <AlertCircle className="h-3 w-3" />
              ) : warnings.length > 0 ? (
                <AlertCircle className="h-3 w-3" />
              ) : (
                <CheckCircle className="h-3 w-3" />
              )
            }
            className="font-medium"
          >
            {validationStatus.text}
          </StatusBadge>

          {/* Spec hash indicator */}
          {specHash && (
            <div className="text-xs text-graphite-400 font-mono bg-graphite-50 px-2 py-1 rounded border">
              {specHash.substring(0, 8)}
            </div>
          )}
        </div>

        {/* Action buttons - Enhanced layout */}
        <div className="flex items-center gap-3 pl-6 border-l border-graphite-200">
          <Button
            variant={hasUnsavedChanges ? 'primary' : 'secondary'}
            size="sm"
            leftIcon={
              isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />
            }
            onClick={handleSave}
            disabled={!hasUnsavedChanges || isSaving}
            className={cn(
              'min-w-[88px] font-medium transition-all duration-200',
              hasUnsavedChanges && 'shadow-sm shadow-blue-500/20'
            )}
          >
            Save{' '}
            {hasUnsavedChanges && (
              <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded text-xs">
                {state.unsavedChanges.size}
              </span>
            )}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            leftIcon={
              isValidating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )
            }
            onClick={handleValidate}
            disabled={isValidating || !currentProject}
            className="font-medium"
          >
            Validate
          </Button>

          <Button
            variant="secondary"
            size="sm"
            leftIcon={
              isFreezing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lock className="h-4 w-4" />
              )
            }
            onClick={handleFreeze}
            disabled={isFreezing || !currentProject || errors.length > 0}
            className={cn(
              'font-medium',
              errors.length === 0 &&
                !isFreezing &&
                'hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700'
            )}
          >
            Freeze
          </Button>
        </div>

        {/* User indicator */}
        <div className="flex items-center gap-2 pl-4 border-l border-graphite-200">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-graphite-300 to-graphite-400 flex items-center justify-center shadow-sm">
            <User className="w-4 h-4 text-white" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default TopBar;
