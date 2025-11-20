import { createContext, useContext } from "react";

export type TabBadgeUpdater = (tabId: string, count: number | null) => void;

const TabBadgeContext = createContext<TabBadgeUpdater | null>(null);

interface TabBadgeProviderProps {
  value: TabBadgeUpdater;
  children: React.ReactNode;
}

export function TabBadgeProvider({ value, children }: TabBadgeProviderProps) {
  return <TabBadgeContext.Provider value={value}>{children}</TabBadgeContext.Provider>;
}

export function useTabBadgeUpdater(): TabBadgeUpdater {
  return useContext(TabBadgeContext) ?? (() => undefined);
}
