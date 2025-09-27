import StatusBadge from '@/design-system/components/StatusBadge';
import { apiService } from '@/services/api';
import { clsx } from 'clsx';
import React, { useState, useEffect } from 'react';
import { EmptyState } from './components/EmptyState';
import { ErrorState } from './components/ErrorState';
import { FrontendTreeSection } from './components/FrontendTree';
import type {
  FrontendPackage,
  RouteEndpoint,
  RouteEndpointDocumentation,
  RouteEndpointParameter,
  RouteEndpointResponse,
} from './components/FrontendTree';
import { LoadingState } from './components/LoadingState';
import RouteCardsSection from './components/RouteCardsSection';
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

  const buildPackagesFromGroup = (group: GroupedComponentGroup): FrontendPackage[] => {
    const packages = new Map<string, FrontendPackage>();

    const normalizeEndpoint = (value: unknown): RouteEndpoint => {
      const base = (value ?? {}) as Partial<RouteEndpoint> & {
        method?: string;
        path?: string;
        controller?: string;
        fullPath?: string;
        handler?: string;
        returnType?: string;
        signature?: string;
        documentation?: Partial<RouteEndpoint['documentation']>;
        parameters?: unknown;
        responses?: unknown;
        tags?: unknown;
        source?: unknown;
      };

      const normalizeParameters = (): RouteEndpoint['parameters'] => {
        if (!Array.isArray(base.parameters)) {
          return [];
        }
        return base.parameters.map(parameter => {
          const param = parameter as Partial<RouteEndpointParameter> & { name?: string };
          const normalized: RouteEndpointParameter = {
            name: String(param.name ?? '').trim() || 'param',
            optional: Boolean(param.optional),
          };
          if (param.type !== undefined && param.type !== null) {
            normalized.type = String(param.type);
          }
          if (param.description !== undefined && param.description !== null) {
            normalized.description = String(param.description);
          }
          if (Array.isArray(param.decorators) && param.decorators.length > 0) {
            normalized.decorators = param.decorators.map(dec => String(dec));
          }
          return normalized;
        });
      };

      const normalizeResponses = (): RouteEndpoint['responses'] => {
        if (!Array.isArray(base.responses)) {
          return [];
        }
        return base.responses.map(response => {
          const res = response as Partial<RouteEndpointResponse>;
          const decorator: RouteEndpointResponse['decorator'] =
            res.decorator === 'SuccessResponse' ? 'SuccessResponse' : 'Response';
          const normalized: RouteEndpointResponse = { decorator };
          if (res.status !== undefined && res.status !== null) {
            normalized.status = String(res.status);
          }
          if (res.description !== undefined && res.description !== null) {
            normalized.description = String(res.description);
          }
          return normalized;
        });
      };

      const documentation = (() => {
        const raw = base.documentation;
        if (!raw || typeof raw !== 'object') {
          return undefined;
        }
        const payload: RouteEndpointDocumentation = {};
        if ((raw as any).summary !== undefined) {
          payload.summary = String((raw as any).summary);
        }
        if ((raw as any).description !== undefined) {
          payload.description = String((raw as any).description);
        }
        if ((raw as any).returns !== undefined) {
          payload.returns = String((raw as any).returns);
        }
        const remarks = Array.isArray((raw as any).remarks)
          ? (raw as any).remarks.map((entry: unknown) => String(entry))
          : [];
        if (remarks.length > 0) {
          payload.remarks = remarks;
        }
        const examples = Array.isArray((raw as any).examples)
          ? (raw as any).examples.map((entry: unknown) => String(entry))
          : [];
        if (examples.length > 0) {
          payload.examples = examples;
        }
        const deprecatedRaw = (raw as any).deprecated;
        if (typeof deprecatedRaw === 'string') {
          payload.deprecated = deprecatedRaw;
        } else if (deprecatedRaw === true) {
          payload.deprecated = true;
        }
        return Object.keys(payload).length > 0 ? payload : undefined;
      })();

      const handler = base.handler ? String(base.handler) : undefined;
      const returnType = base.returnType ? String(base.returnType) : undefined;
      const defaultSignature = `${handler ?? 'handler'}()${returnType ? `: ${returnType}` : ''}`;

      const tags = Array.isArray(base.tags) ? base.tags.map(tag => String(tag)) : [];

      const source = (() => {
        const raw = base.source as { line?: unknown } | undefined;
        if (raw && typeof raw.line === 'number') {
          return { line: raw.line };
        }
        if (raw && typeof raw.line === 'string' && raw.line.trim().length > 0) {
          const parsed = Number.parseInt(raw.line, 10);
          if (!Number.isNaN(parsed)) {
            return { line: parsed };
          }
        }
        return undefined;
      })();

      const endpoint: RouteEndpoint = {
        method: String(base.method ?? 'GET').toUpperCase(),
        signature: base.signature ? String(base.signature) : defaultSignature,
        parameters: normalizeParameters(),
        responses: normalizeResponses(),
      };

      if (base.path !== undefined && base.path !== null) {
        endpoint.path = String(base.path);
      }
      if (base.fullPath !== undefined && base.fullPath !== null) {
        endpoint.fullPath = String(base.fullPath);
      }
      if (base.controller !== undefined && base.controller !== null) {
        endpoint.controller = String(base.controller);
      }
      if (handler) {
        endpoint.handler = handler;
      }
      if (returnType) {
        endpoint.returnType = returnType;
      }
      if (documentation) {
        endpoint.documentation = documentation;
      }
      if (tags.length > 0) {
        endpoint.tags = tags;
      }
      if (source) {
        endpoint.source = source;
      }

      return endpoint;
    };

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
      isBaseRoute: boolean;
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
      const isBaseRoute =
        Boolean(metadata.isBaseRoute) ||
        (baseSegments.length > 0 &&
          routeSegments.length === baseSegments.length &&
          baseSegments.every((segment, index) => routeSegments[index] === segment));
      const metadataDisplayLabel =
        typeof metadata.displayLabel === 'string' ? metadata.displayLabel : null;
      const displayLabel =
        metadataDisplayLabel && metadataDisplayLabel.trim().length > 0
          ? metadataDisplayLabel
          : isBaseRoute
            ? '/'
            : fullRoutePath || '/';
      return {
        routerType,
        controllerRelativePath,
        fullRoutePath,
        baseRoutePath: routeBasePath,
        routeSegments,
        baseSegments,
        displayLabel,
        isBaseRoute,
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

      const metadataPackageName = String(
        metadata.packageName || metadata.serviceDisplayName || metadata.serviceName || ''
      ).trim();

      let packageKey: string | undefined;

      if (group.treeMode === 'routes') {
        if (metadataPackageName) {
          packageKey = metadataPackageName;
        } else if (normalizedServiceName) {
          packageKey = normalizedServiceName;
        } else if (routeInfo?.baseRoutePath && routeInfo.baseRoutePath !== '/') {
          packageKey = routeInfo.baseRoutePath;
        } else if (metadata.packageRoot) {
          packageKey = String(metadata.packageRoot);
        } else if (routeInfo?.routeSegments.length) {
          packageKey = routeInfo.routeSegments[0];
        } else if (routeIdentifier) {
          packageKey = routeIdentifier;
        } else {
          packageKey = '/';
        }
      } else {
        packageKey =
          metadataPackageName ||
          normalizedServiceName ||
          metadata.packageName ||
          metadata.root ||
          (filePath.includes('/') ? filePath.split('/')[0] : filePath);
      }

      if (!packageKey) {
        packageKey =
          group.treeMode === 'routes' ? routeIdentifier || item.name || '/routes' : group.label;
      }

      const normalizeRoutesPackageKey = (value: string): string => {
        const trimmed = value.trim();
        if (!trimmed) {
          return '/';
        }
        if (trimmed === '/') {
          return '/';
        }
        return trimmed.replace(/^\/+/, '').replace(/\/+$/, '') || trimmed;
      };

      let normalizedPackageKey = String(packageKey || 'Routes').trim();
      if (group.treeMode === 'routes') {
        normalizedPackageKey = normalizeRoutesPackageKey(normalizedPackageKey);
      }
      if (!normalizedPackageKey) {
        normalizedPackageKey =
          group.treeMode === 'routes' ? '/' : formatLabel(group.label || 'Group');
      }

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
          if (info.isBaseRoute) {
            return [] as string[];
          }
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
        const routePathForDisplay = info.isBaseRoute ? '/' : info.fullRoutePath;
        const httpMethods = Array.isArray(metadata.httpMethods)
          ? metadata.httpMethods.map((method: unknown) => String(method).toUpperCase())
          : Array.isArray((item.data as any)?.httpMethods)
            ? (item.data as any).httpMethods.map((method: unknown) => String(method).toUpperCase())
            : [];
        const rawEndpoints = Array.isArray(metadata.endpoints) ? metadata.endpoints : [];
        const endpoints = rawEndpoints.map(normalizeEndpoint);
        const routerTypeNormalized = ((metadata.routerType as string) || info.routerType || '')
          .toString()
          .toLowerCase();
        const noiseKeywords = [
          'dockerfile-container',
          'nats-compose',
          'spec-workbench-compose',
          'api-types',
        ];
        const lowerPackageName = pkg.packageName.toLowerCase();
        const lowerDisplayLabel = (displayLabel || '').toLowerCase();
        const lowerRoutePath = (info.fullRoutePath || '').toLowerCase();
        const isNoise =
          !info.isBaseRoute &&
          noiseKeywords.some(keyword => {
            const lower = keyword.toLowerCase();
            return (
              lowerPackageName.includes(lower) ||
              lowerDisplayLabel.includes(lower) ||
              lowerRoutePath.includes(lower)
            );
          });

        if (isNoise) {
          return;
        }

        const routeMetadata = {
          ...metadata,
          httpMethods,
          endpoints,
        };
        pkg.routes.push({
          path: routePathForDisplay,
          filePath: info.controllerRelativePath,
          treePath,
          routerType: (metadata.routerType as string | undefined) || info.routerType,
          displayLabel: displayLabel || routePathForDisplay,
          httpMethods,
          endpoints,
          metadata: routeMetadata,
          isBaseRoute: info.isBaseRoute,
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
            className="rounded-full text-[10px] px-2 py-0.5 !bg-graphite-900 !text-graphite-200 !border-graphite-600"
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
              if (group.type === 'route') {
                const packages = buildPackagesFromGroup(group);
                if (packages.length === 0) {
                  return null;
                }
                return (
                  <RouteCardsSection key={group.label} title={group.label} packages={packages} />
                );
              }

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
