import type { Meta, StoryObj } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { CueViewer } from './CueViewer';
import {
  basicRequirementsCue,
  assemblySpecCue,
  validationErrorsCue,
  complexTypescriptProjectCue,
  rustMicroserviceCue,
  sampleResolvedData,
} from '../../test/cue-samples';

const meta: Meta<typeof CueViewer> = {
  title: 'Components/CUE Visualization/CueViewer',
  component: CueViewer,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
# CUE Viewer

A comprehensive CUE file viewer and editor component with syntax highlighting, validation display, and metadata analysis.

## Features

- **Monaco Editor Integration**: Full CUE syntax highlighting with custom language definition
- **Validation Display**: Visual indication of errors, warnings, and info messages with line/column details  
- **Metadata Extraction**: Automatic analysis of package, imports, definitions, and line counts
- **Multiple View Modes**: View-only, editable, and split-view with resolved data
- **Copy Functionality**: One-click copy of CUE source code
- **Responsive Design**: Adapts to different container sizes and layouts

## View Modes

- **View**: Read-only display with syntax highlighting
- **Edit**: Interactive editor with change callbacks
- **Split**: Side-by-side CUE source and resolved data comparison

## Validation Features

The viewer can display validation results from CUE's type checker, including:
- Type unification errors
- Constraint violations  
- Missing required fields
- Pattern matching failures
- Range validation errors

## Use Cases

1. **Code Review**: Display CUE specifications for team review
2. **Interactive Editing**: Allow users to modify CUE files with real-time validation
3. **Documentation**: Present CUE schemas and examples in documentation
4. **Debugging**: Identify and fix validation errors with detailed error messages
5. **Learning**: Educational tool for understanding CUE syntax and concepts
        `,
      },
    },
  },
  argTypes: {
    mode: {
      control: 'select',
      options: ['view', 'edit', 'split'],
      description: 'Display mode for the viewer',
    },
    editable: {
      control: 'boolean',
      description: 'Whether the CUE content can be edited',
    },
    showLineNumbers: {
      control: 'boolean',
      description: 'Show line numbers in the editor',
    },
    showCopyButton: {
      control: 'boolean',
      description: 'Show copy to clipboard button',
    },
    onChange: {
      action: 'content-changed',
      description: 'Callback when content changes in edit mode',
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof CueViewer>;

/**
 * Basic requirements specification showing security, performance, and compliance requirements.
 * Demonstrates clean CUE syntax with nested structures and constraints.
 */
export const Requirements: Story = {
  args: {
    title: 'Authentication Requirements',
    cueSource: basicRequirementsCue,
    mode: 'view',
    showLineNumbers: true,
    showCopyButton: true,
  },
};

/**
 * Complex microservices assembly specification with infrastructure configuration.
 * Shows advanced CUE features like imports, complex data structures, and service definitions.
 */
export const Assembly: Story = {
  args: {
    title: 'Microservices Assembly',
    cueSource: assemblySpecCue,
    mode: 'view',
    showLineNumbers: true,
    showCopyButton: true,
  },
};

/**
 * CUE file with intentional validation errors to demonstrate error handling.
 * Shows how validation errors are displayed with line numbers and detailed messages.
 */
export const ValidationErrors: Story = {
  args: {
    title: 'CUE Validation Errors Demo',
    cueSource: validationErrorsCue,
    mode: 'view',
    showLineNumbers: true,
    showCopyButton: true,
    validationErrors: [
      {
        line: 6,
        column: 10,
        message: 'Cannot unify int 12345 and string "user123"',
        severity: 'error',
      },
      {
        line: 9,
        column: 6,
        message: 'Value 150 exceeds maximum allowed age of 120',
        severity: 'error',
      },
      {
        line: 23,
        column: 1,
        message: 'Missing required field "email"',
        severity: 'error',
      },
      {
        line: 24,
        column: 1,
        message: 'Missing required field "age"',
        severity: 'error',
      },
      {
        line: 30,
        column: 15,
        message: 'Cannot unify string and int 12345',
        severity: 'error',
      },
      {
        line: 34,
        column: 10,
        message: 'String "invalid-email" does not match email pattern',
        severity: 'warning',
      },
      {
        line: 38,
        column: 9,
        message: 'Value -50 is below minimum allowed value 0',
        severity: 'error',
      },
      {
        line: 62,
        column: 14,
        message: '"unknown" is not in the list of valid statuses',
        severity: 'info',
      },
    ],
  },
};

/**
 * Advanced TypeScript project specification with performance requirements and complex architecture.
 * Demonstrates CUE's ability to handle large, complex configuration files.
 */
export const TypeScriptProject: Story = {
  args: {
    title: 'Advanced TypeScript Project',
    cueSource: complexTypescriptProjectCue,
    mode: 'view',
    showLineNumbers: true,
    showCopyButton: true,
  },
};

/**
 * High-performance Rust microservice with ultra-low latency requirements.
 * Shows CUE specifications for systems programming and performance-critical applications.
 */
export const RustMicroservice: Story = {
  args: {
    title: 'High-Performance Rust Service',
    cueSource: rustMicroserviceCue,
    mode: 'view',
    showLineNumbers: true,
    showCopyButton: true,
  },
};

/**
 * Editable CUE viewer where users can modify the content.
 * Includes change callback to demonstrate interactive editing capabilities.
 */
export const Editable: Story = {
  args: {
    title: 'Editable CUE Specification',
    cueSource: basicRequirementsCue,
    mode: 'edit',
    editable: true,
    showLineNumbers: true,
    showCopyButton: true,
    onChange: action('content-changed'),
  },
};

/**
 * Split view showing CUE source code alongside resolved data.
 * Demonstrates how CUE specifications are processed and their output.
 */
export const SplitView: Story = {
  args: {
    title: 'CUE Source + Resolved Data',
    cueSource: assemblySpecCue,
    mode: 'split',
    showLineNumbers: true,
    showCopyButton: true,
    resolvedData: sampleResolvedData.resolved,
  },
};

/**
 * Minimal viewer without extra controls, suitable for embedding in other components.
 */
export const Minimal: Story = {
  args: {
    cueSource: `// Simple CUE example
package example

// User configuration
user: {
    name: "John Doe"
    age: 30
    email: "john@example.com"
}

// API configuration  
api: {
    host: "localhost"
    port: 8080
    timeout: 30
}`,
    mode: 'view',
    showLineNumbers: false,
    showCopyButton: false,
  },
};

/**
 * Compact version with reduced height, suitable for dashboard widgets or previews.
 */
export const Compact: Story = {
  args: {
    title: 'Compact CUE Viewer',
    cueSource: `package config

database: {
    host: "localhost"
    port: 5432
    name: "app_db"
    pool_size: 10
}

redis: {
    url: "redis://localhost:6379"
    timeout: 5000
}`,
    mode: 'view',
    showLineNumbers: true,
    showCopyButton: true,
    className: 'max-w-2xl',
  },
};

/**
 * Large display optimized for presentations or detailed code review.
 * Shows the full assembly specification with maximum visibility.
 */
export const LargeDisplay: Story = {
  args: {
    title: 'Large Display - Assembly Specification',
    cueSource: assemblySpecCue,
    mode: 'view',
    showLineNumbers: true,
    showCopyButton: true,
    className: 'text-lg',
  },
  parameters: {
    viewport: {
      viewports: {
        largeDesktop: {
          name: 'Large Desktop',
          styles: {
            width: '1440px',
            height: '900px',
          },
        },
      },
      defaultViewport: 'largeDesktop',
    },
  },
};

/**
 * Dark theme variant for night mode or developer preferences.
 */
export const DarkTheme: Story = {
  args: {
    title: 'Dark Theme CUE Viewer',
    cueSource: complexTypescriptProjectCue,
    mode: 'view',
    showLineNumbers: true,
    showCopyButton: true,
  },
  parameters: {
    backgrounds: {
      default: 'dark',
      values: [{ name: 'dark', value: '#1a1a1a' }],
    },
  },
};
