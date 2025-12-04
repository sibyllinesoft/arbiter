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

export const useUiStore = zukeeper(
  create<UiState>((set, get) => {
    // Load initial theme from localStorage
    let savedTheme: string | null = null;
    let prefersDark = false;

    if (isBrowser) {
      try {
        savedTheme = window.localStorage.getItem(THEME_KEY);
      } catch (error) {
        console.warn("Failed to read theme from localStorage", error);
      }
      try {
        const media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
        prefersDark = media ? media.matches : false;
      } catch (error) {
        prefersDark = false;
      }
    }

    const initialDark = savedTheme === "dark" ? true : savedTheme === "light" ? false : prefersDark;

    return {
      leftTab: "source",
      rightTab: "architecture",
      isDark: initialDark,
      setLeftTab: (tab: LeftTab) => set({ leftTab: tab }),
      setRightTab: (tab: RightTab) => set({ rightTab: tab }),
      toggleTheme: () => {
        const current = get().isDark;
        const newTheme = !current;
        set({ isDark: newTheme });
        if (isBrowser) {
          try {
            window.localStorage.setItem(THEME_KEY, newTheme ? "dark" : "light");
          } catch (error) {
            console.warn("Failed to persist theme to localStorage", error);
          }
        }
      },
    };
  }),
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
