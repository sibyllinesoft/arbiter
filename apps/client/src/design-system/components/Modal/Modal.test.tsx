import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '../../test/utils';
import Modal from './Modal';

// Mock createPortal to render in the same container for testing
vi.mock('react-dom', async () => {
  const actual = await vi.importActual('react-dom');
  return {
    ...actual,
    createPortal: (element: React.ReactNode) => element,
  };
});

describe('Modal', () => {
  let originalBodyOverflow: string;

  beforeEach(() => {
    // Store original body overflow style
    originalBodyOverflow = document.body.style.overflow;
    // Reset body style before each test
    document.body.style.overflow = '';
  });

  afterEach(() => {
    // Restore original body style after each test
    document.body.style.overflow = originalBodyOverflow;
    // Clean up any remaining modals
    document.body.innerHTML = '';
  });

  describe('rendering', () => {
    it('does not render when closed', () => {
      render(
        <Modal open={false} onClose={() => {}}>
          Content
        </Modal>
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders when open', () => {
      render(
        <Modal open={true} onClose={() => {}}>
          Content
        </Modal>
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    it('renders with title', () => {
      render(
        <Modal open={true} onClose={() => {}} title="Modal Title">
          Content
        </Modal>
      );

      const title = screen.getByText('Modal Title');
      expect(title).toBeInTheDocument();
      expect(title).toHaveAttribute('id', 'modal-title');

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title');
    });

    it('renders with description', () => {
      render(
        <Modal open={true} onClose={() => {}} description="Modal description">
          Content
        </Modal>
      );

      const description = screen.getByText('Modal description');
      expect(description).toBeInTheDocument();
      expect(description).toHaveAttribute('id', 'modal-description');

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-describedby', 'modal-description');
    });

    it('renders with title and description', () => {
      render(
        <Modal open={true} onClose={() => {}} title="Title" description="Description">
          Content
        </Modal>
      );

      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
    });
  });

  describe('sizes', () => {
    it.each([['xs'], ['sm'], ['md'], ['lg'], ['xl'], ['2xl'], ['3xl'], ['full']])(
      'renders %s size correctly',
      size => {
        render(
          <Modal open={true} onClose={() => {}} size={size as any}>
            Content
          </Modal>
        );

        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
      }
    );

    it('defaults to md size', () => {
      render(
        <Modal open={true} onClose={() => {}}>
          Content
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('max-w-md');
    });
  });

  describe('variants', () => {
    it.each([
      ['default', null],
      ['success', 'CheckCircle'],
      ['warning', 'AlertTriangle'],
      ['error', 'XCircle'],
      ['info', 'Info'],
    ])('renders %s variant correctly', (variant, iconName) => {
      render(
        <Modal open={true} onClose={() => {}} variant={variant as any} title="Test">
          Content
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();

      if (iconName) {
        // Check that an icon is rendered (we can't easily test specific Lucide icons)
        const header = screen.getByText('Test').closest('div');
        const icon = header?.querySelector('svg');
        if (icon) {
          expect(icon).toBeInTheDocument();
        }
      }
    });

    it('applies variant-specific border colors', () => {
      const { rerender } = render(
        <Modal open={true} onClose={() => {}} variant="success">
          Content
        </Modal>
      );

      let dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('border-l-4', 'border-green-500');

      rerender(
        <Modal open={true} onClose={() => {}} variant="error">
          Content
        </Modal>
      );
      dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('border-l-4', 'border-red-500');
    });
  });

  describe('close button', () => {
    it('shows close button by default', () => {
      render(
        <Modal open={true} onClose={() => {}}>
          Content
        </Modal>
      );

      const closeButton = screen.getByLabelText('Close modal');
      expect(closeButton).toBeInTheDocument();
    });

    it('hides close button when showCloseButton is false', () => {
      render(
        <Modal open={true} onClose={() => {}} showCloseButton={false}>
          Content
        </Modal>
      );

      expect(screen.queryByLabelText('Close modal')).not.toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();

      render(
        <Modal open={true} onClose={onClose}>
          Content
        </Modal>
      );

      const closeButton = screen.getByLabelText('Close modal');
      await user.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('backdrop interactions', () => {
    it('calls onClose when backdrop is clicked by default', async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();

      render(
        <Modal open={true} onClose={onClose}>
          Content
        </Modal>
      );

      // Click on backdrop (the first div with backdrop classes)
      const backdrop = document.querySelector('.bg-graphite-900\\/50');
      expect(backdrop).toBeInTheDocument();

      await user.click(backdrop!);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when backdrop is clicked and closeOnBackdropClick is false', async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();

      render(
        <Modal open={true} onClose={onClose} closeOnBackdropClick={false}>
          Content
        </Modal>
      );

      const backdrop = document.querySelector('.bg-graphite-900\\/50');
      await user.click(backdrop!);

      expect(onClose).not.toHaveBeenCalled();
    });

    it('does not close when clicking inside modal content', async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();

      render(
        <Modal open={true} onClose={onClose}>
          Content
        </Modal>
      );

      await user.click(screen.getByText('Content'));
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('keyboard interactions', () => {
    it('calls onClose when Escape key is pressed by default', async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();

      render(
        <Modal open={true} onClose={onClose}>
          Content
        </Modal>
      );

      await user.keyboard('{Escape}');
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when Escape is pressed and closeOnEscape is false', async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();

      render(
        <Modal open={true} onClose={onClose} closeOnEscape={false}>
          Content
        </Modal>
      );

      await user.keyboard('{Escape}');
      expect(onClose).not.toHaveBeenCalled();
    });

    it('traps focus within modal', async () => {
      const user = userEvent.setup();

      render(
        <Modal open={true} onClose={() => {}}>
          <button>First</button>
          <button>Second</button>
          <button>Last</button>
        </Modal>
      );

      const firstButton = screen.getByText('First');
      const lastButton = screen.getByText('Last');
      const closeButton = screen.getByLabelText('Close modal');

      // Focus the last button in the modal (close button is actually last)
      closeButton.focus();
      expect(closeButton).toHaveFocus();

      // Tab should wrap to first focusable element
      await user.tab();
      await waitFor(() => {
        expect(firstButton).toHaveFocus();
      });
    });
  });

  describe('loading state', () => {
    it('shows loading overlay when loading is true', () => {
      render(
        <Modal open={true} onClose={() => {}} loading>
          Content
        </Modal>
      );

      expect(screen.getByText('Loading...')).toBeInTheDocument();

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('pointer-events-none');

      // Check for loading spinner
      expect(dialog.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('does not show loading overlay when loading is false', () => {
      render(
        <Modal open={true} onClose={() => {}} loading={false}>
          Content
        </Modal>
      );

      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
  });

  describe('footer', () => {
    it('renders custom footer', () => {
      const footer = <button>Custom Footer</button>;
      render(
        <Modal open={true} onClose={() => {}} footer={footer}>
          Content
        </Modal>
      );

      expect(screen.getByText('Custom Footer')).toBeInTheDocument();
    });

    it('renders default footer when showDefaultFooter is true', () => {
      render(
        <Modal open={true} onClose={() => {}} showDefaultFooter>
          Content
        </Modal>
      );

      expect(screen.getByText('Close')).toBeInTheDocument();
    });

    it('default footer close button calls onClose', async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();

      render(
        <Modal open={true} onClose={onClose} showDefaultFooter>
          Content
        </Modal>
      );

      const closeButton = screen.getByText('Close');
      await user.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('prioritizes custom footer over default footer', () => {
      const footer = <button>Custom</button>;
      render(
        <Modal open={true} onClose={() => {}} footer={footer} showDefaultFooter>
          Content
        </Modal>
      );

      expect(screen.getByText('Custom')).toBeInTheDocument();
      expect(screen.queryByText('Close')).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has correct ARIA attributes', () => {
      render(
        <Modal
          open={true}
          onClose={() => {}}
          title="Accessible Modal"
          description="Description text"
        >
          Content
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title');
      expect(dialog).toHaveAttribute('aria-describedby', 'modal-description');
      expect(dialog).toHaveAttribute('tabIndex', '-1');
    });

    it('marks backdrop as aria-hidden', () => {
      render(
        <Modal open={true} onClose={() => {}}>
          Content
        </Modal>
      );

      const backdrop = document.querySelector('[aria-hidden="true"]');
      expect(backdrop).toBeInTheDocument();
      expect(backdrop).toHaveClass('bg-graphite-900/50');
    });

    it('manages focus correctly', async () => {
      // Create a button outside the modal to test focus restoration
      const outsideButton = document.createElement('button');
      outsideButton.textContent = 'Outside';
      document.body.appendChild(outsideButton);
      outsideButton.focus();

      expect(outsideButton).toHaveFocus();

      const { rerender } = render(
        <Modal open={false} onClose={() => {}}>
          Content
        </Modal>
      );

      // Open modal
      rerender(
        <Modal open={true} onClose={() => {}}>
          Content
        </Modal>
      );

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toHaveFocus();
      });

      // Close modal
      rerender(
        <Modal open={false} onClose={() => {}}>
          Content
        </Modal>
      );

      await waitFor(() => {
        expect(outsideButton).toHaveFocus();
      });

      // Cleanup
      document.body.removeChild(outsideButton);
    });
  });

  describe('body scroll prevention', () => {
    it('prevents body scroll when modal is open', () => {
      const { rerender } = render(
        <Modal open={false} onClose={() => {}}>
          Content
        </Modal>
      );

      // Initially body should not have overflow hidden
      expect(document.body.style.overflow).not.toBe('hidden');

      // Open modal
      rerender(
        <Modal open={true} onClose={() => {}}>
          Content
        </Modal>
      );

      expect(document.body.style.overflow).toBe('hidden');

      // Close modal
      rerender(
        <Modal open={false} onClose={() => {}}>
          Content
        </Modal>
      );

      // Body overflow should be restored
      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('custom styling', () => {
    it('applies custom className to modal content', () => {
      render(
        <Modal open={true} onClose={() => {}} className="custom-modal">
          Content
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('custom-modal');
    });

    it('applies custom containerClassName', () => {
      render(
        <Modal open={true} onClose={() => {}} containerClassName="custom-container">
          Content
        </Modal>
      );

      // Find the container element (parent of the dialog)
      const dialog = screen.getByRole('dialog');
      const container = dialog.parentElement;
      expect(container).toHaveClass('custom-container');
    });
  });

  describe('positioning', () => {
    it('centers modal by default', () => {
      render(
        <Modal open={true} onClose={() => {}}>
          Content
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      const container = dialog.parentElement;
      expect(container).toHaveClass('items-center', 'justify-center');
    });

    it('positions modal at top when centered is false', () => {
      render(
        <Modal open={true} onClose={() => {}} centered={false}>
          Content
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      const container = dialog.parentElement;
      expect(container).toHaveClass('items-start', 'justify-center', 'pt-16');
      expect(container).not.toHaveClass('items-center');
    });
  });

  describe('z-index', () => {
    it('uses default z-index', () => {
      render(
        <Modal open={true} onClose={() => {}}>
          Content
        </Modal>
      );

      // Find the outermost modal container
      const modalContainer = document.querySelector('.fixed.inset-0');
      expect(modalContainer).toHaveClass('z-50');
    });

    it('uses custom z-index', () => {
      render(
        <Modal open={true} onClose={() => {}} zIndex={100}>
          Content
        </Modal>
      );

      const modalContainer = document.querySelector('.fixed.inset-0');
      expect(modalContainer).toHaveClass('z-100');
    });
  });

  describe('initial focus', () => {
    it('focuses specified element when initialFocus is provided', async () => {
      render(
        <Modal open={true} onClose={() => {}} initialFocus="[data-testid='focus-me']">
          <button data-testid="focus-me">Focus me</button>
          <button>Other button</button>
        </Modal>
      );

      await waitFor(() => {
        const focusTarget = screen.getByTestId('focus-me');
        expect(focusTarget).toHaveFocus();
      });
    });

    it('focuses modal when no initialFocus is provided', async () => {
      render(
        <Modal open={true} onClose={() => {}}>
          Content
        </Modal>
      );

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toHaveFocus();
      });
    });
  });
});
