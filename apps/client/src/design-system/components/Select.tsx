/**
 * Select Component - Design System
 * Professional select dropdown with comprehensive features for developer tools
 * Includes search, multi-select, validation states, and sophisticated graphite styling
 */

import { clsx } from 'clsx';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Search,
  X,
} from 'lucide-react';
import React, {
  forwardRef,
  useState,
  useRef,
  useEffect,
  type ReactNode,
  type KeyboardEvent,
} from 'react';
import { cn } from '../variants';

export interface SelectOption {
  /** Unique value for the option */
  value: string;
  /** Display label for the option */
  label: string;
  /** Optional description for the option */
  description?: string;
  /** Whether the option is disabled */
  disabled?: boolean;
  /** Optional icon for the option */
  icon?: ReactNode;
  /** Optional group/category for the option */
  group?: string;
}

export interface SelectProps {
  /** Array of options to display */
  options: SelectOption[];

  /** Currently selected value(s) */
  value?: string | string[];

  /** Default value(s) */
  defaultValue?: string | string[];

  /** Callback when selection changes */
  onChange?: (value: string | string[]) => void;

  /** Whether multiple selections are allowed */
  multiple?: boolean;

  /** Placeholder text when no option is selected */
  placeholder?: string;

  /** Label for the select */
  label?: string;

  /** Helper text below the select */
  helperText?: string;

  /** Additional description text */
  description?: string;

  /** Error message (sets variant to error automatically) */
  error?: string;

  /** Warning message (sets variant to warning automatically) */
  warning?: string;

  /** Success message (sets variant to success automatically) */
  success?: string;

  /** Select variant */
  variant?: 'default' | 'error' | 'success' | 'warning';

  /** Select size */
  size?: 'sm' | 'md' | 'lg';

  /** Whether the select should take full width */
  fullWidth?: boolean;

  /** Whether to show search input in dropdown */
  searchable?: boolean;

  /** Whether the select is disabled */
  disabled?: boolean;

  /** Whether the select is required */
  required?: boolean;

  /** Whether the select is in a loading state */
  loading?: boolean;

  /** Whether to show validation icons automatically */
  showValidationIcon?: boolean;

  /** Whether the label should be inside the select (floating) */
  floatingLabel?: boolean;

  /** Whether to show the label */
  hideLabel?: boolean;

  /** Maximum height for the dropdown */
  maxHeight?: number;

  /** Whether to show option descriptions */
  showDescriptions?: boolean;

  /** Custom className for additional styling */
  className?: string;

  /** Custom className for the wrapper */
  wrapperClassName?: string;

  /** Custom className for the dropdown */
  dropdownClassName?: string;
}

export const Select = forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      options = [],
      value,
      defaultValue,
      onChange,
      multiple = false,
      placeholder = multiple ? 'Select options...' : 'Select an option...',
      label,
      helperText,
      description,
      error,
      warning,
      success,
      variant = 'default',
      size = 'md',
      fullWidth = true,
      searchable = false,
      disabled = false,
      required = false,
      loading = false,
      showValidationIcon = true,
      floatingLabel = false,
      hideLabel = false,
      maxHeight = 320,
      showDescriptions = true,
      className,
      wrapperClassName,
      dropdownClassName,
      ...props
    },
    ref
  ) => {
    // State management
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const [selectedValues, setSelectedValues] = useState<string[]>(() => {
      if (value !== undefined) {
        return Array.isArray(value) ? value : [value];
      }
      if (defaultValue !== undefined) {
        return Array.isArray(defaultValue) ? defaultValue : [defaultValue];
      }
      return [];
    });

    // Refs
    const selectRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Determine actual variant based on state props
    const actualVariant = error ? 'error' : warning ? 'warning' : success ? 'success' : variant;
    const actualHelperText = error || warning || success || helperText;

    // Filter options based on search term
    const filteredOptions =
      searchable && searchTerm
        ? options.filter(
            option =>
              option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
              option.description?.toLowerCase().includes(searchTerm.toLowerCase())
          )
        : options;

    // Get validation icon
    const getValidationIcon = () => {
      if (!showValidationIcon || loading) return null;

      if (error) return <AlertCircle className="h-4 w-4 text-red-500" />;
      if (warning) return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      if (success) return <CheckCircle className="h-4 w-4 text-green-500" />;

      return null;
    };

    const validationIcon = getValidationIcon();

    // Get selected option labels
    const getSelectedLabels = () => {
      return selectedValues.map(val => {
        const option = options.find(opt => opt.value === val);
        return option?.label || val;
      });
    };

    // Handle selection
    const handleSelect = (optionValue: string) => {
      let newValues: string[];

      if (multiple) {
        if (selectedValues.includes(optionValue)) {
          newValues = selectedValues.filter(val => val !== optionValue);
        } else {
          newValues = [...selectedValues, optionValue];
        }
      } else {
        newValues = [optionValue];
        setIsOpen(false);
      }

      setSelectedValues(newValues);

      if (onChange) {
        onChange(multiple ? newValues : newValues[0]);
      }
    };

    // Handle keyboard navigation
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
          } else {
            setFocusedIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          if (isOpen) {
            setFocusedIndex(prev => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
          }
          break;

        case 'Enter':
        case ' ':
          e.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
          } else if (focusedIndex >= 0 && focusedIndex < filteredOptions.length) {
            handleSelect(filteredOptions[focusedIndex].value);
          }
          break;

        case 'Escape':
          setIsOpen(false);
          setFocusedIndex(-1);
          break;

        case 'Tab':
          setIsOpen(false);
          break;
      }
    };

    // Handle outside click
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Focus search input when dropdown opens
    useEffect(() => {
      if (isOpen && searchable && searchRef.current) {
        searchRef.current.focus();
      }
    }, [isOpen, searchable]);

    // Generate unique ID
    const selectId = `select-${Math.random().toString(36).substr(2, 9)}`;

    // Component classes
    const selectClasses = cn(
      // Base styles
      'relative flex items-center justify-between w-full cursor-pointer',
      'font-sans transition-all duration-150 ease-in-out',
      'focus:outline-none focus:ring-2 focus:ring-offset-0',

      // Size styles
      size === 'sm' && 'px-3 py-1.5 text-sm rounded',
      size === 'md' && 'px-3 py-2 text-base rounded',
      size === 'lg' && 'px-4 py-3 text-lg rounded-lg',

      // Variant styles
      actualVariant === 'default' &&
        cn(
          'bg-white border border-graphite-300 text-graphite-900',
          'hover:border-graphite-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
        ),
      actualVariant === 'error' &&
        cn(
          'bg-white border border-red-300 text-graphite-900',
          'hover:border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500'
        ),
      actualVariant === 'warning' &&
        cn(
          'bg-white border border-amber-300 text-graphite-900',
          'hover:border-amber-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500'
        ),
      actualVariant === 'success' &&
        cn(
          'bg-white border border-emerald-300 text-graphite-900',
          'hover:border-emerald-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
        ),

      // Disabled styles
      disabled && 'bg-graphite-50 text-graphite-500 cursor-not-allowed border-graphite-200',

      // Open state
      isOpen && 'border-blue-500 ring-1 ring-blue-500',

      className
    );

    const wrapperClasses = cn(
      'space-y-1',
      !fullWidth && 'inline-block',
      disabled && 'opacity-60',
      wrapperClassName
    );

    return (
      <div className={wrapperClasses}>
        {/* Label */}
        {label && !hideLabel && !floatingLabel && (
          <label htmlFor={selectId} className="block text-sm font-medium text-graphite-700">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        {/* Description */}
        {description && !floatingLabel && (
          <p className="text-sm text-graphite-600">{description}</p>
        )}

        {/* Select container */}
        <div ref={selectRef} className="relative">
          {/* Floating label */}
          {label && !hideLabel && floatingLabel && (
            <label
              htmlFor={selectId}
              className={cn(
                'absolute left-3 transition-all duration-150 pointer-events-none',
                'text-sm font-medium',
                selectedValues.length > 0 || isOpen
                  ? 'top-2 text-xs text-graphite-600'
                  : 'top-1/2 -translate-y-1/2 text-graphite-500',
                actualVariant === 'error' && 'text-red-600',
                actualVariant === 'warning' && 'text-amber-600',
                actualVariant === 'success' && 'text-green-600'
              )}
            >
              {label}
              {required && <span className="text-red-500 ml-1">*</span>}
            </label>
          )}

          {/* Select button */}
          <button
            ref={ref}
            id={selectId}
            type="button"
            disabled={disabled || loading}
            className={selectClasses}
            onClick={() => !disabled && !loading && setIsOpen(!isOpen)}
            onKeyDown={handleKeyDown}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-describedby={cn(
              actualHelperText && `${selectId}-description`,
              description && `${selectId}-desc`
            )}
            {...props}
          >
            {/* Selected values / placeholder */}
            <div
              className={cn(
                'flex-1 text-left truncate',
                floatingLabel && selectedValues.length > 0 && 'pt-4',
                selectedValues.length === 0 && 'text-graphite-400'
              )}
            >
              {selectedValues.length > 0 ? (
                multiple && selectedValues.length > 1 ? (
                  <span className="flex items-center gap-1">
                    {getSelectedLabels().slice(0, 2).join(', ')}
                    {selectedValues.length > 2 && (
                      <span className="bg-graphite-100 text-graphite-700 px-1.5 py-0.5 rounded text-xs">
                        +{selectedValues.length - 2}
                      </span>
                    )}
                  </span>
                ) : (
                  getSelectedLabels().join(', ')
                )
              ) : (
                placeholder
              )}
            </div>

            {/* Right side elements */}
            <div className="flex items-center gap-1 ml-2">
              {/* Loading spinner */}
              {loading && <Loader2 className="h-4 w-4 animate-spin text-graphite-400" />}

              {/* Validation icon */}
              {validationIcon}

              {/* Clear button for multiple select */}
              {multiple && selectedValues.length > 0 && !disabled && !loading && (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    setSelectedValues([]);
                    onChange && onChange([]);
                  }}
                  className="p-0.5 hover:bg-graphite-100 rounded"
                  aria-label="Clear selection"
                >
                  <X className="h-3 w-3 text-graphite-500" />
                </button>
              )}

              {/* Chevron */}
              {!loading &&
                (isOpen ? (
                  <ChevronUp className="h-4 w-4 text-graphite-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-graphite-500" />
                ))}
            </div>
          </button>

          {/* Dropdown */}
          {isOpen && (
            <div
              ref={dropdownRef}
              className={cn(
                'absolute z-50 w-full mt-1',
                'bg-white border border-graphite-300 rounded-lg shadow-lg',
                'animate-in fade-in-0 zoom-in-95 duration-100',
                dropdownClassName
              )}
              style={{ maxHeight }}
            >
              {/* Search input */}
              {searchable && (
                <div className="p-2 border-b border-graphite-200">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-graphite-400" />
                    <input
                      ref={searchRef}
                      type="text"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      placeholder="Search options..."
                      className="w-full pl-10 pr-3 py-2 text-sm border border-graphite-300 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              {/* Options list */}
              <div className="max-h-60 overflow-y-auto">
                {filteredOptions.length === 0 ? (
                  <div className="p-3 text-sm text-graphite-500 text-center">
                    {searchTerm ? 'No options match your search' : 'No options available'}
                  </div>
                ) : (
                  filteredOptions.map((option, index) => (
                    <button
                      key={option.value}
                      type="button"
                      disabled={option.disabled}
                      onClick={() => !option.disabled && handleSelect(option.value)}
                      className={cn(
                        'w-full px-3 py-2 text-left flex items-center gap-3',
                        'hover:bg-graphite-50 focus:bg-graphite-50 focus:outline-none',
                        'transition-colors duration-100',
                        index === focusedIndex && 'bg-graphite-50',
                        option.disabled && 'opacity-50 cursor-not-allowed',
                        selectedValues.includes(option.value) && 'bg-blue-50 text-blue-700'
                      )}
                      onMouseEnter={() => setFocusedIndex(index)}
                    >
                      {/* Selection indicator */}
                      <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                        {selectedValues.includes(option.value) && (
                          <Check className="h-3 w-3 text-blue-600" />
                        )}
                      </div>

                      {/* Option icon */}
                      {option.icon && <div className="flex-shrink-0">{option.icon}</div>}

                      {/* Option content */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-graphite-900">{option.label}</div>
                        {option.description && showDescriptions && (
                          <div className="text-xs text-graphite-500 truncate">
                            {option.description}
                          </div>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Description for floating label variant */}
        {description && floatingLabel && (
          <p id={`${selectId}-desc`} className="text-sm text-graphite-600">
            {description}
          </p>
        )}

        {/* Helper text / Validation messages */}
        {actualHelperText && (
          <p
            id={`${selectId}-description`}
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

Select.displayName = 'Select';

export default Select;
