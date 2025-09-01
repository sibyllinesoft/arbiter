import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { AlertCircle, RefreshCw, Info, AlertTriangle, XCircle } from 'lucide-react';

interface ViolationData {
  severity: 'error' | 'warning' | 'info';
  violationIds: string[];
  count: number;
}

interface GraphNode {
  id: string;
  label: string;
  type: 'object' | 'array' | 'value';
  children?: string[];
  violations?: ViolationData;
}

interface CueError {
  message: string;
  line?: number;
  column?: number;
  filename?: string;
  severity?: 'error' | 'warning' | 'info';
  violationId?: string;
  friendlyMessage?: string;
  suggestedFix?: string;
}

interface ViolationAwareMermaidRendererProps {
  chart?: string;
  nodes?: GraphNode[];
  errors?: CueError[];
  className?: string;
  title?: string;
  showHeatmap?: boolean;
  onJumpToLine?: (line: number) => void;
}

export const ViolationAwareMermaidRenderer: React.FC<ViolationAwareMermaidRendererProps> = ({
  chart,
  nodes = [],
  errors = [],
  className = '',
  title,
  showHeatmap = false,
  onJumpToLine,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showTooltip, setShowTooltip] = useState<{
    visible: boolean;
    content: CueError | null;
    x: number;
    y: number;
  }>({ visible: false, content: null, x: 0, y: 0 });

  useEffect(() => {
    // Initialize mermaid with violation-aware styling
    mermaid.initialize({
      startOnLoad: true,
      theme: 'default',
      securityLevel: 'loose',
      fontFamily: 'Inter, system-ui, sans-serif',
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis',
        padding: 20,
      },
      themeVariables: {
        // Custom colors for violations
        primaryColor: '#f3f4f6',
        primaryTextColor: '#1f2937',
        primaryBorderColor: '#d1d5db',
        lineColor: '#6b7280',
      },
    });
  }, []);

  const generateViolationAwareChart = (): string => {
    if (chart) {
      return enhanceChartWithViolations(chart, nodes, errors);
    }

    if (showHeatmap) {
      return generateHeatmapChart(nodes);
    }

    return generateFlowChartFromNodes(nodes);
  };

  const enhanceChartWithViolations = (originalChart: string, nodes: GraphNode[], errors: CueError[]): string => {
    let enhancedChart = originalChart;

    // Add violation styling to existing chart
    nodes.forEach(node => {
      if (node.violations) {
        const styleClass = getViolationStyleClass(node.violations.severity);
        const nodeRegex = new RegExp(`(${node.id})(\\[[^\\]]+\\])`, 'g');
        enhancedChart = enhancedChart.replace(nodeRegex, (match, nodeId, nodeContent) => {
          return `${nodeId}${nodeContent}:::${styleClass}`;
        });
      }
    });

    // Add CSS classes for violation styling
    enhancedChart += '\n\n' + getViolationStyleDefinitions();

    return enhancedChart;
  };

  const generateFlowChartFromNodes = (nodes: GraphNode[]): string => {
    if (nodes.length === 0) {
      return 'graph TD\n  A[No data to visualize]';
    }

    let chart = 'graph TD\n';
    
    nodes.forEach((node, index) => {
      const nodeId = `node_${index}`;
      const label = node.label;
      const shape = getNodeShape(node.type);
      
      if (node.violations) {
        const styleClass = getViolationStyleClass(node.violations.severity);
        chart += `  ${nodeId}${shape.replace('LABEL', label)}:::${styleClass}\n`;
      } else {
        chart += `  ${nodeId}${shape.replace('LABEL', label)}\n`;
      }

      // Add connections to children
      if (node.children) {
        node.children.slice(0, 5).forEach((child, childIndex) => {
          const childNodeId = `child_${index}_${childIndex}`;
          chart += `  ${childNodeId}[${child}]\n`;
          chart += `  ${nodeId} --> ${childNodeId}\n`;
        });
      }
    });

    chart += '\n' + getViolationStyleDefinitions();
    return chart;
  };

  const generateHeatmapChart = (nodes: GraphNode[]): string => {
    const subsystemMap = aggregateViolationsBySubsystem(nodes);
    
    let chart = 'graph TD\n';
    
    Object.entries(subsystemMap).forEach(([subsystem, data], index) => {
      const nodeId = `subsystem_${index}`;
      const severity = data.severity;
      const count = data.count;
      const label = `${subsystem}\\n${count} issues`;
      
      const styleClass = getHeatmapStyleClass(severity, count);
      chart += `  ${nodeId}[${label}]:::${styleClass}\n`;
    });

    chart += '\n' + getHeatmapStyleDefinitions();
    return chart;
  };

  const aggregateViolationsBySubsystem = (nodes: GraphNode[]) => {
    const subsystemMap: Record<string, { severity: string; count: number; violations: string[] }> = {};
    
    nodes.forEach(node => {
      if (node.violations) {
        const subsystem = node.id.split('.')[0] || 'root';
        
        if (!subsystemMap[subsystem]) {
          subsystemMap[subsystem] = {
            severity: node.violations.severity,
            count: 0,
            violations: []
          };
        }
        
        subsystemMap[subsystem].count += node.violations.count;
        subsystemMap[subsystem].violations.push(...node.violations.violationIds);
        
        // Use highest severity
        if (node.violations.severity === 'error' || 
           (node.violations.severity === 'warning' && subsystemMap[subsystem].severity === 'info')) {
          subsystemMap[subsystem].severity = node.violations.severity;
        }
      }
    });
    
    return subsystemMap;
  };

  const getNodeShape = (type: string): string => {
    switch (type) {
      case 'object': return '[LABEL]';
      case 'array': return '(LABEL)';
      case 'value': return '{LABEL}';
      default: return '[LABEL]';
    }
  };

  const getViolationStyleClass = (severity: string): string => {
    switch (severity) {
      case 'error': return 'violationError';
      case 'warning': return 'violationWarning';
      case 'info': return 'violationInfo';
      default: return 'violationError';
    }
  };

  const getHeatmapStyleClass = (severity: string, count: number): string => {
    const intensity = Math.min(count / 5, 1); // Cap at 5+ violations for max intensity
    
    if (severity === 'error') {
      return intensity > 0.7 ? 'heatmapCritical' : 'heatmapHigh';
    } else if (severity === 'warning') {
      return intensity > 0.7 ? 'heatmapMedium' : 'heatmapLow';
    }
    return 'heatmapInfo';
  };

  const getViolationStyleDefinitions = (): string => {
    return `
    classDef violationError fill:#fef2f2,stroke:#dc2626,stroke-width:3px,color:#dc2626
    classDef violationWarning fill:#fffbeb,stroke:#d97706,stroke-width:2px,color:#d97706
    classDef violationInfo fill:#f0f9ff,stroke:#0284c7,stroke-width:1px,color:#0284c7
    `;
  };

  const getHeatmapStyleDefinitions = (): string => {
    return `
    classDef heatmapCritical fill:#dc2626,stroke:#b91c1c,stroke-width:3px,color:white
    classDef heatmapHigh fill:#f87171,stroke:#dc2626,stroke-width:2px,color:white
    classDef heatmapMedium fill:#fbbf24,stroke:#d97706,stroke-width:2px,color:white
    classDef heatmapLow fill:#fde047,stroke:#ca8a04,stroke-width:1px,color:#92400e
    classDef heatmapInfo fill:#bfdbfe,stroke:#3b82f6,stroke-width:1px,color:#1d4ed8
    `;
  };

  const handleNodeClick = (event: MouseEvent) => {
    const target = event.target as SVGElement;
    
    // Find the node data based on the clicked element
    const nodeId = target.getAttribute('data-id') || target.textContent || '';
    const relatedErrors = errors.filter(error => 
      error.violationId && nodes.some(node => 
        node.id === nodeId && node.violations?.violationIds.includes(error.violationId!)
      )
    );

    if (relatedErrors.length > 0) {
      const error = relatedErrors[0];
      setShowTooltip({
        visible: true,
        content: error,
        x: event.clientX,
        y: event.clientY,
      });
    }
  };

  const renderChart = async () => {
    if (!containerRef.current) return;

    try {
      setIsLoading(true);
      setError(null);

      // Clear previous content
      containerRef.current.innerHTML = '';

      // Generate the violation-aware chart
      const chartDefinition = generateViolationAwareChart();

      // Generate unique ID for this diagram
      const diagramId = `violation-mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Render the diagram
      const { svg } = await mermaid.render(diagramId, chartDefinition);

      // Insert the SVG into the container
      containerRef.current.innerHTML = svg;

      // Make sure the SVG is responsive
      const svgElement = containerRef.current.querySelector('svg');
      if (svgElement) {
        svgElement.style.maxWidth = '100%';
        svgElement.style.height = 'auto';
        svgElement.style.display = 'block';
        svgElement.style.margin = '0 auto';

        // Add click handlers for violation tooltips
        const nodeElements = svgElement.querySelectorAll('g.node');
        nodeElements.forEach((nodeElement, index) => {
          nodeElement.addEventListener('click', handleNodeClick);
          // Add data attributes for easier identification
          nodeElement.setAttribute('data-node-index', index.toString());
          if (nodes[index]) {
            nodeElement.setAttribute('data-id', nodes[index].id);
          }
        });
      }
    } catch (err) {
      console.error('Failed to render violation-aware mermaid diagram:', err);
      setError(err instanceof Error ? err.message : 'Failed to render diagram');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    renderChart();
  }, [chart, nodes, errors, showHeatmap]);

  const handleRetry = () => {
    renderChart();
  };

  const handleTooltipClose = () => {
    setShowTooltip({ visible: false, content: null, x: 0, y: 0 });
  };

  const handleJumpToLine = (line: number) => {
    if (onJumpToLine) {
      onJumpToLine(line);
    }
    handleTooltipClose();
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error': return <XCircle className="w-4 h-4 text-red-600" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      case 'info': return <Info className="w-4 h-4 text-blue-600" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center min-h-[200px] ${className}`}>
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-gray-600">Rendering violation-aware diagram...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center min-h-[200px] ${className}`}>
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h4 className="text-red-700 font-medium mb-2">Diagram Render Error</h4>
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <button
            onClick={handleRetry}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 text-red-800 rounded-md hover:bg-red-200 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={className}>
        {title && (
          <h4 className="text-sm font-semibold text-gray-700 mb-4 text-center">
            {title}
          </h4>
        )}
        <div className="bg-white rounded-lg border border-gray-200 p-4 relative">
          <div 
            ref={containerRef} 
            className="mermaid-container flex items-center justify-center min-h-[200px]"
          />
          
          {/* Violation Summary */}
          {errors.length > 0 && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <h5 className="text-sm font-medium text-gray-700 mb-2">
                Violations Summary ({errors.length} total)
              </h5>
              <div className="space-y-1 text-xs text-gray-600">
                <div className="flex items-center gap-1">
                  <XCircle className="w-3 h-3 text-red-600" />
                  <span>{errors.filter(e => e.severity === 'error' || !e.severity).length} Errors</span>
                </div>
                <div className="flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                  <span>{errors.filter(e => e.severity === 'warning').length} Warnings</span>
                </div>
                <div className="flex items-center gap-1">
                  <Info className="w-3 h-3 text-blue-600" />
                  <span>{errors.filter(e => e.severity === 'info').length} Info</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Violation Tooltip */}
      {showTooltip.visible && showTooltip.content && (
        <div 
          className="fixed z-50 bg-white border border-gray-300 rounded-lg shadow-lg p-4 max-w-sm"
          style={{
            left: showTooltip.x + 10,
            top: showTooltip.y - 10,
          }}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-1">
              {getSeverityIcon(showTooltip.content.severity || 'error')}
            </div>
            <div className="flex-1 min-w-0">
              <h6 className="text-sm font-medium text-gray-900 mb-1">
                {showTooltip.content.severity?.toUpperCase() || 'ERROR'}
              </h6>
              <p className="text-sm text-gray-700 mb-2">
                {showTooltip.content.friendlyMessage || showTooltip.content.message}
              </p>
              {showTooltip.content.suggestedFix && (
                <p className="text-xs text-blue-600 mb-2 font-medium">
                  Suggestion: {showTooltip.content.suggestedFix}
                </p>
              )}
              <div className="flex gap-2">
                {showTooltip.content.line && (
                  <button
                    onClick={() => handleJumpToLine(showTooltip.content.line!)}
                    className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded hover:bg-blue-200"
                  >
                    Jump to line {showTooltip.content.line}
                  </button>
                )}
                <button
                  onClick={handleTooltipClose}
                  className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded hover:bg-gray-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ViolationAwareMermaidRenderer;