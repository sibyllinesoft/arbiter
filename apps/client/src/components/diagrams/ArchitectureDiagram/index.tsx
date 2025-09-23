import { clsx } from 'clsx';
import React, { useState, useEffect } from 'react';
import { apiService } from '../../../services/api';
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

  // Group components by source file for rendering
  console.log(projectData);
  const groupedComponents = computeGroupedComponents(projectData);

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
      <div className="p-4 bg-white border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Sources</h3>
        <p className="text-sm text-gray-600">
          {totalComponents > 0
            ? `Showing ${totalComponents} imported components`
            : 'Import a project to see its components'}
        </p>
      </div>

      {/* Components by Source File */}
      <div className="p-4 space-y-4">
        {Object.keys(groupedComponents).length === 0 ? (
          <EmptyState />
        ) : (
          Object.entries(groupedComponents).map(([sourceFile, components]) => (
            <SourceGroup
              key={sourceFile}
              sourceFile={sourceFile}
              components={components}
              expandedSources={expandedSources}
              setExpandedSources={setExpandedSources}
              onComponentClick={setSelectedComponent}
            />
          ))
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
