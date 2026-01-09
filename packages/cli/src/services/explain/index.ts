#!/usr/bin/env node
/**
 * @packageDocumentation
 * Explain command - Generate human-readable explanations of CUE specifications.
 *
 * Provides functionality to:
 * - Parse and analyze CUE assembly files
 * - Generate Markdown explanations of specifications
 * - Output in text or JSON format
 * - Include hints for improving specifications
 */

import fs from "node:fs/promises";
import path from "node:path";
import { safeFileOperation } from "@/constraints/index.js";
import type { Config } from "@/io/config/config.js";
import chalk from "chalk";
import { enrichExplanationWithAnalysis } from "./analysis-generator.js";
import {
  createParsingContext,
  initializeEmptyExplanation,
  processContentLines,
} from "./assembly-parser.js";
import { type AssemblyExplanation, generateMarkdownExplanation } from "./markdown-generator.js";
import {
  printArtifactDetails,
  printBuildConfig,
  printContractsAndInvariants,
  printExplanationHeader,
  printHelpfulHints,
  printNextSteps,
  printPotentialIssues,
  printProfileInfo,
  printRecommendations,
  printTestConfig,
} from "./output-formatters.js";

// Re-export for external consumers
export type { AssemblyExplanation } from "./markdown-generator.js";

/**
 * Options for explain command
 */
export interface ExplainOptions {
  format?: "text" | "json";
  output?: string;
  verbose?: boolean;
  hints?: boolean;
}

async function writeExplanationFile(filePath: string, content: string): Promise<void> {
  await safeFileOperation("write", filePath, async (validatedPath) => {
    await fs.writeFile(validatedPath, content, "utf-8");
  });
}

/**
 * Report missing assembly file in appropriate format
 */
function reportMissingAssembly(structuredOutput: boolean): void {
  if (structuredOutput) {
    console.log(
      JSON.stringify({ error: "No assembly specification found", suggestion: "arbiter init" }),
    );
  } else {
    console.log(chalk.red("❌ No assembly specification found"));
    console.log(chalk.dim("To get started:"));
    console.log(chalk.dim("  1. Run: arbiter init --preset <id>"));
    console.log(chalk.dim("  2. Or: arbiter add service <name>"));
    console.log(chalk.dim("  3. Then: arbiter explain"));
  }
}

/**
 * Log progress messages for non-JSON output
 */
function logProgress(assemblyPath: string, structuredOutput: boolean): void {
  if (!structuredOutput) {
    console.log(chalk.green(`✅ Found ${path.relative(process.cwd(), assemblyPath)}`));
  }
}

/**
 * Generate plain-English summary of current assembly.cue
 */
export async function explainCommand(options: ExplainOptions, _config: Config): Promise<number> {
  try {
    const format = options.format || "text";
    const structuredOutput = format === "json";

    if (!structuredOutput) {
      console.log(chalk.blue("🔍 Analyzing specification..."));
    }

    const assemblyPath = await resolveAssemblyPath();
    if (!assemblyPath) {
      reportMissingAssembly(structuredOutput);
      return 1;
    }

    logProgress(assemblyPath, structuredOutput);

    const assemblyContent = await fs.readFile(assemblyPath, "utf-8");
    const explanation = await parseAssemblyForExplanation(assemblyContent);

    if (format === "json") {
      return await generateJsonExplanation(explanation, options);
    }
    return await generateTextExplanation(explanation, options);
  } catch (error) {
    console.error(
      chalk.red("Explanation generation failed:"),
      error instanceof Error ? error.message : String(error),
    );
    return 2;
  }
}

async function resolveAssemblyPath(): Promise<string | null> {
  const arbiterFile = path.resolve(".arbiter", "assembly.cue");
  if (await fileExists(arbiterFile)) {
    return arbiterFile;
  }

  const arbiterDir = path.resolve(".arbiter");
  if (await directoryExists(arbiterDir)) {
    const entries = await fs.readdir(arbiterDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const candidate = path.join(arbiterDir, entry.name, "assembly.cue");
      if (await fileExists(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

async function fileExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function directoryExists(target: string): Promise<boolean> {
  try {
    const stats = await fs.stat(target);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Parse assembly file and extract explanation information.
 */
async function parseAssemblyForExplanation(content: string): Promise<AssemblyExplanation> {
  const lines = content.split("\n");
  const explanation = initializeEmptyExplanation();
  const context = createParsingContext();

  processContentLines(lines, explanation, context);
  enrichExplanationWithAnalysis(explanation);

  return explanation;
}

/**
 * Generate JSON explanation output.
 */
async function generateJsonExplanation(
  explanation: AssemblyExplanation,
  options: ExplainOptions,
): Promise<number> {
  const output = {
    timestamp: new Date().toISOString(),
    summary: explanation.summary,
    artifact: explanation.artifact,
    profile: explanation.profile,
    build: explanation.build,
    tests: explanation.tests,
    contracts: explanation.contracts,
    analysis: {
      nextSteps: explanation.nextSteps,
      recommendations: explanation.recommendations,
      potentialIssues: explanation.potentialIssues,
    },
  };

  const jsonContent = JSON.stringify(output, null, 2);

  if (options.output) {
    await writeExplanationFile(options.output, jsonContent);
  } else {
    console.log(jsonContent);
  }

  return 0;
}

/**
 * Generate text explanation output.
 */
async function generateTextExplanation(
  explanation: AssemblyExplanation,
  options: ExplainOptions,
): Promise<number> {
  console.log(chalk.blue("📝 Generating plain-English explanation...\n"));

  printExplanationHeader(explanation);
  printArtifactDetails(explanation.artifact);
  printProfileInfo(explanation.profile);
  printBuildConfig(explanation.build);
  printTestConfig(explanation.tests);
  printContractsAndInvariants(explanation.contracts);
  printNextSteps(explanation.nextSteps);
  printRecommendations(explanation.recommendations);
  printPotentialIssues(explanation.potentialIssues);

  if (options.hints !== false) {
    printHelpfulHints();
  }

  if (options.output) {
    const textContent = generateMarkdownExplanation(explanation);
    await writeExplanationFile(options.output, textContent);
    console.log(chalk.green(`✅ Explanation saved to: ${options.output}`));
  }

  return 0;
}
