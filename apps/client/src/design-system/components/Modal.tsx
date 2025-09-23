/**
 * Modal Component - Design System
 * Professional modal dialog with comprehensive variants, accessibility, and animations
 * Designed for developer tools with sophisticated graphite theme
 */

import { clsx } from 'clsx';
import { AlertTriangle, CheckCircle, Info, Loader2, X, XCircle } from 'lucide-react';
import React, {
  useEffect,
  useRef,
  type ReactNode,
  type MouseEvent,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../variants';
import Button from './Button';

export interface ModalProps {
  /** Whether the modal is open */
  open: boolean;

  /** Callback when the modal should be closed */
  onClose: () => void;

  /** Modal title */
  title?: string;

  /** Modal description */
  description?: string;

  /** Modal size */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full';

  /** Modal variant */
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';

  /** Whether the modal is in loading state */
  loading?: boolean;

  /** Whether to show the close button */
  showCloseButton?: boolean;

  /** Whether to close on backdrop click */
  closeOnBackdropClick?: boolean;

  /** Whether to close on escape key */
  closeOnEscape?: boolean;

  /** Custom className for the modal content */
  className?: string;

  /** Custom className for the modal container */
  containerClassName?: string;

  /** Modal content */
  children?: ReactNode;

  /** Footer content */
  footer?: ReactNode;

  /** Whether to show default footer with close button */
  showDefaultFooter?: boolean;

  /** Initial focus element selector */
  initialFocus?: string;

  /** Whether to center content vertically */
  centered?: boolean;

  /** Custom z-index */
  zIndex?: number;
}

const sizeClasses = {
  xs: 'max-w-xs',
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  full: 'max-w-full mx-4',
} as const;

const variantIcons = {
  default: null,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
} as const;

const variantClasses = {
  default: '',
  success: 'border-l-4 border-green-500',
  warning: 'border-l-4 border-yellow-500',
  error: 'border-l-4 border-red-500',
  info: 'border-l-4 border-blue-500',
} as const;

const variantIconClasses = {
  default: '',
  success: 'text-green-500',
  warning: 'text-yellow-500',
  error: 'text-red-500',
  info: 'text-blue-500',
} as const;

export function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  variant = 'default',
  loading = false,
  showCloseButton = true,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  className,
  containerClassName,
  children,
  footer,
  showDefaultFooter = false,
  initialFocus,
  centered = true,
  zIndex = 50,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Focus management
  useEffect(() => {
    if (open) {
      // Store previously focused element
      previousActiveElement.current = document.activeElement as HTMLElement;

      // Focus initial element or modal itself
      setTimeout(() => {
        if (initialFocus) {
          const element = modalRef.current?.querySelector(initialFocus) as HTMLElement;
          if (element) {
            element.focus();
          }
        } else {
          modalRef.current?.focus();
        }
      }, 100);
    }

    // Restore focus when closing
    return () => {
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [open, initialFocus]);

  // Handle escape key
  useEffect(() => {
    if (!open || !closeOnEscape) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape as any);
    return () => document.removeEventListener('keydown', handleEscape as any);
  }, [open, closeOnEscape, onClose]);

  // Handle backdrop click
  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (closeOnBackdropClick && event.target === event.currentTarget) {
      onClose();
    }
  };

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [open]);

  // Trap focus within modal
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab') {
      const modal = modalRef.current;
      if (!modal) return;

      const focusableElements = modal.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
      ) as NodeListOf<HTMLElement>;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    }
  };

  if (!open) return null;

  const VariantIcon = variantIcons[variant];

  const modal = (
    <div className={cn('fixed inset-0', `z-${zIndex}`)}>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-graphite-900/50 backdrop-blur-sm transition-opacity"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Modal container */}
      <div
        className={cn(
          'fixed inset-0 flex p-4',
          centered ? 'items-center justify-center' : 'items-start justify-center pt-16',
          containerClassName
        )}
      >
        <div
          ref={modalRef}
          className={cn(
            // Base styles
            'relative bg-white rounded-xl shadow-2xl border border-graphite-200',
            'transform transition-all',
            'animate-in fade-in zoom-in-95 duration-200',
            'w-full max-h-[90vh] overflow-y-auto',
            'focus:outline-none',

            // Size classes
            sizeClasses[size],

            // Variant classes
            variantClasses[variant],

            // Loading state
            loading && 'pointer-events-none',

            // Custom className
            className
          )}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? 'modal-title' : undefined}
          aria-describedby={description ? 'modal-description' : undefined}
          tabIndex={-1}
          onKeyDown={handleKeyDown}
        >
          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-xl z-10">
              <div className="flex items-center gap-3 text-graphite-600">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm font-medium">Loading...</span>
              </div>
            </div>
          )}

          {/* Header */}
          {(title || showCloseButton) && (
            <div className="flex items-start gap-4 p-6 border-b border-graphite-200">
              {VariantIcon && (
                <div className={cn('flex-shrink-0 mt-1', variantIconClasses[variant])}>
                  <VariantIcon className="h-6 w-6" />
                </div>
              )}

              <div className="flex-1 min-w-0">
                {title && (
                  <h2 id="modal-title" className="text-xl font-semibold text-graphite-900">
                    {title}
                  </h2>
                )}
                {description && (
                  <p
                    id="modal-description"
                    className="mt-2 text-sm text-graphite-600 leading-relaxed"
                  >
                    {description}
                  </p>
                )}
              </div>

              {showCloseButton && (
                <button
                  type="button"
                  className={cn(
                    'flex-shrink-0 rounded-md p-2 transition-colors',
                    'text-graphite-400 hover:text-graphite-600 hover:bg-graphite-100',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1'
                  )}
                  onClick={onClose}
                  aria-label="Close modal"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
          )}

          {/* Content */}
          <div
            className={cn(
              'px-6',
              title || showCloseButton ? 'py-4' : 'pt-6',
              footer || showDefaultFooter ? 'pb-4' : 'pb-6'
            )}
          >
            {children}
          </div>

          {/* Footer */}
          {(footer || showDefaultFooter) && (
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-graphite-200 bg-graphite-50/50 rounded-b-xl">
              {footer || (
                <Button variant="secondary" onClick={onClose}>
                  Close
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

export default Modal;
