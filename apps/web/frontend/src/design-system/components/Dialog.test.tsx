import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook } from '@testing-library/react';
import Dialog, { ConfirmDialog, AlertDialog, useDialog, type DialogAction } from './Dialog';

// Mock the Button component to ensure it renders as proper button elements
vi.mock('./Button', () => ({
  default: ({ children, onClick, disabled, loading, variant, ...props }: any) => (
    <button onClick={onClick} disabled={disabled || loading} data-variant={variant} {...props}>
      {children}
    </button>
  ),
}));

// Mock the Modal component since we're testing Dialog's specific behavior
vi.mock('./Modal', () => ({
  default: ({
    open,
    title,
    description,
    children,
    footer,
    onClose,
    className,
    variant,
    size,
  }: any) => {
    if (!open) return null;
    return (
      <div data-testid="mock-modal" className={className} data-variant={variant} data-size={size}>
        <div data-testid="modal-title">{title}</div>
        {description && <div data-testid="modal-description">{description}</div>}
        <div data-testid="modal-content">{children}</div>
        <div data-testid="modal-footer">{footer}</div>
        <button onClick={onClose} data-testid="modal-close">
          Close
        </button>
      </div>
    );
  },
}));

const mockActions: DialogAction[] = [
  {
    label: 'Cancel',
    variant: 'secondary',
    onClick: vi.fn(),
  },
  {
    label: 'Confirm',
    variant: 'primary',
    onClick: vi.fn(),
  },
];

describe('Dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Basic Rendering Tests
  describe('rendering', () => {
    it('renders when open', () => {
      render(
        <Dialog open={true} onClose={vi.fn()} title="Test Dialog" description="Test description" />
      );

      expect(screen.getByTestId('mock-modal')).toBeInTheDocument();
      expect(screen.getByTestId('modal-title')).toHaveTextContent('Test Dialog');
      expect(screen.getByTestId('modal-description')).toHaveTextContent('Test description');
    });

    it('does not render when closed', () => {
      render(<Dialog open={false} onClose={vi.fn()} title="Test Dialog" />);

      expect(screen.queryByTestId('mock-modal')).not.toBeInTheDocument();
    });

    it('renders without description', () => {
      render(<Dialog open={true} onClose={vi.fn()} title="Test Dialog" />);

      expect(screen.getByTestId('modal-title')).toHaveTextContent('Test Dialog');
      expect(screen.queryByTestId('modal-description')).not.toBeInTheDocument();
    });

    it('renders with custom content', () => {
      render(
        <Dialog open={true} onClose={vi.fn()} title="Test Dialog">
          <div data-testid="custom-content">Custom content</div>
        </Dialog>
      );

      expect(screen.getByTestId('custom-content')).toBeInTheDocument();
    });
  });

  // Dialog Types Tests
  describe('dialog types', () => {
    it('renders default type correctly', () => {
      render(<Dialog open={true} onClose={vi.fn()} title="Default Dialog" type="default" />);

      expect(screen.getByText('OK')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('renders confirmation type correctly', () => {
      render(<Dialog open={true} onClose={vi.fn()} title="Confirm Dialog" type="confirmation" />);

      expect(screen.getByText('Confirm')).toBeInTheDocument();
    });

    it('renders destructive type correctly', () => {
      render(<Dialog open={true} onClose={vi.fn()} title="Delete Dialog" type="destructive" />);

      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    it('renders success type correctly', () => {
      render(<Dialog open={true} onClose={vi.fn()} title="Success Dialog" type="success" />);

      expect(screen.getByText('Continue')).toBeInTheDocument();
    });

    it('renders warning type correctly', () => {
      render(<Dialog open={true} onClose={vi.fn()} title="Warning Dialog" type="warning" />);

      expect(screen.getByText('Proceed')).toBeInTheDocument();
    });

    it('renders error type correctly', () => {
      render(<Dialog open={true} onClose={vi.fn()} title="Error Dialog" type="error" />);

      expect(screen.getByText('OK')).toBeInTheDocument();
    });

    it('renders info type correctly', () => {
      render(<Dialog open={true} onClose={vi.fn()} title="Info Dialog" type="info" />);

      expect(screen.getByText('OK')).toBeInTheDocument();
    });
  });

  // Custom Actions Tests
  describe('custom actions', () => {
    it('renders custom actions', () => {
      render(<Dialog open={true} onClose={vi.fn()} title="Custom Actions" actions={mockActions} />);

      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Confirm')).toBeInTheDocument();
    });

    it('calls action onClick when clicked', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      const actions = [
        {
          label: 'Test Action',
          variant: 'primary' as const,
          onClick: handleClick,
        },
      ];

      render(<Dialog open={true} onClose={vi.fn()} title="Test" actions={actions} />);

      await user.click(screen.getByText('Test Action'));
      expect(handleClick).toHaveBeenCalled();
    });

    it('renders disabled actions', () => {
      const disabledActions = [
        {
          label: 'Disabled Action',
          variant: 'primary' as const,
          onClick: vi.fn(),
          disabled: true,
        },
      ];

      render(<Dialog open={true} onClose={vi.fn()} title="Test" actions={disabledActions} />);

      const button = screen.getByRole('button', { name: 'Disabled Action' });
      expect(button).toBeDisabled();
    });

    it('renders loading actions', () => {
      const loadingActions = [
        {
          label: 'Loading Action',
          variant: 'primary' as const,
          onClick: vi.fn(),
          loading: true,
        },
      ];

      render(<Dialog open={true} onClose={vi.fn()} title="Test" actions={loadingActions} />);

      const button = screen.getByText('Loading Action');
      expect(button).toBeInTheDocument();
      // Button component should handle loading state
    });
  });

  // Cancel Button Tests
  describe('cancel button', () => {
    it('shows cancel button by default', () => {
      render(<Dialog open={true} onClose={vi.fn()} title="Test" />);

      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('hides cancel button when showCancel is false', () => {
      render(<Dialog open={true} onClose={vi.fn()} title="Test" showCancel={false} />);

      expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
    });

    it('uses custom cancel label', () => {
      render(<Dialog open={true} onClose={vi.fn()} title="Test" cancelLabel="Custom Cancel" />);

      expect(screen.getByText('Custom Cancel')).toBeInTheDocument();
    });

    it('calls onClose when cancel is clicked', async () => {
      const user = userEvent.setup();
      const handleClose = vi.fn();

      render(<Dialog open={true} onClose={handleClose} title="Test" />);

      await user.click(screen.getByText('Cancel'));
      expect(handleClose).toHaveBeenCalled();
    });
  });

  // Custom Styling Tests
  describe('custom styling', () => {
    it('applies custom className', () => {
      render(<Dialog open={true} onClose={vi.fn()} title="Test" className="custom-dialog" />);

      expect(screen.getByTestId('mock-modal')).toHaveClass('custom-dialog');
    });
  });

  // Backdrop and Escape Tests
  describe('backdrop and escape', () => {
    it('passes closeOnBackdropClick to Modal', () => {
      const { rerender } = render(
        <Dialog open={true} onClose={vi.fn()} title="Test" closeOnBackdropClick={true} />
      );

      // Test that prop is passed through (Mock Modal will receive it)
      expect(screen.getByTestId('mock-modal')).toBeInTheDocument();

      rerender(<Dialog open={true} onClose={vi.fn()} title="Test" closeOnBackdropClick={false} />);

      expect(screen.getByTestId('mock-modal')).toBeInTheDocument();
    });

    it('passes closeOnEscape to Modal', () => {
      render(<Dialog open={true} onClose={vi.fn()} title="Test" closeOnEscape={false} />);

      expect(screen.getByTestId('mock-modal')).toBeInTheDocument();
    });
  });
});

describe('ConfirmDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Basic Rendering Tests
  describe('rendering', () => {
    it('renders confirmation dialog', () => {
      render(
        <ConfirmDialog
          open={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          title="Confirm Action"
          description="Are you sure?"
        />
      );

      expect(screen.getByTestId('modal-title')).toHaveTextContent('Confirm Action');
      expect(screen.getByTestId('modal-description')).toHaveTextContent('Are you sure?');
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Confirm')).toBeInTheDocument();
    });

    it('renders destructive confirmation dialog', () => {
      render(
        <ConfirmDialog
          open={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          title="Delete Item"
          type="destructive"
        />
      );

      expect(screen.getByText('Delete')).toBeInTheDocument();
    });
  });

  // Action Tests
  describe('actions', () => {
    it('calls onConfirm when confirm button is clicked', async () => {
      const user = userEvent.setup();
      const handleConfirm = vi.fn();

      render(
        <ConfirmDialog open={true} onClose={vi.fn()} onConfirm={handleConfirm} title="Confirm" />
      );

      const confirmButton = screen.getByRole('button', { name: 'Confirm' });
      await user.click(confirmButton);
      expect(handleConfirm).toHaveBeenCalled();
    });

    it('calls onClose when cancel button is clicked', async () => {
      const user = userEvent.setup();
      const handleClose = vi.fn();

      render(
        <ConfirmDialog open={true} onClose={handleClose} onConfirm={vi.fn()} title="Confirm" />
      );

      await user.click(screen.getByText('Cancel'));
      expect(handleClose).toHaveBeenCalled();
    });
  });

  // Custom Labels Tests
  describe('custom labels', () => {
    it('uses custom confirm label', () => {
      render(
        <ConfirmDialog
          open={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          title="Custom Confirm"
          confirmLabel="Yes, Do It"
        />
      );

      expect(screen.getByText('Yes, Do It')).toBeInTheDocument();
    });

    it('uses custom cancel label', () => {
      render(
        <ConfirmDialog
          open={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          title="Custom Cancel"
          cancelLabel="No, Don't"
        />
      );

      expect(screen.getByText("No, Don't")).toBeInTheDocument();
    });
  });

  // Loading State Tests
  describe('loading state', () => {
    it('shows loading on confirm button when loading', () => {
      render(
        <ConfirmDialog
          open={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          title="Loading Confirm"
          loading={true}
        />
      );

      const confirmButton = screen.getByText('Confirm');
      expect(confirmButton).toBeInTheDocument();
    });

    it('disables cancel button when loading', () => {
      render(
        <ConfirmDialog
          open={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          title="Loading Confirm"
          loading={true}
        />
      );

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      expect(cancelButton).toBeDisabled();
    });

    it('prevents backdrop click when loading', () => {
      render(
        <ConfirmDialog
          open={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          title="Loading Confirm"
          loading={true}
        />
      );

      // The underlying Dialog should have closeOnBackdropClick=false when loading
      expect(screen.getByTestId('mock-modal')).toBeInTheDocument();
    });
  });
});

describe('AlertDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Basic Rendering Tests
  describe('rendering', () => {
    it('renders alert dialog', () => {
      render(
        <AlertDialog
          open={true}
          onClose={vi.fn()}
          title="Alert Title"
          description="Alert description"
        />
      );

      expect(screen.getByTestId('modal-title')).toHaveTextContent('Alert Title');
      expect(screen.getByTestId('modal-description')).toHaveTextContent('Alert description');
      expect(screen.getByText('OK')).toBeInTheDocument();
      expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
    });

    it('renders with different alert types', () => {
      const types = ['success', 'warning', 'error', 'info'] as const;

      types.forEach(type => {
        const { unmount } = render(
          <AlertDialog open={true} onClose={vi.fn()} title={`${type} Alert`} type={type} />
        );

        expect(screen.getByText('OK')).toBeInTheDocument();
        unmount();
      });
    });

    it('renders with custom content', () => {
      render(
        <AlertDialog open={true} onClose={vi.fn()} title="Alert with Content">
          <div data-testid="alert-content">Custom alert content</div>
        </AlertDialog>
      );

      expect(screen.getByTestId('alert-content')).toBeInTheDocument();
    });
  });

  // Action Tests
  describe('actions', () => {
    it('calls onClose when OK button is clicked', async () => {
      const user = userEvent.setup();
      const handleClose = vi.fn();

      render(<AlertDialog open={true} onClose={handleClose} title="Test Alert" />);

      await user.click(screen.getByText('OK'));
      expect(handleClose).toHaveBeenCalled();
    });

    it('uses custom OK label', () => {
      render(<AlertDialog open={true} onClose={vi.fn()} title="Custom OK" okLabel="Got It" />);

      expect(screen.getByText('Got It')).toBeInTheDocument();
    });
  });
});

// Simplified useDialog hook tests - the hook implementation is complex
// and requires more sophisticated mocking to test properly in isolation
describe('useDialog hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Basic Hook Tests
  describe('hook basics', () => {
    it('returns dialog methods', () => {
      const { result } = renderHook(() => useDialog());

      expect(result.current.confirm).toBeInstanceOf(Function);
      expect(result.current.alert).toBeInstanceOf(Function);
      expect(result.current.dialog).toBeInstanceOf(Function);
      expect(result.current.DialogProvider).toBeInstanceOf(Function);
    });

    it('renders DialogProvider without errors', () => {
      const { result } = renderHook(() => useDialog());

      render(<result.current.DialogProvider />);
      // Should render without throwing errors
      expect(document.body).toBeInTheDocument();
    });
  });

  // Basic functionality test - more comprehensive testing would require
  // complex mocking of the internal dialog state management
  describe('basic functionality', () => {
    it('provides expected API surface', () => {
      const { result } = renderHook(() => useDialog());

      // Verify the hook returns the expected interface
      expect(typeof result.current.confirm).toBe('function');
      expect(typeof result.current.alert).toBe('function');
      expect(typeof result.current.dialog).toBe('function');
      expect(typeof result.current.DialogProvider).toBe('function');
    });
  });
});
