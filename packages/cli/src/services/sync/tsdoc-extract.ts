/**
 * @packageDocumentation
 * TSDoc extraction for generating API documentation.
 *
 * Extracts documentation from TypeScript source files:
 * - Exported functions with JSDoc/TSDoc comments
 * - Exported interfaces and types
 * - Parameter and return type information
 */

import fs from "node:fs/promises";
import path from "node:path";
import { glob } from "glob";

export interface ExtractedFunction {
  name: string;
  signature: string;
  description?: string;
  params: Array<{ name: string; type?: string; description?: string }>;
  returns?: { type?: string; description?: string };
  examples?: string[];
  deprecated?: string;
  isAsync: boolean;
}

export interface ExtractedInterface {
  name: string;
  description?: string;
  properties: Array<{ name: string; type: string; optional: boolean; description?: string }>;
}

export interface ExtractedType {
  name: string;
  definition: string;
  description?: string;
}

export interface ExtractedAPI {
  functions: ExtractedFunction[];
  interfaces: ExtractedInterface[];
  types: ExtractedType[];
}

/**
 * Clean a description string by removing trailing comment artifacts
 */
function cleanDescription(desc: string | undefined): string | undefined {
  if (!desc) return undefined;
  // Remove trailing " /" and "*/" artifacts
  return (
    desc
      .replace(/\s*\/\s*$/g, "")
      .replace(/\s*\*\/\s*$/g, "")
      .trim() || undefined
  );
}

/**
 * Parse a TSDoc/JSDoc comment block into structured data
 */
function parseDocComment(comment: string): {
  description?: string;
  params: Array<{ name: string; type?: string; description?: string }>;
  returns?: { type?: string; description?: string };
  examples: string[];
  deprecated?: string;
} {
  const lines = comment
    .replace(/^\/\*\*/, "")
    .replace(/\*\/$/, "")
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/, "").trim());

  const result: ReturnType<typeof parseDocComment> = {
    params: [],
    examples: [],
  };

  let currentTag: string | null = null;
  let currentContent: string[] = [];
  let descriptionLines: string[] = [];

  for (const line of lines) {
    const tagMatch = line.match(/^@(\w+)(?:\s+(.*))?$/);

    if (tagMatch) {
      // Save previous tag content
      if (currentTag === "param") {
        const paramMatch = currentContent.join(" ").match(/^\{([^}]+)\}\s*(\w+)\s*[-–]?\s*(.*)/);
        const simpleMatch = currentContent.join(" ").match(/^(\w+)\s*[-–]?\s*(.*)/);
        if (paramMatch) {
          result.params.push({
            name: paramMatch[2],
            type: paramMatch[1],
            description: cleanDescription(paramMatch[3]),
          });
        } else if (simpleMatch) {
          result.params.push({
            name: simpleMatch[1],
            description: cleanDescription(simpleMatch[2]),
          });
        }
      } else if (currentTag === "returns" || currentTag === "return") {
        const returnMatch = currentContent.join(" ").match(/^\{([^}]+)\}\s*(.*)/);
        if (returnMatch) {
          result.returns = { type: returnMatch[1], description: cleanDescription(returnMatch[2]) };
        } else {
          result.returns = { description: cleanDescription(currentContent.join(" ")) };
        }
      } else if (currentTag === "example") {
        result.examples.push(currentContent.join("\n"));
      } else if (currentTag === "deprecated") {
        const deprecatedText = currentContent.join(" ");
        result.deprecated = deprecatedText.split("/")[0].trim() || "Deprecated";
      }

      // Start new tag
      currentTag = tagMatch[1];
      currentContent = tagMatch[2] ? [tagMatch[2]] : [];
    } else if (currentTag) {
      currentContent.push(line);
    } else if (line && !line.startsWith("@")) {
      descriptionLines.push(line);
    }
  }

  // Handle final tag
  if (currentTag === "param") {
    const paramMatch = currentContent.join(" ").match(/^\{([^}]+)\}\s*(\w+)\s*[-–]?\s*(.*)/);
    const simpleMatch = currentContent.join(" ").match(/^(\w+)\s*[-–]?\s*(.*)/);
    if (paramMatch) {
      result.params.push({
        name: paramMatch[2],
        type: paramMatch[1],
        description: cleanDescription(paramMatch[3]),
      });
    } else if (simpleMatch) {
      result.params.push({
        name: simpleMatch[1],
        description: cleanDescription(simpleMatch[2]),
      });
    }
  } else if (currentTag === "returns" || currentTag === "return") {
    const returnMatch = currentContent.join(" ").match(/^\{([^}]+)\}\s*(.*)/);
    if (returnMatch) {
      result.returns = { type: returnMatch[1], description: cleanDescription(returnMatch[2]) };
    } else {
      result.returns = { description: cleanDescription(currentContent.join(" ")) };
    }
  } else if (currentTag === "example") {
    result.examples.push(currentContent.join("\n"));
  } else if (currentTag === "deprecated") {
    const deprecatedText = currentContent.join(" ");
    result.deprecated = deprecatedText.split("/")[0].trim() || "Deprecated";
  }

  result.description = cleanDescription(descriptionLines.join(" ").trim());
  return result;
}

/**
 * Extract function signature from TypeScript code
 */
function extractFunctionSignature(declaration: string): string {
  // Clean up the signature - remove 'export', 'async', get just the function signature
  return declaration
    .replace(/^export\s+/, "")
    .replace(/^async\s+/, "")
    .replace(/\{[\s\S]*$/, "")
    .trim();
}

/**
 * Extract exported functions from TypeScript source
 */
function extractFunctions(source: string): ExtractedFunction[] {
  const functions: ExtractedFunction[] = [];

  // Match exported functions with optional preceding doc comment
  // Handles: export function name(...), export async function name(...), export const name = (...) =>
  const functionPattern =
    /(\/\*\*[\s\S]*?\*\/\s*)?(export\s+(?:async\s+)?function\s+(\w+)\s*(?:<[^>]+>)?\s*\([^)]*\)(?:\s*:\s*[^{]+)?)/g;

  let match;
  while ((match = functionPattern.exec(source)) !== null) {
    const docComment = match[1];
    const fullDeclaration = match[2];
    const funcName = match[3];

    const isAsync = fullDeclaration.includes("async ");
    const signature = extractFunctionSignature(fullDeclaration);

    let parsed: ReturnType<typeof parseDocComment> = {
      params: [],
      examples: [],
    };

    if (docComment) {
      parsed = parseDocComment(docComment);
    }

    // Extract parameter types from signature if not in doc
    const paramMatch = fullDeclaration.match(/\(([^)]*)\)/);
    if (paramMatch && parsed.params.length === 0) {
      const paramsStr = paramMatch[1];
      const paramParts = paramsStr.split(",").filter((p) => p.trim());
      for (const part of paramParts) {
        const paramNameMatch = part.trim().match(/^(\w+)(?:\??:\s*(.+))?$/);
        if (paramNameMatch) {
          parsed.params.push({
            name: paramNameMatch[1],
            type: paramNameMatch[2]?.trim(),
          });
        }
      }
    }

    // Extract return type from signature if not in doc
    const returnTypeMatch = fullDeclaration.match(/\):\s*([^{]+)$/);
    if (returnTypeMatch && !parsed.returns?.type) {
      parsed.returns = {
        ...parsed.returns,
        type: returnTypeMatch[1].trim(),
      };
    }

    functions.push({
      name: funcName,
      signature,
      description: parsed.description,
      params: parsed.params,
      returns: parsed.returns,
      examples: parsed.examples,
      deprecated: parsed.deprecated,
      isAsync,
    });
  }

  // Also match arrow function exports: export const name = (...) =>
  const arrowPattern =
    /(\/\*\*[\s\S]*?\*\/\s*)?export\s+const\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s+)?\([^)]*\)\s*(?::\s*[^=]+)?\s*=>/g;

  while ((match = arrowPattern.exec(source)) !== null) {
    const docComment = match[1];
    const funcName = match[2];

    // Check if we already have this function
    if (functions.some((f) => f.name === funcName)) continue;

    let parsed: ReturnType<typeof parseDocComment> = {
      params: [],
      examples: [],
    };

    if (docComment) {
      parsed = parseDocComment(docComment);
    }

    functions.push({
      name: funcName,
      signature: `const ${funcName} = (...)`,
      description: parsed.description,
      params: parsed.params,
      returns: parsed.returns,
      examples: parsed.examples,
      deprecated: parsed.deprecated,
      isAsync: match[0].includes("async"),
    });
  }

  return functions;
}

/**
 * Extract exported interfaces from TypeScript source
 */
function extractInterfaces(source: string): ExtractedInterface[] {
  const interfaces: ExtractedInterface[] = [];

  // Match exported interfaces with optional doc comment
  const interfacePattern =
    /(\/\*\*[\s\S]*?\*\/\s*)?export\s+interface\s+(\w+)(?:<[^>]+>)?\s*\{([^}]+)\}/g;

  let match;
  while ((match = interfacePattern.exec(source)) !== null) {
    const docComment = match[1];
    const name = match[2];
    const body = match[3];

    let description: string | undefined;
    if (docComment) {
      const parsed = parseDocComment(docComment);
      description = parsed.description;
    }

    // Parse properties from interface body
    const properties: ExtractedInterface["properties"] = [];
    const propPattern = /(\w+)(\?)?:\s*([^;]+);/g;
    let propMatch;
    while ((propMatch = propPattern.exec(body)) !== null) {
      properties.push({
        name: propMatch[1],
        optional: !!propMatch[2],
        type: propMatch[3].trim(),
      });
    }

    interfaces.push({ name, description, properties });
  }

  return interfaces;
}

/**
 * Extract exported type aliases from TypeScript source
 */
function extractTypes(source: string): ExtractedType[] {
  const types: ExtractedType[] = [];

  // Match exported type aliases
  const typePattern = /(\/\*\*[\s\S]*?\*\/\s*)?export\s+type\s+(\w+)(?:<[^>]+>)?\s*=\s*([^;]+);/g;

  let match;
  while ((match = typePattern.exec(source)) !== null) {
    const docComment = match[1];
    const name = match[2];
    const definition = match[3].trim();

    let description: string | undefined;
    if (docComment) {
      const parsed = parseDocComment(docComment);
      description = parsed.description;
    }

    types.push({ name, definition, description });
  }

  return types;
}

/**
 * Find the main entry point for a TypeScript package
 */
async function findEntryPoint(packageDir: string): Promise<string | null> {
  // Check package.json for exports/main
  const pkgJsonPath = path.join(packageDir, "package.json");
  try {
    const pkgJson = JSON.parse(await fs.readFile(pkgJsonPath, "utf-8"));

    // Check exports field first
    if (pkgJson.exports) {
      const mainExport = pkgJson.exports["."];
      if (typeof mainExport === "string") {
        const srcPath = mainExport.replace(/^\.\/dist\//, "./src/").replace(/\.js$/, ".ts");
        const fullPath = path.join(packageDir, srcPath);
        if (
          await fs
            .access(fullPath)
            .then(() => true)
            .catch(() => false)
        ) {
          return fullPath;
        }
      } else if (mainExport?.import) {
        const srcPath = mainExport.import.replace(/^\.\/dist\//, "./src/").replace(/\.js$/, ".ts");
        const fullPath = path.join(packageDir, srcPath);
        if (
          await fs
            .access(fullPath)
            .then(() => true)
            .catch(() => false)
        ) {
          return fullPath;
        }
      }
    }

    // Check main field
    if (pkgJson.main) {
      const srcPath = pkgJson.main.replace(/^\.\/dist\//, "./src/").replace(/\.js$/, ".ts");
      const fullPath = path.join(packageDir, srcPath);
      if (
        await fs
          .access(fullPath)
          .then(() => true)
          .catch(() => false)
      ) {
        return fullPath;
      }
    }
  } catch {
    // No package.json or invalid
  }

  // Fallback: look for common entry points
  const candidates = ["src/index.ts", "src/lib.ts", "src/main.ts", "index.ts", "lib.ts"];

  for (const candidate of candidates) {
    const fullPath = path.join(packageDir, candidate);
    if (
      await fs
        .access(fullPath)
        .then(() => true)
        .catch(() => false)
    ) {
      return fullPath;
    }
  }

  return null;
}

/**
 * Extract API documentation from a TypeScript package
 */
export async function extractPackageAPI(packageDir: string): Promise<ExtractedAPI | null> {
  const entryPoint = await findEntryPoint(packageDir);

  if (!entryPoint) {
    return null;
  }

  try {
    const source = await fs.readFile(entryPoint, "utf-8");

    const functions = extractFunctions(source);
    const interfaces = extractInterfaces(source);
    const types = extractTypes(source);

    // Only return if we found something
    if (functions.length === 0 && interfaces.length === 0 && types.length === 0) {
      return null;
    }

    return { functions, interfaces, types };
  } catch {
    return null;
  }
}

/**
 * Generate markdown documentation from extracted API
 */
export function generateAPIMarkdown(api: ExtractedAPI): string {
  const lines: string[] = ["## API", ""];

  // Functions
  if (api.functions.length > 0) {
    lines.push("### Functions", "");

    for (const func of api.functions) {
      // Function header
      const asyncPrefix = func.isAsync ? "async " : "";
      lines.push(`#### \`${asyncPrefix}${func.name}()\``, "");

      // Deprecation warning
      if (func.deprecated) {
        lines.push(`> **Deprecated:** ${func.deprecated}`, "");
      }

      // Description
      if (func.description) {
        lines.push(func.description, "");
      }

      // Parameters
      if (func.params.length > 0) {
        lines.push("**Parameters:**", "");
        for (const param of func.params) {
          const typeStr = param.type ? ` \`${param.type}\`` : "";
          const descStr = param.description ? ` - ${param.description}` : "";
          lines.push(`- \`${param.name}\`${typeStr}${descStr}`);
        }
        lines.push("");
      }

      // Returns
      if (func.returns) {
        const typeStr = func.returns.type ? `\`${func.returns.type}\`` : "";
        const descStr = func.returns.description ? ` - ${func.returns.description}` : "";
        lines.push(`**Returns:** ${typeStr}${descStr}`, "");
      }

      // Examples
      if (func.examples.length > 0) {
        lines.push("**Example:**", "");
        for (const example of func.examples) {
          lines.push("```typescript", example.trim(), "```", "");
        }
      }
    }
  }

  // Interfaces
  if (api.interfaces.length > 0) {
    lines.push("### Interfaces", "");

    for (const iface of api.interfaces) {
      lines.push(`#### \`${iface.name}\``, "");

      if (iface.description) {
        lines.push(iface.description, "");
      }

      if (iface.properties.length > 0) {
        lines.push("| Property | Type | Required |");
        lines.push("|----------|------|----------|");
        for (const prop of iface.properties) {
          const required = prop.optional ? "No" : "Yes";
          lines.push(`| \`${prop.name}\` | \`${prop.type}\` | ${required} |`);
        }
        lines.push("");
      }
    }
  }

  // Types
  if (api.types.length > 0) {
    lines.push("### Types", "");

    for (const type of api.types) {
      lines.push(`#### \`${type.name}\``, "");

      if (type.description) {
        lines.push(type.description, "");
      }

      lines.push("```typescript", `type ${type.name} = ${type.definition}`, "```", "");
    }
  }

  return lines.join("\n");
}

/**
 * Extract re-export paths from source code
 */
function extractReExports(source: string): string[] {
  const reExports: string[] = [];

  // Match: export * from "./module"
  // Match: export * as Name from "./module"
  // Match: export { foo, bar } from "./module"
  const reExportPattern = /export\s+(?:\*|\{[^}]+\})(?:\s+as\s+\w+)?\s+from\s+["']([^"']+)["']/g;

  let match;
  while ((match = reExportPattern.exec(source)) !== null) {
    reExports.push(match[1]);
  }

  return reExports;
}

/**
 * Resolve a relative import path to an absolute file path
 */
async function resolveModulePath(fromFile: string, importPath: string): Promise<string | null> {
  const dir = path.dirname(fromFile);

  // Try with .ts extension
  const tsPath = path.join(dir, importPath + ".ts");
  if (
    await fs
      .access(tsPath)
      .then(() => true)
      .catch(() => false)
  ) {
    return tsPath;
  }

  // Try with /index.ts
  const indexPath = path.join(dir, importPath, "index.ts");
  if (
    await fs
      .access(indexPath)
      .then(() => true)
      .catch(() => false)
  ) {
    return indexPath;
  }

  // Try with .tsx extension
  const tsxPath = path.join(dir, importPath + ".tsx");
  if (
    await fs
      .access(tsxPath)
      .then(() => true)
      .catch(() => false)
  ) {
    return tsxPath;
  }

  return null;
}

/**
 * Recursively extract API from a file and its re-exports
 */
async function extractFromFileRecursive(
  filePath: string,
  visited: Set<string> = new Set(),
): Promise<ExtractedAPI> {
  // Prevent infinite loops
  if (visited.has(filePath)) {
    return { functions: [], interfaces: [], types: [] };
  }
  visited.add(filePath);

  const result: ExtractedAPI = {
    functions: [],
    interfaces: [],
    types: [],
  };

  try {
    const source = await fs.readFile(filePath, "utf-8");

    // Extract direct exports from this file
    const directFunctions = extractFunctions(source);
    const directInterfaces = extractInterfaces(source);
    const directTypes = extractTypes(source);

    result.functions.push(...directFunctions);
    result.interfaces.push(...directInterfaces);
    result.types.push(...directTypes);

    // Follow re-exports
    const reExports = extractReExports(source);
    for (const reExport of reExports) {
      // Only follow relative imports
      if (!reExport.startsWith(".")) continue;

      const resolvedPath = await resolveModulePath(filePath, reExport);
      if (resolvedPath) {
        const childAPI = await extractFromFileRecursive(resolvedPath, visited);
        result.functions.push(...childAPI.functions);
        result.interfaces.push(...childAPI.interfaces);
        result.types.push(...childAPI.types);
      }
    }
  } catch {
    // Skip files that can't be read
  }

  return result;
}

/**
 * Extract API documentation from a TypeScript package (with re-export support)
 */
export async function extractPackageAPIWithReExports(
  packageDir: string,
): Promise<ExtractedAPI | null> {
  const entryPoint = await findEntryPoint(packageDir);

  if (!entryPoint) {
    return null;
  }

  try {
    const api = await extractFromFileRecursive(entryPoint);

    // Deduplicate by name (in case of re-exports from multiple paths)
    const seenFunctions = new Set<string>();
    const seenInterfaces = new Set<string>();
    const seenTypes = new Set<string>();

    api.functions = api.functions.filter((f) => {
      if (seenFunctions.has(f.name)) return false;
      seenFunctions.add(f.name);
      return true;
    });

    api.interfaces = api.interfaces.filter((i) => {
      if (seenInterfaces.has(i.name)) return false;
      seenInterfaces.add(i.name);
      return true;
    });

    api.types = api.types.filter((t) => {
      if (seenTypes.has(t.name)) return false;
      seenTypes.add(t.name);
      return true;
    });

    // Only return if we found something
    if (api.functions.length === 0 && api.interfaces.length === 0 && api.types.length === 0) {
      return null;
    }

    return api;
  } catch {
    return null;
  }
}
