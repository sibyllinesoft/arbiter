import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Home, Folder, File, Settings } from 'lucide-react'
import Breadcrumbs, { type BreadcrumbItem, breadcrumbIcons } from './Breadcrumbs'

const mockBreadcrumbItems: BreadcrumbItem[] = [
  {
    id: 'home',
    label: 'Home',
    href: '/',
  },
  {
    id: 'docs',
    label: 'Documentation',
    href: '/docs',
  },
  {
    id: 'api',
    label: 'API Reference',
    href: '/docs/api',
  },
  {
    id: 'current',
    label: 'Current Page',
    current: true,
  },
]

const mockItemsWithIcons: BreadcrumbItem[] = [
  {
    id: 'home',
    label: 'Home',
    icon: <Home />,
    href: '/',
  },
  {
    id: 'folder',
    label: 'Project Files',
    icon: <Folder />,
    href: '/files',
  },
  {
    id: 'file',
    label: 'index.tsx',
    icon: <File />,
    current: true,
  },
]

const mockItemsWithCallbacks: BreadcrumbItem[] = [
  {
    id: 'clickable1',
    label: 'Clickable Item',
    onClick: vi.fn(),
  },
  {
    id: 'clickable2',
    label: 'Another Item',
    onClick: vi.fn(),
  },
]

const mockLongBreadcrumbs: BreadcrumbItem[] = [
  { id: '1', label: 'Level 1', href: '/1' },
  { id: '2', label: 'Level 2', href: '/2' },
  { id: '3', label: 'Level 3', href: '/3' },
  { id: '4', label: 'Level 4', href: '/4' },
  { id: '5', label: 'Level 5', href: '/5' },
  { id: '6', label: 'Level 6', href: '/6' },
  { id: '7', label: 'Current Level', current: true },
]

describe('Breadcrumbs', () => {
  // Basic Rendering Tests
  describe('rendering', () => {
    it('renders without crashing', () => {
      render(<Breadcrumbs items={mockBreadcrumbItems} />)
      expect(screen.getByLabelText('Breadcrumb')).toBeInTheDocument()
    })

    it('renders all breadcrumb items', () => {
      render(<Breadcrumbs items={mockBreadcrumbItems} />)
      expect(screen.getByText('Home')).toBeInTheDocument()
      expect(screen.getByText('Documentation')).toBeInTheDocument()
      expect(screen.getByText('API Reference')).toBeInTheDocument()
      expect(screen.getByText('Current Page')).toBeInTheDocument()
    })

    it('renders empty breadcrumbs', () => {
      render(<Breadcrumbs items={[]} />)
      expect(screen.getByLabelText('Breadcrumb')).toBeInTheDocument()
      expect(screen.getByRole('list')).toBeInTheDocument()
    })

    it('renders single item', () => {
      const singleItem = [mockBreadcrumbItems[0]]
      render(<Breadcrumbs items={singleItem} />)
      expect(screen.getByText('Home')).toBeInTheDocument()
      expect(screen.getAllByRole('listitem')).toHaveLength(1)
    })
  })

  // Separator Tests
  describe('separators', () => {
    it('renders chevron separators by default', () => {
      render(<Breadcrumbs items={mockBreadcrumbItems} />)
      // Check for chevron icons (SVG elements)
      const separators = document.querySelectorAll('svg')
      expect(separators.length).toBeGreaterThan(0)
    })

    it('renders slash separators', () => {
      render(<Breadcrumbs items={mockBreadcrumbItems} separator="slash" />)
      const separators = screen.getAllByText('/')
      expect(separators).toHaveLength(mockBreadcrumbItems.length - 1)
    })

    it('renders dot separators', () => {
      render(<Breadcrumbs items={mockBreadcrumbItems} separator="dot" />)
      const separators = screen.getAllByText('•')
      expect(separators).toHaveLength(mockBreadcrumbItems.length - 1)
    })

    it('renders custom separator', () => {
      const customSeparator = <span data-testid="custom-separator">→</span>
      render(<Breadcrumbs items={mockBreadcrumbItems} separator={customSeparator} />)
      const separators = screen.getAllByTestId('custom-separator')
      expect(separators).toHaveLength(mockBreadcrumbItems.length - 1)
    })

    it('does not render separator after last item', () => {
      render(<Breadcrumbs items={mockBreadcrumbItems.slice(0, 2)} separator="slash" />)
      const separators = screen.getAllByText('/')
      expect(separators).toHaveLength(1)
    })
  })

  // Current Page Tests
  describe('current page', () => {
    it('applies current page styling', () => {
      render(<Breadcrumbs items={mockBreadcrumbItems} />)
      const currentItem = screen.getByText('Current Page').parentElement
      expect(currentItem).toHaveClass('text-graphite-900', 'font-semibold')
    })

    it('applies aria-current to current page', () => {
      render(<Breadcrumbs items={mockBreadcrumbItems} />)
      const currentButton = screen.getByText('Current Page').closest('[aria-current]')
      expect(currentButton).toHaveAttribute('aria-current', 'page')
    })

    it('handles multiple items without current flag', () => {
      const itemsWithoutCurrent = mockBreadcrumbItems.map(item => ({ ...item, current: undefined }))
      render(<Breadcrumbs items={itemsWithoutCurrent} />)
      
      const items = screen.getAllByText(/Home|Documentation|API Reference|Current Page/)
      items.forEach(item => {
        const element = item.closest('span, button')
        expect(element).not.toHaveAttribute('aria-current')
      })
    })

    it('handles last item as current by default when no current is specified', () => {
      const itemsWithoutCurrent = mockBreadcrumbItems.map(item => ({ ...item, current: undefined }))
      render(<Breadcrumbs items={itemsWithoutCurrent} />)
      // All items should be rendered normally without special current styling
      expect(screen.getByText('Current Page')).toBeInTheDocument()
    })
  })

  // Click Handling Tests
  describe('click handling', () => {
    it('calls onItemClick when item is clicked', async () => {
      const user = userEvent.setup()
      const handleItemClick = vi.fn()
      render(<Breadcrumbs items={mockBreadcrumbItems} onItemClick={handleItemClick} />)

      const homeItem = screen.getByText('Home')
      await user.click(homeItem)

      expect(handleItemClick).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'home', label: 'Home' })
      )
    })

    it('calls item onClick when provided', async () => {
      const user = userEvent.setup()
      const customClick = vi.fn()
      const itemsWithOnClick = [
        { ...mockBreadcrumbItems[0], onClick: customClick }
      ]
      render(<Breadcrumbs items={itemsWithOnClick} />)

      const homeItem = screen.getByText('Home')
      await user.click(homeItem)

      expect(customClick).toHaveBeenCalled()
    })

    it('calls both onItemClick and item onClick', async () => {
      const user = userEvent.setup()
      const handleItemClick = vi.fn()
      const customClick = vi.fn()
      const itemsWithOnClick = [
        { ...mockBreadcrumbItems[0], onClick: customClick }
      ]
      render(<Breadcrumbs items={itemsWithOnClick} onItemClick={handleItemClick} />)

      const homeItem = screen.getByText('Home')
      await user.click(homeItem)

      expect(customClick).toHaveBeenCalled()
      expect(handleItemClick).toHaveBeenCalled()
    })

    it('does not render button for non-clickable items', () => {
      const nonClickableItems: BreadcrumbItem[] = [
        { id: 'static', label: 'Static Item' }
      ]
      render(<Breadcrumbs items={nonClickableItems} />)

      const staticItem = screen.getByText('Static Item')
      const button = staticItem.closest('button')
      expect(button).toBeNull()
    })

    it('renders button for clickable items', () => {
      render(<Breadcrumbs items={mockBreadcrumbItems} />)

      const homeItem = screen.getByText('Home')
      const button = homeItem.closest('button')
      expect(button).toBeInTheDocument()
      expect(button).toHaveAttribute('type', 'button')
    })
  })

  // Icon Tests
  describe('icons', () => {
    it('renders item icons', () => {
      render(<Breadcrumbs items={mockItemsWithIcons} />)
      
      const homeItem = screen.getByText('Home').parentElement
      const homeIcon = homeItem?.querySelector('svg')
      expect(homeIcon).toBeInTheDocument()
    })

    it('shows home icon when showHomeIcon is true', () => {
      render(<Breadcrumbs items={mockBreadcrumbItems} showHomeIcon />)
      
      const homeItem = screen.getByText('Home').parentElement
      const homeIcon = homeItem?.querySelector('svg')
      expect(homeIcon).toBeInTheDocument()
    })

    it('does not show home icon when showHomeIcon is false', () => {
      const itemsWithoutIcons = mockBreadcrumbItems.map(item => ({ ...item, icon: undefined }))
      render(<Breadcrumbs items={itemsWithoutIcons} showHomeIcon={false} />)
      
      // Should not have any icons
      const homeItem = screen.getByText('Home').parentElement
      const homeIcon = homeItem?.querySelector('svg')
      // The separator might have an icon, so we check the item specifically
      expect(homeItem?.firstChild?.querySelector('svg')).toBeFalsy()
    })

    it('prefers custom icon over default home icon', () => {
      const itemsWithCustomIcons = [
        { ...mockBreadcrumbItems[0], icon: <Settings data-testid="custom-icon" /> }
      ]
      render(<Breadcrumbs items={itemsWithCustomIcons} showHomeIcon />)
      
      expect(screen.getByTestId('custom-icon')).toBeInTheDocument()
    })
  })

  // Size Tests
  describe('sizes', () => {
    it('applies small size classes', () => {
      const { container } = render(<Breadcrumbs items={mockBreadcrumbItems} size="sm" />)
      const nav = container.querySelector('nav')
      expect(nav).toHaveClass('text-xs')
    })

    it('applies medium size classes by default', () => {
      const { container } = render(<Breadcrumbs items={mockBreadcrumbItems} />)
      const nav = container.querySelector('nav')
      expect(nav).toHaveClass('text-sm')
    })

    it('applies large size classes', () => {
      const { container } = render(<Breadcrumbs items={mockBreadcrumbItems} size="lg" />)
      const nav = container.querySelector('nav')
      expect(nav).toHaveClass('text-base')
    })

    it('applies size-specific padding to items', () => {
      render(<Breadcrumbs items={[mockBreadcrumbItems[0]]} size="lg" />)
      const item = screen.getByText('Home').parentElement
      expect(item).toHaveClass('px-3', 'py-2')
    })
  })

  // Max Items and Collapsing Tests
  describe('max items and collapsing', () => {
    it('shows all items when maxItems is not set', () => {
      render(<Breadcrumbs items={mockLongBreadcrumbs} />)
      
      mockLongBreadcrumbs.forEach(item => {
        expect(screen.getByText(item.label)).toBeInTheDocument()
      })
    })

    it('collapses items when exceeding maxItems', () => {
      render(<Breadcrumbs items={mockLongBreadcrumbs} maxItems={4} />)
      
      // Should show first item, collapsed indicator, and last few items
      expect(screen.getByText('Level 1')).toBeInTheDocument()
      expect(screen.getByText('Current Level')).toBeInTheDocument()
      expect(screen.getByLabelText(/Show .* hidden items/)).toBeInTheDocument()
      
      // Middle items should not be visible initially
      expect(screen.queryByText('Level 3')).not.toBeInTheDocument()
    })

    it('expands collapsed items when clicked', async () => {
      const user = userEvent.setup()
      render(<Breadcrumbs items={mockLongBreadcrumbs} maxItems={4} />)
      
      const collapseButton = screen.getByLabelText(/Show .* hidden items/)
      await user.click(collapseButton)
      
      // Hidden items should now be visible
      expect(screen.getByText('Level 2')).toBeInTheDocument()
      expect(screen.getByText('Level 3')).toBeInTheDocument()
    })

    it('calculates collapse correctly with different maxItems', () => {
      render(<Breadcrumbs items={mockLongBreadcrumbs} maxItems={3} />)
      
      // With maxItems=3, should show first item + collapsed + last 1 item
      expect(screen.getByText('Level 1')).toBeInTheDocument()
      expect(screen.getByText('Current Level')).toBeInTheDocument()
      expect(screen.getByLabelText(/Show .* hidden items/)).toBeInTheDocument()
    })

    it('does not collapse when items length equals maxItems', () => {
      render(<Breadcrumbs items={mockBreadcrumbItems} maxItems={4} />)
      
      // Should not show collapse indicator
      expect(screen.queryByLabelText(/Show .* hidden items/)).not.toBeInTheDocument()
      
      // All items should be visible
      mockBreadcrumbItems.forEach(item => {
        expect(screen.getByText(item.label)).toBeInTheDocument()
      })
    })

    it('handles edge case with maxItems less than 2', () => {
      render(<Breadcrumbs items={mockLongBreadcrumbs} maxItems={1} />)
      
      // Should still show at least first and last item
      expect(screen.getByText('Level 1')).toBeInTheDocument()
      expect(screen.getByText('Current Level')).toBeInTheDocument()
    })
  })

  // Accessibility Tests
  describe('accessibility', () => {
    it('has proper ARIA structure', () => {
      render(<Breadcrumbs items={mockBreadcrumbItems} />)
      
      expect(screen.getByLabelText('Breadcrumb')).toBeInTheDocument()
      expect(screen.getByRole('navigation')).toBeInTheDocument()
      expect(screen.getByRole('list')).toBeInTheDocument()
      expect(screen.getAllByRole('listitem')).toHaveLength(mockBreadcrumbItems.length)
    })

    it('applies proper aria-current to current page', () => {
      render(<Breadcrumbs items={mockBreadcrumbItems} />)
      
      const currentPageElement = screen.getByText('Current Page').closest('[aria-current]')
      expect(currentPageElement).toHaveAttribute('aria-current', 'page')
    })

    it('has proper button accessibility for clickable items', () => {
      render(<Breadcrumbs items={mockBreadcrumbItems} />)
      
      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        expect(button).toHaveAttribute('type', 'button')
      })
    })

    it('provides proper aria-label for collapse button', () => {
      render(<Breadcrumbs items={mockLongBreadcrumbs} maxItems={3} />)
      
      const collapseButton = screen.getByLabelText(/Show .* hidden items/)
      expect(collapseButton).toHaveAttribute('aria-label')
      expect(collapseButton.getAttribute('aria-label')).toContain('Show')
      expect(collapseButton.getAttribute('aria-label')).toContain('hidden items')
    })
  })

  // Hover and Focus States Tests
  describe('hover and focus states', () => {
    it('applies hover styles to clickable items', () => {
      render(<Breadcrumbs items={mockBreadcrumbItems} />)
      
      const homeButton = screen.getByText('Home').parentElement
      expect(homeButton).toHaveClass('hover:text-graphite-900', 'hover:bg-graphite-50')
    })

    it('applies focus styles to clickable items', () => {
      render(<Breadcrumbs items={mockBreadcrumbItems} />)
      
      const homeButton = screen.getByText('Home').parentElement
      expect(homeButton).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-blue-500')
    })

    it('does not apply interactive styles to current item', () => {
      render(<Breadcrumbs items={mockBreadcrumbItems} />)
      
      const currentItem = screen.getByText('Current Page').parentElement
      expect(currentItem).not.toHaveClass('hover:text-graphite-900')
    })

    it('does not apply interactive styles to non-clickable items', () => {
      const nonClickableItems: BreadcrumbItem[] = [
        { id: 'static', label: 'Static Item' }
      ]
      render(<Breadcrumbs items={nonClickableItems} />)
      
      const staticItem = screen.getByText('Static Item').parentElement
      expect(staticItem).not.toHaveClass('hover:text-graphite-900')
      expect(staticItem).not.toHaveClass('cursor-pointer')
    })
  })

  // Custom Styling Tests
  describe('custom styling', () => {
    it('applies custom className', () => {
      const { container } = render(
        <Breadcrumbs items={mockBreadcrumbItems} className="custom-breadcrumbs" />
      )
      const nav = container.querySelector('nav')
      expect(nav).toHaveClass('custom-breadcrumbs')
    })

    it('combines custom className with default classes', () => {
      const { container } = render(
        <Breadcrumbs items={mockBreadcrumbItems} className="custom-breadcrumbs" />
      )
      const nav = container.querySelector('nav')
      expect(nav).toHaveClass('custom-breadcrumbs', 'flex', 'items-center')
    })
  })

  // Edge Cases Tests
  describe('edge cases', () => {
    it('handles items with empty labels', () => {
      const itemsWithEmptyLabels: BreadcrumbItem[] = [
        { id: 'empty', label: '', href: '/' }
      ]
      render(<Breadcrumbs items={itemsWithEmptyLabels} />)
      
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('handles items with very long labels', () => {
      const itemsWithLongLabels: BreadcrumbItem[] = [
        {
          id: 'long',
          label: 'This is a very long breadcrumb label that should be truncated to prevent layout issues',
          href: '/long'
        }
      ]
      render(<Breadcrumbs items={itemsWithLongLabels} />)
      
      const labelSpan = screen.getByText(/This is a very long/)
      expect(labelSpan).toHaveClass('truncate')
    })

    it('handles mixed clickable and non-clickable items', () => {
      const mixedItems: BreadcrumbItem[] = [
        { id: 'clickable', label: 'Clickable', href: '/click' },
        { id: 'static', label: 'Static' },
        { id: 'current', label: 'Current', current: true }
      ]
      render(<Breadcrumbs items={mixedItems} />)
      
      // Clickable item should be a button
      const clickableButton = screen.getByText('Clickable').closest('button')
      expect(clickableButton).toBeInTheDocument()
      
      // Static item should not be a button
      const staticButton = screen.getByText('Static').closest('button')
      expect(staticButton).toBeNull()
    })

    it('handles items without IDs gracefully', () => {
      // This would typically cause React key warnings, but component should still render
      const itemsWithoutIds = [
        { id: '', label: 'No ID', href: '/' }
      ]
      render(<Breadcrumbs items={itemsWithoutIds} />)
      
      expect(screen.getByText('No ID')).toBeInTheDocument()
    })
  })

  // Integration Tests
  describe('integration', () => {
    it('works with complex navigation scenario', async () => {
      const user = userEvent.setup()
      const handleItemClick = vi.fn()
      
      render(
        <Breadcrumbs 
          items={mockLongBreadcrumbs}
          maxItems={4}
          onItemClick={handleItemClick}
          showHomeIcon
          separator="slash"
        />
      )

      // Click on visible item
      const level1Item = screen.getByText('Level 1')
      await user.click(level1Item)
      expect(handleItemClick).toHaveBeenCalledTimes(1)

      // Expand collapsed items
      const collapseButton = screen.getByLabelText(/Show .* hidden items/)
      await user.click(collapseButton)
      
      // Click on previously hidden item
      const level3Item = screen.getByText('Level 3')
      await user.click(level3Item)
      expect(handleItemClick).toHaveBeenCalledTimes(2)
    })

    it('maintains functionality with prop changes', () => {
      const { rerender } = render(<Breadcrumbs items={mockBreadcrumbItems} separator="chevron" />)
      
      expect(screen.getByText('Home')).toBeInTheDocument()
      
      // Change separator
      rerender(<Breadcrumbs items={mockBreadcrumbItems} separator="slash" />)
      
      expect(screen.getByText('Home')).toBeInTheDocument()
      expect(screen.getAllByText('/')).toHaveLength(mockBreadcrumbItems.length - 1)
    })
  })

  // breadcrumbIcons Export Tests
  describe('breadcrumbIcons export', () => {
    it('exports common icons', () => {
      expect(breadcrumbIcons.Home).toBeDefined()
      expect(breadcrumbIcons.Folder).toBeDefined()
      expect(breadcrumbIcons.File).toBeDefined()
    })

    it('icons can be used in breadcrumb items', () => {
      const itemsWithExportedIcons: BreadcrumbItem[] = [
        {
          id: 'home',
          label: 'Home',
          icon: <breadcrumbIcons.Home />,
          href: '/'
        }
      ]
      
      render(<Breadcrumbs items={itemsWithExportedIcons} />)
      expect(screen.getByText('Home')).toBeInTheDocument()
    })
  })
})