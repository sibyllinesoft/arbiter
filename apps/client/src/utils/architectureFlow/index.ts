import { extractResolvedData } from "./dataExtractor";
import { type EdgeBuilderContext, addEdges } from "./edgeBuilder";
import { matchNodesToComposeGroups } from "./groupMatcher";
import { extractRawType, resolveArtifactType } from "./helpers";
import { createNodeRegistry } from "./nodeRegistry";
/**
 * Architecture Flow Graph Builder
 *
 * Modular implementation for building ReactFlow nodes and edges from resolved specs.
 */
import type { ArchitectureFlowGraph, BuilderHelpers, DependencyEdge } from "./types";

export * from "./types";
export * from "./helpers";
export * from "./gridLayout";

/** Build an architecture flow graph from resolved spec data */
export function buildArchitectureFlowGraph(
  resolved: Record<string, unknown> | null | undefined,
  helpers: BuilderHelpers,
): ArchitectureFlowGraph {
  if (!resolved) return { nodes: [], edges: [], groups: {} };

  const { state, registerNode } = createNodeRegistry(helpers);
  const edges: DependencyEdge[] = [];

  // Extract data from resolved spec
  const { resolvedFrontends, components, componentEntries, services, databases, artifacts } =
    extractResolvedData(resolved);

  // Register services
  Object.entries(services).forEach(([key, svc]) => {
    const s = svc as Record<string, unknown>;
    registerNode(key, (s?.name as string) ?? key, "service", s);
  });

  // Register databases
  Object.entries(databases).forEach(([key, db]) => {
    const d = db as Record<string, unknown>;
    registerNode(key, (d?.name as string) ?? key, "database", d);
  });

  // Register frontends
  resolvedFrontends.forEach((pkg) => {
    const p = pkg as Record<string, unknown>;
    const id = (p?.packageName || p?.name || p?.id || "frontend") as string;
    registerNode(id, (p?.name as string) ?? id, "frontend", p);
  });

  // Register components
  Object.entries(components).forEach(([key, component]) => {
    const c = component as Record<string, unknown>;
    const rawType = extractRawType(c);
    const resolvedType = resolveArtifactType(rawType);
    registerNode(key, (c?.name as string) ?? key, resolvedType, c);
  });

  // Register artifacts (skip relationships - they become edges, not nodes)
  artifacts.forEach((artifact, index) => {
    const a = artifact as Record<string, unknown>;
    const rawType = extractRawType(a);
    // Skip relationship artifacts - they're processed separately as edges
    if (rawType.toLowerCase() === "relationship") return;

    const id = (a?.id ||
      a?.artifactId ||
      a?.artifact_id ||
      a?.name ||
      `artifact-${index}`) as string;
    const resolvedType = resolveArtifactType(rawType);
    registerNode(id, (a?.name as string) ?? id, resolvedType, a);
  });

  // Build edge context
  const edgeCtx: EdgeBuilderContext = {
    nodes: state.nodes,
    edges,
    idMap: state.idMap,
  };

  // Add edges for frontends
  resolvedFrontends.forEach((pkg) => {
    const p = pkg as Record<string, unknown>;
    const meta = p?.metadata as Record<string, unknown> | undefined;
    const nodeId = state.idMap[(p?.packageName || p?.name || p?.id) as string];
    if (!nodeId) return;
    addEdges(edgeCtx, nodeId, p?.depends_on ?? p?.dependencies ?? meta?.depends_on, "uses");
  });

  // Add edges for artifacts
  artifacts.forEach((artifact) => {
    const a = artifact as Record<string, unknown>;
    const meta = a?.metadata as Record<string, unknown> | undefined;
    const nodeId = state.idMap[(a?.id ?? a?.name) as string];
    if (!nodeId) return;
    addEdges(
      edgeCtx,
      nodeId,
      a?.depends_on ?? a?.dependencies ?? meta?.depends_on,
      (meta?.linkLabel as string) ?? undefined,
    );
  });

  // Add edges for components
  componentEntries.forEach(([key, component]) => {
    const c = component as Record<string, unknown>;
    const nodeId = state.idMap[key];
    if (!nodeId) return;
    addEdges(edgeCtx, nodeId, c?.depends_on ?? c?.dependencies, "uses");
  });

  // Add edges from relationship artifacts (manually created edges with labels)
  artifacts.forEach((artifact) => {
    const a = artifact as Record<string, unknown>;
    const artifactType = (a?.type ?? a?.artifactType ?? "").toString().toLowerCase();
    if (artifactType !== "relationship") return;

    const meta = a?.metadata as Record<string, unknown> | undefined;
    const source = (meta?.source ?? a?.source) as string | undefined;
    const target = (meta?.target ?? a?.target) as string | undefined;
    const label = (meta?.label ?? a?.label ?? a?.name) as string | undefined;
    const relationshipId = (a?.id ?? a?.artifactId) as string | undefined;

    if (!source || !target) return;

    // Resolve source and target to node IDs
    const sourceNodeId = state.idMap[source] ?? source;
    const targetNodeId = state.idMap[target] ?? target;

    // Check if both nodes exist
    if (
      !state.nodes.some((n) => n.id === sourceNodeId) ||
      !state.nodes.some((n) => n.id === targetNodeId)
    ) {
      return;
    }

    // Check if edge already exists
    const edgeId = `${sourceNodeId}->${targetNodeId}`;
    if (edges.some((e) => e.id === edgeId)) {
      // Update existing edge with label if it doesn't have one
      const existingEdge = edges.find((e) => e.id === edgeId);
      if (existingEdge && !existingEdge.data?.label && label) {
        existingEdge.data = { ...existingEdge.data, label, relationshipId };
      }
      return;
    }

    // Create edge from relationship
    edges.push({
      id: edgeId,
      source: sourceNodeId,
      target: targetNodeId,
      type: "smoothstep",
      animated: true,
      data: { label: label ?? "", relationshipId },
    });
  });

  // Match nodes to compose groups
  matchNodesToComposeGroups(state.nodes, state.groups);

  return { nodes: state.nodes, edges, groups: state.groups };
}
