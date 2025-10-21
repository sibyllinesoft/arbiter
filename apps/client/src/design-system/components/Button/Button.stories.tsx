/**
 * Button Component Stories
 * Comprehensive documentation and examples for the Button component
 */

import type { Meta, StoryObj } from "@storybook/react";
import { ArrowRight, Download, Loader2, Plus, Save, Trash2 } from "lucide-react";
import Button from "./Button";

const meta = {
  title: "Design System/Button",
  component: Button,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Professional button component with comprehensive variants, sizes, and states. Designed for developer tools with a sophisticated graphite theme.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: { type: "select" },
      options: ["primary", "secondary", "ghost", "danger"],
      description: "Visual variant of the button",
    },
    size: {
      control: { type: "select" },
      options: ["xs", "sm", "md", "lg", "xl"],
      description: "Size of the button affecting padding and font size",
    },
    fullWidth: {
      control: { type: "boolean" },
      description: "Whether the button should take full width of container",
    },
    loading: {
      control: { type: "boolean" },
      description: "Whether the button is in a loading state",
    },
    disabled: {
      control: { type: "boolean" },
      description: "Whether the button is disabled",
    },
    children: {
      control: { type: "text" },
      description: "Button content",
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default button
export const Default: Story = {
  args: {
    children: "Button",
  },
};

// All variants
export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Danger</Button>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "The four main button variants: Primary for main actions, Secondary for secondary actions, Ghost for subtle actions, and Danger for destructive actions.",
      },
    },
  },
};

// All sizes
export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Button size="xs">Extra Small</Button>
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
      <Button size="xl">Extra Large</Button>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Buttons come in five sizes from xs to xl. Medium (md) is the default size.",
      },
    },
  },
};

// With icons
export const WithIcons: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button leftIcon={<Save />}>Save</Button>
      <Button rightIcon={<ArrowRight />}>Next</Button>
      <Button leftIcon={<Download />} rightIcon={<ArrowRight />}>
        Download File
      </Button>
      <Button variant="secondary" leftIcon={<Plus />}>
        Add Item
      </Button>
      <Button variant="danger" leftIcon={<Trash2 />}>
        Delete
      </Button>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Buttons can include icons on the left, right, or both sides. Icons automatically scale with button size.",
      },
    },
  },
};

// Loading states
export const Loading: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button loading>Loading</Button>
      <Button variant="secondary" loading>
        Processing
      </Button>
      <Button variant="ghost" loading>
        Saving
      </Button>
      <Button loading leftIcon={<Save />}>
        Save
      </Button>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Loading buttons show a spinner and are automatically disabled. The text becomes transparent while preserving button dimensions.",
      },
    },
  },
};

// Disabled states
export const Disabled: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button disabled>Disabled</Button>
      <Button variant="secondary" disabled>
        Disabled
      </Button>
      <Button variant="ghost" disabled>
        Disabled
      </Button>
      <Button variant="danger" disabled>
        Disabled
      </Button>
      <Button disabled leftIcon={<Save />}>
        Disabled with Icon
      </Button>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Disabled buttons have reduced opacity and are not interactive. All variants support disabled state.",
      },
    },
  },
};

// Full width
export const FullWidth: Story = {
  render: () => (
    <div className="w-80 space-y-4">
      <Button fullWidth>Full Width Primary</Button>
      <Button variant="secondary" fullWidth>
        Full Width Secondary
      </Button>
      <Button variant="ghost" fullWidth leftIcon={<Save />}>
        Full Width with Icon
      </Button>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Full width buttons stretch to fill their container width. Useful in forms and narrow layouts.",
      },
    },
  },
};

// Developer tool examples with realistic context
export const DeveloperToolExamples: Story = {
  render: () => (
    <div className="space-y-8 p-6 bg-gray-50 rounded-lg">
      {/* Project toolbar */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-800">Project Toolbar</h3>
        <div className="flex items-center justify-between p-3 bg-white rounded border">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">E-commerce API Platform</span>
            <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">Active</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" leftIcon={<Save />}>
              Save Spec
            </Button>
            <Button size="sm" variant="secondary" leftIcon={<Download />}>
              Export YAML
            </Button>
            <Button size="sm" variant="ghost">
              Validate
            </Button>
          </div>
        </div>
      </div>

      {/* Build and deployment */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-800">Build & Deploy</h3>
        <div className="p-4 bg-white rounded border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm">
              Build Status: <span className="text-green-600">Passed</span>
            </span>
            <span className="text-xs text-gray-500">2m 34s ago</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary">
              View Logs
            </Button>
            <Button size="sm" leftIcon={<ArrowRight />}>
              Deploy to Staging
            </Button>
            <Button size="sm" variant="danger" leftIcon={<Trash2 />}>
              Cancel Build
            </Button>
          </div>
        </div>
      </div>

      {/* Form actions with context */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-800">Specification Editor</h3>
        <div className="p-4 bg-white rounded border">
          <div className="mb-4">
            <div className="flex items-center gap-2 text-sm">
              <span>authentication.yml</span>
              <span className="w-2 h-2 bg-orange-400 rounded-full" title="Unsaved changes"></span>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost">Discard Changes</Button>
            <Button leftIcon={<Save />}>Save & Validate</Button>
          </div>
        </div>
      </div>

      {/* Destructive actions with confirmation context */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-800">Danger Zone</h3>
        <div className="p-4 bg-red-50 rounded border border-red-200">
          <div className="mb-3">
            <h4 className="text-sm font-medium text-red-900">Delete Project</h4>
            <p className="text-xs text-red-700">
              This action cannot be undone. All specifications and history will be lost.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="danger" size="sm" leftIcon={<Trash2 />}>
              Delete Project
            </Button>
            <Button variant="danger" size="sm">
              Reset All Data
            </Button>
          </div>
        </div>
      </div>

      {/* Loading states in context */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-800">Processing States</h3>
        <div className="p-4 bg-white rounded border">
          <div className="flex gap-2 mb-3">
            <Button loading size="sm">
              Running Tests
            </Button>
            <Button loading variant="secondary" size="sm">
              Generating Docs
            </Button>
            <Button loading variant="ghost" size="sm">
              Syncing
            </Button>
          </div>
          <div className="text-xs text-gray-600">
            These buttons show loading states during long-running operations
          </div>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Comprehensive examples showing buttons in realistic developer tool contexts: project management, build/deploy workflows, editors, and dangerous operations.",
      },
    },
  },
};

// Interactive playground
export const Interactive: Story = {
  args: {
    variant: "primary",
    size: "md",
    children: "Interactive Button",
    fullWidth: false,
    loading: false,
    disabled: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Interactive playground to experiment with all button props. Use the controls panel below to test different combinations.",
      },
    },
  },
};
