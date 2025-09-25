/**
 * Input Component - Design System
 * Professional input with comprehensive variants, states, and accessibility
 * Designed for developer tools with sophisticated graphite theme
 */

import { AlertCircle, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { type InputHTMLAttributes, type ReactNode, forwardRef } from 'react';
import { cn, inputVariants, sizeVariants } from '../../variants';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Input variant determines the visual style */
  variant?: 'default' | 'error' | 'success' | 'warning';

  /** Input size affects padding and font size */
  size?: 'sm' | 'md' | 'lg';

  /** Whether the input should take full width of container */
  fullWidth?: boolean;

  /** Icon to display before the input */
  leftIcon?: ReactNode;

  /** Icon to display after the input */
  rightIcon?: ReactNode;

  /** Label for the input */
  label?: string;

  /** Helper text below the input */
  helperText?: string;

  /** Error message (sets variant to error automatically) */
  error?: string;

  /** Warning message (sets variant to warning automatically) */
  warning?: string;

  /** Success message (sets variant to success automatically) */
  success?: string;

  /** Whether the input is in a loading state */
  loading?: boolean;

  /** Whether to show validation icons automatically */
  showValidationIcon?: boolean;

  /** Whether to show the label */
  hideLabel?: boolean;

  /** Whether the label should be inside the input (floating) */
  floatingLabel?: boolean;

  /** Additional description text */
  description?: string;

  /** Custom className for additional styling */
  className?: string;

  /** Custom className for the wrapper */
  wrapperClassName?: string;

  /** Custom className for the input wrapper */
  inputWrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      variant = 'default',
      size = 'md',
      fullWidth = true,
      leftIcon,
      rightIcon,
      label,
      helperText,
      error,
      warning,
      success,
      loading = false,
      showValidationIcon = true,
      hideLabel = false,
      floatingLabel = false,
      description,
      className,
      wrapperClassName,
      inputWrapperClassName,
      disabled,
      id,
      ...props
    },
    ref
  ) => {
    // Determine actual variant based on state props
    const actualVariant = error ? 'error' : warning ? 'warning' : success ? 'success' : variant;
    const actualHelperText = error || warning || success || helperText;
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

    // Validation icon logic
    const getValidationIcon = () => {
      if (!showValidationIcon || loading) return null;

      if (error) return <AlertCircle className={cn(sizeVariants.icon[size], 'text-red-500')} />;
      if (warning)
        return <AlertTriangle className={cn(sizeVariants.icon[size], 'text-amber-500')} />;
      if (success) return <CheckCircle className={cn(sizeVariants.icon[size], 'text-green-500')} />;

      return null;
    };

    const validationIcon = getValidationIcon();
    const hasRightElement = rightIcon || validationIcon || loading;

    const inputClasses = cn(
      // Base styles
      'block w-full font-sans',
      'transition-all duration-150 ease-in-out',
      'placeholder:text-graphite-400',
      'focus:outline-none focus:ring-2 focus:ring-offset-0',

      // Variant styles
      inputVariants[actualVariant],

      // Size styles
      sizeVariants.input[size],

      // Icon padding adjustments
      leftIcon && (size === 'lg' ? 'pl-12' : size === 'sm' ? 'pl-8' : 'pl-10'),
      hasRightElement && (size === 'lg' ? 'pr-12' : size === 'sm' ? 'pr-8' : 'pr-10'),

      // Loading state
      loading && 'cursor-wait',

      // Floating label adjustments
      floatingLabel && 'pt-6 pb-2',

      // Custom className
      className
    );

    const wrapperClasses = cn(
      'space-y-1',
      !fullWidth && 'inline-block',
      disabled && 'opacity-60 cursor-not-allowed',
      wrapperClassName
    );

    const inputWrapperClasses = cn('relative', inputWrapperClassName);

    return (
      <div className={wrapperClasses}>
        {/* Label */}
        {label && !hideLabel && !floatingLabel && (
          <label htmlFor={inputId} className="block text-sm font-medium text-graphite-700">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        {/* Description */}
        {description && !floatingLabel && (
          <p className="text-sm text-graphite-600">{description}</p>
        )}

        {/* Input wrapper */}
        <div className={inputWrapperClasses}>
          {/* Floating label */}
          {label && !hideLabel && floatingLabel && (
            <label
              htmlFor={inputId}
              className={cn(
                'absolute left-3 transition-all duration-150 pointer-events-none',
                'text-sm font-medium',
                props.value || props.defaultValue
                  ? 'top-2 text-xs text-graphite-600'
                  : 'top-1/2 -translate-y-1/2 text-graphite-500',
                actualVariant === 'error' && 'text-red-600',
                actualVariant === 'warning' && 'text-amber-600',
                actualVariant === 'success' && 'text-green-600'
              )}
            >
              {label}
              {props.required && <span className="text-red-500 ml-1">*</span>}
            </label>
          )}

          {/* Left icon */}
          {leftIcon && (
            <div
              className={cn(
                'absolute top-1/2 -translate-y-1/2 text-graphite-400',
                size === 'lg' ? 'left-4' : size === 'sm' ? 'left-2' : 'left-3'
              )}
            >
              <div className={sizeVariants.icon[size]}>{leftIcon}</div>
            </div>
          )}

          {/* Input field */}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled || loading}
            className={inputClasses}
            aria-describedby={cn(
              actualHelperText && `${inputId}-description`,
              description && `${inputId}-desc`
            )}
            aria-invalid={!!error}
            {...props}
          />

          {/* Right side elements */}
          <div
            className={cn(
              'absolute top-1/2 -translate-y-1/2 flex items-center gap-1',
              size === 'lg' ? 'right-4' : size === 'sm' ? 'right-2' : 'right-3'
            )}
          >
            {/* Loading spinner */}
            {loading && (
              <Loader2 className={cn(sizeVariants.icon[size], 'animate-spin text-graphite-400')} />
            )}

            {/* Validation icon */}
            {validationIcon}

            {/* Right icon */}
            {rightIcon && (
              <div className="text-graphite-400">
                <div className={sizeVariants.icon[size]}>{rightIcon}</div>
              </div>
            )}
          </div>
        </div>

        {/* Description for floating label variant */}
        {description && floatingLabel && (
          <p id={`${inputId}-desc`} className="text-sm text-graphite-600">
            {description}
          </p>
        )}

        {/* Helper text / Validation messages */}
        {actualHelperText && (
          <p
            id={`${inputId}-description`}
            className={cn(
              'text-sm flex items-start gap-1',
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

Input.displayName = 'Input';

export default Input;
