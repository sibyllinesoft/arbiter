import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, spyOn } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as YAML from "yaml";
import { generateCommand } from "../commands/generate.js";
import { DEFAULT_PROJECT_STRUCTURE } from "../config.js";
import { safeFileOperation } from "../constraints/index.js";
import type { CLIConfig } from "../types.js";

function buildConfig(projectDir: string): CLIConfig {
  return {
    apiUrl: "http://127.0.0.1:65535",
    timeout: 500,
    format: "table",
    color: false,
    projectDir,
    projectStructure: { ...DEFAULT_PROJECT_STRUCTURE },
  };
}

function createSpecContent(serviceBlocks: string): string {
  return `package testapp

{
	product: {
		name: "Test Application"
	}
	config: {
		language: "typescript"
		kind:     "service"
	}
	ui: {
		routes: []
	}
	flows: []
	deployment: {
		target: "kubernetes"
	}
	services: {
${serviceBlocks}
	}
}
`;
}

function cueService(name: string, language: string, directory: string): string {
  return `		${name}: {
			type:            "internal"
			workload:        "deployment"
			language:        "${language}"
			sourceDirectory: "${directory}"
		}`;
}

function splitHeaderAndBody(content: string): { header: string; body: string } {
  const normalized = content.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  let index = 0;
  while (index < lines.length && lines[index].startsWith("#")) {
    index += 1;
  }

  const header = lines.slice(0, index).join("\n");
  const body = lines.slice(index).join("\n").replace(/^\n/, "");

  return {
    header: header ? `${header}\n` : "",
    body,
  };
}

describe("Generate command workflows", () => {
  let consoleErrorSpy: ReturnType<typeof spyOn<typeof console, "error">>;

  beforeAll(() => {
    consoleErrorSpy = spyOn(console, "error");
    consoleErrorSpy.mockImplementation(() => {});
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  const PROJECT_ROOT = path.resolve(__dirname, "../../../..");
  let tmpDir: string;
  let config: CLIConfig;
  let previousSkipRemoteSpec: string | undefined;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "arbiter-generate-workflow-"));
    process.chdir(PROJECT_ROOT);
    process.chdir(tmpDir);
    config = buildConfig(tmpDir);
    previousSkipRemoteSpec = process.env.ARBITER_SKIP_REMOTE_SPEC;
    process.env.ARBITER_SKIP_REMOTE_SPEC = "1";
  });

  afterEach(async () => {
    process.chdir(PROJECT_ROOT);
    await fs.rm(tmpDir, { recursive: true, force: true });
    if (previousSkipRemoteSpec === undefined) {
      delete process.env.ARBITER_SKIP_REMOTE_SPEC;
    } else {
      process.env.ARBITER_SKIP_REMOTE_SPEC = previousSkipRemoteSpec;
    }
    consoleErrorSpy.mockClear();
  });

  async function writeSpec(serviceBlocks: string): Promise<void> {
    const specDir = path.join(tmpDir, ".arbiter", "test-app");
    await fs.mkdir(specDir, { recursive: true });
    await safeFileOperation("write", path.join(specDir, "assembly.cue"), async (validatedPath) => {
      await fs.writeFile(validatedPath, createSpecContent(serviceBlocks));
    });
  }

  async function readWorkflow(): Promise<string> {
    const workflowPath = path.join(tmpDir, ".github", "workflows", "ci.yml");
    return fs.readFile(workflowPath, "utf8");
  }

  it("creates modular workflow jobs for application and services", async () => {
    await writeSpec([cueService("api", "typescript", "./services/api")].join("\n"));

    const exitCode = await generateCommand({ outputDir: ".", force: true }, config);
    expect(exitCode).toBe(0);

    const workflowContent = await readWorkflow();

    expect(workflowContent).toContain("arbiter_app:");
    expect(workflowContent).toContain("npm install");
    expect(workflowContent).toContain("npm run lint");
  });

  it("updates workflows idempotently while preserving manual jobs", async () => {
    await writeSpec([cueService("api", "typescript", "./services/api")].join("\n"));

    let exitCode = await generateCommand({ outputDir: ".", force: true }, config);
    expect(exitCode).toBe(0);

    const firstWorkflow = await readWorkflow();
    const { header, body } = splitHeaderAndBody(firstWorkflow);
    const doc = YAML.parse(body) as Record<string, any>;
    doc.jobs = doc.jobs || {};
    doc.jobs.manual_health = {
      "runs-on": "ubuntu-latest",
      steps: [{ run: 'echo "manual job"' }],
    };
    const manualWorkflow =
      header + YAML.stringify(doc, { indent: 2, lineWidth: 0 }).trimEnd() + "\n";
    await safeFileOperation(
      "write",
      path.join(tmpDir, ".github", "workflows", "ci.yml"),
      async (validatedPath) => {
        await fs.writeFile(validatedPath, manualWorkflow);
      },
    );

    // Add a new Python service and regenerate
    await writeSpec(
      [
        cueService("api", "typescript", "./services/api"),
        cueService("reporting", "python", "./services/reporting"),
      ].join("\n"),
    );

    exitCode = await generateCommand({ outputDir: ".", force: true }, config);
    expect(exitCode).toBe(0);

    const updatedWorkflow = await readWorkflow();
    expect(updatedWorkflow).toContain("arbiter_service_api:");
    expect(updatedWorkflow).toContain("arbiter_service_reporting:");
    expect(updatedWorkflow).toContain("pip install -e .");
    expect(updatedWorkflow).toContain("manual_health:");
    expect(updatedWorkflow).toContain('echo "manual job"');

    // Remove the original TypeScript service and ensure it is dropped
    await writeSpec([cueService("reporting", "python", "./services/reporting")].join("\n"));

    exitCode = await generateCommand({ outputDir: ".", force: true }, config);
    expect(exitCode).toBe(0);

    const finalWorkflow = await readWorkflow();
    expect(finalWorkflow).not.toContain("arbiter_service_api:");
    expect(finalWorkflow).toContain("arbiter_service_reporting:");
    expect(finalWorkflow).toContain("manual_health:");
  });
});
