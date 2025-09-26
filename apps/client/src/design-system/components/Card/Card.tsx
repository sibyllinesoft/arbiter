/**
 * Card Component - Design System
 * Professional card container with comprehensive variants and states
 * Designed for developer tools with sophisticated graphite theme
 */

import { type HTMLAttributes, type ReactNode, forwardRef } from 'react';
import { cn } from '../../variants';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Card variant determines the visual style and interaction behavior */
  variant?: 'default' | 'interactive' | 'elevated' | 'outlined' | 'ghost';

  /** Card size affects padding and border radius */
  size?: 'sm' | 'md' | 'lg' | 'xl';

  /** Card header content */
  header?: ReactNode;

  /** Card title */
  title?: string;

  /** Card subtitle or description */
  subtitle?: string;

  /** Card footer content */
  footer?: ReactNode;

  /** Whether to show a divider between header and content */
  headerDivider?: boolean;

  /** Whether to show a divider between content and footer */
  footerDivider?: boolean;

  /** Whether the card has a loading state */
  loading?: boolean;

  /** Whether the card is disabled */
  disabled?: boolean;

  /** Whether the card is selected */
  selected?: boolean;

  /** Whether the card has hover effects */
  hoverable?: boolean;

  /** Custom className for additional styling */
  className?: string;

  /** Custom className for the header */
  headerClassName?: string;

  /** Custom className for the body */
  bodyClassName?: string;

  /** Custom className for the footer */
  footerClassName?: string;

  /** Card content */
  children?: ReactNode;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'default',
      size = 'md',
      header,
      title,
      subtitle,
      footer,
      headerDivider = false,
      footerDivider = false,
      loading = false,
      disabled = false,
      selected = false,
      hoverable = false,
      className,
      headerClassName,
      bodyClassName,
      footerClassName,
      children,
      onClick,
      ...props
    },
    ref
  ) => {
    // Card size classes
    const sizeClasses = {
      sm: {
        card: 'rounded-lg',
        padding: 'p-3',
        headerPadding: 'px-3 pt-3',
        bodyPadding: 'px-3',
        footerPadding: 'px-3 pb-3',
        gap: 'space-y-2',
      },
      md: {
        card: 'rounded-lg',
        padding: 'p-4',
        headerPadding: 'px-4 pt-4',
        bodyPadding: 'px-4',
        footerPadding: 'px-4 pb-4',
        gap: 'space-y-3',
      },
      lg: {
        card: 'rounded-xl',
        padding: 'p-6',
        headerPadding: 'px-6 pt-6',
        bodyPadding: 'px-6',
        footerPadding: 'px-6 pb-6',
        gap: 'space-y-4',
      },
      xl: {
        card: 'rounded-xl',
        padding: 'p-8',
        headerPadding: 'px-8 pt-8',
        bodyPadding: 'px-8',
        footerPadding: 'px-8 pb-8',
        gap: 'space-y-6',
      },
    };

    const sizeClass = sizeClasses[size];

    // Card variant classes
    const variantClasses = {
      default: cn(
        'bg-white dark:bg-graphite-800 border border-gray-200 dark:border-graphite-700 shadow-sm dark:shadow-graphite-900/10',
        hoverable &&
          'hover:border-gray-300 dark:hover:border-graphite-600 hover:shadow-md dark:hover:shadow-graphite-900/20',
        selected &&
          'border-blue-500 dark:border-blue-400 ring-1 ring-blue-500 dark:ring-blue-400 ring-opacity-20'
      ),
      interactive: cn(
        'bg-white dark:bg-graphite-800 border border-gray-200 dark:border-graphite-700 shadow-sm dark:shadow-graphite-900/10',
        'hover:border-gray-300 dark:hover:border-graphite-600 hover:shadow-md dark:hover:shadow-graphite-900/20 hover:shadow-graphite-900/5',
        'active:scale-[0.998] active:shadow-sm',
        'transition-all duration-150 ease-out cursor-pointer',
        selected &&
          'border-blue-500 dark:border-blue-400 ring-1 ring-blue-500 dark:ring-blue-400 ring-opacity-20',
        disabled &&
          'cursor-not-allowed opacity-60 hover:border-gray-200 dark:hover:border-graphite-700 hover:shadow-sm dark:hover:shadow-graphite-900/10 active:scale-100'
      ),
      elevated: cn(
        'bg-white dark:bg-graphite-800 border-0 shadow-lg shadow-gray-900/10 dark:shadow-graphite-900/20',
        hoverable && 'hover:shadow-xl hover:shadow-gray-900/15 dark:hover:shadow-graphite-900/25',
        selected && 'ring-1 ring-blue-500 dark:ring-blue-400 ring-opacity-30'
      ),
      outlined: cn(
        'bg-transparent border-2 border-gray-300 dark:border-graphite-600',
        hoverable &&
          'hover:border-gray-400 dark:hover:border-graphite-500 hover:bg-gray-50 dark:hover:bg-graphite-700',
        selected && 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
      ),
      ghost: cn(
        'bg-transparent border-0 shadow-none',
        hoverable && 'hover:bg-gray-50 dark:hover:bg-graphite-700',
        selected && 'bg-blue-50 dark:bg-blue-900/20'
      ),
    };

    const cardClasses = cn(
      // Base styles
      'relative transition-all duration-150 ease-out overflow-hidden',

      // Size
      sizeClass.card,

      // Variant styles
      variantClasses[variant],

      // Loading state
      loading && 'pointer-events-none',

      // Disabled state
      disabled && 'opacity-60 cursor-not-allowed',

      className
    );

    const hasHeader = header || title || subtitle;
    const hasFooter = footer;
    const isClickable = onClick && !disabled && !loading;

    return (
      <div
        ref={ref}
        className={cardClasses}
        onClick={isClickable ? onClick : undefined}
        role={isClickable ? 'button' : undefined}
        tabIndex={isClickable ? 0 : undefined}
        onKeyDown={
          isClickable
            ? e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onClick?.(e as any);
                }
              }
            : undefined
        }
        aria-selected={selected}
        aria-disabled={disabled}
        {...props}
      >
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-white dark:bg-graphite-800 bg-opacity-80 dark:bg-opacity-90 rounded-inherit flex items-center justify-center z-10">
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <div className="w-4 h-4 border-2 border-gray-300 dark:border-gray-600 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin" />
              <span className="text-sm">Loading...</span>
            </div>
          </div>
        )}

        <div className={sizeClass.gap}>
          {/* Header */}
          {hasHeader && (
            <div
              className={cn(
                hasFooter || children ? sizeClass.headerPadding : sizeClass.padding,
                headerDivider && 'border-graphite-200',
                headerClassName
              )}
            >
              {header || (
                <div className="space-y-1">
                  {title && (
                    <h3
                      className={cn(
                        'font-semibold text-gray-900 dark:text-gray-100',
                        size === 'sm' && 'text-sm',
                        size === 'md' && 'text-base',
                        size === 'lg' && 'text-lg',
                        size === 'xl' && 'text-xl'
                      )}
                    >
                      {title}
                    </h3>
                  )}
                  {subtitle && (
                    <p
                      className={cn(
                        'text-gray-600 dark:text-gray-400',
                        size === 'sm' && 'text-xs',
                        size === 'md' && 'text-sm',
                        size === 'lg' && 'text-sm',
                        size === 'xl' && 'text-base'
                      )}
                    >
                      {subtitle}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Body */}
          {children && (
            <div
              className={cn(
                hasHeader && hasFooter
                  ? sizeClass.bodyPadding
                  : hasHeader
                    ? sizeClass.footerPadding
                    : hasFooter
                      ? sizeClass.headerPadding
                      : sizeClass.padding,
                bodyClassName
              )}
            >
              {children}
            </div>
          )}

          {/* Footer */}
          {hasFooter && (
            <div
              className={cn(
                hasHeader || children ? sizeClass.footerPadding : sizeClass.padding,
                footerDivider && 'border-t border-graphite-200',
                footerClassName
              )}
            >
              {footer}
            </div>
          )}
        </div>
      </div>
    );
  }
);

Card.displayName = 'Card';

export default Card;
