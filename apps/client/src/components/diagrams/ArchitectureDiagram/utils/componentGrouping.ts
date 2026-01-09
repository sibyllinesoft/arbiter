export type TreeMode = "components" | "routes";

export interface GroupedComponentItem {
  name: string;
  data: any;
}

export interface GroupedComponentGroup {
  key: string;
  label: string;
  type: string;
  layout: "grid" | "tree";
  treeMode?: TreeMode;
  items: GroupedComponentItem[];
}

const TYPE_CONFIG: Record<string, { label: string; layout: "grid" | "tree"; treeMode?: TreeMode }> =
  {
    service: { label: "Services", layout: "grid" },
    frontend: { label: "Frontends", layout: "grid" },
    package: { label: "Packages", layout: "grid" },
    tool: { label: "Tools", layout: "grid" },
    route: { label: "Routes", layout: "grid" },
    view: { label: "Views", layout: "grid" },
    component: { label: "Components", layout: "grid" },
    infrastructure: { label: "Infrastructure", layout: "grid" },
    database: { label: "Databases", layout: "grid" },
    flow: { label: "Flows", layout: "grid" },
    capability: { label: "Capabilities", layout: "grid" },
    group: { label: "Groups", layout: "grid" },
    task: { label: "Tasks", layout: "grid" },
    other: { label: "Other", layout: "grid" },
  };

const getTypeConfig = (type: string) => TYPE_CONFIG[type] ?? TYPE_CONFIG.other;

const CUE_FILE_REGEX_CHECK = /\.cue$/i;

/** Resolve artifact ID from an item */
function resolveArtifactId(item: unknown): string | undefined {
  if (!item || typeof item !== "object") {
    return undefined;
  }
  const candidateSources: unknown[] = [
    (item as Record<string, unknown>).artifactId,
    (item as Record<string, unknown>).artifact_id,
    (item as Record<string, unknown>).id,
  ];
  const metadata = (item as Record<string, unknown>).metadata;
  if (metadata && typeof metadata === "object") {
    candidateSources.push(
      (metadata as Record<string, unknown>).artifactId,
      (metadata as Record<string, unknown>).artifact_id,
      (metadata as Record<string, unknown>).id,
    );
  }
  for (const candidate of candidateSources) {
    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }
  return undefined;
}

/** Check if item is in the removed set */
function isRemovedItem(item: unknown, removedArtifactIds: Set<string>): boolean {
  if (!removedArtifactIds || removedArtifactIds.size === 0) {
    return false;
  }
  const candidateId = resolveArtifactId(item);
  return candidateId ? removedArtifactIds.has(candidateId) : false;
}

/** Check if item should be excluded from diagram */
function shouldExcludeFromDiagram(item: any, removedArtifactIds: Set<string>): boolean {
  if (isRemovedItem(item, removedArtifactIds)) {
    return true;
  }
  const candidates = [
    item?.metadata?.filePath,
    item?.metadata?.sourceFile,
    item?.filePath,
    item?.sourceFile,
  ]
    .filter(Boolean)
    .map((path) => String(path));

  return candidates.some((path) => CUE_FILE_REGEX_CHECK.test(path));
}

/** Enrich data with type for grouping */
function enrichDataForGrouping(data: any, enforcedType: string) {
  return {
    ...data,
    type: data.type || enforcedType,
    metadata: {
      ...(data.metadata || {}),
    },
  };
}

/** Normalize task collection to array */
function normalizeTaskCollection(source: unknown): any[] {
  if (Array.isArray(source)) {
    return source;
  }
  if (source && typeof source === "object") {
    return Object.values(source as Record<string, any>);
  }
  return [];
}

export const normalizeRelativePath = (
  filePath: string | undefined,
  packageRoot: string,
): string => {
  if (!filePath) return "";
  const normalizedFile = filePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!packageRoot) return normalizedFile;

  const normalizedRoot = packageRoot.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!normalizedRoot) return normalizedFile;

  if (normalizedFile.startsWith(normalizedRoot)) {
    const trimmed = normalizedFile.slice(normalizedRoot.length);
    return trimmed.replace(/^\/+/, "");
  }

  return normalizedFile;
};

const getComponentType = (data: any, name: string): string => {
  const toLowerString = (value: unknown): string => String(value || "").toLowerCase();
  const rawType = toLowerString(data.type || data.metadata?.type);
  const language = toLowerString(data.metadata?.language);
  const framework = toLowerString(data.metadata?.framework);
  const detectedType = toLowerString(data.metadata?.detectedType);

  if (detectedType === "tool" || detectedType === "build_tool") return "tool";
  if (detectedType === "frontend" || detectedType === "mobile") return "frontend";
  if (detectedType === "web_service") return "service";

  if (rawType.includes("service")) return "service";
  if (["package", "module", "library"].includes(rawType)) return "package";
  if (["tool", "cli", "binary"].includes(rawType)) return "tool";
  if (["deployment", "infrastructure"].includes(rawType)) return "infrastructure";
  if (rawType === "database") return "database";
  if (rawType === "frontend" || rawType === "mobile") return "frontend";
  if (rawType === "route") {
    const routerType = toLowerString(data.metadata?.routerType);
    if (routerType && routerType !== "tsoa") {
      return "view";
    }
    return "route";
  }
  if (rawType === "component") return "component";

  if (language && ["javascript", "typescript", "tsx", "jsx"].includes(language)) {
    if (data.metadata?.routerType) return "view";
    if (framework.includes("react") || framework.includes("next")) return "view";
  }

  if (data.metadata?.containerImage || data.metadata?.compose) return "service";
  if (data.metadata?.kubernetes || data.metadata?.terraform) return "infrastructure";

  if (name.includes("@")) return "package";

  return "component";
};

export const computeGroupedComponents = (
  projectData: any,
  removedArtifactIds: Set<string> = new Set(),
): GroupedComponentGroup[] => {
  const groups = new Map<string, GroupedComponentGroup>();
  const recordedTaskKeys = new Set<string>();

  const ensureGroup = (type: string): GroupedComponentGroup => {
    const config = getTypeConfig(type)!;
    if (!groups.has(config.label)) {
      const baseGroup: GroupedComponentGroup = {
        key: type,
        label: config.label,
        type,
        layout: config.layout,
        items: [],
      };
      if (config.treeMode !== undefined) {
        baseGroup.treeMode = config.treeMode;
      }
      groups.set(config.label, baseGroup);
    }
    return groups.get(config.label)!;
  };

  const addToGroup = (type: string, name: string, data: any) => {
    if (!type) return;
    if (isRemovedItem(data, removedArtifactIds)) return;
    const group = ensureGroup(type);
    group.items.push({ name, data });
  };

  const registerTask = (
    rawTask: any,
    fallbackName: string,
    context?: { groupId?: string; groupName?: string },
  ) => {
    if (!rawTask && typeof rawTask !== "string") {
      return;
    }

    const taskData = typeof rawTask === "string" ? { name: rawTask } : { ...rawTask };
    if (shouldExcludeFromDiagram(taskData, removedArtifactIds)) {
      return;
    }
    const metadata = (taskData.metadata ?? {}) as Record<string, unknown>;

    const identifierCandidates = [
      taskData.id,
      metadata.id,
      taskData.artifactId,
      metadata.artifactId,
      metadata.artifact_id,
    ]
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter(Boolean);

    const dedupeKey = identifierCandidates[0] || fallbackName;
    if (dedupeKey && recordedTaskKeys.has(dedupeKey)) {
      return;
    }

    const taskName =
      (typeof taskData.name === "string" && taskData.name.trim().length > 0
        ? taskData.name.trim()
        : undefined) ??
      dedupeKey ??
      fallbackName ??
      `Task ${recordedTaskKeys.size + 1}`;

    const statusCandidates = [taskData.status, taskData.state, metadata.status, metadata.state]
      .map((value) => (typeof value === "string" ? value.toLowerCase() : ""))
      .filter(Boolean);

    const completedFlag =
      taskData.completed === true ||
      taskData.done === true ||
      taskData.isCompleted === true ||
      metadata.completed === true ||
      statusCandidates.includes("completed");

    if (completedFlag) {
      return;
    }

    const enrichedTask = enrichDataForGrouping(
      {
        ...taskData,
        name: taskName,
        metadata: {
          ...(metadata || {}),
          ...(context?.groupId ? { groupId: context.groupId } : {}),
          ...(context?.groupName ? { groupName: context.groupName } : {}),
        },
      },
      "task",
    );

    addToGroup("task", taskName, enrichedTask);

    if (dedupeKey) {
      recordedTaskKeys.add(dedupeKey);
    }
  };

  if (projectData) {
    const services = projectData.spec?.services || projectData.services || {};
    const databases = projectData.spec?.databases || projectData.databases || {};
    const components = projectData.spec?.components || projectData.components || {};
    const routes = projectData.spec?.ui?.routes || projectData.ui?.routes || [];
    const frontendPackages = projectData.spec?.frontend?.packages || [];

    const processEntry = (name: string, originalData: any) => {
      if (!originalData) return;
      if (shouldExcludeFromDiagram(originalData, removedArtifactIds)) return;
      const type = getComponentType(originalData, name);
      const data = enrichDataForGrouping(originalData, type);
      addToGroup(type, name, data);
    };

    Object.entries(services).forEach(([name, data]) => {
      processEntry(name, data);
    });

    Object.entries(databases).forEach(([name, data]) => {
      if (!data) return;
      const databaseData = enrichDataForGrouping(data, "database");
      if (shouldExcludeFromDiagram(databaseData, removedArtifactIds)) return;
      addToGroup("database", name, databaseData);
    });

    Object.entries(components).forEach(([name, data]) => {
      processEntry(name, data);
    });

    (routes as any[]).forEach((route) => {
      if (!route) return;
      const name = route.id || route.name || route.path || "route";
      const baseMetadata = route.metadata || {};
      const routerType = baseMetadata.routerType;
      const derivedType = routerType && routerType !== "tsoa" ? "view" : "route";
      const routeData = {
        ...route,
        name: route.name || route.path || name,
        metadata: baseMetadata,
        type: derivedType,
      };
      if (shouldExcludeFromDiagram(routeData, removedArtifactIds)) return;
      const type = getComponentType(routeData, name);
      addToGroup(type, name, routeData);
    });

    frontendPackages.forEach((pkg: any) => {
      const packageName = pkg.packageName || pkg.name || "frontend";
      const packageRoot = pkg.packageRoot || pkg.root || ".";

      const frontendSummary = enrichDataForGrouping(
        {
          name: packageName,
          description:
            pkg.description ||
            pkg.summary ||
            `Frontend package located at ${packageRoot || "project root"}`,
          metadata: {
            ...(pkg.metadata || {}),
            packageName,
            packageRoot,
            frameworks: pkg.frameworks,
            framework: Array.isArray(pkg.frameworks) ? pkg.frameworks[0] : undefined,
            detectedType: "frontend",
            type: "frontend",
          },
        },
        "frontend",
      );

      addToGroup("frontend", packageName, frontendSummary);

      (pkg.components || []).forEach((component: any) => {
        const name = `${packageName}:${component.name}`;
        const relativeFilePath = normalizeRelativePath(component.filePath, packageRoot);
        const data = enrichDataForGrouping(
          {
            ...component,
            metadata: {
              ...component.metadata,
              packageName,
              packageRoot,
              filePath: relativeFilePath,
              displayLabel: component.name,
            },
          },
          "component",
        );
        if (shouldExcludeFromDiagram(data, removedArtifactIds)) return;
        addToGroup("component", name, data);
      });

      (pkg.routes || []).forEach((route: any) => {
        const name = `${packageName}:${route.path || route.filePath || "view"}`;
        const relativeFilePath = normalizeRelativePath(route.filePath, packageRoot);
        const displayLabel = route.path || route.filePath || route.name || name;
        const data = enrichDataForGrouping(
          {
            ...route,
            name: displayLabel,
            metadata: {
              ...route.metadata,
              packageName,
              packageRoot,
              routerType: route.routerType || "frontend",
              filePath: relativeFilePath,
              displayLabel,
            },
          },
          "view",
        );
        if (shouldExcludeFromDiagram(data, removedArtifactIds)) return;
        addToGroup("view", name, data);
      });
    });
  }

  const capabilitySource = projectData?.spec?.capabilities ?? projectData?.capabilities ?? [];
  const recordCapability = (raw: any, fallbackName: string, idx: number) => {
    if (!raw && typeof raw !== "string") return;
    const capabilityData = typeof raw === "string" ? { name: raw } : { ...raw };
    const capabilityName = String(capabilityData.name || fallbackName || `Capability ${idx + 1}`);

    if (!capabilityData.description && capabilityData.metadata?.description) {
      capabilityData.description = capabilityData.metadata.description;
    }

    if (!capabilityData.gherkin) {
      const fromMetadata = capabilityData.metadata?.gherkinSpec || capabilityData.metadata?.gherkin;
      if (typeof fromMetadata === "string" && fromMetadata.trim().length > 0) {
        capabilityData.gherkin = fromMetadata;
      }
    }

    const enriched = enrichDataForGrouping(
      {
        ...capabilityData,
        name: capabilityName,
      },
      "capability",
    );
    addToGroup("capability", capabilityName, enriched);
  };

  if (Array.isArray(capabilitySource)) {
    capabilitySource.forEach((capability, index) => {
      recordCapability(capability, `Capability ${index + 1}`, index);
    });
  } else if (capabilitySource && typeof capabilitySource === "object") {
    Object.entries(capabilitySource as Record<string, any>).forEach(([key, capability], index) => {
      recordCapability(capability, key || `Capability ${index + 1}`, index);
    });
  }

  const flowsSource = projectData?.spec?.flows ?? projectData?.flows ?? [];
  const flowsArray = Array.isArray(flowsSource)
    ? flowsSource
    : flowsSource && typeof flowsSource === "object"
      ? Object.values(flowsSource as Record<string, any>)
      : [];
  flowsArray.forEach((flow, index) => {
    if (!flow && typeof flow !== "string") return;
    const flowData = typeof flow === "string" ? { name: flow } : { ...flow };
    const flowName = String(flowData.name || flowData.id || `Flow ${index + 1}`);
    const enriched = enrichDataForGrouping(
      {
        ...flowData,
        name: flowName,
      },
      "flow",
    );
    addToGroup("flow", flowName, enriched);
  });

  const groupSource = projectData?.spec?.groups ?? projectData?.groups ?? [];
  const groupEntries: Array<{ key: string; value: any; index: number }> = [];
  if (Array.isArray(groupSource)) {
    groupSource.forEach((value, index) => {
      const key =
        (value && typeof value === "object" && (value.id || value.name)) || `group-${index + 1}`;
      groupEntries.push({ key: String(key), value, index });
    });
  } else if (groupSource && typeof groupSource === "object") {
    Object.entries(groupSource as Record<string, any>).forEach(([key, value], index) => {
      groupEntries.push({ key, value, index });
    });
  }

  groupEntries.forEach(({ key, value, index }) => {
    if (!value && typeof value !== "string") return;
    const groupData = typeof value === "string" ? { id: key, name: value } : { ...value };
    const groupId = String(groupData.id || key || `group-${index + 1}`);
    const groupName = String(groupData.name || groupId || `Group ${index + 1}`);
    const enrichedGroup = enrichDataForGrouping(
      {
        ...groupData,
        id: groupId,
        name: groupName,
        metadata: {
          ...(groupData.metadata || {}),
          groupId,
        },
      },
      "group",
    );
    addToGroup("group", groupName, enrichedGroup);

    const tasksSource = groupData.tasks ?? [];
    const tasksArray = Array.isArray(tasksSource)
      ? tasksSource
      : tasksSource && typeof tasksSource === "object"
        ? Object.values(tasksSource as Record<string, any>)
        : [];

    tasksArray.forEach((task, taskIndex) => {
      registerTask(task, `${groupName} Task ${taskIndex + 1}`, { groupId, groupName });
    });
  });

  const standaloneSpecTasks = normalizeTaskCollection(projectData?.spec?.tasks);
  standaloneSpecTasks.forEach((task, index) => {
    registerTask(task, `Task ${index + 1}`);
  });

  const projectLevelTasks = normalizeTaskCollection(projectData?.tasks);
  projectLevelTasks.forEach((task, index) => {
    registerTask(task, `Task ${standaloneSpecTasks.length + index + 1}`);
  });

  Object.keys(TYPE_CONFIG)
    .filter((type) => type !== "component")
    .forEach((type) => {
      ensureGroup(type);
    });

  const dedupedGroups = Array.from(groups.values())
    .map((group) => {
      const seenDisplayNames = new Set<string>();
      const uniqueItems = group.items.filter(({ name, data }) => {
        const displayName = data.name || name;
        if (!displayName) return false;
        if (seenDisplayNames.has(displayName)) return false;
        seenDisplayNames.add(displayName);
        return true;
      });

      return { ...group, items: uniqueItems };
    })
    .filter((group) => group.type !== "component");

  return dedupedGroups.sort((a, b) => {
    const diff = b.items.length - a.items.length;
    if (diff !== 0) {
      return diff;
    }
    return a.label.localeCompare(b.label);
  });
};
