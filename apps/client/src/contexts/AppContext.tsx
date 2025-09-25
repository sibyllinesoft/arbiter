/**
 * Main application context for state management
 */

import React, { createContext, useContext, useReducer } from 'react';
import type { ReactNode } from 'react';
import type { Fragment, Project } from '../types/api';

interface AppState {
  projects: Project[];
  fragments: Fragment[];
  activeFragmentId: string | null;
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
  // UI State
  activeTab: string;
  currentView: 'dashboard' | 'config' | 'project';
  gitUrl: string;
  modalTab: 'git' | 'github';
  // GitHub Integration State
  gitHubRepos: any[];
  gitHubOrgs: any[];
  selectedRepos: Set<number>;
  reposByOwner: Record<string, any[]>;
  isLoadingGitHub: boolean;
}

type AppAction =
  | { type: 'SET_PROJECTS'; payload: Project[] }
  | { type: 'SET_FRAGMENTS'; payload: Fragment[] }
  | { type: 'UPDATE_FRAGMENT'; payload: Fragment }
  | { type: 'DELETE_FRAGMENT'; payload: string }
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
  | { type: 'UPDATE_SETTINGS'; payload: Partial<AppState['settings']> }
  | { type: 'SET_ACTIVE_TAB'; payload: string }
  | { type: 'SET_CURRENT_VIEW'; payload: 'dashboard' | 'config' | 'project' }
  | { type: 'SET_GIT_URL'; payload: string }
  | { type: 'SET_MODAL_TAB'; payload: 'git' | 'github' }
  | { type: 'SET_GITHUB_REPOS'; payload: any[] }
  | { type: 'SET_GITHUB_ORGS'; payload: any[] }
  | { type: 'SET_SELECTED_REPOS'; payload: Set<number> }
  | { type: 'TOGGLE_REPO_SELECTION'; payload: number }
  | { type: 'SET_REPOS_BY_OWNER'; payload: Record<string, any[]> }
  | { type: 'SET_LOADING_GITHUB'; payload: boolean }
  | { type: 'SET_ACTIVE_FRAGMENT'; payload: string | null };

const initialState: AppState = {
  projects: [],
  fragments: [],
  activeFragmentId: null,
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
  // UI State - persist using localStorage
  activeTab: localStorage.getItem('arbiter:activeTab') || 'source',
  currentView: 'dashboard',
  gitUrl: localStorage.getItem('arbiter:gitUrl') || '',
  modalTab: (localStorage.getItem('arbiter:modalTab') as 'git' | 'github') || 'git',
  // GitHub Integration State
  gitHubRepos: JSON.parse(localStorage.getItem('arbiter:githubRepos') || '[]'),
  gitHubOrgs: JSON.parse(localStorage.getItem('arbiter:githubOrgs') || '[]'),
  selectedRepos: new Set<number>(),
  reposByOwner: JSON.parse(localStorage.getItem('arbiter:reposByOwner') || '{}'),
  isLoadingGitHub: false,
};

// Persistence middleware for GitHub state
function persistGitHubState(state: AppState): void {
  const githubStateKeys = ['gitHubRepos', 'gitHubOrgs', 'reposByOwner'] as const;

  githubStateKeys.forEach(key => {
    try {
      localStorage.setItem(`arbiter:${key.toLowerCase()}`, JSON.stringify(state[key]));
    } catch (error) {
      console.warn(`Failed to persist ${key} to localStorage:`, error);
    }
  });
}

function appReducer(state: AppState, action: AppAction): AppState {
  const newState = (() => {
    switch (action.type) {
      case 'SET_PROJECTS':
        return { ...state, projects: action.payload };
      case 'SET_FRAGMENTS':
        return { ...state, fragments: action.payload };
      case 'UPDATE_FRAGMENT':
        return {
          ...state,
          fragments: state.fragments.map(f => (f.id === action.payload.id ? action.payload : f)),
        };
      case 'DELETE_FRAGMENT':
        return {
          ...state,
          fragments: state.fragments.filter(f => f.id !== action.payload),
        };
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
      case 'SET_ACTIVE_TAB':
        // Persist tab selection to localStorage
        localStorage.setItem('arbiter:activeTab', action.payload);
        return { ...state, activeTab: action.payload };
      case 'SET_CURRENT_VIEW':
        return { ...state, currentView: action.payload };
      case 'SET_GIT_URL':
        // Persist git URL to localStorage for convenience
        localStorage.setItem('arbiter:gitUrl', action.payload);
        return { ...state, gitUrl: action.payload };
      case 'SET_MODAL_TAB':
        // Persist modal tab to localStorage
        localStorage.setItem('arbiter:modalTab', action.payload);
        return { ...state, modalTab: action.payload };
      case 'SET_GITHUB_REPOS':
        return { ...state, gitHubRepos: action.payload };
      case 'SET_GITHUB_ORGS':
        return { ...state, gitHubOrgs: action.payload };
      case 'SET_SELECTED_REPOS':
        return { ...state, selectedRepos: action.payload };
      case 'TOGGLE_REPO_SELECTION':
        const newSelectedRepos = new Set(state.selectedRepos);
        if (newSelectedRepos.has(action.payload)) {
          newSelectedRepos.delete(action.payload);
        } else {
          newSelectedRepos.add(action.payload);
        }
        return { ...state, selectedRepos: newSelectedRepos };
      case 'SET_REPOS_BY_OWNER':
        return { ...state, reposByOwner: action.payload };
      case 'SET_LOADING_GITHUB':
        return { ...state, isLoadingGitHub: action.payload };
      case 'SET_ACTIVE_FRAGMENT':
        return { ...state, activeFragmentId: action.payload };
      default:
        return state;
    }
  })();

  // Persist GitHub state changes to localStorage
  const githubActions = ['SET_GITHUB_REPOS', 'SET_GITHUB_ORGS', 'SET_REPOS_BY_OWNER'];
  if (githubActions.includes(action.type)) {
    persistGitHubState(newState);
  }

  return newState;
}

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSelectedCueFile: (file: string | null) => void;
  updateSettings: (settings: Partial<AppState['settings']>) => void;
  setActiveTab: (tab: string) => void;
  setCurrentView: (view: 'dashboard' | 'config' | 'project') => void;
  setGitUrl: (url: string) => void;
  setModalTab: (tab: 'git' | 'github') => void;
  setGitHubRepos: (repos: any[]) => void;
  setGitHubOrgs: (orgs: any[]) => void;
  setSelectedRepos: (repos: Set<number>) => void;
  toggleRepoSelection: (repoId: number) => void;
  setReposByOwner: (
    reposByOwner: Record<string, any[]> | ((prev: Record<string, any[]>) => Record<string, any[]>)
  ) => void;
  setLoadingGitHub: (loading: boolean) => void;
  updateEditorContent: (fragmentId: string, content: string) => void;
  markUnsaved: (id: string) => void;
  markSaved: (id: string) => void;
  setActiveFragment: (id: string | null) => void;
  isDark: boolean;
  toggleTheme: () => void;
}

import { useTheme } from '../stores/ui-store';

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
  const setActiveTab = (tab: string) => dispatch({ type: 'SET_ACTIVE_TAB', payload: tab });
  const setCurrentView = (view: 'dashboard' | 'config' | 'project') =>
    dispatch({ type: 'SET_CURRENT_VIEW', payload: view });
  const setGitUrl = (url: string) => dispatch({ type: 'SET_GIT_URL', payload: url });
  const setModalTab = (tab: 'git' | 'github') => dispatch({ type: 'SET_MODAL_TAB', payload: tab });
  const setGitHubRepos = (repos: any[]) => dispatch({ type: 'SET_GITHUB_REPOS', payload: repos });
  const setGitHubOrgs = (orgs: any[]) => dispatch({ type: 'SET_GITHUB_ORGS', payload: orgs });
  const setSelectedRepos = (repos: Set<number>) =>
    dispatch({ type: 'SET_SELECTED_REPOS', payload: repos });
  const toggleRepoSelection = (repoId: number) =>
    dispatch({ type: 'TOGGLE_REPO_SELECTION', payload: repoId });
  const setReposByOwner = (
    reposByOwner: Record<string, any[]> | ((prev: Record<string, any[]>) => Record<string, any[]>)
  ) => {
    if (typeof reposByOwner === 'function') {
      dispatch({ type: 'SET_REPOS_BY_OWNER', payload: reposByOwner(state.reposByOwner) });
    } else {
      dispatch({ type: 'SET_REPOS_BY_OWNER', payload: reposByOwner });
    }
  };
  const setLoadingGitHub = (loading: boolean) =>
    dispatch({ type: 'SET_LOADING_GITHUB', payload: loading });

  const updateEditorContent = (fragmentId: string, content: string) =>
    dispatch({ type: 'SET_EDITOR_CONTENT', payload: { fragmentId, content } });
  const markUnsaved = (id: string) => dispatch({ type: 'MARK_UNSAVED', payload: id });
  const markSaved = (id: string) => dispatch({ type: 'MARK_SAVED', payload: id });
  const setActiveFragment = (id: string | null) =>
    dispatch({ type: 'SET_ACTIVE_FRAGMENT', payload: id });

  const { isDark, toggleTheme } = useTheme();

  const value: AppContextValue = {
    state,
    dispatch,
    setLoading,
    setError,
    setSelectedCueFile,
    updateSettings,
    setActiveTab,
    setCurrentView,
    setGitUrl,
    setModalTab,
    setGitHubRepos,
    setGitHubOrgs,
    setSelectedRepos,
    toggleRepoSelection,
    setReposByOwner,
    setLoadingGitHub,
    updateEditorContent,
    markUnsaved,
    markSaved,
    setActiveFragment,
    isDark,
    toggleTheme,
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

// Note: useCurrentProject is provided by ProjectContext, not AppContext

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

export function useUIState() {
  const { state, setActiveTab, setCurrentView, setGitUrl, setModalTab } = useApp();
  return {
    activeTab: state.activeTab,
    currentView: state.currentView,
    gitUrl: state.gitUrl,
    modalTab: state.modalTab,
    setActiveTab,
    setCurrentView,
    setGitUrl,
    setModalTab,
  };
}

export function useGitHubState() {
  const {
    state,
    setGitHubRepos,
    setGitHubOrgs,
    setSelectedRepos,
    toggleRepoSelection,
    setReposByOwner,
    setLoadingGitHub,
  } = useApp();
  return {
    gitHubRepos: state.gitHubRepos,
    gitHubOrgs: state.gitHubOrgs,
    selectedRepos: state.selectedRepos,
    reposByOwner: state.reposByOwner,
    isLoadingGitHub: state.isLoadingGitHub,
    setGitHubRepos,
    setGitHubOrgs,
    setSelectedRepos,
    toggleRepoSelection,
    setReposByOwner,
    setLoadingGitHub,
  };
}

export function useActiveFragment() {
  const { state } = useApp();
  return state.fragments.find(f => f.id === state.activeFragmentId) || null;
}

export function useEditorContent(fragmentId: string) {
  const { state } = useApp();
  return state.editorContent[fragmentId] || '';
}
