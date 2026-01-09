/**
 * Git scanner type definitions.
 * Interfaces for project scanning, file analysis, and Git operations.
 */

/** Detected project structure from scanning files */
export interface ProjectStructure {
  hasPackageJson: boolean;
  hasCargoToml: boolean;
  hasDockerfile: boolean;
  hasCueFiles: boolean;
  hasYamlFiles: boolean;
  hasJsonFiles: boolean;
  importableFiles: string[];
  performanceMetrics?: {
    filesScanned: number;
    usedGitLsFiles?: boolean;
  };
}

/** Result from scanning a Git repository or local directory */
export interface GitScanResult {
  success: boolean;
  tempPath?: string;
  files?: string[];
  projectStructure?: ProjectStructure;
  gitUrl?: string;
  projectName?: string;
  branch?: string;
  error?: string;
}

/** Adapter interface for Git repository scanning operations */
export interface GitScannerAdapter {
  scanGitUrl(gitUrl: string, authToken?: string): Promise<GitScanResult>;
  scanLocalPath(directoryPath: string): Promise<GitScanResult>;
  cleanup(tempPath: string): Promise<void>;
  cleanupAll(): Promise<void>;
  resolveTempPath?(tempPath: string): Promise<GitScanResult | null>;
}
