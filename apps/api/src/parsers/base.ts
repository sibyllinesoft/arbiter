import type { AnalyzedArtifact } from "../git/project-analysis.types";
/**
 * Base parser types and interfaces.
 * Defines the common contract for all file parsers in the analysis pipeline.
 */
import type { ProjectStructure } from "../scanner/git-scanner.types";

/**
 * Context passed to file parsers during analysis.
 * Contains project information and methods for registering artifacts.
 */
export interface ParserContext {
  /** Unique identifier for the project */
  projectId: string;
  /** Human-readable project name */
  projectName: string;
  /** Path to the file being parsed */
  filePath: string;
  /** Optional existing artifact for the file */
  artifact?: AnalyzedArtifact;
  /** Callback to register a discovered artifact */
  addArtifact: (artifact: AnalyzedArtifact) => void;
  /** Project structure information from scanning */
  structure: ProjectStructure;
  /** List of all files in the project */
  allFiles: string[];
}

/**
 * Interface for file parsers that analyze specific file types.
 * Parsers are matched against files by path and extract artifacts.
 */
export interface FileParser {
  /** Parser name for debugging and logging */
  name: string;
  /** Priority for parser ordering (higher runs first) */
  priority?: number;
  /** Weight factor for scoring importance */
  weight?: number;
  /**
   * Check if this parser can handle a file.
   * @param filePath - Path to the file
   * @returns True if the parser should process this file
   */
  matches(filePath: string): boolean;
  /**
   * Parse a file and extract artifacts.
   * @param content - File content as a string
   * @param context - Parser context with project information
   */
  parse(content: string, context: ParserContext): void | Promise<void>;
}
