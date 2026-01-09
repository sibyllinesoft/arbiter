/**
 * @packageDocumentation
 * Change analysis utilities for schema diff.
 *
 * Provides functionality to:
 * - Categorize schema changes
 * - Determine change impact (breaking, compatible, neutral)
 * - Generate migration hints
 * - Format diff output
 */

import chalk from "chalk";
import type { DiffOptions, SchemaChange, SchemaDiff } from "./index.js";

/**
 * Determine category from key path.
 */
export function getCategoryFromKey(key: string): SchemaChange["category"] {
  if (key === "package") return "package";
  if (key.startsWith("import.")) return "import";
  if (key.startsWith("constraint.")) return "constraint";
  if (key.includes("validation") || key.includes("rules") || key.includes("limit"))
    return "constraint";
  return "field";
}

/**
 * Extract numeric value from constraint.
 */
export function extractNumericValue(value: string): number | null {
  const numMatch = value.match(/([><]=?)\s*([0-9]+(?:\.[0-9]+)?)/);
  return numMatch ? Number.parseFloat(numMatch[2]) : null;
}

/**
 * Extract type from value.
 */
export function extractType(value: string): string | null {
  const typeMatch = value.match(/\b(string|number|bool|int|float)\b/);
  return typeMatch ? typeMatch[1] : null;
}

/**
 * Compare numeric limits for tightness based on operator type.
 */
function isNumericLimitTighter(
  oldValue: string,
  newValue: string,
  oldLimit: number,
  newLimit: number,
): boolean | null {
  if (oldValue.includes(">") && newValue.includes(">")) {
    return newLimit > oldLimit;
  }
  if (oldValue.includes("<") && newValue.includes("<")) {
    return newLimit < oldLimit;
  }
  return null;
}

/**
 * Check if constraint became tighter.
 */
export function isConstraintTighter(oldValue: string, newValue: string): boolean {
  const oldLimit = extractNumericValue(oldValue);
  const newLimit = extractNumericValue(newValue);

  if (oldLimit !== null && newLimit !== null) {
    const numericResult = isNumericLimitTighter(oldValue, newValue, oldLimit, newLimit);
    if (numericResult !== null) return numericResult;
  }

  const oldConstraints = oldValue.split("&").length;
  const newConstraints = newValue.split("&").length;
  return newConstraints > oldConstraints;
}

/**
 * Check if there's a type change.
 */
export function hasTypeChange(oldValue: string, newValue: string): boolean {
  const oldType = extractType(oldValue);
  const newType = extractType(newValue);
  return oldType !== newType && oldType !== null && newType !== null;
}

/**
 * Determine impact of removal.
 */
export function getRemovalImpact(key: string, _value: string): SchemaChange["impact"] {
  if (key.startsWith("constraint.") || key.includes("validation") || key.includes("required")) {
    return "breaking";
  }
  if (key.startsWith("import.")) {
    return "breaking";
  }
  return "compatible";
}

/**
 * Determine impact of addition.
 */
export function getAdditionImpact(key: string, value: string): SchemaChange["impact"] {
  if (key.includes("required") || (key.includes("constraint") && value.includes("&"))) {
    return "breaking";
  }
  return "compatible";
}

/**
 * Determine impact of modification.
 */
export function getModificationImpact(
  key: string,
  oldValue: string,
  newValue: string,
): SchemaChange["impact"] {
  if (key.includes("limit") || key.includes("constraint")) {
    if (isConstraintTighter(oldValue, newValue)) {
      return "breaking";
    }
  }

  if (hasTypeChange(oldValue, newValue)) {
    return "breaking";
  }

  return "compatible";
}

/**
 * Generate migration hint for removal.
 */
export function getRemovalMigrationHint(key: string, value: string): string {
  if (key.startsWith("constraint.")) {
    return `Update existing data to work without the ${key.replace("constraint.", "")} constraint`;
  }
  if (key.startsWith("import.")) {
    return `Remove usage of ${value} from dependent schemas`;
  }
  return `Remove references to ${key} from configuration values`;
}

/**
 * Generate migration hint for addition.
 */
export function getAdditionMigrationHint(key: string, _value: string): string {
  if (key.includes("required") || key.includes("constraint")) {
    return `Ensure existing data satisfies the new ${key} constraint`;
  }
  return `New field ${key} is available for use`;
}

/**
 * Generate migration hint for modification.
 */
export function getModificationMigrationHint(
  key: string,
  oldValue: string,
  newValue: string,
): string {
  if (isConstraintTighter(oldValue, newValue)) {
    return `Update existing data to satisfy stricter constraint: ${newValue}`;
  }
  if (hasTypeChange(oldValue, newValue)) {
    return `Convert existing values from ${extractType(oldValue)} to ${extractType(newValue)}`;
  }
  return `Update references to ${key} to use new value: ${newValue}`;
}

/** Impact ordering for sorting */
export const IMPACT_ORDER: Record<SchemaChange["impact"], number> = {
  breaking: 0,
  compatible: 1,
  neutral: 2,
};

/**
 * Sort changes by impact (breaking first).
 */
export function sortChangesByImpact(changes: SchemaChange[]): SchemaChange[] {
  return changes.sort((a, b) => {
    if (IMPACT_ORDER[a.impact] !== IMPACT_ORDER[b.impact]) {
      return IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact];
    }
    return a.location.localeCompare(b.location);
  });
}

/**
 * Create a removed change entry.
 */
export function createRemovedChange(key: string, oldValue: string): SchemaChange {
  const category = getCategoryFromKey(key);
  return {
    type: "removed",
    category,
    location: key,
    old_value: oldValue,
    impact: getRemovalImpact(key, oldValue),
    description: `Removed ${category}: ${key}`,
    migration_hint: getRemovalMigrationHint(key, oldValue),
  };
}

/**
 * Create an added change entry.
 */
export function createAddedChange(key: string, newValue: string): SchemaChange {
  const category = getCategoryFromKey(key);
  return {
    type: "added",
    category,
    location: key,
    new_value: newValue,
    impact: getAdditionImpact(key, newValue),
    description: `Added ${category}: ${key}`,
    migration_hint: getAdditionMigrationHint(key, newValue),
  };
}

/**
 * Create a modified change entry.
 */
export function createModifiedChange(
  key: string,
  oldValue: string,
  newValue: string,
): SchemaChange {
  const category = getCategoryFromKey(key);
  return {
    type: "modified",
    category,
    location: key,
    old_value: oldValue,
    new_value: newValue,
    impact: getModificationImpact(key, oldValue, newValue),
    description: `Modified ${category}: ${key}`,
    migration_hint: getModificationMigrationHint(key, oldValue, newValue),
  };
}

/**
 * Get appropriate color for compatibility score.
 */
export function getCompatibilityColor(score: number): string {
  if (score >= 80) return chalk.green.toString();
  if (score >= 60) return chalk.yellow.toString();
  return chalk.red.toString();
}

/**
 * Get icon for change type and impact.
 */
export function getChangeIcon(type: SchemaChange["type"], impact: SchemaChange["impact"]): string {
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
 * Get color for change impact.
 */
export function getChangeColor(impact: SchemaChange["impact"]): typeof chalk.green {
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
 * Get impact label.
 */
export function getImpactLabel(impact: SchemaChange["impact"]): string {
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

function formatDiffSummary(diff: SchemaDiff): string {
  let output = chalk.cyan("Schema Evolution Analysis\n");
  output += `${chalk.dim("=".repeat(50))}\n\n`;
  output += chalk.bold("Summary:\n");
  output += `  Total changes: ${diff.summary.total_changes}\n`;
  output += `  Breaking changes: ${chalk.red(diff.summary.breaking_changes)}\n`;
  output += `  Added: ${chalk.green(diff.summary.added)}\n`;
  output += `  Removed: ${chalk.red(diff.summary.removed)}\n`;
  output += `  Modified: ${chalk.yellow(diff.summary.modified)}\n`;
  output += `  Compatibility score: ${getCompatibilityColor(diff.compatibility_score)}${diff.compatibility_score}/100${chalk.reset()}\n`;
  output += `  Migration needed: ${diff.migration_needed ? chalk.red("Yes") : chalk.green("No")}\n\n`;
  return output;
}

function formatSingleChange(change: SchemaChange, showMigration: boolean): string {
  const icon = getChangeIcon(change.type, change.impact);
  const color = getChangeColor(change.impact);

  let output = `${icon} ${color}${change.description}${chalk.reset()}\n`;
  output += `  Location: ${chalk.dim(change.location)}\n`;

  if (change.old_value) {
    output += `  Old: ${chalk.red(change.old_value)}\n`;
  }
  if (change.new_value) {
    output += `  New: ${chalk.green(change.new_value)}\n`;
  }

  output += `  Impact: ${getImpactLabel(change.impact)}\n`;

  if (showMigration && change.migration_hint) {
    output += `  Migration: ${chalk.yellow(change.migration_hint)}\n`;
  }

  output += "\n";
  return output;
}

/**
 * Format diff for text output.
 */
export function formatDiffText(diff: SchemaDiff, options: DiffOptions): string {
  let output = formatDiffSummary(diff);

  if (options.summary) {
    return output;
  }

  if (diff.changes.length === 0) {
    return output + chalk.green("✓ No changes detected\n");
  }

  output += chalk.bold("Changes:\n\n");
  for (const change of diff.changes) {
    output += formatSingleChange(change, options.migration ?? false);
  }

  return output;
}
