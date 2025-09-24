export const getComponentType = (data: any, name: string): string => {
  let componentType =
    data.type || data.metadata?.type || (name.includes('@') ? 'library' : 'service');

  // Standardize binary to cli
  if (componentType === 'binary') {
    componentType = 'cli';
  }

  // Standardize database to data
  if (componentType === 'database') {
    componentType = 'data';
  }

  return componentType;
};

export const getSourceFile = (artifact: any): string => {
  if (artifact.metadata.root) {
    return artifact.metadata.root;
  }
  const filePath = artifact.metadata.filePath;
  if (!filePath) {
    return 'Unknown Source';
  }
  if (filePath.includes('kubernetes')) {
    return 'Kubernetes';
  }
  const parts = filePath.split('/');
  const dir = parts.slice(0, -1).join('/');
  return dir || 'Root';
};

export const computeGroupedComponents = (projectData: any): Record<string, any[]> => {
  const groupedComponents: Record<string, any[]> = {};

  if (projectData) {
    const services = projectData.spec?.services || projectData.services || {};
    const databases = projectData.spec?.databases || projectData.databases || {};
    const components = projectData.spec?.components || projectData.components || {};

    // Re-group for display with deduplication by display name per type
    const allEntries = [
      ...Object.entries(services),
      ...Object.entries(databases),
      ...Object.entries(components),
    ];

    // Group by type first, then dedup per group
    const tempGroups: Record<string, any[]> = {};
    allEntries.forEach(([name, data]: [string, any]) => {
      const type = getComponentType(data, name);
      const groupLabel =
        type.charAt(0).toUpperCase() +
        type.slice(1) +
        (type === 'cli' || type === 'data' ? 's' : 's');
      if (!tempGroups[groupLabel]) {
        tempGroups[groupLabel] = [];
      }
      tempGroups[groupLabel].push({ name, data });
    });

    // Dedup per type group by display name
    Object.entries(tempGroups).forEach(([groupLabel, groupEntries]) => {
      const seenDisplayNames = new Set<string>();
      const uniqueGroup = groupEntries.filter(({ data }) => {
        const displayName = data.name || name;
        if (seenDisplayNames.has(displayName)) {
          return false;
        }
        seenDisplayNames.add(displayName);
        return true;
      });
      groupedComponents[groupLabel] = uniqueGroup;
    });
  }
  console.log(groupedComponents);
  return groupedComponents;
};
