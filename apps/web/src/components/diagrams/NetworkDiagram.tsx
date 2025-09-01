import React, { useEffect, useRef } from 'react';
import { Network } from 'vis-network';
import { DataSet } from 'vis-data';

interface NetworkNode {
  id: string;
  label: string;
  group?: string;
  color?: string;
  shape?: string;
  size?: number;
}

interface NetworkEdge {
  id?: string;
  from: string;
  to: string;
  label?: string;
  arrows?: string;
  color?: string;
  dashes?: boolean;
}

interface NetworkDiagramProps {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  className?: string;
  title?: string;
  options?: any;
}

export const NetworkDiagram: React.FC<NetworkDiagramProps> = ({
  nodes,
  edges,
  className = '',
  title,
  options = {},
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create DataSets
    const nodeDataSet = new DataSet(nodes);
    const edgeDataSet = new DataSet(edges);

    // Default options
    const defaultOptions = {
      nodes: {
        borderWidth: 2,
        borderWidthSelected: 4,
        chosen: true,
        font: {
          size: 12,
          color: '#343a40',
          face: 'Inter, system-ui, sans-serif',
        },
        scaling: {
          min: 10,
          max: 30,
        },
        shadow: {
          enabled: true,
          color: 'rgba(0,0,0,0.1)',
          size: 5,
          x: 2,
          y: 2,
        },
      },
      edges: {
        width: 2,
        color: {
          color: '#848484',
          highlight: '#2563eb',
          hover: '#3b82f6',
        },
        smooth: {
          type: 'cubicBezier',
          forceDirection: 'horizontal',
          roundness: 0.4,
        },
        arrows: {
          to: {
            enabled: true,
            scaleFactor: 0.8,
          },
        },
        font: {
          size: 11,
          color: '#6b7280',
          align: 'middle',
          background: 'rgba(255,255,255,0.8)',
          strokeWidth: 0,
        },
      },
      physics: {
        enabled: true,
        stabilization: {
          enabled: true,
          iterations: 100,
          updateInterval: 25,
        },
        barnesHut: {
          gravitationalConstant: -2000,
          centralGravity: 0.3,
          springLength: 150,
          springConstant: 0.04,
          damping: 0.09,
          avoidOverlap: 0.1,
        },
      },
      interaction: {
        hover: true,
        zoomView: true,
        dragView: true,
        selectConnectedEdges: false,
        tooltipDelay: 200,
      },
      layout: {
        improvedLayout: true,
        clusterThreshold: 150,
      },
      ...options,
    };

    // Create network
    const data = {
      nodes: nodeDataSet,
      edges: edgeDataSet,
    };

    networkRef.current = new Network(containerRef.current, data, defaultOptions);

    // Add event listeners
    networkRef.current.on('click', (params) => {
      if (params.nodes.length > 0) {
        console.log('Node clicked:', params.nodes[0]);
      }
    });

    networkRef.current.on('hoverNode', (params) => {
      document.body.style.cursor = 'pointer';
    });

    networkRef.current.on('blurNode', () => {
      document.body.style.cursor = 'default';
    });

    // Cleanup function
    return () => {
      if (networkRef.current) {
        networkRef.current.destroy();
        networkRef.current = null;
      }
      document.body.style.cursor = 'default';
    };
  }, [nodes, edges, options]);

  return (
    <div className={className}>
      {title && (
        <h4 className="text-sm font-semibold text-gray-700 mb-4 text-center">
          {title}
        </h4>
      )}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div 
          ref={containerRef}
          className="w-full h-96"
          style={{ minHeight: '400px' }}
        />
      </div>
    </div>
  );
};

export default NetworkDiagram;