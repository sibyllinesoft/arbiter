import { getComponentType } from "./component-type-detection";
import {
  normalizeRelativePath as normalizeRelativePathImpl,
  processComponents,
  processDatabases,
  processFrontendPackages,
  processRoutes,
  processServices,
} from "./data-processors";

type TreeMode = "components" | "routes";

interface TypeDisplayConfig {
  label: string;
  layout: "grid" | "tree";
  treeMode?: TreeMode;
}

const TYPE_CONFIG: Record<string, TypeDisplayConfig> = {
  service: { label: "Services", layout: "grid" },
  frontend: { label: "Frontends", layout: "grid" },
  package: { label: "Packages", layout: "grid" },
  tool: { label: "Tools", layout: "grid" },
  route: { label: "Routes", layout: "tree", treeMode: "routes" },
  view: { label: "Views", layout: "tree", treeMode: "routes" },
  component: { label: "Components", layout: "grid" },
  infrastructure: { label: "Infrastructure", layout: "tree", treeMode: "components" },
  database: { label: "Infrastructure", layout: "tree", treeMode: "components" },
  other: { label: "Other", layout: "grid" },
};

const DESIRED_GROUP_ORDER = [
  "Frontends",
  "Services",
  "Packages",
  "Tools",
  "Routes",
  "Views",
  "Components",
  "Infrastructure",
  "Other",
];

const getTypeConfig = (type: string): TypeDisplayConfig =>
  (TYPE_CONFIG[type] ?? TYPE_CONFIG.other) as TypeDisplayConfig;

/** Re-export normalizeRelativePath for backward compatibility */
export const normalizeRelativePath = normalizeRelativePathImpl;

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

/** Create an empty group with the given configuration */
function createGroup(type: string): GroupedComponentGroup {
  const config = getTypeConfig(type);
  const baseGroup: GroupedComponentGroup = {
    key: type,
    label: config.label,
    type,
    layout: config.layout,
    items: [],
  };
  if (config.treeMode) {
    baseGroup.treeMode = config.treeMode;
  }
  return baseGroup;
}

/** Deduplicate and filter groups */
function deduplicateGroups(groups: Map<string, GroupedComponentGroup>): GroupedComponentGroup[] {
  return Array.from(groups.values())
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
    .filter((group) => group.items.length > 0);
}

/** Order groups according to desired order */
function orderGroups(dedupedGroups: GroupedComponentGroup[]): GroupedComponentGroup[] {
  const orderedGroups: GroupedComponentGroup[] = [];
  const remainingGroups = new Map(dedupedGroups.map((group) => [group.label, group] as const));

  DESIRED_GROUP_ORDER.forEach((label) => {
    if (remainingGroups.has(label)) {
      orderedGroups.push(remainingGroups.get(label)!);
      remainingGroups.delete(label);
    }
  });

  orderedGroups.push(...remainingGroups.values());
  return orderedGroups;
}

export { getComponentType };

/** Extract packages data from project structure */
const extractServices = (projectData: any): Record<string, unknown> =>
  projectData?.spec?.packages || projectData?.packages || {};

/** Extract databases data from project structure */
const extractDatabases = (projectData: any): Record<string, unknown> =>
  projectData?.spec?.databases || projectData?.databases || {};

/** Extract components data from project structure */
const extractComponents = (projectData: any): Record<string, unknown> =>
  projectData?.spec?.components || projectData?.components || {};

/** Extract routes data from project structure */
const extractRoutes = (projectData: any): unknown[] =>
  projectData?.spec?.ui?.routes || projectData?.ui?.routes || [];

/** Extract frontend packages from project structure */
const extractFrontendPackages = (projectData: any): unknown[] =>
  projectData?.spec?.frontend?.packages || [];

/** Create a group adder function for the groups map */
function createGroupAdder(groups: Map<string, GroupedComponentGroup>) {
  return (type: string, name: string, data: any) => {
    if (!type) return;
    const config = getTypeConfig(type);
    if (!groups.has(config.label)) {
      groups.set(config.label, createGroup(type));
    }
    groups.get(config.label)!.items.push({ name, data });
  };
}

/** Process all project data and populate groups */
function populateGroups(
  projectData: any,
  addToGroup: (type: string, name: string, data: any) => void,
): void {
  if (!projectData) return;

  processServices(extractServices(projectData), addToGroup);
  processDatabases(extractDatabases(projectData), addToGroup);
  processComponents(extractComponents(projectData), addToGroup);
  processRoutes(extractRoutes(projectData), addToGroup);
  processFrontendPackages(extractFrontendPackages(projectData), addToGroup);
}

export const computeGroupedComponents = (projectData: any): GroupedComponentGroup[] => {
  const groups = new Map<string, GroupedComponentGroup>();
  const addToGroup = createGroupAdder(groups);

  populateGroups(projectData, addToGroup);

  return orderGroups(deduplicateGroups(groups));
};
