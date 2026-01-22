/**
 * CLI router for exposing CLI commands as HTTP endpoints.
 * Provides add, create, and surface operations.
 */
import path from "path";
import fs from "fs-extra";
import { Hono } from "hono";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

type Dependencies = Record<string, unknown>;

interface CliConfig {
  apiUrl: string;
  timeout: number;
  format: "json";
  color: boolean;
  projectDir: string;
  projectStructure: {
    appsDirectory: string;
    packagesDirectory: string;
    servicesDirectory: string;
    docsDirectory: string;
    testsDirectory: string;
    infraDirectory: string;
    packageRelative: {
      docsDirectory: boolean;
      testsDirectory: boolean;
      infraDirectory: boolean;
    };
  };
}

const PROJECT_ROOT = path.resolve(__dirname, "../../../..");

function createDefaultConfig(projectDir = process.cwd()): CliConfig {
  return {
    apiUrl: "http://localhost:5050",
    timeout: 30000,
    format: "json",
    color: false,
    projectDir,
    projectStructure: {
      appsDirectory: "apps",
      packagesDirectory: "packages",
      servicesDirectory: "services",
      docsDirectory: "docs",
      testsDirectory: "tests",
      infraDirectory: "infra",
      packageRelative: {
        docsDirectory: false,
        testsDirectory: false,
        infraDirectory: false,
      },
    },
  };
}

function errorResponse(c: Context, message: string, details?: string, status = 500) {
  return c.json(
    {
      success: false,
      error: message,
      ...(details && { message: details }),
    },
    status as ContentfulStatusCode,
  );
}

function successResponse(c: Context, data: Record<string, unknown>) {
  return c.json({ success: true, ...data });
}

async function withDirectoryContext<T>(targetDir: string, fn: () => Promise<T>): Promise<T> {
  const originalCwd = process.cwd();
  process.chdir(targetDir);
  try {
    return await fn();
  } finally {
    process.chdir(originalCwd);
  }
}

/**
 * Handle the /add endpoint.
 */
async function handleAddCommand(c: Context) {
  const { subcommand, name, options = {} } = await c.req.json();

  if (!subcommand || !name) {
    return errorResponse(c, "subcommand and name parameters are required", undefined, 400);
  }

  const { addCommand } = await import(`${PROJECT_ROOT}/packages/cli/src/commands/add.js`);
  const exitCode = await addCommand(subcommand, name, options, createDefaultConfig());

  if (exitCode !== 0) {
    return errorResponse(c, `Add command failed with exit code ${exitCode}`);
  }

  return successResponse(c, {
    message: `Successfully added ${subcommand}: ${name}`,
    subcommand,
    name,
    options,
  });
}

/**
 * Handle the /create endpoint.
 */
async function handleCreateCommand(c: Context) {
  const { name, options = {} } = await c.req.json();

  if (!name) {
    return errorResponse(c, "name parameter is required", undefined, 400);
  }

  const { initCommand } = await import(`${PROJECT_ROOT}/packages/cli/src/commands/init.js`);

  const targetDir = options.directory
    ? path.resolve(options.directory, name)
    : path.resolve(process.cwd(), name);

  const initOptions = {
    template: options.template || "basic",
    force: options.force || false,
    ...options,
  };

  await fs.ensureDir(path.dirname(targetDir));
  await fs.ensureDir(targetDir);

  const exitCode = await withDirectoryContext(targetDir, () => initCommand(name, initOptions));

  if (exitCode !== 0) {
    return errorResponse(c, `Init command failed with exit code ${exitCode}`);
  }

  return successResponse(c, {
    message: `Successfully created project: ${name}`,
    name,
    directory: targetDir,
    template: initOptions.template,
    options: initOptions,
  });
}

/**
 * Handle the /surface endpoint.
 */
async function handleSurfaceCommand(c: Context) {
  const { targets = [], options = {} } = await c.req.json();

  if (!targets.length) {
    return errorResponse(c, "targets parameter is required", undefined, 400);
  }

  const { surfaceCommand } = await import(`${PROJECT_ROOT}/packages/cli/src/commands/surface.js`);

  const surfaceOptions = {
    language: options.language ?? "typescript",
    output: options.output,
    outputDir: options.outputDir,
    projectName: options.projectName,
    genericNames: options.genericNames ?? false,
    diff: options.diff ?? false,
    format: "json" as const,
    ndjsonOutput: false,
    agentMode: true,
    verbose: options.verbose ?? false,
  };

  const exitCode = await withDirectoryContext(targets[0], () =>
    surfaceCommand(surfaceOptions, createDefaultConfig(targets[0])),
  );

  if (exitCode !== 0) {
    return errorResponse(c, "Surface analysis failed", `CLI command exited with code ${exitCode}`);
  }

  return successResponse(c, {
    targets,
    message: "Surface analysis completed successfully",
    note: "Results written to surface file in project directory",
  });
}

type RouteHandler = (c: Context) => Promise<Response>;

/** Wrap route handler with error handling */
function withErrorHandling(
  handler: RouteHandler,
  operationName: string,
  failureMessage: string,
): RouteHandler {
  return async (c: Context) => {
    try {
      return await handler(c);
    } catch (error) {
      console.error(`${operationName} error:`, error);
      return errorResponse(
        c,
        failureMessage,
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  };
}

/**
 * Create the CLI router with add, create, and surface endpoints.
 */
export function createCliRouter(_deps: Dependencies) {
  const router = new Hono();

  router.post("/add", withErrorHandling(handleAddCommand, "Add API", "Add command failed"));
  router.post(
    "/create",
    withErrorHandling(handleCreateCommand, "Create API", "Create project failed"),
  );
  router.post(
    "/surface",
    withErrorHandling(handleSurfaceCommand, "Surface analysis", "Surface analysis failed"),
  );

  return router;
}
