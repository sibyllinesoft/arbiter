import type { FlowConfig } from "../../../cue/index.js";

export interface FlowOptions {
  from?: string;
  to?: string;
  endpoint?: string;
  expect?: string;
  steps?: string;
  [key: string]: any;
}

export type FlowStep =
  | { visit: string }
  | { click: string }
  | { expect: { locator: string; state: string } }
  | { expect_api: { method: string; path: string; status: number } };

export async function addFlow(
  manipulator: any,
  content: string,
  flowId: string,
  options: FlowOptions,
): Promise<string> {
  const flowSteps = generateFlowSteps(options);
  const flowConfig: FlowConfig = {
    id: flowId,
    steps: flowSteps,
  };

  return await manipulator.addFlow(content, flowConfig);
}

function generateFlowSteps(options: FlowOptions): FlowStep[] {
  if (options.steps) {
    return parseCustomSteps(options.steps);
  }

  if (options.from && options.to) {
    return generateNavigationFlow(options.from, options.to);
  }

  if (options.endpoint) {
    return generateApiHealthFlow(options.endpoint, options.expect || "200");
  }

  throw new Error("Flow must specify either --from/--to, --endpoint, or --steps");
}

function parseCustomSteps(stepsJson: string): FlowStep[] {
  try {
    return JSON.parse(stepsJson);
  } catch {
    throw new Error("Invalid steps format. Expected JSON array.");
  }
}

function generateNavigationFlow(from: string, to: string): FlowStep[] {
  return [
    { visit: from },
    { click: `btn:goto-${to}` },
    { expect: { locator: `page:${to}`, state: "visible" } },
  ];
}

function generateApiHealthFlow(endpoint: string, expectedStatus: string): FlowStep[] {
  return [
    { expect_api: { method: "GET", path: endpoint, status: Number.parseInt(expectedStatus, 10) } },
  ];
}
