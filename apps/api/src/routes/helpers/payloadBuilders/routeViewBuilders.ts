import { coerceOptionalTrimmedString, coerceStringArray } from "./shared";
/**
 * Route and View artifact payload builders
 */
import type { ManualArtifactPayload } from "./types";

/**
 * Build route artifact payload with path, methods, and operations.
 */
export function buildRoutePayload(
  values: Record<string, any>,
  _slug: string,
  name: string,
  description: string | null,
): ManualArtifactPayload {
  const pathValue = typeof values.path === "string" ? values.path.trim() : "/";
  const inferredMethod = coerceOptionalTrimmedString(values.method)?.toUpperCase();
  const methods = coerceStringArray(values.methods).map((m) => m.toUpperCase());
  if (inferredMethod && !methods.includes(inferredMethod)) methods.push(inferredMethod);
  const normalizedMethods = methods.length > 0 ? methods : ["GET"];

  let operations: Record<string, unknown> | undefined;
  const rawOperations = values.operations;
  if (rawOperations && typeof rawOperations === "object") {
    operations = rawOperations as Record<string, unknown>;
  } else if (inferredMethod) {
    const methodKey = inferredMethod.toLowerCase();
    const tags = coerceStringArray(values.tags);
    operations = {
      [methodKey]: {
        summary: coerceOptionalTrimmedString(values.summary),
        description: coerceOptionalTrimmedString(values.description),
        tags: tags.length > 0 ? tags : undefined,
        responses: values.responses,
        requestBody: values.requestBody,
      },
    };
  }

  return {
    name,
    description,
    artifactType: "route",
    metadata: {
      description,
      path: pathValue || "/",
      methods: normalizedMethods,
      ...(operations ? { operations } : {}),
      classification: { detectedType: "route", reason: "manual-entry", source: "user" },
    },
  };
}

/**
 * Build view artifact payload with path and component info.
 */
export function buildViewPayload(
  values: Record<string, any>,
  _slug: string,
  name: string,
  description: string | null,
): ManualArtifactPayload {
  const pathValue = coerceOptionalTrimmedString(values.path);
  const componentName = coerceOptionalTrimmedString(values.component);
  const filePathValue = coerceOptionalTrimmedString(values.filePath);
  const routerTypeValue = coerceOptionalTrimmedString(values.routerType);
  const clientId = coerceOptionalTrimmedString(values.clientId);
  const clientIdentifier = coerceOptionalTrimmedString(values.clientIdentifier) || clientId;
  const clientSlug = coerceOptionalTrimmedString(values.clientSlug);
  const clientName = coerceOptionalTrimmedString(values.clientName);

  const metadata: Record<string, unknown> = {
    description,
    path: pathValue,
    classification: { detectedType: "view", reason: "manual-entry", source: "user" },
  };

  if (componentName) metadata.component = componentName;
  if (filePathValue) {
    metadata.filePath = filePathValue;
    metadata.sourceFile = filePathValue;
  }
  if (routerTypeValue) metadata.routerType = routerTypeValue;

  if (clientId || clientIdentifier || clientSlug || clientName) {
    if (clientId) metadata.clientId = clientId;
    if (clientIdentifier) metadata.clientIdentifier = clientIdentifier;
    if (clientSlug) metadata.clientSlug = clientSlug;
    if (clientName) metadata.clientName = clientName;
    metadata.client = {
      ...(clientId ? { id: clientId } : {}),
      ...(clientIdentifier ? { identifier: clientIdentifier } : {}),
      ...(clientSlug ? { slug: clientSlug } : {}),
      ...(clientName ? { name: clientName } : {}),
    };
  }

  return { name, description, artifactType: "view", metadata };
}
