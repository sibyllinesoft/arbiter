import React, { useState } from 'react';
import { clsx } from 'clsx';

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
    text: '#1e40af'
  },
  backend: {
    bg: '#dcfce7',
    border: '#22c55e',
    text: '#15803d'
  },
  cli: {
    bg: '#fef3c7',
    border: '#f59e0b',
    text: '#d97706'
  },
  data: {
    bg: '#f3e8ff',
    border: '#a855f7',
    text: '#7c3aed'
  },
  external: {
    bg: '#fee2e2',
    border: '#ef4444',
    text: '#dc2626'
  }
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
      { id: 'websocket', position: { x: 150, y: 100 } }
    ]
  },
  {
    id: 'monaco-editor',
    name: 'Monaco Editor',
    type: 'frontend', 
    description: 'Code editing with CUE syntax highlighting and validation',
    technologies: ['Monaco Editor', 'CUE Language Support'],
    position: { x: 300, y: 50 },
    size: { width: 180, height: 80 }
  },
  {
    id: 'diagram-renderers',
    name: 'Diagram Renderers',
    type: 'frontend',
    description: 'Flow, Site, FSM, View diagrams with interactive SVG/Graphviz',
    technologies: ['Graphviz WASM', 'Mermaid', 'SVG'],
    position: { x: 520, y: 50 },
    size: { width: 200, height: 100 }
  },
  
  // Backend Layer
  {
    id: 'api-server',
    name: 'API Server',
    type: 'backend',
    description: 'Bun HTTP server with REST API and WebSocket support',
    technologies: ['Bun', 'TypeScript', 'WebSockets'],
    position: { x: 50, y: 200 },
    size: { width: 180, height: 100 },
    ports: [
      { id: 'rest-api', position: { x: 90, y: 200 } },
      { id: 'websocket-server', position: { x: 140, y: 200 } },
      { id: 'spec-engine', position: { x: 90, y: 300 } }
    ]
  },
  {
    id: 'spec-engine',
    name: 'CUE Spec Engine',
    type: 'backend',
    description: 'CUE specification validation, processing, and schema management',
    technologies: ['CUE Lang', 'JSON Schema', 'Validation'],
    position: { x: 270, y: 200 },
    size: { width: 180, height: 100 },
    ports: [
      { id: 'validation', position: { x: 360, y: 200 } },
      { id: 'ir-gen', position: { x: 360, y: 250 } }
    ]
  },
  {
    id: 'ir-generator',
    name: 'IR Generator',
    type: 'backend',
    description: 'Intermediate representation generation from CUE specs',
    technologies: ['Code Generation', 'Templates', 'AST Processing'],
    position: { x: 490, y: 200 },
    size: { width: 180, height: 100 }
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
      { id: 'file-ops', position: { x: 100, y: 450 } }
    ]
  },
  {
    id: 'command-handlers',
    name: 'Command Handlers',
    type: 'cli',
    description: 'Init, add, generate, check, sync, integrate commands',
    technologies: ['TypeScript', 'File System', 'Process Management'],
    position: { x: 300, y: 350 },
    size: { width: 200, height: 100 }
  },
  
  // Data Layer
  {
    id: 'cue-specs',
    name: 'CUE Specifications',
    type: 'data',
    description: 'Declarative system specifications in CUE format',
    technologies: ['CUE Files', 'Schema Definitions', 'Constraints'],
    position: { x: 50, y: 500 },
    size: { width: 180, height: 80 }
  },
  {
    id: 'sqlite-db',
    name: 'SQLite Database',
    type: 'data',
    description: 'Project metadata, fragments, validation cache, user data',
    technologies: ['SQLite', 'SQL Migrations', 'Data Persistence'],
    position: { x: 270, y: 500 },
    size: { width: 180, height: 80 }
  },
  {
    id: 'generated-code',
    name: 'Generated Artifacts',
    type: 'data',
    description: 'Generated code, configs, CI/CD pipelines, documentation',
    technologies: ['Templates', 'Code Generation', 'File Output'],
    position: { x: 490, y: 500 },
    size: { width: 180, height: 80 }
  },
  
  // External Integrations
  {
    id: 'git-repos',
    name: 'Git Repositories',
    type: 'external',
    description: 'Version control integration and code deployment',
    technologies: ['Git', 'GitHub/GitLab', 'CI/CD'],
    position: { x: 50, y: 620 },
    size: { width: 160, height: 70 }
  },
  {
    id: 'deployment',
    name: 'Deployment Targets', 
    type: 'external',
    description: 'Production environments and cloud platforms',
    technologies: ['Docker', 'Kubernetes', 'Cloud Services'],
    position: { x: 250, y: 620 },
    size: { width: 160, height: 70 }
  }
];

const ARCHITECTURE_CONNECTIONS: Connection[] = [
  // Frontend to Backend
  { from: { componentId: 'react-app', portId: 'api-client' }, to: { componentId: 'api-server', portId: 'rest-api' }, type: 'api', label: 'REST API' },
  { from: { componentId: 'react-app', portId: 'websocket' }, to: { componentId: 'api-server', portId: 'websocket-server' }, type: 'websocket', label: 'Real-time Updates' },
  
  // Backend Internal
  { from: { componentId: 'api-server', portId: 'spec-engine' }, to: { componentId: 'spec-engine', portId: 'validation' }, type: 'api', label: 'Validation' },
  { from: { componentId: 'spec-engine', portId: 'ir-gen' }, to: { componentId: 'ir-generator' }, type: 'data', label: 'IR Generation' },
  
  // CLI to Backend
  { from: { componentId: 'cli-interface', portId: 'api-client-cli' }, to: { componentId: 'api-server' }, type: 'api', label: 'CLI API' },
  
  // Data Connections
  { from: { componentId: 'api-server' }, to: { componentId: 'sqlite-db' }, type: 'data', label: 'Persistence' },
  { from: { componentId: 'spec-engine' }, to: { componentId: 'cue-specs' }, type: 'file', label: 'Read Specs' },
  { from: { componentId: 'cli-interface', portId: 'file-ops' }, to: { componentId: 'cue-specs' }, type: 'file', label: 'File Operations' },
  { from: { componentId: 'ir-generator' }, to: { componentId: 'generated-code' }, type: 'file', label: 'Code Generation' },
  
  // External Integrations
  { from: { componentId: 'cli-interface' }, to: { componentId: 'git-repos' }, type: 'api', label: 'Git Operations' },
  { from: { componentId: 'generated-code' }, to: { componentId: 'deployment' }, type: 'api', label: 'Deploy Artifacts' }
];

const ArchitectureDiagram: React.FC<ArchitectureDiagramProps> = ({ projectId, className = '' }) => {
  const [hoveredComponent, setHoveredComponent] = useState<string | null>(null);
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);
  
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
        onClick={() => setSelectedComponent(component.id === selectedComponent ? null : component.id)}
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
          y={20}
          textAnchor="middle"
          className="text-sm font-semibold"
          fill={colors.text}
        >
          {component.name}
        </text>
        
        {/* Component Description */}
        <foreignObject
          x={8}
          y={30}
          width={component.size.width - 16}
          height={component.size.height - 40}
        >
          <div className="text-xs text-gray-600 leading-tight">
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
              className="text-xs font-medium"
              fill={colors.text}
            >
              Technologies:
            </text>
            {component.technologies.map((tech, index) => (
              <text
                key={tech}
                x={component.size.width / 2}
                y={component.size.height + 35 + index * 12}
                textAnchor="middle"
                className="text-xs"
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
            r={3}
            fill={colors.border}
            stroke="white"
            strokeWidth={1}
          />
        ))}
      </g>
    );
  };
  
  const renderConnection = (connection: Connection) => {
    const fromComponent = ARCHITECTURE_COMPONENTS.find(c => c.id === connection.from.componentId);
    const toComponent = ARCHITECTURE_COMPONENTS.find(c => c.id === connection.to.componentId);
    
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
      data: '#8b5cf6'
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
  
  return (
    <div className={clsx('h-full overflow-auto bg-gray-50', className)}>
      {/* Header */}
      <div className="p-4 bg-white border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">System Architecture</h3>
        <p className="text-sm text-gray-600">
          Interactive diagram showing the Arbiter system components and their relationships
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
      
      {/* Architecture Diagram */}
      <div className="p-4">
        <svg viewBox="0 0 800 750" className="w-full h-auto min-h-[600px] bg-white border border-gray-200 rounded-lg">
          {/* Arrow Marker Definition */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon
                points="0 0, 10 3.5, 0 7"
                fill="#6b7280"
              />
            </marker>
          </defs>
          
          {/* Layer Background */}
          <g className="layer-backgrounds">
            <rect x="30" y="30" width="720" height="140" rx="8" fill="#f8fafc" stroke="#e2e8f0" strokeDasharray="5,5" />
            <text x="40" y="50" className="text-sm font-medium" fill="#64748b">Frontend Layer</text>
            
            <rect x="30" y="180" width="720" height="140" rx="8" fill="#f0fdf4" stroke="#dcfce7" strokeDasharray="5,5" />
            <text x="40" y="200" className="text-sm font-medium" fill="#16a34a">Backend Layer</text>
            
            <rect x="30" y="330" width="720" height="140" rx="8" fill="#fffbeb" stroke="#fef3c7" strokeDasharray="5,5" />
            <text x="40" y="350" className="text-sm font-medium" fill="#d97706">CLI Layer</text>
            
            <rect x="30" y="480" width="720" height="120" rx="8" fill="#faf5ff" stroke="#f3e8ff" strokeDasharray="5,5" />
            <text x="40" y="500" className="text-sm font-medium" fill="#7c3aed">Data Layer</text>
            
            <rect x="30" y="610" width="720" height="100" rx="8" fill="#fef2f2" stroke="#fee2e2" strokeDasharray="5,5" />
            <text x="40" y="630" className="text-sm font-medium" fill="#dc2626">External Systems</text>
          </g>
          
          {/* Connections (rendered first so they appear behind components) */}
          {ARCHITECTURE_CONNECTIONS.map(renderConnection)}
          
          {/* Components */}
          {ARCHITECTURE_COMPONENTS.map(renderComponent)}
        </svg>
        
        {/* Component Details Panel */}
        {selectedComponent && (
          <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg">
            {(() => {
              const component = ARCHITECTURE_COMPONENTS.find(c => c.id === selectedComponent);
              if (!component) return null;
              
              return (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-900">{component.name}</h4>
                    <button
                      onClick={() => setSelectedComponent(null)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{component.description}</p>
                  <div className="space-y-2">
                    <h5 className="text-sm font-medium text-gray-700">Technologies:</h5>
                    <div className="flex flex-wrap gap-1">
                      {component.technologies.map(tech => (
                        <span
                          key={tech}
                          className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-md"
                        >
                          {tech}
                        </span>
                      ))}
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