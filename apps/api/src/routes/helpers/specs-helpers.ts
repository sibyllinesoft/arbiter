/**
 * Spec helper utilities for TSOA controller analysis.
 * Extracts endpoint metadata, parameters, and documentation from TypeScript decorators.
 */
import path from "path";
import fs from "fs-extra";
import ts from "typescript";

/** Maps decorator names to HTTP method strings */
const HTTP_METHOD_DECORATORS = new Map<string, string>([
  ["Get", "GET"],
  ["Post", "POST"],
  ["Put", "PUT"],
  ["Patch", "PATCH"],
  ["Delete", "DELETE"],
  ["Head", "HEAD"],
  ["Options", "OPTIONS"],
]);

/** Canonical ordering for HTTP methods in output */
const HTTP_METHOD_ORDER = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];

/** Extracted information about a single API endpoint */
export interface EndpointInfo {
  method: string;
  path?: string;
  fullPath?: string;
  handler?: string;
  signature: string;
  returnType?: string;
  documentation?: EndpointDocumentation;
  parameters: ParameterInfo[];
  responses: ResponseInfo[];
  tags?: string[];
  source?: { line: number };
}

/** JSDoc-extracted documentation for an endpoint */
export interface EndpointDocumentation {
  /** Brief one-line summary */
  summary?: string;
  /** Detailed description text */
  description?: string;
  /** Return value documentation */
  returns?: string;
  /** Additional remarks from @remarks tags */
  remarks?: string[];
  /** Code examples from @example tags */
  examples?: string[];
  /** Deprecation status or message */
  deprecated?: string | boolean;
}

/** Information about a method parameter */
export interface ParameterInfo {
  /** Parameter name */
  name: string;
  /** TypeScript type annotation */
  type?: string;
  /** Whether the parameter is optional */
  optional: boolean;
  /** JSDoc description from @param tag */
  description?: string;
  /** Applied decorator names */
  decorators?: string[];
}

/** Response decorator information */
export interface ResponseInfo {
  /** HTTP status code */
  status?: string;
  /** Response description */
  description?: string;
  /** Decorator type used */
  decorator: "SuccessResponse" | "Response";
}

/** Complete analysis result for a TSOA controller */
export interface ControllerAnalysis {
  /** All HTTP methods used in the controller */
  httpMethods: string[];
  /** Extracted endpoint information */
  endpoints: EndpointInfo[];
  /** Base route from @Route decorator */
  routeDecorator?: string;
  /** Tags from @Tags decorators */
  tags: string[];
  /** Controller class name */
  className?: string;
}

/**
 * Get default Docker container image for a programming language.
 * @param language - Programming language name
 * @returns Appropriate Docker image tag
 */
export function getContainerImage(language: string): string {
  switch (language?.toLowerCase()) {
    case "rust":
      return "rust:alpine";
    case "nodejs":
    case "javascript":
    case "typescript":
      return "node:alpine";
    case "python":
      return "python:slim";
    case "go":
      return "golang:alpine";
    case "java":
      return "openjdk:slim";
    default:
      return "alpine:latest";
  }
}

/**
 * Get default port number for a language/framework combination.
 * @param language - Programming language
 * @param framework - Optional framework name
 * @returns Default port number
 */
export function getDefaultPort(language: string, framework?: string): number {
  const normalizedFramework = (framework ?? "").toLowerCase();
  const normalizedLanguage = (language ?? "").toLowerCase();

  if (normalizedFramework.includes("express") || normalizedFramework.includes("fastify"))
    return 3000;
  if (normalizedFramework.includes("flask") || normalizedFramework.includes("fastapi")) return 5000;
  if (normalizedFramework.includes("axum") || normalizedFramework.includes("warp")) return 8080;
  if (normalizedFramework.includes("gin") || normalizedFramework.includes("echo")) return 8080;
  if (normalizedLanguage === "nodejs" || normalizedLanguage === "javascript") return 3000;
  if (normalizedLanguage === "python") return 5000;
  return 8080;
}

/**
 * Coerce a value to a trimmed non-empty string.
 * @param value - Value to coerce
 * @returns Trimmed string or undefined if empty
 */
export function coerceText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Infer database type from framework or name hints.
 * @param framework - Database framework name
 * @param name - Database name containing type hints
 * @returns Normalized database type string
 */
export function getDatabaseType(framework?: string, name?: string): string {
  if (framework) return framework.toLowerCase();
  if (name?.includes("postgres") || name?.includes("pg")) return "postgresql";
  if (name?.includes("mysql") || name?.includes("maria")) return "mysql";
  if (name?.includes("mongo")) return "mongodb";
  if (name?.includes("redis")) return "redis";
  if (name?.includes("sqlite")) return "sqlite";
  return "postgresql";
}

/**
 * Get database version, using explicit value or sensible defaults.
 * @param dbType - Database type (postgresql, mysql, etc.)
 * @param explicitVersion - Optional explicit version
 * @returns Version string
 */
export function getDatabaseVersion(dbType: string, explicitVersion?: string): string {
  if (explicitVersion) return explicitVersion;
  const versions: Record<string, string> = {
    postgresql: "15",
    mysql: "8.0",
    mongodb: "7.0",
    redis: "7.2",
    sqlite: "3",
  };
  return versions[dbType] ?? "latest";
}

/**
 * Convert a string to a URL-friendly slug.
 * @param value - String to convert
 * @returns Lowercase hyphenated slug
 */
export function toSlug(value: string): string {
  return value
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

/**
 * Resolve a controller file path against multiple base directories.
 * @param relatives - Base directory paths to search
 * @param normalized - Relative controller path
 * @returns Absolute path if found, null otherwise
 */
export async function resolveControllerPath(
  relatives: string[],
  normalized: string,
): Promise<string | null> {
  for (const relative of relatives) {
    if (!relative) continue;
    const absoluteRoot = path.isAbsolute(relative) ? relative : path.resolve(relative);
    const attempt = path.resolve(absoluteRoot, normalized);
    if (await fs.pathExists(attempt)) return attempt;
  }

  const fallback = path.resolve(normalized);
  if (await fs.pathExists(fallback)) return fallback;
  return null;
}

/**
 * Sort HTTP methods in canonical order (GET, POST, PUT, etc.).
 * @param values - HTTP method names
 * @returns Sorted array of methods
 */
function httpOrderSort(values: Iterable<string>): string[] {
  return Array.from(values).sort((a, b) => {
    const aIndex = HTTP_METHOD_ORDER.indexOf(a);
    const bIndex = HTTP_METHOD_ORDER.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });
}

/**
 * Combine base and sub paths into a single normalized path.
 * @param base - Base path (e.g., from @Route decorator)
 * @param sub - Sub path (e.g., from @Get decorator)
 * @returns Combined path or undefined if both empty
 */
function combinePaths(base?: string, sub?: string): string | undefined {
  if (!base && !sub) return undefined;
  if (!base) return sub;
  if (!sub) return base;
  const trimmedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const trimmedSub = sub.startsWith("/") ? sub : `/${sub}`;
  return `${trimmedBase}${trimmedSub}`.replace(/\/+/g, "/");
}

/**
 * Extract decorators from a TypeScript AST node.
 * Handles both legacy and modern decorator API.
 * @param node - AST node to extract decorators from
 * @returns Array of decorator nodes
 */
function getDecorators(node: ts.Node): readonly ts.Decorator[] {
  const direct = (node as { decorators?: readonly ts.Decorator[] }).decorators;
  if (direct && direct.length > 0) return direct;
  if (typeof (ts as any).canHaveDecorators === "function" && (ts as any).canHaveDecorators(node)) {
    const resolved = (ts as any).getDecorators?.(node);
    if (resolved && resolved.length > 0) return resolved;
  }
  return [];
}

/**
 * Parse a decorator node to extract its name and arguments.
 * @param decorator - Decorator AST node
 * @param sourceFile - Source file for text extraction
 * @returns Parsed decorator info or null
 */
function parseDecorator(
  decorator: ts.Decorator,
  sourceFile: ts.SourceFile,
): { name: string; arguments: readonly ts.Expression[] } | null {
  const expression = decorator.expression;
  if (ts.isCallExpression(expression)) {
    const callee = expression.expression;
    const name = ts.isIdentifier(callee)
      ? callee.text
      : ts.isPropertyAccessExpression(callee)
        ? callee.name.text
        : callee.getText(sourceFile);
    return { name, arguments: expression.arguments };
  }
  if (ts.isIdentifier(expression)) {
    return { name: expression.text, arguments: [] };
  }
  if (ts.isPropertyAccessExpression(expression)) {
    return { name: expression.name.text, arguments: [] };
  }
  return { name: expression.getText(sourceFile), arguments: [] };
}

/**
 * Normalize a JSDoc comment to a plain string.
 * @param comment - Comment text or node array
 * @param sourceFile - Source file for text extraction
 * @returns Normalized comment string
 */
function normalizeComment(
  comment: string | ts.NodeArray<ts.JSDocComment> | undefined,
  sourceFile: ts.SourceFile,
): string | undefined {
  if (!comment) return undefined;
  if (typeof comment === "string") return comment.trim();
  const text = comment
    .map((part) => {
      if (typeof part === "string") return part;
      if ("text" in part && typeof (part as { text?: unknown }).text === "string") {
        return String(part.text);
      }
      return part.getText(sourceFile);
    })
    .join("");
  return text.trim();
}

/**
 * Analyze a TSOA controller file and extract endpoint details.
 * @param controllerAbsolute - Absolute path to controller file
 * @returns Complete controller analysis with endpoints and metadata
 */
export async function extractControllerDetails(
  controllerAbsolute: string,
): Promise<ControllerAnalysis> {
  try {
    const content = await fs.readFile(controllerAbsolute, "utf-8");
    const sourceFile = ts.createSourceFile(
      controllerAbsolute,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    const methodSet = new Set<string>();
    const endpoints: EndpointInfo[] = [];
    const tagsSet = new Set<string>();
    let routeDecorator: string | undefined;
    let className: string | undefined;

    const controllers: ts.ClassDeclaration[] = [];
    sourceFile.forEachChild((node) => {
      if (ts.isClassDeclaration(node)) controllers.push(node);
    });

    for (const controller of controllers) {
      if (!className && controller.name) {
        className = controller.name.text;
      }

      for (const decorator of getDecorators(controller)) {
        const parsed = parseDecorator(decorator, sourceFile);
        if (!parsed) continue;
        if (parsed.name === "Route" && parsed.arguments[0]) {
          const arg = parsed.arguments[0];
          routeDecorator = ts.isStringLiteralLike(arg) ? arg.text : arg.getText(sourceFile);
        }
        if (parsed.name === "Tags") {
          parsed.arguments.forEach((arg) => {
            const text = ts.isStringLiteralLike(arg) ? arg.text : arg.getText(sourceFile);
            if (text) tagsSet.add(text);
          });
        }
      }

      controller.members.forEach((member) => {
        if (!ts.isMethodDeclaration(member)) return;

        const methodDecorators = getDecorators(member);
        if (!methodDecorators.length) return;

        const endpoint = extractMethodEndpoint(
          member,
          methodDecorators,
          routeDecorator,
          sourceFile,
        );
        if (endpoint) {
          methodSet.add(endpoint.method);
          endpoint.tags?.forEach((tag) => tagsSet.add(tag));
          endpoints.push(endpoint);
        }
      });
    }

    return {
      httpMethods: httpOrderSort(methodSet),
      endpoints,
      routeDecorator,
      tags: Array.from(tagsSet),
      className,
    };
  } catch (error) {
    console.warn("[specs-helpers] Failed to analyze TSOA controller", {
      controller: controllerAbsolute,
      error,
    });
    return { httpMethods: [], endpoints: [], tags: [] };
  }
}

/**
 * Extract endpoint information from a controller method.
 * @param member - Method declaration AST node
 * @param decorators - Method decorators
 * @param routeDecorator - Base route from controller
 * @param sourceFile - Source file for text extraction
 * @returns Endpoint info or null if not an HTTP method
 */
function extractMethodEndpoint(
  member: ts.MethodDeclaration,
  decorators: readonly ts.Decorator[],
  routeDecorator: string | undefined,
  sourceFile: ts.SourceFile,
): EndpointInfo | null {
  let httpMethodName: string | undefined;
  let subPath: string | undefined;
  const endpointTags = new Set<string>();
  const responses: ResponseInfo[] = [];
  let deprecatedViaDecorator: string | boolean | undefined;

  for (const decorator of decorators) {
    const parsed = parseDecorator(decorator, sourceFile);
    if (!parsed) continue;

    const normalizedMethod = HTTP_METHOD_DECORATORS.get(parsed.name) || parsed.name.toUpperCase();
    if (HTTP_METHOD_DECORATORS.has(parsed.name) || HTTP_METHOD_DECORATORS.has(normalizedMethod)) {
      httpMethodName = HTTP_METHOD_DECORATORS.get(parsed.name) || normalizedMethod;
      const firstArg = parsed.arguments[0];
      if (firstArg) {
        subPath = ts.isStringLiteralLike(firstArg)
          ? firstArg.text
          : firstArg.getText(sourceFile).trim();
      }
      continue;
    }

    if (parsed.name === "Tags") {
      parsed.arguments.forEach((arg) => {
        const text = ts.isStringLiteralLike(arg) ? arg.text : arg.getText(sourceFile);
        if (text) endpointTags.add(text);
      });
      continue;
    }

    if (parsed.name === "SuccessResponse" || parsed.name === "Response") {
      const statusArg = parsed.arguments[0];
      const descriptionArg = parsed.arguments[1];
      responses.push({
        status: statusArg
          ? ts.isStringLiteralLike(statusArg)
            ? statusArg.text
            : statusArg.getText(sourceFile)
          : undefined,
        description: descriptionArg
          ? ts.isStringLiteralLike(descriptionArg)
            ? descriptionArg.text
            : descriptionArg.getText(sourceFile)
          : undefined,
        decorator: parsed.name as "SuccessResponse" | "Response",
      });
      continue;
    }

    if (parsed.name === "Deprecated") {
      const reasonArg = parsed.arguments[0];
      deprecatedViaDecorator = reasonArg
        ? ts.isStringLiteralLike(reasonArg)
          ? reasonArg.text
          : reasonArg.getText(sourceFile)
        : true;
    }
  }

  if (!httpMethodName) return null;

  const documentation = extractMethodDocumentation(member, deprecatedViaDecorator, sourceFile);
  const parameters = extractMethodParameters(member, documentation.paramComments, sourceFile);

  const handlerName = member.name?.getText(sourceFile) ?? "handler";
  const returnType = member.type ? member.type.getText(sourceFile) : undefined;
  const signatureParameters = parameters
    .map((p) => `${p.name}${p.optional ? "?" : ""}${p.type ? `: ${p.type}` : ""}`)
    .join(", ");
  const signature = `${handlerName}(${signatureParameters})${returnType ? `: ${returnType}` : ""}`;

  const position = sourceFile.getLineAndCharacterOfPosition(member.getStart());

  return {
    method: httpMethodName,
    path: subPath || undefined,
    fullPath: combinePaths(routeDecorator, subPath),
    handler: handlerName,
    signature,
    returnType,
    documentation: documentation.hasContent ? documentation.payload : undefined,
    parameters,
    responses,
    tags: endpointTags.size ? Array.from(endpointTags) : undefined,
    source: { line: position.line + 1 },
  };
}

/** Result of extracting method documentation */
interface DocumentationResult {
  /** Extracted documentation payload */
  payload: EndpointDocumentation;
  /** Whether any documentation was found */
  hasContent: boolean;
  /** Parameter name to description mapping */
  paramComments: Map<string, string>;
}

/**
 * Extract JSDoc documentation from a method declaration.
 * @param member - Method declaration AST node
 * @param deprecatedViaDecorator - Deprecation from @Deprecated decorator
 * @param sourceFile - Source file for text extraction
 * @returns Documentation result with payload and param comments
 */
function extractMethodDocumentation(
  member: ts.MethodDeclaration,
  deprecatedViaDecorator: string | boolean | undefined,
  sourceFile: ts.SourceFile,
): DocumentationResult {
  const docsAccumulator = {
    summary: undefined as string | undefined,
    description: undefined as string | undefined,
    returns: undefined as string | undefined,
    remarks: [] as string[],
    examples: [] as string[],
    deprecated: deprecatedViaDecorator as string | boolean | undefined,
    paramComments: new Map<string, string>(),
  };

  const jsDocs = (member as { jsDoc?: readonly ts.JSDoc[] }).jsDoc ?? [];
  for (const jsDoc of jsDocs) {
    const comment = normalizeComment(jsDoc.comment, sourceFile);
    if (comment) {
      if (!docsAccumulator.summary) {
        const [firstLine, ...rest] = comment.split(/\r?\n/);
        docsAccumulator.summary = firstLine?.trim() || undefined;
        const remainder = rest.join("\n").trim();
        if (remainder) docsAccumulator.description = remainder;
      } else {
        docsAccumulator.description = docsAccumulator.description
          ? `${docsAccumulator.description}\n${comment}`
          : comment;
      }
    }

    (jsDoc.tags ?? []).forEach((tag) => {
      const tagName = tag.tagName.text.toLowerCase();
      const tagComment = normalizeComment(tag.comment, sourceFile);

      if (ts.isJSDocParameterTag(tag)) {
        const paramName = tag.name.getText(sourceFile);
        if (paramName && tagComment) docsAccumulator.paramComments.set(paramName, tagComment);
        return;
      }
      if (tagName === "returns" || tagName === "return") {
        if (tagComment)
          docsAccumulator.returns = docsAccumulator.returns
            ? `${docsAccumulator.returns}\n${tagComment}`
            : tagComment;
        return;
      }
      if (tagName === "example" && tagComment) {
        docsAccumulator.examples.push(tagComment);
        return;
      }
      if (tagName === "remarks" && tagComment) {
        docsAccumulator.remarks.push(tagComment);
        return;
      }
      if (tagName === "deprecated") {
        docsAccumulator.deprecated = tagComment || true;
      }
    });
  }

  const payload: EndpointDocumentation = {
    summary: docsAccumulator.summary,
    description: docsAccumulator.description,
    returns: docsAccumulator.returns,
    remarks: docsAccumulator.remarks.length ? docsAccumulator.remarks : undefined,
    examples: docsAccumulator.examples.length ? docsAccumulator.examples : undefined,
    deprecated: docsAccumulator.deprecated,
  };

  const hasContent = Boolean(
    payload.summary ||
      payload.description ||
      payload.returns ||
      (payload.remarks && payload.remarks.length > 0) ||
      (payload.examples && payload.examples.length > 0) ||
      payload.deprecated,
  );

  return { payload, hasContent, paramComments: docsAccumulator.paramComments };
}

/**
 * Extract parameter information from a method declaration.
 * @param member - Method declaration AST node
 * @param paramComments - JSDoc parameter descriptions
 * @param sourceFile - Source file for text extraction
 * @returns Array of parameter information
 */
function extractMethodParameters(
  member: ts.MethodDeclaration,
  paramComments: Map<string, string>,
  sourceFile: ts.SourceFile,
): ParameterInfo[] {
  return member.parameters.map((param) => {
    const name = param.name.getText(sourceFile);
    const type = param.type ? param.type.getText(sourceFile) : undefined;
    const optional = Boolean(param.questionToken || param.initializer);
    const decoratorNames = getDecorators(param)
      .map((d) => parseDecorator(d, sourceFile)?.name)
      .filter((n): n is string => Boolean(n));

    return {
      name,
      type,
      optional,
      description: paramComments.get(name),
      decorators: decoratorNames.length > 0 ? decoratorNames : undefined,
    };
  });
}
