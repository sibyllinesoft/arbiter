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

  // Register artifacts
  artifacts.forEach((artifact, index) => {
    const a = artifact as Record<string, unknown>;
    const id = (a?.id ||
      a?.artifactId ||
      a?.artifact_id ||
      a?.name ||
      `artifact-${index}`) as string;
    const rawType = extractRawType(a);
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

  // Match nodes to compose groups
  matchNodesToComposeGroups(state.nodes, state.groups);

  return { nodes: state.nodes, edges, groups: state.groups };
}
