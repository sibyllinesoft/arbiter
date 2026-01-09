/**
 * @packageDocumentation
 * Schema subcommand module - Handles adding data schemas to CUE specifications.
 *
 * Supports:
 * - JSON Schema definitions with examples
 * - Automatic conversion to CUE format
 * - Validation rules configuration
 */

import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { safeFileOperation } from "@/constraints/index.js";
import chalk from "chalk";
import fs from "fs-extra";

/** Options for schema configuration */
interface SchemaOptions {
  example?: string;
  rules?: string;
  format?: string;
  [key: string]: any;
}

/** Details of a converted CUE schema */
interface CueSchemaDetails {
  cue: string;
  cueFile: string;
}

/**
 * Add a data schema to the CUE specification.
 * @param manipulator - CUE file manipulator instance
 * @param content - Current CUE file content
 * @param schemaName - Name of the schema
 * @param options - Schema configuration options
 * @returns Updated CUE file content
 */
export async function addSchema(
  manipulator: any,
  content: string,
  schemaName: string,
  options: SchemaOptions,
): Promise<string> {
  const schemaConfig: Record<string, unknown> = {};

  addExampleToConfig(schemaConfig, options.example);
  await addRulesToConfig(schemaConfig, schemaName, options);

  return await manipulator.addToSection(content, "components.schemas", schemaName, schemaConfig);
}

/**
 * Add an example to the schema configuration.
 * @param config - Schema configuration object
 * @param example - JSON example string
 */
function addExampleToConfig(config: Record<string, unknown>, example: string | undefined): void {
  if (!example) return;
  try {
    config.example = JSON.parse(example);
  } catch {
    throw new Error("Invalid example format. Expected JSON.");
  }
}

/**
 * Add validation rules to the schema configuration.
 * @param config - Schema configuration object
 * @param schemaName - Name of the schema
 * @param options - Schema configuration options
 */
async function addRulesToConfig(
  config: Record<string, unknown>,
  schemaName: string,
  options: SchemaOptions,
): Promise<void> {
  if (!options.rules) return;

  const parsedRules = parseRulesJson(options.rules);
  config.rules = parsedRules;
  config.schemaFormat = "json";

  await maybeConvertToCue(config, schemaName, parsedRules, options.format);
}

/**
 * Parse JSON rules string into an object.
 * @param rules - JSON rules string
 * @returns Parsed rules object
 */
function parseRulesJson(rules: string): Record<string, unknown> {
  try {
    return JSON.parse(rules);
  } catch {
    throw new Error("Invalid rules format. Expected JSON.");
  }
}

/**
 * Optionally convert JSON Schema rules to CUE format.
 * @param config - Schema configuration object
 * @param schemaName - Name of the schema
 * @param parsedRules - Parsed rules object
 * @param format - Optional format specification
 */
async function maybeConvertToCue(
  config: Record<string, unknown>,
  schemaName: string,
  parsedRules: Record<string, unknown>,
  format: string | undefined,
): Promise<void> {
  if (format && format !== "json-schema") return;

  try {
    const cueDetails = await convertJsonSchemaRulesToCue(schemaName, parsedRules);
    config.schemaFormat = "cue";
    config.cue = cueDetails.cue;
    config.cueFile = cueDetails.cueFile;
  } catch (conversionError) {
    logCueConversionWarning(schemaName, conversionError);
  }
}

/**
 * Log a warning when CUE conversion fails.
 * @param schemaName - Name of the schema
 * @param error - The conversion error
 */
function logCueConversionWarning(schemaName: string, error: unknown): void {
  console.warn(
    chalk.yellow(
      `⚠️  Failed to convert JSON Schema to CUE for ${schemaName}: ${
        error instanceof Error ? error.message : error
      }`,
    ),
  );
  console.warn(chalk.dim("Falling back to storing raw JSON rules."));
}

/**
 * Convert JSON Schema rules to CUE format.
 * @param schemaName - Name of the schema
 * @param rules - JSON Schema rules object
 * @returns CUE schema details including source and file path
 */
export async function convertJsonSchemaRulesToCue(
  schemaName: string,
  rules: Record<string, unknown>,
): Promise<CueSchemaDetails> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "arbiter-schema-"));
  const sanitizedName = schemaName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "schema";

  try {
    const inputPath = path.join(tempDir, `${sanitizedName}.json`);
    await safeFileOperation("write", inputPath, async (validatedPath) => {
      await fs.writeFile(validatedPath, JSON.stringify(rules, null, 2), "utf-8");
    });

    const cueSource = await runCueImport(inputPath);
    const schemaDir = path.resolve(".arbiter", "schemas");
    await fs.ensureDir(schemaDir);

    const cueFileName = `${sanitizedName}.cue`;
    const cuePath = path.join(schemaDir, cueFileName);
    await safeFileOperation("write", cuePath, async (validatedPath) => {
      await fs.writeFile(validatedPath, `${cueSource.trim()}\n`, "utf-8");
    });

    return {
      cue: cueSource.trim(),
      cueFile: path.join("@/services/add/subcommands/schemas", cueFileName),
    };
  } finally {
    await fs.remove(tempDir);
  }
}

/**
 * Run the CUE import command to convert JSON Schema to CUE.
 * @param inputPath - Path to the input JSON file
 * @returns CUE source code output
 */
async function runCueImport(inputPath: string): Promise<string> {
  return await new Promise((resolve, reject) => {
    const child = spawn("cue", ["import", "--out", "cue", "--from", "jsonschema", inputPath], {
      cwd: process.cwd(),
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(
          new Error(
            stderr.trim() || `cue import exited with code ${code ?? "unknown"} while converting.`,
          ),
        );
      }
    });
  });
}
