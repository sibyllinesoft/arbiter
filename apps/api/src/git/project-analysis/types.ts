/**
 * @module project-analysis/types
 * Type definitions for project analysis.
 */

export interface StructureMetrics {
  filesScanned: number;
  usedGitLsFiles?: boolean;
}

export interface AnalysisOptions {
  gitUrl?: string;
  structure?: import("../../scanner/git-scanner.types").ProjectStructure;
  branch?: string;
  fetcher?: import("../content-fetcher").ContentFetcher;
  maxConcurrency?: number;
  projectRoot?: string;
}

export interface FrontendRouteInfo {
  path: string;
  filePath: string;
  routerType: string;
  component?: string;
  metadata?: Record<string, unknown>;
}

export interface NextRouteInfo {
  key: string;
  path: string;
  component: string;
  relativeFile: string;
  dynamicSegments: string[];
  segment?: string;
}

export { type AnalyzedArtifact, type TreeAnalysisResult } from "../project-analysis.types";
