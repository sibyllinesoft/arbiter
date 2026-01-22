/**
 * @packageDocumentation
 * Platform Detection Utilities for Smart Service Configuration.
 *
 * Automatically detects platform context from project structure and suggests
 * appropriate service types for Cloudflare, Vercel, and Supabase platforms.
 */

import path from "node:path";
import type { PlatformServiceType } from "@/cue/index.js";
import fs from "fs-extra";

/** Detected platform context with confidence and suggestions. */
export interface PlatformContext {
  detected: "cloudflare" | "vercel" | "supabase" | "kubernetes" | "unknown";
  confidence: number; // 0-1 score
  indicators: string[];
  suggestions: PlatformSuggestion[];
}

/** Platform-specific service suggestion. */
export interface PlatformSuggestion {
  serviceName: string;
  serviceType: PlatformServiceType;
  reason: string;
}

/** Supported platform identifiers. */
type PlatformKey = "cloudflare" | "vercel" | "supabase";

/** File presence indicator for platform detection. */
interface FileIndicator {
  path: string;
  score: number;
  message: string;
}

/** Environment variable indicator for platform detection. */
interface EnvIndicator {
  keyword: string;
  score: number;
  message: string;
}

/** Package dependency indicator for platform detection. */
interface DependencyIndicator {
  packages: string[];
  score: number;
  message: string;
}

/** Collection of all indicator types for a platform. */
interface PlatformIndicators {
  files: FileIndicator[];
  envKeywords: EnvIndicator[];
  dependencies: DependencyIndicator[];
}

/** Platform-specific indicators for detection. */
const PLATFORM_INDICATORS: Record<PlatformKey, PlatformIndicators> = {
  cloudflare: {
    files: [
      { path: "wrangler.toml", score: 0.8, message: "wrangler.toml found" },
      { path: "workers", score: 0.6, message: "workers/ directory found" },
    ],
    envKeywords: [{ keyword: "CLOUDFLARE", score: 0.3, message: "CLOUDFLARE env vars found" }],
    dependencies: [
      {
        packages: ["@cloudflare/workers-types", "wrangler"],
        score: 0.4,
        message: "Cloudflare dependencies found",
      },
    ],
  },
  vercel: {
    files: [
      { path: "vercel.json", score: 0.8, message: "vercel.json found" },
      { path: ".vercel", score: 0.4, message: ".vercel/ directory found" },
      { path: "api", score: 0.3, message: "api/ directory found" },
    ],
    envKeywords: [{ keyword: "VERCEL", score: 0.3, message: "VERCEL env vars found" }],
    dependencies: [
      { packages: ["@vercel/node", "vercel"], score: 0.4, message: "Vercel dependencies found" },
    ],
  },
  supabase: {
    files: [{ path: "supabase", score: 0.7, message: "supabase/ directory found" }],
    envKeywords: [{ keyword: "SUPABASE", score: 0.5, message: "SUPABASE env vars found" }],
    dependencies: [
      {
        packages: ["@supabase/supabase-js", "supabase"],
        score: 0.4,
        message: "Supabase dependencies found",
      },
    ],
  },
};

/**
 * Check file indicators for platform detection.
 * @param projectDir - Directory to check for files
 * @param indicators - File indicators to check
 * @param results - Array to append indicator messages
 * @returns Accumulated score from matched indicators
 */
async function checkFileIndicators(
  projectDir: string,
  indicators: FileIndicator[],
  results: string[],
): Promise<number> {
  let score = 0;
  for (const indicator of indicators) {
    if (await fs.pathExists(path.join(projectDir, indicator.path))) {
      score += indicator.score;
      results.push(indicator.message);
    }
  }
  return score;
}

/**
 * Check environment variable indicators for platform detection.
 * @param envContent - Content of the .env file
 * @param indicators - Environment indicators to check
 * @param results - Array to append indicator messages
 * @returns Accumulated score from matched indicators
 */
function checkEnvIndicators(
  envContent: string,
  indicators: EnvIndicator[],
  results: string[],
): number {
  let score = 0;
  for (const indicator of indicators) {
    if (envContent.includes(indicator.keyword)) {
      score += indicator.score;
      results.push(indicator.message);
    }
  }
  return score;
}

/**
 * Check package dependency indicators for platform detection.
 * @param deps - Combined dependencies object from package.json
 * @param indicators - Dependency indicators to check
 * @param results - Array to append indicator messages
 * @returns Accumulated score from matched indicators
 */
function checkDependencyIndicators(
  deps: Record<string, unknown>,
  indicators: DependencyIndicator[],
  results: string[],
): number {
  let score = 0;
  for (const indicator of indicators) {
    if (indicator.packages.some((pkg) => deps[pkg])) {
      score += indicator.score;
      results.push(indicator.message);
    }
  }
  return score;
}

/**
 * Scan all platform indicators for a project directory.
 * @param projectDir - Directory to scan for platform indicators
 * @returns Object with platform scores and detected indicators
 */
async function scanPlatformIndicators(projectDir: string): Promise<{
  scores: Record<PlatformKey, number>;
  indicators: string[];
}> {
  const scores: Record<PlatformKey, number> = { cloudflare: 0, vercel: 0, supabase: 0 };
  const indicators: string[] = [];

  const platforms = Object.keys(PLATFORM_INDICATORS) as PlatformKey[];

  for (const platform of platforms) {
    const config = PLATFORM_INDICATORS[platform];
    scores[platform] += await checkFileIndicators(projectDir, config.files, indicators);
  }

  const envPath = path.join(projectDir, ".env");
  if (await fs.pathExists(envPath)) {
    const envContent = await fs.readFile(envPath, "utf-8");
    for (const platform of platforms) {
      scores[platform] += checkEnvIndicators(
        envContent,
        PLATFORM_INDICATORS[platform].envKeywords,
        indicators,
      );
    }
  }

  const packageJsonPath = path.join(projectDir, "package.json");
  if (await fs.pathExists(packageJsonPath)) {
    const packageJson = await fs.readJson(packageJsonPath);
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    for (const platform of platforms) {
      scores[platform] += checkDependencyIndicators(
        deps,
        PLATFORM_INDICATORS[platform].dependencies,
        indicators,
      );
    }
  }

  return { scores, indicators };
}

/**
 * Determine the detected platform from accumulated scores.
 * @param scores - Platform scores from indicator checks
 * @returns Detected platform identifier
 */
function determinePlatform(scores: Record<PlatformKey, number>): PlatformContext["detected"] {
  const maxScore = Math.max(scores.cloudflare, scores.vercel, scores.supabase);

  if (maxScore >= 0.5) {
    if (scores.cloudflare === maxScore) return "cloudflare";
    if (scores.vercel === maxScore) return "vercel";
    if (scores.supabase === maxScore) return "supabase";
  }

  return maxScore > 0 ? "kubernetes" : "unknown";
}

/**
 * Detect platform context from project structure and files.
 * @param projectDir - Directory to analyze (defaults to current)
 * @returns Promise resolving to detected platform context
 */
export async function detectPlatform(projectDir = "."): Promise<PlatformContext> {
  try {
    const { scores, indicators } = await scanPlatformIndicators(projectDir);
    const detected = determinePlatform(scores);
    const maxScore = Math.max(scores.cloudflare, scores.vercel, scores.supabase);

    return {
      detected,
      confidence: maxScore,
      indicators,
      suggestions: generatePlatformSuggestions(detected),
    };
  } catch {
    return { detected: "unknown", confidence: 0, indicators: [], suggestions: [] };
  }
}

/** Platform-specific service suggestions for each detected platform. */
const PLATFORM_SUGGESTIONS: Record<PlatformKey, PlatformSuggestion[]> = {
  cloudflare: [
    {
      serviceName: "worker",
      serviceType: "cloudflare_worker",
      reason: "Cloudflare Worker for API endpoints",
    },
    {
      serviceName: "database",
      serviceType: "cloudflare_d1",
      reason: "D1 SQLite database instead of container",
    },
    {
      serviceName: "cache",
      serviceType: "cloudflare_kv",
      reason: "KV store instead of Redis container",
    },
    { serviceName: "storage", serviceType: "cloudflare_r2", reason: "R2 object storage for files" },
  ],
  vercel: [
    {
      serviceName: "api",
      serviceType: "vercel_function",
      reason: "Vercel Function for API routes",
    },
    {
      serviceName: "edge-api",
      serviceType: "vercel_edge_function",
      reason: "Edge Function for low-latency endpoints",
    },
    { serviceName: "cache", serviceType: "vercel_kv", reason: "Vercel KV for caching" },
    {
      serviceName: "database",
      serviceType: "vercel_postgres",
      reason: "Vercel Postgres instead of container",
    },
  ],
  supabase: [
    {
      serviceName: "database",
      serviceType: "supabase_database",
      reason: "Supabase PostgreSQL database",
    },
    {
      serviceName: "auth",
      serviceType: "supabase_auth",
      reason: "Supabase Authentication service",
    },
    {
      serviceName: "storage",
      serviceType: "supabase_storage",
      reason: "Supabase Storage for files",
    },
    {
      serviceName: "functions",
      serviceType: "supabase_functions",
      reason: "Supabase Edge Functions",
    },
  ],
};

/**
 * Generate service suggestions for a detected platform.
 * @param platform - Detected platform identifier
 * @returns Array of platform-specific service suggestions
 */
function generatePlatformSuggestions(platform: PlatformContext["detected"]): PlatformSuggestion[] {
  return PLATFORM_SUGGESTIONS[platform as PlatformKey] ?? [];
}

/** Default configuration for a platform service type. */
type ServiceDefaults = {
  platform: "cloudflare" | "vercel" | "supabase" | "kubernetes";
  workload: "deployment" | "statefulset" | "serverless" | "managed";
  runtime?: string;
  language?: string;
};

/** Return type for getPlatformServiceDefaults - all service defaults are optional */
export type PlatformServiceDefaultsResult = {
  artifactType: "external";
  platform?: "cloudflare" | "vercel" | "supabase" | "kubernetes";
  workload?: "deployment" | "statefulset" | "serverless" | "managed";
  runtime?: string;
  language?: string;
};

/** Service defaults mapping for each platform service type. */
const SERVICE_DEFAULTS: Record<string, ServiceDefaults> = {
  // Cloudflare services
  cloudflare_worker: { platform: "cloudflare", workload: "serverless", runtime: "worker" },
  cloudflare_durable_object: {
    platform: "cloudflare",
    workload: "serverless",
    runtime: "durable_object",
  },
  cloudflare_d1: { platform: "cloudflare", workload: "managed", language: "sql" },
  cloudflare_kv: { platform: "cloudflare", workload: "managed", language: "key-value" },
  cloudflare_r2: { platform: "cloudflare", workload: "managed", language: "object-storage" },
  // Vercel services
  vercel_function: { platform: "vercel", workload: "serverless", runtime: "nodejs18.x" },
  vercel_edge_function: { platform: "vercel", workload: "serverless", runtime: "edge-runtime" },
  vercel_kv: { platform: "vercel", workload: "managed", language: "key-value" },
  vercel_postgres: { platform: "vercel", workload: "managed", language: "sql" },
  // Supabase services
  supabase_database: { platform: "supabase", workload: "managed", language: "postgresql" },
  supabase_auth: { platform: "supabase", workload: "managed", language: "auth" },
  supabase_storage: { platform: "supabase", workload: "managed", language: "object-storage" },
  supabase_functions: { platform: "supabase", workload: "serverless", runtime: "deno" },
};

/**
 * Get platform-appropriate service configuration defaults.
 * @param serviceType - Platform service type identifier
 * @returns Service defaults with artifact type
 */
export function getPlatformServiceDefaults(
  serviceType: PlatformServiceType,
): PlatformServiceDefaultsResult {
  const config = SERVICE_DEFAULTS[serviceType];
  return config
    ? { artifactType: "external" as const, ...config }
    : { artifactType: "external" as const };
}
