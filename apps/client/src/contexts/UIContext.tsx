import React, { createContext, useContext, useMemo, useReducer } from "react";

export type ViewName = "dashboard" | "config" | "project";

type UIState = {
  activeTab: string;
  currentView: ViewName;
  gitUrl: string;
  modalTab: "git" | "github";
};

type UIAction =
  | { type: "SET_ACTIVE_TAB"; payload: string }
  | { type: "SET_CURRENT_VIEW"; payload: ViewName }
  | { type: "SET_GIT_URL"; payload: string }
  | { type: "SET_MODAL_TAB"; payload: "git" | "github" };

const STORAGE_KEYS = {
  activeTab: "arbiter:activeTab",
  gitUrl: "arbiter:gitUrl",
  modalTab: "arbiter:modalTab",
} as const;

const isBrowser = typeof window !== "undefined";

function readStoredString(key: string, fallback: string): string {
  if (!isBrowser) return fallback;
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch (error) {
    console.warn(`Failed to read ${key} from localStorage`, error);
    return fallback;
  }
}

const initialState: UIState = {
  activeTab: (() => {
    const stored = readStoredString(STORAGE_KEYS.activeTab, "source");
    return stored === "friendly" ? "source" : stored;
  })(),
  currentView: "dashboard",
  gitUrl: readStoredString(STORAGE_KEYS.gitUrl, ""),
  modalTab: ((): "git" | "github" => {
    const raw = readStoredString(STORAGE_KEYS.modalTab, "git");
    return raw === "github" ? "github" : "git";
  })(),
};

function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case "SET_ACTIVE_TAB": {
      const next = action.payload === "friendly" ? "source" : action.payload;
      if (isBrowser) {
        window.localStorage.setItem(STORAGE_KEYS.activeTab, next);
      }
      return { ...state, activeTab: next };
    }
    case "SET_CURRENT_VIEW":
      return { ...state, currentView: action.payload };
    case "SET_GIT_URL": {
      if (isBrowser) {
        window.localStorage.setItem(STORAGE_KEYS.gitUrl, action.payload);
      }
      return { ...state, gitUrl: action.payload };
    }
    case "SET_MODAL_TAB": {
      if (isBrowser) {
        window.localStorage.setItem(STORAGE_KEYS.modalTab, action.payload);
      }
      return { ...state, modalTab: action.payload };
    }
    default:
      return state;
  }
}

interface UIContextValue {
  state: UIState;
  setActiveTab: (tab: string) => void;
  setCurrentView: (view: ViewName) => void;
  setGitUrl: (url: string) => void;
  setModalTab: (tab: "git" | "github") => void;
}

const UIContext = createContext<UIContextValue | undefined>(undefined);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(uiReducer, initialState);

  const value = useMemo<UIContextValue>(
    () => ({
      state,
      setActiveTab: (tab) => dispatch({ type: "SET_ACTIVE_TAB", payload: tab }),
      setCurrentView: (view) => dispatch({ type: "SET_CURRENT_VIEW", payload: view }),
      setGitUrl: (url) => dispatch({ type: "SET_GIT_URL", payload: url }),
      setModalTab: (tab) => dispatch({ type: "SET_MODAL_TAB", payload: tab }),
    }),
    [state],
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUIState() {
  const context = useContext(UIContext);
  if (!context) throw new Error("useUIState must be used within a UIProvider");
  const { state, setActiveTab, setCurrentView, setGitUrl, setModalTab } = context;
  return { ...state, setActiveTab, setCurrentView, setGitUrl, setModalTab };
}
