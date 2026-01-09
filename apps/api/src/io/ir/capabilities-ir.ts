/**
 * Capabilities IR generator for dependency graph visualization.
 * Transforms capability specifications into a directed graph structure
 * showing dependencies between capabilities, grouped by domain.
 */
import { extractAsRecord } from "./helpers";
import type { IREdge, IRGroup, IRNode } from "./types";

/**
 * Generate capabilities intermediate representation for dependency visualization.
 * Creates a directed graph with capability nodes, dependency edges, and domain groupings.
 * @param resolved - The resolved specification containing capability definitions
 * @returns IR data with nodes, edges, groups, layout configuration, and metadata
 */
export function generateCapabilitiesIR(resolved: Record<string, unknown>): Record<string, unknown> {
  const capabilities = extractAsRecord(resolved, "capabilities");
  const nodes: IRNode[] = [];
  const edges: IREdge[] = [];
  const groups: IRGroup[] = [];
  const domains = new Set<string>();

  Object.entries(capabilities).forEach(([capId, capability]) => {
    const domain = capId.split(".")[0];
    domains.add(domain);

    nodes.push({
      id: capId,
      label: capability.name || capId,
      type: "capability",
      domain: domain,
      properties: {
        complexity: capability.complexity || "medium",
        priority: capability.priority || "medium",
        owner: capability.owner || "unknown",
      },
    });

    if (capability.depends_on && Array.isArray(capability.depends_on)) {
      capability.depends_on.forEach((depId: string) => {
        edges.push({
          source: depId,
          target: capId,
          type: "dependency",
        });
      });
    }
  });

  domains.forEach((domain) => {
    const domainNodes = nodes.filter((n) => n.domain === domain);
    groups.push({
      id: domain,
      label: domain.charAt(0).toUpperCase() + domain.slice(1),
      nodeIds: domainNodes.map((n) => n.id),
    });
  });

  return {
    type: "directed_graph",
    nodes,
    edges,
    groups,
    layout: {
      algorithm: "hierarchical",
    },
    metadata: {
      totalCapabilities: nodes.length,
      dependencies: edges.length,
      domains: domains.size,
    },
  };
}
