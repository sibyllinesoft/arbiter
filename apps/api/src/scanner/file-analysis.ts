/**
 * File analysis utilities for the scanner worker.
 * Provides file categorization, extension detection, and project structure analysis.
 */

/** Analyzed information about a single file */
export interface FileInfo {
  path: string;
  relativePath: string;
  isDirectory: boolean;
  size: number;
  extension: string;
  isImportable: boolean;
  projectIndicators: string[];
}

const PROJECT_CONFIG_FILES = new Set([
  "package.json",
  "cargo.toml",
  "dockerfile",
  "docker-compose.yml",
  "docker-compose.yaml",
  "requirements.txt",
  "pyproject.toml",
  "setup.py",
  "go.mod",
  "makefile",
  "tsconfig.json",
  "jsconfig.json",
  "webpack.config.js",
  "rollup.config.js",
  "vite.config.js",
  "vite.config.ts",
  ".gitignore",
  "readme.md",
]);

const IMPORTABLE_EXTENSIONS = new Set([
  "cue",
  "json",
  "yaml",
  "yml",
  "toml",
  "ts",
  "js",
  "tsx",
  "jsx",
  "py",
  "rs",
  "go",
  "dockerfile",
  "md",
  "txt",
]);

const CONFIG_EXTENSIONS = new Set(["cue", "json", "yaml", "yml", "toml"]);
const TS_JS_EXTENSIONS = new Set(["ts", "js", "tsx", "jsx"]);
const K8S_KEYWORDS = ["deployment", "service", "configmap", "secret", "ingress", "namespace"];
const SKIP_ENTRIES = new Set(["node_modules", "dist", "build", "target", "__pycache__", ".git"]);

/**
 * Check if a directory entry should be skipped during scanning.
 * @param entry - Directory or file name to check
 * @returns True if the entry should be skipped
 */
export function shouldSkipEntry(entry: string): boolean {
  return entry.startsWith(".") || SKIP_ENTRIES.has(entry);
}

/**
 * Extract the file extension from a filename.
 * @param fileName - Name of the file
 * @returns Lowercase extension without the dot
 */
export function getExtension(fileName: string): string {
  return fileName.includes(".") ? fileName.split(".").pop()?.toLowerCase() || "" : "";
}

/**
 * Analyze a file and populate its info based on name and extension.
 * @param fileInfo - File info object to populate
 * @param fileName - Name of the file being analyzed
 */
export function analyzeFileInfo(fileInfo: FileInfo, fileName: string): void {
  const lowerFileName = fileName.toLowerCase();
  const { extension } = fileInfo;

  if (PROJECT_CONFIG_FILES.has(lowerFileName)) {
    fileInfo.isImportable = true;
    fileInfo.projectIndicators.push("project-config");
  }

  if (IMPORTABLE_EXTENSIONS.has(extension)) {
    fileInfo.isImportable = true;
    categorizeByExtension(fileInfo, extension);
  }

  if (isYamlFile(extension) && hasK8sKeyword(lowerFileName)) {
    fileInfo.projectIndicators.push("kubernetes");
  }
}

/** Categorize a file by its extension and add project indicators */
function categorizeByExtension(fileInfo: FileInfo, extension: string): void {
  if (CONFIG_EXTENSIONS.has(extension)) {
    fileInfo.projectIndicators.push("config-file");
  } else if (TS_JS_EXTENSIONS.has(extension)) {
    fileInfo.projectIndicators.push("typescript-javascript");
  } else if (extension === "py") {
    fileInfo.projectIndicators.push("python");
  } else if (extension === "rs") {
    fileInfo.projectIndicators.push("rust");
  } else if (extension === "go") {
    fileInfo.projectIndicators.push("golang");
  }
}

/** Check if extension indicates a YAML file */
function isYamlFile(extension: string): boolean {
  return extension === "yaml" || extension === "yml";
}

/** Check if filename contains a Kubernetes resource keyword */
function hasK8sKeyword(fileName: string): boolean {
  return K8S_KEYWORDS.some((keyword) => fileName.includes(keyword));
}

/**
 * Analyze file content to detect project indicators.
 * @param fileInfo - File info object to update
 * @param content - Raw file content
 */
export function analyzeFileContent(fileInfo: FileInfo, content: string): void {
  const lowerContent = content.toLowerCase();

  if (lowerContent.includes("apiversion:") && lowerContent.includes("kind:")) {
    fileInfo.projectIndicators.push("kubernetes-manifest");
  }

  if (lowerContent.includes("package:") && fileInfo.extension === "cue") {
    fileInfo.projectIndicators.push("cue-package");
  }

  if (lowerContent.includes("import") && TS_JS_EXTENSIONS.has(fileInfo.extension)) {
    fileInfo.projectIndicators.push("module-file");
  }

  if (isPythonModule(lowerContent, fileInfo.extension)) {
    fileInfo.projectIndicators.push("python-module");
  }
}

/** Check if file content indicates a Python module */
function isPythonModule(content: string, extension: string): boolean {
  return extension === "py" && (content.includes("def ") || content.includes("class "));
}

/**
 * Check if a directory name indicates a project source directory.
 * @param dirName - Name of the directory
 * @returns True if directory is a common project folder
 */
export function isProjectDirectory(dirName: string): boolean {
  const projectDirs = ["src", "lib", "config", "configs", "schemas", "spec", "specs"];
  return projectDirs.includes(dirName.toLowerCase());
}
