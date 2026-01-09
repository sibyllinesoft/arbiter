/**
 * Intermediate Representation (IR) generator for diagrams and visualizations.
 * This module provides the central IR generation service that transforms
 * resolved specifications into various visualization formats.
 */
import type { IRKind, IRResponse } from "../../util/types.ts";
import { getCurrentTimestamp, logger } from "../utils.ts";
import { generateCapabilitiesIR } from "./capabilities-ir";
import { generateCoverageIR } from "./coverage-ir";
import { generateDependenciesIR } from "./dependencies-ir";
import { generateFlowIR, generateFlowsIR } from "./flow-ir";
import { generateFsmIR } from "./fsm-ir";
import { generateSiteIR, generateViewIR } from "./view-ir";

/**
 * Generator class for creating intermediate representations.
 * Routes generation requests to specialized IR generators based on kind.
 */
export class IRGenerator {
  /**
   * Generate an intermediate representation for visualization.
   * Dispatches to the appropriate specialized generator based on the IR kind.
   * @param kind - The type of IR to generate (flow, fsm, view, site, capabilities, flows, dependencies, coverage)
   * @param resolved - The resolved specification data to transform
   * @returns The generated IR response with data and metadata
   * @throws Error if the IR kind is unknown or generation fails
   */
  async generateIR(kind: IRKind, resolved: Record<string, unknown>): Promise<IRResponse> {
    const startTime = Date.now();

    try {
      let data: Record<string, unknown>;

      switch (kind) {
        case "flow":
          data = generateFlowIR(resolved);
          break;
        case "fsm":
          data = generateFsmIR(resolved);
          break;
        case "view":
          data = generateViewIR(resolved);
          break;
        case "site":
          data = generateSiteIR(resolved);
          break;
        case "capabilities":
          data = generateCapabilitiesIR(resolved);
          break;
        case "flows":
          data = generateFlowsIR(resolved);
          break;
        case "dependencies":
          data = generateDependenciesIR(resolved);
          break;
        case "coverage":
          data = generateCoverageIR(resolved);
          break;
        default:
          throw new Error(`Unknown IR kind: ${kind}`);
      }

      return {
        kind,
        data,
        generated_at: getCurrentTimestamp(),
      };
    } catch (error) {
      logger.error("IR generation failed", error instanceof Error ? error : undefined, { kind });

      throw new Error(
        `Failed to generate ${kind} IR: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}

export * from "./types";
export * from "./helpers";
export { generateFlowIR, generateFlowsIR } from "./flow-ir";
export { generateFsmIR } from "./fsm-ir";
export { generateViewIR, generateSiteIR } from "./view-ir";
export { generateCapabilitiesIR } from "./capabilities-ir";
export { generateDependenciesIR } from "./dependencies-ir";
export { generateCoverageIR } from "./coverage-ir";
