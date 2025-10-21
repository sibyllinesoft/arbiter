/**
 * Design System Overview Stories
 * Comprehensive showcase of the Graphite Design System
 * Professional developer tool interface patterns and components
 */

import type { Meta, StoryObj } from "@storybook/react";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle,
  Clock,
  Code,
  Database,
  Download,
  Eye,
  FileText,
  Folder,
  GitBranch,
  Globe,
  Home,
  Info,
  Loader2,
  Monitor,
  Pause,
  Play,
  Plus,
  Save,
  Search,
  Settings,
  Shield,
  Terminal,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";

import Breadcrumbs from "./components/Breadcrumbs";
// Import all design system components
import Button from "./components/Button";
import Card from "./components/Card";
import Checkbox from "./components/Checkbox";
import Dialog from "./components/Dialog";
import Input from "./components/Input";
import Modal from "./components/Modal";
import NavItem from "./components/NavItem";
import Radio from "./components/Radio";
import Select from "./components/Select";
import Sidebar from "./components/Sidebar";
import StatusBadge from "./components/StatusBadge";
import Tabs from "./components/Tabs";
import Toast from "./components/Toast";

// Import data and tokens
import { storybookData } from "../test/storybook-data";
import { colors, spacing, typography } from "./tokens";

const meta = {
  title: "Design System/Overview",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: `
# Graphite Design System

A comprehensive, professional design system built specifically for developer tools. 
The Graphite theme provides sophisticated, minimal aesthetics with excellent usability.

## Key Features

- **Professional**: Clean, minimal design perfect for technical interfaces
- **Accessible**: WCAG 2.1 AA compliant with proper color contrast and focus management
- **Performant**: Optimized components with minimal bundle size impact
- **Consistent**: Systematic color scales, typography, and spacing
- **Flexible**: Comprehensive variant system for different use cases

## Design Philosophy

The Graphite design system prioritizes:
1. **Clarity** - Information hierarchy and visual structure
2. **Efficiency** - Reduced cognitive load for power users
3. **Reliability** - Predictable interactions and error handling
4. **Scalability** - Components that work from simple to complex use cases
        `,
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

// Comprehensive application showcase
export const ApplicationShowcase: Story = {
  render: () => (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Code className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-semibold text-gray-900">Arbiter</span>
            </div>

            <nav className="flex items-center gap-1">
              <NavItem icon={<Home />} active>
                Dashboard
              </NavItem>
              <NavItem icon={<Folder />}>Projects</NavItem>
              <NavItem icon={<Monitor />}>Deployments</NavItem>
              <NavItem icon={<Terminal />}>Logs</NavItem>
              <NavItem icon={<Settings />}>Settings</NavItem>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <Input
                placeholder="Search projects..."
                leftIcon={<Search />}
                size="sm"
                className="w-64"
              />
            </div>
            <Button variant="ghost" size="sm">
              <Bell className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <img
                src="https://images.unsplash.com/photo-1494790108755-2616b612b786?w=32&h=32&fit=crop&crop=face"
                alt="User"
                className="w-8 h-8 rounded-full"
              />
              <span className="text-sm font-medium text-gray-700">Sarah Chen</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Breadcrumbs */}
        <div className="mb-6">
          <Breadcrumbs
            items={[
              { id: "projects", label: "Projects", href: "#" },
              { id: "ecommerce-platform", label: "E-commerce Platform", href: "#" },
              { id: "dashboard", label: "Dashboard", href: "#", current: true },
            ]}
          />
        </div>

        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">E-commerce Platform</h1>
            <p className="text-gray-600 mt-1">Real-time specification workbench and validation</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" leftIcon={<Download />}>
              Export Specs
            </Button>
            <Button leftIcon={<Save />}>Save Changes</Button>
          </div>
        </div>

        {/* Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card variant="elevated" size="sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-gray-900">23</div>
                <div className="text-sm text-gray-600">Active Specs</div>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-3">
              <StatusBadge variant="success" size="xs">
                All Valid
              </StatusBadge>
            </div>
          </Card>

          <Card variant="elevated" size="sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-gray-900">98.5%</div>
                <div className="text-sm text-gray-600">Test Coverage</div>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <div className="mt-3">
              <StatusBadge variant="success" size="xs">
                Excellent
              </StatusBadge>
            </div>
          </Card>

          <Card variant="elevated" size="sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-gray-900">2</div>
                <div className="text-sm text-gray-600">Issues Found</div>
              </div>
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
            </div>
            <div className="mt-3">
              <StatusBadge variant="warning" size="xs">
                Needs Attention
              </StatusBadge>
            </div>
          </Card>

          <Card variant="elevated" size="sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-gray-900">5m</div>
                <div className="text-sm text-gray-600">Last Validation</div>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Clock className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <div className="mt-3">
              <StatusBadge variant="active" size="xs" pulse>
                Running
              </StatusBadge>
            </div>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Projects and Files */}
          <div className="lg:col-span-2 space-y-6">
            {/* Recent Projects */}
            <Card title="Recent Projects" subtitle="Your most active specification projects">
              <div className="space-y-4">
                {storybookData.projects.slice(0, 3).map((project, index) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 ${
                          index === 0
                            ? "bg-blue-100"
                            : index === 1
                              ? "bg-green-100"
                              : "bg-purple-100"
                        } rounded-lg flex items-center justify-center`}
                      >
                        <Code
                          className={`h-5 w-5 ${
                            index === 0
                              ? "text-blue-600"
                              : index === 1
                                ? "text-green-600"
                                : "text-purple-600"
                          }`}
                        />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{project.name}</div>
                        <div className="text-sm text-gray-600">
                          Updated {new Date(project.updated_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        variant={index === 0 ? "success" : index === 1 ? "pending" : "warning"}
                        size="xs"
                      >
                        {index === 0 ? "Active" : index === 1 ? "Building" : "Issues"}
                      </StatusBadge>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Build Pipeline */}
            <Card
              title="Build Pipeline"
              subtitle="Continuous integration and deployment status"
              header={
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">Build Pipeline</h3>
                    <p className="text-sm text-gray-600">
                      Continuous integration and deployment status
                    </p>
                  </div>
                  <Button variant="ghost" size="sm">
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              }
              headerDivider
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 border border-green-200 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <div className="font-medium text-gray-900">Build & Test</div>
                      <div className="text-sm text-gray-600">Completed in 2m 34s</div>
                    </div>
                  </div>
                  <StatusBadge variant="success" size="sm">
                    Passed
                  </StatusBadge>
                </div>

                <div className="flex items-center justify-between p-3 border border-blue-200 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                    <div>
                      <div className="font-medium text-gray-900">Deploy to Staging</div>
                      <div className="text-sm text-gray-600">In progress...</div>
                    </div>
                  </div>
                  <StatusBadge variant="pending" size="sm" loading>
                    Deploying
                  </StatusBadge>
                </div>

                <div className="flex items-center justify-between p-3 border border-gray-200 bg-gray-50 rounded-lg opacity-60">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-gray-400" />
                    <div>
                      <div className="font-medium text-gray-700">Production Deploy</div>
                      <div className="text-sm text-gray-500">Waiting for approval</div>
                    </div>
                  </div>
                  <StatusBadge variant="neutral" size="sm">
                    Pending
                  </StatusBadge>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column - Team and Activity */}
          <div className="space-y-6">
            {/* Team Activity */}
            <Card title="Team Activity" subtitle="Recent team member activity">
              <div className="space-y-4">
                {storybookData.users.teamMembers.slice(0, 4).map((member, index) => (
                  <div key={member.id} className="flex items-center gap-3">
                    <img src={member.avatar} alt={member.name} className="w-8 h-8 rounded-full" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {member.name}
                      </div>
                      <div className="text-xs text-gray-600 truncate">{member.role}</div>
                    </div>
                    <StatusBadge
                      variant={
                        member.status === "online"
                          ? "active"
                          : member.status === "away"
                            ? "warning"
                            : "inactive"
                      }
                      size="xs"
                      pulse={member.status === "online"}
                    >
                      {member.status}
                    </StatusBadge>
                  </div>
                ))}
              </div>
            </Card>

            {/* System Health */}
            <Card title="System Health" subtitle="Real-time service monitoring">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-gray-600" />
                    <span className="text-sm text-gray-900">API Gateway</span>
                  </div>
                  <StatusBadge variant="active" size="xs" showDot>
                    Online
                  </StatusBadge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-gray-600" />
                    <span className="text-sm text-gray-900">Database</span>
                  </div>
                  <StatusBadge variant="warning" size="xs" showDot>
                    Degraded
                  </StatusBadge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-gray-600" />
                    <span className="text-sm text-gray-900">Auth Service</span>
                  </div>
                  <StatusBadge variant="active" size="xs" showDot>
                    Online
                  </StatusBadge>
                </div>
              </div>
            </Card>

            {/* Quick Actions */}
            <Card title="Quick Actions" subtitle="Common development tasks">
              <div className="space-y-3">
                <Button fullWidth variant="secondary" leftIcon={<Plus />}>
                  New Specification
                </Button>
                <Button fullWidth variant="ghost" leftIcon={<Play />}>
                  Run Validation
                </Button>
                <Button fullWidth variant="ghost" leftIcon={<Download />}>
                  Export Documentation
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: `
### Complete Application Interface

This story demonstrates a complete developer tool interface using the Graphite Design System. 
It showcases how all components work together to create a professional, cohesive user experience.

**Key Features Demonstrated:**
- Navigation and information hierarchy
- Status indicators and system health monitoring  
- Interactive cards and data visualization
- Team collaboration interfaces
- Build pipeline and deployment workflows
- Responsive layout patterns
- Consistent typography and spacing

**Components Used:**
- Navigation (NavItem, Breadcrumbs)
- Layout (Cards with various configurations)
- Interactive Elements (Buttons, Status Badges)
- Forms (Input with search functionality)
- Data Display (User avatars, metrics, progress indicators)
        `,
      },
    },
  },
};

// Color palette showcase
export const ColorPalette: Story = {
  render: () => (
    <div className="p-8 space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Graphite Color System</h2>

        {/* Primary Graphite Scale */}
        <div className="mb-8">
          <h3 className="text-lg font-medium text-gray-800 mb-4">Primary Graphite Scale</h3>
          <div className="grid grid-cols-10 gap-2">
            {Object.entries(colors.graphite).map(([weight, color]) => (
              <div key={weight} className="space-y-2">
                <div
                  className="h-16 rounded-lg shadow-sm border"
                  style={{ backgroundColor: color }}
                />
                <div className="text-center">
                  <div className="text-xs font-medium text-gray-900">{weight}</div>
                  <div className="text-xs text-gray-600 font-mono">{color}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Semantic Colors */}
        <div className="space-y-6">
          <h3 className="text-lg font-medium text-gray-800">Semantic Color Scales</h3>

          {Object.entries(colors.semantic).map(([name, scale]) => (
            <div key={name} className="space-y-3">
              <h4 className="text-base font-medium text-gray-700 capitalize">{name}</h4>
              <div className="grid grid-cols-10 gap-2">
                {Object.entries(scale).map(([weight, color]) => (
                  <div key={weight} className="space-y-1">
                    <div
                      className="h-12 rounded shadow-sm border"
                      style={{ backgroundColor: color }}
                    />
                    <div className="text-center">
                      <div className="text-xs text-gray-600">{weight}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Usage Examples */}
        <div className="mt-12">
          <h3 className="text-lg font-medium text-gray-800 mb-4">Color Usage Examples</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="font-medium text-gray-900">Success State</span>
                </div>
                <StatusBadge variant="success" size="sm">
                  Build Successful
                </StatusBadge>
                <Button variant="primary" size="sm">
                  Primary Action
                </Button>
              </div>
            </Card>

            <Card>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <span className="font-medium text-gray-900">Warning State</span>
                </div>
                <StatusBadge variant="warning" size="sm">
                  Needs Review
                </StatusBadge>
                <Button variant="secondary" size="sm">
                  Secondary Action
                </Button>
              </div>
            </Card>

            <Card>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-500" />
                  <span className="font-medium text-gray-900">Error State</span>
                </div>
                <StatusBadge variant="error" size="sm">
                  Build Failed
                </StatusBadge>
                <Button variant="danger" size="sm">
                  Destructive Action
                </Button>
              </div>
            </Card>

            <Card>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-blue-500" />
                  <span className="font-medium text-gray-900">Info State</span>
                </div>
                <StatusBadge variant="info" size="sm">
                  Information
                </StatusBadge>
                <Button variant="ghost" size="sm">
                  Ghost Action
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: `
### Color System

The Graphite color system provides a comprehensive palette with systematic scales for consistent, accessible interfaces.

**Primary Scale (Graphite):** Used for text, borders, and neutral UI elements
**Semantic Scales:** Success (green), Warning (amber), Error (red), Info (blue)
**Usage:** Each scale provides 50-900 variants for maximum flexibility
        `,
      },
    },
  },
};

// Typography showcase
export const Typography: Story = {
  render: () => (
    <div className="p-8 space-y-8 max-w-4xl">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Typography System</h2>

        {/* Font Scales */}
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-800">Font Size Scale</h3>
            {Object.entries(typography.fontSize).map(([name, [size, { lineHeight }]]) => (
              <div key={name} className="flex items-baseline gap-4 p-4 border rounded-lg">
                <div className="w-12 text-xs text-gray-500 font-mono">{name}</div>
                <div className="w-20 text-xs text-gray-500 font-mono">{size}</div>
                <div style={{ fontSize: size, lineHeight }} className="flex-1 text-gray-900">
                  The quick brown fox jumps over the lazy dog
                </div>
              </div>
            ))}
          </div>

          {/* Font Weights */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-800">Font Weight Scale</h3>
            {Object.entries(typography.fontWeight).map(([name, weight]) => (
              <div key={name} className="flex items-center gap-4 p-4 border rounded-lg">
                <div className="w-20 text-xs text-gray-500 font-mono">{name}</div>
                <div className="w-16 text-xs text-gray-500 font-mono">{weight}</div>
                <div style={{ fontWeight: weight }} className="text-lg text-gray-900">
                  Professional developer interface text
                </div>
              </div>
            ))}
          </div>

          {/* Typography Hierarchy */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-800">Typography Hierarchy</h3>
            <div className="space-y-6 p-6 border rounded-lg">
              <h1 className="text-4xl font-bold text-gray-900">Heading 1 - Page Title</h1>
              <h2 className="text-3xl font-semibold text-gray-900">Heading 2 - Section Title</h2>
              <h3 className="text-2xl font-semibold text-gray-900">Heading 3 - Subsection</h3>
              <h4 className="text-xl font-medium text-gray-900">Heading 4 - Component Title</h4>
              <h5 className="text-lg font-medium text-gray-900">Heading 5 - Card Title</h5>
              <h6 className="text-base font-medium text-gray-900">Heading 6 - Label</h6>
              <p className="text-base text-gray-700 leading-relaxed">
                Body text for reading content. This is the standard paragraph text used throughout
                the application. It maintains good readability with appropriate line height and
                spacing.
              </p>
              <p className="text-sm text-gray-600">
                Small text for captions, metadata, and secondary information.
              </p>
              <p className="text-xs text-gray-500 font-mono">
                Extra small monospace text for technical details: commit a1b2c3d
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
        story: `
### Typography System

A systematic approach to typography with consistent font sizes, weights, and hierarchy for professional developer interfaces.

**Features:**
- Consistent size scale from xs (12px) to 4xl (36px)
- Four font weights from normal to bold
- System font stack optimized for developer tools
- Appropriate line heights for readability
        `,
      },
    },
  },
};

// Component showcase
export const ComponentShowcase: Story = {
  render: () => (
    <div className="p-8 space-y-12">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Component Library</h2>

        {/* Buttons */}
        <section className="space-y-4">
          <h3 className="text-lg font-medium text-gray-800">Buttons</h3>
          <Card>
            <div className="space-y-6">
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Variants</h4>
                <div className="flex flex-wrap gap-3">
                  <Button variant="primary">Primary</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="danger">Danger</Button>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">With Icons</h4>
                <div className="flex flex-wrap gap-3">
                  <Button variant="primary" leftIcon={<Save />}>
                    Save Changes
                  </Button>
                  <Button variant="secondary" leftIcon={<Download />}>
                    Export
                  </Button>
                  <Button variant="ghost" rightIcon={<ArrowRight />}>
                    Continue
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Loading States</h4>
                <div className="flex flex-wrap gap-3">
                  <Button loading>Processing</Button>
                  <Button variant="secondary" loading>
                    Building
                  </Button>
                  <Button variant="ghost" loading>
                    Validating
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </section>

        {/* Status Badges */}
        <section className="space-y-4">
          <h3 className="text-lg font-medium text-gray-800">Status Badges</h3>
          <Card>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <StatusBadge variant="success" showDot>
                  Success
                </StatusBadge>
                <StatusBadge variant="warning" showDot>
                  Warning
                </StatusBadge>
                <StatusBadge variant="error" showDot>
                  Error
                </StatusBadge>
                <StatusBadge variant="info" showDot>
                  Info
                </StatusBadge>
                <StatusBadge variant="active" showDot pulse>
                  Active
                </StatusBadge>
                <StatusBadge variant="pending" showDot>
                  Pending
                </StatusBadge>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">With Icons</h4>
                <div className="flex flex-wrap gap-3">
                  <StatusBadge variant="success" icon={<CheckCircle />}>
                    Deployed
                  </StatusBadge>
                  <StatusBadge variant="warning" icon={<AlertTriangle />}>
                    Warning
                  </StatusBadge>
                  <StatusBadge variant="error" icon={<XCircle />}>
                    Failed
                  </StatusBadge>
                  <StatusBadge variant="pending" icon={<Clock />} loading>
                    Building
                  </StatusBadge>
                </div>
              </div>
            </div>
          </Card>
        </section>

        {/* Form Components */}
        <section className="space-y-4">
          <h3 className="text-lg font-medium text-gray-800">Form Components</h3>
          <Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Input label="Project Name" placeholder="Enter project name" leftIcon={<Code />} />
                <Input label="Repository URL" placeholder="https://github.com/..." type="url" />
                <Select
                  label="Environment"
                  placeholder="Select environment"
                  options={[
                    { value: "dev", label: "Development" },
                    { value: "staging", label: "Staging" },
                    { value: "prod", label: "Production" },
                  ]}
                />
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Features</label>
                  <div className="space-y-2">
                    <Checkbox label="Real-time collaboration" defaultChecked />
                    <Checkbox label="Advanced analytics" />
                    <Checkbox label="API access" defaultChecked />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Deployment Type</label>
                  <div className="space-y-2">
                    <Radio name="deployment" value="cloud" label="Cloud hosting" defaultChecked />
                    <Radio name="deployment" value="self" label="Self-hosted" />
                    <Radio name="deployment" value="hybrid" label="Hybrid setup" />
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </section>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: `
### Component Library Overview

A comprehensive collection of components designed for professional developer tools.
Each component follows consistent design principles and includes multiple variants for different use cases.

**Key Components:**
- **Buttons:** Primary actions, secondary options, ghost interactions, and destructive operations
- **Status Badges:** System status, build states, health indicators, and process tracking  
- **Forms:** Input fields, selectors, checkboxes, and radio buttons with proper validation
- **Cards:** Content containers with flexible layouts and interactive states
        `,
      },
    },
  },
};
