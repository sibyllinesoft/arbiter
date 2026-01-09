/**
 * @packageDocumentation
 * Database utilities for CUE manipulation.
 *
 * Provides functionality to:
 * - Generate database connection strings
 * - Generate environment variables for databases
 * - Support platform-specific database configurations
 */

import { type DatabaseConfig, PLATFORM_DB_ENV_GENERATORS } from "../types.js";

/**
 * Generate database connection string
 */
export function generateDbConnectionString(image: string, dbName: string, port: number): string {
  if (!image) {
    throw new Error("generateDbConnectionString called with undefined image");
  }
  if (image.includes("postgres")) {
    return `postgresql://user:password@${dbName}:${port}/${dbName}`;
  }
  if (image.includes("mysql")) {
    return `mysql://user:password@${dbName}:${port}/${dbName}`;
  }
  return `db://${dbName}:${port}/${dbName}`;
}

/**
 * Generate platform-specific database environment variables
 */
export function generatePlatformDbEnvVars(
  serviceType: string,
  dbName: string,
): Record<string, string> {
  const generator = PLATFORM_DB_ENV_GENERATORS[serviceType];
  return generator ? generator(dbName) : { DATABASE_URL: `${serviceType}://${dbName}` };
}

/**
 * Generate database environment variables based on config
 */
export function generateDbEnvVars(config: DatabaseConfig, dbName: string): Record<string, string> {
  const isContainerBased = config.image || !config.serviceType || config.serviceType === "prebuilt";
  if (isContainerBased) {
    return {
      DATABASE_URL: generateDbConnectionString(
        config.image ?? "postgres",
        dbName,
        config.ports?.[0]?.port || 5432,
      ),
    };
  }
  return generatePlatformDbEnvVars(config.serviceType!, dbName);
}
