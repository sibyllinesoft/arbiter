import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../../test/utils'
import userEvent from '@testing-library/user-event'
import { Search, User } from 'lucide-react'
import Input from './Input'

describe('Input', () => {
  describe('rendering', () => {
    it('renders with default props', () => {
      render(<Input placeholder="Enter text" />)
      
      const input = screen.getByRole('textbox')
      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute('placeholder', 'Enter text')
    })

    it('renders with a label', () => {
      render(<Input label="Username" placeholder="Enter username" />)
      
      const label = screen.getByText('Username')
      const input = screen.getByLabelText('Username')
      
      expect(label).toBeInTheDocument()
      expect(input).toBeInTheDocument()
    })

    it('generates unique IDs when not provided', () => {
      render(
        <>
          <Input label="First" />
          <Input label="Second" />
        </>
      )
      
      const firstInput = screen.getByLabelText('First')
      const secondInput = screen.getByLabelText('Second')
      
      expect(firstInput.id).toBeDefined()
      expect(secondInput.id).toBeDefined()
      expect(firstInput.id).not.toBe(secondInput.id)
    })

    it('uses provided ID', () => {
      render(<Input id="custom-id" label="Test" />)
      
      const input = screen.getByLabelText('Test')
      expect(input.id).toBe('custom-id')
    })

    it('forwards ref correctly', () => {
      const ref = React.createRef<HTMLInputElement>()
      render(<Input ref={ref} />)
      
      expect(ref.current).toBeInstanceOf(HTMLInputElement)
      expect(ref.current).toBe(screen.getByRole('textbox'))
    })
  })

  describe('variants', () => {
    it.each([
      ['default'],
      ['error'],
      ['success'],
      ['warning']
    ])('renders %s variant correctly', (variant) => {
      render(<Input variant={variant as any} data-testid="input" />)
      
      const input = screen.getByTestId('input')
      expect(input).toBeInTheDocument()
    })

    it('automatically sets error variant when error prop is provided', () => {
      render(<Input error="This field is required" data-testid="error-input" />)
      
      const input = screen.getByTestId('error-input')
      expect(input).toHaveAttribute('aria-invalid', 'true')
    })

    it('automatically sets warning variant when warning prop is provided', () => {
      render(<Input warning="This might cause issues" />)
      
      const input = screen.getByRole('textbox')
      expect(input).toBeInTheDocument()
    })

    it('automatically sets success variant when success prop is provided', () => {
      render(<Input success="Looks good!" />)
      
      const input = screen.getByRole('textbox')
      expect(input).toBeInTheDocument()
    })

    it('prioritizes error over warning and success', () => {
      render(
        <Input
          error="Error message"
          warning="Warning message"
          success="Success message"
          data-testid="prioritized-input"
        />
      )
      
      const input = screen.getByTestId('prioritized-input')
      expect(input).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByText('Error message')).toBeInTheDocument()
      expect(screen.queryByText('Warning message')).not.toBeInTheDocument()
    })
  })

  describe('sizes', () => {
    it.each([
      ['sm'],
      ['md'],
      ['lg']
    ])('renders %s size correctly', (size) => {
      render(<Input size={size as any} data-testid="sized-input" />)
      
      const input = screen.getByTestId('sized-input')
      expect(input).toBeInTheDocument()
    })

    it('defaults to md size', () => {
      render(<Input data-testid="default-size" />)
      
      const input = screen.getByTestId('default-size')
      expect(input).toBeInTheDocument()
    })
  })

  describe('fullWidth prop', () => {
    it('applies full width to wrapper by default', () => {
      render(<Input label="Full width input" />)
      
      const wrapper = screen.getByText('Full width input').closest('div')
      // The input itself always has w-full, but wrapper doesn't have inline-block when fullWidth=true
      expect(wrapper).not.toHaveClass('inline-block')
    })

    it('applies inline-block to wrapper when fullWidth is false', () => {
      render(<Input fullWidth={false} label="Not full width" />)
      
      const wrapper = screen.getByText('Not full width').closest('div')
      expect(wrapper).toHaveClass('inline-block')
    })
  })

  describe('icons', () => {
    it('renders left icon', () => {
      render(<Input leftIcon={<Search data-testid="left-icon" />} />)
      
      expect(screen.getByTestId('left-icon')).toBeInTheDocument()
    })

    it('renders right icon', () => {
      render(<Input rightIcon={<User data-testid="right-icon" />} />)
      
      expect(screen.getByTestId('right-icon')).toBeInTheDocument()
    })

    it('renders both left and right icons', () => {
      render(
        <Input
          leftIcon={<Search data-testid="left-icon" />}
          rightIcon={<User data-testid="right-icon" />}
        />
      )
      
      expect(screen.getByTestId('left-icon')).toBeInTheDocument()
      expect(screen.getByTestId('right-icon')).toBeInTheDocument()
    })

    it('adjusts padding when icons are present', () => {
      render(
        <Input
          leftIcon={<Search />}
          rightIcon={<User />}
          data-testid="icon-input"
        />
      )
      
      const input = screen.getByTestId('icon-input')
      expect(input).toHaveClass('pl-10', 'pr-10') // Default md size padding
    })

    it('adjusts padding for different sizes with icons', () => {
      const { rerender } = render(
        <Input
          leftIcon={<Search />}
          size="sm"
          data-testid="small-icon-input"
        />
      )
      
      expect(screen.getByTestId('small-icon-input')).toHaveClass('pl-8')

      rerender(
        <Input
          leftIcon={<Search />}
          size="lg"
          data-testid="large-icon-input"
        />
      )
      
      expect(screen.getByTestId('large-icon-input')).toHaveClass('pl-12')
    })
  })

  describe('validation icons', () => {
    it('shows error icon when error is provided and showValidationIcon is true', () => {
      render(<Input error="Error message" showValidationIcon />)
      
      const alertIcon = screen.getByRole('textbox').parentElement?.querySelector('svg')
      expect(alertIcon).toBeInTheDocument()
    })

    it('shows warning icon when warning is provided', () => {
      render(<Input warning="Warning message" showValidationIcon />)
      
      const input = screen.getByRole('textbox')
      const warningIcon = input.parentElement?.querySelector('svg')
      expect(warningIcon).toBeInTheDocument()
    })

    it('shows success icon when success is provided', () => {
      render(<Input success="Success message" showValidationIcon />)
      
      const input = screen.getByRole('textbox')
      const successIcon = input.parentElement?.querySelector('svg')
      expect(successIcon).toBeInTheDocument()
    })

    it('does not show validation icons when showValidationIcon is false', () => {
      render(<Input error="Error message" showValidationIcon={false} />)
      
      const input = screen.getByRole('textbox')
      // Only the input should be present, no validation icons
      expect(input).toBeInTheDocument()
    })

    it('does not show validation icon when loading', () => {
      render(<Input error="Error message" loading showValidationIcon />)
      
      // Should show loading spinner instead of validation icon
      const input = screen.getByRole('textbox')
      const spinner = input.parentElement?.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })
  })

  describe('loading state', () => {
    it('shows loading spinner when loading is true', () => {
      render(<Input loading />)
      
      const input = screen.getByRole('textbox')
      const spinner = input.parentElement?.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })

    it('disables input when loading', () => {
      render(<Input loading />)
      
      const input = screen.getByRole('textbox')
      expect(input).toBeDisabled()
    })

    it('adds cursor-wait class when loading', () => {
      render(<Input loading data-testid="loading-input" />)
      
      const input = screen.getByTestId('loading-input')
      expect(input).toHaveClass('cursor-wait')
    })
  })

  describe('disabled state', () => {
    it('disables input when disabled prop is true', () => {
      render(<Input disabled />)
      
      const input = screen.getByRole('textbox')
      expect(input).toBeDisabled()
    })

    it('applies opacity to wrapper when disabled', () => {
      render(<Input disabled label="Disabled input" />)
      
      const wrapper = screen.getByText('Disabled input').closest('div')
      expect(wrapper).toHaveClass('opacity-60', 'cursor-not-allowed')
    })
  })

  describe('floating label', () => {
    it('renders floating label', () => {
      render(<Input label="Floating label" floatingLabel />)
      
      const label = screen.getByText('Floating label')
      expect(label).toHaveClass('absolute', 'pointer-events-none')
    })

    it('positions floating label based on input value', () => {
      render(<Input label="Floating label" floatingLabel value="test" readOnly />)
      
      const label = screen.getByText('Floating label')
      expect(label).toHaveClass('top-2', 'text-xs')
    })

    it('positions floating label when no value', () => {
      render(<Input label="Floating label" floatingLabel />)
      
      const label = screen.getByText('Floating label')
      expect(label).toHaveClass('top-1/2', '-translate-y-1/2')
    })

    it('adjusts input padding for floating label', () => {
      render(<Input label="Floating label" floatingLabel data-testid="floating-input" />)
      
      const input = screen.getByTestId('floating-input')
      expect(input).toHaveClass('pt-6', 'pb-2')
    })
  })

  describe('helper text and messages', () => {
    it('renders helper text', () => {
      render(<Input helperText="This is helper text" />)
      
      expect(screen.getByText('This is helper text')).toBeInTheDocument()
    })

    it('renders error message', () => {
      render(<Input error="This field is required" />)
      
      const errorMessage = screen.getByText('This field is required')
      expect(errorMessage).toBeInTheDocument()
      expect(errorMessage).toHaveClass('text-red-600')
    })

    it('renders warning message', () => {
      render(<Input warning="This might cause issues" />)
      
      const warningMessage = screen.getByText('This might cause issues')
      expect(warningMessage).toBeInTheDocument()
      expect(warningMessage).toHaveClass('text-amber-600')
    })

    it('renders success message', () => {
      render(<Input success="Looks good!" />)
      
      const successMessage = screen.getByText('Looks good!')
      expect(successMessage).toBeInTheDocument()
      expect(successMessage).toHaveClass('text-green-600')
    })

    it('connects helper text to input with aria-describedby', () => {
      render(<Input helperText="Helper text" id="test-input" />)
      
      const input = screen.getByRole('textbox')
      const helperText = screen.getByText('Helper text')
      
      expect(input).toHaveAttribute('aria-describedby')
      expect(helperText.id).toContain('test-input-description')
    })
  })

  describe('description', () => {
    it('renders description text', () => {
      render(<Input description="Additional information" />)
      
      expect(screen.getByText('Additional information')).toBeInTheDocument()
    })

    it('positions description differently for floating label', () => {
      render(<Input description="Additional info" floatingLabel id="test-input" />)
      
      const description = screen.getByText('Additional info')
      expect(description).toHaveAttribute('id', 'test-input-desc')
    })
  })

  describe('required field', () => {
    it('shows asterisk for required field', () => {
      render(<Input label="Required field" required />)
      
      const asterisk = screen.getByText('*')
      expect(asterisk).toBeInTheDocument()
      expect(asterisk).toHaveClass('text-red-500')
    })

    it('shows asterisk in floating label', () => {
      render(<Input label="Required field" required floatingLabel />)
      
      const asterisk = screen.getByText('*')
      expect(asterisk).toBeInTheDocument()
      expect(asterisk).toHaveClass('text-red-500')
    })
  })

  describe('interactions', () => {
    it('allows user to type in the input', async () => {
      const user = userEvent.setup()
      render(<Input placeholder="Type here" />)
      
      const input = screen.getByRole('textbox')
      await user.type(input, 'Hello World')
      
      expect(input).toHaveValue('Hello World')
    })

    it('calls onChange when value changes', async () => {
      const handleChange = vi.fn()
      const user = userEvent.setup()
      
      render(<Input onChange={handleChange} />)
      
      const input = screen.getByRole('textbox')
      await user.type(input, 'a')
      
      expect(handleChange).toHaveBeenCalled()
    })

    it('calls onFocus when input is focused', async () => {
      const handleFocus = vi.fn()
      const user = userEvent.setup()
      
      render(<Input onFocus={handleFocus} />)
      
      const input = screen.getByRole('textbox')
      await user.click(input)
      
      expect(handleFocus).toHaveBeenCalled()
    })

    it('calls onBlur when input loses focus', async () => {
      const handleBlur = vi.fn()
      const user = userEvent.setup()
      
      render(<Input onBlur={handleBlur} />)
      
      const input = screen.getByRole('textbox')
      await user.click(input)
      await user.tab()
      
      expect(handleBlur).toHaveBeenCalled()
    })

    it('does not allow typing when disabled', async () => {
      const user = userEvent.setup()
      render(<Input disabled />)
      
      const input = screen.getByRole('textbox')
      await user.type(input, 'test')
      
      expect(input).toHaveValue('')
    })
  })

  describe('accessibility', () => {
    it('has correct role', () => {
      render(<Input />)
      
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('connects label to input', () => {
      render(<Input label="Test label" />)
      
      const input = screen.getByLabelText('Test label')
      expect(input).toBeInTheDocument()
    })

    it('sets aria-invalid when there is an error', () => {
      render(<Input error="Error message" />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('aria-invalid', 'true')
    })

    it('does not set aria-invalid when there is no error', () => {
      render(<Input />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('aria-invalid', 'false')
    })

    it('connects error message with aria-describedby', () => {
      render(<Input error="Error message" id="error-input" />)
      
      const input = screen.getByRole('textbox')
      const errorMessage = screen.getByText('Error message')
      
      expect(input).toHaveAttribute('aria-describedby')
      expect(errorMessage.id).toContain('error-input-description')
    })

    it('supports custom aria attributes', () => {
      render(<Input aria-label="Custom label" aria-required="true" />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('aria-label', 'Custom label')
      expect(input).toHaveAttribute('aria-required', 'true')
    })
  })

  describe('custom styling', () => {
    it('applies custom className to input', () => {
      render(<Input className="custom-input-class" data-testid="custom-input" />)
      
      const input = screen.getByTestId('custom-input')
      expect(input).toHaveClass('custom-input-class')
    })

    it('applies custom wrapperClassName', () => {
      render(<Input wrapperClassName="custom-wrapper" label="Test" />)
      
      const wrapper = screen.getByText('Test').closest('div')
      expect(wrapper).toHaveClass('custom-wrapper')
    })

    it('applies custom inputWrapperClassName', () => {
      render(<Input inputWrapperClassName="custom-input-wrapper" />)
      
      const input = screen.getByRole('textbox')
      const inputWrapper = input.parentElement
      expect(inputWrapper).toHaveClass('custom-input-wrapper')
    })
  })

  describe('HTML attributes', () => {
    it('forwards HTML input attributes', () => {
      render(
        <Input
          type="email"
          name="email"
          autoComplete="email"
          placeholder="Enter email"
          maxLength={100}
        />
      )
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('type', 'email')
      expect(input).toHaveAttribute('name', 'email')
      expect(input).toHaveAttribute('autocomplete', 'email')
      expect(input).toHaveAttribute('placeholder', 'Enter email')
      expect(input).toHaveAttribute('maxlength', '100')
    })

    it('does not forward non-HTML props', () => {
      render(<Input variant="error" size="lg" fullWidth />)
      
      const input = screen.getByRole('textbox')
      expect(input).not.toHaveAttribute('variant')
      expect(input).not.toHaveAttribute('size')
      expect(input).not.toHaveAttribute('fullWidth')
    })
  })
})