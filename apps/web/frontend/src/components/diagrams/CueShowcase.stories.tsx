import type { Meta, StoryObj } from '@storybook/react';
import { CueShowcase } from './CueShowcase';

const meta: Meta<typeof CueShowcase> = {
  title: 'Components/CUE Visualization/CueShowcase',
  component: CueShowcase,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
# CUE Showcase

The CueShowcase component provides a comprehensive demonstration of CUE file visualization capabilities in the Arbiter frontend.

## Features

- **Multiple CUE Examples**: Requirements, assembly specs, validation errors, TypeScript projects, and Rust services
- **Interactive Visualization**: Switch between overview, source code, resolved data, and split views
- **Syntax Highlighting**: Full CUE syntax highlighting with Monaco Editor
- **Validation Display**: Visual indication of validation errors, warnings, and info messages
- **Metadata Analysis**: Automatic extraction of package info, imports, definitions, and line counts
- **Resolved Data**: Side-by-side comparison of CUE source and resolved JSON output

## Use Cases

1. **Requirements Engineering**: Visualize security, performance, and compliance requirements
2. **System Assembly**: Review microservices architecture and deployment specifications
3. **Validation & Debugging**: Identify and fix CUE validation errors with detailed error messages
4. **Project Documentation**: Present complex project specifications in an interactive format
5. **Service Configuration**: Display high-performance service configurations with metadata

## Technical Integration

The showcase integrates with:
- Monaco Editor for syntax highlighting and editing
- Design system components for consistent UI
- Validation engine for error detection
- Resolution engine for CUE evaluation

This component serves as both a demonstration tool and a production-ready interface for CUE file management in the Arbiter platform.
        `,
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof CueShowcase>;

/**
 * Default showcase with all CUE examples available.
 * Users can navigate between different types of CUE files and view modes.
 */
export const Default: Story = {
  args: {},
};

/**
 * Full-screen showcase for presentations and detailed review.
 * Optimized for larger displays and comprehensive examination of CUE files.
 */
export const FullScreen: Story = {
  args: {},
  parameters: {
    layout: 'fullscreen',
    viewport: {
      viewports: {
        fullHD: {
          name: 'Full HD',
          styles: {
            width: '1920px',
            height: '1080px',
          },
        },
      },
      defaultViewport: 'fullHD',
    },
  },
};

/**
 * Compact version suitable for dashboard integration or smaller containers.
 */
export const Compact: Story = {
  args: {
    className: 'max-w-4xl mx-auto',
  },
  parameters: {
    viewport: {
      viewports: {
        tablet: {
          name: 'Tablet',
          styles: {
            width: '768px',
            height: '1024px',
          },
        },
      },
      defaultViewport: 'tablet',
    },
  },
};
