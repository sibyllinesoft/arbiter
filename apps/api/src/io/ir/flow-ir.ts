/**
 * Flow IR generator for Mermaid flowchart/sequence diagrams.
 * Transforms flow specifications into intermediate representations
 * suitable for rendering as interactive flowcharts.
 */
import { computeSpecHash, extractFlows, getFlowStepKind, getFlowStepLabel } from "./helpers";
import type { FlowIR, FlowIREdge, FlowIRNode } from "./types";

/**
 * Generate flow intermediate representation for simple flowcharts.
 * Extracts flows from the spec and converts each step into nodes and edges.
 * @param resolved - The resolved specification containing flow definitions
 * @returns IR data with spec hash and flow structures
 */
export function generateFlowIR(resolved: Record<string, unknown>): Record<string, unknown> {
  const flows = extractFlows(resolved);
  const flowIRs: FlowIR[] = [];

  Object.entries(flows).forEach(([flowId, flow]) => {
    const nodes: FlowIRNode[] = [];
    const edges: FlowIREdge[] = [];

    if (Array.isArray(flow.steps)) {
      flow.steps.forEach((step: any, index: number) => {
        const nodeId = step.id || `${index}`;
        const kind = getFlowStepKind(step);
        const label = getFlowStepLabel(step, index);

        nodes.push({
          id: nodeId,
          kind,
          label,
        });

        if (step.dependsOn && Array.isArray(step.dependsOn)) {
          step.dependsOn.forEach((depId: string) => {
            edges.push({
              from: depId,
              to: nodeId,
              label: step.transition || "",
            });
          });
        }
      });
    }

    flowIRs.push({
      id: flowId,
      nodes,
      edges,
    });
  });

  return {
    specHash: computeSpecHash(resolved),
    flows: flowIRs,
  };
}

/**
 * Generate comprehensive flows IR with decision branches.
 * Creates a more detailed graph representation including branching logic.
 * @param resolved - The resolved specification containing flow definitions
 * @returns IR data with nodes, edges, flows, layout hints, and metadata
 */
export function generateFlowsIR(resolved: Record<string, unknown>): Record<string, unknown> {
  const flows =
    resolved.flows && typeof resolved.flows === "object" && !Array.isArray(resolved.flows)
      ? (resolved.flows as Record<string, any>)
      : {};
  const flowList: any[] = [];
  const nodes: any[] = [];
  const edges: any[] = [];
  let totalSteps = 0;
  let totalDecisions = 0;

  Object.entries(flows).forEach(([flowId, flow]) => {
    const flowSteps = flow.steps || [];
    totalSteps += flowSteps.length;

    flowList.push({
      id: flowId,
      name: flow.name || flowId,
      trigger: flow.trigger,
      outcome: flow.outcome,
      steps: flowSteps,
    });

    flowSteps.forEach((step: any, index: number) => {
      const nodeId = `${flowId}.${index}`;

      nodes.push({
        id: nodeId,
        label: step.name || `Step ${index + 1}`,
        type: "process",
        properties: {
          action: step.action,
          actor: step.actor,
          duration: step.estimated_duration,
          complexity: step.complexity,
        },
      });

      if (index > 0) {
        edges.push({
          source: `${flowId}.${index - 1}`,
          target: nodeId,
          type: "sequence",
        });
      }

      if (step.branches && Array.isArray(step.branches)) {
        step.branches.forEach((branch: any) => {
          const decisionNodeId = `${nodeId}.${branch.condition}`;
          totalDecisions++;

          nodes.push({
            id: decisionNodeId,
            label: branch.name || branch.condition,
            type: "decision",
            properties: {
              condition: branch.condition,
              description: branch.description,
            },
          });

          edges.push({
            source: nodeId,
            target: decisionNodeId,
            type: "branch",
            label: branch.condition,
          });
        });
      }
    });
  });

  return {
    type: "flowchart",
    nodes,
    edges,
    flows: flowList,
    layout: {
      algorithm: "dagre",
    },
    metadata: {
      totalFlows: flowList.length,
      totalSteps,
      totalDecisions,
    },
  };
}
