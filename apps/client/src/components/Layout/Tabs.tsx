import Badge from "@/components/Badge";
import { clsx } from "clsx";
import React from "react";
import type { TabItem, TabsProps } from "../../types/ui";

export function Tabs({ activeTab, onTabChange, tabs, className }: TabsProps) {
  const activeTabContent = tabs.find((tab) => tab.id === activeTab)?.content;

  return (
    <div className={clsx("flex flex-col h-full min-h-0", className)}>
      <div className="flex flex-wrap items-end gap-1 bg-white/95 px-6 border-b border-graphite-200/80 dark:bg-graphite-950/95 dark:border-graphite-700/70">
        {tabs.map((tab) => (
          <TabHeader
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTab}
            onClick={() => !tab.disabled && onTabChange(tab.id)}
          />
        ))}
      </div>

      <div className="flex-1 min-h-0 min-w-0 overflow-hidden bg-white dark:bg-graphite-950">
        {activeTabContent}
      </div>
    </div>
  );
}

interface TabHeaderProps {
  tab: TabItem;
  isActive: boolean;
  onClick: () => void;
}

function TabHeader({ tab, isActive, onClick }: TabHeaderProps) {
  return (
    <button
      type="button"
      className={clsx(
        "px-4 py-2.5 text-sm font-medium rounded-t-md border-b-2 border-transparent transition-colors duration-150",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-0",
        isActive
          ? "bg-white text-blue-600 border-b-2 border-blue-500 dark:bg-graphite-950 dark:text-blue-300"
          : "text-graphite-500 bg-transparent border-b-2 border-transparent hover:text-blue-600 hover:bg-white/70 dark:text-graphite-400 dark:hover:text-blue-300 dark:hover:bg-graphite-900/50",
        tab.disabled && "opacity-50 cursor-not-allowed",
      )}
      onClick={onClick}
      disabled={tab.disabled}
      aria-selected={isActive}
      role="tab"
    >
      <span className="flex items-center gap-2.5">
        {tab.label}
        {tab.badge !== undefined && tab.badge !== null && (
          <Badge variant={isActive ? "accent" : "neutral"} size="sm">
            {tab.badge}
          </Badge>
        )}
      </span>
    </button>
  );
}

export default Tabs;
