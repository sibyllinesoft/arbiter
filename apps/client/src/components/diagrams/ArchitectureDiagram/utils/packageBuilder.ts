/**
 * Package builder utilities for frontend and route components.
 * Converts grouped components into structured package representations.
 */
import type { GroupedComponentGroup, GroupedComponentItem } from "./componentGrouping";
import { normalizeRelativePath } from "./componentGrouping";

/** Parameter definition for a route endpoint */
interface RouteEndpointParameter {
  name: string;
  type?: string;
  optional: boolean;
  description?: string;
  decorators?: string[];
}

/** Response definition for a route endpoint */
interface RouteEndpointResponse {
  /** Decorator type (SuccessResponse or Response) */
  decorator: "SuccessResponse" | "Response";
  /** HTTP status code */
  status?: string;
  /** Response description */
  description?: string;
}

/** Documentation extracted from JSDoc comments */
interface RouteEndpointDocumentation {
  /** Brief summary line */
  summary?: string;
  /** Full description text */
  description?: string;
  /** Return value documentation */
  returns?: string;
  /** Additional remarks */
  remarks?: string[];
  /** Code examples */
  examples?: string[];
  /** Deprecation status or message */
  deprecated?: boolean | string;
}

/** Complete endpoint definition with method, path, and documentation */
export interface RouteEndpoint {
  method: string;
  path?: string;
  fullPath?: string;
  controller?: string;
  handler?: string;
  returnType?: string;
  signature: string;
  documentation?: RouteEndpointDocumentation;
  parameters: RouteEndpointParameter[];
  responses: RouteEndpointResponse[];
  tags?: string[];
  source?: { line: number };
}

/** Frontend package containing components and routes */
export interface FrontendPackage {
  packageName: string;
  packageRoot: string;
  frameworks: string[];
  components?: Array<{
    name: string;
    filePath: string;
    framework: string;
    description?: string;
    props?: any;
  }>;
  routes?: Array<{
    path: string;
    filePath?: string;
    treePath?: string;
    routerType?: string;
    displayLabel: string;
    httpMethods: string[];
    endpoints: RouteEndpoint[];
    metadata: any;
    isBaseRoute: boolean;
  }>;
}

/** Derived route information for tree positioning */
type RouteInfo = {
  routerType: string;
  controllerRelativePath: string;
  fullRoutePath: string;
  baseRoutePath: string;
  routeSegments: string[];
  baseSegments: string[];
  displayLabel: string;
  isBaseRoute: boolean;
};

/**
 * Normalize an endpoint value to the RouteEndpoint interface.
 * @param value - Raw endpoint data
 * @returns Normalized endpoint with defaults
 */
const normalizeEndpoint = (value: unknown): RouteEndpoint => {
  const base = (value ?? {}) as Partial<RouteEndpoint> & {
    method?: string;
    path?: string;
    controller?: string;
    fullPath?: string;
    handler?: string;
    returnType?: string;
    signature?: string;
    documentation?: Partial<RouteEndpoint["documentation"]>;
    parameters?: unknown;
    responses?: unknown;
    tags?: unknown;
    source?: unknown;
  };

  const normalizeParameters = (): RouteEndpoint["parameters"] => {
    if (!Array.isArray(base.parameters)) {
      return [];
    }
    return (base.parameters || []).map((parameter: any) => {
      const param = parameter as Partial<RouteEndpointParameter> & { name?: string };
      const normalized: RouteEndpointParameter = {
        name: String(param.name ?? "").trim() || "param",
        optional: Boolean(param.optional),
      };
      if (param.type !== undefined && param.type !== null) {
        normalized.type = String(param.type);
      }
      if (param.description !== undefined && param.description !== null) {
        normalized.description = String(param.description);
      }
      if (Array.isArray(param.decorators) && param.decorators.length > 0) {
        normalized.decorators = (param.decorators || []).map((dec: any) => String(dec));
      }
      return normalized;
    });
  };

  const normalizeResponses = (): RouteEndpoint["responses"] => {
    if (!Array.isArray(base.responses)) {
      return [];
    }
    return (base.responses || []).map((response: any) => {
      const res = response as Partial<RouteEndpointResponse>;
      const decorator: RouteEndpointResponse["decorator"] =
        res.decorator === "SuccessResponse" ? "SuccessResponse" : "Response";
      const normalized: RouteEndpointResponse = { decorator };
      if (res.status !== undefined && res.status !== null) {
        normalized.status = String(res.status);
      }
      if (res.description !== undefined && res.description !== null) {
        normalized.description = String(res.description);
      }
      return normalized;
    });
  };

  const documentation = (() => {
    const raw = base.documentation;
    if (!raw || typeof raw !== "object") {
      return undefined;
    }
    const payload: RouteEndpointDocumentation = {};
    if ((raw as any).summary !== undefined) {
      payload.summary = String((raw as any).summary);
    }
    if ((raw as any).description !== undefined) {
      payload.description = String((raw as any).description);
    }
    if ((raw as any).returns !== undefined) {
      payload.returns = String((raw as any).returns);
    }
    const remarks = Array.isArray((raw as any).remarks)
      ? (raw as any).remarks.map((entry: unknown) => String(entry))
      : [];
    if (remarks.length > 0) {
      payload.remarks = remarks;
    }
    const examples = Array.isArray((raw as any).examples)
      ? (raw as any).examples.map((entry: unknown) => String(entry))
      : [];
    if (examples.length > 0) {
      payload.examples = examples;
    }
    const deprecatedRaw = (raw as any).deprecated;
    if (typeof deprecatedRaw === "string") {
      payload.deprecated = deprecatedRaw;
    } else if (deprecatedRaw === true) {
      payload.deprecated = true;
    }
    return Object.keys(payload).length > 0 ? payload : undefined;
  })();

  const handler = base.handler ? String(base.handler) : undefined;
  const returnType = base.returnType ? String(base.returnType) : undefined;
  const defaultSignature = `${handler ?? "handler"}()${returnType ? `: ${returnType}` : ""}`;

  const tags = Array.isArray(base.tags) ? base.tags.map((tag: any) => String(tag)) : [];

  const source = (() => {
    const raw = base.source as { line?: unknown } | undefined;
    if (raw && typeof raw.line === "number") {
      return { line: raw.line };
    }
    if (raw && typeof raw.line === "string" && raw.line.trim().length > 0) {
      const parsed = Number.parseInt(raw.line, 10);
      if (!Number.isNaN(parsed)) {
        return { line: parsed };
      }
    }
    return undefined;
  })();

  const endpoint: RouteEndpoint = {
    method: String(base.method ?? "GET").toUpperCase(),
    signature: base.signature ? String(base.signature) : defaultSignature,
    parameters: normalizeParameters(),
    responses: normalizeResponses(),
  };

  if (base.path !== undefined && base.path !== null) {
    endpoint.path = String(base.path);
  }
  if (base.fullPath !== undefined && base.fullPath !== null) {
    endpoint.fullPath = String(base.fullPath);
  }
  if (base.controller !== undefined && base.controller !== null) {
    endpoint.controller = String(base.controller);
  }
  if (handler) {
    endpoint.handler = handler;
  }
  if (returnType) {
    endpoint.returnType = returnType;
  }
  if (documentation) {
    endpoint.documentation = documentation;
  }
  if (tags.length > 0) {
    endpoint.tags = tags;
  }
  if (source) {
    endpoint.source = source;
  }

  return endpoint;
};

/**
 * Format a label string for display.
 * @param value - Label to format
 * @returns Formatted label
 */
const formatLabel = (value: string): string => value;

/**
 * Split a path into segments, removing leading slashes.
 * @param value - Path string to split
 * @returns Array of path segments
 */
const splitSegments = (value: string): string[] =>
  value.replace(/^\/+/, "").split("/").filter(Boolean);

/**
 * Normalize a route path to a consistent format.
 * @param value - Raw path value
 * @returns Normalized path with leading slash
 */
const normalizeRoutePath = (value: unknown): string => {
  if (value === undefined || value === null) return "";
  const trimmed = String(value).trim();
  if (trimmed === "") return "";
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const collapsed = withLeadingSlash.replace(/\/+/g, "/");
  if (collapsed.length > 1 && /\/+$/.test(collapsed)) {
    return collapsed.replace(/\/+$/, "");
  }
  return collapsed;
};

/**
 * Extract a route identifier from a component item.
 * @param item - Grouped component item
 * @returns Route identifier string or undefined
 */
const getRouteIdentifier = (item: GroupedComponentItem): string | undefined => {
  const metadata = item.data.metadata || {};
  const candidate =
    item.data.path ||
    metadata.routePath ||
    metadata.displayLabel ||
    item.data.displayLabel ||
    item.data.name ||
    item.name;
  if (!candidate) {
    return undefined;
  }
  const trimmed = String(candidate).trim();
  return trimmed === "" ? undefined : trimmed;
};

/**
 * Derive route information from a component item.
 * @param item - Grouped component item
 * @returns Derived route info with paths and display label
 */
const deriveRouteInfo = (item: GroupedComponentItem): RouteInfo => {
  const metadata = item.data.metadata || {};
  const routerType = String(metadata.routerType || item.data.routerType || "").toLowerCase();
  const packageRoot = metadata.packageRoot || metadata.root || "";
  const rawFilePath = metadata.controllerPath || metadata.filePath || item.data.filePath || "";
  const controllerRelativePath = normalizeRelativePath(rawFilePath, packageRoot || "");
  const routeBasePath = normalizeRoutePath(metadata.routeBasePath);
  const routePathCandidate =
    metadata.routePath || metadata.path || item.data.path || getRouteIdentifier(item) || "";
  const normalizedRoutePath = normalizeRoutePath(routePathCandidate);
  const fullRoutePath = normalizedRoutePath || routeBasePath || "/";
  const routeSegments = splitSegments(fullRoutePath);
  const baseSegments = routeBasePath ? splitSegments(routeBasePath) : [];
  const isBaseRoute =
    Boolean(metadata.isBaseRoute) ||
    (baseSegments.length > 0 &&
      routeSegments.length === baseSegments.length &&
      baseSegments.every((segment, index) => routeSegments[index] === segment));
  const metadataDisplayLabel =
    typeof metadata.displayLabel === "string" ? metadata.displayLabel : null;
  const displayLabel =
    metadataDisplayLabel && metadataDisplayLabel.trim().length > 0
      ? metadataDisplayLabel
      : isBaseRoute
        ? "/"
        : fullRoutePath || "/";
  return {
    routerType,
    controllerRelativePath,
    fullRoutePath,
    baseRoutePath: routeBasePath,
    routeSegments,
    baseSegments,
    displayLabel,
    isBaseRoute,
  };
};

/**
 * Build frontend packages from a grouped component group.
 * @param group - Component group to transform
 * @returns Array of frontend packages with components and routes
 */
export const buildPackagesFromGroup = (group: GroupedComponentGroup): FrontendPackage[] => {
  const packages = new Map<string, FrontendPackage>();

  const ensurePackage = (item: GroupedComponentItem, routeInfo?: RouteInfo): FrontendPackage => {
    const metadata = item.data.metadata || {};
    const filePath = String(metadata.filePath || item.data.filePath || "");
    const packageRoot = metadata.packageRoot || metadata.root || "";
    const rawServiceName = String(
      metadata.serviceDisplayName || metadata.serviceName || metadata.packageName || "",
    ).replace(/^@[^/]+\//, "");
    const routeIdentifier = getRouteIdentifier(item);
    const normalizedServiceName = rawServiceName.trim();

    const metadataPackageName = String(
      metadata.packageName || metadata.serviceDisplayName || metadata.serviceName || "",
    ).trim();

    let packageKey: string | undefined;

    if (group.treeMode === "routes") {
      if (metadataPackageName) {
        packageKey = metadataPackageName;
      } else if (normalizedServiceName) {
        packageKey = normalizedServiceName;
      } else if (routeInfo?.baseRoutePath && routeInfo.baseRoutePath !== "/") {
        packageKey = routeInfo.baseRoutePath;
      } else if (metadata.packageRoot) {
        packageKey = String(metadata.packageRoot);
      } else if (routeInfo?.routeSegments.length) {
        packageKey = routeInfo.routeSegments[0];
      } else if (routeIdentifier) {
        packageKey = routeIdentifier;
      } else {
        packageKey = "/";
      }
    } else {
      packageKey =
        metadataPackageName ||
        normalizedServiceName ||
        metadata.packageName ||
        metadata.root ||
        (filePath.includes("/") ? filePath.split("/")[0] : filePath);
    }

    if (!packageKey) {
      packageKey =
        group.treeMode === "routes" ? routeIdentifier || item.name || "/routes" : group.label;
    }

    const normalizeRoutesPackageKey = (value: string): string => {
      const trimmed = value.trim();
      if (!trimmed) {
        return "/";
      }
      if (trimmed === "/") {
        return "/";
      }
      return trimmed.replace(/^\/+/, "").replace(/\/+$/, "") || trimmed;
    };

    let normalizedPackageKey = String(packageKey || "Routes").trim();
    if (group.treeMode === "routes") {
      normalizedPackageKey = normalizeRoutesPackageKey(normalizedPackageKey);
    }
    if (!normalizedPackageKey) {
      normalizedPackageKey =
        group.treeMode === "routes" ? "/" : formatLabel(group.label || "Group");
    }

    const packageDisplayName =
      group.treeMode === "routes" ? normalizedPackageKey : formatLabel(normalizedPackageKey);

    if (!packages.has(normalizedPackageKey)) {
      const frameworks = new Set<string>();
      if (metadata.framework) {
        frameworks.add(metadata.framework);
      }

      packages.set(normalizedPackageKey, {
        packageName: packageDisplayName,
        packageRoot,
        frameworks: Array.from(frameworks),
        components: [],
        routes: [],
      });
    }

    const pkg = packages.get(normalizedPackageKey)!;
    if (metadata.framework && !pkg.frameworks.includes(metadata.framework)) {
      pkg.frameworks.push(metadata.framework);
    }
    return pkg;
  };

  group.items.forEach((item: GroupedComponentItem) => {
    const metadata = item.data.metadata || {};
    const routeInfo = group.treeMode === "routes" ? deriveRouteInfo(item) : null;
    const pkg = ensurePackage(item, routeInfo ?? undefined);

    if (group.treeMode === "routes" && routeInfo) {
      const info = routeInfo;
      const treeSegments = (() => {
        if (info.isBaseRoute) {
          return [] as string[];
        }
        if (info.routerType === "tsoa" && info.baseSegments.length > 0) {
          const matchesBase = info.baseSegments.every(
            (segment, index) => info.routeSegments[index] === segment,
          );
          if (matchesBase) {
            return info.routeSegments.slice(info.baseSegments.length);
          }
        }
        return info.routeSegments;
      })();
      const treePath = treeSegments.join("/");

      pkg.routes = pkg.routes || [];
      const displayLabel =
        info.routerType === "tsoa" && treeSegments.length > 0
          ? `/${treeSegments.join("/")}`
          : info.displayLabel;
      const routePathForDisplay = info.isBaseRoute ? "/" : info.fullRoutePath;
      const httpMethods = Array.isArray(metadata.httpMethods)
        ? metadata.httpMethods.map((method: unknown) => String(method).toUpperCase())
        : Array.isArray((item.data as any)?.httpMethods)
          ? (item.data as any).httpMethods.map((method: unknown) => String(method).toUpperCase())
          : [];
      const rawEndpoints = Array.isArray(metadata.endpoints) ? metadata.endpoints : [];
      const endpoints = rawEndpoints.map(normalizeEndpoint);
      const routerTypeNormalized = ((metadata.routerType as string) || info.routerType || "")
        .toString()
        .toLowerCase();
      const noiseKeywords = [
        "dockerfile-container",
        "nats-compose",
        "spec-workbench-compose",
        "api-types",
      ];
      const lowerPackageName = pkg.packageName.toLowerCase();
      const lowerDisplayLabel = (displayLabel || "").toLowerCase();
      const lowerRoutePath = (info.fullRoutePath || "").toLowerCase();
      const isNoise =
        !info.isBaseRoute &&
        noiseKeywords.some((keyword) => {
          const lower = keyword.toLowerCase();
          return (
            lowerPackageName.includes(lower) ||
            lowerDisplayLabel.includes(lower) ||
            lowerRoutePath.includes(lower)
          );
        });

      if (isNoise) {
        return;
      }

      const routeMetadata = {
        ...metadata,
        httpMethods,
        endpoints,
      };
      pkg.routes.push({
        path: routePathForDisplay,
        filePath: info.controllerRelativePath,
        treePath,
        routerType: (metadata.routerType as string | undefined) || info.routerType,
        displayLabel: displayLabel || routePathForDisplay,
        httpMethods,
        endpoints,
        metadata: routeMetadata,
        isBaseRoute: info.isBaseRoute,
      });
    } else {
      const filePath = normalizeRelativePath(
        metadata.filePath || item.data.filePath || "",
        pkg.packageRoot || "",
      );
      pkg.components = pkg.components || [];
      pkg.components.push({
        name: item.data.name || item.name,
        filePath,
        framework: metadata.framework || "",
        description: item.data.description || metadata.description,
        props: item.data.props,
      });
    }
  });

  return Array.from(packages.values()).map((pkg) => {
    if (!pkg.components || pkg.components.length === 0) {
      delete pkg.components;
    }
    if (!pkg.routes || pkg.routes.length === 0) {
      delete pkg.routes;
    }
    return pkg;
  });
};
