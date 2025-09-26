import StatusBadge from '@/design-system/components/StatusBadge';
import { apiService } from '@/services/api';
import { clsx } from 'clsx';
import React, { useState, useEffect } from 'react';
import { EmptyState } from './components/EmptyState';
import { ErrorState } from './components/ErrorState';
import { FrontendTreeSection } from './components/FrontendTree';
import { LoadingState } from './components/LoadingState';
import { SelectedDetails } from './components/SelectedDetails';
import { SourceGroup } from './components/SourceGroup';
import type { ArchitectureDiagramProps } from './types';
import {
  type GroupedComponentGroup,
  type GroupedComponentItem,
  computeGroupedComponents,
  normalizeRelativePath,
} from './utils';

const ArchitectureDiagram: React.FC<ArchitectureDiagramProps> = ({ projectId, className = '' }) => {
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);
  const [projectData, setProjectData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  // Fetch real project data
  useEffect(() => {
    const fetchProjectData = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await apiService.getResolvedSpec(projectId);
        setProjectData(result.resolved);
      } catch (err: any) {
        if (err.status === 404 || err.message?.includes('404')) {
          // Project deleted or not found - clear data and show specific message
          setProjectData(null);
          setError('Project not found or has been deleted');
          console.warn(`Project ${projectId} not found - likely deleted`);
        } else {
          setError(err instanceof Error ? err.message : 'Failed to fetch project data');
          console.error('Failed to fetch project data:', err);
        }
      } finally {
        setLoading(false);
      }
    };

    if (projectId) {
      fetchProjectData();
    } else {
      setProjectData(null);
      setError(null);
    }
  }, [projectId]);

  // Group components by type for rendering

  const groupedComponents = computeGroupedComponents(projectData);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line no-console
      console.info('[ArchitectureDiagram] grouped components', groupedComponents);
      // eslint-disable-next-line no-console
      console.info('[ArchitectureDiagram] raw spec components', projectData?.spec?.components);
    }
  }, [groupedComponents, projectData]);
  // Handle loading state
  if (loading) {
    return <LoadingState className={className} />;
  }

  // Handle error state
  if (error) {
    return (
      <ErrorState error={error} className={className} onRefresh={() => window.location.reload()} />
    );
  }

  const totalComponents = groupedComponents.reduce((sum, group) => sum + group.items.length, 0);

  const buildPackagesFromGroup = (group: GroupedComponentGroup) => {
    type FrontendPackage = {
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
      }>;
    };

    const packages = new Map<string, FrontendPackage>();

    const formatLabel = (value: string): string =>
      value
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(' ');

    const splitSegments = (value: string): string[] =>
      value.replace(/^\/+/, '').split('/').filter(Boolean);

    const normalizeRoutePath = (value: unknown): string => {
      if (value === undefined || value === null) return '';
      const trimmed = String(value).trim();
      if (trimmed === '') return '';
      const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
      const collapsed = withLeadingSlash.replace(/\/+/g, '/');
      if (collapsed.length > 1 && /\/+$/.test(collapsed)) {
        return collapsed.replace(/\/+$/, '');
      }
      return collapsed;
    };

    type RouteInfo = {
      routerType: string;
      controllerRelativePath: string;
      fullRoutePath: string;
      baseRoutePath: string;
      routeSegments: string[];
      baseSegments: string[];
      displayLabel: string;
    };

    const getRouteIdentifier = (item: GroupedComponentItem): string | undefined => {
      const metadata = item.data.metadata || {};
      const candidate =
        item.data.path ||
        metadata.routePath ||
        metadata.displayLabel ||
        item.data.displayLabel ||
        item.data.name ||
        item.name;
      if (!candidate) {
        return undefined;
      }
      const trimmed = String(candidate).trim();
      return trimmed === '' ? undefined : trimmed;
    };

    const deriveRouteInfo = (item: GroupedComponentItem): RouteInfo => {
      const metadata = item.data.metadata || {};
      const routerType = String(metadata.routerType || item.data.routerType || '').toLowerCase();
      const packageRoot = metadata.packageRoot || metadata.root || '';
      const rawFilePath = metadata.controllerPath || metadata.filePath || item.data.filePath || '';
      const controllerRelativePath = normalizeRelativePath(rawFilePath, packageRoot || '');
      const routeBasePath = normalizeRoutePath(metadata.routeBasePath);
      const routePathCandidate =
        metadata.routePath || metadata.path || item.data.path || getRouteIdentifier(item) || '';
      const normalizedRoutePath = normalizeRoutePath(routePathCandidate);
      const fullRoutePath = normalizedRoutePath || routeBasePath || '/';
      const routeSegments = splitSegments(fullRoutePath);
      const baseSegments = routeBasePath ? splitSegments(routeBasePath) : [];
      const metadataDisplayLabel =
        typeof metadata.displayLabel === 'string' ? metadata.displayLabel : null;
      const displayLabel =
        metadataDisplayLabel && metadataDisplayLabel.trim().length > 0
          ? metadataDisplayLabel
          : fullRoutePath;
      return {
        routerType,
        controllerRelativePath,
        fullRoutePath,
        baseRoutePath: routeBasePath,
        routeSegments,
        baseSegments,
        displayLabel,
      };
    };

    const ensurePackage = (item: GroupedComponentItem, routeInfo?: RouteInfo): FrontendPackage => {
      const metadata = item.data.metadata || {};
      const filePath = String(metadata.filePath || item.data.filePath || '');
      const packageRoot = metadata.packageRoot || metadata.root || '';
      const rawServiceName = String(
        metadata.serviceDisplayName || metadata.serviceName || metadata.packageName || ''
      ).replace(/^@[^/]+\//, '');
      const routeIdentifier = getRouteIdentifier(item);
      const normalizedServiceName = rawServiceName.trim();

      let packageKey: string;

      if (group.treeMode === 'routes') {
        if (routeInfo?.baseRoutePath) {
          packageKey = routeInfo.baseRoutePath;
        } else if (routeInfo?.routeSegments.length) {
          packageKey = `/${routeInfo.routeSegments[0]}`;
        } else if (normalizedServiceName) {
          packageKey = normalizedServiceName.startsWith('/')
            ? normalizedServiceName
            : `/${normalizedServiceName}`;
        } else if (routeIdentifier) {
          packageKey = routeIdentifier.startsWith('/') ? routeIdentifier : `/${routeIdentifier}`;
        } else {
          packageKey = '/';
        }
      } else {
        packageKey =
          normalizedServiceName ||
          metadata.packageName ||
          metadata.root ||
          (filePath.includes('/') ? filePath.split('/')[0] : filePath);
      }

      if (!packageKey) {
        packageKey =
          group.treeMode === 'routes' ? routeIdentifier || item.name || '/routes' : group.label;
      }

      const normalizedPackageKey = String(packageKey || 'Routes');
      const packageDisplayName =
        group.treeMode === 'routes' ? normalizedPackageKey : formatLabel(normalizedPackageKey);

      if (!packages.has(normalizedPackageKey)) {
        const frameworks = new Set<string>();
        if (metadata.framework) {
          frameworks.add(metadata.framework);
        }

        packages.set(normalizedPackageKey, {
          packageName: packageDisplayName,
          packageRoot,
          frameworks: Array.from(frameworks),
          components: [],
          routes: [],
        });
      }

      const pkg = packages.get(normalizedPackageKey)!;
      if (metadata.framework && !pkg.frameworks.includes(metadata.framework)) {
        pkg.frameworks.push(metadata.framework);
      }
      return pkg;
    };

    group.items.forEach(item => {
      const metadata = item.data.metadata || {};
      const routeInfo = group.treeMode === 'routes' ? deriveRouteInfo(item) : null;
      const pkg = ensurePackage(item, routeInfo ?? undefined);

      if (group.treeMode === 'routes' && routeInfo) {
        const info = routeInfo;
        const treeSegments = (() => {
          if (info.routerType === 'tsoa' && info.baseSegments.length > 0) {
            const matchesBase = info.baseSegments.every(
              (segment, index) => info.routeSegments[index] === segment
            );
            if (matchesBase) {
              return info.routeSegments.slice(info.baseSegments.length);
            }
          }
          return info.routeSegments;
        })();
        const treePath = treeSegments.join('/');

        pkg.routes = pkg.routes || [];
        const displayLabel =
          info.routerType === 'tsoa' && treeSegments.length > 0
            ? `/${treeSegments.join('/')}`
            : info.displayLabel;
        pkg.routes.push({
          path: info.fullRoutePath,
          filePath: info.controllerRelativePath,
          treePath,
          routerType: (metadata.routerType as string | undefined) || info.routerType,
          displayLabel: displayLabel || info.fullRoutePath,
        });
      } else {
        const filePath = normalizeRelativePath(
          metadata.filePath || item.data.filePath || '',
          pkg.packageRoot || ''
        );
        pkg.components = pkg.components || [];
        pkg.components.push({
          name: item.data.name || item.name,
          filePath,
          framework: metadata.framework || '',
          description: item.data.description || metadata.description,
          props: item.data.props,
        });
      }
    });

    return Array.from(packages.values()).map(pkg => {
      if (!pkg.components || pkg.components.length === 0) {
        delete pkg.components;
      }
      if (!pkg.routes || pkg.routes.length === 0) {
        delete pkg.routes;
      }
      return pkg;
    });
  };

  return (
    <div
      className={clsx(
        'h-full overflow-auto bg-gray-50 dark:bg-graphite-950 scrollbar-transparent',
        className
      )}
    >
      {/* Header */}
      <div className="p-4 bg-white dark:bg-graphite-900 border-b border-gray-200 dark:border-graphite-700 flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900 dark:text-graphite-25">Components</h3>
        {totalComponents > 0 && (
          <StatusBadge
            variant="secondary"
            style="solid"
            size="xs"
            className="border-0 rounded-full text-[10px] text-white"
          >
            {totalComponents}
          </StatusBadge>
        )}
      </div>

      {/* Components by Source File */}
      <div className="p-4 space-y-6">
        {groupedComponents.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-4">
            {groupedComponents.map(group => {
              if (group.layout === 'tree') {
                const packages = buildPackagesFromGroup(group);
                if (packages.length === 0) {
                  return null;
                }
                return (
                  <div
                    key={group.label}
                    className="bg-white dark:bg-graphite-900 border border-gray-200 dark:border-graphite-700 rounded-lg overflow-hidden"
                  >
                    <FrontendTreeSection
                      title={group.label}
                      packages={packages}
                      mode={group.treeMode === 'routes' ? 'routes' : 'components'}
                    />
                  </div>
                );
              }

              return (
                <SourceGroup
                  key={group.label}
                  groupLabel={group.label}
                  components={group.items}
                  expandedSources={expandedSources}
                  setExpandedSources={setExpandedSources}
                  onComponentClick={setSelectedComponent}
                />
              );
            })}
          </div>
        )}

        {/* Selected Component Details */}
        <SelectedDetails
          selectedComponent={selectedComponent}
          groupedComponents={groupedComponents}
          onClose={() => setSelectedComponent(null)}
        />
      </div>
    </div>
  );
};

export default ArchitectureDiagram;
