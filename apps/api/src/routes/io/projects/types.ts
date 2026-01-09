import type { EventService } from "../../../io/events";
/**
 * Type definitions for project routes
 */
import type { SpecWorkbenchDB } from "../../../util/db";

export type Dependencies = Record<string, unknown>;

export type ProjectDeps = {
  db: SpecWorkbenchDB | undefined;
  events: EventService | undefined;
};
