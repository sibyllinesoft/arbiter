/**
 * Design Tokens Stories
 * Comprehensive documentation for the Graphite design system tokens
 * Shows professional usage in developer tool contexts
 */

import type { Meta, StoryObj } from '@storybook/react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  Code,
  Database,
  FileText,
} from 'lucide-react';
import { storybookData } from '../test/storybook-data';
import { borderRadius, colors, shadows, spacing, typography } from './tokens';

const meta = {
  title: 'Design System/Tokens',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Design tokens for the Graphite theme - colors, typography, spacing, and other design primitives that ensure consistency across the application.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

// Color Palette
export const Colors: Story = {
  render: () => (
    <div className="p-8 space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-6">Color Palette</h2>

        {/* Graphite Scale */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Graphite Scale (Primary)</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-4">
            {Object.entries(colors.graphite).map(([key, value]) => (
              <div key={key} className="text-center">
                <div
                  className="w-16 h-16 rounded-lg mb-2 border border-gray-200"
                  style={{ backgroundColor: value }}
                />
                <div className="text-sm font-medium">graphite-{key}</div>
                <div className="text-xs text-gray-600 font-mono">{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Semantic Colors */}
        <div className="space-y-6">
          <h3 className="text-lg font-semibold">Semantic Colors</h3>

          {Object.entries(colors.semantic).map(([category, colorSet]) => (
            <div key={category}>
              <h4 className="text-md font-medium mb-3 capitalize">{category}</h4>
              <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-4">
                {Object.entries(colorSet as Record<string, string>).map(([shade, value]) => (
                  <div key={shade} className="text-center">
                    <div
                      className="w-12 h-12 rounded-lg mb-2 border border-gray-200"
                      style={{ backgroundColor: value }}
                    />
                    <div className="text-xs font-medium">{shade}</div>
                    <div className="text-xs text-gray-500 font-mono">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Accent Colors */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4">Accent Colors</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(colors.accent).map(([key, value]) => (
              <div key={key} className="text-center">
                <div
                  className="w-16 h-16 rounded-lg mb-2 border border-gray-200"
                  style={{ backgroundColor: value }}
                />
                <div className="text-sm font-medium">{key}</div>
                <div className="text-xs text-gray-600 font-mono">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Complete color palette including the primary graphite scale, semantic colors for status indicators, and accent colors for interactive elements.',
      },
    },
  },
};

// Typography
export const Typography: Story = {
  render: () => (
    <div className="p-8 space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-6">Typography</h2>

        {/* Font Families */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Font Families</h3>
          <div className="space-y-4">
            <div>
              <div className="text-sm text-gray-600 mb-2">Sans Serif (UI Text)</div>
              <div className="text-xl" style={{ fontFamily: typography.fontFamily.sans }}>
                The quick brown fox jumps over the lazy dog
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-2">Monospace (Code)</div>
              <div className="text-xl" style={{ fontFamily: typography.fontFamily.mono }}>
                const hello = "world"; // Code example
              </div>
            </div>
          </div>
        </div>

        {/* Font Sizes */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Font Sizes</h3>
          <div className="space-y-4">
            {Object.entries(typography.fontSize).map(([key, [size, { lineHeight }]]) => (
              <div key={key} className="flex items-center gap-8">
                <div className="w-12 text-sm text-gray-600 font-mono">{key}</div>
                <div className="w-20 text-sm text-gray-600 font-mono">{size}</div>
                <div className="flex-1" style={{ fontSize: size, lineHeight }}>
                  The quick brown fox jumps over the lazy dog
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Font Weights */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Font Weights</h3>
          <div className="space-y-3">
            {Object.entries(typography.fontWeight).map(([key, weight]) => (
              <div key={key} className="flex items-center gap-8">
                <div className="w-20 text-sm text-gray-600 font-mono">{key}</div>
                <div className="w-12 text-sm text-gray-600 font-mono">{weight}</div>
                <div className="text-lg" style={{ fontWeight: weight }}>
                  The quick brown fox jumps over the lazy dog
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Typography system including font families, sizes, and weights. Optimized for developer tools with excellent code readability.',
      },
    },
  },
};

// Spacing Scale
export const Spacing: Story = {
  render: () => (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">Spacing Scale</h2>
      <div className="space-y-4">
        {Object.entries(spacing).map(([key, value]) => (
          <div key={key} className="flex items-center gap-4">
            <div className="w-12 text-sm text-gray-600 font-mono">{key}</div>
            <div className="w-20 text-sm text-gray-600 font-mono">{value}</div>
            <div className="bg-blue-200 h-4" style={{ width: value }} />
          </div>
        ))}
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Consistent spacing scale used for margins, padding, and gaps throughout the interface.',
      },
    },
  },
};

// Border Radius
export const BorderRadius: Story = {
  render: () => (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">Border Radius</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {Object.entries(borderRadius).map(([key, value]) => (
          <div key={key} className="text-center">
            <div
              className="w-16 h-16 bg-blue-100 border-2 border-blue-300 mb-2 mx-auto"
              style={{ borderRadius: value }}
            />
            <div className="text-sm font-medium">{key === 'DEFAULT' ? 'default' : key}</div>
            <div className="text-xs text-gray-600 font-mono">{value}</div>
          </div>
        ))}
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Border radius tokens for consistent rounded corners across components.',
      },
    },
  },
};

// Shadows
export const Shadows: Story = {
  render: () => (
    <div className="p-8 bg-gray-50">
      <h2 className="text-2xl font-bold mb-6">Shadows</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
        {Object.entries(shadows).map(([key, value]) => {
          if (key === 'none') return null;
          return (
            <div key={key} className="text-center">
              <div
                className="w-20 h-20 bg-white rounded-lg mb-3 mx-auto"
                style={{ boxShadow: value }}
              />
              <div className="text-sm font-medium">{key === 'DEFAULT' ? 'default' : key}</div>
              <div className="text-xs text-gray-600 font-mono break-all">{value}</div>
            </div>
          );
        })}
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Shadow tokens providing depth and elevation to UI elements.',
      },
    },
  },
};

// Code Colors (Monaco Editor theme preview)
export const CodeColors: Story = {
  render: () => (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">Code Editor Theme</h2>
      <div
        className="p-6 rounded-lg font-mono text-sm"
        style={{ backgroundColor: colors.code.background, color: colors.code.text }}
      >
        <div className="space-y-2">
          <div>
            <span style={{ color: colors.code.comment }}>// Example CUE configuration</span>
          </div>
          <div>
            <span style={{ color: colors.code.keyword }}>package</span>
            <span> main</span>
          </div>
          <div className="mt-4">
            <span style={{ color: colors.code.variable }}>config</span>
            <span>: {`{`}</span>
          </div>
          <div className="pl-4">
            <span style={{ color: colors.code.variable }}>name</span>
            <span>: </span>
            <span style={{ color: colors.code.string }}>"spec-workbench"</span>
          </div>
          <div className="pl-4">
            <span style={{ color: colors.code.variable }}>version</span>
            <span>: </span>
            <span style={{ color: colors.code.number }}>1.0</span>
          </div>
          <div className="pl-4">
            <span style={{ color: colors.code.function }}>validate</span>
            <span>: </span>
            <span style={{ color: colors.code.keyword }}>true</span>
          </div>
          <div>
            <span>{`}`}</span>
          </div>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Color scheme for the Monaco code editor, providing excellent contrast and readability for CUE language syntax.',
      },
    },
  },
};

// Comprehensive token usage in realistic developer interface
export const ProfessionalUsageExample: Story = {
  render: () => (
    <div style={{ fontFamily: typography.fontFamily.sans }} className="min-h-screen bg-gray-50">
      {/* Header using typography and color tokens */}
      <header className="bg-white border-b border-gray-200" style={{ padding: spacing[6] }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center"
              style={{
                width: spacing[8],
                height: spacing[8],
                backgroundColor: colors.accent.primary,
                borderRadius: borderRadius.lg,
              }}
            >
              <Code className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1
                style={{
                  fontSize: typography.fontSize.xl[0],
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.text.primary,
                  lineHeight: typography.fontSize.xl[1].lineHeight,
                }}
              >
                {storybookData.projects[0]?.name || 'Project Name'}
              </h1>
              <p
                style={{
                  fontSize: typography.fontSize.sm[0],
                  color: colors.text.tertiary,
                  lineHeight: typography.fontSize.sm[1].lineHeight,
                }}
              >
                Professional specification workbench
              </p>
            </div>
          </div>

          <div className="flex items-center" style={{ gap: spacing[4] }}>
            <div
              className="px-3 py-2 rounded-md bg-green-100 text-green-800"
              style={{
                borderRadius: borderRadius.md,
                fontSize: typography.fontSize.xs[0],
                fontWeight: typography.fontWeight.medium,
              }}
            >
              All Systems Operational
            </div>
            <img
              src={storybookData.users.currentUser.avatar}
              alt="User"
              className="rounded-full"
              style={{ width: spacing[8], height: spacing[8] }}
            />
          </div>
        </div>
      </header>

      {/* Main content area demonstrating spacing and layout tokens */}
      <main style={{ padding: `${spacing[8]} ${spacing[6]}` }}>
        <div className="max-w-6xl mx-auto">
          {/* Status cards using elevation and color tokens */}
          <div
            className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8"
            style={{ marginBottom: spacing[8] }}
          >
            {[
              {
                title: 'Active Specs',
                value: '23',
                icon: FileText,
                color: colors.semantic.info[500],
                bg: colors.semantic.info[50],
              },
              {
                title: 'Build Status',
                value: 'Passing',
                icon: CheckCircle,
                color: colors.semantic.success[500],
                bg: colors.semantic.success[50],
              },
              {
                title: 'Coverage',
                value: '98.5%',
                icon: Activity,
                color: colors.semantic.success[500],
                bg: colors.semantic.success[50],
              },
              {
                title: 'Issues',
                value: '2',
                icon: AlertTriangle,
                color: colors.semantic.warning[500],
                bg: colors.semantic.warning[50],
              },
            ].map((stat, index) => (
              <div
                key={index}
                className="bg-white"
                style={{
                  padding: spacing[6],
                  borderRadius: borderRadius.lg,
                  boxShadow: shadows.md,
                  border: `1px solid ${colors.border.subtle}`,
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div
                      style={{
                        fontSize: typography.fontSize['2xl'][0],
                        fontWeight: typography.fontWeight.bold,
                        color: colors.text.primary,
                      }}
                    >
                      {stat.value}
                    </div>
                    <div
                      style={{
                        fontSize: typography.fontSize.sm[0],
                        color: colors.text.tertiary,
                        marginTop: spacing[1],
                      }}
                    >
                      {stat.title}
                    </div>
                  </div>
                  <div
                    className="flex items-center justify-center"
                    style={{
                      width: spacing[12],
                      height: spacing[12],
                      backgroundColor: stat.bg,
                      borderRadius: borderRadius.lg,
                    }}
                  >
                    <stat.icon
                      style={{ width: spacing[6], height: spacing[6], color: stat.color }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Project list using typography hierarchy and semantic colors */}
          <div
            className="bg-white"
            style={{
              borderRadius: borderRadius.lg,
              boxShadow: shadows.lg,
              border: `1px solid ${colors.border.subtle}`,
            }}
          >
            <div style={{ padding: spacing[6], borderBottom: `1px solid ${colors.border.subtle}` }}>
              <h2
                style={{
                  fontSize: typography.fontSize.lg[0],
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.text.primary,
                }}
              >
                Recent Projects
              </h2>
              <p
                style={{
                  fontSize: typography.fontSize.sm[0],
                  color: colors.text.secondary,
                  marginTop: spacing[1],
                }}
              >
                Your active specification projects and their status
              </p>
            </div>

            <div>
              {storybookData.projects.map((project, index) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between hover:bg-gray-50 transition-colors"
                  style={{
                    padding: spacing[4],
                    borderBottom:
                      index < storybookData.projects.length - 1
                        ? `1px solid ${colors.border.subtle}`
                        : 'none',
                  }}
                >
                  <div className="flex items-center" style={{ gap: spacing[4] }}>
                    <div
                      className="flex items-center justify-center"
                      style={{
                        width: spacing[10],
                        height: spacing[10],
                        backgroundColor: colors.semantic.info[100],
                        borderRadius: borderRadius.lg,
                      }}
                    >
                      <Database className="h-5 w-5" style={{ color: colors.semantic.info[600] }} />
                    </div>
                    <div>
                      <h3
                        style={{
                          fontSize: typography.fontSize.base[0],
                          fontWeight: typography.fontWeight.medium,
                          color: colors.text.primary,
                        }}
                      >
                        {project.name}
                      </h3>
                      <p
                        style={{
                          fontSize: typography.fontSize.sm[0],
                          color: colors.text.tertiary,
                          marginTop: spacing[0.5],
                        }}
                      >
                        Updated {new Date(project.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center" style={{ gap: spacing[3] }}>
                    <div
                      className="px-2 py-1 rounded-full"
                      style={{
                        backgroundColor:
                          index === 0
                            ? colors.semantic.success[100]
                            : index === 1
                              ? colors.semantic.warning[100]
                              : colors.semantic.info[100],
                        color:
                          index === 0
                            ? colors.semantic.success[800]
                            : index === 1
                              ? colors.semantic.warning[800]
                              : colors.semantic.info[800],
                        fontSize: typography.fontSize.xs[0],
                        fontWeight: typography.fontWeight.medium,
                      }}
                    >
                      {index === 0 ? 'Active' : index === 1 ? 'Building' : 'Ready'}
                    </div>
                    <button
                      className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
                      style={{ borderRadius: borderRadius.DEFAULT }}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Code editor preview using code color tokens */}
          <div
            className="mt-8"
            style={{
              backgroundColor: colors.code.background,
              borderRadius: borderRadius.lg,
              boxShadow: shadows.xl,
              overflow: 'hidden',
            }}
          >
            <div
              className="px-4 py-3 border-b"
              style={{
                backgroundColor: colors.graphite[800],
                borderBottom: `1px solid ${colors.graphite[700]}`,
              }}
            >
              <div className="flex items-center" style={{ gap: spacing[2] }}>
                <div
                  style={{
                    width: spacing[3],
                    height: spacing[3],
                    backgroundColor: colors.semantic.error[500],
                    borderRadius: borderRadius.full,
                  }}
                />
                <div
                  style={{
                    width: spacing[3],
                    height: spacing[3],
                    backgroundColor: colors.semantic.warning[500],
                    borderRadius: borderRadius.full,
                  }}
                />
                <div
                  style={{
                    width: spacing[3],
                    height: spacing[3],
                    backgroundColor: colors.semantic.success[500],
                    borderRadius: borderRadius.full,
                  }}
                />
                <span
                  className="ml-4"
                  style={{
                    color: colors.code.text,
                    fontSize: typography.fontSize.sm[0],
                    fontFamily: typography.fontFamily.mono,
                  }}
                >
                  authentication.yml
                </span>
              </div>
            </div>

            <div
              style={{
                padding: spacing[4],
                fontFamily: typography.fontFamily.mono,
                fontSize: typography.fontSize.sm[0],
                lineHeight: '1.5',
              }}
            >
              <div className="space-y-1">
                <div>
                  <span style={{ color: colors.code.comment }}>
                    # User Authentication Specification
                  </span>
                </div>
                <div style={{ marginTop: spacing[2] }}>
                  <span style={{ color: colors.code.keyword }}>capabilities:</span>
                </div>
                <div style={{ paddingLeft: spacing[4] }}>
                  <span style={{ color: colors.code.string }}>- name: "User Login"</span>
                </div>
                <div style={{ paddingLeft: spacing[6] }}>
                  <span style={{ color: colors.code.variable }}>requirements:</span>
                </div>
                <div style={{ paddingLeft: spacing[8] }}>
                  <span style={{ color: colors.code.string }}>- "Multi-factor authentication"</span>
                </div>
                <div style={{ paddingLeft: spacing[8] }}>
                  <span style={{ color: colors.code.string }}>- "Session management"</span>
                </div>
                <div style={{ paddingLeft: spacing[4] }}>
                  <span style={{ color: colors.code.variable }}>tests:</span>
                </div>
                <div style={{ paddingLeft: spacing[6] }}>
                  <span style={{ color: colors.code.function }}>coverage</span>
                  <span style={{ color: colors.code.text }}>: </span>
                  <span style={{ color: colors.code.number }}>95</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: `
### Professional Token Usage

This comprehensive example demonstrates how design tokens are applied throughout a realistic developer tool interface, 
showcasing the systematic approach to colors, typography, spacing, and other design primitives.

**Token Categories Demonstrated:**

**Colors:**
- Semantic colors for status indicators (success, warning, error, info)
- Graphite scale for text hierarchy and neutral elements
- Code editor color scheme for syntax highlighting
- Interactive states and hover effects

**Typography:**
- Font family system with sans-serif for UI and monospace for code
- Size scale from xs (12px) to 2xl (24px) with appropriate line heights
- Font weight hierarchy for information emphasis
- Professional text color scale for readability

**Spacing:**
- Consistent spacing scale using rem units
- Padding and margin relationships
- Grid layouts and component spacing
- Visual rhythm and breathing room

**Other Tokens:**
- Border radius for modern, friendly interfaces
- Box shadows for depth and elevation
- Border colors for subtle separation
- Interactive feedback and transitions

This example shows how systematic design tokens create consistency, maintainability, 
and professional polish across complex developer interfaces.
        `,
      },
    },
  },
};
