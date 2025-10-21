#!/usr/bin/env bun
/**
 * Test detection logic using pre-exported JSON data
 * This allows rapid iteration on detection rules without re-scanning projects
 */

import * as fs from "fs-extra";
import type { PackageJsonData } from "./plugins/nodejs";

interface PackageDetectionData {
  name: string;
  path: string;
  packageJson: PackageJsonData;
  filePatterns: string[];
  detectedType?: string;
}

interface DetectionData {
  projectPath: string;
  projectName: string;
  packages: PackageDetectionData[];
}

// Simplified detection logic for testing
function detectPackageType(pkg: PackageDetectionData): string {
  const { packageJson } = pkg;
  const name = packageJson.name;

  // Merge all dependencies for checking
  const depsObj = packageJson as any;
  const deps = { ...(depsObj.dependencies || {}), ...(depsObj.devDependencies || {}) };

  // 1. CLI - Has bin field or CLI framework
  if (packageJson.bin) {
    return "tool";
  }

  // Check for CLI frameworks even without bin field
  const cliFrameworks = [
    "commander",
    "yargs",
    "inquirer",
    "oclif",
    "meow",
    "caporal",
    "cac",
    "clipanion",
  ];
  const hasCliFramework = Object.keys(deps).some((dep) =>
    cliFrameworks.some((cli) => dep.toLowerCase().includes(cli)),
  );

  if (hasCliFramework && !packageJson.private) {
    return "tool";
  }

  // 2. Types packages - Special case for type definition packages
  // These are libraries even if they have web framework dependencies
  const isTypesPackage =
    name.toLowerCase().includes("types") ||
    name.toLowerCase().includes("type-definitions") ||
    (packageJson.types && !packageJson.main) ||
    (packageJson.typings && !packageJson.main);

  if (isTypesPackage) {
    return "module";
  }

  // 3. Web Service - Has web framework, database driver, or server-related scripts
  const webFrameworks = [
    "express",
    "fastify",
    "koa",
    "hono",
    "hapi",
    "nestjs",
    "restify",
    "sails",
    "feathers",
    "apollo-server",
    "graphql-yoga",
    "trpc",
    "socket.io",
    "ws",
  ];
  const databases = [
    "mongoose",
    "sequelize",
    "typeorm",
    "prisma",
    "drizzle-orm",
    "pg",
    "mysql",
    "mysql2",
    "mongodb",
    "redis",
    "ioredis",
    "knex",
    "objection",
    "mikro-orm",
  ];

  const hasWebFramework = Object.keys(deps).some((dep) =>
    webFrameworks.some((fw) => dep.toLowerCase().includes(fw)),
  );

  const hasDatabase = Object.keys(deps).some((dep) =>
    databases.some((db) => dep.toLowerCase().includes(db)),
  );

  const hasServerScript =
    (packageJson as any).scripts &&
    (((packageJson as any).scripts.start as string)?.includes("server") ||
      ((packageJson as any).scripts.start as string)?.includes("src/server") ||
      ((packageJson as any).scripts.dev as string)?.includes("server") ||
      ((packageJson as any).scripts.serve as string | boolean) ||
      ((packageJson as any).main as string)?.includes("server"));

  if (hasWebFramework || hasDatabase || hasServerScript) {
    return "service";
  }

  // 4. Build tools - webpack, rollup, etc.
  const buildTools = [
    "webpack",
    "rollup",
    "parcel",
    "esbuild",
    "turbopack",
    "tsup",
    "vite",
    "snowpack",
  ];
  const hasBuildTool = Object.keys(deps).some((dep) =>
    buildTools.some((tool) => dep.toLowerCase().includes(tool)),
  );

  // Check if it's primarily a build tool (not a frontend app using vite)
  const isBuildTool = hasBuildTool && !packageJson.private && !packageJson.browserslist;
  if (isBuildTool) {
    return "tool";
  }

  // 5. Frontend - Has frontend framework AND is private or has browserslist
  const frontendFrameworks = [
    "react",
    "vue",
    "angular",
    "svelte",
    "solid",
    "preact",
    "next",
    "nuxt",
    "gatsby",
  ];
  const hasFrontendFramework = Object.keys(deps).some((dep) =>
    frontendFrameworks.some((fw) => dep.toLowerCase().includes(fw)),
  );

  if (hasFrontendFramework) {
    const isComponentLibrary =
      packageJson.peerDependencies &&
      Object.keys(packageJson.peerDependencies).some((peer) =>
        frontendFrameworks.some((fw) => peer.toLowerCase().includes(fw)),
      );

    if (isComponentLibrary) {
      return "module";
    }

    if (packageJson.private || packageJson.browserslist) {
      return "frontend";
    }
  }

  // 6. Module - Everything else
  return "module";
}

// Define expected types for key packages
const expectedTypes: Record<string, string> = {
  // Arbiter packages
  "@arbiter/cli": "tool",
  "@arbiter/api": "service",
  "@arbiter/shared": "module",
  "@arbiter/shared-types": "module",
  "@arbiter/api-types": "module", // Should be module, not service
  "@arbiter/importer": "module",
  "@arbiter/cue-runner": "module",
  "@arbiter/core": "module",
  "spec-workbench-frontend": "frontend",
  arbiter: "tool", // Root has bin field

  // Smith packages
  "smith-agent-visualizer": "frontend",
  "@smith/protocol": "module",
};

async function runTests() {
  const dataPath = "/home/nathan/Projects/arbiter/detection-test-data.json";
  const data: DetectionData[] = await fs.readJson(dataPath);

  console.log("🧪 Testing Package Type Detection\n");
  console.log("=".repeat(80));

  let totalPass = 0;
  let totalFail = 0;
  const failures: string[] = [];

  for (const project of data) {
    console.log(`\n📦 Project: ${project.projectName}`);
    console.log("-".repeat(40));

    for (const pkg of project.packages) {
      const detected = detectPackageType(pkg);
      const expected = expectedTypes[pkg.name] || pkg.detectedType;
      const pass = detected === expected;

      if (pass) {
        totalPass++;
        console.log(`  ✅ ${pkg.name}: ${detected}`);
      } else {
        totalFail++;
        failures.push(`${pkg.name}: expected ${expected}, got ${detected}`);
        console.log(`  ❌ ${pkg.name}: expected ${expected}, got ${detected}`);

        // Debug info for failures
        const pkgJson = pkg.packageJson as any;
        const deps = Object.keys({
          ...(pkgJson.dependencies || {}),
          ...(pkgJson.devDependencies || {}),
        });
        console.log(
          `     Dependencies: ${deps.slice(0, 5).join(", ")}${deps.length > 5 ? "..." : ""}`,
        );
        console.log(`     Has bin: ${!!pkg.packageJson.bin}`);
        console.log(`     Private: ${!!pkg.packageJson.private}`);
        console.log(`     Main: ${pkg.packageJson.main || "none"}`);
      }
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log(`\n📊 Results: ${totalPass} passed, ${totalFail} failed\n`);

  if (failures.length > 0) {
    console.log("❌ Failed detections:");
    failures.forEach((f) => console.log(`  - ${f}`));
  }

  return totalFail === 0;
}

runTests().then((success) => {
  process.exit(success ? 0 : 1);
});
