/**
 * Tab component for organizing content
 */

import React from 'react';
import { clsx } from 'clsx';
import type { TabsProps, TabItem } from '../../types/ui';

export function Tabs({ activeTab, onTabChange, tabs, className }: TabsProps) {
  const activeTabContent = tabs.find(tab => tab.id === activeTab)?.content;

  return (
    <div className={clsx('flex flex-col h-full min-h-0', className)}>
      {/* Tab headers */}
      <div className="flex border-b border-gray-200 bg-gray-50">
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
      <div className="flex-1 min-h-0 min-w-0 overflow-hidden">{activeTabContent}</div>
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
          ? 'border-blue-500 text-blue-600 bg-white'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
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
              isActive ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-600'
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
