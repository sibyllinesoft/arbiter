/**
 * Node.js package.json parser.
 * Extracts package metadata, detects frameworks, and classifies project type.
 */
import path from "node:path";
import type { FileParser } from "./base";
import {
  buildTsoaAnalysisFromPackage,
  classifyPackageManifest,
  detectNodePackageLanguage,
} from "./helpers";

/** Structure of a package.json manifest */
interface PackageJson {
  name?: string;
  version?: string;
  description?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Extract metadata fields from a package.json object.
 * @param pkg - Parsed package.json content
 * @returns Normalized package metadata
 */
function extractPackageMetadata(pkg: PackageJson) {
  const description = typeof pkg.description === "string" ? pkg.description.trim() : "";
  const version = typeof pkg.version === "string" ? pkg.version.trim() : "";

  return {
    name: pkg.name,
    version: version || undefined,
    description: description || undefined,
    scripts: pkg.scripts ? Object.keys(pkg.scripts) : [],
    dependencies: pkg.dependencies ? Object.keys(pkg.dependencies) : [],
    devDependencies: pkg.devDependencies ? Object.keys(pkg.devDependencies) : [],
  };
}

/** Supported frameworks in priority order */
const FRAMEWORK_PACKAGES = ["express", "fastify", "nestjs"] as const;

/**
 * Detect the primary web framework from package dependencies.
 * @param dependencies - Package dependencies object
 * @returns Detected framework name or undefined
 */
function detectFramework(dependencies?: Record<string, string>): string | undefined {
  if (!dependencies) return undefined;
  return FRAMEWORK_PACKAGES.find((pkg) => pkg in dependencies);
}

/** Apply basic metadata from package.json to artifact */
function applyPackageMetadata(artifact: any, pkg: PackageJson): void {
  const packageMeta = extractPackageMetadata(pkg);
  artifact.metadata = { ...artifact.metadata, package: packageMeta };

  if (typeof pkg.name === "string") artifact.name = pkg.name;
  if (packageMeta.description) artifact.description = packageMeta.description;
}

/** Apply framework and language detection to artifact */
function applyFrameworkAndLanguage(artifact: any, pkg: PackageJson): void {
  const framework = detectFramework(pkg.dependencies);
  if (framework) artifact.framework = framework;

  const detectedLanguage = detectNodePackageLanguage(pkg);
  if (detectedLanguage) artifact.language = detectedLanguage;
}

/** Apply classification metadata to artifact */
function applyClassification(artifact: any, pkg: PackageJson): void {
  const classification = classifyPackageManifest(pkg);
  artifact.type = classification.type;
  artifact.metadata = {
    ...artifact.metadata,
    detectedType: classification.detectedType,
    classification: { source: "manifest", reason: classification.reason },
  };
  if (classification.type === "tool" && !artifact.framework) {
    artifact.framework = "cli";
  }
}

/** Apply TSOA analysis if applicable */
function applyTsoaAnalysis(
  artifact: any,
  pkg: PackageJson,
  filePath: string,
  allFiles: string[],
): void {
  const tsoaAnalysis = buildTsoaAnalysisFromPackage(filePath, pkg, allFiles);
  if (tsoaAnalysis) {
    artifact.metadata = { ...artifact.metadata, tsoaAnalysis };
  }
}

/** Parse JSON safely, returning null on failure */
function parsePackageJson(content: string): PackageJson | null {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Parser for package.json manifest files.
 * Extracts package metadata, detects frameworks and language,
 * and classifies the project type (service, frontend, tool, package).
 */
export const packageJsonParser: FileParser = {
  name: "package-json",
  priority: 8,
  matches: (filePath) => path.basename(filePath).toLowerCase() === "package.json",
  parse: (content, context) => {
    const { artifact } = context;
    if (!artifact) return;

    const pkg = parsePackageJson(content);
    if (!pkg) return;

    applyPackageMetadata(artifact, pkg);
    applyFrameworkAndLanguage(artifact, pkg);
    applyClassification(artifact, pkg);
    applyTsoaAnalysis(artifact, pkg, context.filePath, context.allFiles);
  },
};
