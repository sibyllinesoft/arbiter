/**
 * CUE-Driven Architecture Diagram
 * Automatically generates architecture diagrams from CUE specifications
 */

import {
  type CueArchitectureData,
  type DiagramComponent,
  type DiagramConnection,
  type DiagramTheme,
  type DiagramType,
} from '@/types/architecture';
import { CueArchitectureParser } from '@/utils/cueArchitectureParser';
import { DiagramLayoutEngine } from '@/utils/diagramLayout';
import { clsx } from 'clsx';
import React, { useState, useEffect, useMemo } from 'react';

interface CueDrivenArchitectureDiagramProps {
  /** CUE specification data */
  cueData: CueArchitectureData;
  /** Type of diagram to generate */
  diagramType?: DiagramType;
  /** Layout algorithm */
  layoutType?: string;
  /** Custom theme */
  theme?: Partial<DiagramTheme>;
  /** Additional CSS classes */
  className?: string;
  /** Enable/disable interactivity */
  interactive?: boolean;
  /** Callback when component is selected */
  onComponentSelect?: (component: DiagramComponent) => void;
  /** Callback when connection is selected */
  onConnectionSelect?: (connection: DiagramConnection) => void;
}

// Default theme configuration
const DEFAULT_THEME: DiagramTheme = {
  name: 'default',
  layers: {
    presentation: {
      background: '#dbeafe',
      border: '#3b82f6',
      text: '#1e40af',
    },
    application: {
      background: '#dcfce7',
      border: '#22c55e',
      text: '#15803d',
    },
    service: {
      background: '#fef3c7',
      border: '#f59e0b',
      text: '#d97706',
    },
    data: {
      background: '#f3e8ff',
      border: '#a855f7',
      text: '#7c3aed',
    },
    external: {
      background: '#fee2e2',
      border: '#ef4444',
      text: '#dc2626',
    },
  },
  connections: {
    user_navigation: { color: '#3b82f6', width: 2, style: 'solid' },
    user_interaction: { color: '#10b981', width: 2, style: 'dashed' },
    api_call: { color: '#f59e0b', width: 2, style: 'solid' },
    capability_usage: { color: '#8b5cf6', width: 1.5, style: 'dotted' },
    state_transition: { color: '#ef4444', width: 2, style: 'solid' },
    data_flow: { color: '#6b7280', width: 1, style: 'solid' },
    dependency: { color: '#374151', width: 1, style: 'dashed' },
  },
  components: {
    defaultSize: { width: 150, height: 80 },
    minSize: { width: 100, height: 60 },
    padding: 8,
    borderRadius: 8,
  },
};

const DARK_THEME: DiagramTheme = {
  name: 'dark',
  layers: {
    presentation: {
      background: '#334155',
      border: '#60a5fa',
      text: '#bfdbfe',
    },
    application: {
      background: '#166534',
      border: '#4ade80',
      text: '#dcfce7',
    },
    service: {
      background: '#713f12',
      border: '#f59e0b',
      text: '#fcd34d',
    },
    data: {
      background: '#581c87',
      border: '#c084fc',
      text: '#e9d5ff',
    },
    external: {
      background: '#991b1b',
      border: '#f87171',
      text: '#fecaca',
    },
  },
  connections: {
    user_navigation: { color: '#60a5fa', width: 2, style: 'solid' },
    user_interaction: { color: '#4ade80', width: 2, style: 'dashed' },
    api_call: { color: '#f59e0b', width: 2, style: 'solid' },
    capability_usage: { color: '#c084fc', width: 1.5, style: 'dotted' },
    state_transition: { color: '#f87171', width: 2, style: 'solid' },
    data_flow: { color: '#9ca3af', width: 1, style: 'solid' },
    dependency: { color: '#6b7280', width: 1, style: 'dashed' },
  },
  components: {
    defaultSize: { width: 150, height: 80 },
    minSize: { width: 100, height: 60 },
    padding: 8,
    borderRadius: 8,
  },
};

export const CueDrivenArchitectureDiagram: React.FC<CueDrivenArchitectureDiagramProps> = ({
  cueData,
  diagramType = 'system_overview',
  layoutType,
  theme = {},
  className = '',
  interactive = true,
  onComponentSelect,
  onConnectionSelect,
}) => {
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);
  const [hoveredElement, setHoveredElement] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);

  // Detect dark mode
  useEffect(() => {
    const updateTheme = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };

    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  // Merge theme with defaults
  const baseTheme = useMemo(() => {
    const selectedTheme = isDark ? DARK_THEME : DEFAULT_THEME;
    return {
      ...selectedTheme,
      ...theme,
      layers: { ...selectedTheme.layers, ...theme.layers },
      connections: { ...selectedTheme.connections, ...theme.connections },
      components: { ...selectedTheme.components, ...theme.components },
    };
  }, [theme, isDark]);

  const effectiveTheme: DiagramTheme = baseTheme;

  // Parse CUE data into diagram components
  const { components, connections } = useMemo(() => {
    if (!cueData) {
      return { components: [], connections: [] };
    }

    const parsed = CueArchitectureParser.parseArchitecture(cueData);

    // Filter components based on diagram type
    let filteredComponents = parsed.components;
    let filteredConnections = parsed.connections;

    switch (diagramType) {
      case 'user_journey':
        filteredComponents = parsed.components.filter(c =>
          ['route', 'capability'].includes(c.type)
        );
        filteredConnections = parsed.connections.filter(c =>
          ['user_navigation', 'user_interaction', 'capability_usage'].includes(c.type)
        );
        break;

      case 'service_topology':
        filteredComponents = parsed.components.filter(c =>
          ['service', 'api_endpoint', 'external_system'].includes(c.type)
        );
        filteredConnections = parsed.connections.filter(c =>
          ['api_call', 'dependency'].includes(c.type)
        );
        break;

      case 'capability_map':
        filteredComponents = parsed.components.filter(c =>
          ['capability', 'route'].includes(c.type)
        );
        filteredConnections = parsed.connections.filter(c => c.type === 'capability_usage');
        break;

      case 'state_diagram':
        filteredComponents = parsed.components.filter(c => c.type === 'state_machine');
        filteredConnections = parsed.connections.filter(c => c.type === 'state_transition');
        break;

      case 'api_surface':
        filteredComponents = parsed.components.filter(c =>
          ['api_endpoint', 'service'].includes(c.type)
        );
        filteredConnections = parsed.connections.filter(c => c.type === 'api_call');
        break;
    }

    return { components: filteredComponents, connections: filteredConnections };
  }, [cueData, diagramType]);

  // Apply layout algorithm
  const { components: layoutedComponents, viewport } = useMemo(() => {
    if (components.length === 0) {
      return { components: [], viewport: { width: 800, height: 600 } };
    }

    const layoutEngine = new DiagramLayoutEngine();
    const algorithmType = layoutType || layoutEngine.suggestLayout(components, connections);

    return layoutEngine.applyLayout(components, connections, algorithmType);
  }, [components, connections, layoutType]);

  // Handle component selection
  const handleComponentClick = (component: DiagramComponent) => {
    if (!interactive) return;

    const newSelection = selectedComponent === component.id ? null : component.id;
    setSelectedComponent(newSelection);

    if (newSelection && onComponentSelect) {
      onComponentSelect(component);
    }
  };

  // Handle connection selection
  const handleConnectionClick = (connection: DiagramConnection) => {
    if (!interactive) return;

    const newSelection = selectedConnection === connection.id ? null : connection.id;
    setSelectedConnection(newSelection);

    if (newSelection && onConnectionSelect) {
      onConnectionSelect(connection);
    }
  };

  // Render a single component
  const renderComponent = (component: DiagramComponent) => {
    const layerStyle = effectiveTheme.layers[component.layer];
    const isSelected = selectedComponent === component.id;
    const isHovered = hoveredElement === component.id;

    // Dynamic hover detail colors
    const hoverFill = isDark ? '#1f2937' : 'white';
    const hoverText = isDark ? '#d1d5db' : '#374151';

    return (
      <g
        key={component.id}
        transform={`translate(${component.position.x}, ${component.position.y})`}
        onMouseEnter={() => setHoveredElement(component.id)}
        onMouseLeave={() => setHoveredElement(null)}
        onClick={() => handleComponentClick(component)}
        className={interactive ? 'cursor-pointer' : ''}
      >
        {/* Component rectangle */}
        <rect
          width={component.size.width}
          height={component.size.height}
          rx={effectiveTheme.components.borderRadius}
          ry={effectiveTheme.components.borderRadius}
          fill={layerStyle.background}
          stroke={layerStyle.border}
          strokeWidth={isSelected ? 3 : isHovered ? 2 : 1}
          className={clsx(
            'transition-all duration-200',
            isHovered && 'drop-shadow-lg',
            isSelected && 'drop-shadow-xl'
          )}
        />

        {/* Component icon based on type */}
        {renderComponentIcon(component, layerStyle.text)}

        {/* Component name */}
        <text
          x={component.size.width / 2}
          y={25}
          textAnchor="middle"
          className="text-sm font-semibold"
          fill={layerStyle.text}
        >
          {component.name}
        </text>

        {/* Component description */}
        <foreignObject
          x={effectiveTheme.components.padding}
          y={35}
          width={component.size.width - effectiveTheme.components.padding * 2}
          height={component.size.height - 45}
        >
          <div className="text-xs text-gray-600 dark:text-gray-400 leading-tight overflow-hidden">
            {component.description}
          </div>
        </foreignObject>

        {/* Ports */}
        {component.ports?.map(port => (
          <circle
            key={port.id}
            cx={port.position.x}
            cy={port.position.y}
            r={3}
            fill={layerStyle.border}
            stroke={isDark ? '#374151' : 'white'}
            strokeWidth={1}
          />
        ))}

        {/* Hover details */}
        {isHovered && renderComponentDetails(component, layerStyle, hoverFill, hoverText)}
      </g>
    );
  };

  // Render component type icon
  const renderComponentIcon = (component: DiagramComponent, color: string) => {
    const iconSize = 16;
    const iconX = component.size.width - iconSize - 8;
    const iconY = 8;

    const iconPaths = {
      route: 'M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z',
      service: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z',
      capability:
        'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
      api_endpoint:
        'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z',
      state_machine: 'M4 12a8 8 0 018-8V0l4 4-4 4V4a6 6 0 100 12 6 6 0 000-12z',
      external_system:
        'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5z',
      flow: 'M9 5v2h6V5H9zm0 4v2h6V9H9zm0 4v2h6v-2H9zm0 4v2h6v-2H9z',
      component: 'M3 3h18v18H3V3z',
      data_store: 'M4 4h16v2H4V4zm0 4h16v2H4V8zm0 4h16v2H4v-2zm0 4h16v2H4v-2z',
    };

    const path = iconPaths[component.type] || iconPaths.service;

    return (
      <g transform={`translate(${iconX}, ${iconY}) scale(0.6)`}>
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
          <path d={path} fill={color} />
        </svg>
      </g>
    );
  };

  // Render component hover details
  const renderComponentDetails = (
    component: DiagramComponent,
    layerStyle: any,
    hoverFill: string,
    hoverText: string
  ) => {
    const details = [];

    if (component.technology) {
      details.push(`Tech: ${component.technology}`);
    }

    if (component.language) {
      details.push(`Lang: ${component.language}`);
    }

    if (component.capabilities?.length) {
      details.push(`Caps: ${component.capabilities.slice(0, 2).join(', ')}`);
    }

    if (details.length === 0) return null;

    const detailHeight = details.length * 12 + 16;

    return (
      <g>
        <rect
          x={-10}
          y={component.size.height + 5}
          width={component.size.width + 20}
          height={detailHeight}
          rx={4}
          ry={4}
          fill={hoverFill}
          stroke={layerStyle.border}
          strokeWidth={1}
          className="drop-shadow-md"
        />
        {details.map((detail, index) => (
          <text
            key={index}
            x={component.size.width / 2}
            y={component.size.height + 20 + index * 12}
            textAnchor="middle"
            className="text-xs"
            fill={hoverText}
          >
            {detail}
          </text>
        ))}
      </g>
    );
  };

  // Render a single connection
  const renderConnection = (connection: DiagramConnection) => {
    const fromComponent = layoutedComponents.find(c => c.id === connection.from.componentId);
    const toComponent = layoutedComponents.find(c => c.id === connection.to.componentId);

    if (!fromComponent || !toComponent) return null;

    const connectionStyle = effectiveTheme.connections[connection.type];
    const isSelected = selectedConnection === connection.id;
    const isHovered = hoveredElement === connection.id;

    // Calculate connection points
    const fromX = fromComponent.position.x + fromComponent.size.width / 2;
    const fromY = fromComponent.position.y + fromComponent.size.height;
    const toX = toComponent.position.x + toComponent.size.width / 2;
    const toY = toComponent.position.y;

    // Create curved path
    const midY = fromY + (toY - fromY) / 2;
    const pathD = `M ${fromX} ${fromY} Q ${fromX} ${midY} ${toX} ${toY}`;

    return (
      <g
        key={connection.id}
        onMouseEnter={() => setHoveredElement(connection.id)}
        onMouseLeave={() => setHoveredElement(null)}
        onClick={() => handleConnectionClick(connection)}
        className={interactive ? 'cursor-pointer' : ''}
      >
        {/* Connection path */}
        <path
          d={pathD}
          stroke={connectionStyle.color}
          strokeWidth={isSelected || isHovered ? connectionStyle.width + 1 : connectionStyle.width}
          strokeDasharray={
            connectionStyle.style === 'dashed'
              ? '5,5'
              : connectionStyle.style === 'dotted'
                ? '2,2'
                : 'none'
          }
          fill="none"
          markerEnd="url(#arrowhead)"
          className="transition-all duration-200"
        />

        {/* Connection label */}
        {connection.label && (
          <text
            x={(fromX + toX) / 2}
            y={midY - 5}
            textAnchor="middle"
            className="text-xs"
            fill={connectionStyle.color}
            fontWeight="500"
            style={{
              fontSize: isHovered || isSelected ? '11px' : '10px',
              fontWeight: isHovered || isSelected ? '600' : '500',
            }}
          >
            {connection.label}
          </text>
        )}
      </g>
    );
  };

  // Generate suggested diagram types
  const suggestedTypes = useMemo(() => {
    return CueArchitectureParser.suggestDiagramTypes(cueData);
  }, [cueData]);

  if (!cueData || Object.keys(cueData).length === 0) {
    return (
      <div
        className={clsx(
          'flex items-center justify-center h-64 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg',
          className
        )}
      >
        <div className="text-center">
          <div className="text-gray-400 dark:text-gray-500 mb-2">
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
          <p className="text-gray-600 dark:text-gray-300">No CUE data provided</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Upload or paste CUE specification to generate diagram
          </p>
        </div>
      </div>
    );
  }

  if (layoutedComponents.length === 0) {
    return (
      <div
        className={clsx(
          'flex items-center justify-center h-64 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg',
          className
        )}
      >
        <div className="text-center">
          <div className="text-gray-400 dark:text-gray-500 mb-2">
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
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </div>
          <p className="text-gray-600 dark:text-gray-300">No architectural components found</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            The CUE specification doesn't contain recognizable architectural elements
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('h-full flex flex-col bg-gray-50 dark:bg-gray-900', className)}>
      {/* Header */}
      <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              CUE-Driven Architecture Diagram
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Generated from {cueData.metadata?.name || 'CUE specification'} •{' '}
              {layoutedComponents.length} components • {connections.length} connections
            </p>
          </div>

          {/* Diagram type selector */}
          {suggestedTypes.length > 1 && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">View:</label>
              <select
                value={diagramType}
                onChange={e => {
                  /* Handle diagram type change */
                }}
                className="text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded px-2 py-1"
              >
                {suggestedTypes.map(type => (
                  <option key={type} value={type}>
                    {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-4 text-xs">
          {Object.entries(effectiveTheme.layers).map(([layer, style]) => {
            const hasComponents = layoutedComponents.some(c => c.layer === layer);
            if (!hasComponents) return null;

            return (
              <div key={layer} className="flex items-center gap-1">
                <div
                  className="w-3 h-3 rounded border"
                  style={{ backgroundColor: style.background, borderColor: style.border }}
                />
                <span className="capitalize font-medium text-gray-700 dark:text-gray-300">
                  {layer.replace('_', ' ')}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Diagram */}
      <div className="flex-1 overflow-auto p-4 scrollbar-transparent">
        <svg
          viewBox={`0 0 ${viewport.width} ${viewport.height}`}
          className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
          style={{ minHeight: '400px' }}
        >
          {/* Arrow marker definition */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill={isDark ? '#9ca3af' : '#6b7280'} />
            </marker>
          </defs>

          {/* Connections (rendered first) */}
          {connections.map(renderConnection)}

          {/* Components */}
          {layoutedComponents.map(renderComponent)}
        </svg>
      </div>

      {/* Details panel */}
      {selectedComponent && (
        <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          {(() => {
            const component = layoutedComponents.find(c => c.id === selectedComponent);
            if (!component) return null;

            return (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                    {component.name}
                  </h4>
                  <button
                    onClick={() => setSelectedComponent(null)}
                    className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {component.description}
                </p>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Type:</span>
                    <span className="ml-2 text-gray-600 dark:text-gray-400">
                      {component.type.replace('_', ' ')}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Layer:</span>
                    <span className="ml-2 text-gray-600 dark:text-gray-400">
                      {component.layer.replace('_', ' ')}
                    </span>
                  </div>
                  {component.technology && (
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        Technology:
                      </span>
                      <span className="ml-2 text-gray-600 dark:text-gray-400">
                        {component.technology}
                      </span>
                    </div>
                  )}
                  {component.language && (
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        Language:
                      </span>
                      <span className="ml-2 text-gray-600 dark:text-gray-400">
                        {component.language}
                      </span>
                    </div>
                  )}
                </div>

                {component.capabilities && component.capabilities.length > 0 && (
                  <div className="mt-3">
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      Capabilities:
                    </span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {component.capabilities.map(cap => (
                        <span
                          key={cap}
                          className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-md"
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default CueDrivenArchitectureDiagram;
