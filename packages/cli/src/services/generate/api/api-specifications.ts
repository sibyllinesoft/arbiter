/**
 * @packageDocumentation
 * OpenAPI specification generation from app spec paths.
 *
 * Converts application specifications to OpenAPI 3.0.3 format and generates
 * language-specific API client services.
 */

import path from "node:path";
import type { ServiceConfig as LanguageServiceConfig } from "@/language-support/index.js";
import {
  generateService,
  getConfiguredLanguagePlugin,
} from "@/services/generate/core/orchestration/template-orchestrator.js";
import { writeFileWithHooks } from "@/services/generate/util/hook-executor.js";
import { joinRelativePath } from "@/services/generate/util/shared.js";
import type { GenerateOptions, GenerationReporter } from "@/services/generate/util/types.js";
import type { ProjectStructureConfig } from "@/types.js";
import type { AppSpec, PathSpec } from "@arbiter/shared";
import fs from "fs-extra";

const reporter: GenerationReporter = {
  info: (...args: any[]) => console.info(...args),
  warn: (...args: any[]) => console.warn(...args),
  error: (...args: any[]) => console.error(...args),
};

/**
 * Ensure API directory exists
 */
function ensureApiDirectory(apiDir: string, dryRun: boolean): void {
  if (!fs.existsSync(apiDir) && !dryRun) {
    fs.mkdirSync(apiDir, { recursive: true });
  }
}

/**
 * Generate services for a single component
 */
async function generateComponentServices(
  componentName: string,
  component: any,
  language: string,
  apiDir: string,
  structure: ProjectStructureConfig,
  options: GenerateOptions,
): Promise<string[]> {
  if (!component.methods || component.methods.length === 0) {
    return [];
  }

  const files: string[] = [];
  const serviceConfig: LanguageServiceConfig = {
    name: componentName,
    type: "api",
    methods: component.methods,
    validation: true,
  };

  try {
    const result = await generateService(language, serviceConfig);

    for (const file of result.files) {
      const relativePath = file.path.replace(/^src\//i, "");
      const fullPath = path.join(apiDir, relativePath);
      const dir = path.dirname(fullPath);

      if (!fs.existsSync(dir) && !options.dryRun) {
        fs.mkdirSync(dir, { recursive: true });
      }

      await writeFileWithHooks(fullPath, file.content, options);
      files.push(joinRelativePath(structure.docsDirectory, "api", relativePath));
    }
  } catch (error: any) {
    reporter.error(`Failed to generate ${language} service for ${componentName}:`, error.message);
  }

  return files;
}

/**
 * Generate OpenAPI specification file
 */
async function generateOpenApiFile(
  appSpec: AppSpec,
  apiDir: string,
  structure: ProjectStructureConfig,
  options: GenerateOptions,
): Promise<string | null> {
  if (!appSpec.paths) return null;

  const openApiSpec = buildOpenApiSpec(appSpec);
  const specPath = path.join(apiDir, "openapi.json");
  await writeFileWithHooks(specPath, JSON.stringify(openApiSpec, null, 2), options);
  return joinRelativePath(structure.docsDirectory, "api", "openapi.json");
}

/**
 * Generate API specifications from resources
 */
export async function generateAPISpecifications(
  appSpec: AppSpec,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
): Promise<string[]> {
  reporter.info("Generating API specifications...");

  const language = appSpec.config?.language || "typescript";
  const plugin = getConfiguredLanguagePlugin(language);
  const apiDir = path.join(outputDir, structure.docsDirectory, "api");

  ensureApiDirectory(apiDir, options.dryRun);

  const files: string[] = [];

  // Generate language-specific API services
  if (plugin?.capabilities?.api && appSpec.resources) {
    reporter.info(`Generating ${language} API services using ${plugin.name}...`);

    for (const [componentName, component] of Object.entries(appSpec.resources)) {
      const componentFiles = await generateComponentServices(
        componentName,
        component,
        language,
        apiDir,
        structure,
        options,
      );
      files.push(...componentFiles);
    }
  }

  // Generate OpenAPI specification
  const openApiPath = await generateOpenApiFile(appSpec, apiDir, structure, options);
  if (openApiPath) {
    files.push(openApiPath);
  }

  return files;
}

function buildComponentSchemas(appSpec: AppSpec): Record<string, any> {
  const resourceSchemas = (appSpec.resources as any)?.schemas;
  if (!resourceSchemas || typeof resourceSchemas !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(resourceSchemas as Record<string, any>).map(([name, schema]) => [
      name,
      {
        type: "object",
        example: (schema as any).example,
        ...((schema as any).examples && { examples: (schema as any).examples }),
      },
    ]),
  );
}

function flattenPathSpecs(appSpec: AppSpec): Record<string, PathSpec> {
  const flattenedPaths: Record<string, PathSpec> = {};
  for (const pathMap of Object.values(appSpec.paths ?? {})) {
    if (!pathMap || typeof pathMap !== "object") {
      continue;
    }
    for (const [pathKey, pathSpec] of Object.entries(pathMap as Record<string, PathSpec>)) {
      flattenedPaths[pathKey] = pathSpec;
    }
  }
  return flattenedPaths;
}

function convertPathOperations(pathSpec: PathSpec): Record<string, any> {
  const operations: Record<string, any> = {};

  for (const [method, operation] of Object.entries(pathSpec)) {
    if (!operation) {
      continue;
    }

    const isLegacyOperation =
      typeof (operation as any).response !== "undefined" ||
      typeof (operation as any).request !== "undefined";

    operations[method] = isLegacyOperation
      ? convertLegacyOperation(method, "", operation)
      : convertModernOperation(method, "", operation);
  }

  return operations;
}

/**
 * Build OpenAPI specification from app spec paths
 */
function buildOpenApiSpec(appSpec: AppSpec): Record<string, any> {
  const openApiSpec = {
    openapi: "3.0.3",
    info: {
      title: appSpec.product.name,
      version: "1.0.0",
      description: appSpec.product.goals?.join("; ") || "Generated API specification",
    },
    paths: {} as Record<string, any>,
    components: { schemas: buildComponentSchemas(appSpec) },
  };

  const flattenedPaths = flattenPathSpecs(appSpec);
  for (const [pathKey, pathSpec] of Object.entries(flattenedPaths)) {
    openApiSpec.paths[pathKey] = convertPathOperations(pathSpec);
  }

  return openApiSpec;
}

function convertLegacyOperation(
  method: string,
  pathKey: string,
  operation: any,
): Record<string, any> {
  const legacyOperation = operation as Record<string, any>;
  const responseStatus = legacyOperation.status || (method === "get" ? 200 : 201);
  return {
    summary: `${method.toUpperCase()} ${pathKey}`,
    ...(legacyOperation.request && {
      requestBody: {
        content: {
          "application/json": {
            schema: legacyOperation.request.$ref ? { $ref: legacyOperation.request.$ref } : {},
            example: legacyOperation.request.example,
          },
        },
      },
    }),
    responses: {
      [responseStatus]: {
        description: "Success",
        content: {
          "application/json": {
            schema: legacyOperation.response?.$ref ? { $ref: legacyOperation.response.$ref } : {},
            example: legacyOperation.response?.example,
          },
        },
      },
    },
    ...(legacyOperation.assertions ? { "x-assertions": legacyOperation.assertions } : {}),
  };
}

function convertModernOperation(
  method: string,
  pathKey: string,
  operation: any,
): Record<string, any> {
  const modernOperation = operation as Record<string, unknown>;
  const parameters = convertParameters(modernOperation.parameters as any[]);
  const requestBody = convertRequestBody(modernOperation.requestBody);
  const responses = convertResponses(modernOperation.responses);

  return {
    summary:
      typeof modernOperation.summary === "string"
        ? modernOperation.summary
        : `${method.toUpperCase()} ${pathKey}`,
    description:
      typeof modernOperation.description === "string" ? modernOperation.description : undefined,
    operationId:
      typeof modernOperation.operationId === "string" ? modernOperation.operationId : undefined,
    tags: Array.isArray(modernOperation.tags) ? modernOperation.tags : undefined,
    deprecated:
      typeof modernOperation.deprecated === "boolean" ? modernOperation.deprecated : undefined,
    ...(parameters ? { parameters } : {}),
    ...(requestBody ? { requestBody } : {}),
    responses: responses ?? {
      default: {
        description: "Response",
      },
    },
    ...(modernOperation.assertions ? { "x-assertions": modernOperation.assertions } : {}),
  };
}

/**
 * Resolve schema from schema or schemaRef
 */
function resolveSchemaFromMedia(media: Record<string, unknown>): unknown | undefined {
  const schemaCandidate = media.schema;
  const schemaRefCandidate = media.schemaRef;

  if (schemaCandidate && typeof schemaCandidate === "object") {
    return schemaCandidate;
  }

  if (typeof schemaRefCandidate === "string" && schemaRefCandidate.trim().length > 0) {
    return { $ref: schemaRefCandidate.trim() };
  }

  return undefined;
}

/**
 * Build media object from media definition
 */
function buildMediaObject(media: unknown): Record<string, unknown> {
  if (!media || typeof media !== "object") {
    return {};
  }

  const mediaRecord = media as Record<string, unknown>;
  const mediaObject: Record<string, unknown> = {};

  const schema = resolveSchemaFromMedia(mediaRecord);
  if (schema) {
    mediaObject.schema = schema;
  }

  if (mediaRecord.example !== undefined) {
    mediaObject.example = mediaRecord.example;
  }

  return mediaObject;
}

function resolveMediaContent(
  content?: Record<string, any>,
): Record<string, Record<string, unknown>> | undefined {
  if (!content || typeof content !== "object") {
    return undefined;
  }

  const entries = Object.entries(content)
    .filter(([contentType]) => Boolean(contentType))
    .map(([contentType, media]) => {
      const mediaObject = buildMediaObject(media);
      return [contentType, Object.keys(mediaObject).length > 0 ? mediaObject : {}] as [
        string,
        Record<string, unknown>,
      ];
    });

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

/**
 * Convert a single parameter to OpenAPI format
 */
function convertSingleParameter(parameter: Record<string, unknown>): Record<string, unknown> {
  const schema = resolveSchemaFromMedia(parameter);
  return {
    name: parameter.name,
    in: parameter["in"],
    description: parameter.description,
    required:
      typeof parameter.required === "boolean" ? parameter.required : parameter["in"] === "path",
    deprecated: parameter.deprecated,
    example: parameter.example,
    ...(schema ? { schema } : {}),
  };
}

/**
 * Check if parameter has valid name
 */
function hasValidParameterName(param: Record<string, unknown>): boolean {
  return typeof param.name === "string" && (param.name as string).trim().length > 0;
}

function convertParameters(parameters?: any[]): any[] | undefined {
  if (!Array.isArray(parameters) || parameters.length === 0) {
    return undefined;
  }

  const converted = parameters
    .filter((parameter) => parameter && typeof parameter === "object")
    .map((parameter) => convertSingleParameter(parameter as Record<string, unknown>))
    .filter(hasValidParameterName);

  return converted.length > 0 ? converted : undefined;
}

function convertRequestBody(requestBody: unknown): any {
  if (!requestBody || typeof requestBody !== "object") {
    return undefined;
  }
  const coerced = requestBody as Record<string, unknown>;
  const content = resolveMediaContent(coerced.content as Record<string, any>);
  if (!content) {
    return undefined;
  }
  return {
    description: coerced.description,
    required: typeof coerced.required === "boolean" ? coerced.required : undefined,
    content,
  };
}

/**
 * Convert a single response entry to OpenAPI format
 */
function convertSingleResponse(
  status: string,
  value: unknown,
): [string, Record<string, unknown>] | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const responseRecord = value as Record<string, unknown>;
  const content = resolveMediaContent(responseRecord.content as Record<string, any>);
  const headers = responseRecord.headers;
  const description =
    typeof responseRecord.description === "string" ? responseRecord.description : "Response";

  return [
    status,
    {
      description,
      ...(headers && typeof headers === "object" ? { headers } : {}),
      ...(content ? { content } : {}),
    },
  ];
}

function convertResponses(responses: unknown): Record<string, any> | undefined {
  if (!responses || typeof responses !== "object") {
    return undefined;
  }

  const convertedEntries = Object.entries(responses)
    .filter(([status]) => status)
    .map(([status, value]) => convertSingleResponse(status, value))
    .filter(Boolean) as Array<[string, Record<string, unknown>]>;

  return convertedEntries.length > 0 ? Object.fromEntries(convertedEntries) : undefined;
}
