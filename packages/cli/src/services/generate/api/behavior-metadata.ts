/**
 * @packageDocumentation
 * Behavior route metadata utilities for deriving test IDs and route information.
 *
 * Provides functions to extract and sanitize test identifiers from behavior
 * specifications for use in generated test files.
 */

import { type AppSpec, getBehaviorsArray } from "@arbiter/specification";

export interface BehaviorRouteMetadata {
  rootTestId?: string;
  actionTestIds: string[];
  successTestId?: string;
  apiInteractions: Array<{ method: string; path: string; status?: number }>;
}

/**
 * Create a route ID resolver function
 */
function createRouteIdResolver(routes: Array<{ id: string }>): (behaviorId: string) => string {
  return (behaviorId: string): string => {
    if (routes.some((route) => route.id === behaviorId)) {
      return behaviorId;
    }
    const namespace = behaviorId.split(":")[0];
    const matchedRoute = routes.find((route) => route.id.startsWith(namespace)) ??
      routes[0] ?? { id: behaviorId };
    return matchedRoute.id;
  };
}

/**
 * Process a single step for action test IDs
 */
function processStepActions(
  step: any,
  locatorMap: Record<string, string>,
  actionSet: Set<string>,
): void {
  if (typeof step.click === "string") {
    const id = extractTestId(step.click, locatorMap);
    if (id) actionSet.add(id);
  }
  if (typeof step.fill?.locator === "string") {
    const id = extractTestId(step.fill.locator, locatorMap);
    if (id) actionSet.add(id);
  }
}

/**
 * Process step's expect clause and update entry
 */
function processStepExpect(
  step: any,
  locatorMap: Record<string, string>,
  entry: BehaviorRouteMetadata,
): string | undefined {
  if (typeof step.expect?.locator !== "string") {
    return undefined;
  }

  const derivedId = extractTestId(step.expect.locator, locatorMap);
  if (!derivedId) {
    return undefined;
  }

  if (!entry.rootTestId && step.expect.locator.startsWith("page:")) {
    entry.rootTestId = derivedId;
  }

  return derivedId;
}

/**
 * Process step's API expectation
 */
function processStepApiExpect(step: any, entry: BehaviorRouteMetadata): void {
  if (!step.expect_api) return;

  const method = (step.expect_api.method || "GET").toUpperCase();
  const path = step.expect_api.path;
  const key = `${method} ${path}`;

  const exists = entry.apiInteractions.some(
    (api) => `${(api.method || "GET").toUpperCase()} ${api.path}` === key,
  );

  if (!exists) {
    entry.apiInteractions.push({
      method,
      path,
      status: step.expect_api.status,
    });
  }
}

/**
 * Resolve root test ID from locator map if not already set
 */
function resolveRootTestId(
  entry: BehaviorRouteMetadata,
  routeId: string,
  locatorMap: Record<string, string>,
): void {
  if (entry.rootTestId) return;

  const namespace = routeId.split(":")[0];
  const pageKey =
    Object.keys(locatorMap).find((key) => key.startsWith("page:") && key.includes(namespace)) ||
    Object.keys(locatorMap).find((key) => key.startsWith("page:"));

  if (pageKey) {
    entry.rootTestId = extractTestId(pageKey, locatorMap) ?? entry.rootTestId;
  }
}

/**
 * Derive behavior route metadata from app spec
 */
export function deriveBehaviorRouteMetadata(appSpec: AppSpec): Map<string, BehaviorRouteMetadata> {
  const metadata = new Map<string, BehaviorRouteMetadata>();
  const locatorMap = (appSpec as any).locators || {};
  const routes = Array.isArray((appSpec as any).ui?.routes) ? (appSpec as any).ui.routes : [];
  const resolveRouteId = createRouteIdResolver(routes);

  for (const behavior of getBehaviorsArray(appSpec)) {
    const routeId = resolveRouteId(behavior.id);

    if (!metadata.has(routeId)) {
      metadata.set(routeId, { actionTestIds: [], apiInteractions: [] });
    }

    const entry = metadata.get(routeId)!;
    const actionSet = new Set(entry.actionTestIds);
    let lastExpectId = entry.successTestId;

    for (const step of behavior.steps || []) {
      processStepActions(step, locatorMap, actionSet);

      const expectId = processStepExpect(step, locatorMap, entry);
      if (expectId) lastExpectId = expectId;

      processStepApiExpect(step, entry);
    }

    resolveRootTestId(entry, routeId, locatorMap);
    entry.actionTestIds = Array.from(actionSet);
    if (lastExpectId) entry.successTestId = lastExpectId;
  }

  return metadata;
}

/**
 * Extract test ID from target string using locator map
 */
export function extractTestId(
  target: string | undefined,
  locatorMap: Record<string, string>,
): string | null {
  if (!target) return null;
  const mapped = locatorMap[target];
  if (mapped) {
    const match = mapped.match(/data-testid="([^"]+)"/);
    if (match) return match[1];
  }
  const directMatch = target.match(/data-testid="([^"]+)"/);
  if (directMatch) {
    return directMatch[1];
  }
  if (target.includes(":")) {
    const parts = target.split(":");
    return sanitizeTestId(parts.pop() || target);
  }
  if (/[\[\].#]/.test(target)) {
    return sanitizeTestId(target.replace(/[^a-z0-9]+/gi, "-"));
  }
  return sanitizeTestId(target);
}

/**
 * Sanitize test ID for use in HTML attributes
 */
export function sanitizeTestId(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/--+/g, "-") || "test-id"
  );
}

/**
 * Convert test ID to human-readable label
 */
export function humanizeTestId(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}
