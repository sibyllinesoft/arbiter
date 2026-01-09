/**
 * Connection parsing for CUE architecture data
 */
import type {
  ConnectionType,
  CueArchitectureData,
  DiagramComponent,
  DiagramConnection,
  FlowStep,
} from "../../types/architecture";

/** Find component that corresponds to a flow step */
export function findComponentForFlowStep(
  step: FlowStep | undefined,
  components: DiagramComponent[],
): DiagramComponent | undefined {
  if (!step) return undefined;

  // For visit steps, find view resources (or legacy routes)
  if (step.type === "visit" && step.target) {
    return components.find(
      (c) =>
        (c.type === "resource" &&
          (c.kind === "view" || c.layer === "presentation") &&
          (c.routePath === step.target || c.id.includes(step.target ?? ""))) ||
        (c.type === "route" && (c.routePath === step.target || c.id.includes(step.target ?? ""))),
    );
  }

  // For API expectations, find endpoint resources
  if (step.type === "expect_api" && step.expectation) {
    const expectation = (step.expectation as Record<string, unknown>) ?? {};
    const method = typeof expectation.method === "string" ? expectation.method : undefined;
    const path = typeof expectation.path === "string" ? expectation.path : undefined;
    return components.find(
      (c) =>
        (c.type === "resource" &&
          (c.kind === "endpoint" || c.kind === "api_endpoint") &&
          c.metadata?.method === method &&
          c.metadata?.path === path) ||
        (c.type === "api_endpoint" && c.metadata?.method === method && c.metadata?.path === path),
    );
  }

  // For UI interactions, find components by capabilities
  if (["click", "fill", "expect"].includes(step.type)) {
    return components.find((c) => c.type === "route");
  }

  return undefined;
}

/** Determine connection type for flow step */
export function getConnectionTypeForStep(step: FlowStep | undefined): ConnectionType {
  if (!step) return "data_flow";

  switch (step.type) {
    case "visit":
      return "user_navigation";
    case "click":
    case "fill":
      return "user_interaction";
    case "expect_api":
      return "api_call";
    default:
      return "data_flow";
  }
}

/** Generate connection label for flow step */
export function getConnectionLabelForStep(step: FlowStep | undefined): string {
  if (!step) return "Unknown";

  switch (step.type) {
    case "visit":
      return `Navigate to ${step.target ?? ""}`;
    case "click":
      return `Click ${step.target ?? ""}`;
    case "fill":
      return `Fill ${step.target ?? ""}`;
    case "expect_api": {
      const expectation = (step.expectation as Record<string, unknown>) ?? {};
      const method = typeof expectation.method === "string" ? expectation.method : "";
      const path = typeof expectation.path === "string" ? expectation.path : "";
      return `API: ${method} ${path}`;
    }
    default:
      return step.type;
  }
}

/** Parse flows into user journey connections */
export function parseFlowConnections(
  flow: Record<string, unknown>,
  flowIndex: number,
  components: DiagramComponent[],
  connections: DiagramConnection[],
): void {
  const steps = flow.steps as Array<Record<string, unknown>> | undefined;
  if (!steps || !Array.isArray(steps)) return;

  const flowSteps: FlowStep[] = steps.map((step, index) => ({
    id: `${flow.id || flowIndex}_step_${index}`,
    type: Object.keys(step)[0]!,
    target:
      (step.visit as string) ||
      ((step.click as Record<string, unknown>)?.locator as string) ||
      ((step.fill as Record<string, unknown>)?.locator as string) ||
      "",
    value: (step.fill as Record<string, unknown>)?.value,
    expectation: step.expect ?? step.expect_api,
  }));

  // Create connections between flow steps
  for (let i = 0; i < flowSteps.length - 1; i++) {
    const currentStep = flowSteps[i];
    const nextStep = flowSteps[i + 1];

    const fromComponent = findComponentForFlowStep(currentStep, components);
    const toComponent = nextStep ? findComponentForFlowStep(nextStep, components) : undefined;

    if (fromComponent && toComponent && fromComponent.id !== toComponent.id) {
      connections.push({
        id: `flow_${flow.id || flowIndex}_${i}_${i + 1}`,
        from: { componentId: fromComponent.id },
        to: { componentId: toComponent.id },
        type: getConnectionTypeForStep(nextStep),
        label: getConnectionLabelForStep(nextStep),
        metadata: {
          userAction: nextStep!.type,
          expectation: nextStep!.expectation,
        },
      });
    }
  }
}

/** Parse capability dependencies into connections */
export function parseCapabilityConnections(
  cueData: CueArchitectureData,
  components: DiagramComponent[],
  connections: DiagramConnection[],
): void {
  if (!cueData.capabilities) return;

  Object.entries(cueData.capabilities).forEach(([capId, capData]) => {
    const cap = capData as Record<string, unknown>;
    const requirements = (cap.requirements ?? []) as string[];
    const fromComponent = components.find((c) => c.id === `capability_${capId}`);

    if (!fromComponent) return;

    requirements.forEach((requirement) => {
      const toComponent = components.find((c) => {
        const caps = c.capabilities;
        const metaReqs = (c.metadata as Record<string, unknown>)?.requirements as
          | string[]
          | undefined;
        return (
          (Array.isArray(caps) && caps.includes(requirement)) ||
          (Array.isArray(metaReqs) && metaReqs.includes(requirement))
        );
      });

      if (toComponent) {
        connections.push({
          id: `capability_${capId}_requires_${requirement}`,
          from: { componentId: fromComponent.id },
          to: { componentId: toComponent.id },
          type: "capability_usage",
          label: `Requires ${requirement}`,
          metadata: { capability: requirement },
        });
      }
    });
  });
}

/** Parse route-capability relationships */
export function parseRouteCapabilityConnections(
  cueData: CueArchitectureData,
  components: DiagramComponent[],
  connections: DiagramConnection[],
): void {
  if (!cueData.ui?.routes) return;

  cueData.ui.routes.forEach((route) => {
    if (!route || typeof route !== "object") return;
    const routeObj = route as Record<string, unknown>;
    const routeComponent = components.find(
      (c) =>
        (c.type === "resource" &&
          (c.kind === "view" || c.layer === "presentation") &&
          c.routePath === routeObj.path) ||
        (c.type === "route" && c.routePath === routeObj.path),
    );

    const capabilities = (routeObj.capabilities as string[] | undefined) ?? [];
    if (!routeComponent || !capabilities.length) return;

    capabilities.forEach((capName) => {
      const capComponent = components.find((c) => c.type === "capability" && c.name === capName);

      if (capComponent) {
        connections.push({
          id: `route_${routeObj.id ?? routeObj.path ?? "route"}_uses_${capName}`,
          from: { componentId: routeComponent.id },
          to: { componentId: capComponent.id },
          type: "capability_usage",
          label: `Uses ${capName}`,
          metadata: { capability: capName },
        });
      }
    });
  });
}
