/**
 * Sidebar Component - Design System
 * Professional sidebar navigation with collapsible sections and elegant hierarchy
 * Designed for developer tools with sophisticated graphite theme
 */
import {
  ChevronDown,
  ChevronRight,
  File,
  Folder,
  FolderOpen,
  Home,
  Search,
  Settings,
  Users,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { cn } from '../variants';

export interface SidebarNavItem {
  id: string;
  label: string;
  icon?: ReactNode;
  href?: string;
  active?: boolean;
  badge?: string | number;
  children?: SidebarNavItem[];
  collapsible?: boolean;
  collapsed?: boolean;
  onClick?: () => void;
}

export interface SidebarProps {
  /** Navigation items */
  items: SidebarNavItem[];

  /** Whether the sidebar is collapsed */
  collapsed?: boolean;

  /** Sidebar width when expanded */
  width?: 'sm' | 'md' | 'lg';

  /** Callback when an item is clicked */
  onItemClick?: (item: SidebarNavItem) => void;

  /** Callback when a collapsible section is toggled */
  onToggle?: (itemId: string, collapsed: boolean) => void;

  /** Header content */
  header?: ReactNode;

  /** Footer content */
  footer?: ReactNode;

  /** Custom className */
  className?: string;
}

const widthClasses = {
  sm: 'w-48',
  md: 'w-64',
  lg: 'w-72',
} as const;

const collapsedWidth = 'w-14';

function NavItemComponent({
  item,
  level = 0,
  collapsed = false,
  onItemClick,
  onToggle,
}: {
  item: SidebarNavItem;
  level?: number;
  collapsed?: boolean;
  onItemClick?: (item: SidebarNavItem) => void;
  onToggle?: (itemId: string, collapsed: boolean) => void;
}) {
  const [isCollapsed, setIsCollapsed] = useState(item.collapsed || false);
  const hasChildren = item.children && item.children.length > 0;
  const isActive = item.active;

  const handleClick = () => {
    if (item.collapsible && hasChildren) {
      const newCollapsed = !isCollapsed;
      setIsCollapsed(newCollapsed);
      onToggle?.(item.id, newCollapsed);
    }

    if (item.onClick) {
      item.onClick();
    }

    onItemClick?.(item);
  };

  const itemContent = (
    <div
      className={cn(
        'group flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-all duration-150',
        'text-sm font-medium',

        // Indentation for nested items
        level > 0 && !collapsed && `ml-${level * 4}`,

        // Active state
        isActive && 'bg-blue-50 text-blue-700 border-r-2 border-blue-500',

        // Hover state
        !isActive && 'text-graphite-700 hover:bg-graphite-100 hover:text-graphite-900',

        // Collapsed state
        collapsed && 'justify-center px-2'
      )}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {/* Collapse/expand icon */}
      {hasChildren && item.collapsible && !collapsed && (
        <span className="flex-shrink-0 text-graphite-400">
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      )}

      {/* Item icon */}
      {item.icon && (
        <span
          className={cn(
            'flex-shrink-0',
            isActive ? 'text-blue-600' : 'text-graphite-500 group-hover:text-graphite-700',
            hasChildren && item.collapsible && !collapsed && 'ml-0'
          )}
        >
          {item.icon}
        </span>
      )}

      {/* Item label */}
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>

          {/* Badge */}
          {item.badge && (
            <span
              className={cn(
                'inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium',
                isActive
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-graphite-100 text-graphite-600 group-hover:bg-graphite-200'
              )}
            >
              {item.badge}
            </span>
          )}
        </>
      )}
    </div>
  );

  return (
    <li className="relative">
      {collapsed && item.label ? (
        <div title={item.label} className="relative">
          {itemContent}
        </div>
      ) : (
        itemContent
      )}

      {/* Children */}
      {hasChildren && !isCollapsed && !collapsed && (
        <ul className="mt-1 space-y-1">
          {item.children!.map(child => (
            <NavItemComponent
              key={child.id}
              item={child}
              level={level + 1}
              collapsed={collapsed}
              {...(onItemClick && { onItemClick })}
              {...(onToggle && { onToggle })}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function Sidebar({
  items,
  collapsed = false,
  width = 'md',
  onItemClick,
  onToggle,
  header,
  footer,
  className,
}: SidebarProps) {
  return (
    <aside
      className={cn(
        'flex flex-col h-full bg-white border-r border-graphite-200 transition-all duration-200',
        collapsed ? collapsedWidth : widthClasses[width],
        className
      )}
    >
      {/* Header */}
      {header && (
        <div className={cn('flex-shrink-0 p-4 border-b border-graphite-200', collapsed && 'px-2')}>
          {header}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-2">
          {items.map(item => (
            <NavItemComponent
              key={item.id}
              item={item}
              collapsed={collapsed}
              {...(onItemClick && { onItemClick })}
              {...(onToggle && { onToggle })}
            />
          ))}
        </ul>
      </nav>

      {/* Footer */}
      {footer && (
        <div className={cn('flex-shrink-0 p-4 border-t border-graphite-200', collapsed && 'px-2')}>
          {footer}
        </div>
      )}
    </aside>
  );
}

// Convenience components for common navigation items
export const sidebarIcons = {
  Home,
  Folder,
  FolderOpen,
  File,
  Settings,
  Users,
  Search,
} as const;

export default Sidebar;
