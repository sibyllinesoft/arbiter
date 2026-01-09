/**
 * @packageDocumentation
 * Assembly file parsing utilities for code generation.
 *
 * Provides functions for parsing CUE assembly files and
 * extracting configuration with schema version detection.
 */

import { executeCommand } from "@/services/generate/core/compose/assembly-helpers.js";
import type { GenerationReporter } from "@/services/generate/util/types.js";
import type { AppSpec, ConfigWithVersion, SchemaVersion } from "@arbiter/shared";
import fs from "fs-extra";

/**
 * Normalize capabilities from various input formats.
 */
export function normalizeCapabilities(input: any): Record<string, any> | null {
  if (!input) {
    return null;
  }

  if (Array.isArray(input)) {
    const entries: Record<string, any> = {};
    input.forEach((raw, index) => {
      const base = typeof raw === "string" ? { name: raw } : { ...raw };
      const idSource =
        (typeof raw?.id === "string" && raw.id) || base.name || `capability_${index + 1}`;
      const key = slugify(String(idSource), `capability_${index + 1}`);
      entries[key] = base;
    });
    return entries;
  }

  if (typeof input === "object") {
    return { ...input };
  }

  return null;
}

// Simple slugify function
function slugify(str: string, fallback: string): string {
  const slug = str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

/**
 * Parse assembly.cue file and extract configuration with schema version detection.
 */
export async function parseAssemblyFile(
  assemblyPath: string,
  reporter: GenerationReporter,
): Promise<ConfigWithVersion> {
  // In test environments or when explicitly disabled, skip invoking cue and use fallback parsing
  if (process.env.VITEST || process.env.ARBITER_SKIP_CUE === "1") {
    return fallbackParseAssembly(assemblyPath, reporter);
  }

  try {
    // Use CUE to evaluate and export as JSON
    const result = await executeCommand("cue", ["eval", "--out", "json", assemblyPath], {
      timeout: 10000,
    });

    if (!result.success) {
      reporter.warn("CUE evaluation failed:", result.stderr);
      return fallbackParseAssembly(assemblyPath, reporter);
    }

    const cueData = JSON.parse(result.stdout);

    // Detect schema version based on structure
    const schemaVersion = detectSchemaVersion(cueData);

    // Parse app schema
    return parseAppSchema(cueData, schemaVersion);
  } catch (error) {
    reporter.warn("Error parsing CUE file:", error);
    return fallbackParseAssembly(assemblyPath, reporter);
  }
}

/**
 * Detect schema version based on CUE data structure.
 */
export function detectSchemaVersion(cueData: any): SchemaVersion {
  // Always use app schema - it's the primary and only supported schema now
  return {
    version: "app",
    detected_from: "metadata",
  };
}

/**
 * Parse App Specification schema.
 */
export function parseAppSchema(cueData: any, schemaVersion: SchemaVersion): ConfigWithVersion {
  const appSpec: AppSpec = {
    product: cueData.product || {
      name: "Unknown App",
    },
    config: cueData.config,
    resources: cueData.resources ?? cueData.components ?? [],
    behaviors: cueData.behaviors || [],
    services: cueData.services,
    capabilities: normalizeCapabilities(cueData.capabilities),
    tests: cueData.tests,
    groups: cueData.groups,
    docs: cueData.docs,
    security: cueData.security,
    performance: cueData.performance,
    observability: cueData.observability,
    environments: cueData.environments ?? cueData.deployments,
    data: cueData.data,
    metadata: cueData.metadata,
    testability: cueData.testability,
    ops: cueData.ops,
    processes: cueData.processes ?? cueData.stateModels,
  };

  const config: ConfigWithVersion = {
    schema: schemaVersion,
    app: appSpec,
  };

  (config as any)._fullCueData = cueData;

  return config;
}

/**
 * Fallback to file-based regex parsing if CUE evaluation fails.
 */
export async function fallbackParseAssembly(
  assemblyPath: string,
  reporter: GenerationReporter,
): Promise<ConfigWithVersion> {
  const content = await fs.readFile(assemblyPath, "utf-8");

  // Always use app schema
  const schemaVersion: SchemaVersion = { version: "app", detected_from: "default" };

  reporter.warn("⚠️  CUE evaluation failed - using limited fallback parsing");

  // Extract basic information from the CUE file
  const nameMatch = content.match(/name:\s*"([^"]+)"/);
  const languageMatch = content.match(/language:\s*"([^"]+)"/);
  const productName = nameMatch ? nameMatch[1] : "Unknown App";
  const language = languageMatch ? languageMatch[1] : "typescript";

  const appSpec: AppSpec = {
    product: { name: productName },
    config: { language },
    resources: [],
    behaviors: [],
    capabilities: {},
  };

  const config: ConfigWithVersion = {
    schema: schemaVersion,
    app: appSpec,
  };

  (config as any)._fullCueData = { product: appSpec.product, config: appSpec.config };

  return config;
}
