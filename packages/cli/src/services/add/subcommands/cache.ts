import type { PlatformServiceType, ServiceConfig } from "../../../cue/index.js";
import { getPlatformServiceDefaults } from "../../../utils/platform-detection.js";

interface CacheServiceOptions {
  attachTo?: string;
  image?: string;
  port?: number;
  serviceType?: PlatformServiceType;
  platform?: "cloudflare" | "vercel" | "supabase" | "kubernetes";
  [key: string]: any;
}

interface CacheConfig {
  attachTo?: string;
  image?: string;
  port?: number;
  serviceType?: PlatformServiceType;
  platform?: "cloudflare" | "vercel" | "supabase" | "kubernetes";
}

const CACHE_DEFAULTS = {
  image: "redis:7-alpine",
  port: 6379,
  volumeSize: "10Gi",
} as const;

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

function normalizeCacheOptions(options: CacheServiceOptions): CacheConfig {
  return {
    attachTo: options.attachTo,
    image: options.image ?? (options.serviceType ? undefined : CACHE_DEFAULTS.image),
    port: options.port ?? (options.serviceType ? undefined : CACHE_DEFAULTS.port),
    serviceType: options.serviceType,
    platform: options.platform,
  };
}

function createCacheServiceConfig(config: CacheConfig): ServiceConfig {
  if (config.serviceType && config.serviceType !== "prebuilt") {
    const platformDefaults = getPlatformServiceDefaults(config.serviceType);
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

  return {
    type: "external",
    language: "container",
    workload: "deployment",
    image: config.image!,
    ports: [{ name: "cache", port: config.port!, targetPort: config.port! }],
    volumes: [{ name: "data", path: "/data", size: CACHE_DEFAULTS.volumeSize }],
  };
}

async function attachCacheToService(
  manipulator: any,
  content: string,
  cacheName: string,
  config: CacheConfig,
): Promise<string> {
  try {
    const ast = await manipulator.parse(content);
    if (ast.services?.[config.attachTo!]) {
      if (!ast.services[config.attachTo!].env) {
        ast.services[config.attachTo!].env = {};
      }

      let envVars: Record<string, string> = {};

      if (config.serviceType && config.serviceType !== "prebuilt") {
        envVars = generatePlatformCacheEnvVars(config.serviceType, cacheName);
      } else {
        envVars = { REDIS_URL: `redis://${cacheName}:${config.port}` };
      }

      Object.assign(ast.services[config.attachTo!].env, envVars);
      return await manipulator.serialize(ast, content);
    }
  } catch (error) {
    console.warn(`Could not add cache connection to service ${config.attachTo}`);
  }
  return content;
}

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
