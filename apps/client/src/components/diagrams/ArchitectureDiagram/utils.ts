const CUE_FILE_REGEX = /\.cue$/i;

type TreeMode = 'components' | 'routes';

interface TypeDisplayConfig {
  label: string;
  layout: 'grid' | 'tree';
  treeMode?: TreeMode;
}

const TYPE_CONFIG: Record<string, TypeDisplayConfig> = {
  service: { label: 'Services', layout: 'grid' },
  frontend: { label: 'Frontends', layout: 'grid' },
  module: { label: 'Modules', layout: 'grid' },
  tool: { label: 'Tools', layout: 'grid' },
  route: { label: 'Routes', layout: 'tree', treeMode: 'routes' },
  view: { label: 'Views', layout: 'tree', treeMode: 'routes' },
  component: { label: 'Components', layout: 'grid' },
  infrastructure: { label: 'Infrastructure', layout: 'tree', treeMode: 'components' },
  database: { label: 'Infrastructure', layout: 'tree', treeMode: 'components' },
  other: { label: 'Other', layout: 'grid' },
};

const DESIRED_GROUP_ORDER = [
  'Frontends',
  'Services',
  'Modules',
  'Tools',
  'Routes',
  'Views',
  'Components',
  'Infrastructure',
  'Other',
];

const getTypeConfig = (type: string): TypeDisplayConfig =>
  (TYPE_CONFIG[type] ?? TYPE_CONFIG.other) as TypeDisplayConfig;

const toLowerString = (value: unknown): string => String(value || '').toLowerCase();

const normalizeSlashes = (value: string): string => value.replace(/\\/g, '/');

export const normalizeRelativePath = (
  filePath: string | undefined,
  packageRoot: string
): string => {
  if (!filePath) return '';
  const normalizedFile = normalizeSlashes(filePath).replace(/^\/+/, '');
  if (!packageRoot) return normalizedFile;

  const normalizedRoot = normalizeSlashes(packageRoot).replace(/^\/+|\/+$/g, '');
  if (!normalizedRoot) return normalizedFile;

  if (normalizedFile.startsWith(normalizedRoot)) {
    const trimmed = normalizedFile.slice(normalizedRoot.length);
    return trimmed.replace(/^\/+/, '');
  }

  return normalizedFile;
};

const shouldExcludeFromDiagram = (item: any): boolean => {
  const candidates = [
    item?.metadata?.filePath,
    item?.metadata?.sourceFile,
    item?.filePath,
    item?.sourceFile,
  ]
    .filter(Boolean)
    .map(path => String(path));

  return candidates.some(path => CUE_FILE_REGEX.test(path));
};

const enrichDataForGrouping = (data: any, enforcedType: string) => ({
  ...data,
  type: data.type || enforcedType,
  metadata: {
    ...(data.metadata || {}),
  },
});

export interface GroupedComponentItem {
  name: string;
  data: any;
}

export interface GroupedComponentGroup {
  key: string;
  label: string;
  type: string;
  layout: 'grid' | 'tree';
  treeMode?: TreeMode;
  items: GroupedComponentItem[];
}

export const getComponentType = (data: any, name: string): string => {
  const rawType = toLowerString(data.type || data.metadata?.type);
  const language = toLowerString(data.metadata?.language);
  const framework = toLowerString(data.metadata?.framework);
  const detectedType = toLowerString(data.metadata?.detectedType);

  if (detectedType === 'tool' || detectedType === 'build_tool') return 'tool';
  if (detectedType === 'frontend' || detectedType === 'mobile') return 'frontend';
  if (detectedType === 'web_service') return 'service';

  if (rawType.includes('service')) return 'service';
  if (['module', 'library'].includes(rawType)) return 'module';
  if (['tool', 'cli', 'binary'].includes(rawType)) return 'tool';
  if (['deployment', 'infrastructure'].includes(rawType)) return 'infrastructure';
  if (rawType === 'database') return 'database';
  if (rawType === 'frontend' || rawType === 'mobile') return 'frontend';
  if (rawType === 'route') {
    const routerType = toLowerString(data.metadata?.routerType);
    if (routerType && routerType !== 'tsoa') {
      return 'view';
    }
    return 'route';
  }
  if (rawType === 'component') return 'component';

  if (language && ['javascript', 'typescript', 'tsx', 'jsx'].includes(language)) {
    if (data.metadata?.routerType) return 'view';
    if (framework.includes('react') || framework.includes('next')) return 'view';
  }

  if (data.metadata?.containerImage || data.metadata?.compose) return 'service';
  if (data.metadata?.kubernetes || data.metadata?.terraform) return 'infrastructure';

  if (name.includes('@')) return 'module';

  return 'component';
};

export const computeGroupedComponents = (projectData: any): GroupedComponentGroup[] => {
  const groups = new Map<string, GroupedComponentGroup>();

  const ensureGroup = (type: string): GroupedComponentGroup => {
    const config = getTypeConfig(type);
    if (!groups.has(config.label)) {
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
      groups.set(config.label, baseGroup);
    }
    return groups.get(config.label)!;
  };

  const addToGroup = (type: string, name: string, data: any) => {
    if (!type) return;
    const group = ensureGroup(type);
    group.items.push({ name, data });
  };

  if (projectData) {
    const services = projectData.spec?.services || projectData.services || {};
    const databases = projectData.spec?.databases || projectData.databases || {};
    const components = projectData.spec?.components || projectData.components || {};
    const routes = projectData.spec?.ui?.routes || projectData.ui?.routes || [];
    const frontendPackages = projectData.spec?.frontend?.packages || [];

    const processEntry = (name: string, originalData: any) => {
      if (!originalData) return;
      if (shouldExcludeFromDiagram(originalData)) return;
      const type = getComponentType(originalData, name);
      const data = enrichDataForGrouping(originalData, type);
      addToGroup(type, name, data);
    };

    Object.entries(services).forEach(([name, data]) => {
      processEntry(name, data);
    });

    Object.entries(databases).forEach(([name, data]) => {
      if (!data) return;
      const databaseData = enrichDataForGrouping(data, 'database');
      if (shouldExcludeFromDiagram(databaseData)) return;
      addToGroup('database', name, databaseData);
    });

    Object.entries(components).forEach(([name, data]) => {
      processEntry(name, data);
    });

    (routes as any[]).forEach(route => {
      if (!route) return;
      const name = route.id || route.name || route.path || 'route';
      const baseMetadata = route.metadata || {};
      const routerType = baseMetadata.routerType;
      const derivedType = routerType && routerType !== 'tsoa' ? 'view' : 'route';
      const routeData = {
        ...route,
        name: route.name || route.path || name,
        metadata: baseMetadata,
        type: derivedType,
      };
      if (shouldExcludeFromDiagram(routeData)) return;
      const type = getComponentType(routeData, name);
      addToGroup(type, name, routeData);
    });

    frontendPackages.forEach((pkg: any) => {
      const packageName = pkg.packageName || pkg.name || 'frontend';
      const packageRoot = pkg.packageRoot || pkg.root || '.';

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
          'component'
        );
        if (shouldExcludeFromDiagram(data)) return;
        addToGroup('component', name, data);
      });

      (pkg.routes || []).forEach((route: any) => {
        const name = `${packageName}:${route.path || route.filePath || 'view'}`;
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
              routerType: route.routerType || 'frontend',
              filePath: relativeFilePath,
              displayLabel,
            },
          },
          'view'
        );
        if (shouldExcludeFromDiagram(data)) return;
        addToGroup('view', name, data);
      });
    });
  }

  const dedupedGroups = Array.from(groups.values())
    .map(group => {
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
    .filter(group => group.items.length > 0);

  const orderedGroups: GroupedComponentGroup[] = [];
  const remainingGroups = new Map(dedupedGroups.map(group => [group.label, group] as const));

  DESIRED_GROUP_ORDER.forEach(label => {
    if (remainingGroups.has(label)) {
      orderedGroups.push(remainingGroups.get(label)!);
      remainingGroups.delete(label);
    }
  });

  orderedGroups.push(...remainingGroups.values());

  return orderedGroups;
};
