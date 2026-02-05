/* istanbul ignore file */
import path from "node:path";
import { getConfiguredLanguagePlugin } from "@/services/generate/core/orchestration/template-orchestrator.js";
import type { ClientGenerationTarget } from "@/services/generate/io/contexts.js";
import { ensureDirectory, writeFileWithHooks } from "@/services/generate/util/hook-executor.js";
import { joinRelativePath, slugify, toPathSegments } from "@/services/generate/util/shared.js";
import type { GenerateOptions } from "@/services/generate/util/types.js";
import type { ProjectStructureConfig } from "@/types.js";
import { type AppSpec, getBehaviorsArray, getPackages } from "@arbiter/specification";
import chalk from "chalk";
import fs from "fs-extra";

function isTypeScriptServiceLanguage(language?: string): boolean {
  if (!language) return true;
  const normalized = language.toLowerCase();
  return normalized === "typescript" || normalized === "javascript" || normalized === "node";
}

type BehaviorRouteMetadata = {
  rootTestId?: string;
  actionTestIds: string[];
  successTestId?: string;
  apiInteractions: Array<{ method: string; path: string; status?: number }>;
};

/**
 * Generate E2E package.json for Playwright workspace with Cucumber/Gherkin support
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
      "test:cucumber": "cucumber-js",
    },
    devDependencies: {
      "@playwright/test": "^1.48.2",
      "@cucumber/cucumber": "^10.3.1",
      "@cucumber/pretty-formatter": "^1.0.1",
      typescript: "^5.5.4",
      "ts-node": "^10.9.2",
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
      types: ["node", "@playwright/test", "@cucumber/cucumber"],
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
 * Generate Cucumber configuration
 */
function generateCucumberConfig(): string {
  return `export default {
  require: ['step-definitions/**/*.ts'],
  requireModule: ['ts-node/register'],
  format: ['@cucumber/pretty-formatter'],
  paths: ['features/**/*.feature'],
  publishQuiet: true,
};
`;
}

/**
 * Generate baseline feature file
 */
function generateBaselineFeature(appName: string): string {
  return `Feature: ${appName} Application
  As a user
  I want the application to load successfully
  So that I can use its features

  Scenario: Application loads successfully
    Given I am on the home page
    Then I should see the application

  Scenario: Application displays without errors
    Given I am on the home page
    Then there should be no console errors
`;
}

/**
 * Generate step definitions for baseline feature
 */
function generateBaselineStepDefinitions(): string {
  return `import { Given, Then, Before, After, setDefaultTimeout } from '@cucumber/cucumber';
import { chromium, Browser, Page, BrowserContext } from 'playwright';
import assert from 'node:assert';

setDefaultTimeout(60_000);

let browser: Browser;
let context: BrowserContext;
let page: Page;
const consoleErrors: string[] = [];

Before(async function () {
  browser = await chromium.launch();
  context = await browser.newContext();
  page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
});

After(async function () {
  await context?.close();
  await browser?.close();
  consoleErrors.length = 0;
});

Given('I am on the home page', async function () {
  const baseUrl = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
  await page.goto(baseUrl);
});

Then('I should see the application', async function () {
  await page.waitForLoadState('domcontentloaded');
  const body = await page.$('body');
  assert.ok(body, 'Page body should exist');
});

Then('there should be no console errors', async function () {
  assert.strictEqual(
    consoleErrors.length,
    0,
    \`Expected no console errors but found: \${consoleErrors.join(', ')}\`
  );
});
`;
}

/**
 * Generate baseline Playwright test (runs without behaviors)
 */
function generateBaselineE2eTest(appName: string): string {
  return `import { test, expect } from '@playwright/test';

test.describe('${appName}', () => {
  test('application loads successfully', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('has no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(errors).toHaveLength(0);
  });
});
`;
}

/**
 * Generate locators support file content
 */
function generateLocatorsContent(appSpec: AppSpec): string {
  const locators = (appSpec as any).locators || {};
  const locatorEntries = Object.entries(locators).length
    ? Object.entries(locators)
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

/**
 * Extract test ID from a CSS selector like [data-testid="foo"] -> foo
 * If not a data-testid selector, returns the original value
 */
function extractTestId(selector: string): string {
  const match = selector.match(/\[data-testid=["']([^"']+)["']\]/);
  return match ? match[1] : selector;
}

/**
 * Resolve a locator key to a test ID value
 */
function resolveLocatorToTestId(key: string, locatorMap: Record<string, string>): string {
  const selector = locatorMap[key];
  if (selector) {
    return extractTestId(selector);
  }
  // If key isn't in map, treat it as the test ID directly
  return key;
}

function generateDefaultBehaviorTest(
  behavior: any,
  locatorMap: Record<string, string> = {},
): string {
  const steps = (behavior.steps || [])
    .map((step: any, index: number) => {
      if (step.visit) {
        return `  await page.goto('${step.visit}'); // step ${index}`;
      }
      if (step.click) {
        const testId = resolveLocatorToTestId(step.click, locatorMap);
        return `  await page.getByTestId('${testId}').click(); // step ${index}`;
      }
      if (step.fill?.locator) {
        const testId = resolveLocatorToTestId(step.fill.locator, locatorMap);
        return `  await page.getByTestId('${testId}').fill('test'); // step ${index}`;
      }
      if (step.expect_api?.path) {
        return `  await page.waitForResponse((resp) => resp.url().includes('${step.expect_api.path}')); // step ${index}`;
      }
      if (step.expect?.locator) {
        const testId = resolveLocatorToTestId(step.expect.locator, locatorMap);
        return `  await page.getByTestId('${testId}').waitFor(); // step ${index}`;
      }
      return `  // unsupported step type at index ${index}`;
    })
    .join("\n");

  return `import { test, expect } from '@playwright/test';
\ntest('${behavior.id}', async ({ page }) => {
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
  await ensureDirectory(workspaceRoot, options);
  const files: string[] = [];
  const slug = clientTarget?.slug ?? "app";
  const appName = appSpec.product?.name ?? slug;
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

  // Write baseline Playwright test
  await writeWorkspaceFile(
    workspaceRoot,
    path.join("specs", "baseline.spec.ts"),
    generateBaselineE2eTest(appName),
    options,
    files,
    rel,
  );

  // Scaffold Gherkin/Cucumber support
  await writeWorkspaceFile(
    workspaceRoot,
    "cucumber.config.mjs",
    generateCucumberConfig(),
    options,
    files,
    rel,
  );

  await writeWorkspaceFile(
    workspaceRoot,
    path.join("features", "baseline.feature"),
    generateBaselineFeature(appName),
    options,
    files,
    rel,
  );

  await writeWorkspaceFile(
    workspaceRoot,
    path.join("step-definitions", "baseline.steps.ts"),
    generateBaselineStepDefinitions(),
    options,
    files,
    rel,
  );

  return files;
}

export async function generateBehaviorBasedTests(
  appSpec: AppSpec,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
  clientTarget?: ClientGenerationTarget,
): Promise<{ files: string[]; workspaceDir?: string }> {
  const files: string[] = [];
  const hasBehaviors = getBehaviorsArray(appSpec).length > 0;

  console.log(chalk.blue("🧪 Generating e2e test scaffolding..."));

  const language = clientTarget?.config?.language || appSpec.config?.language || "typescript";
  const plugin = getConfiguredLanguagePlugin(language);

  if (!plugin) {
    console.log(
      chalk.yellow(`⚠️  No plugin available for ${language}, using default Playwright tests`),
    );
  }

  // Colocate e2e tests with the client package
  const clientRoot = clientTarget?.relativeRoot ?? "app";
  const workspaceSegments = [...toPathSegments(clientRoot), "e2e"];
  const workspaceRoot = path.join(outputDir, ...workspaceSegments);

  // Always scaffold the Playwright + Gherkin workspace
  const workspaceFiles = await scaffoldPlaywrightWorkspace(
    appSpec,
    workspaceRoot,
    workspaceSegments,
    options,
    clientTarget,
    structure,
  );
  files.push(...workspaceFiles);

  // Generate behavior-specific tests if behaviors are defined
  if (hasBehaviors) {
    const behaviorsDir = path.join(workspaceRoot, "behaviors");
    if (!fs.existsSync(behaviorsDir) && !options.dryRun) {
      fs.mkdirSync(behaviorsDir, { recursive: true });
    }

    for (const behavior of getBehaviorsArray(appSpec)) {
      const testContent = generateDefaultBehaviorTest(behavior, (appSpec as any).locators);
      const testFileName = `${behavior.id.replace(/:/g, "_")}.test.ts`;
      const testPath = path.join(behaviorsDir, testFileName);
      await writeFileWithHooks(testPath, testContent, options);
      files.push(joinRelativePath(...workspaceSegments, "behaviors", testFileName));
    }
  }

  const workspaceDir = joinRelativePath(...workspaceSegments) || ".";
  return { files, workspaceDir };
}

function buildPlaywrightConfig(
  appSpec: AppSpec,
  clientTarget: ClientGenerationTarget | undefined,
  structure: ProjectStructureConfig,
): string {
  // E2E tests are colocated in client/e2e/, so client root is one level up
  const clientDirRelative = "..";

  // Collect backend services (TypeScript, excluding frontends)
  const tsServices = Object.entries(getPackages(appSpec)).filter(
    ([, pkg]) =>
      isTypeScriptServiceLanguage((pkg as any)?.language as string | undefined) &&
      (pkg as any)?.subtype !== "frontend",
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
      // From clients/[slug]/e2e/ to services/[service]/ is 3 levels up then into services
      const serviceDir = path.posix.join(
        "..",
        "..",
        "..",
        structure.servicesDirectory,
        serviceSlug,
      );
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
  testDir: '.',
  testMatch: ['specs/**/*.spec.ts', 'behaviors/**/*.test.ts'],
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
