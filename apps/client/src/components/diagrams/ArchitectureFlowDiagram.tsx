import { ArtifactCard } from "@/components/ArtifactCard";
import { LAYER_STYLE_CLASSES } from "@/components/diagrams/ArchitectureDiagram/constants";
import { apiService } from "@/services/api";
import { layoutReactFlow } from "@/utils/reactFlowLayout";
import { clsx } from "clsx";
import React, { useEffect, useMemo, useState } from "react";
import type { Edge, Node } from "reactflow";
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

type ArtifactLike = Record<string, any> | undefined;

type DependencyNode = Node<{
  title: string;
  artifact: ArtifactLike;
  artifactType: string;
  description?: string | null;
}>;

type DependencyEdge = Edge<{ label?: string }>;

type GroupKind = "compose" | "kubernetes";

interface DeploymentGroup {
  key: string;
  label: string;
  kind: GroupKind;
  artifact?: ArtifactLike;
  artifactType?: string;
  members: string[];
}

interface ArchitectureFlowDiagramProps {
  projectId: string;
}

const NODE_WIDTH = 280;
const NODE_HEIGHT = 140;

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

const normalizeStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((v) => {
          if (typeof v === "string") return v;
          if (v && typeof v === "object" && "id" in v) return String((v as any).id);
          return String(v);
        })
        .filter(Boolean)
    : [];

const normalizePath = (value: string | undefined | null): string | null => {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\\/g, "/");
};

const groupColors: Record<GroupKind, string> = {
  compose: "#059669", // emerald-600
  kubernetes: "#7c3aed", // violet-600
};

const looksLikeDeploymentContainer = (
  artifact: ArtifactLike,
  artifactType: string,
  deploymentGroup: DeploymentGroup | null,
) => {
  if (!deploymentGroup) return false;
  const rawType = (artifactType || (artifact as any)?.type || "").toString().toLowerCase();
  return rawType.includes("infra");
};

type GroupNodeData = {
  label: string;
  kind: GroupKind;
  artifact?: ArtifactLike;
  artifactType?: string;
};

const GroupNode: React.FC<{ data: GroupNodeData }> = ({ data }) => {
  const color = groupColors[data.kind] ?? "transparent";
  const overlayBg = `${color}14`; // ~8% opacity
  const artifactData = data.artifact
    ? { ...(data.artifact as any), type: data.artifactType ?? (data.artifact as any)?.type }
    : null;
  const title = artifactData?.name ?? data.label;

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

const nodeTypesWithGroups = { card: ArchitectureFlowNode, group: GroupNode };

const deriveDeploymentGroup = (artifact: any): DeploymentGroup | null => {
  const meta = artifact?.metadata ?? {};
  const composeFile = normalizePath(
    meta.composeFile || meta.compose_file || (artifact?.filePath as string | null),
  );

  if (meta.compose || composeFile) {
    const label = composeFile ? `Compose: ${composeFile.split("/").pop()}` : "Compose stack";
    return {
      key: composeFile || "compose-stack",
      label,
      kind: "compose",
      artifact,
      artifactType: artifact?.type,
      members: [],
    };
  }

  const cluster = meta.cluster || meta.kubeCluster || meta.kubernetesCluster;
  if (cluster && typeof cluster === "string") {
    return {
      key: `k8s:${cluster}`,
      label: `Cluster: ${cluster}`,
      kind: "kubernetes",
      members: [],
    };
  }

  return null;
};

const toSafeId = (prefix: string, raw: string) => `${prefix}:${raw.trim()}`;

const pickRecord = (source: any, keys: string[]): Record<string, any> => {
  for (const key of keys) {
    const candidate = source?.[key];
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      return candidate as Record<string, any>;
    }
  }
  return {};
};

const pickArray = (source: any, keys: string[]): any[] => {
  for (const key of keys) {
    const candidate = source?.[key];
    if (Array.isArray(candidate)) {
      return candidate as any[];
    }
  }
  return [];
};

const buildGraph = (
  resolved: Record<string, any> | null | undefined,
): {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  groups: Record<string, DeploymentGroup>;
} => {
  if (!resolved) return { nodes: [], edges: [], groups: {} };

  const nodes: DependencyNode[] = [];
  const edges: DependencyEdge[] = [];
  const idMap: Record<string, string> = {};
  const groups: Record<string, DeploymentGroup> = {};

  const registerNode = (
    id: string,
    title: string,
    artifactType: string,
    artifact: ArtifactLike,
  ) => {
    const primaryId = id?.trim() || "node";
    const artifactId = (artifact as any)?.artifactId || (artifact as any)?.artifact_id;
    const nameKey = (artifact?.name ?? title ?? primaryId).toString().toLowerCase();

    const existingId =
      (artifactId && idMap[artifactId]) || (nameKey && idMap[nameKey]) || idMap[primaryId];
    if (existingId) return existingId;

    const nodeId = toSafeId(artifactType, primaryId);
    idMap[primaryId] = nodeId;
    if (artifactId) idMap[artifactId] = nodeId;
    if (nameKey) idMap[nameKey] = nodeId;

    const deploymentGroup = deriveDeploymentGroup(artifact);
    const isDeploymentContainer = looksLikeDeploymentContainer(
      artifact,
      artifactType,
      deploymentGroup,
    );

    nodes.push({
      id: nodeId,
      type: "card",
      position: { x: 0, y: 0 },
      data: {
        title: title || id,
        artifact,
        artifactType,
        description: artifact?.description ?? artifact?.metadata?.description ?? null,
      },
    });

    if (deploymentGroup) {
      const existing = groups[deploymentGroup.key];

      const merged: DeploymentGroup = existing ?? {
        ...deploymentGroup,
        members: [] as string[],
        ...(isDeploymentContainer && artifact ? { artifact } : {}),
        ...(isDeploymentContainer && artifactType ? { artifactType } : {}),
      };

      if (isDeploymentContainer && artifact && !merged.artifact) {
        merged.artifact = artifact;
      }
      if (isDeploymentContainer && artifactType && !merged.artifactType) {
        merged.artifactType = artifactType;
      }

      merged.members.push(nodeId);
      groups[deploymentGroup.key] = merged;
    }
    return nodeId;
  };

  // Frontend packages (from resolved or spec)
  const frontendPackages = pickArray(resolved, ["frontend", "frontends", "ui"])
    .flatMap((entry) => (Array.isArray(entry?.packages) ? entry.packages : []))
    .concat(pickArray(resolved.frontend, ["packages"]))
    .concat(pickArray(resolved.spec, ["frontend"])?.flatMap((f: any) => f?.packages ?? []) ?? []);

  // Components block (can include frontends, services, databases, packages)
  const components = {
    ...pickRecord(resolved, ["components"]),
    ...pickRecord(resolved.spec, ["components"]),
  };
  const componentEntries = Object.entries(components);

  // Services block
  const services = {
    ...pickRecord(resolved, ["services"]),
    ...pickRecord(resolved.spec, ["services"]),
  };

  // Databases block
  const databases = {
    ...pickRecord(resolved, ["databases"]),
    ...pickRecord(resolved.spec, ["databases"]),
  };

  // Artifacts list fallback
  const artifacts = pickArray(resolved, ["artifacts", "artifact"]).concat(
    pickArray(resolved.spec, ["artifacts", "artifact"]),
  );

  // Register services (from services section)
  Object.entries(services).forEach(([key, svc]) => {
    registerNode(key, svc.name ?? key, "service", svc);
  });

  // Register databases (from databases section)
  Object.entries(databases).forEach(([key, db]) => {
    registerNode(key, db.name ?? key, "database", db);
  });

  // Register frontends (from frontend packages)
  frontendPackages.forEach((pkg) => {
    const id = pkg.packageName || pkg.name || pkg.id || "frontend";
    registerNode(id, pkg.name ?? id, "frontend", pkg);
  });

  // Register components block (ensures UI shows cards even without connections)
  componentEntries.forEach(([key, component]) => {
    const rawType =
      component?.type ||
      component?.artifactType ||
      component?.metadata?.type ||
      component?.category ||
      "";
    const type = String(rawType || "").toLowerCase();
    const resolvedType = (() => {
      if (type.includes("frontend") || type === "ui" || type === "client") return "frontend";
      if (type.includes("service") || type === "api" || type === "job") return "service";
      if (type.includes("db") || type.includes("database") || type.includes("datastore"))
        return "database";
      if (type.includes("infra") || type.includes("infrastructure")) return "infrastructure";
      if (type.includes("package") || type === "module") return "package";
      return "external";
    })();
    registerNode(key, component?.name ?? key, resolvedType, component);
  });

  // Register artifacts array (fallback when only artifacts are provided)
  artifacts.forEach((artifact, index) => {
    const id =
      artifact?.id ||
      artifact?.artifactId ||
      artifact?.artifact_id ||
      artifact?.name ||
      `artifact-${index}`;
    const rawType =
      artifact?.type ||
      artifact?.artifactType ||
      artifact?.metadata?.type ||
      artifact?.metadata?.category ||
      "";
    const type = String(rawType || "").toLowerCase();
    const resolvedType = (() => {
      if (type.includes("frontend")) return "frontend";
      if (type.includes("service") || type === "api" || type === "job") return "service";
      if (type.includes("db") || type.includes("database") || type.includes("datastore"))
        return "database";
      if (type.includes("infra")) return "infrastructure";
      if (type.includes("package") || type === "module") return "package";
      return "external";
    })();
    registerNode(id, artifact?.name ?? id, resolvedType, artifact);
  });

  // Limit compose group members to nodes that belong to the same compose stack
  Object.values(groups).forEach((group) => {
    if (group.kind !== "compose") return;

    const composeFile =
      (group.artifact as any)?.metadata?.composeFile ||
      (group.artifact as any)?.metadata?.compose_file ||
      (group.artifact as any)?.filePath ||
      null;

    const composeServiceNames = Array.isArray((group.artifact as any)?.metadata?.services)
      ? ((group.artifact as any)?.metadata?.services as any[])
          .map((svc) => (typeof svc?.service === "string" ? svc.service.trim() : null))
          .filter(Boolean)
      : [];

    const memberSet = new Set<string>(group.members);

    const belongsToGroup = (node: DependencyNode) => {
      const artifact = (node.data as any)?.artifact ?? {};
      const meta = artifact?.metadata ?? {};
      const rawType = (artifact?.type || meta?.type || "").toString().toLowerCase();
      const nameCandidates = [
        artifact?.name,
        meta?.service,
        meta?.name,
        node.data?.title,
        node.id.split(":")[1],
      ]
        .map((v) => (typeof v === "string" ? v.trim() : null))
        .filter(Boolean) as string[];

      const sameComposeFile =
        composeFile &&
        [meta.composeFile, meta.compose_file, artifact?.filePath].some(
          (v) => typeof v === "string" && v.trim() === composeFile,
        );

      const hasComposeMetadata = Boolean(
        meta.composeService ||
          meta.composeServiceYaml ||
          meta.compose ||
          meta.compose_file ||
          meta.composeFile,
      );

      const listedInCompose = composeServiceNames.some((svc) =>
        nameCandidates.some((candidate) => candidate === svc || candidate.endsWith(`-${svc}`)),
      );

      const isServiceOrDb =
        ["service:", "database:"].some((prefix) => node.id.startsWith(prefix)) ||
        rawType === "service" ||
        rawType === "database";

      return isServiceOrDb && (sameComposeFile || listedInCompose || hasComposeMetadata);
    };

    nodes.filter(belongsToGroup).forEach((n) => memberSet.add(n.id));
    group.members = Array.from(memberSet);
  });

  const resolveTargetId = (raw: string): string | null => {
    if (!raw) return null;
    if (idMap[raw]) return idMap[raw];

    // Friendly fallbacks: match common prefix/suffix patterns or alias to database
    const fallbackKey = Object.keys(idMap).find(
      (key) =>
        key === raw ||
        key.endsWith(`-${raw}`) ||
        key.startsWith(`${raw}-`) ||
        key.split(":")[1] === raw,
    );
    if (fallbackKey) return idMap[fallbackKey] ?? null;

    if (raw === "primary" && idMap["app-db"]) return idMap["app-db"];
    if (raw === "postgres" && idMap["app-db"]) return idMap["app-db"];
    if (raw === "rest" && idMap["rest-service"]) return idMap["rest-service"];
    if (raw === "frontend" && idMap["frontend-app"]) return idMap["frontend-app"];

    const [maybeType, rest] = raw.includes(":") ? raw.split(":", 2) : [null, null];
    if (maybeType && rest) {
      return toSafeId(maybeType, rest);
    }

    // Last resort: try fuzzy contains match
    const looseKey = Object.keys(idMap).find((key) => key.includes(raw));
    if (looseKey) return idMap[looseKey] ?? null;

    return null;
  };

  const nodeExists = (nodeId: string | null | undefined) =>
    Boolean(nodeId && nodes.some((n) => n.id === nodeId));

  const addEdges = (fromId: string, dependencies: unknown, label?: string) => {
    if (!nodeExists(fromId)) return;
    const deps = normalizeStringArray(dependencies);
    deps.forEach((dep) => {
      const targetId = resolveTargetId(dep);
      if (!targetId || targetId === fromId || !nodeExists(targetId)) return;
      const edgeId = `${fromId}->${targetId}`;
      if (edges.some((e) => e.id === edgeId)) return;
      edges.push({
        id: edgeId,
        source: fromId,
        target: targetId,
        type: "smoothstep",
        animated: true,
        label,
      });
    });
  };

  // Frontend dependencies -> services
  frontendPackages.forEach((pkg) => {
    const nodeId = idMap[pkg.packageName || pkg.name || pkg.id];
    if (!nodeId) return;
    addEdges(nodeId, pkg.depends_on ?? pkg.dependencies ?? pkg.metadata?.depends_on, "uses");
  });

  // Artifact dependencies
  artifacts.forEach((artifact) => {
    const nodeId = idMap[artifact?.id ?? artifact?.name];
    if (!nodeId) return;
    addEdges(
      nodeId,
      artifact?.depends_on ?? artifact?.dependencies ?? artifact?.metadata?.depends_on,
      "depends on",
    );
  });

  // Component dependencies (covers frontends/services defined in components block)
  componentEntries.forEach(([key, component]) => {
    const nodeId = idMap[key];
    if (!nodeId) return;
    addEdges(
      nodeId,
      component.depends_on ?? component.dependencies ?? component.metadata?.depends_on,
      "depends on",
    );
  });

  // Service dependencies -> other services or databases
  Object.entries(services as Record<string, any>).forEach(([key, svc]) => {
    const nodeId = idMap[key];
    if (!nodeId) return;
    addEdges(nodeId, svc.depends_on ?? svc.dependencies ?? svc.metadata?.depends_on, "depends on");

    // Common shape: single database field
    if (svc.database && typeof svc.database === "string") {
      addEdges(nodeId, [svc.database], "stores in");
    }
  });

  return { nodes, edges, groups };
};

const LoadingOverlay = () => (
  <div className="flex h-full items-center justify-center text-sm text-gray-600 dark:text-graphite-200">
    Loading architecture…
  </div>
);

const ErrorOverlay = ({ message }: { message: string }) => (
  <div className="flex h-full items-center justify-center text-sm text-red-600 dark:text-red-300">
    {message}
  </div>
);

const ArchitectureFlowDiagram: React.FC<ArchitectureFlowDiagramProps> = ({ projectId }) => {
  const [resolved, setResolved] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    nodes: rawNodes,
    edges: rawEdges,
    groups,
  } = useMemo(() => buildGraph(resolved), [resolved]);
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
        if (!memberNodes.length) return null;
        const padding = 60;
        const minX = Math.min(...memberNodes.map((n) => n.position.x)) - padding;
        const minY = Math.min(...memberNodes.map((n) => n.position.y)) - padding;
        const maxX = Math.max(...memberNodes.map((n) => n.position.x + NODE_WIDTH)) + padding;
        const maxY = Math.max(...memberNodes.map((n) => n.position.y + NODE_HEIGHT)) + padding;
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
        No architecture data yet. Add a frontend, service, or database to see the graph.
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
