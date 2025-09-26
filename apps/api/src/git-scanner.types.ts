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

export interface GitScannerAdapter {
  scanGitUrl(gitUrl: string): Promise<GitScanResult>;
  scanLocalPath(directoryPath: string): Promise<GitScanResult>;
  cleanup(tempPath: string): Promise<void>;
  cleanupAll(): Promise<void>;
  resolveTempPath?(tempPath: string): Promise<GitScanResult | null>;
}
