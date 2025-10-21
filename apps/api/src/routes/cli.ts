import path from "path";
import fs from "fs-extra";
import { Hono } from "hono";

type Dependencies = Record<string, unknown>;

export function createCliRouter(deps: Dependencies) {
  const PROJECT_ROOT = path.resolve(__dirname, "../../../..");

  const router = new Hono();

  // Add endpoint for MCP add commands
  router.post("/add", async (c) => {
    try {
      const body = await c.req.json();
      const { subcommand, name, options = {} } = body;

      if (!subcommand || !name) {
        return c.json(
          {
            success: false,
            error: "subcommand and name parameters are required",
          },
          400,
        );
      }

      // Import the addCommand function
      const { addCommand } = await import(`${PROJECT_ROOT}/packages/cli/src/commands/add.js`);

      // Create a basic CLI config (you may want to make this configurable)
      const config = {
        apiUrl: "http://localhost:5050",
        timeout: 30000,
        format: "json" as const,
        color: false,
        projectDir: process.cwd(),
        projectStructure: {
          appsDirectory: "apps",
          packagesDirectory: "packages",
          servicesDirectory: "services",
          testsDirectory: "tests",
          infraDirectory: "infra",
          endpointDirectory: "apps/api/src/endpoints",
        },
      };

      // Call the add command
      const exitCode = await addCommand(subcommand, name, options, config);

      if (exitCode === 0) {
        return c.json({
          success: true,
          message: `Successfully added ${subcommand}: ${name}`,
          subcommand,
          name,
          options,
        });
      } else {
        return c.json(
          {
            success: false,
            error: `Add command failed with exit code ${exitCode}`,
            subcommand,
            name,
          },
          500,
        );
      }
    } catch (error) {
      console.error("Add API error:", error);
      return c.json(
        {
          success: false,
          error: "Add command failed",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  });

  // Create endpoint for MCP create project command
  router.post("/create", async (c) => {
    try {
      const body = await c.req.json();
      const { name, options = {} } = body;

      if (!name) {
        return c.json(
          {
            success: false,
            error: "name parameter is required",
          },
          400,
        );
      }

      // Import the initCommand function
      const { initCommand } = await import(`${PROJECT_ROOT}/packages/cli/src/commands/init.js`);

      // Determine target directory
      const targetDir = options.directory
        ? path.resolve(options.directory, name)
        : path.resolve(process.cwd(), name);

      // Prepare init options
      const initOptions = {
        template: options.template || "basic",
        force: options.force || false,
        ...options,
      };

      // Change to target directory for project creation
      const originalCwd = process.cwd();

      try {
        // Ensure parent directory exists
        await fs.ensureDir(path.dirname(targetDir));

        // Create and change to target directory
        await fs.ensureDir(targetDir);
        process.chdir(targetDir);

        // Call the init command
        const exitCode = await initCommand(name, initOptions);

        if (exitCode === 0) {
          return c.json({
            success: true,
            message: `Successfully created project: ${name}`,
            name,
            directory: targetDir,
            template: initOptions.template,
            options: initOptions,
          });
        } else {
          return c.json(
            {
              success: false,
              error: `Init command failed with exit code ${exitCode}`,
              name,
              directory: targetDir,
            },
            500,
          );
        }
      } finally {
        // Always restore original working directory
        process.chdir(originalCwd);
      }
    } catch (error) {
      console.error("Create API error:", error);
      return c.json(
        {
          success: false,
          error: "Create project failed",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  });

  // Surface analysis endpoint - thin wrapper around CLI surface command
  router.post("/surface", async (c) => {
    try {
      const body = await c.req.json();
      const { targets = [], options = {} } = body;

      if (!targets.length) {
        return c.json(
          {
            success: false,
            error: "targets parameter is required",
          },
          400,
        );
      }

      // Import the CLI surface command directly
      const { surfaceCommand } = await import(
        `${PROJECT_ROOT}/packages/cli/src/commands/surface.js`
      );

      // Create a minimal config object
      const config = {
        apiUrl: "http://localhost:5050",
        timeout: 30000,
        format: "json" as const,
        color: false,
        projectDir: targets[0],
        projectStructure: {
          appsDirectory: "apps",
          packagesDirectory: "packages",
          servicesDirectory: "services",
          testsDirectory: "tests",
          infraDirectory: "infra",
          endpointDirectory: "apps/api/src/endpoints",
        },
      };

      // Map API options to CLI surface options
      const surfaceOptions = {
        language: options.language ?? "typescript", // Default language
        output: options.output,
        outputDir: options.outputDir,
        projectName: options.projectName,
        genericNames: options.genericNames ?? false,
        diff: options.diff ?? false,
        format: "json" as const,
        ndjsonOutput: false,
        agentMode: true, // Use agent mode for API
        verbose: options.verbose ?? false,
      };

      // Change to the target directory for analysis
      const originalCwd = process.cwd();
      process.chdir(targets[0]);

      try {
        // Execute the CLI surface command
        const exitCode = await surfaceCommand(surfaceOptions, config);

        if (exitCode !== 0) {
          return c.json(
            {
              success: false,
              error: "Surface analysis failed",
              message: `CLI command exited with code ${exitCode}`,
            },
            500,
          );
        }

        // Return success - the CLI surface command handles its own output
        return c.json({
          success: true,
          targets,
          message: "Surface analysis completed successfully",
          note: "Results written to surface file in project directory",
        });
      } finally {
        // Restore original working directory
        process.chdir(originalCwd);
      }
    } catch (error) {
      console.error("Surface analysis error:", error);
      return c.json(
        {
          success: false,
          error: "Surface analysis failed",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  });

  return router;
}
