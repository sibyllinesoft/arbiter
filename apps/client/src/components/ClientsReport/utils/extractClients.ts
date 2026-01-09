import {
  createExternalArtifactCard,
  isManualClient,
  normalizeClient,
} from "@/features/spec/transformers/clients";
import { coerceDisplayValue, slugify } from "@/features/spec/utils/clients";
import type { ExternalArtifactCard, NormalizedClient, NormalizedClientView } from "../types";

interface ExtractedClients {
  internalClients: NormalizedClient[];
  externalClients: ExternalArtifactCard[];
}

interface FrontendPackage {
  packageName?: string;
  name?: string;
  packageRoot?: string;
  packageJsonPath?: string;
  frameworks?: unknown[];
  components?: unknown[];
  routes?: RouteEntry[];
}

interface RouteEntry {
  path?: string;
  filePath?: string;
  routerType?: string;
}

function extractComponentEntries(
  componentsSource: unknown,
): Array<[string, Record<string, unknown>]> {
  const entries: Array<[string, Record<string, unknown>]> = [];

  if (Array.isArray(componentsSource)) {
    componentsSource.forEach((component, index) => {
      entries.push([`component-${index + 1}`, (component as Record<string, unknown>) ?? {}]);
    });
  } else if (componentsSource && typeof componentsSource === "object") {
    Object.entries(componentsSource as Record<string, unknown>).forEach(([key, value]) => {
      entries.push([key, (value as Record<string, unknown>) ?? {}]);
    });
  }

  return entries;
}

function extractPackageName(pkg: FrontendPackage): string {
  const packageNameRaw =
    (typeof pkg.packageName === "string" ? (pkg.packageName ?? "").trim() : "") ||
    (typeof pkg.name === "string" ? (pkg.name ?? "").trim() : "");
  return packageNameRaw;
}

function buildRouteEntries(routes: RouteEntry[] | undefined): Array<{
  path: string;
  filePath?: string;
  routerType?: string;
}> {
  if (!Array.isArray(routes)) return [];

  return routes
    .map((route) => {
      if (!route || typeof route !== "object") return null;
      const pathValue = typeof route.path === "string" ? route.path.trim() : "";
      const filePathValue = typeof route.filePath === "string" ? route.filePath.trim() : "";
      const routerTypeValue =
        typeof route.routerType === "string" ? route.routerType.trim() : undefined;
      if (!pathValue && !filePathValue) return null;
      return {
        path: pathValue || "/",
        ...(filePathValue ? { filePath: filePathValue } : {}),
        ...(routerTypeValue ? { routerType: routerTypeValue } : {}),
      };
    })
    .filter((entry): entry is { path: string; filePath?: string; routerType?: string } =>
      Boolean(entry),
    );
}

function processFrontendPackage(
  pkg: FrontendPackage,
  seenComponentKeys: Set<string>,
): [string, Record<string, unknown>] | null {
  const packageNameRaw = extractPackageName(pkg);
  if (!packageNameRaw) return null;

  const key = packageNameRaw.replace(/_/g, "-");
  const normalizedKey = key.toLowerCase();
  if (seenComponentKeys.has(normalizedKey)) return null;

  const packageRoot = typeof pkg.packageRoot === "string" ? pkg.packageRoot.trim() : undefined;
  const packageJsonPath =
    typeof pkg.packageJsonPath === "string" ? pkg.packageJsonPath.trim() : undefined;
  const frameworks = Array.isArray(pkg.frameworks)
    ? pkg.frameworks.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean)
    : [];
  const routeEntries = buildRouteEntries(pkg.routes as RouteEntry[]);

  const frontendAnalysis = {
    frameworks,
    components: Array.isArray(pkg.components) ? pkg.components : [],
    routers: routeEntries.length
      ? [
          {
            type: frameworks[0] ?? "frontend",
            routerType: routeEntries[0]?.routerType ?? frameworks[0] ?? "frontend",
            routes: routeEntries,
          },
        ]
      : [],
  };

  const metadata: Record<string, unknown> = {
    ...(packageRoot ? { packageRoot, root: packageRoot } : {}),
    ...(packageJsonPath ? { sourceFile: packageJsonPath } : {}),
    frameworks,
    frontendAnalysis,
    classification: {
      detectedType: "frontend",
      source: "frontend-packages",
      reason: "aggregated",
    },
    detected: true,
  };

  seenComponentKeys.add(normalizedKey);

  return [
    key,
    {
      id: key,
      artifactId: key,
      name: packageNameRaw,
      type: "frontend",
      description: "",
      metadata,
    },
  ];
}

function buildManualView(
  entryKey: string,
  value: Record<string, unknown>,
): NormalizedClientView | null {
  const type = coerceDisplayValue(value?.type);
  if (type !== "view") return null;

  const metadata = (value?.metadata ?? {}) as Record<string, unknown>;
  const rawPath =
    coerceDisplayValue(metadata?.path) ??
    coerceDisplayValue((metadata?.route as { path?: string } | undefined)?.path) ??
    "/";
  const normalizedPath = rawPath.startsWith("/") ? rawPath : `/${rawPath.replace(/^\/?/, "")}`;
  const componentName =
    coerceDisplayValue(metadata?.component) ??
    coerceDisplayValue(metadata?.componentName) ??
    coerceDisplayValue(value?.name) ??
    `view-${entryKey}`;
  const filePath =
    coerceDisplayValue(metadata?.filePath) ??
    coerceDisplayValue(metadata?.sourceFile) ??
    coerceDisplayValue(metadata?.source_path) ??
    undefined;
  const routerType =
    coerceDisplayValue(metadata?.routerType) ??
    coerceDisplayValue(metadata?.router_type) ??
    undefined;

  return {
    key: `${entryKey}-manual-${slugify(normalizedPath)}-${slugify(componentName ?? "view")}`,
    path: normalizedPath,
    ...(componentName ? { component: componentName } : {}),
    ...(routerType ? { routerType } : {}),
    ...(filePath ? { filePath } : {}),
  };
}

function extractViewIdentifiers(
  value: Record<string, unknown>,
  metadata: Record<string, unknown>,
): Array<string | undefined> {
  const candidateIdentifiers: Array<string | undefined> = [
    coerceDisplayValue(metadata?.clientId) ?? undefined,
    coerceDisplayValue(metadata?.clientIdentifier) ?? undefined,
    coerceDisplayValue(metadata?.clientSlug) ?? undefined,
    coerceDisplayValue(metadata?.clientName) ?? undefined,
  ];

  if (metadata?.client && typeof metadata.client === "object") {
    const clientMeta = metadata.client as Record<string, unknown>;
    candidateIdentifiers.push(
      coerceDisplayValue(clientMeta.id) ?? undefined,
      coerceDisplayValue(clientMeta.identifier) ?? undefined,
      coerceDisplayValue(clientMeta.slug) ?? undefined,
      coerceDisplayValue(clientMeta.name) ?? undefined,
    );
  }

  const viewName = coerceDisplayValue(value?.name);
  if (viewName) {
    candidateIdentifiers.push(viewName, slugify(viewName));
  }

  return candidateIdentifiers;
}

function buildManualViewMap(
  entries: Array<[string, Record<string, unknown>]>,
): Map<string, NormalizedClientView[]> {
  const manualViewMap = new Map<string, NormalizedClientView[]>();

  const registerManualView = (candidate: string | undefined, view: NormalizedClientView) => {
    if (typeof candidate !== "string") return;
    const normalizedKey = candidate.trim().toLowerCase();
    if (!normalizedKey) return;
    const existing = manualViewMap.get(normalizedKey);
    const keySignature = `${view.path}|${view.component ?? ""}`.toLowerCase();
    if (existing) {
      if (
        !existing.some(
          (item) => `${item.path}|${item.component ?? ""}`.toLowerCase() === keySignature,
        )
      ) {
        existing.push(view);
      }
      return;
    }
    manualViewMap.set(normalizedKey, [view]);
  };

  entries.forEach(([entryKey, value]) => {
    const manualView = buildManualView(entryKey, value);
    if (!manualView) return;

    const metadata = (value?.metadata ?? {}) as Record<string, unknown>;
    const candidateIdentifiers = extractViewIdentifiers(value, metadata);

    candidateIdentifiers.forEach((identifier) => {
      if (!identifier) return;
      registerManualView(identifier, manualView);
      registerManualView(slugify(identifier), manualView);
    });
  });

  return manualViewMap;
}

export function extractClients(resolved: Record<string, unknown> | undefined): ExtractedClients {
  if (!resolved) {
    return { internalClients: [], externalClients: [] };
  }

  const spec = (resolved as any).spec ?? resolved;
  const componentsSource = (spec as any).components ?? (resolved as any).components ?? {};

  const entries = extractComponentEntries(componentsSource);
  const seenComponentKeys = new Set(entries.map(([key]) => key.toLowerCase()));

  const frontendPackages = Array.isArray((spec as any)?.frontend?.packages)
    ? (spec as any).frontend.packages
    : [];

  frontendPackages.forEach((pkg: FrontendPackage) => {
    if (!pkg || typeof pkg !== "object") return;
    const entry = processFrontendPackage(pkg, seenComponentKeys);
    if (entry) entries.push(entry);
  });

  const manualViewMap = buildManualViewMap(entries);

  const clients = entries
    .filter(([, value]) => {
      const type = coerceDisplayValue(value?.type);
      return type === "frontend";
    })
    .map(([key, value]) => normalizeClient(key, value, manualViewMap))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  const internalClients = clients.filter((client) => client.hasSource || isManualClient(client));
  const externalClients = clients
    .filter((client) => !(client.hasSource || isManualClient(client)))
    .map((client) => createExternalArtifactCard(client.identifier, client.raw));

  return { internalClients, externalClients };
}
