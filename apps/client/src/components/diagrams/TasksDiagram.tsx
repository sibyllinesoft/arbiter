import { ArtifactCard, type ArtifactCardMetaRow } from "@/components/ArtifactCard";
import LayoutTabs from "@/components/Layout/Tabs";
import AddEntityModal from "@/components/modals/AddEntityModal";
import { coerceFieldValueToString } from "@/components/modals/AddEntityModal";
import {
  DEFAULT_UI_OPTION_CATALOG,
  type EpicTaskOption,
  type FieldValue,
  type TaskEpicOption,
  type UiOptionCatalog,
} from "@/components/modals/entityTypes";
import { useTabBadgeUpdater } from "@/contexts/TabBadgeContext";
import { Card } from "@/design-system";
import { apiService } from "@/services/api";
import type { TabItem as LayoutTabItem } from "@/types/ui";
import { clsx } from "clsx";
import { AlertCircle, Flag, GitBranch, Layers, User, Workflow } from "lucide-react";
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactFlow, {
  Handle,
  Position,
  MarkerType,
  type Edge,
  type Node,
  type NodeProps,
  getRectOfNodes,
  type ReactFlowInstance,
} from "reactflow";
import "reactflow/dist/style.css";

interface TasksDiagramProps {
  projectId: string;
  className?: string;
}

export interface TasksDiagramHandle {
  openTaskCreator: () => void;
  openEpicCreator: () => void;
}

type UnknownRecord = Record<string, unknown>;

type ResolvedSpec = UnknownRecord & {
  spec?: UnknownRecord;
};

interface NormalizedTask {
  /** Original identifier (if supplied) */
  rawId: string;
  /** Human friendly display name */
  name: string;
  /** Normalized slug used for dependency matching */
  slug: string;
  /** Optional status (lowercased) */
  status?: string;
  /** Optional assignee or owner */
  assignee?: string;
  /** Optional priority */
  priority?: string;
  /** Optional description */
  description?: string;
  /** Dependency strings as provided */
  dependsOn: string[];
  /** Stable node identifier for graph rendering */
  nodeId: string;
  /** Graph status class derived from task status */
  statusClass: string;
  /** Whether the task appears to be completed */
  completed: boolean;
  /** Keys that can resolve this task during dependency matching */
  matchKeys: string[];
  /** Backing artifact identifier when available */
  artifactId?: string;
  /** Associated epic identifier if scoped */
  epicId?: string | null;
  /** Associated epic display name if scoped */
  epicName?: string;
}

interface NormalizedTaskGroup {
  /** Stable identifier used for tab routing and dependency mapping */
  id: string;
  /** Raw identifier preserved from the source data */
  rawId?: string;
  /** Backing artifact identifier when available */
  artifactId?: string | null;
  /** Human-friendly label */
  name: string;
  /** Optional descriptive text */
  description?: string;
  /** Normalized tasks contained within the group */
  tasks: NormalizedTask[];
  /** Group type - either dedicated epic or global unscoped tasks */
  type: "epic" | "unscoped";
  /** Slug match keys to correlate tasks with this group */
  matchKeys: string[];
}

const STATUS_STYLES: Record<string, string> = {
  completed: "fill:#dcfce7,stroke:#15803d,color:#166534,font-weight:bold",
  in_progress: "fill:#bfdbfe,stroke:#1d4ed8,color:#1e3a8a,font-weight:bold",
  blocked: "fill:#fee2e2,stroke:#dc2626,color:#991b1b,font-weight:bold",
  at_risk: "fill:#fef3c7,stroke:#d97706,color:#92400e,font-weight:bold",
  todo: "fill:#f1f5f9,stroke:#94a3b8,color:#475569",
};

const DEFAULT_TASK_LAYER_KEY = "task-default";

const TASK_STATUS_LAYER_KEY: Record<string, string> = {
  completed: "task-completed",
  in_progress: "task-in-progress",
  blocked: "task-blocked",
  at_risk: "task-at-risk",
  todo: DEFAULT_TASK_LAYER_KEY,
};

const FALLBACK_STATUS_CLASS = "todo";

const normalizeString = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str.length ? str : null;
};

const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const toArray = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => normalizeString(item)).filter((v): v is string => Boolean(v));
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => normalizeString(item))
      .filter((v): v is string => Boolean(v));
  }
  return [];
};

const deriveStatusClass = (status?: string | null): string => {
  if (!status) {
    return FALLBACK_STATUS_CLASS;
  }

  const normalized = slugify(status);
  if (STATUS_STYLES[normalized]) {
    return normalized;
  }

  return FALLBACK_STATUS_CLASS;
};

const escapeMermaidLabel = (value: string): string =>
  value.replace(/"/g, '\\"').replace(/</g, "&lt;").replace(/>/g, "&gt;");

const toRecord = (value: unknown): UnknownRecord =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : {};

const getString = (record: UnknownRecord, key: string): string | null =>
  normalizeString(record[key]);

const getNestedRecord = (record: UnknownRecord, key: string): UnknownRecord =>
  toRecord(record[key]);

const getBooleanFlag = (value: unknown): boolean => value === true;

const ensureArray = (value: unknown): Array<{ key: string; value: unknown; index: number }> => {
  if (Array.isArray(value)) {
    return value.map((item, index) => ({
      key: `index-${index}`,
      value: item,
      index,
    }));
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).map(([key, entry], index) => ({
      key,
      value: entry,
      index,
    }));
  }

  return [];
};

interface TaskNodeData {
  task: NormalizedTask;
  isSelected: boolean;
}

interface NormalizeTaskArgs {
  value: unknown;
  key: string;
  index: number;
  nodePrefix: string;
  epicContext?: { id?: string | null; slug: string; name: string };
}

const normalizeTask = ({
  value,
  key,
  index,
  nodePrefix,
  epicContext,
}: NormalizeTaskArgs): NormalizedTask | null => {
  const taskRecord = typeof value === "string" ? {} : toRecord(value);
  const inlineName = normalizeString(typeof value === "string" ? value : taskRecord["name"]);
  const metadata = getNestedRecord(taskRecord, "metadata");

  const explicitEpicId =
    getString(taskRecord, "epicId") ??
    getString(taskRecord, "epic_id") ??
    getString(metadata, "epicId") ??
    getString(metadata, "epic_id") ??
    null;

  const explicitEpicName =
    getString(taskRecord, "epicName") ??
    getString(metadata, "epicName") ??
    getString(metadata, "epic") ??
    null;

  const fallbackBase = epicContext
    ? `${epicContext.slug}-task-${index + 1}`
    : `${nodePrefix || "task"}-${index + 1}`;

  const rawId =
    getString(taskRecord, "id") ??
    getString(taskRecord, "slug") ??
    normalizeString(key) ??
    inlineName ??
    fallbackBase;

  const name = getString(taskRecord, "name") ?? inlineName ?? rawId ?? fallbackBase;

  const description =
    getString(taskRecord, "description") ??
    getString(taskRecord, "summary") ??
    getString(metadata, "description") ??
    getString(metadata, "summary") ??
    undefined;

  const statusCandidates = [
    getString(taskRecord, "status"),
    getString(taskRecord, "state"),
    getString(metadata, "status"),
    getString(metadata, "state"),
  ].filter((candidate): candidate is string => Boolean(candidate));

  const statusTokens = statusCandidates.map((token) => token.toLowerCase());
  const status = statusCandidates[0] ?? undefined;

  const assignee =
    getString(taskRecord, "assignee") ??
    getString(taskRecord, "owner") ??
    getString(metadata, "assignee") ??
    getString(metadata, "owner") ??
    undefined;

  const priority =
    getString(taskRecord, "priority") ?? getString(metadata, "priority") ?? undefined;

  const completedFlag =
    getBooleanFlag(taskRecord["completed"]) ||
    getBooleanFlag(taskRecord["done"]) ||
    getBooleanFlag(taskRecord["isCompleted"]) ||
    getBooleanFlag(metadata["completed"]) ||
    getBooleanFlag(metadata["done"]) ||
    getBooleanFlag(metadata["isCompleted"]) ||
    statusTokens.includes("completed") ||
    statusTokens.includes("done");

  const dependencySources = [
    taskRecord["dependsOn"],
    taskRecord["depends_on"],
    taskRecord["dependencies"],
    taskRecord["blockedBy"],
    taskRecord["blocked_by"],
    metadata["dependsOn"],
    metadata["depends_on"],
    metadata["dependencies"],
  ];

  const dependsOn = dependencySources
    .flatMap((entry) => toArray(entry))
    .filter((dep, depIndex, self) => self.indexOf(dep) === depIndex);

  const aliasCandidates = taskRecord["aliases"] ?? metadata["aliases"];
  const aliasValues = Array.isArray(aliasCandidates)
    ? aliasCandidates
        .map((item) => normalizeString(item))
        .filter((item): item is string => Boolean(item))
    : typeof aliasCandidates === "string"
      ? aliasCandidates
          .split(",")
          .map((item) => normalizeString(item))
          .filter((item): item is string => Boolean(item))
      : [];

  const artifactId =
    getString(taskRecord, "artifactId") ??
    getString(taskRecord, "artifact_id") ??
    getString(taskRecord, "entityId") ??
    getString(taskRecord, "entity_id") ??
    getString(metadata, "artifactId") ??
    getString(metadata, "artifact_id") ??
    getString(metadata, "entityId") ??
    getString(metadata, "entity_id") ??
    null;

  const slugSeed = rawId ?? name ?? fallbackBase;
  const slugValue = slugify(slugSeed);
  const sanitizedPrefix = slugify(nodePrefix) || "task";
  const nodeIdBase = slugValue || `${sanitizedPrefix}-${index + 1}`;
  const nodeId = `task_${nodeIdBase}`;

  const matchKeys = Array.from(
    new Set(
      [rawId, name, key, slugValue, ...aliasValues]
        .map((item) => (item ? slugify(String(item)) : null))
        .filter((item): item is string => Boolean(item)),
    ),
  );

  if (!matchKeys.includes(nodeIdBase)) {
    matchKeys.push(nodeIdBase);
  }

  const normalizedTask: NormalizedTask = {
    rawId: rawId ?? fallbackBase,
    name: name ?? fallbackBase,
    slug: slugValue || nodeIdBase,
    dependsOn,
    nodeId,
    statusClass: deriveStatusClass(status ?? (completedFlag ? "completed" : undefined)),
    completed: completedFlag,
    matchKeys,
  };

  if (status) {
    normalizedTask.status = status;
  }

  if (assignee) {
    normalizedTask.assignee = assignee;
  }

  if (priority) {
    normalizedTask.priority = priority;
  }

  if (description) {
    normalizedTask.description = description;
  }

  if (artifactId) {
    normalizedTask.artifactId = artifactId;
  }

  if (epicContext) {
    const effectiveEpicId = epicContext.id ?? epicContext.slug;
    normalizedTask.epicId = effectiveEpicId;
    normalizedTask.epicName = epicContext.name;
  }

  if (!normalizedTask.epicId && explicitEpicId) {
    normalizedTask.epicId = explicitEpicId;
  }

  if (!normalizedTask.epicName && explicitEpicName) {
    normalizedTask.epicName = explicitEpicName;
  }

  return normalizedTask;
};

const buildTaskGroups = (resolved: ResolvedSpec | null | undefined): NormalizedTaskGroup[] => {
  const unscopedGroup: NormalizedTaskGroup = {
    id: "unscoped",
    rawId: "unscoped",
    artifactId: null,
    name: "Unscoped",
    description: "Tasks that are not assigned to an epic yet.",
    tasks: [],
    type: "unscoped",
    matchKeys: ["unscoped"],
  };

  if (!resolved) {
    return [unscopedGroup];
  }

  const resolvedRecord = toRecord(resolved);
  const specRecord = getNestedRecord(resolvedRecord, "spec");

  const epicSource = specRecord["epics"] ?? resolvedRecord["epics"] ?? [];
  const epicEntries = ensureArray(epicSource);

  const epicGroups: NormalizedTaskGroup[] = [];
  const epicMatchMap = new Map<string, NormalizedTaskGroup>();
  const groupTaskSeen = new Map<NormalizedTaskGroup, Set<string>>();

  const addTaskToGroup = (group: NormalizedTaskGroup, task: NormalizedTask) => {
    const dedupeKey = task.slug || slugify(task.rawId) || `${group.id}-${task.nodeId}`;
    let seen = groupTaskSeen.get(group);
    if (!seen) {
      seen = new Set<string>();
      groupTaskSeen.set(group, seen);
    }

    if (dedupeKey && seen.has(dedupeKey)) {
      return;
    }

    if (dedupeKey) {
      seen.add(dedupeKey);
    }

    group.tasks.push(task);
  };

  epicEntries.forEach(({ key, value, index }) => {
    if (!value && typeof value !== "string") {
      return;
    }

    const epicRecord =
      typeof value === "string" ? ({ name: value } satisfies UnknownRecord) : toRecord(value);
    const metadata = getNestedRecord(epicRecord, "metadata");
    const rawEpicId =
      getString(epicRecord, "id") ??
      getString(epicRecord, "slug") ??
      getString(metadata, "id") ??
      getString(metadata, "slug") ??
      normalizeString(key) ??
      `epic-${index + 1}`;

    const epicName = getString(epicRecord, "name") ?? rawEpicId ?? `Epic ${index + 1}`;

    const description =
      getString(epicRecord, "description") ?? getString(epicRecord, "summary") ?? undefined;

    const aliasRaw = epicRecord["aliases"];
    const aliasValues = Array.isArray(aliasRaw)
      ? aliasRaw
          .map((item) => normalizeString(item))
          .filter((item): item is string => Boolean(item))
      : [];

    const metadataSlug = getString(metadata, "slug") ?? getString(metadata, "id");
    const artifactId =
      getString(epicRecord, "artifactId") ??
      getString(epicRecord, "artifact_id") ??
      getString(metadata, "artifactId") ??
      getString(metadata, "artifact_id") ??
      getString(metadata, "entityId") ??
      getString(metadata, "entity_id") ??
      null;

    const slugBase = rawEpicId ?? metadataSlug ?? epicName ?? `${key || "epic"}-${index + 1}`;
    const epicSlug = slugify(slugBase) || `epic-${index + 1}`;

    const matchKeys = Array.from(
      new Set(
        [
          rawEpicId,
          epicName,
          normalizeString(key),
          getString(epicRecord, "slug"),
          getString(metadata, "slug"),
          getString(metadata, "id"),
          epicSlug,
          ...aliasValues,
        ]
          .map((item) => (item ? slugify(String(item)) : null))
          .filter((item): item is string => Boolean(item)),
      ),
    );

    if (!matchKeys.includes(epicSlug)) {
      matchKeys.push(epicSlug);
    }

    const epicGroup: NormalizedTaskGroup = {
      id: epicSlug,
      rawId: rawEpicId ?? epicSlug,
      artifactId,
      name: epicName,
      tasks: [],
      type: "epic",
      matchKeys,
      ...(description ? { description } : {}),
    };

    epicGroups.push(epicGroup);
    matchKeys.forEach((matchKey) => {
      if (!epicMatchMap.has(matchKey)) {
        epicMatchMap.set(matchKey, epicGroup);
      }
    });

    const taskSource = epicRecord["tasks"] ?? [];
    const taskEntries = ensureArray(taskSource);

    taskEntries.forEach(({ key: taskKey, value: taskValue, index: taskIndex }) => {
      const normalizedTask = normalizeTask({
        value: taskValue,
        key: taskKey,
        index: taskIndex,
        nodePrefix: `${epicGroup.id}-task`,
        epicContext: {
          id: epicGroup.rawId ?? epicGroup.id,
          slug: epicGroup.id,
          name: epicGroup.name,
        },
      });

      if (normalizedTask) {
        addTaskToGroup(epicGroup, normalizedTask);
      }
    });
  });

  const globalTaskSource = specRecord["tasks"] ?? resolvedRecord["tasks"] ?? [];
  const globalTaskEntries = ensureArray(globalTaskSource);

  globalTaskEntries.forEach(({ key, value, index }) => {
    const taskRecord = typeof value === "string" ? {} : toRecord(value);
    const metadata = getNestedRecord(taskRecord, "metadata");

    const epicCandidates = [
      getString(taskRecord, "epicId"),
      getString(taskRecord, "epic_id"),
      getString(taskRecord, "epic"),
      getString(metadata, "epicId"),
      getString(metadata, "epic"),
    ].filter((candidate): candidate is string => Boolean(candidate));

    let targetEpic: NormalizedTaskGroup | null = null;

    for (const candidate of epicCandidates) {
      const lookup = slugify(candidate);
      if (lookup && epicMatchMap.has(lookup)) {
        targetEpic = epicMatchMap.get(lookup) ?? null;
        if (targetEpic) {
          break;
        }
      }
    }

    const normalizedTask = normalizeTask({
      value,
      key,
      index,
      nodePrefix: targetEpic ? `${targetEpic.id}-task` : "unscoped-task",
      ...(targetEpic
        ? {
            epicContext: {
              id: targetEpic.rawId ?? targetEpic.id,
              slug: targetEpic.id,
              name: targetEpic.name,
            },
          }
        : {}),
    });

    if (!normalizedTask) {
      return;
    }

    if (targetEpic) {
      addTaskToGroup(targetEpic, normalizedTask);
    } else {
      addTaskToGroup(unscopedGroup, normalizedTask);
    }
  });

  const allGroups = [unscopedGroup, ...epicGroups];

  allGroups.forEach((group) => {
    group.tasks.sort((a, b) => {
      const nameA = a.name ?? a.rawId;
      const nameB = b.name ?? b.rawId;
      return nameA.localeCompare(nameB);
    });
  });

  return allGroups;
};

interface TaskGroupPanelProps {
  group: NormalizedTaskGroup;
  isActive: boolean;
  onTaskClick: (task: NormalizedTask) => void;
  onEpicEdit?: (group: NormalizedTaskGroup) => void;
}

interface TaskFlowData {
  nodes: Node<TaskNodeData>[];
  edges: Edge[];
  missingDependencies: string[];
}

const getTaskLayerKey = (statusClass: string): string => {
  const candidate = TASK_STATUS_LAYER_KEY[statusClass];
  return typeof candidate === "string" && candidate.length > 0 ? candidate : DEFAULT_TASK_LAYER_KEY;
};

const buildTaskCardData = (task: NormalizedTask) => {
  const layerKey = getTaskLayerKey(task.statusClass);

  return {
    name: task.name,
    type: layerKey,
    metadata: {
      description: task.description ?? undefined,
      summary: task.description ?? undefined,
      category: layerKey,
      epic: task.epicName ?? undefined,
      owner: task.assignee ?? undefined,
    },
  };
};

const buildTaskMetaRows = (task: NormalizedTask): ArtifactCardMetaRow[] => {
  const rows: ArtifactCardMetaRow[] = [];

  const statusLabel = task.status ? task.status : task.completed ? "Completed" : "Unclassified";

  rows.push({
    key: "status",
    icon: <Workflow />,
    content: <span className="opacity-100 capitalize">Status: {statusLabel}</span>,
  });

  if (task.priority) {
    rows.push({
      key: "priority",
      icon: <Flag />,
      content: <span className="opacity-100">Priority: {task.priority}</span>,
    });
  }

  if (task.assignee) {
    rows.push({
      key: "assignee",
      icon: <User />,
      content: <span className="opacity-100">Owner: {task.assignee}</span>,
    });
  }

  if (task.epicName) {
    rows.push({
      key: "epic",
      icon: <Layers />,
      content: <span className="opacity-100">Epic: {task.epicName}</span>,
    });
  }

  if (task.dependsOn.length > 0) {
    rows.push({
      key: "dependencies",
      icon: <GitBranch />,
      content: <span className="opacity-100">Dependencies: {task.dependsOn.length}</span>,
    });
  }

  return rows;
};

const buildTaskFlowData = (
  group: NormalizedTaskGroup,
  selectedTaskId: string | null,
): TaskFlowData => {
  const nodes: Node<TaskNodeData>[] = [];
  const edges: Edge[] = [];
  const missingDependencies: string[] = [];

  const matchMap = new Map<string, NormalizedTask>();
  group.tasks.forEach((task) => {
    task.matchKeys.forEach((key) => {
      if (key && !matchMap.has(key)) {
        matchMap.set(key, task);
      }
    });
  });

  const horizontalSpacing = 240;

  group.tasks.forEach((task, index) => {
    nodes.push({
      id: task.nodeId,
      type: "task",
      position: { x: index * horizontalSpacing, y: 0 },
      data: {
        task,
        isSelected: task.nodeId === selectedTaskId,
      },
      draggable: false,
      selectable: true,
      style: { width: 220 },
      selected: task.nodeId === selectedTaskId,
    });
  });

  const edgeIds = new Set<string>();

  group.tasks.forEach((task) => {
    if (!task.dependsOn.length) {
      return;
    }

    task.dependsOn.forEach((dep) => {
      const normalized = slugify(dep);
      const dependencyTask = normalized ? matchMap.get(normalized) : undefined;

      if (dependencyTask) {
        const edgeId = `${dependencyTask.nodeId}->${task.nodeId}`;
        if (!edgeIds.has(edgeId)) {
          edges.push({
            id: edgeId,
            source: dependencyTask.nodeId,
            target: task.nodeId,
            type: "smoothstep",
            markerEnd: {
              type: MarkerType.ArrowClosed,
            },
            animated: false,
          });
          edgeIds.add(edgeId);
        }
      } else {
        missingDependencies.push(`${task.name} depends on ${dep}`);
      }
    });
  });

  return {
    nodes,
    edges,
    missingDependencies: Array.from(new Set(missingDependencies)),
  };
};

const TaskNode: React.FC<NodeProps<TaskNodeData>> = ({ data }) => {
  const { task, isSelected } = data;
  const cardData = buildTaskCardData(task);
  const metaRows = buildTaskMetaRows(task);

  return (
    <div className="relative">
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />

      <ArtifactCard
        name={task.name}
        data={cardData}
        description={task.description ?? null}
        metaRows={metaRows}
        onClick={() => {}}
        className={clsx(
          isSelected ? "ring-2 ring-offset-2 ring-offset-black/20 ring-white/80" : "",
        )}
      />
    </div>
  );
};

const TASK_NODE_TYPES = { task: TaskNode };

interface TaskFlowProps {
  nodes: Node<TaskNodeData>[];
  edges: Edge[];
  onSelectTask: (task: NormalizedTask | null) => void;
  width: number;
  height: number;
  onTaskClick: (task: NormalizedTask) => void;
}

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 1.6;
const HORIZONTAL_PADDING = 80;
const TOP_PADDING = 20;
const BOTTOM_PADDING = 80;

function TaskFlow({ nodes, edges, onSelectTask, width, height, onTaskClick }: TaskFlowProps) {
  const instanceRef = useRef<ReactFlowInstance | null>(null);

  const applyViewport = useCallback(() => {
    const instance = instanceRef.current;
    if (!instance || nodes.length === 0 || width <= 0 || height <= 0) {
      return;
    }

    const rect = getRectOfNodes(nodes);
    if (!rect) {
      return;
    }

    const paddedWidth = Math.max(rect.width + HORIZONTAL_PADDING * 2, 1);
    const paddedHeight = Math.max(rect.height + TOP_PADDING + BOTTOM_PADDING, 1);

    const zoomX = width / paddedWidth;
    const zoomY = height / paddedHeight;
    const targetZoom = Math.min(Math.max(Math.min(zoomX, zoomY), MIN_ZOOM), MAX_ZOOM);

    const x = (HORIZONTAL_PADDING - rect.x) * targetZoom;
    const y = (TOP_PADDING - rect.y) * targetZoom;

    instance.setViewport({ x, y, zoom: targetZoom });
  }, [nodes, width, height]);

  useEffect(() => {
    applyViewport();
  }, [applyViewport, edges]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={TASK_NODE_TYPES}
      proOptions={{ hideAttribution: true }}
      className="bg-transparent"
      style={{ width, height }}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.35}
      maxZoom={1.6}
      panOnScroll={false}
      zoomOnScroll
      zoomOnPinch
      onInit={(instance) => {
        instanceRef.current = instance;
        applyViewport();
      }}
      onNodeClick={(_, node) => {
        const data = node.data as TaskNodeData;
        onSelectTask(data.task);
        onTaskClick(data.task);
      }}
      onPaneClick={() => onSelectTask(null)}
    />
  );
}

interface TaskDetailCardProps {
  task: NormalizedTask;
}

const TaskDetailCard: React.FC<TaskDetailCardProps> = ({ task }) => {
  const cardData = buildTaskCardData(task);
  const metaRows = buildTaskMetaRows(task);
  const hasDependencies = task.dependsOn.length > 0;

  return (
    <div className="space-y-3">
      <ArtifactCard
        name={task.name}
        data={cardData}
        description={task.description ?? null}
        metaRows={metaRows}
        onClick={() => {}}
      />

      {hasDependencies && (
        <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700 shadow-sm dark:bg-white/10 dark:text-white/85">
          <p className="font-medium text-slate-900 dark:text-white">Dependencies</p>
          <ul className="mt-2 list-disc list-inside space-y-1">
            {task.dependsOn.map((dep) => (
              <li key={`${task.nodeId}-${dep}`}>{dep}</li>
            ))}
          </ul>
        </div>
      )}

      {!task.description && !hasDependencies && (
        <p className="text-xs text-slate-500 dark:text-white/70">
          No additional details provided for this task yet.
        </p>
      )}
    </div>
  );
};

function TaskGroupPanel({ group, isActive, onTaskClick, onEpicEdit }: TaskGroupPanelProps) {
  const [selectedTask, setSelectedTask] = useState<NormalizedTask | null>(null);
  const flowContainerRef = useRef<HTMLDivElement | null>(null);
  const [hasMeasuredSize, setHasMeasuredSize] = useState(false);
  const [flowSize, setFlowSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>(() => {
    if (typeof window === "undefined") {
      return { width: 1280, height: 720 };
    }
    return { width: window.innerWidth, height: window.innerHeight };
  });

  const flowData = useMemo(
    () => buildTaskFlowData(group, selectedTask?.nodeId ?? null),
    [group, selectedTask?.nodeId],
  );

  useEffect(() => {
    setSelectedTask(null);
    setHasMeasuredSize(false);
  }, [group.id, isActive]);

  const updateMeasuredSize = useCallback(() => {
    if (!isActive) {
      setHasMeasuredSize(false);
      return false;
    }

    const node = flowContainerRef.current;
    if (!node) {
      return false;
    }

    const rect = node.getBoundingClientRect();
    const computed = window.getComputedStyle(node);
    const paddingX =
      parseFloat(computed.paddingLeft || "0") + parseFloat(computed.paddingRight || "0");
    const paddingY =
      parseFloat(computed.paddingTop || "0") + parseFloat(computed.paddingBottom || "0");

    const width = Math.max(1, Math.round(rect.width - paddingX));
    const height = Math.max(1, Math.round(rect.height - paddingY));

    if (width <= 0 || height <= 0) {
      setHasMeasuredSize(false);
      return false;
    }

    setFlowSize((previous) => {
      const deltaWidth = width - previous.width;
      const deltaHeight = height - previous.height;
      const noChange = Math.abs(deltaWidth) < 1 && Math.abs(deltaHeight) < 1;
      return noChange ? previous : { width, height };
    });

    setHasMeasuredSize(true);

    return true;
  }, [isActive, group.id]);

  useEffect(() => {
    const updateViewport = () => {
      if (typeof window === "undefined") return;
      setViewportSize({
        width: Math.max(1, window.innerWidth),
        height: Math.max(1, window.innerHeight),
      });
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => {
      window.removeEventListener("resize", updateViewport);
    };
  }, []);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    if (updateMeasuredSize()) {
      return;
    }

    let frame: number;
    const measureUntilVisible = () => {
      if (!updateMeasuredSize()) {
        frame = requestAnimationFrame(measureUntilVisible);
      }
    };

    frame = requestAnimationFrame(measureUntilVisible);

    return () => {
      if (frame) {
        cancelAnimationFrame(frame);
      }
    };
  }, [group.id, updateMeasuredSize, isActive]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const node = flowContainerRef.current;
    if (!node) return;

    const observer = new ResizeObserver(() => {
      updateMeasuredSize();
    });

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [updateMeasuredSize, isActive]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const handleResize = () => {
      updateMeasuredSize();
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [updateMeasuredSize, isActive]);

  const hasTasks = group.tasks.length > 0;
  const baseWidth = Math.max(1200, Math.round(viewportSize.width * 0.92));
  const baseHeight = Math.max(720, Math.round(viewportSize.height * 0.85));
  const renderWidth = baseWidth;
  const renderHeight = baseHeight;
  const adjustedHeight = Math.max(520, renderHeight - 20);
  const shouldRenderFlow = isActive && renderWidth > 0 && adjustedHeight > 0;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <Card
        variant="ghost"
        size="sm"
        className="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent shadow-none ring-0"
        bodyClassName="flex min-h-0 flex-1 flex-col p-0"
      >
        <div
          ref={flowContainerRef}
          className="flex-1 min-h-0 overflow-hidden"
          style={{ minHeight: `${adjustedHeight}px` }}
        >
          {hasTasks ? (
            shouldRenderFlow ? (
              <div
                className="relative h-full w-full overflow-hidden bg-white dark:bg-graphite-950"
                style={{ minHeight: `${adjustedHeight}px` }}
              >
                {group.type === "epic" && group.description && (
                  <div className="pointer-events-none absolute left-2 top-2 z-[999] flex justify-start">
                    <div
                      className="pointer-events-none rounded-lg border border-white/30 bg-white/50 p-3 text-xs leading-relaxed text-gray-900 shadow-xl backdrop-blur-[10px] dark:border-white/10 dark:bg-graphite-900/50 dark:text-graphite-50"
                      style={{ width: "25%", minWidth: "16rem", maxWidth: "24rem" }}
                    >
                      <p className="whitespace-pre-line">{group.description}</p>
                    </div>
                  </div>
                )}
                <div
                  className="absolute left-1/2 top-1/2 bg-white dark:bg-graphite-950"
                  style={{
                    width: `${renderWidth}px`,
                    height: `${adjustedHeight}px`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <TaskFlow
                    nodes={flowData.nodes}
                    edges={flowData.edges}
                    onSelectTask={setSelectedTask}
                    width={renderWidth}
                    height={adjustedHeight}
                    onTaskClick={onTaskClick}
                  />
                </div>
              </div>
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-white dark:bg-graphite-950 text-xs text-graphite-400">
                <span>Preparing canvas…</span>
              </div>
            )
          ) : (
            <div className="flex h-full w-full items-center justify-center px-6 text-base font-semibold text-gray-700 text-center dark:text-graphite-100">
              {group.type === "unscoped"
                ? "No unscoped tasks yet. Use Add Task to capture work that has not been assigned to an epic."
                : "No tasks have been added to this epic yet. Use Add Task to start planning the work."}
            </div>
          )}
        </div>

        {(selectedTask || flowData.missingDependencies.length > 0) && (
          <div className="space-y-4 px-6 py-4">
            {selectedTask && <TaskDetailCard task={selectedTask} />}

            {flowData.missingDependencies.length > 0 && (
              <div className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                <p className="font-medium">Unresolved dependencies</p>
                <ul className="mt-1 list-disc list-inside space-y-1 text-xs sm:text-sm">
                  {flowData.missingDependencies.map((dependency, index) => (
                    <li key={`${group.id}-missing-${index}`}>{dependency}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

export const TasksDiagram = forwardRef<TasksDiagramHandle, TasksDiagramProps>(
  ({ projectId, className = "" }, ref) => {
    const [resolved, setResolved] = useState<ResolvedSpec | null>(null);
    const [, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [uiOptionCatalog, setUiOptionCatalog] =
      useState<UiOptionCatalog>(DEFAULT_UI_OPTION_CATALOG);
    const [epicModalState, setEpicModalState] = useState<{
      open: boolean;
      initialValues: Record<string, FieldValue> | null;
      mode: "create" | "edit";
      targetArtifactId: string | null;
      draftIdentifier: string | null;
    }>({
      open: false,
      initialValues: null,
      mode: "create",
      targetArtifactId: null,
      draftIdentifier: null,
    });
    const { targetArtifactId: activeEpicArtifactId, draftIdentifier: activeEpicDraftIdentifier } =
      epicModalState;
    const [taskModalState, setTaskModalState] = useState<{
      open: boolean;
      presetEpicId: string | null;
      initialValues: Record<string, FieldValue> | null;
      mode: "create" | "edit";
      targetArtifactId: string | null;
    }>({
      open: false,
      presetEpicId: null,
      initialValues: null,
      mode: "create",
      targetArtifactId: null,
    });
    const [activeTab, setActiveTab] = useState<string>("unscoped");
    const isMountedRef = useRef(true);

    useEffect(() => {
      isMountedRef.current = true;
      return () => {
        isMountedRef.current = false;
      };
    }, []);

    const loadResolved = useCallback(
      async (options: { silent?: boolean } = {}) => {
        if (!isMountedRef.current) return;

        const { silent = false } = options;

        if (!projectId) {
          setResolved(null);
          setLoading(false);
          return;
        }

        try {
          if (!silent) {
            setLoading(true);
          }
          setError(null);
          const response = await apiService.getResolvedSpec(projectId);
          if (!isMountedRef.current) return;
          setResolved(response.resolved as ResolvedSpec);
        } catch (err) {
          console.error("Failed to load epic/task data", err);
          if (!isMountedRef.current) return;
          setResolved(null);
          setError(err instanceof Error ? err.message : "Failed to load tasks");
          throw err;
        } finally {
          if (!silent && isMountedRef.current) {
            setLoading(false);
          }
        }
      },
      [projectId],
    );

    useEffect(() => {
      loadResolved().catch(() => {
        /* handled in loadResolved */
      });
    }, [loadResolved]);

    useEffect(() => {
      let active = true;
      (async () => {
        try {
          const options = await apiService.getUiOptionCatalog();
          if (!active || !isMountedRef.current || !options) return;
          setUiOptionCatalog((prev) => ({
            ...DEFAULT_UI_OPTION_CATALOG,
            ...prev,
            ...options,
          }));
        } catch (err) {
          if (import.meta.env.DEV) {
            console.warn("[TasksDiagram] failed to fetch UI option catalog", err);
          }
        }
      })();

      return () => {
        active = false;
      };
    }, []);

    const taskGroups = useMemo(() => buildTaskGroups(resolved), [resolved]);
    const tabBadgeUpdater = useTabBadgeUpdater();
    const tasksReady = Boolean(resolved);
    const totalTasks = useMemo(
      () => (tasksReady ? taskGroups.reduce((sum, group) => sum + group.tasks.length, 0) : null),
      [taskGroups, tasksReady],
    );

    useEffect(() => {
      if (!projectId) {
        tabBadgeUpdater("tasks", null);
        return () => {
          tabBadgeUpdater("tasks", null);
        };
      }
      if (totalTasks == null) {
        tabBadgeUpdater("tasks", null);
        return () => {
          tabBadgeUpdater("tasks", null);
        };
      }
      tabBadgeUpdater("tasks", totalTasks);
      return () => {
        tabBadgeUpdater("tasks", null);
      };
    }, [projectId, tabBadgeUpdater, totalTasks]);

    useEffect(() => {
      if (!taskGroups.length) {
        if (activeTab !== "unscoped") {
          setActiveTab("unscoped");
        }
        return;
      }

      if (!taskGroups.some((group) => group.id === activeTab)) {
        setActiveTab(taskGroups[0]?.id ?? "unscoped");
      }
    }, [taskGroups, activeTab]);

    const { openTaskOptions, epicSelectionOptions } = useMemo(() => {
      const options: EpicTaskOption[] = [];
      const selection: TaskEpicOption[] = [];
      const seenTasks = new Set<string>();
      const seenEpics = new Set<string>();

      taskGroups.forEach((group) => {
        if (group.type === "epic") {
          const epicIdentifier = group.rawId ?? group.id;
          if (epicIdentifier && !seenEpics.has(epicIdentifier)) {
            selection.push({ id: epicIdentifier, name: group.name });
            seenEpics.add(epicIdentifier);
            seenEpics.add(group.id);
          }
        }

        group.tasks.forEach((task) => {
          if (task.completed) {
            return;
          }

          const optionId = String(task.rawId || task.slug || `${group.id}-${task.nodeId}`);
          const dedupeKey = `${group.id}-${optionId}`;
          if (seenTasks.has(dedupeKey)) {
            return;
          }

          seenTasks.add(dedupeKey);

          const option: EpicTaskOption = {
            id: optionId,
            name: task.name,
          };

          if (group.type === "epic") {
            const epicIdentifier = group.rawId ?? group.id;
            option.epicId = epicIdentifier;
            option.epicName = group.name;

            if (epicIdentifier && !seenEpics.has(epicIdentifier)) {
              selection.push({ id: epicIdentifier, name: group.name });
              seenEpics.add(epicIdentifier);
              seenEpics.add(group.id);
            }
          }

          if (task.epicId && !option.epicId) {
            option.epicId = task.epicId;
          }

          if (task.epicName && !option.epicName) {
            option.epicName = task.epicName;
          }

          if (task.status) {
            option.status = task.status;
          }

          options.push(option);
        });
      });

      selection.sort((a, b) => a.name.localeCompare(b.name));

      return { openTaskOptions: options, epicSelectionOptions: selection };
    }, [taskGroups]);

    const optionCatalog = useMemo<UiOptionCatalog>(
      () => ({
        ...uiOptionCatalog,
        epicTaskOptions: openTaskOptions,
        taskEpicOptions: epicSelectionOptions,
      }),
      [uiOptionCatalog, openTaskOptions, epicSelectionOptions],
    );

    const handleCreateEntity = useCallback(
      async ({
        entityType,
        values,
        artifactId,
      }: {
        entityType: string;
        values: Record<string, FieldValue>;
        artifactId?: string | null;
      }) => {
        if (!projectId) {
          return;
        }
        try {
          if (artifactId) {
            await apiService.updateProjectEntity(projectId, artifactId, {
              type: entityType,
              values,
            });
          } else {
            await apiService.createProjectEntity(projectId, {
              type: entityType,
              values,
            });
          }
          await loadResolved({ silent: true });
          if (isMountedRef.current) {
            setError(null);
          }
        } catch (err) {
          console.error("[TasksDiagram] failed to create entity", err);
          if (isMountedRef.current) {
            setError(err instanceof Error ? err.message : "Failed to create entity");
          }
        }
      },
      [projectId, loadResolved],
    );

    const handleEpicSubmit = useCallback(
      (payload: { entityType: string; values: Record<string, FieldValue> }) => {
        const valuesWithContext: Record<string, FieldValue> = { ...payload.values };
        const incomingId =
          typeof valuesWithContext.id === "string" ? valuesWithContext.id.trim() : "";
        const incomingSlug =
          typeof valuesWithContext.slug === "string" ? valuesWithContext.slug.trim() : "";
        const resolvedIdentifier = incomingId || incomingSlug || activeEpicDraftIdentifier || "";

        if (resolvedIdentifier) {
          valuesWithContext.id = resolvedIdentifier;
          valuesWithContext.slug = resolvedIdentifier;
        }

        return handleCreateEntity({
          entityType: payload.entityType,
          values: valuesWithContext,
          artifactId: activeEpicArtifactId ?? null,
        });
      },
      [handleCreateEntity, activeEpicArtifactId, activeEpicDraftIdentifier],
    );

    const epicLookup = useMemo(() => {
      const map = new Map<string, NormalizedTaskGroup>();
      taskGroups.forEach((group) => {
        if (group.type !== "epic") return;
        const identifiers = [group.id, group.rawId ?? "", group.artifactId ?? ""];
        identifiers.filter(Boolean).forEach((identifier) => {
          map.set(identifier, group);
          map.set(slugify(identifier), group);
        });
      });
      return map;
    }, [taskGroups]);

    const handleTaskSubmit = useCallback(
      (payload: { entityType: string; values: Record<string, FieldValue> }) => {
        const valuesWithContext: Record<string, FieldValue> = { ...payload.values };

        const coerceSingle = (value: FieldValue | undefined): string =>
          coerceFieldValueToString(value).trim();

        const rawEpicValue =
          coerceSingle(valuesWithContext.epicId) ||
          coerceSingle(valuesWithContext.epic) ||
          (typeof taskModalState.presetEpicId === "string" ? taskModalState.presetEpicId : "");

        delete valuesWithContext.epic;
        delete valuesWithContext.epicId;
        delete valuesWithContext.epicName;

        const trimmedEpicId = rawEpicValue.trim();

        if (trimmedEpicId.length > 0) {
          const resolvedEpic =
            epicLookup.get(trimmedEpicId) ?? epicLookup.get(slugify(trimmedEpicId));
          const finalEpicId = resolvedEpic
            ? (resolvedEpic.rawId ?? resolvedEpic.id)
            : trimmedEpicId;
          const finalEpicName = resolvedEpic?.name ?? trimmedEpicId;

          valuesWithContext.epicId = finalEpicId;
          valuesWithContext.epic = finalEpicId;
          valuesWithContext.epicName = finalEpicName;
        }

        const targetId = taskModalState.targetArtifactId;
        if (targetId) {
          valuesWithContext.id = targetId;
        }

        return handleCreateEntity({
          entityType: payload.entityType,
          values: valuesWithContext,
          artifactId: targetId,
        });
      },
      [
        taskModalState.presetEpicId,
        taskModalState.targetArtifactId,
        epicLookup,
        handleCreateEntity,
      ],
    );

    const openTaskModal = useCallback((group?: NormalizedTaskGroup | null) => {
      if (group && group.type === "epic") {
        const epicIdentifier = group.rawId ?? group.id;
        setTaskModalState({
          open: true,
          presetEpicId: epicIdentifier,
          initialValues: { epicId: epicIdentifier },
          mode: "create",
          targetArtifactId: null,
        });
      } else {
        setTaskModalState({
          open: true,
          presetEpicId: null,
          initialValues: { epicId: "" },
          mode: "create",
          targetArtifactId: null,
        });
      }
      setError(null);
    }, []);

    const closeTaskModal = useCallback(() => {
      setTaskModalState({
        open: false,
        presetEpicId: null,
        initialValues: null,
        mode: "create",
        targetArtifactId: null,
      });
      setError(null);
    }, []);

    const handleExistingTaskClick = useCallback((task: NormalizedTask) => {
      const initialValues: Record<string, FieldValue> = {
        name: task.name ?? task.rawId ?? "",
        epicId: task.epicId ?? "",
      };
      if (task.description) {
        initialValues.description = task.description;
      }

      setTaskModalState({
        open: true,
        presetEpicId: task.epicId ?? null,
        initialValues,
        mode: "edit",
        targetArtifactId: task.artifactId ?? null,
      });
      setError(null);
    }, []);

    const handleEpicCreate = useCallback(() => {
      setEpicModalState({
        open: true,
        initialValues: { name: "", description: "" },
        mode: "create",
        targetArtifactId: null,
        draftIdentifier: null,
      });
      setError(null);
    }, []);

    const handleEpicEdit = useCallback((group: NormalizedTaskGroup) => {
      if (group.type !== "epic") return;

      const initialValues: Record<string, FieldValue> = {
        name: group.name,
        description: group.description ?? "",
      };

      setEpicModalState({
        open: true,
        initialValues,
        mode: "edit",
        targetArtifactId: group.artifactId ?? null,
        draftIdentifier: group.rawId ?? group.id ?? null,
      });
      setError(null);
    }, []);

    const closeEpicModal = useCallback(() => {
      setEpicModalState({
        open: false,
        initialValues: null,
        mode: "create",
        targetArtifactId: null,
        draftIdentifier: null,
      });
      setError(null);
    }, []);

    const activeGroup = useMemo(
      () => taskGroups.find((group) => group.id === activeTab) ?? taskGroups[0] ?? null,
      [taskGroups, activeTab],
    );

    useImperativeHandle(
      ref,
      () => ({
        openTaskCreator: () => openTaskModal(activeGroup),
        openEpicCreator: handleEpicCreate,
      }),
      [activeGroup, openTaskModal, handleEpicCreate],
    );

    const presetEpicGroup = useMemo(() => {
      if (!taskModalState.open || !taskModalState.presetEpicId) {
        return null;
      }
      return (
        epicLookup.get(taskModalState.presetEpicId) ??
        epicLookup.get(slugify(taskModalState.presetEpicId)) ??
        null
      );
    }, [taskModalState, epicLookup]);

    const taskModalTitle = useMemo(() => {
      if (taskModalState.mode === "edit") {
        const taskName = coerceFieldValueToString(taskModalState.initialValues?.name).trim();
        return taskName.length > 0 ? `Update Task: ${taskName}` : "Update Task";
      }
      return "Add Task";
    }, [taskModalState.mode, taskModalState.initialValues]);

    const taskModalDescription = useMemo(() => {
      return taskModalState.mode === "edit"
        ? "Review and update the selected task. Changes will be saved to the project."
        : "Provide the details needed to add a new task.";
    }, [taskModalState.mode]);

    const epicModalInitialValues = useMemo<Record<string, FieldValue>>(
      () => epicModalState.initialValues ?? { name: "", description: "" },
      [epicModalState.initialValues],
    );

    const epicModalTitle = useMemo(() => {
      if (epicModalState.mode === "edit") {
        const epicName = coerceFieldValueToString(epicModalState.initialValues?.name).trim();
        return epicName.length > 0 ? `Update Epic: ${epicName}` : "Update Epic";
      }
      return "Add Epic";
    }, [epicModalState.mode, epicModalState.initialValues]);

    const epicModalDescription = useMemo(() => {
      return epicModalState.mode === "edit"
        ? "Modify the epic details and save your updates."
        : "Provide the details needed to add a new epic.";
    }, [epicModalState.mode]);

    const taskModalInitialValues = useMemo<Record<string, FieldValue>>(() => {
      if (taskModalState.initialValues) {
        return taskModalState.initialValues;
      }

      if (presetEpicGroup) {
        return { epicId: presetEpicGroup.rawId ?? presetEpicGroup.id };
      }

      if (taskModalState.presetEpicId) {
        return { epicId: taskModalState.presetEpicId };
      }

      return { epicId: "" };
    }, [taskModalState.initialValues, presetEpicGroup, taskModalState.presetEpicId]);

    const tabItems = useMemo<LayoutTabItem[]>(
      () =>
        taskGroups.map((group) => {
          const panelProps: TaskGroupPanelProps = {
            group,
            isActive: activeTab === group.id,
            onTaskClick: handleExistingTaskClick,
            ...(group.type === "epic" ? { onEpicEdit: handleEpicEdit } : {}),
          } as TaskGroupPanelProps;

          return {
            id: group.id,
            label: group.type === "unscoped" ? "Unscoped" : group.name,
            badge: String(group.tasks.length),
            content: (
              <div className="h-full px-6 py-6">
                <TaskGroupPanel {...panelProps} />
              </div>
            ),
          } satisfies LayoutTabItem;
        }),
      [taskGroups, activeTab, handleExistingTaskClick, handleEpicEdit],
    );

    if (!projectId) {
      return (
        <div className={`flex items-center justify-center h-full ${className}`}>
          <p className="text-gray-600">Select a project to view tasks.</p>
        </div>
      );
    }

    return (
      <div className={`flex h-full flex-col bg-white dark:bg-graphite-950 ${className}`}>
        <div className="flex-1 min-h-0 overflow-hidden">
          {error && (
            <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-1 h-4 w-4 flex-shrink-0" />
                <div>
                  <p className="font-medium">Unable to load tasks</p>
                  <p className="text-xs text-red-600 dark:text-red-200/90">{error}</p>
                </div>
              </div>
            </div>
          )}

          <LayoutTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            tabs={tabItems}
            className="flex h-full min-h-0 flex-col"
          />
        </div>

        {epicModalState.open && (
          <AddEntityModal
            open={epicModalState.open}
            entityType="epic"
            groupLabel="Epics"
            optionCatalog={optionCatalog}
            onClose={closeEpicModal}
            onSubmit={handleEpicSubmit}
            initialValues={epicModalInitialValues}
            titleOverride={epicModalTitle}
            descriptionOverride={epicModalDescription}
            mode={epicModalState.mode}
          />
        )}

        {taskModalState.open && (
          <AddEntityModal
            open={taskModalState.open}
            entityType="task"
            groupLabel={presetEpicGroup ? `Task for ${presetEpicGroup.name}` : "Task"}
            optionCatalog={optionCatalog}
            onClose={closeTaskModal}
            onSubmit={handleTaskSubmit}
            initialValues={taskModalInitialValues}
            titleOverride={taskModalTitle}
            descriptionOverride={taskModalDescription}
            mode={taskModalState.mode}
          />
        )}
      </div>
    );
  },
);

TasksDiagram.displayName = "TasksDiagram";

export default TasksDiagram;
