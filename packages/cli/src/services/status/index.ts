import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import jsyaml from "js-yaml";
import { ApiClient } from "../../api-client.js";
import type { Config } from "../../config.js";
import { getCueManipulator } from "../../constraints/cli-integration.js";
import { validateCUE } from "../../cue/index.js";
import { formatJson, formatStatusTable, formatYaml } from "../../utils/formatting.js";
import { withProgress } from "../../utils/progress.js";

export interface StatusOptions {
  detailed?: boolean;
}

interface ProjectStatus {
  health: "healthy" | "degraded" | "error";
  healthDetails?: string;
  lastUpdated?: string;
  components?: Array<{
    type: string;
    name: string;
    status: "active" | "inactive" | "error";
    lastModified?: string;
    dependencies?: string[];
  }>;
  validations?: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
  specifications?: Array<{
    path: string;
    valid: boolean;
    errors: number;
    warnings: number;
    lastValidated?: string;
  }>;
}

async function getLocalProjectStatus(config: Config): Promise<ProjectStatus> {
  const assemblyPath = path.resolve(config.projectDir || process.cwd(), ".arbiter", "assembly.cue");

  if (!(await fs.pathExists(assemblyPath))) {
    return {
      health: "error",
      healthDetails: "Local specification not found",
      components: [],
      validations: { total: 0, passed: 0, failed: 0, warnings: 0 },
      specifications: [],
    };
  }

  const stats = await fs.stat(assemblyPath);
  const content = await fs.readFile(assemblyPath, "utf-8");
  const validation = await validateCUE(content);

  let parsedSpec: any = null;
  let parseError: string | undefined;
  const manipulator = getCueManipulator();
  try {
    parsedSpec = await manipulator.parse(content);
  } catch (error) {
    parseError = error instanceof Error ? error.message : String(error);
  } finally {
    await manipulator.cleanup();
  }

  const components =
    Object.entries(parsedSpec?.services ?? {}).map(([name, service]: [string, any]) => ({
      type: "service",
      name,
      status: "active" as const,
      lastModified: stats.mtime.toISOString(),
      dependencies: Object.keys(service?.dependencies ?? {}),
    })) ?? [];

  const health = validation.valid && !parseError ? "healthy" : "error";
  const healthDetails = !validation.valid
    ? validation.errors[0] || "Validation failed"
    : parseError
      ? parseError
      : "Specification valid";

  return {
    health,
    healthDetails,
    lastUpdated: stats.mtime.toISOString(),
    components,
    validations: {
      total: 1,
      passed: validation.valid ? 1 : 0,
      failed: validation.valid ? 0 : 1,
      warnings: 0,
    },
    specifications: [
      {
        path: path.relative(config.projectDir || process.cwd(), assemblyPath) || "assembly.cue",
        valid: validation.valid && !parseError,
        errors: validation.valid ? 0 : validation.errors.length || 1,
        warnings: 0,
        lastValidated: new Date().toISOString(),
      },
    ],
  };
}

function displayStatusTable(status: ProjectStatus, detailed: boolean): void {
  const normalizedHealth = status.health ?? "degraded";
  const healthColor = getHealthColor(normalizedHealth);
  const healthIcon = getHealthIcon(normalizedHealth);
  console.log(`${healthIcon} Project Health: ${healthColor(normalizedHealth.toUpperCase())}`);

  if (status.lastUpdated) {
    console.log(chalk.gray(`Last Updated: ${new Date(status.lastUpdated).toLocaleString()}`));
  }

  console.log();

  const components = status.components || [];
  const validations = status.validations || { total: 0, passed: 0, failed: 0, warnings: 0 };

  console.log(chalk.bold("Components:"));
  if (components.length === 0) {
    console.log(chalk.gray("  No components discovered"));
  } else {
    for (const component of components) {
      let statusText = chalk.green("active");
      if (component.status === "inactive") statusText = chalk.yellow("inactive");
      if (component.status === "error") statusText = chalk.red("error");

      console.log(`  • ${component.type}: ${chalk.bold(component.name)} (${statusText})`);
      if (component.lastModified) {
        console.log(chalk.gray(`    Last modified: ${component.lastModified}`));
      }
      if (component.dependencies && component.dependencies.length > 0) {
        console.log(chalk.gray(`    Dependencies: ${component.dependencies.join(", ")}`));
      }
    }
  }

  console.log();
  console.log(chalk.bold("Validations:"));
  console.log(`  Total: ${validations.total}`);
  console.log(`  Passed: ${chalk.green(validations.passed)}`);
  console.log(
    `  Failed: ${validations.failed > 0 ? chalk.red(validations.failed) : validations.failed}`,
  );
  console.log(
    `  Warnings: ${validations.warnings > 0 ? chalk.yellow(validations.warnings) : validations.warnings}`,
  );

  if (detailed && status.specifications && status.specifications.length > 0) {
    console.log();
    console.log(chalk.bold("Specifications:"));
    for (const spec of status.specifications) {
      const validText = spec.valid ? chalk.green("valid") : chalk.red("invalid");
      console.log(`  • ${spec.path}: ${validText}`);
      console.log(`    Errors: ${spec.errors}, Warnings: ${spec.warnings}`);
      if (spec.lastValidated) {
        console.log(chalk.gray(`    Last validated: ${spec.lastValidated}`));
      }
    }
  }
}

export function getHealthColor(health: ProjectStatus["health"]): typeof chalk.green {
  switch (health) {
    case "healthy":
      return chalk.green;
    case "degraded":
      return chalk.yellow;
    case "error":
      return chalk.red;
    default:
      return chalk.gray;
  }
}

export function getHealthIcon(health: ProjectStatus["health"]): string {
  switch (health) {
    case "healthy":
      return "✅";
    case "degraded":
      return "⚠️";
    case "error":
      return "❌";
    default:
      return "ℹ️";
  }
}

export function normalizeRemoteProjectStatus(data: any, projectId?: string): ProjectStatus {
  const isValid = data?.status === "healthy";
  const components = Array.isArray(data?.components) ? data.components : [];
  const specs = Array.isArray(data?.specifications) ? data.specifications : [];

  return {
    health: isValid ? "healthy" : "degraded",
    healthDetails: data?.message || data?.error,
    lastUpdated: data?.timestamp || new Date().toISOString(),
    components: components.map((component: any) => ({
      type: component.type || "unknown",
      name: component.name || "unnamed",
      status: component.status || "degraded",
      lastModified: component.updatedAt,
      dependencies: component.dependencies || [],
    })),
    validations: data?.validations || {
      total: specs.length,
      passed: specs.filter((s: any) => s.valid).length,
      failed: specs.filter((s: any) => !s.valid).length,
      warnings: 0,
    },
    specifications: specs.map((spec: any) => ({
      path: spec.path || "unknown",
      valid: Boolean(spec.valid),
      errors: spec.errors || 0,
      warnings: spec.warnings || 0,
      lastValidated: spec.lastValidated,
    })),
  };
}

export async function statusCommand(options: StatusOptions, config: Config): Promise<number> {
  try {
    const structuredJson = config.format === "json";
    if (config.localMode) {
      const status = await getLocalProjectStatus(config);

      switch (config.format) {
        case "json":
          console.log(JSON.stringify(status, null, 2));
          break;
        case "yaml":
          console.log(jsyaml.dump(status, { indent: 2 }));
          break;
        case "table":
        default:
          displayStatusTable(status, options.detailed ?? false);
          break;
      }

      return status.health === "error" ? 1 : 0;
    }

    const client = new ApiClient(config);

    const result = structuredJson
      ? await client.getProjectStatus(config.projectId)
      : await withProgress({ text: "Getting project status..." }, () =>
          client.getProjectStatus(config.projectId),
        );

    if (!result.success) {
      if (!structuredJson) {
        console.error(chalk.red("Status check failed:"), result.error);
        console.log(chalk.yellow("Falling back to local specification status...\n"));
      }
      const fallbackStatus = await getLocalProjectStatus(config);
      if (structuredJson) {
        console.log(JSON.stringify(fallbackStatus, null, 2));
      } else if (config.format === "yaml") {
        console.log(jsyaml.dump(fallbackStatus, { indent: 2 }));
      } else {
        displayStatusTable(fallbackStatus, options.detailed ?? false);
      }
      return fallbackStatus.health === "error" ? 1 : 0;
    }

    const status = normalizeRemoteProjectStatus(result.data, config.projectId);

    switch (config.format) {
      case "json":
        console.log(JSON.stringify(status, null, 2));
        break;
      case "yaml":
        console.log(jsyaml.dump(status, { indent: 2 }));
        break;
      case "table":
      default:
        displayStatusTable(status, options.detailed ?? false);
        break;
    }

    return status.health === "error" ? 1 : 0;
  } catch (error) {
    console.error(
      chalk.red("Status command failed:"),
      error instanceof Error ? error.message : String(error),
    );
    return 2;
  }
}
