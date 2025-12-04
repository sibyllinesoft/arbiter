import type { ProjectStructure } from "../git-scanner.types";
import type { AnalyzedArtifact } from "../project-analysis.types";

export interface ParserContext {
  projectId: string;
  projectName: string;
  filePath: string;
  artifact?: AnalyzedArtifact;
  addArtifact: (artifact: AnalyzedArtifact) => void;
  structure: ProjectStructure;
  allFiles: string[];
}

export interface FileParser {
  name: string;
  priority?: number;
  weight?: number;
  matches(filePath: string): boolean;
  parse(content: string, context: ParserContext): void | Promise<void>;
}
