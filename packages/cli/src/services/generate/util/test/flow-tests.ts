/* istanbul ignore file */
import path from "node:path";
import { getConfiguredLanguagePlugin } from "@/services/generate/core/orchestration/template-orchestrator.js";
import type { ClientGenerationTarget } from "@/services/generate/io/contexts.js";
import { ensureDirectory, writeFileWithHooks } from "@/services/generate/util/hook-executor.js";
import { joinRelativePath, slugify, toPathSegments } from "@/services/generate/util/shared.js";
import type { GenerateOptions } from "@/services/generate/util/types.js";
import type { ProjectStructureConfig } from "@/types.js";
import type { AppSpec } from "@arbiter/shared";
import chalk from "chalk";
import fs from "fs-extra";

function isTypeScriptServiceLanguage(language?: string): boolean {
  if (!language) return true;
  const normalized = language.toLowerCase();
  return normalized === "typescript" || normalized === "javascript" || normalized === "node";
}

type FlowRouteMetadata = {
  rootTestId?: string;
  actionTestIds: string[];
  successTestId?: string;
  apiInteractions: Array<{ method: string; path: string; status?: number }>;
};

/**
 * Generate E2E package.json for Playwright workspace
 */
function generateE2ePackageJson(slug: string): object {
  return {
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
}

/**
 * Generate tsconfig for E2E workspace
 */
function generateE2eTsconfig(): object {
  return {
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
}

/**
 * Generate locators support file content
 */
function generateLocatorsContent(appSpec: AppSpec): string {
  const locatorEntries = Object.entries(appSpec.locators || {}).length
    ? Object.entries(appSpec.locators)
    : [["page:root", '[data-testid="app-root"]']];

  return `export const locators = {
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
}

/**
 * Generate E2E runner script content
 */
function generateRunE2eScript(): string {
  return `#!/usr/bin/env node
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
}

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

/**
 * Write a workspace file and track it in the files list
 */
async function writeWorkspaceFile(
  workspaceRoot: string,
  relativePath: string,
  content: string,
  options: GenerateOptions,
  files: string[],
  rel: (file: string) => string,
): Promise<void> {
  const fullPath = path.join(workspaceRoot, relativePath);
  await ensureDirectory(path.dirname(fullPath), options);
  await writeFileWithHooks(fullPath, content, options);
  files.push(rel(relativePath));
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

  // Write package.json
  await writeWorkspaceFile(
    workspaceRoot,
    "package.json",
    JSON.stringify(generateE2ePackageJson(slug), null, 2),
    options,
    files,
    rel,
  );

  // Write tsconfig.json
  await writeWorkspaceFile(
    workspaceRoot,
    "tsconfig.json",
    JSON.stringify(generateE2eTsconfig(), null, 2),
    options,
    files,
    rel,
  );

  // Write support files
  await writeWorkspaceFile(
    workspaceRoot,
    path.join("support", "locators.ts"),
    generateLocatorsContent(appSpec),
    options,
    files,
    rel,
  );

  await writeWorkspaceFile(
    workspaceRoot,
    path.join("support", "run-e2e.mjs"),
    generateRunE2eScript(),
    options,
    files,
    rel,
  );

  // Write Playwright config
  await writeWorkspaceFile(
    workspaceRoot,
    "playwright.config.ts",
    buildPlaywrightConfig(appSpec, clientTarget, structure),
    options,
    files,
    rel,
  );

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

function buildPlaywrightConfig(
  appSpec: AppSpec,
  clientTarget: ClientGenerationTarget | undefined,
  structure: ProjectStructureConfig,
): string {
  const slug = clientTarget?.slug ?? "app";
  const clientBase =
    clientTarget?.relativeRoot ?? joinRelativePath(structure.clientsDirectory, slug);
  const clientDirRelative = path.posix.join("..", "..", clientBase);
  const tsServices = Object.entries(appSpec.services ?? {}).filter(([, svc]) =>
    isTypeScriptServiceLanguage((svc as any)?.language as string | undefined),
  );

  const webPortInit = "Number(process.env.E2E_WEB_PORT ?? 5173)";
  const storefrontPortInit = "Number(process.env.E2E_STOREFRONT_PORT ?? 3000)";
  const catalogPortInit = "Number(process.env.E2E_CATALOG_PORT ?? 4000)";
  const stripePortInit = "Number(process.env.E2E_STRIPE_PORT ?? 4010)";
  const webPortExpr = "webPort";
  const storefrontPortExpr = "storefrontPort";
  const catalogPortExpr = "catalogPort";
  const stripePortExpr = "stripePort";

  const serviceWebServers = tsServices
    .map(([serviceName]) => {
      const serviceSlug = slugify(serviceName, serviceName);
      const portExpr = serviceSlug.includes("catalog")
        ? catalogPortExpr
        : serviceSlug.includes("stripe")
          ? stripePortExpr
          : storefrontPortExpr;
      const serviceDir = path.posix.join("..", "..", structure.servicesDirectory, serviceSlug);
      return `{
      command: 'npm run dev',
      cwd: path.resolve(__dirname, '${serviceDir}'),
      url: \`http://127.0.0.1:\${${portExpr}}/healthz\`,
      env: {
        PORT: String(${portExpr}),
        HOST: '127.0.0.1',
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    }`;
    })
    .join(",\n    ");

  const webServerEntries = `[
    {
      command: \`npm run dev -- --host 127.0.0.1 --port \${webPort}\`,
      cwd: clientDir,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        E2E_WEB_PORT: String(webPort),
      },
    }${serviceWebServers ? `,\n    ${serviceWebServers}` : ""}
  ]`;

  return `import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const clientDir = path.resolve(__dirname, '${clientDirRelative}');
const webPort = ${webPortInit};
const storefrontPort = ${storefrontPortInit};
const catalogPort = ${catalogPortInit};
const stripePort = ${stripePortInit};
const baseURL = process.env.E2E_BASE_URL ?? \`http://127.0.0.1:\${webPort}\`;

export default defineConfig({
  testDir: './behaviors',
  timeout: 120_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: ${webServerEntries},
});
`;
}
