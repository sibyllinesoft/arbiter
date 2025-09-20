/**
 * Main application context for state management
 */

import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import type { Project } from '../types/api';

interface AppState {
  projects: Project[];
  currentProject: Project | null;
  isConnected: boolean;
  reconnectAttempts: number;
  lastSync: string | null;
  isValidating: boolean;
  errors: Array<{ message: string; line?: number; column?: number }>;
  warnings: Array<{ message: string; line?: number; column?: number }>;
  specHash: string | null;
  lastValidation: string | null;
  selectedCueFile: string | null;
  availableCueFiles: string[];
  unsavedChanges: Set<string>;
  editorContent: Record<string, string>;
  loading: boolean;
  error: string | null;
  settings: {
    showNotifications: boolean;
  };
}

type AppAction =
  | { type: 'SET_PROJECTS'; payload: Project[] }
  | { type: 'SET_CURRENT_PROJECT'; payload: Project | null }
  | { type: 'SET_CONNECTION_STATUS'; payload: boolean }
  | {
      type: 'SET_VALIDATION_STATE';
      payload: Partial<
        Pick<AppState, 'errors' | 'warnings' | 'isValidating' | 'lastValidation' | 'specHash'>
      >;
    }
  | { type: 'SET_SELECTED_CUE_FILE'; payload: string | null }
  | { type: 'SET_AVAILABLE_CUE_FILES'; payload: string[] }
  | { type: 'MARK_UNSAVED'; payload: string }
  | { type: 'MARK_SAVED'; payload: string }
  | { type: 'SET_EDITOR_CONTENT'; payload: { fragmentId: string; content: string } }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<AppState['settings']> };

const initialState: AppState = {
  projects: [],
  currentProject: null,
  isConnected: true,
  reconnectAttempts: 0,
  lastSync: null,
  isValidating: false,
  errors: [],
  warnings: [],
  specHash: null,
  lastValidation: null,
  selectedCueFile: null,
  availableCueFiles: [],
  unsavedChanges: new Set(),
  editorContent: {},
  loading: false,
  error: null,
  settings: {
    showNotifications: false,
  },
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_PROJECTS':
      return { ...state, projects: action.payload };
    case 'SET_CURRENT_PROJECT':
      return { ...state, currentProject: action.payload };
    case 'SET_CONNECTION_STATUS':
      return { ...state, isConnected: action.payload };
    case 'SET_VALIDATION_STATE':
      return { ...state, ...action.payload };
    case 'SET_SELECTED_CUE_FILE':
      return { ...state, selectedCueFile: action.payload };
    case 'SET_AVAILABLE_CUE_FILES':
      return { ...state, availableCueFiles: action.payload };
    case 'MARK_UNSAVED':
      return { ...state, unsavedChanges: new Set([...state.unsavedChanges, action.payload]) };
    case 'MARK_SAVED':
      const newUnsavedChanges = new Set(state.unsavedChanges);
      newUnsavedChanges.delete(action.payload);
      return { ...state, unsavedChanges: newUnsavedChanges };
    case 'SET_EDITOR_CONTENT':
      return {
        ...state,
        editorContent: {
          ...state.editorContent,
          [action.payload.fragmentId]: action.payload.content,
        },
      };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };
    default:
      return state;
  }
}

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSelectedCueFile: (file: string | null) => void;
  updateSettings: (settings: Partial<AppState['settings']>) => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const setLoading = (loading: boolean) => dispatch({ type: 'SET_LOADING', payload: loading });
  const setError = (error: string | null) => dispatch({ type: 'SET_ERROR', payload: error });
  const setSelectedCueFile = (file: string | null) =>
    dispatch({ type: 'SET_SELECTED_CUE_FILE', payload: file });
  const updateSettings = (settings: Partial<AppState['settings']>) =>
    dispatch({ type: 'UPDATE_SETTINGS', payload: settings });

  const value: AppContextValue = {
    state,
    dispatch,
    setLoading,
    setError,
    setSelectedCueFile,
    updateSettings,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

export function useCurrentProject() {
  const { state } = useApp();
  return state.currentProject;
}

export function useConnectionStatus() {
  const { state } = useApp();
  return {
    isConnected: state.isConnected,
    reconnectAttempts: state.reconnectAttempts,
    lastSync: state.lastSync,
  };
}

export function useValidationState() {
  const { state } = useApp();
  return {
    isValidating: state.isValidating,
    errors: state.errors,
    warnings: state.warnings,
    specHash: state.specHash,
    lastValidation: state.lastValidation,
  };
}

export function useCueFileState() {
  const { state } = useApp();
  return {
    selectedCueFile: state.selectedCueFile,
    availableCueFiles: state.availableCueFiles,
  };
}

export function useAppSettings() {
  const { state, updateSettings } = useApp();
  return {
    settings: state.settings,
    updateSettings,
  };
}
