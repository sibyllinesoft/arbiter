/**
 * Architecture Flow Diagram component using ReactFlow.
 * Renders an interactive service dependency graph with deployment grouping.
 */
import { ArtifactCard } from "@/components/core/ArtifactCard";
import { LAYER_STYLE_CLASSES } from "@/components/diagrams/ArchitectureDiagram/constants";
import { apiService } from "@/services/api";
import {
  type DependencyEdge,
  type DependencyNode,
  type DeploymentGroup,
  buildArchitectureFlowGraph,
} from "@/utils/diagramTransformers";
import { layoutReactFlow } from "@/utils/reactFlowLayout";
import { clsx } from "clsx";
import React, { useEffect, useMemo, useState } from "react";
import type { Node } from "reactflow";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";

/** Generic artifact record type */
type ArtifactLike = Record<string, unknown> | undefined;

/** Props for the ArchitectureFlowDiagram component */
interface ArchitectureFlowDiagramProps {
  projectId: string;
}

/** Default node dimensions for layout calculations */
const NODE_WIDTH = 280;
const NODE_HEIGHT = 140;

/** Get CSS class for a layer based on artifact type */
const layerColorForType = (type: string): string => {
  const normalized = type.toLowerCase();
  const colorKey =
    normalized === "database" || normalized === "datastore"
      ? "database"
      : normalized === "frontend" || normalized === "client"
        ? "frontend"
        : normalized === "service"
          ? "service"
          : normalized === "infrastructure"
            ? "infrastructure"
            : "external";
  return LAYER_STYLE_CLASSES[colorKey as keyof typeof LAYER_STYLE_CLASSES] ?? "";
};

/** ReactFlow node component for displaying service artifacts */
const ArchitectureFlowNode: React.FC<{ data: DependencyNode["data"] }> = ({ data }) => {
  const layerClass = layerColorForType(data?.artifactType ?? data?.artifact?.type ?? "external");

  return (
    <div
      className={clsx("relative rounded-xl bg-white shadow-sm dark:bg-graphite-900", layerClass)}
    >
      <Handle type="target" position={Position.Top} className="bg-gray-400 dark:bg-gray-300" />
      <Handle type="source" position={Position.Bottom} className="bg-gray-400 dark:bg-gray-300" />
      <ArtifactCard
        name={data.title}
        data={{ ...(data.artifact ?? {}), type: data.artifactType }}
        description={data.description ?? null}
        onClick={() => {}}
        className="w-[260px]"
      />
    </div>
  );
};

/** Normalize file path separators to forward slashes */
const normalizePath = (value: string | undefined | null): string | null => {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\\/g, "/");
};

/** Color palette for deployment group borders */
const groupColors: Record<DeploymentGroup["kind"], string> = {
  compose: "#059669", // emerald-600
  kubernetes: "#7c3aed", // violet-600
};

/** Check if an artifact represents a deployment container (infrastructure type) */
const looksLikeDeploymentContainer = (
  artifact: ArtifactLike,
  artifactType: string,
  deploymentGroup: DeploymentGroup | null,
): boolean => {
  if (!deploymentGroup) return false;
  const rawType = (
    artifactType ||
    (artifact && typeof artifact === "object" ? (artifact as { type?: unknown }).type : "") ||
    ""
  )
    .toString()
    .toLowerCase();
  return rawType.includes("infra");
};

/** Data structure for deployment group nodes */
type GroupNodeData = {
  label: string;
  kind: DeploymentGroup["kind"];
  artifact?: ArtifactLike;
  artifactType?: string;
};

/** ReactFlow node component for rendering deployment group boundaries */
const GroupNode: React.FC<{ data: GroupNodeData }> = ({ data }) => {
  const color = groupColors[data.kind] ?? "transparent";
  const overlayBg = `${color}14`; // ~8% opacity
  const artifactData = data.artifact
    ? {
        ...(data.artifact as Record<string, unknown>),
        type: data.artifactType ?? (data.artifact as Record<string, unknown>)?.type,
      }
    : null;
  const title =
    typeof (artifactData as Record<string, unknown> | null)?.name === "string"
      ? ((artifactData as Record<string, unknown>).name as string)
      : data.label;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        boxSizing: "border-box",
        borderWidth: 2,
        borderStyle: "dashed",
        borderColor: color,
        borderRadius: 14,
        backgroundColor: `${color}12`, // very light tint, ensures no gray
        boxShadow: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 8,
          left: 8,
          maxWidth: 260,
          padding: "8px 12px",
          background: overlayBg,
          borderRadius: 10,
          color: "#0b1f1a",
          fontSize: 11,
          lineHeight: 1.4,
          boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 2 }}>{title}</div>
        <div style={{ opacity: 0.82 }}>{data.label}</div>
      </div>
    </div>
  );
};

/** Node type registry for ReactFlow */
const nodeTypesWithGroups = { card: ArchitectureFlowNode, group: GroupNode };

/** Extract compose file path from artifact metadata */
const extractComposeFile = (meta: Record<string, unknown>, artifact: ArtifactLike): string | null =>
  normalizePath(
    (meta as any).composeFile ||
      (meta as any).compose_file ||
      (artifact?.filePath as string | null),
  );

/** Extract kubernetes cluster name from artifact metadata */
const extractKubernetesCluster = (meta: Record<string, unknown>): string | null => {
  const cluster =
    (meta as any).cluster || (meta as any).kubeCluster || (meta as any).kubernetesCluster;
  return cluster && typeof cluster === "string" ? cluster : null;
};

/** Build a compose deployment group */
const buildComposeGroup = (composeFile: string | null, artifact: ArtifactLike): DeploymentGroup => {
  const artifactType =
    typeof (artifact as any)?.type === "string" ? ((artifact as any).type as string) : undefined;
  const label = composeFile ? `Compose: ${composeFile.split("/").pop()}` : "Compose stack";
  return {
    key: composeFile || "compose-stack",
    label,
    kind: "compose",
    ...(artifact ? { artifact: artifact as Record<string, unknown> } : {}),
    ...(artifactType ? { artifactType } : {}),
    members: [],
  };
};

/** Build a kubernetes deployment group */
const buildKubernetesGroup = (cluster: string): DeploymentGroup => ({
  key: `k8s:${cluster}`,
  label: `Cluster: ${cluster}`,
  kind: "kubernetes",
  members: [],
});

/** Extract deployment group info from artifact metadata (compose or kubernetes) */
const deriveDeploymentGroup = (artifact: ArtifactLike): DeploymentGroup | null => {
  const meta = (artifact?.metadata as Record<string, unknown>) ?? {};
  const composeFile = extractComposeFile(meta, artifact);

  if ((meta as any).compose || composeFile) {
    return buildComposeGroup(composeFile, artifact);
  }

  const cluster = extractKubernetesCluster(meta);
  if (cluster) {
    return buildKubernetesGroup(cluster);
  }

  return null;
};

/** Build the dependency graph from resolved spec data */
const buildGraph = (
  resolved: Record<string, unknown> | null | undefined,
): {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  groups: Record<string, DeploymentGroup>;
} =>
  buildArchitectureFlowGraph(resolved, {
    deriveDeploymentGroup,
    looksLikeDeploymentContainer,
  });

/** Filter graph to only include service-type nodes and their connections */
const filterGraphToServices = ({
  nodes,
  edges,
  groups,
}: {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  groups: Record<string, DeploymentGroup>;
}) => {
  const isServiceNode = (node: DependencyNode) => {
    const artifactType = (node.data?.artifactType ?? "").toString().toLowerCase();
    if (artifactType.includes("service") || artifactType === "api" || artifactType === "job") {
      return true;
    }
    const prefix = node.id.split(":")[0]?.toLowerCase();
    return prefix === "service" || prefix === "api" || prefix === "job";
  };

  const serviceNodeIds = new Set(nodes.filter(isServiceNode).map((n) => n.id));

  const filteredNodes = nodes.filter((n) => serviceNodeIds.has(n.id));
  const filteredEdges = edges.filter(
    (e) => serviceNodeIds.has(e.source) && serviceNodeIds.has(e.target),
  );

  const filteredGroups = Object.entries(groups).reduce<Record<string, DeploymentGroup>>(
    (acc, [key, group]) => {
      const members = group.members.filter((id) => serviceNodeIds.has(id));
      if (members.length === 0) return acc;
      acc[key] = { ...group, members };
      return acc;
    },
    {},
  );

  return { nodes: filteredNodes, edges: filteredEdges, groups: filteredGroups };
};

/** Group node padding in pixels */
const GROUP_PADDING = 60;

/** Calculate bounding box for a set of nodes */
const calculateNodesBoundingBox = (
  memberNodes: Array<{ position: { x: number; y: number } }>,
  nodeWidth: number,
  nodeHeight: number,
  padding: number,
): { minX: number; minY: number; maxX: number; maxY: number } => ({
  minX: Math.min(...memberNodes.map((n) => n.position.x)) - padding,
  minY: Math.min(...memberNodes.map((n) => n.position.y)) - padding,
  maxX: Math.max(...memberNodes.map((n) => n.position.x + nodeWidth)) + padding,
  maxY: Math.max(...memberNodes.map((n) => n.position.y + nodeHeight)) + padding,
});

/** Build a group node for a deployment group */
const buildGroupNode = (
  group: DeploymentGroup,
  memberNodes: Array<{ position: { x: number; y: number } }>,
): Node | null => {
  if (!memberNodes.length) return null;

  const { minX, minY, maxX, maxY } = calculateNodesBoundingBox(
    memberNodes,
    NODE_WIDTH,
    NODE_HEIGHT,
    GROUP_PADDING,
  );

  return {
    id: `group-${group.key}`,
    type: "group",
    position: { x: minX, y: minY },
    data: {
      label: group.label,
      kind: group.kind,
      artifact: group.artifact,
      artifactType: group.artifactType,
    },
    style: {
      width: maxX - minX,
      height: maxY - minY,
      zIndex: 0,
      background: "transparent",
      pointerEvents: "none",
    },
    draggable: false,
    selectable: false,
  } as Node;
};

/** Loading state overlay component */
const LoadingOverlay = () => (
  <div className="flex h-full items-center justify-center text-sm text-gray-600 dark:text-graphite-200">
    Loading architecture…
  </div>
);

/** Error state overlay component */
const ErrorOverlay = ({ message }: { message: string }) => (
  <div className="flex h-full items-center justify-center text-sm text-red-600 dark:text-red-300">
    {message}
  </div>
);

/**
 * Interactive architecture diagram showing service dependencies.
 * Fetches resolved spec and renders a ReactFlow graph with deployment grouping.
 */
const ArchitectureFlowDiagram: React.FC<ArchitectureFlowDiagramProps> = ({ projectId }) => {
  const [resolved, setResolved] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    nodes: rawNodes,
    edges: rawEdges,
    groups,
  } = useMemo(() => filterGraphToServices(buildGraph(resolved)), [resolved]);
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(
    () =>
      layoutReactFlow(rawNodes, rawEdges, {
        layout: "flow",
        defaultSize: { width: NODE_WIDTH, height: NODE_HEIGHT },
        direction: "TB",
      }),
    [rawNodes, rawEdges],
  );

  const groupNodes = useMemo(() => {
    if (!layoutedNodes.length) return [];
    return Object.values(groups)
      .map((group) => {
        const memberNodes = layoutedNodes.filter((n) => group.members.includes(n.id));
        return buildGroupNode(group, memberNodes);
      })
      .filter(Boolean) as Node[];
  }, [groups, layoutedNodes]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  useEffect(() => {
    setNodes([
      ...groupNodes,
      ...layoutedNodes.map((n) => ({
        ...n,
        style: { ...(n.style ?? {}), zIndex: 1 },
      })),
    ]);
    setEdges(layoutedEdges);
  }, [layoutedNodes, layoutedEdges, setNodes, setEdges, groupNodes]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!projectId) return;
      setIsLoading(true);
      setError(null);
      try {
        const response = await apiService.getResolvedSpec(projectId);
        if (!active) return;
        setResolved(response.resolved);
      } catch (err) {
        if (!active) return;
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to load architecture");
      } finally {
        if (active) setIsLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [projectId]);

  if (isLoading) {
    return <LoadingOverlay />;
  }

  if (error) {
    return <ErrorOverlay message={error} />;
  }

  if (!resolved || nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-600 dark:text-graphite-200">
        No architecture data yet. Add a service to see the graph.
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypesWithGroups}
      fitView
      className="bg-gray-50 dark:bg-graphite-950"
    >
      <Background gap={16} size={1} />
      <MiniMap pannable zoomable />
      <Controls />
    </ReactFlow>
  );
};

export default ArchitectureFlowDiagram;
