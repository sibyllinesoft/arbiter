import * as path from "path";
import {
  type Evidence,
  type ImporterPlugin,
  type InferenceContext,
  type InferredArtifact,
  type ParseContext,
} from "../types";

interface PythonPackageData extends Record<string, unknown> {
  configType: string;
  name: string;
  version?: string;
  description?: string;
  dependencies: string[];
}

/**
 * Simplified importer plugin for Python projects.
 * Parses pyproject.toml, setup.py, and requirements.txt.
 * Outputs Package artifacts. Does NOT try to classify - that's for agents.
 */
export class PythonPlugin implements ImporterPlugin {
  name(): string {
    return "python";
  }

  supports(filePath: string): boolean {
    const fileName = path.basename(filePath);
    return ["setup.py", "pyproject.toml", "requirements.txt", "Pipfile"].includes(fileName);
  }

  async parse(filePath: string, fileContent?: string, context?: ParseContext): Promise<Evidence[]> {
    if (!fileContent) return [];

    const fileName = path.basename(filePath);
    const baseId = path.relative(context?.projectRoot ?? process.cwd(), filePath);

    try {
      if (fileName === "setup.py") {
        return this.parseSetupPy(filePath, fileContent, baseId);
      }
      if (fileName === "pyproject.toml") {
        return this.parsePyprojectToml(filePath, fileContent, baseId);
      }
      if (fileName === "requirements.txt") {
        return this.parseRequirementsTxt(filePath, fileContent, baseId);
      }
      if (fileName === "Pipfile") {
        return this.parsePipfile(filePath, fileContent, baseId);
      }
    } catch {
      return [];
    }

    return [];
  }

  async infer(evidence: Evidence[], context: InferenceContext): Promise<InferredArtifact[]> {
    const pythonEvidence = evidence.filter((e) => e.source === this.name() && e.type === "config");
    if (!pythonEvidence.length) return [];

    const artifacts: InferredArtifact[] = [];

    for (const ev of pythonEvidence) {
      const artifact = this.inferFromPythonEvidence(ev, context);
      if (artifact) {
        artifacts.push(artifact);
      }
    }

    return artifacts;
  }

  /**
   * Infer a Package artifact from Python evidence.
   * Always outputs "package" - agents determine subtype later.
   */
  private inferFromPythonEvidence(
    ev: Evidence,
    context: InferenceContext,
  ): InferredArtifact | null {
    const pkg = ev.data as PythonPackageData;
    const projectRoot = context.projectRoot ?? context.fileIndex.root ?? "";
    const pkgDir = path.dirname(ev.filePath);
    const relativeDir = this.normalize(path.relative(projectRoot, pkgDir)) || ".";

    const artifactName = pkg.name || path.basename(pkgDir);
    const framework = this.detectFramework(pkg.dependencies);

    const metadata: Record<string, unknown> = {
      sourceFile: projectRoot ? path.relative(projectRoot, ev.filePath) : ev.filePath,
      root: relativeDir === "." ? "" : relativeDir,
      manifest: pkg.configType,
      language: "python",
    };

    if (framework) {
      metadata.framework = framework;
    }

    return {
      artifact: {
        id: artifactName,
        type: "package",
        name: artifactName,
        description: pkg.description || "Python package",
        tags: ["python"],
        metadata,
      },
      provenance: {
        evidence: [ev.id],
        plugins: [this.name()],
        rules: ["manifest-parser"],
        timestamp: Date.now(),
        pipelineVersion: "2.0.0",
      },
      relationships: [],
    };
  }

  /**
   * Detect framework from dependencies (informational only)
   */
  private detectFramework(dependencies: string[]): string | undefined {
    const depsLower = dependencies.map((d) => this.extractPackageName(d).toLowerCase());

    const frameworkMap: [string[], string][] = [
      [["django"], "django"],
      [["fastapi"], "fastapi"],
      [["flask"], "flask"],
      [["tornado"], "tornado"],
      [["sanic"], "sanic"],
      [["starlette"], "starlette"],
      [["streamlit"], "streamlit"],
      [["gradio"], "gradio"],
      [["click", "typer"], "cli"],
    ];

    for (const [signals, framework] of frameworkMap) {
      if (signals.some((s) => depsLower.includes(s))) {
        return framework;
      }
    }

    return undefined;
  }

  // ---------- Parsing helpers ----------

  private parseSetupPy(filePath: string, content: string, evidenceId: string): Evidence[] {
    const name =
      this.extractPythonStringField(content, "name") || path.basename(path.dirname(filePath));
    const description = this.extractPythonStringField(content, "description");
    const dependencies = this.extractPythonListField(content, "install_requires");

    return [
      {
        id: evidenceId,
        source: this.name(),
        type: "config",
        filePath,
        data: {
          configType: "setup.py",
          name,
          description,
          dependencies,
        } as PythonPackageData,
        metadata: {
          timestamp: Date.now(),
          fileSize: content.length,
        },
      },
    ];
  }

  private parsePyprojectToml(filePath: string, content: string, evidenceId: string): Evidence[] {
    // Simple TOML parsing
    const nameMatch = content.match(/name\s*=\s*["']([^"']+)["']/);
    const descMatch = content.match(/description\s*=\s*["']([^"']+)["']/);
    const name = nameMatch?.[1] || path.basename(path.dirname(filePath));
    const description = descMatch?.[1];

    // Extract dependencies from [project.dependencies] or [tool.poetry.dependencies]
    const dependencies = this.extractTomlDependencies(content);

    return [
      {
        id: evidenceId,
        source: this.name(),
        type: "config",
        filePath,
        data: {
          configType: "pyproject.toml",
          name,
          description,
          dependencies,
        } as PythonPackageData,
        metadata: {
          timestamp: Date.now(),
          fileSize: content.length,
        },
      },
    ];
  }

  private parseRequirementsTxt(filePath: string, content: string, evidenceId: string): Evidence[] {
    const dependencies = content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && !line.startsWith("-"));

    const name = path.basename(path.dirname(filePath));

    return [
      {
        id: evidenceId,
        source: this.name(),
        type: "config",
        filePath,
        data: {
          configType: "requirements.txt",
          name,
          dependencies,
        } as PythonPackageData,
        metadata: {
          timestamp: Date.now(),
          fileSize: content.length,
        },
      },
    ];
  }

  private parsePipfile(filePath: string, content: string, evidenceId: string): Evidence[] {
    // Simple Pipfile parsing - extract package names from [packages] section
    const dependencies: string[] = [];
    const lines = content.split("\n");
    let inPackages = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === "[packages]") {
        inPackages = true;
        continue;
      }
      if (trimmed.startsWith("[") && trimmed !== "[packages]") {
        inPackages = false;
        continue;
      }
      if (inPackages && trimmed && !trimmed.startsWith("#")) {
        const match = trimmed.match(/^([a-zA-Z0-9_-]+)/);
        if (match) {
          dependencies.push(match[1]);
        }
      }
    }

    const name = path.basename(path.dirname(filePath));

    return [
      {
        id: evidenceId,
        source: this.name(),
        type: "config",
        filePath,
        data: {
          configType: "Pipfile",
          name,
          dependencies,
        } as PythonPackageData,
        metadata: {
          timestamp: Date.now(),
          fileSize: content.length,
        },
      },
    ];
  }

  private extractPythonStringField(content: string, fieldName: string): string | undefined {
    const pattern = new RegExp(`${fieldName}\\s*=\\s*["']([^"']+)["']`);
    const match = content.match(pattern);
    return match?.[1];
  }

  private extractPythonListField(content: string, fieldName: string): string[] {
    const pattern = new RegExp(`${fieldName}\\s*=\\s*\\[([^\\]]+)\\]`, "s");
    const match = content.match(pattern);
    if (!match) return [];

    return match[1]
      .split(",")
      .map((item) => item.trim().replace(/["']/g, ""))
      .filter(Boolean);
  }

  private extractTomlDependencies(content: string): string[] {
    const dependencies: string[] = [];

    // Extract from [project.dependencies] array
    const projectDepsMatch = content.match(/\[project\][\s\S]*?dependencies\s*=\s*\[([\s\S]*?)\]/);
    if (projectDepsMatch) {
      const deps = projectDepsMatch[1]
        .split(",")
        .map((d) => d.trim().replace(/["']/g, ""))
        .filter(Boolean);
      dependencies.push(...deps);
    }

    // Extract from [tool.poetry.dependencies] section
    const poetryMatch = content.match(/\[tool\.poetry\.dependencies\]([\s\S]*?)(?:\[|$)/);
    if (poetryMatch) {
      const lines = poetryMatch[1].split("\n");
      for (const line of lines) {
        const match = line.match(/^([a-zA-Z0-9_-]+)\s*=/);
        if (match && match[1] !== "python") {
          dependencies.push(match[1]);
        }
      }
    }

    return dependencies;
  }

  private extractPackageName(dep: string): string {
    // Extract package name from dependency spec like "django>=4.0" or "flask[async]"
    const match = dep.match(/^([a-zA-Z0-9_-]+)/);
    return match?.[1] || dep;
  }

  private normalize(value: string): string {
    return value.replace(/\\/g, "/").replace(/^\.\//, "");
  }
}

export const pythonPlugin = new PythonPlugin();
