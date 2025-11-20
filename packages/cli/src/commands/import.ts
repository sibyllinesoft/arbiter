import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import chalk from "chalk";
import { safeFileOperation } from "../constraints/index.js";

export interface ImportOptions {
  global?: boolean;
  list?: boolean;
  remove?: boolean;
  validate?: boolean;
  allow?: string[];
}

export interface ImportRegistry {
  version: string;
  last_updated: string;
  allowed_imports: {
    [pattern: string]: {
      description?: string;
      added_date: string;
      added_by: string;
      versions?: string[];
      security_reviewed?: boolean;
    };
  };
  blocked_imports: {
    [pattern: string]: {
      reason: string;
      blocked_date: string;
      blocked_by: string;
    };
  };
}

/**
 * Get import registry file path
 */
function getRegistryPath(global = false): string {
  if (global) {
    return path.join(os.homedir(), ".arbiter", "imports.json");
  }
  return path.join(process.cwd(), ".arbiter", "imports.json");
}

/**
 * Get registry directory path
 */
function getRegistryDir(global = false): string {
  return path.dirname(getRegistryPath(global));
}

/**
 * Load import registry
 */
async function loadImportRegistry(global = false): Promise<ImportRegistry> {
  const registryPath = getRegistryPath(global);

  try {
    const content = await fs.readFile(registryPath, "utf-8");
    return JSON.parse(content) as ImportRegistry;
  } catch (_error) {
    // Return default registry if file doesn't exist
    return {
      version: "1.0.0",
      last_updated: new Date().toISOString(),
      allowed_imports: {},
      blocked_imports: {},
    };
  }
}

/**
 * Save import registry
 */
async function saveImportRegistry(registry: ImportRegistry, global = false): Promise<void> {
  const registryPath = getRegistryPath(global);
  const registryDir = getRegistryDir(global);

  // Ensure directory exists
  await fs.mkdir(registryDir, { recursive: true });

  // Update timestamp
  registry.last_updated = new Date().toISOString();

  // Save registry
  await safeFileOperation("write", registryPath, async (validatedPath) => {
    await fs.writeFile(validatedPath, JSON.stringify(registry, null, 2), "utf-8");
  });
}

/**
 * Check if import pattern matches any allowed pattern
 */
function isImportAllowed(importPath: string, registry: ImportRegistry): boolean {
  // Check blocked imports first
  for (const blockedPattern of Object.keys(registry.blocked_imports)) {
    if (matchesPattern(importPath, blockedPattern)) {
      return false;
    }
  }

  // Check allowed imports
  for (const allowedPattern of Object.keys(registry.allowed_imports)) {
    if (matchesPattern(importPath, allowedPattern)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if import path matches a pattern (supports wildcards)
 */
function matchesPattern(importPath: string, pattern: string): boolean {
  // Convert pattern to regex
  const regexPattern = pattern.replace(/\*/g, ".*").replace(/\?/g, ".").replace(/\./g, "\\.");

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(importPath);
}

/**
 * Parse import pattern with optional version
 */
function parseImportPattern(pattern: string): { name: string; version?: string } {
  const atIndex = pattern.lastIndexOf("@");
  if (atIndex > 0 && pattern.substring(0, atIndex).includes("/")) {
    // Pattern like @org/pkg@version
    return {
      name: pattern.substring(0, atIndex),
      version: pattern.substring(atIndex + 1),
    };
  }
  // Pattern without version
  return { name: pattern };
}

/**
 * List allowed imports
 */
export async function listImports(options: ImportOptions = {}): Promise<number> {
  try {
    const registry = await loadImportRegistry(options.global);

    console.log(chalk.cyan("Import Registry"));
    console.log(chalk.dim(`Location: ${getRegistryPath(options.global)}`));
    console.log(chalk.dim(`Last updated: ${registry.last_updated}`));
    console.log();

    // Show allowed imports
    const allowedCount = Object.keys(registry.allowed_imports).length;
    if (allowedCount > 0) {
      console.log(chalk.green(`✓ Allowed Imports (${allowedCount}):`));
      for (const [pattern, info] of Object.entries(registry.allowed_imports)) {
        console.log(`  ${chalk.green(pattern)}`);
        if (info.description) {
          console.log(chalk.dim(`    ${info.description}`));
        }
        if (info.versions && info.versions.length > 0) {
          console.log(chalk.dim(`    Versions: ${info.versions.join(", ")}`));
        }
        console.log(chalk.dim(`    Added: ${info.added_date} by ${info.added_by}`));
        if (info.security_reviewed) {
          console.log(chalk.dim(`    ${chalk.green("✓")} Security reviewed`));
        }
        console.log();
      }
    } else {
      console.log(chalk.yellow("No allowed imports configured"));
      console.log(chalk.dim("Use `arbiter import add <pattern>` to allow imports"));
    }

    // Show blocked imports
    const blockedCount = Object.keys(registry.blocked_imports).length;
    if (blockedCount > 0) {
      console.log();
      console.log(chalk.red(`✗ Blocked Imports (${blockedCount}):`));
      for (const [pattern, info] of Object.entries(registry.blocked_imports)) {
        console.log(`  ${chalk.red(pattern)}`);
        console.log(chalk.dim(`    Reason: ${info.reason}`));
        console.log(chalk.dim(`    Blocked: ${info.blocked_date} by ${info.blocked_by}`));
        console.log();
      }
    }

    return 0;
  } catch (error) {
    console.error(
      chalk.red("Error listing imports:"),
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}

/**
 * Add allowed import
 */
export async function addImport(pattern: string, options: ImportOptions = {}): Promise<number> {
  try {
    const registry = await loadImportRegistry(options.global);
    const parsed = parseImportPattern(pattern);
    const currentUser = process.env.USER || process.env.USERNAME || "unknown";

    // Check if already in blocked list
    if (registry.blocked_imports[parsed.name]) {
      console.error(
        chalk.red(
          `Import '${parsed.name}' is blocked: ${registry.blocked_imports[parsed.name].reason}`,
        ),
      );
      return 1;
    }

    // Add or update allowed import
    if (!registry.allowed_imports[parsed.name]) {
      registry.allowed_imports[parsed.name] = {
        added_date: new Date().toISOString(),
        added_by: currentUser,
        versions: [],
      };
    }

    const importInfo = registry.allowed_imports[parsed.name];

    // Add version if specified
    if (parsed.version && !importInfo.versions?.includes(parsed.version)) {
      importInfo.versions = importInfo.versions || [];
      importInfo.versions.push(parsed.version);
      importInfo.versions.sort();
    }

    // Save registry
    await saveImportRegistry(registry, options.global);

    console.log(chalk.green(`✓ Added allowed import: ${pattern}`));
    console.log(chalk.dim(`Registry: ${getRegistryPath(options.global)}`));

    return 0;
  } catch (error) {
    console.error(
      chalk.red("Error adding import:"),
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}

/**
 * Remove allowed import
 */
export async function removeImport(pattern: string, options: ImportOptions = {}): Promise<number> {
  try {
    const registry = await loadImportRegistry(options.global);
    const parsed = parseImportPattern(pattern);

    if (!registry.allowed_imports[parsed.name]) {
      console.error(chalk.yellow(`Import '${parsed.name}' is not in the allowed list`));
      return 1;
    }

    delete registry.allowed_imports[parsed.name];

    // Save registry
    await saveImportRegistry(registry, options.global);

    console.log(chalk.green(`✓ Removed allowed import: ${parsed.name}`));

    return 0;
  } catch (error) {
    console.error(
      chalk.red("Error removing import:"),
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}

/**
 * Block an import pattern
 */
export async function blockImport(
  pattern: string,
  reason: string,
  options: ImportOptions = {},
): Promise<number> {
  try {
    const registry = await loadImportRegistry(options.global);
    const parsed = parseImportPattern(pattern);
    const currentUser = process.env.USER || process.env.USERNAME || "unknown";

    // Remove from allowed list if present
    if (registry.allowed_imports[parsed.name]) {
      delete registry.allowed_imports[parsed.name];
    }

    // Add to blocked list
    registry.blocked_imports[parsed.name] = {
      reason,
      blocked_date: new Date().toISOString(),
      blocked_by: currentUser,
    };

    // Save registry
    await saveImportRegistry(registry, options.global);

    console.log(chalk.red(`✗ Blocked import: ${parsed.name}`));
    console.log(chalk.dim(`Reason: ${reason}`));

    return 0;
  } catch (error) {
    console.error(
      chalk.red("Error blocking import:"),
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}

/**
 * Validate imports in CUE files
 */
export async function validateImports(
  files: string[],
  options: ImportOptions = {},
): Promise<number> {
  try {
    const registry = await loadImportRegistry(options.global);
    let hasErrors = false;

    console.log(chalk.cyan("Validating imports against registry..."));
    console.log(chalk.dim(`Registry: ${getRegistryPath(options.global)}`));
    console.log();

    for (const file of files) {
      try {
        const content = await fs.readFile(file, "utf-8");
        const imports = extractImportsFromCue(content);

        console.log(chalk.bold(`${file}:`));

        if (imports.length === 0) {
          console.log(chalk.dim("  No imports found"));
          continue;
        }

        for (const importPath of imports) {
          const isAllowed = isImportAllowed(importPath, registry);

          if (isAllowed) {
            console.log(`  ${chalk.green("✓")} ${importPath}`);
          } else {
            console.log(`  ${chalk.red("✗")} ${importPath} ${chalk.dim("(not allowed)")}`);
            hasErrors = true;
          }
        }

        console.log();
      } catch (error) {
        console.error(
          `  ${chalk.red("Error reading file:")} ${error instanceof Error ? error.message : String(error)}`,
        );
        hasErrors = true;
      }
    }

    if (hasErrors) {
      console.log(chalk.red("Import validation failed"));
      console.log(chalk.dim("Use `arbiter import add <pattern>` to allow imports"));
      return 1;
    }
    console.log(chalk.green("✓ All imports are allowed"));
    return 0;
  } catch (error) {
    console.error(
      chalk.red("Error validating imports:"),
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}

/**
 * Extract import statements from CUE content
 */
function extractImportsFromCue(content: string): string[] {
  const imports: string[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // Match: import "package"
    const singleImport = trimmed.match(/^import\s+"([^"]+)"$/);
    if (singleImport) {
      imports.push(singleImport[1]);
      continue;
    }

    // Match: import alias "package"
    const aliasImport = trimmed.match(/^import\s+\w+\s+"([^"]+)"$/);
    if (aliasImport) {
      imports.push(aliasImport[1]);
      continue;
    }

    // Match imports in multi-line import blocks
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      const importPath = trimmed.slice(1, -1);
      if (importPath && !importPath.includes(" ")) {
        imports.push(importPath);
      }
    }
  }

  return [...new Set(imports)]; // Remove duplicates
}

/**
 * Initialize default import registry with common safe patterns
 */
export async function initImportRegistry(options: ImportOptions = {}): Promise<number> {
  try {
    const registryPath = getRegistryPath(options.global);

    // Check if registry already exists
    try {
      await fs.access(registryPath);
      console.log(chalk.yellow(`Import registry already exists at ${registryPath}`));
      console.log(chalk.dim("Use --force to overwrite"));
      return 1;
    } catch {
      // Registry doesn't exist, proceed with creation
    }

    const currentUser = process.env.USER || process.env.USERNAME || "system";
    const defaultRegistry: ImportRegistry = {
      version: "1.0.0",
      last_updated: new Date().toISOString(),
      allowed_imports: {
        strings: {
          description: "CUE standard library - string manipulation",
          added_date: new Date().toISOString(),
          added_by: currentUser,
          security_reviewed: true,
        },
        list: {
          description: "CUE standard library - list operations",
          added_date: new Date().toISOString(),
          added_by: currentUser,
          security_reviewed: true,
        },
        math: {
          description: "CUE standard library - mathematical operations",
          added_date: new Date().toISOString(),
          added_by: currentUser,
          security_reviewed: true,
        },
        "encoding/json": {
          description: "CUE standard library - JSON encoding/decoding",
          added_date: new Date().toISOString(),
          added_by: currentUser,
          security_reviewed: true,
        },
        "encoding/yaml": {
          description: "CUE standard library - YAML encoding/decoding",
          added_date: new Date().toISOString(),
          added_by: currentUser,
          security_reviewed: true,
        },
        time: {
          description: "CUE standard library - time and date operations",
          added_date: new Date().toISOString(),
          added_by: currentUser,
          security_reviewed: true,
        },
        "@valhalla/*": {
          description: "Valhalla project imports - trusted internal organization",
          added_date: new Date().toISOString(),
          added_by: currentUser,
          security_reviewed: true,
        },
      },
      blocked_imports: {
        "unsafe/*": {
          reason: "Potentially unsafe operations",
          blocked_date: new Date().toISOString(),
          blocked_by: currentUser,
        },
      },
    };

    await saveImportRegistry(defaultRegistry, options.global);

    console.log(chalk.green("✓ Import registry initialized"));
    console.log(chalk.dim(`Location: ${registryPath}`));
    console.log();
    console.log(chalk.bold("Default allowed imports:"));
    for (const pattern of Object.keys(defaultRegistry.allowed_imports)) {
      console.log(`  ${chalk.green("✓")} ${pattern}`);
    }
    console.log();
    console.log(chalk.bold("Default blocked imports:"));
    for (const pattern of Object.keys(defaultRegistry.blocked_imports)) {
      console.log(`  ${chalk.red("✗")} ${pattern}`);
    }

    return 0;
  } catch (error) {
    console.error(
      chalk.red("Error initializing import registry:"),
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}

/**
 * Main import command handler
 */
export async function importCommand(
  action: string,
  pattern?: string,
  options: ImportOptions = {},
): Promise<number> {
  switch (action) {
    case "init":
      return await initImportRegistry(options);

    case "list":
      return await listImports(options);

    case "add":
      if (!pattern) {
        console.error(chalk.red("Import pattern is required for add command"));
        return 1;
      }
      return await addImport(pattern, options);

    case "remove":
      if (!pattern) {
        console.error(chalk.red("Import pattern is required for remove command"));
        return 1;
      }
      return await removeImport(pattern, options);

    case "block": {
      if (!pattern) {
        console.error(chalk.red("Import pattern is required for block command"));
        return 1;
      }
      const reason = options.allow?.[0] || "Security policy violation";
      return await blockImport(pattern, reason, options);
    }

    case "validate":
      if (!options.allow || options.allow.length === 0) {
        console.error(chalk.red("File patterns are required for validate command"));
        return 1;
      }
      return await validateImports(options.allow, options);

    default:
      console.error(chalk.red(`Unknown import action: ${action}`));
      console.log(chalk.dim("Available actions: init, list, add, remove, block, validate"));
      return 1;
  }
}
