import StatusBadge from '@/design-system/components/StatusBadge';
import { apiService } from '@/services/api';
import { clsx } from 'clsx';
import React, { useState, useEffect } from 'react';
import { EmptyState } from './components/EmptyState';
import { ErrorState } from './components/ErrorState';
import { LoadingState } from './components/LoadingState';
import { SelectedDetails } from './components/SelectedDetails';
import { SourceGroup } from './components/SourceGroup';
import type { ArchitectureDiagramProps } from './types';
import { computeGroupedComponents } from './utils';

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
  console.log(groupedComponents);
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

  const totalComponents = Object.values(groupedComponents).reduce(
    (sum, arr) => sum + arr.length,
    0
  );

  return (
    <div className={clsx('h-full overflow-auto bg-gray-50', className)}>
      {/* Header */}
      <div className="p-4 bg-white border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Components</h3>
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
      <div className="p-4">
        {Object.keys(groupedComponents).length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedComponents).map(([groupLabel, components]) => (
              <SourceGroup
                key={groupLabel}
                groupLabel={groupLabel}
                components={components}
                expandedSources={expandedSources}
                setExpandedSources={setExpandedSources}
                onComponentClick={setSelectedComponent}
              />
            ))}
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
