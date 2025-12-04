/**
 * Platform Detection Utilities for Smart Service Configuration
 *
 * Automatically detects platform context from project structure and suggests
 * appropriate service types for Cloudflare, Vercel, and Supabase platforms.
 */

import path from "node:path";
import type { PlatformServiceType } from "@/cue/index.js";
import fs from "fs-extra";

export interface PlatformContext {
  detected: "cloudflare" | "vercel" | "supabase" | "kubernetes" | "unknown";
  confidence: number; // 0-1 score
  indicators: string[];
  suggestions: PlatformSuggestion[];
}

export interface PlatformSuggestion {
  serviceName: string;
  serviceType: PlatformServiceType;
  reason: string;
}

/**
 * Detect platform context from project structure and files
 */
export async function detectPlatform(projectDir = "."): Promise<PlatformContext> {
  const indicators: string[] = [];
  let cloudflareScore = 0;
  let vercelScore = 0;
  let supabaseScore = 0;

  try {
    // Check for Cloudflare indicators
    if (await fs.pathExists(path.join(projectDir, "wrangler.toml"))) {
      cloudflareScore += 0.8;
      indicators.push("wrangler.toml found");
    }

    if (await fs.pathExists(path.join(projectDir, "workers"))) {
      cloudflareScore += 0.6;
      indicators.push("workers/ directory found");
    }

    // Check for Vercel indicators
    if (await fs.pathExists(path.join(projectDir, "vercel.json"))) {
      vercelScore += 0.8;
      indicators.push("vercel.json found");
    }

    if (await fs.pathExists(path.join(projectDir, ".vercel"))) {
      vercelScore += 0.4;
      indicators.push(".vercel/ directory found");
    }

    if (await fs.pathExists(path.join(projectDir, "api"))) {
      vercelScore += 0.3;
      indicators.push("api/ directory found");
    }

    // Check for Supabase indicators
    if (await fs.pathExists(path.join(projectDir, "supabase"))) {
      supabaseScore += 0.7;
      indicators.push("supabase/ directory found");
    }

    if (await fs.pathExists(path.join(projectDir, ".env"))) {
      const envContent = await fs.readFile(path.join(projectDir, ".env"), "utf-8");
      if (envContent.includes("SUPABASE")) {
        supabaseScore += 0.5;
        indicators.push("SUPABASE env vars found");
      }
      if (envContent.includes("CLOUDFLARE")) {
        cloudflareScore += 0.3;
        indicators.push("CLOUDFLARE env vars found");
      }
      if (envContent.includes("VERCEL")) {
        vercelScore += 0.3;
        indicators.push("VERCEL env vars found");
      }
    }

    // Check package.json for platform-specific dependencies
    const packageJsonPath = path.join(projectDir, "package.json");
    if (await fs.pathExists(packageJsonPath)) {
      const packageJson = await fs.readJson(packageJsonPath);
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      if (deps["@cloudflare/workers-types"] || deps.wrangler) {
        cloudflareScore += 0.4;
        indicators.push("Cloudflare dependencies found");
      }

      if (deps["@vercel/node"] || deps.vercel) {
        vercelScore += 0.4;
        indicators.push("Vercel dependencies found");
      }

      if (deps["@supabase/supabase-js"] || deps.supabase) {
        supabaseScore += 0.4;
        indicators.push("Supabase dependencies found");
      }
    }
  } catch (error) {
    // Ignore file system errors
  }

  // Determine the detected platform
  const maxScore = Math.max(cloudflareScore, vercelScore, supabaseScore);
  let detected: PlatformContext["detected"] = "unknown";

  if (maxScore >= 0.5) {
    if (cloudflareScore === maxScore) detected = "cloudflare";
    else if (vercelScore === maxScore) detected = "vercel";
    else if (supabaseScore === maxScore) detected = "supabase";
  } else if (maxScore > 0) {
    detected = "kubernetes"; // Default to Kubernetes if some indicators but low confidence
  }

  const suggestions = generatePlatformSuggestions(detected, projectDir);

  return {
    detected,
    confidence: maxScore,
    indicators,
    suggestions,
  };
}

/**
 * Generate platform-specific service suggestions based on detected platform
 */
function generatePlatformSuggestions(
  platform: PlatformContext["detected"],
  projectDir: string,
): PlatformSuggestion[] {
  const suggestions: PlatformSuggestion[] = [];

  switch (platform) {
    case "cloudflare":
      suggestions.push(
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
        {
          serviceName: "storage",
          serviceType: "cloudflare_r2",
          reason: "R2 object storage for files",
        },
      );
      break;

    case "vercel":
      suggestions.push(
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
        {
          serviceName: "cache",
          serviceType: "vercel_kv",
          reason: "Vercel KV for caching",
        },
        {
          serviceName: "database",
          serviceType: "vercel_postgres",
          reason: "Vercel Postgres instead of container",
        },
      );
      break;

    case "supabase":
      suggestions.push(
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
      );
      break;
  }

  return suggestions;
}

/**
 * Get platform-appropriate service configuration defaults
 */
export function getPlatformServiceDefaults(serviceType: PlatformServiceType) {
  const defaults: Partial<{
    platform?: "cloudflare" | "vercel" | "supabase" | "kubernetes";
    workload?: "deployment" | "statefulset" | "serverless" | "managed";
    runtime?: string;
    language?: string;
    artifactType?: "internal" | "external";
  }> = { artifactType: "external" };

  switch (serviceType) {
    // Cloudflare services
    case "cloudflare_worker":
      defaults.platform = "cloudflare";
      defaults.workload = "serverless";
      defaults.runtime = "worker";
      break;

    case "cloudflare_durable_object":
      defaults.platform = "cloudflare";
      defaults.workload = "serverless";
      defaults.runtime = "durable_object";
      break;

    case "cloudflare_d1":
      defaults.platform = "cloudflare";
      defaults.workload = "managed";
      defaults.language = "sql";
      break;

    case "cloudflare_kv":
      defaults.platform = "cloudflare";
      defaults.workload = "managed";
      defaults.language = "key-value";
      break;

    case "cloudflare_r2":
      defaults.platform = "cloudflare";
      defaults.workload = "managed";
      defaults.language = "object-storage";
      break;

    // Vercel services
    case "vercel_function":
      defaults.platform = "vercel";
      defaults.workload = "serverless";
      defaults.runtime = "nodejs18.x";
      break;

    case "vercel_edge_function":
      defaults.platform = "vercel";
      defaults.workload = "serverless";
      defaults.runtime = "edge-runtime";
      break;

    case "vercel_kv":
      defaults.platform = "vercel";
      defaults.workload = "managed";
      defaults.language = "key-value";
      break;

    case "vercel_postgres":
      defaults.platform = "vercel";
      defaults.workload = "managed";
      defaults.language = "sql";
      break;

    // Supabase services
    case "supabase_database":
      defaults.platform = "supabase";
      defaults.workload = "managed";
      defaults.language = "postgresql";
      break;

    case "supabase_auth":
      defaults.platform = "supabase";
      defaults.workload = "managed";
      defaults.language = "auth";
      break;

    case "supabase_storage":
      defaults.platform = "supabase";
      defaults.workload = "managed";
      defaults.language = "object-storage";
      break;

    case "supabase_functions":
      defaults.platform = "supabase";
      defaults.workload = "serverless";
      defaults.runtime = "deno";
      break;
  }

  return defaults;
}
