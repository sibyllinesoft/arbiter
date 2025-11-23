/**
 * Python Plugin for Brownfield Detection
 *
 * Comprehensive plugin for detecting Python artifacts including web services,
 * CLI tools, data processing scripts, and libraries. Analyzes setup.py, pyproject.toml,
 * requirements.txt, and source files to infer application architecture.
 */

import * as path from "path";
import {
  type ArtifactType,
  type Evidence,
  type ImporterPlugin,
  type InferenceContext,
  type InferredArtifact,
  type ParseContext,
  type Provenance,
} from "../types";

// ============================================================================
// Python Configuration Data Types
// ============================================================================

interface PythonPackageData extends Record<string, unknown> {
  configType: string;
  name: string;
  version?: string;
  description?: string;
  dependencies: string[];
  devDependencies: string[];
  scripts: Record<string, string>;
  entryPoints?: Record<string, string>;
  author?: string;
  license?: string;
  keywords?: string[];
  homepage?: string;
  repository?: string;
}

interface PythonSourceData extends Record<string, unknown> {
  configType: string;
  filePath: string;
  hasImports: boolean;
  hasIfMain: boolean;
  isPackageInit: boolean;
  imports: string[];
  webFrameworks: string[];
  cliPatterns: string[];
  dataProcessingPatterns: string[];
}

// Simplified heuristics to align with Node and Rust manifest classification
const PYTHON_WEB_FRAMEWORKS = [
  "django",
  "flask",
  "fastapi",
  "tornado",
  "sanic",
  "starlette",
  "bottle",
  "falcon",
  "pyramid",
];

const PYTHON_CLI_LIBRARIES = ["click", "typer", "argparse", "fire", "docopt"];

const PYTHON_FRONTEND_LIBRARIES = ["streamlit", "dash", "gradio", "panel"];

function normalizeDependencyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_.-].*$/i, "")
    .replace(/_/g, "-");
}

function collectNormalizedDependencies(values: string[] | undefined): Set<string> {
  const set = new Set<string>();
  if (!values) return set;
  for (const value of values) {
    if (!value) continue;
    const normalized = normalizeDependencyName(String(value));
    if (normalized) {
      set.add(normalized);
    }
  }
  return set;
}

interface PythonClassification {
  artifactType: ArtifactType;
  detectedType: string;
  reason: string;
  framework?: string;
}

function classifyPythonPackage(packageData: PythonPackageData): PythonClassification {
  const dependencySet = collectNormalizedDependencies(packageData.dependencies);
  const devDependencySet = collectNormalizedDependencies(packageData.devDependencies);
  const combinedDeps = new Set<string>([...dependencySet, ...devDependencySet]);

  const findDependency = (candidates: string[]): string | undefined => {
    return candidates.find((candidate) => combinedDeps.has(candidate));
  };

  const matchedWebFramework = findDependency(PYTHON_WEB_FRAMEWORKS);
  if (matchedWebFramework) {
    return {
      artifactType: "service",
      detectedType: "service",
      reason: "web-framework",
      framework: matchedWebFramework,
    };
  }

  const hasScripts = Object.keys(packageData.scripts || {}).length > 0;
  const hasConsoleEntry = Boolean(
    packageData.entryPoints &&
      typeof packageData.entryPoints === "object" &&
      Object.keys((packageData.entryPoints as Record<string, unknown>).console_scripts ?? {})
        .length > 0,
  );
  const matchedCliLibrary = findDependency(PYTHON_CLI_LIBRARIES);

  if (matchedCliLibrary || hasScripts || hasConsoleEntry) {
    return {
      artifactType: "binary",
      detectedType: "cli",
      reason: matchedCliLibrary ? "cli-library" : "console-script",
      framework: matchedCliLibrary,
    };
  }

  const matchedFrontendLibrary = findDependency(PYTHON_FRONTEND_LIBRARIES);
  if (matchedFrontendLibrary) {
    return {
      artifactType: "frontend",
      detectedType: "frontend",
      reason: "frontend-library",
      framework: matchedFrontendLibrary,
    };
  }

  return {
    artifactType: "module",
    detectedType: "module",
    reason: "default-module",
  };
}

function classifyPythonSource(evidence: PythonSourceData[]): PythonClassification {
  let matchedFramework: string | undefined;
  let hasCli = false;

  for (const item of evidence) {
    if (!matchedFramework && item.webFrameworks?.length) {
      matchedFramework = item.webFrameworks[0];
    }
    if (item.cliPatterns?.length || item.hasIfMain) {
      hasCli = true;
    }
  }

  if (matchedFramework) {
    return {
      artifactType: "service",
      detectedType: "service",
      reason: "source-web-framework",
      framework: matchedFramework,
    };
  }

  if (hasCli) {
    return {
      artifactType: "binary",
      detectedType: "cli",
      reason: "source-cli-pattern",
    };
  }

  return {
    artifactType: "module",
    detectedType: "module",
    reason: "source-default",
  };
}

// ============================================================================
// Main Plugin Implementation
// ============================================================================

export class PythonPlugin implements ImporterPlugin {
  name(): string {
    return "python";
  }

  supports(filePath: string, fileContent?: string): boolean {
    const fileName = path.basename(filePath);
    const extension = path.extname(filePath);

    // Support Python configuration files
    if (
      [
        "setup.py",
        "pyproject.toml",
        "requirements.txt",
        "Pipfile",
        "poetry.lock",
        "setup.cfg",
        "environment.yml",
        "conda.yml",
      ].includes(fileName)
    ) {
      return true;
    }

    // Support Python source files
    if ([".py", ".pyx", ".pyi"].includes(extension)) {
      return true;
    }

    return false;
  }

  async parse(filePath: string, fileContent?: string, context?: ParseContext): Promise<Evidence[]> {
    if (!fileContent) return [];

    const evidence: Evidence[] = [];
    const fileName = path.basename(filePath);
    const baseId = path.relative(context?.projectRoot ?? process.cwd(), filePath);

    try {
      if (fileName === "setup.py") {
        evidence.push(...(await this.parseSetupPy(filePath, fileContent, baseId)));
      } else if (fileName === "pyproject.toml") {
        evidence.push(...(await this.parsePyprojectToml(filePath, fileContent, baseId)));
      } else if (fileName === "requirements.txt") {
        evidence.push(...(await this.parseRequirementsTxt(filePath, fileContent, baseId)));
      } else if (fileName === "Pipfile") {
        evidence.push(...(await this.parsePipfile(filePath, fileContent, baseId)));
      } else if (path.extname(filePath) === ".py") {
        evidence.push(...(await this.parsePythonSource(filePath, fileContent, baseId)));
      }
    } catch (error) {
      console.warn(`Python plugin failed to parse ${filePath}:`, error);
    }

    return evidence;
  }

  async infer(evidence: Evidence[], context: InferenceContext): Promise<InferredArtifact[]> {
    const pythonEvidence = evidence.filter((e) => e.source === "python");
    if (pythonEvidence.length === 0) return [];

    const artifacts: InferredArtifact[] = [];

    try {
      // Infer from package configuration evidence
      const packageEvidence = pythonEvidence.filter((e) => {
        if (e.type !== "config") return false;
        const configType = typeof e.data?.configType === "string" ? e.data.configType : "";
        return ["setup", "pyproject", "package"].some((token) => configType.includes(token));
      });

      for (const pkg of packageEvidence) {
        artifacts.push(...(await this.inferFromPackageConfig(pkg, pythonEvidence, context)));
      }

      // If no package config found, try to infer from source files
      if (packageEvidence.length === 0) {
        artifacts.push(...(await this.inferFromSourceOnly(pythonEvidence, context)));
      }
    } catch (error) {
      console.warn("Python plugin inference failed:", error);
    }

    return artifacts;
  }

  // ============================================================================
  // Private parsing methods
  // ============================================================================

  private async parseSetupPy(
    filePath: string,
    content: string,
    baseId: string,
  ): Promise<Evidence[]> {
    const evidence: Evidence[] = [];

    try {
      // Extract setup() call parameters using regex (simplified)
      const setupMatch = content.match(/setup\s*\(\s*([\s\S]*?)\s*\)/);
      if (!setupMatch) return evidence;

      const setupContent = setupMatch[1];

      // Extract basic metadata
      const name =
        this.extractPythonStringField(setupContent, "name") ||
        path.basename(path.dirname(filePath));
      const version = this.extractPythonStringField(setupContent, "version");
      const description = this.extractPythonStringField(setupContent, "description");

      // Extract dependencies
      const installRequires = this.extractPythonListField(setupContent, "install_requires");
      const extraRequires = this.extractPythonDictField(setupContent, "extras_require");

      // Extract entry points
      const entryPoints = this.extractPythonDictField(setupContent, "entry_points");
      const scripts = this.extractPythonListField(setupContent, "scripts");

      const packageData: PythonPackageData = {
        configType: "setup-py",
        name,
        version,
        description,
        dependencies: installRequires,
        devDependencies: Object.values(extraRequires).flat(),
        scripts: this.convertToScripts(entryPoints as any, scripts),
        entryPoints: entryPoints as any,
        author: this.extractPythonStringField(setupContent, "author"),
        license: this.extractPythonStringField(setupContent, "license"),
        homepage: this.extractPythonStringField(setupContent, "url"),
      };

      evidence.push({
        id: baseId,
        source: "python",
        type: "config",
        filePath,
        data: packageData,
        metadata: {
          timestamp: Date.now(),
          fileSize: content.length,
        },
      });
    } catch (error) {
      console.warn("Failed to parse setup.py:", error);
    }

    return evidence;
  }

  private async parsePyprojectToml(
    filePath: string,
    content: string,
    baseId: string,
  ): Promise<Evidence[]> {
    const evidence: Evidence[] = [];

    try {
      // Simple TOML parsing for common fields
      const projectMatch = content.match(/\[project\]([\s\S]*?)(?=\n\[|\n$)/);
      const poetryMatch = content.match(/\[tool\.poetry\]([\s\S]*?)(?=\n\[|\n$)/);

      let projectSection = projectMatch?.[1];
      let poetrySection = poetryMatch?.[1];

      // Extract from [project] section (PEP 621)
      const name =
        this.extractTomlField(projectSection, "name") ||
        this.extractTomlField(poetrySection, "name") ||
        path.basename(path.dirname(filePath));
      const version =
        this.extractTomlField(projectSection, "version") ||
        this.extractTomlField(poetrySection, "version");
      const description =
        this.extractTomlField(projectSection, "description") ||
        this.extractTomlField(poetrySection, "description");

      // Extract dependencies
      const dependencies =
        this.extractTomlArray(projectSection, "dependencies") ||
        this.extractTomlDependencies(poetrySection);
      const devDependencies = this.extractTomlDevDependencies(content);

      // Extract scripts
      const scripts =
        this.extractTomlTable(projectSection, "scripts") ||
        this.extractTomlTable(poetrySection, "scripts") ||
        {};

      const packageData: PythonPackageData = {
        configType: "pyproject-toml",
        name,
        version,
        description,
        dependencies,
        devDependencies,
        scripts,
        author:
          this.extractTomlField(projectSection, "authors") ||
          this.extractTomlField(poetrySection, "authors"),
        license:
          this.extractTomlField(projectSection, "license") ||
          this.extractTomlField(poetrySection, "license"),
        homepage:
          this.extractTomlField(projectSection, "homepage") ||
          this.extractTomlField(poetrySection, "homepage"),
      };

      evidence.push({
        id: baseId,
        source: "python",
        type: "config",
        filePath,
        data: packageData,
        metadata: {
          timestamp: Date.now(),
          fileSize: content.length,
        },
      });
    } catch (error) {
      console.warn("Failed to parse pyproject.toml:", error);
    }

    return evidence;
  }

  private async parseRequirementsTxt(
    filePath: string,
    content: string,
    baseId: string,
  ): Promise<Evidence[]> {
    const evidence: Evidence[] = [];

    try {
      const dependencies = content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && !line.startsWith("-"))
        .map((line) => line.split(/[>=<~!]/)[0].trim());

      evidence.push({
        id: baseId,
        source: "python",
        type: "dependency",
        filePath,
        data: {
          configType: "requirements-txt",
          dependencies,
          devDependencies: [],
        },
        metadata: {
          timestamp: Date.now(),
          fileSize: content.length,
        },
      });
    } catch (error) {
      console.warn("Failed to parse requirements.txt:", error);
    }

    return evidence;
  }

  private async parsePipfile(
    filePath: string,
    content: string,
    baseId: string,
  ): Promise<Evidence[]> {
    const evidence: Evidence[] = [];

    try {
      // Extract dependencies from [packages] and [dev-packages] sections
      const packagesMatch = content.match(/\[packages\]([\s\S]*?)(?=\n\[|\n$)/);
      const devPackagesMatch = content.match(/\[dev-packages\]([\s\S]*?)(?=\n\[|\n$)/);

      const dependencies = this.extractTomlDependencies(packagesMatch?.[1]);
      const devDependencies = this.extractTomlDependencies(devPackagesMatch?.[1]);

      evidence.push({
        id: baseId,
        source: "python",
        type: "dependency",
        filePath,
        data: {
          configType: "pipfile",
          dependencies,
          devDependencies,
        },
        metadata: {
          timestamp: Date.now(),
          fileSize: content.length,
        },
      });
    } catch (error) {
      console.warn("Failed to parse Pipfile:", error);
    }

    return evidence;
  }

  private async parsePythonSource(
    filePath: string,
    content: string,
    baseId: string,
  ): Promise<Evidence[]> {
    const evidence: Evidence[] = [];

    try {
      // Detect imports
      const imports = this.extractImports(content);
      const hasImports = imports.length > 0;

      // Check for if __name__ == "__main__":
      const hasIfMain = /if\s+__name__\s*==\s*['""]__main__['""]/.test(content);

      // Check if this is a package __init__.py
      const isPackageInit = path.basename(filePath) === "__init__.py";

      // Detect web framework usage
      const webFrameworks = this.detectWebFrameworks(content, imports);

      // Detect CLI patterns
      const cliPatterns = this.detectCliPatterns(content, imports);

      // Detect data processing patterns
      const dataProcessingPatterns = this.detectDataProcessingPatterns(content, imports);

      const sourceData: PythonSourceData = {
        configType: "source-file",
        filePath,
        hasImports,
        hasIfMain,
        isPackageInit,
        imports,
        webFrameworks,
        cliPatterns,
        dataProcessingPatterns,
      };

      evidence.push({
        id: baseId,
        source: "python",
        type: hasIfMain ? "function" : hasImports ? "import" : "export",
        filePath,
        data: sourceData,
        metadata: {
          timestamp: Date.now(),
          fileSize: content.length,
        },
      });
    } catch (error) {
      console.warn("Failed to parse Python source:", error);
    }

    return evidence;
  }

  // ============================================================================
  // Private inference methods
  // ============================================================================

  private async inferFromPackageConfig(
    packageEvidence: Evidence,
    allEvidence: Evidence[],
    context: InferenceContext,
  ): Promise<InferredArtifact[]> {
    const packageData = packageEvidence.data as unknown as PythonPackageData;
    const classification = classifyPythonPackage(packageData);
    const artifactName = packageData.name || this.deriveNameFromPath(packageEvidence.filePath);
    const artifact = this.buildArtifactFromClassification({
      artifactName,
      artifactType: classification.artifactType,
      detectedType: classification.detectedType,
      reason: classification.reason,
      framework: classification.framework,
      description: packageData.description,
      filePath: packageEvidence.filePath,
      metadataExtras: {
        dependencies: packageData.dependencies,
        devDependencies: packageData.devDependencies,
        scripts: packageData.scripts,
        entryPoints: packageData.entryPoints,
      },
    });

    return [
      {
        artifact,
        provenance: this.createProvenance([packageEvidence]),
        relationships: [],
      },
    ];
  }

  private async inferFromSourceOnly(
    allEvidence: Evidence[],
    context: InferenceContext,
  ): Promise<InferredArtifact[]> {
    const sourceEvidence = allEvidence.filter((e) => e.data?.configType === "source-file");

    if (sourceEvidence.length === 0) return [];

    const sourceData = sourceEvidence.map((e) => e.data as unknown as PythonSourceData);
    const classification = classifyPythonSource(sourceData);
    const projectName = path.basename(context.projectRoot ?? process.cwd());
    const sourceFilePath = sourceEvidence[0]?.filePath ?? context.projectRoot ?? process.cwd();

    const artifact = this.buildArtifactFromClassification({
      artifactName: projectName,
      artifactType: classification.artifactType,
      detectedType: classification.detectedType,
      reason: classification.reason,
      framework: classification.framework,
      description: undefined,
      filePath: sourceFilePath,
      metadataExtras: {},
    });

    return [
      {
        artifact,
        provenance: this.createProvenance(sourceEvidence),
        relationships: [],
      },
    ];
  }

  private deriveNameFromPath(filePath: string): string {
    const basename = path.basename(path.dirname(filePath));
    return basename || "python-project";
  }

  private buildArtifactFromClassification(params: {
    artifactName: string;
    artifactType: ArtifactType;
    detectedType: string;
    reason: string;
    framework?: string;
    description?: string;
    filePath: string;
    metadataExtras: Record<string, unknown>;
  }) {
    const {
      artifactName,
      artifactType,
      detectedType,
      reason,
      framework,
      description,
      filePath,
      metadataExtras,
    } = params;

    const tags = new Set<string>(["python"]);
    if (artifactType === "binary") {
      tags.add("tool");
    } else if (artifactType === "service") {
      tags.add("service");
    } else if (artifactType === "frontend") {
      tags.add("frontend");
    } else {
      tags.add("module");
    }

    if (framework) {
      tags.add(framework);
    }

    const fallbackDescriptions: Record<ArtifactType, string> = {
      service: `Python web service: ${artifactName}`,
      binary: `Python CLI tool: ${artifactName}`,
      tool: `Python tool: ${artifactName}`,
      module: `Python module: ${artifactName}`,
      job: `Python job: ${artifactName}`,
      schema: `Python schema: ${artifactName}`,
      config: `Python config: ${artifactName}`,
      deployment: `Python deployment: ${artifactName}`,
      test: `Python tests: ${artifactName}`,
      frontend: `Python frontend app: ${artifactName}`,
      database: `Python database service: ${artifactName}`,
      cache: `Python cache service: ${artifactName}`,
      queue: `Python queue service: ${artifactName}`,
      proxy: `Python proxy: ${artifactName}`,
      monitor: `Python monitor: ${artifactName}`,
      auth: `Python auth service: ${artifactName}`,
      docs: `Python docs: ${artifactName}`,
      infrastructure: `Python infrastructure: ${artifactName}`,
    };

    const artifactDescription =
      description?.trim() ||
      fallbackDescriptions[artifactType] ||
      `Python component: ${artifactName}`;

    const fileName = path.basename(filePath);
    let manifest: string | undefined;
    if (fileName === "pyproject.toml") {
      manifest = "pyproject.toml";
    } else if (fileName === "setup.py") {
      manifest = "setup.py";
    } else if (fileName === "Pipfile") {
      manifest = "Pipfile";
    } else if (fileName === "requirements.txt") {
      manifest = "requirements.txt";
    }

    return {
      id: `python-${artifactType}-${artifactName}`,
      type: artifactType,
      name: artifactName,
      description: artifactDescription,
      tags: Array.from(tags),
      metadata: {
        sourceFile: filePath,
        root: path.dirname(filePath),
        ...(manifest ? { manifest } : {}),
        language: "python",
        framework,
        detectedType,
        classification: {
          source: "python-analysis",
          reason,
        },
        ...metadataExtras,
      },
    };
  }

  // ============================================================================
  // Helper methods
  // ============================================================================

  private extractImports(content: string): string[] {
    const imports: string[] = [];
    const lines = content.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();

      // import module
      const importMatch = trimmed.match(
        /^import\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)/,
      );
      if (importMatch) {
        imports.push(importMatch[1].split(".")[0]);
        continue;
      }

      // from module import ...
      const fromMatch = trimmed.match(
        /^from\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s+import/,
      );
      if (fromMatch) {
        imports.push(fromMatch[1].split(".")[0]);
      }
    }

    return [...new Set(imports)];
  }

  private detectWebFrameworks(content: string, imports: string[]): string[] {
    const webFrameworks = [
      "django",
      "flask",
      "fastapi",
      "tornado",
      "sanic",
      "starlette",
      "bottle",
      "falcon",
      "pyramid",
    ];
    return imports.filter((imp) => webFrameworks.includes(imp));
  }

  private detectCliPatterns(content: string, imports: string[]): string[] {
    const cliLibraries = ["click", "argparse", "typer", "fire", "docopt"];
    const patterns: string[] = [];

    // Check for CLI library imports
    patterns.push(...imports.filter((imp) => cliLibraries.includes(imp)));

    // Check for CLI patterns in code
    if (/if\s+__name__\s*==\s*['""]__main__['""]/.test(content)) {
      patterns.push("main_guard");
    }

    if (/sys\.argv/.test(content)) {
      patterns.push("argv_usage");
    }

    return patterns;
  }

  private detectDataProcessingPatterns(content: string, imports: string[]): string[] {
    const dataLibraries = [
      "pandas",
      "numpy",
      "scipy",
      "matplotlib",
      "seaborn",
      "plotly",
      "dask",
      "polars",
    ];
    return imports.filter((imp) => dataLibraries.includes(imp));
  }

  // Utility methods for parsing Python/TOML content
  private extractPythonStringField(content: string, field: string): string | undefined {
    const regex = new RegExp(`${field}\\s*=\\s*['"](.*?)['"]`);
    const match = content.match(regex);
    return match?.[1];
  }

  private extractPythonListField(content: string, field: string): string[] {
    const regex = new RegExp(`${field}\\s*=\\s*\\[(.*?)\\]`, "s");
    const match = content.match(regex);
    if (!match) return [];

    return match[1]
      .split(",")
      .map((item) => item.trim().replace(/['"]/g, ""))
      .filter((item) => item.length > 0);
  }

  private extractPythonDictField(content: string, field: string): Record<string, string[]> {
    // Simplified dict parsing - would need more robust implementation
    return {};
  }

  private extractTomlField(content: string | undefined, field: string): string | undefined {
    if (!content) return undefined;
    const regex = new RegExp(`${field}\\s*=\\s*['"](.*?)['"]`);
    const match = content.match(regex);
    return match?.[1];
  }

  private extractTomlArray(content: string | undefined, field: string): string[] {
    if (!content) return [];
    const regex = new RegExp(`${field}\\s*=\\s*\\[(.*?)\\]`, "s");
    const match = content.match(regex);
    if (!match) return [];

    return match[1]
      .split(",")
      .map((item) => item.trim().replace(/['"]/g, ""))
      .filter((item) => item.length > 0);
  }

  private extractTomlTable(content: string | undefined, field: string): Record<string, string> {
    if (!content) return {};
    // Simplified table parsing
    return {};
  }

  private extractTomlDependencies(content: string | undefined): string[] {
    if (!content) return [];
    const dependencies: string[] = [];
    const lines = content.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const eqIndex = trimmed.indexOf("=");
        if (eqIndex > 0) {
          const depName = trimmed.substring(0, eqIndex).trim();
          if (depName && /^[a-zA-Z_-]+$/.test(depName)) {
            dependencies.push(depName);
          }
        }
      }
    }

    return dependencies;
  }

  private extractTomlDevDependencies(content: string): string[] {
    const devMatch = content.match(
      /\[tool\.poetry\.group\.dev\.dependencies\]([\s\S]*?)(?=\n\[|\n$)/,
    );
    if (devMatch) {
      return this.extractTomlDependencies(devMatch[1]);
    }
    return [];
  }

  private convertToScripts(
    entryPoints: Record<string, any>,
    scripts: string[],
  ): Record<string, string> {
    const result: Record<string, string> = {};

    // Convert entry points
    if (entryPoints?.console_scripts) {
      Object.entries(entryPoints.console_scripts).forEach(([name, target]) => {
        result[name] = target as string;
      });
    }

    // Convert scripts array
    scripts.forEach((script) => {
      const name = path.basename(script, path.extname(script));
      result[name] = script;
    });

    return result;
  }

  private createProvenance(evidence: Evidence[]): Provenance {
    return {
      evidence: evidence.map((e) => e.id),
      plugins: ["python"],
      rules: ["package-config-analysis", "source-file-analysis"],
      timestamp: Date.now(),
      pipelineVersion: "1.0.0",
    };
  }
}

// Export the plugin instance
export const pythonPlugin = new PythonPlugin();
