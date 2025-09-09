import React, { useEffect, useRef, useState } from 'react';
import { Graphviz } from '@hpcc-js/wasm';
import { apiService } from '../../services/api';
import type { IRResponse } from '../../types/api';

interface SiteDiagramProps {
  projectId: string;
  className?: string;
}

interface SiteIRData {
  specHash: string;
  routes: {
    id: string;
    path: string;
    capabilities: string[];
  }[];
  dependencies?: {
    from: string;
    to: string;
    type: string;
  }[];
}

const SiteDiagram: React.FC<SiteDiagramProps> = ({ projectId, className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [siteData, setSiteData] = useState<SiteIRData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [graphviz, setGraphviz] = useState<any>(null);

  useEffect(() => {
    // Initialize Graphviz
    const initGraphviz = async () => {
      try {
        const gv = await Graphviz.load();
        setGraphviz(gv);
      } catch (err) {
        console.error('Failed to load Graphviz:', err);
        setError('Failed to initialize diagram renderer');
      }
    };

    initGraphviz();
  }, []);

  useEffect(() => {
    if (!projectId) return;

    const loadSiteData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response: IRResponse = await apiService.getIR(projectId, 'site');
        setSiteData(response.data as SiteIRData);
      } catch (err) {
        console.error('Failed to load site data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load site diagram');
      } finally {
        setLoading(false);
      }
    };

    loadSiteData();
  }, [projectId]);

  const generateDotFromSiteData = (data: SiteIRData): string => {
    if (!data.routes || data.routes.length === 0) {
      return `digraph G {
        rankdir=TB;
        node [shape=box, style="rounded,filled", fillcolor=lightgray];
        
        empty [label="No routes defined\\nAdd routes to your CUE spec" fillcolor="#f9fafb" color="#d1d5db"];
      }`;
    }

    let dot = `digraph SiteRoutes {
      rankdir=TB;
      node [shape=box, style="rounded,filled", fontname="Inter", fontsize=10];
      edge [fontname="Inter", fontsize=8];
      
      // Define color scheme
      node [fillcolor="#ffffff", color="#374151"];
      edge [color="#6b7280"];
    `;

    // Add route nodes
    const routes = Array.isArray(data.routes) ? data.routes : data.routes?.nodes || [];
    routes.forEach(route => {
      const capabilities = route.capabilities || [];
      const capabilityText = capabilities.length > 0 
        ? `\\nCapabilities: ${capabilities.join(', ')}`
        : '';
      
      // Color nodes based on capabilities
      let fillColor = '#f9fafb'; // default
      let borderColor = '#d1d5db';
      
      if (capabilities.includes('create')) {
        fillColor = '#dcfce7'; // green
        borderColor = '#16a34a';
      } else if (capabilities.includes('edit') || capabilities.includes('update')) {
        fillColor = '#fef3c7'; // yellow
        borderColor = '#d97706';
      } else if (capabilities.includes('delete')) {
        fillColor = '#fee2e2'; // red
        borderColor = '#dc2626';
      } else if (capabilities.includes('view') || capabilities.includes('list')) {
        fillColor = '#dbeafe'; // blue
        borderColor = '#2563eb';
      }
      
      const routeId = route.id || route.label || route.path || `route_${Math.random().toString(36).substr(2, 9)}`;
      const nodeId = routeId.replace(/[^a-zA-Z0-9]/g, '_');
      dot += `
        ${nodeId} [
          label="${routeId}\\n${route.path || ''}${capabilityText}"
          fillcolor="${fillColor}"
          color="${borderColor}"
        ];`;
    });

    // Add dependencies if available
    const edges = data.routes?.edges || data.dependencies || [];
    if (edges && edges.length > 0) {
      dot += `\n      // Dependencies\n`;
      edges.forEach(dep => {
        const fromId = (dep.from || dep.source || '').replace(/[^a-zA-Z0-9]/g, '_');
        const toId = (dep.to || dep.target || '').replace(/[^a-zA-Z0-9]/g, '_');
        const label = dep.type || dep.label ? ` [label="${dep.type || dep.label}"]` : '';
        if (fromId && toId) {
          dot += `      ${fromId} -> ${toId}${label};\n`;
        }
      });
    } else {
      // Create implicit dependencies based on route hierarchy
      const sortedRoutes = [...routes].sort((a, b) => (a.path || '').length - (b.path || '').length);
      
      sortedRoutes.forEach(route => {
        if (route.path) {
          const parentPath = route.path.split('/').slice(0, -1).join('/') || '/';
          const parentRoute = sortedRoutes.find(r => r.path === parentPath && r.id !== route.id);
          
          if (parentRoute && route.id && parentRoute.id) {
            const fromId = parentRoute.id.replace(/[^a-zA-Z0-9]/g, '_');
            const toId = route.id.replace(/[^a-zA-Z0-9]/g, '_');
            dot += `      ${fromId} -> ${toId} [style=dashed, color="#9ca3af"];\n`;
          }
        }
      });
    }

    dot += '\n    }';
    return dot;
  };

  const renderGraphvizDiagram = async (dotSource: string) => {
    if (!graphviz || !containerRef.current) return;

    try {
      // Generate SVG from DOT source
      const svg = graphviz.dot(dotSource);
      
      // Clear previous content
      containerRef.current.innerHTML = '';
      
      // Create a container for the SVG
      const svgContainer = document.createElement('div');
      svgContainer.className = 'flex justify-center items-center min-h-[400px]';
      svgContainer.innerHTML = svg;
      
      // Style the SVG for responsiveness
      const svgElement = svgContainer.querySelector('svg');
      if (svgElement) {
        svgElement.style.maxWidth = '100%';
        svgElement.style.height = 'auto';
        svgElement.style.background = 'white';
        svgElement.style.border = '1px solid #e5e7eb';
        svgElement.style.borderRadius = '8px';
        svgElement.style.padding = '20px';
      }
      
      containerRef.current.appendChild(svgContainer);
    } catch (err) {
      console.error('Failed to render Graphviz diagram:', err);
      setError('Failed to render site diagram');
    }
  };

  useEffect(() => {
    if (siteData && graphviz && !loading && !error) {
      const dotSource = generateDotFromSiteData(siteData);
      renderGraphvizDiagram(dotSource);
    }
  }, [siteData, graphviz, loading, error]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading site diagrams...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-red-700 font-medium">Error loading site diagram</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 px-4 py-2 bg-red-100 text-red-800 rounded-md hover:bg-red-200 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full overflow-auto ${className}`}>
      <div className="p-4">
        {siteData?.routes && siteData.routes.length > 0 && (
          <div className="mb-4">
            <h3 className="text-lg font-medium text-gray-900">Site Route DAG</h3>
            <p className="text-sm text-gray-600">
              Showing {siteData.routes.length} route{siteData.routes.length !== 1 ? 's' : ''} and their relationships
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-200 border border-green-600 rounded"></div>
                <span>Create</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-yellow-200 border border-yellow-600 rounded"></div>
                <span>Edit/Update</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-red-200 border border-red-600 rounded"></div>
                <span>Delete</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-200 border border-blue-600 rounded"></div>
                <span>View/List</span>
              </div>
            </div>
          </div>
        )}
        <div ref={containerRef} className="site-diagram-container" />
      </div>
    </div>
  );
};

export default SiteDiagram;