/**
 * UI state store using Zustand
 */

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

export const useUiStore = create<UiState>(set => ({
  leftTab: 'source',
  rightTab: 'flow',
  setLeftTab: (tab: LeftTab) => set({ leftTab: tab }),
  setRightTab: (tab: RightTab) => set({ rightTab: tab }),
}));

// Convenience hooks for specific parts of the state
export function useTabs() {
  return useUiStore(state => ({
    leftTab: state.leftTab,
    rightTab: state.rightTab,
    setLeftTab: state.setLeftTab,
    setRightTab: state.setRightTab,
  }));
}
