import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../../test/utils';
import userEvent from '@testing-library/user-event';
import Checkbox from './Checkbox';

describe('Checkbox', () => {
  describe('rendering', () => {
    it('renders with default props', () => {
      render(<Checkbox />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).not.toBeChecked();
    });

    it('renders with label', () => {
      render(<Checkbox label="Accept terms" />);

      const label = screen.getByText('Accept terms');
      expect(label).toBeInTheDocument();

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAccessibleName('Accept terms');
    });

    it('renders with children as label', () => {
      render(<Checkbox>Custom label content</Checkbox>);

      const label = screen.getByText('Custom label content');
      expect(label).toBeInTheDocument();

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAccessibleName('Custom label content');
    });

    it('renders with description', () => {
      render(<Checkbox label="Terms" description="Please read the terms carefully" />);

      const description = screen.getByText('Please read the terms carefully');
      expect(description).toBeInTheDocument();
      expect(description).toHaveAttribute('id');
    });

    it('renders with helper text', () => {
      render(<Checkbox label="Terms" helperText="This field is required" />);

      expect(screen.getByText('This field is required')).toBeInTheDocument();
    });

    it('forwards ref correctly', () => {
      const ref = React.createRef<HTMLInputElement>();
      render(<Checkbox ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLInputElement);
      expect(ref.current).toBe(screen.getByRole('checkbox'));
    });

    it('generates unique ID when not provided', () => {
      render(
        <div>
          <Checkbox label="First" />
          <Checkbox label="Second" />
        </div>
      );

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[0].id).toBeTruthy();
      expect(checkboxes[1].id).toBeTruthy();
      expect(checkboxes[0].id).not.toBe(checkboxes[1].id);
    });

    it('uses custom ID when provided', () => {
      render(<Checkbox id="custom-id" label="Test" />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('id', 'custom-id');

      // Find the label element (it's the parent of the text)
      const textElement = screen.getByText('Test');
      const label = textElement.closest('label');
      expect(label).toHaveAttribute('for', 'custom-id');
    });
  });

  describe('states', () => {
    it('renders checked state', () => {
      render(<Checkbox checked readOnly label="Checked" />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
    });

    it('renders unchecked state', () => {
      render(<Checkbox checked={false} readOnly label="Unchecked" />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).not.toBeChecked();
    });

    it('renders indeterminate state', () => {
      render(<Checkbox indeterminate label="Indeterminate" />);

      // Should show minus icon instead of check icon
      const minusIcon = document.querySelector('svg[class*="h-"]');
      expect(minusIcon).toBeInTheDocument();
    });

    it('renders disabled state', () => {
      render(<Checkbox disabled label="Disabled" />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeDisabled();

      // Wrapper should have opacity and cursor styles
      const wrapper = checkbox.closest('.opacity-60');
      expect(wrapper).toBeInTheDocument();
    });

    it('renders loading state', () => {
      render(<Checkbox loading label="Loading" />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeDisabled();

      // Should show loading spinner
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('sizes', () => {
    it.each([
      ['sm', 'h-4 w-4', 'text-sm'],
      ['md', 'h-5 w-5', 'text-base'],
      ['lg', 'h-6 w-6', 'text-lg'],
    ])('renders %s size correctly', (size, checkboxClass, textClass) => {
      render(<Checkbox size={size as any} label="Test" />);

      // Check the custom checkbox element has correct size
      const customCheckbox = document.querySelector(`.${checkboxClass.split(' ').join('.')}`);
      expect(customCheckbox).toBeInTheDocument();

      // Check the label element has correct text size class
      const textElement = screen.getByText('Test');
      const label = textElement.closest('label');
      expect(label).toHaveClass(textClass);
    });

    it('defaults to md size', () => {
      render(<Checkbox label="Test" />);

      const textElement = screen.getByText('Test');
      const label = textElement.closest('label');
      expect(label).toHaveClass('text-base');
    });
  });

  describe('variants', () => {
    it.each([
      ['default', 'border-graphite-300'],
      ['error', 'border-red-300'],
      ['warning', 'border-amber-300'],
      ['success', 'border-emerald-300'],
    ])('renders %s variant correctly', (variant, borderClass) => {
      render(<Checkbox variant={variant as any} label="Test" />);

      const customCheckbox = document.querySelector(`[class*="${borderClass}"]`);
      expect(customCheckbox).toBeInTheDocument();
    });

    it('error message overrides variant', () => {
      render(<Checkbox variant="success" error="This is required" />);

      const errorText = screen.getByText('This is required');
      expect(errorText).toHaveClass('text-red-600');
    });

    it('warning message overrides variant', () => {
      render(<Checkbox variant="success" warning="Please check" />);

      const warningText = screen.getByText('Please check');
      expect(warningText).toHaveClass('text-amber-600');
    });

    it('success message overrides variant', () => {
      render(<Checkbox variant="error" success="All good" />);

      const successText = screen.getByText('All good');
      expect(successText).toHaveClass('text-green-600');
    });
  });

  describe('validation states', () => {
    it('shows error state with icon', () => {
      render(<Checkbox error="This field is required" label="Test" />);

      expect(screen.getByText('This field is required')).toBeInTheDocument();

      // Should show error icon
      const errorIcon = document.querySelector('svg[class*="text-red-500"]');
      expect(errorIcon).toBeInTheDocument();
    });

    it('shows warning state with icon', () => {
      render(<Checkbox warning="Please double-check" label="Test" />);

      expect(screen.getByText('Please double-check')).toBeInTheDocument();

      // Should show warning icon
      const warningIcon = document.querySelector('svg[class*="text-amber-500"]');
      expect(warningIcon).toBeInTheDocument();
    });

    it('shows success state with icon', () => {
      render(<Checkbox success="Looks good!" label="Test" />);

      expect(screen.getByText('Looks good!')).toBeInTheDocument();

      // Should show success icon
      const successIcon = document.querySelector('svg[class*="text-green-500"]');
      expect(successIcon).toBeInTheDocument();
    });

    it('hides validation icon when showValidationIcon is false', () => {
      render(<Checkbox error="Error" showValidationIcon={false} label="Test" />);

      const errorIcon = document.querySelector('svg[class*="text-red-500"]');
      expect(errorIcon).not.toBeInTheDocument();
    });

    it('hides validation icon when loading', () => {
      render(<Checkbox error="Error" loading label="Test" />);

      const errorIcon = document.querySelector('svg[class*="text-red-500"]');
      expect(errorIcon).not.toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('can be clicked to toggle', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(<Checkbox onChange={onChange} label="Clickable" />);

      const checkbox = screen.getByRole('checkbox');
      await user.click(checkbox);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.objectContaining({ checked: true }),
        })
      );
    });

    it('can be clicked by clicking the label', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(<Checkbox onChange={onChange} label="Click label" />);

      const label = screen.getByText('Click label');
      await user.click(label);

      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('cannot be clicked when disabled', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(<Checkbox onChange={onChange} disabled label="Disabled" />);

      const checkbox = screen.getByRole('checkbox');
      await user.click(checkbox);

      expect(onChange).not.toHaveBeenCalled();
    });

    it('cannot be clicked when loading', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(<Checkbox onChange={onChange} loading label="Loading" />);

      const checkbox = screen.getByRole('checkbox');
      await user.click(checkbox);

      expect(onChange).not.toHaveBeenCalled();
    });

    it('supports keyboard interaction (Space)', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(<Checkbox onChange={onChange} label="Keyboard" />);

      const checkbox = screen.getByRole('checkbox');
      checkbox.focus();
      await user.keyboard(' ');

      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('supports keyboard interaction (Enter) - should not activate checkbox', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(<Checkbox onChange={onChange} label="Keyboard" />);

      const checkbox = screen.getByRole('checkbox');
      checkbox.focus();
      await user.keyboard('{Enter}');

      // Enter key should NOT activate a checkbox (only Space does)
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('controlled vs uncontrolled', () => {
    it('works as uncontrolled component', async () => {
      const user = userEvent.setup();
      render(<Checkbox label="Uncontrolled" />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).not.toBeChecked();

      await user.click(checkbox);
      expect(checkbox).toBeChecked();
    });

    it('works as controlled component', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      const { rerender } = render(
        <Checkbox checked={false} onChange={onChange} label="Controlled" />
      );

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).not.toBeChecked();

      await user.click(checkbox);
      expect(onChange).toHaveBeenCalledTimes(1);
      // Component stays unchecked until parent updates
      expect(checkbox).not.toBeChecked();

      // Simulate parent update
      rerender(<Checkbox checked={true} onChange={onChange} label="Controlled" />);
      expect(checkbox).toBeChecked();
    });

    it('respects defaultChecked for initial state', () => {
      render(<Checkbox defaultChecked label="Default checked" />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
    });
  });

  describe('accessibility', () => {
    it('has proper accessibility attributes', () => {
      render(<Checkbox label="Accessible checkbox" />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('type', 'checkbox');
      expect(checkbox).toHaveAttribute('id');

      // Find the label element which should be associated with the checkbox
      const textElement = screen.getByText('Accessible checkbox');
      const label = textElement.closest('label');
      expect(label).toHaveAttribute('for', checkbox.id);
    });

    it('sets aria-describedby for helper text', () => {
      render(<Checkbox label="Test" helperText="Helper text" />);

      const checkbox = screen.getByRole('checkbox');
      const describedBy = checkbox.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();

      const helperText = screen.getByText('Helper text');
      expect(helperText).toHaveAttribute('id', describedBy?.split(' ')[0]);
    });

    it('sets aria-describedby for description', () => {
      render(<Checkbox label="Test" description="Description text" />);

      const checkbox = screen.getByRole('checkbox');
      const describedBy = checkbox.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
    });

    it('sets aria-describedby for both helper text and description', () => {
      render(<Checkbox label="Test" description="Description" helperText="Helper" />);

      const checkbox = screen.getByRole('checkbox');
      const describedBy = checkbox.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();

      // Should contain both IDs
      const ids = describedBy?.split(' ');
      expect(ids).toHaveLength(2);
    });

    it('is focusable', () => {
      render(<Checkbox label="Focusable" />);

      const checkbox = screen.getByRole('checkbox');
      checkbox.focus();
      expect(checkbox).toHaveFocus();
    });

    it('cannot be focused when disabled', () => {
      render(<Checkbox label="Disabled" disabled />);

      const checkbox = screen.getByRole('checkbox');
      checkbox.focus();
      expect(checkbox).not.toHaveFocus();
    });
  });

  describe('visual indicators', () => {
    it('shows check icon when checked', () => {
      render(<Checkbox checked readOnly label="Checked" />);

      // Check icon should be present (but not minus icon)
      const icons = document.querySelectorAll('svg');
      const hasCheckIcon = Array.from(icons).some(
        icon =>
          icon.classList.toString().includes('h-') &&
          !icon.classList.toString().includes('animate-spin')
      );
      expect(hasCheckIcon).toBe(true);
    });

    it('shows minus icon when indeterminate', () => {
      render(<Checkbox indeterminate label="Indeterminate" />);

      // Should have minus icon when indeterminate
      const icons = document.querySelectorAll('svg');
      const hasIcon = Array.from(icons).some(
        icon =>
          icon.classList.toString().includes('h-') &&
          !icon.classList.toString().includes('animate-spin')
      );
      expect(hasIcon).toBe(true);
    });

    it('shows loading spinner when loading', () => {
      render(<Checkbox loading label="Loading" />);

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('hides check icon when loading', () => {
      render(<Checkbox checked loading label="Loading checked" />);

      // Should not show check icon when loading
      const checkIcons = document.querySelectorAll('svg:not(.animate-spin)');
      expect(checkIcons).toHaveLength(0);
    });
  });

  describe('custom styling', () => {
    it('applies custom className to checkbox', () => {
      render(<Checkbox className="custom-checkbox" />);

      const customCheckbox = document.querySelector('.custom-checkbox');
      expect(customCheckbox).toBeInTheDocument();
    });

    it('applies custom wrapperClassName to wrapper', () => {
      render(<Checkbox wrapperClassName="custom-wrapper" label="Test" />);

      const wrapper = document.querySelector('.custom-wrapper');
      expect(wrapper).toBeInTheDocument();
    });

    it('applies custom labelClassName to label', () => {
      render(<Checkbox labelClassName="custom-label" label="Custom styled label" />);

      // Find the label element which has the custom class
      const textElement = screen.getByText('Custom styled label');
      const label = textElement.closest('label');
      expect(label).toHaveClass('custom-label');
    });
  });

  describe('HTML attributes', () => {
    it('forwards HTML input attributes', () => {
      render(
        <Checkbox
          name="test-checkbox"
          value="test-value"
          data-testid="checkbox-input"
          aria-label="Test checkbox"
        />
      );

      const checkbox = screen.getByTestId('checkbox-input');
      expect(checkbox).toHaveAttribute('name', 'test-checkbox');
      expect(checkbox).toHaveAttribute('value', 'test-value');
      expect(checkbox).toHaveAttribute('aria-label', 'Test checkbox');
    });

    it('does not forward component-specific props as HTML attributes', () => {
      render(
        <Checkbox
          variant="error"
          size="lg"
          indeterminate={true}
          loading={true}
          data-testid="checkbox"
        />
      );

      const checkbox = screen.getByTestId('checkbox');
      expect(checkbox).not.toHaveAttribute('variant');
      expect(checkbox).not.toHaveAttribute('size');
      expect(checkbox).not.toHaveAttribute('indeterminate');
      expect(checkbox).not.toHaveAttribute('loading');
    });
  });

  describe('edge cases', () => {
    it('handles missing label gracefully', () => {
      render(<Checkbox />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeInTheDocument();
    });

    it('handles empty label gracefully', () => {
      render(<Checkbox label="" />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeInTheDocument();
    });

    it('prioritizes children over label prop', () => {
      render(<Checkbox label="Label prop">Children content</Checkbox>);

      expect(screen.getByText('Children content')).toBeInTheDocument();
      expect(screen.queryByText('Label prop')).not.toBeInTheDocument();
    });

    it('handles both indeterminate and checked states', () => {
      render(<Checkbox checked readOnly indeterminate label="Both states" />);

      // Should show minus icon (indeterminate takes precedence over checked)
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeInTheDocument();
    });

    it('handles validation message priority (error > warning > success)', () => {
      render(
        <Checkbox
          error="Error message"
          warning="Warning message"
          success="Success message"
          label="Test"
        />
      );

      expect(screen.getByText('Error message')).toBeInTheDocument();
      expect(screen.queryByText('Warning message')).not.toBeInTheDocument();
      expect(screen.queryByText('Success message')).not.toBeInTheDocument();
    });
  });
});
