#!/usr/bin/env bun
/**
 * Cross-platform local CI script for Arbiter
 * Replaces local-ci.sh for better Windows compatibility
 */

import { spawn } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { chdir } from "process";

// Get script directory and change to project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");
chdir(rootDir);

const TOTAL_STEPS = 7;
let currentStep = 1;

function printHeader(title: string): void {
  console.log("\n========================================");
  console.log(title);
  console.log("========================================");
}

function runCommand(command: string, args: string[]): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: true, // Use shell for cross-platform compatibility
    });

    child.on("close", (code) => {
      resolve(code || 0);
    });

    child.on("error", (error) => {
      console.error(`Failed to start command: ${error.message}`);
      resolve(1);
    });
  });
}

async function runStep(title: string, command: string, args: string[]): Promise<void> {
  console.log(`\n[${currentStep}/${TOTAL_STEPS}] ${title}`);
  console.log("----------------------------------------");

  const exitCode = await runCommand(command, args);

  if (exitCode === 0) {
    console.log(`✅ ${title}`);
  } else {
    console.log(`❌ ${title} (exit code ${exitCode})`);
    process.exit(exitCode);
  }

  currentStep++;
}

async function main(): Promise<void> {
  try {
    printHeader("Arbiter Local CI");

    await runStep("Install dependencies", "bun", ["install", "--frozen-lockfile"]);
    await runStep("Check formatting & linting", "bun", ["run", "check:ci"]);
    await runStep("Type check (TS project references)", "bun", ["run", "typecheck"]);
    await runStep("Run unit and integration tests", "bun", ["run", "test"]);
    await runStep("Generator smoke test", "bun", ["run", "cli:smoke"]);
    await runStep("Build workspaces", "bun", ["run", "build"]);
    await runStep("Audit dependencies", "bun", ["audit"]);

    console.log("\nAll checks passed ✅");
    process.exit(0);
  } catch (error) {
    console.error("CI script failed:", error);
    process.exit(1);
  }
}

// Handle process signals gracefully
process.on("SIGINT", () => {
  console.log("\nCI interrupted by user");
  process.exit(130);
});

process.on("SIGTERM", () => {
  console.log("\nCI terminated");
  process.exit(143);
});

main().catch((error) => {
  console.error("Unhandled error in CI script:", error);
  process.exit(1);
});
