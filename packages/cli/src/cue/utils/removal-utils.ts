/**
 * @packageDocumentation
 * CUE removal utilities for entity deletion.
 *
 * Provides functionality to:
 * - Remove path methods from AST structures
 * - Remove service endpoints
 * - Cleanup empty containers after removal
 */

/**
 * Delete object key if container becomes empty
 */
function deleteIfEmpty(container: Record<string, any>, key: string): void {
  if (container[key] && Object.keys(container[key]).length === 0) {
    delete container[key];
  }
}

/**
 * Remove specific method from path, returns false if method doesn't exist
 */
function removeSpecificMethod(
  ast: any,
  serviceName: string,
  endpointPath: string,
  method: string,
): boolean {
  const methodKey = method.toLowerCase();
  if (!ast.paths[serviceName][endpointPath][methodKey]) return false;
  delete ast.paths[serviceName][endpointPath][methodKey];
  deleteIfEmpty(ast.paths[serviceName], endpointPath);
  return true;
}

/**
 * Remove method from paths in AST, cleaning up empty containers
 */
export function removePathMethod(
  ast: any,
  serviceName: string,
  endpointPath: string,
  method?: string,
): boolean {
  if (!ast.paths?.[serviceName]?.[endpointPath]) return false;

  if (method) {
    if (!removeSpecificMethod(ast, serviceName, endpointPath, method)) return false;
  } else {
    delete ast.paths[serviceName][endpointPath];
  }

  deleteIfEmpty(ast.paths, serviceName);
  deleteIfEmpty(ast, "paths");
  return true;
}

/**
 * Filter methods from endpoint, returning true if endpoint should be deleted
 */
function shouldDeleteEndpoint(
  endpointSpec: Record<string, any>,
  method: string | undefined,
): boolean {
  if (!method) return true;

  const updatedMethods = (endpointSpec.methods as string[] | undefined)?.filter(
    (m) => m.toLowerCase() !== method.toLowerCase(),
  );

  if (updatedMethods && updatedMethods.length > 0) {
    endpointSpec.methods = updatedMethods;
    return false;
  }
  return true;
}

/**
 * Remove endpoint from service endpoints in AST
 */
export function removeServiceEndpoint(
  ast: any,
  serviceName: string,
  endpointPath: string,
  method?: string,
): void {
  const serviceSpec = ast.services?.[serviceName];
  if (!serviceSpec?.endpoints) return;

  for (const [endpointId, endpointSpecValue] of Object.entries(serviceSpec.endpoints)) {
    if (!endpointSpecValue || typeof endpointSpecValue !== "object") continue;

    const endpointSpec = endpointSpecValue as Record<string, any>;
    if (endpointSpec.path !== endpointPath) continue;

    if (shouldDeleteEndpoint(endpointSpec, method)) {
      delete serviceSpec.endpoints[endpointId];
    }
  }

  if (Object.keys(serviceSpec.endpoints).length === 0) {
    delete serviceSpec.endpoints;
  }
}

function buildPathStack(segments: string[], ast: any): Array<{ parent: any; key: string }> | null {
  const stack: Array<{ parent: any; key: string }> = [];
  let current = ast;

  for (const segment of segments) {
    if (!current || typeof current !== "object" || !(segment in current)) {
      return null;
    }
    stack.push({ parent: current, key: segment });
    current = current[segment];
  }

  return stack;
}

function isEmptyObject(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value as object).length === 0
  );
}

/**
 * Cleanup empty containers in AST by walking path backwards
 */
export function cleanupEmptyContainers(segments: string[], ast: any): void {
  const stack = buildPathStack(segments, ast);
  if (!stack) {
    return;
  }

  for (let i = stack.length - 1; i >= 0; i -= 1) {
    const { parent, key } = stack[i];
    if (isEmptyObject(parent[key])) {
      delete parent[key];
    } else {
      break;
    }
  }
}

/**
 * Navigate to a section in AST by dot-separated path
 * Returns the parent and key of the target, or undefined if path doesn't exist
 */
export function navigateToSection(
  ast: any,
  section: string,
): { parent: any; segments: string[] } | undefined {
  const segments = section.split(".");
  let current = ast;

  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i];
    if (!current || typeof current !== "object" || !(segment in current)) {
      return undefined;
    }
    current = current[segment];
  }

  return { parent: current, segments };
}

/**
 * Map of entity types to their section names
 */
export const sectionMap: Record<string, string> = {
  database: "databases",
  package: "packages",
  tool: "tools",
  frontend: "frontends",
  capability: "capabilities",
  cache: "caches",
};
