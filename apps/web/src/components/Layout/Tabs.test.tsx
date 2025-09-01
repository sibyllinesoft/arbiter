/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Tabs from './Tabs';
import type { TabItem } from '../../types/ui';

// Mock tab content components
const Tab1Content = () => <div data-testid="tab1-content">Tab 1 Content</div>;
const Tab2Content = () => <div data-testid="tab2-content">Tab 2 Content</div>;
const Tab3Content = () => <div data-testid="tab3-content">Tab 3 Content</div>;

// Test data
const mockTabs: TabItem[] = [
  {
    id: 'tab1',
    label: 'First Tab',
    content: <Tab1Content />,
  },
  {
    id: 'tab2', 
    label: 'Second Tab',
    content: <Tab2Content />,
  },
  {
    id: 'tab3',
    label: 'Third Tab', 
    content: <Tab3Content />,
  },
];

const mockTabsWithBadges: TabItem[] = [
  {
    id: 'tab1',
    label: 'Errors',
    content: <Tab1Content />,
    badge: '5',
  },
  {
    id: 'tab2',
    label: 'Warnings',
    content: <Tab2Content />,
    badge: 12,
  },
  {
    id: 'tab3',
    label: 'Info',
    content: <Tab3Content />,
  },
];

const mockTabsWithDisabled: TabItem[] = [
  {
    id: 'tab1',
    label: 'Available',
    content: <Tab1Content />,
  },
  {
    id: 'tab2',
    label: 'Disabled Tab',
    content: <Tab2Content />,
    disabled: true,
  },
  {
    id: 'tab3',
    label: 'Also Available',
    content: <Tab3Content />,
  },
];

describe('Tabs', () => {
  const user = userEvent.setup();
  const mockOnTabChange = vi.fn();

  beforeEach(() => {
    mockOnTabChange.mockClear();
  });

  describe('Basic Rendering', () => {
    it('renders all tab headers', () => {
      render(
        <Tabs
          activeTab="tab1"
          onTabChange={mockOnTabChange}
          tabs={mockTabs}
        />
      );

      expect(screen.getByRole('tab', { name: 'First Tab' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Second Tab' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Third Tab' })).toBeInTheDocument();
    });

    it('renders active tab content', () => {
      render(
        <Tabs
          activeTab="tab2"
          onTabChange={mockOnTabChange}
          tabs={mockTabs}
        />
      );

      expect(screen.getByTestId('tab2-content')).toBeInTheDocument();
      expect(screen.queryByTestId('tab1-content')).not.toBeInTheDocument();
      expect(screen.queryByTestId('tab3-content')).not.toBeInTheDocument();
    });

    it('applies custom className to container', () => {
      render(
        <Tabs
          activeTab="tab1"
          onTabChange={mockOnTabChange}
          tabs={mockTabs}
          className="custom-tabs"
        />
      );

      const container = screen.getByRole('tab', { name: 'First Tab' }).closest('.custom-tabs');
      expect(container).toBeInTheDocument();
    });

    it('renders empty content when no active tab matches', () => {
      render(
        <Tabs
          activeTab="nonexistent"
          onTabChange={mockOnTabChange}
          tabs={mockTabs}
        />
      );

      expect(screen.queryByTestId('tab1-content')).not.toBeInTheDocument();
      expect(screen.queryByTestId('tab2-content')).not.toBeInTheDocument();
      expect(screen.queryByTestId('tab3-content')).not.toBeInTheDocument();
    });
  });

  describe('Tab States and Styling', () => {
    it('applies active styling to active tab', () => {
      render(
        <Tabs
          activeTab="tab2"
          onTabChange={mockOnTabChange}
          tabs={mockTabs}
        />
      );

      const activeTab = screen.getByRole('tab', { name: 'Second Tab' });
      const inactiveTab = screen.getByRole('tab', { name: 'First Tab' });

      expect(activeTab).toHaveClass('border-blue-500', 'text-blue-600', 'bg-white');
      expect(inactiveTab).toHaveClass('border-transparent', 'text-gray-500');
    });

    it('applies aria-selected correctly', () => {
      render(
        <Tabs
          activeTab="tab1"
          onTabChange={mockOnTabChange}
          tabs={mockTabs}
        />
      );

      expect(screen.getByRole('tab', { name: 'First Tab' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tab', { name: 'Second Tab' })).toHaveAttribute('aria-selected', 'false');
      expect(screen.getByRole('tab', { name: 'Third Tab' })).toHaveAttribute('aria-selected', 'false');
    });

    it('applies disabled styling and attributes to disabled tabs', () => {
      render(
        <Tabs
          activeTab="tab1"
          onTabChange={mockOnTabChange}
          tabs={mockTabsWithDisabled}
        />
      );

      const disabledTab = screen.getByRole('tab', { name: 'Disabled Tab' });
      expect(disabledTab).toHaveClass('opacity-50', 'cursor-not-allowed');
      expect(disabledTab).toBeDisabled();
    });
  });

  describe('Badge Rendering', () => {
    it('renders string badges correctly', () => {
      render(
        <Tabs
          activeTab="tab1"
          onTabChange={mockOnTabChange}
          tabs={mockTabsWithBadges}
        />
      );

      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('5')).toHaveClass('bg-blue-100', 'text-blue-800'); // Active tab badge
    });

    it('renders number badges correctly', () => {
      render(
        <Tabs
          activeTab="tab2"
          onTabChange={mockOnTabChange}
          tabs={mockTabsWithBadges}
        />
      );

      expect(screen.getByText('12')).toBeInTheDocument();
      expect(screen.getByText('12')).toHaveClass('bg-blue-100', 'text-blue-800'); // Active tab badge
    });

    it('applies different badge styling for active vs inactive tabs', () => {
      render(
        <Tabs
          activeTab="tab1"
          onTabChange={mockOnTabChange}
          tabs={mockTabsWithBadges}
        />
      );

      const activeBadge = screen.getByText('5');
      const inactiveBadge = screen.getByText('12');

      expect(activeBadge).toHaveClass('bg-blue-100', 'text-blue-800');
      expect(inactiveBadge).toHaveClass('bg-gray-200', 'text-gray-600');
    });

    it('does not render badge when badge prop is undefined', () => {
      render(
        <Tabs
          activeTab="tab3"
          onTabChange={mockOnTabChange}
          tabs={mockTabsWithBadges}
        />
      );

      const tab3 = screen.getByRole('tab', { name: 'Info' });
      expect(tab3.querySelector('.bg-blue-100')).not.toBeInTheDocument();
      expect(tab3.querySelector('.bg-gray-200')).not.toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('calls onTabChange when clicking active tab', async () => {
      render(
        <Tabs
          activeTab="tab1"
          onTabChange={mockOnTabChange}
          tabs={mockTabs}
        />
      );

      await user.click(screen.getByRole('tab', { name: 'Second Tab' }));
      expect(mockOnTabChange).toHaveBeenCalledWith('tab2');
    });

    it('calls onTabChange with correct tab ID on click', async () => {
      render(
        <Tabs
          activeTab="tab1"
          onTabChange={mockOnTabChange}
          tabs={mockTabs}
        />
      );

      await user.click(screen.getByRole('tab', { name: 'Third Tab' }));
      expect(mockOnTabChange).toHaveBeenCalledWith('tab3');
      expect(mockOnTabChange).toHaveBeenCalledTimes(1);
    });

    it('does not call onTabChange when clicking disabled tab', async () => {
      render(
        <Tabs
          activeTab="tab1"
          onTabChange={mockOnTabChange}
          tabs={mockTabsWithDisabled}
        />
      );

      await user.click(screen.getByRole('tab', { name: 'Disabled Tab' }));
      expect(mockOnTabChange).not.toHaveBeenCalled();
    });

    it('handles multiple rapid clicks gracefully', async () => {
      render(
        <Tabs
          activeTab="tab1"
          onTabChange={mockOnTabChange}
          tabs={mockTabs}
        />
      );

      const tab2 = screen.getByRole('tab', { name: 'Second Tab' });
      
      // Click multiple times rapidly
      await user.click(tab2);
      await user.click(tab2);
      await user.click(tab2);

      expect(mockOnTabChange).toHaveBeenCalledTimes(3);
      expect(mockOnTabChange).toHaveBeenCalledWith('tab2');
    });
  });

  describe('Keyboard Navigation', () => {
    it('supports keyboard focus', async () => {
      render(
        <Tabs
          activeTab="tab1"
          onTabChange={mockOnTabChange}
          tabs={mockTabs}
        />
      );

      const firstTab = screen.getByRole('tab', { name: 'First Tab' });
      await user.tab();
      expect(firstTab).toHaveFocus();
    });

    it('supports Enter key activation', async () => {
      render(
        <Tabs
          activeTab="tab1"
          onTabChange={mockOnTabChange}
          tabs={mockTabs}
        />
      );

      const secondTab = screen.getByRole('tab', { name: 'Second Tab' });
      secondTab.focus();
      await user.keyboard('{Enter}');
      expect(mockOnTabChange).toHaveBeenCalledWith('tab2');
    });

    it('supports Space key activation', async () => {
      render(
        <Tabs
          activeTab="tab1"
          onTabChange={mockOnTabChange}
          tabs={mockTabs}
        />
      );

      const thirdTab = screen.getByRole('tab', { name: 'Third Tab' });
      thirdTab.focus();
      await user.keyboard(' ');
      expect(mockOnTabChange).toHaveBeenCalledWith('tab3');
    });

    it('prevents activation of disabled tabs via keyboard', async () => {
      render(
        <Tabs
          activeTab="tab1"
          onTabChange={mockOnTabChange}
          tabs={mockTabsWithDisabled}
        />
      );

      const disabledTab = screen.getByRole('tab', { name: 'Disabled Tab' });
      disabledTab.focus();
      await user.keyboard('{Enter}');
      expect(mockOnTabChange).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('provides proper ARIA roles', () => {
      render(
        <Tabs
          activeTab="tab1"
          onTabChange={mockOnTabChange}
          tabs={mockTabs}
        />
      );

      expect(screen.getAllByRole('tab')).toHaveLength(3);
    });

    it('provides focus ring styles', () => {
      render(
        <Tabs
          activeTab="tab1"
          onTabChange={mockOnTabChange}
          tabs={mockTabs}
        />
      );

      const tabs = screen.getAllByRole('tab');
      tabs.forEach(tab => {
        expect(tab).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-blue-500');
      });
    });

    it('maintains proper tab index for keyboard navigation', () => {
      render(
        <Tabs
          activeTab="tab1"
          onTabChange={mockOnTabChange}
          tabs={mockTabs}
        />
      );

      const tabs = screen.getAllByRole('tab');
      tabs.forEach(tab => {
        // All tabs should be focusable (tabindex 0 or no explicit tabindex)
        expect(tab.getAttribute('tabindex')).not.toBe('-1');
      });
    });
  });

  describe('Dynamic Tab Updates', () => {
    it('updates content when activeTab prop changes', () => {
      const { rerender } = render(
        <Tabs
          activeTab="tab1"
          onTabChange={mockOnTabChange}
          tabs={mockTabs}
        />
      );

      expect(screen.getByTestId('tab1-content')).toBeInTheDocument();

      rerender(
        <Tabs
          activeTab="tab2"
          onTabChange={mockOnTabChange}
          tabs={mockTabs}
        />
      );

      expect(screen.getByTestId('tab2-content')).toBeInTheDocument();
      expect(screen.queryByTestId('tab1-content')).not.toBeInTheDocument();
    });

    it('handles dynamic tabs array changes', () => {
      const initialTabs = mockTabs.slice(0, 2);
      const { rerender } = render(
        <Tabs
          activeTab="tab1"
          onTabChange={mockOnTabChange}
          tabs={initialTabs}
        />
      );

      expect(screen.getAllByRole('tab')).toHaveLength(2);

      rerender(
        <Tabs
          activeTab="tab1"
          onTabChange={mockOnTabChange}
          tabs={mockTabs}
        />
      );

      expect(screen.getAllByRole('tab')).toHaveLength(3);
      expect(screen.getByRole('tab', { name: 'Third Tab' })).toBeInTheDocument();
    });

    it('handles empty tabs array gracefully', () => {
      render(
        <Tabs
          activeTab="tab1"
          onTabChange={mockOnTabChange}
          tabs={[]}
        />
      );

      expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles tabs with identical labels', () => {
      const duplicateLabelTabs: TabItem[] = [
        {
          id: 'tab1',
          label: 'Same Label',
          content: <Tab1Content />,
        },
        {
          id: 'tab2',
          label: 'Same Label',
          content: <Tab2Content />,
        },
      ];

      render(
        <Tabs
          activeTab="tab1"
          onTabChange={mockOnTabChange}
          tabs={duplicateLabelTabs}
        />
      );

      const tabs = screen.getAllByRole('tab', { name: 'Same Label' });
      expect(tabs).toHaveLength(2);
    });

    it('handles very long tab labels', () => {
      const longLabelTabs: TabItem[] = [
        {
          id: 'tab1',
          label: 'This is a very long tab label that might cause overflow issues',
          content: <Tab1Content />,
        },
      ];

      render(
        <Tabs
          activeTab="tab1"
          onTabChange={mockOnTabChange}
          tabs={longLabelTabs}
        />
      );

      const tab = screen.getByRole('tab');
      expect(tab).toBeInTheDocument();
    });

    it('handles null or undefined content', () => {
      const nullContentTabs: TabItem[] = [
        {
          id: 'tab1',
          label: 'Tab with null content',
          content: null as any,
        },
        {
          id: 'tab2', 
          label: 'Tab with undefined content',
          content: undefined as any,
        },
      ];

      expect(() => {
        render(
          <Tabs
            activeTab="tab1"
            onTabChange={mockOnTabChange}
            tabs={nullContentTabs}
          />
        );
      }).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('handles large number of tabs efficiently', () => {
      const manyTabs: TabItem[] = Array.from({ length: 50 }, (_, i) => ({
        id: `tab${i}`,
        label: `Tab ${i}`,
        content: <div>Content {i}</div>,
      }));

      const startTime = performance.now();
      render(
        <Tabs
          activeTab="tab0"
          onTabChange={mockOnTabChange}
          tabs={manyTabs}
        />
      );
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100); // Should render within 100ms
      expect(screen.getAllByRole('tab')).toHaveLength(50);
    });

    it('only renders active tab content', () => {
      render(
        <Tabs
          activeTab="tab2"
          onTabChange={mockOnTabChange}
          tabs={mockTabs}
        />
      );

      // Only tab2 content should be in the DOM
      expect(screen.getByTestId('tab2-content')).toBeInTheDocument();
      expect(screen.queryByTestId('tab1-content')).not.toBeInTheDocument();
      expect(screen.queryByTestId('tab3-content')).not.toBeInTheDocument();
    });
  });

  describe('Component Structure', () => {
    it('has proper semantic structure', () => {
      render(
        <Tabs
          activeTab="tab1"
          onTabChange={mockOnTabChange}
          tabs={mockTabs}
        />
      );

      // Container should have proper flex layout
      const container = screen.getByTestId('tab1-content').closest('.flex.flex-col');
      expect(container).toBeInTheDocument();

      // Tab headers should be in a header section
      const headerSection = screen.getByRole('tab', { name: 'First Tab' }).closest('.border-b');
      expect(headerSection).toBeInTheDocument();

      // Content should be in a separate section
      const contentSection = screen.getByTestId('tab1-content').closest('.flex-1');
      expect(contentSection).toBeInTheDocument();
    });

    it('applies hover styles to tab buttons', () => {
      render(
        <Tabs
          activeTab="tab1"
          onTabChange={mockOnTabChange}
          tabs={mockTabs}
        />
      );

      const inactiveTab = screen.getByRole('tab', { name: 'Second Tab' });
      expect(inactiveTab).toHaveClass('hover:text-gray-700', 'hover:border-gray-300');
    });
  });
});