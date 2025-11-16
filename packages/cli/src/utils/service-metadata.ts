import type { ServiceConfig } from "@arbiter/shared-types/cli";

const WORKLOAD_VALUES = new Set(["deployment", "statefulset", "daemonset", "job", "cronjob"]);

function isWorkload(value: unknown): value is string {
  return typeof value === "string" && WORKLOAD_VALUES.has(value);
}

export function resolveServiceWorkload(
  service: Partial<ServiceConfig> | undefined,
): string | undefined {
  if (!service) return undefined;
  const candidates = [
    service.workload,
    (service as any).legacyWorkload,
    (service as any).legacyType,
  ];
  for (const candidate of candidates) {
    if (isWorkload(candidate)) return candidate;
  }
  if (isWorkload((service as any).mode)) return (service as any).mode;
  if (isWorkload((service as any).runtime)) return (service as any).runtime;
  if (isWorkload((service as any).execution)) return (service as any).execution;
  if (isWorkload((service as any).deploymentKind)) return (service as any).deploymentKind;
  if (isWorkload((service as any).type)) return (service as any).type;
  return undefined;
}

export function resolveServiceArtifactType(
  service: Partial<ServiceConfig> | undefined,
): "internal" | "external" {
  if (!service) return "internal";
  const explicit = (service.type ||
    service.artifactType ||
    (service as any).serviceType ||
    (service as any).legacyServiceType) as string | undefined;

  if (explicit === "internal" || explicit === "external") {
    return explicit;
  }

  const source = service.source as Record<string, unknown> | undefined;
  if (source && typeof source === "object") {
    const kind = String(source.kind || "").toLowerCase();
    if (kind === "monorepo") {
      return "internal";
    }
    if (kind) {
      return "external";
    }
  }

  if (service.sourceDirectory) {
    return "internal";
  }

  if (service.image && !source) {
    return "external";
  }

  return "internal";
}

export function isInternalService(service: Partial<ServiceConfig> | undefined): boolean {
  if (!service) return true;
  if (service.type === "internal") return true;
  if (service.type === "external") return false;
  return resolveServiceArtifactType(service) === "internal";
}

export function ensureWorkload(service: Partial<ServiceConfig>, fallback: string): string {
  return resolveServiceWorkload(service) ?? fallback;
}
