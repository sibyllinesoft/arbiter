/**
 * StatusBadge Component Stories
 * Comprehensive documentation and examples for the StatusBadge component
 * Showcasing professional status indicators with sophisticated graphite theme
 */

import type { Meta, StoryObj } from "@storybook/react";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  GitBranch,
  Info,
  Pause,
  Shield,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import StatusBadge from "./StatusBadge";

const meta = {
  title: "Design System/StatusBadge",
  component: StatusBadge,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Professional status badge component with comprehensive variants, styles, and states. Designed for developer tools with sophisticated graphite theme.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: { type: "select" },
      options: ["success", "warning", "error", "info", "neutral", "pending", "active", "inactive"],
      description: "Semantic variant of the status badge",
    },
    style: {
      control: { type: "select" },
      options: ["solid", "outlined", "subtle"],
      description: "Visual style of the badge",
    },
    size: {
      control: { type: "select" },
      options: ["xs", "sm", "md", "lg"],
      description: "Size of the badge affecting padding and typography",
    },
    showDot: {
      control: { type: "boolean" },
      description: "Whether to show a status dot indicator",
    },
    pulse: {
      control: { type: "boolean" },
      description: "Whether the dot should pulse (for active states)",
    },
    loading: {
      control: { type: "boolean" },
      description: "Whether the badge is in a loading state",
    },
  },
} satisfies Meta<typeof StatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default badge
export const Default: Story = {
  args: {
    variant: "success",
    children: "Active",
    showDot: true,
  },
};

// All variants
export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
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
      <StatusBadge variant="neutral" showDot>
        Neutral
      </StatusBadge>
      <StatusBadge variant="pending" showDot>
        Pending
      </StatusBadge>
      <StatusBadge variant="active" showDot pulse>
        Active
      </StatusBadge>
      <StatusBadge variant="inactive" showDot>
        Inactive
      </StatusBadge>
    </div>
  ),
  args: {
    children: "Status Badge",
  },
  parameters: {
    docs: {
      description: {
        story:
          "All semantic variants of the status badge: success, warning, error, info, neutral, pending, active, and inactive.",
      },
    },
  },
};

// All styles
export const Styles: Story = {
  render: () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-graphite-700">Solid Style</h4>
        <div className="flex flex-wrap gap-3">
          <StatusBadge variant="success" style="solid" showDot>
            Success
          </StatusBadge>
          <StatusBadge variant="warning" style="solid" showDot>
            Warning
          </StatusBadge>
          <StatusBadge variant="error" style="solid" showDot>
            Error
          </StatusBadge>
          <StatusBadge variant="info" style="solid" showDot>
            Info
          </StatusBadge>
          <StatusBadge variant="active" style="solid" showDot pulse>
            Active
          </StatusBadge>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium text-graphite-700">Outlined Style</h4>
        <div className="flex flex-wrap gap-3">
          <StatusBadge variant="success" style="outlined" showDot>
            Success
          </StatusBadge>
          <StatusBadge variant="warning" style="outlined" showDot>
            Warning
          </StatusBadge>
          <StatusBadge variant="error" style="outlined" showDot>
            Error
          </StatusBadge>
          <StatusBadge variant="info" style="outlined" showDot>
            Info
          </StatusBadge>
          <StatusBadge variant="active" style="outlined" showDot pulse>
            Active
          </StatusBadge>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium text-graphite-700">Subtle Style</h4>
        <div className="flex flex-wrap gap-3">
          <StatusBadge variant="success" style="subtle" showDot>
            Success
          </StatusBadge>
          <StatusBadge variant="warning" style="subtle" showDot>
            Warning
          </StatusBadge>
          <StatusBadge variant="error" style="subtle" showDot>
            Error
          </StatusBadge>
          <StatusBadge variant="info" style="subtle" showDot>
            Info
          </StatusBadge>
          <StatusBadge variant="active" style="subtle" showDot pulse>
            Active
          </StatusBadge>
        </div>
      </div>
    </div>
  ),
  args: {
    children: "Status Badge",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Different visual styles: solid (default), outlined (transparent background), and subtle (no border).",
      },
    },
  },
};

// All sizes
export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <StatusBadge variant="info" size="xs" showDot>
        Extra Small
      </StatusBadge>
      <StatusBadge variant="info" size="sm" showDot>
        Small
      </StatusBadge>
      <StatusBadge variant="info" size="md" showDot>
        Medium
      </StatusBadge>
      <StatusBadge variant="info" size="lg" showDot>
        Large
      </StatusBadge>
    </div>
  ),
  args: {
    children: "Status Badge",
  },
  parameters: {
    docs: {
      description: {
        story: "Size variants with proportional scaling of text, padding, and indicators.",
      },
    },
  },
};

// With icons
export const WithIcons: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <StatusBadge variant="success" icon={<CheckCircle />}>
        Deployed
      </StatusBadge>
      <StatusBadge variant="warning" icon={<AlertTriangle />}>
        Build Warning
      </StatusBadge>
      <StatusBadge variant="error" icon={<XCircle />}>
        Failed
      </StatusBadge>
      <StatusBadge variant="info" icon={<Info />}>
        Information
      </StatusBadge>
      <StatusBadge variant="pending" icon={<Clock />}>
        Pending Review
      </StatusBadge>
      <StatusBadge variant="active" icon={<Activity />} pulse>
        Live
      </StatusBadge>
    </div>
  ),
  args: {
    children: "Status Badge",
  },
  parameters: {
    docs: {
      description: {
        story: "Status badges with custom icons for enhanced meaning and visual appeal.",
      },
    },
  },
};

// Loading states
export const LoadingStates: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <StatusBadge variant="info" loading>
        Processing
      </StatusBadge>
      <StatusBadge variant="pending" loading>
        Building
      </StatusBadge>
      <StatusBadge variant="warning" loading>
        Deploying
      </StatusBadge>
      <StatusBadge variant="success" loading size="lg">
        Running Tests
      </StatusBadge>
    </div>
  ),
  args: {
    children: "Status Badge",
  },
  parameters: {
    docs: {
      description: {
        story: "Loading states with spinning indicators to show ongoing processes.",
      },
    },
  },
};

// Professional developer tool examples
export const DeveloperToolExamples: Story = {
  render: () => (
    <div className="space-y-8 max-w-4xl">
      {/* Build & Deployment Status */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-graphite-800">Build & Deployment Status</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-graphite-50 rounded-lg">
            <div className="flex items-center gap-3">
              <GitBranch className="h-4 w-4 text-graphite-500" />
              <div>
                <div className="font-medium text-graphite-900">Frontend Application</div>
                <div className="text-sm text-graphite-600">main branch • commit a1b2c3d</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge variant="success" icon={<CheckCircle />} size="sm">
                Deployed
              </StatusBadge>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-graphite-50 rounded-lg">
            <div className="flex items-center gap-3">
              <Database className="h-4 w-4 text-graphite-500" />
              <div>
                <div className="font-medium text-graphite-900">API Service</div>
                <div className="text-sm text-graphite-600">develop branch • commit e4f5g6h</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge variant="pending" icon={<Clock />} loading size="sm">
                Building
              </StatusBadge>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-graphite-50 rounded-lg">
            <div className="flex items-center gap-3">
              <Shield className="h-4 w-4 text-graphite-500" />
              <div>
                <div className="font-medium text-graphite-900">Authentication Service</div>
                <div className="text-sm text-graphite-600">feature/oauth2 • commit i7j8k9l</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge variant="error" icon={<XCircle />} size="sm">
                Build Failed
              </StatusBadge>
            </div>
          </div>
        </div>
      </div>

      {/* Service Health Monitoring */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-graphite-800">Service Health</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 bg-white border border-graphite-200 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-graphite-900">Web Application</h4>
              <StatusBadge variant="active" showDot pulse size="xs">
                Healthy
              </StatusBadge>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-graphite-600">Response Time</span>
                <span className="text-graphite-900">127ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-graphite-600">Uptime</span>
                <span className="text-graphite-900">99.94%</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-white border border-graphite-200 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-graphite-900">Database</h4>
              <StatusBadge variant="warning" showDot size="xs">
                Degraded
              </StatusBadge>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-graphite-600">Connections</span>
                <span className="text-graphite-900">187/200</span>
              </div>
              <div className="flex justify-between">
                <span className="text-graphite-600">Query Time</span>
                <span className="text-amber-600">2.3s</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-white border border-graphite-200 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-graphite-900">Cache Service</h4>
              <StatusBadge variant="error" showDot size="xs">
                Down
              </StatusBadge>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-graphite-600">Last Ping</span>
                <span className="text-red-600">5m ago</span>
              </div>
              <div className="flex justify-between">
                <span className="text-graphite-600">Status</span>
                <span className="text-red-600">Unreachable</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Team Activity & Permissions */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-graphite-800">Team Activity</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-white border border-graphite-200 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <div className="font-medium text-graphite-900">Sarah Chen</div>
                <div className="text-sm text-graphite-600">Frontend Developer</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge variant="active" style="subtle" showDot pulse size="xs">
                Online
              </StatusBadge>
              <StatusBadge variant="success" style="outlined" size="xs">
                Admin
              </StatusBadge>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-white border border-graphite-200 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <Users className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <div className="font-medium text-graphite-900">Marcus Johnson</div>
                <div className="text-sm text-graphite-600">Backend Engineer</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge variant="pending" style="subtle" showDot size="xs">
                Away
              </StatusBadge>
              <StatusBadge variant="info" style="outlined" size="xs">
                Member
              </StatusBadge>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-white border border-graphite-200 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <Users className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <div className="font-medium text-graphite-900">Emily Rodriguez</div>
                <div className="text-sm text-graphite-600">DevOps Engineer</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge variant="inactive" style="subtle" showDot size="xs">
                Offline
              </StatusBadge>
              <StatusBadge variant="warning" style="outlined" size="xs">
                Maintainer
              </StatusBadge>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Flags & Experiments */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-graphite-800">Feature Flags</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-white border border-graphite-200 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-graphite-900">New Dashboard UI</h4>
              <StatusBadge variant="active" icon={<Zap />} size="sm">
                Enabled
              </StatusBadge>
            </div>
            <p className="text-sm text-graphite-600">
              Beta version of the redesigned dashboard interface
            </p>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-graphite-600">Coverage: 25% of users</span>
              <StatusBadge variant="success" style="subtle" size="xs">
                Stable
              </StatusBadge>
            </div>
          </div>

          <div className="p-4 bg-white border border-graphite-200 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-graphite-900">Advanced Analytics</h4>
              <StatusBadge variant="pending" icon={<Clock />} loading size="sm">
                Testing
              </StatusBadge>
            </div>
            <p className="text-sm text-graphite-600">Enhanced reporting and metrics dashboard</p>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-graphite-600">Coverage: 5% of users</span>
              <StatusBadge variant="warning" style="subtle" size="xs">
                Beta
              </StatusBadge>
            </div>
          </div>

          <div className="p-4 bg-white border border-graphite-200 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-graphite-900">Real-time Collaboration</h4>
              <StatusBadge variant="inactive" icon={<Pause />} size="sm">
                Disabled
              </StatusBadge>
            </div>
            <p className="text-sm text-graphite-600">Live editing and collaboration features</p>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-graphite-600">Coverage: 0% of users</span>
              <StatusBadge variant="error" style="subtle" size="xs">
                Issues Found
              </StatusBadge>
            </div>
          </div>

          <div className="p-4 bg-white border border-graphite-200 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-graphite-900">Mobile Responsive</h4>
              <StatusBadge variant="success" icon={<CheckCircle />} size="sm">
                Live
              </StatusBadge>
            </div>
            <p className="text-sm text-graphite-600">Optimized mobile and tablet experience</p>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-graphite-600">Coverage: 100% of users</span>
              <StatusBadge variant="success" style="subtle" size="xs">
                Production
              </StatusBadge>
            </div>
          </div>
        </div>
      </div>
    </div>
  ),
  args: {
    children: "Status Badge",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Real-world examples of status badges in developer tools: build status, service health, team activity, and feature flags.",
      },
    },
  },
};

// Interactive playground
export const Interactive: Story = {
  args: {
    variant: "success",
    style: "solid",
    size: "sm",
    showDot: true,
    pulse: false,
    loading: false,
    children: "Status Badge",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Interactive playground to experiment with all status badge props. Use the controls panel below to test different combinations.",
      },
    },
  },
};
