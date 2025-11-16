#!/usr/bin/env bun

/**
 * API Documentation Generator
 *
 * Generates comprehensive API documentation from OpenAPI specs, TypeScript types,
 * and route handlers in the Arbiter project.
 */

import { spawn } from "child_process";
import * as path from "path";
import chalk from "chalk";
import * as fs from "fs-extra";
import { glob } from "glob";
import YAML from "yaml";

interface ApiDocumentationOptions {
  sourceDir: string;
  outputDir: string;
  formats: ("markdown" | "json" | "html" | "openapi")[];
  includeTypes: boolean;
  includeExamples: boolean;
  includeSchemas: boolean;
  includeSecurity: boolean;
  serverUrl?: string;
  verbose: boolean;
  dryRun: boolean;
}

interface ApiEndpoint {
  path: string;
  method: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: ApiParameter[];
  requestBody?: ApiRequestBody;
  responses?: Record<string, ApiResponse>;
  security?: SecurityRequirement[];
  deprecated?: boolean;
  examples?: ApiExample[];
}

interface ApiParameter {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  required: boolean;
  schema: ApiSchema;
  description?: string;
  example?: any;
}

interface ApiRequestBody {
  description?: string;
  required: boolean;
  content: Record<string, ApiMediaType>;
}

interface ApiResponse {
  description: string;
  content?: Record<string, ApiMediaType>;
  headers?: Record<string, ApiHeader>;
}

interface ApiMediaType {
  schema: ApiSchema;
  examples?: Record<string, ApiExample>;
}

interface ApiSchema {
  type?: string;
  format?: string;
  properties?: Record<string, ApiSchema>;
  required?: string[];
  items?: ApiSchema;
  enum?: any[];
  example?: any;
  description?: string;
  $ref?: string;
}

interface ApiExample {
  summary?: string;
  description?: string;
  value: any;
}

interface ApiHeader {
  description?: string;
  schema: ApiSchema;
}

interface SecurityRequirement {
  [name: string]: string[];
}

interface ApiInfo {
  title: string;
  description: string;
  version: string;
  contact?: {
    name?: string;
    email?: string;
    url?: string;
  };
  license?: {
    name: string;
    url?: string;
  };
}

interface OpenApiSpec {
  openapi: string;
  info: ApiInfo;
  servers: Array<{
    url: string;
    description?: string;
  }>;
  paths: Record<string, Record<string, ApiEndpoint>>;
  components?: {
    schemas?: Record<string, ApiSchema>;
    securitySchemes?: Record<string, any>;
    responses?: Record<string, ApiResponse>;
    parameters?: Record<string, ApiParameter>;
    examples?: Record<string, ApiExample>;
  };
  security?: SecurityRequirement[];
  tags?: Array<{
    name: string;
    description?: string;
  }>;
}

export async function generateApiDocumentation(options: ApiDocumentationOptions): Promise<number> {
  try {
    console.log(chalk.blue("🌐 Generating API Documentation"));
    console.log(chalk.dim(`Source: ${options.sourceDir}`));
    console.log(chalk.dim(`Output: ${options.outputDir}`));
    console.log(chalk.dim(`Formats: ${options.formats.join(", ")}`));

    // Find API source files
    const apiFiles = await findApiFiles(options.sourceDir);

    if (apiFiles.routes.length === 0 && apiFiles.specs.length === 0) {
      console.log(chalk.yellow("⚠️  No API files found"));
      return 0;
    }

    console.log(
      chalk.blue(
        `🔍 Found ${apiFiles.routes.length} route files, ${apiFiles.specs.length} spec files`,
      ),
    );

    // Parse existing OpenAPI specs
    let openApiSpec: OpenApiSpec | undefined;
    if (apiFiles.specs.length > 0) {
      openApiSpec = await parseOpenApiSpecs(apiFiles.specs, options);
    }

    // Extract endpoints from route files
    const extractedEndpoints = await extractEndpointsFromRoutes(apiFiles.routes, options);

    // Merge or create OpenAPI spec
    const spec = openApiSpec
      ? mergeEndpointsIntoSpec(openApiSpec, extractedEndpoints)
      : createOpenApiSpecFromEndpoints(extractedEndpoints, options);

    // Generate documentation in requested formats
    await fs.ensureDir(options.outputDir);

    for (const format of options.formats) {
      await generateApiDocumentationFormat(format, spec, options);
    }

    // Generate additional files
    await generateApiIndex(spec, options);
    await generateApiMetrics(spec, options);

    console.log(chalk.green("✅ API documentation generation completed"));
    return 0;
  } catch (error) {
    console.error(
      chalk.red("API documentation generation failed:"),
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}

async function findApiFiles(sourceDir: string): Promise<{
  routes: string[];
  specs: string[];
  types: string[];
}> {
  const routePatterns = [
    path.join(sourceDir, "**/routes/**/*.ts"),
    path.join(sourceDir, "**/api/**/*.ts"),
    path.join(sourceDir, "**/handlers/**/*.ts"),
  ];

  const specPatterns = [
    path.join(sourceDir, "**/*.openapi.{json,yaml,yml}"),
    path.join(sourceDir, "**/openapi.{json,yaml,yml}"),
    path.join(sourceDir, "**/api-spec.{json,yaml,yml}"),
  ];

  const typePatterns = [
    path.join(sourceDir, "**/types/**/*.ts"),
    path.join(sourceDir, "**/schemas/**/*.ts"),
  ];

  const routes = await findFiles(routePatterns);
  const specs = await findFiles(specPatterns);
  const types = await findFiles(typePatterns);

  return { routes, specs, types };
}

async function findFiles(patterns: string[]): Promise<string[]> {
  let files: string[] = [];

  for (const pattern of patterns) {
    const matches = await glob(pattern);
    files.push(...matches);
  }

  return [...new Set(files)].sort();
}

async function parseOpenApiSpecs(
  specFiles: string[],
  options: ApiDocumentationOptions,
): Promise<OpenApiSpec> {
  // For now, take the first spec file
  const specFile = specFiles[0];

  if (options.verbose) {
    console.log(chalk.dim(`Reading OpenAPI spec: ${specFile}`));
  }

  const content = await fs.readFile(specFile, "utf8");

  let spec: OpenApiSpec;
  if (specFile.endsWith(".json")) {
    spec = JSON.parse(content);
  } else {
    spec = YAML.parse(content);
  }

  return spec;
}

async function extractEndpointsFromRoutes(
  routeFiles: string[],
  options: ApiDocumentationOptions,
): Promise<ApiEndpoint[]> {
  const endpoints: ApiEndpoint[] = [];

  for (const file of routeFiles) {
    try {
      const extractedEndpoints = await extractEndpointsFromFile(file, options);
      endpoints.push(...extractedEndpoints);

      if (options.verbose) {
        console.log(
          chalk.dim(`  ✅ Extracted ${extractedEndpoints.length} endpoints from ${file}`),
        );
      }
    } catch (error) {
      console.warn(
        chalk.yellow(
          `  ⚠️  Failed to parse ${file}: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  }

  return endpoints;
}

async function extractEndpointsFromFile(
  filePath: string,
  options: ApiDocumentationOptions,
): Promise<ApiEndpoint[]> {
  const content = await fs.readFile(filePath, "utf8");
  const endpoints: ApiEndpoint[] = [];

  // Extract route definitions (simplified approach for common patterns)

  // Express-style routes
  const expressRouteRegex =
    /(?:app|router)\.(\w+)\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(?:async\s+)?\(?([^)]*)\)?\s*=>\s*\{([^}]+)\}/g;

  let match;
  while ((match = expressRouteRegex.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const path = match[2];
    const params = match[3];
    const body = match[4];

    const endpoint: ApiEndpoint = {
      path,
      method,
      summary: extractSummaryFromComment(content, match.index),
      description: extractDescriptionFromComment(content, match.index),
      tags: extractTagsFromPath(path),
      parameters: extractParametersFromPath(path, params),
      responses: extractResponsesFromBody(body),
      deprecated:
        content.includes(`@deprecated`) && isNearPosition(content, "@deprecated", match.index),
    };

    endpoints.push(endpoint);
  }

  // Elysia/Hono style routes
  const elysiaRouteRegex =
    /\.(\w+)\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(?:\{[^}]*\}\s*,\s*)?(?:async\s+)?\(?([^)]*)\)?\s*=>\s*\{([^}]+)\}/g;

  while ((match = elysiaRouteRegex.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const path = match[2];
    const params = match[3];
    const body = match[4];

    const endpoint: ApiEndpoint = {
      path,
      method,
      summary: extractSummaryFromComment(content, match.index),
      description: extractDescriptionFromComment(content, match.index),
      tags: extractTagsFromPath(path),
      parameters: extractParametersFromPath(path, params),
      responses: extractResponsesFromBody(body),
      deprecated:
        content.includes(`@deprecated`) && isNearPosition(content, "@deprecated", match.index),
    };

    endpoints.push(endpoint);
  }

  return endpoints;
}

function extractSummaryFromComment(content: string, index: number): string | undefined {
  const beforeRoute = content.substring(0, index);
  const lines = beforeRoute.split("\n");

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line.startsWith("/**") || line.startsWith("/*")) {
      // Look for @summary tag
      const summaryMatch = line.match(/@summary\s+(.+)/);
      if (summaryMatch) {
        return summaryMatch[1].trim();
      }
      // Or use first comment line
      const commentContent = line
        .replace(/^\/\*+\s*/, "")
        .replace(/\*+\/$/, "")
        .trim();
      if (commentContent && !commentContent.includes("@")) {
        return commentContent;
      }
    }
    if (line.startsWith("//")) {
      return line.substring(2).trim();
    }
    if (line !== "") break;
  }

  return undefined;
}

function extractDescriptionFromComment(content: string, index: number): string | undefined {
  const beforeRoute = content.substring(0, index);
  const commentMatch = beforeRoute.match(/\/\*\*([\s\S]*?)\*\//);

  if (commentMatch) {
    const comment = commentMatch[1];
    const descriptionMatch = comment.match(/@description\s+([\s\S]*?)(?=@|$)/);
    if (descriptionMatch) {
      return descriptionMatch[1].trim().replace(/\s*\*\s*/g, " ");
    }
  }

  return undefined;
}

function extractTagsFromPath(path: string): string[] {
  const segments = path.split("/").filter((s) => s && !s.startsWith(":") && !s.startsWith("{"));
  return segments.length > 0 ? [segments[0]] : ["default"];
}

function extractParametersFromPath(path: string, params: string): ApiParameter[] {
  const parameters: ApiParameter[] = [];

  // Extract path parameters
  const pathParamRegex = /:(\w+)|{(\w+)}/g;
  let match;

  while ((match = pathParamRegex.exec(path)) !== null) {
    const paramName = match[1] || match[2];
    parameters.push({
      name: paramName,
      in: "path",
      required: true,
      schema: { type: "string" },
      description: `Path parameter: ${paramName}`,
    });
  }

  // Extract query parameters from function params (simplified)
  if (params.includes("query")) {
    // This would need more sophisticated parsing
    parameters.push({
      name: "query",
      in: "query",
      required: false,
      schema: { type: "object" },
      description: "Query parameters",
    });
  }

  return parameters;
}

function extractResponsesFromBody(body: string): Record<string, ApiResponse> {
  const responses: Record<string, ApiResponse> = {};

  // Look for return statements
  const returnMatch = body.match(/return\s+.*?\.status\((\d+)\)|\.json\(|\.send\(/);
  if (returnMatch) {
    const statusCode = returnMatch[1] || "200";
    responses[statusCode] = {
      description: "Successful response",
      content: {
        "application/json": {
          schema: { type: "object" },
        },
      },
    };
  } else {
    // Default response
    responses["200"] = {
      description: "Successful response",
      content: {
        "application/json": {
          schema: { type: "object" },
        },
      },
    };
  }

  // Look for error cases
  if (body.includes("throw") || body.includes("error")) {
    responses["400"] = {
      description: "Bad request",
    };
  }

  return responses;
}

function isNearPosition(
  content: string,
  search: string,
  position: number,
  range: number = 200,
): boolean {
  const start = Math.max(0, position - range);
  const end = Math.min(content.length, position + range);
  const snippet = content.substring(start, end);
  return snippet.includes(search);
}

function createOpenApiSpecFromEndpoints(
  endpoints: ApiEndpoint[],
  options: ApiDocumentationOptions,
): OpenApiSpec {
  const spec: OpenApiSpec = {
    openapi: "3.0.3",
    info: {
      title: "Arbiter API",
      description: "API documentation for the Arbiter project",
      version: "1.0.0",
      contact: {
        name: "Arbiter Team",
      },
    },
    servers: [
      {
        url: options.serverUrl || "http://localhost:5050",
        description: "Development server",
      },
    ],
    paths: {},
    components: {
      schemas: {},
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [],
  };

  // Group endpoints by path
  const pathGroups: Record<string, Record<string, ApiEndpoint>> = {};
  const tags = new Set<string>();

  for (const endpoint of endpoints) {
    if (!pathGroups[endpoint.path]) {
      pathGroups[endpoint.path] = {};
    }
    pathGroups[endpoint.path][endpoint.method.toLowerCase()] = endpoint;

    if (endpoint.tags) {
      endpoint.tags.forEach((tag) => tags.add(tag));
    }
  }

  // Add paths to spec
  spec.paths = pathGroups;

  // Add tags to spec
  spec.tags = Array.from(tags).map((tag) => ({
    name: tag,
    description: `Operations for ${tag}`,
  }));

  return spec;
}

function mergeEndpointsIntoSpec(spec: OpenApiSpec, endpoints: ApiEndpoint[]): OpenApiSpec {
  // Merge extracted endpoints into existing spec
  for (const endpoint of endpoints) {
    if (!spec.paths[endpoint.path]) {
      spec.paths[endpoint.path] = {};
    }
    spec.paths[endpoint.path][endpoint.method.toLowerCase()] = endpoint;
  }

  return spec;
}

async function generateApiDocumentationFormat(
  format: "markdown" | "json" | "html" | "openapi",
  spec: OpenApiSpec,
  options: ApiDocumentationOptions,
): Promise<void> {
  console.log(chalk.blue(`📄 Generating ${format} API documentation...`));

  const outputFile = path.join(
    options.outputDir,
    `api-reference.${format === "openapi" ? "yaml" : format}`,
  );

  if (options.dryRun) {
    console.log(chalk.yellow(`🔍 Would generate: ${outputFile}`));
    return;
  }

  switch (format) {
    case "json":
      await generateJsonFormat(spec, outputFile);
      break;
    case "openapi":
      await generateOpenApiFormat(spec, outputFile);
      break;
    case "markdown":
      await generateMarkdownFormat(spec, outputFile, options);
      break;
    case "html":
      await generateHtmlFormat(spec, outputFile, options);
      break;
  }

  console.log(chalk.green(`  ✅ Generated ${format} documentation`));
}

async function generateJsonFormat(spec: OpenApiSpec, outputFile: string): Promise<void> {
  await fs.writeFile(outputFile, JSON.stringify(spec, null, 2), "utf8");
}

async function generateOpenApiFormat(spec: OpenApiSpec, outputFile: string): Promise<void> {
  const yamlContent = YAML.stringify(spec, {
    indent: 2,
    lineWidth: -1,
  });
  await fs.writeFile(outputFile, yamlContent, "utf8");
}

async function generateMarkdownFormat(
  spec: OpenApiSpec,
  outputFile: string,
  options: ApiDocumentationOptions,
): Promise<void> {
  let content = `# ${spec.info.title}

${spec.info.description}

**Version**: ${spec.info.version}

## Table of Contents

`;

  // Generate table of contents
  if (spec.tags) {
    for (const tag of spec.tags) {
      content += `- [${tag.name}](#${tag.name.toLowerCase()})\n`;
    }
  }

  content += "\n";

  // Generate server information
  if (spec.servers && spec.servers.length > 0) {
    content += "## Servers\n\n";
    for (const server of spec.servers) {
      content += `- **${server.description || "Server"}**: \`${server.url}\`\n`;
    }
    content += "\n";
  }

  // Generate authentication information
  if (options.includeSecurity && spec.security) {
    content += "## Authentication\n\n";
    content +=
      "This API uses Bearer token authentication. Include the token in the Authorization header:\n\n";
    content += "```\nAuthorization: Bearer <token>\n```\n\n";
  }

  // Group endpoints by tags
  const endpointsByTag = groupEndpointsByTag(spec);

  // Generate documentation for each tag
  for (const [tagName, endpoints] of Object.entries(endpointsByTag)) {
    content += `## ${tagName}\n\n`;

    for (const { path, method, endpoint } of endpoints) {
      content += `### ${method.toUpperCase()} ${path}\n\n`;

      if (endpoint.summary) {
        content += `${endpoint.summary}\n\n`;
      }

      if (endpoint.description) {
        content += `${endpoint.description}\n\n`;
      }

      if (endpoint.deprecated) {
        content += "⚠️ **Deprecated**\n\n";
      }

      // Parameters
      if (endpoint.parameters && endpoint.parameters.length > 0) {
        content += "**Parameters**:\n\n";
        content += "| Name | Type | In | Required | Description |\n";
        content += "|------|------|----|----------|-------------|\n";

        for (const param of endpoint.parameters) {
          const required = param.required ? "Yes" : "No";
          const description = param.description || "";
          content += `| \`${param.name}\` | \`${param.schema.type}\` | ${param.in} | ${required} | ${description} |\n`;
        }
        content += "\n";
      }

      // Request body
      if (endpoint.requestBody) {
        content += "**Request Body**:\n\n";
        if (endpoint.requestBody.description) {
          content += `${endpoint.requestBody.description}\n\n`;
        }

        for (const [mediaType, mediaTypeObj] of Object.entries(endpoint.requestBody.content)) {
          content += `**Content-Type**: \`${mediaType}\`\n\n`;
          if (mediaTypeObj.schema) {
            content += "```json\n";
            content += JSON.stringify(generateSchemaExample(mediaTypeObj.schema), null, 2);
            content += "\n```\n\n";
          }
        }
      }

      // Responses
      if (endpoint.responses) {
        content += "**Responses**:\n\n";

        for (const [statusCode, response] of Object.entries(endpoint.responses)) {
          content += `**${statusCode}**: ${response.description}\n\n`;

          if (response.content) {
            for (const [mediaType, mediaTypeObj] of Object.entries(response.content)) {
              if (mediaTypeObj.schema) {
                content += "```json\n";
                content += JSON.stringify(generateSchemaExample(mediaTypeObj.schema), null, 2);
                content += "\n```\n\n";
              }
            }
          }
        }
      }

      content += "---\n\n";
    }
  }

  await fs.writeFile(outputFile, content, "utf8");
}

async function generateHtmlFormat(
  spec: OpenApiSpec,
  outputFile: string,
  options: ApiDocumentationOptions,
): Promise<void> {
  // Generate using Redoc or similar tool
  // For now, convert markdown to basic HTML
  const markdownFile = outputFile.replace(".html", ".md");
  await generateMarkdownFormat(spec, markdownFile, options);

  const markdown = await fs.readFile(markdownFile, "utf8");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${spec.info.title} - API Reference</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
        h1, h2, h3 { color: #2563eb; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
        th { background-color: #f8f9fa; }
        code { background-color: #f1f5f9; padding: 2px 6px; border-radius: 3px; }
        pre { background-color: #f8f9fa; padding: 16px; border-radius: 6px; overflow-x: auto; }
        .endpoint { border-left: 4px solid #2563eb; padding-left: 16px; margin: 20px 0; }
        .method { display: inline-block; padding: 4px 8px; border-radius: 4px; font-weight: bold; color: white; margin-right: 8px; }
        .method.get { background-color: #059669; }
        .method.post { background-color: #dc2626; }
        .method.put { background-color: #d97706; }
        .method.delete { background-color: #dc2626; }
        .deprecated { color: #dc2626; font-weight: bold; }
    </style>
</head>
<body>
${markdown
  .replace(/^# (.+)$/gm, "<h1>$1</h1>")
  .replace(/^## (.+)$/gm, "<h2>$1</h2>")
  .replace(/^### (.+)$/gm, "<h3>$1</h3>")
  .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
  .replace(/\`(.+?)\`/g, "<code>$1</code>")
  .replace(/^- (.+)$/gm, "<li>$1</li>")
  .replace(/(\<li\>.*\<\/li\>)/gs, "<ul>$1</ul>")
  .replace(/\n/g, "<br>")}
</body>
</html>`;

  await fs.writeFile(outputFile, html, "utf8");

  // Clean up temporary markdown file
  await fs.remove(markdownFile);
}

function groupEndpointsByTag(
  spec: OpenApiSpec,
): Record<string, Array<{ path: string; method: string; endpoint: ApiEndpoint }>> {
  const groups: Record<string, Array<{ path: string; method: string; endpoint: ApiEndpoint }>> = {};

  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, endpoint] of Object.entries(methods)) {
      const tags = endpoint.tags || ["default"];

      for (const tag of tags) {
        if (!groups[tag]) {
          groups[tag] = [];
        }
        groups[tag].push({ path, method, endpoint });
      }
    }
  }

  return groups;
}

function generateSchemaExample(schema: ApiSchema): any {
  if (schema.example !== undefined) {
    return schema.example;
  }

  if (schema.$ref) {
    return { $ref: schema.$ref };
  }

  switch (schema.type) {
    case "object":
      const obj: any = {};
      if (schema.properties) {
        for (const [propName, propSchema] of Object.entries(schema.properties)) {
          obj[propName] = generateSchemaExample(propSchema);
        }
      }
      return obj;

    case "array":
      return schema.items ? [generateSchemaExample(schema.items)] : [];

    case "string":
      return schema.enum ? schema.enum[0] : "string";

    case "number":
    case "integer":
      return 42;

    case "boolean":
      return true;

    default:
      return null;
  }
}

async function generateApiIndex(
  spec: OpenApiSpec,
  options: ApiDocumentationOptions,
): Promise<void> {
  const indexFile = path.join(options.outputDir, "api-index.json");

  if (options.dryRun) {
    console.log(chalk.yellow(`🔍 Would generate: ${indexFile}`));
    return;
  }

  const endpointCount = Object.values(spec.paths).reduce(
    (sum, methods) => sum + Object.keys(methods).length,
    0,
  );

  const index = {
    generatedAt: new Date().toISOString(),
    api: {
      title: spec.info.title,
      version: spec.info.version,
      description: spec.info.description,
    },
    statistics: {
      endpoints: endpointCount,
      paths: Object.keys(spec.paths).length,
      tags: spec.tags?.length || 0,
      schemas: Object.keys(spec.components?.schemas || {}).length,
    },
    endpoints: Object.entries(spec.paths).flatMap(([path, methods]) =>
      Object.entries(methods).map(([method, endpoint]) => ({
        path,
        method: method.toUpperCase(),
        summary: endpoint.summary,
        tags: endpoint.tags,
      })),
    ),
  };

  await fs.writeFile(indexFile, JSON.stringify(index, null, 2), "utf8");
  console.log(chalk.green("  ✅ Generated API index"));
}

async function generateApiMetrics(
  spec: OpenApiSpec,
  options: ApiDocumentationOptions,
): Promise<void> {
  const metricsFile = path.join(options.outputDir, "api-metrics.json");

  if (options.dryRun) {
    console.log(chalk.yellow(`🔍 Would generate: ${metricsFile}`));
    return;
  }

  const endpoints = Object.entries(spec.paths).flatMap(([path, methods]) =>
    Object.entries(methods).map(([method, endpoint]) => ({ path, method, endpoint })),
  );

  const metrics = {
    generatedAt: new Date().toISOString(),
    overview: {
      totalEndpoints: endpoints.length,
      totalPaths: Object.keys(spec.paths).length,
      totalTags: spec.tags?.length || 0,
      totalSchemas: Object.keys(spec.components?.schemas || {}).length,
    },
    byMethod: {},
    byTag: {},
    coverage: {
      documented: 0,
      total: endpoints.length,
      percentage: 0,
    },
    quality: {
      hasExamples: 0,
      hasDescriptions: 0,
      hasParameters: 0,
      averageParametersPerEndpoint: 0,
    },
  };

  // Count by method
  const methodCounts: Record<string, number> = {};
  const tagCounts: Record<string, number> = {};
  let documented = 0;
  let hasExamples = 0;
  let hasDescriptions = 0;
  let hasParameters = 0;
  let totalParameters = 0;

  for (const { method, endpoint } of endpoints) {
    methodCounts[method.toUpperCase()] = (methodCounts[method.toUpperCase()] || 0) + 1;

    if (endpoint.tags) {
      for (const tag of endpoint.tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }

    if (endpoint.description && endpoint.description.length > 10) {
      documented++;
      hasDescriptions++;
    }

    if (endpoint.examples && endpoint.examples.length > 0) {
      hasExamples++;
    }

    if (endpoint.parameters && endpoint.parameters.length > 0) {
      hasParameters++;
      totalParameters += endpoint.parameters.length;
    }
  }

  metrics.byMethod = methodCounts;
  metrics.byTag = tagCounts;
  metrics.coverage = {
    documented,
    total: endpoints.length,
    percentage: endpoints.length > 0 ? (documented / endpoints.length) * 100 : 0,
  };
  metrics.quality = {
    hasExamples,
    hasDescriptions,
    hasParameters,
    averageParametersPerEndpoint: endpoints.length > 0 ? totalParameters / endpoints.length : 0,
  };

  await fs.writeFile(metricsFile, JSON.stringify(metrics, null, 2), "utf8");
  console.log(chalk.green("  ✅ Generated API metrics"));
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const defaultOptions: ApiDocumentationOptions = {
    sourceDir: "./apps/api/src",
    outputDir: "./docs",
    formats: ["markdown", "json", "openapi"],
    includeTypes: true,
    includeExamples: true,
    includeSchemas: true,
    includeSecurity: true,
    serverUrl: "http://localhost:5050",
    verbose: false,
    dryRun: false,
  };

  generateApiDocumentation(defaultOptions)
    .then((exitCode) => process.exit(exitCode))
    .catch((error) => {
      console.error(chalk.red("Error:"), error);
      process.exit(1);
    });
}
