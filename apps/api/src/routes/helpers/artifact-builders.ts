/**
 * Artifact transformation helpers for the resolved spec
 */
import path from "path";
import {
  type ControllerAnalysis,
  coerceText,
  extractControllerDetails,
  getContainerImage,
  getDatabaseType,
  getDatabaseVersion,
  getDefaultPort,
  resolveControllerPath,
  toSlug,
} from "./specs-helpers";

/**
 * Build service metadata from an artifact
 */
export function buildServiceMetadata(
  artifact: any,
  language: string,
  framework: string,
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    ...artifact.metadata,
    language,
    framework,
    workspaceMember: artifact.metadata?.workspaceMember,
    filePath: artifact.file_path,
    detected: true,
    originalImage: artifact.metadata?.containerImage,
    buildContext: artifact.metadata?.buildContext,
    dockerfilePath: artifact.metadata?.dockerfile,
    dockerfile: artifact.metadata?.dockerfile,
  };

  const dockerInfo = artifact.metadata?.docker;
  if (dockerInfo && typeof dockerInfo === "object") {
    metadata.docker = dockerInfo;
    const fields = [
      "composeServiceYaml",
      "composeService",
      "composeServiceName",
      "composeFile",
      "dockerfile",
      "buildContext",
      "dockerfilePath",
    ] as const;
    for (const field of fields) {
      const value = (dockerInfo as Record<string, unknown>)[
        field === "dockerfile" ? "dockerfile" : field
      ];
      if (value !== undefined && (typeof value === "string" ? value.trim() : true)) {
        metadata[field === "dockerfile" ? "dockerfileContent" : field] = value;
      }
    }
  }

  return metadata;
}

/**
 * Merge deployment artifacts into services
 */
export function mergeDeploymentsIntoServices(
  artifacts: any[],
  services: Record<string, any>,
): void {
  const serviceNames = new Set(
    artifacts.filter((a: any) => a.type === "service").map((a: any) => a.name),
  );
  const deploymentArtifacts = artifacts.filter((a: any) => a.type === "deployment");

  for (const dep of deploymentArtifacts) {
    if (serviceNames.has(dep.name)) {
      const serviceKey = dep.name.replace(/_/g, "-");
      if (services[serviceKey]) {
        services[serviceKey].metadata.deployment = {
          ...services[serviceKey].metadata.deployment,
          ...dep.metadata,
          type: "deployment",
          source: "inferred",
        };
      }
    }
  }
}

/**
 * Build services from artifacts
 */
export function buildServicesFromArtifacts(artifacts: any[]): Record<string, any> {
  const services: Record<string, any> = {};
  const serviceArtifacts = artifacts.filter((a: any) => a.type === "service");

  for (const artifact of serviceArtifacts) {
    const serviceName = artifact.name.replace(/_/g, "-");
    const language =
      coerceText(artifact.language) || coerceText(artifact.metadata?.language) || "unknown";
    const framework =
      coerceText(artifact.framework) || coerceText(artifact.metadata?.framework) || "unknown";
    const port = artifact.metadata?.port || getDefaultPort(language, framework);
    const imageToUse = artifact.metadata?.containerImage || getContainerImage(language);

    const metadata = buildServiceMetadata(artifact, language, framework);

    services[serviceName] = {
      name: artifact.name,
      type: "service",
      image: imageToUse,
      ports: [{ port, targetPort: port }],
      metadata,
    };
  }

  mergeDeploymentsIntoServices(artifacts, services);
  return services;
}

/**
 * Build databases from artifacts
 */
export function buildDatabasesFromArtifacts(artifacts: any[]): Record<string, any> {
  const databases: Record<string, any> = {};
  const databaseArtifacts = artifacts.filter((a: any) => a.type === "database");

  for (const artifact of databaseArtifacts) {
    const dbName = artifact.name.replace(/_/g, "-");
    const dbType = getDatabaseType(artifact.framework, artifact.name);
    const version = getDatabaseVersion(dbType, artifact.metadata?.version);

    databases[dbName] = {
      name: artifact.name,
      type: dbType,
      version,
      metadata: {
        ...artifact.metadata,
        configFile: artifact.metadata?.configFile,
        detected: true,
        language: artifact.language || "sql",
        framework: artifact.framework || dbType,
      },
    };
  }

  return databases;
}

/**
 * Normalize component type for an artifact
 */
export function normalizeComponentType(artifact: any): string {
  let componentType = artifact.type;
  const detectedType = String(
    artifact.metadata?.detectedType || artifact.metadata?.classification?.detectedType || "",
  ).toLowerCase();
  const classificationReason = artifact.metadata?.classification?.reason;
  const packageData = artifact.metadata?.package || {};
  const hasCliBin = Boolean(
    typeof packageData.bin === "string" ||
      (packageData.bin && Object.keys(packageData.bin).length > 0),
  );

  if (
    componentType === "binary" ||
    componentType === "cli" ||
    detectedType === "tool" ||
    detectedType === "binary" ||
    classificationReason === "manifest-bin" ||
    hasCliBin
  ) {
    componentType = "tool";
  }

  return componentType;
}

/**
 * Build components from artifacts
 */
export function buildComponentsFromArtifacts(
  artifacts: any[],
  _services: Record<string, any>,
): Record<string, any> {
  const components: Record<string, any> = {};
  const serviceNames = new Set(
    artifacts.filter((a: any) => a.type === "service").map((a: any) => a.name),
  );
  const otherArtifacts = artifacts.filter(
    (a: any) =>
      !["service", "database", "deployment"].includes(a.type) || !serviceNames.has(a.name),
  );

  for (const artifact of otherArtifacts) {
    if (artifact.type === "frontend" && artifact.metadata?.frontendAnalysis) continue;

    const baseName = artifact.name.replace(/_/g, "-");
    const componentKey =
      artifact.id ||
      (artifact.file_path
        ? `${baseName}-${artifact.file_path.replace(/[^a-z0-9]/gi, "-").slice(-50)}`
        : baseName);

    const componentType = normalizeComponentType(artifact);

    components[componentKey] = {
      name: artifact.name,
      type: componentType,
      description: artifact.description || artifact.metadata?.description || "",
      language: artifact.language || "unknown",
      framework: artifact.framework || "unknown",
      metadata: {
        ...artifact.metadata,
        workspaceMember: artifact.metadata?.workspaceMember,
        filePath: artifact.file_path,
        detected: true,
      },
    };
  }

  return components;
}

/**
 * Extract frontend packages from artifacts
 */
export function extractFrontendPackages(artifacts: any[]): any[] {
  return artifacts
    .filter((artifact: any) => artifact.metadata?.frontendAnalysis)
    .map((artifact: any) => {
      const analysis = artifact.metadata.frontendAnalysis as any;
      return {
        packageName: artifact.name,
        packageRoot: artifact.metadata?.root ?? ".",
        packageJsonPath: artifact.metadata?.sourceFile ?? "package.json",
        frameworks: analysis.frameworks || [],
        components: (analysis.components || []).map((c: any) => ({
          name: c.name,
          filePath: c.filePath || "",
          framework: c.framework,
          description: c.description,
          props: c.props,
        })),
        routes: (analysis.routers || []).flatMap((router: any) =>
          (router.routes || []).map((route: any) => ({
            path: route.path,
            filePath: route.filePath || "",
            routerType:
              router.type || router.routerType || analysis.frameworks?.[0] || "react-router",
          })),
        ),
      };
    });
}

/**
 * Build frontend routes from packages
 */
export function buildFrontendRoutes(frontendPackages: any[]): any[] {
  return frontendPackages.flatMap((pkg: any) =>
    (pkg.routes || []).map((route: any, idx: number) => {
      const safeIdSegment = (route.path || route.filePath || "route")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase();
      const id = `${pkg.packageName.replace(/[^a-zA-Z0-9]+/g, "-")}-${safeIdSegment || idx}`;
      const displayName = route.path || route.filePath || `${pkg.packageName} route`;
      return {
        id,
        path: route.path || "/",
        name: displayName,
        component: route.filePath || displayName,
        capabilities: [],
        type: "route",
        metadata: {
          packageName: pkg.packageName,
          packageRoot: pkg.packageRoot,
          routerType: route.routerType,
          filePath: route.filePath || null,
          source: "frontend-detection",
        },
      };
    }),
  );
}

/**
 * Build a controller route from a candidate
 */
async function buildControllerRoute(
  candidate: string,
  index: number,
  slugRoot: string,
  baseRoutePath: string,
  baseMetadata: any,
  tsoaSummary: any,
  artifact: any,
  analysis: any,
): Promise<{
  route: any;
  httpMethods: string[];
  endpoints: any[];
  controllerSourceAvailable: boolean;
} | null> {
  const normalized = candidate.split("\\").join("/");
  const fileName = normalized.split("/").pop() || normalized;
  const baseSegment = toSlug(
    fileName
      .replace(/\.[tj]sx?$/i, "")
      .replace(/controller$/i, "")
      .replace(/route$/i, ""),
  );
  const safeId = `${slugRoot}-${baseSegment || "controller"}-${index}`;
  const routePath = baseSegment
    ? `${baseRoutePath}/${baseSegment}`.replace(/\/+/g, "/")
    : baseRoutePath;

  const displayNameBase = fileName
    .replace(/\.[tj]sx?$/i, "")
    .replace(/controller$/i, "")
    .replace(/route$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
  const formatLabel = (v: string) =>
    v
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ");
  const displayName = displayNameBase
    ? formatLabel(displayNameBase)
    : formatLabel(artifact.name.replace(/^@[^/]+\//, ""));

  const candidateRoots = [
    analysis.root,
    artifact.metadata?.root,
    artifact.metadata?.packageRoot,
    path.dirname(artifact.file_path || ""),
  ].filter((v): v is string => typeof v === "string" && v.trim().length > 0);

  const controllerAbsolute = await resolveControllerPath(candidateRoots, normalized);
  const controllerDetails: ControllerAnalysis = controllerAbsolute
    ? await extractControllerDetails(controllerAbsolute)
    : { httpMethods: [], endpoints: [], tags: [] };

  const enrichedEndpoints = controllerDetails.endpoints.map((e) => ({
    ...e,
    controller: displayName,
  }));

  const route = {
    id: `backend-${safeId}`,
    path: routePath,
    name: displayName,
    component: normalized,
    capabilities: [],
    type: "route",
    metadata: {
      ...baseMetadata,
      controllerPath: normalized,
      filePath: normalized,
      displayName,
      routePath,
      httpMethods: controllerDetails.httpMethods,
      endpoints: enrichedEndpoints,
      routeDecorator: controllerDetails.routeDecorator,
      tags: controllerDetails.tags,
      controllerClass: controllerDetails.className,
      controllerSourceAvailable: Boolean(controllerAbsolute),
      tsoa: {
        ...tsoaSummary,
        controllerTags: controllerDetails.tags,
        controllerClass: controllerDetails.className,
        controllerSourceAvailable: Boolean(controllerAbsolute),
      },
    },
    displayLabel: displayName,
    httpMethods: controllerDetails.httpMethods,
    endpoints: enrichedEndpoints,
  };

  return {
    route,
    httpMethods: controllerDetails.httpMethods,
    endpoints: enrichedEndpoints,
    controllerSourceAvailable: Boolean(controllerAbsolute),
  };
}

/**
 * Build TSOA routes from an artifact's analysis
 */
async function buildTsoaRoutes(artifact: any, analysis: any): Promise<any[]> {
  const rawServiceName = artifact.name.replace(/^@[^/]+\//, "") || artifact.name;
  const slugRoot = toSlug(artifact.name) || "service";
  const serviceSlug = toSlug(rawServiceName) || slugRoot;
  const baseRoutePath = `/${serviceSlug}`.replace(/\/+/g, "/");

  const baseMetadata = {
    source: "tsoa",
    serviceName: artifact.name,
    serviceDisplayName: rawServiceName,
    packageName: rawServiceName,
    packageRoot: artifact.metadata?.root || ".",
    routerType: "tsoa",
    routeBasePath: baseRoutePath,
  };

  const tsoaSummary = {
    hasTsoaDependency: Boolean(analysis.hasTsoaDependency),
    recommendedCommands: Array.isArray(analysis.recommendedCommands)
      ? analysis.recommendedCommands
      : [],
    configFiles: Array.isArray(analysis.configFiles) ? analysis.configFiles.slice(0, 5) : [],
    scriptsUsingTsoa: Array.isArray(analysis.scriptsUsingTsoa) ? analysis.scriptsUsingTsoa : [],
    totalTypeScriptFiles: analysis.totalTypeScriptFiles ?? 0,
  };

  const controllerCandidates = Array.isArray(analysis.controllerCandidates)
    ? analysis.controllerCandidates
    : [];
  if (controllerCandidates.length === 0) return [];

  const routesForService: any[] = [
    {
      id: `backend-${slugRoot}-root`,
      path: baseRoutePath,
      name: baseRoutePath,
      component: `${rawServiceName} service`,
      capabilities: [],
      type: "route",
      metadata: {
        ...baseMetadata,
        displayName: "/",
        routePath: baseRoutePath,
        isBaseRoute: true,
        httpMethods: [],
        endpoints: [],
        tsoa: tsoaSummary,
      },
      displayLabel: "/",
      httpMethods: [],
      endpoints: [],
    },
  ];

  const aggregatedEndpoints: any[] = [];
  const aggregatedMethods = new Set<string>();
  let anyControllerSourceAvailable = false;

  for (const [index, candidate] of controllerCandidates.entries()) {
    const route = await buildControllerRoute(
      candidate,
      index,
      slugRoot,
      baseRoutePath,
      baseMetadata,
      tsoaSummary,
      artifact,
      analysis,
    );
    if (route) {
      if (route.controllerSourceAvailable) anyControllerSourceAvailable = true;
      route.httpMethods.forEach((m: string) => aggregatedMethods.add(m));
      route.endpoints.forEach((e: any) => aggregatedEndpoints.push(e));
      routesForService.push(route.route);
    }
  }

  routesForService[0].metadata.httpMethods = Array.from(aggregatedMethods);
  routesForService[0].metadata.endpoints = aggregatedEndpoints;
  routesForService[0].httpMethods = Array.from(aggregatedMethods);
  routesForService[0].endpoints = aggregatedEndpoints;
  routesForService[0].metadata.controllerSourceAvailable = anyControllerSourceAvailable;

  return routesForService;
}

/**
 * Build backend routes from artifacts
 */
export async function buildBackendRoutes(
  artifacts: any[],
  _services: Record<string, any>,
): Promise<any[]> {
  const backendRoutes: any[] = [];
  const serviceArtifacts = artifacts.filter((a: any) => a.type === "service");

  for (const artifact of serviceArtifacts) {
    const analysis = artifact.metadata?.tsoaAnalysis;
    if (!analysis) continue;

    const routesForService = await buildTsoaRoutes(artifact, analysis);
    backendRoutes.push(...routesForService);
  }

  return backendRoutes;
}
