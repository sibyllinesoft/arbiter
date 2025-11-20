import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import { safeFileOperation } from "../../../constraints/index.js";

interface SchemaOptions {
  example?: string;
  rules?: string;
  format?: string;
  [key: string]: any;
}

interface CueSchemaDetails {
  cue: string;
  cueFile: string;
}

export async function addSchema(
  manipulator: any,
  content: string,
  schemaName: string,
  options: SchemaOptions,
): Promise<string> {
  const { example, rules } = options;

  const schemaConfig: Record<string, unknown> = {};

  if (example) {
    try {
      schemaConfig.example = JSON.parse(example);
    } catch {
      throw new Error("Invalid example format. Expected JSON.");
    }
  }

  if (rules) {
    try {
      const parsedRules = JSON.parse(rules);
      schemaConfig.rules = parsedRules;
      schemaConfig.schemaFormat = "json";

      if (!options.format || options.format === "json-schema") {
        try {
          const cueDetails = await convertJsonSchemaRulesToCue(schemaName, parsedRules);
          schemaConfig.schemaFormat = "cue";
          schemaConfig.cue = cueDetails.cue;
          schemaConfig.cueFile = cueDetails.cueFile;
        } catch (conversionError) {
          console.warn(
            chalk.yellow(
              `⚠️  Failed to convert JSON Schema to CUE for ${schemaName}: ${
                conversionError instanceof Error ? conversionError.message : conversionError
              }`,
            ),
          );
          console.warn(chalk.dim("Falling back to storing raw JSON rules."));
        }
      }
    } catch {
      throw new Error("Invalid rules format. Expected JSON.");
    }
  }

  return await manipulator.addToSection(content, "components.schemas", schemaName, schemaConfig);
}

async function convertJsonSchemaRulesToCue(
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
      cueFile: path.join("./schemas", cueFileName),
    };
  } finally {
    await fs.remove(tempDir);
  }
}

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
