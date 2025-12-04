import type { ProjectStructure } from "./git-scanner.types";

export interface ArtifactLink {
  type: string;
  target: string;
  description?: string;
}

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

export interface TreeAnalysisResult {
  structure: ProjectStructure;
  artifacts: AnalyzedArtifact[];
  serviceCount: number;
  databaseCount: number;
}
