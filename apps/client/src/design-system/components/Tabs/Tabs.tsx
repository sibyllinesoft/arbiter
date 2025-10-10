/**
 * Tabs Component - Design System
 * Professional tabbed interface with comprehensive features and states
 * Designed for developer tools with sophisticated graphite theme
 */

import Badge from '@/components/Badge';
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react';
import React, { useState, useRef, useEffect, type ReactNode } from 'react';
import { cn } from '../../variants';

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  badge?: string | number;
  icon?: ReactNode;
  closable?: boolean;
  tooltip?: string;
}

export interface TabsProps {
  /** Array of tab items */
  items: TabItem[];

  /** Currently active tab ID */
  activeTab?: string;

  /** Callback when tab changes */
  onChange?: (tabId: string) => void;

  /** Legacy alias for onChange */
  onTabChange?: (tabId: string) => void;

  /** Callback when tab is closed */
  onTabClose?: (tabId: string) => void;

  /** Tab variant */
  variant?: 'underline' | 'pills' | 'bordered' | 'buttons';

  /** Tab size */
  size?: 'sm' | 'md' | 'lg';

  /** Whether tabs should take full width */
  fullWidth?: boolean;

  /** Whether tabs should be scrollable when overflowing */
  scrollable?: boolean;

  /** Whether to show scroll buttons */
  showScrollButtons?: boolean;

  /** Custom className for the tab container */
  className?: string;

  /** Custom className for the content area */
  contentClassName?: string;

  /** Custom className for individual tabs */
  tabClassName?: string;
}

const variantClasses = {
  underline: {
    container: 'relative',
    tab: 'relative border-none text-graphite-400 hover:text-graphite-200',
    activeTab: 'text-white',
    disabledTab: 'text-graphite-500 cursor-not-allowed hover:text-graphite-500',
  },
  pills: {
    container: '',
    tab: 'rounded-lg hover:bg-graphite-100 hover:text-graphite-700',
    activeTab: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
    disabledTab:
      'text-graphite-400 cursor-not-allowed hover:bg-transparent hover:text-graphite-400',
  },
  bordered: {
    container: 'border-b border-graphite-200',
    tab: 'border border-transparent rounded-t-lg hover:border-graphite-300 hover:text-graphite-700 hover:bg-graphite-50',
    activeTab: 'border-graphite-300 border-b-white bg-white text-graphite-900 shadow-sm -mb-px',
    disabledTab:
      'text-graphite-400 cursor-not-allowed hover:border-transparent hover:text-graphite-400',
  },
  buttons: {
    container: 'bg-graphite-100 rounded-lg p-1',
    tab: 'rounded-md hover:bg-graphite-200 hover:text-graphite-700',
    activeTab: 'bg-white text-graphite-900 shadow-sm',
    disabledTab:
      'text-graphite-400 cursor-not-allowed hover:bg-transparent hover:text-graphite-400',
  },
} as const;

const sizeClasses = {
  sm: {
    tab: 'px-2 py-1.5 text-sm',
    icon: 'h-3.5 w-3.5',
    badge: 'px-1.5 py-0.5 text-xs',
    close: 'h-3 w-3',
  },
  md: {
    tab: 'px-3 py-2 text-sm',
    icon: 'h-4 w-4',
    badge: 'px-2 py-1 text-xs',
    close: 'h-4 w-4',
  },
  lg: {
    tab: 'px-4 py-3 text-base',
    icon: 'h-5 w-5',
    badge: 'px-2.5 py-1 text-sm',
    close: 'h-4 w-4',
  },
} as const;

export function Tabs({
  items,
  activeTab,
  onChange,
  onTabChange,
  onTabClose,
  variant = 'underline',
  size = 'md',
  fullWidth = false,
  scrollable = false,
  showScrollButtons = false,
  className,
  contentClassName,
  tabClassName,
}: TabsProps) {
  const [internalActiveTab, setInternalActiveTab] = useState(activeTab || items[0]?.id);
  const [scrollLeft, setScrollLeft] = useState(0);
  const tabListRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const currentActiveTab = activeTab || internalActiveTab;
  const classes = variantClasses[variant];
  const sizes = sizeClasses[size];

  // Update scroll button states
  const updateScrollButtons = () => {
    if (!tabListRef.current || !scrollable) return;

    const { scrollLeft, scrollWidth, clientWidth } = tabListRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth);
  };

  useEffect(() => {
    updateScrollButtons();
  }, [items, scrollable]);

  useEffect(() => {
    const tabList = tabListRef.current;
    if (!tabList || !scrollable) return;

    const handleScroll = () => {
      updateScrollButtons();
    };

    tabList.addEventListener('scroll', handleScroll);
    return () => tabList.removeEventListener('scroll', handleScroll);
  }, [scrollable]);

  const handleTabClick = (tabId: string, disabled?: boolean, loading?: boolean) => {
    if (disabled || loading) return;

    if (onChange) {
      onChange(tabId);
    }

    if (onTabChange) {
      onTabChange(tabId);
    }

    if (!onChange && !onTabChange) {
      setInternalActiveTab(tabId);
    }
  };

  const handleTabClose = (tabId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    onTabClose?.(tabId);
  };

  const handleKeyDown = (event: React.KeyboardEvent, tabId: string) => {
    const availableItems = items.filter(item => !item.disabled && !item.loading);
    const currentIndex = availableItems.findIndex(item => item.id === tabId);

    switch (event.key) {
      case 'ArrowLeft': {
        event.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : availableItems.length - 1;
        const prevTab = availableItems[prevIndex];
        if (prevTab) handleTabClick(prevTab.id);
        break;
      }
      case 'ArrowRight': {
        event.preventDefault();
        const nextIndex = currentIndex < availableItems.length - 1 ? currentIndex + 1 : 0;
        const nextTab = availableItems[nextIndex];
        if (nextTab) handleTabClick(nextTab.id);
        break;
      }
      case 'Home': {
        event.preventDefault();
        const firstTab = availableItems[0];
        if (firstTab) handleTabClick(firstTab.id);
        break;
      }
      case 'End': {
        event.preventDefault();
        const lastTab = availableItems[availableItems.length - 1];
        if (lastTab) handleTabClick(lastTab.id);
        break;
      }
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (!tabListRef.current) return;

    const scrollAmount = tabListRef.current.clientWidth * 0.5;
    const newScrollLeft =
      direction === 'left' ? scrollLeft - scrollAmount : scrollLeft + scrollAmount;

    tabListRef.current.scrollTo({
      left: newScrollLeft,
      behavior: 'smooth',
    });
    setScrollLeft(newScrollLeft);
  };

  return (
    <div className={cn('w-full', className)}>
      {/* Tab List Container */}
      <div className="relative">
        {/* Left scroll button */}
        {scrollable && showScrollButtons && canScrollLeft && (
          <button
            type="button"
            className="absolute left-0 top-0 z-10 flex items-center justify-center w-8 h-full bg-white shadow-md rounded-l-md"
            onClick={() => scroll('left')}
            aria-label="Scroll tabs left"
          >
            <ChevronLeft className="h-4 w-4 text-graphite-600" />
          </button>
        )}

        {/* Tab List */}
        <nav
          ref={tabListRef}
          className={cn(
            'flex gap-3',
            classes.container,
            fullWidth && !scrollable && 'w-full',
            scrollable && 'overflow-x-auto scrollbar-hide',
            scrollable && showScrollButtons && canScrollLeft && 'ml-8',
            scrollable && showScrollButtons && canScrollRight && 'mr-8'
          )}
          role="tablist"
          style={scrollable ? { scrollbarWidth: 'none', msOverflowStyle: 'none' } : undefined}
        >
          {items.map(item => {
            const isActive = item.id === currentActiveTab;
            const isDisabled = item.disabled;
            const isLoading = item.loading;

            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`tabpanel-${item.id}`}
                tabIndex={isActive ? 0 : -1}
                disabled={isDisabled || isLoading}
                title={item.tooltip}
                className={cn(
                  // Base styles
                  'relative inline-flex items-center gap-2',
                  'font-medium transition-all duration-150 whitespace-nowrap',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',

                  // Size styles
                  sizes.tab,

                  // Full width
                  fullWidth && !scrollable && 'flex-1 justify-center',

                  // Variant styles
                  classes.tab,
                  isActive && classes.activeTab,
                  (isDisabled || isLoading) && classes.disabledTab,

                  // Custom className
                  tabClassName
                )}
                onClick={() => handleTabClick(item.id, isDisabled, isLoading)}
                onKeyDown={e => handleKeyDown(e, item.id)}
              >
                {/* Loading state */}
                {isLoading && (
                  <Loader2 className={cn('animate-spin', sizes.icon, 'text-blue-500')} />
                )}

                {/* Icon */}
                {!isLoading && item.icon && (
                  <span className={cn('flex-shrink-0', sizes.icon)}>{item.icon}</span>
                )}

                <span className="truncate tracking-wide">{item.label}</span>

                {/* Badge */}
                {item.badge && (
                  <Badge
                    variant={isActive ? 'accent' : 'neutral'}
                    size={size === 'lg' ? 'md' : 'sm'}
                  >
                    {item.badge}
                  </Badge>
                )}

                {/* Close button */}
                {item.closable && !isLoading && (
                  <button
                    type="button"
                    className={cn(
                      'flex-shrink-0 rounded-sm p-0.5 hover:bg-graphite-300/50 transition-colors',
                      'focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500'
                    )}
                    onClick={e => handleTabClose(item.id, e)}
                    aria-label={`Close ${item.label} tab`}
                  >
                    <X className={cn(sizes.close, 'text-graphite-500 hover:text-graphite-700')} />
                  </button>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right scroll button */}
        {scrollable && showScrollButtons && canScrollRight && (
          <button
            type="button"
            className="absolute right-0 top-0 z-10 flex items-center justify-center w-8 h-full bg-white shadow-md rounded-r-md"
            onClick={() => scroll('right')}
            aria-label="Scroll tabs right"
          >
            <ChevronRight className="h-4 w-4 text-graphite-600" />
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className={cn('mt-4', contentClassName)}>
        {items.map(item => (
          <div
            key={item.id}
            id={`tabpanel-${item.id}`}
            role="tabpanel"
            aria-labelledby={`tab-${item.id}`}
            className={cn(item.id === currentActiveTab ? 'block' : 'hidden')}
          >
            {item.content}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Tabs;
