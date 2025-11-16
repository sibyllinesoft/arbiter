/**
 * Architecture diagram types for CUE-driven diagram generation
 */

// Base architectural elements that can be extracted from CUE
export interface ArchitecturalElement {
  id: string;
  name: string;
  type: ElementType;
  description?: string;
  metadata?: Record<string, any>;
}

export type ElementType =
  | "service"
  | "component"
  | "route"
  | "flow"
  | "capability"
  | "state_machine"
  | "api_endpoint"
  | "external_system"
  | "data_store";

// Enhanced component model for diagram rendering
export interface DiagramComponent extends ArchitecturalElement {
  // Visual properties
  position: { x: number; y: number };
  size: { width: number; height: number };
  layer: DiagramLayer;

  // Technical details from CUE
  technology?: string;
  language?: string;
  framework?: string[];

  // Connection points
  ports?: DiagramPort[];

  // From CUE services
  serviceType?: "bespoke" | "prebuilt" | "external";
  deploymentType?: "deployment" | "statefulset" | "daemonset";
  replicas?: number;

  // From UI routes
  routePath?: string;
  capabilities?: string[];

  // From flows
  flowSteps?: FlowStep[];

  // From state machines
  states?: Record<string, any>;
  transitions?: Record<string, string>;
}

export interface DiagramPort {
  id: string;
  position: { x: number; y: number };
  type: "input" | "output" | "bidirectional";
  protocol?: "http" | "websocket" | "grpc" | "database";
}

export type DiagramLayer =
  | "presentation" // UI routes, components
  | "application" // Flows, business logic
  | "service" // Services, APIs
  | "data" // Databases, storage
  | "external"; // External systems

// Connection types derived from CUE relationships
export interface DiagramConnection {
  id: string;
  from: { componentId: string; portId?: string };
  to: { componentId: string; portId?: string };
  type: ConnectionType;
  label?: string;
  metadata?: {
    // From flows
    userAction?: string;
    expectation?: any;

    // From API paths
    method?: string;
    path?: string;

    // From capabilities
    capability?: string;

    // From dependencies
    dependsOn?: string[];
  };
}

export type ConnectionType =
  | "user_navigation" // UI route navigation
  | "user_interaction" // Flow steps (click, fill, etc.)
  | "api_call" // HTTP requests to services
  | "capability_usage" // Capability dependencies
  | "state_transition" // State machine transitions
  | "data_flow" // Data passing between components
  | "dependency"; // Service dependencies

// Flow analysis for generating connections
export interface FlowStep {
  id: string;
  type: "visit" | "click" | "fill" | "expect" | "expect_api";
  target?: string;
  value?: string;
  expectation?: any;
}

// Layout configuration for different diagram types
export interface DiagramLayout {
  type: "layered" | "force_directed" | "hierarchical" | "circular";
  direction: "top_down" | "left_right" | "bottom_up" | "right_left";
  spacing: {
    component: { x: number; y: number };
    layer: number;
  };
  layers: DiagramLayer[];
}

// Complete diagram specification
export interface ArchitectureDiagram {
  id: string;
  name: string;
  description?: string;
  type: DiagramType;

  // Generated from CUE
  components: DiagramComponent[];
  connections: DiagramConnection[];

  // Visual configuration
  layout: DiagramLayout;
  viewport: { width: number; height: number };

  // Metadata about generation
  generatedFrom: {
    cuePath: string;
    timestamp: string;
    schemaVersion: "v1" | "v2";
  };

  // Interactive features
  interactivity?: {
    clickableComponents: boolean;
    hoverDetails: boolean;
    zoomPan: boolean;
    layerToggle: boolean;
  };
}

export type DiagramType =
  | "system_overview" // Complete system architecture
  | "service_topology" // Service interconnections
  | "user_journey" // Flow-based user paths
  | "capability_map" // Business capability relationships
  | "state_diagram" // State machine visualization
  | "api_surface"; // API endpoint mapping

// CUE parsing results
export interface CueArchitectureData {
  // v1 schema elements
  services?: Record<string, any>;
  deployment?: any;
  deployments?: Record<string, any>;

  // application schema elements
  product?: any;
  ui?: { routes: any[] };
  flows?: any[];
  capabilities?: Record<string, any>;
  paths?: Record<string, any>;
  stateModels?: Record<string, any>;
  locators?: Record<string, string>;

  // Additional metadata
  metadata?: {
    name: string;
    version: string;
    apiVersion: string;
    kind: string;
  };
}

// Layout algorithms
export interface LayoutAlgorithm {
  name: string;
  calculate(
    components: DiagramComponent[],
    connections: DiagramConnection[],
  ): {
    components: DiagramComponent[];
    viewport: { width: number; height: number };
  };
}

// Theming for different diagram types
export interface DiagramTheme {
  name: string;
  layers: Record<
    DiagramLayer,
    {
      background: string;
      border: string;
      text: string;
    }
  >;
  connections: Record<
    ConnectionType,
    {
      color: string;
      width: number;
      style: "solid" | "dashed" | "dotted";
    }
  >;
  components: {
    defaultSize: { width: number; height: number };
    minSize: { width: number; height: number };
    padding: number;
    borderRadius: number;
  };
}

// Export configuration
export interface DiagramExportOptions {
  format: "svg" | "png" | "pdf" | "mermaid" | "graphviz";
  quality?: number;
  width?: number;
  height?: number;
  includeMetadata?: boolean;
  embedFonts?: boolean;
}
