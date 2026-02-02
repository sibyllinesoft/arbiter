/**
 * @packageDocumentation
 * TypeDoc-based API extraction for generating documentation.
 *
 * Uses TypeDoc CLI to extract documentation from TypeScript packages.
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

export interface ExtractedFunction {
  name: string;
  signature: string;
  description?: string;
  params: Array<{ name: string; type?: string; description?: string }>;
  returns?: { type?: string; description?: string };
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

// TypeDoc reflection kinds
const KIND_FUNCTION = 64;
const KIND_INTERFACE = 256;
const KIND_TYPE_ALIAS = 2097152;
const KIND_PROPERTY = 1024;
const KIND_MODULE = 4;

/**
 * Find the entry point for a package
 */
async function findEntryPoint(packageDir: string): Promise<string | null> {
  const pkgJsonPath = path.join(packageDir, "package.json");
  try {
    const pkgJson = JSON.parse(await fs.readFile(pkgJsonPath, "utf-8"));

    if (pkgJson.exports?.["."]?.import) {
      const srcPath = pkgJson.exports["."].import
        .replace(/^\.\/dist\//, "./src/")
        .replace(/\.js$/, ".ts");
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
    // Fall through
  }

  const candidates = ["src/index.ts", "src/lib.ts", "index.ts"];
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
 * Run TypeDoc CLI and get JSON output
 */
async function runTypeDoc(entryPoint: string, packageDir: string): Promise<any> {
  const tmpFile = path.join(os.tmpdir(), `typedoc-${process.pid}-${Date.now()}.json`);

  return new Promise((resolve, reject) => {
    const args = [
      "typedoc",
      "--json",
      tmpFile,
      "--skipErrorChecking",
      "--excludeExternals",
      "--excludePrivate",
      "--excludeProtected",
      "--logLevel",
      "None",
      entryPoint,
    ];

    const proc = spawn("bunx", args, {
      cwd: packageDir,
      stdio: ["ignore", "ignore", "ignore"],
    });

    proc.on("close", async () => {
      try {
        const content = await fs.readFile(tmpFile, "utf-8");
        await fs.unlink(tmpFile).catch(() => {});
        resolve(JSON.parse(content));
      } catch {
        resolve(null);
      }
    });

    proc.on("error", () => resolve(null));
  });
}

/**
 * Extract text from TypeDoc comment
 */
function getCommentText(comment: any): string | undefined {
  if (!comment?.summary) return undefined;
  const text = comment.summary
    .map((p: any) => p.text || "")
    .join("")
    .trim();
  return text || undefined;
}

/**
 * Get deprecated tag
 */
function getDeprecated(comment: any): string | undefined {
  const tag = comment?.blockTags?.find((t: any) => t.tag === "@deprecated");
  return tag ? tag.content?.[0]?.text || "Deprecated" : undefined;
}

/**
 * Get returns description
 */
function getReturnsDesc(comment: any): string | undefined {
  const tag = comment?.blockTags?.find((t: any) => t.tag === "@returns");
  return tag?.content?.[0]?.text;
}

/**
 * Format TypeDoc type to string
 */
function formatType(type: any): string {
  if (!type) return "unknown";

  switch (type.type) {
    case "intrinsic":
      return type.name;
    case "reference":
      if (type.typeArguments?.length) {
        const args = type.typeArguments.map(formatType).join(", ");
        return `${type.name}<${args}>`;
      }
      return type.name || "unknown";
    case "array":
      return `${formatType(type.elementType)}[]`;
    case "union":
      return type.types?.map(formatType).join(" | ") || "unknown";
    case "intersection":
      return type.types?.map(formatType).join(" & ") || "unknown";
    case "literal":
      return JSON.stringify(type.value);
    case "reflection":
      return "object";
    case "tuple":
      return `[${type.elements?.map(formatType).join(", ") || ""}]`;
    default:
      return type.name || "unknown";
  }
}

/**
 * Extract API from TypeDoc JSON (recursive to handle modules)
 */
function extractFromJson(data: any, prefix = ""): ExtractedAPI {
  const result: ExtractedAPI = {
    functions: [],
    interfaces: [],
    types: [],
  };

  for (const child of data.children || []) {
    const name = prefix ? `${prefix}.${child.name}` : child.name;

    // Recurse into modules (namespace re-exports)
    if (child.kind === KIND_MODULE && child.children) {
      const nested = extractFromJson(child, name);
      result.functions.push(...nested.functions);
      result.interfaces.push(...nested.interfaces);
      result.types.push(...nested.types);
      continue;
    }

    // Functions
    if (child.kind === KIND_FUNCTION) {
      const sig = child.signatures?.[0];
      const returnType = formatType(sig?.type);

      result.functions.push({
        name,
        signature: `function ${name}(...)`,
        description: getCommentText(sig?.comment),
        params: (sig?.parameters || []).map((p: any) => ({
          name: p.name,
          type: formatType(p.type),
          description: getCommentText(p.comment),
        })),
        returns: { type: returnType, description: getReturnsDesc(sig?.comment) },
        deprecated: getDeprecated(sig?.comment),
        isAsync: returnType.startsWith("Promise"),
      });
    }

    // Interfaces
    if (child.kind === KIND_INTERFACE) {
      result.interfaces.push({
        name,
        description: getCommentText(child.comment),
        properties: (child.children || [])
          .filter((p: any) => p.kind === KIND_PROPERTY)
          .map((p: any) => ({
            name: p.name,
            type: formatType(p.type),
            optional: p.flags?.isOptional || false,
            description: getCommentText(p.comment),
          })),
      });
    }

    // Type aliases
    if (child.kind === KIND_TYPE_ALIAS) {
      result.types.push({
        name,
        definition: formatType(child.type),
        description: getCommentText(child.comment),
      });
    }
  }

  return result;
}

/**
 * Extract API documentation from a TypeScript package using TypeDoc
 */
export async function extractPackageAPIWithTypeDoc(
  packageDir: string,
): Promise<ExtractedAPI | null> {
  const entryPoint = await findEntryPoint(packageDir);
  if (!entryPoint) {
    return null;
  }

  try {
    const data = await runTypeDoc(entryPoint, packageDir);
    if (!data) {
      return null;
    }

    const api = extractFromJson(data);

    if (api.functions.length === 0 && api.interfaces.length === 0 && api.types.length === 0) {
      return null;
    }

    return api;
  } catch {
    return null;
  }
}

/**
 * Generate markdown documentation from extracted API
 */
export function generateAPIMarkdown(api: ExtractedAPI): string {
  const lines: string[] = ["## API", ""];

  if (api.functions.length > 0) {
    lines.push("### Functions", "");

    for (const func of api.functions) {
      const asyncPrefix = func.isAsync ? "async " : "";
      lines.push(`#### \`${asyncPrefix}${func.name}()\``, "");

      if (func.deprecated) {
        lines.push(`> **Deprecated:** ${func.deprecated}`, "");
      }

      if (func.description) {
        lines.push(func.description, "");
      }

      if (func.params.length > 0) {
        lines.push("**Parameters:**", "");
        for (const param of func.params) {
          const typeStr = param.type ? ` \`${param.type}\`` : "";
          const descStr = param.description ? ` - ${param.description}` : "";
          lines.push(`- \`${param.name}\`${typeStr}${descStr}`);
        }
        lines.push("");
      }

      if (func.returns?.type) {
        const descStr = func.returns.description ? ` - ${func.returns.description}` : "";
        lines.push(`**Returns:** \`${func.returns.type}\`${descStr}`, "");
      }
    }
  }

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
