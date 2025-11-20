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
import { safeFileOperation } from "../constraints/index.js";

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
  serviceType?: PlatformServiceType;
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
    await safeFileOperation("write", tempFile, async (validatedPath) => {
      await fs.writeFile(validatedPath, content);
    });

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
      throw new Error(
        `Failed to add service "${serviceName}" using CUE tooling: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Add an endpoint to the CUE structure
   */
  async addEndpoint(content: string, config: EndpointConfig): Promise<string> {
    try {
      const ast = await this.parse(content);
      const methodKey = config.method.toLowerCase();

      if (!ast.paths) {
        ast.paths = {};
      }
      if (!ast.paths[config.service]) {
        ast.paths[config.service] = {};
      }
      if (!ast.paths[config.service][config.path]) {
        ast.paths[config.service][config.path] = {};
      }

      const operation: Record<string, unknown> = {
        ...(config.summary && { summary: config.summary }),
        ...(config.description && { description: config.description }),
        ...(config.implements && { implements: config.implements }),
        ...(config.request && { request: config.request }),
        ...(config.response && { response: config.response }),
      };

      ast.paths[config.service][config.path][methodKey] = operation;

      if (ast.services && ast.services[config.service]) {
        const targetService = ast.services[config.service];
        if (!targetService.endpoints) {
          targetService.endpoints = {};
        }

        const endpointId = config.endpointId ?? this.buildEndpointIdentifier(config);
        const existing = targetService.endpoints[endpointId] || {};
        const existingMethods = Array.isArray(existing.methods) ? existing.methods : [];
        const methodSet = new Set<string>(existingMethods.map((m: string) => m.toUpperCase()));
        methodSet.add(config.method.toUpperCase());

        targetService.endpoints[endpointId] = {
          ...existing,
          path: config.path,
          methods: Array.from(methodSet),
          ...(config.implements && { implements: config.implements }),
          handler:
            config.handler ??
            existing.handler ??
            this.buildDefaultHandlerReference(config.service, config.method, config.path),
        };
      }

      return await this.serialize(ast, content);
    } catch (error) {
      throw new Error(`Failed to add endpoint: ${error instanceof Error ? error.message : error}`);
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
      throw new Error(
        `Failed to add database "${dbName}" using CUE tooling: ${error instanceof Error ? error.message : String(error)}`,
      );
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
      throw new Error(
        `Failed to add route "${route.id || route.path}" via CUE tooling: ${error instanceof Error ? error.message : String(error)}`,
      );
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
      throw new Error(
        `Failed to add flow "${flow.id}" via CUE tooling: ${error instanceof Error ? error.message : String(error)}`,
      );
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
      throw new Error(
        `Failed to add key "${key}" to section "${section}": ${error instanceof Error ? error.message : String(error)}`,
      );
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
  async removeEndpoint(
    content: string,
    serviceName: string,
    endpointPath: string,
    method?: string,
  ): Promise<string> {
    try {
      const ast = await this.parse(content);
      if (!ast.paths || !ast.paths[serviceName] || !ast.paths[serviceName][endpointPath]) {
        return content;
      }

      if (method) {
        const methodKey = method.toLowerCase();
        if (!ast.paths[serviceName][endpointPath][methodKey]) {
          return content;
        }
        delete ast.paths[serviceName][endpointPath][methodKey];
        if (Object.keys(ast.paths[serviceName][endpointPath]).length === 0) {
          delete ast.paths[serviceName][endpointPath];
        }
      } else {
        delete ast.paths[serviceName][endpointPath];
      }

      if (ast.paths[serviceName] && Object.keys(ast.paths[serviceName]).length === 0) {
        delete ast.paths[serviceName];
      }
      if (ast.paths && Object.keys(ast.paths).length === 0) {
        delete ast.paths;
      }

      const serviceSpec = ast.services?.[serviceName];
      if (serviceSpec?.endpoints) {
        for (const [endpointId, endpointSpecValue] of Object.entries(serviceSpec.endpoints)) {
          if (!endpointSpecValue || typeof endpointSpecValue !== "object") {
            continue;
          }

          const endpointSpec = endpointSpecValue as Record<string, any>;

          if (endpointSpec.path !== endpointPath) {
            continue;
          }

          if (method) {
            const updatedMethods = (endpointSpec.methods as string[] | undefined)?.filter(
              (m) => m.toLowerCase() !== method.toLowerCase(),
            );
            if (updatedMethods && updatedMethods.length > 0) {
              endpointSpec.methods = updatedMethods;
              continue;
            }
          }

          delete serviceSpec.endpoints[endpointId];
        }

        if (Object.keys(serviceSpec.endpoints).length === 0) {
          delete serviceSpec.endpoints;
        }
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
    await safeFileOperation("write", tempFile, async (validatedPath) => {
      await fs.writeFile(validatedPath, content);
    });

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
    await safeFileOperation("write", tempFile, async (validatedPath) => {
      await fs.writeFile(validatedPath, content);
    });

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

  private buildEndpointIdentifier(config: EndpointConfig): string {
    const normalized = config.path.replace(/^\//, "").replace(/[{}]/g, "");
    const segments = normalized
      .split(/[\/_-]+/)
      .filter(Boolean)
      .map((segment) => segment.toLowerCase());
    const base = segments.length > 0 ? segments.join("-") : "root";
    return `${config.method.toLowerCase()}-${base}`.replace(/-+/g, "-");
  }

  private buildDefaultHandlerReference(service: string, method: string, path: string) {
    return {
      type: "module",
      module: `${service}/handlers/routes`,
      function: this.buildHandlerFunctionName(method, path),
    };
  }

  private buildHandlerFunctionName(method: string, path: string): string {
    const cleaned = path
      .replace(/^\//, "")
      .replace(/[{}]/g, "")
      .split(/[\/_-]+/)
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
      .join("");
    const suffix = cleaned || "Root";
    const methodPrefix = method.toLowerCase();
    return `${methodPrefix}${suffix}`;
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
