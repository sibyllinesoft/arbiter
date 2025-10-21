import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import chalk from "chalk";
import type { CLIConfig } from "../types.js";
import { resolveSmartNaming } from "../utils/smart-naming.js";
import type { APISurface } from "./surface.js";

// Import traceability system (commented out - dependency missing)
// const require = createRequire(import.meta.url);
// const traceabilityLib = require("../../../../lib/traceability.cjs");

/**
 * Semantic version bump types
 */
export type VersionBump = "MAJOR" | "MINOR" | "PATCH";

/**
 * Version plan analysis options
 */
export interface VersionPlanOptions {
  /** Current surface file path */
  current?: string;
  /** Previous surface file path for comparison */
  previous?: string;
  /** Output file for version plan */
  output?: string;
  /** Enable strict mode for library compliance */
  strict?: boolean;
  /** Include all changes in analysis */
  verbose?: boolean;
}

/**
 * Version release options
 */
export interface VersionReleaseOptions {
  /** Version plan file to execute */
  plan?: string;
  /** Specific version to set (overrides plan) */
  version?: string;
  /** Changelog output file */
  changelog?: string;
  /** Enable dry-run mode (default) */
  dryRun?: boolean;
  /** Apply changes (disables dry-run) */
  apply?: boolean;
  /** Verbose output */
  verbose?: boolean;
}

/**
 * API change classification
 */
export interface APIChange {
  type: "added" | "removed" | "modified";
  symbol: string;
  symbolType: string;
  breaking: boolean;
  description: string;
  location?: {
    file: string;
    line: number;
  };
  oldSignature?: string;
  newSignature?: string;
}

/**
 * Version plan analysis result
 */
/**
 * Traceability information for version changes
 */
export interface VersionTraceability {
  /** Related requirements that drove the changes */
  requirements: Array<{
    id: string;
    content: string;
    source: string;
    location: { file: string; line: number };
  }>;
  /** Linked specifications */
  specifications: Array<{
    id: string;
    content: string;
    source: string;
    type: string;
  }>;
  /** Tests that validate the changes */
  tests: Array<{
    id: string;
    name: string;
    source: string;
    type: string;
  }>;
  /** Code artifacts affected */
  code_artifacts: Array<{
    id: string;
    content: string;
    source: string;
    type: string;
  }>;
  /** Coverage metrics */
  coverage: {
    requirements_linked: number;
    specifications_linked: number;
    tests_linked: number;
    code_linked: number;
  };
}

export interface VersionPlan {
  timestamp: number;
  current_version?: string;
  required_bump: VersionBump;
  rationale: string;
  breaking_changes: APIChange[];
  new_features: APIChange[];
  bug_fixes: APIChange[];
  statistics: {
    total_changes: number;
    breaking_count: number;
    feature_count: number;
    fix_count: number;
  };
  strict_mode: boolean;
  recommendations: string[];
  /** Traceability information linking changes to requirements */
  traceability?: VersionTraceability;
}

/**
 * Language-specific manifest information
 */
export interface ManifestInfo {
  type: "npm" | "python" | "rust" | "go" | "generic";
  path: string;
  current_version?: string;
  version_field: string;
}

/**
 * Version plan command - analyze API changes and recommend semver bump
 */
export async function versionPlanCommand(
  options: VersionPlanOptions,
  _config: CLIConfig,
): Promise<number> {
  try {
    console.log(chalk.blue("📊 Analyzing API changes for version planning..."));

    // Resolve smart naming for output file
    const planNaming = await resolveSmartNaming("versionPlan", {
      output: options.output,
      useGenericNames: options.output === "version_plan.json", // Use generic if explicitly specified
    });

    // Load current and previous surfaces - use smart naming for defaults too
    let currentPath = options.current;
    if (!currentPath) {
      const surfaceNaming = await resolveSmartNaming("surface", { useGenericNames: false });
      currentPath = surfaceNaming.fullPath;
      // Fallback to generic if project-specific doesn't exist
      if (!existsSync(currentPath)) {
        currentPath = "surface.json";
      }
    }

    const previousPath = options.previous || findPreviousSurface(currentPath);

    if (!existsSync(currentPath)) {
      console.error(chalk.red(`❌ Current surface file not found: ${currentPath}`));
      console.log(chalk.dim("Run `arbiter surface <language>` to generate it"));
      return 1;
    }

    const currentSurface = await loadSurface(currentPath);
    if (!currentSurface) {
      return 1;
    }

    let previousSurface: APISurface | null = null;
    if (existsSync(previousPath)) {
      previousSurface = await loadSurface(previousPath);
      console.log(chalk.dim(`Comparing against: ${previousPath}`));
    } else {
      console.log(chalk.yellow(`⚠️  No previous surface found at ${previousPath}`));
      console.log(chalk.dim("Assuming this is the initial version"));
    }

    // Perform change analysis
    const changes = await analyzeAPIChanges(previousSurface, currentSurface);

    // Generate version plan
    const plan = await generateVersionPlan(changes, options);

    // Write plan to file
    await writeFile(planNaming.fullPath, JSON.stringify(plan, null, 2));

    // Display results
    console.log(chalk.green(`✅ Version plan generated: ${planNaming.filename}`));
    if (!planNaming.isGeneric && planNaming.context.name) {
      console.log(chalk.dim(`   Project: ${planNaming.context.name}`));
    }
    displayVersionPlan(plan, options.verbose);

    // Return non-zero if strict mode violations detected
    if (options.strict && plan.required_bump === "MAJOR" && plan.breaking_changes.length > 0) {
      console.log(
        chalk.red("\n❌ STRICT MODE: Breaking changes detected requiring MAJOR version bump"),
      );
      return 1;
    }

    return 0;
  } catch (error) {
    console.error(
      chalk.red("❌ Version plan failed:"),
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}

/**
 * Version release command - update manifests and generate changelog
 */
export async function versionReleaseCommand(
  options: VersionReleaseOptions,
  _config: CLIConfig,
): Promise<number> {
  try {
    const isDryRun = !options.apply; // Default to dry-run unless --apply specified

    console.log(chalk.blue(`🚀 ${isDryRun ? "Planning" : "Executing"} version release...`));

    if (isDryRun) {
      console.log(chalk.yellow("🔍 DRY-RUN MODE: No files will be modified"));
      console.log(chalk.dim("Use --apply to execute changes"));
    }

    // Load version plan
    let plan: VersionPlan | null = null;
    if (options.plan) {
      if (!existsSync(options.plan)) {
        console.error(chalk.red(`❌ Version plan file not found: ${options.plan}`));
        return 1;
      }

      const planContent = await readFile(options.plan, "utf-8");
      plan = JSON.parse(planContent);
      console.log(chalk.dim(`Using plan: ${options.plan}`));
    }

    // Detect manifests in current directory
    const manifests = await detectManifests();

    if (manifests.length === 0) {
      console.error(chalk.red("❌ No supported manifests found"));
      console.log(chalk.dim("Supported: package.json, pyproject.toml, Cargo.toml"));
      return 1;
    }

    console.log(chalk.cyan("📦 Detected manifests:"));
    manifests.forEach((manifest) => {
      const versionInfo = manifest.current_version
        ? ` (v${manifest.current_version})`
        : " (version not found)";
      console.log(`  ${manifest.type}: ${manifest.path}${versionInfo}`);
    });

    // Determine target version
    let targetVersion: string;
    if (options.version) {
      targetVersion = options.version;
      console.log(chalk.cyan(`🎯 Target version (explicit): ${targetVersion}`));
    } else if (plan) {
      targetVersion = calculateNextVersion(
        manifests[0].current_version || "0.0.0",
        plan.required_bump,
      );
      console.log(chalk.cyan(`🎯 Target version (${plan.required_bump}): ${targetVersion}`));
      console.log(chalk.dim(`Rationale: ${plan.rationale}`));
    } else {
      console.error(chalk.red("❌ No version specified and no plan provided"));
      console.log(chalk.dim("Use --version <version> or --plan <plan-file>"));
      return 1;
    }

    // Generate changelog
    if (plan) {
      const changelogPath = options.changelog || "CHANGELOG.md";
      await generateChangelog(plan, targetVersion, changelogPath, isDryRun);
      console.log(
        chalk.green(`📝 Changelog ${isDryRun ? "preview" : "updated"}: ${changelogPath}`),
      );
    }

    // Update manifests
    console.log(chalk.blue("\n📝 Updating manifests..."));
    for (const manifest of manifests) {
      await updateManifest(manifest, targetVersion, isDryRun, options.verbose);
    }

    // Git tag recommendations for Go/Bash
    const hasGoFiles = existsSync("go.mod");
    const hasBashScripts = existsSync("scripts") || existsSync("bin");

    if (hasGoFiles || hasBashScripts) {
      console.log(chalk.blue("\n🏷️  Git tag recommendations:"));
      console.log(chalk.cyan(`  git tag v${targetVersion}`));
      console.log(chalk.cyan(`  git push origin v${targetVersion}`));

      if (hasGoFiles) {
        console.log(chalk.dim("  (Go modules use git tags for versioning)"));
      }
    }

    if (isDryRun) {
      console.log(chalk.green("\n✅ Version release plan complete"));
      console.log(chalk.yellow("Use --apply to execute these changes"));
    } else {
      console.log(chalk.green("\n🎉 Version release complete!"));
      console.log(chalk.dim(`All manifests updated to v${targetVersion}`));
    }

    return 0;
  } catch (error) {
    console.error(
      chalk.red("❌ Version release failed:"),
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}

/**
 * Find previous surface file (simple heuristic)
 */
function findPreviousSurface(currentPath: string): string {
  // For now, look for surface-prev.json or similar
  const dir = currentPath.includes("/") ? currentPath.split("/").slice(0, -1).join("/") : ".";
  const basename = currentPath.includes("/") ? currentPath.split("/").pop()! : currentPath;
  const name = basename.replace(".json", "");

  return join(dir, `${name}-prev.json`);
}

/**
 * Load API surface from file
 */
async function loadSurface(path: string): Promise<APISurface | null> {
  try {
    const content = await readFile(path, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error(chalk.red(`Failed to load surface from ${path}:`), error);
    return null;
  }
}

/**
 * Analyze API changes between surfaces
 */
async function analyzeAPIChanges(
  previous: APISurface | null,
  current: APISurface,
): Promise<APIChange[]> {
  // Handle initial version case
  if (!previous) {
    return createInitialVersionChanges(current);
  }

  // Create lookup maps for comparison
  const comparisonMaps = createSymbolComparisonMaps(previous, current);

  // Collect all change types
  const addedChanges = findAddedSymbols(current, comparisonMaps.previousMap);
  const removedChanges = findRemovedSymbols(previous, comparisonMaps.currentMap);
  const modifiedChanges = findModifiedSymbols(current, comparisonMaps.previousMap);

  return [...addedChanges, ...removedChanges, ...modifiedChanges];
}

/**
 * Create changes for initial version (no previous version)
 */
function createInitialVersionChanges(current: APISurface): APIChange[] {
  const changes: APIChange[] = [];

  for (const symbol of current.symbols) {
    changes.push({
      type: "added",
      symbol: symbol.name,
      symbolType: symbol.type,
      breaking: false, // New APIs are not breaking
      description: `Added ${symbol.type} '${symbol.name}'`,
      location: symbol.location,
      newSignature: symbol.signature,
    });
  }

  return changes;
}

/**
 * Create lookup maps for symbol comparison
 */
function createSymbolComparisonMaps(previous: APISurface, current: APISurface) {
  const previousMap = new Map(previous.symbols.map((s) => [`${s.name}:${s.type}`, s]));
  const currentMap = new Map(current.symbols.map((s) => [`${s.name}:${s.type}`, s]));

  return { previousMap, currentMap };
}

/**
 * Find added symbols (new in current version)
 */
function findAddedSymbols(current: APISurface, previousMap: Map<string, any>): APIChange[] {
  const changes: APIChange[] = [];

  for (const symbol of current.symbols) {
    const key = `${symbol.name}:${symbol.type}`;
    if (!previousMap.has(key)) {
      changes.push({
        type: "added",
        symbol: symbol.name,
        symbolType: symbol.type,
        breaking: false,
        description: `Added ${symbol.type} '${symbol.name}'`,
        location: symbol.location,
        newSignature: symbol.signature,
      });
    }
  }

  return changes;
}

/**
 * Find removed symbols (breaking changes)
 */
function findRemovedSymbols(previous: APISurface, currentMap: Map<string, any>): APIChange[] {
  const changes: APIChange[] = [];

  for (const symbol of previous.symbols) {
    const key = `${symbol.name}:${symbol.type}`;
    if (!currentMap.has(key)) {
      changes.push({
        type: "removed",
        symbol: symbol.name,
        symbolType: symbol.type,
        breaking: true, // Removals are always breaking
        description: `Removed ${symbol.type} '${symbol.name}'`,
        location: symbol.location,
        oldSignature: symbol.signature,
      });
    }
  }

  return changes;
}

/**
 * Find modified symbols (signature changes)
 */
function findModifiedSymbols(current: APISurface, previousMap: Map<string, any>): APIChange[] {
  const changes: APIChange[] = [];

  for (const symbol of current.symbols) {
    const key = `${symbol.name}:${symbol.type}`;
    const prevSymbol = previousMap.get(key);

    if (prevSymbol && prevSymbol.signature !== symbol.signature) {
      // Signature changed - potentially breaking
      const isBreaking = isSignatureChangeBreaking(
        prevSymbol.signature,
        symbol.signature,
        symbol.type,
      );

      changes.push({
        type: "modified",
        symbol: symbol.name,
        symbolType: symbol.type,
        breaking: isBreaking,
        description: `Modified ${symbol.type} '${symbol.name}'${isBreaking ? " (BREAKING)" : ""}`,
        location: symbol.location,
        oldSignature: prevSymbol.signature,
        newSignature: symbol.signature,
      });
    }
  }

  return changes;
}

/**
 * Enhanced breaking change detection with sophisticated heuristics
 * Implements language-specific analysis for accurate semver recommendations
 */
function isSignatureChangeBreaking(
  oldSignature?: string,
  newSignature?: string,
  symbolType?: string,
): boolean {
  if (!oldSignature || !newSignature) {
    return false; // Missing signature info, assume non-breaking for better UX
  }

  // If signatures are identical, definitely not breaking
  if (oldSignature === newSignature) {
    return false;
  }

  // Enhanced language-specific analysis
  switch (symbolType) {
    case "function":
      return analyzeFunctionSignatureChange(oldSignature, newSignature);
    case "interface":
    case "type":
      return analyzeTypeSignatureChange(oldSignature, newSignature);
    case "class":
      return analyzeClassSignatureChange(oldSignature, newSignature);
    default:
      return analyzeGenericSignatureChange(oldSignature, newSignature);
  }
}

/**
 * Analyze function signature changes for breaking changes
 */
function analyzeFunctionSignatureChange(oldSig: string, newSig: string): boolean {
  // Extract function components
  const oldFunc = parseFunctionSignature(oldSig);
  const newFunc = parseFunctionSignature(newSig);

  // Parameter analysis
  const parameterChange = analyzeParameterChanges(oldFunc.parameters, newFunc.parameters);
  if (parameterChange.isBreaking) {
    return true;
  }

  // Return type analysis (stricter for some languages)
  if (oldFunc.returnType !== newFunc.returnType) {
    // Return type narrowing is generally breaking
    if (isTypeNarrowing(oldFunc.returnType, newFunc.returnType)) {
      return true;
    }

    // Union type changes are breaking if removing options
    if (isUnionTypeReduction(oldFunc.returnType, newFunc.returnType)) {
      return true;
    }
  }

  // Generic constraint changes
  if (oldFunc.generics && newFunc.generics) {
    return analyzeGenericConstraintChanges(oldFunc.generics, newFunc.generics);
  }

  return false;
}

/**
 * Parse function signature into components
 */
function parseFunctionSignature(signature: string): {
  name: string;
  parameters: Array<{ name: string; type: string; optional: boolean; hasDefault: boolean }>;
  returnType: string;
  generics?: string[];
} {
  // Extract function name
  const nameMatch = signature.match(/(?:function\s+|^)(\w+)/);
  const name = nameMatch?.[1] || "unknown";

  // Extract parameters
  const paramsMatch = signature.match(/\(([^)]*)\)/);
  const paramsStr = paramsMatch?.[1] || "";

  const parameters = paramsStr
    .split(",")
    .map((param) => {
      const trimmed = param.trim();
      if (!trimmed) return null;

      const optional = trimmed.includes("?");
      const hasDefault = trimmed.includes("=");

      // Extract name and type
      const colonIndex = trimmed.indexOf(":");
      const name =
        colonIndex > -1 ? trimmed.substring(0, colonIndex).replace("?", "").trim() : trimmed;
      const type =
        colonIndex > -1
          ? trimmed
              .substring(colonIndex + 1)
              .split("=")[0]
              .trim()
          : "any";

      return { name, type, optional, hasDefault };
    })
    .filter(Boolean) as Array<{
    name: string;
    type: string;
    optional: boolean;
    hasDefault: boolean;
  }>;

  // Extract return type
  const returnMatch = signature.match(/->\s*([^{]+)|:\s*([^{=>]+)/);
  const returnType = (returnMatch?.[1] || returnMatch?.[2] || "void").trim();

  // Extract generics (basic)
  const genericsMatch = signature.match(/<([^>]+)>/);
  const generics = genericsMatch?.[1]?.split(",").map((g) => g.trim());

  return { name, parameters, returnType, generics };
}

/**
 * Analyze parameter changes for breaking changes
 */
function analyzeParameterChanges(
  oldParams: Array<{ name: string; type: string; optional: boolean; hasDefault: boolean }>,
  newParams: Array<{ name: string; type: string; optional: boolean; hasDefault: boolean }>,
): { isBreaking: boolean; reason?: string } {
  // Count required parameters
  const oldRequired = oldParams.filter((p) => !p.optional && !p.hasDefault).length;
  const newRequired = newParams.filter((p) => !p.optional && !p.hasDefault).length;

  // Adding required parameters is breaking
  if (newRequired > oldRequired) {
    return { isBreaking: true, reason: "Added required parameters" };
  }

  // Removing any parameters is breaking (even optional ones can break)
  if (newParams.length < oldParams.length) {
    return { isBreaking: true, reason: "Removed parameters" };
  }

  // Check parameter type changes
  for (let i = 0; i < oldParams.length; i++) {
    const oldParam = oldParams[i];
    const newParam = newParams[i];

    if (!newParam) break; // Already handled above

    // Type narrowing is breaking
    if (isTypeNarrowing(oldParam.type, newParam.type)) {
      return {
        isBreaking: true,
        reason: `Parameter '${oldParam.name}' type narrowed from '${oldParam.type}' to '${newParam.type}'`,
      };
    }

    // Making required parameter optional is non-breaking
    // Making optional parameter required is breaking
    if (!oldParam.optional && newParam.optional) {
      // This is actually a good change (widening compatibility)
      continue;
    }

    if (oldParam.optional && !newParam.optional) {
      return { isBreaking: true, reason: `Parameter '${oldParam.name}' is no longer optional` };
    }
  }

  return { isBreaking: false };
}

/**
 * Check if a type change represents narrowing (breaking)
 */
function isTypeNarrowing(oldType: string, newType: string): boolean {
  // Basic type narrowing detection
  if (oldType === "any" && newType !== "any") {
    return false; // any -> specific type is not breaking (it's improvement)
  }

  if (oldType === "unknown" && newType !== "unknown") {
    return false; // unknown -> specific type is not breaking
  }

  // Union type to single type
  if (oldType.includes("|") && !newType.includes("|")) {
    return true; // Union to single type is narrowing
  }

  // Check for common widening patterns
  const wideningPatterns = [
    ["number", "string"], // number to string could be breaking
    ["string", "number"], // string to number is definitely breaking
    ["object", "string"], // object to string is breaking
  ];

  for (const [from, to] of wideningPatterns) {
    if (oldType.includes(from) && newType.includes(to)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if union type options were removed (breaking)
 */
function isUnionTypeReduction(oldType: string, newType: string): boolean {
  if (!oldType.includes("|") || !newType.includes("|")) {
    return false;
  }

  const oldTypes = oldType.split("|").map((t) => t.trim());
  const newTypes = newType.split("|").map((t) => t.trim());

  // If any old type is no longer present, it's breaking
  return oldTypes.some((ot) => !newTypes.includes(ot));
}

/**
 * Analyze generic constraint changes
 */
function analyzeGenericConstraintChanges(oldGenerics: string[], newGenerics: string[]): boolean {
  if (oldGenerics.length !== newGenerics.length) {
    return true; // Different number of generics is breaking
  }

  // Check for constraint narrowing
  for (let i = 0; i < oldGenerics.length; i++) {
    const oldConstraint = extractGenericConstraint(oldGenerics[i]);
    const newConstraint = extractGenericConstraint(newGenerics[i]);

    if (isConstraintNarrowing(oldConstraint, newConstraint)) {
      return true;
    }
  }

  return false;
}

/**
 * Extract constraint from generic parameter (e.g., "T extends string" -> "string")
 */
function extractGenericConstraint(generic: string): string {
  const match = generic.match(/extends\s+(.+)/);
  return match?.[1]?.trim() || "any";
}

/**
 * Check if generic constraint became more restrictive
 */
function isConstraintNarrowing(oldConstraint: string, newConstraint: string): boolean {
  if (oldConstraint === "any" && newConstraint !== "any") {
    return true; // any -> specific constraint is narrowing
  }

  // Add more sophisticated constraint analysis here
  return oldConstraint !== newConstraint;
}

/**
 * Analyze interface/type signature changes
 */
function analyzeTypeSignatureChange(oldSig: string, newSig: string): boolean {
  // Property removal detection
  if (hasRemovedProperties(oldSig, newSig)) {
    return true;
  }

  // Property type narrowing detection
  if (hasNarrowedPropertyTypes(oldSig, newSig)) {
    return true;
  }

  // Structural changes that affect compatibility
  if (hasStructuralChanges(oldSig, newSig)) {
    return true;
  }

  return false;
}

/**
 * Detect removed properties in interfaces/types
 */
function hasRemovedProperties(oldSig: string, newSig: string): boolean {
  // Extract property names from old signature
  const oldProps = extractPropertyNames(oldSig);
  const newProps = extractPropertyNames(newSig);

  // Check if any old property is missing in new signature
  return oldProps.some((prop) => !newProps.includes(prop));
}

/**
 * Extract property names from interface/type signature
 */
function extractPropertyNames(signature: string): string[] {
  const props: string[] = [];

  // Basic property extraction (can be enhanced)
  const propertyMatches = signature.matchAll(/(\w+)\s*[?:]\s*/g);
  for (const match of propertyMatches) {
    props.push(match[1]);
  }

  return props;
}

/**
 * Detect property type narrowing
 */
function hasNarrowedPropertyTypes(oldSig: string, newSig: string): boolean {
  // This is a simplified implementation
  // In practice, you'd want to parse the AST properly
  const oldContent = oldSig.replace(/\s+/g, " ").trim();
  const newContent = newSig.replace(/\s+/g, " ").trim();

  // If new signature is significantly shorter, likely properties were removed or types narrowed
  return newContent.length < oldContent.length * 0.8;
}

/**
 * Detect structural changes that affect compatibility
 */
function hasStructuralChanges(oldSig: string, newSig: string): boolean {
  // Look for inheritance changes, method signature changes, etc.
  const oldExtends = oldSig.match(/extends\s+(\w+)/);
  const newExtends = newSig.match(/extends\s+(\w+)/);

  if (oldExtends && newExtends && oldExtends[1] !== newExtends[1]) {
    return true; // Changed inheritance
  }

  if (oldExtends && !newExtends) {
    return true; // Removed inheritance
  }

  return false;
}

/**
 * Analyze class signature changes
 */
function analyzeClassSignatureChange(oldSig: string, newSig: string): boolean {
  // Check for constructor changes
  if (hasConstructorChanges(oldSig, newSig)) {
    return true;
  }

  // Check for public method/property removal
  if (hasRemovedPublicMembers(oldSig, newSig)) {
    return true;
  }

  // Check for inheritance changes
  return hasStructuralChanges(oldSig, newSig);
}

/**
 * Detect constructor signature changes
 */
function hasConstructorChanges(oldSig: string, newSig: string): boolean {
  const oldConstructor = oldSig.match(/constructor\s*\([^)]*\)/);
  const newConstructor = newSig.match(/constructor\s*\([^)]*\)/);

  if (!oldConstructor && !newConstructor) {
    return false; // No constructors in either
  }

  if (oldConstructor && !newConstructor) {
    return true; // Constructor removed
  }

  if (!oldConstructor && newConstructor) {
    return false; // Constructor added (not breaking if it has defaults)
  }

  return oldConstructor[0] !== newConstructor[0]; // Constructor changed
}

/**
 * Detect removal of public class members
 */
function hasRemovedPublicMembers(oldSig: string, newSig: string): boolean {
  // Extract public method/property names
  const oldPublicMembers = extractPublicMembers(oldSig);
  const newPublicMembers = extractPublicMembers(newSig);

  return oldPublicMembers.some((member) => !newPublicMembers.includes(member));
}

/**
 * Extract public member names from class signature
 */
function extractPublicMembers(signature: string): string[] {
  const members: string[] = [];

  // Look for public methods and properties
  const memberMatches = signature.matchAll(/(?:public\s+)?(\w+)\s*[(:]/g);
  for (const match of memberMatches) {
    members.push(match[1]);
  }

  return members;
}

/**
 * Fallback analysis for generic signatures
 */
function analyzeGenericSignatureChange(oldSig: string, newSig: string): boolean {
  // Conservative approach for unknown signature types
  const oldContent = oldSig.replace(/\s+/g, " ").trim();
  const newContent = newSig.replace(/\s+/g, " ").trim();

  // Significant length reduction suggests removal (potentially breaking)
  if (newContent.length < oldContent.length * 0.7) {
    return true;
  }

  // Look for common breaking change patterns
  const breakingPatterns = [/removed?\s+\w+/i, /delete[sd]?\s+\w+/i, /deprecated?\s+\w+/i];

  return breakingPatterns.some((pattern) => pattern.test(newSig));
}

/**
 * Generate version plan from changes
 */
/**
 * Extract traceability information for version changes
 */
async function extractVersionTraceability(
  changes: APIChange[],
): Promise<VersionTraceability | undefined> {
  try {
    console.log(chalk.dim("  🔗 Extracting traceability information..."));

    // Load traceability data (mocked - dependency missing)
    const _requirements: any[] = []; // await traceabilityLib.extractRequirements();
    const _specifications: any[] = []; // await traceabilityLib.extractSpecifications();
    const _tests: any[] = []; // await traceabilityLib.extractTests();
    const _codeArtifacts: any[] = []; // await traceabilityLib.extractCodeArtifacts();

    // Build traceability graph (mocked)
    const graph = { nodes: [], links: [] }; // traceabilityLib.buildTraceabilityGraph(requirements, specifications, tests, codeArtifacts);

    // Find related artifacts based on changed components
    const relatedRequirements = new Set<any>();
    const relatedSpecs = new Set<any>();
    const relatedTests = new Set<any>();
    const relatedCode = new Set<any>();

    // Analyze each change for traceability links
    for (const change of changes) {
      const changeSignature = (
        change.oldSignature ||
        change.newSignature ||
        change.description
      ).toLowerCase();

      // Find artifacts that reference this change
      for (const node of graph.nodes) {
        if (
          node.content?.toLowerCase().includes(changeSignature) ||
          node.name?.toLowerCase().includes(changeSignature)
        ) {
          switch (node.nodeType) {
            case "requirement":
              relatedRequirements.add(node);
              break;
            case "specification":
              relatedSpecs.add(node);
              break;
            case "test":
              relatedTests.add(node);
              break;
            case "code":
              relatedCode.add(node);
              break;
          }
        }
      }

      // Also search for links to artifacts that contain the change
      const matchingLinks = graph.links.filter((link) => {
        const sourceNode = graph.nodes.find((n) => n.id === link.source);
        const targetNode = graph.nodes.find((n) => n.id === link.target);

        return (
          sourceNode?.content?.toLowerCase().includes(changeSignature) ||
          sourceNode?.name?.toLowerCase().includes(changeSignature) ||
          targetNode?.content?.toLowerCase().includes(changeSignature) ||
          targetNode?.name?.toLowerCase().includes(changeSignature)
        );
      });

      // Add linked artifacts
      for (const link of matchingLinks) {
        const sourceNode = graph.nodes.find((n) => n.id === link.source);
        const targetNode = graph.nodes.find((n) => n.id === link.target);

        [sourceNode, targetNode].forEach((node) => {
          if (!node) return;

          switch (node.nodeType) {
            case "requirement":
              relatedRequirements.add(node);
              break;
            case "specification":
              relatedSpecs.add(node);
              break;
            case "test":
              relatedTests.add(node);
              break;
            case "code":
              relatedCode.add(node);
              break;
          }
        });
      }
    }

    const traceability: VersionTraceability = {
      requirements: Array.from(relatedRequirements).map((req: any) => ({
        id: req.id,
        content: req.content,
        source: req.source,
        location: req.location,
      })),
      specifications: Array.from(relatedSpecs).map((spec: any) => ({
        id: spec.id,
        content: spec.content,
        source: spec.source,
        type: spec.type,
      })),
      tests: Array.from(relatedTests).map((test: any) => ({
        id: test.id,
        name: test.name || test.content,
        source: test.source,
        type: test.type,
      })),
      code_artifacts: Array.from(relatedCode).map((code: any) => ({
        id: code.id,
        content: code.content,
        source: code.source,
        type: code.type,
      })),
      coverage: {
        requirements_linked: relatedRequirements.size,
        specifications_linked: relatedSpecs.size,
        tests_linked: relatedTests.size,
        code_linked: relatedCode.size,
      },
    };

    console.log(
      chalk.dim(
        `    Found ${traceability.coverage.requirements_linked} requirements, ${traceability.coverage.specifications_linked} specs, ${traceability.coverage.tests_linked} tests, ${traceability.coverage.code_linked} code artifacts`,
      ),
    );

    return traceability;
  } catch (error) {
    console.warn(
      chalk.yellow(
        `⚠️  Could not extract traceability information: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
    return undefined;
  }
}

async function generateVersionPlan(
  changes: APIChange[],
  options: VersionPlanOptions,
): Promise<VersionPlan> {
  const breakingChanges = changes.filter((c) => c.breaking);
  const newFeatures = changes.filter((c) => c.type === "added" && !c.breaking);
  const bugFixes = changes.filter((c) => c.type === "modified" && !c.breaking);

  // Determine required bump
  let requiredBump: VersionBump;
  let rationale: string;

  if (breakingChanges.length > 0) {
    requiredBump = "MAJOR";
    rationale = `${breakingChanges.length} breaking change(s) detected`;
  } else if (newFeatures.length > 0) {
    requiredBump = "MINOR";
    rationale = `${newFeatures.length} new feature(s) added`;
  } else if (bugFixes.length > 0) {
    requiredBump = "PATCH";
    rationale = `${bugFixes.length} bug fix(es) or internal change(s)`;
  } else {
    requiredBump = "PATCH";
    rationale = "No API changes detected, assume internal changes";
  }

  // Generate recommendations
  const recommendations: string[] = [];

  if (options.strict && breakingChanges.length > 0) {
    recommendations.push("STRICT MODE: Breaking changes require explicit MAJOR version bump");
  }

  if (breakingChanges.length > 0) {
    recommendations.push("Update documentation to reflect breaking changes");
    recommendations.push("Consider providing migration guide for users");
  }

  if (newFeatures.length > 5) {
    recommendations.push(
      "Large number of new features - consider splitting into multiple releases",
    );
  }

  // Extract traceability information
  const traceabilityInfo = await extractVersionTraceability(changes);

  // Add traceability-based recommendations
  if (traceabilityInfo) {
    if (traceabilityInfo.coverage.requirements_linked === 0) {
      recommendations.push(
        "Consider linking changes to specific requirements for better traceability",
      );
    }

    if (
      traceabilityInfo.coverage.tests_linked === 0 &&
      (breakingChanges.length > 0 || newFeatures.length > 0)
    ) {
      recommendations.push("Add tests to validate the changes and improve traceability");
    }

    if (traceabilityInfo.requirements.length > 0) {
      recommendations.push(
        `Changes linked to ${traceabilityInfo.requirements.length} requirement(s) - ensure all are addressed`,
      );
    }
  }

  return {
    timestamp: Date.now(),
    required_bump: requiredBump,
    rationale,
    breaking_changes: breakingChanges,
    new_features: newFeatures,
    bug_fixes: bugFixes,
    statistics: {
      total_changes: changes.length,
      breaking_count: breakingChanges.length,
      feature_count: newFeatures.length,
      fix_count: bugFixes.length,
    },
    strict_mode: !!options.strict,
    recommendations,
    traceability: traceabilityInfo,
  };
}

/**
 * Display version plan summary
 */
function displayVersionPlan(plan: VersionPlan, verbose?: boolean): void {
  console.log(chalk.cyan("\n📋 Version Plan Summary:"));
  console.log(
    `  Required bump: ${chalk.bold(getBumpColor(plan.required_bump)(plan.required_bump))}`,
  );
  console.log(`  Rationale: ${plan.rationale}`);

  console.log(chalk.cyan("\n📊 Change Statistics:"));
  console.log(`  Breaking changes: ${chalk.red(plan.statistics.breaking_count)}`);
  console.log(`  New features: ${chalk.green(plan.statistics.feature_count)}`);
  console.log(`  Bug fixes: ${chalk.blue(plan.statistics.fix_count)}`);
  console.log(`  Total changes: ${plan.statistics.total_changes}`);

  if (plan.strict_mode) {
    console.log(chalk.yellow("\n⚠️  STRICT MODE ENABLED"));
  }

  if (plan.recommendations.length > 0) {
    console.log(chalk.cyan("\n💡 Recommendations:"));
    plan.recommendations.forEach((rec) => {
      console.log(`  • ${rec}`);
    });
  }

  // Display traceability information
  if (plan.traceability) {
    const trace = plan.traceability;
    console.log(chalk.cyan("\n🔗 Traceability Information:"));

    if (trace.coverage.requirements_linked > 0) {
      console.log(`  Requirements linked: ${chalk.green(trace.coverage.requirements_linked)}`);
    }
    if (trace.coverage.specifications_linked > 0) {
      console.log(`  Specifications linked: ${chalk.blue(trace.coverage.specifications_linked)}`);
    }
    if (trace.coverage.tests_linked > 0) {
      console.log(`  Tests linked: ${chalk.yellow(trace.coverage.tests_linked)}`);
    }
    if (trace.coverage.code_linked > 0) {
      console.log(`  Code artifacts linked: ${chalk.magenta(trace.coverage.code_linked)}`);
    }

    if (verbose && trace.requirements.length > 0) {
      console.log(chalk.cyan("\n📋 Related Requirements:"));
      trace.requirements.slice(0, 3).forEach((req) => {
        console.log(
          `  • ${chalk.bold(req.id)}: ${req.content.substring(0, 80)}${req.content.length > 80 ? "..." : ""}`,
        );
        console.log(chalk.dim(`    Source: ${req.source}:${req.location.line}`));
      });

      if (trace.requirements.length > 3) {
        console.log(chalk.dim(`    ... and ${trace.requirements.length - 3} more requirements`));
      }
    }
  } else {
    console.log(chalk.dim("\n🔗 No traceability information available"));
  }

  if (verbose && (plan.breaking_changes.length > 0 || plan.new_features.length > 0)) {
    if (plan.breaking_changes.length > 0) {
      console.log(chalk.red("\n💥 Breaking Changes:"));
      plan.breaking_changes.forEach((change) => {
        console.log(`  • ${change.description}`);
        if (change.oldSignature && change.newSignature) {
          console.log(chalk.dim(`    Old: ${change.oldSignature}`));
          console.log(chalk.dim(`    New: ${change.newSignature}`));
        }
      });
    }

    if (plan.new_features.length > 0 && verbose) {
      console.log(chalk.green("\n✨ New Features:"));
      plan.new_features.slice(0, 5).forEach((change) => {
        console.log(`  • ${change.description}`);
      });

      if (plan.new_features.length > 5) {
        console.log(chalk.dim(`    ... and ${plan.new_features.length - 5} more`));
      }
    }
  }
}

/**
 * Get color for version bump type
 */
function getBumpColor(bump: VersionBump): (text: string) => string {
  switch (bump) {
    case "MAJOR":
      return chalk.red;
    case "MINOR":
      return chalk.yellow;
    case "PATCH":
      return chalk.green;
  }
}

/**
 * Manifest detection configuration
 */
interface ManifestConfig {
  filePath: string;
  type: string;
  versionField: string;
  parser: (content: string) => string | undefined;
}

/**
 * Parse version from package.json content
 */
function parsePackageJsonVersion(content: string): string | undefined {
  try {
    const pkg = JSON.parse(content);
    return pkg.version;
  } catch {
    return undefined;
  }
}

/**
 * Parse version from TOML-style content
 */
function parseTomlVersion(content: string): string | undefined {
  const versionMatch = content.match(/version\s*=\s*"([^"]+)"/);
  return versionMatch?.[1];
}

/**
 * Check if manifest file exists and attempt to parse it
 */
async function checkManifestFile(config: ManifestConfig): Promise<ManifestInfo | null> {
  if (!existsSync(config.filePath)) {
    return null;
  }

  try {
    const content = await readFile(config.filePath, "utf-8");
    const version = config.parser(content);

    return {
      type: config.type as ManifestInfo["type"],
      path: config.filePath,
      current_version: version,
      version_field: config.versionField,
    };
  } catch (_error) {
    console.warn(chalk.yellow(`Warning: Could not parse ${config.filePath}`));
    return null;
  }
}

/**
 * Create Go manifest info (no file parsing needed)
 */
function createGoManifest(): ManifestInfo | null {
  if (!existsSync("go.mod")) {
    return null;
  }

  return {
    type: "go",
    path: "go.mod",
    current_version: undefined, // Go uses git tags
    version_field: "git-tag",
  };
}

/**
 * Get all manifest configurations to check
 */
function getManifestConfigs(): ManifestConfig[] {
  return [
    {
      filePath: "package.json",
      type: "npm",
      versionField: "version",
      parser: parsePackageJsonVersion,
    },
    {
      filePath: "pyproject.toml",
      type: "python",
      versionField: "project.version",
      parser: parseTomlVersion,
    },
    {
      filePath: "Cargo.toml",
      type: "rust",
      versionField: "package.version",
      parser: parseTomlVersion,
    },
  ];
}

/**
 * Detect manifests in current directory
 */
async function detectManifests(): Promise<ManifestInfo[]> {
  const manifests: ManifestInfo[] = [];
  const configs = getManifestConfigs();

  // Check standard manifest files
  for (const config of configs) {
    const manifest = await checkManifestFile(config);
    if (manifest) {
      manifests.push(manifest);
    }
  }

  // Check Go manifest (special case)
  const goManifest = createGoManifest();
  if (goManifest) {
    manifests.push(goManifest);
  }

  return manifests;
}

/**
 * Calculate next version based on current version and bump type
 */
function calculateNextVersion(currentVersion: string, bump: VersionBump): string {
  const parts = currentVersion.replace(/^v/, "").split(".").map(Number);

  // Ensure we have at least 3 parts
  while (parts.length < 3) {
    parts.push(0);
  }

  switch (bump) {
    case "MAJOR":
      return `${parts[0] + 1}.0.0`;
    case "MINOR":
      return `${parts[0]}.${parts[1] + 1}.0`;
    case "PATCH":
      return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
  }
}

/**
 * Update manifest file with new version
 */
async function updateManifest(
  manifest: ManifestInfo,
  version: string,
  isDryRun: boolean,
  verbose?: boolean,
): Promise<void> {
  try {
    if (manifest.type === "go") {
      // Go uses git tags, not file updates
      console.log(`  ${manifest.type}: Use git tag v${version} (no file changes needed)`);
      return;
    }

    const content = await readFile(manifest.path, "utf-8");
    let newContent: string;

    switch (manifest.type) {
      case "npm": {
        const pkg = JSON.parse(content);
        pkg.version = version;
        newContent = `${JSON.stringify(pkg, null, 2)}\n`;
        break;
      }

      case "python": {
        newContent = content.replace(/version\s*=\s*"[^"]+"/, `version = "${version}"`);
        break;
      }

      case "rust": {
        newContent = content.replace(/version\s*=\s*"[^"]+"/, `version = "${version}"`);
        break;
      }

      default:
        throw new Error(`Unsupported manifest type: ${manifest.type}`);
    }

    const oldVersion = manifest.current_version || "unknown";
    console.log(`  ${manifest.type}: ${oldVersion} → ${version}`);

    if (verbose && isDryRun) {
      console.log(chalk.dim(`    Path: ${manifest.path}`));
      console.log(chalk.dim(`    Field: ${manifest.version_field}`));
    }

    if (!isDryRun) {
      await writeFile(manifest.path, newContent);
      console.log(chalk.green(`    ✅ ${manifest.path} updated`));
    } else {
      console.log(chalk.yellow(`    📋 Would update ${manifest.path}`));
    }
  } catch (error) {
    console.error(chalk.red(`    ❌ Failed to update ${manifest.path}:`), error);
  }
}

/**
 * Generate changelog from version plan
 */
async function generateChangelog(
  plan: VersionPlan,
  version: string,
  path: string,
  isDryRun: boolean,
): Promise<void> {
  const date = new Date().toISOString().split("T")[0];

  let changelogEntry = `## [${version}] - ${date}\n\n`;

  if (plan.breaking_changes.length > 0) {
    changelogEntry += "### 💥 BREAKING CHANGES\n\n";
    plan.breaking_changes.forEach((change) => {
      changelogEntry += `- ${change.description}\n`;
      if (change.oldSignature && change.newSignature) {
        changelogEntry += `  - **Before:** \`${change.oldSignature}\`\n`;
        changelogEntry += `  - **After:** \`${change.newSignature}\`\n`;
      }
    });
    changelogEntry += "\n";
  }

  if (plan.new_features.length > 0) {
    changelogEntry += "### ✨ Features\n\n";
    plan.new_features.forEach((change) => {
      changelogEntry += `- ${change.description}\n`;
    });
    changelogEntry += "\n";
  }

  if (plan.bug_fixes.length > 0) {
    changelogEntry += "### 🐛 Bug Fixes\n\n";
    plan.bug_fixes.forEach((change) => {
      changelogEntry += `- ${change.description}\n`;
    });
    changelogEntry += "\n";
  }

  // Add traceability information
  if (
    plan.traceability &&
    (plan.traceability.requirements.length > 0 || plan.traceability.tests.length > 0)
  ) {
    changelogEntry += "### 🔗 Traceability\n\n";

    if (plan.traceability.requirements.length > 0) {
      changelogEntry += "**Related Requirements:**\n";
      plan.traceability.requirements.slice(0, 5).forEach((req) => {
        const shortContent =
          req.content.length > 60 ? `${req.content.substring(0, 60)}...` : req.content;
        changelogEntry += `- [${req.id}](${req.source}#L${req.location.line}): ${shortContent}\n`;
      });

      if (plan.traceability.requirements.length > 5) {
        changelogEntry += `- _... and ${plan.traceability.requirements.length - 5} more requirements_\n`;
      }
      changelogEntry += "\n";
    }

    if (plan.traceability.tests.length > 0) {
      changelogEntry += "**Validation Tests:**\n";
      plan.traceability.tests.slice(0, 3).forEach((test) => {
        changelogEntry += `- [${test.id}](${test.source}): ${test.name}\n`;
      });

      if (plan.traceability.tests.length > 3) {
        changelogEntry += `- _... and ${plan.traceability.tests.length - 3} more tests_\n`;
      }
      changelogEntry += "\n";
    }
  }

  // Add statistics
  changelogEntry += "### 📊 Statistics\n\n";
  changelogEntry += `- Total changes: ${plan.statistics.total_changes}\n`;
  changelogEntry += `- API additions: ${plan.statistics.feature_count}\n`;
  changelogEntry += `- Breaking changes: ${plan.statistics.breaking_count}\n`;
  changelogEntry += `- Fixes/improvements: ${plan.statistics.fix_count}\n`;

  if (plan.traceability) {
    changelogEntry += `- Requirements linked: ${plan.traceability.coverage.requirements_linked}\n`;
    changelogEntry += `- Tests linked: ${plan.traceability.coverage.tests_linked}\n`;
  }

  changelogEntry += "\n";

  if (isDryRun) {
    console.log(chalk.cyan("📝 Changelog preview:"));
    console.log(chalk.dim("─".repeat(60)));
    console.log(changelogEntry.trim());
    console.log(chalk.dim("─".repeat(60)));
  } else {
    // Prepend to existing changelog or create new one
    let existingContent = "";
    if (existsSync(path)) {
      existingContent = await readFile(path, "utf-8");
    } else {
      existingContent = "# Changelog\n\n";
    }

    // Insert new entry after title
    const lines = existingContent.split("\n");
    const titleIndex = lines.findIndex((line) => line.startsWith("# "));

    if (titleIndex !== -1) {
      lines.splice(titleIndex + 2, 0, changelogEntry.trim(), "");
    } else {
      lines.unshift(changelogEntry.trim(), "");
    }

    await writeFile(path, lines.join("\n"));
  }
}
