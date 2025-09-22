import { clsx } from 'clsx';
import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';

interface ArchitectureDiagramProps {
  projectId: string;
  className?: string;
}

interface Component {
  id: string;
  name: string;
  type: 'frontend' | 'backend' | 'cli' | 'data' | 'external';
  description: string;
  technologies: string[];
  position: { x: number; y: number };
  size: { width: number; height: number };
  ports?: { id: string; position: { x: number; y: number } }[];
}

interface Connection {
  from: { componentId: string; portId?: string };
  to: { componentId: string; portId?: string };
  type: 'api' | 'websocket' | 'file' | 'data';
  label?: string;
  bidirectional?: boolean;
}

const LAYER_COLORS = {
  frontend: {
    bg: '#dbeafe',
    border: '#3b82f6',
    text: '#1e40af',
    gradient: 'radial-gradient(ellipse 120% 80% at 20% 30%, #dbeafe, #c7d2fe, #bfdbfe)',
  },
  backend: {
    bg: '#1E466B', // Blue-600 - darker blue background for services
    border: '#163759', // Blue-700 - darker blue for services
    text: '#D8E6F3', // Blue-50 - light text for contrast
    gradient: 'radial-gradient(ellipse 120% 80% at 20% 30%, #25557E, #1E466B, #163759)', // Blue-500 to Blue-600 to Blue-700
  },
  cli: {
    bg: '#3A2A70', // Purple-600 - darker purple background for libraries
    border: '#31205A', // Purple-700 - darker purple for libraries
    text: '#E7E6F5', // Purple-50 - light text for contrast
    gradient: 'radial-gradient(ellipse 120% 80% at 20% 30%, #4A378B, #3A2A70, #31205A)', // Purple-500 to Purple-600 to Purple-700
  },
  data: {
    bg: '#f3e8ff',
    border: '#a855f7',
    text: '#7c3aed',
    gradient: 'radial-gradient(ellipse 120% 80% at 20% 30%, #f3e8ff, #ede9fe, #e9d5ff)',
  },
  external: {
    bg: '#fee2e2',
    border: '#ef4444',
    text: '#dc2626',
    gradient: 'radial-gradient(ellipse 120% 80% at 20% 30%, #fee2e2, #fed7d7, #fecaca)',
  },
};

const ARCHITECTURE_COMPONENTS: Component[] = [
  // Frontend Layer
  {
    id: 'react-app',
    name: 'React Frontend',
    type: 'frontend',
    description: 'Main UI with split pane layout, tabs, and diagram components',
    technologies: ['React', 'TypeScript', 'Vite', 'Tailwind CSS'],
    position: { x: 50, y: 50 },
    size: { width: 200, height: 100 },
    ports: [
      { id: 'api-client', position: { x: 100, y: 100 } },
      { id: 'websocket', position: { x: 150, y: 100 } },
    ],
  },
  {
    id: 'monaco-editor',
    name: 'Monaco Editor',
    type: 'frontend',
    description: 'Code editing with CUE syntax highlighting and validation',
    technologies: ['Monaco Editor', 'CUE Language Support'],
    position: { x: 300, y: 50 },
    size: { width: 120, height: 50 },
  },
  {
    id: 'diagram-renderers',
    name: 'Diagram Renderers',
    type: 'frontend',
    description: 'Flow, Site, FSM, View diagrams with interactive SVG/Graphviz',
    technologies: ['Graphviz WASM', 'Mermaid', 'SVG'],
    position: { x: 520, y: 50 },
    size: { width: 200, height: 100 },
  },

  // Backend Layer
  {
    id: 'api-server',
    name: 'API Server',
    type: 'backend',
    description: 'Bun HTTP server with REST API and WebSocket support',
    technologies: ['Bun', 'TypeScript', 'WebSockets'],
    position: { x: 50, y: 200 },
    size: { width: 120, height: 70 },
    ports: [
      { id: 'rest-api', position: { x: 90, y: 200 } },
      { id: 'websocket-server', position: { x: 140, y: 200 } },
      { id: 'spec-engine', position: { x: 90, y: 300 } },
    ],
  },
  {
    id: 'spec-engine',
    name: 'CUE Spec Engine',
    type: 'backend',
    description: 'CUE specification validation, processing, and schema management',
    technologies: ['CUE Lang', 'JSON Schema', 'Validation'],
    position: { x: 270, y: 200 },
    size: { width: 120, height: 70 },
    ports: [
      { id: 'validation', position: { x: 360, y: 200 } },
      { id: 'ir-gen', position: { x: 360, y: 250 } },
    ],
  },
  {
    id: 'ir-generator',
    name: 'IR Generator',
    type: 'backend',
    description: 'Intermediate representation generation from CUE specs',
    technologies: ['Code Generation', 'Templates', 'AST Processing'],
    position: { x: 490, y: 200 },
    size: { width: 120, height: 70 },
  },

  // CLI Layer
  {
    id: 'cli-interface',
    name: 'CLI Interface',
    type: 'cli',
    description: 'Command-line tool for project management and automation',
    technologies: ['Commander.js', 'Chalk', 'Bun Runtime'],
    position: { x: 50, y: 350 },
    size: { width: 200, height: 100 },
    ports: [
      { id: 'api-client-cli', position: { x: 150, y: 350 } },
      { id: 'file-ops', position: { x: 100, y: 450 } },
    ],
  },
  {
    id: 'command-handlers',
    name: 'Command Handlers',
    type: 'cli',
    description: 'Init, add, generate, check, sync, integrate commands',
    technologies: ['TypeScript', 'File System', 'Process Management'],
    position: { x: 300, y: 350 },
    size: { width: 200, height: 100 },
  },

  // Data Layer
  {
    id: 'cue-specs',
    name: 'CUE Specifications',
    type: 'data',
    description: 'Declarative system specifications in CUE format',
    technologies: ['CUE Files', 'Schema Definitions', 'Constraints'],
    position: { x: 50, y: 500 },
    size: { width: 120, height: 50 },
  },
  {
    id: 'sqlite-db',
    name: 'SQLite Database',
    type: 'data',
    description: 'Project metadata, fragments, validation cache, user data',
    technologies: ['SQLite', 'SQL Migrations', 'Data Persistence'],
    position: { x: 270, y: 500 },
    size: { width: 120, height: 50 },
  },
  {
    id: 'generated-code',
    name: 'Generated Artifacts',
    type: 'data',
    description: 'Generated code, configs, CI/CD pipelines, documentation',
    technologies: ['Templates', 'Code Generation', 'File Output'],
    position: { x: 490, y: 500 },
    size: { width: 120, height: 50 },
  },

  // External Integrations
  {
    id: 'git-repos',
    name: 'Git Repositories',
    type: 'external',
    description: 'Version control integration and code deployment',
    technologies: ['Git', 'GitHub/GitLab', 'CI/CD'],
    position: { x: 50, y: 620 },
    size: { width: 110, height: 50 },
  },
  {
    id: 'deployment',
    name: 'Deployment Targets',
    type: 'external',
    description: 'Production environments and cloud platforms',
    technologies: ['Docker', 'Kubernetes', 'Cloud Services'],
    position: { x: 250, y: 620 },
    size: { width: 110, height: 50 },
  },
];

const ARCHITECTURE_CONNECTIONS: Connection[] = [
  // Frontend to Backend
  {
    from: { componentId: 'react-app', portId: 'api-client' },
    to: { componentId: 'api-server', portId: 'rest-api' },
    type: 'api',
    label: 'REST API',
  },
  {
    from: { componentId: 'react-app', portId: 'websocket' },
    to: { componentId: 'api-server', portId: 'websocket-server' },
    type: 'websocket',
    label: 'Real-time Updates',
  },

  // Backend Internal
  {
    from: { componentId: 'api-server', portId: 'spec-engine' },
    to: { componentId: 'spec-engine', portId: 'validation' },
    type: 'api',
    label: 'Validation',
  },
  {
    from: { componentId: 'spec-engine', portId: 'ir-gen' },
    to: { componentId: 'ir-generator' },
    type: 'data',
    label: 'IR Generation',
  },

  // CLI to Backend
  {
    from: { componentId: 'cli-interface', portId: 'api-client-cli' },
    to: { componentId: 'api-server' },
    type: 'api',
    label: 'CLI API',
  },

  // Data Connections
  {
    from: { componentId: 'api-server' },
    to: { componentId: 'sqlite-db' },
    type: 'data',
    label: 'Persistence',
  },
  {
    from: { componentId: 'spec-engine' },
    to: { componentId: 'cue-specs' },
    type: 'file',
    label: 'Read Specs',
  },
  {
    from: { componentId: 'cli-interface', portId: 'file-ops' },
    to: { componentId: 'cue-specs' },
    type: 'file',
    label: 'File Operations',
  },
  {
    from: { componentId: 'ir-generator' },
    to: { componentId: 'generated-code' },
    type: 'file',
    label: 'Code Generation',
  },

  // External Integrations
  {
    from: { componentId: 'cli-interface' },
    to: { componentId: 'git-repos' },
    type: 'api',
    label: 'Git Operations',
  },
  {
    from: { componentId: 'generated-code' },
    to: { componentId: 'deployment' },
    type: 'api',
    label: 'Deploy Artifacts',
  },
];

const ArchitectureDiagram: React.FC<ArchitectureDiagramProps> = ({ projectId, className = '' }) => {
  const [hoveredComponent, setHoveredComponent] = useState<string | null>(null);
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
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch project data');
        console.error('Failed to fetch project data:', err);
      } finally {
        setLoading(false);
      }
    };

    if (projectId) {
      fetchProjectData();
    }
  }, [projectId]);

  // Generate components grouped by source files
  const generateComponentsFromData = (
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
      const sourceFile =
        serviceData.metadata?.sourceFile || serviceData.sourceFile || 'docker-compose.yml';
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
      const sourceFile =
        (dbData as any).metadata?.sourceFile || (dbData as any).sourceFile || 'docker-compose.yml';
      if (!componentsBySource[sourceFile]) {
        componentsBySource[sourceFile] = [];
      }
      componentsBySource[sourceFile].push({
        name: dbName,
        displayName: (dbData as any).name || dbName,
        type: 'data',
        data: dbData,
        kind: 'database',
      });
    });

    // Group other components by source file
    Object.entries(otherComponents).forEach(([componentName, componentData]: [string, any]) => {
      const sourceFile =
        (componentData as any).metadata?.sourceFile ||
        (componentData as any).sourceFile ||
        'package.json';
      if (!componentsBySource[sourceFile]) {
        componentsBySource[sourceFile] = [];
      }

      let componentType: 'cli' | 'frontend' | 'external' = 'external';
      if (
        (componentData as any).type === 'client' ||
        componentName.includes('web') ||
        componentName.includes('ui')
      ) {
        componentType = 'frontend';
      } else if ((componentData as any).type === 'tool' || componentName.includes('cli')) {
        componentType = 'cli';
      }

      componentsBySource[sourceFile].push({
        name: componentName,
        displayName: (componentData as any).name || componentName,
        type: componentType,
        data: componentData,
        kind: 'component',
      });
    });

    return { components, connections };
  };

  const { components: dynamicComponents, connections: dynamicConnections } =
    generateComponentsFromData(projectData);

  // Group components by source file for rendering
  const componentsBySource = generateComponentsFromData(projectData);
  const groupedComponents: Record<string, any[]> = {};

  if (projectData) {
    const services = projectData.spec?.services || projectData.services || {};
    const databases = projectData.spec?.databases || projectData.databases || {};
    const otherComponents = projectData.spec?.components || projectData.components || {};

    // Re-group for display with deduplication by display name
    const allEntries = [
      ...Object.entries(services),
      ...Object.entries(databases),
      ...Object.entries(otherComponents),
    ];

    // Track seen display names to avoid duplicates
    const seenDisplayNames = new Set<string>();

    allEntries.forEach(([name, data]: [string, any]) => {
      const displayName = data.name || name;

      // Skip if we've already seen this display name
      if (seenDisplayNames.has(displayName)) {
        return;
      }
      seenDisplayNames.add(displayName);

      const sourceFile =
        data.metadata?.sourceFile ||
        data.sourceFile ||
        (name.includes('@') ? 'package.json' : 'docker-compose.yml');
      if (!groupedComponents[sourceFile]) {
        groupedComponents[sourceFile] = [];
      }
      groupedComponents[sourceFile].push({ name, data });
    });
  }

  const renderComponent = (component: Component) => {
    const colors = LAYER_COLORS[component.type];
    const isHovered = hoveredComponent === component.id;
    const isSelected = selectedComponent === component.id;

    return (
      <g
        key={component.id}
        transform={`translate(${component.position.x}, ${component.position.y})`}
        onMouseEnter={() => setHoveredComponent(component.id)}
        onMouseLeave={() => setHoveredComponent(null)}
        onClick={() =>
          setSelectedComponent(component.id === selectedComponent ? null : component.id)
        }
        className="cursor-pointer"
      >
        {/* Component Box */}
        <rect
          width={component.size.width}
          height={component.size.height}
          rx={8}
          ry={8}
          fill={colors.bg}
          stroke={colors.border}
          strokeWidth={isHovered || isSelected ? 2 : 1}
          className={clsx(
            'transition-all duration-200',
            isHovered && 'drop-shadow-lg',
            isSelected && 'drop-shadow-xl'
          )}
        />

        {/* Component Title */}
        <text
          x={component.size.width / 2}
          y={15}
          textAnchor="middle"
          className="text-xs font-semibold"
          fill={colors.text}
        >
          {component.name}
        </text>

        {/* Component Description */}
        <foreignObject
          x={8}
          y={20}
          width={component.size.width - 8}
          height={component.size.height - 25}
        >
          <div
            className="text-2xs text-gray-600 leading-tight overflow-hidden"
            style={{ fontSize: '10px' }}
          >
            {component.description}
          </div>
        </foreignObject>

        {/* Technology Stack (on hover/select) */}
        {(isHovered || isSelected) && (
          <g>
            <rect
              x={-10}
              y={component.size.height + 5}
              width={component.size.width + 20}
              height={Math.max(40, component.technologies.length * 12 + 16)}
              rx={4}
              ry={4}
              fill="white"
              stroke={colors.border}
              strokeWidth={1}
              className="drop-shadow-md"
            />
            <text
              x={component.size.width / 2}
              y={component.size.height + 20}
              textAnchor="middle"
              className="text-2xs font-medium"
              fill={colors.text}
            >
              Technologies:
            </text>
            {component.technologies.map((tech, index) => (
              <text
                key={`${component.id}-tech-${index}`}
                x={component.size.width / 2}
                y={component.size.height + 35 + index * 10}
                textAnchor="middle"
                className="text-2xs"
                fill="#374151"
              >
                {tech}
              </text>
            ))}
          </g>
        )}

        {/* Connection Ports */}
        {component.ports?.map(port => (
          <circle
            key={port.id}
            cx={port.position.x}
            cy={port.position.y}
            r={2}
            fill={colors.border}
            stroke="white"
            strokeWidth={1}
          />
        ))}
      </g>
    );
  };

  const renderConnection = (connection: Connection) => {
    const fromComponent = componentsToRender.find(c => c.id === connection.from.componentId);
    const toComponent = componentsToRender.find(c => c.id === connection.to.componentId);

    if (!fromComponent || !toComponent) return null;

    const fromPort = connection.from.portId
      ? fromComponent.ports?.find(p => p.id === connection.from.portId)
      : null;
    const toPort = connection.to.portId
      ? toComponent.ports?.find(p => p.id === connection.to.portId)
      : null;

    const fromX = fromComponent.position.x + (fromPort?.position.x ?? fromComponent.size.width / 2);
    const fromY = fromComponent.position.y + (fromPort?.position.y ?? fromComponent.size.height);
    const toX = toComponent.position.x + (toPort?.position.x ?? toComponent.size.width / 2);
    const toY = toComponent.position.y + (toPort?.position.y ?? 0);

    const connectionColors = {
      api: '#3b82f6',
      websocket: '#10b981',
      file: '#f59e0b',
      data: '#8b5cf6',
    };

    const midY = fromY + (toY - fromY) / 2;

    return (
      <g key={`${connection.from.componentId}-${connection.to.componentId}`}>
        {/* Connection Path */}
        <path
          d={`M ${fromX} ${fromY} Q ${fromX} ${midY} ${toX} ${toY}`}
          stroke={connectionColors[connection.type]}
          strokeWidth={2}
          fill="none"
          markerEnd="url(#arrowhead)"
          className="connection-path"
        />

        {/* Connection Label */}
        {connection.label && (
          <text
            x={(fromX + toX) / 2}
            y={midY - 5}
            textAnchor="middle"
            className="text-xs"
            fill={connectionColors[connection.type]}
            fontWeight="500"
          >
            {connection.label}
          </text>
        )}
      </g>
    );
  };

  // Handle loading state
  if (loading) {
    return (
      <div className={clsx('h-full overflow-auto bg-gray-50', className)}>
        <div className="p-4 bg-white border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Sources</h3>
          <p className="text-sm text-gray-600">Loading project architecture...</p>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-600">Loading architecture data...</span>
        </div>
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <div className={clsx('h-full overflow-auto bg-gray-50', className)}>
        <div className="p-4 bg-white border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Sources</h3>
          <p className="text-sm text-red-600">Error loading project architecture</p>
        </div>
        <div className="flex items-center justify-center h-64">
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
            <p className="text-gray-900 font-medium mb-2">Failed to load architecture data</p>
            <p className="text-sm text-gray-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('h-full overflow-auto bg-gray-50', className)}>
      {/* Header */}
      <div className="p-4 bg-white border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Sources</h3>
        <p className="text-sm text-gray-600">
          {dynamicComponents.length > 0
            ? `Interactive diagram showing the project's ${dynamicComponents.length} components and their relationships`
            : 'Interactive diagram showing the Arbiter system components (fallback)'}
        </p>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-4 text-xs">
          {Object.entries(LAYER_COLORS).map(([layer, colors]) => (
            <div key={layer} className="flex items-center gap-1">
              <div
                className="w-3 h-3 rounded border"
                style={{ backgroundColor: colors.bg, borderColor: colors.border }}
              />
              <span className="capitalize font-medium">{layer}</span>
            </div>
          ))}
        </div>

        {/* Connection Legend */}
        <div className="mt-2 flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-6 h-0.5 bg-blue-500"></div>
            <span>REST API</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-6 h-0.5 bg-green-500"></div>
            <span>WebSocket</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-6 h-0.5 bg-yellow-500"></div>
            <span>File System</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-6 h-0.5 bg-purple-500"></div>
            <span>Data Flow</span>
          </div>
        </div>
      </div>

      {/* Components by Source File */}
      <div className="p-4 space-y-4">
        {Object.keys(groupedComponents).length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-4">
              <svg
                className="w-16 h-16 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No Components Found</h3>
            <p className="text-gray-600">Import a project to see its architecture components</p>
          </div>
        ) : (
          Object.entries(groupedComponents).map(([sourceFile, components]) => (
            <div
              key={sourceFile}
              className="bg-white border border-gray-200 rounded-lg overflow-hidden"
            >
              {/* Source File Header */}
              <button
                onClick={() =>
                  setExpandedSources(prev => ({ ...prev, [sourceFile]: !prev[sourceFile] }))
                }
                className="w-full px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <svg
                      className="w-4 h-4 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <div className="text-left">
                    <h3 className="font-medium text-gray-900">{sourceFile}</h3>
                    <p className="text-sm text-gray-600">
                      {components.length} component{components.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${expandedSources[sourceFile] ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {/* Components Grid */}
              {expandedSources[sourceFile] && (
                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {components.map(({ name, data }) => {
                      const componentType =
                        data.type ||
                        data.metadata?.type ||
                        (name.includes('@') ? 'library' : 'service');
                      const colors =
                        componentType === 'service'
                          ? LAYER_COLORS.backend
                          : componentType === 'database'
                            ? LAYER_COLORS.data
                            : componentType === 'library'
                              ? LAYER_COLORS.cli
                              : LAYER_COLORS.external;

                      return (
                        <div
                          key={`${sourceFile}-${name}`}
                          className="p-3 border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
                          style={{
                            background: colors.gradient || colors.bg,
                            borderColor: colors.border,
                          }}
                          onClick={() =>
                            setSelectedComponent(selectedComponent === name ? null : name)
                          }
                        >
                          {/* Component Name */}
                          <h4 className="font-medium text-sm mb-1" style={{ color: colors.text }}>
                            {data.name || name}
                          </h4>

                          {/* Component Metadata */}
                          <div className="space-y-1 text-xs text-gray-600">
                            {data.metadata?.language &&
                              data.metadata.language !== 'unknown' &&
                              data.metadata.language.trim() !== '' && (
                                <div>
                                  Language:{' '}
                                  <span className="font-mono text-gray-800">
                                    {data.metadata.language}
                                  </span>
                                </div>
                              )}
                            {data.metadata?.framework &&
                              data.metadata.framework !== 'unknown' &&
                              data.metadata.framework.trim() !== '' && (
                                <div>
                                  Framework:{' '}
                                  <span className="font-mono text-gray-800">
                                    {data.metadata.framework}
                                  </span>
                                </div>
                              )}
                            {data.version && data.version.trim() !== '' && (
                              <div>
                                Version:{' '}
                                <span className="font-mono text-gray-800">{data.version}</span>
                              </div>
                            )}
                            {data.image && data.image.trim() !== '' && (
                              <div>
                                Image: <span className="font-mono text-gray-800">{data.image}</span>
                              </div>
                            )}
                            {data.ports && (
                              <div>
                                Ports:{' '}
                                <span className="font-mono text-gray-800">
                                  {(() => {
                                    if (Array.isArray(data.ports)) {
                                      // Handle array of ports - extract port numbers
                                      return data.ports
                                        .map(port => {
                                          if (typeof port === 'object' && port !== null) {
                                            // Extract port number from object
                                            return (
                                              port.port ||
                                              port.targetPort ||
                                              port.number ||
                                              port.value ||
                                              JSON.stringify(port)
                                            );
                                          }
                                          return String(port);
                                        })
                                        .join(', ');
                                    } else if (
                                      typeof data.ports === 'object' &&
                                      data.ports !== null
                                    ) {
                                      // Handle port object - extract meaningful values
                                      const portObj = data.ports as any;

                                      // If it's a single port object with port/targetPort
                                      if (portObj.port || portObj.targetPort) {
                                        return `${portObj.port || portObj.targetPort}${portObj.targetPort && portObj.port !== portObj.targetPort ? `:${portObj.targetPort}` : ''}`;
                                      }

                                      // If it's an object with multiple port entries
                                      return Object.entries(portObj)
                                        .map(([key, value]) => {
                                          if (typeof value === 'object' && value !== null) {
                                            const port = value as any;
                                            return (
                                              port.port ||
                                              port.targetPort ||
                                              port.number ||
                                              port.value ||
                                              key
                                            );
                                          }
                                          return value;
                                        })
                                        .filter(p => p !== null && p !== undefined)
                                        .join(', ');
                                    } else {
                                      return String(data.ports);
                                    }
                                  })()}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Component Type Badge */}
                          <div className="mt-2">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              {componentType}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))
        )}

        {/* Selected Component Details */}
        {selectedComponent && (
          <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg">
            {(() => {
              // Find the selected component in the grouped data
              let selectedData = null;
              for (const [sourceFile, components] of Object.entries(groupedComponents)) {
                const found = components.find(({ name }) => name === selectedComponent);
                if (found) {
                  selectedData = { ...found, sourceFile };
                  break;
                }
              }

              if (!selectedData) return null;

              return (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-900">
                      {selectedData.data.name || selectedData.name}
                    </h4>
                    <button
                      onClick={() => setSelectedComponent(null)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">Source: {selectedData.sourceFile}</p>

                  {/* Full metadata display */}
                  <div className="space-y-3">
                    {selectedData.data.description && (
                      <div>
                        <h5 className="text-sm font-medium text-gray-700 mb-1">Description:</h5>
                        <p className="text-sm text-gray-600">{selectedData.data.description}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(selectedData.data).map(([key, value]) => {
                        if (key === 'name' || key === 'description' || !value) return null;
                        return (
                          <div key={key}>
                            <h5 className="text-sm font-medium text-gray-700 mb-1 capitalize">
                              {key}:
                            </h5>
                            <p className="text-sm text-gray-600 font-mono bg-gray-50 px-2 py-1 rounded">
                              {typeof value === 'object'
                                ? JSON.stringify(value, null, 2)
                                : String(value)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};

export default ArchitectureDiagram;
