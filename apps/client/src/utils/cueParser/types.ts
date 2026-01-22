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
  description?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
  routePath?: string | undefined;
  size?: { width: number; height: number } | undefined;
  capabilities?: string[] | undefined;
};
