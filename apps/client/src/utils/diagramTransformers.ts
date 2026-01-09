/**
 * @module diagramTransformers
 * Utilities for transforming CUE architecture data into ReactFlow diagram nodes and edges.
 * Provides filtering logic for different diagram types (user journey, service topology, etc.)
 * and handles layout positioning using the DiagramLayoutEngine.
 */
import type { DiagramComponent, DiagramConnection, DiagramType } from "@/types/architecture";
import { CueArchitectureParser } from "@/utils/cueArchitectureParser";
import { DiagramLayoutEngine } from "@/utils/diagramLayout";

// Re-export types and main function from modular implementation
export type {
  DependencyNode,
  DependencyEdge,
  DeploymentGroup,
  ArchitectureFlowGraph,
} from "./architectureFlow";
export { buildArchitectureFlowGraph } from "./architectureFlow";

/** Result of parsing CUE data into diagram model */
type CueParseResult = {
  components: DiagramComponent[];
  connections: DiagramConnection[];
};

/** Filter predicate for diagram components */
type ComponentFilter = (c: DiagramComponent) => boolean;

/** Filter configuration for a diagram type */
interface DiagramFilterConfig {
  componentFilter: ComponentFilter;
  connectionTypes: string[];
}

/** Component filter: user journey view elements */
const isUserJourneyComponent: ComponentFilter = (c) =>
  c.type === "capability" ||
  c.type === "route" ||
  (c.type === "resource" && (c.kind === "view" || c.layer === "presentation"));

/** Component filter: service topology elements */
const isServiceTopologyComponent: ComponentFilter = (c) =>
  c.type === "service" ||
  c.type === "external_system" ||
  c.type === "api_endpoint" ||
  (c.type === "resource" &&
    (c.kind === "endpoint" || c.kind === "api_endpoint" || c.layer === "service"));

/** Component filter: capability map elements */
const isCapabilityMapComponent: ComponentFilter = (c) => ["capability", "route"].includes(c.type);

/** Component filter: state diagram elements */
const isStateDiagramComponent: ComponentFilter = (c) => c.type === "process";

/** Component filter: API surface elements */
const isApiSurfaceComponent: ComponentFilter = (c) =>
  c.type === "service" ||
  c.type === "api_endpoint" ||
  (c.type === "resource" &&
    (c.kind === "endpoint" || c.kind === "api_endpoint" || c.layer === "service"));

/** Filter configurations for each diagram type */
const DIAGRAM_FILTERS: Record<DiagramType, DiagramFilterConfig> = {
  user_journey: {
    componentFilter: isUserJourneyComponent,
    connectionTypes: ["user_navigation", "user_interaction", "capability_usage"],
  },
  service_topology: {
    componentFilter: isServiceTopologyComponent,
    connectionTypes: ["api_call", "dependency"],
  },
  capability_map: {
    componentFilter: isCapabilityMapComponent,
    connectionTypes: ["capability_usage"],
  },
  state_diagram: {
    componentFilter: isStateDiagramComponent,
    connectionTypes: ["state_transition"],
  },
  api_surface: {
    componentFilter: isApiSurfaceComponent,
    connectionTypes: ["api_call"],
  },
};

/**
 * Transforms CUE architecture data into a filtered diagram model based on diagram type.
 * @param cueData - Raw CUE data to parse
 * @param diagramType - The type of diagram to generate (user_journey, service_topology, etc.)
 * @returns Filtered components and connections for the specified diagram type
 */
export function buildCueDiagramModel(cueData: unknown, diagramType: DiagramType): CueParseResult {
  if (!cueData) return { components: [], connections: [] };

  const parsed = CueArchitectureParser.parseArchitecture(cueData);

  const filterConfig = DIAGRAM_FILTERS[diagramType];
  if (!filterConfig) {
    return { components: parsed.components, connections: parsed.connections };
  }

  const filteredComponents = parsed.components.filter(filterConfig.componentFilter);
  const filteredConnections = parsed.connections.filter((c) =>
    filterConfig.connectionTypes.includes(c.type),
  );

  return { components: filteredComponents, connections: filteredConnections };
}

export function layoutCueDiagram(
  components: DiagramComponent[],
  connections: DiagramConnection[],
  layoutType?: string,
): { components: DiagramComponent[]; viewport: { width: number; height: number } } {
  if (components.length === 0) {
    return { components: [], viewport: { width: 800, height: 600 } };
  }

  const layoutEngine = new DiagramLayoutEngine();
  const algorithmType = layoutType || layoutEngine.suggestLayout(components, connections);
  return layoutEngine.applyLayout(components, connections, algorithmType);
}
