import path from "node:path";
import chalk from "chalk";
import type { DatabaseConfig, PlatformServiceType } from "../../../cue/index.js";
import {
  type TemplateContext,
  buildTemplateContext,
  templateOrchestrator,
} from "../../../templates/index.js";
import { getPlatformServiceDefaults } from "../../../utils/platform-detection.js";
import { validateTemplateExistsSync } from "../template-engine.js";

interface DatabaseAddOptions {
  attachTo?: string;
  image?: string;
  port?: number;
  template?: string;
  serviceType?: PlatformServiceType;
  platform?: "cloudflare" | "vercel" | "supabase" | "kubernetes";
  [key: string]: any;
}

interface NormalizedDatabaseOptions {
  attachTo?: string;
  image: string;
  port: number;
  template?: string;
  serviceType?: PlatformServiceType;
  platform?: "cloudflare" | "vercel" | "supabase" | "kubernetes";
}

const DATABASE_DEFAULTS = {
  image: "postgres:15",
  port: 5432,
  volumeSize: "50Gi",
} as const;

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

function createDatabaseConfiguration(
  dbName: string,
  options: NormalizedDatabaseOptions,
): DatabaseConfig {
  if (options.serviceType && options.serviceType !== "prebuilt") {
    const platformDefaults = getPlatformServiceDefaults(options.serviceType);
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

interface VolumeConfig {
  name: string;
  path: string;
  size: string;
  type: string;
}

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
