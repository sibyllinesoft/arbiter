import * as path from "path";
import {
  type ArtifactType,
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
  devDependencies: string[];
  scripts: Record<string, string>;
  entryPoints?: Record<string, string>;
}

const PYTHON_WEB_FRAMEWORKS = ["django", "flask", "fastapi", "tornado", "sanic", "starlette"];
const PYTHON_FRONTEND_FILES = ["streamlit_app.py", "app.py", "dash_app.py", "gradio_app.py"];
const PYTHON_CLI_LIBRARIES = ["click", "typer", "argparse", "fire", "docopt"];

/** Importer plugin for Python projects. Parses pyproject.toml, setup.py, and requirements.txt. */
export class PythonPlugin implements ImporterPlugin {
  name(): string {
    return "python";
  }

  supports(filePath: string): boolean {
    const fileName = path.basename(filePath);
    return [
      "setup.py",
      "pyproject.toml",
      "requirements.txt",
      "Pipfile",
      "poetry.lock",
      "setup.cfg",
      "environment.yml",
      "conda.yml",
    ].includes(fileName);
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

  /**
   * Build inference context data for a single evidence item
   */
  private buildInferenceData(ev: Evidence, context: InferenceContext) {
    const pkg = ev.data as PythonPackageData;
    const projectRoot = context.projectRoot ?? context.fileIndex.root ?? "";
    const pkgDir = path.dirname(ev.filePath);
    const relativeDir = this.normalize(path.relative(projectRoot, pkgDir)) || ".";
    const dirCtx =
      context.directoryContexts.get(relativeDir) || context.directoryContexts.get(".") || undefined;

    const dependencies = [
      ...this.collectNormalizedDependencies(pkg.dependencies),
      ...this.collectNormalizedDependencies(pkg.devDependencies),
    ];

    return {
      pkg,
      projectRoot,
      pkgDir,
      relativeDir,
      dirCtx,
      dependencies,
      filePatterns: dirCtx?.filePatterns ?? [],
      hasDocker: Boolean(dirCtx?.hasDockerfile || dirCtx?.hasComposeService),
      dockerBuild: dirCtx?.dockerBuild,
    };
  }

  /**
   * Build metadata for the artifact
   */
  private buildPythonMetadata(
    ev: Evidence,
    data: ReturnType<typeof this.buildInferenceData>,
    classification: { type: ArtifactType; tags: string[] },
    framework: string | undefined,
  ): Record<string, unknown> {
    const metadata: Record<string, unknown> = {
      sourceFile: data.projectRoot ? path.relative(data.projectRoot, ev.filePath) : ev.filePath,
      root: data.relativeDir === "." ? "" : data.relativeDir,
      manifest: data.pkg.configType,
      language: "python",
      classification,
    };

    if (data.hasDocker) {
      metadata.dockerContext = data.relativeDir;
    }
    if (framework) {
      metadata.framework = framework;
    }
    if (data.dockerBuild) {
      metadata.buildContext = this.toRelative(data.projectRoot, data.dockerBuild.buildContext);
      metadata.dockerfilePath = this.toRelative(data.projectRoot, data.dockerBuild.dockerfile);
    }

    return metadata;
  }

  /**
   * Infer a single artifact from Python package evidence
   */
  private inferFromPythonEvidence(ev: Evidence, context: InferenceContext): InferredArtifact {
    const data = this.buildInferenceData(ev, context);
    const structuralSignals = this.detectStructuralSignals(data.filePatterns);

    const classification = context.classifier.classify({
      dependencies: data.dependencies,
      filePatterns: data.filePatterns,
      scripts: data.pkg.scripts ?? {},
      language: "python",
      hasDocker: data.hasDocker,
      hasBinaryEntry: this.hasConsoleEntry(data.pkg),
    });

    const artifactType = this.applyHeuristics(classification.type, structuralSignals);
    const framework = this.detectFramework(data.dependencies) ?? structuralSignals.framework;
    const metadata = this.buildPythonMetadata(ev, data, classification, framework);
    const artifactName = data.pkg.name || path.basename(data.pkgDir);

    return {
      artifact: {
        id: artifactName,
        type: artifactType,
        name: artifactName,
        description: data.pkg.description || `Python ${artifactType}`,
        tags: Array.from(new Set<string>([...classification.tags, "python", artifactType])),
        metadata,
      },
      provenance: {
        evidence: [ev.id],
        plugins: [this.name()],
        rules: ["manifest-classifier"],
        timestamp: Date.now(),
        pipelineVersion: "1.1.0",
      },
      relationships: [],
    };
  }

  async infer(evidence: Evidence[], context: InferenceContext): Promise<InferredArtifact[]> {
    const pythonEvidence = evidence.filter((e) => e.source === this.name() && e.type === "config");
    if (!pythonEvidence.length) return [];

    return pythonEvidence.map((ev) => this.inferFromPythonEvidence(ev, context));
  }

  // ---------- Parsing helpers ----------

  private parseSetupPy(filePath: string, content: string, evidenceId: string): Evidence[] {
    const name =
      this.extractPythonStringField(content, "name") || path.basename(path.dirname(filePath));
    const description = this.extractPythonStringField(content, "description");
    const dependencies = this.extractPythonListField(content, "install_requires");
    const extraRequires = this.extractPythonDictField(content, "extras_require");
    const devDependencies = Object.values(extraRequires)
      .flat()
      .filter((dep): dep is string => typeof dep === "string");
    const entryPoints = this.extractPythonDictField(content, "entry_points");
    const scripts = this.convertToScripts(entryPoints as any, []);

    const packageData: PythonPackageData = {
      configType: "setup.py",
      name,
      description,
      dependencies,
      devDependencies,
      scripts,
      entryPoints: entryPoints as any,
    };

    return [
      {
        id: evidenceId,
        source: this.name(),
        type: "config",
        filePath,
        data: packageData,
        metadata: { timestamp: Date.now(), fileSize: content.length },
      },
    ];
  }

  private parsePyprojectToml(filePath: string, content: string, evidenceId: string): Evidence[] {
    const projectMatch = content.match(/\[project\]([\s\S]*?)(?=\n\[|\n$)/);
    const poetryMatch = content.match(/\[tool\.poetry\]([\s\S]*?)(?=\n\[|\n$)/);

    const projectSection = projectMatch?.[1];
    const poetrySection = poetryMatch?.[1];

    const name =
      this.extractTomlField(projectSection, "name") ||
      this.extractTomlField(poetrySection, "name") ||
      path.basename(path.dirname(filePath));

    const description =
      this.extractTomlField(projectSection, "description") ||
      this.extractTomlField(poetrySection, "description");

    const dependencies =
      this.extractTomlArray(projectSection, "dependencies") ||
      this.extractTomlDependencies(poetrySection);
    const devDependencies = this.extractTomlDevDependencies(content);
    const scripts =
      this.extractTomlTable(projectSection, "scripts") ||
      this.extractTomlTable(poetrySection, "scripts") ||
      {};

    const packageData: PythonPackageData = {
      configType: "pyproject.toml",
      name,
      description,
      dependencies,
      devDependencies,
      scripts,
    };

    return [
      {
        id: evidenceId,
        source: this.name(),
        type: "config",
        filePath,
        data: packageData,
        metadata: { timestamp: Date.now(), fileSize: content.length },
      },
    ];
  }

  private parseRequirementsTxt(filePath: string, content: string, evidenceId: string): Evidence[] {
    const dependencies = content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && !line.startsWith("-"))
      .map((line) => line.split(/[>=<~!]/)[0].trim());

    const packageData: PythonPackageData = {
      configType: "requirements.txt",
      name: path.basename(path.dirname(filePath)),
      dependencies,
      devDependencies: [],
      scripts: {},
    };

    return [
      {
        id: evidenceId,
        source: this.name(),
        type: "config",
        filePath,
        data: packageData,
        metadata: { timestamp: Date.now(), fileSize: content.length },
      },
    ];
  }

  private parsePipfile(filePath: string, content: string, evidenceId: string): Evidence[] {
    const dependencies = this.extractTomlDependencies(
      content.match(/\[packages\]([\s\S]*?)(?=\n\[|\n$)/)?.[1],
    );
    const devDependencies = this.extractTomlDependencies(
      content.match(/\[dev-packages\]([\s\S]*?)(?=\n\[|\n$)/)?.[1],
    );

    const packageData: PythonPackageData = {
      configType: "Pipfile",
      name: path.basename(path.dirname(filePath)),
      dependencies,
      devDependencies,
      scripts: {},
    };

    return [
      {
        id: evidenceId,
        source: this.name(),
        type: "config",
        filePath,
        data: packageData,
        metadata: { timestamp: Date.now(), fileSize: content.length },
      },
    ];
  }

  // ---------- Classification helpers ----------

  private collectNormalizedDependencies(values: string[] | undefined): string[] {
    if (!values) return [];
    return values
      .map((value) => value?.toLowerCase?.() ?? value)
      .map((value) =>
        String(value)
          .replace(/[^a-z0-9_.-].*$/i, "")
          .replace(/_/g, "-"),
      )
      .filter(Boolean);
  }

  private detectFramework(dependencies: string[]): string | undefined {
    const depSet = new Set(dependencies.map((d) => d.toLowerCase()));
    const matched = PYTHON_WEB_FRAMEWORKS.find((fw) => depSet.has(fw));
    return matched;
  }

  private detectStructuralSignals(filePatterns: string[]) {
    const normalized = filePatterns.map((f) => f.toLowerCase());
    const hasManage = normalized.some((f) => f.endsWith("manage.py"));
    const hasWsgi = normalized.some((f) => f.endsWith("wsgi.py") || f.endsWith("asgi.py"));
    const hasFrontend = normalized.some((f) =>
      PYTHON_FRONTEND_FILES.some((needle) => f.endsWith(needle.toLowerCase())),
    );
    const hasCli = normalized.some((f) => f.endsWith("cli.py") || f.endsWith("main.py"));

    const framework =
      hasManage || hasWsgi ? "django-like" : hasFrontend ? "streamlit/dash" : undefined;

    return {
      framework,
      hasServiceSignals: hasManage || hasWsgi,
      hasFrontendSignals: hasFrontend,
      hasCliSignals: hasCli,
    };
  }

  private hasConsoleEntry(pkg: PythonPackageData): boolean {
    const entryPoints = pkg.entryPoints || {};
    const consoleScripts = (entryPoints as any)?.console_scripts;
    if (!consoleScripts) return false;
    if (Array.isArray(consoleScripts)) {
      return consoleScripts.length > 0;
    }
    if (typeof consoleScripts === "object") {
      return Object.keys(consoleScripts as Record<string, unknown>).length > 0;
    }
    return false;
  }

  private applyHeuristics(
    baseType: ArtifactType,
    signals: ReturnType<typeof this.detectStructuralSignals>,
  ): ArtifactType {
    if (signals.hasServiceSignals) return "service";
    if (signals.hasFrontendSignals) return "frontend";
    if (signals.hasCliSignals && baseType === "package") return "binary";
    return baseType;
  }

  // ---------- lightweight field extraction utilities ----------

  private extractPythonStringField(content: string, field: string): string | undefined {
    const match = content.match(new RegExp(`${field}\\s*=\\s*['"]([^'"]+)['"]`));
    return match?.[1];
  }

  private extractPythonListField(content: string, field: string): string[] {
    const match = content.match(new RegExp(`${field}\\s*=\\s*\\[([^\\]]*)\\]`));
    if (!match) return [];
    return match[1]
      .split(",")
      .map((item) => item.trim().replace(/^['"]|['"]$/g, ""))
      .filter(Boolean);
  }

  private extractPythonDictField(content: string, field: string): Record<string, unknown> {
    const match = content.match(new RegExp(`${field}\\s*=\\s*\\{([\\s\\S]*?)\\}`, "m"));
    if (!match) return {};
    const dictContent = match[1];
    const pairs = dictContent.split(",").map((pair) => pair.trim());
    const result: Record<string, unknown> = {};
    for (const pair of pairs) {
      const [key, value] = pair.split(":").map((item) => item?.trim());
      if (key && value) {
        result[key.replace(/^['"]|['"]$/g, "")] = value.replace(/^['"]|['"]$/g, "");
      }
    }
    return result;
  }

  private convertToScripts(
    entryPoints?: Record<string, unknown>,
    scripts?: string[],
  ): Record<string, string> {
    const entries =
      typeof entryPoints === "object" && entryPoints
        ? ((entryPoints as Record<string, Record<string, string>>).console_scripts ?? {})
        : {};

    const results: Record<string, string> = {};
    for (const [key, value] of Object.entries(entries)) {
      results[key] = String(value);
    }

    if (scripts) {
      scripts.forEach((script, idx) => {
        results[`script_${idx}`] = script;
      });
    }

    return results;
  }

  private extractTomlField(section: string | undefined, field: string): string | undefined {
    if (!section) return undefined;
    const match = section.match(new RegExp(`${field}\\s*=\\s*["']([^"']+)["']`));
    return match?.[1];
  }

  private extractTomlArray(section: string | undefined, field: string): string[] {
    if (!section) return [];
    const match = section.match(new RegExp(`${field}\\s*=\\s*\\[([^\\]]*)\\]`));
    if (!match) return [];
    return match[1]
      .split(",")
      .map((item) => item.trim().replace(/^['"]|['"]$/g, ""))
      .filter(Boolean);
  }

  private extractTomlTable(
    section: string | undefined,
    field: string,
  ): Record<string, string> | undefined {
    if (!section) return undefined;
    const match = section.match(
      new RegExp(`\\[${field.replace(".", "\\.")}\\]([\\s\\S]*?)(?=\\n\\[|$)`),
    );
    if (!match) return undefined;
    const tableContent = match[1];
    const entries = tableContent
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.includes("="));

    const table: Record<string, string> = {};
    for (const line of entries) {
      const [key, value] = line.split("=").map((part) => part.trim().replace(/^['"]|['"]$/g, ""));
      if (key && value) {
        table[key] = value;
      }
    }
    return table;
  }

  private extractTomlDependencies(section?: string): string[] {
    if (!section) return [];
    return section
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("[") && !line.startsWith("#"))
      .map((line) =>
        line
          .split("=")[0]
          .trim()
          .replace(/^['"]|['"]$/g, ""),
      )
      .filter(Boolean);
  }

  private extractTomlDevDependencies(content: string): string[] {
    const toolDeps = this.extractTomlDependencies(
      content.match(/\[tool\.poetry\.dev-dependencies\]([\s\S]*?)(?=\n\[|\n$)/)?.[1],
    );
    const hatchDeps = this.extractTomlDependencies(
      content.match(/\[tool\.hatch\.metadata\]([\s\S]*?)(?=\n\[|\n$)/)?.[1],
    );
    return [...toolDeps, ...hatchDeps];
  }

  private normalize(value: string): string {
    return value.replace(/\\/g, "/").replace(/^\.\//, "");
  }

  private toRelative(projectRoot: string, abs?: string): string | undefined {
    if (!abs) return undefined;
    if (!projectRoot) return abs;
    return this.normalize(path.relative(projectRoot, abs));
  }
}

export const pythonPlugin = new PythonPlugin();
