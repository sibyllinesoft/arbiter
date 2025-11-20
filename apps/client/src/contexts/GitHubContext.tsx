import type { GitHubOrganization, GitHubReposByOwner, GitHubRepository } from "@/types/github";
import React, { createContext, useContext, useMemo, useReducer } from "react";

interface GitHubState {
  gitHubRepos: GitHubRepository[];
  gitHubOrgs: GitHubOrganization[];
  selectedRepos: Set<number>;
  reposByOwner: GitHubReposByOwner;
  isLoadingGitHub: boolean;
}

type GitHubAction =
  | { type: "SET_GITHUB_REPOS"; payload: GitHubRepository[] }
  | { type: "SET_GITHUB_ORGS"; payload: GitHubOrganization[] }
  | { type: "SET_SELECTED_REPOS"; payload: Set<number> }
  | { type: "TOGGLE_REPO_SELECTION"; payload: number }
  | { type: "SET_REPOS_BY_OWNER"; payload: GitHubReposByOwner }
  | { type: "SET_LOADING_GITHUB"; payload: boolean };

const STORAGE_KEYS = {
  gitHubRepos: "arbiter:githubRepos",
  gitHubOrgs: "arbiter:githubOrgs",
  reposByOwner: "arbiter:reposByOwner",
} as const;

const isBrowser = typeof window !== "undefined";

function readStoredJson<T>(key: string, fallback: T): T {
  if (!isBrowser) return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const initialState: GitHubState = {
  gitHubRepos: readStoredJson<GitHubRepository[]>(STORAGE_KEYS.gitHubRepos, []),
  gitHubOrgs: readStoredJson<GitHubOrganization[]>(STORAGE_KEYS.gitHubOrgs, []),
  selectedRepos: new Set<number>(),
  reposByOwner: readStoredJson<GitHubReposByOwner>(STORAGE_KEYS.reposByOwner, {}),
  isLoadingGitHub: false,
};

function persistGitHubState(state: GitHubState) {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(STORAGE_KEYS.gitHubRepos, JSON.stringify(state.gitHubRepos));
    window.localStorage.setItem(STORAGE_KEYS.gitHubOrgs, JSON.stringify(state.gitHubOrgs));
    window.localStorage.setItem(STORAGE_KEYS.reposByOwner, JSON.stringify(state.reposByOwner));
  } catch (error) {
    console.warn("Failed to persist GitHub state", error);
  }
}

function githubReducer(state: GitHubState, action: GitHubAction): GitHubState {
  const next = (() => {
    switch (action.type) {
      case "SET_GITHUB_REPOS":
        return { ...state, gitHubRepos: action.payload };
      case "SET_GITHUB_ORGS":
        return { ...state, gitHubOrgs: action.payload };
      case "SET_SELECTED_REPOS":
        return { ...state, selectedRepos: action.payload };
      case "TOGGLE_REPO_SELECTION": {
        const nextSelected = new Set(state.selectedRepos);
        if (nextSelected.has(action.payload)) {
          nextSelected.delete(action.payload);
        } else {
          nextSelected.add(action.payload);
        }
        return { ...state, selectedRepos: nextSelected };
      }
      case "SET_REPOS_BY_OWNER":
        return { ...state, reposByOwner: action.payload };
      case "SET_LOADING_GITHUB":
        return { ...state, isLoadingGitHub: action.payload };
      default:
        return state;
    }
  })();

  if (["SET_GITHUB_REPOS", "SET_GITHUB_ORGS", "SET_REPOS_BY_OWNER"].includes(action.type)) {
    persistGitHubState(next);
  }

  return next;
}

interface GitHubContextValue {
  state: GitHubState;
  setGitHubRepos: (repos: GitHubRepository[]) => void;
  setGitHubOrgs: (orgs: GitHubOrganization[]) => void;
  setSelectedRepos: (repos: Set<number>) => void;
  toggleRepoSelection: (repoId: number) => void;
  setReposByOwner: (reposByOwner: GitHubReposByOwner) => void;
  setLoadingGitHub: (loading: boolean) => void;
}

const GitHubContext = createContext<GitHubContextValue | undefined>(undefined);

export function GitHubProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(githubReducer, initialState);

  const value = useMemo<GitHubContextValue>(
    () => ({
      state,
      setGitHubRepos: (repos) => dispatch({ type: "SET_GITHUB_REPOS", payload: repos }),
      setGitHubOrgs: (orgs) => dispatch({ type: "SET_GITHUB_ORGS", payload: orgs }),
      setSelectedRepos: (repos) => dispatch({ type: "SET_SELECTED_REPOS", payload: repos }),
      toggleRepoSelection: (repoId) => dispatch({ type: "TOGGLE_REPO_SELECTION", payload: repoId }),
      setReposByOwner: (reposByOwner) =>
        dispatch({ type: "SET_REPOS_BY_OWNER", payload: reposByOwner }),
      setLoadingGitHub: (loading) => dispatch({ type: "SET_LOADING_GITHUB", payload: loading }),
    }),
    [state],
  );

  return <GitHubContext.Provider value={value}>{children}</GitHubContext.Provider>;
}

export function useGitHubState() {
  const context = useContext(GitHubContext);
  if (!context) throw new Error("useGitHubState must be used within GitHubProvider");
  return context;
}
