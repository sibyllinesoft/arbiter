/**
 * @module ArchitectureDiagram/grouping
 * Component grouping utilities for the Architecture Diagram.
 * Exports types and helpers for organizing components by type.
 */

export type {
  TreeMode,
  GroupedComponentItem,
  GroupedComponentGroup,
  RouteEndpoint,
  RouteEndpointParameter,
  RouteEndpointResponse,
  RouteEndpointDocumentation,
  FrontendPackage,
} from "./types";

export {
  TYPE_CONFIG,
  CUE_FILE_REGEX,
  getTypeConfig,
  toLowerString,
  stringifyListEntry,
  normalizeRelativePath,
  buildInitialValuesFromMetadata,
  getComponentType,
  shouldExcludeFromDiagram,
  enrichDataForGrouping,
  resolveArtifactId,
} from "./helpers";

export { computeGroupedComponents } from "./computeGroupedComponents";
export { buildPackagesFromGroup } from "./buildPackagesFromGroup";
