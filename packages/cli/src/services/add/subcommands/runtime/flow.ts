/**
 * @packageDocumentation
 * Flow subcommand module - Handles adding test flows to CUE specifications.
 *
 * Supports defining:
 * - Navigation flows (page-to-page transitions)
 * - API health check flows
 * - Custom step sequences
 */

import type { FlowConfig } from "@/cue/index.js";

/** Options for flow configuration */
export interface FlowOptions {
  from?: string;
  to?: string;
  endpoint?: string;
  expect?: string;
  steps?: string;
  [key: string]: any;
}

/** Union type representing a single flow step action */
export type FlowStep =
  | { visit: string }
  | { click: string }
  | { expect: { locator: string; state: string } }
  | { expect_api: { method: string; path: string; status: number } };

/**
 * Add a test flow to the CUE specification.
 * @param manipulator - CUE file manipulator instance
 * @param content - Current CUE file content
 * @param flowId - Unique identifier for the flow
 * @param options - Flow configuration options
 * @returns Updated CUE file content
 */
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

/**
 * Generate flow steps based on the provided options.
 * @param options - Flow configuration options
 * @returns Array of flow steps
 */
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

/**
 * Parse custom steps from JSON string.
 * @param stepsJson - JSON array of flow steps
 * @returns Parsed array of flow steps
 */
function parseCustomSteps(stepsJson: string): FlowStep[] {
  try {
    return JSON.parse(stepsJson);
  } catch {
    throw new Error("Invalid steps format. Expected JSON array.");
  }
}

/**
 * Generate a navigation flow between two pages.
 * @param from - Starting page identifier
 * @param to - Destination page identifier
 * @returns Array of navigation flow steps
 */
function generateNavigationFlow(from: string, to: string): FlowStep[] {
  return [
    { visit: from },
    { click: `btn:goto-${to}` },
    { expect: { locator: `page:${to}`, state: "visible" } },
  ];
}

/**
 * Generate an API health check flow.
 * @param endpoint - API endpoint to check
 * @param expectedStatus - Expected HTTP status code
 * @returns Array of API check flow steps
 */
function generateApiHealthFlow(endpoint: string, expectedStatus: string): FlowStep[] {
  return [
    { expect_api: { method: "GET", path: endpoint, status: Number.parseInt(expectedStatus, 10) } },
  ];
}
