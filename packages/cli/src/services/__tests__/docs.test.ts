import { describe, expect, it, spyOn } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { CLIConfig } from "../../types.js";
import { docsCommand, docsGenerateCommand } from "../docs/index.js";

const baseConfig = (projectDir: string): CLIConfig => ({
  apiUrl: "http://localhost",
  timeout: 1,
  format: "json",
  color: false,
  localMode: true,
  projectDir,
  projectStructure: {
    clientsDirectory: "clients",
    servicesDirectory: "services",
    packagesDirectory: "packages",
    toolsDirectory: "tools",
    docsDirectory: "docs",
    testsDirectory: "tests",
    infraDirectory: "infra",
  },
});

const tmp = () => fs.mkdtemp(path.join(os.tmpdir(), "arb-docs-"));

describe("docs commands", () => {
  it("shows help or errors for invalid subcommands", async () => {
    const config = baseConfig(process.cwd());
    const warn = spyOn(console, "error").mockImplementation(() => {});
    const code = await docsCommand("unknown" as any, {}, config);
    expect(code).toBe(1);
    warn.mockRestore();
  });

  it("returns failure when required inputs are missing", async () => {
    const dir = await tmp();
    const config = baseConfig(dir);
    const schemaCode = await docsCommand("schema", {}, config);
    const apiCode = await docsCommand("api", {}, config);
    expect(schemaCode).toBe(1);
    expect(apiCode).toBe(1);
  });

  it("generates placeholder docs in requested formats", async () => {
    const dir = await tmp();
    const config = baseConfig(dir);
    const exitCode = await docsGenerateCommand(
      { output: path.join(dir, "out"), formats: "markdown,json" },
      config,
    );
    expect(exitCode).toBe(0);

    const mdExists = await fs.readFile(path.join(dir, "out", "cli-reference.md"), "utf8");
    const jsonExists = await fs.readFile(path.join(dir, "out", "cli-reference.json"), "utf8");
    expect(mdExists).toContain("Arbiter CLI Reference");
    const parsed = JSON.parse(jsonExists);
    expect(parsed.generatedAt).toBeDefined();
  });

  it("produces schema docs and examples when assembly exists", async () => {
    const dir = await tmp();
    const prev = process.cwd();
    process.chdir(dir);

    try {
      const config = baseConfig(dir);
      const assembly = `// Project name\nname: string\n// Service description\nservice: string default: "api"\nimport "github.com/arbiter/core"`;
      await fs.writeFile(path.join(dir, "arbiter.assembly.cue"), assembly, "utf-8");

      const code = await docsCommand(
        "schema",
        {
          format: "markdown",
          output: path.join(dir, "out", "schema.md"),
          examples: true,
        },
        config,
      );

      expect(code).toBe(0);
      const output = await fs.readFile(path.join(dir, "out", "schema.md"), "utf-8");
      expect(output).toContain("Arbiter Assembly");
      expect(output).toContain("service");

      const libraryExample = await fs.readFile(
        path.join(dir, "out", "examples", "library.cue"),
        "utf-8",
      );
      expect(libraryExample).toContain('kind: "library"');
    } finally {
      process.chdir(prev);
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("renders API docs when surface.json is present", async () => {
    const dir = await tmp();
    const prev = process.cwd();
    process.chdir(dir);

    try {
      const config = baseConfig(dir);
      const surface = {
        functions: [
          {
            name: "getUser",
            description: "Fetch a user",
            parameters: [{ name: "id", type: "string", description: "user id" }],
            returns: { type: "User", description: "user record" },
          },
        ],
      };
      await fs.writeFile(path.join(dir, "surface.json"), JSON.stringify(surface, null, 2), "utf-8");

      const code = await docsCommand(
        "api",
        { format: "html", output: path.join(dir, "out", "api.html") },
        config,
      );

      expect(code).toBe(0);
      const html = await fs.readFile(path.join(dir, "out", "api.html"), "utf-8");
      expect(html).toContain("getUser");
      expect(html).toContain("API Documentation");
    } finally {
      process.chdir(prev);
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
