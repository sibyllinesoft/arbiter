/**
 * Parser helper functions for analyzing package manifests and project structure.
 * Provides utilities for framework detection, language classification, and artifact generation.
 */
import { createHash } from "node:crypto";
import path from "node:path";
import {
  DOCKER_COMPOSE_FILES,
  KUBERNETES_KEYWORDS,
  NODE_CLI_FRAMEWORKS,
  NODE_FRONTEND_FRAMEWORKS,
  NODE_WEB_FRAMEWORKS,
  RUST_CLI_FRAMEWORKS,
  RUST_WEB_FRAMEWORKS,
  TSOA_ROUTE_PATTERN,
  TYPESCRIPT_SIGNALS,
} from "./constants";

// Re-export constants for backward compatibility
export {
  DATABASE_HINTS,
  DOCKER_COMPOSE_FILES,
  KUBERNETES_KEYWORDS,
  NODE_CLI_FRAMEWORKS,
  NODE_FRONTEND_FRAMEWORKS,
  NODE_WEB_FRAMEWORKS,
  PACKAGE_MANIFESTS,
  ROUTE_HINT_PATTERN,
  RUST_CLI_FRAMEWORKS,
  RUST_WEB_FRAMEWORKS,
  TSOA_ROUTE_PATTERN,
  TYPESCRIPT_SIGNALS,
} from "./constants";

/** Normalize path separators to forward slashes */
export function normalizeSlashes(value: string): string {
  return value.replace(/\\+/g, "/");
}

/** Collect all dependencies from a package.json manifest */
export function collectPackageDependencies(pkg: any): Record<string, string> {
  return {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
    ...(pkg.optionalDependencies || {}),
    ...(pkg.peerDependencies || {}),
  };
}

/** Detect web frameworks used in a Node.js package */
export function detectPackageFrameworks(pkg: any): string[] {
  const deps = collectPackageDependencies(pkg);
  return NODE_WEB_FRAMEWORKS.filter((dep) => Boolean(deps[dep]));
}

/** Check if a package uses TypeScript based on dependencies and configuration */
export function packageUsesTypeScript(pkg: any): boolean {
  const deps = collectPackageDependencies(pkg);
  if (TYPESCRIPT_SIGNALS.some((signal) => Boolean(deps[signal]))) {
    return true;
  }

  if (typeof pkg.types === "string" || typeof pkg.typings === "string") {
    return true;
  }

  const scripts = pkg.scripts || {};
  const scriptSignals = ["ts-node", "tsx", "ts-node-dev", "tsup", "tsc"];
  return Object.values(scripts)
    .filter((command): command is string => typeof command === "string")
    .some((command) => scriptSignals.some((signal) => command.includes(signal)));
}

/** Classification result type */
type PackageClassification = {
  type: "service" | "frontend" | "tool" | "package";
  detectedType: string;
  reason: string;
};

/** Build set of runtime dependency names (lowercase) */
function buildRuntimeDepSet(pkg: any): Set<string> {
  return new Set<string>([
    ...Object.keys(pkg.dependencies || {}).map((dep) => dep.toLowerCase()),
    ...Object.keys(pkg.optionalDependencies || {}).map((dep) => dep.toLowerCase()),
    ...Object.keys(pkg.peerDependencies || {}).map((dep) => dep.toLowerCase()),
  ]);
}

/** Check if package has any matching runtime dependency */
function hasRuntimeDep(runtimeDeps: Set<string>, candidates: string[]): boolean {
  return candidates.some((candidate) => runtimeDeps.has(candidate));
}

/** Check if package has a bin entry */
function hasBinEntry(pkg: any): boolean {
  return typeof pkg.bin === "string" || (pkg.bin && Object.keys(pkg.bin).length > 0);
}

/** Classify a Node.js package as service, frontend, tool, or library */
export function classifyPackageManifest(pkg: any): PackageClassification {
  const deps = collectPackageDependencies(pkg);
  const depNames = Object.keys(deps).map((dep) => dep.toLowerCase());
  const runtimeDeps = buildRuntimeDepSet(pkg);

  if (hasRuntimeDep(runtimeDeps, NODE_WEB_FRAMEWORKS)) {
    return { type: "service", detectedType: "web_service", reason: "web-framework" };
  }

  if (hasRuntimeDep(runtimeDeps, NODE_FRONTEND_FRAMEWORKS) || pkg.browserslist) {
    return { type: "frontend", detectedType: "frontend", reason: "frontend-framework" };
  }

  const hasBin = hasBinEntry(pkg);
  const hasCliDep = NODE_CLI_FRAMEWORKS.some((f) => depNames.includes(f));

  if (hasBin || hasCliDep) {
    return {
      type: "tool",
      detectedType: "tool",
      reason: hasBin ? "manifest-bin" : "cli-dependency",
    };
  }

  return { type: "package", detectedType: "package", reason: "default-module" };
}

/** Detect the primary language used in a Node.js package */
export function detectNodePackageLanguage(pkg: any): string | null {
  const deps = collectPackageDependencies(pkg);
  const depNames = new Set<string>(Object.keys(deps).map((dep) => dep.toLowerCase()));
  const scripts = Object.values(pkg.scripts || {}).filter(
    (value): value is string => typeof value === "string",
  );
  const scriptBlob = scripts.join(" ").toLowerCase();

  const hasTypeScriptSignal =
    TYPESCRIPT_SIGNALS.some((signal) => depNames.has(signal)) ||
    /(?:\btsc\b|ts-node|tsx|typescript)/.test(scriptBlob) ||
    (typeof pkg.types === "string" && pkg.types.endsWith(".d.ts")) ||
    (typeof pkg.typings === "string" && pkg.typings.endsWith(".d.ts")) ||
    (typeof pkg.main === "string" && pkg.main.endsWith(".ts")) ||
    (typeof pkg.module === "string" && pkg.module.endsWith(".ts"));

  if (hasTypeScriptSignal) {
    return "TypeScript";
  }

  return null;
}

function normalizeCargoDependencyName(name: string): string {
  return name.toLowerCase().replace(/_/g, "-");
}

/** Collect all dependency names from a Cargo.toml manifest */
export function collectCargoDependencyNames(cargo: any): string[] {
  const sections = ["dependencies", "dev-dependencies", "build-dependencies"];
  const names = new Set<string>();

  for (const section of sections) {
    const deps = cargo?.[section];
    if (!deps || typeof deps !== "object") continue;
    for (const key of Object.keys(deps)) {
      names.add(normalizeCargoDependencyName(key));
    }
  }

  return Array.from(names);
}

/** Extract binary name from a single bin entry */
function extractBinaryName(entry: unknown): string | null {
  if (typeof entry === "string") return entry;
  if (entry && typeof entry === "object") {
    const name = (entry as Record<string, unknown>).name;
    if (typeof name === "string") return name;
  }
  return null;
}

/** Extract binary target names from a Cargo.toml bin section */
export function extractCargoBinaryNames(binSection: unknown): string[] {
  if (!binSection) return [];

  if (Array.isArray(binSection)) {
    return binSection.map(extractBinaryName).filter((value): value is string => Boolean(value));
  }

  const name = extractBinaryName(binSection);
  return name ? [name] : [];
}

/** Classify a Rust crate as service, package, or tool based on dependencies */
export function classifyCargoManifest(options: {
  dependencyNames: string[];
  hasBinaries: boolean;
  hasLibrary: boolean;
}): {
  type: "service" | "package" | "tool";
  detectedType: "service" | "package" | "binary";
  reason: string;
  framework?: string;
} {
  const { dependencyNames, hasBinaries } = options;
  const normalizedDeps = dependencyNames.map(normalizeCargoDependencyName);

  const findMatch = (candidates: string[]): string | undefined => {
    return candidates.find((candidate) => normalizedDeps.includes(candidate));
  };

  const webFramework = findMatch(RUST_WEB_FRAMEWORKS);
  if (webFramework) {
    return {
      type: "service",
      detectedType: "service",
      reason: "web-framework",
      framework: webFramework,
    };
  }

  if (hasBinaries) {
    const cliFramework = findMatch(RUST_CLI_FRAMEWORKS);
    return {
      type: "tool",
      detectedType: "binary",
      reason: cliFramework ? "cli-binary" : "binary-target",
      framework: cliFramework,
    };
  }

  return {
    type: "package",
    detectedType: "package",
    reason: options.hasLibrary ? "library-target" : "default-module",
  };
}

/** Strip the package root prefix from a file path */
export function stripPackageRoot(filePath: string, packageRoot: string): string {
  if (!packageRoot) return filePath;
  if (filePath === packageRoot) return "";
  if (filePath.startsWith(`${packageRoot}/`)) {
    return filePath.slice(packageRoot.length + 1);
  }
  return filePath;
}

/** Check if file belongs to package scope */
function isFileInPackageScope(file: string, normalizedRoot: string): boolean {
  if (file.endsWith(".d.ts")) return false;
  if (!normalizedRoot) return !file.startsWith("node_modules/");
  return file === normalizedRoot || file.startsWith(`${normalizedRoot}/`);
}

/** Filter files relevant to a package and strip root prefix */
function getPackageRelevantFiles(allFiles: string[], normalizedRoot: string): string[] {
  return allFiles
    .map(normalizeSlashes)
    .filter((file) => isFileInPackageScope(file, normalizedRoot))
    .map((file) => stripPackageRoot(file, normalizedRoot))
    .filter((rel) => rel && !rel.startsWith("node_modules/"));
}

/** Check if file is a potential TSOA controller candidate */
function isControllerCandidate(rel: string): boolean {
  if (!TSOA_ROUTE_PATTERN.test(rel)) return false;
  if (/\.d\.ts$/i.test(rel)) return false;
  if (/\btests?\//i.test(rel) || /__tests__\//i.test(rel)) return false;
  return true;
}

/** Extract scripts that use tsoa from package.json */
function getTsoaScripts(scripts: Record<string, unknown>): string[] {
  return Object.entries(scripts)
    .filter(([, command]) => typeof command === "string" && command.includes("tsoa"))
    .map(([name]) => name);
}

/** Build TSOA analysis data from a TypeScript package */
export function buildTsoaAnalysisFromPackage(
  packageJsonPath: string,
  pkg: any,
  allFiles: string[],
): {
  root: string;
  frameworks: string[];
  usesTypeScript: true;
  hasTsoaDependency: boolean;
  totalTypeScriptFiles: number;
  controllerCandidates: string[];
  configFiles: string[];
  scriptsUsingTsoa: string[];
  recommendedCommands: string[];
} | null {
  const frameworks = detectPackageFrameworks(pkg);
  if (frameworks.length === 0 || !packageUsesTypeScript(pkg)) return null;

  const packageDir = normalizeSlashes(path.dirname(packageJsonPath));
  const normalizedRoot = packageDir === "." ? "" : packageDir;
  const hasTsoaDependency = Boolean(collectPackageDependencies(pkg).tsoa);

  const relevantFiles = getPackageRelevantFiles(allFiles, normalizedRoot);
  if (relevantFiles.length === 0) return null;

  const tsFiles = relevantFiles.filter((rel) => /\.(ts|tsx)$/i.test(rel));
  if (tsFiles.length === 0) return null;

  const controllerCandidates = tsFiles.filter(isControllerCandidate).slice(0, 50);
  const configFiles = relevantFiles.filter((rel) => /tsoa\.json$/i.test(rel)).slice(0, 10);
  const scriptsUsingTsoa = getTsoaScripts(pkg.scripts || {});

  if (controllerCandidates.length === 0 && configFiles.length === 0 && !hasTsoaDependency) {
    return null;
  }

  return {
    root: normalizedRoot || ".",
    frameworks,
    usesTypeScript: true,
    hasTsoaDependency,
    totalTypeScriptFiles: tsFiles.length,
    controllerCandidates,
    configFiles,
    scriptsUsingTsoa,
    recommendedCommands: hasTsoaDependency
      ? ["npx tsoa spec", "npx tsoa routes"]
      : ["npm install --save-dev tsoa", "npx tsoa spec", "npx tsoa routes"],
  };
}

/** Generate a unique artifact ID from project and file path */
export function makeArtifactId(projectId: string, filePath: string): string {
  const hash = createHash("sha1").update(`${projectId}:${filePath}`).digest("hex");
  return `artifact-${hash}`;
}

/** Convert a file path to a human-readable name */
export function prettifyName(filePath: string): string {
  const base = path.basename(filePath);
  const withoutExt = base.replace(path.extname(base), "");
  return (
    withoutExt
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "artifact"
  );
}

/** Check if a YAML file is infrastructure-related (Docker, Kubernetes) */
export function isInfrastructureYaml(base: string): boolean {
  if (DOCKER_COMPOSE_FILES.has(base)) return true;
  return KUBERNETES_KEYWORDS.some((keyword) => base.includes(keyword));
}

/** Check if a JSON file is a configuration or manifest file */
export function isConfigJson(base: string): boolean {
  return base === "package.json" || base.endsWith("config.json") || base.includes("manifest");
}
