/**
 * @packageDocumentation
 * Cache subcommand module - Handles adding cache services to CUE specifications.
 *
 * This module supports various cache backends:
 * - Container-based Redis (default)
 * - Upstash Redis (serverless)
 * - Cloudflare KV
 * - Vercel KV
 */

import type { PlatformServiceType, ServiceConfig } from "@/cue/index.js";
import { getPlatformServiceDefaults } from "@/utils/util/core/platform-detection.js";

/** Options for configuring a cache service */
interface CacheServiceOptions {
  attachTo?: string;
  image?: string;
  port?: number;
  serviceType?: PlatformServiceType;
  platform?: "cloudflare" | "vercel" | "supabase" | "kubernetes";
  [key: string]: any;
}

/** Internal normalized cache configuration */
interface CacheConfig {
  attachTo?: string;
  image?: string;
  port?: number;
  serviceType?: PlatformServiceType;
  platform?: "cloudflare" | "vercel" | "supabase" | "kubernetes";
}

/** Default values for cache service configuration */
const CACHE_DEFAULTS = {
  image: "redis:7-alpine",
  port: 6379,
  volumeSize: "10Gi",
} as const;

/**
 * Add a cache service to the CUE specification.
 * @param manipulator - CUE file manipulator instance
 * @param content - Current CUE file content
 * @param cacheName - Name for the cache service
 * @param options - Cache configuration options
 * @returns Updated CUE file content
 */
export async function addCache(
  manipulator: any,
  content: string,
  cacheName: string,
  options: CacheServiceOptions,
): Promise<string> {
  const cacheConfig = normalizeCacheOptions(options);
  const serviceConfig = createCacheServiceConfig(cacheConfig);

  let updatedContent = await manipulator.addService(content, cacheName, serviceConfig);

  if (cacheConfig.attachTo) {
    updatedContent = await attachCacheToService(
      manipulator,
      updatedContent,
      cacheName,
      cacheConfig,
    );
  }

  return updatedContent;
}

/**
 * Normalize cache service options with defaults.
 * @param options - User-provided cache options
 * @returns Normalized cache configuration
 */
function normalizeCacheOptions(options: CacheServiceOptions): CacheConfig {
  return {
    attachTo: options.attachTo,
    image: options.image ?? (options.serviceType ? undefined : CACHE_DEFAULTS.image),
    port: options.port ?? (options.serviceType ? undefined : CACHE_DEFAULTS.port),
    serviceType: options.serviceType,
    platform: options.platform,
  };
}

/**
 * Create platform-based cache service configuration.
 */
function createPlatformCacheConfig(
  config: CacheConfig,
  platformDefaults: ReturnType<typeof getPlatformServiceDefaults>,
): ServiceConfig {
  return {
    serviceType: config.serviceType,
    type: platformDefaults.artifactType || "external",
    language: platformDefaults.language || "key-value",
    workload: platformDefaults.workload || "managed",
    ...(platformDefaults.platform && { platform: platformDefaults.platform }),
    ...(platformDefaults.runtime && { runtime: platformDefaults.runtime }),
    ...(config.attachTo && { attachTo: config.attachTo }),
  };
}

/**
 * Create container-based cache service configuration.
 */
function createContainerCacheConfig(config: CacheConfig): ServiceConfig {
  return {
    type: "external",
    language: "container",
    workload: "deployment",
    image: config.image!,
    ports: [{ name: "cache", port: config.port!, targetPort: config.port! }],
    volumes: [{ name: "data", path: "/data", size: CACHE_DEFAULTS.volumeSize }],
  };
}

/**
 * Create a service configuration for the cache.
 * @param config - Normalized cache configuration
 * @returns Service configuration object
 */
function createCacheServiceConfig(config: CacheConfig): ServiceConfig {
  if (config.serviceType && config.serviceType !== "prebuilt") {
    const platformDefaults = getPlatformServiceDefaults(config.serviceType);
    return createPlatformCacheConfig(config, platformDefaults);
  }
  return createContainerCacheConfig(config);
}

/**
 * Attach cache environment variables to a service.
 * @param manipulator - CUE file manipulator instance
 * @param content - Current CUE file content
 * @param cacheName - Name of the cache service
 * @param config - Cache configuration
 * @returns Updated CUE file content
 */
function resolveCacheEnvVars(cacheName: string, config: CacheConfig): Record<string, string> {
  if (config.serviceType && config.serviceType !== "prebuilt") {
    return generatePlatformCacheEnvVars(config.serviceType, cacheName);
  }
  return { REDIS_URL: `redis://${cacheName}:${config.port}` };
}

async function attachCacheToService(
  manipulator: any,
  content: string,
  cacheName: string,
  config: CacheConfig,
): Promise<string> {
  try {
    const ast = await manipulator.parse(content);
    const targetService = ast.services?.[config.attachTo!];
    if (!targetService) {
      return content;
    }

    if (!targetService.env) {
      targetService.env = {};
    }

    Object.assign(targetService.env, resolveCacheEnvVars(cacheName, config));
    return await manipulator.serialize(ast, content);
  } catch {
    console.warn(`Could not add cache connection to service ${config.attachTo}`);
    return content;
  }
}

/**
 * Generate platform-specific environment variables for cache connectivity.
 * @param serviceType - Platform service type
 * @param cacheName - Name of the cache service
 * @returns Environment variable key-value pairs
 */
function generatePlatformCacheEnvVars(
  serviceType: PlatformServiceType,
  cacheName: string,
): Record<string, string> {
  switch (serviceType) {
    case "upstash_redis":
      return {
        UPSTASH_REDIS_REST_URL: `https://us1-${cacheName}.upstash.io`,
        UPSTASH_REDIS_REST_TOKEN: `${cacheName}_token`,
        UPSTASH_REDIS_TLS_URL: `rediss://us1-${cacheName}.upstash.io:6379`,
        CACHE_URL: `upstash://${cacheName}`,
      };
    case "cloudflare_kv":
      return {
        CLOUDFLARE_ACCOUNT_ID: "your-account-id",
        CLOUDFLARE_NAMESPACE_ID: `${cacheName}-namespace`,
        CACHE_URL: `cloudflare-kv://${cacheName}`,
      };
    case "vercel_kv":
      return {
        KV_REST_API_URL: `https://${cacheName}.kv.vercel-storage.com`,
        KV_REST_API_TOKEN: `${cacheName}_token`,
        KV_URL: `redis://${cacheName}`,
        CACHE_URL: `vercel-kv://${cacheName}`,
      };
    default:
      return {
        CACHE_URL: `${serviceType}://${cacheName}`,
      };
  }
}
