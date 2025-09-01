import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Home, Folder, Settings, File, Users } from 'lucide-react'
import Sidebar, { type SidebarNavItem, sidebarIcons } from './Sidebar'

const mockNavItems: SidebarNavItem[] = [
  {
    id: 'home',
    label: 'Home',
    icon: <Home />,
    active: true,
  },
  {
    id: 'files',
    label: 'Files',
    icon: <Folder />,
    collapsible: true,
    children: [
      {
        id: 'documents',
        label: 'Documents',
        icon: <File />,
      },
      {
        id: 'images',
        label: 'Images',
        icon: <File />,
        badge: '12',
      },
    ],
  },
  {
    id: 'users',
    label: 'Users',
    icon: <Users />,
    badge: '5',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: <Settings />,
  },
]

const mockFlatItems: SidebarNavItem[] = [
  {
    id: 'item1',
    label: 'First Item',
    icon: <Home />,
  },
  {
    id: 'item2',
    label: 'Second Item',
    icon: <Folder />,
    active: true,
  },
  {
    id: 'item3',
    label: 'Third Item',
    icon: <Settings />,
    badge: '3',
  },
]

describe('Sidebar', () => {
  // Basic Rendering Tests
  describe('rendering', () => {
    it('renders without crashing', () => {
      render(<Sidebar items={mockNavItems} />)
      expect(screen.getByRole('complementary')).toBeInTheDocument()
    })

    it('renders navigation items', () => {
      render(<Sidebar items={mockNavItems} />)
      expect(screen.getByText('Home')).toBeInTheDocument()
      expect(screen.getByText('Files')).toBeInTheDocument()
      expect(screen.getByText('Users')).toBeInTheDocument()
      expect(screen.getByText('Settings')).toBeInTheDocument()
    })

    it('renders item icons', () => {
      render(<Sidebar items={mockNavItems} />)
      // Check for lucide icons by their SVG presence in the button
      const homeItem = screen.getByText('Home').parentElement
      const homeIcon = homeItem?.querySelector('svg')
      expect(homeIcon).toBeInTheDocument()
    })

    it('renders item badges', () => {
      render(<Sidebar items={mockNavItems} />)
      expect(screen.getByText('5')).toBeInTheDocument()
    })

    it('renders header when provided', () => {
      const header = <div data-testid="sidebar-header">Header Content</div>
      render(<Sidebar items={mockFlatItems} header={header} />)
      expect(screen.getByTestId('sidebar-header')).toBeInTheDocument()
    })

    it('renders footer when provided', () => {
      const footer = <div data-testid="sidebar-footer">Footer Content</div>
      render(<Sidebar items={mockFlatItems} footer={footer} />)
      expect(screen.getByTestId('sidebar-footer')).toBeInTheDocument()
    })

    it('renders empty sidebar', () => {
      render(<Sidebar items={[]} />)
      expect(screen.getByRole('complementary')).toBeInTheDocument()
      expect(screen.getByRole('navigation')).toBeInTheDocument()
    })
  })

  // Active State Tests
  describe('active states', () => {
    it('applies active styling to active items', () => {
      render(<Sidebar items={mockNavItems} />)
      const homeItem = screen.getByText('Home').parentElement
      expect(homeItem).toHaveClass('bg-blue-50', 'text-blue-700')
    })

    it('applies normal styling to inactive items', () => {
      render(<Sidebar items={mockNavItems} />)
      const filesItem = screen.getByText('Files').parentElement
      expect(filesItem).toHaveClass('text-graphite-700')
      expect(filesItem).not.toHaveClass('bg-blue-50')
    })

    it('handles items without active state', () => {
      const itemsWithoutActive = mockFlatItems.map(item => ({ ...item, active: undefined }))
      render(<Sidebar items={itemsWithoutActive} />)
      
      const firstItem = screen.getByText('First Item').parentElement
      expect(firstItem).toHaveClass('text-graphite-700')
    })
  })

  // Collapsible Sections Tests
  describe('collapsible sections', () => {
    it('renders collapsible items with expand/collapse icons', () => {
      render(<Sidebar items={mockNavItems} />)
      const filesItem = screen.getByText('Files').parentElement
      // Check for chevron icon
      const chevronIcon = filesItem?.querySelector('svg')
      expect(chevronIcon).toBeInTheDocument()
    })

    it('shows children when expanded by default', () => {
      render(<Sidebar items={mockNavItems} />)
      expect(screen.getByText('Documents')).toBeInTheDocument()
      expect(screen.getByText('Images')).toBeInTheDocument()
    })

    it('toggles children visibility when collapsible item is clicked', async () => {
      const user = userEvent.setup()
      render(<Sidebar items={mockNavItems} />)

      // Children should be visible initially
      expect(screen.getByText('Documents')).toBeInTheDocument()

      // Click to collapse
      const filesItem = screen.getByText('Files').parentElement!
      await user.click(filesItem)

      // Children should be hidden
      expect(screen.queryByText('Documents')).not.toBeInTheDocument()
      expect(screen.queryByText('Images')).not.toBeInTheDocument()

      // Click to expand again
      await user.click(filesItem)

      // Children should be visible again
      expect(screen.getByText('Documents')).toBeInTheDocument()
      expect(screen.getByText('Images')).toBeInTheDocument()
    })

    it('calls onToggle when collapsible item is toggled', async () => {
      const user = userEvent.setup()
      const handleToggle = vi.fn()
      render(<Sidebar items={mockNavItems} onToggle={handleToggle} />)

      const filesItem = screen.getByText('Files').parentElement!
      await user.click(filesItem)

      expect(handleToggle).toHaveBeenCalledWith('files', true)
    })

    it('handles initially collapsed items', () => {
      const collapsedItems = mockNavItems.map(item => 
        item.id === 'files' ? { ...item, collapsed: true } : item
      )
      render(<Sidebar items={collapsedItems} />)

      // Children should not be visible
      expect(screen.queryByText('Documents')).not.toBeInTheDocument()
      expect(screen.queryByText('Images')).not.toBeInTheDocument()
    })

    it('does not collapse non-collapsible items with children', () => {
      const nonCollapsibleItems = mockNavItems.map(item => 
        item.id === 'files' ? { ...item, collapsible: false } : item
      )
      render(<Sidebar items={nonCollapsibleItems} />)

      // Children should always be visible for non-collapsible items
      expect(screen.getByText('Documents')).toBeInTheDocument()
    })
  })

  // Item Click Tests
  describe('item clicks', () => {
    it('calls onItemClick when item is clicked', async () => {
      const user = userEvent.setup()
      const handleItemClick = vi.fn()
      render(<Sidebar items={mockNavItems} onItemClick={handleItemClick} />)

      const homeItem = screen.getByText('Home').parentElement!
      await user.click(homeItem)

      expect(handleItemClick).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'home', label: 'Home' })
      )
    })

    it('calls custom onClick when item has one', async () => {
      const user = userEvent.setup()
      const customClick = vi.fn()
      const itemsWithCustomClick = [
        { ...mockFlatItems[0], onClick: customClick }
      ]
      render(<Sidebar items={itemsWithCustomClick} />)

      const firstItem = screen.getByText('First Item').parentElement!
      await user.click(firstItem)

      expect(customClick).toHaveBeenCalled()
    })

    it('handles both onItemClick and custom onClick', async () => {
      const user = userEvent.setup()
      const handleItemClick = vi.fn()
      const customClick = vi.fn()
      const itemsWithBoth = [
        { ...mockFlatItems[0], onClick: customClick }
      ]
      render(<Sidebar items={itemsWithBoth} onItemClick={handleItemClick} />)

      const firstItem = screen.getByText('First Item').parentElement!
      await user.click(firstItem)

      expect(customClick).toHaveBeenCalled()
      expect(handleItemClick).toHaveBeenCalled()
    })
  })

  // Keyboard Navigation Tests
  describe('keyboard navigation', () => {
    it('handles Enter key press on items', async () => {
      const user = userEvent.setup()
      const handleItemClick = vi.fn()
      render(<Sidebar items={mockFlatItems} onItemClick={handleItemClick} />)

      const firstItem = screen.getByText('First Item').parentElement!
      firstItem.focus()
      await user.keyboard('{Enter}')

      expect(handleItemClick).toHaveBeenCalled()
    })

    it('handles Space key press on items', async () => {
      const user = userEvent.setup()
      const handleItemClick = vi.fn()
      render(<Sidebar items={mockFlatItems} onItemClick={handleItemClick} />)

      const firstItem = screen.getByText('First Item').parentElement!
      firstItem.focus()
      await user.keyboard(' ')

      expect(handleItemClick).toHaveBeenCalled()
    })

    it('handles Enter key on collapsible items', async () => {
      const user = userEvent.setup()
      render(<Sidebar items={mockNavItems} />)

      const filesItem = screen.getByText('Files').parentElement!
      filesItem.focus()
      
      // Children should be visible initially
      expect(screen.getByText('Documents')).toBeInTheDocument()
      
      // Press Enter to collapse
      await user.keyboard('{Enter}')
      
      // Children should be hidden
      expect(screen.queryByText('Documents')).not.toBeInTheDocument()
    })

    it('has proper tabindex for keyboard navigation', () => {
      render(<Sidebar items={mockFlatItems} />)
      
      const items = screen.getAllByRole('button')
      items.forEach(item => {
        expect(item).toHaveAttribute('tabindex', '0')
      })
    })
  })

  // Width and Layout Tests
  describe('width and layout', () => {
    it('applies small width class', () => {
      const { container } = render(<Sidebar items={mockFlatItems} width="sm" />)
      const sidebar = container.firstChild
      expect(sidebar).toHaveClass('w-48')
    })

    it('applies medium width class by default', () => {
      const { container } = render(<Sidebar items={mockFlatItems} />)
      const sidebar = container.firstChild
      expect(sidebar).toHaveClass('w-64')
    })

    it('applies large width class', () => {
      const { container } = render(<Sidebar items={mockFlatItems} width="lg" />)
      const sidebar = container.firstChild
      expect(sidebar).toHaveClass('w-80')
    })
  })

  // Collapsed State Tests
  describe('collapsed state', () => {
    it('applies collapsed width when collapsed', () => {
      const { container } = render(<Sidebar items={mockFlatItems} collapsed />)
      const sidebar = container.firstChild
      expect(sidebar).toHaveClass('w-14')
    })

    it('hides labels when collapsed', () => {
      render(<Sidebar items={mockFlatItems} collapsed />)
      expect(screen.queryByText('First Item')).not.toBeInTheDocument()
      expect(screen.queryByText('Second Item')).not.toBeInTheDocument()
    })

    it('shows tooltips when collapsed', () => {
      render(<Sidebar items={mockFlatItems} collapsed />)
      
      // Find the first nav item container (which should have title attribute)
      const navItems = screen.getAllByRole('button')
      const firstItem = navItems[0].parentElement
      expect(firstItem).toHaveAttribute('title', 'First Item')
    })

    it('hides badges when collapsed', () => {
      render(<Sidebar items={mockNavItems} collapsed />)
      expect(screen.queryByText('5')).not.toBeInTheDocument()
    })

    it('hides children when collapsed', () => {
      render(<Sidebar items={mockNavItems} collapsed />)
      expect(screen.queryByText('Documents')).not.toBeInTheDocument()
      expect(screen.queryByText('Images')).not.toBeInTheDocument()
    })

    it('centers items when collapsed', () => {
      render(<Sidebar items={mockFlatItems} collapsed />)
      
      const firstItemButton = screen.getAllByRole('button')[0]
      expect(firstItemButton).toHaveClass('justify-center', 'px-2')
    })

    it('adjusts header padding when collapsed', () => {
      const header = <div data-testid="header">Header</div>
      const { container } = render(
        <Sidebar items={mockFlatItems} collapsed header={header} />
      )
      const headerContainer = screen.getByTestId('header').parentElement
      expect(headerContainer).toHaveClass('px-2')
    })

    it('adjusts footer padding when collapsed', () => {
      const footer = <div data-testid="footer">Footer</div>
      const { container } = render(
        <Sidebar items={mockFlatItems} collapsed footer={footer} />
      )
      const footerContainer = screen.getByTestId('footer').parentElement
      expect(footerContainer).toHaveClass('px-2')
    })
  })

  // Nested Navigation Tests
  describe('nested navigation', () => {
    it('renders nested items with proper indentation', () => {
      render(<Sidebar items={mockNavItems} />)
      
      const documentsItem = screen.getByText('Documents').parentElement
      // Check for indentation class - ml-4 for level 1
      expect(documentsItem).toHaveClass('ml-4')
    })

    it('renders deeply nested items', () => {
      const deeplyNestedItems: SidebarNavItem[] = [
        {
          id: 'level0',
          label: 'Level 0',
          collapsible: true,
          children: [
            {
              id: 'level1',
              label: 'Level 1',
              collapsible: true,
              children: [
                {
                  id: 'level2',
                  label: 'Level 2',
                  children: [
                    {
                      id: 'level3',
                      label: 'Level 3',
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
      
      render(<Sidebar items={deeplyNestedItems} />)
      
      expect(screen.getByText('Level 0')).toBeInTheDocument()
      expect(screen.getByText('Level 1')).toBeInTheDocument()
      expect(screen.getByText('Level 2')).toBeInTheDocument()
      expect(screen.getByText('Level 3')).toBeInTheDocument()
    })

    it('handles nested item clicks', async () => {
      const user = userEvent.setup()
      const handleItemClick = vi.fn()
      render(<Sidebar items={mockNavItems} onItemClick={handleItemClick} />)

      const documentsItem = screen.getByText('Documents').parentElement!
      await user.click(documentsItem)

      expect(handleItemClick).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'documents', label: 'Documents' })
      )
    })

    it('shows badges on nested items', () => {
      render(<Sidebar items={mockNavItems} />)
      expect(screen.getByText('12')).toBeInTheDocument()
    })
  })

  // Custom Styling Tests
  describe('custom styling', () => {
    it('applies custom className', () => {
      const { container } = render(
        <Sidebar items={mockFlatItems} className="custom-sidebar" />
      )
      const sidebar = container.firstChild
      expect(sidebar).toHaveClass('custom-sidebar')
    })

    it('combines custom className with default classes', () => {
      const { container } = render(
        <Sidebar items={mockFlatItems} className="custom-sidebar" />
      )
      const sidebar = container.firstChild
      expect(sidebar).toHaveClass('custom-sidebar', 'flex', 'flex-col', 'h-full')
    })
  })

  // Accessibility Tests
  describe('accessibility', () => {
    it('has proper ARIA roles', () => {
      render(<Sidebar items={mockFlatItems} />)
      
      expect(screen.getByRole('complementary')).toBeInTheDocument()
      expect(screen.getByRole('navigation')).toBeInTheDocument()
    })

    it('has proper button roles for interactive items', () => {
      render(<Sidebar items={mockFlatItems} />)
      
      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(3)
    })

    it('supports keyboard navigation', () => {
      render(<Sidebar items={mockFlatItems} />)
      
      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        expect(button).toHaveAttribute('tabindex', '0')
      })
    })

    it('provides tooltips for collapsed items', () => {
      render(<Sidebar items={mockFlatItems} collapsed showTooltips />)
      
      // Check that collapsed items have title attributes for tooltips
      const navButtons = screen.getAllByRole('button')
      const firstButton = navButtons[0]
      const tooltipContainer = firstButton.parentElement
      expect(tooltipContainer).toHaveAttribute('title')
    })
  })

  // Edge Cases Tests
  describe('edge cases', () => {
    it('handles items without icons', () => {
      const itemsWithoutIcons = mockFlatItems.map(item => ({ ...item, icon: undefined }))
      render(<Sidebar items={itemsWithoutIcons} />)
      
      expect(screen.getByText('First Item')).toBeInTheDocument()
      expect(screen.getByText('Second Item')).toBeInTheDocument()
    })

    it('handles items without labels', () => {
      const itemsWithoutLabels: SidebarNavItem[] = [
        {
          id: 'no-label',
          label: '',
          icon: <Home />,
        }
      ]
      render(<Sidebar items={itemsWithoutLabels} />)
      
      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
    })

    it('handles items with very long labels', () => {
      const itemsWithLongLabels: SidebarNavItem[] = [
        {
          id: 'long-label',
          label: 'This is a very long label that should be truncated properly to fit within the sidebar width constraints',
          icon: <Home />,
        }
      ]
      render(<Sidebar items={itemsWithLongLabels} />)
      
      const labelSpan = screen.getByText(/This is a very long label/)
      expect(labelSpan).toHaveClass('truncate')
    })

    it('handles empty children arrays', () => {
      const itemsWithEmptyChildren: SidebarNavItem[] = [
        {
          id: 'empty-children',
          label: 'Empty Children',
          children: [],
          collapsible: true,
        }
      ]
      render(<Sidebar items={itemsWithEmptyChildren} />)
      
      expect(screen.getByText('Empty Children')).toBeInTheDocument()
    })

    it('handles mixed collapsible and non-collapsible items', () => {
      const mixedItems: SidebarNavItem[] = [
        {
          id: 'collapsible',
          label: 'Collapsible',
          collapsible: true,
          children: [{ id: 'child1', label: 'Child 1' }]
        },
        {
          id: 'non-collapsible',
          label: 'Non-Collapsible',
          children: [{ id: 'child2', label: 'Child 2' }]
        }
      ]
      render(<Sidebar items={mixedItems} />)
      
      expect(screen.getByText('Collapsible')).toBeInTheDocument()
      expect(screen.getByText('Non-Collapsible')).toBeInTheDocument()
      expect(screen.getByText('Child 1')).toBeInTheDocument()
      expect(screen.getByText('Child 2')).toBeInTheDocument()
    })
  })

  // Integration Tests
  describe('integration', () => {
    it('works with complex navigation scenario', async () => {
      const user = userEvent.setup()
      const handleItemClick = vi.fn()
      const handleToggle = vi.fn()
      
      render(
        <Sidebar 
          items={mockNavItems}
          onItemClick={handleItemClick}
          onToggle={handleToggle}
        />
      )

      // Click on a regular item
      const homeItem = screen.getByText('Home').parentElement!
      await user.click(homeItem)
      expect(handleItemClick).toHaveBeenCalledTimes(1)

      // Toggle a collapsible item
      const filesItem = screen.getByText('Files').parentElement!
      await user.click(filesItem)
      expect(handleToggle).toHaveBeenCalledWith('files', true)

      // Click on a nested item
      await user.click(filesItem) // Expand again
      await waitFor(() => {
        const documentsItem = screen.getByText('Documents').parentElement!
        user.click(documentsItem)
      })
      
      expect(handleItemClick).toHaveBeenCalledTimes(3) // home + files + documents
    })

    it('maintains state across prop changes', () => {
      const { rerender } = render(<Sidebar items={mockNavItems} />)
      
      // Initial render should show children
      expect(screen.getByText('Documents')).toBeInTheDocument()
      
      // Rerender with different props but same items
      rerender(<Sidebar items={mockNavItems} width="lg" />)
      
      // Children should still be visible
      expect(screen.getByText('Documents')).toBeInTheDocument()
    })
  })

  // sidebarIcons Export Tests
  describe('sidebarIcons export', () => {
    it('exports common icons', () => {
      expect(sidebarIcons.Home).toBeDefined()
      expect(sidebarIcons.Folder).toBeDefined()
      expect(sidebarIcons.FolderOpen).toBeDefined()
      expect(sidebarIcons.File).toBeDefined()
      expect(sidebarIcons.Settings).toBeDefined()
      expect(sidebarIcons.Users).toBeDefined()
      expect(sidebarIcons.Search).toBeDefined()
    })

    it('icons can be used in items', () => {
      const itemsWithSidebarIcons: SidebarNavItem[] = [
        {
          id: 'home',
          label: 'Home',
          icon: <sidebarIcons.Home />,
        }
      ]
      
      render(<Sidebar items={itemsWithSidebarIcons} />)
      expect(screen.getByText('Home')).toBeInTheDocument()
    })
  })
})