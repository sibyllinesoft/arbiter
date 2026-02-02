/**
 * UI component generation for React routes and locators.
 * Extracted from index.ts to improve modularity.
 */

import path from "node:path";
import {
  type FlowRouteMetadata,
  deriveFlowRouteMetadata,
  humanizeTestId,
  sanitizeTestId,
} from "@/services/generate/api/flow-metadata.js";
import type { ClientGenerationTarget } from "@/services/generate/io/contexts.js";
import { ensureDirectory, writeFileWithHooks } from "@/services/generate/util/hook-executor.js";
import { joinRelativePath } from "@/services/generate/util/shared.js";
import type { GenerateOptions, GenerationReporter } from "@/services/generate/util/types.js";
import type { AppSpec } from "@arbiter/specification";

const reporter: GenerationReporter = {
  info: (...args: any[]) => console.info(...args),
  warn: (...args: any[]) => console.warn(...args),
  error: (...args: any[]) => console.error(...args),
};

/**
 * Resolve the root test ID attribute for a route
 */
function resolveRootTestIdAttr(routeId: string, flowMetadata?: FlowRouteMetadata): string {
  if (flowMetadata?.rootTestId && flowMetadata.rootTestId.length > 0) {
    return ` data-testid="${flowMetadata.rootTestId}"`;
  }
  return ` data-testid="${sanitizeTestId(routeId)}"`;
}

/**
 * Generate action button JSX for a test ID
 */
function generateActionButton(testId: string): string {
  const label = humanizeTestId(testId);
  return `        <button
          type="button"
          data-testid="${testId}"
          onClick={ => handleAction('${testId}')}
          aria-pressed={activeAction === '${testId}'}
          className={activeAction === '${testId}' ? 'selected' : undefined}
        >
          ${label}
        </button>`;
}

/**
 * Generate action buttons section
 */
function generateActionSection(actionTestIds: string[] | undefined): string {
  if (!actionTestIds?.length) return "";

  const buttons = actionTestIds.map(generateActionButton).join("\n");
  return `      <section className="stub-actions">
${buttons}
      </section>`;
}

/**
 * Generate success status block
 */
function generateSuccessBlock(successTestId: string | undefined): string {
  if (!successTestId) return "";

  return `        {status === 'success' && (
          <div role="status" data-testid="${successTestId}">
            <h3>Success</h3>
            <p>{activeAction ? \`Flow for \${activeAction} is ready.\` : 'Flow completed.'}</p>
          </div>
        )}`;
}

/**
 * Generate fetch calls for API interactions
 */
function generateFetchCalls(
  routeId: string,
  apiInteractions: FlowRouteMetadata["apiInteractions"],
): string {
  if (!apiInteractions?.length) {
    return "      await new Promise((resolve) => setTimeout(resolve, 300));";
  }

  return apiInteractions
    .map(
      (api) => `      await fetch('${api.path}', {
        method: '${(api.method || "GET").toUpperCase()}',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: '${routeId}', action }),
      });`,
    )
    .join("\n");
}

/**
 * Generate route definition export
 */
function generateRouteDefinition(
  definitionName: string,
  routeId: string,
  safePath: string,
  componentName: string,
): string {
  return `export const ${definitionName}: RouteDefinition = {
  id: '${routeId}',
  path: '${safePath}',
  Component: ${componentName},
};`;
}

/**
 * Generate static (non-interactive) route component
 */
function generateStaticComponent(
  componentName: string,
  definitionName: string,
  routeId: string,
  safePath: string,
  title: string,
  description: string,
  capabilityBlock: string,
  rootAttr: string,
): string {
  return `import type { FC } from 'react';
import type { RouteDefinition } from '@/services/generate/types';

const ${componentName}: FC =  => {
  return (
    <section data-route="${routeId}" role="main"${rootAttr}>
      <header>
        <h1>${title}</h1>
        <p>${description}</p>
      </header>
${capabilityBlock}    </section>
  );
};

${generateRouteDefinition(definitionName, routeId, safePath, componentName)}
`;
}

/**
 * Build route component content for React
 */
export function buildRouteComponentContent(
  route: any,
  componentName: string,
  definitionName: string,
  safePath: string,
  title: string,
  description: string,
  capabilityBlock: string,
  locatorMap: Record<string, string>,
  flowMetadata?: FlowRouteMetadata,
): string {
  const rootAttr = resolveRootTestIdAttr(route.id, flowMetadata);
  const hasInteractiveFlow = (flowMetadata?.actionTestIds?.length || 0) > 0;

  if (!hasInteractiveFlow && !flowMetadata?.successTestId) {
    return generateStaticComponent(
      componentName,
      definitionName,
      route.id,
      safePath,
      title,
      description,
      capabilityBlock,
      rootAttr,
    );
  }

  const actionSection = generateActionSection(flowMetadata?.actionTestIds);
  const successBlock = generateSuccessBlock(flowMetadata?.successTestId);
  const fetchCalls = generateFetchCalls(route.id, flowMetadata?.apiInteractions);

  return `import { useState } from 'react';
import type { FC } from 'react';
import type { RouteDefinition } from '@/services/generate/types';

const ${componentName}: FC =  => {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAction = async (action: string) => {
    setActiveAction(action);
    setStatus('submitting');
    setErrorMessage(null);
    try {
${fetchCalls}
      setStatus('success');
    } catch (error) {
      reporter.error('Stub action failed', error);
      setStatus('error');
      setErrorMessage('Something went wrong. Please try again.');
    }
  };

  return (
    <section data-route="${route.id}" role="main"${rootAttr}>
      <header>
        <h1>${title}</h1>
        <p>${description}</p>
      </header>
${capabilityBlock}${actionSection}
      <section aria-live="polite">
${successBlock}
        {status === 'error' && (
          <div role="alert">
            <p>{errorMessage}</p>
          </div>
        )}
      </section>
    </section>
  );
};

${generateRouteDefinition(definitionName, route.id, safePath, componentName)}
`;
}

/**
 * Route types file content
 */
const ROUTE_TYPES_CONTENT = `import type { ComponentType } from 'react';

export interface RouteDefinition {
  id: string;
  path: string;
  Component: ComponentType;
  description?: string;
  children?: RouteDefinition[];
}

export type RouteDefinitions = RouteDefinition[];
`;

/**
 * AppRoutes component content
 */
const APP_ROUTES_CONTENT = `import { useRoutes } from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';

export interface AppRoutesProps {
  routes: RouteObject[];
}

export function AppRoutes({ routes }: AppRoutesProps) {
  return useRoutes(routes);
}
`;

/**
 * Metadata extracted from a route definition
 */
interface RouteMetadata {
  baseName: string;
  componentName: string;
  definitionName: string;
  fileName: string;
  safePath: string;
  title: string;
  description: string;
  capabilityBlock: string;
}

/**
 * Build metadata from a route definition
 */
function buildRouteMetadata(route: any): RouteMetadata {
  const baseName = route.id
    .split(":")
    .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

  const rawPath = route.path || `/${route.id.replace(/:/g, "/")}`;
  const safePath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;

  const description =
    route.summary ||
    route.description ||
    (Array.isArray(route.capabilities) && route.capabilities.length > 0
      ? `Capabilities: ${route.capabilities.join(", ")}`
      : "Auto-generated view");

  const capabilityList = Array.isArray(route.capabilities)
    ? route.capabilities.map((cap: string) => `          <li>${cap}</li>`).join("\n")
    : "";

  const capabilityBlock = capabilityList
    ? `        <section className="route-capabilities">\n          <h2>Capabilities</h2>\n          <ul>\n${capabilityList}\n          </ul>\n        </section>\n`
    : "";

  return {
    baseName,
    componentName: `${baseName}View`,
    definitionName: `${baseName}Route`,
    fileName: `${baseName}Route.tsx`,
    safePath,
    title: route.name || baseName,
    description,
    capabilityBlock,
  };
}

/**
 * Generate routes aggregator (index.tsx) content
 */
function generateAggregatorContent(routeDefinitions: Array<{ importName: string }>): string {
  const imports = routeDefinitions
    .map(
      (definition) =>
        `import { ${definition.importName} } from '@/services/generate/${definition.importName}';`,
    )
    .join("\n");
  const definitionsArray = routeDefinitions.map((definition) => definition.importName).join(", ");

  return `import type { RouteObject } from 'react-router-dom';
import type { RouteDefinition } from '@/services/generate/types';
${imports ? `${imports}\n` : ""}
const definitions: RouteDefinition[] = [${definitionsArray}];

const toRouteObject = (definition: RouteDefinition): RouteObject => {
  const View = definition.Component;
  return {
    path: definition.path,
    element: <View />,
    children: definition.children?.map(toRouteObject),
  };
};

export const routes: RouteObject[] = definitions.map(toRouteObject);
export type { RouteDefinition } from '@/services/generate/types';
`;
}

/**
 * Process a single route and write its component file
 */
async function processRouteComponent(
  route: any,
  routesDir: string,
  relativeRoot: string,
  locatorMap: Record<string, string>,
  flowRoutes: Map<string, FlowRouteMetadata>,
  options: GenerateOptions,
): Promise<{ relPath: string; importName: string }> {
  const metadata = buildRouteMetadata(route);
  const filePath = path.join(routesDir, metadata.fileName);
  const relPath = joinRelativePath(relativeRoot, "src", "routes", metadata.fileName);

  const flowMetadata = flowRoutes.get(route.id);
  const componentContent = buildRouteComponentContent(
    route,
    metadata.componentName,
    metadata.definitionName,
    metadata.safePath,
    metadata.title,
    metadata.description,
    metadata.capabilityBlock,
    locatorMap,
    flowMetadata,
  );

  await writeFileWithHooks(filePath, componentContent, options);

  return { relPath, importName: metadata.definitionName };
}

/**
 * Generate UI components from app spec routes
 */
export async function generateUIComponents(
  appSpec: AppSpec,
  clientTarget: ClientGenerationTarget,
  options: GenerateOptions,
): Promise<string[]> {
  const files: string[] = [];
  const context = clientTarget.context;
  const relativeRoot = clientTarget.relativeRoot;
  const language = clientTarget.config?.language || appSpec.config?.language || "typescript";

  if (language !== "typescript") {
    reporter.info(
      `UI route generation currently supports TypeScript React projects. Skipping for '${language}'.`,
    );
    return files;
  }

  await ensureDirectory(context.routesDir, options);

  // Write types file
  const typeFilePath = path.join(context.routesDir, "types.ts");
  await writeFileWithHooks(typeFilePath, ROUTE_TYPES_CONTENT, options);
  files.push(joinRelativePath(relativeRoot, "src", "routes", "types.ts"));

  // Process all routes
  const locatorMap = (appSpec as any).locators || {};
  const flowRoutes = deriveFlowRouteMetadata(appSpec);
  const routeDefinitions: Array<{ importName: string }> = [];

  const uiRoutes = (appSpec as any).ui?.routes || [];
  for (const route of uiRoutes) {
    const result = await processRouteComponent(
      route,
      context.routesDir,
      relativeRoot,
      locatorMap,
      flowRoutes,
      options,
    );
    files.push(result.relPath);
    routeDefinitions.push({ importName: result.importName });
  }

  // Write aggregator file
  const aggregatorPath = path.join(context.routesDir, "index.tsx");
  await writeFileWithHooks(aggregatorPath, generateAggregatorContent(routeDefinitions), options);
  files.push(joinRelativePath(relativeRoot, "src", "routes", "index.tsx"));

  // Write AppRoutes component
  const appRoutesPath = path.join(context.routesDir, "AppRoutes.tsx");
  await writeFileWithHooks(appRoutesPath, APP_ROUTES_CONTENT, options);
  files.push(joinRelativePath(relativeRoot, "src", "routes", "AppRoutes.tsx"));

  return files;
}

/**
 * Generate locator definitions for UI testing
 */
export async function generateLocatorDefinitions(
  appSpec: AppSpec,
  clientTarget: ClientGenerationTarget,
  options: GenerateOptions,
): Promise<string[]> {
  const files: string[] = [];

  reporter.info("Generating locator definitions...");

  const locatorsContent = `// UI Locators - Generated by Arbiter
// These locators provide a stable contract between tests and UI implementation

export const locators = {
${Object.entries((appSpec as any).locators || {})
  .map(([token, selector]) => `  '${token}': '${selector}',`)
  .join("\n")}
} as const;

export type LocatorToken = keyof typeof locators;

// Helper function to get locator by token
export function getLocator(token: LocatorToken): string {
  return locators[token];
}

// Type-safe locator access
export function loc(token: LocatorToken): string {
  return locators[token];
}
`;

  const locatorsDir = path.join(clientTarget.context.root, "src", "routes");
  const locatorsPath = path.join(locatorsDir, "locators.ts");

  await ensureDirectory(locatorsDir, options);

  await writeFileWithHooks(locatorsPath, locatorsContent, options);
  files.push(joinRelativePath(clientTarget.relativeRoot, "src", "routes", "locators.ts"));

  return files;
}
