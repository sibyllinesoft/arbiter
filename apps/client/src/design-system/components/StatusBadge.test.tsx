import { AlertTriangle, CheckCircle, Clock, Info, XCircle } from 'lucide-react';
import React from 'react';
import { render, screen } from '../../test/utils';
import StatusBadge from './StatusBadge';

describe('StatusBadge', () => {
  // Basic Rendering Tests
  describe('rendering', () => {
    it('renders without crashing', () => {
      render(<StatusBadge>Test Badge</StatusBadge>);
      expect(screen.getByText('Test Badge')).toBeInTheDocument();
    });

    it('renders children content', () => {
      render(<StatusBadge>Custom Content</StatusBadge>);
      expect(screen.getByText('Custom Content')).toBeInTheDocument();
    });

    it('renders as a span element', () => {
      const { container } = render(<StatusBadge>Test</StatusBadge>);
      const badge = container.querySelector('span');
      expect(badge).toBeInTheDocument();
    });

    it('has base badge classes', () => {
      const { container } = render(<StatusBadge>Test</StatusBadge>);
      const badge = container.firstChild;
      expect(badge).toHaveClass(
        'inline-flex',
        'items-center',
        'font-medium',
        'rounded-full',
        'border'
      );
    });
  });

  // Size Tests
  describe('sizes', () => {
    it('renders extra small size correctly', () => {
      const { container } = render(<StatusBadge size="xs">XS Badge</StatusBadge>);
      const badge = container.firstChild;
      expect(badge).toHaveClass('px-2', 'py-0.5', 'text-xs', 'gap-1');
    });

    it('renders small size correctly (default)', () => {
      const { container } = render(<StatusBadge>SM Badge</StatusBadge>);
      const badge = container.firstChild;
      expect(badge).toHaveClass('px-2.5', 'py-1', 'text-xs', 'gap-1.5');
    });

    it('renders medium size correctly', () => {
      const { container } = render(<StatusBadge size="md">MD Badge</StatusBadge>);
      const badge = container.firstChild;
      expect(badge).toHaveClass('px-3', 'py-1.5', 'text-sm', 'gap-2');
    });

    it('renders large size correctly', () => {
      const { container } = render(<StatusBadge size="lg">LG Badge</StatusBadge>);
      const badge = container.firstChild;
      expect(badge).toHaveClass('px-4', 'py-2', 'text-base', 'gap-2');
    });
  });

  // Variant Tests
  describe('variants', () => {
    it('renders neutral variant correctly (default)', () => {
      const { container } = render(<StatusBadge>Neutral</StatusBadge>);
      const badge = container.firstChild;
      expect(badge).toHaveClass('bg-graphite-50', 'border-graphite-200', 'text-graphite-700');
    });

    it('renders success variant correctly', () => {
      const { container } = render(<StatusBadge variant="success">Success</StatusBadge>);
      const badge = container.firstChild;
      expect(badge).toHaveClass('bg-emerald-50', 'border-emerald-200', 'text-emerald-700');
    });

    it('renders warning variant correctly', () => {
      const { container } = render(<StatusBadge variant="warning">Warning</StatusBadge>);
      const badge = container.firstChild;
      expect(badge).toHaveClass('bg-amber-50', 'border-amber-200', 'text-amber-700');
    });

    it('renders error variant correctly', () => {
      const { container } = render(<StatusBadge variant="error">Error</StatusBadge>);
      const badge = container.firstChild;
      expect(badge).toHaveClass('bg-red-50', 'border-red-200', 'text-red-700');
    });

    it('renders info variant correctly', () => {
      const { container } = render(<StatusBadge variant="info">Info</StatusBadge>);
      const badge = container.firstChild;
      expect(badge).toHaveClass('bg-blue-50', 'border-blue-200', 'text-blue-700');
    });

    it('renders pending variant correctly', () => {
      const { container } = render(<StatusBadge variant="pending">Pending</StatusBadge>);
      const badge = container.firstChild;
      expect(badge).toHaveClass('bg-amber-50', 'border-amber-200', 'text-amber-700');
    });

    it('renders active variant correctly', () => {
      const { container } = render(<StatusBadge variant="active">Active</StatusBadge>);
      const badge = container.firstChild;
      expect(badge).toHaveClass('bg-green-50', 'border-green-200', 'text-green-700');
    });

    it('renders inactive variant correctly', () => {
      const { container } = render(<StatusBadge variant="inactive">Inactive</StatusBadge>);
      const badge = container.firstChild;
      expect(badge).toHaveClass('bg-graphite-50', 'border-graphite-200', 'text-graphite-600');
    });
  });

  // Style Tests
  describe('styles', () => {
    it('renders solid style correctly (default)', () => {
      const { container } = render(<StatusBadge variant="success">Solid</StatusBadge>);
      const badge = container.firstChild;
      expect(badge).toHaveClass('bg-emerald-50', 'border-emerald-200', 'text-emerald-700');
    });

    it('renders outlined style correctly', () => {
      const { container } = render(
        <StatusBadge variant="success" style="outlined">
          Outlined
        </StatusBadge>
      );
      const badge = container.firstChild;
      expect(badge).toHaveClass(
        'bg-transparent',
        'border-2',
        'border-emerald-200',
        'text-emerald-700'
      );
    });

    it('renders subtle style correctly', () => {
      const { container } = render(
        <StatusBadge variant="success" style="subtle">
          Subtle
        </StatusBadge>
      );
      const badge = container.firstChild;
      expect(badge).toHaveClass('bg-emerald-50', 'border-transparent', 'text-emerald-700');
    });

    it('fallback to solid style for invalid style', () => {
      const { container } = render(
        <StatusBadge variant="success" style={'invalid' as any}>
          Invalid
        </StatusBadge>
      );
      const badge = container.firstChild;
      expect(badge).toHaveClass('bg-emerald-50', 'border-emerald-200', 'text-emerald-700');
    });
  });

  // Dot Indicator Tests
  describe('dot indicator', () => {
    it('does not show dot by default', () => {
      const { container } = render(<StatusBadge>No Dot</StatusBadge>);
      const dot = container.querySelector('span.rounded-full.flex-shrink-0:not(.border-2)');
      expect(dot).not.toBeInTheDocument();
    });

    it('shows dot when showDot is true', () => {
      const { container } = render(<StatusBadge showDot>With Dot</StatusBadge>);
      const dot = container.querySelector('span.rounded-full.flex-shrink-0:not(.border-2)');
      expect(dot).toBeInTheDocument();
    });

    it('applies correct dot size for different badge sizes', () => {
      // XS size
      const { container: xsContainer } = render(
        <StatusBadge size="xs" showDot>
          XS
        </StatusBadge>
      );
      const xsDot = xsContainer.querySelector('.h-1\\.5.w-1\\.5');
      expect(xsDot).toBeInTheDocument();

      // SM size (default)
      const { container: smContainer } = render(<StatusBadge showDot>SM</StatusBadge>);
      const smDot = smContainer.querySelector('.h-2.w-2');
      expect(smDot).toBeInTheDocument();

      // MD size
      const { container: mdContainer } = render(
        <StatusBadge size="md" showDot>
          MD
        </StatusBadge>
      );
      const mdDot = mdContainer.querySelector('.h-2\\.5.w-2\\.5');
      expect(mdDot).toBeInTheDocument();

      // LG size
      const { container: lgContainer } = render(
        <StatusBadge size="lg" showDot>
          LG
        </StatusBadge>
      );
      const lgDot = lgContainer.querySelector('.h-3.w-3');
      expect(lgDot).toBeInTheDocument();
    });

    it('applies correct dot color based on variant', () => {
      const { container } = render(
        <StatusBadge variant="success" showDot>
          Success
        </StatusBadge>
      );
      const dot = container.querySelector('.bg-emerald-500');
      expect(dot).toBeInTheDocument();
    });

    it('adds pulse animation when pulse is true', () => {
      const { container } = render(
        <StatusBadge showDot pulse>
          Pulsing
        </StatusBadge>
      );
      const dot = container.querySelector('.animate-pulse');
      expect(dot).toBeInTheDocument();
    });

    it('does not add pulse animation when pulse is false', () => {
      const { container } = render(
        <StatusBadge showDot pulse={false}>
          No Pulse
        </StatusBadge>
      );
      const dot = container.querySelector('.animate-pulse');
      expect(dot).not.toBeInTheDocument();
    });
  });

  // Icon Tests
  describe('icon', () => {
    it('renders custom icon when provided', () => {
      render(<StatusBadge icon={<CheckCircle data-testid="check-icon" />}>With Icon</StatusBadge>);
      expect(screen.getByTestId('check-icon')).toBeInTheDocument();
    });

    it('icon overrides dot indicator', () => {
      const { container } = render(
        <StatusBadge icon={<CheckCircle data-testid="check-icon" />} showDot>
          Icon Override
        </StatusBadge>
      );

      expect(screen.getByTestId('check-icon')).toBeInTheDocument();
      const dot = container.querySelector('span.rounded-full.flex-shrink-0:not(.border-2)');
      expect(dot).not.toBeInTheDocument();
    });

    it('applies correct icon size for different badge sizes', () => {
      // XS size
      const { container: xsContainer } = render(
        <StatusBadge size="xs" icon={<CheckCircle />}>
          XS Icon
        </StatusBadge>
      );
      const xsIcon = xsContainer.querySelector('.h-3.w-3');
      expect(xsIcon).toBeInTheDocument();

      // SM size (default)
      const { container: smContainer } = render(
        <StatusBadge icon={<CheckCircle />}>SM Icon</StatusBadge>
      );
      const smIcon = smContainer.querySelector('.h-3\\.5.w-3\\.5');
      expect(smIcon).toBeInTheDocument();

      // MD size
      const { container: mdContainer } = render(
        <StatusBadge size="md" icon={<CheckCircle />}>
          MD Icon
        </StatusBadge>
      );
      const mdIcon = mdContainer.querySelector('.h-4.w-4');
      expect(mdIcon).toBeInTheDocument();

      // LG size
      const { container: lgContainer } = render(
        <StatusBadge size="lg" icon={<CheckCircle />}>
          LG Icon
        </StatusBadge>
      );
      const lgIcon = lgContainer.querySelector('.h-5.w-5');
      expect(lgIcon).toBeInTheDocument();
    });

    it('applies correct icon color based on variant', () => {
      const { container } = render(
        <StatusBadge variant="error" icon={<XCircle />}>
          Error Icon
        </StatusBadge>
      );
      const iconWrapper = container.querySelector('.text-red-500');
      expect(iconWrapper).toBeInTheDocument();
    });
  });

  // Loading State Tests
  describe('loading state', () => {
    it('shows loading spinner when loading is true', () => {
      const { container } = render(<StatusBadge loading>Loading</StatusBadge>);
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('loading spinner overrides icon and dot', () => {
      const { container } = render(
        <StatusBadge loading icon={<CheckCircle data-testid="check-icon" />} showDot>
          Loading Override
        </StatusBadge>
      );

      expect(container.querySelector('.animate-spin')).toBeInTheDocument();
      expect(screen.queryByTestId('check-icon')).not.toBeInTheDocument();

      // Should not have a regular dot (only the spinner which is a div)
      const regularDot = container.querySelector('span.rounded-full.flex-shrink-0:not(.border-2)');
      expect(regularDot).not.toBeInTheDocument();
    });

    it('applies opacity when loading', () => {
      const { container } = render(<StatusBadge loading>Loading</StatusBadge>);
      const badge = container.firstChild;
      expect(badge).toHaveClass('opacity-75');
    });

    it('spinner has correct size for different badge sizes', () => {
      // XS size
      const { container: xsContainer } = render(
        <StatusBadge size="xs" loading>
          XS Loading
        </StatusBadge>
      );
      const xsSpinner = xsContainer.querySelector('.h-1\\.5.w-1\\.5');
      expect(xsSpinner).toBeInTheDocument();

      // SM size (default)
      const { container: smContainer } = render(<StatusBadge loading>SM Loading</StatusBadge>);
      const smSpinner = smContainer.querySelector('.h-2.w-2');
      expect(smSpinner).toBeInTheDocument();

      // MD size
      const { container: mdContainer } = render(
        <StatusBadge size="md" loading>
          MD Loading
        </StatusBadge>
      );
      const mdSpinner = mdContainer.querySelector('.h-2\\.5.w-2\\.5');
      expect(mdSpinner).toBeInTheDocument();

      // LG size
      const { container: lgContainer } = render(
        <StatusBadge size="lg" loading>
          LG Loading
        </StatusBadge>
      );
      const lgSpinner = lgContainer.querySelector('.h-3.w-3');
      expect(lgSpinner).toBeInTheDocument();
    });

    it('spinner has current color border styling', () => {
      const { container } = render(<StatusBadge loading>Loading</StatusBadge>);
      const spinner = container.querySelector('.border-current.border-t-transparent');
      expect(spinner).toBeInTheDocument();
    });
  });

  // Custom Styling Tests
  describe('custom styling', () => {
    it('applies custom className', () => {
      const { container } = render(<StatusBadge className="custom-badge">Custom</StatusBadge>);
      const badge = container.firstChild;
      expect(badge).toHaveClass('custom-badge');
    });

    it('custom className does not override base classes', () => {
      const { container } = render(<StatusBadge className="custom-badge">Custom</StatusBadge>);
      const badge = container.firstChild;
      expect(badge).toHaveClass('custom-badge', 'inline-flex', 'items-center', 'rounded-full');
    });
  });

  // Accessibility Tests
  describe('accessibility', () => {
    it('has proper text content for screen readers', () => {
      render(<StatusBadge variant="success">Operation Complete</StatusBadge>);
      expect(screen.getByText('Operation Complete')).toBeInTheDocument();
    });

    it('maintains proper contrast with different variants', () => {
      const variants: Array<'success' | 'warning' | 'error' | 'info'> = [
        'success',
        'warning',
        'error',
        'info',
      ];

      variants.forEach(variant => {
        const { container } = render(<StatusBadge variant={variant}>{variant}</StatusBadge>);
        const badge = container.firstChild as HTMLElement;

        // Should have appropriate text colors for contrast
        if (variant === 'success') expect(badge).toHaveClass('text-emerald-700');
        if (variant === 'warning') expect(badge).toHaveClass('text-amber-700');
        if (variant === 'error') expect(badge).toHaveClass('text-red-700');
        if (variant === 'info') expect(badge).toHaveClass('text-blue-700');
      });
    });

    it('provides meaningful content when used with icons', () => {
      render(
        <StatusBadge variant="success" icon={<CheckCircle aria-hidden="true" />}>
          Task Completed Successfully
        </StatusBadge>
      );
      expect(screen.getByText('Task Completed Successfully')).toBeInTheDocument();
    });
  });

  // State Combination Tests
  describe('state combinations', () => {
    it('combines variant, size, and style correctly', () => {
      const { container } = render(
        <StatusBadge variant="warning" size="lg" style="outlined">
          Large Warning
        </StatusBadge>
      );
      const badge = container.firstChild;

      // Size classes
      expect(badge).toHaveClass('px-4', 'py-2', 'text-base');

      // Outlined style classes
      expect(badge).toHaveClass('bg-transparent', 'border-2');

      // Warning variant classes
      expect(badge).toHaveClass('border-amber-200', 'text-amber-700');
    });

    it('combines icon with pulse animation correctly', () => {
      const { container } = render(
        <StatusBadge icon={<Clock />} variant="pending" pulse>
          Processing...
        </StatusBadge>
      );

      // Icon should be present
      const iconWrapper = container.querySelector('.text-amber-500');
      expect(iconWrapper).toBeInTheDocument();

      // Pulse animation should not be applied to icon (only to dots)
      const pulsingElement = container.querySelector('.animate-pulse');
      expect(pulsingElement).not.toBeInTheDocument();
    });

    it('loading state overrides all indicators', () => {
      const { container } = render(
        <StatusBadge loading icon={<CheckCircle />} showDot pulse variant="success">
          Loading Override Test
        </StatusBadge>
      );

      // Should only show spinner
      expect(container.querySelector('.animate-spin')).toBeInTheDocument();

      // Should not show icon or dot
      expect(container.querySelector('.lucide')).not.toBeInTheDocument();
      const regularDot = container.querySelector('span.rounded-full.flex-shrink-0:not(.border-2)');
      expect(regularDot).not.toBeInTheDocument();

      // Should not show pulse animation
      expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument();
    });
  });

  // Edge Cases
  describe('edge cases', () => {
    it('handles empty children gracefully', () => {
      const { container } = render(<StatusBadge>{''}</StatusBadge>);
      const badge = container.firstChild;
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('');
    });

    it('handles complex children content', () => {
      render(
        <StatusBadge>
          <span>Complex</span> <strong>Content</strong>
        </StatusBadge>
      );
      expect(screen.getByText('Complex')).toBeInTheDocument();
      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    it('handles boolean and number children', () => {
      const { rerender } = render(<StatusBadge>{42}</StatusBadge>);
      expect(screen.getByText('42')).toBeInTheDocument();

      rerender(<StatusBadge>{true}</StatusBadge>);
      expect(screen.queryByText('true')).not.toBeInTheDocument();

      rerender(<StatusBadge>{false}</StatusBadge>);
      expect(screen.queryByText('false')).not.toBeInTheDocument();
    });

    it('handles null and undefined children gracefully', () => {
      const { container, rerender } = render(<StatusBadge>{null}</StatusBadge>);
      expect(container.firstChild).toBeInTheDocument();

      rerender(<StatusBadge>{undefined}</StatusBadge>);
      expect(container.firstChild).toBeInTheDocument();
    });

    it('maintains accessibility with complex indicator combinations', () => {
      const { container } = render(
        <StatusBadge variant="active" showDot pulse size="md">
          Online
        </StatusBadge>
      );

      expect(screen.getByText('Online')).toBeInTheDocument();

      // Badge should have proper visual indicators
      const dot = container.querySelector('span.rounded-full.flex-shrink-0:not(.border-2)');
      expect(dot).toBeInTheDocument();
      expect(dot).toHaveClass('animate-pulse');
    });
  });
});
