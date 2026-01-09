import { apiService } from "@services/api";
import mermaid from "mermaid";
import React, { useEffect, useRef, useState } from "react";
import type { IRResponse } from "../../types/api";

interface FlowDiagramProps {
  projectId: string;
  className?: string;
}

type NodeKind = "visit" | "click" | "fill" | "expect" | "expect_api";

interface FlowNode {
  id: string;
  kind: NodeKind;
  label: string;
}

interface FlowEdge {
  from: string;
  to: string;
  label?: string;
}

interface Flow {
  id: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

interface FlowIRData {
  specHash: string;
  flows: Flow[];
}

/** Node styling configuration by kind */
const NODE_STYLES: Record<
  NodeKind | "default",
  { shape: string; fill: string; stroke: string; color: string }
> = {
  visit: { shape: "[%s]", fill: "#1E466B", stroke: "#25557E", color: "#A9C7DF" },
  click: { shape: "{%s}", fill: "#3A2A70", stroke: "#4A378B", color: "#A19BD2" },
  fill: { shape: "[/%s/]", fill: "#1D6A5B", stroke: "#45A190", color: "#79C0B0" },
  expect: { shape: "((%s))", fill: "#803131", stroke: "#BA5956", color: "#D98A86" },
  expect_api: { shape: "{{%s}}", fill: "#725718", stroke: "#A6842A", color: "#C8A656" },
  default: { shape: "[%s]", fill: "#3B475C", stroke: "#50617A", color: "#8C97AA" },
};

/** Loading spinner component */
const LoadingSpinner: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`flex items-center justify-center h-full ${className}`}>
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
      <p className="text-gray-600">Loading flow diagrams...</p>
    </div>
  </div>
);

/** Error display component */
const ErrorDisplay: React.FC<{ error: string; className?: string }> = ({
  error,
  className = "",
}) => (
  <div className={`flex items-center justify-center h-full ${className}`}>
    <div className="text-center">
      <div className="text-red-500 mb-4">
        <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

/** Format a flow node for mermaid */
const formatNode = (nodeId: string, label: string, kind: NodeKind): string => {
  const style = NODE_STYLES[kind] ?? NODE_STYLES.default;
  const shapeStr = style.shape.replace("%s", label);
  return `    ${nodeId}${shapeStr}\n    style ${nodeId} fill:${style.fill},stroke:${style.stroke},color:${style.color}\n`;
};

/** Format a flow edge for mermaid */
const formatEdge = (flowIndex: number, edge: FlowEdge): string => {
  const label = edge.label ? `|${edge.label}|` : "";
  return `    ${flowIndex}_${edge.from} -->${label} ${flowIndex}_${edge.to}\n`;
};

/** Convert flows to mermaid diagram code */
const convertFlowToMermaid = (flows: Flow[]): string => {
  if (!flows?.length) {
    return `graph TD\n    A[No flows defined]\n    style A fill:#2F394B,stroke:#6B7A92,stroke-dasharray: 5 5,color:#B3BBC8`;
  }

  const lines = ["graph TD"];
  flows.forEach((flow, idx) => {
    lines.push(`    %% Flow: ${flow.id}`);
    flow.nodes.forEach((node) =>
      lines.push(formatNode(`${idx}_${node.id}`, node.label || node.id, node.kind)),
    );
    flow.edges.forEach((edge) => lines.push(formatEdge(idx, edge)));
    if (idx < flows.length - 1) lines.push("");
  });
  return lines.join("\n");
};

/** Render mermaid SVG into container */
const renderMermaidDiagram = async (
  containerRef: React.RefObject<HTMLDivElement>,
  mermaidCode: string,
  setError: (error: string) => void,
) => {
  if (!containerRef.current) return;
  try {
    containerRef.current.innerHTML = "";
    const { svg } = await mermaid.render(`mermaid-${Date.now()}`, mermaidCode);
    containerRef.current.innerHTML = svg;
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

const FlowDiagram: React.FC<FlowDiagramProps> = ({ projectId, className = "" }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [flowData, setFlowData] = useState<FlowIRData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: true,
      theme: "default",
      securityLevel: "loose",
      flowchart: { useMaxWidth: true, htmlLabels: true, curve: "basis" },
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

  useEffect(() => {
    if (flowData && !loading && !error) {
      renderMermaidDiagram(containerRef, convertFlowToMermaid(flowData.flows), setError);
    }
  }, [flowData, loading, error]);

  if (loading) return <LoadingSpinner className={className} />;
  if (error) return <ErrorDisplay error={error} className={className} />;

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
