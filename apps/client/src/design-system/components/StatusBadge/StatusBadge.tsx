/**
 * StatusBadge Component - Design System
 * Professional status indicators with comprehensive variants and states
 * Designed for developer tools with sophisticated graphite theme
 */

import { type ReactNode } from 'react';
import { cn, statusVariants } from '../../variants';

export type StatusVariant =
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'neutral'
  | 'pending'
  | 'active'
  | 'inactive'
  | 'secondary';

export interface StatusBadgeProps {
  /** Status variant determines the color scheme */
  variant?: StatusVariant;

  /** Legacy alias for variant */
  status?: StatusVariant;

  /** Badge style appearance */
  style?: 'solid' | 'outlined' | 'subtle';

  /** Badge size */
  size?: 'xs' | 'sm' | 'md' | 'lg';

  /** Whether to show a dot indicator */
  showDot?: boolean;

  /** Whether the dot should pulse (for active states) */
  pulse?: boolean;

  /** Icon to display (overrides dot) */
  icon?: ReactNode;

  /** Whether the badge has a loading state */
  loading?: boolean;

  /** Badge content */
  children: ReactNode;

  /** Custom className for additional styling */
  className?: string;
}

const sizeClasses = {
  xs: {
    badge: 'px-2 py-0.5 text-xs',
    icon: 'h-3 w-3',
    dot: 'h-1.5 w-1.5',
    gap: 'gap-1',
  },
  sm: {
    badge: 'px-2.5 py-1 text-xs',
    icon: 'h-3.5 w-3.5',
    dot: 'h-2 w-2',
    gap: 'gap-1.5',
  },
  md: {
    badge: 'px-2 py-1 text-sm',
    icon: 'h-4 w-4',
    dot: 'h-2.5 w-2.5',
    gap: 'gap-2',
  },
  lg: {
    badge: 'px-4 py-2 text-base',
    icon: 'h-5 w-5',
    dot: 'h-3 w-3',
    gap: 'gap-2',
  },
} as const;

// Extended status variants with additional semantic meanings
const extendedStatusVariants = {
  ...statusVariants,
  pending: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    icon: 'text-amber-500',
    dot: 'bg-amber-500',
  },
  active: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-700',
    icon: 'text-green-500',
    dot: 'bg-green-500',
  },
  inactive: {
    bg: 'bg-graphite-50',
    border: 'border-graphite-200',
    text: 'text-graphite-600',
    icon: 'text-graphite-400',
    dot: 'bg-graphite-400',
  },
  secondary: {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-700',
    icon: 'text-purple-500',
    dot: 'bg-purple-500',
  },
};

export function StatusBadge({
  variant = 'neutral',
  status,
  style = 'solid',
  size = 'sm',
  showDot = false,
  pulse = false,
  icon,
  loading = false,
  children,
  className,
}: StatusBadgeProps) {
  const resolvedVariant = status ?? variant;
  const statusStyles = extendedStatusVariants[resolvedVariant];
  const sizeClass = sizeClasses[size];

  // Style variants
  const getStyleClasses = () => {
    switch (style) {
      case 'solid':
        return cn(statusStyles.bg, statusStyles.border, statusStyles.text);
      case 'outlined':
        return cn('bg-transparent border-2', statusStyles.border, statusStyles.text);
      case 'subtle':
        return cn(statusStyles.bg, 'border-transparent', statusStyles.text);
      default:
        return cn(statusStyles.bg, statusStyles.border, statusStyles.text);
    }
  };

  const badgeClasses = cn(
    // Base styles
    'inline-flex items-center font-medium rounded-md border transition-all duration-150',

    // Size styles
    sizeClass.badge,
    sizeClass.gap,

    // Style variant classes
    getStyleClasses(),

    // Loading state
    loading && 'opacity-75',

    // Custom className
    className
  );

  const renderIndicator = () => {
    if (loading) {
      return (
        <div
          className={cn(
            'flex-shrink-0 border-2 border-current border-t-transparent rounded-full animate-spin',
            sizeClass.dot
          )}
        />
      );
    }

    if (icon) {
      return <span className={cn('flex-shrink-0', statusStyles.icon, sizeClass.icon)}>{icon}</span>;
    }

    if (showDot) {
      return (
        <span
          className={cn(
            'flex-shrink-0 rounded-full',
            statusStyles.dot,
            sizeClass.dot,
            pulse && 'animate-pulse'
          )}
        />
      );
    }

    return null;
  };

  return (
    <span className={badgeClasses}>
      {renderIndicator()}
      <span>{children}</span>
    </span>
  );
}

export default StatusBadge;
