import { useVirtualizer } from "@tanstack/react-virtual";
import { clsx } from "clsx";
import React, { useEffect, useMemo, useRef, useState } from "react";

interface RouteEndpointDocumentation {
  summary?: string;
  description?: string;
  returns?: string;
  remarks?: string[];
  examples?: string[];
  deprecated?: string | boolean;
}

interface RouteEndpointParameter {
  name: string;
  type?: string;
  optional: boolean;
  description?: string;
  decorators?: string[];
}

interface RouteEndpointResponse {
  status?: string;
  description?: string;
  decorator: "SuccessResponse" | "Response";
}

interface RouteEndpoint {
  method: string;
  path?: string;
  fullPath?: string;
  controller?: string;
  handler?: string;
  signature: string;
  returnType?: string;
  documentation?: RouteEndpointDocumentation;
  parameters: RouteEndpointParameter[];
  responses: RouteEndpointResponse[];
  tags?: string[];
  source?: { line: number };
}

interface FrontendPackage {
  packageName: string;
  packageRoot: string;
  packageJsonPath?: string;
  frameworks: string[];
  components?: Array<{
    name: string;
    filePath: string;
    framework: string;
    description?: string;
    props?: Array<{
      name: string;
      type: string;
      required: boolean;
      description?: string;
    }>;
  }>;
  routes?: Array<{
    path: string;
    filePath?: string;
    treePath?: string;
    routerType?: string;
    displayLabel?: string;
    httpMethods?: string[];
    endpoints?: RouteEndpoint[];
    metadata?: Record<string, any>;
    isBaseRoute?: boolean;
  }>;
}

interface FrontendTreeProps {
  title: string;
  packages: FrontendPackage[];
  mode: "components" | "routes";
}

type TreeNodeType = "package" | "folder" | "item";

interface TreeNode {
  id: string;
  label: string;
  depth: number;
  type: TreeNodeType;
  packageName: string;
  filePath?: string;
  extra?: Record<string, any>;
  children?: Map<string, TreeNode>;
}

interface FlattenedNode {
  node: TreeNode;
  depth: number;
  isLeaf: boolean;
}

/** Layout constants */
const INDENT_SIZE = 16;
const CHEVRON_PATH = "M9 5l7 7-7 7";

/** Node type to style class mapping */
const NODE_TYPE_STYLES: Record<TreeNodeType, string> = {
  package: "font-semibold text-gray-900 dark:text-graphite-25",
  folder: "text-gray-700 dark:text-graphite-200",
  item: "text-gray-600 dark:text-graphite-300",
};

const collapseSingleChildFolders = (node: TreeNode): TreeNode => {
  if (!node.children || node.children.size === 0) {
    return node;
  }

  const collapsedChildren = new Map<string, TreeNode>();

  node.children.forEach((child) => {
    let collapsed = collapseSingleChildFolders(child);

    while (collapsed.type === "folder" && collapsed.children && collapsed.children.size === 1) {
      const [grandChild] = Array.from(collapsed.children.values());
      if (!grandChild) break;

      const mergedLabel = `${collapsed.label}/${grandChild.label}`;
      const mergedId = `${collapsed.id}/${grandChild.label}`;
      const mergedFilePath =
        grandChild.filePath && collapsed.filePath
          ? `${collapsed.filePath}/${grandChild.filePath}`
          : grandChild.filePath || collapsed.filePath || "";

      collapsed = {
        ...grandChild,
        id: mergedId,
        label: mergedLabel,
        depth: collapsed.depth,
        filePath: mergedFilePath,
      };
    }

    collapsedChildren.set(collapsed.label, collapsed);
  });

  return {
    ...node,
    children: collapsedChildren,
  };
};

/** Navigate through tree segments, creating nodes as needed */
const navigateToNode = (
  root: TreeNode,
  segments: string[],
  packageName: string,
  mode: "components" | "routes",
): TreeNode => {
  let current = root;
  segments.forEach((segment, index) => {
    if (!current.children) current.children = new Map();
    const key = `${current.id}/${segment}`;
    if (!current.children.has(segment)) {
      current.children.set(segment, {
        id: key,
        label: segment,
        depth: current.depth + 1,
        type: index === segments.length - 1 && mode === "components" ? "item" : "folder",
        packageName,
        filePath: segments.slice(0, index + 1).join("/"),
        children: new Map(),
      });
    }
    current = current.children.get(segment)!;
  });
  return current;
};

/** Insert a synthetic child node for empty paths */
const insertSyntheticNode = (
  parent: TreeNode,
  displayLabel: string,
  relPath: string,
  extra: Record<string, any>,
): void => {
  if (!parent.children) parent.children = new Map();
  const syntheticId = `${parent.id}/${displayLabel}`;
  parent.children.set(syntheticId, {
    id: syntheticId,
    label: displayLabel,
    depth: parent.depth + 1,
    type: "item",
    packageName: parent.packageName,
    filePath: relPath,
    extra,
  });
};

/** Build component extra metadata */
const buildComponentExtra = (component: NonNullable<FrontendPackage["components"]>[number]) => ({
  componentName: component.name,
  description: component.description,
  framework: component.framework,
  props: component.props,
});

/** Build route extra metadata */
const buildRouteExtra = (
  route: NonNullable<FrontendPackage["routes"]>[number],
  displayLabel: string,
) => ({
  routePath: route.path,
  routerType: route.routerType,
  displayLabel,
  controllerPath: route.filePath,
  httpMethods: route.httpMethods,
  endpoints: route.endpoints,
  isBaseRoute: route.isBaseRoute,
  metadata: route.metadata,
});

/** Get route display label */
const getRouteDisplayLabel = (route: NonNullable<FrontendPackage["routes"]>[number]): string => {
  const candidate = route.displayLabel || route.path || route.filePath || "";
  return candidate.length > 0 ? candidate : "route";
};

/** Insert node into tree at given path */
const insertNodeAtPath = (
  rootNode: TreeNode,
  relPath: string,
  displayLabel: string,
  extra: Record<string, any>,
  packageName: string,
  mode: "components" | "routes",
): void => {
  const segments = relPath.replace(/\\/g, "/").split("/").filter(Boolean);

  if (mode === "routes" && segments.length === 0) {
    rootNode.extra = { ...rootNode.extra, ...extra };
    rootNode.filePath = relPath;
    return;
  }

  const current = navigateToNode(rootNode, segments, packageName, mode);

  if (segments.length === 0) {
    insertSyntheticNode(current, displayLabel, relPath, extra);
    return;
  }

  if (mode === "routes") current.type = "item";
  current.extra = { ...current.extra, ...extra };
  current.filePath = segments.join("/");
};

/** Build package root node */
const createPackageRootNode = (pkg: FrontendPackage, mode: "components" | "routes"): TreeNode => ({
  id: `${mode}-${pkg.packageName}`,
  label: pkg.packageName,
  depth: 0,
  type: "package",
  packageName: pkg.packageName,
  extra: { frameworks: pkg.frameworks, packageRoot: pkg.packageRoot },
  children: new Map(),
});

const buildHierarchy = (packages: FrontendPackage[], mode: "components" | "routes"): TreeNode[] => {
  return packages.map((pkg) => {
    const rootNode = createPackageRootNode(pkg, mode);

    if (mode === "components") {
      (pkg.components ?? []).forEach((component) => {
        insertNodeAtPath(
          rootNode,
          component.filePath ?? "",
          component.name,
          buildComponentExtra(component),
          pkg.packageName,
          mode,
        );
      });
    } else {
      (pkg.routes ?? []).forEach((route) => {
        const treeTarget = route.treePath ?? route.path ?? route.filePath ?? "";
        const displayLabel = getRouteDisplayLabel(route);
        insertNodeAtPath(
          rootNode,
          treeTarget,
          displayLabel,
          buildRouteExtra(route, displayLabel),
          pkg.packageName,
          mode,
        );
      });
    }

    return collapseSingleChildFolders(rootNode);
  });
};

const flattenTree = (roots: TreeNode[], expanded: Set<string>): FlattenedNode[] => {
  const result: FlattenedNode[] = [];

  const processNode = (node: TreeNode) => {
    const childrenArray = node.children ? Array.from(node.children.values()) : [];
    const isLeaf = childrenArray.length === 0 || node.type === "item";
    result.push({ node, depth: node.depth, isLeaf });

    if (!isLeaf && expanded.has(node.id)) {
      childrenArray
        .sort((a, b) => a.label.localeCompare(b.label))
        .forEach((child) => processNode(child));
    }
  };

  roots.forEach((root) => processNode(root));
  return result;
};

const hasChildren = (node: TreeNode): boolean => {
  if (node.type === "item") return false;
  return (node.children && node.children.size > 0) ?? false;
};

const getNodeLabel = (node: TreeNode, mode: "components" | "routes"): string => {
  if (node.type === "package") {
    const frameworks = (node.extra?.frameworks as string[]) || [];
    return frameworks.length ? `${node.label} (${frameworks.join(", ")})` : node.label;
  }

  if (node.type === "item") {
    if (mode === "components") {
      return (node.extra?.componentName as string) || node.label;
    }
    return (node.extra?.displayLabel as string) || (node.extra?.routePath as string) || node.label;
  }

  return node.label;
};

export const FrontendTreeSection: React.FC<FrontendTreeProps> = ({ title, packages, mode }) => {
  const roots = useMemo(() => buildHierarchy(packages, mode), [packages, mode]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const initial = new Set<string>();
    const autoExpand = (nodes: TreeNode[]) => {
      nodes.forEach((node) => {
        if (node.type !== "item") {
          initial.add(node.id);
        }
        if (node.children) {
          autoExpand(Array.from(node.children.values()));
        }
      });
    };
    autoExpand(roots);
    setExpanded(initial);
  }, [roots]);

  const flattened = useMemo(() => flattenTree(roots, expanded), [roots, expanded]);
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: flattened.length,
    estimateSize: () => 32,
    getScrollElement: () => parentRef.current,
    overscan: 10,
  });

  const toggleNode = (nodeId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  if (!packages.length) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-graphite-900 border border-gray-200 dark:border-graphite-700 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 dark:bg-graphite-800 border-b border-gray-200 dark:border-graphite-700 flex items-center justify-between">
        <h3 className="font-medium text-gray-900 dark:text-graphite-25">{title}</h3>
        <span className="text-xs text-gray-500 dark:text-graphite-400">
          {flattened.length} items
        </span>
      </div>

      <div ref={parentRef} className="max-h-72 overflow-auto scrollbar-transparent">
        <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const item = flattened[virtualRow.index];
            if (!item) {
              return null;
            }
            const node = item.node;
            const offset = virtualRow.start;
            const label = getNodeLabel(node, mode);
            const isExpandable = hasChildren(node);
            const isExpanded = expanded.has(node.id);
            const routerType = (node.extra?.routerType as string | undefined) || undefined;
            const framework = (node.extra?.framework as string | undefined) || undefined;

            return (
              <div
                key={node.id}
                className="px-4 flex items-center gap-2 text-sm text-gray-700 dark:text-graphite-200"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${offset}px)`,
                  height: `${virtualRow.size}px`,
                }}
              >
                <div
                  className="flex items-center gap-2 cursor-default"
                  style={{ paddingLeft: item.depth * INDENT_SIZE }}
                >
                  {isExpandable ? (
                    <button
                      type="button"
                      onClick={() => toggleNode(node.id)}
                      className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-gray-200 text-gray-600"
                    >
                      <svg
                        className={clsx("w-3 h-3 transition-transform", isExpanded && "rotate-90")}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </button>
                  ) : (
                    <span className="w-5 h-5" />
                  )}

                  <span className={clsx("truncate", NODE_TYPE_STYLES[node.type])} title={label}>
                    {label}
                  </span>

                  {node.type === "item" &&
                    mode === "routes" &&
                    routerType &&
                    routerType !== "tsoa" &&
                    null}

                  {node.type === "item" && mode === "components" && framework && (
                    <span className="text-xs text-gray-400 dark:text-graphite-400">
                      ({framework})
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export type {
  FrontendPackage,
  RouteEndpoint,
  RouteEndpointDocumentation,
  RouteEndpointParameter,
  RouteEndpointResponse,
};
