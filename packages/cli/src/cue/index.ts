/**
 * CUE Manipulation Abstraction Layer
 *
 * This module provides a proper AST-based approach to CUE file manipulation,
 * replacing fragile string concatenation with validated CUE tool integration.
 *
 * Key Features:
 * - Parse CUE files using the CUE tool
 * - Manipulate CUE structures through JSON intermediate representation
 * - Format and validate using official CUE tooling
 * - Type-safe operations with proper error handling
 */

import * as os from "node:os";
import path from "node:path";
import { CueRunner } from "@arbiter/cue-runner";
import fs from "fs-extra";

/**
 * Platform-specific service types for popular cloud providers
 */
export type PlatformServiceType =
  // Generic types
  | "bespoke"
  | "prebuilt"
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
 * Configuration for a service in the CUE specification
 */
export interface ServiceConfig {
  serviceType: PlatformServiceType;
  language: string;
  type: "deployment" | "statefulset" | "serverless" | "managed";
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
}

/**
 * Configuration for an API endpoint
 */
export interface EndpointConfig {
  method: string;
  request?: {
    $ref: string;
  };
  response?: {
    $ref: string;
  };
}

/**
 * Configuration for a database service
 */
export interface DatabaseConfig extends ServiceConfig {
  attachTo?: string;
}

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

/**
 * Main CUE manipulator class providing AST-based operations
 */
export class CUEManipulator {
  private tempDir: string;

  constructor() {
    this.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cue-manipulator-"));
  }

  /**
   * Parse CUE content into a JavaScript object using the CUE tool
   */
  async parse(content: string): Promise<any> {
    const tempFile = path.join(this.tempDir, "input.cue");
    await fs.writeFile(tempFile, content);

    try {
      const runner = this.createRunner();
      const exportResult = await runner.exportJson([tempFile]);

      if (exportResult.success && exportResult.value) {
        return exportResult.value;
      }

      const firstDiagnostic = exportResult.diagnostics[0];
      const reason = firstDiagnostic?.message || exportResult.error || "Unknown CUE export error";
      throw new Error(reason);
    } catch (error) {
      throw new Error(`Failed to parse CUE content: ${error}`);
    }
  }

  /**
   * Add a service to the CUE structure
   */
  async addService(content: string, serviceName: string, config: ServiceConfig): Promise<string> {
    try {
      // Parse existing content
      const ast = await this.parse(content);

      // Ensure services section exists
      if (!ast.services) {
        ast.services = {};
      }

      // Add the service
      ast.services[serviceName] = config;

      // Convert back to CUE and format
      return await this.serialize(ast, content);
    } catch (error) {
      // Fallback to direct manipulation if parsing fails (for incomplete CUE)
      return this.directServiceAdd(content, serviceName, config);
    }
  }

  /**
   * Add an endpoint to the CUE structure
   */
  async addEndpoint(content: string, endpoint: string, config: EndpointConfig): Promise<string> {
    try {
      const ast = await this.parse(content);

      // Ensure paths section exists
      if (!ast.paths) {
        ast.paths = {};
      }

      // Add the endpoint
      ast.paths[endpoint] = {
        [config.method.toLowerCase()]: {
          ...(config.request && { request: config.request }),
          ...(config.response && { response: config.response }),
        },
      };

      return await this.serialize(ast, content);
    } catch (error) {
      return this.directEndpointAdd(content, endpoint, config);
    }
  }

  /**
   * Add a database to the CUE structure
   */
  async addDatabase(content: string, dbName: string, config: DatabaseConfig): Promise<string> {
    try {
      const ast = await this.parse(content);

      // Ensure services section exists
      if (!ast.services) {
        ast.services = {};
      }

      // Add the database service
      ast.services[dbName] = config;

      // If attaching to another service, add connection environment variables
      if (config.attachTo && ast.services[config.attachTo]) {
        if (!ast.services[config.attachTo].env) {
          ast.services[config.attachTo].env = {};
        }

        // Generate connection string based on service type
        if (config.image) {
          // Container-based database
          const connectionString = this.generateDbConnectionString(
            config.image,
            dbName,
            config.ports?.[0]?.port || 5432,
          );
          ast.services[config.attachTo].env.DATABASE_URL = connectionString;
        } else if (config.serviceType && config.serviceType !== "prebuilt") {
          // Platform-managed database - generate appropriate env vars
          const envVars = this.generatePlatformDbEnvVars(config.serviceType, dbName);
          Object.assign(ast.services[config.attachTo].env, envVars);
        }
      }

      return await this.serialize(ast, content);
    } catch (error) {
      return this.directDatabaseAdd(content, dbName, config);
    }
  }

  /**
   * Add a route to the UI routes array
   */
  async addRoute(content: string, route: RouteConfig): Promise<string> {
    try {
      const ast = await this.parse(content);

      // Ensure ui.routes exists
      if (!ast.ui) {
        ast.ui = {};
      }
      if (!ast.ui.routes) {
        ast.ui.routes = [];
      }

      // Add the route
      ast.ui.routes.push(route);

      return await this.serialize(ast, content);
    } catch (error) {
      return this.directRouteAdd(content, route);
    }
  }

  /**
   * Add a flow to the flows array
   */
  async addFlow(content: string, flow: FlowConfig): Promise<string> {
    try {
      const ast = await this.parse(content);

      // Ensure flows exists
      if (!ast.flows) {
        ast.flows = [];
      }

      // Add the flow
      ast.flows.push(flow);

      return await this.serialize(ast, content);
    } catch (error) {
      return this.directFlowAdd(content, flow);
    }
  }

  /**
   * Add a key-value pair to a specific section
   */
  async addToSection(content: string, section: string, key: string, value: any): Promise<string> {
    try {
      const ast = await this.parse(content);

      // Navigate to the section (support nested sections like "components.schemas")
      const sections = section.split(".");
      let current = ast;

      for (const sec of sections) {
        if (!current[sec]) {
          current[sec] = {};
        }
        current = current[sec];
      }

      // Add the key-value pair
      current[key] = value;

      return await this.serialize(ast, content);
    } catch (error) {
      return this.directSectionAdd(content, section, key, value);
    }
  }

  /**
   * Remove a service from the specification
   */
  async removeService(content: string, serviceName: string): Promise<string> {
    try {
      const ast = await this.parse(content);
      if (!ast.services || !Object.prototype.hasOwnProperty.call(ast.services, serviceName)) {
        return content;
      }

      delete ast.services[serviceName];

      if (ast.services && Object.keys(ast.services).length === 0) {
        delete ast.services;
      }

      return await this.serialize(ast, content);
    } catch {
      return content;
    }
  }

  /**
   * Remove an endpoint or method from the specification
   */
  async removeEndpoint(content: string, endpoint: string, method?: string): Promise<string> {
    try {
      const ast = await this.parse(content);
      if (!ast.paths || !ast.paths[endpoint]) {
        return content;
      }

      if (method) {
        const methodKey = method.toLowerCase();
        if (!ast.paths[endpoint][methodKey]) {
          return content;
        }
        delete ast.paths[endpoint][methodKey];
        if (Object.keys(ast.paths[endpoint]).length === 0) {
          delete ast.paths[endpoint];
        }
      } else {
        delete ast.paths[endpoint];
      }

      if (ast.paths && Object.keys(ast.paths).length === 0) {
        delete ast.paths;
      }

      return await this.serialize(ast, content);
    } catch {
      return content;
    }
  }

  /**
   * Remove an item from an array-based section
   */
  async removeFromArray(
    content: string,
    section: string,
    predicate: (item: any) => boolean,
  ): Promise<string> {
    try {
      const ast = await this.parse(content);
      const segments = section.split(".");
      let parent: any = ast;

      for (let i = 0; i < segments.length - 1; i += 1) {
        const segment = segments[i];
        if (!parent || typeof parent !== "object" || !(segment in parent)) {
          return content;
        }
        parent = parent[segment];
      }

      const key = segments[segments.length - 1];
      const target = parent?.[key];
      if (!Array.isArray(target)) {
        return content;
      }

      const filtered = target.filter((item: any) => !predicate(item));
      if (filtered.length === target.length) {
        return content;
      }

      parent[key] = filtered;

      if (Array.isArray(parent[key]) && parent[key].length === 0) {
        this.cleanupEmptyContainers(segments, ast);
      }

      return await this.serialize(ast, content);
    } catch {
      return content;
    }
  }

  /**
   * Remove a UI route by identifier
   */
  async removeRoute(content: string, identifier: { id?: string; path?: string }): Promise<string> {
    const hasIdentifier = Boolean(identifier.id || identifier.path);
    if (!hasIdentifier) {
      return content;
    }

    return await this.removeFromArray(content, "ui.routes", (route) => {
      const matchesId = identifier.id ? route.id === identifier.id : false;
      const matchesPath = identifier.path ? route.path === identifier.path : false;

      if (identifier.id && identifier.path) {
        return matchesId || matchesPath;
      }
      if (identifier.id) {
        return matchesId;
      }
      return matchesPath;
    });
  }

  /**
   * Remove a flow by identifier
   */
  async removeFlow(content: string, flowId: string): Promise<string> {
    if (!flowId) {
      return content;
    }

    return await this.removeFromArray(content, "flows", (flow) => flow.id === flowId);
  }

  /**
   * Remove a key from a specific section
   */
  async removeFromSection(content: string, section: string, key: string): Promise<string> {
    try {
      const ast = await this.parse(content);
      const segments = section.split(".");
      const pathStack: Array<{ parent: any; key: string }> = [];
      let current: any = ast;

      for (const segment of segments) {
        if (!current || typeof current !== "object" || !(segment in current)) {
          return content;
        }
        pathStack.push({ parent: current, key: segment });
        current = current[segment];
      }

      if (!current || typeof current !== "object" || !(key in current)) {
        return content;
      }

      delete current[key];

      if (typeof current === "object" && current && Object.keys(current).length === 0) {
        this.cleanupEmptyContainers(
          pathStack.map(({ key }) => key),
          ast,
        );
      }

      return await this.serialize(ast, content);
    } catch {
      return content;
    }
  }

  /**
   * Serialize a JavaScript object back to formatted CUE
   */
  async serialize(ast: any, originalContent?: string): Promise<string> {
    try {
      // Extract package declaration from original content if available
      let packageDeclaration = "package main";
      if (originalContent) {
        const packageMatch = originalContent.match(/package\s+(\w+)/);
        if (packageMatch) {
          packageDeclaration = `package ${packageMatch[1]}`;
        }
      }

      // Use manual CUE formatting for better control
      const cueBody = this.formatCueObject(ast);
      const cueWithPackage = `${packageDeclaration}\n\n${cueBody}`;

      return await this.format(cueWithPackage);
    } catch (error) {
      throw new Error(`Failed to serialize CUE content: ${error}`);
    }
  }

  /**
   * Format CUE content using the CUE tool
   */
  async format(content: string): Promise<string> {
    const tempFile = path.join(this.tempDir, "format.cue");
    await fs.writeFile(tempFile, content);

    try {
      const runner = this.createRunner();
      const result = await runner.fmt([tempFile]);
      if (!result.success) {
        throw new Error(result.stderr || "cue fmt failed");
      }

      return await fs.readFile(tempFile, "utf-8");
    } catch (error) {
      throw new Error(`Failed to format CUE content: ${error}`);
    }
  }

  /**
   * Validate CUE content using the CUE tool
   */
  async validate(content: string): Promise<ValidationResult> {
    const tempFile = path.join(this.tempDir, "validate.cue");
    await fs.writeFile(tempFile, content);

    try {
      const runner = this.createRunner();
      const result = await runner.vet([tempFile]);

      if (result.success) {
        return { valid: true, errors: [] };
      }

      const errors = result.diagnostics.length
        ? result.diagnostics.map((diag) => diag.message)
        : [result.raw.stderr || "cue vet failed"];

      return { valid: false, errors };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { valid: false, errors: [message] };
    }
  }

  private createRunner(): CueRunner {
    return new CueRunner({ cwd: this.tempDir });
  }

  /**
   * Direct service addition fallback for when parsing fails
   */
  private directServiceAdd(content: string, serviceName: string, config: ServiceConfig): string {
    const serviceBlock = this.formatCueObject(config);

    const servicesRegex = /(services:\s*{)([^}]*)(})/s;
    const match = content.match(servicesRegex);

    if (match) {
      const existing = match[2];
      const newEntry = `\n\t${serviceName}: ${serviceBlock}`;
      const updated = existing.trim() ? `${existing}${newEntry}` : newEntry;
      return content.replace(servicesRegex, `$1${updated}\n$3`);
    }
    return `${content}\n\nservices: {\n\t${serviceName}: ${serviceBlock}\n}`;
  }

  /**
   * Direct endpoint addition fallback
   */
  private directEndpointAdd(content: string, endpoint: string, config: EndpointConfig): string {
    const pathBlock = this.formatCueObject({
      [config.method.toLowerCase()]: {
        ...(config.request && { request: config.request }),
        ...(config.response && { response: config.response }),
      },
    });

    const pathsRegex = /(paths:\s*{)([^}]*)(})/s;
    const match = content.match(pathsRegex);

    if (match) {
      const existing = match[2];
      const newEntry = `\n\t"${endpoint}": ${pathBlock}`;
      const updated = existing.trim() ? `${existing}${newEntry}` : newEntry;
      return content.replace(pathsRegex, `$1${updated}\n$3`);
    }
    return `${content}\n\npaths: {\n\t"${endpoint}": ${pathBlock}\n}`;
  }

  /**
   * Direct database addition fallback
   */
  private directDatabaseAdd(content: string, dbName: string, config: DatabaseConfig): string {
    let result = this.directServiceAdd(content, dbName, config);

    // Add connection string to attached service if specified
    if (config.attachTo) {
      if (config.image) {
        // Container-based database
        const connectionString = this.generateDbConnectionString(
          config.image,
          dbName,
          config.ports?.[0]?.port || 5432,
        );
        result = this.addEnvironmentVariable(
          result,
          config.attachTo,
          "DATABASE_URL",
          connectionString,
        );
      } else if (config.serviceType && config.serviceType !== "prebuilt") {
        // Platform-managed database - add multiple env vars
        const envVars = this.generatePlatformDbEnvVars(config.serviceType, dbName);
        for (const [key, value] of Object.entries(envVars)) {
          result = this.addEnvironmentVariable(result, config.attachTo, key, value);
        }
      }
    }

    return result;
  }

  /**
   * Direct route addition fallback
   */
  private directRouteAdd(content: string, route: RouteConfig): string {
    const routeBlock = this.formatCueObject(route);

    const routesRegex = /(ui:\s*routes:\s*\[)([^\]]*)]]/s;
    const match = content.match(routesRegex);

    if (match) {
      const existing = match[2];
      const separator = existing.trim() ? ",\n\t" : "\n\t";
      return content.replace(routesRegex, `$1${existing}${separator}${routeBlock}\n]`);
    }
    return content.replace(/ui:\s*routes:\s*\[\]/, `ui: routes: [\n\t${routeBlock}\n]`);
  }

  /**
   * Direct flow addition fallback
   */
  private directFlowAdd(content: string, flow: FlowConfig): string {
    const flowBlock = this.formatCueObject(flow);

    const flowsRegex = /(flows:\s*\[)([^\]]*)]]/s;
    const match = content.match(flowsRegex);

    if (match) {
      const existing = match[2];
      const separator = existing.trim() ? ",\n\t" : "\n\t";
      return content.replace(flowsRegex, `$1${existing}${separator}${flowBlock}\n]`);
    }
    return content.replace(/flows:\s*\[\]/, `flows: [\n\t${flowBlock}\n]`);
  }

  /**
   * Direct section addition fallback
   */
  private directSectionAdd(content: string, section: string, key: string, value: any): string {
    const valueStr = this.formatCueObject(value);

    const sectionRegex = new RegExp(`(${section.replace(".", ":\\s+")}:\\s*{)([^}]*)(})`, "s");
    const match = content.match(sectionRegex);

    if (match) {
      const existing = match[2];
      const newEntry = `\n\t${key}: ${valueStr}`;
      const updated = existing.trim() ? `${existing}${newEntry}` : newEntry;
      return content.replace(sectionRegex, `$1${updated}\n$3`);
    }
    return `${content}\n\n${section}: {\n\t${key}: ${valueStr}\n}`;
  }

  /**
   * Add environment variable to a service
   */
  private addEnvironmentVariable(
    content: string,
    serviceName: string,
    key: string,
    value: string,
  ): string {
    const envRegex = new RegExp(`(${serviceName}:\\s*{[^}]*env:\\s*{)([^}]*)(})`, "s");
    const match = content.match(envRegex);

    if (match) {
      const existing = match[2];
      const newEntry = `\n\t\t${key}: "${value}"`;
      const updated = existing.trim() ? `${existing}${newEntry}` : newEntry;
      return content.replace(envRegex, `$1${updated}\n\t$3`);
    }
    // Add env section to service
    const serviceRegex = new RegExp(`(${serviceName}:\\s*{[^}]*)(})`, "s");
    return content.replace(serviceRegex, `$1\tenv: {\n\t\t${key}: "${value}"\n\t}\n$2`);
  }

  /**
   * Format a JavaScript object as CUE syntax
   */
  private formatCueObject(obj: any, indent = ""): string {
    if (typeof obj === "string") {
      return `"${obj.replace(/"/g, '\\"')}"`;
    }
    if (typeof obj === "number" || typeof obj === "boolean") {
      return String(obj);
    }

    if (Array.isArray(obj)) {
      if (obj.length === 0) {
        return "[]";
      }
      const items = obj.map((item) => `${indent}\t${this.formatCueObject(item, `${indent}\t`)}`);
      return `[\n${items.join(",\n")}\n${indent}]`;
    }

    if (typeof obj === "object" && obj !== null) {
      const entries = Object.entries(obj);
      if (entries.length === 0) {
        return "{}";
      }
      const formattedEntries = entries.map(([k, v]) => {
        const key = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k) ? k : `"${k}"`;
        return `${indent}\t${key}: ${this.formatCueObject(v, `${indent}\t`)}`;
      });
      return `{\n${formattedEntries.join("\n")}\n${indent}}`;
    }

    return String(obj);
  }

  /**
   * Generate database connection string
   */
  private generateDbConnectionString(image: string, dbName: string, port: number): string {
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
  private generatePlatformDbEnvVars(serviceType: string, dbName: string): Record<string, string> {
    switch (serviceType) {
      case "cloudflare_d1":
        return {
          D1_DATABASE_ID: `${dbName}_id`,
          D1_DATABASE_NAME: dbName,
          DATABASE_URL: `d1://${dbName}`,
        };
      case "cloudflare_kv":
        return {
          KV_NAMESPACE_ID: `${dbName}_namespace_id`,
          KV_BINDING_NAME: dbName.toUpperCase(),
        };
      case "vercel_postgres":
        return {
          POSTGRES_URL: `postgres://${dbName}`,
          POSTGRES_PRISMA_URL: `postgres://${dbName}?pgbouncer=true`,
          POSTGRES_URL_NON_POOLING: `postgres://${dbName}`,
        };
      case "vercel_kv":
        return {
          KV_REST_API_URL: `https://${dbName}.kv.vercel-storage.com`,
          KV_REST_API_TOKEN: `${dbName}_token`,
          KV_URL: `redis://${dbName}`,
        };
      case "supabase_database":
        return {
          SUPABASE_URL: `https://${dbName}.supabase.co`,
          SUPABASE_ANON_KEY: `${dbName}_anon_key`,
          SUPABASE_SERVICE_ROLE_KEY: `${dbName}_service_role_key`,
          DATABASE_URL: `postgresql://${dbName}`,
        };
      default:
        return {
          DATABASE_URL: `${serviceType}://${dbName}`,
        };
    }
  }

  /**
   * Cleanup temporary files
   */
  private cleanupEmptyContainers(segments: string[], ast: any): void {
    const stack: Array<{ parent: any; key: string }> = [];
    let current = ast;

    for (const segment of segments) {
      if (!current || typeof current !== "object" || !(segment in current)) {
        return;
      }
      stack.push({ parent: current, key: segment });
      current = current[segment];
    }

    for (let i = stack.length - 1; i >= 0; i -= 1) {
      const { parent, key } = stack[i];
      const value = parent[key];

      if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        Object.keys(value).length === 0
      ) {
        delete parent[key];
      } else {
        break;
      }
    }
  }

  /**
   * Cleanup temporary files
   */
  async cleanup(): Promise<void> {
    await fs.remove(this.tempDir);
  }
}

/**
 * Create a new CUE manipulator instance
 */
export function createCUEManipulator(): CUEManipulator {
  return new CUEManipulator();
}

/**
 * Helper function to validate CUE content
 */
export async function validateCUE(content: string): Promise<ValidationResult> {
  const manipulator = createCUEManipulator();
  try {
    return await manipulator.validate(content);
  } finally {
    await manipulator.cleanup();
  }
}

/**
 * Helper function to format CUE content
 */
export async function formatCUE(content: string): Promise<string> {
  const manipulator = createCUEManipulator();
  try {
    return await manipulator.format(content);
  } finally {
    await manipulator.cleanup();
  }
}
