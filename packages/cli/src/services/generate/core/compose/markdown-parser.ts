/**
 * @packageDocumentation
 * Markdown spec parser for generate command.
 *
 * Parses markdown files from .arbiter/ directory and builds an AppSpec.
 */

import path from "node:path";
import type {
  AppSpec,
  ConfigWithVersion,
  ProductSpec,
  SchemaVersion,
  SpecEntity,
  TestCase,
  TestSuite,
} from "@arbiter/specification";
import fs from "fs-extra";
import yaml from "yaml";

/**
 * Parse YAML frontmatter from markdown content
 */
function parseFrontmatter(content: string): { frontmatter: Record<string, any>; body: string } {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, body: content };
  }

  try {
    const frontmatter = yaml.parse(match[1]) || {};
    return { frontmatter, body: match[2] || "" };
  } catch {
    return { frontmatter: {}, body: content };
  }
}

/**
 * Extract title from markdown body (first # heading)
 */
function extractTitle(body: string): string | undefined {
  const match = body.match(/^#\s+(.+)$/m);
  return match?.[1];
}

/**
 * Parse a markdown file into a spec entity
 */
async function parseMarkdownEntity(
  filePath: string,
  relativePath: string,
): Promise<SpecEntity | null> {
  const filename = path.basename(filePath, ".md");
  const parentDir = path.basename(path.dirname(filePath));

  // Skip root README.md - it's handled separately as project metadata
  // README.md files should represent their parent directory, not be standalone entities
  if (filename.toLowerCase() === "readme" && parentDir === ".arbiter") {
    return null;
  }

  const content = await fs.readFile(filePath, "utf-8");
  const { frontmatter, body } = parseFrontmatter(content);

  // Skip files without a type, or with type "project" (project-level metadata)
  if (!frontmatter.type || frontmatter.type === "project") {
    return null;
  }

  const title = extractTitle(body) || path.basename(filePath, ".md");
  // For README.md files in subdirectories, use the parent directory as slug
  // e.g., api/README.md -> slug "api"
  const slug =
    filename.toLowerCase() === "readme" && parentDir && parentDir !== ".arbiter"
      ? parentDir
      : filename;

  // Build base entity
  const entity: SpecEntity = {
    type: frontmatter.type,
    slug,
    name: title,
    description: frontmatter.description,
    entityId: frontmatter.entityId,
    createdAt: frontmatter.createdAt,
    updatedAt: frontmatter.updatedAt,
  } as SpecEntity;

  // Add type-specific fields for packages/services
  if (frontmatter.type === "service" || frontmatter.type === "package") {
    (entity as any).language = frontmatter.language;
    (entity as any).framework = frontmatter.framework;
    (entity as any).port = frontmatter.port;
    (entity as any).subtype = frontmatter.subtype;
    // Don't set sourceDirectory - let the generator use the correct directory based on subtype
    if (frontmatter.sourceDirectory) {
      (entity as any).sourceDirectory = frontmatter.sourceDirectory;
    }
  }

  if (frontmatter.type === "schema") {
    (entity as any).fields = frontmatter.fields;
  }

  // Add endpoint data
  if (frontmatter.type === "endpoint") {
    // Store endpoint path and method
    (entity as any).endpointPath = frontmatter.path;
    (entity as any).method = frontmatter.method || "GET";
    (entity as any).summary = frontmatter.summary;

    // Store Hurl assertions string if present
    if (frontmatter.assertions) {
      (entity as any).assertions = frontmatter.assertions;
    }

    // Use group from frontmatter, service field, or parent directory
    const parentDir = path.dirname(relativePath);
    const impliedGroup = parentDir && parentDir !== "." ? parentDir : undefined;
    (entity as any).group = frontmatter.group || frontmatter.service || impliedGroup;
  }

  // Add tags
  if (frontmatter.tags) {
    (entity as any).tags = frontmatter.tags;
  }

  // Parent from directory structure
  const dir = path.dirname(relativePath);
  if (dir && dir !== ".") {
    (entity as any).parent = dir;
  }

  return entity;
}

/**
 * Recursively find all markdown files in a directory
 */
async function findMarkdownFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  if (!(await fs.pathExists(dir))) {
    return files;
  }

  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "cache") {
      files.push(...(await findMarkdownFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Parse project metadata from README.md
 */
async function parseProjectReadme(arbiterDir: string): Promise<ProductSpec> {
  const readmePath = path.join(arbiterDir, "README.md");

  if (!(await fs.pathExists(readmePath))) {
    return { name: "Unknown Project" };
  }

  const content = await fs.readFile(readmePath, "utf-8");
  const { frontmatter, body } = parseFrontmatter(content);
  const title = extractTitle(body) || "Project";

  return {
    name: title,
    description: frontmatter.description,
    goals: frontmatter.goals,
  };
}

/**
 * Parse config.json for project configuration
 */
async function parseConfig(arbiterDir: string): Promise<Record<string, any>> {
  const configPath = path.join(arbiterDir, "config.json");

  if (!(await fs.pathExists(configPath))) {
    return {};
  }

  try {
    return await fs.readJson(configPath);
  } catch {
    return {};
  }
}

/**
 * Entity handlers for different types during spec building
 */
interface EntityAccumulator {
  entities: Record<string, SpecEntity>;
  services: Record<string, any>;
  paths: Record<string, Record<string, any>>;
  routes: Array<{ id: string; path: string; name: string }>;
}

type EntityHandler = (
  entity: SpecEntity,
  acc: EntityAccumulator,
  config: Record<string, any>,
) => void;

const entityHandlers: Record<string, EntityHandler> = {
  package: handlePackageEntity,
  service: handlePackageEntity, // service is alias for package
  endpoint: handleEndpointEntity,
  route: handleRouteEntity,
};

function handlePackageEntity(
  entity: SpecEntity,
  acc: EntityAccumulator,
  config: Record<string, any>,
): void {
  const serviceEntry: Record<string, any> = {
    language: (entity as any).language || config.language || "typescript",
    framework: (entity as any).framework,
    port: (entity as any).port,
    subtype: (entity as any).subtype,
  };
  if ((entity as any).sourceDirectory) {
    serviceEntry.sourceDirectory = (entity as any).sourceDirectory;
  }
  acc.services[entity.slug] = serviceEntry;
}

function handleEndpointEntity(entity: SpecEntity, acc: EntityAccumulator): void {
  const endpointPath = (entity as any).endpointPath;
  const method = ((entity as any).method || "GET").toLowerCase();
  const hurlAssertions = (entity as any).assertions;

  if (!endpointPath) return;

  const group = (entity as any).group || "default";
  if (!acc.paths[group]) {
    acc.paths[group] = {};
  }

  // Build path spec with method and parsed Hurl assertions
  if (!acc.paths[group][endpointPath]) {
    acc.paths[group][endpointPath] = {};
  }

  const methodSpec: Record<string, unknown> = {
    summary: (entity as any).summary,
  };

  // Parse Hurl assertions into structured format for test generator
  if (hurlAssertions) {
    methodSpec.hurlAssertions = hurlAssertions;
    methodSpec.assertions = parseHurlAssertions(hurlAssertions);
  }

  acc.paths[group][endpointPath][method] = methodSpec;
}

/**
 * Parse Hurl assertion block into structured assertions
 */
function parseHurlAssertions(hurl: string): Record<string, Record<string, unknown>> {
  const assertions: Record<string, Record<string, unknown>> = {};
  const lines = hurl.split("\n");

  let expectedStatus: number | undefined;
  let assertIndex = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // Parse HTTP status line (e.g., "HTTP 200" or "HTTP/1.1 200")
    const statusMatch = trimmed.match(/^HTTP(?:\/[\d.]+)?\s+(\d+)/);
    if (statusMatch) {
      expectedStatus = Number.parseInt(statusMatch[1], 10);
      continue;
    }

    // Skip [Asserts] header and comments
    if (trimmed === "[Asserts]" || trimmed.startsWith("#") || !trimmed) {
      continue;
    }

    // Parse assertion lines
    const assertionName = `assert-${++assertIndex}`;
    const assertion: Record<string, unknown> = {};

    if (expectedStatus !== undefined) {
      assertion.status = expectedStatus;
    }

    // Parse jsonpath assertions: jsonpath "$.field" == "value"
    const jsonpathMatch = trimmed.match(/^jsonpath\s+"([^"]+)"\s+(\S+)\s*(.*)$/);
    if (jsonpathMatch) {
      const [, path, predicate, value] = jsonpathMatch;
      assertion.type = "jsonpath";
      assertion.path = path;
      assertion.predicate = predicate;
      assertion.value = parseHurlValue(value);
      assertion.raw = trimmed;
      assertions[assertionName] = assertion;
      continue;
    }

    // Parse header assertions: header "Content-Type" contains "json"
    const headerMatch = trimmed.match(/^header\s+"([^"]+)"\s+(\S+)\s*(.*)$/);
    if (headerMatch) {
      const [, header, predicate, value] = headerMatch;
      assertion.type = "header";
      assertion.header = header;
      assertion.predicate = predicate;
      assertion.value = parseHurlValue(value);
      assertion.raw = trimmed;
      assertions[assertionName] = assertion;
      continue;
    }

    // Parse status assertions: status == 200
    const statusAssertMatch = trimmed.match(/^status\s+(\S+)\s*(\d+)$/);
    if (statusAssertMatch) {
      const [, predicate, value] = statusAssertMatch;
      assertion.type = "status";
      assertion.predicate = predicate;
      assertion.value = Number.parseInt(value, 10);
      assertion.raw = trimmed;
      assertions[assertionName] = assertion;
      continue;
    }

    // Parse body assertions: body contains "text"
    const bodyMatch = trimmed.match(/^body\s+(\S+)\s*(.*)$/);
    if (bodyMatch) {
      const [, predicate, value] = bodyMatch;
      assertion.type = "body";
      assertion.predicate = predicate;
      assertion.value = parseHurlValue(value);
      assertion.raw = trimmed;
      assertions[assertionName] = assertion;
      continue;
    }

    // Store unparsed assertions with raw value
    if (trimmed) {
      assertion.type = "raw";
      assertion.raw = trimmed;
      assertions[assertionName] = assertion;
    }
  }

  return assertions;
}

/**
 * Parse a Hurl value (handles quoted strings, numbers, booleans)
 */
function parseHurlValue(value: string): unknown {
  const trimmed = value.trim();

  // Quoted string
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }

  // Boolean
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;

  // Existence check
  if (trimmed === "exists" || trimmed === "") return "exists";

  // Number
  const num = Number(trimmed);
  if (!Number.isNaN(num)) return num;

  return trimmed;
}

function handleRouteEntity(entity: SpecEntity, acc: EntityAccumulator): void {
  acc.routes.push({
    id: entity.slug,
    path: (entity as any).path || `/${entity.slug}`,
    name: entity.name,
  });
}

function handleDefaultEntity(entity: SpecEntity, acc: EntityAccumulator): void {
  // Check for frontend subtype or tags - these also contribute routes
  const subtype = (entity as any).subtype;
  const tags = (entity as any).tags;

  if (subtype === "frontend" || (tags && tags.includes("frontend"))) {
    acc.routes.push({
      id: entity.slug,
      path: (entity as any).path || `/${entity.slug}`,
      name: entity.name,
    });
  }
}

/**
 * Generate test suites from services
 */
function generateTestsFromServices(
  services: Record<string, any>,
  entities: Record<string, SpecEntity>,
  specName: string,
  paths: Record<string, Record<string, any>> = {},
): TestSuite[] {
  const testSuites: TestSuite[] = [];
  const namespace = `arbiter.${specName}`.toLowerCase().replace(/[^a-z0-9.]/g, "_");

  // Generate unit tests for each service
  for (const [serviceName, service] of Object.entries(services)) {
    const entity = entities[serviceName];
    const serviceNamespace = `${namespace}.${serviceName}`.toLowerCase();

    const cases: TestCase[] = [];

    // Add health check test if service has a port
    if (service.port) {
      cases.push({
        name: `${serviceName}_health_check`,
        namespace: serviceNamespace,
        description: `Health check for ${serviceName} service`,
        steps: [
          {
            action: "http_request",
            params: {
              method: "GET",
              url: `http://localhost:${service.port}/health`,
              timeout: 5000,
            },
            expected: { status: 200 },
          },
        ],
        metadata: { generated: true, source: "arbiter" },
      });
    }

    // Add basic service test
    cases.push({
      name: `${serviceName}_startup`,
      namespace: serviceNamespace,
      description: `Verify ${serviceName} service starts correctly`,
      steps: [
        {
          action: "service_startup",
          params: { service: serviceName, timeout: 30000 },
          expected: { running: true },
        },
      ],
      metadata: { generated: true, source: "arbiter" },
    });

    if (cases.length > 0) {
      testSuites.push({
        name: `${serviceName}_unit_tests`,
        namespace: serviceNamespace,
        type: "unit",
        cases,
        setup: [],
        teardown: [],
      } as TestSuite & { type: string });
    }
  }

  // Check if there are any endpoint assertions (Hurl tests count as integration tests)
  const hasEndpointAssertions = Object.values(paths).some((pathGroup) =>
    Object.values(pathGroup).some((pathSpec) =>
      Object.values(pathSpec as Record<string, any>).some(
        (methodSpec: any) => methodSpec?.assertions,
      ),
    ),
  );

  // Add integration test suite if multiple services or endpoint assertions exist
  if (Object.keys(services).length > 1 || hasEndpointAssertions) {
    const integrationCases: TestCase[] = [];

    if (Object.keys(services).length > 1) {
      integrationCases.push({
        name: "services_connectivity",
        namespace: `${namespace}.integration`,
        description: "Verify all services can communicate",
        steps: [
          {
            action: "check_connectivity",
            params: { services: Object.keys(services) },
            expected: { all_connected: true },
          },
        ],
        metadata: { generated: true, source: "arbiter" },
      });
    }

    if (hasEndpointAssertions) {
      integrationCases.push({
        name: "endpoint_assertions",
        namespace: `${namespace}.integration`,
        description: "API endpoint assertion tests (Hurl)",
        steps: [
          {
            action: "run_hurl_tests",
            params: { source: "endpoint_assertions" },
            expected: { all_pass: true },
          },
        ],
        metadata: { generated: true, source: "arbiter", testType: "hurl" },
      });
    }

    testSuites.push({
      name: "integration_tests",
      namespace: `${namespace}.integration`,
      type: "integration",
      cases: integrationCases,
      setup: [],
      teardown: [],
    } as TestSuite & { type: string });
  }

  // Add e2e test suite placeholder
  testSuites.push({
    name: "e2e_tests",
    namespace: `${namespace}.e2e`,
    type: "e2e",
    cases: [
      {
        name: "basic_workflow",
        namespace: `${namespace}.e2e`,
        description: "End-to-end test for basic user workflow",
        steps: [
          {
            action: "e2e_workflow",
            params: { workflow: "basic" },
            expected: { success: true },
          },
        ],
        metadata: { generated: true, source: "arbiter" },
      },
    ],
    setup: [],
    teardown: [],
  } as TestSuite & { type: string });

  return testSuites;
}

/**
 * Parse all markdown files in .arbiter/ and build a ConfigWithVersion
 */
export async function parseMarkdownSpec(arbiterDir: string): Promise<ConfigWithVersion> {
  const product = await parseProjectReadme(arbiterDir);
  const config = await parseConfig(arbiterDir);

  // Find all markdown files
  const markdownFiles = await findMarkdownFiles(arbiterDir);

  // Initialize accumulator for unified entity processing
  const acc: EntityAccumulator = {
    entities: {},
    services: {},
    paths: {},
    routes: [],
  };

  // Single pass: parse and dispatch each entity to appropriate handler
  for (const filePath of markdownFiles) {
    if (filePath === path.join(arbiterDir, "README.md")) {
      continue;
    }

    const relativePath = path.relative(arbiterDir, filePath);
    const entity = await parseMarkdownEntity(filePath, relativePath);

    if (entity) {
      acc.entities[entity.slug] = entity;

      // Dispatch to type-specific handler, or default handler
      const handler = entityHandlers[entity.type];
      if (handler) {
        handler(entity, acc, config);
      } else {
        handleDefaultEntity(entity, acc);
      }
    }
  }

  // Build AppSpec from accumulated data
  const appSpec: AppSpec = {
    product,
    config: {
      language: config.language || "typescript",
      ...config,
    },
    entities: acc.entities,
    metadata: {
      name: product.name,
      version: config.version || "0.1.0",
    },
  };

  if (Object.keys(acc.services).length > 0) {
    (appSpec as any).services = acc.services;
  }

  if (Object.keys(acc.paths).length > 0) {
    (appSpec as any).paths = acc.paths;
  }

  const tests = generateTestsFromServices(
    acc.services,
    acc.entities,
    product.name || "app",
    acc.paths,
  );
  if (tests.length > 0) {
    (appSpec as any).tests = tests;
  }

  if (acc.routes.length > 0) {
    appSpec.ui = { routes: acc.routes };
  }

  const schema: SchemaVersion = {
    version: "app",
    detected_from: "structure",
  };

  return {
    schema,
    app: appSpec,
  };
}
