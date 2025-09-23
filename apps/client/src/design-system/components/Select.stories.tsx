/**
 * Select Component Stories - Comprehensive
 * Showcasing professional dropdown with search, multi-select, and validation
 * Designed for sophisticated developer tools with graphite theme
 */

import type { Meta, StoryObj } from '@storybook/react';
import {
  Code,
  Database,
  FileText,
  Folder,
  GitBranch,
  Globe,
  Layers,
  Package,
  Server,
  Settings,
  Terminal,
  Users,
} from 'lucide-react';
import Select, { type SelectOption } from './Select';

// Sample option data for stories
const frameworkOptions: SelectOption[] = [
  {
    value: 'react',
    label: 'React',
    description: 'A JavaScript library for building user interfaces',
    icon: <Code className="h-4 w-4 text-blue-500" />,
  },
  {
    value: 'vue',
    label: 'Vue.js',
    description: 'The Progressive JavaScript Framework',
    icon: <Code className="h-4 w-4 text-green-500" />,
  },
  {
    value: 'angular',
    label: 'Angular',
    description: 'Platform for building mobile and desktop web apps',
    icon: <Code className="h-4 w-4 text-red-500" />,
  },
  {
    value: 'svelte',
    label: 'Svelte',
    description: 'Cybernetically enhanced web apps',
    icon: <Code className="h-4 w-4 text-orange-500" />,
  },
  {
    value: 'nextjs',
    label: 'Next.js',
    description: 'The React Framework for Production',
    icon: <Code className="h-4 w-4 text-black" />,
  },
];

const databaseOptions: SelectOption[] = [
  {
    value: 'postgresql',
    label: 'PostgreSQL',
    description: 'Advanced open source relational database',
    icon: <Database className="h-4 w-4 text-blue-600" />,
  },
  {
    value: 'mysql',
    label: 'MySQL',
    description: 'Popular open-source relational database',
    icon: <Database className="h-4 w-4 text-orange-500" />,
  },
  {
    value: 'mongodb',
    label: 'MongoDB',
    description: 'Document-oriented NoSQL database',
    icon: <Database className="h-4 w-4 text-green-600" />,
  },
  {
    value: 'redis',
    label: 'Redis',
    description: 'In-memory data structure store',
    icon: <Database className="h-4 w-4 text-red-500" />,
  },
  {
    value: 'sqlite',
    label: 'SQLite',
    description: 'Lightweight embedded database',
    icon: <Database className="h-4 w-4 text-gray-600" />,
  },
];

const environmentOptions: SelectOption[] = [
  { value: 'development', label: 'Development', description: 'Local development environment' },
  { value: 'staging', label: 'Staging', description: 'Pre-production testing environment' },
  { value: 'production', label: 'Production', description: 'Live production environment' },
  {
    value: 'testing',
    label: 'Testing',
    description: 'Automated testing environment',
    disabled: true,
  },
];

const projectOptions: SelectOption[] = [
  {
    value: 'web-app',
    label: 'Web Application',
    description: 'Full-stack web application',
    icon: <Globe className="h-4 w-4" />,
  },
  {
    value: 'api',
    label: 'REST API',
    description: 'Backend API service',
    icon: <Server className="h-4 w-4" />,
  },
  {
    value: 'mobile',
    label: 'Mobile App',
    description: 'Native mobile application',
    icon: <Package className="h-4 w-4" />,
  },
  {
    value: 'desktop',
    label: 'Desktop App',
    description: 'Cross-platform desktop application',
    icon: <Terminal className="h-4 w-4" />,
  },
];

const teamOptions: SelectOption[] = [
  {
    value: 'frontend',
    label: 'Frontend Team',
    description: '12 developers',
    icon: <Users className="h-4 w-4 text-blue-500" />,
  },
  {
    value: 'backend',
    label: 'Backend Team',
    description: '8 developers',
    icon: <Users className="h-4 w-4 text-green-500" />,
  },
  {
    value: 'devops',
    label: 'DevOps Team',
    description: '4 engineers',
    icon: <Users className="h-4 w-4 text-purple-500" />,
  },
  {
    value: 'design',
    label: 'Design Team',
    description: '6 designers',
    icon: <Users className="h-4 w-4 text-pink-500" />,
  },
];

const meta = {
  title: 'Design System/Select',
  component: Select,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Professional select dropdown component with search functionality, multi-select support, validation states, and comprehensive accessibility features. Designed for developer tools with sophisticated graphite theme.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'error', 'success', 'warning'],
      description: 'Visual variant of the select',
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
      description: 'Size of the select affecting padding and font size',
    },
    multiple: {
      control: { type: 'boolean' },
      description: 'Whether multiple selections are allowed',
    },
    searchable: {
      control: { type: 'boolean' },
      description: 'Whether to show search input in dropdown',
    },
    showDescriptions: {
      control: { type: 'boolean' },
      description: 'Whether to show option descriptions',
    },
    showValidationIcon: {
      control: { type: 'boolean' },
      description: 'Whether to show validation icons automatically',
    },
    floatingLabel: {
      control: { type: 'boolean' },
      description: 'Whether the label should float inside the select',
    },
    loading: {
      control: { type: 'boolean' },
      description: 'Whether the select is in a loading state',
    },
    disabled: {
      control: { type: 'boolean' },
      description: 'Whether the select is disabled',
    },
    required: {
      control: { type: 'boolean' },
      description: 'Whether the select is required',
    },
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default select
export const Default: Story = {
  args: {
    label: 'Choose Framework',
    options: frameworkOptions,
    placeholder: 'Select a framework...',
  },
};

// All variants with validation states
export const Variants: Story = {
  render: () => (
    <div className="w-80 space-y-4">
      <Select label="Default" options={frameworkOptions} placeholder="Default select" />
      <Select
        label="Success"
        options={frameworkOptions}
        placeholder="Success select"
        success="Great choice!"
        showValidationIcon
      />
      <Select
        label="Warning"
        options={frameworkOptions}
        placeholder="Warning select"
        warning="Consider other options"
        showValidationIcon
      />
      <Select
        label="Error"
        options={frameworkOptions}
        placeholder="Error select"
        error="This field is required"
        showValidationIcon
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Select variants with enhanced validation states: Default, Success, Warning, and Error with automatic validation icons.',
      },
    },
  },
};

// All sizes
export const Sizes: Story = {
  render: () => (
    <div className="w-80 space-y-4">
      <Select size="sm" label="Small" options={frameworkOptions} placeholder="Small select" />
      <Select
        size="md"
        label="Medium"
        options={frameworkOptions}
        placeholder="Medium select (default)"
      />
      <Select size="lg" label="Large" options={frameworkOptions} placeholder="Large select" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Select sizes with proper icon scaling and padding adjustments for each size.',
      },
    },
  },
};

// Multi-select functionality
export const MultipleSelection: Story = {
  render: () => (
    <div className="w-96 space-y-4">
      <Select
        multiple
        label="Select Technologies"
        options={frameworkOptions}
        placeholder="Choose multiple frameworks..."
        description="Select all technologies you're familiar with"
      />
      <Select
        multiple
        label="Select Databases"
        options={databaseOptions}
        placeholder="Choose databases..."
        showDescriptions
        helperText="Multiple selections allowed"
      />
      <Select
        multiple
        label="Assign Teams"
        options={teamOptions}
        placeholder="Select teams..."
        floatingLabel
        showValidationIcon
        success="Teams assigned successfully"
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Multi-select functionality with tag display, clear all option, and proper selection management.',
      },
    },
  },
};

// Searchable selects
export const SearchableSelects: Story = {
  render: () => (
    <div className="w-96 space-y-4">
      <Select
        searchable
        label="Choose Framework"
        options={frameworkOptions}
        placeholder="Search frameworks..."
        description="Start typing to filter options"
        showDescriptions
      />
      <Select
        searchable
        multiple
        label="Select Databases"
        options={databaseOptions}
        placeholder="Search and select databases..."
        showDescriptions
        helperText="Search by name or description"
      />
      <Select
        searchable
        label="Environment"
        options={environmentOptions}
        placeholder="Search environments..."
        floatingLabel
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Searchable selects with real-time filtering by option labels and descriptions.',
      },
    },
  },
};

// Loading states
export const LoadingStates: Story = {
  render: () => (
    <div className="w-80 space-y-4">
      <Select
        loading
        label="Loading Options"
        options={[]}
        placeholder="Loading..."
        helperText="Fetching available options..."
      />
      <Select
        loading
        multiple
        label="Loading Teams"
        options={teamOptions}
        placeholder="Refreshing teams..."
        value={['frontend', 'backend']}
        helperText="Updating team assignments..."
      />
      <Select
        loading
        size="lg"
        label="Large Loading Select"
        options={frameworkOptions}
        placeholder="Large loading state"
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Loading states with animated spinner and disabled interaction during data fetching.',
      },
    },
  },
};

// Floating labels
export const FloatingLabels: Story = {
  render: () => (
    <div className="w-96 space-y-6">
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-graphite-700">Floating Label Selects</h3>
        <Select floatingLabel label="Project Type" options={projectOptions} showDescriptions />
        <Select
          floatingLabel
          searchable
          label="Technology Stack"
          options={frameworkOptions}
          showDescriptions
          description="Choose your preferred framework"
        />
        <Select
          floatingLabel
          multiple
          searchable
          label="Development Teams"
          options={teamOptions}
          placeholder="Select teams..."
          required
        />
        <Select
          floatingLabel
          label="Deployment Environment"
          options={environmentOptions}
          success="Environment configured"
          showValidationIcon
        />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Modern floating label pattern that provides clean, space-efficient design while maintaining accessibility.',
      },
    },
  },
};

// Professional developer tool examples
export const DeveloperToolExamples: Story = {
  render: () => (
    <div className="space-y-8 max-w-4xl">
      {/* Project configuration */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-graphite-800">Project Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Project Type"
            options={projectOptions}
            showDescriptions
            required
            helperText="Choose your project type"
          />
          <Select
            label="Framework"
            options={frameworkOptions}
            showDescriptions
            searchable
            success="Framework selected"
            showValidationIcon
          />
          <Select
            multiple
            label="Databases"
            options={databaseOptions}
            placeholder="Select databases..."
            showDescriptions
            searchable
          />
          <Select
            label="Environment"
            options={environmentOptions}
            defaultValue="development"
            warning="Development environment selected"
            showValidationIcon
          />
        </div>
      </div>

      {/* Team assignment with floating labels */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-graphite-800">Team Assignment</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            floatingLabel
            multiple
            searchable
            label="Assign Teams"
            options={teamOptions}
            showDescriptions
            placeholder="Search and select teams..."
          />
          <Select
            floatingLabel
            label="Primary Responsibility"
            options={[
              {
                value: 'frontend',
                label: 'Frontend Development',
                icon: <Code className="h-4 w-4" />,
              },
              {
                value: 'backend',
                label: 'Backend Development',
                icon: <Server className="h-4 w-4" />,
              },
              {
                value: 'fullstack',
                label: 'Full Stack Development',
                icon: <Layers className="h-4 w-4" />,
              },
              {
                value: 'devops',
                label: 'DevOps & Infrastructure',
                icon: <Settings className="h-4 w-4" />,
              },
            ]}
            showDescriptions={false}
          />
        </div>
      </div>

      {/* Advanced configuration */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-graphite-800">Advanced Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select
            searchable
            label="Git Branch"
            options={[
              {
                value: 'main',
                label: 'main',
                description: 'Production branch',
                icon: <GitBranch className="h-4 w-4 text-green-500" />,
              },
              {
                value: 'develop',
                label: 'develop',
                description: 'Development branch',
                icon: <GitBranch className="h-4 w-4 text-blue-500" />,
              },
              {
                value: 'staging',
                label: 'staging',
                description: 'Staging branch',
                icon: <GitBranch className="h-4 w-4 text-yellow-500" />,
              },
              {
                value: 'feature/auth',
                label: 'feature/auth',
                description: 'Authentication feature',
                icon: <GitBranch className="h-4 w-4 text-purple-500" />,
              },
            ]}
            showDescriptions
            placeholder="Select branch..."
          />
          <Select
            label="Build Target"
            options={[
              {
                value: 'development',
                label: 'Development',
                description: 'Unminified build with source maps',
              },
              {
                value: 'production',
                label: 'Production',
                description: 'Optimized build for deployment',
              },
              { value: 'testing', label: 'Testing', description: 'Build optimized for testing' },
            ]}
            showDescriptions
            defaultValue="development"
          />
          <Select
            loading
            label="Available Regions"
            options={[]}
            placeholder="Loading regions..."
            helperText="Fetching available deployment regions..."
          />
        </div>
      </div>

      {/* Validation and status */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-graphite-800">Validation & Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Schema Validation"
            options={[
              {
                value: 'valid',
                label: 'Valid Schema',
                icon: <FileText className="h-4 w-4 text-green-500" />,
              },
              {
                value: 'warning',
                label: 'Schema Warnings',
                icon: <FileText className="h-4 w-4 text-amber-500" />,
              },
              {
                value: 'error',
                label: 'Schema Errors',
                icon: <FileText className="h-4 w-4 text-red-500" />,
              },
            ]}
            value="valid"
            success="Schema validation passed"
            showValidationIcon
            disabled
          />
          <Select
            label="Deployment Status"
            options={[
              { value: 'deployed', label: 'Successfully Deployed' },
              { value: 'pending', label: 'Deployment Pending' },
              { value: 'failed', label: 'Deployment Failed' },
            ]}
            value="failed"
            error="Deployment failed - check logs"
            showValidationIcon
            disabled
          />
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Real-world examples of selects in developer tools: project configuration, team assignment, build settings, and status displays.',
      },
    },
  },
};

// Disabled states
export const DisabledStates: Story = {
  render: () => (
    <div className="w-96 space-y-4">
      <Select
        disabled
        label="Disabled Default"
        options={frameworkOptions}
        placeholder="This select is disabled"
      />
      <Select
        disabled
        label="Disabled with Value"
        options={frameworkOptions}
        value="react"
        showValidationIcon
      />
      <Select
        disabled
        multiple
        label="Disabled Multiple"
        options={teamOptions}
        value={['frontend', 'backend']}
        helperText="Selection cannot be changed"
      />
      <Select
        disabled
        floatingLabel
        label="Disabled Floating"
        options={environmentOptions}
        value="production"
        success="Configuration locked"
        showValidationIcon
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
    label: 'Interactive Select',
    options: frameworkOptions,
    placeholder: 'Choose an option...',
    size: 'md',
    variant: 'default',
    multiple: false,
    searchable: false,
    showDescriptions: true,
    showValidationIcon: true,
    floatingLabel: false,
    disabled: false,
    loading: false,
    required: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Interactive playground to experiment with all select props. Use the controls panel below to test different combinations.',
      },
    },
  },
};
