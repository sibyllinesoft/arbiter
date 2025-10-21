/**
 * Radio Component Stories
 * Comprehensive documentation and examples for Radio and RadioGroup components
 * Showcasing professional form controls with sophisticated graphite theme
 */

import type { Meta, StoryObj } from "@storybook/react";
import {
  Cloud,
  Code,
  Database,
  GitBranch,
  Globe,
  Package,
  Server,
  Settings,
  Shield,
  Terminal,
  Users,
  Zap,
} from "lucide-react";
import Radio, { RadioGroup, type RadioOption } from "./Radio";

// Sample data for stories
const deploymentOptions: RadioOption[] = [
  {
    value: "cloud",
    label: "Cloud Deployment",
    description: "Deploy to managed cloud infrastructure",
    icon: <Cloud className="h-4 w-4 text-blue-500" />,
  },
  {
    value: "dedicated",
    label: "Dedicated Server",
    description: "Deploy to dedicated hardware",
    icon: <Server className="h-4 w-4 text-green-500" />,
  },
  {
    value: "hybrid",
    label: "Hybrid Setup",
    description: "Combination of cloud and on-premise",
    icon: <Globe className="h-4 w-4 text-purple-500" />,
  },
];

const databaseOptions: RadioOption[] = [
  {
    value: "postgresql",
    label: "PostgreSQL",
    description: "Robust relational database with advanced features",
    icon: <Database className="h-4 w-4 text-blue-600" />,
  },
  {
    value: "mysql",
    label: "MySQL",
    description: "Popular open-source relational database",
    icon: <Database className="h-4 w-4 text-orange-500" />,
  },
  {
    value: "mongodb",
    label: "MongoDB",
    description: "Document-oriented NoSQL database",
    icon: <Database className="h-4 w-4 text-green-600" />,
  },
  {
    value: "redis",
    label: "Redis",
    description: "In-memory data structure store",
    icon: <Database className="h-4 w-4 text-red-500" />,
  },
];

const frameworkOptions: RadioOption[] = [
  {
    value: "react",
    label: "React",
    description: "A JavaScript library for building user interfaces",
    icon: <Code className="h-4 w-4 text-blue-500" />,
  },
  {
    value: "vue",
    label: "Vue.js",
    description: "The Progressive JavaScript Framework",
    icon: <Code className="h-4 w-4 text-green-500" />,
  },
  {
    value: "angular",
    label: "Angular",
    description: "Platform for building mobile and desktop web apps",
    icon: <Code className="h-4 w-4 text-red-500" />,
  },
  {
    value: "svelte",
    label: "Svelte",
    description: "Cybernetically enhanced web apps",
    icon: <Code className="h-4 w-4 text-orange-500" />,
  },
];

const environmentOptions: RadioOption[] = [
  { value: "development", label: "Development", description: "Local development environment" },
  { value: "staging", label: "Staging", description: "Pre-production testing environment" },
  { value: "production", label: "Production", description: "Live production environment" },
  {
    value: "testing",
    label: "Testing",
    description: "Automated testing environment",
    disabled: true,
  },
];

const meta = {
  title: "Design System/Radio",
  component: Radio,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Professional radio button and radio group components with comprehensive states, validation, and accessibility features. Designed for developer tools with sophisticated graphite theme.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: { type: "select" },
      options: ["default", "error", "success", "warning"],
      description: "Visual variant of the radio",
    },
    size: {
      control: { type: "select" },
      options: ["sm", "md", "lg"],
      description: "Size of the radio affecting size and font",
    },
    label: {
      control: { type: "text" },
      description: "Label text for the radio",
    },
    description: {
      control: { type: "text" },
      description: "Additional description text",
    },
    helperText: {
      control: { type: "text" },
      description: "Helper text below the radio",
    },
    error: {
      control: { type: "text" },
      description: "Error message (sets variant to error automatically)",
    },
    warning: {
      control: { type: "text" },
      description: "Warning message (sets variant to warning automatically)",
    },
    success: {
      control: { type: "text" },
      description: "Success message (sets variant to success automatically)",
    },
    loading: {
      control: { type: "boolean" },
      description: "Whether the radio is in a loading state",
    },
    showValidationIcon: {
      control: { type: "boolean" },
      description: "Whether to show validation icons automatically",
    },
    disabled: {
      control: { type: "boolean" },
      description: "Whether the radio is disabled",
    },
    checked: {
      control: { type: "boolean" },
      description: "Whether the radio is checked",
    },
  },
} satisfies Meta<typeof Radio>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default radio
export const Default: Story = {
  args: {
    name: "example",
    value: "option1",
    label: "Option 1",
    description: "This is the first option",
  },
};

// All variants with validation states
export const Variants: Story = {
  render: () => (
    <div className="w-96 space-y-4">
      <Radio
        name="variants"
        value="default"
        label="Default Radio"
        helperText="Standard radio button style"
      />
      <Radio
        name="variants"
        value="success"
        label="Success Radio"
        success="Configuration saved successfully"
        showValidationIcon
        checked
      />
      <Radio
        name="variants"
        value="warning"
        label="Warning Radio"
        warning="This setting may affect performance"
        showValidationIcon
      />
      <Radio
        name="variants"
        value="error"
        label="Error Radio"
        error="This option is not available"
        showValidationIcon
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Radio variants with enhanced validation states: Default, Success, Warning, and Error with automatic validation icons.",
      },
    },
  },
};

// All sizes
export const Sizes: Story = {
  render: () => (
    <div className="w-96 space-y-4">
      <Radio
        name="sizes"
        value="small"
        size="sm"
        label="Small Radio"
        description="Compact size for dense layouts"
      />
      <Radio
        name="sizes"
        value="medium"
        size="md"
        label="Medium Radio"
        description="Default size for most use cases"
        checked
      />
      <Radio
        name="sizes"
        value="large"
        size="lg"
        label="Large Radio"
        description="Larger size for prominence"
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Radio sizes with proper scaling of the radio button, icons, and text.",
      },
    },
  },
};

// Loading states
export const LoadingStates: Story = {
  render: () => (
    <div className="w-96 space-y-4">
      <Radio
        name="loading"
        value="option1"
        loading
        label="Validating Option"
        helperText="Please wait while we validate this selection..."
      />
      <Radio
        name="loading"
        value="option2"
        loading
        size="lg"
        label="Processing Selection"
        description="Checking system compatibility"
        helperText="This may take a few moments"
        checked
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Loading states with animated spinner, showing the radio is processing an action.",
      },
    },
  },
};

// RadioGroup - Basic usage
export const BasicRadioGroup: Story = {
  render: () => (
    <div className="w-96">
      <RadioGroup
        name="deployment"
        label="Choose Deployment Method"
        description="Select how you want to deploy your application"
        options={deploymentOptions}
        defaultValue="cloud"
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Basic RadioGroup with options including icons and descriptions.",
      },
    },
  },
};

// RadioGroup - All variants
export const RadioGroupVariants: Story = {
  render: () => (
    <div className="space-y-8">
      <RadioGroup
        name="default-group"
        label="Default Group"
        options={environmentOptions}
        helperText="Choose your target environment"
      />

      <RadioGroup
        name="success-group"
        label="Success Group"
        options={environmentOptions}
        defaultValue="production"
        success="Environment configured successfully"
      />

      <RadioGroup
        name="warning-group"
        label="Warning Group"
        options={environmentOptions}
        defaultValue="staging"
        warning="Staging environment has limited resources"
      />

      <RadioGroup
        name="error-group"
        label="Error Group"
        options={environmentOptions}
        error="Please select an environment"
        required
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "RadioGroup variants showing different validation states and messages.",
      },
    },
  },
};

// RadioGroup - Horizontal layout
export const HorizontalRadioGroup: Story = {
  render: () => (
    <div className="space-y-8">
      <RadioGroup
        name="framework-horizontal"
        label="Choose Framework"
        description="Select your preferred JavaScript framework"
        options={frameworkOptions}
        direction="horizontal"
        defaultValue="react"
      />

      <RadioGroup
        name="environment-horizontal"
        label="Target Environment"
        options={environmentOptions}
        direction="horizontal"
        size="sm"
        helperText="Select deployment target"
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "RadioGroup with horizontal layout for options that work better in a row.",
      },
    },
  },
};

// Professional developer tool examples
export const DeveloperToolExamples: Story = {
  render: () => (
    <div className="space-y-10 max-w-4xl">
      {/* Project Setup */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-graphite-800">Project Configuration</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <RadioGroup
            name="project-type"
            label="Project Type"
            description="Choose the type of project you're creating"
            options={[
              {
                value: "web-app",
                label: "Web Application",
                description: "Full-stack web application with frontend and backend",
                icon: <Globe className="h-4 w-4 text-blue-500" />,
              },
              {
                value: "api",
                label: "REST API",
                description: "Backend API service only",
                icon: <Server className="h-4 w-4 text-green-500" />,
              },
              {
                value: "spa",
                label: "Single Page Application",
                description: "Frontend-only application",
                icon: <Code className="h-4 w-4 text-purple-500" />,
              },
              {
                value: "tool",
                label: "Command Line Tool",
                description: "Terminal-based application",
                icon: <Terminal className="h-4 w-4 text-gray-600" />,
              },
            ]}
            defaultValue="web-app"
          />

          <RadioGroup
            name="framework"
            label="Frontend Framework"
            options={frameworkOptions}
            success="Framework selected"
            defaultValue="react"
          />
        </div>
      </div>

      {/* Build Configuration */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-graphite-800">Build Configuration</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <RadioGroup
            name="build-tool"
            label="Build Tool"
            description="Choose your build and bundling tool"
            options={[
              {
                value: "vite",
                label: "Vite",
                description: "Fast build tool with HMR",
                icon: <Zap className="h-4 w-4 text-yellow-500" />,
              },
              {
                value: "webpack",
                label: "Webpack",
                description: "Mature and configurable bundler",
                icon: <Package className="h-4 w-4 text-blue-600" />,
              },
              {
                value: "parcel",
                label: "Parcel",
                description: "Zero-configuration build tool",
                icon: <Package className="h-4 w-4 text-red-500" />,
              },
            ]}
            defaultValue="vite"
          />

          <RadioGroup
            name="package-manager"
            label="Package Manager"
            options={[
              { value: "npm", label: "npm", description: "Default Node.js package manager" },
              { value: "yarn", label: "Yarn", description: "Fast and reliable package manager" },
              { value: "pnpm", label: "pnpm", description: "Efficient disk space usage" },
              {
                value: "bun",
                label: "Bun",
                description: "Ultra-fast JavaScript runtime and package manager",
              },
            ]}
            size="sm"
            direction="horizontal"
            defaultValue="npm"
          />
        </div>
      </div>

      {/* Database Selection */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-graphite-800">Database Configuration</h3>
        <RadioGroup
          name="database"
          label="Primary Database"
          description="Choose your primary data storage solution"
          options={databaseOptions}
          defaultValue="postgresql"
          helperText="You can add additional databases later"
        />
      </div>

      {/* Deployment Settings */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-graphite-800">Deployment Settings</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <RadioGroup
            name="deployment-target"
            label="Deployment Target"
            options={deploymentOptions}
            defaultValue="cloud"
            success="Deployment method configured"
          />

          <RadioGroup
            name="ci-cd"
            label="CI/CD Pipeline"
            description="Choose your continuous integration platform"
            options={[
              {
                value: "github-actions",
                label: "GitHub Actions",
                description: "Integrated with GitHub repositories",
                icon: <GitBranch className="h-4 w-4 text-gray-800" />,
              },
              {
                value: "gitlab-ci",
                label: "GitLab CI",
                description: "Built-in GitLab automation",
                icon: <GitBranch className="h-4 w-4 text-orange-500" />,
              },
              {
                value: "jenkins",
                label: "Jenkins",
                description: "Self-hosted automation server",
                icon: <Settings className="h-4 w-4 text-blue-600" />,
              },
              {
                value: "none",
                label: "Manual Deployment",
                description: "Deploy manually without automation",
              },
            ]}
            warning="Manual deployment not recommended for production"
            defaultValue="github-actions"
          />
        </div>
      </div>

      {/* Security Configuration */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-graphite-800">Security Configuration</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <RadioGroup
            name="authentication"
            label="Authentication Method"
            options={[
              {
                value: "jwt",
                label: "JWT Tokens",
                description: "JSON Web Tokens for stateless auth",
                icon: <Shield className="h-4 w-4 text-green-500" />,
              },
              {
                value: "session",
                label: "Session-based",
                description: "Traditional server-side sessions",
                icon: <Shield className="h-4 w-4 text-blue-500" />,
              },
              {
                value: "oauth",
                label: "OAuth 2.0",
                description: "Third-party authentication",
                icon: <Shield className="h-4 w-4 text-purple-500" />,
              },
            ]}
            defaultValue="jwt"
          />

          <RadioGroup
            name="access-level"
            label="Default Access Level"
            options={[
              {
                value: "public",
                label: "Public Access",
                description: "Open to all users",
                icon: <Users className="h-4 w-4 text-green-500" />,
              },
              {
                value: "authenticated",
                label: "Authenticated Users",
                description: "Requires login",
                icon: <Users className="h-4 w-4 text-blue-500" />,
              },
              {
                value: "admin",
                label: "Admin Only",
                description: "Restricted to administrators",
                icon: <Shield className="h-4 w-4 text-red-500" />,
              },
            ]}
            error="Access level must be selected"
            required
          />
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Real-world examples of radio groups in developer tools: project setup, build configuration, database selection, deployment settings, and security options.",
      },
    },
  },
};

// Disabled states
export const DisabledStates: Story = {
  render: () => (
    <div className="space-y-8">
      <div className="w-96 space-y-4">
        <h4 className="text-sm font-medium text-graphite-700">Individual Radio Disabled States</h4>
        <Radio
          name="disabled-individual"
          value="option1"
          disabled
          label="Disabled Unchecked"
          description="This option is not available"
        />
        <Radio
          name="disabled-individual"
          value="option2"
          disabled
          checked
          label="Disabled Checked"
          description="This option is enabled but cannot be changed"
        />
        <Radio
          name="disabled-individual"
          value="option3"
          disabled
          variant="success"
          success="Feature is locked"
          showValidationIcon
          label="Disabled with Success"
        />
      </div>

      <div>
        <h4 className="text-sm font-medium text-graphite-700 mb-4">Disabled Radio Group</h4>
        <RadioGroup
          name="disabled-group"
          label="Deployment Method (Disabled)"
          description="Selection is currently locked"
          options={deploymentOptions}
          defaultValue="cloud"
          disabled
          helperText="Contact administrator to change deployment settings"
        />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Comprehensive disabled states for both individual radio buttons and entire radio groups.",
      },
    },
  },
};

// Interactive playground for single radio
export const Interactive: Story = {
  args: {
    name: "interactive",
    value: "option",
    label: "Interactive Radio",
    description: "This is a description",
    helperText: "This is helper text",
    size: "md",
    variant: "default",
    checked: false,
    loading: false,
    showValidationIcon: true,
    disabled: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Interactive playground to experiment with individual radio props. Use the controls panel below to test different combinations.",
      },
    },
  },
};
