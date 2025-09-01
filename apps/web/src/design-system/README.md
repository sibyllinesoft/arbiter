# Graphite Design System

A professional, minimal design system for developer tools with a sophisticated graphite color palette.

## Philosophy

The Graphite Design System embodies the principles of premium developer tools like GitHub, Linear, and Vercel:

- **Professional Minimalism**: Clean, sophisticated interfaces that don't distract from the task at hand
- **Excellent Typography**: Readable fonts optimized for both UI text and code
- **Thoughtful Hierarchy**: Clear visual hierarchy that guides users naturally
- **Accessible by Default**: WCAG 2.1 AA compliance built into all components
- **Developer-Focused**: Designed specifically for technical workflows and complex data

## Getting Started

```tsx
import { Button, Input, Card } from '../design-system';

function MyComponent() {
  return (
    <Card>
      <Input label="Project Name" placeholder="Enter project name" />
      <Button variant="primary">Create Project</Button>
    </Card>
  );
}
```

## Color System

### Graphite Scale (Primary)
The primary color scale provides 10 shades of sophisticated grays:

- `graphite-50`: Almost white, subtle backgrounds
- `graphite-100`: Light backgrounds, panels
- `graphite-200`: Subtle borders
- `graphite-300`: Light borders, disabled text
- `graphite-400`: Placeholder text, icons
- `graphite-500`: Body text, secondary elements
- `graphite-600`: Headers, strong text
- `graphite-700`: Primary text, headings
- `graphite-800`: Dark text, strong emphasis
- `graphite-900`: Darkest, high contrast

### Semantic Colors
Status-based colors for different states:

- **Success**: Emerald scale for positive states
- **Warning**: Amber scale for cautionary states  
- **Error**: Red scale for error states
- **Info**: Blue scale for informational states

### Usage Examples

```tsx
<div className="bg-graphite-50 border border-graphite-200">
  <h2 className="text-graphite-800 font-semibold">Title</h2>
  <p className="text-graphite-600">Description text</p>
</div>
```

## Typography

### Font Families
- **Sans Serif**: System fonts optimized for UI text
- **Monospace**: Optimized for code with ligature support (Fira Code preferred)

### Font Sizes
Standard scale from `xs` (12px) to `4xl` (36px) with optimized line heights.

### Font Weights
- **normal** (400): Body text
- **medium** (500): Emphasis
- **semibold** (600): Headings
- **bold** (700): Strong emphasis

## Components

### Button
Professional button component with comprehensive variants:

```tsx
<Button variant="primary" size="md" leftIcon={<Save />}>
  Save Changes
</Button>
```

**Variants**: `primary`, `secondary`, `ghost`, `danger`  
**Sizes**: `xs`, `sm`, `md`, `lg`, `xl`

### Input
Form input with validation states:

```tsx
<Input 
  label="Email"
  placeholder="Enter your email"
  error="Please enter a valid email"
  leftIcon={<Mail />}
/>
```

**Variants**: `default`, `error`, `success`  
**Sizes**: `sm`, `md`, `lg`

### Card
Container component for grouping content:

```tsx
<Card variant="elevated" padding="lg">
  <h3>Card Title</h3>
  <p>Card content</p>
</Card>
```

**Variants**: `default`, `interactive`, `elevated`

### StatusBadge
Status indicators with semantic colors:

```tsx
<StatusBadge variant="success" showDot>
  Connected
</StatusBadge>
```

**Variants**: `success`, `warning`, `error`, `info`, `neutral`

### Modal
Accessible modal dialogs:

```tsx
<Modal open={isOpen} onClose={() => setIsOpen(false)} title="Confirm Action">
  <p>Are you sure you want to continue?</p>
</Modal>
```

### Toast
Non-intrusive notifications:

```tsx
<Toast 
  variant="success"
  title="Changes saved"
  description="Your project has been updated"
/>
```

### Tabs
Clean tabbed interfaces:

```tsx
<Tabs 
  items={[
    { id: 'code', label: 'Code', content: <CodeEditor /> },
    { id: 'preview', label: 'Preview', content: <Preview /> }
  ]}
/>
```

## Design Tokens

### Spacing Scale
Consistent spacing based on 4px increments:
- `1` = 4px
- `2` = 8px  
- `4` = 16px
- `6` = 24px
- `8` = 32px

### Border Radius
- `sm`: 2px - Small elements
- `DEFAULT`: 4px - Standard elements  
- `md`: 6px - Cards, panels
- `lg`: 8px - Large components
- `xl`: 12px - Hero elements

### Shadows
Subtle elevation system:
- `sm`: Minimal shadow for slight elevation
- `DEFAULT`: Standard shadow for cards
- `md`: Medium shadow for floating elements
- `lg`: Large shadow for modals
- `xl`: Maximum shadow for overlays

## Best Practices

### Color Usage
- Use graphite scale for most UI elements
- Reserve semantic colors for status indicators
- Maintain sufficient contrast ratios (4.5:1 minimum)
- Test in both light and dark modes

### Typography
- Use font weight hierarchy consistently
- Maintain readable line heights (1.4-1.6 for body text)
- Limit font sizes - stick to the scale
- Use monospace fonts only for code

### Spacing
- Use the spacing scale consistently
- Maintain vertical rhythm with consistent line heights
- Group related elements with consistent spacing
- Use whitespace to create visual hierarchy

### Accessibility
- All components meet WCAG 2.1 AA standards
- Interactive elements have minimum 44px touch targets
- Focus indicators are clearly visible
- Color is never the only way to convey information

## Development Workflow

### Adding Components
1. Create component in `src/design-system/components/`
2. Follow existing patterns for props and variants
3. Export from main index file
4. Create comprehensive Storybook stories
5. Document usage and examples

### Using in Applications
```tsx
// Always import from the design system root
import { Button, Input, colors } from '../design-system';

// Use design tokens for custom styling
const customStyles = {
  backgroundColor: colors.graphite[50],
  borderColor: colors.graphite[200],
};
```

### Customization
The design system is built on Tailwind CSS. Extend colors and tokens in `tailwind.config.js`:

```js
module.exports = {
  theme: {
    extend: {
      colors: {
        // Custom colors extend the graphite scale
        brand: {
          50: '#f0f9ff',
          // ... rest of scale
        }
      }
    }
  }
}
```

## Storybook Documentation

All components are documented in Storybook with:
- Interactive controls for all props
- Multiple usage examples
- Accessibility information
- Design token showcase

Run Storybook to explore components:
```bash
npm run storybook
```

## Contributing

1. Follow existing patterns and conventions
2. Maintain accessibility standards
3. Write comprehensive tests
4. Update documentation
5. Create thorough Storybook stories

## Resources

- [Storybook](http://localhost:6006) - Component documentation
- [WCAG Guidelines](https://www.w3.org/WAI/WCAG21/quickref/) - Accessibility standards
- [Tailwind CSS](https://tailwindcss.com) - Utility framework