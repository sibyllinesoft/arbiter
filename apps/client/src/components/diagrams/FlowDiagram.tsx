import mermaid from "mermaid";
import React, { useEffect, useRef, useState } from "react";
import { apiService } from "../../services/api";
import type { IRResponse } from "../../types/api";

interface FlowDiagramProps {
  projectId: string;
  className?: string;
}

interface FlowIRData {
  specHash: string;
  flows: {
    id: string;
    nodes: {
      id: string;
      kind: "visit" | "click" | "fill" | "expect" | "expect_api";
      label: string;
    }[];
    edges: {
      from: string;
      to: string;
      label?: string;
    }[];
  }[];
}

const FlowDiagram: React.FC<FlowDiagramProps> = ({ projectId, className = "" }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [flowData, setFlowData] = useState<FlowIRData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize mermaid with configuration
    mermaid.initialize({
      startOnLoad: true,
      theme: "default",
      securityLevel: "loose",
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: "basis",
      },
      fontFamily: "Inter, system-ui, sans-serif",
    });
  }, []);

  useEffect(() => {
    if (!projectId) return;

    const loadFlowData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response: IRResponse = await apiService.getIR(projectId, "flow");
        setFlowData(response.data as unknown as FlowIRData);
      } catch (err) {
        console.error("Failed to load flow data:", err);
        setError(err instanceof Error ? err.message : "Failed to load flow diagram");
      } finally {
        setLoading(false);
      }
    };

    loadFlowData();
  }, [projectId]);

  const convertFlowToMermaid = (flows: FlowIRData["flows"]): string => {
    if (!flows || flows.length === 0) {
      return `graph TD
        A[No flows defined]
        style A fill:#2F394B,stroke:#6B7A92,stroke-dasharray: 5 5,color:#B3BBC8`;
    }

    let mermaidCode = "graph TD\n";

    // Process each flow
    flows.forEach((flow, flowIndex) => {
      // Add flow title as a comment
      mermaidCode += `    %% Flow: ${flow.id}\n`;

      // Add nodes with appropriate styling based on their kind
      flow.nodes.forEach((node) => {
        const nodeId = `${flowIndex}_${node.id}`;
        const label = node.label || node.id;

        switch (node.kind) {
          case "visit":
            mermaidCode += `    ${nodeId}[${label}]\n`;
            mermaidCode += `    style ${nodeId} fill:#1E466B,stroke:#25557E,color:#A9C7DF\n`;
            break;
          case "click":
            mermaidCode += `    ${nodeId}{${label}}\n`;
            mermaidCode += `    style ${nodeId} fill:#3A2A70,stroke:#4A378B,color:#A19BD2\n`;
            break;
          case "fill":
            mermaidCode += `    ${nodeId}[/${label}/]\n`;
            mermaidCode += `    style ${nodeId} fill:#1D6A5B,stroke:#45A190,color:#79C0B0\n`;
            break;
          case "expect":
            mermaidCode += `    ${nodeId}((${label}))\n`;
            mermaidCode += `    style ${nodeId} fill:#803131,stroke:#BA5956,color:#D98A86\n`;
            break;
          case "expect_api":
            mermaidCode += `    ${nodeId}{{${label}}}\n`;
            mermaidCode += `    style ${nodeId} fill:#725718,stroke:#A6842A,color:#C8A656\n`;
            break;
          default:
            mermaidCode += `    ${nodeId}[${label}]\n`;
            mermaidCode += `    style ${nodeId} fill:#3B475C,stroke:#50617A,color:#8C97AA\n`;
        }
      });

      // Add edges
      flow.edges.forEach((edge) => {
        const fromId = `${flowIndex}_${edge.from}`;
        const toId = `${flowIndex}_${edge.to}`;
        const label = edge.label ? `|${edge.label}|` : "";
        mermaidCode += `    ${fromId} -->${label} ${toId}\n`;
      });

      // Add spacing between flows
      if (flowIndex < flows.length - 1) {
        mermaidCode += "\n";
      }
    });

    return mermaidCode;
  };

  const renderMermaidDiagram = async (mermaidCode: string) => {
    if (!containerRef.current) return;

    try {
      // Clear previous content
      containerRef.current.innerHTML = "";

      // Generate unique ID for this diagram
      const diagramId = `mermaid-${Date.now()}`;

      // Render the diagram
      const { svg } = await mermaid.render(diagramId, mermaidCode);

      // Insert the SVG into the container
      containerRef.current.innerHTML = svg;

      // Make sure the SVG is responsive
      const svgElement = containerRef.current.querySelector("svg");
      if (svgElement) {
        svgElement.style.maxWidth = "100%";
        svgElement.style.height = "auto";
      }
    } catch (err) {
      console.error("Failed to render mermaid diagram:", err);
      setError("Failed to render flow diagram");
    }
  };

  useEffect(() => {
    if (flowData && !loading && !error) {
      const mermaidCode = convertFlowToMermaid(flowData.flows);
      renderMermaidDiagram(mermaidCode);
    }
  }, [flowData, loading, error]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading flow diagrams...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg
              className="w-12 h-12 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-red-700 font-medium">Error loading flow diagram</p>
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
        {flowData?.flows && flowData.flows.length > 0 && (
          <div className="mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-graphite-100">
              Flow Diagrams
            </h3>
            <p className="text-sm text-gray-600 dark:text-graphite-400">
              Showing {flowData.flows.length} flow{flowData.flows.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}
        <div
          ref={containerRef}
          className="mermaid-container bg-white border border-gray-200 rounded-lg p-4 min-h-[400px] flex items-center justify-center"
        />
      </div>
    </div>
  );
};

export default FlowDiagram;
