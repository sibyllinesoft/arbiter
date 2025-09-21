/**
 * Git URL Scanner - Clone git repositories to temp directories and scan for importable content
 * Enhanced with parallel worker processing for improved performance
 */

import { execFile } from "child_process";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";
import { type FileInfo, FileWorkerPool } from "./file-scanner-worker";

const execFileAsync = promisify(execFile);

interface GitScanResult {
  success: boolean;
  tempPath?: string;
  files?: string[];
  projectStructure?: ProjectStructure;
  error?: string;
}

interface ProjectStructure {
  hasPackageJson: boolean;
  hasCargoToml: boolean;
  hasDockerfile: boolean;
  hasCueFiles: boolean;
  hasYamlFiles: boolean;
  hasJsonFiles: boolean;
  detectedType: "nodejs" | "rust" | "docker" | "kubernetes" | "config-only" | "unknown";
  importableFiles: string[];
  performanceMetrics?: {
    scanTimeMs: number;
    filesScanned: number;
    workersUsed: number;
    parallelBatches: number;
    usedGitLsFiles?: boolean;
  };
}

export class GitScanner {
  private tempDirs: Set<string> = new Set();
  private workerPool: FileWorkerPool;
  private readonly maxConcurrentWorkers: number;

  constructor(maxWorkers?: number) {
    this.maxConcurrentWorkers = maxWorkers || Math.max(2, Math.min(8, require("os").cpus().length));
    this.workerPool = new FileWorkerPool(this.maxConcurrentWorkers);
  }

  /**
   * Clone a git repository to a temporary directory and scan its contents
   */
  async scanGitUrl(gitUrl: string): Promise<GitScanResult> {
    let tempPath: string | undefined;

    try {
      // Validate git URL format
      if (!this.isValidGitUrl(gitUrl)) {
        return {
          success: false,
          error: "Invalid git URL format",
        };
      }

      // Create temporary directory
      tempPath = await this.createTempDir();
      this.tempDirs.add(tempPath);

      // Clone repository
      await this.cloneRepository(gitUrl, tempPath);

      // Scan the cloned repository using parallel workers
      const { files, metrics } = await this.scanDirectoryParallel(tempPath);
      const projectStructure = await this.analyzeProjectStructure(tempPath, files, metrics);

      return {
        success: true,
        tempPath,
        files,
        projectStructure,
      };
    } catch (error) {
      // Cleanup on error
      if (tempPath) {
        await this.cleanup(tempPath);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Scan a local directory path
   */
  async scanLocalPath(directoryPath: string): Promise<GitScanResult> {
    try {
      // Check if directory exists
      const stats = await fs.stat(directoryPath);
      if (!stats.isDirectory()) {
        return {
          success: false,
          error: "Path is not a directory",
        };
      }

      // Scan the directory using parallel workers
      const { files, metrics } = await this.scanDirectoryParallel(directoryPath);
      const projectStructure = await this.analyzeProjectStructure(directoryPath, files, metrics);

      return {
        success: true,
        tempPath: directoryPath,
        files,
        projectStructure,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to scan directory",
      };
    }
  }

  /**
   * Clean up a temporary directory
   */
  async cleanup(tempPath: string): Promise<void> {
    try {
      await fs.rm(tempPath, { recursive: true, force: true });
      this.tempDirs.delete(tempPath);
    } catch (error) {
      console.warn(`Failed to cleanup temp directory ${tempPath}:`, error);
    }
  }

  /**
   * Clean up all temporary directories
   */
  async cleanupAll(): Promise<void> {
    const cleanupPromises = Array.from(this.tempDirs).map((dir) => this.cleanup(dir));
    await Promise.allSettled(cleanupPromises);
    await this.workerPool.terminate();
  }

  /**
   * Scan directory structure using git ls-files first, then fall back to parallel worker processes
   */
  private async scanDirectoryParallel(basePath: string): Promise<{
    files: string[];
    metrics: {
      scanTimeMs: number;
      filesScanned: number;
      workersUsed: number;
      parallelBatches: number;
      usedGitLsFiles?: boolean;
    };
  }> {
    const startTime = Date.now();

    // Try git ls-files first for much better performance and Git-aware scanning
    const gitFiles = await this.tryGitLsFiles(basePath);
    if (gitFiles) {
      const scanTimeMs = Date.now() - startTime;
      return {
        files: gitFiles,
        metrics: {
          scanTimeMs,
          filesScanned: gitFiles.length,
          workersUsed: 0, // git ls-files doesn't use workers
          parallelBatches: 0,
          usedGitLsFiles: true,
        },
      };
    }

    // Fall back to worker-based directory scanning for non-Git directories
    const allFileInfos: FileInfo[] = [];
    let totalBatches = 0;

    // First, get the top-level directory listing
    const topLevelFiles = await this.workerPool.scanDirectory(basePath, "", 1, 0);
    allFileInfos.push(...topLevelFiles);

    // Collect directories for parallel processing
    const directories = topLevelFiles
      .filter((file) => file.isDirectory)
      .map((file) => ({
        path: file.path,
        relativePath: file.relativePath,
      }));

    // Process directories in parallel with dynamic batching
    const batchSize = Math.max(2, Math.floor(this.maxConcurrentWorkers * 1.5));

    for (let i = 0; i < directories.length; i += batchSize) {
      const batch = directories.slice(i, i + batchSize);
      totalBatches++;

      // Process this batch of directories in parallel with higher priority
      const batchPromises = batch.map(async (dir, index) => {
        try {
          // Higher priority for first few directories, then normal priority
          const priority = index < 3 ? 3 : 2;
          return await this.workerPool.executeTask(
            "scan-directory",
            {
              dirPath: dir.path,
              relativePath: dir.relativePath,
              maxDepth: 8,
              currentDepth: 1,
            },
            priority,
          );
        } catch (error) {
          console.warn(`Failed to scan directory ${dir.path}:`, error);
          return [];
        }
      });

      const batchResults = await Promise.all(batchPromises);

      // Flatten and add results
      for (const result of batchResults) {
        allFileInfos.push(...result);
      }
    }

    // Convert FileInfo objects to simple file paths and extract importable files
    const files = allFileInfos.filter((file) => !file.isDirectory).map((file) => file.relativePath);

    const scanTimeMs = Date.now() - startTime;

    return {
      files,
      metrics: {
        scanTimeMs,
        filesScanned: files.length,
        workersUsed: this.maxConcurrentWorkers,
        parallelBatches: totalBatches,
        usedGitLsFiles: false,
      },
    };
  }

  /**
   * Try to use git ls-files for efficient Git repository scanning
   */
  private async tryGitLsFiles(basePath: string): Promise<string[] | null> {
    try {
      // Check if directory is a Git repository
      const gitDir = join(basePath, ".git");
      const gitDirExists = await fs
        .stat(gitDir)
        .then(() => true)
        .catch(() => false);

      if (!gitDirExists) {
        return null;
      }

      // Use git ls-files to list all tracked files
      const { stdout } = await execFileAsync("git", ["ls-files", "-z"], {
        cwd: basePath,
        timeout: 30000, // 30 second timeout
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large repos
      });

      // Parse null-terminated output
      const files = stdout
        .split("\0")
        .filter((file) => file.length > 0)
        .map((file) => file.trim());

      console.log(`Git ls-files found ${files.length} tracked files in ${basePath}`);
      return files;
    } catch (error) {
      console.warn(
        `Git ls-files failed for ${basePath}, falling back to directory scan:`,
        error instanceof Error ? error.message : error,
      );
      return null;
    }
  }

  private isValidGitUrl(url: string): boolean {
    const gitUrlPatterns = [
      /^https:\/\/github\.com\/[\w\-._]+\/[\w\-._]+(?:\.git)?$/,
      /^https:\/\/gitlab\.com\/[\w\-._]+\/[\w\-._]+(?:\.git)?$/,
      /^https:\/\/bitbucket\.org\/[\w\-._]+\/[\w\-._]+(?:\.git)?$/,
      /^git@github\.com:[\w\-._]+\/[\w\-._]+\.git$/,
      /^git@gitlab\.com:[\w\-._]+\/[\w\-._]+\.git$/,
      /^https:\/\/.*\.git$/,
      /^git@.*:.*\.git$/,
    ];

    return gitUrlPatterns.some((pattern) => pattern.test(url));
  }

  private async createTempDir(): Promise<string> {
    const tempBase = tmpdir();
    const tempName = `arbiter-git-scan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const tempPath = join(tempBase, tempName);

    await fs.mkdir(tempPath, { recursive: true });
    return tempPath;
  }

  private async cloneRepository(gitUrl: string, targetPath: string): Promise<void> {
    try {
      // Use shallow clone for faster downloads
      await execFileAsync("git", ["clone", "--depth", "1", "--single-branch", gitUrl, targetPath], {
        timeout: 60000, // 60 second timeout
      });
    } catch (error) {
      throw new Error(
        `Failed to clone repository: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private async analyzeProjectStructure(
    basePath: string,
    files: string[],
    metrics?: any,
  ): Promise<ProjectStructure> {
    const structure: ProjectStructure = {
      hasPackageJson: false,
      hasCargoToml: false,
      hasDockerfile: false,
      hasCueFiles: false,
      hasYamlFiles: false,
      hasJsonFiles: false,
      detectedType: "unknown",
      importableFiles: [],
    };

    // Analyze file types
    for (const file of files) {
      const fileName = file.toLowerCase();
      const extension = fileName.split(".").pop() || "";

      if (fileName === "package.json") {
        structure.hasPackageJson = true;
      } else if (fileName === "cargo.toml") {
        structure.hasCargoToml = true;
      } else if (fileName === "dockerfile" || fileName.startsWith("dockerfile.")) {
        structure.hasDockerfile = true;
      } else if (extension === "cue") {
        structure.hasCueFiles = true;
        structure.importableFiles.push(file);
      } else if (["yaml", "yml"].includes(extension)) {
        structure.hasYamlFiles = true;
        // Check if it's a Kubernetes or config file
        if (
          fileName.includes("deployment") ||
          fileName.includes("service") ||
          fileName.includes("configmap") ||
          fileName.includes("secret") ||
          fileName.includes("docker-compose")
        ) {
          structure.importableFiles.push(file);
        }
      } else if (extension === "json") {
        structure.hasJsonFiles = true;
        // Check for configuration files
        if (
          fileName.includes("config") ||
          fileName === "package.json" ||
          fileName.includes("tsconfig") ||
          fileName.includes("manifest")
        ) {
          structure.importableFiles.push(file);
        }
      }
    }

    // Determine project type
    if (structure.hasPackageJson) {
      structure.detectedType = "nodejs";
    } else if (structure.hasCargoToml) {
      structure.detectedType = "rust";
    } else if (structure.hasDockerfile) {
      structure.detectedType = "docker";
    } else if (structure.hasYamlFiles && this.hasKubernetesFiles(files)) {
      structure.detectedType = "kubernetes";
    } else if (structure.hasCueFiles || structure.hasYamlFiles || structure.hasJsonFiles) {
      structure.detectedType = "config-only";
    }

    // Add performance metrics if provided
    if (metrics) {
      structure.performanceMetrics = metrics;
    }

    return structure;
  }

  private hasKubernetesFiles(files: string[]): boolean {
    const k8sKeywords = ["deployment", "service", "configmap", "secret", "ingress", "namespace"];
    return files.some(
      (file) =>
        k8sKeywords.some((keyword) => file.toLowerCase().includes(keyword)) &&
        (file.endsWith(".yaml") || file.endsWith(".yml")),
    );
  }
}

// Export singleton instance with optimized worker count
export const gitScanner = new GitScanner();

// Cleanup on process exit
process.on("exit", () => {
  gitScanner.cleanupAll().catch(console.error);
});

process.on("SIGINT", () => {
  gitScanner.cleanupAll().catch(console.error);
  process.exit(0);
});

process.on("SIGTERM", () => {
  gitScanner.cleanupAll().catch(console.error);
  process.exit(0);
});
