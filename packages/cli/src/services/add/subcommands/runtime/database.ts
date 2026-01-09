/**
 * @packageDocumentation
 * Database subcommand module - Handles adding database services to CUE specifications.
 *
 * Supports various database backends:
 * - PostgreSQL (default container)
 * - MySQL container
 * - Platform-managed databases (Supabase, PlanetScale, Neon)
 */

import path from "node:path";
import type { DatabaseConfig, PlatformServiceType } from "@/cue/index.js";
import { validateTemplateExistsSync } from "@/services/add/template-engine.js";
import {
  type TemplateContext,
  buildTemplateContext,
  templateOrchestrator,
} from "@/templates/index.js";
import { getPlatformServiceDefaults } from "@/utils/util/core/platform-detection.js";
import chalk from "chalk";

/** Options for database service configuration */
interface DatabaseAddOptions {
  attachTo?: string;
  image?: string;
  port?: number;
  template?: string;
  serviceType?: PlatformServiceType;
  platform?: "cloudflare" | "vercel" | "supabase" | "kubernetes";
  [key: string]: any;
}

/** Internal normalized database configuration */
interface NormalizedDatabaseOptions {
  attachTo?: string;
  image: string;
  port: number;
  template?: string;
  serviceType?: PlatformServiceType;
  platform?: "cloudflare" | "vercel" | "supabase" | "kubernetes";
}

/** Default values for database service configuration */
const DATABASE_DEFAULTS = {
  image: "postgres:15",
  port: 5432,
  volumeSize: "50Gi",
} as const;

/**
 * Add a database service to the CUE specification.
 * @param manipulator - CUE file manipulator instance
 * @param content - Current CUE file content
 * @param dbName - Name for the database service
 * @param options - Database configuration options
 * @returns Updated CUE file content
 */
export async function addDatabase(
  manipulator: any,
  content: string,
  dbName: string,
  options: DatabaseAddOptions,
): Promise<string> {
  const dbOptions = normalizeDatabaseOptions(options);

  if (dbOptions.template) {
    await handleTemplateBasedDatabaseCreation(dbName, content, dbOptions);
  }

  const dbConfig = createDatabaseConfiguration(dbName, dbOptions);
  return await manipulator.addDatabase(content, dbName, dbConfig);
}

/**
 * Normalize database options with defaults.
 * @param options - User-provided database options
 * @returns Normalized database configuration
 */
function normalizeDatabaseOptions(options: DatabaseAddOptions): NormalizedDatabaseOptions {
  return {
    attachTo: options.attachTo,
    image: options.image ?? DATABASE_DEFAULTS.image,
    port: options.port ?? DATABASE_DEFAULTS.port,
    template: options.template,
    serviceType: options.serviceType,
    platform: options.platform,
  };
}

/**
 * Handle database creation using a template.
 * @param dbName - Database name
 * @param content - Current CUE file content
 * @param options - Normalized database options
 */
async function handleTemplateBasedDatabaseCreation(
  dbName: string,
  content: string,
  options: NormalizedDatabaseOptions,
): Promise<void> {
  try {
    await templateOrchestrator.loadConfig();

    validateTemplateExistsSync(options.template!);

    console.log(
      chalk.blue(`🔧 Generating database '${dbName}' using template '${options.template}'`),
    );

    const context = await buildDatabaseTemplateContext(content, dbName, options);
    const targetDir = `./database/${dbName}`;

    await templateOrchestrator.executeTemplate(options.template!, path.resolve(targetDir), context);

    console.log(
      chalk.green(`✅ Database template '${options.template}' applied to '${targetDir}'`),
    );
  } catch (error) {
    throw new Error(
      `Database template generation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Build template context for database generation.
 * @param content - Current CUE file content
 * @param dbName - Database name
 * @param options - Normalized database options
 * @returns Template context object
 */
async function buildDatabaseTemplateContext(
  content: string,
  dbName: string,
  options: NormalizedDatabaseOptions,
): Promise<TemplateContext> {
  const fallback: Record<string, unknown> = {
    name: dbName,
    kind: "database",
    ports: [{ name: "db", port: options.port, targetPort: options.port }],
  };

  return await buildTemplateContext(content, {
    artifactName: dbName,
    artifactFallback: fallback,
    impl: {
      databaseName: dbName,
      attachTo: options.attachTo,
      image: options.image,
      port: options.port,
      serviceType: options.serviceType,
      platform: options.platform,
    },
  });
}

function createPlatformDatabaseConfig(
  options: NormalizedDatabaseOptions,
  platformDefaults: ReturnType<typeof getPlatformServiceDefaults>,
): DatabaseConfig {
  return {
    serviceType: options.serviceType,
    type: platformDefaults.artifactType || "external",
    language: platformDefaults.language || "sql",
    workload: platformDefaults.workload || "managed",
    ...(platformDefaults.platform && { platform: platformDefaults.platform }),
    ...(platformDefaults.runtime && { runtime: platformDefaults.runtime }),
    ...(options.attachTo && { attachTo: options.attachTo }),
  };
}

function createContainerDatabaseConfig(
  dbName: string,
  options: NormalizedDatabaseOptions,
): DatabaseConfig {
  return {
    type: "external",
    language: "container",
    workload: "statefulset",
    image: options.image,
    ports: [{ name: "db", port: options.port, targetPort: options.port }],
    volumes: [createDatabaseVolume(options.image)],
    env: generateDbEnvVars(options.image, dbName),
    ...(options.attachTo && { attachTo: options.attachTo }),
  };
}

/**
 * Create a database configuration object.
 * @param dbName - Database name
 * @param options - Normalized database options
 * @returns Database configuration
 */
function createDatabaseConfiguration(
  dbName: string,
  options: NormalizedDatabaseOptions,
): DatabaseConfig {
  if (options.serviceType && options.serviceType !== "prebuilt") {
    const platformDefaults = getPlatformServiceDefaults(options.serviceType);
    return createPlatformDatabaseConfig(options, platformDefaults);
  }
  return createContainerDatabaseConfig(dbName, options);
}

/**
 * Create a volume configuration for the database.
 * @param image - Database container image
 * @returns Volume configuration
 */
function createDatabaseVolume(image: string): VolumeConfig {
  if (!image) {
    return {
      name: "data",
      path: "/var/lib/data",
      size: DATABASE_DEFAULTS.volumeSize,
      type: "persistentVolumeClaim",
    };
  }

  const dataPath = image.includes("postgres") ? "/var/lib/postgresql/data" : "/var/lib/mysql";

  return {
    name: "data",
    path: dataPath,
    size: DATABASE_DEFAULTS.volumeSize,
    type: "persistentVolumeClaim",
  };
}

/** Volume configuration for database storage */
interface VolumeConfig {
  name: string;
  path: string;
  size: string;
  type: string;
}

/**
 * Generate environment variables for database connectivity.
 * @param image - Database container image
 * @param dbName - Database name
 * @returns Environment variable key-value pairs
 */
function generateDbEnvVars(image: string, dbName: string): Record<string, string> {
  if (image.includes("mysql")) {
    return {
      MYSQL_DATABASE: dbName,
      MYSQL_USER: `${dbName}_user`,
      MYSQL_PASSWORD: `${dbName}_password`,
      MYSQL_ROOT_PASSWORD: `${dbName}_root`,
      DATABASE_URL: `mysql://$MYSQL_USER:$MYSQL_PASSWORD@${dbName}:3306/${dbName}`,
    };
  }

  return {
    POSTGRES_DB: dbName,
    POSTGRES_USER: `${dbName}_user`,
    POSTGRES_PASSWORD: `${dbName}_password`,
    DATABASE_URL: `postgres://$POSTGRES_USER:$POSTGRES_PASSWORD@${dbName}:5432/${dbName}`,
  };
}
