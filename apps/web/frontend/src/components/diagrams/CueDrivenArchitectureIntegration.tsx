/**
 * CUE-Driven Architecture Integration
 * Example of integrating the CUE-driven diagram with real API data
 */

import React, { useState, useEffect } from 'react';
import { CueDrivenArchitectureDiagram } from './CueDrivenArchitectureDiagram';
import { CueArchitectureData, DiagramType } from '../../types/architecture';

interface CueDrivenArchitectureIntegrationProps {
  /** Project ID to fetch CUE data for */
  projectId?: string;
  /** API endpoint base URL */
  apiBaseUrl?: string;
  /** Additional CSS classes */
  className?: string;
}

export const CueDrivenArchitectureIntegration: React.FC<CueDrivenArchitectureIntegrationProps> = ({
  projectId = 'demo-project',
  apiBaseUrl = 'http://localhost:5050',
  className = '',
}) => {
  const [cueData, setCueData] = useState<CueArchitectureData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diagramType, setDiagramType] = useState<DiagramType>('system_overview');
  const [layoutType, setLayoutType] = useState<string>('layered');
  const [suggestedTypes, setSuggestedTypes] = useState<string[]>([]);

  // Fetch CUE data from API
  useEffect(() => {
    const fetchCueData = async () => {
      try {
        setLoading(true);
        setError(null);

        // First try to get the resolved specification
        const response = await fetch(`${apiBaseUrl}/api/ir/validate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            projectId,
            timeout: 10000,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch CUE data: ${response.statusText}`);
        }

        const result = await response.json();

        if (!result.success || !result.resolved) {
          throw new Error('No resolved CUE data available');
        }

        const architectureData: CueArchitectureData = {
          // Extract metadata
          metadata: {
            name: result.resolved.metadata?.name || result.resolved.product?.name || projectId,
            version: result.resolved.metadata?.version || '1.0.0',
            apiVersion: result.resolved.apiVersion || 'arbiter.dev/v2',
            kind: result.resolved.kind || 'Assembly',
          },

          // v2 schema elements
          product: result.resolved.product,
          ui: result.resolved.ui,
          flows: result.resolved.flows,
          capabilities: result.resolved.capabilities,
          paths: result.resolved.paths,
          stateModels: result.resolved.stateModels || result.resolved.states,
          locators: result.resolved.locators,

          // v1 schema elements
          services: result.resolved.services,
          deployment: result.resolved.deployment,
        };

        setCueData(architectureData);

        // Import parser dynamically to get suggestions
        const { CueArchitectureParser } = await import('../../utils/cueArchitectureParser');
        const suggestions = CueArchitectureParser.suggestDiagramTypes(architectureData);
        setSuggestedTypes(suggestions);

        // Set default diagram type to first suggestion
        if (suggestions.length > 0) {
          setDiagramType(suggestions[0] as DiagramType);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
        console.error('Failed to fetch CUE data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCueData();
  }, [projectId, apiBaseUrl]);

  // Handle component selection for debugging
  const handleComponentSelect = (component: any) => {
    console.log('Selected component:', component);
  };

  // Handle connection selection for debugging
  const handleConnectionSelect = (connection: any) => {
    console.log('Selected connection:', connection);
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-96 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading CUE specification...</p>
          <p className="text-sm text-gray-500 mt-1">Project: {projectId}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-96 ${className}`}>
        <div className="text-center">
          <div className="text-red-400 mb-4">
            <svg
              className="w-12 h-12 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-gray-900 font-medium mb-2">Failed to load CUE data</p>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!cueData) {
    return (
      <div className={`flex items-center justify-center h-96 ${className}`}>
        <div className="text-center">
          <div className="text-gray-400 mb-4">
            <svg
              className="w-12 h-12 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <p className="text-gray-600">No CUE data available</p>
          <p className="text-sm text-gray-500 mt-1">Project: {projectId}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col ${className}`}>
      {/* Controls */}
      <div className="p-4 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Live Architecture Diagram</h2>
            <p className="text-sm text-gray-600">
              Generated from {cueData.metadata?.name || projectId} CUE specification
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Diagram Type Selector */}
            {suggestedTypes.length > 1 && (
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">View:</label>
                <select
                  value={diagramType}
                  onChange={e => setDiagramType(e.target.value as DiagramType)}
                  className="text-sm border border-gray-300 rounded px-3 py-1"
                >
                  {suggestedTypes.map(type => (
                    <option key={type} value={type}>
                      {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Layout Selector */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Layout:</label>
              <select
                value={layoutType}
                onChange={e => setLayoutType(e.target.value)}
                className="text-sm border border-gray-300 rounded px-3 py-1"
              >
                <option value="layered">Layered</option>
                <option value="force_directed">Force Directed</option>
                <option value="flow">Flow Based</option>
              </select>
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
              title="Refresh diagram"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
          <span>Schema: {cueData.metadata?.apiVersion}</span>
          <span>Version: {cueData.metadata?.version}</span>
          <span>Kind: {cueData.metadata?.kind}</span>
          {suggestedTypes.length > 0 && <span>Available Views: {suggestedTypes.length}</span>}
        </div>
      </div>

      {/* Diagram */}
      <div className="flex-1">
        <CueDrivenArchitectureDiagram
          cueData={cueData}
          diagramType={diagramType}
          layoutType={layoutType}
          interactive={true}
          onComponentSelect={handleComponentSelect}
          onConnectionSelect={handleConnectionSelect}
        />
      </div>
    </div>
  );
};

export default CueDrivenArchitectureIntegration;
