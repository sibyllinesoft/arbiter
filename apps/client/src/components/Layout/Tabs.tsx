import Badge from '@/components/Badge';
import { clsx } from 'clsx';
import React from 'react';
import type { TabItem, TabsProps } from '../../types/ui';

export function Tabs({ activeTab, onTabChange, tabs, className }: TabsProps) {
  const activeTabContent = tabs.find(tab => tab.id === activeTab)?.content;

  return (
    <div className={clsx('flex flex-col h-full min-h-0', className)}>
      <div className="flex gap-3 bg-transparent">
        {tabs.map(tab => (
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
        'px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors duration-150',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-0',
        isActive
          ? 'bg-blue-500/15 text-white shadow-sm shadow-blue-900/20'
          : 'text-graphite-400 hover:text-graphite-200 hover:bg-graphite-900/50',
        tab.disabled && 'opacity-50 cursor-not-allowed'
      )}
      onClick={onClick}
      disabled={tab.disabled}
      aria-selected={isActive}
      role="tab"
    >
      <span className="flex items-center gap-2.5">
        {tab.label}
        {tab.badge && (
          <Badge variant={isActive ? 'accent' : 'neutral'} size="sm">
            {tab.badge}
          </Badge>
        )}
      </span>
    </button>
  );
}

export default Tabs;
