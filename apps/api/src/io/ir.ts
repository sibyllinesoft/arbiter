/**
 * Intermediate Representation (IR) generator
 * Re-exported from modular structure in ./ir/
 */
export { IRGenerator } from "./ir/index";
export * from "./ir/types";
export * from "./ir/helpers";
export {
  generateFlowIR,
  generateFlowsIR,
  generateFsmIR,
  generateViewIR,
  generateSiteIR,
  generateCapabilitiesIR,
  generateDependenciesIR,
  generateCoverageIR,
} from "./ir/index";
