/**
 * Data constants for DiagramShowcase stories.
 * Extracted to reduce file complexity.
 */

/** Quick start guide YAML content */
export const quickStartGuideYaml = `# Quick Start Guide - Diagram Visualization
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

  processes:
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

/** Combined visualization Mermaid diagram */
export const combinedVisualization = `graph TB
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

/** Rendering architecture YAML */
export const renderingArchitectureYaml = `# Diagram Rendering Architecture
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
  workers: "Background processing for complex layouts"`;

/** Diagram type definitions for the overview component */
export const diagramTypes = [
  {
    id: "flow",
    title: "Flow Diagrams",
    color: "bg-blue-500",
    description: "Process flows, build pipelines, data processing workflows",
    features: [
      { name: "CI/CD Pipelines", available: true },
      { name: "Data Processing", available: true },
      { name: "Testing Workflows", available: true },
    ],
  },
  {
    id: "state",
    title: "State Machines",
    color: "bg-purple-500",
    description: "Application states, user flows, system behavior",
    features: [
      { name: "Order Processing", available: true },
      { name: "User Authentication", available: true },
      { name: "Game Sessions", available: true },
    ],
  },
  {
    id: "architecture",
    title: "Architecture",
    color: "bg-green-500",
    description: "System architecture, microservices, cloud infrastructure",
    features: [
      { name: "Microservices", available: true },
      { name: "Cloud Native", available: true },
      { name: "Serverless", available: true },
    ],
  },
  {
    id: "gap",
    title: "Gap Analysis",
    color: "bg-orange-500",
    description: "Coverage analysis, compliance gaps, quality metrics",
    features: [
      { name: "Test Coverage", available: true },
      { name: "Security Compliance", available: true },
      { name: "API Coverage", available: true },
    ],
  },
];

/** Technical features for the overview component */
export const technicalFeatures = [
  { name: "Mermaid.js", description: "Flowcharts & State diagrams", icon: "📊", color: "blue" },
  { name: "Vis.js Network", description: "Interactive networks", icon: "🕸️", color: "green" },
  { name: "D3.js", description: "Custom visualizations", icon: "🎨", color: "purple" },
  { name: "Real-time", description: "Live data updates", icon: "⚡", color: "orange" },
];
