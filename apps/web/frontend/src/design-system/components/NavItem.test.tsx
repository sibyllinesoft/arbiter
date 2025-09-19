import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Home, Settings, ChevronRight } from 'lucide-react';
import NavItem, { NavGroup, type NavItemProps } from './NavItem';

const mockOnClick = vi.fn();

describe('NavItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Basic Rendering Tests
  describe('rendering', () => {
    it('renders button by default', () => {
      render(<NavItem>Dashboard</NavItem>);

      const navItem = screen.getByRole('button', { name: 'Dashboard' });
      expect(navItem).toBeInTheDocument();
      expect(navItem.tagName).toBe('BUTTON');
    });

    it('renders as link when href is provided', () => {
      render(<NavItem href="/dashboard">Dashboard</NavItem>);

      const navItem = screen.getByRole('link', { name: 'Dashboard' });
      expect(navItem).toBeInTheDocument();
      expect(navItem).toHaveAttribute('href', '/dashboard');
    });

    it('renders disabled button when disabled and href provided', () => {
      render(
        <NavItem href="/dashboard" disabled>
          Dashboard
        </NavItem>
      );

      // Should render as disabled button, not a link
      const navItem = screen.getByRole('button', { name: 'Dashboard' });
      expect(navItem).toBeDisabled();
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('renders with custom text content', () => {
      render(<NavItem>Custom Navigation Item</NavItem>);

      expect(screen.getByText('Custom Navigation Item')).toBeInTheDocument();
    });

    it('renders with ReactNode children', () => {
      render(
        <NavItem>
          <span data-testid="custom-content">Complex Content</span>
        </NavItem>
      );

      expect(screen.getByTestId('custom-content')).toBeInTheDocument();
    });
  });

  // State Tests
  describe('states', () => {
    it('applies active styles when active', () => {
      render(
        <NavItem active variant="default">
          Active Item
        </NavItem>
      );

      const navItem = screen.getByRole('button', { name: 'Active Item' });
      expect(navItem).toHaveClass('bg-blue-50', 'text-blue-700');
    });

    it('applies disabled styles when disabled', () => {
      render(<NavItem disabled>Disabled Item</NavItem>);

      const navItem = screen.getByRole('button', { name: 'Disabled Item' });
      expect(navItem).toBeDisabled();
      expect(navItem).toHaveClass('text-graphite-400', 'cursor-not-allowed');
    });

    it('does not apply hover styles when not interactive', () => {
      render(<NavItem interactive={false}>Non Interactive</NavItem>);

      const navItem = screen.getByRole('button', { name: 'Non Interactive' });
      // Should not have hover classes
      expect(navItem).not.toHaveClass('hover:text-graphite-900');
    });
  });

  // Variant Tests
  describe('variants', () => {
    it('renders default variant correctly', () => {
      render(<NavItem variant="default">Default</NavItem>);

      const navItem = screen.getByRole('button', { name: 'Default' });
      expect(navItem).toHaveClass('text-graphite-700', 'hover:text-graphite-900');
    });

    it('renders subtle variant correctly', () => {
      render(<NavItem variant="subtle">Subtle</NavItem>);

      const navItem = screen.getByRole('button', { name: 'Subtle' });
      expect(navItem).toHaveClass('text-graphite-600', 'hover:text-graphite-800');
    });

    it('renders ghost variant correctly', () => {
      render(<NavItem variant="ghost">Ghost</NavItem>);

      const navItem = screen.getByRole('button', { name: 'Ghost' });
      expect(navItem).toHaveClass('text-graphite-600', 'hover:text-graphite-900');
    });

    it('applies active variant styles correctly', () => {
      render(
        <NavItem variant="subtle" active>
          Active Subtle
        </NavItem>
      );

      const navItem = screen.getByRole('button', { name: 'Active Subtle' });
      expect(navItem).toHaveClass('bg-graphite-100', 'text-graphite-900');
    });

    it('applies ghost active styles correctly', () => {
      render(
        <NavItem variant="ghost" active>
          Active Ghost
        </NavItem>
      );

      const navItem = screen.getByRole('button', { name: 'Active Ghost' });
      expect(navItem).toHaveClass('text-blue-600', 'font-medium');
    });
  });

  // Size Tests
  describe('sizes', () => {
    it('renders small size correctly', () => {
      render(<NavItem size="sm">Small</NavItem>);

      const navItem = screen.getByRole('button', { name: 'Small' });
      expect(navItem).toHaveClass('px-2', 'py-1.5', 'text-sm');
    });

    it('renders medium size correctly', () => {
      render(<NavItem size="md">Medium</NavItem>);

      const navItem = screen.getByRole('button', { name: 'Medium' });
      expect(navItem).toHaveClass('px-3', 'py-2', 'text-sm');
    });

    it('renders large size correctly', () => {
      render(<NavItem size="lg">Large</NavItem>);

      const navItem = screen.getByRole('button', { name: 'Large' });
      expect(navItem).toHaveClass('px-4', 'py-3', 'text-base');
    });
  });

  // Icon Tests
  describe('icons', () => {
    it('renders with start icon', () => {
      render(<NavItem icon={<Home data-testid="start-icon" />}>With Icon</NavItem>);

      expect(screen.getByTestId('start-icon')).toBeInTheDocument();
    });

    it('renders with end icon', () => {
      render(<NavItem endIcon={<ChevronRight data-testid="end-icon" />}>With End Icon</NavItem>);

      expect(screen.getByTestId('end-icon')).toBeInTheDocument();
    });

    it('renders with both start and end icons', () => {
      render(
        <NavItem
          icon={<Home data-testid="start-icon" />}
          endIcon={<ChevronRight data-testid="end-icon" />}
        >
          With Both Icons
        </NavItem>
      );

      expect(screen.getByTestId('start-icon')).toBeInTheDocument();
      expect(screen.getByTestId('end-icon')).toBeInTheDocument();
    });

    it('applies correct icon styling for different sizes', () => {
      const { rerender } = render(
        <NavItem size="sm" icon={<Home data-testid="icon" />}>
          Small Icon
        </NavItem>
      );

      let icon = screen.getByTestId('icon');
      expect(icon.parentElement).toHaveClass('h-3.5', 'w-3.5');

      rerender(
        <NavItem size="lg" icon={<Home data-testid="icon" />}>
          Large Icon
        </NavItem>
      );

      icon = screen.getByTestId('icon');
      expect(icon.parentElement).toHaveClass('h-5', 'w-5');
    });

    it('applies active color to icon when active', () => {
      render(
        <NavItem active icon={<Home data-testid="icon" />}>
          Active With Icon
        </NavItem>
      );

      const iconContainer = screen.getByTestId('icon').parentElement;
      expect(iconContainer).toHaveClass('text-blue-600');
    });
  });

  // Badge Tests
  describe('badges', () => {
    it('renders with string badge', () => {
      render(<NavItem badge="New">With Badge</NavItem>);

      expect(screen.getByText('New')).toBeInTheDocument();
      expect(screen.getByText('New').tagName).toBe('SPAN');
    });

    it('renders with number badge', () => {
      render(<NavItem badge={5}>With Number Badge</NavItem>);

      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('renders with ReactNode badge', () => {
      render(
        <NavItem badge={<span data-testid="custom-badge">Custom</span>}>With Custom Badge</NavItem>
      );

      expect(screen.getByTestId('custom-badge')).toBeInTheDocument();
    });

    it('applies active styling to badge when active', () => {
      render(
        <NavItem active badge="Active">
          Active With Badge
        </NavItem>
      );

      const badge = screen.getByText('Active');
      expect(badge).toHaveClass('bg-blue-100', 'text-blue-700');
    });

    it('applies correct badge sizing', () => {
      render(
        <NavItem size="lg" badge="Large">
          Large Badge
        </NavItem>
      );

      const badge = screen.getByText('Large');
      expect(badge).toHaveClass('px-2.5', 'py-1', 'text-sm');
    });
  });

  // External Link Tests
  describe('external links', () => {
    it('renders external link indicator', () => {
      render(
        <NavItem href="https://example.com" external>
          External Link
        </NavItem>
      );

      const link = screen.getByRole('link', { name: /External Link/i });
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');

      // External icon should be present
      const externalIcon = link.querySelector('.lucide-external-link');
      expect(externalIcon).toBeInTheDocument();
    });

    it('does not render external indicator for buttons', () => {
      render(<NavItem external>Not External Button</NavItem>);

      const button = screen.getByRole('button');
      const externalIcon = button.querySelector('.lucide-external-link');
      expect(externalIcon).not.toBeInTheDocument();
    });

    it('does not render external indicator without href', () => {
      render(<NavItem external>No Href External</NavItem>);

      const button = screen.getByRole('button');
      const externalIcon = button.querySelector('.lucide-external-link');
      expect(externalIcon).not.toBeInTheDocument();
    });
  });

  // Shortcut Tests
  describe('keyboard shortcuts', () => {
    it('renders keyboard shortcut', () => {
      render(<NavItem shortcut="⌘K">With Shortcut</NavItem>);

      const shortcut = screen.getByText('⌘K');
      expect(shortcut).toBeInTheDocument();
      expect(shortcut.tagName).toBe('KBD');
    });

    it('applies correct shortcut styling for different sizes', () => {
      render(
        <NavItem size="lg" shortcut="⌘K">
          Large Shortcut
        </NavItem>
      );

      const shortcut = screen.getByText('⌘K');
      expect(shortcut).toHaveClass('text-sm');
    });

    it('renders both badge and shortcut', () => {
      render(
        <NavItem badge="3" shortcut="⌘K">
          Badge and Shortcut
        </NavItem>
      );

      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('⌘K')).toBeInTheDocument();
    });
  });

  // Interaction Tests
  describe('interactions', () => {
    it('calls onClick when button clicked', async () => {
      const user = userEvent.setup();

      render(<NavItem onClick={mockOnClick}>Clickable</NavItem>);

      await user.click(screen.getByRole('button', { name: 'Clickable' }));
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('calls onClick when link clicked', async () => {
      render(
        <NavItem href="/test" onClick={mockOnClick}>
          Link
        </NavItem>
      );

      // Prevent default navigation to avoid jsdom errors
      const link = screen.getByRole('link', { name: 'Link' });

      // Mock the click event to prevent navigation
      fireEvent.click(link);

      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when disabled', async () => {
      const user = userEvent.setup();

      render(
        <NavItem disabled onClick={mockOnClick}>
          Disabled
        </NavItem>
      );

      const button = screen.getByRole('button', { name: 'Disabled' });
      await user.click(button);
      expect(mockOnClick).not.toHaveBeenCalled();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();

      render(<NavItem onClick={mockOnClick}>Keyboard Nav</NavItem>);

      const button = screen.getByRole('button', { name: 'Keyboard Nav' });
      button.focus();

      expect(button).toHaveFocus();

      await user.keyboard('{Enter}');
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('supports space key for activation', async () => {
      const user = userEvent.setup();

      render(<NavItem onClick={mockOnClick}>Space Activation</NavItem>);

      const button = screen.getByRole('button', { name: 'Space Activation' });
      button.focus();

      await user.keyboard(' ');
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });
  });

  // Styling and Accessibility Tests
  describe('styling and accessibility', () => {
    it('applies custom className', () => {
      render(<NavItem className="custom-nav-item">Custom Styled</NavItem>);

      const navItem = screen.getByRole('button', { name: 'Custom Styled' });
      expect(navItem).toHaveClass('custom-nav-item');
    });

    it('has proper focus styles', () => {
      render(<NavItem>Focusable</NavItem>);

      const navItem = screen.getByRole('button', { name: 'Focusable' });
      expect(navItem).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-blue-500');
    });

    it('maintains proper button semantics', () => {
      render(<NavItem>Button Nav</NavItem>);

      const navItem = screen.getByRole('button', { name: 'Button Nav' });
      expect(navItem).toHaveAttribute('type', 'button');
    });

    it('maintains proper link semantics for external links', () => {
      render(
        <NavItem href="https://example.com" external>
          External
        </NavItem>
      );

      const link = screen.getByRole('link', { name: /External/i });
      expect(link).toHaveAttribute('href', 'https://example.com');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('truncates long text content', () => {
      render(<NavItem>Very Long Navigation Item Text That Should Be Truncated</NavItem>);

      const textSpan = screen.getByText('Very Long Navigation Item Text That Should Be Truncated');
      expect(textSpan).toHaveClass('truncate');
    });
  });

  // Complex Scenarios Tests
  describe('complex scenarios', () => {
    it('renders fully featured nav item', () => {
      render(
        <NavItem
          href="/settings"
          active
          icon={<Settings data-testid="icon" />}
          endIcon={<ChevronRight data-testid="end-icon" />}
          badge="Pro"
          shortcut="⌘,"
          size="lg"
          variant="default"
        >
          Settings
        </NavItem>
      );

      // Link name includes badge and shortcut text in accessible name
      const link = screen.getByRole('link', { name: /Settings.*Pro.*⌘,/i });
      expect(link).toHaveAttribute('href', '/settings');
      expect(link).toHaveClass('bg-blue-50', 'text-blue-700');

      expect(screen.getByTestId('icon')).toBeInTheDocument();
      expect(screen.getByTestId('end-icon')).toBeInTheDocument();
      expect(screen.getByText('Pro')).toBeInTheDocument();
      expect(screen.getByText('⌘,')).toBeInTheDocument();
    });

    it('handles all disabled states correctly', () => {
      render(
        <NavItem
          disabled
          icon={<Settings data-testid="icon" />}
          badge="Disabled"
          onClick={mockOnClick}
        >
          Disabled Item
        </NavItem>
      );

      // Button includes badge text in accessible name
      const button = screen.getByRole('button', { name: 'Disabled Item Disabled' });
      expect(button).toBeDisabled();
      expect(button).toHaveClass('text-graphite-400', 'cursor-not-allowed');

      // Should still render content
      expect(screen.getByTestId('icon')).toBeInTheDocument();
      expect(screen.getByText('Disabled')).toBeInTheDocument();
    });

    it('handles mixed interactive content', () => {
      render(
        <NavItem
          badge={<span data-testid="badge-content">Custom</span>}
          endIcon={<span data-testid="icon-content">×</span>}
        >
          Mixed Content
        </NavItem>
      );

      // Main nav item should be a button (includes end icon text in name)
      expect(screen.getByRole('button', { name: 'Mixed Content Custom ×' })).toBeInTheDocument();

      // Custom badge and icon content should be rendered
      expect(screen.getByTestId('badge-content')).toBeInTheDocument();
      expect(screen.getByTestId('icon-content')).toBeInTheDocument();
    });
  });
});

describe('NavGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Basic Rendering Tests
  describe('rendering', () => {
    it('renders without title', () => {
      render(
        <NavGroup>
          <NavItem>Item 1</NavItem>
          <NavItem>Item 2</NavItem>
        </NavGroup>
      );

      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
    });

    it('renders with title', () => {
      render(
        <NavGroup title="Navigation">
          <NavItem>Item 1</NavItem>
        </NavGroup>
      );

      // Title text is rendered normally, CSS applies uppercase styling
      expect(screen.getByText('Navigation')).toBeInTheDocument();
      expect(screen.getByText('Item 1')).toBeInTheDocument();
    });

    it('renders title as heading when not collapsible', () => {
      render(
        <NavGroup title="Section" collapsible={false}>
          <NavItem>Item</NavItem>
        </NavGroup>
      );

      const title = screen.getByText('Section');
      expect(title.tagName).toBe('H3');
      expect(title).toHaveClass('text-xs', 'font-semibold', 'text-graphite-500');
    });

    it('renders multiple children', () => {
      render(
        <NavGroup title="Multi">
          <NavItem>First</NavItem>
          <NavItem>Second</NavItem>
          <NavItem>Third</NavItem>
        </NavGroup>
      );

      expect(screen.getByText('First')).toBeInTheDocument();
      expect(screen.getByText('Second')).toBeInTheDocument();
      expect(screen.getByText('Third')).toBeInTheDocument();
    });
  });

  // Collapsible Tests
  describe('collapsible behavior', () => {
    it('renders as collapsible button when collapsible prop is true', () => {
      render(
        <NavGroup title="Collapsible" collapsible>
          <NavItem>Hidden Item</NavItem>
        </NavGroup>
      );

      const toggleButton = screen.getByRole('button', { name: /COLLAPSIBLE/i });
      expect(toggleButton).toBeInTheDocument();
      expect(screen.getByText('Hidden Item')).toBeInTheDocument();
    });

    it('shows content by default when not collapsed', () => {
      render(
        <NavGroup title="Open" collapsible defaultCollapsed={false}>
          <NavItem>Visible Item</NavItem>
        </NavGroup>
      );

      expect(screen.getByText('Visible Item')).toBeInTheDocument();

      // Chevron should be rotated (expanded state)
      const toggleButton = screen.getByRole('button', { name: /Open/i });
      const chevron = toggleButton.querySelector('.lucide-chevron-right');
      expect(chevron).toHaveClass('rotate-90');
    });

    it('hides content when defaultCollapsed is true', () => {
      render(
        <NavGroup title="Collapsed" collapsible defaultCollapsed>
          <NavItem>Hidden Item</NavItem>
        </NavGroup>
      );

      expect(screen.queryByText('Hidden Item')).not.toBeInTheDocument();

      // Chevron should not be rotated (collapsed state)
      const chevron = screen.getByRole('button').querySelector('.lucide-chevron-right');
      expect(chevron).not.toHaveClass('rotate-90');
    });

    it('toggles visibility when collapsible button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <NavGroup title="Toggle" collapsible defaultCollapsed>
          <NavItem>Toggle Item</NavItem>
        </NavGroup>
      );

      // Initially hidden
      expect(screen.queryByText('Toggle Item')).not.toBeInTheDocument();

      // Click to expand
      const toggleButton = screen.getByRole('button', { name: /TOGGLE/i });
      await user.click(toggleButton);

      expect(screen.getByText('Toggle Item')).toBeInTheDocument();

      // Click to collapse again
      await user.click(toggleButton);

      expect(screen.queryByText('Toggle Item')).not.toBeInTheDocument();
    });

    it('updates chevron rotation when toggling', async () => {
      const user = userEvent.setup();

      render(
        <NavGroup title="Chevron" collapsible defaultCollapsed>
          <NavItem>Item</NavItem>
        </NavGroup>
      );

      const toggleButton = screen.getByRole('button', { name: /CHEVRON/i });
      const chevron = toggleButton.querySelector('.lucide-chevron-right');

      // Initially collapsed - no rotation
      expect(chevron).not.toHaveClass('rotate-90');

      // Click to expand
      await user.click(toggleButton);
      expect(chevron).toHaveClass('rotate-90');

      // Click to collapse
      await user.click(toggleButton);
      expect(chevron).not.toHaveClass('rotate-90');
    });
  });

  // Keyboard Interaction Tests
  describe('keyboard interactions', () => {
    it('supports keyboard activation of toggle', async () => {
      const user = userEvent.setup();

      render(
        <NavGroup title="Keyboard" collapsible defaultCollapsed>
          <NavItem>Hidden</NavItem>
        </NavGroup>
      );

      const toggleButton = screen.getByRole('button', { name: /KEYBOARD/i });

      // Focus and activate with Enter
      toggleButton.focus();
      await user.keyboard('{Enter}');

      expect(screen.getByText('Hidden')).toBeInTheDocument();

      // Activate with Space
      await user.keyboard(' ');

      expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
    });
  });

  // Styling Tests
  describe('styling', () => {
    it('applies custom className', () => {
      render(
        <NavGroup className="custom-group">
          <NavItem>Item</NavItem>
        </NavGroup>
      );

      // Find the outer div with custom class
      const group = document.querySelector('.custom-group');
      expect(group).toBeInTheDocument();
      expect(group).toHaveClass('space-y-1');
    });

    it('applies correct spacing classes', () => {
      render(
        <div data-testid="wrapper">
          <NavGroup>
            <NavItem>Item</NavItem>
          </NavGroup>
        </div>
      );

      const wrapper = screen.getByTestId('wrapper');
      const group = wrapper.querySelector('.space-y-1');
      expect(group).toBeInTheDocument();
    });

    it('styles collapsible button correctly', () => {
      render(
        <NavGroup title="Styled" collapsible>
          <NavItem>Item</NavItem>
        </NavGroup>
      );

      const button = screen.getByRole('button', { name: /STYLED/i });
      expect(button).toHaveClass(
        'flex',
        'items-center',
        'gap-2',
        'text-xs',
        'font-semibold',
        'text-graphite-500',
        'hover:text-graphite-700'
      );
    });
  });

  // Complex Scenarios Tests
  describe('complex scenarios', () => {
    it('handles nested content properly', () => {
      render(
        <NavGroup title="Parent" collapsible>
          <NavGroup title="Child">
            <NavItem>Nested Item</NavItem>
          </NavGroup>
          <NavItem>Parent Item</NavItem>
        </NavGroup>
      );

      // Titles are rendered in uppercase by CSS
      expect(screen.getByText('Parent')).toBeInTheDocument();
      expect(screen.getByText('Child')).toBeInTheDocument();
      expect(screen.getByText('Nested Item')).toBeInTheDocument();
      expect(screen.getByText('Parent Item')).toBeInTheDocument();
    });

    it('maintains state independently for multiple groups', async () => {
      const user = userEvent.setup();

      render(
        <div>
          <NavGroup title="Group 1" collapsible defaultCollapsed>
            <NavItem>Item 1</NavItem>
          </NavGroup>
          <NavGroup title="Group 2" collapsible defaultCollapsed>
            <NavItem>Item 2</NavItem>
          </NavGroup>
        </div>
      );

      // Both items initially hidden
      expect(screen.queryByText('Item 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Item 2')).not.toBeInTheDocument();

      // Expand first group only
      await user.click(screen.getByRole('button', { name: /GROUP 1/i }));

      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.queryByText('Item 2')).not.toBeInTheDocument();

      // Expand second group
      await user.click(screen.getByRole('button', { name: /GROUP 2/i }));

      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
    });

    it('handles empty groups gracefully', () => {
      render(
        <NavGroup title="Empty" collapsible>
          {null}
          {false}
          {undefined}
        </NavGroup>
      );

      expect(screen.getByRole('button', { name: /EMPTY/i })).toBeInTheDocument();
      // Should not throw or cause rendering issues
    });
  });
});
