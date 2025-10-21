import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { Card } from "../../design-system/components/Card";
import {
  assemblySpecCue,
  basicRequirementsCue,
  sampleResolvedData,
  validationErrorsCue,
} from "../../test/cue-samples";
import { MonacoEditor } from "../Editor/MonacoEditor";
import { CueShowcase } from "./CueShowcase";
import { CueViewer } from "./CueViewer";
import { DataViewer } from "./DataViewer";

const meta: Meta = {
  title: "Components/CUE Visualization/Overview",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: `
# CUE Visualization System Overview

The Arbiter frontend provides a comprehensive suite of components for visualizing, editing, and managing CUE (Configure, Unify, Execute) files. This overview demonstrates the complete ecosystem of CUE-related components and their integration.

## Component Architecture

### 1. CueShowcase
- **Purpose**: Complete demonstration and selection interface
- **Features**: Multiple examples, interactive navigation, view mode switching
- **Use Case**: Main entry point for CUE file exploration and presentation

### 2. CueViewer  
- **Purpose**: Individual CUE file visualization and editing
- **Features**: Monaco Editor integration, validation display, metadata extraction
- **Use Case**: Focused work on specific CUE files with full editing capabilities

### 3. DataViewer
- **Purpose**: Multi-language data display with syntax highlighting
- **Features**: CUE, JSON, YAML, TypeScript, JavaScript support
- **Use Case**: Display various data formats with consistent styling

### 4. Monaco Editor Integration
- **Purpose**: Advanced code editing with CUE language support
- **Features**: Custom CUE tokenizer, auto-completion, hover documentation
- **Use Case**: Professional-grade editing experience for CUE files

## CUE Language Features Supported

### Syntax Highlighting
- Keywords: \`package\`, \`import\`, \`if\`, \`for\`, \`in\`, \`let\`
- Built-in types: \`string\`, \`int\`, \`float\`, \`bool\`, \`bytes\`
- Operators: \`and\`, \`or\`, \`div\`, \`mod\`, \`quo\`, \`rem\`
- Field references and constraints
- Comments and string literals

### Validation Display
- Type unification errors
- Constraint violations
- Missing required fields
- Pattern matching failures
- Range validation errors

### Metadata Extraction
- Package declarations
- Import statements
- Definition counting
- Line and comment statistics

## Integration with Arbiter Platform

The CUE visualization system integrates with:
- **Specification Engine**: Real-time validation and resolution
- **Project Management**: File organization and version control  
- **API Layer**: Fetching and storing CUE specifications
- **Design System**: Consistent UI patterns and theming

## Use Cases in Production

1. **Requirements Engineering**: Define and visualize system requirements
2. **Configuration Management**: Manage complex application configurations
3. **API Specifications**: Document and validate API contracts
4. **Infrastructure as Code**: Define deployment and infrastructure specs
5. **Policy Definition**: Codify business rules and compliance requirements

## Performance Considerations

- **Syntax Highlighting**: Client-side processing for responsive experience
- **Large Files**: Virtual scrolling and lazy loading for performance
- **Real-time Validation**: Debounced validation to avoid excessive processing
- **Memory Management**: Efficient Monaco Editor usage and cleanup

This comprehensive system provides a production-ready solution for CUE file management in web applications, with particular focus on developer experience and visual clarity.
        `,
      },
    },
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj;

const OverviewDemo = () => {
  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">CUE Visualization System</h1>
        <p className="text-gray-600 text-lg">
          Complete overview of CUE file visualization, editing, and management components in the
          Arbiter frontend.
        </p>
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="p-4 text-center">
          <div className="text-2xl mb-2">📋</div>
          <h3 className="font-semibold text-sm">Requirements</h3>
          <p className="text-xs text-gray-600">Security, performance, compliance</p>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl mb-2">🏗️</div>
          <h3 className="font-semibold text-sm">Assembly</h3>
          <p className="text-xs text-gray-600">Microservices architecture</p>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl mb-2">⚠️</div>
          <h3 className="font-semibold text-sm">Validation</h3>
          <p className="text-xs text-gray-600">Error detection and display</p>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl mb-2">⚡</div>
          <h3 className="font-semibold text-sm">Performance</h3>
          <p className="text-xs text-gray-600">High-performance services</p>
        </Card>
      </div>

      {/* Main Showcase */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Interactive CUE Showcase</h2>
        <Card className="p-0">
          <CueShowcase />
        </Card>
      </div>

      {/* Component Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div>
          <h3 className="text-xl font-semibold text-gray-900 mb-4">CUE Editor with Validation</h3>
          <Card>
            <CueViewer
              title="Requirements with Validation Errors"
              cueSource={validationErrorsCue}
              validationErrors={[
                {
                  line: 6,
                  column: 10,
                  message: 'Cannot unify int 12345 and string "user123"',
                  severity: "error",
                },
                {
                  line: 34,
                  column: 10,
                  message: "Invalid email format",
                  severity: "warning",
                },
                {
                  line: 62,
                  column: 14,
                  message: "Unknown status value",
                  severity: "info",
                },
              ]}
              mode="view"
              className="h-64"
            />
          </Card>
        </div>

        <div>
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Resolved Data Output</h3>
          <Card>
            <DataViewer
              title="Resolved Specification"
              data={sampleResolvedData}
              language="json"
              className="h-64"
            />
          </Card>
        </div>
      </div>

      {/* Monaco Editor Integration */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">
          Advanced Monaco Editor Integration
        </h3>
        <Card>
          <div className="h-64">
            <MonacoEditor
              value={basicRequirementsCue}
              onChange={() => {}}
              language="cue"
              theme="cue-light"
              options={{
                lineNumbers: "on",
                minimap: { enabled: true, scale: 0.5 },
                scrollBeyondLastLine: false,
                readOnly: true,
                wordWrap: "on",
              }}
            />
          </div>
        </Card>
      </div>

      {/* Language Support Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div>
          <h4 className="font-semibold text-gray-900 mb-2">CUE Specification</h4>
          <Card>
            <DataViewer
              data={`package example

user: {
    name: "John Doe"
    age: 30 & >=18 & <=120
    email: =~"^[a-z]+@[a-z]+\\.[a-z]+$"
}

config: {
    timeout: 30
    retries: 3
}`}
              language="cue"
              showCopyButton={false}
              className="h-32"
            />
          </Card>
        </div>

        <div>
          <h4 className="font-semibold text-gray-900 mb-2">Resolved JSON</h4>
          <Card>
            <DataViewer
              data={{
                user: {
                  name: "John Doe",
                  age: 30,
                  email: "john@example.com",
                },
                config: {
                  timeout: 30,
                  retries: 3,
                },
              }}
              language="json"
              showCopyButton={false}
              className="h-32"
            />
          </Card>
        </div>

        <div>
          <h4 className="font-semibold text-gray-900 mb-2">YAML Output</h4>
          <Card>
            <DataViewer
              data={`user:
  name: "John Doe"
  age: 30
  email: "john@example.com"
config:
  timeout: 30
  retries: 3`}
              language="yaml"
              showCopyButton={false}
              className="h-32"
            />
          </Card>
        </div>
      </div>

      {/* Technical Features */}
      <div>
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Technical Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-4">
            <h4 className="font-semibold text-gray-900 mb-3">Syntax Highlighting</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Custom CUE language definition for Monaco</li>
              <li>• Keywords, types, and operator highlighting</li>
              <li>• Comment and string literal support</li>
              <li>• Field reference and constraint visualization</li>
              <li>• Multi-language support (CUE, JSON, YAML, TS, JS)</li>
            </ul>
          </Card>

          <Card className="p-4">
            <h4 className="font-semibold text-gray-900 mb-3">Validation & Error Display</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Real-time validation error display</li>
              <li>• Line and column error positioning</li>
              <li>• Severity levels (error, warning, info)</li>
              <li>• Expandable error detail panels</li>
              <li>• Integration with CUE type checker</li>
            </ul>
          </Card>

          <Card className="p-4">
            <h4 className="font-semibold text-gray-900 mb-3">Metadata Extraction</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Automatic package detection</li>
              <li>• Import statement counting</li>
              <li>• Definition and line statistics</li>
              <li>• Comment analysis</li>
              <li>• File structure overview</li>
            </ul>
          </Card>

          <Card className="p-4">
            <h4 className="font-semibold text-gray-900 mb-3">Interactive Features</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Copy to clipboard functionality</li>
              <li>• Multiple view modes (view, edit, split)</li>
              <li>• Responsive design and layouts</li>
              <li>• Keyboard shortcuts and navigation</li>
              <li>• Integration with design system</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
};

/**
 * Complete overview of the CUE visualization system showing all components and their capabilities.
 * This story demonstrates the integration between different visualization components and their use cases.
 */
export const CompleteOverview: Story = {
  render: () => <OverviewDemo />,
};

/**
 * Focused demonstration of CUE syntax highlighting capabilities across different languages and formats.
 */
export const SyntaxHighlightingDemo: Story = {
  render: () => (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold text-gray-900">CUE Syntax Highlighting Comparison</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <DataViewer
            title="CUE Requirements Specification"
            data={basicRequirementsCue}
            language="cue"
          />
        </Card>

        <Card>
          <DataViewer title="Assembly Configuration" data={assemblySpecCue} language="cue" />
        </Card>
      </div>
    </div>
  ),
};

/**
 * Demonstrates validation error handling and display across different error types and severity levels.
 */
export const ValidationDemo: Story = {
  render: () => (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold text-gray-900">CUE Validation Error Display</h1>

      <Card>
        <CueViewer
          title="CUE File with Multiple Validation Errors"
          cueSource={validationErrorsCue}
          validationErrors={[
            {
              line: 6,
              column: 10,
              message: 'Cannot unify int 12345 and string "user123" - conflicting types',
              severity: "error",
            },
            {
              line: 9,
              column: 6,
              message: "Value 150 exceeds maximum allowed age of 120",
              severity: "error",
            },
            {
              line: 23,
              column: 1,
              message: 'Missing required field "email" in user specification',
              severity: "error",
            },
            {
              line: 30,
              column: 15,
              message: "Cannot unify string constraint with int value 12345",
              severity: "error",
            },
            {
              line: 34,
              column: 10,
              message: 'String "invalid-email" does not match email pattern regex',
              severity: "warning",
            },
            {
              line: 38,
              column: 9,
              message: "Value -50 is below minimum allowed value 0 for score field",
              severity: "error",
            },
            {
              line: 52,
              column: 12,
              message: '"PATCH" is not in allowed methods list ["GET", "POST", "PUT", "DELETE"]',
              severity: "error",
            },
            {
              line: 62,
              column: 14,
              message:
                '"unknown" is not in valid status values ["active", "inactive", "pending", "suspended"]',
              severity: "info",
            },
          ]}
          mode="view"
        />
      </Card>
    </div>
  ),
};

/**
 * Side-by-side comparison of CUE source and resolved data output.
 */
export const SourceVsResolvedDemo: Story = {
  render: () => (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold text-gray-900">CUE Source vs Resolved Data</h1>

      <Card>
        <CueViewer
          title="CUE Assembly Specification - Split View"
          cueSource={assemblySpecCue}
          resolvedData={sampleResolvedData.resolved}
          mode="split"
        />
      </Card>
    </div>
  ),
};
