import userEvent from '@testing-library/user-event';
import { CheckCircle } from 'lucide-react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '../../test/utils';
import Toast, { ToastContainer, ToastManager, toast } from './Toast';

describe('Toast', () => {
  // Basic Rendering Tests
  describe('rendering', () => {
    it('renders without crashing', () => {
      render(<Toast title="Test Toast" />);
      expect(screen.getByText('Test Toast')).toBeInTheDocument();
    });

    it('renders title correctly', () => {
      render(<Toast title="Toast Title" />);
      expect(screen.getByText('Toast Title')).toBeInTheDocument();
    });

    it('renders with description', () => {
      render(<Toast title="Title" description="Toast description" />);
      expect(screen.getByText('Toast description')).toBeInTheDocument();
    });

    it('does not render when visible is false', () => {
      render(<Toast title="Hidden Toast" visible={false} />);
      expect(screen.queryByText('Hidden Toast')).not.toBeInTheDocument();
    });
  });

  // Variant Tests
  describe('variants', () => {
    it('renders success variant correctly', () => {
      render(<Toast variant="success" title="Success" />);
      expect(screen.getByText('Success')).toBeInTheDocument();
    });

    it('renders error variant correctly', () => {
      render(<Toast variant="error" title="Error" />);
      expect(screen.getByText('Error')).toBeInTheDocument();
    });

    it('renders warning variant correctly', () => {
      render(<Toast variant="warning" title="Warning" />);
      expect(screen.getByText('Warning')).toBeInTheDocument();
    });

    it('renders info variant correctly (default)', () => {
      render(<Toast title="Info" />);
      expect(screen.getByText('Info')).toBeInTheDocument();
    });

    it('renders loading variant correctly', () => {
      render(<Toast variant="loading" title="Loading" />);
      expect(screen.getByText('Loading')).toBeInTheDocument();
    });

    it('renders neutral variant correctly', () => {
      render(<Toast variant="neutral" title="Neutral" />);
      expect(screen.getByText('Neutral')).toBeInTheDocument();
    });
  });

  // Icon Tests
  describe('icons', () => {
    it('uses custom icon when provided', () => {
      render(<Toast title="Custom Icon" icon={<CheckCircle data-testid="custom-icon" />} />);
      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });
  });

  // Close Button Tests
  describe('close button', () => {
    it('shows close button by default', () => {
      render(<Toast title="Closable" />);
      const closeButton = screen.getByLabelText('Close notification');
      expect(closeButton).toBeInTheDocument();
    });

    it('hides close button when closable is false', () => {
      render(<Toast title="Not Closable" closable={false} />);
      expect(screen.queryByLabelText('Close notification')).not.toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', async () => {
      const handleClose = vi.fn();
      const user = userEvent.setup();

      render(<Toast title="Close Test" onClose={handleClose} />);

      const closeButton = screen.getByLabelText('Close notification');
      await user.click(closeButton);

      expect(handleClose).toHaveBeenCalled();
    });
  });

  // Action Tests
  describe('actions', () => {
    it('renders action content', () => {
      const action = <button data-testid="action">Retry</button>;
      render(<Toast title="With Action" action={action} />);

      expect(screen.getByTestId('action')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('action is clickable', async () => {
      const handleActionClick = vi.fn();
      const user = userEvent.setup();

      const action = (
        <button data-testid="action" onClick={handleActionClick}>
          Action
        </button>
      );
      render(<Toast title="Action Click" action={action} />);

      const actionButton = screen.getByTestId('action');
      await user.click(actionButton);

      expect(handleActionClick).toHaveBeenCalled();
    });
  });

  // Custom Styling Tests
  describe('custom styling', () => {
    it('applies custom className', () => {
      render(<Toast title="Custom Class" className="custom-toast" visible={true} />);

      // Since Toast uses createPortal, the className is applied to the portal element
      // In our test setup, let's check if the toast is rendered in document.body
      const toastElement = document.body.querySelector('.custom-toast');
      expect(toastElement).toBeInTheDocument();
    });
  });

  // Edge Cases
  describe('edge cases', () => {
    it('handles empty title gracefully', () => {
      render(<Toast title="" />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('handles visibility changes', () => {
      const { rerender } = render(<Toast title="Visibility Test" visible={true} />);
      expect(screen.getByText('Visibility Test')).toBeInTheDocument();

      rerender(<Toast title="Visibility Test" visible={false} />);
      expect(screen.queryByText('Visibility Test')).not.toBeInTheDocument();
    });
  });
});

describe('ToastContainer', () => {
  const mockToasts = [
    { id: '1', title: 'First Toast', variant: 'success' as const },
    { id: '2', title: 'Second Toast', variant: 'error' as const },
    { id: '3', title: 'Third Toast', variant: 'info' as const },
  ];

  // Basic Rendering Tests
  describe('rendering', () => {
    it('renders without crashing', () => {
      render(<ToastContainer />);
      expect(screen.getByLabelText('Notifications')).toBeInTheDocument();
    });

    it('renders all provided toasts', () => {
      render(<ToastContainer toasts={mockToasts} />);

      expect(screen.getByText('First Toast')).toBeInTheDocument();
      expect(screen.getByText('Second Toast')).toBeInTheDocument();
      expect(screen.getByText('Third Toast')).toBeInTheDocument();
    });

    it('limits toasts to specified limit', () => {
      const manyToasts = [
        ...mockToasts,
        { id: '4', title: 'Fourth Toast' },
        { id: '5', title: 'Fifth Toast' },
        { id: '6', title: 'Sixth Toast' },
      ];

      render(<ToastContainer toasts={manyToasts} limit={3} />);

      expect(screen.getByText('First Toast')).toBeInTheDocument();
      expect(screen.getByText('Second Toast')).toBeInTheDocument();
      expect(screen.getByText('Third Toast')).toBeInTheDocument();
      expect(screen.queryByText('Fourth Toast')).not.toBeInTheDocument();
    });

    it('has proper accessibility attributes', () => {
      render(<ToastContainer toasts={mockToasts} />);
      const container = screen.getByLabelText('Notifications');
      expect(container).toHaveAttribute('aria-live', 'polite');
      expect(container).toHaveAttribute('aria-label', 'Notifications');
    });
  });
});

describe('ToastManager', () => {
  let manager: ToastManager;

  beforeEach(() => {
    manager = new ToastManager();
  });

  // Basic Functionality Tests
  describe('basic functionality', () => {
    it('creates manager instance', () => {
      expect(manager).toBeInstanceOf(ToastManager);
    });

    it('starts with empty toasts', () => {
      expect(manager.getToasts()).toHaveLength(0);
    });

    it('shows a toast', () => {
      manager.show({ title: 'Test Toast' });

      expect(manager.getToasts()).toHaveLength(1);
      expect(manager.getToasts()[0]!.title).toBe('Test Toast');
    });

    it('hides a toast', () => {
      const id = manager.show({ title: 'Test Toast' });
      expect(manager.getToasts()).toHaveLength(1);

      manager.hide(id);
      expect(manager.getToasts()).toHaveLength(0);
    });

    it('clears all toasts', () => {
      manager.show({ title: 'Toast 1' });
      manager.show({ title: 'Toast 2' });
      expect(manager.getToasts()).toHaveLength(2);

      manager.clear();
      expect(manager.getToasts()).toHaveLength(0);
    });
  });

  // Subscription Tests
  describe('subscriptions', () => {
    it('notifies subscribers when toasts change', () => {
      const callback = vi.fn();

      manager.subscribe(callback);
      manager.show({ title: 'Test' });

      expect(callback).toHaveBeenCalled();
    });

    it('unsubscribes correctly', () => {
      const callback = vi.fn();

      const unsubscribe = manager.subscribe(callback);
      unsubscribe();

      manager.show({ title: 'Test' });
      expect(callback).not.toHaveBeenCalled();
    });
  });

  // Convenience Methods Tests
  describe('convenience methods', () => {
    it('creates success toast', () => {
      manager.success('Success!', 'Operation completed');
      expect(manager.getToasts()).toHaveLength(1);
      const toast = manager.getToasts()[0]!;

      expect(toast.variant).toBe('success');
      expect(toast.title).toBe('Success!');
      expect(toast.description).toBe('Operation completed');
    });

    it('creates error toast', () => {
      manager.error('Error!', 'Something went wrong');
      expect(manager.getToasts()).toHaveLength(1);
      const toast = manager.getToasts()[0]!;

      expect(toast.variant).toBe('error');
      expect(toast.title).toBe('Error!');
      expect(toast.description).toBe('Something went wrong');
    });

    it('creates warning toast', () => {
      manager.warning('Warning!', 'Please be careful');
      expect(manager.getToasts()).toHaveLength(1);
      const toast = manager.getToasts()[0]!;

      expect(toast.variant).toBe('warning');
      expect(toast.title).toBe('Warning!');
      expect(toast.description).toBe('Please be careful');
    });

    it('creates info toast', () => {
      manager.info('Info', 'Helpful information');
      expect(manager.getToasts()).toHaveLength(1);
      const toastItem = manager.getToasts()[0]!;

      expect(toastItem.variant).toBe('info');
      expect(toastItem.title).toBe('Info');
      expect(toastItem.description).toBe('Helpful information');
    });

    it('creates loading toast with duration 0', () => {
      manager.loading('Loading...', 'Please wait');
      expect(manager.getToasts()).toHaveLength(1);
      const toast = manager.getToasts()[0]!;

      expect(toast.variant).toBe('loading');
      expect(toast.title).toBe('Loading...');
      expect(toast.description).toBe('Please wait');
      expect(toast.duration).toBe(0);
    });
  });

  // Toast ID Generation Tests
  describe('ID generation', () => {
    it('generates unique IDs automatically', () => {
      const id1 = manager.show({ title: 'Toast 1' });
      const id2 = manager.show({ title: 'Toast 2' });

      expect(id1).not.toBe(id2);
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
    });

    it('uses provided ID when given', () => {
      const customId = 'custom-toast-id';
      const id = manager.show({ id: customId, title: 'Custom ID Toast' });

      expect(id).toBe(customId);
    });
  });
});

describe('Global toast instance', () => {
  beforeEach(() => {
    // Clear any existing toasts
    toast.clear();
  });

  it('provides global toast instance', () => {
    expect(toast!).toBeInstanceOf(ToastManager);
  });

  it('works with global instance', () => {
    const id = toast!.success('Global Success!');
    expect(toast!.getToasts()).toHaveLength(1);
    expect(toast!.getToasts()[0]!.title).toBe('Global Success!');

    toast!.hide(id);
    expect(toast!.getToasts()).toHaveLength(0);
  });

  it('convenience methods work on global instance', () => {
    toast!.error('Global Error');
    toast!.warning('Global Warning');
    toast!.info('Global Info');

    expect(toast!.getToasts()).toHaveLength(3);

    toast!.clear();
    expect(toast!.getToasts()).toHaveLength(0);
  });
});
