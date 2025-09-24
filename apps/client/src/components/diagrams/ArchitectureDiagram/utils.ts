export const getSourceFile = (itemData: any): string => {
  return itemData.metadata.filePath;
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
  console.log(groupedComponents);
  return groupedComponents;
};
