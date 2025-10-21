#!/usr/bin/env bun

/**
 * Version synchronization script for Arbiter monorepo
 * Ensures all packages have consistent version numbers
 */

import path from "node:path";
import fs from "fs-extra";
import { glob } from "glob";

interface PackageJson {
  name: string;
  version: string;
  [key: string]: any;
}

async function syncVersions() {
  console.log("🔄 Syncing versions across Arbiter monorepo...");

  // Read root package.json for the canonical version
  const rootPackagePath = path.resolve("package.json");
  const rootPackage: PackageJson = await fs.readJson(rootPackagePath);
  const targetVersion = rootPackage.version;

  console.log(`📦 Target version: ${targetVersion}`);

  // Find all package.json files in packages/* and apps/*
  const packagePaths = await glob("@(packages|apps)/*/package.json", {
    cwd: process.cwd(),
  });

  let updatedCount = 0;
  const errors: string[] = [];

  for (const packagePath of packagePaths) {
    try {
      const fullPath = path.resolve(packagePath);
      const packageJson: PackageJson = await fs.readJson(fullPath);

      // Only update @arbiter/* packages
      if (packageJson.name?.startsWith("@arbiter/")) {
        if (packageJson.version !== targetVersion) {
          console.log(
            `  ✏️  Updating ${packageJson.name}: ${packageJson.version} → ${targetVersion}`,
          );

          packageJson.version = targetVersion;
          await fs.writeJson(fullPath, packageJson, { spaces: 2 });
          updatedCount++;
        } else {
          console.log(`  ✅ ${packageJson.name}: already at ${targetVersion}`);
        }
      } else {
        console.log(`  ⏭️  Skipping ${packageJson.name || packagePath}: not an @arbiter package`);
      }
    } catch (error) {
      const errorMsg = `Failed to process ${packagePath}: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(errorMsg);
      console.error(`  ❌ ${errorMsg}`);
    }
  }

  // Summary
  console.log("\n📊 Summary:");
  console.log(`  • Updated packages: ${updatedCount}`);
  console.log(`  • Errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log("\n❌ Errors encountered:");
    errors.forEach((error) => console.log(`  • ${error}`));
    process.exit(1);
  }

  console.log("\n🎉 Version synchronization complete!");
}

// Version validation function
export function validateVersionConsistency(): boolean {
  console.log("🔍 Validating version consistency...");

  try {
    const rootPackage: PackageJson = JSON.parse(fs.readFileSync("package.json", "utf-8"));
    const targetVersion = rootPackage.version;

    const packagePaths = glob.sync("@(packages|apps)/*/package.json");
    let isConsistent = true;

    for (const packagePath of packagePaths) {
      const packageJson: PackageJson = JSON.parse(fs.readFileSync(packagePath, "utf-8"));

      if (packageJson.name?.startsWith("@arbiter/")) {
        if (packageJson.version !== targetVersion) {
          console.log(
            `❌ Version mismatch: ${packageJson.name} has ${packageJson.version}, expected ${targetVersion}`,
          );
          isConsistent = false;
        }
      }
    }

    if (isConsistent) {
      console.log(`✅ All @arbiter packages are at version ${targetVersion}`);
    }

    return isConsistent;
  } catch (error) {
    console.error(
      `❌ Validation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return false;
  }
}

// CLI interface
if (import.meta.main) {
  const command = process.argv[2];

  switch (command) {
    case "sync":
      await syncVersions();
      break;
    case "validate": {
      const isValid = validateVersionConsistency();
      process.exit(isValid ? 0 : 1);
      break;
    }
    default:
      console.log(`
Usage: bun scripts/sync-versions.ts <command>

Commands:
  sync      Sync all @arbiter package versions to match root package.json
  validate  Check if all @arbiter package versions are consistent

Examples:
  bun scripts/sync-versions.ts sync
  bun scripts/sync-versions.ts validate
`);
      process.exit(1);
  }
}
