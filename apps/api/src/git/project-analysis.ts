/**
 * @module project-analysis
 * Project file analysis and artifact extraction.
 * Re-exports from project-analysis/ subdirectory.
 */

export {
  buildProjectStructure,
  analyzeProjectFiles,
  classifyFile,
  extractNextRoutes,
  extractReactRouterRoutes,
  annotateFrontendRoutes,
  normalizeRelativePath,
} from "./project-analysis/index";

export type {
  StructureMetrics,
  AnalysisOptions,
  FrontendRouteInfo,
} from "./project-analysis/types";
