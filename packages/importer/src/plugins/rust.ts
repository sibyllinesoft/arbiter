/**
 * Rust plugin with lightweight heuristics.
 *
 * Focused on a handful of strong signals that are simple to understand and
 * maintain: Cargo manifests, obvious CLI/web frameworks, and basic source
 * patterns. The goal is to surface useful artifacts without deep AST analysis.
 */

import * as path from "path";
import { parse } from "@iarna/toml";
import {
  type ArtifactType,
  type Evidence,
  type ImporterPlugin,
  type InferenceContext,
  type InferredArtifact,
  type ParseContext,
  type Provenance,
} from "../types";

// Heuristic dependency buckets ------------------------------------------------
const RUST_WEB_FRAMEWORKS = [
  "axum",
  "warp",
  "actix-web",
  "rocket",
  "tide",
  "gotham",
  "iron",
  "nickel",
  "tower-web",
  "salvo",
  "poem",
];

const RUST_CLI_FRAMEWORKS = ["clap", "structopt", "argh", "gumdrop"];
const RUST_JOB_FRAMEWORKS = ["tokio-cron-scheduler", "cron", "job-scheduler"];
const RUST_DATABASE_DRIVERS = [
  "sqlx",
  "diesel",
  "rusqlite",
  "postgres",
  "mysql",
  "mongodb",
  "redis",
];

interface CargoDependency {
  name: string;
  version: string;
  kind: "runtime" | "dev" | "build";
}

interface CargoBinaryDefinition {
  name: string;
  path?: string;
}

interface CargoEvidenceData extends Record<string, unknown> {
  configType: "cargo-toml";
  package?: {
    name?: string;
    version?: string;
    description?: string;
  };
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  buildDependencies: Record<string, string>;
  hasBinaries: boolean;
  hasLibrary: boolean;
  binaries: CargoBinaryDefinition[];
  fullCargo: Record<string, unknown>;
}

/** Type guard to check if data is CargoEvidenceData. */
function isCargoEvidenceData(data: Record<string, unknown>): data is CargoEvidenceData {
  const configType = data["configType"];
  return typeof configType === "string" && configType === "cargo-toml";
}

/** Importer plugin for Rust projects. Parses Cargo.toml and detects crate types. */
export class RustPlugin implements ImporterPlugin {
  name(): string {
    return "rust";
  }

  supports(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, "/");
    const fileName = path.basename(normalized);

    if (fileName === "Cargo.toml" || fileName === "Cargo.lock") {
      return true;
    }

    if (fileName.endsWith(".rs") && normalized.includes("/src/")) {
      return true;
    }

    return false;
  }

  async parse(filePath: string, fileContent?: string, context?: ParseContext): Promise<Evidence[]> {
    if (!fileContent) return [];

    const normalized = filePath.replace(/\\/g, "/");
    const fileName = path.basename(normalized);

    if (fileName === "Cargo.toml") {
      return this.parseCargoToml(normalized, fileContent, context);
    }

    if (fileName === "Cargo.lock") {
      return [
        {
          id: this.createEvidenceId(normalized, context),
          source: "rust",
          type: "config",
          filePath: normalized,
          data: { configType: "cargo-lock" },
          metadata: this.createMetadata(fileContent.length),
        },
      ];
    }

    if (normalized.includes("/src/") && fileName.endsWith(".rs")) {
      return this.parseRustSource(normalized, fileContent, context);
    }

    return [];
  }

  async infer(evidence: Evidence[], context: InferenceContext): Promise<InferredArtifact[]> {
    const rustConfigs = evidence.filter(
      (e) =>
        e.source === "rust" && e.type === "config" && (e.data as any).configType === "cargo-toml",
    );

    if (rustConfigs.length === 0) {
      return [];
    }

    const binaryDefinitions = evidence.filter(
      (e) =>
        e.source === "rust" &&
        e.type === "config" &&
        (e.data as any).configType === "binary-definition",
    );

    const artifacts: InferredArtifact[] = [];

    for (const cargoEvidence of rustConfigs) {
      artifacts.push(...this.inferFromCargoToml(cargoEvidence, binaryDefinitions, context));
    }

    return artifacts;
  }

  // ---------------------------------------------------------------------------
  // Parsing helpers
  // ---------------------------------------------------------------------------
  private parseCargoToml(filePath: string, content: string, context?: ParseContext): Evidence[] {
    let cargo: Record<string, any>;

    try {
      cargo = parse(content) as Record<string, any>;
    } catch (error) {
      console.warn("Rust plugin: failed to parse Cargo.toml", error);
      return [];
    }

    const runtimeDeps = this.extractDependencies(cargo.dependencies, "runtime");
    const devDeps = this.extractDependencies(cargo["dev-dependencies"], "dev");
    const buildDeps = this.extractDependencies(cargo["build-dependencies"], "build");
    const rawBin = cargo.bin ?? cargo.binaries ?? cargo["bin"];
    const binaries = this.extractBinaries(rawBin);
    const hasBinaries = Array.isArray(rawBin)
      ? rawBin.length > 0
      : Boolean(rawBin) || binaries.length > 0;

    const data: CargoEvidenceData = {
      configType: "cargo-toml",
      package: cargo.package ?? {},
      dependencies: this.dependenciesRecord(runtimeDeps),
      devDependencies: this.dependenciesRecord(devDeps),
      buildDependencies: this.dependenciesRecord(buildDeps),
      hasBinaries,
      hasLibrary: Boolean(cargo.lib),
      binaries,
      fullCargo: cargo,
    };

    const evidence: Evidence[] = [
      {
        id: this.createEvidenceId(filePath, context),
        source: "rust",
        type: "config",
        filePath,
        data,
        metadata: this.createMetadata(content.length),
      },
    ];

    for (const dep of [...runtimeDeps, ...devDeps, ...buildDeps]) {
      evidence.push({
        id: `${this.createEvidenceId(filePath, context)}#${dep.kind}-${dep.name}`,
        source: "rust",
        type: "dependency",
        filePath,
        data: {
          dependencyType: dep.kind,
          name: dep.name,
          version: dep.version,
        },
        metadata: this.createMetadata(0),
      });
    }

    for (const bin of binaries) {
      evidence.push({
        id: `${this.createEvidenceId(filePath, context)}#bin-${bin.name}`,
        source: "rust",
        type: "config",
        filePath,
        data: {
          configType: "binary-definition",
          binaryName: bin.name,
          binaryPath: bin.path,
        },
        metadata: this.createMetadata(0),
      });
    }

    return evidence;
  }

  private parseRustSource(filePath: string, content: string, context?: ParseContext): Evidence[] {
    const evidence: Evidence[] = [];
    const baseId = this.createEvidenceId(filePath, context);
    const metadata = this.createMetadata(content.length);

    if (/fn\s+main\s*\(/.test(content)) {
      evidence.push({
        id: `${baseId}#main`,
        source: "rust",
        type: "function",
        filePath,
        data: {
          functionType: "main",
          isEntryPoint: true,
        },
        metadata,
      });
    }

    if (/#\s*\[\s*tokio::main/.test(content)) {
      evidence.push({
        id: `${baseId}#async-main`,
        source: "rust",
        type: "function",
        filePath,
        data: {
          functionType: "async-main",
          runtime: "tokio",
        },
        metadata,
      });
    }

    const frameworkMatch = this.findFirstMatch(content, RUST_WEB_FRAMEWORKS);
    if (frameworkMatch) {
      evidence.push({
        id: `${baseId}#framework-${frameworkMatch}`,
        source: "rust",
        type: "config",
        filePath,
        data: {
          configType: "source-framework",
          framework: frameworkMatch,
        },
        metadata,
      });
    }

    return evidence;
  }

  // ---------------------------------------------------------------------------
  // Inference helpers
  // ---------------------------------------------------------------------------
  private inferFromCargoToml(
    cargoEvidence: Evidence,
    binaryEvidence: Evidence[],
    _context: InferenceContext,
  ): InferredArtifact[] {
    const cargoData = cargoEvidence.data;
    if (!isCargoEvidenceData(cargoData)) {
      return [];
    }

    const dependencyNames = this.getMergedDependencyNames(cargoData);
    const frameworks = this.detectFrameworks(dependencyNames);
    const binariesForCrate = binaryEvidence.filter((e) => e.filePath === cargoEvidence.filePath);
    const binaryInfo = this.extractBinaryInfo(binariesForCrate);

    const artifactType = this.determineRustArtifactType(
      cargoData,
      frameworks,
      binariesForCrate.length > 0,
    );
    const artifactName = this.resolveRustArtifactName(
      cargoData,
      cargoEvidence.filePath,
      binaryInfo,
    );
    const metadata = this.buildRustMetadata(
      cargoEvidence.filePath,
      dependencyNames,
      cargoData,
      frameworks,
      artifactType,
      binaryInfo,
    );
    const tags = this.buildRustTags(artifactType, cargoData.hasLibrary);
    const description = cargoData.package?.description || "Rust project";

    return [
      {
        artifact: {
          id: `rust-${artifactType}-${artifactName}`,
          type: artifactType,
          name: artifactName,
          description,
          tags,
          metadata,
        },
        provenance: {
          evidence: [cargoEvidence.id],
          plugins: ["rust"],
          rules: ["cargo-heuristics"],
          timestamp: Date.now(),
          pipelineVersion: "1.0.0",
        },
        relationships: [],
      },
    ];
  }

  /**
   * Merge all dependency types and return their names
   */
  private getMergedDependencyNames(data: CargoEvidenceData): string[] {
    const mergedDeps: Record<string, string> = {
      ...data.dependencies,
      ...data.devDependencies,
      ...data.buildDependencies,
    };
    return Object.keys(mergedDeps);
  }

  /**
   * Detect frameworks from dependencies
   */
  private detectFrameworks(dependencyNames: string[]) {
    return {
      web: this.findFirstMatch(dependencyNames, RUST_WEB_FRAMEWORKS),
      cli: this.findFirstMatch(dependencyNames, RUST_CLI_FRAMEWORKS),
      job: this.findFirstMatch(dependencyNames, RUST_JOB_FRAMEWORKS),
      database: this.findFirstMatch(dependencyNames, RUST_DATABASE_DRIVERS),
    };
  }

  /**
   * Extract binary info from evidence
   */
  private extractBinaryInfo(binariesForCrate: Evidence[]): {
    name?: string;
    path?: string;
  } {
    const binaryMatch = binariesForCrate.find((e) => {
      const data = e.data as Record<string, unknown>;
      return typeof data["binaryName"] === "string";
    });
    const binaryData = binaryMatch?.data as Record<string, unknown> | undefined;
    return {
      name: typeof binaryData?.binaryName === "string" ? binaryData.binaryName : undefined,
      path: typeof binaryData?.binaryPath === "string" ? binaryData.binaryPath : undefined,
    };
  }

  /**
   * Determine artifact type based on cargo data and detected frameworks
   */
  private determineRustArtifactType(
    data: CargoEvidenceData,
    frameworks: ReturnType<typeof this.detectFrameworks>,
    hasBinaryEvidence: boolean,
  ): ArtifactType {
    if (frameworks.web) {
      return "service";
    }
    if (frameworks.job) {
      return "job";
    }
    if (data.hasBinaries || hasBinaryEvidence) {
      return "binary";
    }
    return "package";
  }

  /**
   * Resolve the artifact name from binary info or package name
   */
  private resolveRustArtifactName(
    data: CargoEvidenceData,
    filePath: string,
    binaryInfo: { name?: string; path?: string },
  ): string {
    if (binaryInfo.name) {
      return binaryInfo.name;
    }
    return data.package?.name || path.basename(path.dirname(filePath));
  }

  /**
   * Build metadata for the Rust artifact
   */
  private buildRustMetadata(
    filePath: string,
    dependencyNames: string[],
    data: CargoEvidenceData,
    frameworks: ReturnType<typeof this.detectFrameworks>,
    artifactType: ArtifactType,
    binaryInfo: { name?: string; path?: string },
  ): Record<string, unknown> {
    const metadata: Record<string, unknown> = {
      sourceFile: filePath,
      root: path.dirname(filePath),
      manifest: "Cargo.toml",
      language: "rust",
      packageManager: "cargo",
      dependencies: dependencyNames,
    };

    if (frameworks.web) metadata.framework = frameworks.web;
    if (artifactType === "binary" && frameworks.cli) metadata.cliFramework = frameworks.cli;
    if (frameworks.job) metadata.jobFramework = frameworks.job;
    if (frameworks.database) metadata.databaseDriver = frameworks.database;
    if (data.package?.version) metadata.version = data.package.version;
    if (binaryInfo.path) metadata.entryPoint = binaryInfo.path;

    return metadata;
  }

  /**
   * Build tags for the Rust artifact
   */
  private buildRustTags(artifactType: ArtifactType, hasLibrary: boolean): string[] {
    const tags = new Set<string>(["rust"]);
    if (artifactType === "binary") tags.add("tool");
    if (artifactType === "service") tags.add("service");
    if (artifactType === "package" || hasLibrary) tags.add("package");
    if (artifactType === "job") tags.add("job");
    return Array.from(tags);
  }

  private extractDependencies(
    deps: Record<string, any> | undefined,
    kind: CargoDependency["kind"],
  ): CargoDependency[] {
    if (!deps) return [];

    return Object.entries(deps).map(([name, value]) => {
      if (typeof value === "string") {
        return { name, version: value, kind };
      }
      if (value && typeof value === "object" && typeof value.version === "string") {
        return { name, version: value.version, kind };
      }
      return { name, version: "workspace", kind };
    });
  }

  /**
   * Parse a single binary entry from cargo bin array
   */
  private parseBinaryEntry(entry: unknown): CargoBinaryDefinition | null {
    if (typeof entry === "string") {
      return { name: entry };
    }
    if (!entry || typeof entry !== "object") {
      return null;
    }
    const record = entry as Record<string, unknown>;
    if (typeof record.name !== "string") {
      return null;
    }
    return {
      name: record.name,
      path: typeof record.path === "string" ? record.path : undefined,
    };
  }

  /**
   * Parse binaries from an array format
   */
  private parseBinaryArray(binArray: unknown[]): CargoBinaryDefinition[] {
    return binArray
      .map((entry) => this.parseBinaryEntry(entry))
      .filter((value): value is CargoBinaryDefinition => value !== null);
  }

  /**
   * Parse binaries from an object format
   */
  private parseBinaryObject(binObject: Record<string, unknown>): CargoBinaryDefinition[] {
    const name = binObject.name;
    if (typeof name !== "string") {
      return [];
    }
    return [
      {
        name,
        path: typeof binObject.path === "string" ? binObject.path : undefined,
      },
    ];
  }

  private extractBinaries(binSection: unknown): CargoBinaryDefinition[] {
    if (!binSection) {
      return [];
    }
    if (Array.isArray(binSection)) {
      return this.parseBinaryArray(binSection);
    }
    if (typeof binSection === "object") {
      return this.parseBinaryObject(binSection as Record<string, unknown>);
    }
    return [];
  }

  private dependenciesRecord(deps: CargoDependency[]): Record<string, string> {
    return deps.reduce<Record<string, string>>((acc, dep) => {
      acc[dep.name] = dep.version;
      return acc;
    }, {});
  }

  private findFirstMatch(source: string | string[], candidates: string[]): string | undefined {
    const haystack = Array.isArray(source) ? source : [source];
    for (const item of haystack) {
      const lower = item.toLowerCase();
      const match = candidates.find((candidate) => lower.includes(candidate.toLowerCase()));
      if (match) return match;
    }
    return undefined;
  }

  private createEvidenceId(filePath: string, context?: { projectRoot?: string }): string {
    const root = context?.projectRoot ?? process.cwd();
    const relative = path.relative(root, filePath);
    return relative === "" ? filePath : relative;
  }

  private createMetadata(size: number) {
    return {
      timestamp: Date.now(),
      fileSize: size,
    };
  }
}

export const rustPlugin = new RustPlugin();
