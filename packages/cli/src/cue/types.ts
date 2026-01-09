/**
 * CUE Manipulation Types
 *
 * Type definitions and configuration interfaces for CUE file manipulation.
 */

type EnvVarGenerator = (dbName: string) => Record<string, string>;

/**
 * Platform-specific database environment variable generators
 */
export const PLATFORM_DB_ENV_GENERATORS: Record<string, EnvVarGenerator> = {
  cloudflare_d1: (dbName) => ({
    D1_DATABASE_ID: `${dbName}_id`,
    D1_DATABASE_NAME: dbName,
    DATABASE_URL: `d1://${dbName}`,
  }),
  cloudflare_kv: (dbName) => ({
    KV_NAMESPACE_ID: `${dbName}_namespace_id`,
    KV_BINDING_NAME: dbName.toUpperCase(),
  }),
  vercel_postgres: (dbName) => ({
    POSTGRES_URL: `postgres://${dbName}`,
    POSTGRES_PRISMA_URL: `postgres://${dbName}?pgbouncer=true`,
    POSTGRES_URL_NON_POOLING: `postgres://${dbName}`,
  }),
  vercel_kv: (dbName) => ({
    KV_REST_API_URL: `https://${dbName}.kv.vercel-storage.com`,
    KV_REST_API_TOKEN: `${dbName}_token`,
    KV_URL: `redis://${dbName}`,
  }),
  supabase_database: (dbName) => ({
    SUPABASE_URL: `https://${dbName}.supabase.co`,
    SUPABASE_ANON_KEY: `${dbName}_anon_key`,
    SUPABASE_SERVICE_ROLE_KEY: `${dbName}_service_role_key`,
    DATABASE_URL: `postgresql://${dbName}`,
  }),
};

/**
 * Platform-specific service types for popular cloud providers
 */
export type PlatformServiceType =
  // Generic types
  | "bespoke"
  | "prebuilt"
  | "upstash_redis"
  // Cloudflare platform
  | "cloudflare_worker"
  | "cloudflare_d1"
  | "cloudflare_kv"
  | "cloudflare_r2"
  | "cloudflare_durable_object"
  // Vercel platform
  | "vercel_function"
  | "vercel_edge_function"
  | "vercel_kv"
  | "vercel_postgres"
  | "vercel_blob"
  // Supabase platform
  | "supabase_database"
  | "supabase_auth"
  | "supabase_storage"
  | "supabase_functions"
  | "supabase_realtime";

/**
 * Infrastructure service types - databases, caches, queues, and load balancers
 * are all services with an additional infrastructureType field
 */
export type InfrastructureType = "database" | "cache" | "queue" | "load-balancer";

/**
 * Configuration for a service in the CUE specification
 */
export interface ServiceConfig {
  serviceType?: PlatformServiceType;
  /** Infrastructure type for databases, caches, queues, and load balancers */
  infrastructureType?: InfrastructureType;
  type: "internal" | "external";
  language: string;
  workload?: "deployment" | "statefulset" | "serverless" | "managed";
  sourceDirectory?: string;
  image?: string;
  // Platform-specific configurations
  platform?: "cloudflare" | "vercel" | "supabase" | "kubernetes";
  runtime?: string; // e.g., "durable_object", "edge", "nodejs18"
  region?: string;
  // Standard configurations
  ports?: Array<{
    name: string;
    port: number;
    targetPort: number;
  }>;
  volumes?: Array<{
    name: string;
    path: string;
    size?: string;
    type?: string;
  }>;
  env?: Record<string, string>;
  healthCheck?: {
    path: string;
    port: number;
  };
  template?: string;
  /** Service to attach this infrastructure to */
  attachTo?: string;
  /** Target service for load balancer */
  target?: string;
}

/**
 * Configuration for an API endpoint
 */
export interface EndpointConfig {
  service: string;
  path: string;
  method: string;
  summary?: string;
  description?: string;
  implements?: string;
  endpointId?: string;
  handler?: {
    type: "module" | "endpoint";
    module?: string;
    function?: string;
    service?: string;
    endpoint?: string;
  };
  request?: {
    $ref: string;
  };
  response?: {
    $ref: string;
  };
}

/**
 * @deprecated Use ServiceConfig with infrastructureType: "database" instead.
 * Databases are now services with an infrastructureType field.
 */
export type DatabaseConfig = ServiceConfig;

/**
 * Configuration for a UI route
 */
export interface RouteConfig {
  id: string;
  path: string;
  capabilities: string[];
  components?: string[];
}

/**
 * Configuration for a user flow
 */
export interface FlowConfig {
  id: string;
  steps: Array<any>;
}

/**
 * Result of CUE validation
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
