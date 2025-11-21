import type { FieldValue } from "@/components/modals/entityTypes";
import type { KeyValueEntry } from "@amalto/key-value-editor";
import { buildEnvironmentMap } from "./normalizers";
import type { ExternalArtifactCard, NormalizedEndpointCard, NormalizedService } from "./types";

export const buildEndpointInitialValues = (
  endpoint: NormalizedEndpointCard,
): Record<string, FieldValue> => {
  const data = (endpoint.data ?? {}) as Record<string, unknown>;
  const metadata = (data.metadata ?? {}) as Record<string, unknown>;

  const httpMethods = Array.isArray(data.httpMethods)
    ? (data.httpMethods as unknown[])
    : Array.isArray(metadata?.httpMethods)
      ? (metadata.httpMethods as unknown[])
      : [];
  const methodCandidate = httpMethods.find((value) => typeof value === "string") as
    | string
    | undefined;
  const method = methodCandidate ? methodCandidate.toUpperCase() : "GET";

  const rawPathCandidate =
    (typeof data.path === "string" && data.path) ||
    (typeof metadata.routePath === "string" && metadata.routePath) ||
    (typeof metadata.path === "string" && metadata.path) ||
    "/";
  const pathCandidate = rawPathCandidate?.toString().trim() || "/";

  const summaryCandidate =
    (typeof metadata.summary === "string" && metadata.summary) ||
    (typeof data.name === "string" && data.name) ||
    "";

  const descriptionCandidate =
    (typeof data.description === "string" && data.description) ||
    (typeof metadata.description === "string" && metadata.description) ||
    "";

  const operationIdCandidate =
    (typeof metadata.operationId === "string" && metadata.operationId) || "";

  const rawTags = (metadata as Record<string, unknown>).tags;
  const tagsCandidate = Array.isArray(rawTags)
    ? rawTags.filter((tag): tag is string => typeof tag === "string").map((tag) => tag)
    : typeof rawTags === "string"
      ? rawTags
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0)
      : [];

  const artifactIdCandidate =
    (typeof metadata.artifactId === "string" && metadata.artifactId) ||
    (typeof metadata.artifact_id === "string" && metadata.artifact_id) ||
    (typeof data.artifactId === "string" && data.artifactId) ||
    undefined;

  const initialValues: Record<string, FieldValue> = {
    method,
    path: pathCandidate,
    summary: summaryCandidate,
    description: descriptionCandidate,
    operationId: operationIdCandidate,
    tags: tagsCandidate,
  };

  if (artifactIdCandidate) {
    initialValues.artifactId = artifactIdCandidate;
  }

  return initialValues;
};

export const buildServiceInitialValues = (
  service: NormalizedService,
): Record<string, FieldValue> => {
  const metadata =
    service.raw &&
    typeof service.raw === "object" &&
    service.raw.metadata &&
    typeof service.raw.metadata === "object"
      ? (service.raw.metadata as Record<string, unknown>)
      : {};

  const values: Record<string, FieldValue> = {
    name: service.displayName || service.identifier,
  };

  const descriptionCandidate =
    service.description ||
    (typeof metadata.description === "string" && (metadata.description as string).trim()) ||
    undefined;
  if (descriptionCandidate) {
    values.description = descriptionCandidate;
  }

  const languageCandidate =
    (typeof service.raw?.language === "string" && service.raw.language.trim()) ||
    (typeof metadata.language === "string" && (metadata.language as string).trim()) ||
    service.metadataItems.find((item) => item.label === "Language")?.value ||
    undefined;
  if (languageCandidate) {
    values.language = languageCandidate;
  }

  const frameworkCandidate =
    (typeof service.raw?.framework === "string" && service.raw.framework.trim()) ||
    (typeof service.raw?.technology === "string" && service.raw.technology.trim()) ||
    (typeof metadata.framework === "string" && (metadata.framework as string).trim()) ||
    service.metadataItems.find((item) => item.label === "Technology")?.value ||
    undefined;
  if (frameworkCandidate) {
    values.framework = frameworkCandidate;
  }

  const environmentMap =
    service.environment && Object.keys(service.environment).length > 0
      ? service.environment
      : buildEnvironmentMap(service.raw);
  const environmentPairs: KeyValueEntry[] = Object.entries(environmentMap).map(([key, value]) => ({
    key,
    value: value ?? "",
  }));
  if (environmentPairs.length > 0) {
    values.environmentVariables = environmentPairs;
  }

  return values;
};

export const buildExternalServiceInitialValues = (
  card: ExternalArtifactCard,
): Record<string, FieldValue> => {
  const metadata =
    card.data?.metadata && typeof card.data.metadata === "object"
      ? (card.data.metadata as Record<string, unknown>)
      : {};
  const values: Record<string, FieldValue> = {
    name: card.name,
  };
  const descriptionCandidate =
    (typeof card.data?.description === "string" && card.data.description.trim()) || undefined;
  if (descriptionCandidate) {
    values.description = descriptionCandidate;
  }
  const languageCandidate =
    (typeof card.data?.language === "string" && card.data.language.trim()) ||
    (typeof metadata.language === "string" && (metadata.language as string).trim()) ||
    undefined;
  if (languageCandidate) {
    values.language = languageCandidate;
  }
  const frameworkCandidate =
    (typeof card.data?.framework === "string" && card.data.framework.trim()) ||
    (typeof metadata.framework === "string" && (metadata.framework as string).trim()) ||
    undefined;
  if (frameworkCandidate) {
    values.framework = frameworkCandidate;
  }

  return values;
};
