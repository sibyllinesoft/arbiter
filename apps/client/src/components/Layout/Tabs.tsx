/**
 * Tab component for organizing content
 */

import { clsx } from 'clsx';
import React from 'react';
import type { TabItem, TabsProps } from '../../types/ui';

export function Tabs({ activeTab, onTabChange, tabs, className }: TabsProps) {
  const activeTabContent = tabs.find(tab => tab.id === activeTab)?.content;

  return (
    <div className={clsx('flex flex-col h-full min-h-0', className)}>
      {/* Tab headers */}
      <div className="flex border-b border-gray-200 dark:border-graphite-600 bg-gray-50 dark:bg-graphite-800">
        {tabs.map(tab => (
          <TabHeader
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTab}
            onClick={() => !tab.disabled && onTabChange(tab.id)}
          />
        ))}
      </div>

      {/* Tab content */}
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
        'px-4 py-2 font-medium text-sm border-b-2 transition-colors duration-150',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset',
        isActive
          ? 'border-blue-500 text-blue-600 bg-white dark:border-blue-400 dark:text-blue-300 dark:bg-graphite-900'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-graphite-400 dark:hover:text-graphite-300 dark:hover:border-graphite-500',
        tab.disabled && 'opacity-50 cursor-not-allowed'
      )}
      onClick={onClick}
      disabled={tab.disabled}
      aria-selected={isActive}
      role="tab"
    >
      <span className="flex items-center gap-2">
        {tab.label}
        {tab.badge && (
          <span
            className={clsx(
              'inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium',
              isActive
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
                : 'bg-gray-200 text-gray-600 dark:bg-graphite-700 dark:text-graphite-400'
            )}
          >
            {tab.badge}
          </span>
        )}
      </span>
    </button>
  );
}

export default Tabs;
