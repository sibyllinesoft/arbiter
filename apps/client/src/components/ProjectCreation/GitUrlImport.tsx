/**
 * GitUrlImport - Component for importing projects from Git URLs
 */

import { useUIState } from "@contexts/AppContext";
import { useSetCurrentProject } from "@contexts/ProjectContext";
import { Button } from "@design-system";
import { useProjects } from "@hooks/api-hooks";
import { apiService } from "@services/api";
import { CheckCircle, GitBranch as GitIcon, Link, RefreshCw } from "lucide-react";
import React, { useState } from "react";
import { toast } from "react-toastify";

interface GitUrlImportProps {
  onClose: () => void;
}

export function GitUrlImport({ onClose }: GitUrlImportProps) {
  const { gitUrl, setGitUrl } = useUIState();
  const { refetch: refetchProjects } = useProjects();
  const setCurrentProject = useSetCurrentProject();

  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  const handleScanGitUrl = async () => {
    if (!gitUrl.trim()) {
      toast.error("Please enter a valid Git URL");
      return;
    }

    setIsScanning(true);
    try {
      const result = await apiService.scanGitUrl(gitUrl);
      if (result.success) {
        setScanResult(result);
        toast.success("Repository scanned successfully");
      } else {
        toast.error(result.error || "Failed to scan repository");
      }
    } catch (error) {
      toast.error("Failed to scan git repository");
      console.error("Git scan error:", error);
    } finally {
      setIsScanning(false);
    }
  };

  const handleImportFromScan = async () => {
    if (!scanResult) return;

    setIsCreatingProject(true);
    try {
      let projectName: string =
        scanResult.projectName ||
        scanResult.gitUrl?.split("/").pop()?.replace(".git", "") ||
        "git-import";
      let projectPath: string | undefined = !scanResult.isLocalFileSelection
        ? scanResult.tempPath
        : undefined;

      const newProject = await apiService.createProject(projectName, projectPath);
      setCurrentProject(newProject);
      refetchProjects();
      onClose();

      if (scanResult.tempPath && !scanResult.isLocalFileSelection) {
        try {
          const tempId = btoa(scanResult.tempPath);
          await apiService.cleanupImport(tempId);
        } catch (cleanupError) {
          console.warn("Failed to cleanup temp directory:", cleanupError);
        }
      }
      toast.success(`Project "${newProject.name}" created from repository`);
    } catch (error) {
      toast.error("Failed to create project from scan");
      console.error("Import from scan error:", error);
    } finally {
      setIsCreatingProject(false);
    }
  };

  return (
    <div className="h-full space-y-4 overflow-y-auto">
      <div className="rounded-lg border-2 border-dashed border-gray-300 p-6 dark:border-graphite-600 dark:bg-graphite-900/40">
        <div className="mb-4 flex items-center gap-3">
          <GitIcon className="h-8 w-8 text-gray-400 dark:text-graphite-300" />
          <div>
            <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Clone from Git Repository
            </h4>
            <p className="text-sm text-gray-600 dark:text-graphite-300">
              Enter a GitHub, GitLab, or other Git repository URL
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <input
            type="url"
            value={gitUrl}
            onChange={(e) => setGitUrl(e.target.value)}
            placeholder="https://github.com/user/repo.git"
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-graphite-600 dark:bg-graphite-800 dark:text-gray-100 dark:placeholder:text-graphite-400 dark:focus:ring-blue-400"
          />
          <Button
            variant="secondary"
            onClick={handleScanGitUrl}
            disabled={!gitUrl.trim() || isScanning}
            className="w-full"
            leftIcon={
              isScanning ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Link className="w-4 h-4" />
              )
            }
          >
            {isScanning ? "Scanning Repository..." : "Scan Repository"}
          </Button>
        </div>
      </div>

      {/* Scan Results */}
      {scanResult && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-500/40 dark:bg-green-500/10">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            <h4 className="font-medium text-green-900 dark:text-green-200">
              Repository Scanned Successfully
            </h4>
          </div>

          <div className="space-y-2 text-sm">
            <p className="text-green-800 dark:text-green-200">
              <strong>Detected Files:</strong> {(() => {
                const types = [];
                if (scanResult.projectStructure?.hasPackageJson) types.push("Node.js");
                if (scanResult.projectStructure?.hasCargoToml) types.push("Rust");
                if (scanResult.projectStructure?.hasDockerfile) types.push("Docker");
                if (scanResult.projectStructure?.hasCueFiles) types.push("CUE");
                if (scanResult.projectStructure?.hasYamlFiles) types.push("YAML");
                if (scanResult.projectStructure?.hasJsonFiles) types.push("JSON");
                return types.length > 0 ? types.join(", ") : "Various configuration files";
              })()}
            </p>
            <p className="text-green-800 dark:text-green-200">
              <strong>Files Found:</strong> {scanResult.files?.length || 0}
            </p>
            <p className="text-green-800 dark:text-green-200">
              <strong>Importable Files:</strong>{" "}
              {scanResult.projectStructure?.importableFiles?.length || 0}
            </p>
            {scanResult.projectStructure?.performanceMetrics && (
              <p className="text-green-800 dark:text-green-200">
                <strong>Scan Method:</strong>{" "}
                {scanResult.projectStructure.performanceMetrics.usedGitLsFiles
                  ? "Git ls-files (fast)"
                  : "Directory scan"}
                {scanResult.projectStructure.performanceMetrics.usedGitLsFiles && " ⚡"}
              </p>
            )}
          </div>

          <Button
            variant="primary"
            onClick={handleImportFromScan}
            disabled={isCreatingProject}
            className="w-full mt-4"
          >
            {isCreatingProject ? "Creating Project..." : "Create Project from Repository"}
          </Button>
        </div>
      )}
    </div>
  );
}
