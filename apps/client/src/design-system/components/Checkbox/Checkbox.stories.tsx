/**
 * Checkbox Component Stories
 * Comprehensive documentation and examples for the Checkbox component
 * Showcasing professional form controls with sophisticated graphite theme
 */

import type { Meta, StoryObj } from '@storybook/react';
import { Database, Globe, Settings, Shield, Users, Zap } from 'lucide-react';
import Checkbox from './Checkbox';

const meta = {
  title: 'Design System/Checkbox',
  component: Checkbox,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Professional checkbox component with comprehensive states, validation, indeterminate support, and accessibility features. Designed for developer tools with sophisticated graphite theme.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'error', 'success', 'warning'],
      description: 'Visual variant of the checkbox',
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
      description: 'Size of the checkbox affecting size and font',
    },
    label: {
      control: { type: 'text' },
      description: 'Label text for the checkbox',
    },
    description: {
      control: { type: 'text' },
      description: 'Additional description text',
    },
    helperText: {
      control: { type: 'text' },
      description: 'Helper text below the checkbox',
    },
    error: {
      control: { type: 'text' },
      description: 'Error message (sets variant to error automatically)',
    },
    warning: {
      control: { type: 'text' },
      description: 'Warning message (sets variant to warning automatically)',
    },
    success: {
      control: { type: 'text' },
      description: 'Success message (sets variant to success automatically)',
    },
    indeterminate: {
      control: { type: 'boolean' },
      description: 'Whether the checkbox is in an indeterminate state',
    },
    loading: {
      control: { type: 'boolean' },
      description: 'Whether the checkbox is in a loading state',
    },
    showValidationIcon: {
      control: { type: 'boolean' },
      description: 'Whether to show validation icons automatically',
    },
    disabled: {
      control: { type: 'boolean' },
      description: 'Whether the checkbox is disabled',
    },
    checked: {
      control: { type: 'boolean' },
      description: 'Whether the checkbox is checked',
    },
  },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default checkbox
export const Default: Story = {
  args: {
    label: 'Enable notifications',
    helperText: 'Receive email notifications for important updates',
  },
};

// All variants with validation states
export const Variants: Story = {
  render: () => (
    <div className="w-96 space-y-4">
      <Checkbox label="Default Checkbox" helperText="Standard checkbox style" />
      <Checkbox
        label="Success Checkbox"
        success="Configuration saved successfully"
        showValidationIcon
        checked
      />
      <Checkbox
        label="Warning Checkbox"
        warning="This setting may affect performance"
        showValidationIcon
      />
      <Checkbox label="Error Checkbox" error="This field is required" showValidationIcon />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Checkbox variants with enhanced validation states: Default, Success, Warning, and Error with automatic validation icons.',
      },
    },
  },
};

// All sizes
export const Sizes: Story = {
  render: () => (
    <div className="w-96 space-y-4">
      <Checkbox size="sm" label="Small Checkbox" description="Compact size for dense layouts" />
      <Checkbox size="md" label="Medium Checkbox" description="Default size for most use cases" />
      <Checkbox size="lg" label="Large Checkbox" description="Larger size for prominence" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Checkbox sizes with proper scaling of the checkbox, icons, and text.',
      },
    },
  },
};

// Indeterminate state
export const IndeterminateState: Story = {
  render: () => (
    <div className="w-96 space-y-4">
      <div className="space-y-3">
        <Checkbox
          label="Select All Features"
          indeterminate
          description="Some features are selected"
        />
        <div className="ml-6 space-y-2">
          <Checkbox size="sm" label="Feature A" checked />
          <Checkbox size="sm" label="Feature B" checked />
          <Checkbox size="sm" label="Feature C" />
          <Checkbox size="sm" label="Feature D" />
        </div>
      </div>

      <Checkbox
        variant="warning"
        label="Partial Configuration"
        indeterminate
        warning="Some options are configured"
        showValidationIcon
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Indeterminate state for parent checkboxes that have some but not all child options selected.',
      },
    },
  },
};

// Loading states
export const LoadingStates: Story = {
  render: () => (
    <div className="w-96 space-y-4">
      <Checkbox
        loading
        label="Saving Preferences"
        helperText="Please wait while we save your settings..."
      />
      <Checkbox
        loading
        size="lg"
        label="Validating Configuration"
        description="Checking system compatibility"
        helperText="This may take a few moments"
      />
      <Checkbox
        loading
        variant="success"
        label="Processing Payment"
        checked
        helperText="Finalizing transaction..."
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Loading states with animated spinner, showing the checkbox is processing an action.',
      },
    },
  },
};

// With custom content using children
export const CustomContent: Story = {
  render: () => (
    <div className="w-96 space-y-4">
      <Checkbox>
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-blue-500" />
          <span>Enable Advanced Settings</span>
        </div>
      </Checkbox>

      <Checkbox description="Access to database configuration and management tools">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-green-500" />
          <span>Database Access</span>
        </div>
      </Checkbox>

      <Checkbox variant="warning" warning="This grants elevated privileges" showValidationIcon>
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-amber-500" />
          <span>Admin Privileges</span>
        </div>
      </Checkbox>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Checkboxes with custom content using icons and complex layouts through the children prop.',
      },
    },
  },
};

// Professional developer tool examples
export const DeveloperToolExamples: Story = {
  render: () => (
    <div className="space-y-8 max-w-4xl">
      {/* Build Configuration */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-graphite-800">Build Configuration</h3>
        <div className="space-y-3">
          <Checkbox
            label="Enable Source Maps"
            description="Generate source maps for debugging in production"
            checked
          />
          <Checkbox label="Minify Output" description="Compress JavaScript and CSS files" checked />
          <Checkbox
            label="Tree Shaking"
            description="Remove unused code from bundle"
            success="Optimization enabled"
            showValidationIcon
            checked
          />
          <Checkbox label="Bundle Analyzer" description="Generate bundle size analysis report" />
        </div>
      </div>

      {/* Deployment Settings */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-graphite-800">Deployment Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <Checkbox>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-500" />
                <span>Auto-deploy on Push</span>
              </div>
            </Checkbox>
            <Checkbox description="Automatically run tests before deployment" checked>
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-blue-500" />
                <span>Pre-deployment Tests</span>
              </div>
            </Checkbox>
            <Checkbox warning="May increase build time" showValidationIcon>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-green-500" />
                <span>CDN Distribution</span>
              </div>
            </Checkbox>
          </div>

          <div className="space-y-3">
            <Checkbox
              label="Environment Variables"
              description="Load environment-specific configuration"
              checked
            />
            <Checkbox
              label="SSL Certificate"
              description="Enable HTTPS for secure connections"
              variant="success"
              success="SSL configured"
              showValidationIcon
              checked
            />
            <Checkbox
              label="Custom Domain"
              description="Use custom domain for deployment"
              loading
              helperText="Validating domain configuration..."
            />
          </div>
        </div>
      </div>

      {/* Team Permissions */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-graphite-800">Team Permissions</h3>
        <div className="space-y-3">
          <Checkbox label="All Team Members" indeterminate description="Some members have access" />
          <div className="ml-6 space-y-2">
            <Checkbox size="sm" checked>
              <div className="flex items-center gap-2">
                <Users className="h-3 w-3 text-blue-500" />
                <span>Frontend Team (12 members)</span>
              </div>
            </Checkbox>
            <Checkbox size="sm" checked>
              <div className="flex items-center gap-2">
                <Users className="h-3 w-3 text-green-500" />
                <span>Backend Team (8 members)</span>
              </div>
            </Checkbox>
            <Checkbox size="sm">
              <div className="flex items-center gap-2">
                <Users className="h-3 w-3 text-purple-500" />
                <span>DevOps Team (4 members)</span>
              </div>
            </Checkbox>
            <Checkbox size="sm" disabled>
              <div className="flex items-center gap-2">
                <Users className="h-3 w-3 text-pink-500" />
                <span>Design Team (6 members)</span>
              </div>
            </Checkbox>
          </div>
        </div>
      </div>

      {/* Feature Flags */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-graphite-800">Feature Flags</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-graphite-600">Experimental Features</h4>
            <Checkbox
              label="New Dashboard UI"
              description="Beta version of redesigned dashboard"
              warning="May have bugs in production"
              showValidationIcon
            />
            <Checkbox
              label="Advanced Analytics"
              description="Enhanced reporting and metrics"
              checked
            />
            <Checkbox
              label="Real-time Collaboration"
              description="Live editing with team members"
              loading
              helperText="Configuring WebSocket connections..."
            />
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-graphite-600">Security Features</h4>
            <Checkbox
              label="Two-Factor Authentication"
              description="Enhanced account security"
              variant="success"
              success="2FA enabled for all users"
              showValidationIcon
              checked
            />
            <Checkbox
              label="Session Timeout"
              description="Automatically log out inactive users"
              checked
            />
            <Checkbox
              label="IP Whitelist"
              description="Restrict access to specific IP addresses"
              error="Configuration required"
              showValidationIcon
            />
          </div>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Real-world examples of checkboxes in developer tools: build configuration, deployment settings, team permissions, and feature flags.',
      },
    },
  },
};

// Disabled states
export const DisabledStates: Story = {
  render: () => (
    <div className="w-96 space-y-4">
      <Checkbox disabled label="Disabled Unchecked" description="This option is not available" />
      <Checkbox
        disabled
        checked
        label="Disabled Checked"
        description="This option is enabled but cannot be changed"
      />
      <Checkbox
        disabled
        indeterminate
        label="Disabled Indeterminate"
        description="Partial selection that cannot be modified"
      />
      <Checkbox
        disabled
        variant="success"
        success="Feature is locked"
        showValidationIcon
        checked
        label="Disabled with Success"
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Comprehensive disabled states showing how all variants and features behave when disabled.',
      },
    },
  },
};

// Interactive playground
export const Interactive: Story = {
  args: {
    label: 'Interactive Checkbox',
    description: 'This is a description',
    helperText: 'This is helper text',
    size: 'md',
    variant: 'default',
    checked: false,
    indeterminate: false,
    loading: false,
    showValidationIcon: true,
    disabled: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Interactive playground to experiment with all checkbox props. Use the controls panel below to test different combinations.',
      },
    },
  },
};
