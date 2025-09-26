import { useVirtualizer } from '@tanstack/react-virtual';
import { clsx } from 'clsx';
import React, { useEffect, useMemo, useRef, useState } from 'react';

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
    routerType?: string;
  }>;
}

interface FrontendTreeProps {
  title: string;
  packages: FrontendPackage[];
  mode: 'components' | 'routes';
}

type TreeNodeType = 'package' | 'folder' | 'item';

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

const INDENT_SIZE = 16;

const buildHierarchy = (packages: FrontendPackage[], mode: 'components' | 'routes'): TreeNode[] => {
  return packages.map(pkg => {
    const rootId = `${mode}-${pkg.packageName}`;
    const rootNode: TreeNode = {
      id: rootId,
      label: pkg.packageName,
      depth: 0,
      type: 'package',
      packageName: pkg.packageName,
      extra: {
        frameworks: pkg.frameworks,
        packageRoot: pkg.packageRoot,
      },
      children: new Map(),
    };

    const insertNode = (relPath: string, displayLabel: string, extra: Record<string, any>) => {
      const normalized = relPath.replace(/\\/g, '/');
      const segments = normalized === '' ? [] : normalized.split('/').filter(Boolean);

      let current = rootNode;

      segments.forEach((segment, index) => {
        if (!current.children) {
          current.children = new Map();
        }
        const key = `${current.id}/${segment}`;
        if (!current.children.has(segment)) {
          current.children.set(segment, {
            id: key,
            label: segment,
            depth: current.depth + 1,
            type: index === segments.length - 1 && mode === 'components' ? 'item' : 'folder',
            packageName: pkg.packageName,
            filePath: segments.slice(0, index + 1).join('/'),
            children: new Map(),
          });
        }
        current = current.children.get(segment)!;
      });

      if (segments.length === 0) {
        if (!current.children) {
          current.children = new Map();
        }
        const syntheticId = `${current.id}/${displayLabel}`;
        current.children.set(syntheticId, {
          id: syntheticId,
          label: displayLabel,
          depth: current.depth + 1,
          type: 'item',
          packageName: pkg.packageName,
          filePath: relPath,
          extra,
        });
        return;
      }

      if (mode === 'routes' && current) {
        current.type = 'item';
      }

      current.extra = {
        ...(current.extra || {}),
        ...extra,
      };
      current.filePath = segments.join('/');
    };

    if (mode === 'components') {
      (pkg.components ?? []).forEach(component => {
        insertNode(component.filePath ?? '', component.name, {
          componentName: component.name,
          description: component.description,
          framework: component.framework,
          props: component.props,
        });
      });
    } else {
      (pkg.routes ?? []).forEach(route => {
        insertNode(route.filePath ?? route.path ?? '', route.path ?? route.filePath ?? 'route', {
          routePath: route.path,
          routerType: route.routerType,
        });
      });
    }

    return rootNode;
  });
};

const flattenTree = (roots: TreeNode[], expanded: Set<string>): FlattenedNode[] => {
  const result: FlattenedNode[] = [];

  const processNode = (node: TreeNode) => {
    const childrenArray = node.children ? Array.from(node.children.values()) : [];
    const isLeaf = childrenArray.length === 0 || node.type === 'item';
    result.push({ node, depth: node.depth, isLeaf });

    if (!isLeaf && expanded.has(node.id)) {
      childrenArray
        .sort((a, b) => a.label.localeCompare(b.label))
        .forEach(child => processNode(child));
    }
  };

  roots.forEach(root => processNode(root));
  return result;
};

const hasChildren = (node: TreeNode): boolean => {
  if (node.type === 'item') return false;
  return (node.children && node.children.size > 0) ?? false;
};

const getNodeLabel = (node: TreeNode, mode: 'components' | 'routes'): string => {
  if (node.type === 'package') {
    const frameworks = (node.extra?.frameworks as string[]) || [];
    return frameworks.length ? `${node.label} (${frameworks.join(', ')})` : node.label;
  }

  if (node.type === 'item') {
    if (mode === 'components') {
      return (node.extra?.componentName as string) || node.label;
    }
    return (node.extra?.routePath as string) || node.label;
  }

  return node.label;
};

export const FrontendTreeSection: React.FC<FrontendTreeProps> = ({ title, packages, mode }) => {
  const roots = useMemo(() => buildHierarchy(packages, mode), [packages, mode]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(roots.map(root => root.id)));

  useEffect(() => {
    setExpanded(new Set(roots.map(root => root.id)));
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
    setExpanded(prev => {
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
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-medium text-gray-900">{title}</h3>
        <span className="text-xs text-gray-500">{flattened.length} items</span>
      </div>

      <div ref={parentRef} className="max-h-72 overflow-auto">
        <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map(virtualRow => {
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
                className="px-4 flex items-center gap-2 text-sm"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
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
                        className={clsx('w-3 h-3 transition-transform', isExpanded && 'rotate-90')}
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

                  <span
                    className={clsx('truncate', {
                      'font-semibold text-gray-900': node.type === 'package',
                      'text-gray-700': node.type === 'folder',
                      'text-gray-600': node.type === 'item',
                    })}
                    title={label}
                  >
                    {label}
                  </span>

                  {node.type === 'item' && mode === 'routes' && routerType && (
                    <span className="text-xs text-gray-400">({routerType})</span>
                  )}

                  {node.type === 'item' && mode === 'components' && framework && (
                    <span className="text-xs text-gray-400">({framework})</span>
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

export type { FrontendPackage };
