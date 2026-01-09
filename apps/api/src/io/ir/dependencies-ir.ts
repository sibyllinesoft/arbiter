/**
 * Dependencies IR generator for layered graph visualization.
 * Transforms capability and service specifications into a layered architecture
 * graph showing business and application layer relationships.
 */
import { extractAsRecord } from "./helpers";
import type { IREdge, IRLayer, IRNode } from "./types";

/**
 * Generate dependencies intermediate representation for layered architecture visualization.
 * Creates a graph with capabilities in the business layer and services in the application layer,
 * connected by dependency and implementation edges.
 * @param resolved - The resolved specification containing capability and service definitions
 * @returns IR data with nodes, edges, layers, and layout configuration
 */
export function generateDependenciesIR(resolved: Record<string, unknown>): Record<string, unknown> {
  const capabilities = extractAsRecord(resolved, "capabilities");
  const services = extractAsRecord(resolved, "services");
  const layers: IRLayer[] = [];
  const nodes: IRNode[] = [];
  const edges: IREdge[] = [];

  Object.entries(capabilities).forEach(([capId, capability]) => {
    nodes.push({
      id: capId,
      label: capability.name || capId,
      type: "capability",
      properties: {
        dependencies: capability.depends_on || [],
      },
    });

    if (capability.depends_on && Array.isArray(capability.depends_on)) {
      capability.depends_on.forEach((depId: string) => {
        edges.push({
          source: depId,
          target: capId,
          type: "depends",
        });
      });
    }
  });

  Object.entries(services).forEach(([serviceId, service]) => {
    nodes.push({
      id: serviceId,
      label: service.name || serviceId,
      type: "service",
      properties: {
        technology: service.technology,
        environment: service.environment,
        implements: service.implements || [],
      },
    });

    if (service.implements && Array.isArray(service.implements)) {
      service.implements.forEach((capId: string) => {
        edges.push({
          source: serviceId,
          target: capId,
          type: "implements",
        });
      });
    }
  });

  const capabilityNodes = nodes.filter((n) => n.type === "capability");
  const serviceNodes = nodes.filter((n) => n.type === "service");

  if (capabilityNodes.length > 0) {
    layers.push({
      id: "business",
      label: "Business Layer",
      nodeIds: capabilityNodes.map((n) => n.id),
    });
  }

  if (serviceNodes.length > 0) {
    layers.push({
      id: "application",
      label: "Application Layer",
      nodeIds: serviceNodes.map((n) => n.id),
    });
  }

  return {
    type: "layered_graph",
    nodes,
    edges,
    layers,
    layout: {
      algorithm: "layered",
    },
  };
}
