import type { Edge, Node } from "reactflow";
import { Position } from "reactflow";

import type { DiagramComponent, DiagramConnection } from "@/types/architecture";
import { DiagramLayoutEngine } from "./diagramLayout";

export type ReactFlowLayoutOptions = {
  layout?: "layered" | "force_directed" | "flow";
  defaultSize?: { width: number; height: number };
  direction?: "TB" | "LR";
};

const engine = new DiagramLayoutEngine();

export function layoutReactFlow<T = any>(
  nodes: Node<T>[],
  edges: Edge[],
  options: ReactFlowLayoutOptions = {},
): { nodes: Node<T>[]; edges: Edge[]; viewport: { width: number; height: number } } {
  const size = options.defaultSize ?? { width: 220, height: 140 };

  const components: DiagramComponent[] = nodes.map((node) => {
    const width = typeof node.width === "number" ? node.width : size.width;
    const height = typeof node.height === "number" ? node.height : size.height;
    const data = (node.data as Record<string, unknown> | undefined) ?? {};
    const label =
      typeof data.title === "string"
        ? data.title
        : typeof data.name === "string"
          ? data.name
          : node.id;

    return {
      id: node.id,
      name: String(label),
      type: "component",
      position: node.position ?? { x: 0, y: 0 },
      size: { width, height },
      layer: "application",
    } as DiagramComponent;
  });

  const connections: DiagramConnection[] = edges.map((edge) => ({
    id: edge.id,
    from: { componentId: edge.source },
    to: { componentId: edge.target },
    type: "dependency",
  }));

  const { components: positioned, viewport } = engine.applyLayout(
    components,
    connections,
    options.layout ?? "flow",
  );

  const positionedMap = new Map(positioned.map((component) => [component.id, component]));
  const sourcePosition = options.direction === "LR" ? Position.Right : Position.Bottom;
  const targetPosition = options.direction === "LR" ? Position.Left : Position.Top;

  const layoutedNodes = nodes.map((node) => {
    const positionedNode = positionedMap.get(node.id);
    if (!positionedNode) return node;
    return {
      ...node,
      position: { ...positionedNode.position },
      sourcePosition,
      targetPosition,
    };
  });

  return { nodes: layoutedNodes, edges, viewport };
}
