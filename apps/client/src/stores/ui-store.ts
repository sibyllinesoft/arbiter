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
  setLeftTab: (tab: LeftTab) => void;
  setRightTab: (tab: RightTab) => void;
}

export const useUiStore = zukeeper(
  create<UiState>(set => ({
    leftTab: 'source',
    rightTab: 'flow',
    setLeftTab: (tab: LeftTab) => set({ leftTab: tab }),
    setRightTab: (tab: RightTab) => set({ rightTab: tab }),
  }))
);

// Convenience hooks for specific parts of the state
export function useTabs() {
  const leftTab = useUiStore((state: UiState) => state.leftTab);
  const rightTab = useUiStore((state: UiState) => state.rightTab);
  const setLeftTab = useUiStore((state: UiState) => state.setLeftTab);
  const setRightTab = useUiStore((state: UiState) => state.setRightTab);

  return { leftTab, rightTab, setLeftTab, setRightTab };
}
