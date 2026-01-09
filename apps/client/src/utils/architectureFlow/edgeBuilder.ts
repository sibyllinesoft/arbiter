import { normalizeStringArray, toSafeId } from "./helpers";
/**
 * Edge building logic for architecture flow graph
 */
import type { DependencyEdge, DependencyNode } from "./types";

export type EdgeBuilderContext = {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  idMap: Record<string, string>;
};

/** Resolve a raw dependency string to a node ID */
export function resolveTargetId(raw: string, idMap: Record<string, string>): string | null {
  if (!raw) return null;
  if (idMap[raw]) return idMap[raw];

  const fallbackKey = Object.keys(idMap).find(
    (key) =>
      key === raw ||
      key.endsWith(`-${raw}`) ||
      key.startsWith(`${raw}-`) ||
      key.split(":")[1] === raw,
  );
  if (fallbackKey) return idMap[fallbackKey] ?? null;

  const [maybeType, rest] = raw.includes(":") ? raw.split(":", 2) : [null, null];
  if (maybeType && rest) {
    return toSafeId(maybeType, rest);
  }

  const looseKey = Object.keys(idMap).find((key) => key.includes(raw));
  if (looseKey) return idMap[looseKey] ?? null;

  return null;
}

/** Check if a node exists in the nodes array */
export function nodeExists(nodeId: string | null | undefined, nodes: DependencyNode[]): boolean {
  return Boolean(nodeId && nodes.some((n) => n.id === nodeId));
}

/** Add edges from a source node to its dependencies */
export function addEdges(
  ctx: EdgeBuilderContext,
  fromId: string,
  dependencies: unknown,
  label?: string,
): void {
  if (!nodeExists(fromId, ctx.nodes)) return;
  const deps = normalizeStringArray(dependencies);
  deps.forEach((dep) => {
    const targetId = resolveTargetId(dep, ctx.idMap);
    if (!targetId || targetId === fromId || !nodeExists(targetId, ctx.nodes)) return;
    const edgeId = `${fromId}->${targetId}`;
    if (ctx.edges.some((e) => e.id === edgeId)) return;
    ctx.edges.push({
      id: edgeId,
      source: fromId,
      target: targetId,
      type: "smoothstep",
      animated: true,
      label,
    });
  });
}
