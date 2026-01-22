/**
 * Utility functions for Git URL import functionality.
 */

import type { Project } from "@/types/api";
import { apiService } from "@services/api";
import { toast } from "react-toastify";

interface ProjectStructure {
  hasPackageJson?: boolean;
  hasCargoToml?: boolean;
  hasDockerfile?: boolean;
  hasCueFiles?: boolean;
  hasYamlFiles?: boolean;
  hasJsonFiles?: boolean;
  importableFiles?: unknown[];
  performanceMetrics?: {
    usedGitLsFiles?: boolean;
  };
}

interface ScanResult {
  success: boolean;
  error?: string;
  projectName?: string;
  gitUrl?: string;
  tempPath?: string;
  isLocalFileSelection?: boolean;
  files?: unknown[];
  projectStructure?: ProjectStructure;
}

/** Detect project types from scan result structure */
export function getDetectedProjectTypes(projectStructure?: ProjectStructure): string {
  if (!projectStructure) {
    return "Various configuration files";
  }

  const types: string[] = [];
  if (projectStructure.hasPackageJson) types.push("Node.js");
  if (projectStructure.hasCargoToml) types.push("Rust");
  if (projectStructure.hasDockerfile) types.push("Docker");
  if (projectStructure.hasCueFiles) types.push("CUE");
  if (projectStructure.hasYamlFiles) types.push("YAML");
  if (projectStructure.hasJsonFiles) types.push("JSON");

  return types.length > 0 ? types.join(", ") : "Various configuration files";
}

/** Get scan method description */
export function getScanMethodDescription(projectStructure?: ProjectStructure): string {
  const metrics = projectStructure?.performanceMetrics;
  if (!metrics) return "";

  return metrics.usedGitLsFiles ? "Git ls-files (fast) ⚡" : "Directory scan";
}

/** Extract project name from scan result or git URL */
export function extractProjectName(scanResult: ScanResult): string {
  if (scanResult.projectName) {
    return scanResult.projectName;
  }

  const urlPath = scanResult.gitUrl?.split("/").pop();
  if (urlPath) {
    return urlPath.replace(".git", "");
  }

  return "git-import";
}

/** Check if cleanup is needed after import */
export function needsCleanup(scanResult: ScanResult): boolean {
  return Boolean(scanResult.tempPath && !scanResult.isLocalFileSelection);
}

/** Scan a Git URL and return the scan result */
export async function scanGitUrl(gitUrl: string): Promise<ScanResult | null> {
  if (!gitUrl.trim()) {
    toast.error("Please enter a valid Git URL", { autoClose: 2000 });
    return null;
  }

  try {
    const result = await apiService.scanGitUrl(gitUrl);
    if (result.success) {
      toast.success("Repository scanned successfully", { autoClose: 2000 });
      return result as ScanResult;
    }
    toast.error(result.error || "Failed to scan repository", { autoClose: 3000 });
    return null;
  } catch (error) {
    toast.error("Failed to scan git repository", { autoClose: 3000 });
    console.error("Git scan error:", error);
    return null;
  }
}

/** Cleanup temporary import resources */
async function cleanupTempResources(scanResult: ScanResult): Promise<void> {
  if (!needsCleanup(scanResult) || !scanResult.tempPath) return;

  try {
    const tempId = btoa(scanResult.tempPath);
    await apiService.cleanupImport(tempId);
  } catch (cleanupError) {
    console.warn("Failed to cleanup temp directory:", cleanupError);
  }
}

/** Import a project from scan result */
export async function importFromScan(
  scanResult: ScanResult,
): Promise<{ success: boolean; project?: Project }> {
  try {
    const projectName = extractProjectName(scanResult);
    const projectPath = !scanResult.isLocalFileSelection ? scanResult.tempPath : undefined;

    const newProject = await apiService.createProject(projectName, projectPath);
    await cleanupTempResources(scanResult);
    toast.success(`Project "${newProject.name}" created from repository`, { autoClose: 2000 });
    return { success: true, project: newProject };
  } catch (error) {
    toast.error("Failed to create project from scan", { autoClose: 3000 });
    console.error("Import from scan error:", error);
    return { success: false };
  }
}

export type { ScanResult, ProjectStructure };
