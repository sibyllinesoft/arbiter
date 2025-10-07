import {
  AddEntityModal,
  DEFAULT_UI_OPTION_CATALOG,
  type EpicTaskOption,
  type FieldValue,
  type TaskEpicOption,
  type UiOptionCatalog,
  coerceFieldValueToString,
} from "@/components/modals/AddEntityModal";
import { Button, Card, type TabItem, Tabs } from "@/design-system";
import { apiService } from "@/services/api";
import { AlertCircle, Plus } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MermaidRenderer from "./MermaidRenderer";

interface TasksDiagramProps {
  projectId: string;
  className?: string;
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
  /** Execution order if supplied */
  order: number;
  /** Dependency strings as provided */
  dependsOn: string[];
  /** Mermaid node identifier */
  nodeId: string;
  /** Mermaid class name derived from status */
  statusClass: string;
  /** Whether the task appears to be completed */
  completed: boolean;
  /** Keys that can resolve this task during dependency matching */
  matchKeys: string[];
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

interface TaskGroupChart {
  id: string;
  name: string;
  chart: string;
  missingDependencies: string[];
}

const STATUS_STYLES: Record<string, string> = {
  completed: "fill:#dcfce7,stroke:#15803d,color:#166534,font-weight:bold",
  in_progress: "fill:#bfdbfe,stroke:#1d4ed8,color:#1e3a8a,font-weight:bold",
  blocked: "fill:#fee2e2,stroke:#dc2626,color:#991b1b,font-weight:bold",
  at_risk: "fill:#fef3c7,stroke:#d97706,color:#92400e,font-weight:bold",
  todo: "fill:#f1f5f9,stroke:#94a3b8,color:#475569",
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

const coerceOrder = (value: unknown, fallback: number): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return fallback;
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

  const order = coerceOrder(taskRecord["order"], coerceOrder(metadata["order"], index));

  const normalizedTask: NormalizedTask = {
    rawId: rawId ?? fallbackBase,
    name: name ?? fallbackBase,
    slug: slugValue || nodeIdBase,
    order,
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

    const rawEpicId =
      getString(epicRecord, "id") ??
      getString(epicRecord, "slug") ??
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

    const slugBase = rawEpicId ?? epicName ?? `${key || "epic"}-${index + 1}`;
    const epicSlug = slugify(slugBase) || `epic-${index + 1}`;

    const matchKeys = Array.from(
      new Set(
        [
          rawEpicId,
          epicName,
          normalizeString(key),
          getString(epicRecord, "slug"),
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
      const orderA = Number.isFinite(a.order) ? a.order : 0;
      const orderB = Number.isFinite(b.order) ? b.order : 0;
      if (orderA === orderB) {
        return a.name.localeCompare(b.name);
      }
      return orderA - orderB;
    });
  });

  return allGroups;
};

const generateMermaidChart = (group: NormalizedTaskGroup, groupIndex: number): TaskGroupChart => {
  const lines: string[] = ["flowchart TD"];
  const prefix = group.type === "epic" ? "Epic" : "Unscoped";
  const subgraphId = `${prefix}_${groupIndex}`;
  const label = escapeMermaidLabel(group.name);

  const missingDependencies: string[] = [];

  if (!group.tasks.length) {
    lines.push(`  subgraph ${subgraphId}["${label}"]`);
    const placeholderId = `${subgraphId}_empty`;
    lines.push(`    ${placeholderId}["No tasks defined"]`);
    lines.push("  end");
    lines.push(`  classDef ${FALLBACK_STATUS_CLASS} ${STATUS_STYLES[FALLBACK_STATUS_CLASS]};`);
    lines.push(`  class ${placeholderId} ${FALLBACK_STATUS_CLASS};`);

    return {
      id: group.id,
      name: group.name,
      chart: lines.join("\n"),
      missingDependencies,
    };
  }

  const matchMap = new Map<string, NormalizedTask>();

  group.tasks.forEach((task) => {
    task.matchKeys.forEach((key) => {
      if (!matchMap.has(key)) {
        matchMap.set(key, task);
      }
    });
  });

  lines.push(`  subgraph ${subgraphId}["${label}"]`);

  const usedClasses = new Set<string>();

  group.tasks.forEach((task) => {
    const labelParts: string[] = [escapeMermaidLabel(task.name)];

    if (task.status) {
      labelParts.push(`Status: ${escapeMermaidLabel(task.status)}`);
    }

    if (task.assignee) {
      labelParts.push(`Owner: ${escapeMermaidLabel(task.assignee)}`);
    }

    labelParts.push(`Order: ${Number.isFinite(task.order) ? task.order : "n/a"}`);

    if (task.priority) {
      labelParts.push(`Priority: ${escapeMermaidLabel(task.priority)}`);
    }

    const labelText = labelParts.join("<br/>");
    lines.push(`    ${task.nodeId}["${labelText}"]`);
    usedClasses.add(task.statusClass);
  });

  lines.push("  end");

  group.tasks.forEach((task) => {
    if (!task.dependsOn.length) {
      return;
    }

    const targetNode = task.nodeId;

    task.dependsOn.forEach((dep) => {
      const normalized = slugify(dep);
      const dependentTask = matchMap.get(normalized);

      if (dependentTask) {
        lines.push(`  ${dependentTask.nodeId} --> ${targetNode}`);
      } else {
        missingDependencies.push(`${task.name} depends on ${dep}`);
      }
    });
  });

  if (!usedClasses.size) {
    usedClasses.add(FALLBACK_STATUS_CLASS);
  }

  usedClasses.forEach((cls) => {
    const style = STATUS_STYLES[cls] ?? STATUS_STYLES[FALLBACK_STATUS_CLASS];
    lines.push(`  classDef ${cls} ${style};`);
  });

  group.tasks.forEach((task) => {
    lines.push(`  class ${task.nodeId} ${task.statusClass};`);
  });

  return {
    id: group.id,
    name: group.name,
    chart: lines.join("\n"),
    missingDependencies,
  };
};

interface TaskGroupPanelProps {
  group: NormalizedTaskGroup;
  chart?: TaskGroupChart;
}

function TaskGroupPanel({ group, chart }: TaskGroupPanelProps) {
  const hasTasks = group.tasks.length > 0;

  return (
    <div className="flex flex-col gap-4 pb-6">
      {group.type === "epic" && (
        <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-relaxed text-gray-700 dark:border-graphite-800 dark:bg-graphite-900/60 dark:text-graphite-200">
          {group.description ? (
            <p>{group.description}</p>
          ) : (
            <p className="italic text-gray-500 dark:text-graphite-400">
              No description provided for this epic yet.
            </p>
          )}
        </div>
      )}

      <Card className="space-y-4 bg-white p-6 dark:bg-graphite-950">
        {hasTasks ? (
          chart ? (
            <MermaidRenderer chart={chart.chart} />
          ) : (
            <div className="text-sm text-gray-500 dark:text-graphite-400">
              Unable to render tasks for this group.
            </div>
          )
        ) : (
          <p className="text-xs text-gray-500 dark:text-graphite-400">
            {group.type === "unscoped"
              ? "No unscoped tasks yet. Use Add Task to capture work that has not been assigned to an epic."
              : "No tasks have been added to this epic yet. Use Add Task to start planning the work."}
          </p>
        )}

        {hasTasks && chart?.missingDependencies.length ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-900/20 dark:text-amber-200">
            <p className="font-medium">Unresolved dependencies</p>
            <ul className="mt-1 list-disc list-inside space-y-1 text-xs sm:text-sm">
              {chart.missingDependencies.map((dependency, index) => (
                <li key={`${chart.id}-missing-${index}`}>{dependency}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

export const TasksDiagram: React.FC<TasksDiagramProps> = ({ projectId, className = "" }) => {
  const [resolved, setResolved] = useState<ResolvedSpec | null>(null);
  const [, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uiOptionCatalog, setUiOptionCatalog] =
    useState<UiOptionCatalog>(DEFAULT_UI_OPTION_CATALOG);
  const [isEpicModalOpen, setIsEpicModalOpen] = useState(false);
  const [taskModalState, setTaskModalState] = useState<{
    open: boolean;
    presetEpicId: string | null;
  }>({ open: false, presetEpicId: null });
  const [activeTab, setActiveTab] = useState<string>("unscoped");
  const isMountedRef = useRef(true);

  useEffect(() => {
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

  const chartsByGroupId = useMemo(() => {
    const map = new Map<string, TaskGroupChart>();
    taskGroups.forEach((group, index) => {
      map.set(group.id, generateMermaidChart(group, index));
    });
    return map;
  }, [taskGroups]);

  const { openTaskOptions, epicSelectionOptions } = useMemo(() => {
    const options: EpicTaskOption[] = [];
    const selection: TaskEpicOption[] = [];
    const seenTasks = new Set<string>();
    const seenEpics = new Set<string>();

    taskGroups.forEach((group) => {
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
    async ({ entityType, values }: { entityType: string; values: Record<string, FieldValue> }) => {
      if (!projectId) {
        return;
      }
      try {
        await apiService.createProjectEntity(projectId, {
          type: entityType,
          values,
        });
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
      return handleCreateEntity(payload);
    },
    [handleCreateEntity],
  );

  const epicLookup = useMemo(() => {
    const map = new Map<string, NormalizedTaskGroup>();
    taskGroups.forEach((group) => {
      if (group.type !== "epic") return;
      const identifiers = [group.id, group.rawId ?? ""];
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
        const finalEpicId = resolvedEpic ? (resolvedEpic.rawId ?? resolvedEpic.id) : trimmedEpicId;
        const finalEpicName = resolvedEpic?.name ?? trimmedEpicId;

        valuesWithContext.epicId = finalEpicId;
        valuesWithContext.epic = finalEpicId;
        valuesWithContext.epicName = finalEpicName;
      }

      return handleCreateEntity({ entityType: payload.entityType, values: valuesWithContext });
    },
    [taskModalState.presetEpicId, epicLookup, handleCreateEntity],
  );

  const openTaskModal = useCallback((group?: NormalizedTaskGroup | null) => {
    if (group && group.type === "epic") {
      setTaskModalState({ open: true, presetEpicId: group.rawId ?? group.id });
    } else {
      setTaskModalState({ open: true, presetEpicId: null });
    }
    setError(null);
  }, []);

  const closeTaskModal = useCallback(() => {
    setTaskModalState({ open: false, presetEpicId: null });
    setError(null);
  }, []);

  const activeGroup = useMemo(
    () => taskGroups.find((group) => group.id === activeTab) ?? taskGroups[0] ?? null,
    [taskGroups, activeTab],
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

  const tabItems = useMemo<TabItem[]>(
    () =>
      taskGroups.map((group) => {
        const chart = chartsByGroupId.get(group.id);
        return {
          id: group.id,
          label: group.type === "unscoped" ? "Unscoped" : group.name,
          badge: String(group.tasks.length),
          content: <TaskGroupPanel group={group} {...(chart ? { chart } : {})} />,
        } satisfies TabItem;
      }),
    [taskGroups, chartsByGroupId],
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
      <div className="flex flex-col gap-3 border-b border-gray-200 bg-white px-6 py-4 dark:border-graphite-800 dark:bg-graphite-950 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-graphite-25">
            Tasks Overview
          </h2>
          <p className="text-sm text-gray-600 dark:text-graphite-300">
            Track unscoped work and epic progress in one place.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => openTaskModal(activeGroup)}
          >
            Add Task
          </Button>
          <Button
            variant="secondary"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setIsEpicModalOpen(true)}
          >
            Add Epic
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-6 pb-6">
        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-400/50 dark:bg-red-900/30 dark:text-red-200">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-1 h-4 w-4 flex-shrink-0" />
              <div>
                <p className="font-medium">Unable to load tasks</p>
                <p className="text-xs text-red-600 dark:text-red-200/90">{error}</p>
              </div>
            </div>
          </div>
        )}

        <Tabs
          items={tabItems}
          activeTab={activeTab}
          onChange={setActiveTab}
          variant="underline"
          size="md"
          scrollable
          showScrollButtons
          className="flex h-full flex-col"
          contentClassName="flex-1 overflow-y-auto pb-6 pr-1"
        />
      </div>

      {isEpicModalOpen && (
        <AddEntityModal
          open={isEpicModalOpen}
          entityType="epic"
          groupLabel="Epics"
          optionCatalog={optionCatalog}
          onClose={() => setIsEpicModalOpen(false)}
          onSubmit={handleEpicSubmit}
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
          initialValues={
            presetEpicGroup
              ? { epicId: presetEpicGroup.rawId ?? presetEpicGroup.id }
              : taskModalState.presetEpicId
                ? { epicId: taskModalState.presetEpicId }
                : { epicId: "" }
          }
        />
      )}
    </div>
  );
};

export default TasksDiagram;
