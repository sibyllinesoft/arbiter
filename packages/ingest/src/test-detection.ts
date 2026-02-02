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

const CLI_FRAMEWORKS = [
  "commander",
  "yargs",
  "inquirer",
  "oclif",
  "meow",
  "caporal",
  "cac",
  "clipanion",
];
const WEB_FRAMEWORKS = [
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
const DATABASES = [
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
const BUILD_TOOLS = [
  "webpack",
  "rollup",
  "parcel",
  "esbuild",
  "turbopack",
  "tsup",
  "vite",
  "snowpack",
];
const FRONTEND_FRAMEWORKS = [
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

function getMergedDependencies(packageJson: PackageJsonData): Record<string, unknown> {
  const pkg = packageJson as Record<string, unknown>;
  return {
    ...((pkg.dependencies as Record<string, unknown>) || {}),
    ...((pkg.devDependencies as Record<string, unknown>) || {}),
  };
}

function hasDependencyMatching(deps: Record<string, unknown>, patterns: string[]): boolean {
  return Object.keys(deps).some((dep) => patterns.some((p) => dep.toLowerCase().includes(p)));
}

function isTypesPackage(name: string, packageJson: PackageJsonData): boolean {
  const lowerName = name.toLowerCase();
  return (
    lowerName.includes("types") ||
    lowerName.includes("type-definitions") ||
    (!!packageJson.types && !packageJson.main) ||
    (!!packageJson.typings && !packageJson.main)
  );
}

function hasServerScript(packageJson: PackageJsonData): boolean {
  const pkg = packageJson as Record<string, unknown>;
  const scripts = pkg.scripts as Record<string, string> | undefined;
  if (!scripts) return false;
  return (
    scripts.start?.includes("server") ||
    scripts.start?.includes("src/server") ||
    scripts.dev?.includes("server") ||
    !!scripts.serve ||
    (pkg.main as string | undefined)?.includes("server") === true
  );
}

function isComponentLibrary(packageJson: PackageJsonData): boolean {
  if (!packageJson.peerDependencies) return false;
  return Object.keys(packageJson.peerDependencies).some((peer) =>
    FRONTEND_FRAMEWORKS.some((fw) => peer.toLowerCase().includes(fw)),
  );
}

/**
 * Detection context for package type detection
 */
interface DetectionContext {
  name: string;
  packageJson: PackageJsonData;
  deps: Record<string, unknown>;
  hasCliFramework: boolean;
  hasWebFramework: boolean;
  hasDatabase: boolean;
  hasBuildTool: boolean;
  hasFrontendFramework: boolean;
}

/**
 * Build detection context from package data
 */
function buildDetectionContext(pkg: PackageDetectionData): DetectionContext {
  const { packageJson } = pkg;
  const deps = getMergedDependencies(packageJson);

  return {
    name: packageJson.name || "",
    packageJson,
    deps,
    hasCliFramework: hasDependencyMatching(deps, CLI_FRAMEWORKS),
    hasWebFramework: hasDependencyMatching(deps, WEB_FRAMEWORKS),
    hasDatabase: hasDependencyMatching(deps, DATABASES),
    hasBuildTool: hasDependencyMatching(deps, BUILD_TOOLS),
    hasFrontendFramework: hasDependencyMatching(deps, FRONTEND_FRAMEWORKS),
  };
}

/**
 * Package type detection rule
 */
type DetectionRule = (ctx: DetectionContext) => string | null;

/**
 * Detection rules in priority order
 */
const DETECTION_RULES: DetectionRule[] = [
  // 1. CLI - Has bin field
  (ctx) => (ctx.packageJson.bin ? "tool" : null),
  // 2. CLI framework (non-private)
  (ctx) => (ctx.hasCliFramework && !ctx.packageJson.private ? "tool" : null),
  // 3. Types packages
  (ctx) => (isTypesPackage(ctx.name, ctx.packageJson) ? "package" : null),
  // 4. Web Service
  (ctx) =>
    ctx.hasWebFramework || ctx.hasDatabase || hasServerScript(ctx.packageJson) ? "service" : null,
  // 5. Build tools (non-private, non-browser)
  (ctx) =>
    ctx.hasBuildTool && !ctx.packageJson.private && !ctx.packageJson.browserslist ? "tool" : null,
  // 6. Frontend framework - component library
  (ctx) => (ctx.hasFrontendFramework && isComponentLibrary(ctx.packageJson) ? "package" : null),
  // 7. Frontend framework - application
  (ctx) =>
    ctx.hasFrontendFramework && (ctx.packageJson.private || ctx.packageJson.browserslist)
      ? "frontend"
      : null,
];

// Simplified detection logic for testing
function detectPackageType(pkg: PackageDetectionData): string {
  const ctx = buildDetectionContext(pkg);

  for (const rule of DETECTION_RULES) {
    const result = rule(ctx);
    if (result) return result;
  }

  return "package";
}

// Define expected types for key packages
const expectedTypes: Record<string, string> = {
  // Arbiter packages
  "@arbiter/cli": "tool",
  "@arbiter/api": "service",
  "@arbiter/shared": "package",
  "@arbiter/shared-types": "package",
  "@arbiter/api-types": "package",
  "@arbiter/ingest": "package",
  "@arbiter/cue-runner": "package",
  "spec-workbench-frontend": "frontend",
  arbiter: "tool", // Root has bin field

  // Smith packages
  "smith-agent-visualizer": "frontend",
  "@smith/protocol": "package",
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
