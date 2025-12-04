/* istanbul ignore file */
import path from "node:path";
import type { ClientGenerationTarget } from "@/services/generate/contexts.js";
import { ensureDirectory, writeFileWithHooks } from "@/services/generate/hook-executor.js";
import { joinRelativePath, toPathSegments } from "@/services/generate/shared.js";
import { getConfiguredLanguagePlugin } from "@/services/generate/template-orchestrator.js";
import type { GenerateOptions } from "@/services/generate/types.js";
import type { ProjectStructureConfig } from "@/types.js";
import type { AppSpec } from "@arbiter/shared";
import chalk from "chalk";
import fs from "fs-extra";

type FlowRouteMetadata = {
  rootTestId?: string;
  actionTestIds: string[];
  successTestId?: string;
  apiInteractions: Array<{ method: string; path: string; status?: number }>;
};

function generateDefaultFlowTest(flow: any, locatorMap: Record<string, string> = {}): string {
  const steps = (flow.steps || [])
    .map((step: any, index: number) => {
      if (step.click) {
        return `  await page.getByTestId('${step.click}').click(); // step ${index}`;
      }
      if (step.fill?.locator) {
        return `  await page.getByTestId('${step.fill.locator}').fill('test'); // step ${index}`;
      }
      if (step.expect_api?.path) {
        return `  await page.waitForResponse((resp) => resp.url().includes('${step.expect_api.path}'));`;
      }
      if (step.expect?.locator) {
        const testId = locatorMap[step.expect.locator] || step.expect.locator;
        return `  await page.getByTestId('${testId}').waitFor(); // step ${index}`;
      }
      return "// unsupported step";
    })
    .join("\n");

  return `import { test, expect } from '@playwright/test';
\ntest('${flow.id}', async ({ page }) => {
${steps}
  expect(true).toBe(true);
});\n`;
}

async function scaffoldPlaywrightWorkspace(
  appSpec: AppSpec,
  workspaceRoot: string,
  workspaceSegments: string[],
  options: GenerateOptions,
  clientTarget: ClientGenerationTarget | undefined,
  structure: ProjectStructureConfig,
): Promise<string[]> {
  if (!appSpec.behaviors || appSpec.behaviors.length === 0) {
    return [];
  }

  await ensureDirectory(workspaceRoot, options);
  const files: string[] = [];

  const slug = clientTarget?.slug ?? "app";
  const rel = (file: string) => joinRelativePath(...workspaceSegments, file);

  const packageJson = {
    name: `@${slug}/e2e`,
    private: true,
    version: "0.0.0",
    scripts: {
      test: "node ./support/run-e2e.mjs",
      "test:headed": "node ./support/run-e2e.mjs --headed",
      "test:ui": "node ./support/run-e2e.mjs --ui",
    },
    devDependencies: {
      "@playwright/test": "^1.48.2",
      typescript: "^5.5.4",
    },
  };

  await writeFileWithHooks(
    path.join(workspaceRoot, "package.json"),
    JSON.stringify(packageJson, null, 2),
    options,
  );
  files.push(rel("package.json"));

  const tsconfig = {
    compilerOptions: {
      target: "ESNext",
      module: "CommonJS",
      moduleResolution: "Node",
      types: ["node", "@playwright/test"],
      allowSyntheticDefaultImports: true,
      esModuleInterop: true,
      resolveJsonModule: true,
      skipLibCheck: true,
      strict: false,
    },
    include: ["**/*.ts"],
  };

  await writeFileWithHooks(
    path.join(workspaceRoot, "tsconfig.json"),
    JSON.stringify(tsconfig, null, 2),
    options,
  );
  files.push(rel("tsconfig.json"));

  const locatorsDir = path.join(workspaceRoot, "support");
  await ensureDirectory(locatorsDir, options);
  const locatorEntries = Object.entries(appSpec.locators || {}).length
    ? Object.entries(appSpec.locators)
    : [["page:root", '[data-testid="app-root"]']];
  const locatorsContent = `export const locators = {
${locatorEntries.map(([token, selector]) => `  '${token}': '${selector}',`).join("\n")}
} as const;

export type LocatorToken = keyof typeof locators;

export function getLocator(token: LocatorToken): string {
  return locators[token];
}

export function loc(token: LocatorToken | string): string {
  const record = locators as Record<string, string>;
  return record[token as LocatorToken] ?? String(token);
}
`;
  await writeFileWithHooks(path.join(locatorsDir, "locators.ts"), locatorsContent, options);
  files.push(rel(path.join("support", "locators.ts")));

  const runE2eScript = `#!/usr/bin/env node
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function portIsFree(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once('error', () => {
      tester.close(() => resolve(false));
    });
    tester.listen(port, '0.0.0.0', () => {
      tester.close(() => resolve(true));
    });
  });
}

async function findAvailablePort(preferred, envKey) {
  if (process.env[envKey]) {
    return Number(process.env[envKey]);
  }
  const start = Math.max(preferred, 1024);
  let attempts = 0;
  let candidate = start;
  while (attempts < 500) {
    if (await portIsFree(candidate)) {
      return candidate;
    }
    candidate += 1;
    attempts += 1;
  }
  throw new Error('Unable to locate a free port for ' + envKey);
}

async function allocatePorts() {
  return {
    E2E_WEB_PORT: await findAvailablePort(5173, 'E2E_WEB_PORT'),
    E2E_STOREFRONT_PORT: await findAvailablePort(3000, 'E2E_STOREFRONT_PORT'),
    E2E_CATALOG_PORT: await findAvailablePort(4000, 'E2E_CATALOG_PORT'),
    E2E_STRIPE_PORT: await findAvailablePort(4010, 'E2E_STRIPE_PORT'),
  };
}

async function main() {
  const assignments = await allocatePorts();
  const runner = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const projectRoot = path.resolve(__dirname, '..');

  const child = spawn(runner, ['playwright', 'test', ...process.argv.slice(2)], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      ...Object.fromEntries(
        Object.entries(assignments).map(([key, value]) => [key, String(value)]),
      ),
    },
  });

  child.on('exit', (code) => process.exit(code ?? 1));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
`;
  await writeFileWithHooks(
    path.join(workspaceRoot, "support", "run-e2e.mjs"),
    runE2eScript,
    options,
  );
  files.push(rel(path.join("support", "run-e2e.mjs")));

  return files;
}

export async function generateFlowBasedTests(
  appSpec: AppSpec,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
  clientTarget?: ClientGenerationTarget,
): Promise<{ files: string[]; workspaceDir?: string }> {
  const files: string[] = [];

  console.log(chalk.blue("🧪 Generating tests from behaviors..."));

  const language = clientTarget?.config?.language || appSpec.config?.language || "typescript";
  const plugin = getConfiguredLanguagePlugin(language);

  if (!plugin) {
    console.log(
      chalk.yellow(`⚠️  No plugin available for ${language}, using default Playwright tests`),
    );
  }

  const defaultWorkspaceSegments = [
    ...toPathSegments(structure.testsDirectory || "tests"),
    clientTarget?.slug ?? "app",
  ];
  const workspaceRoot =
    clientTarget?.context?.testsDir ?? path.join(outputDir, ...defaultWorkspaceSegments);
  const relativeWorkspace = path.relative(outputDir, workspaceRoot);
  const workspaceSegments =
    relativeWorkspace.trim().length > 0
      ? toPathSegments(relativeWorkspace)
      : defaultWorkspaceSegments;
  const flowsDir = path.join(workspaceRoot, "behaviors");
  if (!fs.existsSync(flowsDir) && !options.dryRun) {
    fs.mkdirSync(flowsDir, { recursive: true });
  }

  for (const flow of appSpec.behaviors) {
    const testContent = generateDefaultFlowTest(flow, appSpec.locators);

    const testFileName = `${flow.id.replace(/:/g, "_")}.test.ts`;
    const testPath = path.join(flowsDir, testFileName);
    await writeFileWithHooks(testPath, testContent, options);
    files.push(joinRelativePath(...workspaceSegments, "behaviors", testFileName));
  }

  const workspaceFiles = await scaffoldPlaywrightWorkspace(
    appSpec,
    workspaceRoot,
    workspaceSegments,
    options,
    clientTarget,
    structure,
  );
  files.push(...workspaceFiles);

  const workspaceDir = joinRelativePath(...workspaceSegments) || ".";
  return { files, workspaceDir };
}
