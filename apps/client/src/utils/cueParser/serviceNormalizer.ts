/**
 * Service normalization for CUE architecture data
 */
import type { CueArchitectureData } from "../../types/architecture";
import { isRecord, normalizeKind } from "./helpers";
import type { NormalizedService } from "./types";

/** Normalize services from CUE data into a consistent format */
export function normalizeServices(cueData: CueArchitectureData): NormalizedService[] {
  const services: NormalizedService[] = [];

  const collect = (source: unknown, defaultKind: string, prefix: string) => {
    if (!source) return;
    if (isRecord(source)) {
      Object.entries(source).forEach(([id, raw]) => {
        const data = (raw || {}) as Record<string, unknown>;
        const kind = normalizeKind(data, defaultKind);
        const name = (data.name as string) || id;
        services.push({ id, name, data, kind });
      });
    } else if (Array.isArray(source)) {
      source.forEach((entry, idx) => {
        const data = (entry || {}) as Record<string, unknown>;
        const id = (data.id as string) || (data.name as string) || `${prefix}_${idx + 1}`;
        const kind = normalizeKind(data, defaultKind);
        const name = (data.name as string) || id;
        services.push({ id, name, data, kind });
      });
    }
  };

  // Collect packages
  collect((cueData as any).packages, "package", "package");

  // Common service-like collections collapsed into services
  const infra = (cueData.infrastructure ?? {}) as Record<string, unknown>;
  collect(infra.databases ?? infra.database, "database", "database");
  collect(infra.datastores, "database", "datastore");
  collect(infra.caches ?? infra.cache, "cache", "cache");
  collect(
    infra.queues ?? infra.queue ?? infra.message_queue ?? infra.message_queues,
    "queue",
    "queue",
  );
  collect(infra.proxies, "proxy", "proxy");
  collect(infra.load_balancers ?? infra.loadBalancer, "load_balancer", "lb");

  const networking = infra.networking as Record<string, unknown> | undefined;
  if (networking) {
    collect(networking.load_balancer ?? networking.load_balancers, "load_balancer", "lb");
    collect(networking.proxies, "proxy", "proxy");
    collect(networking.cdn, "cdn", "cdn");
  }

  return services;
}
