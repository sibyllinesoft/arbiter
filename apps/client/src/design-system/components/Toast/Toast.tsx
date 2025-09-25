/**
 * Toast Component - Design System
 * Professional toast notifications with comprehensive variants and states
 * Designed for developer tools with sophisticated graphite theme
 */

import { AlertCircle, CheckCircle, Info, Loader2, X, XCircle } from 'lucide-react';
import React, { useState, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn, statusVariants } from '../variants';

export interface ToastProps {
  /** Unique identifier for the toast */
  id?: string;

  /** Toast variant determines the visual style and icon */
  variant?: 'success' | 'warning' | 'error' | 'info' | 'loading' | 'neutral';

  /** Toast title */
  title: string;

  /** Toast description */
  description?: string;

  /** Whether the toast is visible */
  visible?: boolean;

  /** Duration in milliseconds before auto-dismiss (0 for no auto-dismiss) */
  duration?: number;

  /** Position of the toast */
  position?:
    | 'top-right'
    | 'top-left'
    | 'bottom-right'
    | 'bottom-left'
    | 'top-center'
    | 'bottom-center';

  /** Whether to show close button */
  closable?: boolean;

  /** Whether to show progress bar */
  showProgress?: boolean;

  /** Whether the toast can be dismissed by clicking */
  dismissible?: boolean;

  /** Callback when toast is closed */
  onClose?: () => void;

  /** Callback when toast is clicked */
  onClick?: () => void;

  /** Custom icon to override default */
  icon?: ReactNode;

  /** Custom className for additional styling */
  className?: string;

  /** Action buttons or content */
  action?: ReactNode;
}

const icons = {
  success: CheckCircle,
  warning: AlertCircle,
  error: XCircle,
  info: Info,
  loading: Loader2,
  neutral: Info,
} as const;

const positionClasses = {
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'top-center': 'top-4 left-1/2 -translate-x-1/2',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
} as const;

// Extended status variants for additional toast types
const extendedStatusVariants = {
  ...statusVariants,
  loading: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    icon: 'text-blue-500',
    dot: 'bg-blue-500',
  },
};

/**
 * Create progress update callback for auto-dismissing toasts
 */
function createProgressUpdater(
  startTimeRef: React.MutableRefObject<number | undefined>,
  duration: number,
  setProgress: (progress: number) => void
) {
  return () => {
    if (!startTimeRef.current) return;

    const elapsed = Date.now() - startTimeRef.current;
    const remaining = Math.max(0, duration - elapsed);
    const progressValue = (remaining / duration) * 100;

    setProgress(progressValue);

    if (remaining > 0) {
      requestAnimationFrame(createProgressUpdater(startTimeRef, duration, setProgress));
    }
  };
}

/**
 * Setup auto-dismiss timer with optional progress tracking
 */
function setupAutoDismiss(
  duration: number,
  isVisible: boolean,
  variant: NonNullable<ToastProps['variant']> = 'info',
  showProgress: boolean,
  setProgress: (progress: number) => void,
  handleClose: () => void
) {
  if (duration <= 0 || !isVisible || variant === 'loading') {
    return () => {}; // No cleanup needed
  }

  const startTimeRef = { current: Date.now() };

  // Setup progress updates if requested
  if (showProgress) {
    const updateProgress = createProgressUpdater(startTimeRef, duration, setProgress);
    updateProgress();
  }

  // Setup auto-dismiss timer
  const timeoutId = setTimeout(handleClose, duration);

  return () => clearTimeout(timeoutId);
}

/**
 * Create toast event handlers
 */
function createToastHandlers(dismissible: boolean, onClose?: () => void, onClick?: () => void) {
  const handleClose = () => {
    onClose?.();
  };

  const handleClick = () => {
    if (dismissible) {
      handleClose();
    }
    onClick?.();
  };

  const handleCloseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleClose();
  };

  return { handleClose, handleClick, handleCloseClick };
}

/**
 * Render toast icon based on variant and custom icon
 */
function renderToastIcon(variant: ToastProps['variant'], icon?: ReactNode, statusClasses?: string) {
  const IconComponent = icons[variant || 'info'];

  return (
    <div className={cn('flex-shrink-0 mt-0.5', statusClasses)}>
      {icon ||
        (variant === 'loading' ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <IconComponent className="h-5 w-5" />
        ))}
    </div>
  );
}

/**
 * Render toast content (title, description, action)
 */
function renderToastContent(title: string, description?: string, action?: ReactNode) {
  return (
    <div className="flex-1 min-w-0">
      <h3 className={cn('font-semibold text-sm text-graphite-900')}>{title}</h3>

      {description && (
        <p className={cn('mt-1 text-sm text-graphite-600 leading-relaxed')}>{description}</p>
      )}

      {action && (
        <div className="mt-3" onClick={e => e.stopPropagation()}>
          {action}
        </div>
      )}
    </div>
  );
}

/**
 * Render toast close button
 */
function renderCloseButton(closable: boolean, handleCloseClick: (e: React.MouseEvent) => void) {
  if (!closable) return null;

  return (
    <button
      type="button"
      className={cn(
        'flex-shrink-0 rounded-md p-1.5 transition-colors',
        'hover:bg-graphite-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
        'text-graphite-400 hover:text-graphite-600'
      )}
      onClick={handleCloseClick}
      aria-label="Close notification"
    >
      <X className="h-4 w-4" />
    </button>
  );
}

/**
 * Render progress bar for auto-dismissing toasts
 */
function renderProgressBar(
  showProgress: boolean,
  duration: number,
  variant: NonNullable<ToastProps['variant']> = 'info',
  progress: number,
  statusDot: string
) {
  if (!showProgress || duration <= 0 || variant === 'loading') {
    return null;
  }

  return (
    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 rounded-b-lg overflow-hidden">
      <div
        className={cn(
          'h-full transition-all duration-100 ease-linear',
          statusDot.replace('bg-', 'bg-')
        )}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

export function Toast({
  variant = 'info',
  title,
  description,
  visible = true,
  duration = 5000,
  position = 'top-right',
  closable = true,
  showProgress = false,
  dismissible = false,
  onClose,
  onClick,
  icon,
  className,
  action,
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(visible);
  const [progress, setProgress] = useState(100);

  // Create handlers once
  const { handleClose, handleClick, handleCloseClick } = createToastHandlers(
    dismissible,
    () => {
      setIsVisible(false);
      onClose?.();
    },
    onClick
  );

  // Auto-dismiss effect with progress
  useEffect(() => {
    return setupAutoDismiss(duration, isVisible, variant, showProgress, setProgress, handleClose);
  }, [duration, isVisible, variant, showProgress, handleClose]);

  // Update visibility when prop changes
  useEffect(() => {
    setIsVisible(visible);
    if (visible) {
      setProgress(100);
    }
  }, [visible]);

  if (!isVisible) return null;

  const status = extendedStatusVariants[variant || 'info'];

  const toast = (
    <div
      className={cn(
        // Base styles
        'fixed z-50 pointer-events-auto',
        'max-w-sm w-full',
        'transform transition-all duration-300 ease-out',
        'animate-in slide-in-from-top-2 fade-in',

        // Position
        positionClasses[position],

        // Custom className
        className
      )}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        className={cn(
          // Base container styles
          'relative flex items-start gap-3 p-4 rounded-lg shadow-lg border',
          'backdrop-blur-sm bg-white/95',
          'transform transition-transform hover:scale-[1.02]',

          // Variant styles
          status.border,

          // Clickable styles
          (dismissible || onClick) && 'cursor-pointer hover:shadow-xl'
        )}
        onClick={handleClick}
      >
        {renderProgressBar(showProgress, duration, variant, progress, status.dot)}
        {renderToastIcon(variant, icon, status.icon)}
        {renderToastContent(title, description, action)}
        {renderCloseButton(closable, handleCloseClick)}
      </div>
    </div>
  );

  return createPortal(toast, document.body);
}

// Toast container for managing multiple toasts
export interface ToastContainerProps {
  /** Maximum number of toasts to show */
  limit?: number;

  /** Position of toasts */
  position?: ToastProps['position'];

  /** Gap between toasts */
  gap?: 'sm' | 'md' | 'lg';

  /** Custom className for the container */
  className?: string;

  /** Array of toasts to display */
  toasts?: Omit<ToastProps, 'position'>[];

  /** Callback when a toast is closed */
  onToastClose?: (id: string) => void;
}

const gapClasses = {
  sm: 'space-y-1',
  md: 'space-y-2',
  lg: 'space-y-4',
} as const;

export function ToastContainer({
  limit = 5,
  position = 'top-right',
  gap = 'md',
  className,
  toasts = [],
  onToastClose,
}: ToastContainerProps) {
  const visibleToasts = toasts.slice(0, limit);

  return (
    <div
      className={cn(
        'fixed z-50 pointer-events-none',
        'max-w-sm w-full',
        gapClasses[gap],
        positionClasses[position],
        className
      )}
      aria-live="polite"
      aria-label="Notifications"
    >
      {visibleToasts.map(toast => (
        <Toast
          key={toast.id}
          {...toast}
          position={position}
          onClose={() => {
            toast.onClose?.();
            onToastClose?.(toast.id || '');
          }}
        />
      ))}
    </div>
  );
}

// Toast Hook for easy management (would typically be in a separate hooks file)
export interface ToastOptions extends Omit<ToastProps, 'visible'> {
  id?: string; // Optional id, will be auto-generated if not provided
}

export interface ToastContextValue {
  toasts: ToastProps[];
  showToast: (options: ToastOptions) => string;
  hideToast: (id: string) => void;
  clearToasts: () => void;
}

// Simple toast manager for basic usage
export class ToastManager {
  private toasts: Map<string, ToastProps> = new Map();
  private listeners: Set<() => void> = new Set();

  subscribe(callback: () => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify() {
    this.listeners.forEach(callback => callback());
  }

  getToasts(): ToastProps[] {
    return Array.from(this.toasts.values());
  }

  show(options: ToastOptions): string {
    const id = options.id || `toast-${Date.now()}-${Math.random()}`;
    const toast: ToastProps = {
      ...options,
      id,
      visible: true,
      onClose: () => {
        this.hide(id);
        options.onClose?.();
      },
    };

    this.toasts.set(id, toast);
    this.notify();
    return id;
  }

  hide(id: string) {
    this.toasts.delete(id);
    this.notify();
  }

  clear() {
    this.toasts.clear();
    this.notify();
  }

  // Convenience methods
  success(title: string, description?: string, options?: Partial<ToastOptions>) {
    return this.show({
      ...options,
      variant: 'success',
      title,
      ...(description !== undefined && { description }),
    });
  }

  error(title: string, description?: string, options?: Partial<ToastOptions>) {
    return this.show({
      ...options,
      variant: 'error',
      title,
      ...(description !== undefined && { description }),
    });
  }

  warning(title: string, description?: string, options?: Partial<ToastOptions>) {
    return this.show({
      ...options,
      variant: 'warning',
      title,
      ...(description !== undefined && { description }),
    });
  }

  info(title: string, description?: string, options?: Partial<ToastOptions>) {
    return this.show({
      ...options,
      variant: 'info',
      title,
      ...(description !== undefined && { description }),
    });
  }

  loading(title: string, description?: string, options?: Partial<ToastOptions>) {
    return this.show({
      ...options,
      variant: 'loading',
      title,
      ...(description !== undefined && { description }),
      duration: 0, // Loading toasts don't auto-dismiss
    });
  }
}

// Global toast manager instance
export const toast = new ToastManager();

export default Toast;
