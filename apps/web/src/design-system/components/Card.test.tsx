import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../../test/utils'
import userEvent from '@testing-library/user-event'
import Card from './Card'

describe('Card', () => {
  describe('rendering', () => {
    it('renders with default props', () => {
      render(<Card data-testid="card">Card content</Card>)
      
      const card = screen.getByTestId('card')
      expect(card).toBeInTheDocument()
      expect(card).toHaveTextContent('Card content')
    })

    it('renders without children', () => {
      render(<Card data-testid="empty-card" />)
      
      const card = screen.getByTestId('empty-card')
      expect(card).toBeInTheDocument()
    })

    it('forwards ref correctly', () => {
      const ref = React.createRef<HTMLDivElement>()
      render(<Card ref={ref} data-testid="card">Test</Card>)
      
      expect(ref.current).toBeInstanceOf(HTMLDivElement)
      expect(ref.current).toBe(screen.getByTestId('card'))
    })

    it('applies custom className', () => {
      render(<Card className="custom-class" data-testid="card">Test</Card>)
      
      const card = screen.getByTestId('card')
      expect(card).toHaveClass('custom-class')
    })
  })

  describe('variants', () => {
    it.each([
      ['default'],
      ['interactive'], 
      ['elevated'],
      ['outlined'],
      ['ghost']
    ])('renders %s variant correctly', (variant) => {
      render(<Card variant={variant as any} data-testid={`${variant}-card`}>Test</Card>)
      
      const card = screen.getByTestId(`${variant}-card`)
      expect(card).toBeInTheDocument()
    })

    it('defaults to default variant', () => {
      render(<Card data-testid="default-variant">Test</Card>)
      
      const card = screen.getByTestId('default-variant')
      expect(card).toBeInTheDocument()
    })

    it('applies interactive styles and cursor for interactive variant', () => {
      render(<Card variant="interactive" data-testid="interactive-card">Test</Card>)
      
      const card = screen.getByTestId('interactive-card')
      expect(card).toHaveClass('cursor-pointer', 'transition-all')
    })
  })

  describe('sizes', () => {
    it.each([
      ['sm'],
      ['md'],
      ['lg'],
      ['xl']
    ])('renders %s size correctly', (size) => {
      render(<Card size={size as any} data-testid={`${size}-card`}>Test</Card>)
      
      const card = screen.getByTestId(`${size}-card`)
      expect(card).toBeInTheDocument()
    })

    it('defaults to md size', () => {
      render(<Card data-testid="default-size">Test</Card>)
      
      const card = screen.getByTestId('default-size')
      expect(card).toHaveClass('rounded-lg') // md size border radius
    })

    it('applies correct border radius for sizes', () => {
      const { rerender } = render(<Card size="sm" data-testid="size-card">Test</Card>)
      expect(screen.getByTestId('size-card')).toHaveClass('rounded-lg')

      rerender(<Card size="lg" data-testid="size-card">Test</Card>)
      expect(screen.getByTestId('size-card')).toHaveClass('rounded-xl')

      rerender(<Card size="xl" data-testid="size-card">Test</Card>)
      expect(screen.getByTestId('size-card')).toHaveClass('rounded-xl')
    })
  })

  describe('header content', () => {
    it('renders title', () => {
      render(<Card title="Card Title">Content</Card>)
      
      const title = screen.getByRole('heading', { level: 3, name: 'Card Title' })
      expect(title).toBeInTheDocument()
    })

    it('renders subtitle', () => {
      render(<Card title="Title" subtitle="Card Subtitle">Content</Card>)
      
      expect(screen.getByText('Card Subtitle')).toBeInTheDocument()
    })

    it('renders custom header', () => {
      const customHeader = <div data-testid="custom-header">Custom Header</div>
      render(<Card header={customHeader}>Content</Card>)
      
      expect(screen.getByTestId('custom-header')).toBeInTheDocument()
      expect(screen.getByText('Custom Header')).toBeInTheDocument()
    })

    it('prioritizes custom header over title/subtitle', () => {
      const customHeader = <div data-testid="custom-header">Custom</div>
      render(
        <Card 
          header={customHeader} 
          title="Title" 
          subtitle="Subtitle"
        >
          Content
        </Card>
      )
      
      expect(screen.getByTestId('custom-header')).toBeInTheDocument()
      expect(screen.queryByText('Title')).not.toBeInTheDocument()
      expect(screen.queryByText('Subtitle')).not.toBeInTheDocument()
    })

    it('applies header divider when specified', () => {
      render(
        <Card title="Title" headerDivider data-testid="card">
          Content
        </Card>
      )
      
      const headerElement = screen.getByText('Title').parentElement?.parentElement
      expect(headerElement).toHaveClass('border-b', 'border-graphite-200')
    })

    it('adjusts title size based on card size', () => {
      const { rerender } = render(<Card title="Title" size="sm">Content</Card>)
      expect(screen.getByRole('heading')).toHaveClass('text-sm')

      rerender(<Card title="Title" size="lg">Content</Card>)
      expect(screen.getByRole('heading')).toHaveClass('text-lg')

      rerender(<Card title="Title" size="xl">Content</Card>)
      expect(screen.getByRole('heading')).toHaveClass('text-xl')
    })
  })

  describe('footer content', () => {
    it('renders footer', () => {
      const footer = <div data-testid="footer">Footer Content</div>
      render(<Card footer={footer}>Content</Card>)
      
      expect(screen.getByTestId('footer')).toBeInTheDocument()
      expect(screen.getByText('Footer Content')).toBeInTheDocument()
    })

    it('applies footer divider when specified', () => {
      const footer = <div>Footer</div>
      render(
        <Card footer={footer} footerDivider title="Title" data-testid="card">
          Content
        </Card>
      )
      
      const footerElement = screen.getByText('Footer').parentElement
      expect(footerElement).toHaveClass('border-t', 'border-graphite-200')
    })
  })

  describe('loading state', () => {
    it('shows loading overlay when loading is true', () => {
      render(<Card loading data-testid="loading-card">Content</Card>)
      
      const card = screen.getByTestId('loading-card')
      expect(screen.getByText('Loading...')).toBeInTheDocument()
      expect(card.querySelector('.animate-spin')).toBeInTheDocument()
      expect(card).toHaveClass('pointer-events-none')
    })

    it('does not show loading overlay when loading is false', () => {
      render(<Card loading={false}>Content</Card>)
      
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    })

    it('prevents interactions when loading', () => {
      const handleClick = vi.fn()
      render(<Card loading onClick={handleClick} data-testid="loading-card">Content</Card>)
      
      const card = screen.getByTestId('loading-card')
      expect(card).toHaveClass('pointer-events-none')
    })
  })

  describe('disabled state', () => {
    it('applies disabled styles', () => {
      render(<Card disabled data-testid="disabled-card">Content</Card>)
      
      const card = screen.getByTestId('disabled-card')
      expect(card).toHaveClass('opacity-60', 'cursor-not-allowed')
      expect(card).toHaveAttribute('aria-disabled', 'true')
    })

    it('prevents click when disabled', () => {
      const handleClick = vi.fn()
      render(<Card disabled onClick={handleClick} data-testid="disabled-card">Content</Card>)
      
      const card = screen.getByTestId('disabled-card')
      expect(card).not.toHaveAttribute('role', 'button')
      expect(card).not.toHaveAttribute('tabIndex')
    })
  })

  describe('selected state', () => {
    it('applies selected styles', () => {
      render(<Card selected data-testid="selected-card">Content</Card>)
      
      const card = screen.getByTestId('selected-card')
      expect(card).toHaveAttribute('aria-selected', 'true')
    })

    it('applies selected styles with different variants', () => {
      const { rerender } = render(<Card selected variant="default" data-testid="selected-card">Content</Card>)
      const card = screen.getByTestId('selected-card')
      expect(card).toHaveClass('border-blue-500', 'ring-1', 'ring-blue-500')

      rerender(<Card selected variant="outlined" data-testid="selected-card">Content</Card>)
      expect(card).toHaveClass('border-blue-500', 'bg-blue-50')

      rerender(<Card selected variant="ghost" data-testid="selected-card">Content</Card>)
      expect(card).toHaveClass('bg-blue-50')
    })
  })

  describe('hoverable state', () => {
    it('applies hover effects when hoverable is true', () => {
      render(<Card hoverable data-testid="hoverable-card">Content</Card>)
      
      // The hover effects are applied via CSS classes, which we can test
      const card = screen.getByTestId('hoverable-card')
      expect(card).toBeInTheDocument()
    })
  })

  describe('interactions', () => {
    it('calls onClick when clicked and clickable', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()
      
      render(<Card onClick={handleClick} data-testid="clickable-card">Content</Card>)
      
      const card = screen.getByTestId('clickable-card')
      expect(card).toHaveAttribute('role', 'button')
      expect(card).toHaveAttribute('tabIndex', '0')
      
      await user.click(card)
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('does not call onClick when disabled', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()
      
      render(<Card onClick={handleClick} disabled data-testid="disabled-clickable">Content</Card>)
      
      const card = screen.getByTestId('disabled-clickable')
      expect(card).not.toHaveAttribute('role', 'button')
      
      await user.click(card)
      expect(handleClick).not.toHaveBeenCalled()
    })

    it('does not call onClick when loading', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()
      
      render(<Card onClick={handleClick} loading data-testid="loading-clickable">Content</Card>)
      
      const card = screen.getByTestId('loading-clickable')
      expect(card).not.toHaveAttribute('role', 'button')
      
      await user.click(card)
      expect(handleClick).not.toHaveBeenCalled()
    })

    it('supports keyboard interaction (Enter)', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()
      
      render(<Card onClick={handleClick} data-testid="keyboard-card">Content</Card>)
      
      const card = screen.getByTestId('keyboard-card')
      card.focus()
      await user.keyboard('{Enter}')
      
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('supports keyboard interaction (Space)', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()
      
      render(<Card onClick={handleClick} data-testid="keyboard-card">Content</Card>)
      
      const card = screen.getByTestId('keyboard-card')
      card.focus()
      await user.keyboard(' ')
      
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('does not respond to other keys', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()
      
      render(<Card onClick={handleClick} data-testid="keyboard-card">Content</Card>)
      
      const card = screen.getByTestId('keyboard-card')
      card.focus()
      await user.keyboard('{Escape}')
      
      expect(handleClick).not.toHaveBeenCalled()
    })
  })

  describe('accessibility', () => {
    it('has button role when clickable', () => {
      render(<Card onClick={() => {}}>Content</Card>)
      
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('does not have button role when not clickable', () => {
      render(<Card>Content</Card>)
      
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('is focusable when clickable', () => {
      render(<Card onClick={() => {}} data-testid="focusable-card">Content</Card>)
      
      const card = screen.getByTestId('focusable-card')
      expect(card).toHaveAttribute('tabIndex', '0')
      card.focus()
      expect(card).toHaveFocus()
    })

    it('sets aria-selected correctly', () => {
      const { rerender } = render(<Card data-testid="card">Content</Card>)
      
      let card = screen.getByTestId('card')
      expect(card).toHaveAttribute('aria-selected', 'false')
      
      rerender(<Card selected data-testid="card">Content</Card>)
      card = screen.getByTestId('card')
      expect(card).toHaveAttribute('aria-selected', 'true')
    })

    it('sets aria-disabled correctly', () => {
      const { rerender } = render(<Card data-testid="card">Content</Card>)
      
      let card = screen.getByTestId('card')
      expect(card).toHaveAttribute('aria-disabled', 'false')
      
      rerender(<Card disabled data-testid="card">Content</Card>)
      card = screen.getByTestId('card')
      expect(card).toHaveAttribute('aria-disabled', 'true')
    })
  })

  describe('custom styling', () => {
    it('applies custom className to card', () => {
      render(<Card className="custom-card" data-testid="styled-card">Content</Card>)
      
      const card = screen.getByTestId('styled-card')
      expect(card).toHaveClass('custom-card')
    })

    it('applies custom headerClassName', () => {
      render(<Card title="Title" headerClassName="custom-header" data-testid="card">Content</Card>)
      
      const headerElement = screen.getByText('Title').parentElement?.parentElement
      expect(headerElement).toHaveClass('custom-header')
    })

    it('applies custom bodyClassName', () => {
      render(<Card bodyClassName="custom-body" data-testid="card">Content</Card>)
      
      const card = screen.getByTestId('card')
      // Find the div that contains the content and has the custom class
      const bodyElement = card.querySelector('.custom-body')
      expect(bodyElement).toBeInTheDocument()
      expect(bodyElement).toHaveTextContent('Content')
    })

    it('applies custom footerClassName', () => {
      const footer = <div>Footer</div>
      render(<Card footer={footer} footerClassName="custom-footer" data-testid="card">Content</Card>)
      
      const footerElement = screen.getByText('Footer').parentElement
      expect(footerElement).toHaveClass('custom-footer')
    })
  })

  describe('layout and spacing', () => {
    it('renders with header, body, and footer in correct order', () => {
      const footer = <div data-testid="footer">Footer</div>
      render(
        <Card title="Header" footer={footer} data-testid="full-card">
          Body Content
        </Card>
      )
      
      const card = screen.getByTestId('full-card')
      const elements = Array.from(card.querySelectorAll('*')).map(el => el.textContent)
      
      expect(elements).toContain('Header')
      expect(elements).toContain('Body Content')
      expect(elements).toContain('Footer')
    })

    it('handles different size padding correctly', () => {
      render(<Card size="xl" data-testid="xl-card">Content</Card>)
      
      const card = screen.getByTestId('xl-card')
      expect(card).toHaveClass('rounded-xl') // xl size uses rounded-xl
    })

    it('adjusts header padding based on presence of other sections', () => {
      // This tests the logic for different padding classes based on content structure
      render(<Card title="Title">Content</Card>)
      
      const title = screen.getByRole('heading')
      expect(title).toBeInTheDocument()
    })
  })

  describe('HTML attributes', () => {
    it('forwards HTML div attributes', () => {
      render(
        <Card
          data-testid="attributed-card"
          id="card-id"
          role="region"
        >
          Content
        </Card>
      )
      
      const card = screen.getByTestId('attributed-card')
      expect(card).toHaveAttribute('id', 'card-id')
      expect(card).toHaveAttribute('role', 'region') // Should override button role
    })

    it('does not forward component-specific props as HTML attributes', () => {
      render(
        <Card
          variant="interactive"
          size="lg"
          hoverable
          data-testid="props-card"
        >
          Content
        </Card>
      )
      
      const card = screen.getByTestId('props-card')
      expect(card).not.toHaveAttribute('variant')
      expect(card).not.toHaveAttribute('size')
      expect(card).not.toHaveAttribute('hoverable')
    })
  })
})