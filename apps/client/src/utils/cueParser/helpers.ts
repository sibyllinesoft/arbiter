/**
 * Helper utilities for CUE parsing
 */
import type { DiagramComponent, DiagramPort } from "../../types/architecture";
import type { KnownWorkload } from "./types";

const WORKLOAD_VALUES = new Set<KnownWorkload>([
  "deployment",
  "statefulset",
  "daemonset",
  "job",
  "cronjob",
]);

export const isWorkload = (value: unknown): value is KnownWorkload =>
  typeof value === "string" && WORKLOAD_VALUES.has(value as KnownWorkload);

export const deriveWorkload = (serviceData: Record<string, unknown>): KnownWorkload | undefined => {
  if (isWorkload(serviceData.workload)) {
    return serviceData.workload;
  }
  if (isWorkload(serviceData.mode)) {
    return serviceData.mode;
  }
  if (isWorkload(serviceData.type)) {
    return serviceData.type;
  }
  return undefined;
};

export const deriveArtifactType = (
  serviceData: Record<string, unknown>,
): "internal" | "external" => {
  const raw =
    serviceData.type ?? serviceData.artifactType ?? serviceData.serviceType ?? serviceData.category;
  if (raw === "internal" || raw === "external") {
    return raw;
  }
  if (raw === "bespoke") {
    return "internal";
  }
  if (raw === "prebuilt") {
    return "external";
  }
  const source = serviceData.source as Record<string, unknown> | undefined;
  if (serviceData.sourceDirectory || source?.kind === "monorepo") {
    return "internal";
  }
  if (serviceData.image || source?.kind) {
    return "external";
  }
  return "internal";
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const normalizeKind = (value: Record<string, unknown>, fallback: string): string => {
  const candidate =
    value.kind ??
    value.class ??
    value.serviceClass ??
    value.service_type ??
    value.category ??
    value.role ??
    value.type;
  if (typeof candidate === "string" && candidate.trim().length > 0) {
    return candidate.trim();
  }
  return fallback;
};

export const deriveServiceLayer = (kind?: string): DiagramComponent["layer"] => {
  const lower = (kind || "").toLowerCase();
  if (["database", "datastore", "db", "kv", "kv_store", "cache"].includes(lower)) {
    return "data";
  }
  if (["proxy", "load_balancer", "cdn"].includes(lower)) {
    return "service";
  }
  return "service";
};

export const parseServicePorts = (serviceData: Record<string, unknown>): DiagramPort[] => {
  const ports = serviceData.ports as Array<Record<string, unknown>> | undefined;
  if (!ports) return [];

  return ports.map((port, index) => ({
    id: `port_${port.name || index}`,
    position: { x: 40 + index * 30, y: 100 },
    type: "bidirectional" as const,
    protocol: (port.protocol as DiagramPort["protocol"]) || "http",
  }));
};
