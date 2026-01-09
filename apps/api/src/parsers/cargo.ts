/**
 * Cargo.toml parser for Rust project manifest analysis.
 * Extracts package metadata, dependencies, and classifies crate type.
 */
import type { FileParser } from "./base";
import {
  classifyCargoManifest,
  collectCargoDependencyNames,
  extractCargoBinaryNames,
} from "./helpers";

/** Context passed to parser functions */
interface ParserContext {
  artifact?: any;
  filePath: string;
}

/** Parsed Cargo.toml package section */
interface CargoPackage {
  name: string;
  description: string;
  version: string;
}

/**
 * Get the TOML parser from the runtime.
 */
function getTomlParser(): { parse: (content: string) => Record<string, any> } | null {
  const tomlParser = (globalThis as unknown as { Bun?: typeof Bun }).Bun?.TOML;
  if (!tomlParser || typeof tomlParser.parse !== "function") {
    return null;
  }
  return tomlParser;
}

/**
 * Parse the Cargo.toml content.
 */
function parseCargo(content: string, filePath: string): Record<string, any> | null {
  const tomlParser = getTomlParser();
  if (!tomlParser) {
    console.warn("[project-analysis] TOML parser not available in runtime");
    return null;
  }

  try {
    return tomlParser.parse(content) as Record<string, any>;
  } catch (error) {
    console.warn("[project-analysis] failed to parse Cargo manifest", { path: filePath, error });
    return null;
  }
}

/**
 * Extract package metadata from Cargo.toml.
 */
function extractPackageInfo(cargo: Record<string, any>): CargoPackage {
  const packageSection = cargo.package ?? {};
  return {
    name: typeof packageSection.name === "string" ? packageSection.name.trim() : "",
    description:
      typeof packageSection.description === "string" ? packageSection.description.trim() : "",
    version: typeof packageSection.version === "string" ? packageSection.version.trim() : "",
  };
}

/**
 * Extract dependency information from Cargo.toml.
 */
function extractDependencies(cargo: Record<string, any>) {
  return {
    runtime: Object.keys((cargo.dependencies as Record<string, unknown>) ?? {}),
    dev: Object.keys((cargo["dev-dependencies"] as Record<string, unknown>) ?? {}),
    build: Object.keys((cargo["build-dependencies"] as Record<string, unknown>) ?? {}),
    all: collectCargoDependencyNames(cargo),
  };
}

/**
 * Extract binary information from Cargo.toml.
 */
function extractBinaryInfo(cargo: Record<string, any>) {
  const packageSection = cargo.package ?? {};
  const rawBin = cargo.bin ?? cargo.binaries ?? cargo["bin"];
  const binaries = extractCargoBinaryNames(rawBin);
  const hasBinaries =
    binaries.length > 0 ||
    Boolean(packageSection["default-run"]) ||
    Boolean(packageSection["default_bin"]);
  const hasLibrary = Boolean(cargo.lib);

  return { binaries, hasBinaries, hasLibrary };
}

/**
 * Update artifact with parsed Cargo.toml data.
 */
function updateArtifact(
  artifact: any,
  packageInfo: CargoPackage,
  deps: ReturnType<typeof extractDependencies>,
  binInfo: ReturnType<typeof extractBinaryInfo>,
) {
  if (packageInfo.name) {
    artifact.name = packageInfo.name;
  }
  if (packageInfo.description) {
    artifact.description = packageInfo.description;
  }

  artifact.language = "rust";

  const classification = classifyCargoManifest({
    dependencyNames: deps.all,
    hasBinaries: binInfo.hasBinaries,
    hasLibrary: binInfo.hasLibrary,
  });

  const previousType = artifact.type;
  if (classification.framework) {
    artifact.framework = classification.framework;
  }

  artifact.type = classification.type;

  if (classification.type === "tool" && binInfo.binaries.length > 0) {
    artifact.name = binInfo.binaries[0];
  }

  artifact.metadata = {
    ...artifact.metadata,
    detectedType: classification.detectedType,
    classification: {
      source: "cargo-manifest",
      reason: classification.reason,
      previousType,
    },
    cargo: {
      name: packageInfo.name || artifact.name,
      version: packageInfo.version || undefined,
      description: packageInfo.description || undefined,
      dependencies: deps.runtime,
      devDependencies: deps.dev,
      buildDependencies: deps.build,
      hasLibrary: binInfo.hasLibrary,
      hasBinaries: binInfo.hasBinaries,
      binaries: binInfo.binaries,
    },
  };

  if (packageInfo.version) {
    artifact.metadata.version = packageInfo.version;
  }
}

/**
 * Parser for Cargo.toml manifest files.
 * Detects Rust web frameworks, CLI tools, and library crates.
 */
export const cargoTomlParser: FileParser = {
  name: "cargo-toml",
  priority: 8,
  matches: (filePath) => filePath.toLowerCase().endsWith("cargo.toml"),
  parse: (content, context: ParserContext) => {
    const artifact = context.artifact;
    if (!artifact) return;

    const cargo = parseCargo(content, context.filePath);
    if (!cargo || typeof cargo !== "object") return;

    const packageInfo = extractPackageInfo(cargo);
    const deps = extractDependencies(cargo);
    const binInfo = extractBinaryInfo(cargo);

    updateArtifact(artifact, packageInfo, deps, binInfo);
  },
};
