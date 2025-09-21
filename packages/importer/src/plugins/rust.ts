/**
 * Rust Plugin for Brownfield Detection
 *
 * Comprehensive plugin for detecting Rust artifacts including binaries, libraries,
 * services, and jobs. Analyzes Cargo.toml, source files, and dependency patterns
 * to infer application architecture.
 */

import * as path from "path";
import {
  BinaryArtifact,
  ConfidenceScore,
  Evidence,
  ImporterPlugin,
  InferenceContext,
  InferredArtifact,
  JobArtifact,
  LibraryArtifact,
  ParseContext,
  Provenance,
  ServiceArtifact,
} from "../types.js";

// ============================================================================
// TOML Parser - Simple implementation for Cargo.toml parsing
// ============================================================================

interface CargoToml {
  package?: {
    name?: string;
    version?: string;
    description?: string;
    authors?: string[];
    edition?: string;
  };
  bin?: Array<{
    name: string;
    path?: string;
  }>;
  lib?: {
    name?: string;
    path?: string;
    "crate-type"?: string[];
  };
  dependencies?: Record<string, any>;
  "dev-dependencies"?: Record<string, any>;
  "build-dependencies"?: Record<string, any>;
  workspace?: {
    members?: string[];
  };
}

/**
 * Simple TOML parser focused on Cargo.toml structure
 */
function parseCargoToml(content: string): CargoToml {
  const result: CargoToml = {};
  const lines = content.split("\n");
  let currentSection: string[] = [];
  let currentObject: any = result;
  let inArray = false;
  let arrayKey = "";

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Handle section headers [section] or [section.subsection]
    const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].split(".");
      currentObject = result;

      // Navigate to the correct nested object
      for (const section of currentSection) {
        if (!currentObject[section]) {
          currentObject[section] = {};
        }
        currentObject = currentObject[section];
      }
      inArray = false;
      continue;
    }

    // Handle array continuation
    if (inArray) {
      const arrayMatch = trimmed.match(/^"([^"]+)"(?:,|$)/);
      if (arrayMatch) {
        currentObject[arrayKey].push(arrayMatch[1]);
        continue;
      } else if (trimmed === "]") {
        inArray = false;
        continue;
      }
    }

    // Handle key-value pairs
    const kvMatch = trimmed.match(/^([^=]+)\s*=\s*(.+)$/);
    if (kvMatch) {
      const key = kvMatch[1].trim();
      const value = kvMatch[2].trim();

      // Handle different value types
      if (value.startsWith("[") && value.endsWith("]")) {
        // Array value on single line
        const arrayContent = value.slice(1, -1).trim();
        if (arrayContent) {
          currentObject[key] = arrayContent.split(",").map((v) => v.trim().replace(/"/g, ""));
        } else {
          currentObject[key] = [];
        }
      } else if (value.startsWith("[")) {
        // Multi-line array
        inArray = true;
        arrayKey = key;
        currentObject[key] = [];
        const firstElement = value.slice(1).trim();
        if (firstElement && firstElement !== "") {
          const elementMatch = firstElement.match(/^"([^"]+)"(?:,|$)/);
          if (elementMatch) {
            currentObject[key].push(elementMatch[1]);
          }
        }
      } else if (value.startsWith('"') && value.endsWith('"')) {
        // String value
        currentObject[key] = value.slice(1, -1);
      } else if (value === "true" || value === "false") {
        // Boolean value
        currentObject[key] = value === "true";
      } else if (/^\d+(\.\d+)?$/.test(value)) {
        // Numeric value
        currentObject[key] = value.includes(".") ? parseFloat(value) : parseInt(value);
      } else if (value.startsWith("{") && value.endsWith("}")) {
        // Inline table - simplified parsing
        currentObject[key] = {};
      } else {
        // Default to string
        currentObject[key] = value.replace(/"/g, "");
      }
    }
  }

  return result;
}

// ============================================================================
// Rust Framework Detection
// ============================================================================

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

const RUST_HTTP_CLIENTS = ["reqwest", "hyper", "surf", "ureq", "curl"];

const RUST_DATABASE_DRIVERS = [
  "sqlx",
  "diesel",
  "rusqlite",
  "postgres",
  "mysql",
  "mongodb",
  "redis",
  "sled",
  "rocksdb",
];

const RUST_ASYNC_RUNTIMES = ["tokio", "async-std", "smol"];

const RUST_CLI_FRAMEWORKS = ["clap", "structopt", "argh", "gumdrop"];

const RUST_JOB_FRAMEWORKS = ["tokio-cron-scheduler", "cron", "job-scheduler"];

// ============================================================================
// Types for structured evidence data
// ============================================================================

interface CargoPackageData {
  configType: string;
  package: {
    name: string;
    version?: string;
    description?: string;
  };
  hasBinaries: boolean;
  hasLibrary: boolean;
  dependencies: Record<string, any>;
  devDependencies: Record<string, any>;
  buildDependencies: Record<string, any>;
}

interface BinaryDefinitionData {
  configType: string;
  binaryName: string;
  binaryPath: string;
}

// ============================================================================
// Main Plugin Implementation
// ============================================================================

export class RustPlugin implements ImporterPlugin {
  name(): string {
    return "rust";
  }

  supports(filePath: string, fileContent?: string): boolean {
    const fileName = path.basename(filePath);
    const extension = path.extname(filePath);
    const dirName = path.dirname(filePath);

    // Support Cargo files
    if (fileName === "Cargo.toml" || fileName === "Cargo.lock") {
      return true;
    }

    // Support Rust source files in conventional locations
    if (extension === ".rs") {
      return (
        fileName === "main.rs" ||
        fileName === "lib.rs" ||
        fileName === "build.rs" ||
        dirName.includes("src") ||
        dirName.includes("bin") ||
        dirName.includes("examples")
      );
    }

    return false;
  }

  async parse(filePath: string, fileContent?: string, context?: ParseContext): Promise<Evidence[]> {
    if (!fileContent) return [];

    const evidence: Evidence[] = [];
    const fileName = path.basename(filePath);
    const baseId = `rust-${path.relative(context?.projectRoot || "", filePath)}`;

    try {
      if (fileName === "Cargo.toml") {
        evidence.push(...(await this.parseCargoToml(filePath, fileContent, baseId)));
      } else if (fileName === "Cargo.lock") {
        evidence.push(...(await this.parseCargoLock(filePath, fileContent, baseId)));
      } else if (path.extname(filePath) === ".rs") {
        evidence.push(...(await this.parseRustSource(filePath, fileContent, baseId)));
      }
    } catch (error) {
      // Log error but don't fail the entire parse
      console.warn(`Rust plugin failed to parse ${filePath}:`, error);
    }

    return evidence;
  }

  async infer(evidence: Evidence[], context: InferenceContext): Promise<InferredArtifact[]> {
    const rustEvidence = evidence.filter((e) => e.source === "rust");
    if (rustEvidence.length === 0) return [];

    const artifacts: InferredArtifact[] = [];

    try {
      // Infer artifacts from Cargo.toml evidence
      const cargoEvidence = rustEvidence.filter(
        (e) => e.type === "config" && e.data.configType === "cargo-toml",
      );
      for (const cargo of cargoEvidence) {
        artifacts.push(...(await this.inferFromCargoToml(cargo, rustEvidence, context)));
      }

      // Infer additional artifacts from source file evidence
      artifacts.push(...(await this.inferFromSourceFiles(rustEvidence, context)));
    } catch (error) {
      console.warn("Rust plugin inference failed:", error);
    }

    return artifacts;
  }

  // ============================================================================
  // Private parsing methods
  // ============================================================================

  private async parseCargoToml(
    filePath: string,
    content: string,
    baseId: string,
  ): Promise<Evidence[]> {
    const evidence: Evidence[] = [];

    try {
      const cargo = parseCargoToml(content);

      // Package information
      if (cargo.package) {
        evidence.push({
          id: `${baseId}-package`,
          source: "rust",
          type: "config",
          filePath,
          data: {
            configType: "cargo-toml",
            package: cargo.package,
            hasBinaries: Boolean(cargo.bin?.length),
            hasLibrary: Boolean(cargo.lib),
            dependencies: cargo.dependencies || {},
            devDependencies: cargo["dev-dependencies"] || {},
            buildDependencies: cargo["build-dependencies"] || {},
          },
          confidence: 0.95,
          metadata: {
            timestamp: Date.now(),
            fileSize: content.length,
          },
        });
      }

      // Binary definitions
      if (cargo.bin) {
        for (const bin of cargo.bin) {
          evidence.push({
            id: `${baseId}-bin-${bin.name}`,
            source: "rust",
            type: "config",
            filePath,
            data: {
              configType: "binary-definition",
              binaryName: bin.name,
              binaryPath: bin.path || `src/bin/${bin.name}.rs`,
            },
            confidence: 0.9,
            metadata: {
              timestamp: Date.now(),
              fileSize: content.length,
            },
          });
        }
      }

      // Library definition
      if (cargo.lib) {
        evidence.push({
          id: `${baseId}-lib`,
          source: "rust",
          type: "config",
          filePath,
          data: {
            configType: "library-definition",
            libraryName: cargo.lib.name || cargo.package?.name,
            libraryPath: cargo.lib.path || "src/lib.rs",
            crateTypes: cargo.lib["crate-type"] || ["lib"],
          },
          confidence: 0.9,
          metadata: {
            timestamp: Date.now(),
            fileSize: content.length,
          },
        });
      }

      // Dependency analysis
      const allDeps = {
        ...cargo.dependencies,
        ...cargo["dev-dependencies"],
        ...cargo["build-dependencies"],
      };

      for (const [depName, depSpec] of Object.entries(allDeps)) {
        evidence.push({
          id: `${baseId}-dep-${depName}`,
          source: "rust",
          type: "dependency",
          filePath,
          data: {
            dependencyName: depName,
            dependencySpec: depSpec,
            framework: this.classifyFramework(depName),
          },
          confidence: 0.8,
          metadata: {
            timestamp: Date.now(),
            fileSize: content.length,
          },
        });
      }
    } catch (error) {
      console.warn("Failed to parse Cargo.toml:", error);
    }

    return evidence;
  }

  private async parseCargoLock(
    filePath: string,
    content: string,
    baseId: string,
  ): Promise<Evidence[]> {
    const evidence: Evidence[] = [];

    // Extract package information from Cargo.lock (simplified)
    const packageMatches = content.match(/\[\[package\]\]\s*name\s*=\s*"([^"]+)"/g);
    if (packageMatches) {
      for (const match of packageMatches) {
        const nameMatch = match.match(/name\s*=\s*"([^"]+)"/);
        if (nameMatch) {
          evidence.push({
            id: `${baseId}-lock-${nameMatch[1]}`,
            source: "rust",
            type: "dependency",
            filePath,
            data: {
              dependencyName: nameMatch[1],
              locked: true,
            },
            confidence: 0.7,
            metadata: {
              timestamp: Date.now(),
              fileSize: content.length,
            },
          });
        }
      }
    }

    return evidence;
  }

  private async parseRustSource(
    filePath: string,
    content: string,
    baseId: string,
  ): Promise<Evidence[]> {
    const evidence: Evidence[] = [];
    const fileName = path.basename(filePath);

    // Detect main function (entry point)
    if (content.includes("fn main()") || content.includes("fn main(")) {
      evidence.push({
        id: `${baseId}-main`,
        source: "rust",
        type: "function",
        filePath,
        data: {
          functionType: "main",
          isEntryPoint: true,
        },
        confidence: 0.95,
        metadata: {
          timestamp: Date.now(),
          fileSize: content.length,
        },
      });
    }

    // Detect async main (async runtime usage)
    if (content.includes("#[tokio::main]") || content.includes("#[async_std::main]")) {
      evidence.push({
        id: `${baseId}-async-main`,
        source: "rust",
        type: "function",
        filePath,
        data: {
          functionType: "async-main",
          runtime: content.includes("#[tokio::main]") ? "tokio" : "async-std",
        },
        confidence: 0.9,
        metadata: {
          timestamp: Date.now(),
          fileSize: content.length,
        },
      });
    }

    // Detect HTTP server setup patterns
    const httpPatterns = [
      /axum::Router/,
      /warp::Filter/,
      /actix_web::App/,
      /rocket::launch/,
      /tide::Server/,
    ];

    for (const pattern of httpPatterns) {
      if (pattern.test(content)) {
        const framework = pattern.source.match(/(\w+)::/)?.[1] || "unknown";
        evidence.push({
          id: `${baseId}-http-${framework}`,
          source: "rust",
          type: "config",
          filePath,
          data: {
            configType: "http-server",
            framework,
          },
          confidence: 0.85,
          metadata: {
            timestamp: Date.now(),
            fileSize: content.length,
          },
        });
      }
    }

    // Detect port binding
    const portMatches = content.match(/(?:bind|listen)\s*\(\s*["']([^"']*:(\d+))["']\)/g);
    if (portMatches) {
      for (const match of portMatches) {
        const portMatch = match.match(/:(\d+)/);
        if (portMatch) {
          evidence.push({
            id: `${baseId}-port-${portMatch[1]}`,
            source: "rust",
            type: "config",
            filePath,
            data: {
              configType: "port-binding",
              port: parseInt(portMatch[1]),
            },
            confidence: 0.8,
            metadata: {
              timestamp: Date.now(),
              fileSize: content.length,
            },
          });
        }
      }
    }

    // Detect library exports
    if (fileName === "lib.rs" || content.includes("pub mod ") || content.includes("pub fn ")) {
      evidence.push({
        id: `${baseId}-library`,
        source: "rust",
        type: "export",
        filePath,
        data: {
          exportType: "library",
          hasPublicApi: true,
        },
        confidence: 0.8,
        metadata: {
          timestamp: Date.now(),
          fileSize: content.length,
        },
      });
    }

    return evidence;
  }

  // ============================================================================
  // Private inference methods
  // ============================================================================

  private async inferFromCargoToml(
    cargoEvidence: Evidence,
    allEvidence: Evidence[],
    context: InferenceContext,
  ): Promise<InferredArtifact[]> {
    const artifacts: InferredArtifact[] = [];
    const cargoData = cargoEvidence.data as unknown as CargoPackageData;

    // Infer library artifact
    if (cargoData.hasLibrary) {
      const libArtifact: LibraryArtifact = {
        id: `rust-lib-${cargoData.package.name}`,
        type: "library",
        name: cargoData.package.name,
        description: cargoData.package.description || `Rust library: ${cargoData.package.name}`,
        tags: ["rust", "library"],
        metadata: {
          language: "rust",
          packageManager: "cargo",
          version: cargoData.package.version,
          publicApi: this.extractPublicApi(allEvidence),
          dependencies: Object.keys(cargoData.dependencies || {}),
        },
      };

      artifacts.push({
        artifact: libArtifact,
        confidence: this.calculateConfidence([cargoEvidence], 0.9),
        provenance: this.createProvenance([cargoEvidence]),
        relationships: [],
      });
    }

    // Infer binary artifacts
    if (cargoData.hasBinaries) {
      const binEvidence = allEvidence.filter(
        (e) => e.data.configType === "binary-definition" && e.filePath === cargoEvidence.filePath,
      );

      for (const binEv of binEvidence) {
        const isCli = this.hasCliFramework(cargoData.dependencies || {});
        const isService = this.hasWebFramework(cargoData.dependencies || {});
        const isJob = this.hasJobFramework(cargoData.dependencies || {});

        if (isService) {
          artifacts.push(...(await this.createServiceArtifact(binEv, cargoData, allEvidence)));
        } else if (isJob) {
          artifacts.push(...(await this.createJobArtifact(binEv, cargoData, allEvidence)));
        } else {
          artifacts.push(
            ...(await this.createBinaryArtifact(binEv, cargoData, allEvidence, isCli)),
          );
        }
      }
    }

    // Infer from main.rs if no explicit binaries
    if (!cargoData.hasBinaries) {
      const mainEvidence = allEvidence.find(
        (e) => e.data.functionType === "main" && e.filePath.endsWith("main.rs"),
      );

      if (mainEvidence) {
        const isService = this.hasWebFramework(cargoData.dependencies || {});
        const isJob = this.hasJobFramework(cargoData.dependencies || {});

        if (isService) {
          artifacts.push(
            ...(await this.createServiceFromMain(mainEvidence, cargoData, allEvidence)),
          );
        } else if (isJob) {
          artifacts.push(...(await this.createJobFromMain(mainEvidence, cargoData, allEvidence)));
        } else {
          artifacts.push(
            ...(await this.createBinaryFromMain(mainEvidence, cargoData, allEvidence)),
          );
        }
      }
    }

    return artifacts;
  }

  private async inferFromSourceFiles(
    evidence: Evidence[],
    context: InferenceContext,
  ): Promise<InferredArtifact[]> {
    const artifacts: InferredArtifact[] = [];

    // Look for standalone binaries in src/bin/
    const binFiles = evidence.filter(
      (e) => e.filePath.includes("src/bin/") && e.data.functionType === "main",
    );

    for (const binFile of binFiles) {
      const binName = path.basename(binFile.filePath, ".rs");
      const artifact: BinaryArtifact = {
        id: `rust-bin-${binName}`,
        type: "binary",
        name: binName,
        description: `Rust binary: ${binName}`,
        tags: ["rust", "binary"],
        metadata: {
          language: "rust",
          entryPoint: binFile.filePath,
          arguments: [],
          environmentVariables: [],
          dependencies: [],
        },
      };

      artifacts.push({
        artifact,
        confidence: this.calculateConfidence([binFile], 0.7),
        provenance: this.createProvenance([binFile]),
        relationships: [],
      });
    }

    return artifacts;
  }

  // ============================================================================
  // Artifact creation helpers
  // ============================================================================

  private async createServiceArtifact(
    binEvidence: Evidence,
    cargoData: CargoPackageData,
    allEvidence: Evidence[],
  ): Promise<InferredArtifact[]> {
    const binData = binEvidence.data as unknown as BinaryDefinitionData;
    const framework = this.detectWebFramework(cargoData.dependencies || {});
    const portEvidence = allEvidence.find((e) => e.data.configType === "port-binding");
    const port = portEvidence?.data.port || 8080;

    const serviceArtifact: ServiceArtifact = {
      id: `rust-service-${binData.binaryName}`,
      type: "service",
      name: binData.binaryName,
      description: `Rust web service: ${binData.binaryName}`,
      tags: ["rust", "service", "web", framework].filter(Boolean),
      metadata: {
        language: "rust",
        framework,
        port: typeof port === "number" ? port : 8080,
        basePath: "/",
        environmentVariables: [],
        dependencies: this.extractServiceDependencies(cargoData.dependencies || {}),
        endpoints: [], // Would need deeper analysis to extract
        healthCheck: {
          path: "/health",
          expectedStatusCode: 200,
          timeoutMs: 5000,
          intervalSeconds: 30,
        },
      },
    };

    return [
      {
        artifact: serviceArtifact,
        confidence: this.calculateConfidence([binEvidence], 0.85),
        provenance: this.createProvenance([binEvidence]),
        relationships: [],
      },
    ];
  }

  private async createJobArtifact(
    binEvidence: Evidence,
    cargoData: CargoPackageData,
    allEvidence: Evidence[],
  ): Promise<InferredArtifact[]> {
    const binData = binEvidence.data as unknown as BinaryDefinitionData;
    const scheduler = this.detectJobScheduler(cargoData.dependencies || {});

    const jobArtifact: JobArtifact = {
      id: `rust-job-${binData.binaryName}`,
      type: "job",
      name: binData.binaryName,
      description: `Rust background job: ${binData.binaryName}`,
      tags: ["rust", "job", "background"],
      metadata: {
        language: "rust",
        scheduler,
        entryPoint: binData.binaryPath,
        environmentVariables: [],
        dependencies: Object.keys(cargoData.dependencies || {}),
      },
    };

    return [
      {
        artifact: jobArtifact,
        confidence: this.calculateConfidence([binEvidence], 0.8),
        provenance: this.createProvenance([binEvidence]),
        relationships: [],
      },
    ];
  }

  private async createBinaryArtifact(
    binEvidence: Evidence,
    cargoData: CargoPackageData,
    allEvidence: Evidence[],
    isCli: boolean,
  ): Promise<InferredArtifact[]> {
    const binData = binEvidence.data as unknown as BinaryDefinitionData;

    const binaryArtifact: BinaryArtifact = {
      id: `rust-bin-${binData.binaryName}`,
      type: "binary",
      name: binData.binaryName,
      description: `Rust ${isCli ? "CLI tool" : "binary"}: ${binData.binaryName}`,
      tags: ["rust", "binary", isCli ? "cli" : "executable"].filter(Boolean),
      metadata: {
        language: "rust",
        buildSystem: "cargo",
        entryPoint: binData.binaryPath,
        arguments: [],
        environmentVariables: [],
        dependencies: Object.keys(cargoData.dependencies || {}),
      },
    };

    return [
      {
        artifact: binaryArtifact,
        confidence: this.calculateConfidence([binEvidence], 0.8),
        provenance: this.createProvenance([binEvidence]),
        relationships: [],
      },
    ];
  }

  private async createServiceFromMain(
    mainEvidence: Evidence,
    cargoData: CargoPackageData,
    allEvidence: Evidence[],
  ): Promise<InferredArtifact[]> {
    const framework = this.detectWebFramework(cargoData.dependencies || {});
    const portEvidence = allEvidence.find((e) => e.data.configType === "port-binding");
    const port = portEvidence?.data.port || 8080;

    const serviceArtifact: ServiceArtifact = {
      id: `rust-service-${cargoData.package.name}`,
      type: "service",
      name: cargoData.package.name,
      description: `Rust web service: ${cargoData.package.name}`,
      tags: ["rust", "service", "web", framework].filter(Boolean),
      metadata: {
        language: "rust",
        framework,
        port: typeof port === "number" ? port : 8080,
        basePath: "/",
        environmentVariables: [],
        dependencies: this.extractServiceDependencies(cargoData.dependencies || {}),
        endpoints: [],
        healthCheck: {
          path: "/health",
          expectedStatusCode: 200,
          timeoutMs: 5000,
          intervalSeconds: 30,
        },
      },
    };

    return [
      {
        artifact: serviceArtifact,
        confidence: this.calculateConfidence([mainEvidence], 0.8),
        provenance: this.createProvenance([mainEvidence]),
        relationships: [],
      },
    ];
  }

  private async createJobFromMain(
    mainEvidence: Evidence,
    cargoData: CargoPackageData,
    allEvidence: Evidence[],
  ): Promise<InferredArtifact[]> {
    const scheduler = this.detectJobScheduler(cargoData.dependencies || {});

    const jobArtifact: JobArtifact = {
      id: `rust-job-${cargoData.package.name}`,
      type: "job",
      name: cargoData.package.name,
      description: `Rust background job: ${cargoData.package.name}`,
      tags: ["rust", "job", "background"],
      metadata: {
        language: "rust",
        scheduler,
        entryPoint: mainEvidence.filePath,
        environmentVariables: [],
        dependencies: Object.keys(cargoData.dependencies || {}),
      },
    };

    return [
      {
        artifact: jobArtifact,
        confidence: this.calculateConfidence([mainEvidence], 0.75),
        provenance: this.createProvenance([mainEvidence]),
        relationships: [],
      },
    ];
  }

  private async createBinaryFromMain(
    mainEvidence: Evidence,
    cargoData: CargoPackageData,
    allEvidence: Evidence[],
  ): Promise<InferredArtifact[]> {
    const isCli = this.hasCliFramework(cargoData.dependencies || {});

    const binaryArtifact: BinaryArtifact = {
      id: `rust-bin-${cargoData.package.name}`,
      type: "binary",
      name: cargoData.package.name,
      description: `Rust ${isCli ? "CLI tool" : "binary"}: ${cargoData.package.name}`,
      tags: ["rust", "binary", isCli ? "cli" : "executable"].filter(Boolean),
      metadata: {
        language: "rust",
        buildSystem: "cargo",
        entryPoint: mainEvidence.filePath,
        arguments: [],
        environmentVariables: [],
        dependencies: Object.keys(cargoData.dependencies || {}),
      },
    };

    return [
      {
        artifact: binaryArtifact,
        confidence: this.calculateConfidence([mainEvidence], 0.7),
        provenance: this.createProvenance([mainEvidence]),
        relationships: [],
      },
    ];
  }

  // ============================================================================
  // Classification and detection helpers
  // ============================================================================

  private classifyFramework(depName: string): string | undefined {
    if (RUST_WEB_FRAMEWORKS.includes(depName)) return "web";
    if (RUST_HTTP_CLIENTS.includes(depName)) return "http-client";
    if (RUST_DATABASE_DRIVERS.includes(depName)) return "database";
    if (RUST_ASYNC_RUNTIMES.includes(depName)) return "async-runtime";
    if (RUST_CLI_FRAMEWORKS.includes(depName)) return "cli";
    if (RUST_JOB_FRAMEWORKS.includes(depName)) return "job";
    return undefined;
  }

  private hasWebFramework(dependencies: Record<string, any>): boolean {
    return Object.keys(dependencies).some((dep) => RUST_WEB_FRAMEWORKS.includes(dep));
  }

  private hasCliFramework(dependencies: Record<string, any>): boolean {
    return Object.keys(dependencies).some((dep) => RUST_CLI_FRAMEWORKS.includes(dep));
  }

  private hasJobFramework(dependencies: Record<string, any>): boolean {
    return Object.keys(dependencies).some((dep) => RUST_JOB_FRAMEWORKS.includes(dep));
  }

  private detectWebFramework(dependencies: Record<string, any>): string {
    for (const dep of Object.keys(dependencies)) {
      if (RUST_WEB_FRAMEWORKS.includes(dep)) {
        return dep;
      }
    }
    return "unknown";
  }

  private detectJobScheduler(dependencies: Record<string, any>): string {
    for (const dep of Object.keys(dependencies)) {
      if (RUST_JOB_FRAMEWORKS.includes(dep)) {
        return dep;
      }
    }
    return "manual";
  }

  private extractServiceDependencies(dependencies: Record<string, any>): any[] {
    return Object.keys(dependencies)
      .filter((dep) => RUST_DATABASE_DRIVERS.includes(dep) || RUST_HTTP_CLIENTS.includes(dep))
      .map((dep) => ({
        serviceName: dep,
        type: RUST_DATABASE_DRIVERS.includes(dep) ? "database" : "http",
        required: true,
      }));
  }

  private extractPublicApi(evidence: Evidence[]): string[] {
    return evidence
      .filter((e) => e.type === "export" && e.data.exportType === "library")
      .map((e) => e.filePath)
      .map((path) => path.split("/").pop()?.replace(".rs", "") || "")
      .filter(Boolean);
  }

  private calculateConfidence(evidence: Evidence[], baseConfidence: number): ConfidenceScore {
    const avgEvidence = evidence.reduce((sum, e) => sum + e.confidence, 0) / evidence.length;
    const overall = Math.min(0.95, baseConfidence * avgEvidence);

    return {
      overall,
      breakdown: {
        evidence: avgEvidence,
        base: baseConfidence,
      },
      factors: evidence.map((e) => ({
        description: `Evidence from ${e.type}`,
        weight: e.confidence,
        source: e.source,
      })),
    };
  }

  private createProvenance(evidence: Evidence[]): Provenance {
    return {
      evidence: evidence.map((e) => e.id),
      plugins: ["rust"],
      rules: ["cargo-toml-analysis", "source-file-analysis"],
      timestamp: Date.now(),
      pipelineVersion: "1.0.0",
    };
  }
}

// Export the plugin instance
export const rustPlugin = new RustPlugin();
