/**
 * Type definitions for CUE parser
 */
import type { DiagramComponent } from "../../types/architecture";

export type KnownWorkload = "deployment" | "statefulset" | "daemonset" | "job" | "cronjob";

export type NormalizedService = {
  id: string;
  name: string;
  data: Record<string, unknown>;
  kind: string;
};

export type ResourceComponentParams = {
  id: string;
  name: string;
  kind: string;
  layer: DiagramComponent["layer"];
  description?: string;
  metadata?: Record<string, unknown>;
  routePath?: string;
  size?: { width: number; height: number };
  capabilities?: string[];
};
