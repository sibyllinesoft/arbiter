/**
 * Dialog Component - Design System
 * Simple confirmation and alert dialogs with predefined actions
 * Designed for developer tools with sophisticated graphite theme
 */

import React, { type ReactNode } from 'react';
import { cn } from '../variants';
import Button from './Button';
import Modal from './Modal';

export interface DialogAction {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export interface DialogProps {
  /** Whether the dialog is open */
  open: boolean;

  /** Callback when the dialog should be closed */
  onClose: () => void;

  /** Dialog title */
  title: string;

  /** Dialog description */
  description?: string;

  /** Dialog type */
  type?: 'default' | 'confirmation' | 'destructive' | 'success' | 'warning' | 'error' | 'info';

  /** Custom dialog content */
  children?: ReactNode;

  /** Action buttons */
  actions?: DialogAction[];

  /** Whether to show the cancel button */
  showCancel?: boolean;

  /** Custom cancel label */
  cancelLabel?: string;

  /** Whether to close on backdrop click */
  closeOnBackdropClick?: boolean;

  /** Whether to close on escape key */
  closeOnEscape?: boolean;

  /** Custom className */
  className?: string;
}

const typeToVariant = {
  default: 'default',
  confirmation: 'info',
  destructive: 'error',
  success: 'success',
  warning: 'warning',
  error: 'error',
  info: 'info',
} as const;

const typeDefaults = {
  default: {
    primaryLabel: 'OK',
    primaryVariant: 'primary' as const,
  },
  confirmation: {
    primaryLabel: 'Confirm',
    primaryVariant: 'primary' as const,
  },
  destructive: {
    primaryLabel: 'Delete',
    primaryVariant: 'danger' as const,
  },
  success: {
    primaryLabel: 'Continue',
    primaryVariant: 'primary' as const,
  },
  warning: {
    primaryLabel: 'Proceed',
    primaryVariant: 'primary' as const,
  },
  error: {
    primaryLabel: 'OK',
    primaryVariant: 'primary' as const,
  },
  info: {
    primaryLabel: 'OK',
    primaryVariant: 'primary' as const,
  },
} as const;

export function Dialog({
  open,
  onClose,
  title,
  description,
  type = 'default',
  children,
  actions,
  showCancel = true,
  cancelLabel = 'Cancel',
  closeOnBackdropClick = false,
  closeOnEscape = true,
  className,
}: DialogProps) {
  const defaults = typeDefaults[type];
  const modalVariant = typeToVariant[type];

  // Generate default actions if none provided
  const finalActions = actions || [
    ...(showCancel
      ? [
          {
            label: cancelLabel,
            variant: 'secondary' as const,
            onClick: onClose,
          },
        ]
      : []),
    {
      label: defaults.primaryLabel,
      variant: defaults.primaryVariant,
      onClick: onClose,
    },
  ];

  const footer = (
    <div className="flex items-center justify-end gap-3">
      {finalActions.map((action, index) => (
        <Button
          key={index}
          variant={action.variant || 'secondary'}
          onClick={action.onClick}
          disabled={action.disabled}
          loading={action.loading}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      variant={modalVariant}
      size="sm"
      footer={footer}
      closeOnBackdropClick={closeOnBackdropClick}
      closeOnEscape={closeOnEscape}
      showCloseButton={false}
      className={className}
      initialFocus="button"
    >
      {children}
    </Modal>
  );
}

// Convenience dialogs for common use cases
export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: 'confirmation' | 'destructive';
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  type = 'confirmation',
  loading = false,
}: ConfirmDialogProps) {
  const defaults = typeDefaults[type];

  const actions: DialogAction[] = [
    {
      label: cancelLabel,
      variant: 'secondary',
      onClick: onClose,
      disabled: loading,
    },
    {
      label: confirmLabel || defaults.primaryLabel,
      variant: defaults.primaryVariant,
      onClick: onConfirm,
      loading,
    },
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      type={type}
      actions={actions}
      showCancel={false}
      closeOnBackdropClick={!loading}
      closeOnEscape={!loading}
    />
  );
}

export interface AlertDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  type?: 'success' | 'warning' | 'error' | 'info';
  okLabel?: string;
  children?: ReactNode;
}

export function AlertDialog({
  open,
  onClose,
  title,
  description,
  type = 'info',
  okLabel = 'OK',
  children,
}: AlertDialogProps) {
  const actions: DialogAction[] = [
    {
      label: okLabel,
      variant: 'primary',
      onClick: onClose,
    },
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      type={type}
      actions={actions}
      showCancel={false}
    >
      {children}
    </Dialog>
  );
}

// Hook for imperative usage
export interface UseDialogReturn {
  confirm: (options: Omit<ConfirmDialogProps, 'open' | 'onClose'>) => Promise<boolean>;
  alert: (options: Omit<AlertDialogProps, 'open' | 'onClose'>) => Promise<void>;
  dialog: (options: Omit<DialogProps, 'open' | 'onClose'>) => Promise<void>;
}

export function useDialog(): UseDialogReturn {
  const [dialogs, setDialogs] = React.useState<
    Array<{
      id: string;
      component: React.ReactNode;
      resolve: (value: any) => void;
    }>
  >([]);

  const createDialog = React.useCallback(
    <T,>(component: React.ReactNode, defaultValue: T): Promise<T> => {
      return new Promise(resolve => {
        const id = Math.random().toString(36).substr(2, 9);
        setDialogs(prev => [...prev, { id, component, resolve }]);

        // Auto-resolve with default value if no action taken
        setTimeout(() => {
          setDialogs(prev => {
            const exists = prev.find(d => d.id === id);
            if (exists) {
              exists.resolve(defaultValue);
              return prev.filter(d => d.id !== id);
            }
            return prev;
          });
        }, 30000); // 30 second timeout
      });
    },
    []
  );

  const removeDialog = React.useCallback((id: string) => {
    setDialogs(prev => prev.filter(d => d.id !== id));
  }, []);

  const confirm = React.useCallback(
    (options: Omit<ConfirmDialogProps, 'open' | 'onClose'>) => {
      return createDialog<boolean>(
        <ConfirmDialog
          {...options}
          open={true}
          onClose={() => {
            const dialog = dialogs[dialogs.length - 1];
            if (dialog) {
              dialog.resolve(false);
              removeDialog(dialog.id);
            }
          }}
          onConfirm={() => {
            const dialog = dialogs[dialogs.length - 1];
            if (dialog) {
              dialog.resolve(true);
              removeDialog(dialog.id);
            }
          }}
        />,
        false
      );
    },
    [createDialog, dialogs, removeDialog]
  );

  const alert = React.useCallback(
    (options: Omit<AlertDialogProps, 'open' | 'onClose'>) => {
      return createDialog<void>(
        <AlertDialog
          {...options}
          open={true}
          onClose={() => {
            const dialog = dialogs[dialogs.length - 1];
            if (dialog) {
              dialog.resolve(undefined);
              removeDialog(dialog.id);
            }
          }}
        />,
        undefined
      );
    },
    [createDialog, dialogs, removeDialog]
  );

  const dialog = React.useCallback(
    (options: Omit<DialogProps, 'open' | 'onClose'>) => {
      return createDialog<void>(
        <Dialog
          {...options}
          open={true}
          onClose={() => {
            const dialog = dialogs[dialogs.length - 1];
            if (dialog) {
              dialog.resolve(undefined);
              removeDialog(dialog.id);
            }
          }}
        />,
        undefined
      );
    },
    [createDialog, dialogs, removeDialog]
  );

  // Render all active dialogs
  const DialogProvider = React.useCallback(
    () => (
      <>
        {dialogs.map(d => (
          <React.Fragment key={d.id}>{d.component}</React.Fragment>
        ))}
      </>
    ),
    [dialogs]
  );

  return React.useMemo(
    () => ({
      confirm,
      alert,
      dialog,
      DialogProvider,
    }),
    [confirm, alert, dialog, DialogProvider]
  );
}

export default Dialog;
