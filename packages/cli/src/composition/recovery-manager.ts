import fs from "fs-extra";
import path from "node:path";
import type { RecoveryOptions, ComposedSpecification, ProjectCompositionConfig } from "../types.js";

/**
 * Handles project recovery from composed specifications
 */
export class RecoveryManager {
  private readonly projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  /**
   * Recover a complete project from its composed specification
   */
  async recoverProject(options: RecoveryOptions): Promise<{
    success: boolean;
    recoveredFiles: string[];
    error?: string;
  }> {
    const result = {
      success: false,
      recoveredFiles: [] as string[],
      error: undefined as string | undefined
    };

    try {
      const targetDir = options.target || this.projectRoot;
      await fs.ensureDir(targetDir);

      // Load the composed specification
      const composedSpec = await this.loadComposedSpec();
      if (!composedSpec) {
        result.error = "No composed specification found for recovery";
        return result;
      }

      // Validate recovery capability
      if (!composedSpec.recovery.regenerationCapable) {
        result.error = "Project is not marked as recovery-capable due to validation errors";
        return result;
      }

      // Perform recovery based on mode
      switch (options.mode || "full") {
        case "full":
          return await this.performFullRecovery(composedSpec, targetDir, options);
        case "spec_only":
          return await this.performSpecOnlyRecovery(composedSpec, targetDir, options);
        case "structure_only":
          return await this.performStructureOnlyRecovery(composedSpec, targetDir, options);
        default:
          result.error = `Unknown recovery mode: ${options.mode}`;
          return result;
      }

    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      return result;
    }
  }

  /**
   * Recover from a specific integration point in history
   */
  async recoverFromHistoryPoint(
    recoveryPoint: string,
    targetDir: string,
    options: RecoveryOptions = {}
  ): Promise<{
    success: boolean;
    recoveredFiles: string[];
    error?: string;
  }> {
    const result = {
      success: false,
      recoveredFiles: [] as string[],
      error: undefined as string | undefined
    };

    try {
      // Load project configuration
      const config = await this.loadProjectConfig();
      
      // Find the recovery point in integration history
      const historyEntry = config.integrationHistory.find(
        entry => entry.id === recoveryPoint
      );

      if (!historyEntry) {
        result.error = `Recovery point ${recoveryPoint} not found in integration history`;
        return result;
      }

      // Restore files from the recovery point
      if (historyEntry.recoveryData.backups) {
        for (const [originalPath, backupPath] of Object.entries(historyEntry.recoveryData.backups)) {
          const targetPath = path.join(targetDir, path.relative(this.projectRoot, originalPath));
          await fs.ensureDir(path.dirname(targetPath));
          await fs.copy(backupPath, targetPath);
          result.recoveredFiles.push(targetPath);
        }
      }

      // Restore the specification to the state at this point
      const specPath = path.join(targetDir, ".arbiter", "composed", "master.cue");
      await fs.ensureDir(path.dirname(specPath));
      await fs.writeFile(specPath, historyEntry.specAfter, "utf-8");
      result.recoveredFiles.push(specPath);

      result.success = true;

    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
  }

  /**
   * Create a recovery snapshot of the current project state
   */
  async createRecoverySnapshot(description?: string): Promise<{
    success: boolean;
    snapshotId: string;
    snapshotPath: string;
    error?: string;
  }> {
    const result = {
      success: false,
      snapshotId: "",
      snapshotPath: "",
      error: undefined as string | undefined
    };

    try {
      const snapshotId = `snapshot-${Date.now()}`;
      const snapshotDir = path.join(this.projectRoot, ".arbiter", "snapshots", snapshotId);
      await fs.ensureDir(snapshotDir);

      // Copy current project state
      const filesToSnapshot = await this.identifyProjectFiles();
      
      for (const filePath of filesToSnapshot) {
        const relativePath = path.relative(this.projectRoot, filePath);
        const targetPath = path.join(snapshotDir, relativePath);
        
        await fs.ensureDir(path.dirname(targetPath));
        await fs.copy(filePath, targetPath);
      }

      // Create snapshot metadata
      const snapshotMetadata = {
        id: snapshotId,
        created_at: new Date().toISOString(),
        description: description || "Manual snapshot",
        files_count: filesToSnapshot.length,
        composed_spec_version: await this.getCurrentSpecVersion()
      };

      const metadataPath = path.join(snapshotDir, "snapshot.json");
      await fs.writeJson(metadataPath, snapshotMetadata, { spaces: 2 });

      result.success = true;
      result.snapshotId = snapshotId;
      result.snapshotPath = snapshotDir;

    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
  }

  /**
   * List available recovery points
   */
  async listRecoveryPoints(): Promise<{
    integrationHistory: Array<{
      id: string;
      timestamp: string;
      operation: string;
      fragments: string[];
      success: boolean;
    }>;
    snapshots: Array<{
      id: string;
      created_at: string;
      description: string;
      files_count: number;
    }>;
  }> {
    const result = {
      integrationHistory: [] as any[],
      snapshots: [] as any[]
    };

    try {
      // Load integration history from project config
      const config = await this.loadProjectConfig();
      result.integrationHistory = config.integrationHistory.map(entry => ({
        id: entry.id,
        timestamp: entry.timestamp,
        operation: entry.operation,
        fragments: entry.fragments,
        success: entry.success
      }));

      // Load snapshots from filesystem
      const snapshotsDir = path.join(this.projectRoot, ".arbiter", "snapshots");
      if (await fs.pathExists(snapshotsDir)) {
        const snapshotDirs = await fs.readdir(snapshotsDir);
        
        for (const snapshotDir of snapshotDirs) {
          const metadataPath = path.join(snapshotsDir, snapshotDir, "snapshot.json");
          if (await fs.pathExists(metadataPath)) {
            const metadata = await fs.readJson(metadataPath);
            result.snapshots.push(metadata);
          }
        }
      }

    } catch (error) {
      // Return empty results if loading fails
    }

    return result;
  }

  /**
   * Validate recovery capability of current project
   */
  async validateRecoveryCapability(): Promise<{
    canRecover: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const result = {
      canRecover: true,
      issues: [] as string[],
      recommendations: [] as string[]
    };

    try {
      // Check if composed specification exists
      const composedSpec = await this.loadComposedSpec();
      if (!composedSpec) {
        result.canRecover = false;
        result.issues.push("No composed specification found");
        result.recommendations.push("Run 'arbiter composition generate' to create composed specification");
        return result;
      }

      // Check specification validity
      if (!composedSpec.validation.valid) {
        result.canRecover = false;
        result.issues.push("Composed specification has validation errors");
        result.recommendations.push("Resolve validation errors before attempting recovery");
      }

      // Check recovery metadata completeness
      if (!composedSpec.recovery.regenerationCapable) {
        result.canRecover = false;
        result.issues.push("Project is not marked as regeneration capable");
      }

      // Check external dependencies
      const missingDeps = await this.checkExternalDependencies(composedSpec.recovery.externalDependencies);
      if (missingDeps.length > 0) {
        result.issues.push(`Missing external dependencies: ${missingDeps.join(", ")}`);
        result.recommendations.push("Install missing dependencies before recovery");
      }

      // Check file structure template
      if (!composedSpec.recovery.fileStructure || Object.keys(composedSpec.recovery.fileStructure).length === 0) {
        result.issues.push("File structure template is empty");
        result.recommendations.push("Regenerate composed specification with updated file structure");
      }

    } catch (error) {
      result.canRecover = false;
      result.issues.push(`Recovery validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  /**
   * Perform full project recovery
   */
  private async performFullRecovery(
    composedSpec: ComposedSpecification,
    targetDir: string,
    options: RecoveryOptions
  ): Promise<{
    success: boolean;
    recoveredFiles: string[];
    error?: string;
  }> {
    const result = {
      success: false,
      recoveredFiles: [] as string[],
      error: undefined as string | undefined
    };

    try {
      // 1. Recreate directory structure
      const structureResult = await this.recreateFileStructure(
        composedSpec.recovery.fileStructure,
        targetDir
      );
      result.recoveredFiles.push(...structureResult.createdFiles);

      // 2. Restore CUE specification
      const specResult = await this.restoreSpecification(composedSpec, targetDir);
      result.recoveredFiles.push(...specResult.createdFiles);

      // 3. Restore fragment files
      const fragmentsResult = await this.restoreFragments(targetDir);
      result.recoveredFiles.push(...fragmentsResult.createdFiles);

      // 4. Restore configuration
      const configResult = await this.restoreConfiguration(targetDir);
      result.recoveredFiles.push(...configResult.createdFiles);

      // 5. Install external dependencies if requested
      if (options.includeExternalDeps) {
        const depsResult = await this.installExternalDependencies(
          composedSpec.recovery.externalDependencies,
          targetDir
        );
        // Dependencies don't create files, so we just note success
      }

      result.success = true;

    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
  }

  /**
   * Perform specification-only recovery
   */
  private async performSpecOnlyRecovery(
    composedSpec: ComposedSpecification,
    targetDir: string,
    options: RecoveryOptions
  ): Promise<{
    success: boolean;
    recoveredFiles: string[];
    error?: string;
  }> {
    const result = {
      success: false,
      recoveredFiles: [] as string[],
      error: undefined as string | undefined
    };

    try {
      const specResult = await this.restoreSpecification(composedSpec, targetDir);
      result.recoveredFiles.push(...specResult.createdFiles);
      result.success = true;

    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
  }

  /**
   * Perform structure-only recovery
   */
  private async performStructureOnlyRecovery(
    composedSpec: ComposedSpecification,
    targetDir: string,
    options: RecoveryOptions
  ): Promise<{
    success: boolean;
    recoveredFiles: string[];
    error?: string;
  }> {
    const result = {
      success: false,
      recoveredFiles: [] as string[],
      error: undefined as string | undefined
    };

    try {
      const structureResult = await this.recreateFileStructure(
        composedSpec.recovery.fileStructure,
        targetDir
      );
      result.recoveredFiles.push(...structureResult.createdFiles);
      result.success = true;

    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
  }

  // Helper methods

  private async loadComposedSpec(): Promise<ComposedSpecification | null> {
    const specPath = path.join(this.projectRoot, ".arbiter", "composed", "composed-spec.json");
    
    try {
      return await fs.readJson(specPath);
    } catch {
      return null;
    }
  }

  private async loadProjectConfig(): Promise<ProjectCompositionConfig> {
    const configPath = path.join(this.projectRoot, ".arbiter", "project.json");
    return await fs.readJson(configPath);
  }

  private async checkExternalDependencies(dependencies: string[]): Promise<string[]> {
    const missing: string[] = [];
    
    // Simple check - in production, this would be more sophisticated
    for (const dep of dependencies) {
      // Check if dependency is available (simplified)
      const exists = await this.checkDependencyExists(dep);
      if (!exists) {
        missing.push(dep);
      }
    }
    
    return missing;
  }

  private async checkDependencyExists(dependency: string): Promise<boolean> {
    // Simplified dependency check - in production, this would check package managers, system packages, etc.
    try {
      const { spawn } = await import("node:child_process");
      return new Promise((resolve) => {
        const process = spawn("which", [dependency]);
        process.on("close", (code) => {
          resolve(code === 0);
        });
        process.on("error", () => {
          resolve(false);
        });
      });
    } catch {
      return false;
    }
  }

  private async recreateFileStructure(
    fileStructure: Record<string, string>,
    targetDir: string
  ): Promise<{
    createdFiles: string[];
    error?: string;
  }> {
    const result = {
      createdFiles: [] as string[],
      error: undefined as string | undefined
    };

    try {
      for (const [filePath, template] of Object.entries(fileStructure)) {
        const fullPath = path.join(targetDir, filePath);
        await fs.ensureDir(path.dirname(fullPath));
        
        // Generate content from template
        const content = await this.generateFileContentFromTemplate(template);
        await fs.writeFile(fullPath, content, "utf-8");
        
        result.createdFiles.push(fullPath);
      }
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
  }

  private async restoreSpecification(
    composedSpec: ComposedSpecification,
    targetDir: string
  ): Promise<{
    createdFiles: string[];
    error?: string;
  }> {
    const result = {
      createdFiles: [] as string[],
      error: undefined as string | undefined
    };

    try {
      const specDir = path.join(targetDir, ".arbiter", "composed");
      await fs.ensureDir(specDir);
      
      const specPath = path.join(specDir, "master.cue");
      await fs.writeFile(specPath, composedSpec.spec, "utf-8");
      result.createdFiles.push(specPath);
      
      // Also save the full composed specification
      const composedSpecPath = path.join(specDir, "composed-spec.json");
      await fs.writeJson(composedSpecPath, composedSpec, { spaces: 2 });
      result.createdFiles.push(composedSpecPath);

    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
  }

  private async restoreFragments(targetDir: string): Promise<{
    createdFiles: string[];
    error?: string;
  }> {
    const result = {
      createdFiles: [] as string[],
      error: undefined as string | undefined
    };

    try {
      // Copy fragments from current project to target
      const fragmentsDir = path.join(this.projectRoot, ".arbiter", "fragments");
      const targetFragmentsDir = path.join(targetDir, ".arbiter", "fragments");
      
      if (await fs.pathExists(fragmentsDir)) {
        await fs.ensureDir(targetFragmentsDir);
        await fs.copy(fragmentsDir, targetFragmentsDir);
        
        const fragmentFiles = await fs.readdir(targetFragmentsDir);
        result.createdFiles.push(...fragmentFiles.map(f => path.join(targetFragmentsDir, f)));
      }

    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
  }

  private async restoreConfiguration(targetDir: string): Promise<{
    createdFiles: string[];
    error?: string;
  }> {
    const result = {
      createdFiles: [] as string[],
      error: undefined as string | undefined
    };

    try {
      // Copy project configuration
      const configPath = path.join(this.projectRoot, ".arbiter", "project.json");
      const targetConfigPath = path.join(targetDir, ".arbiter", "project.json");
      
      if (await fs.pathExists(configPath)) {
        await fs.ensureDir(path.dirname(targetConfigPath));
        await fs.copy(configPath, targetConfigPath);
        result.createdFiles.push(targetConfigPath);
      }

    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
  }

  private async installExternalDependencies(
    dependencies: string[],
    targetDir: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    // Placeholder for dependency installation
    // In production, this would handle package managers, system dependencies, etc.
    return { success: true };
  }

  private async generateFileContentFromTemplate(template: string): Promise<string> {
    // Basic template processing - could be enhanced with actual templating
    switch (template) {
      case "module template":
        return `module: "example.com/recovered"
language: version: "v0.6.0"`;
      case "schema template":
        return `package main

// Recovered schema
#Config: {
\tname: string
\tversion: string
}`;
      case "values template":
        return `package main

// Recovered values
config: #Config & {
\tname: "recovered-project"
\tversion: "1.0.0"
}`;
      case "composition config":
        return "{}"; // Will be overwritten by actual config
      default:
        return `// Generated from template: ${template}`;
    }
  }

  private async identifyProjectFiles(): Promise<string[]> {
    const files: string[] = [];
    
    // CUE files
    const cueFiles = await this.findFilesWithExtension(".cue");
    files.push(...cueFiles);
    
    // Configuration files
    const configFiles = [
      ".arbiter/project.json",
      ".arbiter.json",
      "cue.mod/module.cue"
    ].map(f => path.join(this.projectRoot, f));
    
    for (const configFile of configFiles) {
      if (await fs.pathExists(configFile)) {
        files.push(configFile);
      }
    }
    
    return files;
  }

  private async findFilesWithExtension(extension: string): Promise<string[]> {
    const files: string[] = [];
    
    const findFiles = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory() && !entry.name.startsWith(".")) {
            await findFiles(fullPath);
          } else if (entry.isFile() && entry.name.endsWith(extension)) {
            files.push(fullPath);
          }
        }
      } catch {
        // Skip directories that can't be read
      }
    };
    
    await findFiles(this.projectRoot);
    return files;
  }

  private async getCurrentSpecVersion(): Promise<string> {
    const composedSpec = await this.loadComposedSpec();
    return composedSpec?.metadata.version || "unknown";
  }
}