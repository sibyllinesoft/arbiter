/**
 * Main application context for global state management
 */

import React, { createContext, useContext, useReducer, useCallback } from 'react';
import type { AppState, AppAction, DiagramTab } from '../types/ui';
import type { Project, Fragment, GapSet, IRResponse, ValidationError, ValidationWarning } from '../types/api';

// Initial state
const initialState: AppState = {
  // Core data
  currentProject: null,
  fragments: [],
  resolved: null,
  gaps: null,
  irs: {},
  
  // UI state
  activeFragmentId: null,
  activeTab: 'flow',
  isLoading: false,
  error: null,
  
  // Editor state
  unsavedChanges: new Set(),
  editorContent: {},
  
  // Connection state
  isConnected: false,
  reconnectAttempts: 0,
  lastSync: null,
  
  // Validation state
  validationErrors: [],
  validationWarnings: [],
  isValidating: false,
  lastValidation: null,
  specHash: null,
};

// Reducer
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_PROJECT':
      return {
        ...state,
        currentProject: action.payload,
        fragments: action.payload ? state.fragments : [],
        resolved: action.payload ? state.resolved : null,
        gaps: action.payload ? state.gaps : null,
        irs: action.payload ? state.irs : {},
        activeFragmentId: action.payload ? state.activeFragmentId : null,
        error: null,
      };

    case 'SET_FRAGMENTS':
      return {
        ...state,
        fragments: action.payload,
      };

    case 'UPDATE_FRAGMENT': {
      const existingIndex = state.fragments.findIndex(f => f.id === action.payload.id);
      const newFragments = [...state.fragments];
      
      if (existingIndex >= 0) {
        newFragments[existingIndex] = action.payload;
      } else {
        newFragments.push(action.payload);
      }
      
      return {
        ...state,
        fragments: newFragments,
      };
    }

    case 'DELETE_FRAGMENT': {
      const newFragments = state.fragments.filter(f => f.id !== action.payload);
      const newUnsavedChanges = new Set(state.unsavedChanges);
      const newEditorContent = { ...state.editorContent };
      
      newUnsavedChanges.delete(action.payload);
      delete newEditorContent[action.payload];
      
      return {
        ...state,
        fragments: newFragments,
        unsavedChanges: newUnsavedChanges,
        editorContent: newEditorContent,
        activeFragmentId: state.activeFragmentId === action.payload ? null : state.activeFragmentId,
      };
    }

    case 'SET_RESOLVED':
      return {
        ...state,
        resolved: action.payload.resolved,
        specHash: action.payload.specHash,
      };

    case 'SET_GAPS':
      return {
        ...state,
        gaps: action.payload,
      };

    case 'SET_IR': {
      return {
        ...state,
        irs: {
          ...state.irs,
          [action.payload.kind]: action.payload.data,
        },
      };
    }

    case 'SET_ACTIVE_FRAGMENT':
      return {
        ...state,
        activeFragmentId: action.payload,
      };

    case 'SET_ACTIVE_TAB':
      return {
        ...state,
        activeTab: action.payload,
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };

    case 'SET_EDITOR_CONTENT': {
      return {
        ...state,
        editorContent: {
          ...state.editorContent,
          [action.payload.fragmentId]: action.payload.content,
        },
      };
    }

    case 'MARK_UNSAVED': {
      const newUnsavedChanges = new Set(state.unsavedChanges);
      newUnsavedChanges.add(action.payload);
      return {
        ...state,
        unsavedChanges: newUnsavedChanges,
      };
    }

    case 'MARK_SAVED': {
      const newUnsavedChanges = new Set(state.unsavedChanges);
      newUnsavedChanges.delete(action.payload);
      return {
        ...state,
        unsavedChanges: newUnsavedChanges,
      };
    }

    case 'SET_CONNECTION_STATUS':
      return {
        ...state,
        isConnected: action.payload,
        error: action.payload ? null : state.error,
      };

    case 'INCREMENT_RECONNECT_ATTEMPTS':
      return {
        ...state,
        reconnectAttempts: state.reconnectAttempts + 1,
      };

    case 'RESET_RECONNECT_ATTEMPTS':
      return {
        ...state,
        reconnectAttempts: 0,
      };

    case 'SET_LAST_SYNC':
      return {
        ...state,
        lastSync: action.payload,
      };

    case 'SET_VALIDATION_STATE':
      return {
        ...state,
        validationErrors: action.payload.errors,
        validationWarnings: action.payload.warnings,
        isValidating: action.payload.isValidating,
        lastValidation: action.payload.lastValidation,
        specHash: action.payload.specHash || state.specHash,
      };

    default:
      return state;
  }
}

// Context type
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  
  // Convenience methods
  setProject: (project: Project | null) => void;
  setActiveFragment: (fragmentId: string | null) => void;
  setActiveTab: (tab: DiagramTab) => void;
  updateEditorContent: (fragmentId: string, content: string) => void;
  markUnsaved: (fragmentId: string) => void;
  markSaved: (fragmentId: string) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
}

// Create context
const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider component
export interface AppProviderProps {
  children: React.ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Convenience methods
  const setProject = useCallback((project: Project | null) => {
    dispatch({ type: 'SET_PROJECT', payload: project });
  }, []);

  const setActiveFragment = useCallback((fragmentId: string | null) => {
    dispatch({ type: 'SET_ACTIVE_FRAGMENT', payload: fragmentId });
  }, []);

  const setActiveTab = useCallback((tab: DiagramTab) => {
    dispatch({ type: 'SET_ACTIVE_TAB', payload: tab });
  }, []);

  const updateEditorContent = useCallback((fragmentId: string, content: string) => {
    dispatch({ type: 'SET_EDITOR_CONTENT', payload: { fragmentId, content } });
  }, []);

  const markUnsaved = useCallback((fragmentId: string) => {
    dispatch({ type: 'MARK_UNSAVED', payload: fragmentId });
  }, []);

  const markSaved = useCallback((fragmentId: string) => {
    dispatch({ type: 'MARK_SAVED', payload: fragmentId });
  }, []);

  const setError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  }, []);

  const contextValue: AppContextType = {
    state,
    dispatch,
    setProject,
    setActiveFragment,
    setActiveTab,
    updateEditorContent,
    markUnsaved,
    markSaved,
    setError,
    setLoading,
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

// Hook to use the app context
export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

// Selectors for common state slices
export function useCurrentProject() {
  const { state } = useApp();
  return state.currentProject;
}

export function useFragments() {
  const { state } = useApp();
  return state.fragments;
}

export function useActiveFragment() {
  const { state } = useApp();
  return state.fragments.find(f => f.id === state.activeFragmentId) || null;
}

export function useEditorContent(fragmentId: string) {
  const { state } = useApp();
  return state.editorContent[fragmentId] || '';
}

export function useHasUnsavedChanges(fragmentId: string) {
  const { state } = useApp();
  return state.unsavedChanges.has(fragmentId);
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
    errors: state.validationErrors,
    warnings: state.validationWarnings,
    isValidating: state.isValidating,
    lastValidation: state.lastValidation,
    specHash: state.specHash,
  };
}