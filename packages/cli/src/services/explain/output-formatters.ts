/**
 * @packageDocumentation
 * Output formatting utilities for explanation display.
 *
 * Provides functionality to:
 * - Print formatted explanation sections to console
 * - Display artifact, profile, build, and test details
 * - Show recommendations and potential issues
 */

import chalk from "chalk";
import type { AssemblyExplanation } from "./markdown-generator.js";

/**
 * Print explanation header with summary.
 */
export function printExplanationHeader(explanation: AssemblyExplanation): void {
  console.log(chalk.bold.cyan("🏗️  Project Configuration Summary"));
  console.log(chalk.dim("─".repeat(50)));
  console.log(chalk.white(explanation.summary));
  console.log();
}

/**
 * Print artifact details section.
 */
export function printArtifactDetails(artifact: AssemblyExplanation["artifact"]): void {
  console.log(chalk.bold.yellow("📦 Artifact Details:"));
  console.log(`  Type: ${chalk.cyan(artifact.type)}`);
  console.log(`  Language: ${chalk.cyan(artifact.language)}`);
  if (artifact.metadata.name) {
    console.log(`  Name: ${chalk.cyan(artifact.metadata.name)}`);
  }
  if (artifact.metadata.version) {
    console.log(`  Version: ${chalk.cyan(artifact.metadata.version)}`);
  }
  if (artifact.description.trim()) {
    console.log(`  Description: ${chalk.gray(artifact.description.trim())}`);
  }
  console.log();
}

/**
 * Print profile information section.
 */
export function printProfileInfo(profile: AssemblyExplanation["profile"]): void {
  console.log(chalk.bold.yellow("⚙️  Profile Configuration:"));
  console.log(`  Profile Type: ${chalk.cyan(profile.type)}`);
  if (profile.features.length > 0) {
    console.log(`  Features: ${profile.features.map((f) => chalk.cyan(f)).join(", ")}`);
  }
  console.log();
}

/**
 * Print build configuration section.
 */
export function printBuildConfig(build: AssemblyExplanation["build"]): void {
  console.log(chalk.bold.yellow("🔨 Build Configuration:"));
  console.log(`  Build Tool: ${chalk.cyan(build.tool)}`);
  if (build.targets.length > 0) {
    console.log(`  Targets: ${build.targets.map((t) => chalk.cyan(t)).join(", ")}`);
  }
  if (build.matrix && Object.keys(build.matrix).length > 0) {
    console.log(`  Build Matrix: ${chalk.gray("Configured")}`);
  }
  console.log();
}

/**
 * Print test configuration section.
 */
export function printTestConfig(tests: AssemblyExplanation["tests"]): void {
  if (tests.types.length === 0) return;
  console.log(chalk.bold.yellow("🧪 Test Configuration:"));
  console.log(`  Test Types: ${tests.types.map((t) => chalk.cyan(t)).join(", ")}`);
  console.log();
}

/**
 * Print contracts and invariants section.
 */
export function printContractsAndInvariants(contracts: AssemblyExplanation["contracts"]): void {
  if (contracts.invariants.length === 0) return;
  console.log(chalk.bold.yellow("📋 Contracts & Invariants:"));
  for (const invariant of contracts.invariants) {
    console.log(`  • ${chalk.cyan(invariant)}`);
  }
  console.log();
}

/**
 * Print next steps section.
 */
export function printNextSteps(nextSteps: string[]): void {
  if (nextSteps.length === 0) return;
  console.log(chalk.bold.green("🎯 Recommended Next Steps:"));
  for (let i = 0; i < nextSteps.length; i++) {
    console.log(`  ${i + 1}. ${nextSteps[i]}`);
  }
  console.log();
}

/**
 * Print recommendations section.
 */
export function printRecommendations(recommendations: string[]): void {
  if (recommendations.length === 0) return;
  console.log(chalk.bold.blue("💡 Recommendations:"));
  for (const recommendation of recommendations) {
    console.log(`  • ${recommendation}`);
  }
  console.log();
}

/**
 * Print potential issues section.
 */
export function printPotentialIssues(issues: string[]): void {
  if (issues.length === 0) return;
  console.log(chalk.bold.yellow("⚠️  Potential Issues:"));
  for (const issue of issues) {
    console.log(`  • ${chalk.yellow(issue)}`);
  }
  console.log();
}

/**
 * Print helpful hints section.
 */
export function printHelpfulHints(): void {
  console.log(chalk.bold.magenta("🔮 Helpful Hints:"));
  console.log(
    `  • Use ${chalk.cyan("arbiter watch")} for continuous validation during development`,
  );
  console.log(`  • Run ${chalk.cyan("arbiter docs schema")} to generate documentation`);
  console.log(`  • Try ${chalk.cyan("arbiter examples")} to see working project templates`);
  console.log(`  • Get detailed help with ${chalk.cyan("arbiter <command> --help")}`);
  console.log();
}
