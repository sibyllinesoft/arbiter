/**
 * Spec utility modules for processing CUE assembly data.
 * Provides helpers for client and service path resolution, type extraction, and data normalization.
 */
export * from "./clients";
export * from "./services";
export { PATH_PRIORITY_CANDIDATES as CLIENT_PATH_CANDIDATES } from "./clientConstants";
export { PATH_PRIORITY_CANDIDATES as SERVICE_PATH_CANDIDATES } from "./serviceConstants";
