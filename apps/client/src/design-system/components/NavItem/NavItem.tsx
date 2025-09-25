/**
 * NavItem Component - Design System
 * Flexible navigation item for various navigation contexts
 * Designed for developer tools with sophisticated graphite theme
 */

import { ChevronRight, ExternalLink } from 'lucide-react';
import React, { forwardRef, type ReactNode } from 'react';
import { cn } from '../variants';

export interface NavItemProps {
  /** Item content/label */
  children: ReactNode;

  /** Item href */
  href?: string;

  /** Whether the item is currently active */
  active?: boolean;

  /** Whether the item is disabled */
  disabled?: boolean;

  /** Icon to display before the label */
  icon?: ReactNode;

  /** Icon to display after the label */
  endIcon?: ReactNode;

  /** Badge or secondary content */
  badge?: string | number | ReactNode;

  /** Visual variant */
  variant?: 'default' | 'subtle' | 'ghost';

  /** Size variant */
  size?: 'sm' | 'md' | 'lg';

  /** Whether this is an external link */
  external?: boolean;

  /** Custom className */
  className?: string;

  /** Click handler */
  onClick?: (event: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void;

  /** Whether to show hover effects */
  interactive?: boolean;

  /** Keyboard shortcut hint */
  shortcut?: string;
}

const variantClasses = {
  default: {
    base: 'text-graphite-700 hover:text-graphite-900 hover:bg-graphite-100',
    active: 'bg-blue-50 text-blue-700 border-r-2 border-blue-500',
    disabled: 'text-graphite-400 cursor-not-allowed',
  },
  subtle: {
    base: 'text-graphite-600 hover:text-graphite-800 hover:bg-graphite-50',
    active: 'bg-graphite-100 text-graphite-900 font-medium',
    disabled: 'text-graphite-400 cursor-not-allowed',
  },
  ghost: {
    base: 'text-graphite-600 hover:text-graphite-900',
    active: 'text-blue-600 font-medium',
    disabled: 'text-graphite-400 cursor-not-allowed',
  },
} as const;

const sizeClasses = {
  sm: {
    container: 'px-2 py-1.5 text-sm',
    icon: 'h-3.5 w-3.5',
    badge: 'px-1.5 py-0.5 text-xs',
    shortcut: 'text-xs',
  },
  md: {
    container: 'px-3 py-2 text-sm',
    icon: 'h-4 w-4',
    badge: 'px-2 py-1 text-xs',
    shortcut: 'text-xs',
  },
  lg: {
    container: 'px-4 py-3 text-base',
    icon: 'h-5 w-5',
    badge: 'px-2.5 py-1 text-sm',
    shortcut: 'text-sm',
  },
} as const;

export const NavItem = forwardRef<HTMLButtonElement | HTMLAnchorElement, NavItemProps>(
  (
    {
      children,
      href,
      active = false,
      disabled = false,
      icon,
      endIcon,
      badge,
      variant = 'default',
      size = 'md',
      external = false,
      className,
      onClick,
      interactive = true,
      shortcut,
      ...props
    },
    ref
  ) => {
    const variants = variantClasses[variant];
    const sizes = sizeClasses[size];

    const baseClasses = cn(
      'flex items-center justify-between w-full rounded-md font-medium transition-all duration-150',
      'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
      sizes.container,

      // State styling
      disabled ? variants.disabled : active ? variants.active : interactive && variants.base,

      className
    );

    const content = (
      <>
        {/* Left content */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Icon */}
          {icon && (
            <span
              className={cn(
                'flex-shrink-0',
                sizes.icon,
                active ? 'text-blue-600' : 'text-graphite-500'
              )}
            >
              {icon}
            </span>
          )}

          {/* Label */}
          <span className="truncate">{children}</span>

          {/* External link indicator */}
          {external && href && (
            <ExternalLink className={cn('flex-shrink-0', sizes.icon, 'text-graphite-400')} />
          )}
        </div>

        {/* Right content */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Badge */}
          {badge && (
            <span
              className={cn(
                'inline-flex items-center justify-center font-medium rounded-full',
                sizes.badge,
                active ? 'bg-blue-100 text-blue-700' : 'bg-graphite-100 text-graphite-600'
              )}
            >
              {badge}
            </span>
          )}

          {/* Keyboard shortcut */}
          {shortcut && (
            <kbd
              className={cn(
                'inline-flex items-center font-mono font-medium rounded border bg-graphite-50 px-1.5 py-0.5',
                sizes.shortcut,
                'text-graphite-500 border-graphite-200'
              )}
            >
              {shortcut}
            </kbd>
          )}

          {/* End icon */}
          {endIcon && (
            <span className={cn('flex-shrink-0', sizes.icon, 'text-graphite-400')}>{endIcon}</span>
          )}
        </div>
      </>
    );

    // Render as link if href is provided
    if (href && !disabled) {
      return (
        <a
          ref={ref as React.Ref<HTMLAnchorElement>}
          href={href}
          className={baseClasses}
          onClick={onClick as React.MouseEventHandler<HTMLAnchorElement>}
          target={external ? '_blank' : undefined}
          rel={external ? 'noopener noreferrer' : undefined}
          {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
        >
          {content}
        </a>
      );
    }

    // Render as button otherwise
    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type="button"
        className={baseClasses}
        onClick={onClick as React.MouseEventHandler<HTMLButtonElement>}
        disabled={disabled}
        {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {content}
      </button>
    );
  }
);

NavItem.displayName = 'NavItem';

// Group component for organizing navigation items
export interface NavGroupProps {
  /** Group title */
  title?: string;

  /** Group items */
  children: ReactNode;

  /** Whether the group is collapsible */
  collapsible?: boolean;

  /** Whether the group is initially collapsed */
  defaultCollapsed?: boolean;

  /** Custom className */
  className?: string;
}

export function NavGroup({
  title,
  children,
  collapsible = false,
  defaultCollapsed = false,
  className,
}: NavGroupProps) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);

  return (
    <div className={cn('space-y-1', className)}>
      {title && (
        <div className="flex items-center justify-between">
          {collapsible ? (
            <button
              type="button"
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-graphite-500 uppercase tracking-wide hover:text-graphite-700 transition-colors"
              onClick={() => setCollapsed(!collapsed)}
            >
              <ChevronRight
                className={cn('h-3 w-3 transition-transform', !collapsed && 'rotate-90')}
              />
              {title}
            </button>
          ) : (
            <h3 className="px-3 py-2 text-xs font-semibold text-graphite-500 uppercase tracking-wide">
              {title}
            </h3>
          )}
        </div>
      )}

      {(!collapsible || !collapsed) && <div className="space-y-1">{children}</div>}
    </div>
  );
}

export default NavItem;
