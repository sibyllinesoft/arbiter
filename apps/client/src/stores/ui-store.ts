/**
 * UI state store using Zustand with zukeeper devtools
 */

import zukeeper from "zukeeper";
import { create } from "zustand";

type LeftTab = "source";
type RightTab =
  | "flow"
  | "site"
  | "view"
  | "architecture"
  | "services"
  | "clients"
  | "tasks"
  | "events"
  | "schemas"
  | "contracts"
  | "packages"
  | "tools"
  | "infrastructure"
  | "flows"
  | "capabilities";

interface UiState {
  leftTab: LeftTab;
  rightTab: RightTab;
  isDark: boolean;
  setLeftTab: (tab: LeftTab) => void;
  setRightTab: (tab: RightTab) => void;
  toggleTheme: () => void;
}

const THEME_KEY = "arbiter:theme";
const isBrowser = typeof window !== "undefined";

/** Safely read saved theme from localStorage */
function getSavedTheme(): string | null {
  if (!isBrowser) return null;
  try {
    return window.localStorage.getItem(THEME_KEY);
  } catch (error) {
    console.warn("Failed to read theme from localStorage", error);
    return null;
  }
}

/** Detect system dark mode preference */
function getSystemPrefersDark(): boolean {
  if (!isBrowser) return false;
  try {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    return media?.matches ?? false;
  } catch {
    return false;
  }
}

/** Persist theme preference to localStorage */
function persistTheme(isDark: boolean): void {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
  } catch (error) {
    console.warn("Failed to persist theme to localStorage", error);
  }
}

/** Determine initial dark mode setting */
function getInitialDarkMode(): boolean {
  const savedTheme = getSavedTheme();
  if (savedTheme === "dark") return true;
  if (savedTheme === "light") return false;
  return getSystemPrefersDark();
}

export const useUiStore = zukeeper(
  create<UiState>((set, get) => ({
    leftTab: "source",
    rightTab: "architecture",
    isDark: getInitialDarkMode(),
    setLeftTab: (tab: LeftTab) => set({ leftTab: tab }),
    setRightTab: (tab: RightTab) => set({ rightTab: tab }),
    toggleTheme: () => {
      const newTheme = !get().isDark;
      set({ isDark: newTheme });
      persistTheme(newTheme);
    },
  })),
);

// Convenience hooks for specific parts of the state
export function useTabs() {
  const leftTab = useUiStore((state: UiState) => state.leftTab);
  const rightTab = useUiStore((state: UiState) => state.rightTab);
  const setLeftTab = useUiStore((state: UiState) => state.setLeftTab);
  const setRightTab = useUiStore((state: UiState) => state.setRightTab);

  return { leftTab, rightTab, setLeftTab, setRightTab };
}

export function useTheme() {
  const isDark = useUiStore((state: UiState) => state.isDark);
  const toggleTheme = useUiStore((state: UiState) => state.toggleTheme);

  return { isDark, toggleTheme };
}
