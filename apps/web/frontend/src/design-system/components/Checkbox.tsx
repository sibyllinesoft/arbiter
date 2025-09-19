/**
 * Checkbox Component - Design System
 * Professional checkbox with comprehensive states and accessibility
 * Designed for developer tools with sophisticated graphite theme
 */

import React, { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { Check, Minus, AlertCircle, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '../variants';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Checkbox variant determines the visual style */
  variant?: 'default' | 'error' | 'success' | 'warning';

  /** Checkbox size affects the checkbox and font size */
  size?: 'sm' | 'md' | 'lg';

  /** Label text for the checkbox */
  label?: string;

  /** Additional description text */
  description?: string;

  /** Helper text below the checkbox */
  helperText?: string;

  /** Error message (sets variant to error automatically) */
  error?: string;

  /** Warning message (sets variant to warning automatically) */
  warning?: string;

  /** Success message (sets variant to success automatically) */
  success?: string;

  /** Whether the checkbox is in an indeterminate state */
  indeterminate?: boolean;

  /** Whether the checkbox is in a loading state */
  loading?: boolean;

  /** Whether to show validation icons automatically */
  showValidationIcon?: boolean;

  /** Custom className for additional styling */
  className?: string;

  /** Custom className for the wrapper */
  wrapperClassName?: string;

  /** Custom className for the label */
  labelClassName?: string;

  /** Children to render as custom label content */
  children?: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      variant = 'default',
      size = 'md',
      label,
      description,
      helperText,
      error,
      warning,
      success,
      indeterminate = false,
      loading = false,
      showValidationIcon = true,
      disabled,
      checked,
      className,
      wrapperClassName,
      labelClassName,
      children,
      id,
      ...props
    },
    ref
  ) => {
    // Determine actual variant based on state props
    const actualVariant = error ? 'error' : warning ? 'warning' : success ? 'success' : variant;
    const actualHelperText = error || warning || success || helperText;

    // Generate unique ID
    const checkboxId = id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;

    // Get validation icon
    const getValidationIcon = () => {
      if (!showValidationIcon || loading) return null;

      if (error) return <AlertCircle className="h-4 w-4 text-red-500" />;
      if (warning) return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      if (success) return <CheckCircle className="h-4 w-4 text-green-500" />;

      return null;
    };

    const validationIcon = getValidationIcon();

    // Checkbox size classes
    const sizeClasses = {
      sm: {
        checkbox: 'h-4 w-4',
        text: 'text-sm',
        icon: 'h-2.5 w-2.5',
        gap: 'gap-2',
      },
      md: {
        checkbox: 'h-5 w-5',
        text: 'text-base',
        icon: 'h-3 w-3',
        gap: 'gap-3',
      },
      lg: {
        checkbox: 'h-6 w-6',
        text: 'text-lg',
        icon: 'h-4 w-4',
        gap: 'gap-3',
      },
    };

    const sizeClass = sizeClasses[size];

    // Checkbox variant classes
    const variantClasses = {
      default: cn(
        'border-graphite-300 text-blue-600 focus:ring-blue-500',
        'checked:bg-blue-600 checked:border-blue-600',
        'hover:border-graphite-400',
        'disabled:bg-graphite-50 disabled:border-graphite-200 disabled:text-graphite-400'
      ),
      error: cn(
        'border-red-300 text-red-600 focus:ring-red-500',
        'checked:bg-red-600 checked:border-red-600',
        'hover:border-red-400',
        'disabled:bg-red-50 disabled:border-red-200 disabled:text-red-300'
      ),
      warning: cn(
        'border-amber-300 text-amber-600 focus:ring-amber-500',
        'checked:bg-amber-600 checked:border-amber-600',
        'hover:border-amber-400',
        'disabled:bg-amber-50 disabled:border-amber-200 disabled:text-amber-300'
      ),
      success: cn(
        'border-emerald-300 text-emerald-600 focus:ring-emerald-500',
        'checked:bg-emerald-600 checked:border-emerald-600',
        'hover:border-emerald-400',
        'disabled:bg-emerald-50 disabled:border-emerald-200 disabled:text-emerald-300'
      ),
    };

    const checkboxClasses = cn(
      // Base styles
      'relative rounded border-2 transition-all duration-150 ease-in-out',
      'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-opacity-50',
      'disabled:cursor-not-allowed',

      // Size
      sizeClass.checkbox,

      // Variant styles
      variantClasses[actualVariant],

      // Loading state
      loading && 'cursor-wait',

      className
    );

    const wrapperClasses = cn(
      'flex items-start',
      sizeClass.gap,
      disabled && 'opacity-60 cursor-not-allowed',
      wrapperClassName
    );

    const labelClasses = cn(
      'flex-1',
      sizeClass.text,
      'text-graphite-900 font-medium cursor-pointer select-none',
      actualVariant === 'error' && 'text-red-900',
      actualVariant === 'warning' && 'text-amber-900',
      actualVariant === 'success' && 'text-emerald-900',
      disabled && 'cursor-not-allowed text-graphite-500',
      labelClassName
    );

    return (
      <div className="space-y-1">
        <div className={wrapperClasses}>
          {/* Hidden input */}
          <input
            ref={ref}
            type="checkbox"
            id={checkboxId}
            checked={checked}
            disabled={disabled || loading}
            className="sr-only"
            aria-describedby={cn(
              actualHelperText && `${checkboxId}-description`,
              description && `${checkboxId}-desc`
            )}
            {...props}
          />

          {/* Custom checkbox */}
          <div className="relative flex-shrink-0">
            <div className={checkboxClasses}>
              {/* Loading spinner */}
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className={cn(sizeClass.icon, 'animate-spin text-graphite-400')} />
                </div>
              )}

              {/* Check/indeterminate icon */}
              {!loading && (checked || indeterminate) && (
                <div className="absolute inset-0 flex items-center justify-center text-white">
                  {indeterminate ? (
                    <Minus className={sizeClass.icon} strokeWidth={3} />
                  ) : (
                    <Check className={sizeClass.icon} strokeWidth={3} />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Label and content */}
          {(label || children) && (
            <div className="flex-1 space-y-1">
              <label htmlFor={checkboxId} className={labelClasses}>
                <div className="flex items-start justify-between gap-2">
                  <span>{children || label}</span>

                  {/* Validation icon */}
                  {validationIcon && <div className="flex-shrink-0">{validationIcon}</div>}
                </div>
              </label>

              {/* Description */}
              {description && (
                <p
                  id={`${checkboxId}-desc`}
                  className={cn('text-sm text-graphite-600', disabled && 'text-graphite-400')}
                >
                  {description}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Helper text / Validation messages */}
        {actualHelperText && (
          <p
            id={`${checkboxId}-description`}
            className={cn(
              'text-sm ml-7 flex items-start gap-1',
              actualVariant === 'error' && 'text-red-600',
              actualVariant === 'warning' && 'text-amber-600',
              actualVariant === 'success' && 'text-green-600',
              actualVariant === 'default' && 'text-graphite-600'
            )}
          >
            {actualHelperText}
          </p>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';

export default Checkbox;
