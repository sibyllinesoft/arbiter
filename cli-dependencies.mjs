#!/usr/bin/env node

/**
 * CLI Dependencies Checker
 *
 * This script checks if all CLI dependencies are properly installed and available.
 * It's used by the main CLI to ensure robust operation across different environments.
 */

import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// CLI dependency manifest
const CLI_DEPENDENCIES = {
  // Core CLI dependencies
  core: ["commander", "chalk", "fs-extra", "zod", "yaml"],
  // Optional dependencies (CLI will work without them but with reduced functionality)
  optional: ["inquirer", "@types/node"],
  // Runtime-specific dependencies
  runtime: {
    node: ["node-fetch"],
    bun: [],
  },
};

// File structure requirements
const REQUIRED_FILES = [
  "packages/cli/dist/cli.js",
  "packages/cli/dist/config.js",
  "packages/cli/dist/api-client.js",
  "packages/cli/dist/commands",
];

/**
 * Color codes for output (fallback for environments without chalk)
 */
const colors = {
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  reset: "\x1b[0m",
  bold: "\x1b[1m",
};

function colorize(color, text) {
  if (process.env.NO_COLOR || !process.stdout.isTTY) {
    return text;
  }
  return `${colors[color]}${text}${colors.reset}`;
}

/**
 * Check if a package is installed and available
 */
function checkPackage(packageName) {
  try {
    // Try to resolve the package
    require.resolve(packageName);
    return { installed: true, error: null };
  } catch (error) {
    return { installed: false, error: error.message };
  }
}

/**
 * Check if all required files exist
 */
function checkRequiredFiles() {
  const missing = [];
  const existing = [];

  for (const file of REQUIRED_FILES) {
    const fullPath = join(__dirname, file);
    if (existsSync(fullPath)) {
      existing.push(file);
    } else {
      missing.push(file);
    }
  }

  return { existing, missing };
}

/**
 * Detect runtime environment
 */
function detectRuntime() {
  if (typeof Bun !== "undefined") {
    return {
      name: "bun",
      version: Bun.version || "unknown",
    };
  }

  return {
    name: "node",
    version: process.version,
  };
}

/**
 * Check package.json for CLI configuration
 */
function checkPackageJson() {
  try {
    const packagePath = join(__dirname, "package.json");
    if (!existsSync(packagePath)) {
      return {
        exists: false,
        hasBin: false,
        hasScripts: false,
      };
    }

    const packageContent = JSON.parse(readFileSync(packagePath, "utf8"));

    return {
      exists: true,
      hasBin: !!packageContent.bin?.arbiter,
      hasScripts: !!(
        packageContent.scripts &&
        (packageContent.scripts.cli ||
          packageContent.scripts["cli:install"] ||
          packageContent.scripts["build:cli"])
      ),
      name: packageContent.name,
      version: packageContent.version,
    };
  } catch (error) {
    return {
      exists: false,
      error: error.message,
    };
  }
}

/**
 * Generate installation suggestions based on missing dependencies
 */
function generateSuggestions(missingCore, missingOptional, missingFiles, runtime) {
  const suggestions = [];

  if (missingFiles.length > 0) {
    suggestions.push({
      type: "build",
      message: "CLI needs to be built",
      commands: [
        `${runtime.name === "bun" ? "bun" : "npm"} run build:cli`,
        "Or if no build script exists:",
        `cd packages/cli && ${runtime.name === "bun" ? "bun" : "npm"} install && ${runtime.name === "bun" ? "bun" : "npm"} run build`,
      ],
    });
  }

  if (missingCore.length > 0) {
    suggestions.push({
      type: "dependencies",
      message: "Core dependencies missing",
      commands: [
        `${runtime.name === "bun" ? "bun install" : "npm install"}`,
        "Or install specific packages:",
        `${runtime.name === "bun" ? "bun add" : "npm install"} ${missingCore.join(" ")}`,
      ],
    });
  }

  if (missingOptional.length > 0) {
    suggestions.push({
      type: "optional",
      message: "Optional dependencies missing (reduced functionality)",
      commands: [
        `${runtime.name === "bun" ? "bun add" : "npm install"} ${missingOptional.join(" ")}`,
      ],
    });
  }

  return suggestions;
}

/**
 * Main dependency check function
 */
export function checkDependencies(options = {}) {
  const { verbose = false, fix = false } = options;

  const results = {
    runtime: detectRuntime(),
    packageJson: checkPackageJson(),
    files: checkRequiredFiles(),
    dependencies: {
      core: { installed: [], missing: [] },
      optional: { installed: [], missing: [] },
    },
    status: "unknown",
    suggestions: [],
  };

  // Check core dependencies
  for (const dep of CLI_DEPENDENCIES.core) {
    const check = checkPackage(dep);
    if (check.installed) {
      results.dependencies.core.installed.push(dep);
    } else {
      results.dependencies.core.missing.push(dep);
    }
  }

  // Check optional dependencies
  for (const dep of CLI_DEPENDENCIES.optional) {
    const check = checkPackage(dep);
    if (check.installed) {
      results.dependencies.optional.installed.push(dep);
    } else {
      results.dependencies.optional.missing.push(dep);
    }
  }

  // Check runtime-specific dependencies
  const runtimeDeps = CLI_DEPENDENCIES.runtime[results.runtime.name] || [];
  for (const dep of runtimeDeps) {
    const check = checkPackage(dep);
    if (!check.installed) {
      results.dependencies.core.missing.push(dep);
    }
  }

  // Determine overall status
  const hasCriticalIssues =
    results.files.missing.length > 0 || results.dependencies.core.missing.length > 0;
  const hasMinorIssues = results.dependencies.optional.missing.length > 0;

  if (hasCriticalIssues) {
    results.status = "error";
  } else if (hasMinorIssues) {
    results.status = "warning";
  } else {
    results.status = "ok";
  }

  // Generate suggestions
  results.suggestions = generateSuggestions(
    results.dependencies.core.missing,
    results.dependencies.optional.missing,
    results.files.missing,
    results.runtime,
  );

  return results;
}

/**
 * Print dependency check results
 */
export function printResults(results, options = {}) {
  const { verbose = false } = options;

  console.log(colorize("bold", "🔍 Arbiter CLI Dependency Check"));
  console.log("─".repeat(50));

  // Runtime info
  console.log(colorize("cyan", `Runtime: ${results.runtime.name} ${results.runtime.version}`));

  // Package.json info
  if (results.packageJson.exists) {
    console.log(
      colorize(
        "cyan",
        `Package: ${results.packageJson.name || "unknown"} v${results.packageJson.version || "unknown"}`,
      ),
    );
    if (results.packageJson.hasBin) {
      console.log(colorize("green", "✅ Binary entry configured"));
    } else {
      console.log(colorize("yellow", "⚠️  No binary entry in package.json"));
    }
  } else {
    console.log(colorize("red", "❌ package.json not found or invalid"));
  }

  console.log("");

  // File check results
  console.log(colorize("bold", "Required Files:"));
  if (results.files.missing.length === 0) {
    console.log(colorize("green", "✅ All required files present"));
    if (verbose) {
      results.files.existing.forEach((file) => {
        console.log(`   ✅ ${file}`);
      });
    }
  } else {
    console.log(colorize("red", `❌ ${results.files.missing.length} file(s) missing:`));
    results.files.missing.forEach((file) => {
      console.log(`   ❌ ${file}`);
    });

    if (verbose && results.files.existing.length > 0) {
      console.log("   Existing files:");
      results.files.existing.forEach((file) => {
        console.log(`   ✅ ${file}`);
      });
    }
  }

  console.log("");

  // Dependency check results
  console.log(colorize("bold", "Dependencies:"));

  // Core dependencies
  console.log("Core:");
  if (results.dependencies.core.missing.length === 0) {
    console.log(colorize("green", "✅ All core dependencies available"));
    if (verbose) {
      results.dependencies.core.installed.forEach((dep) => {
        console.log(`   ✅ ${dep}`);
      });
    }
  } else {
    console.log(
      colorize(
        "red",
        `❌ ${results.dependencies.core.missing.length} core dependency(ies) missing:`,
      ),
    );
    results.dependencies.core.missing.forEach((dep) => {
      console.log(`   ❌ ${dep}`);
    });
  }

  // Optional dependencies
  if (results.dependencies.optional.missing.length > 0) {
    console.log("Optional:");
    console.log(
      colorize(
        "yellow",
        `⚠️  ${results.dependencies.optional.missing.length} optional dependency(ies) missing:`,
      ),
    );
    results.dependencies.optional.missing.forEach((dep) => {
      console.log(`   ⚠️  ${dep}`);
    });
  } else if (verbose) {
    console.log("Optional:");
    console.log(colorize("green", "✅ All optional dependencies available"));
  }

  console.log("");

  // Overall status
  switch (results.status) {
    case "ok":
      console.log(colorize("green", "🎉 CLI is ready to use!"));
      break;
    case "warning":
      console.log(
        colorize("yellow", "⚠️  CLI is functional but some optional features may be unavailable"),
      );
      break;
    case "error":
      console.log(colorize("red", "❌ CLI has critical issues and may not work properly"));
      break;
  }

  // Print suggestions
  if (results.suggestions.length > 0) {
    console.log("");
    console.log(colorize("bold", "💡 Suggestions:"));

    results.suggestions.forEach((suggestion, index) => {
      console.log(`${index + 1}. ${suggestion.message}:`);
      suggestion.commands.forEach((cmd) => {
        if (cmd.startsWith("Or ")) {
          console.log(`   ${colorize("cyan", cmd)}`);
        } else {
          console.log(`   ${colorize("green", cmd)}`);
        }
      });
      console.log("");
    });
  }

  return results.status === "ok";
}

/**
 * CLI interface
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const verbose = args.includes("--verbose") || args.includes("-v");
  const fix = args.includes("--fix");
  const json = args.includes("--json");

  if (args.includes("--help") || args.includes("-h")) {
    console.log("Usage: cli-dependencies.mjs [OPTIONS]");
    console.log("");
    console.log("Check Arbiter CLI dependencies and requirements");
    console.log("");
    console.log("Options:");
    console.log("  --verbose, -v    Show detailed information");
    console.log("  --json           Output results as JSON");
    console.log("  --fix            Attempt to fix issues (not yet implemented)");
    console.log("  --help, -h       Show this help message");
    console.log("");
    process.exit(0);
  }

  const results = checkDependencies({ verbose, fix });

  if (json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    const success = printResults(results, { verbose });
    process.exit(success ? 0 : 1);
  }
}
