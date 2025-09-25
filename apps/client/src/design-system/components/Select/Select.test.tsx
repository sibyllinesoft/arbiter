import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '../../test/utils';
import Select, { type SelectOption } from './Select';

const mockOptions: SelectOption[] = [
  { value: 'apple', label: 'Apple', description: 'Red fruit' },
  { value: 'banana', label: 'Banana', description: 'Yellow fruit' },
  { value: 'cherry', label: 'Cherry', description: 'Small red fruit' },
  { value: 'date', label: 'Date', description: 'Sweet fruit', disabled: true },
  { value: 'elderberry', label: 'Elderberry', description: 'Dark purple fruit' },
];

describe('Select', () => {
  let originalGetBoundingClientRect: any;

  beforeEach(() => {
    // Mock getBoundingClientRect for dropdown positioning
    originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      width: 300,
      height: 40,
      top: 100,
      left: 100,
      bottom: 140,
      right: 400,
      x: 100,
      y: 100,
      toJSON: vi.fn(),
    }));
  });

  afterEach(() => {
    Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  });

  describe('rendering', () => {
    it('renders with default props', () => {
      render(<Select options={mockOptions} />);

      const select = screen.getByRole('button');
      expect(select).toBeInTheDocument();
      expect(select).toHaveAttribute('aria-haspopup', 'listbox');
      expect(select).toHaveAttribute('aria-expanded', 'false');
    });

    it('renders with custom placeholder', () => {
      render(<Select options={mockOptions} placeholder="Choose a fruit" />);

      expect(screen.getByText('Choose a fruit')).toBeInTheDocument();
    });

    it('renders with label', () => {
      render(<Select options={mockOptions} label="Select Fruit" />);

      const label = screen.getByText('Select Fruit');
      expect(label).toBeInTheDocument();
      expect(label).toHaveAttribute('for');
    });

    it('renders with description', () => {
      render(<Select options={mockOptions} description="Choose your favorite fruit" />);

      expect(screen.getByText('Choose your favorite fruit')).toBeInTheDocument();
    });

    it('renders with helper text', () => {
      render(<Select options={mockOptions} helperText="This is helpful" />);

      expect(screen.getByText('This is helpful')).toBeInTheDocument();
    });

    it('shows required asterisk', () => {
      render(<Select options={mockOptions} label="Fruit" required />);

      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('hides label when hideLabel is true', () => {
      render(<Select options={mockOptions} label="Hidden Label" hideLabel />);

      expect(screen.queryByText('Hidden Label')).not.toBeInTheDocument();
    });

    it('forwards ref correctly', () => {
      const ref = React.createRef<HTMLButtonElement>();
      render(<Select ref={ref} options={mockOptions} />);

      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    });
  });

  describe('dropdown behavior', () => {
    it('opens dropdown when clicked', async () => {
      const user = userEvent.setup();
      render(<Select options={mockOptions} />);

      const select = screen.getByRole('button');
      await user.click(select);

      expect(select).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText('Apple')).toBeInTheDocument();
      expect(screen.getByText('Banana')).toBeInTheDocument();
    });

    it('closes dropdown when clicked outside', async () => {
      const user = userEvent.setup();
      render(
        <div>
          <Select options={mockOptions} />
          <button>Outside</button>
        </div>
      );

      const select = screen.getByRole('button', { expanded: false });
      await user.click(select);
      expect(select).toHaveAttribute('aria-expanded', 'true');

      await user.click(screen.getByText('Outside'));
      await waitFor(() => {
        expect(select).toHaveAttribute('aria-expanded', 'false');
      });
    });

    it('closes dropdown when escape key is pressed', async () => {
      const user = userEvent.setup();
      render(<Select options={mockOptions} />);

      const select = screen.getByRole('button');
      await user.click(select);
      expect(select).toHaveAttribute('aria-expanded', 'true');

      await user.keyboard('{Escape}');
      expect(select).toHaveAttribute('aria-expanded', 'false');
    });

    it('shows no options message when options array is empty', async () => {
      const user = userEvent.setup();
      render(<Select options={[]} />);

      const select = screen.getByRole('button');
      await user.click(select);

      expect(screen.getByText('No options available')).toBeInTheDocument();
    });
  });

  describe('single selection', () => {
    it('selects an option when clicked', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<Select options={mockOptions} onChange={onChange} />);

      const select = screen.getByRole('button');
      await user.click(select);
      await user.click(screen.getByText('Apple'));

      expect(onChange).toHaveBeenCalledWith('apple');
      expect(screen.getByText('Apple')).toBeInTheDocument();
    });

    it('closes dropdown after selection in single mode', async () => {
      const user = userEvent.setup();
      render(<Select options={mockOptions} />);

      const select = screen.getByRole('button');
      await user.click(select);
      expect(select).toHaveAttribute('aria-expanded', 'true');

      await user.click(screen.getByText('Apple'));
      expect(select).toHaveAttribute('aria-expanded', 'false');
    });

    it('shows selected option in button', async () => {
      const user = userEvent.setup();
      render(<Select options={mockOptions} />);

      const select = screen.getByRole('button');
      await user.click(select);
      await user.click(screen.getByText('Banana'));

      expect(screen.getByText('Banana')).toBeInTheDocument();
    });

    it('works with controlled value', () => {
      render(<Select options={mockOptions} value="cherry" />);

      expect(screen.getByText('Cherry')).toBeInTheDocument();
    });

    it('works with defaultValue', () => {
      render(<Select options={mockOptions} defaultValue="banana" />);

      expect(screen.getByText('Banana')).toBeInTheDocument();
    });
  });

  describe('multiple selection', () => {
    it('allows multiple selections', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<Select options={mockOptions} multiple onChange={onChange} />);

      const select = screen.getByRole('button');
      await user.click(select);

      // Click on the Apple option in the dropdown
      await user.click(screen.getByText('Apple'));
      expect(onChange).toHaveBeenLastCalledWith(['apple']);

      // Click on the Banana option in the dropdown
      await user.click(screen.getByText('Banana'));
      expect(onChange).toHaveBeenLastCalledWith(['apple', 'banana']);
    });

    it('deselects option when clicked again in multiple mode', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<Select options={mockOptions} multiple onChange={onChange} value={['apple']} />);

      const select = screen.getByRole('button', { expanded: false });
      await user.click(select);

      // Click on the Apple option in the dropdown (not the selected value)
      const appleOptions = screen.getAllByText('Apple');
      expect(appleOptions).toHaveLength(2);
      const appleOption = appleOptions[1]!;
      await user.click(appleOption);

      expect(onChange).toHaveBeenCalledWith([]);
    });

    it('keeps dropdown open in multiple mode', async () => {
      const user = userEvent.setup();
      render(<Select options={mockOptions} multiple />);

      const select = screen.getByRole('button');
      await user.click(select);
      expect(select).toHaveAttribute('aria-expanded', 'true');

      await user.click(screen.getByText('Apple'));
      expect(select).toHaveAttribute('aria-expanded', 'true');
    });

    it('shows multiple selected values with count', () => {
      render(<Select options={mockOptions} multiple value={['apple', 'banana', 'cherry']} />);

      expect(screen.getByText('Apple, Banana')).toBeInTheDocument();
      expect(screen.getByText('+1')).toBeInTheDocument();
    });

    it('shows clear button for multiple selections', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(
        <Select options={mockOptions} multiple value={['apple', 'banana']} onChange={onChange} />
      );

      const clearButton = screen.getByLabelText('Clear selection');
      expect(clearButton).toBeInTheDocument();

      await user.click(clearButton);
      expect(onChange).toHaveBeenCalledWith([]);
    });

    it('prevents dropdown from opening when clear button is clicked', async () => {
      const user = userEvent.setup();
      render(<Select options={mockOptions} multiple value={['apple']} />);

      const clearButton = screen.getByLabelText('Clear selection');
      await user.click(clearButton);

      const select = screen.getByRole('button');
      expect(select).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('keyboard navigation', () => {
    it('opens dropdown with arrow down key', async () => {
      const user = userEvent.setup();
      render(<Select options={mockOptions} />);

      const select = screen.getByRole('button');
      select.focus();
      await user.keyboard('{ArrowDown}');

      expect(select).toHaveAttribute('aria-expanded', 'true');
    });

    it('navigates options with arrow keys', async () => {
      const user = userEvent.setup();
      render(<Select options={mockOptions} />);

      const select = screen.getByRole('button');
      await user.click(select);

      await user.keyboard('{ArrowDown}');
      // Focus should be on first option (Apple)

      await user.keyboard('{ArrowDown}');
      // Focus should be on second option (Banana)

      await user.keyboard('{ArrowUp}');
      // Focus should be back on first option (Apple)
    });

    it('selects option with Enter key', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<Select options={mockOptions} onChange={onChange} />);

      const select = screen.getByRole('button');
      select.focus();
      await user.keyboard('{ArrowDown}'); // Open dropdown
      await user.keyboard('{ArrowDown}'); // Move focus to first option
      await user.keyboard('{Enter}'); // Select first option

      expect(onChange).toHaveBeenCalledWith('apple');
    });

    it('selects option with Space key', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<Select options={mockOptions} onChange={onChange} />);

      const select = screen.getByRole('button');
      select.focus();
      await user.keyboard(' '); // Open dropdown
      await user.keyboard('{ArrowDown}'); // Move focus to first option
      await user.keyboard(' '); // Select first option

      expect(onChange).toHaveBeenCalledWith('apple');
    });

    it('closes dropdown with Tab key', async () => {
      const user = userEvent.setup();
      render(<Select options={mockOptions} />);

      const select = screen.getByRole('button');
      await user.click(select);
      expect(select).toHaveAttribute('aria-expanded', 'true');

      await user.keyboard('{Tab}');
      expect(select).toHaveAttribute('aria-expanded', 'false');
    });

    it('wraps around when navigating past last option', async () => {
      const user = userEvent.setup();
      render(<Select options={mockOptions.slice(0, 2)} />); // Only Apple and Banana

      const select = screen.getByRole('button');
      await user.click(select);

      // Navigate to last option and then one more
      await user.keyboard('{ArrowDown}'); // Apple
      await user.keyboard('{ArrowDown}'); // Banana
      await user.keyboard('{ArrowDown}'); // Should wrap to Apple
    });
  });

  describe('search functionality', () => {
    it('shows search input when searchable is true', async () => {
      const user = userEvent.setup();
      render(<Select options={mockOptions} searchable />);

      const select = screen.getByRole('button');
      await user.click(select);

      const searchInput = screen.getByPlaceholderText('Search options...');
      expect(searchInput).toBeInTheDocument();
    });

    it('focuses search input when dropdown opens', async () => {
      const user = userEvent.setup();
      render(<Select options={mockOptions} searchable />);

      const select = screen.getByRole('button');
      await user.click(select);

      const searchInput = screen.getByPlaceholderText('Search options...');
      await waitFor(() => {
        expect(searchInput).toHaveFocus();
      });
    });

    it('filters options based on search term', async () => {
      const user = userEvent.setup();
      render(<Select options={mockOptions} searchable />);

      const select = screen.getByRole('button');
      await user.click(select);

      const searchInput = screen.getByPlaceholderText('Search options...');
      await user.type(searchInput, 'app');

      expect(screen.getByText('Apple')).toBeInTheDocument();
      expect(screen.queryByText('Banana')).not.toBeInTheDocument();
    });

    it('filters options based on description', async () => {
      const user = userEvent.setup();
      render(<Select options={mockOptions} searchable />);

      const select = screen.getByRole('button');
      await user.click(select);

      const searchInput = screen.getByPlaceholderText('Search options...');
      await user.type(searchInput, 'red');

      expect(screen.getByText('Apple')).toBeInTheDocument();
      expect(screen.getByText('Cherry')).toBeInTheDocument();
      expect(screen.queryByText('Banana')).not.toBeInTheDocument();
    });

    it('shows no results message when search yields no matches', async () => {
      const user = userEvent.setup();
      render(<Select options={mockOptions} searchable />);

      const select = screen.getByRole('button');
      await user.click(select);

      const searchInput = screen.getByPlaceholderText('Search options...');
      await user.type(searchInput, 'xyz');

      expect(screen.getByText('No options match your search')).toBeInTheDocument();
    });
  });

  describe('validation states', () => {
    it('shows error state', () => {
      render(<Select options={mockOptions} error="This field is required" />);

      expect(screen.getByText('This field is required')).toBeInTheDocument();

      const select = screen.getByRole('button');
      expect(select).toHaveClass('border-red-300');

      // Should show error icon
      const icon = screen.getByRole('button').querySelector('svg[class*="text-red-500"]');
      expect(icon).toBeInTheDocument();
    });

    it('shows warning state', () => {
      render(<Select options={mockOptions} warning="Please double-check" />);

      expect(screen.getByText('Please double-check')).toBeInTheDocument();

      const select = screen.getByRole('button');
      expect(select).toHaveClass('border-amber-300');

      // Should show warning icon
      const icon = screen.getByRole('button').querySelector('svg[class*="text-amber-500"]');
      expect(icon).toBeInTheDocument();
    });

    it('shows success state', () => {
      render(<Select options={mockOptions} success="Looks good!" />);

      expect(screen.getByText('Looks good!')).toBeInTheDocument();

      const select = screen.getByRole('button');
      expect(select).toHaveClass('border-emerald-300');

      // Should show success icon
      const icon = screen.getByRole('button').querySelector('svg[class*="text-green-500"]');
      expect(icon).toBeInTheDocument();
    });

    it('hides validation icon when showValidationIcon is false', () => {
      render(<Select options={mockOptions} error="Error" showValidationIcon={false} />);

      const select = screen.getByRole('button');
      const icon = select.querySelector('svg[class*="text-red-500"]');
      expect(icon).not.toBeInTheDocument();
    });

    it('error state overrides other validation states', () => {
      render(<Select options={mockOptions} error="Error" warning="Warning" success="Success" />);

      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.queryByText('Warning')).not.toBeInTheDocument();
      expect(screen.queryByText('Success')).not.toBeInTheDocument();
    });
  });

  describe('sizes', () => {
    it.each([
      ['sm', 'px-3 py-1.5 text-sm'],
      ['md', 'px-3 py-2 text-base'],
      ['lg', 'px-4 py-3 text-lg'],
    ])('renders %s size correctly', (size, expectedClasses) => {
      render(<Select options={mockOptions} size={size as any} data-testid="select" />);

      const select = screen.getByTestId('select');
      expectedClasses.split(' ').forEach(cls => {
        expect(select).toHaveClass(cls);
      });
    });

    it('defaults to md size', () => {
      render(<Select options={mockOptions} data-testid="select" />);

      const select = screen.getByTestId('select');
      expect(select).toHaveClass('px-3', 'py-2', 'text-base');
    });
  });

  describe('disabled state', () => {
    it('applies disabled styles and behavior', () => {
      render(<Select options={mockOptions} disabled />);

      const select = screen.getByRole('button');
      expect(select).toBeDisabled();
      expect(select).toHaveClass('bg-graphite-50', 'text-graphite-500', 'cursor-not-allowed');
    });

    it('does not open when disabled', async () => {
      const user = userEvent.setup();
      render(<Select options={mockOptions} disabled />);

      const select = screen.getByRole('button');
      await user.click(select);

      expect(select).toHaveAttribute('aria-expanded', 'false');
    });

    it('does not respond to keyboard when disabled', async () => {
      const user = userEvent.setup();
      render(<Select options={mockOptions} disabled />);

      const select = screen.getByRole('button');
      select.focus();
      await user.keyboard('{ArrowDown}');

      expect(select).toHaveAttribute('aria-expanded', 'false');
    });

    it('hides clear button when disabled in multiple mode', () => {
      render(<Select options={mockOptions} multiple value={['apple']} disabled />);

      expect(screen.queryByLabelText('Clear selection')).not.toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('shows loading spinner', () => {
      render(<Select options={mockOptions} loading />);

      const spinner = screen.getByRole('button').querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('disables interaction when loading', async () => {
      const user = userEvent.setup();
      render(<Select options={mockOptions} loading />);

      const select = screen.getByRole('button');
      expect(select).toBeDisabled();

      await user.click(select);
      expect(select).toHaveAttribute('aria-expanded', 'false');
    });

    it('hides chevron when loading', () => {
      render(<Select options={mockOptions} loading />);

      const select = screen.getByRole('button');
      const chevron = select.querySelector('svg:not(.animate-spin)');
      expect(chevron).not.toBeInTheDocument();
    });

    it('hides validation icon when loading', () => {
      render(<Select options={mockOptions} error="Error" loading />);

      const select = screen.getByRole('button');
      const errorIcon = select.querySelector('svg[class*="text-red-500"]');
      expect(errorIcon).not.toBeInTheDocument();
    });

    it('hides clear button when loading in multiple mode', () => {
      render(<Select options={mockOptions} multiple value={['apple']} loading />);

      expect(screen.queryByLabelText('Clear selection')).not.toBeInTheDocument();
    });
  });

  describe('floating label', () => {
    it('renders floating label correctly when empty', () => {
      render(<Select options={mockOptions} label="Floating Label" floatingLabel />);

      const label = screen.getByText('Floating Label');
      expect(label).toHaveClass('top-1/2', '-translate-y-1/2');
    });

    it('moves floating label up when value is selected', () => {
      render(<Select options={mockOptions} label="Floating Label" floatingLabel value="apple" />);

      const label = screen.getByText('Floating Label');
      expect(label).toHaveClass('top-2', 'text-xs');
    });

    it('moves floating label up when dropdown is open', async () => {
      const user = userEvent.setup();
      render(<Select options={mockOptions} label="Floating Label" floatingLabel />);

      const select = screen.getByRole('button');
      await user.click(select);

      const label = screen.getByText('Floating Label');
      expect(label).toHaveClass('top-2', 'text-xs');
    });

    it('shows description below input for floating label', () => {
      render(
        <Select options={mockOptions} label="Label" description="Description" floatingLabel />
      );

      // Description should be rendered after the select container
      const description = screen.getByText('Description');
      expect(description).toBeInTheDocument();
    });

    it('adjusts content padding for floating label', () => {
      render(<Select options={mockOptions} label="Label" floatingLabel value="apple" />);

      // The selected value container should have top padding when floating label is used and value is selected
      const valueContainer = screen.getByText('Apple');
      expect(valueContainer).toHaveClass('pt-4');
    });
  });

  describe('option features', () => {
    it('shows option descriptions when enabled', async () => {
      const user = userEvent.setup();
      render(<Select options={mockOptions} showDescriptions />);

      const select = screen.getByRole('button');
      await user.click(select);

      expect(screen.getByText('Red fruit')).toBeInTheDocument();
      expect(screen.getByText('Yellow fruit')).toBeInTheDocument();
    });

    it('hides option descriptions when disabled', async () => {
      const user = userEvent.setup();
      render(<Select options={mockOptions} showDescriptions={false} />);

      const select = screen.getByRole('button');
      await user.click(select);

      expect(screen.queryByText('Red fruit')).not.toBeInTheDocument();
    });

    it('renders option icons when provided', async () => {
      const optionsWithIcons = [
        { value: 'home', label: 'Home', icon: <span data-testid="home-icon">🏠</span> },
        { value: 'work', label: 'Work', icon: <span data-testid="work-icon">💼</span> },
      ];
      const user = userEvent.setup();
      render(<Select options={optionsWithIcons} />);

      const select = screen.getByRole('button');
      await user.click(select);

      expect(screen.getByTestId('home-icon')).toBeInTheDocument();
      expect(screen.getByTestId('work-icon')).toBeInTheDocument();
    });

    it('shows disabled state for disabled options', async () => {
      const user = userEvent.setup();
      render(<Select options={mockOptions} />);

      const select = screen.getByRole('button');
      await user.click(select);

      const disabledOption = screen.getByText('Date').closest('button');
      expect(disabledOption).toHaveClass('opacity-50', 'cursor-not-allowed');
      expect(disabledOption).toBeDisabled();
    });

    it('does not select disabled options', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<Select options={mockOptions} onChange={onChange} />);

      const select = screen.getByRole('button');
      await user.click(select);

      // Find the Date option button which should be disabled
      const dateOptionButton = screen.getByText('Date').closest('button');
      await user.click(dateOptionButton!);

      expect(onChange).not.toHaveBeenCalled();
    });

    it('shows check mark for selected options', async () => {
      const user = userEvent.setup();
      render(<Select options={mockOptions} value="apple" />);

      const select = screen.getByRole('button');
      await user.click(select);

      // Find the Apple option in the dropdown (not the selected value)
      const appleOptions = screen.getAllByText('Apple');
      expect(appleOptions).toHaveLength(2);
      const appleOption = appleOptions[1]!.closest('button');
      expect(appleOption).toBeInTheDocument();
      const checkIcon = appleOption!.querySelector('svg');
      expect(checkIcon).toBeInTheDocument();
    });

    it('highlights selected options', async () => {
      const user = userEvent.setup();
      render(<Select options={mockOptions} value="apple" />);

      const select = screen.getByRole('button');
      await user.click(select);

      // Find the Apple option in the dropdown (not the selected value)
      const appleOptions = screen.getAllByText('Apple');
      expect(appleOptions).toHaveLength(2);
      const appleOption = appleOptions[1]!.closest('button');
      expect(appleOption).toBeInTheDocument();
      expect(appleOption!).toHaveClass('bg-blue-50');
      expect(appleOption!).toHaveClass('text-blue-700');
    });
  });

  describe('full width behavior', () => {
    it('applies full width by default', () => {
      render(
        <div data-testid="wrapper">
          <Select options={mockOptions} />
        </div>
      );

      // The wrapper should not have inline-block class (full width)
      const selectWrapper = screen.getByTestId('wrapper').firstChild;
      expect(selectWrapper).not.toHaveClass('inline-block');
    });

    it('applies inline width when fullWidth is false', () => {
      render(
        <div data-testid="wrapper">
          <Select options={mockOptions} fullWidth={false} />
        </div>
      );

      const selectWrapper = screen.getByTestId('wrapper').firstChild;
      expect(selectWrapper).toHaveClass('inline-block');
    });
  });

  describe('custom styling', () => {
    it('applies custom className to select button', () => {
      render(<Select options={mockOptions} className="custom-select" />);

      const select = screen.getByRole('button');
      expect(select).toHaveClass('custom-select');
    });

    it('applies custom wrapperClassName to wrapper', () => {
      render(
        <div data-testid="container">
          <Select options={mockOptions} wrapperClassName="custom-wrapper" />
        </div>
      );

      const wrapper = screen.getByTestId('container').firstChild;
      expect(wrapper).toHaveClass('custom-wrapper');
    });

    it('applies custom dropdownClassName to dropdown', async () => {
      const user = userEvent.setup();
      render(<Select options={mockOptions} dropdownClassName="custom-dropdown" />);

      const select = screen.getByRole('button');
      await user.click(select);

      const dropdown = screen.getByText('Apple').closest('div[class*="absolute"]');
      expect(dropdown).toHaveClass('custom-dropdown');
    });

    it('applies custom maxHeight to dropdown', async () => {
      const user = userEvent.setup();
      render(<Select options={mockOptions} maxHeight={200} />);

      const select = screen.getByRole('button');
      await user.click(select);

      const dropdown = screen.getByText('Apple').closest('div[class*="absolute"]');
      expect(dropdown).toHaveStyle('max-height: 200px');
    });
  });

  describe('accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(<Select options={mockOptions} label="Fruit Select" />);

      const select = screen.getByRole('button');
      expect(select).toHaveAttribute('aria-haspopup', 'listbox');
      expect(select).toHaveAttribute('aria-expanded', 'false');
      expect(select).toHaveAttribute('id');

      const label = screen.getByText('Fruit Select');
      expect(label).toHaveAttribute('for', select.getAttribute('id'));
    });

    it('sets aria-describedby for helper text', () => {
      render(<Select options={mockOptions} helperText="Helper" />);

      const select = screen.getByRole('button');
      const describedBy = select.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();

      const helperText = screen.getByText('Helper');
      expect(helperText).toHaveAttribute('id', describedBy);
    });

    it('sets aria-describedby for description', () => {
      render(<Select options={mockOptions} description="Description" />);

      const select = screen.getByRole('button');
      const describedBy = select.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
    });

    it('provides clear button aria-label', () => {
      render(<Select options={mockOptions} multiple value={['apple']} />);

      const clearButton = screen.getByLabelText('Clear selection');
      expect(clearButton).toBeInTheDocument();
    });
  });

  describe('HTML attributes', () => {
    it('forwards additional props to select button', () => {
      render(
        <Select options={mockOptions} data-testid="custom-select" aria-label="Custom Select" />
      );

      const select = screen.getByTestId('custom-select');
      expect(select).toHaveAttribute('aria-label', 'Custom Select');
    });

    it('does not forward component-specific props as HTML attributes', () => {
      render(
        <Select options={mockOptions} multiple={true} searchable={true} data-testid="select" />
      );

      const select = screen.getByTestId('select');
      expect(select).not.toHaveAttribute('multiple');
      expect(select).not.toHaveAttribute('searchable');
    });
  });

  describe('edge cases', () => {
    it('handles empty options array', () => {
      render(<Select options={[]} />);

      const select = screen.getByRole('button');
      expect(select).toBeInTheDocument();
    });

    it('handles undefined value gracefully', () => {
      render(<Select options={mockOptions} />);

      expect(screen.getByText('Select an option...')).toBeInTheDocument();
    });

    it('handles invalid value gracefully', () => {
      render(<Select options={mockOptions} value="invalid" />);

      // Should show the invalid value as text since no option matches
      expect(screen.getByText('invalid')).toBeInTheDocument();
    });

    it('handles mouse enter on options for keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<Select options={mockOptions} />);

      const select = screen.getByRole('button');
      await user.click(select);

      // Hover over second option
      await user.hover(screen.getByText('Banana'));
      // This should update the focused index for keyboard navigation
    });
  });
});
