import type { Project } from "../util/types";

export type DbProject = Project & {
  service_count: number;
  database_count: number;
  event_head_id?: string | null;
};

export type WithMetadata<T> = T & {
  metadata?: Record<string, unknown> | null;
};
