/**
 * Input Component Stories - Enhanced
 * Comprehensive documentation and examples for the enhanced Input component
 * Showcasing professional developer tool patterns with sophisticated graphite theme
 */

import type { Meta, StoryObj } from '@storybook/react';
import { 
  Search, Mail, Lock, Eye, EyeOff, User, AlertCircle, CheckCircle, AlertTriangle, 
  Calendar, DollarSign, Phone, Code, GitBranch, Database, Globe, FileText,
  Settings, Terminal, Folder, Clock, Shield
} from 'lucide-react';
import Input from './Input';
import { storybookData } from '../../test/storybook-data';

const meta = {
  title: 'Design System/Input',
  component: Input,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Professional input component with comprehensive variants, states, validation, floating labels, and accessibility features. Designed for developer tools with sophisticated graphite theme and modern UX patterns.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'error', 'success', 'warning'],
      description: 'Visual variant of the input',
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
      description: 'Size of the input affecting padding and font size',
    },
    fullWidth: {
      control: { type: 'boolean' },
      description: 'Whether the input should take full width of container',
    },
    label: {
      control: { type: 'text' },
      description: 'Label for the input',
    },
    placeholder: {
      control: { type: 'text' },
      description: 'Placeholder text',
    },
    description: {
      control: { type: 'text' },
      description: 'Additional description text',
    },
    helperText: {
      control: { type: 'text' },
      description: 'Helper text below the input',
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
    loading: {
      control: { type: 'boolean' },
      description: 'Whether the input is in a loading state',
    },
    showValidationIcon: {
      control: { type: 'boolean' },
      description: 'Whether to show validation icons automatically',
    },
    floatingLabel: {
      control: { type: 'boolean' },
      description: 'Whether the label should float inside the input',
    },
    disabled: {
      control: { type: 'boolean' },
      description: 'Whether the input is disabled',
    },
    required: {
      control: { type: 'boolean' },
      description: 'Whether the input is required',
    },
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default input
export const Default: Story = {
  args: {
    label: 'Email Address',
    placeholder: 'Enter your email',
  },
};

// All variants with new warning state
export const Variants: Story = {
  render: () => (
    <div className="w-80 space-y-4">
      <Input label="Default" placeholder="Default input" />
      <Input label="Success" success="This looks good!" placeholder="Success input" />
      <Input label="Warning" warning="Check this field" placeholder="Warning input" />
      <Input label="Error" error="Something went wrong" placeholder="Error input" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Input variants with enhanced validation states: Default, Success, Warning (new), and Error with automatic validation icons.',
      },
    },
  },
};

// All sizes with proper spacing
export const Sizes: Story = {
  render: () => (
    <div className="w-80 space-y-4">
      <Input size="sm" label="Small" placeholder="Small input" />
      <Input size="md" label="Medium" placeholder="Medium input (default)" />
      <Input size="lg" label="Large" placeholder="Large input" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Input sizes with proper icon scaling and padding adjustments for each size.',
      },
    },
  },
};

// Enhanced validation states with icons
export const ValidationStates: Story = {
  render: () => (
    <div className="w-96 space-y-4">
      <Input 
        label="Valid Email" 
        placeholder="user@example.com"
        success="Email is available and valid"
        showValidationIcon
      />
      <Input 
        label="Email with Warning" 
        placeholder="user@example.com"
        warning="This email is already registered but you can still use it"
        showValidationIcon
      />
      <Input 
        label="Invalid Email" 
        placeholder="user@example.com"
        error="Please enter a valid email address"
        showValidationIcon
      />
      <Input 
        label="Custom Validation" 
        placeholder="Enter value"
        rightIcon={<CheckCircle className="text-emerald-500" />}
        helperText="Custom validation with manual icon"
        showValidationIcon={false}
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Enhanced validation states with automatic validation icons and comprehensive feedback messages.',
      },
    },
  },
};

// Loading states
export const LoadingStates: Story = {
  render: () => (
    <div className="w-80 space-y-4">
      <Input 
        label="Validating Email" 
        placeholder="user@example.com"
        loading
        helperText="Checking availability..."
      />
      <Input 
        label="Processing" 
        value="user@example.com"
        loading
        leftIcon={<Mail />}
        helperText="Saving changes..."
      />
      <Input 
        size="lg"
        label="Large Loading Input" 
        placeholder="Large input with loading"
        loading
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Loading states with animated spinner, showing the input is processing or validating data.',
      },
    },
  },
};

// Floating labels - Modern UX pattern
export const FloatingLabels: Story = {
  render: () => (
    <div className="w-96 space-y-6">
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-graphite-700">Floating Label Inputs</h3>
        <Input 
          floatingLabel
          label="Full Name" 
          placeholder="Enter your full name"
        />
        <Input 
          floatingLabel
          label="Email Address" 
          placeholder="Enter your email"
          leftIcon={<Mail />}
          description="We'll use this to contact you"
        />
        <Input 
          floatingLabel
          label="Phone Number" 
          placeholder="+1 (555) 123-4567"
          leftIcon={<Phone />}
          required
        />
        <Input 
          floatingLabel
          label="Project Name" 
          placeholder="my-awesome-project"
          success="Name is available"
          showValidationIcon
        />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Modern floating label pattern that provides a clean, space-efficient design while maintaining accessibility.',
      },
    },
  },
};

// With comprehensive icons and states
export const WithIcons: Story = {
  render: () => (
    <div className="w-80 space-y-4">
      <Input label="Search" placeholder="Search projects..." leftIcon={<Search />} />
      <Input label="Email" placeholder="Enter your email" leftIcon={<Mail />} rightIcon={<CheckCircle className="text-green-500" />} />
      <Input 
        type="password" 
        label="Password" 
        placeholder="Enter your password" 
        leftIcon={<Lock />} 
        rightIcon={<Eye />} 
      />
      <Input 
        label="Amount" 
        placeholder="0.00" 
        leftIcon={<DollarSign />}
        helperText="Enter amount in USD"
      />
      <Input 
        label="Date" 
        type="date" 
        leftIcon={<Calendar />}
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Inputs with various icon combinations, properly sized and positioned for each input size.',
      },
    },
  },
};

// Professional developer tool patterns
export const DeveloperToolExamples: Story = {
  render: () => (
    <div className="space-y-8 max-w-4xl">
      {/* Configuration form */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-graphite-800">Project Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input 
            label="Project Name" 
            placeholder="my-awesome-project" 
            required
            helperText="Must be a valid identifier"
          />
          <Input 
            label="Version" 
            placeholder="1.0.0" 
            required
            helperText="Semantic version"
          />
          <Input 
            label="Repository URL" 
            placeholder="https://github.com/user/repo" 
            description="Git repository URL"
          />
          <Input 
            label="Build Command" 
            placeholder="npm run build" 
            description="Command to build the project"
          />
        </div>
      </div>
      
      {/* Search and filter with floating labels */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-graphite-800">Search & Filter</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input 
            floatingLabel
            label="Search fragments"
            placeholder="Search..." 
            leftIcon={<Search />}
          />
          <Input 
            floatingLabel
            label="Filter by path" 
            placeholder="api/routes.cue"
          />
          <Input 
            floatingLabel
            label="Created after" 
            type="date"
            leftIcon={<Calendar />}
          />
        </div>
      </div>
      
      {/* Validation results with enhanced states */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-graphite-800">Validation Results</h3>
        <div className="space-y-3">
          <Input 
            label="Schema Path" 
            value="schemas/user.cue" 
            success="Schema is valid and properly formatted"
            showValidationIcon
            readOnly
          />
          <Input 
            label="Fragment Path" 
            value="api/deprecated.cue" 
            warning="This file uses deprecated syntax but will still work"
            showValidationIcon
            readOnly
          />
          <Input 
            label="Invalid Fragment" 
            value="api/invalid.cue" 
            error="Syntax error on line 15: missing closing brace"
            showValidationIcon
            readOnly
          />
          <Input 
            label="Processing Fragment" 
            value="api/processing.cue"
            loading
            helperText="Validating fragment..."
            readOnly
          />
        </div>
      </div>
      
      {/* Form with mixed states */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-graphite-800">API Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input 
            floatingLabel
            label="API Base URL" 
            placeholder="https://api.example.com"
            success="URL is reachable"
            showValidationIcon
          />
          <Input 
            floatingLabel
            label="API Key" 
            type="password"
            placeholder="sk_live_..."
            leftIcon={<Lock />}
            warning="Key expires in 7 days"
            showValidationIcon
          />
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Real-world examples of inputs in developer tools: configuration forms, search interfaces, validation feedback, and API settings.',
      },
    },
  },
};

// Comprehensive disabled states
export const DisabledStates: Story = {
  render: () => (
    <div className="w-96 space-y-4">
      <Input label="Disabled Default" placeholder="This input is disabled" disabled />
      <Input 
        label="Disabled with Value" 
        value="Read-only content" 
        disabled 
        leftIcon={<User />}
      />
      <Input 
        label="Disabled Success" 
        value="Previously validated" 
        disabled 
        success="This was validated"
        showValidationIcon
      />
      <Input 
        label="Disabled Error" 
        placeholder="Disabled input" 
        disabled 
        error="This field has an error but is disabled"
        showValidationIcon
      />
      <Input 
        floatingLabel
        label="Disabled Floating" 
        value="Floating label disabled"
        disabled 
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Comprehensive disabled states showing how all variants and features behave when disabled.',
      },
    },
  },
};

// Developer-specific input patterns
export const DeveloperToolPatterns: Story = {
  render: () => (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Project Configuration</h3>
        <div className="space-y-4 p-6 bg-gray-50 rounded-lg">
          <Input
            label="Project Name"
            placeholder="e.g., ecommerce-api"
            value={storybookData.projects[0]?.name || "E-commerce API Platform"}
            leftIcon={<Code />}
            description="This name will be used in URLs and git repositories"
          />
          <Input
            label="Repository URL"
            placeholder="https://github.com/organization/repo"
            leftIcon={<GitBranch />}
            type="url"
            success="Repository verified and accessible"
            showValidationIcon
          />
          <Input
            label="Database Connection String"
            type="password"
            placeholder="postgresql://user:password@host:5432/db"
            leftIcon={<Database />}
            helperText="Connection details are encrypted and stored securely"
          />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Build Configuration</h3>
        <div className="space-y-4 p-6 bg-gray-50 rounded-lg">
          <Input
            label="Build Command"
            placeholder="npm run build"
            value="npm run build"
            leftIcon={<Terminal />}
            helperText="Command executed during the build process"
          />
          <Input
            label="Output Directory"
            placeholder="./dist"
            value="./dist"
            leftIcon={<Folder />}
            description="Directory containing build artifacts"
          />
          <Input
            label="Environment Variables"
            placeholder="NODE_ENV=production,API_URL=..."
            leftIcon={<Settings />}
            warning="Sensitive values should be added via secure environment configuration"
            showValidationIcon
          />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">API Configuration</h3>
        <div className="space-y-4 p-6 bg-gray-50 rounded-lg">
          <Input
            label="API Endpoint"
            placeholder="https://api.example.com"
            value="https://api.ecommerce-platform.com"
            leftIcon={<Globe />}
            type="url"
            success="Endpoint is reachable"
            showValidationIcon
          />
          <Input
            label="API Key"
            type="password"
            placeholder="sk_live_..."
            leftIcon={<Shield />}
            error="API key is expired"
            showValidationIcon
            description="Generate a new key in your API settings"
          />
          <Input
            label="Webhook URL"
            placeholder="https://your-app.com/webhooks"
            leftIcon={<Globe />}
            type="url"
            helperText="Endpoint for receiving real-time notifications"
          />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Search & Filters</h3>
        <div className="space-y-4 p-6 bg-gray-50 rounded-lg">
          <Input
            placeholder="Search specifications..."
            leftIcon={<Search />}
            size="lg"
            description="Search across all project specifications and requirements"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Created After"
              type="date"
              leftIcon={<Calendar />}
              size="sm"
            />
            <Input
              label="Modified Within"
              placeholder="7 days"
              leftIcon={<Clock />}
              size="sm"
              helperText="e.g., 7 days, 1 month"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Code Editor Integration</h3>
        <div className="space-y-4 p-6 bg-gray-50 rounded-lg">
          <Input
            label="File Path"
            placeholder="/specs/authentication.yml"
            value="/specs/authentication.yml"
            leftIcon={<FileText />}
            description="Relative path from project root"
          />
          <Input
            label="Git Branch"
            placeholder="feature/user-auth"
            value="main"
            leftIcon={<GitBranch />}
            success="Branch is up to date"
            showValidationIcon
          />
          <Input
            floatingLabel
            label="Commit Message"
            placeholder="Add user authentication specification"
            helperText="Describe the changes made to specifications"
          />
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: `
### Developer Tool Input Patterns

This story demonstrates how Input components are used in real developer tool scenarios with realistic data and validation patterns.

**Featured Patterns:**
- **Project Configuration**: Repository URLs, database connections, project settings
- **Build Configuration**: Commands, directories, environment variables  
- **API Configuration**: Endpoints, authentication keys, webhooks
- **Search & Filters**: Global search, date filters, time-based queries
- **Code Editor Integration**: File paths, git branches, commit messages

**Key Features:**
- Contextual icons for different input types
- Validation states with meaningful messages
- Helper text for guidance
- Security considerations for sensitive data
- Realistic placeholder text and default values
        `,
      },
    },
  },
};

// Interactive playground with all new features
export const Interactive: Story = {
  args: {
    label: 'Interactive Input',
    placeholder: 'Type something...',
    helperText: 'This is a helper text',
    size: 'md',
    variant: 'default',
    fullWidth: true,
    disabled: false,
    required: false,
    loading: false,
    showValidationIcon: true,
    floatingLabel: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Interactive playground to experiment with all enhanced input props. Use the controls panel below to test different combinations including the new features.',
      },
    },
  },
};