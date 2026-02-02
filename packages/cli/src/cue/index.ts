/**
 * @packageDocumentation
 * CUE Manipulation Abstraction Layer.
 *
 * Provides AST-based CUE file manipulation with validated tool integration.
 *
 * Key Features:
 * - Parse CUE files using the CUE tool
 * - Manipulate structures through JSON intermediate representation
 * - Format and validate using official CUE tooling
 * - Type-safe operations with proper error handling
 */

import * as os from "node:os";
import path from "node:path";
import { safeFileOperation } from "@/constraints/index.js";
import { CueRunner } from "@arbiter/validation";
import fs from "fs-extra";

// Re-export types for backwards compatibility
export type {
  PlatformServiceType,
  InfrastructureType,
  ServiceConfig,
  EndpointConfig,
  DatabaseConfig,
  RouteConfig,
  FlowConfig,
  ValidationResult,
} from "./types.js";

import type {
  DatabaseConfig,
  EndpointConfig,
  FlowConfig,
  RouteConfig,
  ServiceConfig,
  ValidationResult,
} from "./types.js";

import {
  buildSectionMerge,
  formatCueObject,
  formatCueTopLevel,
  indentBlock,
} from "./utils/formatting.js";

import {
  buildDefaultHandlerReference,
  buildEndpointEntry,
  buildEndpointIdentifier,
  buildOperationObject,
} from "./utils/endpoint-utils.js";

import {
  generateDbConnectionString,
  generateDbEnvVars,
  generatePlatformDbEnvVars,
} from "./utils/db-utils.js";

import { removePathMethod, removeServiceEndpoint, sectionMap } from "./utils/removal-utils.js";

import {
  appendRemovalMarkerForSection,
  canDeleteKey,
  cleanupIfArrayEmpty,
  cleanupIfEmpty,
  traverseToParentAndKey,
  traverseToSection,
} from "./utils/section-manipulation.js";

import {
  appendRouteRemovalMarker,
  hasRouteIdentifier,
  matchesRouteIdentifier,
} from "./utils/route-utils.js";

/**
 * Main CUE manipulator class providing AST-based operations
 */
export class CUEManipulator {
  private tempDir: string;
  private readonly appendOnly: boolean;

  constructor(options: { appendOnly?: boolean } = {}) {
    this.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cue-manipulator-"));
    // Default to AST manipulation (not append-only) for valid CUE output
    this.appendOnly = options.appendOnly ?? false;
  }

  /**
   * Extract error reason from export result
   */
  private extractExportError(result: {
    diagnostics: { message: string }[];
    error?: string;
  }): string {
    return result.diagnostics[0]?.message || result.error || "Unknown CUE export error";
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

      throw new Error(this.extractExportError(exportResult));
    } catch (error) {
      throw new Error(`Failed to parse CUE content: ${error}`);
    }
  }

  /**
   * Build append-only service fragment
   */
  private buildAppendOnlyServiceFragment(serviceName: string, config: ServiceConfig): string {
    const serviceBlock = formatCueObject({ [serviceName]: config }, "  ");
    return ["services: services &", serviceBlock].join("\n");
  }

  /**
   * Add a service to the CUE structure
   */
  async addService(content: string, serviceName: string, config: ServiceConfig): Promise<string> {
    if (this.appendOnly) {
      const fragment = this.buildAppendOnlyServiceFragment(serviceName, config);
      return `${content.trimEnd()}\n\n${fragment}\n`;
    }

    try {
      const ast = await this.parse(content);
      if (!ast.services) ast.services = {};
      ast.services[serviceName] = config;
      return await this.serialize(ast, content);
    } catch (error) {
      throw new Error(
        `Failed to add service "${serviceName}" using CUE tooling: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Generate append-only endpoint fragment
   */
  private buildAppendOnlyEndpointFragment(config: EndpointConfig): string {
    const methodKey = config.method.toLowerCase();
    const operation = buildOperationObject(config);

    const pathCue = formatCueObject(
      { [config.service]: { [config.path]: { [methodKey]: operation } } },
      "  ",
    );
    const pathFragment = ["paths: paths &", pathCue].join("\n");

    const endpointId = config.endpointId ?? buildEndpointIdentifier(config);
    const endpointEntry = buildEndpointEntry(config, endpointId);

    const serviceFragment = [
      "services: services & {",
      `  "${config.service}": {`,
      "    endpoints: endpoints &",
      indentBlock(formatCueObject({ [endpointId]: endpointEntry }, "      "), 4),
      "  }",
      "}",
    ].join("\n");

    return `${pathFragment}\n\n${serviceFragment}`;
  }

  /**
   * Ensure path structure exists in AST
   */
  private ensurePathStructure(ast: any, service: string, path: string): void {
    if (!ast.paths) ast.paths = {};
    if (!ast.paths[service]) ast.paths[service] = {};
    if (!ast.paths[service][path]) ast.paths[service][path] = {};
  }

  /**
   * Update service endpoints in AST
   */
  /**
   * Merge methods into existing endpoint methods
   */
  private mergeEndpointMethods(existing: any, newMethod: string): string[] {
    const existingMethods = Array.isArray(existing.methods) ? existing.methods : [];
    const methodSet = new Set<string>(existingMethods.map((m: string) => m.toUpperCase()));
    methodSet.add(newMethod.toUpperCase());
    return Array.from(methodSet);
  }

  /**
   * Build endpoint configuration object
   */
  private buildEndpointConfig(existing: any, config: EndpointConfig, methods: string[]): any {
    return {
      ...existing,
      path: config.path,
      methods,
      ...(config.implements && { implements: config.implements }),
      handler:
        config.handler ??
        existing.handler ??
        buildDefaultHandlerReference(config.service, config.method, config.path),
    };
  }

  private updateServiceEndpoints(ast: any, config: EndpointConfig): void {
    if (!ast.services || !ast.services[config.service]) return;

    const targetService = ast.services[config.service];
    if (!targetService.endpoints) targetService.endpoints = {};

    const endpointId = config.endpointId ?? buildEndpointIdentifier(config);
    const existing = targetService.endpoints[endpointId] || {};
    const methods = this.mergeEndpointMethods(existing, config.method);

    targetService.endpoints[endpointId] = this.buildEndpointConfig(existing, config, methods);
  }

  /**
   * Add an endpoint to the CUE structure
   */
  async addEndpoint(content: string, config: EndpointConfig): Promise<string> {
    if (this.appendOnly) {
      const fragment = this.buildAppendOnlyEndpointFragment(config);
      return `${content.trimEnd()}\n\n${fragment}\n`;
    }

    try {
      const ast = await this.parse(content);
      const methodKey = config.method.toLowerCase();

      this.ensurePathStructure(ast, config.service, config.path);
      ast.paths[config.service][config.path][methodKey] = buildOperationObject(config);
      this.updateServiceEndpoints(ast, config);

      return await this.serialize(ast, content);
    } catch (error) {
      throw new Error(`Failed to add endpoint: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Build append-only database fragment
   */
  private buildAppendOnlyDbFragment(dbName: string, config: DatabaseConfig): string {
    const baseDbCue = formatCueObject({ [dbName]: config }, "  ");
    const fragments: string[] = ["services: services &", baseDbCue];

    if (config.attachTo) {
      const envVars = generateDbEnvVars(config, dbName);
      const envCue = formatCueObject(envVars, "    ");
      fragments.push(
        "",
        "services: services & {",
        `  "${config.attachTo}": {`,
        "    env: env &",
        indentBlock(envCue, 4),
        "  }",
        "}",
      );
    }

    return fragments.join("\n");
  }

  /**
   * Resolve database env vars based on config type
   */
  private resolveDbEnvVars(config: DatabaseConfig, dbName: string): Record<string, string> {
    if (config.image) {
      const connectionString = generateDbConnectionString(
        config.image,
        dbName,
        config.ports?.[0]?.port || 5432,
      );
      return { DATABASE_URL: connectionString };
    }
    if (config.serviceType && config.serviceType !== "prebuilt") {
      return generatePlatformDbEnvVars(config.serviceType, dbName);
    }
    return {};
  }

  /**
   * Attach database env vars to target service in AST
   */
  private attachDbEnvVarsToService(ast: any, config: DatabaseConfig, dbName: string): void {
    if (!config.attachTo || !ast.services[config.attachTo]) return;

    if (!ast.services[config.attachTo].env) {
      ast.services[config.attachTo].env = {};
    }

    Object.assign(ast.services[config.attachTo].env, this.resolveDbEnvVars(config, dbName));
  }

  /**
   * Add a database to the CUE structure
   */
  async addDatabase(content: string, dbName: string, config: DatabaseConfig): Promise<string> {
    if (this.appendOnly) {
      const fragment = this.buildAppendOnlyDbFragment(dbName, config);
      return `${content.trimEnd()}\n\n${fragment}\n`;
    }

    try {
      const ast = await this.parse(content);
      if (!ast.services) ast.services = {};

      ast.services[dbName] = config;
      this.attachDbEnvVarsToService(ast, config, dbName);

      return await this.serialize(ast, content);
    } catch (error) {
      throw new Error(
        `Failed to add database "${dbName}" using CUE tooling: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private buildAppendOnlyRouteFragment(route: RouteConfig): string {
    // Format route object with proper indentation for array context
    const routeEntries = Object.entries(route).map(([k, v]) => {
      const formattedValue = formatCueObject(v, "\t\t");
      return `\t\t${k}: ${formattedValue}`;
    });
    return ["ui: ui & {", "\troutes: [..., {", ...routeEntries, "\t}]", "}"].join("\n");
  }

  private addRouteToAst(ast: any, route: RouteConfig): void {
    if (!ast.ui) {
      ast.ui = {};
    }
    if (!ast.ui.routes) {
      ast.ui.routes = [];
    }
    ast.ui.routes.push(route);
  }

  /**
   * Add a route to the UI routes array
   * Note: Always uses AST manipulation (not append-only) because CUE list syntax
   * doesn't support simple appending via text fragments.
   */
  async addRoute(content: string, route: RouteConfig): Promise<string> {
    try {
      const ast = await this.parse(content);
      this.addRouteToAst(ast, route);
      return await this.serialize(ast, content);
    } catch (error) {
      throw new Error(
        `Failed to add route "${route.id || route.path}" via CUE tooling: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Build append-only flow fragment
   */
  private buildAppendOnlyFlowFragment(flow: FlowConfig): string {
    const flowCue = formatCueObject(flow, "    ");
    return ["behaviors: [...,", indentBlock(flowCue, 2), "]"].join("\n");
  }

  /**
   * Add flow to AST
   */
  private addFlowToAst(ast: any, flow: FlowConfig): void {
    if (!ast.behaviors) {
      ast.behaviors = [];
    }
    ast.behaviors.push(flow);
  }

  /**
   * Add a flow/behavior to the behaviors array
   * Note: Always uses AST manipulation (not append-only) because CUE list syntax
   * doesn't support simple appending via text fragments.
   */
  async addFlow(content: string, flow: FlowConfig): Promise<string> {
    try {
      const ast = await this.parse(content);
      this.addFlowToAst(ast, flow);
      return await this.serialize(ast, content);
    } catch (error) {
      throw new Error(
        `Failed to add flow "${flow.id}" via CUE tooling: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Navigate to nested section, creating path if needed
   */
  private navigateToSection(ast: any, section: string): any {
    const sections = section.split(".");
    let current = ast;

    for (const sec of sections) {
      if (!current[sec]) {
        current[sec] = {};
      }
      current = current[sec];
    }

    return current;
  }

  /**
   * Add a key-value pair to a specific section
   */
  async addToSection(content: string, section: string, key: string, value: any): Promise<string> {
    if (this.appendOnly) {
      const sectionParts = section.split(".").filter(Boolean);
      const valueCue = formatCueObject(value, "  ");
      const nested = buildSectionMerge(sectionParts, key, valueCue);
      return `${content.trimEnd()}\n\n${nested}\n`;
    }

    try {
      const ast = await this.parse(content);
      const target = this.navigateToSection(ast, section);
      target[key] = value;
      return await this.serialize(ast, content);
    } catch (error) {
      throw new Error(
        `Failed to add key "${key}" to section "${section}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Update an existing key in a specific section with partial updates.
   * Merges the updates into the existing value.
   */
  async updateInSection(
    content: string,
    section: string,
    key: string,
    updates: Record<string, unknown>,
  ): Promise<string> {
    try {
      const ast = await this.parse(content);
      const target = this.navigateToSection(ast, section);

      if (!target[key]) {
        throw new Error(`Key "${key}" not found in section "${section}"`);
      }

      // Merge updates into existing value
      const existing = target[key];
      if (typeof existing === "object" && existing !== null) {
        // Deep merge for nested objects like metadata
        for (const [updateKey, updateValue] of Object.entries(updates)) {
          if (updateKey === "metadata" && typeof updateValue === "object" && updateValue !== null) {
            // Merge metadata instead of replacing
            existing.metadata = { ...existing.metadata, ...updateValue };
          } else {
            existing[updateKey] = updateValue;
          }
        }
      } else {
        target[key] = updates;
      }

      return await this.serialize(ast, content);
    } catch (error) {
      throw new Error(
        `Failed to update key "${key}" in section "${section}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Build append-only service removal marker.
   */
  private buildServiceRemovalMarker(serviceName: string): string {
    const escapedName = serviceName.replace(/\"/g, '\\"');
    return [
      "// removal marker (append-only)",
      "removals: removals & {",
      `  services: [..., "${escapedName}"]`,
      "}",
    ].join("\n");
  }

  /**
   * Remove service from AST and clean up empty services section.
   */
  private removeServiceFromAst(ast: any, serviceName: string): boolean {
    if (!ast.services || !Object.prototype.hasOwnProperty.call(ast.services, serviceName)) {
      return false;
    }

    delete ast.services[serviceName];

    if (Object.keys(ast.services).length === 0) {
      delete ast.services;
    }

    return true;
  }

  /**
   * Remove a service from the specification
   */
  async removeService(content: string, serviceName: string): Promise<string> {
    if (this.appendOnly) {
      const marker = this.buildServiceRemovalMarker(serviceName);
      return `${content.trimEnd()}\n\n${marker}\n`;
    }

    try {
      const ast = await this.parse(content);
      if (!this.removeServiceFromAst(ast, serviceName)) {
        return content;
      }
      return await this.serialize(ast, content);
    } catch {
      return content;
    }
  }

  private buildAppendOnlyEndpointRemovalMarker(
    serviceName: string,
    endpointPath: string,
    method?: string,
  ): string {
    const normalizedMethod = method ? method.toLowerCase() : undefined;
    const methodClause = normalizedMethod ? ` method: "${normalizedMethod}",` : "";
    return [
      "// removal marker (append-only)",
      "removals: removals & {",
      `  endpoints: [..., { service: "${serviceName.replace(/\"/g, '\\"')}", path: "${endpointPath}",${methodClause} }]`,
      "}",
    ].join("\n");
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
    if (this.appendOnly) {
      const marker = this.buildAppendOnlyEndpointRemovalMarker(serviceName, endpointPath, method);
      return `${content.trimEnd()}\n\n${marker}\n`;
    }

    try {
      const ast = await this.parse(content);
      if (!removePathMethod(ast, serviceName, endpointPath, method)) {
        return content;
      }
      removeServiceEndpoint(ast, serviceName, endpointPath, method);
      return await this.serialize(ast, content);
    } catch {
      return content;
    }
  }

  /**
   * Apply filter to array and update parent if changed
   */
  private applyArrayFilter(
    parent: Record<string, any>,
    key: string,
    predicate: (item: any) => boolean,
    segments: string[],
    ast: any,
  ): boolean {
    const target = parent[key];
    if (!Array.isArray(target)) return false;

    const filtered = target.filter((item: any) => !predicate(item));
    if (filtered.length === target.length) return false;

    parent[key] = filtered;
    cleanupIfArrayEmpty(parent, key, segments, ast);
    return true;
  }

  async removeFromArray(
    content: string,
    section: string,
    predicate: (item: any) => boolean,
  ): Promise<string> {
    try {
      const ast = await this.parse(content);
      const result = traverseToParentAndKey(ast, section);
      if (!result) return content;

      const changed = this.applyArrayFilter(
        result.parent,
        result.key,
        predicate,
        result.segments,
        ast,
      );
      return changed ? await this.serialize(ast, content) : content;
    } catch {
      return content;
    }
  }

  /**
   * Remove a UI route by identifier
   */
  async removeRoute(content: string, identifier: { id?: string; path?: string }): Promise<string> {
    if (this.appendOnly) {
      return appendRouteRemovalMarker(content, identifier);
    }

    if (!hasRouteIdentifier(identifier)) {
      return content;
    }

    return await this.removeFromArray(content, "ui.routes", (route) =>
      matchesRouteIdentifier(route, identifier),
    );
  }

  /**
   * Remove a flow by identifier
   */
  async removeFlow(content: string, flowId: string): Promise<string> {
    if (!flowId) {
      return content;
    }

    if (this.appendOnly) {
      const marker = [
        "// removal marker (append-only)",
        "removals: removals & {",
        `  behaviors: [..., "${flowId.replace(/"/g, '\\"')}"]`,
        "}",
      ].join("\n");
      return `${content.trimEnd()}\n\n${marker}\n`;
    }

    return await this.removeFromArray(content, "behaviors", (flow) => flow.id === flowId);
  }

  /**
   * Remove a key from a specific section
   */
  async removeFromSection(content: string, section: string, key: string): Promise<string> {
    if (this.appendOnly) {
      return appendRemovalMarkerForSection(content, section, key);
    }

    try {
      const ast = await this.parse(content);
      const result = traverseToSection(ast, section);
      if (!result) return content;

      const { target, pathStack } = result;
      if (!canDeleteKey(target, key)) return content;

      delete target[key];
      cleanupIfEmpty(target, pathStack, ast);

      return await this.serialize(ast, content);
    } catch {
      return content;
    }
  }

  /**
   * Dispatch removal for special entity types (service, endpoint, route, flow)
   */
  private async dispatchSpecialRemoval(
    content: string,
    normalizedType: string,
    target: string,
    options: { method?: string; service?: string; id?: string },
  ): Promise<string | null> {
    switch (normalizedType) {
      case "service":
        return await this.removeService(content, target);
      case "endpoint":
        return options.service && target
          ? await this.removeEndpoint(content, options.service, target, options.method)
          : content;
      case "route":
        return await this.removeRoute(content, { id: options.id ?? target, path: target });
      case "flow":
        return await this.removeFlow(content, target);
      default:
        return null;
    }
  }

  /**
   * Generic removal helper used by CLI commands.
   */
  async removeDeclaration(
    content: string,
    options: {
      type: string;
      identifier?: string;
      method?: string;
      service?: string;
      id?: string;
    },
  ): Promise<string> {
    const target = options.identifier ?? options.id ?? "";
    const normalizedType = options.type.toLowerCase();

    const specialResult = await this.dispatchSpecialRemoval(
      content,
      normalizedType,
      target,
      options,
    );
    if (specialResult !== null) {
      return specialResult;
    }

    const section = sectionMap[normalizedType] ?? normalizedType;
    return await this.removeFromSection(content, section, target);
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

      // Use top-level formatting (no outer braces) for package content
      const cueBody = formatCueTopLevel(ast);
      const cueWithPackage = `${packageDeclaration}\n\n${cueBody}`;

      return await this.format(cueWithPackage);
    } catch (error) {
      throw new Error(`Failed to serialize CUE content: ${error}`);
    }
  }

  /**
   * Format CUE content using the CUE tool
   * Falls back to returning content as-is if formatting fails (e.g., WASM file write issues)
   */
  async format(content: string): Promise<string> {
    // The WASM CUE runtime has issues with file write operations,
    // so we skip external formatting and return the manually formatted content.
    // The content is already well-formatted by formatCueObject.
    return content;
  }

  /**
   * Extract errors from vet result
   */
  private extractVetErrors(result: {
    diagnostics: { message: string }[];
    raw: { stderr?: string };
  }): string[] {
    if (result.diagnostics.length) {
      return result.diagnostics.map((diag) => diag.message);
    }
    return [result.raw.stderr || "cue vet failed"];
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

      return { valid: false, errors: this.extractVetErrors(result) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { valid: false, errors: [message] };
    }
  }

  private createRunner(): CueRunner {
    return new CueRunner({ cwd: this.tempDir });
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
