import { coerceOptionalTrimmedString } from "./shared";
/**
 * Frontend artifact payload builder
 */
import type { ManualArtifactPayload } from "./types";

/**
 * Build frontend artifact metadata from form values.
 */
function buildFrontendArtifactMetadata(values: Record<string, any>, slug: string) {
  const framework = coerceOptionalTrimmedString(values.framework);
  const frameworks = framework ? [framework] : [];
  const rawEntryPoint = coerceOptionalTrimmedString(values.entryPoint);
  const packageRoot =
    coerceOptionalTrimmedString(values.packageRoot) ||
    (rawEntryPoint && rawEntryPoint.includes("/")
      ? rawEntryPoint.split("/").slice(0, -1).join("/") || `clients/${slug}`
      : `clients/${slug}`);

  const entryPoint = rawEntryPoint
    ? rawEntryPoint.startsWith(`${packageRoot}/`)
      ? rawEntryPoint.slice(packageRoot.length + 1)
      : rawEntryPoint
    : undefined;

  const routerRoutes = entryPoint
    ? [{ path: "/", filePath: entryPoint, routerType: "frontend" }]
    : [];

  return {
    packageRoot,
    frameworks,
    entryPoint,
    frontendAnalysis: {
      frameworks,
      components: [],
      routers: routerRoutes.length
        ? [{ type: "frontend", routerType: "frontend", routes: routerRoutes }]
        : [],
    },
  };
}

/**
 * Build complete frontend artifact payload.
 */
export function buildFrontendPayload(
  values: Record<string, any>,
  slug: string,
  name: string,
  description: string | null,
): ManualArtifactPayload {
  const metadata = buildFrontendArtifactMetadata(values, slug);
  const framework = metadata.frameworks?.[0];
  const entryPoint = metadata.entryPoint;

  return {
    name,
    description,
    artifactType: "frontend",
    language: "typescript",
    framework,
    metadata: {
      description,
      root: metadata.packageRoot,
      sourceFile: entryPoint ? `${metadata.packageRoot}/${entryPoint}` : undefined,
      frontendAnalysis: metadata.frontendAnalysis,
      classification: { detectedType: "frontend", reason: "manual-entry", source: "user" },
    },
    filePath: entryPoint ? `${metadata.packageRoot}/${entryPoint}` : undefined,
  };
}
