import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { safeFileOperation } from "@/constraints/index.js";
import chalk from "chalk";

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
    return path.join(os.homedir(), ".arbiter", "registry.json");
  }
  return path.resolve(".arbiter", "registry.json");
}

/**
 * Load import registry JSON
 */
async function loadRegistry(global = false): Promise<ImportRegistry> {
  const registryPath = getRegistryPath(global);

  try {
    const content = await fs.readFile(registryPath, "utf-8");
    return JSON.parse(content) as ImportRegistry;
  } catch {
    // Return default registry if not found
    return {
      version: "1.0.0",
      last_updated: new Date().toISOString(),
      allowed_imports: {},
      blocked_imports: {},
    };
  }
}

/**
 * Save import registry JSON
 */
async function saveRegistry(registry: ImportRegistry, global = false): Promise<void> {
  const registryPath = getRegistryPath(global);
  await safeFileOperation("write", registryPath, async (validatedPath) => {
    await fs.writeFile(validatedPath, JSON.stringify(registry, null, 2), "utf-8");
  });
}

/**
 * Validate import statements against registry
 */
function validateImports(
  imports: string[],
  registry: ImportRegistry,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const imp of imports) {
    const isAllowed = Object.keys(registry.allowed_imports).some((pattern) => {
      // Convert simple glob-like pattern to regexp
      const regex = new RegExp(
        `^${pattern
          .replace(/[.+^${}()|[\\]\\\\]/g, "\\$&")
          .replace(/\*/g, ".*")
          .replace(/\?/g, ".")}$`,
      );
      return regex.test(imp);
    });

    const isBlocked = Object.keys(registry.blocked_imports).some((pattern) => {
      const regex = new RegExp(
        `^${pattern
          .replace(/[.+^${}()|[\\]\\\\]/g, "\\$&")
          .replace(/\*/g, ".*")
          .replace(/\?/g, ".")}$`,
      );
      return regex.test(imp);
    });

    if (!isAllowed || isBlocked) {
      errors.push(`Import ${imp} is ${isBlocked ? "blocked" : "not allowed"} by the registry`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Update import registry (allow / remove patterns)
 */
async function updateRegistry(
  options: ImportOptions,
  registry: ImportRegistry,
): Promise<ImportRegistry> {
  const now = new Date().toISOString();

  if (options.allow?.length) {
    for (const pattern of options.allow) {
      registry.allowed_imports[pattern] = {
        description: `Allowed via CLI on ${now}`,
        added_date: now,
        added_by: os.userInfo().username || "unknown",
      };
    }
  }

  if (options.remove) {
    for (const pattern of options.allow || []) {
      delete registry.allowed_imports[pattern];
      delete registry.blocked_imports[pattern];
    }
  }

  registry.last_updated = now;
  return registry;
}

/**
 * Main import registry command
 */
export async function importCommand(
  subcommand: "validate" | "list" | "update",
  _namespace: string | undefined,
  options: ImportOptions,
): Promise<number> {
  const registry = await loadRegistry(options.global);

  switch (subcommand) {
    case "list": {
      console.log(chalk.blue("📚 Import Registry"));
      console.log(
        chalk.dim(`Location: ${path.relative(process.cwd(), getRegistryPath(options.global))}`),
      );
      console.log(chalk.dim(`Last updated: ${registry.last_updated}`));
      console.log("\nAllowed imports:");
      for (const [pattern, info] of Object.entries(registry.allowed_imports)) {
        console.log(`  ${chalk.green(pattern)} ${chalk.dim(`(added ${info.added_date})`)}`);
      }
      console.log("\nBlocked imports:");
      for (const [pattern, info] of Object.entries(registry.blocked_imports)) {
        console.log(`  ${chalk.red(pattern)} ${chalk.dim(`(blocked ${info.blocked_date})`)}`);
      }
      return 0;
    }

    case "update": {
      if (!options.allow?.length) {
        console.error(chalk.red("No patterns provided to update. Use --allow <pattern>."));
        return 1;
      }
      const updated = await updateRegistry(options, registry);
      await saveRegistry(updated, options.global);
      console.log(chalk.green("✅ Registry updated"));
      return 0;
    }

    case "validate": {
      if (!options.allow?.length) {
        console.error(chalk.red("Provide imports to validate via --allow <import1,import2>"));
        return 1;
      }
      const imports = options.allow;
      const result = validateImports(imports, registry);
      if (result.valid) {
        console.log(chalk.green("✅ All imports are allowed"));
        return 0;
      }
      console.error(chalk.red("❌ Import validation failed:"));
      result.errors.forEach((err) => console.error(chalk.red(`  • ${err}`)));
      return 1;
    }

    default:
      console.error(chalk.red(`Unknown import subcommand: ${subcommand}`));
      return 1;
  }
}
