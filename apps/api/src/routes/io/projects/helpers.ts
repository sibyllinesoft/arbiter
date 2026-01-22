/**
 * Helper functions for project routes
 */
import { randomUUID } from "node:crypto";
import type { ProjectEntities } from "@arbiter/shared/types/entities";
import type { EventService } from "../../../io/events";
import { coerceStringArray } from "../../../io/utils";
import type { EventType } from "../../../util/types";
import { getDatabaseType, hasOwn, normalizeMetadata, toSlug } from "../../helpers/projects-helpers";
import type { Dependencies } from "./types";

export function extractFrontendViews(artifacts: unknown[]): Set<string> {
  const viewSet = new Set<string>();
  for (const artifact of artifacts) {
    const a = artifact as Record<string, unknown>;
    const meta = a?.metadata as Record<string, unknown> | undefined;
    const analysis = meta?.frontendAnalysis as Record<string, unknown> | undefined;
    if (!analysis) continue;
    const routers = (analysis.routers ?? []) as Array<Record<string, unknown>>;
    for (const router of routers) {
      const routes = (router.routes ?? []) as Array<Record<string, unknown>>;
      for (const route of routes) {
        const rawPath = String(route.path ?? "").trim();
        if (!rawPath) continue;
        const normalized = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
        viewSet.add(normalized.replace(/\/+/g, "/"));
      }
    }
  }
  return viewSet;
}

export function countComponentsByType(
  components: Record<string, unknown>,
  type: string | string[],
): number {
  const types = Array.isArray(type) ? type : [type];
  return Object.values(components).filter((c) => {
    const component = c as Record<string, unknown>;
    return types.includes(component.type as string);
  }).length;
}

export async function broadcastEvent(
  deps: Dependencies,
  projectId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const eventsService = deps.events as EventService | undefined;
  const db = deps.db as Record<string, unknown> | undefined;

  if (eventsService?.broadcastToProject) {
    await eventsService.broadcastToProject(projectId, {
      project_id: projectId,
      event_type: eventType as EventType,
      data: payload,
    });
  } else if (typeof db?.createEvent === "function") {
    await (db.createEvent as Function)(randomUUID(), projectId, eventType, payload);
  }
}

export function addRouteToSet(artifact: Record<string, unknown>, routeSet: Set<string>): void {
  const meta = artifact.metadata as Record<string, unknown> | undefined;
  const pathValue = String(meta?.path ?? artifact.name ?? "/").trim();
  const normalized = pathValue.startsWith("/") ? pathValue : `/${pathValue}`;
  routeSet.add(normalized.replace(/\/+/g, "/"));
}

export function hasRouteFlowMethods(artifact: Record<string, unknown>): boolean {
  const meta = artifact.metadata as Record<string, unknown> | undefined;
  const rawMethods = meta?.methods;
  const methods = Array.isArray(rawMethods) ? rawMethods : coerceStringArray(rawMethods);
  return methods.length > 0;
}

export function countByDetectedType(
  artifact: Record<string, unknown>,
  handlers: Record<string, () => void>,
): void {
  const meta = artifact.metadata as Record<string, unknown> | undefined;
  const detectedType = String(meta?.detectedType ?? meta?.type ?? "").toLowerCase();
  const handler = handlers[detectedType] ?? handlers.default;
  if (handler) handler();
}

export function extractFrontendRoutes(artifacts: unknown[]): Set<string> {
  const routeSet = new Set<string>();
  for (const artifact of artifacts) {
    const a = artifact as Record<string, unknown>;
    const meta = a?.metadata as Record<string, unknown> | undefined;
    const analysis = meta?.frontendAnalysis as Record<string, unknown> | undefined;
    if (!analysis) continue;
    const routers = (analysis.routers ?? []) as Array<Record<string, unknown>>;
    for (const router of routers) {
      const routes = (router.routes ?? []) as Array<Record<string, unknown>>;
      for (const route of routes) {
        const path = String(route.path ?? "").trim();
        if (!path) continue;
        const normalized = path.startsWith("/") ? path : `/${path}`;
        routeSet.add(normalized.replace(/\/+/g, "/"));
      }
    }
  }
  return routeSet;
}

export function buildEntityCounts(artifacts: unknown[], routeSet: Set<string>): ProjectEntities {
  let packageCount = 0,
    toolCount = 0,
    frontendCount = 0,
    infrastructureCount = 0;
  let externalCount = 0,
    viewCount = 0,
    flowCount = 0,
    capabilityCount = 0;

  const otherArtifacts = (artifacts as Array<Record<string, unknown>>).filter(
    (a) => !["service", "database"].includes(a.type as string),
  );

  for (const artifact of otherArtifacts) {
    const type = artifact.type === "binary" ? "tool" : (artifact.type as string);

    switch (type) {
      case "package":
        packageCount++;
        break;
      case "tool":
        toolCount++;
        break;
      case "frontend":
        frontendCount++;
        break;
      case "infrastructure":
        infrastructureCount++;
        break;
      case "route":
        addRouteToSet(artifact, routeSet);
        if (hasRouteFlowMethods(artifact)) flowCount++;
        break;
      case "view":
        viewCount++;
        break;
      case "flow":
        flowCount++;
        break;
      case "capability":
        capabilityCount++;
        break;
      default:
        countByDetectedType(artifact, {
          tool: () => toolCount++,
          build_tool: () => toolCount++,
          frontend: () => frontendCount++,
          infrastructure: () => infrastructureCount++,
          route: () => {
            addRouteToSet(artifact, routeSet);
            if (hasRouteFlowMethods(artifact)) flowCount++;
          },
          view: () => viewCount++,
          flow: () => flowCount++,
          capability: () => capabilityCount++,
          default: () => externalCount++,
        });
    }
  }

  const frontendRouteSet = extractFrontendRoutes(artifacts);
  frontendRouteSet.forEach((path) => routeSet.add(path));

  const routes = Array.from(routeSet);
  return {
    services: 0,
    databases: 0,
    packages: packageCount,
    tools: toolCount,
    frontends: frontendCount,
    infrastructure: infrastructureCount,
    external: externalCount,
    views: viewCount + frontendRouteSet.size,
    routes: routes.length,
    flows: Math.max(flowCount, routes.length > 0 ? 1 : 0),
    capabilities: Math.max(capabilityCount, routes.length > 0 ? 1 : 0),
  };
}

export function buildServicesFromArtifacts(
  artifacts: unknown[],
  routeSet: Set<string>,
): Record<string, unknown> {
  const services: Record<string, unknown> = {};
  const serviceArtifacts = (artifacts as Array<Record<string, unknown>>).filter(
    (a) => a.type === "service",
  );

  for (const artifact of serviceArtifacts) {
    const serviceName = String(artifact.name ?? "").replace(/_/g, "-");
    services[serviceName] = {
      name: artifact.name,
      type: "service",
      metadata: { detected: true },
    };

    const meta = artifact.metadata as Record<string, unknown> | undefined;
    const analysis = meta?.tsoaAnalysis as Record<string, unknown> | undefined;
    if (!analysis) continue;

    const rawServiceName =
      String(artifact.name ?? "").replace(/^@[^/]+\//, "") || String(artifact.name);
    const slugRoot = toSlug(String(artifact.name)) || "service";
    const serviceSlug = toSlug(rawServiceName) || slugRoot;
    const baseRoutePath = `/${serviceSlug}`.replace(/\/+/g, "/");
    if (baseRoutePath) routeSet.add(baseRoutePath);

    const candidates = Array.isArray(analysis.controllerCandidates)
      ? analysis.controllerCandidates
      : [];
    for (const candidate of candidates) {
      const normalized = String(candidate).split("\\").join("/");
      const fileName = normalized.split("/").pop() || normalized;
      const baseSegment = toSlug(
        fileName
          .replace(/\.[tj]sx?$/i, "")
          .replace(/controller$/i, "")
          .replace(/route$/i, ""),
      );
      const routePath = baseSegment
        ? `${baseRoutePath}/${baseSegment}`.replace(/\/+/g, "/")
        : baseRoutePath;
      routeSet.add(routePath);
    }
  }
  return services;
}

export function buildDatabasesFromArtifacts(artifacts: unknown[]): Record<string, unknown> {
  const databases: Record<string, unknown> = {};
  const dbArtifacts = (artifacts as Array<Record<string, unknown>>).filter(
    (a) => a.type === "database",
  );

  for (const artifact of dbArtifacts) {
    const dbName = String(artifact.name ?? "").replace(/_/g, "-");
    databases[dbName] = {
      name: artifact.name,
      type: getDatabaseType(artifact.framework as string | undefined, String(artifact.name)),
      metadata: {
        detected: true,
        language: artifact.language ?? "sql",
        framework: artifact.framework ?? "unknown",
      },
    };
  }
  return databases;
}

export function cleanupMetadataKeys(
  meta: Record<string, unknown> | undefined,
  values: Record<string, unknown>,
): void {
  if (!meta) return;
  const groupKeysProvided =
    typeof values.groupId === "string" ||
    typeof values.group === "string" ||
    typeof values.groupName === "string";
  if (!groupKeysProvided) {
    delete meta.groupId;
    delete meta.group;
    delete meta.groupName;
  }
  delete meta.artifactId;
  delete meta.artifact_id;
  delete meta.entityId;
  delete meta.entity_id;

  if (hasOwn(meta, "environment")) {
    const envValue = meta.environment;
    if (
      !envValue ||
      (typeof envValue === "object" &&
        Object.keys(envValue as Record<string, unknown>).length === 0)
    ) {
      delete meta.environment;
    }
  }
}

export function buildArtifactSnapshot(artifact: Record<string, unknown>): Record<string, unknown> {
  return {
    id: artifact.id,
    project_id: artifact.project_id,
    name: artifact.name,
    description: artifact.description,
    type: artifact.type,
    language: artifact.language,
    framework: artifact.framework,
    metadata: artifact.metadata ?? {},
    file_path: artifact.file_path ?? artifact.filePath ?? null,
    confidence: artifact.confidence ?? 0.95,
    created_at: artifact.created_at ?? null,
    updated_at: artifact.updated_at ?? null,
  };
}

export function restoreFromSnapshot(snapshot: Record<string, unknown>): {
  name: string;
  description: string | null;
  artifactType: string;
  language: string | undefined;
  framework: string | undefined;
  metadata: Record<string, unknown> | undefined;
  filePath: string | undefined;
  confidence: number;
  entityType: string;
} {
  const metadata =
    snapshot.metadata && typeof snapshot.metadata === "object"
      ? (snapshot.metadata as Record<string, unknown>)
      : undefined;

  const displayLabel = metadata?.displayLabel as string | undefined;
  const rawName = snapshot.name;
  const name =
    typeof rawName === "string" && rawName.trim()
      ? rawName.trim()
      : (displayLabel ?? "Restored artifact");
  const description = typeof snapshot.description === "string" ? snapshot.description : null;
  const artifactType =
    typeof snapshot.type === "string"
      ? snapshot.type
      : typeof snapshot.artifact_type === "string"
        ? (snapshot.artifact_type as string)
        : "component";

  const language =
    typeof snapshot.language === "string"
      ? snapshot.language
      : typeof metadata?.language === "string"
        ? (metadata.language as string)
        : undefined;
  const framework =
    typeof snapshot.framework === "string"
      ? snapshot.framework
      : typeof metadata?.framework === "string"
        ? (metadata.framework as string)
        : undefined;
  const filePath =
    typeof snapshot.file_path === "string"
      ? snapshot.file_path
      : typeof snapshot.filePath === "string"
        ? (snapshot.filePath as string)
        : undefined;
  const confidence = typeof snapshot.confidence === "number" ? snapshot.confidence : 0.95;

  const classification = metadata?.classification as Record<string, unknown> | undefined;
  const entityType =
    (classification?.detectedType as string) ?? (metadata?.detectedType as string) ?? artifactType;

  return {
    name,
    description,
    artifactType,
    language,
    framework,
    metadata: normalizeMetadata(metadata),
    filePath,
    confidence,
    entityType,
  };
}
