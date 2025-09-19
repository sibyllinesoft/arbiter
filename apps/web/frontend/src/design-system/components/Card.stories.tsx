/**
 * Card Component Stories
 * Comprehensive documentation and examples for the Card component
 * Showcasing professional card layouts with sophisticated graphite theme
 */

import type { Meta, StoryObj } from '@storybook/react';
import {
  Settings,
  Database,
  Shield,
  Zap,
  Globe,
  Users,
  Code,
  GitBranch,
  Activity,
  Folder,
  FileText,
  Play,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
} from 'lucide-react';
import Card from './Card';
import Button from './Button';

const meta = {
  title: 'Design System/Card',
  component: Card,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Professional card component with comprehensive variants, interactive states, and accessibility features. Designed for developer tools with sophisticated graphite theme.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'interactive', 'elevated', 'outlined', 'ghost'],
      description: 'Visual variant of the card',
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg', 'xl'],
      description: 'Size of the card affecting padding and typography',
    },
    title: {
      control: { type: 'text' },
      description: 'Card title',
    },
    subtitle: {
      control: { type: 'text' },
      description: 'Card subtitle or description',
    },
    loading: {
      control: { type: 'boolean' },
      description: 'Whether the card is in a loading state',
    },
    disabled: {
      control: { type: 'boolean' },
      description: 'Whether the card is disabled',
    },
    selected: {
      control: { type: 'boolean' },
      description: 'Whether the card is selected',
    },
    hoverable: {
      control: { type: 'boolean' },
      description: 'Whether the card has hover effects',
    },
    headerDivider: {
      control: { type: 'boolean' },
      description: 'Whether to show a divider below the header',
    },
    footerDivider: {
      control: { type: 'boolean' },
      description: 'Whether to show a divider above the footer',
    },
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default card
export const Default: Story = {
  args: {
    title: 'Project Settings',
    subtitle: 'Configure your project preferences and build settings',
    children: (
      <p className="text-graphite-600">
        This is the main content area of the card. You can put any content here including text,
        forms, or other components.
      </p>
    ),
  },
};

// All variants
export const Variants: Story = {
  render: () => (
    <div className="w-96 space-y-4">
      <Card variant="default" title="Default Card" subtitle="Standard card with subtle styling">
        <p className="text-graphite-600 text-sm">Clean and minimal design for general content.</p>
      </Card>

      <Card
        variant="interactive"
        title="Interactive Card"
        subtitle="Clickable card with hover effects"
        onClick={() => console.log('Card clicked')}
      >
        <p className="text-graphite-600 text-sm">Perfect for navigation or selectable items.</p>
      </Card>

      <Card variant="elevated" title="Elevated Card" subtitle="Prominent card with enhanced shadow">
        <p className="text-graphite-600 text-sm">
          Stands out from the background with elegant elevation.
        </p>
      </Card>

      <Card variant="outlined" title="Outlined Card" subtitle="Card with prominent border styling">
        <p className="text-graphite-600 text-sm">Clear boundaries with transparent background.</p>
      </Card>

      <Card
        variant="ghost"
        title="Ghost Card"
        subtitle="Minimal card without borders or shadows"
        hoverable
      >
        <p className="text-graphite-600 text-sm">Subtle presence that reveals on interaction.</p>
      </Card>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Card variants for different use cases: Default for general content, Interactive for clickable items, Elevated for important content, Outlined for clear boundaries, and Ghost for subtle layouts.',
      },
    },
  },
};

// All sizes
export const Sizes: Story = {
  render: () => (
    <div className="space-y-6">
      <Card size="sm" title="Small Card" subtitle="Compact size for dense layouts">
        <p className="text-graphite-600">Perfect for dashboard widgets and summary cards.</p>
      </Card>

      <Card size="md" title="Medium Card" subtitle="Default size for most use cases">
        <p className="text-graphite-600">
          The standard size that works well in most contexts and layouts.
        </p>
      </Card>

      <Card size="lg" title="Large Card" subtitle="Spacious size for detailed content">
        <p className="text-graphite-600">
          Ideal for forms, detailed information, or when you need more visual breathing room.
        </p>
      </Card>

      <Card size="xl" title="Extra Large Card" subtitle="Maximum size for hero content">
        <p className="text-graphite-600">
          Perfect for landing pages, feature highlights, or any content that needs to make a strong
          visual impact.
        </p>
      </Card>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Card sizes with proportional padding and typography scaling.',
      },
    },
  },
};

// Interactive states
export const InteractiveStates: Story = {
  render: () => (
    <div className="w-96 space-y-4">
      <Card
        variant="interactive"
        title="Default State"
        subtitle="Normal interactive card"
        onClick={() => console.log('Default clicked')}
      >
        <p className="text-graphite-600 text-sm">Click to interact</p>
      </Card>

      <Card
        variant="interactive"
        title="Selected State"
        subtitle="Currently selected card"
        selected
        onClick={() => console.log('Selected clicked')}
      >
        <p className="text-graphite-600 text-sm">This card is currently selected</p>
      </Card>

      <Card
        variant="interactive"
        title="Disabled State"
        subtitle="Cannot be interacted with"
        disabled
        onClick={() => console.log('This should not fire')}
      >
        <p className="text-graphite-600 text-sm">This card is disabled</p>
      </Card>

      <Card
        variant="interactive"
        title="Loading State"
        subtitle="Processing request"
        loading
        onClick={() => console.log('This should not fire')}
      >
        <p className="text-graphite-600 text-sm">Content is being loaded</p>
      </Card>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Interactive card states: default, selected, disabled, and loading with appropriate visual feedback.',
      },
    },
  },
};

// Cards with custom headers and footers
export const HeadersAndFooters: Story = {
  render: () => (
    <div className="space-y-6 max-w-md">
      <Card
        header={
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-blue-500" />
              <h3 className="font-semibold text-graphite-900">Database Status</h3>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-xs text-green-600">Online</span>
            </div>
          </div>
        }
        headerDivider
      >
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-graphite-600">Connections:</span>
            <span className="font-mono text-graphite-900">127/200</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-graphite-600">Response time:</span>
            <span className="font-mono text-graphite-900">12ms</span>
          </div>
        </div>
      </Card>

      <Card
        title="Deployment Pipeline"
        subtitle="Build and deploy your application"
        footerDivider
        footer={
          <div className="flex items-center justify-between">
            <Button size="sm" variant="ghost">
              View Logs
            </Button>
            <Button size="sm">Deploy Now</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm text-graphite-700">Build completed</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm text-graphite-700">Tests passed</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            <span className="text-sm text-graphite-700">Ready to deploy</span>
          </div>
        </div>
      </Card>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Cards with custom headers and footers, including dividers for clear section separation.',
      },
    },
  },
};

// Professional developer tool examples
export const DeveloperToolExamples: Story = {
  render: () => (
    <div className="space-y-8 max-w-6xl">
      {/* Project Cards */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-graphite-800">Project Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card
            variant="interactive"
            size="sm"
            onClick={() => console.log('Frontend project clicked')}
            header={
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code className="h-4 w-4 text-blue-500" />
                  <span className="font-medium text-graphite-900">Frontend</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-xs text-green-600">Deployed</span>
                </div>
              </div>
            }
          >
            <div className="space-y-2">
              <p className="text-xs text-graphite-600">React + TypeScript</p>
              <div className="flex justify-between text-xs">
                <span className="text-graphite-500">Last deploy:</span>
                <span className="text-graphite-700">2m ago</span>
              </div>
            </div>
          </Card>

          <Card
            variant="interactive"
            size="sm"
            onClick={() => console.log('API project clicked')}
            header={
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-emerald-500" />
                  <span className="font-medium text-graphite-900">API</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-amber-500 rounded-full" />
                  <span className="text-xs text-amber-600">Building</span>
                </div>
              </div>
            }
          >
            <div className="space-y-2">
              <p className="text-xs text-graphite-600">Node.js + Express</p>
              <div className="flex justify-between text-xs">
                <span className="text-graphite-500">Build time:</span>
                <span className="text-graphite-700">1m 23s</span>
              </div>
            </div>
          </Card>

          <Card
            variant="interactive"
            size="sm"
            onClick={() => console.log('Database project clicked')}
            header={
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-purple-500" />
                  <span className="font-medium text-graphite-900">Database</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full" />
                  <span className="text-xs text-red-600">Error</span>
                </div>
              </div>
            }
          >
            <div className="space-y-2">
              <p className="text-xs text-graphite-600">PostgreSQL 14</p>
              <div className="flex justify-between text-xs">
                <span className="text-graphite-500">Error:</span>
                <span className="text-red-600">Connection failed</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Repository Management */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-graphite-800">Repository Management</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card
            variant="default"
            title="spec-workbench"
            subtitle="Specification workbench with CUE language support"
            header={
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-graphite-500" />
                  <span className="text-sm font-medium text-graphite-900">spec-workbench</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                    TypeScript
                  </span>
                  <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">
                    Public
                  </span>
                </div>
              </div>
            }
            headerDivider
            footerDivider
            footer={
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs text-graphite-600">
                  <span>⭐ 124</span>
                  <span>🍴 23</span>
                  <span>Updated 2h ago</span>
                </div>
                <Button size="sm" variant="ghost">
                  View Repository
                </Button>
              </div>
            }
          >
            <div className="space-y-3">
              <p className="text-sm text-graphite-600">
                A sophisticated specification workbench with CUE language editing, real-time
                collaboration, and technical workflows.
              </p>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-graphite-600">TypeScript 78.2%</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-orange-500" />
                  <span className="text-graphite-600">HTML 12.1%</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-purple-500" />
                  <span className="text-graphite-600">CSS 9.7%</span>
                </div>
              </div>
            </div>
          </Card>

          <Card
            variant="default"
            title="api-gateway"
            subtitle="Microservices API gateway with authentication"
            header={
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-graphite-500" />
                  <span className="text-sm font-medium text-graphite-900">api-gateway</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                    Go
                  </span>
                  <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full">
                    Private
                  </span>
                </div>
              </div>
            }
            headerDivider
            footerDivider
            footer={
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs text-graphite-600">
                  <span>⭐ 89</span>
                  <span>🍴 12</span>
                  <span>Updated 5h ago</span>
                </div>
                <Button size="sm" variant="ghost">
                  View Repository
                </Button>
              </div>
            }
          >
            <div className="space-y-3">
              <p className="text-sm text-graphite-600">
                High-performance API gateway with JWT authentication, rate limiting, and service
                discovery.
              </p>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-cyan-500" />
                  <span className="text-graphite-600">Go 91.3%</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span className="text-graphite-600">Dockerfile 5.2%</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-gray-500" />
                  <span className="text-graphite-600">Makefile 3.5%</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* System Health Dashboard */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-graphite-800">System Health</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card
            variant="elevated"
            size="sm"
            header={
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium text-graphite-900">CPU Usage</span>
              </div>
            }
          >
            <div className="space-y-2">
              <div className="text-2xl font-bold text-graphite-900">23%</div>
              <div className="w-full bg-graphite-200 rounded-full h-1">
                <div className="bg-green-500 h-1 rounded-full" style={{ width: '23%' }} />
              </div>
              <p className="text-xs text-green-600">Normal usage</p>
            </div>
          </Card>

          <Card
            variant="elevated"
            size="sm"
            header={
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium text-graphite-900">Memory</span>
              </div>
            }
          >
            <div className="space-y-2">
              <div className="text-2xl font-bold text-graphite-900">67%</div>
              <div className="w-full bg-graphite-200 rounded-full h-1">
                <div className="bg-blue-500 h-1 rounded-full" style={{ width: '67%' }} />
              </div>
              <p className="text-xs text-blue-600">6.7GB / 10GB</p>
            </div>
          </Card>

          <Card
            variant="elevated"
            size="sm"
            header={
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-medium text-graphite-900">Network</span>
              </div>
            }
          >
            <div className="space-y-2">
              <div className="text-2xl font-bold text-graphite-900">1.2GB</div>
              <div className="text-xs text-graphite-600">↓ 892MB ↑ 341MB</div>
              <p className="text-xs text-purple-600">Active transfers</p>
            </div>
          </Card>

          <Card
            variant="elevated"
            size="sm"
            header={
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium text-graphite-900">Users</span>
              </div>
            }
          >
            <div className="space-y-2">
              <div className="text-2xl font-bold text-graphite-900">1,247</div>
              <div className="text-xs text-graphite-600">+23 from yesterday</div>
              <p className="text-xs text-amber-600">Active sessions</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Real-world examples of cards in developer tools: project overviews, repository management, and system health dashboards.',
      },
    },
  },
};

// Interactive playground
export const Interactive: Story = {
  args: {
    variant: 'default',
    size: 'md',
    title: 'Interactive Card',
    subtitle: 'This is a subtitle',
    loading: false,
    disabled: false,
    selected: false,
    hoverable: false,
    headerDivider: false,
    footerDivider: false,
    children:
      'This is the card content. You can customize all aspects of this card using the controls below.',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Interactive playground to experiment with all card props. Use the controls panel below to test different combinations.',
      },
    },
  },
};
