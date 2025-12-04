import type { FileParser } from "./base";
import {
  classifyCargoManifest,
  collectCargoDependencyNames,
  extractCargoBinaryNames,
} from "./helpers";

export const cargoTomlParser: FileParser = {
  name: "cargo-toml",
  priority: 8,
  matches: (filePath) => filePath.toLowerCase().endsWith("cargo.toml"),
  parse: (content, context) => {
    const artifact = context.artifact;
    if (!artifact) return;

    const tomlParser = (globalThis as unknown as { Bun?: typeof Bun }).Bun?.TOML;
    if (!tomlParser || typeof tomlParser.parse !== "function") {
      console.warn("[project-analysis] TOML parser not available in runtime");
      return;
    }

    let cargo: Record<string, any>;
    try {
      cargo = tomlParser.parse(content) as Record<string, any>;
    } catch (error) {
      console.warn("[project-analysis] failed to parse Cargo manifest", {
        path: context.filePath,
        error,
      });
      return;
    }

    if (!cargo || typeof cargo !== "object") return;

    const packageSection = cargo.package ?? {};
    const manifestName = typeof packageSection.name === "string" ? packageSection.name.trim() : "";
    const manifestDescription =
      typeof packageSection.description === "string" ? packageSection.description.trim() : "";
    const manifestVersion =
      typeof packageSection.version === "string" ? packageSection.version.trim() : "";

    if (manifestName) {
      artifact.name = manifestName;
    }
    if (manifestDescription) {
      artifact.description = manifestDescription;
    }

    artifact.language = "rust";

    const runtimeDeps = Object.keys((cargo.dependencies as Record<string, unknown>) ?? {});
    const devDeps = Object.keys((cargo["dev-dependencies"] as Record<string, unknown>) ?? {});
    const buildDeps = Object.keys((cargo["build-dependencies"] as Record<string, unknown>) ?? {});
    const dependencyNames = collectCargoDependencyNames(cargo);

    const rawBin = cargo.bin ?? cargo.binaries ?? cargo["bin"];
    const cargoBinaries = extractCargoBinaryNames(rawBin);
    const hasBinaries =
      cargoBinaries.length > 0 ||
      Boolean(packageSection["default-run"]) ||
      Boolean(packageSection["default_bin"]);
    const hasLibrary = Boolean(cargo.lib);

    const classification = classifyCargoManifest({
      dependencyNames,
      hasBinaries,
      hasLibrary,
    });

    const previousType = artifact.type;
    if (classification.framework) {
      artifact.framework = classification.framework;
    }

    artifact.type = classification.type;

    if (classification.type === "tool" && cargoBinaries.length > 0) {
      artifact.name = cargoBinaries[0];
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
        name: manifestName || artifact.name,
        version: manifestVersion || undefined,
        description: manifestDescription || undefined,
        dependencies: runtimeDeps,
        devDependencies: devDeps,
        buildDependencies: buildDeps,
        hasLibrary,
        hasBinaries,
        binaries: cargoBinaries,
      },
    };

    if (manifestVersion) {
      artifact.metadata.version = manifestVersion;
    }
  },
};
