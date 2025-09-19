import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface MermaidRendererProps {
  chart: string;
  className?: string;
  title?: string;
}

export const MermaidRenderer: React.FC<MermaidRendererProps> = ({
  chart,
  className = '',
  title,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initialize mermaid with modern configuration
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
      sequence: {
        useMaxWidth: true,
        rightAngles: false,
        showSequenceNumbers: true,
      },
      gantt: {
        useMaxWidth: true,
        leftPadding: 75,
        gridLineStartPadding: 35,
        fontSize: 11,
      },
      state: {
        useMaxWidth: true,
      },
    });
  }, []);

  const renderChart = async () => {
    if (!containerRef.current || !chart) return;

    try {
      setIsLoading(true);
      setError(null);

      // Clear previous content
      containerRef.current.innerHTML = '';

      // Generate unique ID for this diagram
      const diagramId = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Render the diagram
      const { svg } = await mermaid.render(diagramId, chart);

      // Insert the SVG into the container
      containerRef.current.innerHTML = svg;

      // Make sure the SVG is responsive
      const svgElement = containerRef.current.querySelector('svg');
      if (svgElement) {
        svgElement.style.maxWidth = '100%';
        svgElement.style.height = 'auto';
        svgElement.style.display = 'block';
        svgElement.style.margin = '0 auto';
      }
    } catch (err) {
      console.error('Failed to render mermaid diagram:', err);
      setError(err instanceof Error ? err.message : 'Failed to render diagram');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    renderChart();
  }, [chart]);

  const handleRetry = () => {
    renderChart();
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center min-h-[200px] ${className}`}>
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-gray-600">Rendering diagram...</p>
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
    <div className={className}>
      {title && <h4 className="text-sm font-semibold text-gray-700 mb-4 text-center">{title}</h4>}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div
          ref={containerRef}
          className="mermaid-container flex items-center justify-center min-h-[200px]"
        />
      </div>
    </div>
  );
};

export default MermaidRenderer;
