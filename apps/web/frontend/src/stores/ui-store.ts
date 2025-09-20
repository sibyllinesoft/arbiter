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
  const leftTab = useUiStore(state => state.leftTab);
  const rightTab = useUiStore(state => state.rightTab);
  const setLeftTab = useUiStore(state => state.setLeftTab);
  const setRightTab = useUiStore(state => state.setRightTab);

  return { leftTab, rightTab, setLeftTab, setRightTab };
}
