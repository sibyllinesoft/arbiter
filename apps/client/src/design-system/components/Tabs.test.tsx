import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileText, Settings, Users } from 'lucide-react';
import React from 'react';
import Tabs, { type TabItem } from './Tabs';

// Mock scrollTo since it's not available in jsdom
Object.defineProperty(Element.prototype, 'scrollTo', {
  value: vi.fn(),
  writable: true,
});

// Mock scroll properties
Object.defineProperty(Element.prototype, 'scrollWidth', {
  get() {
    return 500;
  },
});

Object.defineProperty(Element.prototype, 'clientWidth', {
  get() {
    return 300;
  },
});

Object.defineProperty(Element.prototype, 'scrollLeft', {
  get() {
    return 0;
  },
});

const mockTabItems: TabItem[] = [
  {
    id: 'tab1',
    label: 'First Tab',
    content: <div>First tab content</div>,
  },
  {
    id: 'tab2',
    label: 'Second Tab',
    content: <div>Second tab content</div>,
  },
  {
    id: 'tab3',
    label: 'Third Tab',
    content: <div>Third tab content</div>,
  },
];

const mockTabItemsWithFeatures: TabItem[] = [
  {
    id: 'files',
    label: 'Files',
    content: <div>Files content</div>,
    icon: <FileText />,
    badge: '12',
    closable: true,
    tooltip: 'Files tooltip',
  },
  {
    id: 'settings',
    label: 'Settings',
    content: <div>Settings content</div>,
    icon: <Settings />,
    disabled: true,
  },
  {
    id: 'users',
    label: 'Users',
    content: <div>Users content</div>,
    icon: <Users />,
    loading: true,
  },
];

describe('Tabs', () => {
  // Basic Rendering Tests
  describe('rendering', () => {
    it('renders without crashing', () => {
      render(<Tabs items={mockTabItems} />);
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    it('renders all tab items', () => {
      render(<Tabs items={mockTabItems} />);
      expect(screen.getByText('First Tab')).toBeInTheDocument();
      expect(screen.getByText('Second Tab')).toBeInTheDocument();
      expect(screen.getByText('Third Tab')).toBeInTheDocument();
    });

    it('renders tab content for first tab by default', () => {
      render(<Tabs items={mockTabItems} />);
      const firstPanel = screen.getByText('First tab content').parentElement;
      const secondPanel = screen.getByText('Second tab content').parentElement;

      expect(firstPanel).toHaveClass('block');
      expect(secondPanel).toHaveClass('hidden');
    });

    it('renders empty tabs list', () => {
      render(<Tabs items={[]} />);
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });
  });

  // Controlled vs Uncontrolled Tests
  describe('controlled vs uncontrolled', () => {
    it('works in uncontrolled mode', async () => {
      const user = userEvent.setup();
      render(<Tabs items={mockTabItems} />);

      // First tab should be active by default
      const firstPanel = screen.getByText('First tab content').parentElement;
      const secondPanel = screen.getByText('Second tab content').parentElement;
      expect(firstPanel).toHaveClass('block');

      // Click second tab
      await user.click(screen.getByText('Second Tab'));
      expect(secondPanel).toHaveClass('block');
      expect(firstPanel).toHaveClass('hidden');
    });

    it('works in controlled mode', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();
      const { rerender } = render(
        <Tabs items={mockTabItems} activeTab="tab2" onChange={handleChange} />
      );

      // Second tab should be active
      const firstPanel = screen.getByText('First tab content').parentElement;
      const secondPanel = screen.getByText('Second tab content').parentElement;
      expect(secondPanel).toHaveClass('block');

      // Click first tab
      await user.click(screen.getByText('First Tab'));
      expect(handleChange).toHaveBeenCalledWith('tab1');

      // Rerender with new active tab
      rerender(<Tabs items={mockTabItems} activeTab="tab1" onChange={handleChange} />);
      expect(firstPanel).toHaveClass('block');
    });

    it('uses activeTab prop when provided', () => {
      render(<Tabs items={mockTabItems} activeTab="tab3" />);
      const thirdPanel = screen.getByText('Third tab content').parentElement;
      expect(thirdPanel).toHaveClass('block');
    });
  });

  // Tab Features Tests
  describe('tab features', () => {
    it('renders tab icons', () => {
      render(<Tabs items={mockTabItemsWithFeatures} />);
      // Check for lucide icons by their SVG presence
      const fileIcon = screen.getByText('Files').closest('button')?.querySelector('svg');
      expect(fileIcon).toBeInTheDocument();
    });

    it('renders tab badges', () => {
      render(<Tabs items={mockTabItemsWithFeatures} />);
      expect(screen.getByText('12')).toBeInTheDocument();
    });

    it('renders close buttons for closable tabs', () => {
      render(<Tabs items={mockTabItemsWithFeatures} />);
      const closeButton = screen.getByLabelText('Close Files tab');
      expect(closeButton).toBeInTheDocument();
    });

    it('calls onTabClose when close button is clicked', async () => {
      const user = userEvent.setup();
      const handleTabClose = vi.fn();
      render(<Tabs items={mockTabItemsWithFeatures} onTabClose={handleTabClose} />);

      const closeButton = screen.getByLabelText('Close Files tab');
      await user.click(closeButton);
      expect(handleTabClose).toHaveBeenCalledWith('files');
    });

    it('shows loading spinner for loading tabs', () => {
      render(<Tabs items={mockTabItemsWithFeatures} />);
      const usersTab = screen.getByText('Users').closest('button');
      const loader = usersTab?.querySelector('.animate-spin');
      expect(loader).toBeInTheDocument();
    });

    it('applies tooltip to tabs', () => {
      render(<Tabs items={mockTabItemsWithFeatures} />);
      const filesTab = screen.getByText('Files').closest('button');
      expect(filesTab).toHaveAttribute('title', 'Files tooltip');
    });
  });

  // Tab States Tests
  describe('tab states', () => {
    it('handles disabled tabs correctly', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();
      render(<Tabs items={mockTabItemsWithFeatures} onChange={handleChange} />);

      const settingsTab = screen.getByText('Settings').closest('button');
      expect(settingsTab).toBeDisabled();

      await user.click(settingsTab!);
      expect(handleChange).not.toHaveBeenCalled();
    });

    it('handles loading tabs correctly', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();
      render(<Tabs items={mockTabItemsWithFeatures} onChange={handleChange} />);

      const usersTab = screen.getByText('Users').closest('button');
      expect(usersTab).toBeDisabled();

      await user.click(usersTab!);
      expect(handleChange).not.toHaveBeenCalled();
    });

    it('applies correct aria-selected to active tab', () => {
      render(<Tabs items={mockTabItems} activeTab="tab2" />);
      const tab1 = screen.getByText('First Tab').closest('button');
      const tab2 = screen.getByText('Second Tab').closest('button');

      expect(tab1).toHaveAttribute('aria-selected', 'false');
      expect(tab2).toHaveAttribute('aria-selected', 'true');
    });

    it('applies correct tabindex to tabs', () => {
      render(<Tabs items={mockTabItems} activeTab="tab2" />);
      const tab1 = screen.getByText('First Tab').closest('button');
      const tab2 = screen.getByText('Second Tab').closest('button');
      const tab3 = screen.getByText('Third Tab').closest('button');

      expect(tab1).toHaveAttribute('tabindex', '-1');
      expect(tab2).toHaveAttribute('tabindex', '0');
      expect(tab3).toHaveAttribute('tabindex', '-1');
    });
  });

  // Keyboard Navigation Tests
  describe('keyboard navigation', () => {
    it('navigates with arrow keys', async () => {
      const user = userEvent.setup();
      render(<Tabs items={mockTabItems} />);

      const firstTabButton = screen.getByText('First Tab').closest('button')!;
      firstTabButton.focus();

      // Arrow right to second tab
      fireEvent.keyDown(firstTabButton, { key: 'ArrowRight' });
      const secondPanel = screen.getByText('Second tab content').parentElement;
      expect(secondPanel).toHaveClass('block');

      // Arrow right to third tab
      const secondTabButton = screen.getByText('Second Tab').closest('button')!;
      fireEvent.keyDown(secondTabButton, { key: 'ArrowRight' });
      const thirdPanel = screen.getByText('Third tab content').parentElement;
      expect(thirdPanel).toHaveClass('block');

      // Arrow right wraps to first tab
      const thirdTabButton = screen.getByText('Third Tab').closest('button')!;
      fireEvent.keyDown(thirdTabButton, { key: 'ArrowRight' });
      const firstPanel = screen.getByText('First tab content').parentElement;
      expect(firstPanel).toHaveClass('block');
    });

    it('navigates with arrow left', async () => {
      const user = userEvent.setup();
      render(<Tabs items={mockTabItems} />);

      const firstTabButton = screen.getByText('First Tab').closest('button')!;
      firstTabButton.focus();

      // Arrow left wraps to last tab
      fireEvent.keyDown(firstTabButton, { key: 'ArrowLeft' });
      const thirdPanel = screen.getByText('Third tab content').parentElement;
      expect(thirdPanel).toHaveClass('block');

      // Arrow left to second tab
      const thirdTabButton = screen.getByText('Third Tab').closest('button')!;
      fireEvent.keyDown(thirdTabButton, { key: 'ArrowLeft' });
      const secondPanel = screen.getByText('Second tab content').parentElement;
      expect(secondPanel).toHaveClass('block');
    });

    it('navigates with Home and End keys', async () => {
      const user = userEvent.setup();
      render(<Tabs items={mockTabItems} />);

      // Start by clicking second tab to activate it
      const secondTabButton = screen.getByText('Second Tab').closest('button')!;
      await user.click(secondTabButton);
      secondTabButton.focus();

      // Home goes to first tab
      fireEvent.keyDown(secondTabButton, { key: 'Home' });
      const firstPanel = screen.getByText('First tab content').parentElement;
      expect(firstPanel).toHaveClass('block');

      // End goes to last tab
      const firstTabButton = screen.getByText('First Tab').closest('button')!;
      fireEvent.keyDown(firstTabButton, { key: 'End' });
      const thirdPanel = screen.getByText('Third tab content').parentElement;
      expect(thirdPanel).toHaveClass('block');
    });

    it('skips disabled and loading tabs in keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<Tabs items={mockTabItemsWithFeatures} />);

      const firstTabButton = screen.getByText('Files').closest('button')!;
      firstTabButton.focus();

      // Arrow right should skip disabled and loading tabs, wrap to first
      fireEvent.keyDown(firstTabButton, { key: 'ArrowRight' });
      const filesPanel = screen.getByText('Files content').parentElement;
      expect(filesPanel).toHaveClass('block');
    });
  });

  // Variant Tests
  describe('variants', () => {
    it('applies underline variant classes', () => {
      render(<Tabs items={mockTabItems} variant="underline" />);
      const tablist = screen.getByRole('tablist');
      expect(tablist).toHaveClass('border-b', 'border-graphite-200');
    });

    it('applies pills variant classes', () => {
      render(<Tabs items={mockTabItems} variant="pills" />);
      const firstTab = screen.getByText('First Tab').closest('button');
      expect(firstTab).toHaveClass('rounded-lg');
    });

    it('applies bordered variant classes', () => {
      render(<Tabs items={mockTabItems} variant="bordered" />);
      const tablist = screen.getByRole('tablist');
      expect(tablist).toHaveClass('border-b', 'border-graphite-200');
    });

    it('applies buttons variant classes', () => {
      render(<Tabs items={mockTabItems} variant="buttons" />);
      const tablist = screen.getByRole('tablist');
      expect(tablist).toHaveClass('bg-graphite-100', 'rounded-lg', 'p-1');
    });
  });

  // Size Tests
  describe('sizes', () => {
    it('applies small size classes', () => {
      render(<Tabs items={mockTabItems} size="sm" />);
      const firstTab = screen.getByText('First Tab').closest('button');
      expect(firstTab).toHaveClass('px-2', 'py-1.5', 'text-sm');
    });

    it('applies medium size classes', () => {
      render(<Tabs items={mockTabItems} size="md" />);
      const firstTab = screen.getByText('First Tab').closest('button');
      expect(firstTab).toHaveClass('px-3', 'py-2', 'text-sm');
    });

    it('applies large size classes', () => {
      render(<Tabs items={mockTabItems} size="lg" />);
      const firstTab = screen.getByText('First Tab').closest('button');
      expect(firstTab).toHaveClass('px-4', 'py-3', 'text-base');
    });
  });

  // Layout Tests
  describe('layout', () => {
    it('applies full width when enabled', () => {
      render(<Tabs items={mockTabItems} fullWidth />);
      const firstTab = screen.getByText('First Tab').closest('button');
      expect(firstTab).toHaveClass('flex-1', 'justify-center');
    });

    it('does not apply full width when scrollable', () => {
      render(<Tabs items={mockTabItems} fullWidth scrollable />);
      const firstTab = screen.getByText('First Tab').closest('button');
      expect(firstTab).not.toHaveClass('flex-1', 'justify-center');
    });

    it('applies scrollable classes', () => {
      render(<Tabs items={mockTabItems} scrollable />);
      const tablist = screen.getByRole('tablist');
      expect(tablist).toHaveClass('overflow-x-auto', 'scrollbar-hide');
    });
  });

  // Scroll Buttons Tests
  describe('scroll buttons', () => {
    it('shows scroll buttons when scrollable and showScrollButtons enabled', () => {
      // Mock scrollWidth > clientWidth to show scroll buttons
      Object.defineProperty(Element.prototype, 'scrollLeft', {
        get() {
          return 50;
        },
      });

      render(<Tabs items={mockTabItems} scrollable showScrollButtons />);

      waitFor(() => {
        expect(screen.getByLabelText('Scroll tabs left')).toBeInTheDocument();
      });
    });

    it('handles scroll button clicks', async () => {
      const user = userEvent.setup();
      const mockScrollTo = vi.fn();

      // Mock DOM methods
      Object.defineProperty(Element.prototype, 'scrollTo', {
        value: mockScrollTo,
        writable: true,
      });

      Object.defineProperty(Element.prototype, 'scrollLeft', {
        get() {
          return 50;
        },
      });

      render(<Tabs items={mockTabItems} scrollable showScrollButtons />);

      await waitFor(async () => {
        const leftButton = screen.getByLabelText('Scroll tabs left');
        await user.click(leftButton);
        expect(mockScrollTo).toHaveBeenCalled();
      });
    });

    it('does not show scroll buttons when scrollable is false', () => {
      render(<Tabs items={mockTabItems} scrollable={false} showScrollButtons />);
      expect(screen.queryByLabelText('Scroll tabs left')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Scroll tabs right')).not.toBeInTheDocument();
    });
  });

  // Custom Styling Tests
  describe('custom styling', () => {
    it('applies custom className to container', () => {
      const { container } = render(<Tabs items={mockTabItems} className="custom-tabs" />);
      const tabsContainer = container.firstChild;
      expect(tabsContainer).toHaveClass('custom-tabs');
    });

    it('applies custom contentClassName to content area', () => {
      const { container } = render(<Tabs items={mockTabItems} contentClassName="custom-content" />);
      const contentArea = container.querySelector('.custom-content');
      expect(contentArea).toBeInTheDocument();
    });

    it('applies custom tabClassName to individual tabs', () => {
      render(<Tabs items={mockTabItems} tabClassName="custom-tab" />);
      const firstTab = screen.getByText('First Tab').closest('button');
      expect(firstTab).toHaveClass('custom-tab');
    });
  });

  // Accessibility Tests
  describe('accessibility', () => {
    it('has proper ARIA roles', () => {
      render(<Tabs items={mockTabItems} />);
      expect(screen.getByRole('tablist')).toBeInTheDocument();
      expect(screen.getAllByRole('tab')).toHaveLength(3);
      expect(screen.getAllByRole('tabpanel')).toHaveLength(3);
    });

    it('links tabs to their panels with aria-controls', () => {
      render(<Tabs items={mockTabItems} />);
      const firstTab = screen.getByText('First Tab').closest('button');
      expect(firstTab).toHaveAttribute('aria-controls', 'tabpanel-tab1');
    });

    it('has proper panel labelling with aria-labelledby', () => {
      render(<Tabs items={mockTabItems} />);
      const panels = screen.getAllByRole('tabpanel', { hidden: true });
      expect(panels[0]).toHaveAttribute('aria-labelledby', 'tab-tab1');
      expect(panels[1]).toHaveAttribute('aria-labelledby', 'tab-tab2');
      expect(panels[2]).toHaveAttribute('aria-labelledby', 'tab-tab3');
    });

    it('shows only active panel content to screen readers', () => {
      render(<Tabs items={mockTabItems} activeTab="tab2" />);

      const firstPanel = screen.getByText('First tab content').parentElement;
      const secondPanel = screen.getByText('Second tab content').parentElement;

      expect(firstPanel).toHaveClass('hidden');
      expect(secondPanel).toHaveClass('block');
    });

    it('has proper focus management', () => {
      render(<Tabs items={mockTabItems} />);
      const tabs = screen.getAllByRole('tab');

      // Only active tab should be focusable
      expect(tabs[0]).toHaveAttribute('tabindex', '0');
      expect(tabs[1]).toHaveAttribute('tabindex', '-1');
      expect(tabs[2]).toHaveAttribute('tabindex', '-1');
    });
  });

  // Edge Cases Tests
  describe('edge cases', () => {
    it('handles empty items array', () => {
      render(<Tabs items={[]} />);
      expect(screen.getByRole('tablist')).toBeInTheDocument();
      expect(screen.queryAllByRole('tab')).toHaveLength(0);
    });

    it('handles single tab', () => {
      const singleTab = [mockTabItems[0]];
      render(<Tabs items={singleTab} />);
      expect(screen.getAllByRole('tab')).toHaveLength(1);
      expect(screen.getByText('First tab content')).toBeVisible();
    });

    it('handles invalid activeTab prop', () => {
      render(<Tabs items={mockTabItems} activeTab="nonexistent" />);
      // Should fall back to first tab or no active tab
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    it('handles all tabs disabled', () => {
      const disabledTabs = mockTabItems.map(item => ({ ...item, disabled: true }));
      render(<Tabs items={disabledTabs} />);

      const tabs = screen.getAllByRole('tab');
      tabs.forEach(tab => {
        expect(tab).toBeDisabled();
      });
    });

    it('prevents close button click from triggering tab click', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();
      const handleTabClose = vi.fn();

      render(
        <Tabs
          items={mockTabItemsWithFeatures}
          onChange={handleChange}
          onTabClose={handleTabClose}
        />
      );

      const closeButton = screen.getByLabelText('Close Files tab');
      await user.click(closeButton);

      expect(handleTabClose).toHaveBeenCalledWith('files');
      expect(handleChange).not.toHaveBeenCalled();
    });
  });

  // Integration Tests
  describe('integration', () => {
    it('works with complex tab switching scenario', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();
      const handleTabClose = vi.fn();

      render(
        <Tabs
          items={mockTabItemsWithFeatures}
          onChange={handleChange}
          onTabClose={handleTabClose}
        />
      );

      // Initial state - first tab active
      const filesPanel = screen.getByText('Files content').parentElement;
      expect(filesPanel).toHaveClass('block');

      // Try to click disabled tab (should not work)
      const settingsTab = screen.getByText('Settings');
      await user.click(settingsTab);
      expect(handleChange).not.toHaveBeenCalled();

      // Close first tab
      const closeButton = screen.getByLabelText('Close Files tab');
      await user.click(closeButton);
      expect(handleTabClose).toHaveBeenCalledWith('files');

      // Use keyboard navigation
      const filesTabButton = screen.getByText('Files').closest('button')!;
      filesTabButton.focus();
      fireEvent.keyDown(filesTabButton, { key: 'ArrowRight' });
      // Should skip disabled and loading tabs, wrapping back
      expect(filesPanel).toHaveClass('block');
    });
  });
});
