/**
 * Main application context for state management
 */

/* eslint-disable react-refresh/only-export-components */

import React, { createContext, useContext, useEffect, useReducer } from "react";
import type { ReactNode } from "react";
import { AUTH_TOKEN_STORAGE_KEY, type ProjectStructureSettings, apiService } from "../services/api";
import type { Fragment, Project } from "../types/api";
import type { GitHubOrganization, GitHubReposByOwner, GitHubRepository } from "../types/github";

export interface AppSettings {
  showNotifications: boolean;
  appsDirectory: string;
  packagesDirectory: string;
  servicesDirectory: string;
  testsDirectory: string;
  infraDirectory: string;
  endpointDirectory: string;
}

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
  settings: AppSettings;
  // UI State
  activeTab: string;
  currentView: "dashboard" | "config" | "project";
  gitUrl: string;
  modalTab: "git" | "github";
  // GitHub Integration State
  gitHubRepos: GitHubRepository[];
  gitHubOrgs: GitHubOrganization[];
  selectedRepos: Set<number>;
  reposByOwner: GitHubReposByOwner;
  isLoadingGitHub: boolean;
}

type AppAction =
  | { type: "SET_PROJECTS"; payload: Project[] }
  | { type: "SET_FRAGMENTS"; payload: Fragment[] }
  | { type: "UPDATE_FRAGMENT"; payload: Fragment }
  | { type: "DELETE_FRAGMENT"; payload: string }
  | { type: "SET_CONNECTION_STATUS"; payload: boolean }
  | {
      type: "SET_VALIDATION_STATE";
      payload: Partial<
        Pick<AppState, "errors" | "warnings" | "isValidating" | "lastValidation" | "specHash">
      >;
    }
  | { type: "SET_SELECTED_CUE_FILE"; payload: string | null }
  | { type: "SET_AVAILABLE_CUE_FILES"; payload: string[] }
  | { type: "MARK_UNSAVED"; payload: string }
  | { type: "MARK_SAVED"; payload: string }
  | { type: "SET_EDITOR_CONTENT"; payload: { fragmentId: string; content: string } }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "UPDATE_SETTINGS"; payload: Partial<AppState["settings"]> }
  | { type: "SET_ACTIVE_TAB"; payload: string }
  | { type: "SET_CURRENT_VIEW"; payload: "dashboard" | "config" | "project" }
  | { type: "SET_GIT_URL"; payload: string }
  | { type: "SET_MODAL_TAB"; payload: "git" | "github" }
  | { type: "SET_GITHUB_REPOS"; payload: GitHubRepository[] }
  | { type: "SET_GITHUB_ORGS"; payload: GitHubOrganization[] }
  | { type: "SET_SELECTED_REPOS"; payload: Set<number> }
  | { type: "TOGGLE_REPO_SELECTION"; payload: number }
  | { type: "SET_REPOS_BY_OWNER"; payload: GitHubReposByOwner }
  | { type: "SET_LOADING_GITHUB"; payload: boolean }
  | { type: "SET_ACTIVE_FRAGMENT"; payload: string | null };

const isBrowser = typeof window !== "undefined";
const STORAGE_KEYS = {
  activeTab: "arbiter:activeTab",
  gitUrl: "arbiter:gitUrl",
  modalTab: "arbiter:modalTab",
  gitHubRepos: "arbiter:githubRepos",
  gitHubOrgs: "arbiter:githubOrgs",
  reposByOwner: "arbiter:reposByOwner",
  settings: "arbiter:settings",
} as const;

const DEFAULT_APP_SETTINGS: AppSettings = {
  showNotifications: false,
  appsDirectory: "apps",
  packagesDirectory: "packages",
  servicesDirectory: "services",
  testsDirectory: "tests",
  infraDirectory: "infra",
  endpointDirectory: "apps/api/src/endpoints",
};

const PROJECT_STRUCTURE_FIELDS = [
  "appsDirectory",
  "packagesDirectory",
  "servicesDirectory",
  "testsDirectory",
  "infraDirectory",
  "endpointDirectory",
] as const;

function readStoredString(key: string, fallback: string): string {
  if (!isBrowser) return fallback;
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch (error) {
    console.warn(`Failed to read ${key} from localStorage`, error);
    return fallback;
  }
}

function readStoredJson<T>(key: string, fallback: T): T {
  if (!isBrowser) return fallback;

  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`Failed to parse ${key} from localStorage`, error);
    try {
      window.localStorage.removeItem(key);
    } catch (removeError) {
      console.warn(`Failed to remove ${key} from localStorage`, removeError);
    }
    return fallback;
  }
}

function createInitialState(): AppState {
  const modalTabRaw = readStoredString(STORAGE_KEYS.modalTab, "git");
  const modalTab: "git" | "github" = modalTabRaw === "github" ? "github" : "git";

  const storedActiveTab = readStoredString(STORAGE_KEYS.activeTab, "source");
  const activeTab = storedActiveTab === "friendly" ? "source" : storedActiveTab;

  const storedSettings = readStoredJson<AppSettings>(STORAGE_KEYS.settings, DEFAULT_APP_SETTINGS);
  const settings = { ...DEFAULT_APP_SETTINGS, ...storedSettings };

  return {
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
    settings,
    // UI State - persist using localStorage
    activeTab,
    currentView: "dashboard",
    gitUrl: readStoredString(STORAGE_KEYS.gitUrl, ""),
    modalTab,
    // GitHub Integration State
    gitHubRepos: readStoredJson<GitHubRepository[]>(STORAGE_KEYS.gitHubRepos, []),
    gitHubOrgs: readStoredJson<GitHubOrganization[]>(STORAGE_KEYS.gitHubOrgs, []),
    selectedRepos: new Set<number>(),
    reposByOwner: readStoredJson<GitHubReposByOwner>(STORAGE_KEYS.reposByOwner, {}),
    isLoadingGitHub: false,
  };
}

// Persistence middleware for GitHub state
function persistGitHubState(state: AppState): void {
  if (!isBrowser) return;

  const githubStateKeys = ["gitHubRepos", "gitHubOrgs", "reposByOwner"] as const;

  githubStateKeys.forEach((key) => {
    try {
      const storageKey = STORAGE_KEYS[key];
      const value = state[key];
      window.localStorage.setItem(storageKey, JSON.stringify(value));
    } catch (error) {
      console.warn(`Failed to persist ${key} to localStorage:`, error);
    }
  });
}

function appReducer(state: AppState, action: AppAction): AppState {
  const newState = (() => {
    switch (action.type) {
      case "SET_PROJECTS":
        return { ...state, projects: action.payload };
      case "SET_FRAGMENTS":
        return { ...state, fragments: action.payload };
      case "UPDATE_FRAGMENT":
        return {
          ...state,
          fragments: state.fragments.map((f) => (f.id === action.payload.id ? action.payload : f)),
        };
      case "DELETE_FRAGMENT":
        return {
          ...state,
          fragments: state.fragments.filter((f) => f.id !== action.payload),
        };
      case "SET_CONNECTION_STATUS":
        return { ...state, isConnected: action.payload };
      case "SET_VALIDATION_STATE":
        return { ...state, ...action.payload };
      case "SET_SELECTED_CUE_FILE":
        return { ...state, selectedCueFile: action.payload };
      case "SET_AVAILABLE_CUE_FILES":
        return { ...state, availableCueFiles: action.payload };
      case "MARK_UNSAVED":
        return { ...state, unsavedChanges: new Set([...state.unsavedChanges, action.payload]) };
      case "MARK_SAVED": {
        const newUnsavedChanges = new Set(state.unsavedChanges);
        newUnsavedChanges.delete(action.payload);
        return { ...state, unsavedChanges: newUnsavedChanges };
      }
      case "SET_EDITOR_CONTENT":
        return {
          ...state,
          editorContent: {
            ...state.editorContent,
            [action.payload.fragmentId]: action.payload.content,
          },
        };
      case "SET_LOADING":
        return { ...state, loading: action.payload };
      case "SET_ERROR":
        return { ...state, error: action.payload };
      case "UPDATE_SETTINGS": {
        const nextSettings = { ...state.settings, ...action.payload };
        if (isBrowser) {
          try {
            window.localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(nextSettings));
          } catch (error) {
            console.warn("Failed to persist settings to localStorage", error);
          }
        }
        return { ...state, settings: nextSettings };
      }
      case "SET_ACTIVE_TAB": {
        const nextActiveTab = action.payload === "friendly" ? "source" : action.payload;
        if (isBrowser) {
          window.localStorage.setItem(STORAGE_KEYS.activeTab, nextActiveTab);
        }
        return { ...state, activeTab: nextActiveTab };
      }
      case "SET_CURRENT_VIEW":
        return { ...state, currentView: action.payload };
      case "SET_GIT_URL":
        // Persist git URL to localStorage for convenience
        if (isBrowser) {
          window.localStorage.setItem(STORAGE_KEYS.gitUrl, action.payload);
        }
        return { ...state, gitUrl: action.payload };
      case "SET_MODAL_TAB":
        // Persist modal tab to localStorage
        if (isBrowser) {
          window.localStorage.setItem(STORAGE_KEYS.modalTab, action.payload);
        }
        return { ...state, modalTab: action.payload };
      case "SET_GITHUB_REPOS":
        return { ...state, gitHubRepos: action.payload };
      case "SET_GITHUB_ORGS":
        return { ...state, gitHubOrgs: action.payload };
      case "SET_SELECTED_REPOS":
        return { ...state, selectedRepos: action.payload };
      case "TOGGLE_REPO_SELECTION": {
        const newSelectedRepos = new Set(state.selectedRepos);
        if (newSelectedRepos.has(action.payload)) {
          newSelectedRepos.delete(action.payload);
        } else {
          newSelectedRepos.add(action.payload);
        }
        return { ...state, selectedRepos: newSelectedRepos };
      }
      case "SET_REPOS_BY_OWNER":
        return { ...state, reposByOwner: action.payload };
      case "SET_LOADING_GITHUB":
        return { ...state, isLoadingGitHub: action.payload };
      case "SET_ACTIVE_FRAGMENT":
        return { ...state, activeFragmentId: action.payload };
      default:
        return state;
    }
  })();

  // Persist GitHub state changes to localStorage
  const githubActions = ["SET_GITHUB_REPOS", "SET_GITHUB_ORGS", "SET_REPOS_BY_OWNER"];
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
  updateSettings: (settings: Partial<AppState["settings"]>) => void;
  setActiveTab: (tab: string) => void;
  setCurrentView: (view: "dashboard" | "config" | "project") => void;
  setGitUrl: (url: string) => void;
  setModalTab: (tab: "git" | "github") => void;
  setGitHubRepos: (repos: GitHubRepository[]) => void;
  setGitHubOrgs: (orgs: GitHubOrganization[]) => void;
  setSelectedRepos: (repos: Set<number>) => void;
  toggleRepoSelection: (repoId: number) => void;
  setReposByOwner: (
    reposByOwner: GitHubReposByOwner | ((prev: GitHubReposByOwner) => GitHubReposByOwner),
  ) => void;
  setLoadingGitHub: (loading: boolean) => void;
  updateEditorContent: (fragmentId: string, content: string) => void;
  markUnsaved: (id: string) => void;
  markSaved: (id: string) => void;
  setActiveFragment: (id: string | null) => void;
  isDark: boolean;
  toggleTheme: () => void;
}

import { useTheme } from "../stores/ui-store";

const AppContext = createContext<AppContextValue | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, undefined, createInitialState);

  useEffect(() => {
    if (isBrowser) {
      const storedToken = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
      if (storedToken) {
        apiService.setAuthToken(storedToken);
      }
    }

    let cancelled = false;

    apiService
      .getProjectStructureSettings()
      .then((response) => {
        if (cancelled) return;
        const structure = response?.projectStructure;
        if (!structure) return;

        dispatch({ type: "UPDATE_SETTINGS", payload: structure });
      })
      .catch((error) => {
        console.warn("Failed to load project structure settings", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const setLoading = (loading: boolean) => dispatch({ type: "SET_LOADING", payload: loading });
  const setError = (error: string | null) => dispatch({ type: "SET_ERROR", payload: error });
  const setSelectedCueFile = (file: string | null) =>
    dispatch({ type: "SET_SELECTED_CUE_FILE", payload: file });
  const updateSettings = (settings: Partial<AppState["settings"]>) => {
    dispatch({ type: "UPDATE_SETTINGS", payload: settings });

    const structureUpdates: Partial<ProjectStructureSettings> = {};

    PROJECT_STRUCTURE_FIELDS.forEach((field) => {
      const value = settings[field];
      if (typeof value === "string" && value.trim().length > 0) {
        structureUpdates[field] = value;
      }
    });

    if (Object.keys(structureUpdates).length > 0) {
      void apiService.updateProjectStructureSettings(structureUpdates).catch((error) => {
        console.warn("Failed to persist project structure settings", error);
      });
    }
  };
  const setActiveTab = (tab: string) => dispatch({ type: "SET_ACTIVE_TAB", payload: tab });
  const setCurrentView = (view: "dashboard" | "config" | "project") =>
    dispatch({ type: "SET_CURRENT_VIEW", payload: view });
  const setGitUrl = (url: string) => dispatch({ type: "SET_GIT_URL", payload: url });
  const setModalTab = (tab: "git" | "github") => dispatch({ type: "SET_MODAL_TAB", payload: tab });
  const setGitHubRepos = (repos: GitHubRepository[]) =>
    dispatch({ type: "SET_GITHUB_REPOS", payload: repos });
  const setGitHubOrgs = (orgs: GitHubOrganization[]) =>
    dispatch({ type: "SET_GITHUB_ORGS", payload: orgs });
  const setSelectedRepos = (repos: Set<number>) =>
    dispatch({ type: "SET_SELECTED_REPOS", payload: repos });
  const toggleRepoSelection = (repoId: number) =>
    dispatch({ type: "TOGGLE_REPO_SELECTION", payload: repoId });
  const setReposByOwner = (
    reposByOwner: GitHubReposByOwner | ((prev: GitHubReposByOwner) => GitHubReposByOwner),
  ) => {
    if (typeof reposByOwner === "function") {
      dispatch({ type: "SET_REPOS_BY_OWNER", payload: reposByOwner(state.reposByOwner) });
    } else {
      dispatch({ type: "SET_REPOS_BY_OWNER", payload: reposByOwner });
    }
  };
  const setLoadingGitHub = (loading: boolean) =>
    dispatch({ type: "SET_LOADING_GITHUB", payload: loading });

  const updateEditorContent = (fragmentId: string, content: string) =>
    dispatch({ type: "SET_EDITOR_CONTENT", payload: { fragmentId, content } });
  const markUnsaved = (id: string) => dispatch({ type: "MARK_UNSAVED", payload: id });
  const markSaved = (id: string) => dispatch({ type: "MARK_SAVED", payload: id });
  const setActiveFragment = (id: string | null) =>
    dispatch({ type: "SET_ACTIVE_FRAGMENT", payload: id });

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
    throw new Error("useApp must be used within an AppProvider");
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
  return state.fragments.find((f) => f.id === state.activeFragmentId) || null;
}

export function useEditorContent(fragmentId: string) {
  const { state } = useApp();
  return state.editorContent[fragmentId] || "";
}

// Backwards compatibility re-export for hooks moved to ProjectContext
export { useCurrentProject } from "./ProjectContext";
