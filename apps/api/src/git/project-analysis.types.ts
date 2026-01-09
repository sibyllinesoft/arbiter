/**
 * Project analysis type definitions.
 * Interfaces for analyzed artifacts and tree analysis results.
 */
import type { ProjectStructure } from "../scanner/git-scanner.types";

/** Link between artifacts representing relationships */
export interface ArtifactLink {
  type: string;
  target: string;
  description?: string;
}

/** Analyzed artifact extracted from project files */
export interface AnalyzedArtifact {
  id: string;
  name: string;
  type: "service" | "database" | "infrastructure" | "config" | "tool" | "package" | "frontend";
  description: string;
  language: string | null;
  framework: string | null;
  metadata: Record<string, unknown>;
  filePath: string | null;
  links?: ArtifactLink[];
}

/** Complete result from analyzing a project tree */
export interface TreeAnalysisResult {
  structure: ProjectStructure;
  artifacts: AnalyzedArtifact[];
  serviceCount: number;
  databaseCount: number;
}
