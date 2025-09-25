/**
 * UI state store using Zustand with zukeeper devtools
 */

import zukeeper from 'zukeeper';
import { create } from 'zustand';

type LeftTab = 'source' | 'friendly';
type RightTab =
  | 'flow'
  | 'site'
  | 'fsm'
  | 'view'
  | 'gaps'
  | 'resolved'
  | 'architecture'
  | 'handlers';

interface UiState {
  leftTab: LeftTab;
  rightTab: RightTab;
  isDark: boolean;
  setLeftTab: (tab: LeftTab) => void;
  setRightTab: (tab: RightTab) => void;
  toggleTheme: () => void;
}

const THEME_KEY = 'arbiter:theme';

export const useUiStore = zukeeper(
  create<UiState>((set, get) => {
    // Load initial theme from localStorage
    const savedTheme = localStorage.getItem(THEME_KEY);
    const initialDark = savedTheme ? savedTheme === 'dark' : true;

    return {
      leftTab: 'source',
      rightTab: 'flow',
      isDark: initialDark,
      setLeftTab: (tab: LeftTab) => set({ leftTab: tab }),
      setRightTab: (tab: RightTab) => set({ rightTab: tab }),
      toggleTheme: () => {
        const current = get().isDark;
        const newTheme = !current;
        set({ isDark: newTheme });
        localStorage.setItem(THEME_KEY, newTheme ? 'dark' : 'light');
      },
    };
  })
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
