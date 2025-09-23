import type { Component, Connection } from './types';

export const getSourceFile = (itemData: any): string => {
  // Prefer full path from provenance
  if (itemData.provenance?.evidence && itemData.provenance.evidence.length > 0) {
    return itemData.provenance.evidence[0];
  }
  // Fallback to metadata sourceFile (basename)
  const metadataSource = itemData.metadata?.sourceFile || itemData.sourceFile;
  if (metadataSource) {
    return metadataSource;
  }
  // Intelligent fallback based on type
  const artifactType = itemData.type || itemData.metadata?.type || 'service';
  const language = itemData.metadata?.language || '';
  if (artifactType === 'service' && (language === 'docker' || itemData.containerImage)) {
    return 'docker-compose.yml';
  } else if (
    ['library', 'cli', 'binary', 'frontend', 'service'].includes(artifactType) &&
    (language === 'javascript' || language === 'typescript')
  ) {
    return 'package.json';
  } else if (artifactType === 'database') {
    return 'docker-compose.yml';
  }
  return 'config';
};

export const computeGroupedComponents = (projectData: any): Record<string, any[]> => {
  const groupedComponents: Record<string, any[]> = {};

  if (projectData) {
    const services = projectData.spec?.services || projectData.services || {};
    const databases = projectData.spec?.databases || projectData.databases || {};
    const components = projectData.spec?.components || projectData.components || {};

    // Re-group for display with deduplication by display name per source
    const allEntries = [
      ...Object.entries(services),
      ...Object.entries(databases),
      ...Object.entries(components),
    ];

    // Group by source first, then dedup per group
    const tempGroups: Record<string, any[]> = {};
    allEntries.forEach(([name, data]: [string, any]) => {
      const sourceFile = getSourceFile(data);
      if (!tempGroups[sourceFile]) {
        tempGroups[sourceFile] = [];
      }
      tempGroups[sourceFile].push({ name, data });
    });

    // Dedup per source group by display name
    Object.entries(tempGroups).forEach(([sourceFile, groupEntries]) => {
      const seenDisplayNames = new Set<string>();
      const uniqueGroup = groupEntries.filter(({ data }) => {
        const displayName = data.name || name;
        if (seenDisplayNames.has(displayName)) {
          return false;
        }
        seenDisplayNames.add(displayName);
        return true;
      });
      groupedComponents[sourceFile] = uniqueGroup;
    });
  }

  return groupedComponents;
};

// Unused in current code, but extracted for completeness
export const generateComponentsFromData = (
  data: any
): { components: Component[]; connections: Connection[] } => {
  if (!data) {
    return { components: [], connections: [] };
  }

  const components: Component[] = [];
  const connections: Connection[] = [];

  // Group components by their source files
  const componentsBySource: Record<string, any[]> = {};

  // Extract and group services, databases, and other components
  const services = data.spec?.services || data.services || {};
  const databases = data.spec?.databases || data.databases || {};
  const otherComponents = data.spec?.components || data.components || {};

  // Group services by source file
  Object.entries(services).forEach(([serviceName, serviceData]: [string, any]) => {
    const sourceFile = getSourceFile(serviceData);
    if (!componentsBySource[sourceFile]) {
      componentsBySource[sourceFile] = [];
    }
    componentsBySource[sourceFile].push({
      name: serviceName,
      displayName: serviceData.name || serviceName,
      type: 'backend',
      data: serviceData,
      kind: 'service',
    });
  });

  // Group databases by source file
  Object.entries(databases).forEach(([dbName, dbData]: [string, any]) => {
    const sourceFile = getSourceFile(dbData);
    if (!componentsBySource[sourceFile]) {
      componentsBySource[sourceFile] = [];
    }
    componentsBySource[sourceFile].push({
      name: dbName,
      displayName: dbData.name || dbName,
      type: 'data',
      data: dbData,
      kind: 'database',
    });
  });

  // Group other components by source file
  Object.entries(otherComponents).forEach(([componentName, componentData]: [string, any]) => {
    const sourceFile = getSourceFile(componentData);
    if (!componentsBySource[sourceFile]) {
      componentsBySource[sourceFile] = [];
    }

    let componentType: 'cli' | 'frontend' | 'external' = 'external';
    if (
      componentData.type === 'client' ||
      componentName.includes('web') ||
      componentName.includes('ui')
    ) {
      componentType = 'frontend';
    } else if (componentData.type === 'tool' || componentName.includes('cli')) {
      componentType = 'cli';
    }

    componentsBySource[sourceFile].push({
      name: componentName,
      displayName: componentData.name || componentName,
      type: componentType,
      data: componentData,
      kind: 'component',
    });
  });

  return { components, connections };
};
