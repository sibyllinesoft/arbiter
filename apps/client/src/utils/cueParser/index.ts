/**
 * CUE Architecture Parser - Modular Implementation
 *
 * Extracts architectural elements from CUE specifications for diagram generation.
 */
import type {
  CueArchitectureData,
  DiagramComponent,
  DiagramConnection,
} from "../../types/architecture";
import {
  parseCapabilityConnections,
  parseFlowConnections,
  parseRouteCapabilityConnections,
} from "./connectionParser";
import {
  deriveArtifactType,
  deriveServiceLayer,
  deriveWorkload,
  parseServicePorts,
} from "./helpers";
import { normalizeResources } from "./resourceNormalizer";
import { normalizeServices } from "./serviceNormalizer";

export * from "./types";
export * from "./helpers";
export { normalizeServices } from "./serviceNormalizer";
export { normalizeResources } from "./resourceNormalizer";

export class CueArchitectureParser {
  /** Parse CUE data into architecture components and connections */
  static parseArchitecture(cueData: CueArchitectureData): {
    components: DiagramComponent[];
    connections: DiagramConnection[];
  } {
    const components: DiagramComponent[] = [];
    const connections: DiagramConnection[] = [];

    CueArchitectureParser.parseAppSchema(cueData, components, connections);

    return { components, connections };
  }

  /** Parse app-centric schema */
  private static parseAppSchema(
    cueData: CueArchitectureData,
    components: DiagramComponent[],
    connections: DiagramConnection[],
  ): void {
    // Parse capabilities as application layer components
    if (cueData.capabilities) {
      Object.entries(cueData.capabilities).forEach(([capId, capData]) => {
        const cap = capData as Record<string, unknown>;
        components.push({
          id: `capability_${capId}`,
          name: (cap.name as string) || capId,
          type: "capability",
          description: (cap.description as string) || `Capability: ${capId}`,
          layer: "application",
          position: { x: 0, y: 0 },
          size: { width: 140, height: 70 },
          metadata: {
            requirements: (cap.requirements as string[]) || [],
          },
        });
      });
    }

    // Parse services and service-like infrastructure
    normalizeServices(cueData).forEach((svc) => {
      components.push({
        id: `service_${svc.id}`,
        name: svc.name || svc.id,
        type: "service",
        kind: svc.kind,
        description: (svc.data.description as string) || `Service: ${svc.id}`,
        layer: deriveServiceLayer(svc.kind),
        position: { x: 0, y: 0 },
        size: { width: 180, height: 100 },
        artifactType: deriveArtifactType(svc.data),
        language: svc.data.language as string | undefined,
        workload: deriveWorkload(svc.data),
        ports: parseServicePorts(svc.data),
        metadata: { ...svc.data, serviceKind: svc.kind },
      });
    });

    // Parse unified resources (endpoints/views)
    normalizeResources(cueData).forEach((resource) => {
      components.push(resource);
    });

    // Parse processes (formerly state machines)
    const processes = cueData.processes ?? cueData.stateModels;
    if (processes) {
      Object.entries(processes).forEach(([processId, processData]) => {
        const proc = processData as Record<string, unknown>;
        components.push({
          id: `process_${processId}`,
          name: (proc.name as string) || processId,
          type: "process",
          description: `Process: ${processId}`,
          layer: "application",
          position: { x: 0, y: 0 },
          size: { width: 140, height: 90 },
          states: (proc.states as Record<string, unknown>) || {},
          metadata: {
            initial: proc.initial,
            states: proc.states,
          },
        });
      });
    }

    // Parse behaviors (formerly flows) to generate connections
    const behaviors = cueData.behaviors ?? cueData.flows;
    if (behaviors) {
      behaviors.forEach((flow, flowIndex) => {
        parseFlowConnections(flow as Record<string, unknown>, flowIndex, components, connections);
      });
    }

    // Parse capability dependencies
    parseCapabilityConnections(cueData, components, connections);

    // Parse route-capability relationships
    parseRouteCapabilityConnections(cueData, components, connections);
  }

  /** Analyze CUE data structure and suggest diagram types */
  static suggestDiagramTypes(cueData: CueArchitectureData): string[] {
    const suggestions: string[] = [];

    const serviceCount = normalizeServices(cueData).length;
    const resourceCount = normalizeResources(cueData).length;
    const processCount = Object.keys(cueData.processes ?? cueData.stateModels ?? {}).length;

    if (cueData.ui?.routes && (cueData.behaviors ?? cueData.flows)) {
      suggestions.push("user_journey");
    }

    if (serviceCount > 0) {
      suggestions.push("service_topology");
    }

    if (cueData.capabilities) {
      suggestions.push("capability_map");
    }

    if (processCount > 0) {
      suggestions.push("state_diagram");
    }

    if (resourceCount > 0) {
      suggestions.push("api_surface");
    }

    // Always suggest system overview if we have components
    if (suggestions.length > 0) {
      suggestions.unshift("system_overview");
    }

    return suggestions;
  }
}
