/**
 * GitUrlImport - Component for importing projects from Git URLs.
 * Allows users to enter a Git URL, scan the repository, and create a project.
 */

import { useUIState } from "@contexts/AppContext";
import { useSetCurrentProject } from "@contexts/ProjectContext";
import { Button } from "@design-system";
import { useProjects } from "@hooks/api-hooks";
import { CheckCircle, GitBranch as GitIcon, Link, RefreshCw } from "lucide-react";
import React, { useState } from "react";
import {
  type ScanResult,
  getDetectedProjectTypes,
  getScanMethodDescription,
  importFromScan,
  scanGitUrl,
} from "./git-import-utils";

/** Props for the GitUrlImport component */
interface GitUrlImportProps {
  onClose: () => void;
}

/**
 * Component for importing projects from Git repository URLs.
 * Scans the repository and extracts project structure before creation.
 */
export function GitUrlImport({ onClose }: GitUrlImportProps) {
  const { gitUrl, setGitUrl } = useUIState();
  const { refetch: refetchProjects } = useProjects();
  const setCurrentProject = useSetCurrentProject();

  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  const handleScanGitUrl = async () => {
    setIsScanning(true);
    const result = await scanGitUrl(gitUrl);
    if (result) setScanResult(result);
    setIsScanning(false);
  };

  const handleImportFromScan = async () => {
    if (!scanResult) return;

    setIsCreatingProject(true);
    const result = await importFromScan(scanResult);
    if (result.success && result.project) {
      setCurrentProject(result.project);
      refetchProjects();
      onClose();
    }
    setIsCreatingProject(false);
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
              <strong>Detected Files:</strong>{" "}
              {getDetectedProjectTypes(scanResult.projectStructure)}
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
                {getScanMethodDescription(scanResult.projectStructure)}
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
