/**
 * C4 Model entity payload builders
 * Supports actors, clouds, and container-level entities for architecture diagrams
 */
import type { ManualArtifactPayload } from "./types";

/**
 * Build actor artifact payload (user, team, external system).
 */
export function buildActorPayload(
  values: Record<string, any>,
  _slug: string,
  name: string,
  description: string | null,
): ManualArtifactPayload {
  return {
    name,
    description,
    artifactType: "actor",
    metadata: {
      description,
      actorType: typeof values.actorType === "string" ? values.actorType : "user",
      classification: { detectedType: "actor", reason: "manual-entry", source: "user" },
    },
  };
}

/**
 * Build cloud artifact payload (AWS, GCP, Azure, Cloudflare, Vercel, etc.).
 */
export function buildCloudPayload(
  values: Record<string, any>,
  _slug: string,
  name: string,
  description: string | null,
): ManualArtifactPayload {
  const provider = typeof values.provider === "string" ? values.provider : "custom";
  return {
    name,
    description,
    artifactType: "cloud",
    metadata: {
      description,
      provider,
      region: typeof values.region === "string" ? values.region : undefined,
      classification: { detectedType: "cloud", reason: "manual-entry", source: "user" },
    },
  };
}

/**
 * Build API artifact payload.
 */
export function buildApiPayload(
  values: Record<string, any>,
  _slug: string,
  name: string,
  description: string | null,
): ManualArtifactPayload {
  return {
    name,
    description,
    artifactType: "api",
    language: typeof values.language === "string" ? values.language : undefined,
    framework: typeof values.framework === "string" ? values.framework : undefined,
    metadata: {
      description,
      protocol: typeof values.protocol === "string" ? values.protocol : "http",
      classification: { detectedType: "api", reason: "manual-entry", source: "user" },
    },
  };
}

/**
 * Build mobile app artifact payload.
 */
export function buildMobilePayload(
  values: Record<string, any>,
  _slug: string,
  name: string,
  description: string | null,
): ManualArtifactPayload {
  return {
    name,
    description,
    artifactType: "mobile",
    language: typeof values.language === "string" ? values.language : undefined,
    framework: typeof values.framework === "string" ? values.framework : undefined,
    metadata: {
      description,
      platform: typeof values.platform === "string" ? values.platform : "cross-platform",
      classification: { detectedType: "mobile", reason: "manual-entry", source: "user" },
    },
  };
}

/**
 * Build CLI tool artifact payload.
 */
export function buildCliPayload(
  values: Record<string, any>,
  _slug: string,
  name: string,
  description: string | null,
): ManualArtifactPayload {
  return {
    name,
    description,
    artifactType: "cli",
    language: typeof values.language === "string" ? values.language : undefined,
    metadata: {
      description,
      command: typeof values.command === "string" ? values.command : undefined,
      classification: { detectedType: "cli", reason: "manual-entry", source: "user" },
    },
  };
}

/**
 * Build worker artifact payload.
 */
export function buildWorkerPayload(
  values: Record<string, any>,
  _slug: string,
  name: string,
  description: string | null,
): ManualArtifactPayload {
  return {
    name,
    description,
    artifactType: "worker",
    language: typeof values.language === "string" ? values.language : undefined,
    metadata: {
      description,
      workerType: typeof values.workerType === "string" ? values.workerType : "background",
      classification: { detectedType: "worker", reason: "manual-entry", source: "user" },
    },
  };
}

/**
 * Build Kubernetes cluster artifact payload.
 */
export function buildKubernetesPayload(
  values: Record<string, any>,
  _slug: string,
  name: string,
  description: string | null,
): ManualArtifactPayload {
  return {
    name,
    description,
    artifactType: "kubernetes",
    metadata: {
      description,
      provider: typeof values.provider === "string" ? values.provider : undefined,
      version: typeof values.version === "string" ? values.version : undefined,
      classification: { detectedType: "kubernetes", reason: "manual-entry", source: "user" },
    },
  };
}

/**
 * Build cache artifact payload.
 */
export function buildCachePayload(
  values: Record<string, any>,
  _slug: string,
  name: string,
  description: string | null,
): ManualArtifactPayload {
  const engine = typeof values.engine === "string" ? values.engine : "redis";
  return {
    name,
    description,
    artifactType: "cache",
    framework: engine,
    metadata: {
      description,
      engine,
      classification: { detectedType: "cache", reason: "manual-entry", source: "user" },
    },
  };
}

/**
 * Build message queue artifact payload.
 */
export function buildQueuePayload(
  values: Record<string, any>,
  _slug: string,
  name: string,
  description: string | null,
): ManualArtifactPayload {
  const engine = typeof values.engine === "string" ? values.engine : "rabbitmq";
  return {
    name,
    description,
    artifactType: "queue",
    framework: engine,
    metadata: {
      description,
      engine,
      classification: { detectedType: "queue", reason: "manual-entry", source: "user" },
    },
  };
}

/**
 * Build storage artifact payload.
 */
export function buildStoragePayload(
  values: Record<string, any>,
  _slug: string,
  name: string,
  description: string | null,
): ManualArtifactPayload {
  return {
    name,
    description,
    artifactType: "storage",
    metadata: {
      description,
      storageType: typeof values.storageType === "string" ? values.storageType : "object",
      provider: typeof values.provider === "string" ? values.provider : undefined,
      classification: { detectedType: "storage", reason: "manual-entry", source: "user" },
    },
  };
}

/**
 * Build endpoint artifact payload.
 */
export function buildEndpointPayload(
  values: Record<string, any>,
  _slug: string,
  name: string,
  description: string | null,
): ManualArtifactPayload {
  return {
    name,
    description,
    artifactType: "endpoint",
    metadata: {
      description,
      method: typeof values.method === "string" ? values.method.toUpperCase() : "GET",
      path: typeof values.path === "string" ? values.path : undefined,
      classification: { detectedType: "endpoint", reason: "manual-entry", source: "user" },
    },
  };
}

/**
 * Build component artifact payload.
 */
export function buildComponentPayload(
  values: Record<string, any>,
  _slug: string,
  name: string,
  description: string | null,
): ManualArtifactPayload {
  return {
    name,
    description,
    artifactType: "component",
    language: typeof values.language === "string" ? values.language : undefined,
    metadata: {
      description,
      componentType: typeof values.componentType === "string" ? values.componentType : "ui",
      classification: { detectedType: "component", reason: "manual-entry", source: "user" },
    },
  };
}
