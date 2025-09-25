/**
 * Breadcrumbs Component - Design System
 * Professional breadcrumb navigation with elegant separators and hover states
 * Designed for developer tools with sophisticated graphite theme
 */
import { ChevronRight, File, Folder, Home, MoreHorizontal } from 'lucide-react';
import React, { type ReactNode } from 'react';
import { cn } from '../../variants';

export interface BreadcrumbItem {
  id: string;
  label: string;
  href?: string;
  icon?: ReactNode;
  current?: boolean;
  onClick?: () => void;
}

export interface BreadcrumbsProps {
  /** Breadcrumb items */
  items: BreadcrumbItem[];

  /** Separator between items */
  separator?: 'chevron' | 'slash' | 'dot' | ReactNode;

  /** Maximum number of items to show before collapsing */
  maxItems?: number;

  /** Size variant */
  size?: 'sm' | 'md' | 'lg';

  /** Whether to show home icon for first item */
  showHomeIcon?: boolean;

  /** Custom className */
  className?: string;

  /** Callback when an item is clicked */
  onItemClick?: (item: BreadcrumbItem) => void;
}

const separators = {
  chevron: <ChevronRight className="h-4 w-4 text-graphite-400" />,
  slash: <span className="text-graphite-400 font-normal">/</span>,
  dot: <span className="text-graphite-400">•</span>,
} as const;

const sizeClasses = {
  sm: {
    container: 'text-xs',
    item: 'px-2 py-1',
    icon: 'h-3 w-3',
  },
  md: {
    container: 'text-sm',
    item: 'px-2.5 py-1.5',
    icon: 'h-4 w-4',
  },
  lg: {
    container: 'text-base',
    item: 'px-3 py-2',
    icon: 'h-5 w-5',
  },
} as const;

function BreadcrumbItem({
  item,
  size = 'md',
  onItemClick,
  showIcon = false,
}: {
  item: BreadcrumbItem;
  size?: 'sm' | 'md' | 'lg';
  onItemClick?: (item: BreadcrumbItem) => void;
  showIcon?: boolean;
}) {
  const sizes = sizeClasses[size];
  const isClickable = item.href || item.onClick || onItemClick;
  const isCurrent = item.current;

  const handleClick = () => {
    if (item.onClick) {
      item.onClick();
    }
    onItemClick?.(item);
  };

  const content = (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md transition-colors duration-150',
        sizes.item,

        // Current item styling
        isCurrent && 'text-graphite-900 font-semibold',

        // Clickable item styling
        isClickable &&
          !isCurrent &&
          'text-graphite-600 hover:text-graphite-900 hover:bg-graphite-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',

        // Non-clickable item styling
        !isClickable && !isCurrent && 'text-graphite-600'
      )}
    >
      {/* Icon */}
      {(showIcon || item.icon) && (
        <span
          className={cn(
            'flex-shrink-0',
            sizes.icon,
            isCurrent ? 'text-graphite-700' : 'text-graphite-500'
          )}
        >
          {item.icon || <Folder className={sizes.icon} />}
        </span>
      )}

      <span className="truncate">{item.label}</span>
    </span>
  );

  if (isClickable) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center"
        aria-current={isCurrent ? 'page' : undefined}
      >
        {content}
      </button>
    );
  }

  return (
    <span className="inline-flex items-center" aria-current={isCurrent ? 'page' : undefined}>
      {content}
    </span>
  );
}

function CollapsedItems({
  items,
  size = 'md',
  onItemClick,
}: {
  items: BreadcrumbItem[];
  size?: 'sm' | 'md' | 'lg';
  onItemClick?: (item: BreadcrumbItem) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const sizes = sizeClasses[size];

  if (expanded) {
    return (
      <>
        {items.map((item, index) => (
          <React.Fragment key={item.id}>
            <BreadcrumbItem item={item} size={size} {...(onItemClick ? { onItemClick } : {})} />
            {index < items.length - 1 && (
              <span className="flex-shrink-0 mx-1">{separators.chevron}</span>
            )}
          </React.Fragment>
        ))}
      </>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setExpanded(true)}
      className={cn(
        'inline-flex items-center gap-1 rounded-md transition-colors duration-150',
        sizes.item,
        'text-graphite-600 hover:text-graphite-900 hover:bg-graphite-50',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1'
      )}
      aria-label={`Show ${items.length} hidden items`}
    >
      <MoreHorizontal className={sizes.icon} />
    </button>
  );
}

export function Breadcrumbs({
  items,
  separator = 'chevron',
  maxItems,
  size = 'md',
  showHomeIcon = false,
  className,
  onItemClick,
}: BreadcrumbsProps) {
  const sizes = sizeClasses[size];

  // Handle collapsing items if maxItems is set
  let displayItems = items;
  let collapsedItems: BreadcrumbItem[] = [];

  if (maxItems && items.length > maxItems) {
    // Always show first item, collapsed indicator, and last few items
    const keepFromEnd = Math.max(1, maxItems - 2);
    const firstItem = items[0]!;
    const lastItems = items.slice(-keepFromEnd);
    collapsedItems = items.slice(1, items.length - keepFromEnd);

    displayItems = [firstItem, ...lastItems];
  }

  const getSeparator = () => {
    if (typeof separator === 'string') {
      return separators[separator as keyof typeof separators];
    }
    return separator;
  };

  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center', sizes.container, className)}>
      <ol className="flex items-center space-x-1">
        {displayItems.map((item, index) => {
          const isFirst = index === 0;
          const isLast = index === displayItems.length - 1;
          const showIcon = isFirst && showHomeIcon;

          return (
            <li key={item.id} className="flex items-center">
              {/* Show collapsed items indicator */}
              {isFirst && collapsedItems.length > 0 && (
                <>
                  <BreadcrumbItem
                    item={item}
                    size={size}
                    {...(onItemClick ? { onItemClick } : {})}
                    showIcon={showIcon}
                  />
                  <span className="flex-shrink-0 mx-1">{getSeparator()}</span>
                  <CollapsedItems
                    items={collapsedItems}
                    size={size}
                    {...(onItemClick ? { onItemClick } : {})}
                  />
                  {!isLast && <span className="flex-shrink-0 mx-1">{getSeparator()}</span>}
                </>
              )}

              {/* Regular item */}
              {(isFirst && collapsedItems.length === 0) || !isFirst ? (
                <>
                  <BreadcrumbItem
                    item={item}
                    size={size}
                    {...(onItemClick ? { onItemClick } : {})}
                    showIcon={showIcon}
                  />
                  {!isLast && <span className="flex-shrink-0 mx-1">{getSeparator()}</span>}
                </>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// Convenience icons for breadcrumb items
export const breadcrumbIcons = {
  Home,
  Folder,
  File,
} as const;

export default Breadcrumbs;
