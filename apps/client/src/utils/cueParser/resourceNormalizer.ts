/**
 * Resource normalization for CUE architecture data
 */
import type { CueArchitectureData, DiagramComponent } from "../../types/architecture";
import { isRecord, normalizeKind } from "./helpers";
import type { ResourceComponentParams } from "./types";

/** Build a resource component with consistent structure */
function buildResourceComponent(params: ResourceComponentParams): DiagramComponent {
  return {
    id: params.id,
    name: params.name,
    type: "resource",
    kind: params.kind,
    description: params.description,
    layer: params.layer,
    position: { x: 0, y: 0 },
    size: params.size ?? { width: 160, height: 70 },
    ...(params.routePath ? { routePath: params.routePath } : {}),
    ...(params.capabilities ? { capabilities: params.capabilities } : {}),
    metadata: params.metadata ?? {},
  };
}

/** Collect resources from a source object or array */
function collectFromSource(
  source: unknown,
  defaultKind: string,
  prefix: string,
  addResource: (resource: DiagramComponent) => void,
): void {
  if (!source) return;

  if (isRecord(source)) {
    Object.entries(source).forEach(([id, raw]) => {
      const data = (raw || {}) as Record<string, unknown>;
      const kind = normalizeKind(data, defaultKind);
      const name = (data.name as string) || id;
      const layer =
        kind.toLowerCase() === "view" || kind.toLowerCase() === "ui" ? "presentation" : "service";
      addResource(
        buildResourceComponent({
          id: `resource_${id}`,
          name,
          kind,
          layer,
          description: data.description as string | undefined,
          metadata: data,
          routePath: (data.path ?? data.route ?? data.routePath) as string | undefined,
        }),
      );
    });
  } else if (Array.isArray(source)) {
    source.forEach((raw, idx) => {
      const data = (raw || {}) as Record<string, unknown>;
      const id = (data.id as string) || (data.name as string) || `${prefix}_${idx + 1}`;
      const kind = normalizeKind(data, defaultKind);
      const name = (data.name as string) || id;
      const layer =
        kind.toLowerCase() === "view" || kind.toLowerCase() === "ui" ? "presentation" : "service";
      addResource(
        buildResourceComponent({
          id: `resource_${id}`,
          name,
          kind,
          layer,
          description: data.description as string | undefined,
          metadata: data,
          routePath: (data.path ?? data.route ?? data.routePath) as string | undefined,
        }),
      );
    });
  }
}

/** Parse OpenAPI-style paths into endpoint resources */
function parsePaths(
  paths: Record<string, unknown>,
  addResource: (resource: DiagramComponent) => void,
): void {
  Object.entries(paths).forEach(([path, pathData]) => {
    const methods = Object.keys(pathData as Record<string, unknown>).filter((key) =>
      ["get", "post", "put", "patch", "delete"].includes(key),
    );

    methods.forEach((method) => {
      const idSafe = path.replace(/[^a-zA-Z0-9]/g, "_");
      const resourceId = `resource_${method}_${idSafe}`;
      addResource(
        buildResourceComponent({
          id: resourceId,
          name: `${method.toUpperCase()} ${path}`,
          kind: "endpoint",
          layer: "service",
          description: `API endpoint: ${method.toUpperCase()} ${path}`,
          metadata: {
            method: method.toUpperCase(),
            path,
            pathData: (pathData as Record<string, unknown>)[method],
          },
          size: { width: 160, height: 60 },
        }),
      );
    });
  });
}

/** Parse UI routes into view resources */
function parseUiRoutes(routes: unknown[], addResource: (resource: DiagramComponent) => void): void {
  routes.forEach((route, index) => {
    if (!route || typeof route !== "object") return;
    const routeObj = route as Record<string, unknown>;
    const id = (routeObj.id as string | undefined) || `view_${index}`;
    addResource(
      buildResourceComponent({
        id: `resource_view_${id}`,
        name:
          (routeObj.name as string | undefined) ||
          (routeObj.path as string | undefined) ||
          `Route ${index + 1}`,
        kind: "view",
        layer: "presentation",
        description: `View: ${(routeObj.path as string | undefined) ?? ""}`,
        routePath: (routeObj.path as string | undefined) ?? "",
        size: { width: 150, height: 80 },
        capabilities: (routeObj.capabilities as string[] | undefined) || [],
        metadata: {
          ...routeObj,
          requiresAuth: routeObj.requiresAuth,
          component: routeObj.component,
          layout: routeObj.layout,
        },
      }),
    );
  });
}

/** Normalize resources from CUE data into diagram components */
export function normalizeResources(cueData: CueArchitectureData): DiagramComponent[] {
  const resources: DiagramComponent[] = [];
  const resourceIds = new Set<string>();

  const addResource = (resource: DiagramComponent) => {
    if (resourceIds.has(resource.id)) return;
    resourceIds.add(resource.id);
    resources.push(resource);
  };

  // Collect from resources collection
  collectFromSource(cueData.resources, "resource", "resource", addResource);

  // Parse OpenAPI-style paths
  if (cueData.paths) {
    parsePaths(cueData.paths, addResource);
  }

  // Parse UI routes
  if (cueData.ui?.routes) {
    parseUiRoutes(cueData.ui.routes, addResource);
  }

  return resources;
}
