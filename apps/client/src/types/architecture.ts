/**
 * Architecture diagram types for CUE-driven diagram generation
 */

// Base architectural elements that can be extracted from CUE
export interface ArchitecturalElement {
  id: string;
  name: string;
  type: ElementType;
  /**
   * Fine-grained classification for simplified schema (e.g. queue, proxy, database, endpoint, view).
   */
  kind?: string | undefined;
  description?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export type ElementType =
  | "service"
  | "component"
  | "resource" // Collapsed endpoints/views
  | "route"
  | "flow"
  | "capability"
  | "process"
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
  technology?: string | undefined;
  language?: string | undefined;
  framework?: string[] | undefined;

  // Connection points
  ports?: DiagramPort[] | undefined;

  // From CUE services
  artifactType?: "internal" | "external" | undefined;
  workload?: "deployment" | "statefulset" | "daemonset" | "job" | "cronjob" | undefined;
  replicas?: number | undefined;

  // From UI routes
  routePath?: string | undefined;
  capabilities?: string[] | undefined;

  // From flows
  flowSteps?: FlowStep[] | undefined;

  // From state machines
  states?: Record<string, unknown> | undefined;
  transitions?: Record<string, string> | undefined;
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
    expectation?: unknown;

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
  target?: string | undefined;
  value?: string | undefined;
  expectation?: unknown | undefined;
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
  services?: Record<string, unknown>;
  resources?: Record<string, unknown> | unknown[];
  infrastructure?: Record<string, unknown>;
  environments?: Record<string, unknown>;

  // application schema elements
  product?: unknown;
  ui?: { routes: unknown[] };
  behaviors?: unknown[];
  flows?: unknown[];
  capabilities?: Record<string, unknown>;
  paths?: Record<string, unknown>;
  processes?: Record<string, unknown>;
  /**
   * @deprecated use processes
   */
  stateModels?: Record<string, unknown>;
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
