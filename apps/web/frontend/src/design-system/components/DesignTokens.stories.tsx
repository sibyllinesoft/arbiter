import type { Meta, StoryObj } from '@storybook/react';
import { colors, typography, spacing, borderRadius, shadows } from '../tokens';
import { cn } from '../variants';

const meta: Meta = {
  title: 'Design System/Foundation/Design Tokens',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Comprehensive showcase of design tokens including colors, typography, spacing, and other foundation elements for the Spec Workbench design system.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

// Color palette showcase
function ColorPalette({
  title,
  colors: colorSet,
  className,
}: {
  title: string;
  colors: Record<string, any>;
  className?: string;
}) {
  return (
    <div className={cn('space-y-4', className)}>
      <h3 className="text-lg font-semibold text-graphite-900">{title}</h3>
      <div className="grid gap-6">
        {Object.entries(colorSet).map(([colorName, colorValue]) => {
          // Handle both flat colors and color scales
          if (typeof colorValue === 'string') {
            return (
              <div key={colorName} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-graphite-700 capitalize">
                    {colorName}
                  </span>
                  <span className="text-xs font-mono text-graphite-500">{colorValue}</span>
                </div>
                <div
                  className="h-12 rounded-lg border border-graphite-200 shadow-sm"
                  style={{ backgroundColor: colorValue }}
                />
              </div>
            );
          }

          // Handle color scales (50-900)
          if (typeof colorValue === 'object' && colorValue !== null) {
            return (
              <div key={colorName} className="space-y-3">
                <h4 className="text-sm font-semibold text-graphite-800 capitalize">{colorName}</h4>
                <div className="grid grid-cols-5 gap-2">
                  {Object.entries(colorValue).map(([shade, hex]) => (
                    <div key={shade} className="space-y-2">
                      <div
                        className="h-16 rounded-lg border border-graphite-200 shadow-sm"
                        style={{ backgroundColor: hex as string }}
                        title={`${colorName}-${shade}: ${hex}`}
                      />
                      <div className="text-center">
                        <div className="text-xs font-medium text-graphite-700">{shade}</div>
                        <div className="text-xs font-mono text-graphite-500">{hex}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}

// Typography showcase
function TypographyShowcase() {
  const headingSizes = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl'] as const;
  const bodyText =
    'The quick brown fox jumps over the lazy dog. This pangram demonstrates the complete character set.';

  return (
    <div className="space-y-8">
      <h3 className="text-lg font-semibold text-graphite-900">Typography Scale</h3>

      {/* Headings */}
      <div className="space-y-6">
        <h4 className="text-md font-semibold text-graphite-800">Headings</h4>
        <div className="space-y-4">
          {headingSizes.reverse().map(size => (
            <div key={size} className="space-y-2">
              <div className="flex items-baseline gap-4">
                <div className={`text-${size} font-bold text-graphite-900`}>
                  Heading {size.toUpperCase()}
                </div>
                <div className="text-xs text-graphite-500 font-mono">text-{size}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Body text */}
      <div className="space-y-6">
        <h4 className="text-md font-semibold text-graphite-800">Body Text</h4>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-lg text-graphite-900">{bodyText}</div>
            <div className="text-xs text-graphite-500 font-mono">text-lg (18px)</div>
          </div>

          <div className="space-y-2">
            <div className="text-base text-graphite-900">{bodyText}</div>
            <div className="text-xs text-graphite-500 font-mono">text-base (16px)</div>
          </div>

          <div className="space-y-2">
            <div className="text-sm text-graphite-900">{bodyText}</div>
            <div className="text-xs text-graphite-500 font-mono">text-sm (14px)</div>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-graphite-900">{bodyText}</div>
            <div className="text-xs text-graphite-500 font-mono">text-xs (12px)</div>
          </div>
        </div>
      </div>

      {/* Font weights */}
      <div className="space-y-6">
        <h4 className="text-md font-semibold text-graphite-800">Font Weights</h4>
        <div className="space-y-3">
          <div className="flex items-center gap-6">
            <div className="text-base font-light text-graphite-900">Light (300)</div>
            <div className="text-xs text-graphite-500 font-mono">font-light</div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-base font-normal text-graphite-900">Regular (400)</div>
            <div className="text-xs text-graphite-500 font-mono">font-normal</div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-base font-medium text-graphite-900">Medium (500)</div>
            <div className="text-xs text-graphite-500 font-mono">font-medium</div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-base font-semibold text-graphite-900">Semibold (600)</div>
            <div className="text-xs text-graphite-500 font-mono">font-semibold</div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-base font-bold text-graphite-900">Bold (700)</div>
            <div className="text-xs text-graphite-500 font-mono">font-bold</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Spacing showcase
function SpacingShowcase() {
  const spacingValues = [
    { name: '0.5', value: '2px', class: 'w-0.5 h-0.5' },
    { name: '1', value: '4px', class: 'w-1 h-1' },
    { name: '2', value: '8px', class: 'w-2 h-2' },
    { name: '3', value: '12px', class: 'w-3 h-3' },
    { name: '4', value: '16px', class: 'w-4 h-4' },
    { name: '6', value: '24px', class: 'w-6 h-6' },
    { name: '8', value: '32px', class: 'w-8 h-8' },
    { name: '12', value: '48px', class: 'w-12 h-12' },
    { name: '16', value: '64px', class: 'w-16 h-16' },
    { name: '20', value: '80px', class: 'w-20 h-20' },
    { name: '24', value: '96px', class: 'w-24 h-24' },
  ];

  return (
    <div className="space-y-8">
      <h3 className="text-lg font-semibold text-graphite-900">Spacing Scale</h3>

      <div className="grid gap-6">
        {spacingValues.map(({ name, value, class: className }) => (
          <div key={name} className="flex items-center gap-6">
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <div className={cn('bg-blue-500 rounded', className)} />
              <div className="space-y-1">
                <div className="text-sm font-medium text-graphite-900">{name}</div>
                <div className="text-xs text-graphite-500">{value}</div>
              </div>
            </div>
            <div className="text-xs text-graphite-500 font-mono">
              w-{name} / h-{name}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Border radius showcase
function BorderRadiusShowcase() {
  const radiusValues = [
    { name: 'none', value: '0px', class: 'rounded-none' },
    { name: 'sm', value: '2px', class: 'rounded-sm' },
    { name: 'default', value: '4px', class: 'rounded' },
    { name: 'md', value: '6px', class: 'rounded-md' },
    { name: 'lg', value: '8px', class: 'rounded-lg' },
    { name: 'xl', value: '12px', class: 'rounded-xl' },
    { name: '2xl', value: '16px', class: 'rounded-2xl' },
    { name: 'full', value: '9999px', class: 'rounded-full' },
  ];

  return (
    <div className="space-y-8">
      <h3 className="text-lg font-semibold text-graphite-900">Border Radius</h3>

      <div className="grid grid-cols-2 gap-6">
        {radiusValues.map(({ name, value, class: className }) => (
          <div key={name} className="flex items-center gap-4">
            <div
              className={cn('w-16 h-16 bg-graphite-200 border-2 border-graphite-300', className)}
            />
            <div className="space-y-1">
              <div className="text-sm font-medium text-graphite-900">{name}</div>
              <div className="text-xs text-graphite-500">{value}</div>
              <div className="text-xs text-graphite-500 font-mono">{className}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Shadow showcase
function ShadowShowcase() {
  const shadowValues = [
    { name: 'sm', class: 'shadow-sm' },
    { name: 'default', class: 'shadow' },
    { name: 'md', class: 'shadow-md' },
    { name: 'lg', class: 'shadow-lg' },
    { name: 'xl', class: 'shadow-xl' },
    { name: '2xl', class: 'shadow-2xl' },
  ];

  return (
    <div className="space-y-8">
      <h3 className="text-lg font-semibold text-graphite-900">Shadows</h3>

      <div className="grid grid-cols-3 gap-8">
        {shadowValues.map(({ name, class: className }) => (
          <div key={name} className="space-y-4">
            <div
              className={cn('w-24 h-24 bg-white border border-graphite-100 rounded-lg', className)}
            />
            <div className="text-center">
              <div className="text-sm font-medium text-graphite-900">{name}</div>
              <div className="text-xs text-graphite-500 font-mono">{className}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Interactive states showcase
function InteractiveStatesShowcase() {
  return (
    <div className="space-y-8">
      <h3 className="text-lg font-semibold text-graphite-900">Interactive States</h3>

      <div className="space-y-6">
        <div className="space-y-4">
          <h4 className="text-md font-semibold text-graphite-800">Button States</h4>
          <div className="flex gap-4">
            <button className="px-4 py-2 bg-blue-600 text-white rounded-md font-medium">
              Default
            </button>
            <button className="px-4 py-2 bg-blue-700 text-white rounded-md font-medium">
              Hover
            </button>
            <button className="px-4 py-2 bg-blue-800 text-white rounded-md font-medium">
              Active
            </button>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-md font-medium ring-2 ring-blue-500 ring-offset-2">
              Focus
            </button>
            <button className="px-4 py-2 bg-graphite-300 text-graphite-500 rounded-md font-medium cursor-not-allowed">
              Disabled
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-md font-semibold text-graphite-800">Input States</h4>
          <div className="space-y-3 max-w-md">
            <input
              type="text"
              placeholder="Default state"
              className="w-full px-3 py-2 border border-graphite-300 rounded-md focus:outline-none"
            />
            <input
              type="text"
              placeholder="Focus state"
              className="w-full px-3 py-2 border border-blue-500 rounded-md ring-2 ring-blue-500 ring-opacity-20 focus:outline-none"
            />
            <input
              type="text"
              placeholder="Error state"
              className="w-full px-3 py-2 border border-red-500 rounded-md ring-2 ring-red-500 ring-opacity-20 focus:outline-none"
            />
            <input
              type="text"
              placeholder="Success state"
              className="w-full px-3 py-2 border border-green-500 rounded-md ring-2 ring-green-500 ring-opacity-20 focus:outline-none"
            />
            <input
              type="text"
              placeholder="Disabled state"
              disabled
              className="w-full px-3 py-2 bg-graphite-50 border border-graphite-200 text-graphite-400 rounded-md cursor-not-allowed"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export const ColorPalettes: Story = {
  render: () => (
    <div className="p-8 max-w-7xl space-y-12">
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-graphite-900">Design Tokens</h1>
        <p className="text-lg text-graphite-600">
          Comprehensive showcase of design tokens for the Spec Workbench design system. These tokens
          ensure consistency and maintainability across all components.
        </p>
      </div>

      <ColorPalette
        title="Primary Colors"
        colors={{
          graphite: colors.graphite,
          blue: colors.blue,
        }}
      />

      <ColorPalette
        title="Semantic Colors"
        colors={{
          red: colors.red,
          yellow: colors.yellow,
          green: colors.green,
          purple: colors.purple,
        }}
      />

      <ColorPalette
        title="Neutral Colors"
        colors={{
          gray: colors.gray,
          slate: colors.slate,
        }}
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Complete color palette including graphite primary colors, semantic colors, and neutral tones with all shade variations.',
      },
    },
  },
};

export const TypographyScale: Story = {
  render: () => (
    <div className="p-8 max-w-4xl">
      <TypographyShowcase />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Typography scale showing heading sizes, body text, and font weight variations.',
      },
    },
  },
};

export const SpacingSystem: Story = {
  render: () => (
    <div className="p-8 max-w-4xl">
      <SpacingShowcase />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Spacing scale with visual representations of all spacing tokens from 0.5 to 24.',
      },
    },
  },
};

export const BorderRadiusScale: Story = {
  render: () => (
    <div className="p-8 max-w-4xl">
      <BorderRadiusShowcase />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Border radius scale showing all available radius values from none to full.',
      },
    },
  },
};

export const ShadowScale: Story = {
  render: () => (
    <div className="p-8 max-w-4xl">
      <ShadowShowcase />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Shadow elevation scale with visual examples of each shadow level.',
      },
    },
  },
};

export const InteractiveStates: Story = {
  render: () => (
    <div className="p-8 max-w-4xl">
      <InteractiveStatesShowcase />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Interactive state examples showing hover, focus, active, and disabled states for various elements.',
      },
    },
  },
};

export const ComprehensiveTokens: Story = {
  render: () => (
    <div className="p-8 max-w-7xl space-y-16">
      <div className="space-y-6">
        <h1 className="text-4xl font-bold text-graphite-900">Spec Workbench Design System</h1>
        <div className="text-xl text-graphite-600 space-y-2">
          <p>
            Professional design tokens for modern developer tools. This comprehensive token system
            ensures visual consistency and maintainable styling across the entire Spec Workbench
            application.
          </p>
          <p className="text-base text-graphite-500">
            Built with accessibility, scalability, and developer experience in mind.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-16">
        <div className="space-y-16">
          <ColorPalette
            title="Color System"
            colors={{
              graphite: colors.graphite,
              blue: colors.blue,
              red: colors.red,
              green: colors.green,
            }}
          />

          <SpacingShowcase />

          <BorderRadiusShowcase />
        </div>

        <div className="space-y-16">
          <TypographyShowcase />

          <ShadowShowcase />

          <InteractiveStatesShowcase />
        </div>
      </div>

      <div className="bg-graphite-50 rounded-2xl p-8">
        <h2 className="text-2xl font-bold text-graphite-900 mb-4">Usage Guidelines</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-graphite-900 mb-2">Colors</h3>
              <p className="text-graphite-600">
                Use graphite as the primary neutral color for text and borders. Blue is the accent
                color for interactive elements and brand presence.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-graphite-900 mb-2">Typography</h3>
              <p className="text-graphite-600">
                Use semibold weights for headings and medium for emphasized text. Body text should
                be at least 14px for accessibility.
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-graphite-900 mb-2">Spacing</h3>
              <p className="text-graphite-600">
                Use consistent spacing multiples of 4px. Common values: 4px, 8px, 12px, 16px, 24px
                for most layout needs.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-graphite-900 mb-2">Elevation</h3>
              <p className="text-graphite-600">
                Use subtle shadows (sm, md) for cards and subtle elevation. Larger shadows (lg, xl,
                2xl) for modals and overlays.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Complete design system showcase with all tokens, usage guidelines, and best practices.',
      },
    },
  },
};
