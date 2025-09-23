import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { DataViewer } from './DataViewer';
import { MermaidRenderer } from './MermaidRenderer';
import { NetworkDiagram } from './NetworkDiagram';
import { SplitViewShowcase } from './SplitViewShowcase';

const meta = {
  title: 'Diagrams/Complete Diagram Showcase',
  component: SplitViewShowcase,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof SplitViewShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// COMPREHENSIVE DIAGRAM OVERVIEW
// ============================================================================

const DiagramTypesOverview: React.FC = () => {
  return (
    <div className="bg-white p-6 rounded-lg space-y-6">
      <div className="text-center mb-8">
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          Interactive Diagram Visualization Types
        </h3>
        <p className="text-gray-600">
          Transform YAML/JSON specifications into beautiful, interactive diagrams
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Flow Diagrams */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <h4 className="font-semibold text-gray-900">Flow Diagrams</h4>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            Process flows, build pipelines, data processing workflows
          </p>
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span>• CI/CD Pipelines</span>
              <span className="text-green-600">✓ Available</span>
            </div>
            <div className="flex justify-between">
              <span>• Data Processing</span>
              <span className="text-green-600">✓ Available</span>
            </div>
            <div className="flex justify-between">
              <span>• Testing Workflows</span>
              <span className="text-green-600">✓ Available</span>
            </div>
          </div>
        </div>

        {/* State Machines */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-4 h-4 bg-purple-500 rounded"></div>
            <h4 className="font-semibold text-gray-900">State Machines</h4>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            Application states, user flows, system behavior
          </p>
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span>• Order Processing</span>
              <span className="text-green-600">✓ Available</span>
            </div>
            <div className="flex justify-between">
              <span>• User Authentication</span>
              <span className="text-green-600">✓ Available</span>
            </div>
            <div className="flex justify-between">
              <span>• Game Sessions</span>
              <span className="text-green-600">✓ Available</span>
            </div>
          </div>
        </div>

        {/* Architecture Diagrams */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <h4 className="font-semibold text-gray-900">Architecture</h4>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            System architecture, microservices, cloud infrastructure
          </p>
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span>• Microservices</span>
              <span className="text-green-600">✓ Available</span>
            </div>
            <div className="flex justify-between">
              <span>• Cloud Native</span>
              <span className="text-green-600">✓ Available</span>
            </div>
            <div className="flex justify-between">
              <span>• Serverless</span>
              <span className="text-green-600">✓ Available</span>
            </div>
          </div>
        </div>

        {/* Gap Analysis */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-4 h-4 bg-orange-500 rounded"></div>
            <h4 className="font-semibold text-gray-900">Gap Analysis</h4>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            Coverage analysis, compliance gaps, quality metrics
          </p>
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span>• Test Coverage</span>
              <span className="text-green-600">✓ Available</span>
            </div>
            <div className="flex justify-between">
              <span>• Security Compliance</span>
              <span className="text-green-600">✓ Available</span>
            </div>
            <div className="flex justify-between">
              <span>• API Coverage</span>
              <span className="text-green-600">✓ Available</span>
            </div>
          </div>
        </div>
      </div>

      {/* Technical Features */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <h4 className="font-semibold text-gray-900 mb-4">Technical Features</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-2">
              <span className="text-blue-600 font-bold">📊</span>
            </div>
            <span className="font-medium">Mermaid.js</span>
            <p className="text-xs text-gray-600">Flowcharts & State diagrams</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-2">
              <span className="text-green-600 font-bold">🕸️</span>
            </div>
            <span className="font-medium">Vis.js Network</span>
            <p className="text-xs text-gray-600">Interactive networks</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-2">
              <span className="text-purple-600 font-bold">🎨</span>
            </div>
            <span className="font-medium">D3.js</span>
            <p className="text-xs text-gray-600">Custom visualizations</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mx-auto mb-2">
              <span className="text-orange-600 font-bold">⚡</span>
            </div>
            <span className="font-medium">Real-time</span>
            <p className="text-xs text-gray-600">Live data updates</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const quickStartGuideYaml = `# Quick Start Guide - Diagram Visualization
name: "Developer Tool Diagram Integration"
version: "1.0.0"

# Overview
description: |
  Transform your YAML/JSON specifications into interactive diagrams
  Perfect for developer tools, documentation, and system visualization

# Supported Diagram Types
diagram_types:
  flow_diagrams:
    use_cases:
      - "CI/CD pipeline visualization"
      - "Data processing workflows"
      - "Business process flows"
      - "Testing workflows"
    input_format: "YAML pipeline specification"
    output: "Interactive Mermaid flowchart"
    
  state_machines:
    use_cases:
      - "Application state management"
      - "User authentication flows"
      - "Order processing states"
      - "Game session management"
    input_format: "State machine YAML/JSON"
    output: "Mermaid state diagram"
    
  architecture_diagrams:
    use_cases:
      - "Microservices architecture"
      - "Cloud infrastructure"
      - "Service dependencies"
      - "Network topologies"
    input_format: "Architecture specification"
    output: "Network diagram or Mermaid graph"
    
  gap_analysis:
    use_cases:
      - "Test coverage analysis"
      - "Security compliance gaps"
      - "API coverage metrics"
      - "Quality assurance tracking"
    input_format: "Analysis results YAML"
    output: "Custom gap visualization"

# Integration Examples
integration_patterns:
  developer_tools:
    - name: "Code Editor Extensions"
      description: "Live diagram preview in IDE"
      implementation: "Monaco Editor + diagram renderer"
      
    - name: "Documentation Sites"
      description: "Interactive spec documentation"
      implementation: "Storybook + split view"
      
    - name: "CI/CD Dashboards"
      description: "Pipeline visualization"
      implementation: "Real-time updates via WebSocket"
      
  api_integration:
    - endpoint: "/api/diagrams/render"
      method: "POST"
      input: "YAML/JSON specification"
      output: "SVG/interactive diagram"
      
    - endpoint: "/api/diagrams/templates"
      method: "GET"
      description: "Available diagram templates"
      
# Configuration Options
rendering_options:
  themes:
    - "default"
    - "dark"
    - "high-contrast"
    - "custom"
    
  export_formats:
    - "SVG"
    - "PNG"
    - "PDF"
    - "Interactive HTML"
    
  customization:
    colors: "Brand-specific color schemes"
    fonts: "Custom typography"
    layouts: "Different arrangement algorithms"
    interactions: "Click handlers and tooltips"

# Performance Considerations
performance:
  rendering_time:
    small_diagrams: "< 100ms"
    medium_diagrams: "< 500ms"
    large_diagrams: "< 2s"
    
  optimization_tips:
    - "Use lazy loading for large diagram sets"
    - "Implement viewport-based rendering"
    - "Cache rendered diagrams"
    - "Use WebWorkers for complex processing"

# Best Practices
best_practices:
  data_structure:
    - "Keep YAML specifications clean and well-structured"
    - "Use meaningful names and labels"
    - "Include metadata for better rendering"
    
  user_experience:
    - "Provide loading states during rendering"
    - "Include error handling with helpful messages"
    - "Allow zoom and pan for large diagrams"
    - "Implement responsive layouts"
    
  maintenance:
    - "Version control diagram specifications"
    - "Document custom rendering logic"
    - "Monitor rendering performance"
    - "Keep diagram libraries updated"`;

const combinedVisualization = `graph TB
    subgraph "Data Sources"
        YAML[📄 YAML Specs<br/>Pipeline Configs]
        JSON[📄 JSON Data<br/>API Responses]  
        CONFIG[⚙️ Configuration<br/>System Settings]
    end
    
    subgraph "Processing Layer"
        PARSER[🔍 Data Parser<br/>YAML/JSON Processing]
        VALIDATOR[✅ Schema Validator<br/>Specification Validation]
        TRANSFORMER[🔄 Data Transformer<br/>Diagram-specific Format]
    end
    
    subgraph "Rendering Engines"
        MERMAID[🌊 Mermaid Renderer<br/>Flowcharts & State Machines]
        VIS[🕸️ Vis.js Network<br/>Interactive Networks]
        D3[📊 D3.js Custom<br/>Gap Analysis Charts]
        CANVAS[🎨 Canvas Renderer<br/>Custom Visualizations]
    end
    
    subgraph "Interactive Features"
        ZOOM[🔍 Zoom & Pan<br/>Navigation Controls]
        TOOLTIP[💭 Tooltips<br/>Context Information]
        EXPORT[💾 Export Options<br/>SVG, PNG, PDF]
        REALTIME[⚡ Real-time Updates<br/>Live Data Sync]
    end
    
    subgraph "Output Formats"
        SVG[🖼️ SVG Graphics<br/>Scalable Vector]
        INTERACTIVE[🖱️ Interactive HTML<br/>Full Interactivity]
        STATIC[📷 Static Images<br/>PNG, JPG, PDF]
        EMBED[📦 Embeddable<br/>Iframe, Web Components]
    end
    
    %% Data flow
    YAML --> PARSER
    JSON --> PARSER
    CONFIG --> PARSER
    
    PARSER --> VALIDATOR
    VALIDATOR --> TRANSFORMER
    
    TRANSFORMER --> MERMAID
    TRANSFORMER --> VIS
    TRANSFORMER --> D3
    TRANSFORMER --> CANVAS
    
    MERMAID --> ZOOM
    VIS --> ZOOM
    D3 --> TOOLTIP
    CANVAS --> EXPORT
    
    ZOOM --> SVG
    TOOLTIP --> INTERACTIVE
    EXPORT --> STATIC
    REALTIME --> EMBED
    
    %% Styling
    classDef source fill:#e1f5fe,stroke:#01579b
    classDef process fill:#f3e5f5,stroke:#4a148c
    classDef render fill:#e8f5e8,stroke:#1b5e20
    classDef feature fill:#fff3e0,stroke:#e65100
    classDef output fill:#fce4ec,stroke:#880e4f
    
    class YAML,JSON,CONFIG source
    class PARSER,VALIDATOR,TRANSFORMER process
    class MERMAID,VIS,D3,CANVAS render
    class ZOOM,TOOLTIP,EXPORT,REALTIME feature
    class SVG,INTERACTIVE,STATIC,EMBED output`;

// ============================================================================
// STORY DEFINITIONS
// ============================================================================

export const DiagramShowcaseOverview: Story = {
  args: {
    title: 'Complete Diagram Visualization Platform',
    description:
      'Comprehensive overview of all available diagram types and technical capabilities for developer tools.',
    dataPanelTitle: 'Integration Guide (YAML)',
    diagramPanelTitle: 'Available Diagram Types',
    dataPanel: (
      <DataViewer data={quickStartGuideYaml} language="yaml" title="diagram-platform-guide.yml" />
    ),
    diagramPanel: <DiagramTypesOverview />,
  },
};

export const TechnicalArchitectureOverview: Story = {
  args: {
    title: 'Diagram Rendering Architecture',
    description:
      'Technical architecture showing how YAML/JSON specifications are transformed into interactive diagrams.',
    dataPanelTitle: 'Architecture Overview (YAML)',
    diagramPanelTitle: 'Rendering Pipeline Flow',
    dataPanel: (
      <DataViewer
        data={`# Diagram Rendering Architecture
name: "Interactive Diagram Platform"
version: "2.0.0"

# Core Components
architecture:
  input_layer:
    - "YAML specification parser"
    - "JSON data processor"
    - "Schema validation engine"
    
  processing_layer:
    - "Data transformation pipeline"
    - "Diagram type detection"
    - "Layout algorithm selection"
    
  rendering_layer:
    - "Mermaid.js integration"
    - "Vis.js network renderer"  
    - "D3.js custom visualizations"
    - "Canvas-based rendering"
    
  output_layer:
    - "Interactive SVG generation"
    - "Static image export"
    - "Embeddable components"
    - "Real-time updates"

# Performance Characteristics
performance:
  parsing: "< 50ms for typical specifications"
  rendering: "< 200ms for standard diagrams"
  export: "< 1s for high-resolution outputs"
  memory: "< 50MB for complex visualizations"

# Scalability Features  
scalability:
  lazy_loading: "On-demand diagram rendering"
  caching: "Intelligent diagram caching"
  streaming: "Progressive loading for large datasets"
  workers: "Background processing for complex layouts"`}
        language="yaml"
        title="rendering-architecture.yml"
      />
    ),
    diagramPanel: (
      <MermaidRenderer chart={combinedVisualization} title="Diagram Rendering Pipeline" />
    ),
  },
};
