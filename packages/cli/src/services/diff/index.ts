import fs from "node:fs/promises";
import path from "node:path";
import { safeFileOperation } from "@/constraints/index.js";
import chalk from "chalk";

export interface DiffOptions {
  migration?: boolean;
  format?: "text" | "json";
  context?: number;
  summary?: boolean;
}

export interface SchemaChange {
  type: "added" | "removed" | "modified";
  category: "constraint" | "field" | "import" | "package" | "comment";
  location: string;
  old_value?: string;
  new_value?: string;
  impact: "breaking" | "compatible" | "neutral";
  description: string;
  line_number?: number;
  migration_hint?: string;
}

export interface SchemaDiff {
  summary: {
    total_changes: number;
    breaking_changes: number;
    added: number;
    removed: number;
    modified: number;
  };
  changes: SchemaChange[];
  migration_needed: boolean;
  compatibility_score: number; // 0-100, higher is more compatible
}

/**
 * Parse CUE file and extract structural information
 */
export async function parseCueStructure(filePath: string): Promise<Map<string, string>> {
  const content = await fs.readFile(filePath, "utf-8");
  const lines = content.split("\n");
  const structure = new Map<string, string>();

  const currentPath: string[] = [];
  let inMultiLineComment = false;
  let _braceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const _lineNumber = i + 1;

    // Skip empty lines
    if (!trimmed) continue;

    // Handle multi-line comments
    if (trimmed.includes("/*")) {
      inMultiLineComment = true;
      continue;
    }
    if (trimmed.includes("*/")) {
      inMultiLineComment = false;
      continue;
    }
    if (inMultiLineComment) continue;

    // Skip single-line comments
    if (trimmed.startsWith("//")) continue;

    // Package declaration
    if (trimmed.startsWith("package ")) {
      const packageName = trimmed.replace("package ", "");
      structure.set("package", packageName);
      continue;
    }

    // Import statements
    if (trimmed.startsWith("import ")) {
      const importMatch = trimmed.match(/import\s+(?:(\w+)\s+)?"([^"]+)"/);
      if (importMatch) {
        const importPath = importMatch[2];
        const importAlias = importMatch[1] || path.basename(importPath);
        structure.set(`import.${importAlias}`, importPath);
      }
      continue;
    }

    // Field definitions and constraints
    const fieldMatch = trimmed.match(/^(\w+):\s*(.+)$/);
    if (fieldMatch) {
      const fieldName = fieldMatch[1];
      const fieldValue = fieldMatch[2];
      const fullPath = currentPath.length > 0 ? `${currentPath.join(".")}.${fieldName}` : fieldName;
      structure.set(fullPath, fieldValue);
      continue;
    }

    // Constraint definitions (starting with #)
    const constraintMatch = trimmed.match(/^#(\w+):\s*\{?(.*)$/);
    if (constraintMatch) {
      const constraintName = constraintMatch[1];
      const constraintValue = constraintMatch[2];
      structure.set(`constraint.${constraintName}`, constraintValue);
      if (trimmed.endsWith("{")) {
        currentPath.push(`constraint.${constraintName}`);
        _braceDepth++;
      }
      continue;
    }

    // Handle braces for nesting
    const openBraces = (line.match(/\{/g) || []).length;
    const closeBraces = (line.match(/\}/g) || []).length;

    _braceDepth += openBraces - closeBraces;

    if (closeBraces > 0) {
      // Pop from current path for each closing brace
      for (let j = 0; j < closeBraces; j++) {
        if (currentPath.length > 0) {
          currentPath.pop();
        }
      }
    }

    if (openBraces > closeBraces) {
      // This line opened more braces than it closed
      const fieldName = trimmed.replace(/\s*\{.*$/, "").replace(/:.*$/, "");
      if (fieldName && fieldName !== trimmed) {
        const fullPath =
          currentPath.length > 0 ? `${currentPath.join(".")}.${fieldName}` : fieldName;
        currentPath.push(fullPath);
      }
    }
  }

  return structure;
}

/**
 * Compare two schema structures and generate diff
 */
export function compareSchemas(
  oldStructure: Map<string, string>,
  newStructure: Map<string, string>,
): SchemaChange[] {
  const changes: SchemaChange[] = [];
  const allKeys = new Set([...oldStructure.keys(), ...newStructure.keys()]);

  for (const key of allKeys) {
    const oldValue = oldStructure.get(key);
    const newValue = newStructure.get(key);

    if (oldValue && !newValue) {
      // Field was removed
      const change: SchemaChange = {
        type: "removed",
        category: getCategoryFromKey(key),
        location: key,
        old_value: oldValue,
        impact: getRemovalImpact(key, oldValue),
        description: `Removed ${getCategoryFromKey(key)}: ${key}`,
        migration_hint: getRemovalMigrationHint(key, oldValue),
      };
      changes.push(change);
    } else if (!oldValue && newValue) {
      // Field was added
      const change: SchemaChange = {
        type: "added",
        category: getCategoryFromKey(key),
        location: key,
        new_value: newValue,
        impact: getAdditionImpact(key, newValue),
        description: `Added ${getCategoryFromKey(key)}: ${key}`,
        migration_hint: getAdditionMigrationHint(key, newValue),
      };
      changes.push(change);
    } else if (oldValue && newValue && oldValue !== newValue) {
      // Field was modified
      const change: SchemaChange = {
        type: "modified",
        category: getCategoryFromKey(key),
        location: key,
        old_value: oldValue,
        new_value: newValue,
        impact: getModificationImpact(key, oldValue, newValue),
        description: `Modified ${getCategoryFromKey(key)}: ${key}`,
        migration_hint: getModificationMigrationHint(key, oldValue, newValue),
      };
      changes.push(change);
    }
  }

  return changes.sort((a, b) => {
    // Sort by impact (breaking first), then by location
    const impactOrder = { breaking: 0, compatible: 1, neutral: 2 };
    if (impactOrder[a.impact] !== impactOrder[b.impact]) {
      return impactOrder[a.impact] - impactOrder[b.impact];
    }
    return a.location.localeCompare(b.location);
  });
}

/**
 * Determine category from key path
 */
function getCategoryFromKey(key: string): SchemaChange["category"] {
  if (key === "package") return "package";
  if (key.startsWith("import.")) return "import";
  if (key.startsWith("constraint.")) return "constraint";
  if (key.includes("validation") || key.includes("rules") || key.includes("limit"))
    return "constraint";
  return "field";
}

/**
 * Determine impact of removal
 */
function getRemovalImpact(key: string, _value: string): SchemaChange["impact"] {
  if (key.startsWith("constraint.") || key.includes("validation") || key.includes("required")) {
    return "breaking";
  }
  if (key.startsWith("import.")) {
    return "breaking";
  }
  return "compatible";
}

/**
 * Determine impact of addition
 */
function getAdditionImpact(key: string, value: string): SchemaChange["impact"] {
  if (key.includes("required") || (key.includes("constraint") && value.includes("&"))) {
    return "breaking";
  }
  return "compatible";
}

/**
 * Determine impact of modification
 */
function getModificationImpact(
  key: string,
  oldValue: string,
  newValue: string,
): SchemaChange["impact"] {
  // Check for constraint tightening
  if (key.includes("limit") || key.includes("constraint")) {
    if (isConstraintTighter(oldValue, newValue)) {
      return "breaking";
    }
  }

  // Check for type changes
  if (hasTypeChange(oldValue, newValue)) {
    return "breaking";
  }

  return "compatible";
}

/**
 * Check if constraint became tighter
 */
function isConstraintTighter(oldValue: string, newValue: string): boolean {
  // Extract numeric limits
  const oldLimit = extractNumericValue(oldValue);
  const newLimit = extractNumericValue(newValue);

  if (oldLimit !== null && newLimit !== null) {
    // Check if limit became stricter
    if (oldValue.includes(">") && newValue.includes(">")) {
      return newLimit > oldLimit; // Higher minimum is stricter
    }
    if (oldValue.includes("<") && newValue.includes("<")) {
      return newLimit < oldLimit; // Lower maximum is stricter
    }
  }

  // Check for additional constraints
  const oldConstraints = oldValue.split("&").length;
  const newConstraints = newValue.split("&").length;
  return newConstraints > oldConstraints;
}

/**
 * Check if there's a type change
 */
function hasTypeChange(oldValue: string, newValue: string): boolean {
  const oldType = extractType(oldValue);
  const newType = extractType(newValue);
  return oldType !== newType && oldType !== null && newType !== null;
}

/**
 * Extract numeric value from constraint
 */
function extractNumericValue(value: string): number | null {
  const numMatch = value.match(/([><]=?)\s*([0-9]+(?:\.[0-9]+)?)/);
  return numMatch ? Number.parseFloat(numMatch[2]) : null;
}

/**
 * Extract type from value
 */
function extractType(value: string): string | null {
  const typeMatch = value.match(/\b(string|number|bool|int|float)\b/);
  return typeMatch ? typeMatch[1] : null;
}

/**
 * Generate migration hints
 */
function getRemovalMigrationHint(key: string, value: string): string {
  if (key.startsWith("constraint.")) {
    return `Update existing data to work without the ${key.replace("constraint.", "")} constraint`;
  }
  if (key.startsWith("import.")) {
    return `Remove usage of ${value} from dependent schemas`;
  }
  return `Remove references to ${key} from configuration values`;
}

function getAdditionMigrationHint(key: string, _value: string): string {
  if (key.includes("required") || key.includes("constraint")) {
    return `Ensure existing data satisfies the new ${key} constraint`;
  }
  return `New field ${key} is available for use`;
}

function getModificationMigrationHint(key: string, oldValue: string, newValue: string): string {
  if (isConstraintTighter(oldValue, newValue)) {
    return `Update existing data to satisfy stricter constraint: ${newValue}`;
  }
  if (hasTypeChange(oldValue, newValue)) {
    return `Convert existing values from ${extractType(oldValue)} to ${extractType(newValue)}`;
  }
  return `Update references to ${key} to use new value: ${newValue}`;
}

/**
 * Calculate compatibility score
 */
export function calculateCompatibilityScore(changes: SchemaChange[]): number {
  if (changes.length === 0) return 100;

  let score = 100;
  for (const change of changes) {
    switch (change.impact) {
      case "breaking":
        score -= 20;
        break;
      case "compatible":
        score -= 5;
        break;
      case "neutral":
        score -= 1;
        break;
    }
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Generate diff summary
 */
function generateSummary(changes: SchemaChange[]): SchemaDiff["summary"] {
  const summary = {
    total_changes: changes.length,
    breaking_changes: changes.filter((c) => c.impact === "breaking").length,
    added: changes.filter((c) => c.type === "added").length,
    removed: changes.filter((c) => c.type === "removed").length,
    modified: changes.filter((c) => c.type === "modified").length,
  };

  return summary;
}

/**
 * Format diff for text output
 */
function formatDiffText(diff: SchemaDiff, options: DiffOptions): string {
  let output = "";

  // Header
  output += chalk.cyan("Schema Evolution Analysis\n");
  output += `${chalk.dim("=".repeat(50))}\n\n`;

  // Summary
  output += chalk.bold("Summary:\n");
  output += `  Total changes: ${diff.summary.total_changes}\n`;
  output += `  Breaking changes: ${chalk.red(diff.summary.breaking_changes)}\n`;
  output += `  Added: ${chalk.green(diff.summary.added)}\n`;
  output += `  Removed: ${chalk.red(diff.summary.removed)}\n`;
  output += `  Modified: ${chalk.yellow(diff.summary.modified)}\n`;
  output += `  Compatibility score: ${getCompatibilityColor(diff.compatibility_score)}${diff.compatibility_score}/100${chalk.reset()}\n`;
  output += `  Migration needed: ${diff.migration_needed ? chalk.red("Yes") : chalk.green("No")}\n\n`;

  if (options.summary) {
    return output;
  }

  // Changes
  if (diff.changes.length > 0) {
    output += chalk.bold("Changes:\n\n");

    for (const change of diff.changes) {
      const icon = getChangeIcon(change.type, change.impact);
      const color = getChangeColor(change.impact);

      output += `${icon} ${color}${change.description}${chalk.reset()}\n`;
      output += `  Location: ${chalk.dim(change.location)}\n`;

      if (change.old_value) {
        output += `  Old: ${chalk.red(change.old_value)}\n`;
      }
      if (change.new_value) {
        output += `  New: ${chalk.green(change.new_value)}\n`;
      }

      output += `  Impact: ${getImpactLabel(change.impact)}\n`;

      if (options.migration && change.migration_hint) {
        output += `  Migration: ${chalk.yellow(change.migration_hint)}\n`;
      }

      output += "\n";
    }
  } else {
    output += chalk.green("✓ No changes detected\n");
  }

  return output;
}

/**
 * Get appropriate color for compatibility score
 */
function getCompatibilityColor(score: number): string {
  if (score >= 80) return chalk.green.toString();
  if (score >= 60) return chalk.yellow.toString();
  return chalk.red.toString();
}

/**
 * Get icon for change type and impact
 */
function getChangeIcon(type: SchemaChange["type"], impact: SchemaChange["impact"]): string {
  if (impact === "breaking") return chalk.red("💥");

  switch (type) {
    case "added":
      return chalk.green("➕");
    case "removed":
      return chalk.red("➖");
    case "modified":
      return chalk.yellow("🔧");
    default:
      return "•";
  }
}

/**
 * Get color for change impact
 */
function getChangeColor(impact: SchemaChange["impact"]): typeof chalk.green {
  switch (impact) {
    case "breaking":
      return chalk.red;
    case "compatible":
      return chalk.green;
    case "neutral":
      return chalk.dim;
    default:
      return chalk.white;
  }
}

/**
 * Get impact label
 */
function getImpactLabel(impact: SchemaChange["impact"]): string {
  switch (impact) {
    case "breaking":
      return chalk.red("BREAKING");
    case "compatible":
      return chalk.green("Compatible");
    case "neutral":
      return chalk.dim("Neutral");
    default:
      return "Unknown";
  }
}

/**
 * Generate migration script
 */
export function generateMigrationScript(diff: SchemaDiff): string {
  const breakingChanges = diff.changes.filter((c) => c.impact === "breaking");
  if (breakingChanges.length === 0) {
    return "# No migration needed - all changes are backward compatible\n";
  }

  let script = "# Schema Migration Script\n";
  script += `# Generated: ${new Date().toISOString()}\n\n`;
  script += "# Breaking changes require manual review and data migration\n\n";

  for (const change of breakingChanges) {
    script += `# ${change.description}\n`;
    script += `# Location: ${change.location}\n`;
    if (change.migration_hint) {
      script += `# Action required: ${change.migration_hint}\n`;
    }
    script += "\n";
  }

  return script;
}

/**
 * Diff command - Compare two schemas
 */
export async function diffCommand(
  oldFile: string,
  newFile: string,
  options: DiffOptions = {},
): Promise<number> {
  const structuredOutput = options.format === "json";
  try {
    // Check if files exist
    try {
      await fs.access(oldFile);
      await fs.access(newFile);
    } catch (error) {
      console.error(
        chalk.red("File not found:"),
        error instanceof Error ? error.message : String(error),
      );
      return 1;
    }

    if (!structuredOutput) {
      console.log(chalk.dim(`Comparing ${oldFile} → ${newFile}`));
      console.log();
    }

    // Parse both schemas
    const oldStructure = await parseCueStructure(oldFile);
    const newStructure = await parseCueStructure(newFile);

    // Generate diff
    const changes = compareSchemas(oldStructure, newStructure);
    const summary = generateSummary(changes);
    const compatibilityScore = calculateCompatibilityScore(changes);
    const migrationNeeded = changes.some((c) => c.impact === "breaking");

    const diff: SchemaDiff = {
      summary,
      changes,
      migration_needed: migrationNeeded,
      compatibility_score: compatibilityScore,
    };

    // Output results
    if (structuredOutput) {
      console.log(JSON.stringify(diff, null, 2));
    } else {
      console.log(formatDiffText(diff, options));
    }

    // Generate migration script if requested
    if (options.migration && diff.migration_needed) {
      const migrationScript = generateMigrationScript(diff);
      const migrationPath = `${path.basename(newFile, ".cue")}-migration.md`;
      await safeFileOperation("write", migrationPath, async (validatedPath) => {
        await fs.writeFile(validatedPath, migrationScript, "utf-8");
      });

      if (!structuredOutput) {
        console.log(chalk.green(`✓ Migration guide created: ${migrationPath}`));
      }
    }

    return diff.migration_needed ? 1 : 0;
  } catch (error) {
    console.error(
      chalk.red("Error comparing schemas:"),
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}
