/**
 * Radio Component - Design System
 * Professional radio button with comprehensive states and accessibility
 * Designed for developer tools with sophisticated graphite theme
 */

import React, { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { AlertCircle, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '../variants';

export interface RadioOption {
  /** Value for the radio option */
  value: string;
  /** Label for the radio option */
  label: string;
  /** Description for the radio option */
  description?: string;
  /** Whether this option is disabled */
  disabled?: boolean;
  /** Icon for the radio option */
  icon?: ReactNode;
}

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Radio variant determines the visual style */
  variant?: 'default' | 'error' | 'success' | 'warning';

  /** Radio size affects the radio and font size */
  size?: 'sm' | 'md' | 'lg';

  /** Label text for the radio */
  label?: string;

  /** Additional description text */
  description?: string;

  /** Helper text below the radio */
  helperText?: string;

  /** Error message (sets variant to error automatically) */
  error?: string;

  /** Warning message (sets variant to warning automatically) */
  warning?: string;

  /** Success message (sets variant to success automatically) */
  success?: string;

  /** Whether the radio is in a loading state */
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

export const Radio = forwardRef<HTMLInputElement, RadioProps>(
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
    const radioId = id || `radio-${Math.random().toString(36).substr(2, 9)}`;

    // Get validation icon
    const getValidationIcon = () => {
      if (!showValidationIcon || loading) return null;

      if (error) return <AlertCircle className="h-4 w-4 text-red-500" />;
      if (warning) return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      if (success) return <CheckCircle className="h-4 w-4 text-green-500" />;

      return null;
    };

    const validationIcon = getValidationIcon();

    // Radio size classes
    const sizeClasses = {
      sm: {
        radio: 'h-4 w-4',
        text: 'text-sm',
        dot: 'h-1.5 w-1.5',
        gap: 'gap-2',
      },
      md: {
        radio: 'h-5 w-5',
        text: 'text-base',
        dot: 'h-2 w-2',
        gap: 'gap-3',
      },
      lg: {
        radio: 'h-6 w-6',
        text: 'text-lg',
        dot: 'h-2.5 w-2.5',
        gap: 'gap-3',
      },
    };

    const sizeClass = sizeClasses[size];

    // Radio variant classes
    const variantClasses = {
      default: cn(
        'border-graphite-300 text-blue-600 focus:ring-blue-500',
        'checked:border-blue-600',
        'hover:border-graphite-400',
        'disabled:bg-graphite-50 disabled:border-graphite-200'
      ),
      error: cn(
        'border-red-300 text-red-600 focus:ring-red-500',
        'checked:border-red-600',
        'hover:border-red-400',
        'disabled:bg-red-50 disabled:border-red-200'
      ),
      warning: cn(
        'border-amber-300 text-amber-600 focus:ring-amber-500',
        'checked:border-amber-600',
        'hover:border-amber-400',
        'disabled:bg-amber-50 disabled:border-amber-200'
      ),
      success: cn(
        'border-emerald-300 text-emerald-600 focus:ring-emerald-500',
        'checked:border-emerald-600',
        'hover:border-emerald-400',
        'disabled:bg-emerald-50 disabled:border-emerald-200'
      ),
    };

    const radioClasses = cn(
      // Base styles
      'relative rounded-full border-2 bg-white transition-all duration-150 ease-in-out',
      'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-opacity-50',
      'disabled:cursor-not-allowed',

      // Size
      sizeClass.radio,

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

    const dotClasses = cn(
      'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-150',
      sizeClass.dot,
      actualVariant === 'default' && 'bg-blue-600',
      actualVariant === 'error' && 'bg-red-600',
      actualVariant === 'warning' && 'bg-amber-600',
      actualVariant === 'success' && 'bg-emerald-600',
      checked ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
    );

    return (
      <div className="space-y-1">
        <div className={wrapperClasses}>
          {/* Hidden input */}
          <input
            ref={ref}
            type="radio"
            id={radioId}
            checked={checked}
            disabled={disabled || loading}
            className="sr-only"
            aria-describedby={cn(
              actualHelperText && `${radioId}-description`,
              description && `${radioId}-desc`
            )}
            {...props}
          />

          {/* Custom radio */}
          <div className="relative flex-shrink-0">
            <div className={radioClasses}>
              {/* Loading spinner */}
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-3 w-3 animate-spin text-graphite-400" />
                </div>
              )}

              {/* Radio dot */}
              {!loading && <div className={dotClasses} />}
            </div>
          </div>

          {/* Label and content */}
          {(label || children) && (
            <div className="flex-1 space-y-1">
              <label htmlFor={radioId} className={labelClasses}>
                <div className="flex items-start justify-between gap-2">
                  <span>{children || label}</span>

                  {/* Validation icon */}
                  {validationIcon && <div className="flex-shrink-0">{validationIcon}</div>}
                </div>
              </label>

              {/* Description */}
              {description && (
                <p
                  id={`${radioId}-desc`}
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
            id={`${radioId}-description`}
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

Radio.displayName = 'Radio';

// RadioGroup component for handling groups of radio buttons
export interface RadioGroupProps {
  /** Current value of the radio group */
  value?: string;

  /** Default value of the radio group */
  defaultValue?: string;

  /** Callback when value changes */
  onChange?: (value: string) => void;

  /** Name attribute for all radio buttons */
  name: string;

  /** Array of radio options */
  options: RadioOption[];

  /** Radio group variant */
  variant?: 'default' | 'error' | 'success' | 'warning';

  /** Radio group size */
  size?: 'sm' | 'md' | 'lg';

  /** Group label */
  label?: string;

  /** Group description */
  description?: string;

  /** Helper text for the group */
  helperText?: string;

  /** Error message */
  error?: string;

  /** Warning message */
  warning?: string;

  /** Success message */
  success?: string;

  /** Whether the group is disabled */
  disabled?: boolean;

  /** Whether the group is required */
  required?: boolean;

  /** Layout direction */
  direction?: 'vertical' | 'horizontal';

  /** Custom className */
  className?: string;
}

export const RadioGroup: React.FC<RadioGroupProps> = ({
  value,
  defaultValue,
  onChange,
  name,
  options,
  variant = 'default',
  size = 'md',
  label,
  description,
  helperText,
  error,
  warning,
  success,
  disabled = false,
  required = false,
  direction = 'vertical',
  className,
}) => {
  const [selectedValue, setSelectedValue] = React.useState(value || defaultValue || '');

  const handleChange = (optionValue: string) => {
    setSelectedValue(optionValue);
    onChange?.(optionValue);
  };

  const actualVariant = error ? 'error' : warning ? 'warning' : success ? 'success' : variant;
  const actualHelperText = error || warning || success || helperText;
  const groupId = `radio-group-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={cn('space-y-2', className)}>
      {/* Group label */}
      {label && (
        <legend className="text-sm font-medium text-graphite-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </legend>
      )}

      {/* Group description */}
      {description && <p className="text-sm text-graphite-600">{description}</p>}

      {/* Radio options */}
      <div
        className={cn('space-y-2', direction === 'horizontal' && 'flex flex-wrap gap-6 space-y-0')}
      >
        {options.map(option => (
          <Radio
            key={option.value}
            name={name}
            value={option.value}
            checked={selectedValue === option.value}
            onChange={() => !option.disabled && handleChange(option.value)}
            variant={actualVariant}
            size={size}
            label={option.label}
            description={option.description}
            disabled={disabled || option.disabled}
            className={direction === 'horizontal' ? 'mb-0' : undefined}
          >
            {option.icon && (
              <div className="flex items-center gap-2">
                {option.icon}
                <span>{option.label}</span>
              </div>
            )}
          </Radio>
        ))}
      </div>

      {/* Group helper text */}
      {actualHelperText && (
        <p
          className={cn(
            'text-sm',
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
};

export default Radio;
