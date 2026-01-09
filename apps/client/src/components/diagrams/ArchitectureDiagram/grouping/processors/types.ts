/**
 * @module ArchitectureDiagram/grouping/processors/types
 * Shared types for component processors.
 */

import type { GroupedComponentGroup, GroupedComponentItem } from "../types";

/**
 * Context object passed to all processors.
 * Provides shared state and utility functions.
 */
export interface ProcessorContext {
  /** Map of group labels to their group objects */
  groups: Map<string, GroupedComponentGroup>;
  /** Set of task keys already recorded (for deduplication) */
  recordedTaskKeys: Set<string>;
  /** Set of artifact IDs that have been removed */
  removedArtifactIds: Set<string>;
  /** Check if an item should be excluded due to removal */
  isRemovedItem: (item: unknown) => boolean;
  /** Ensure a group exists and return it */
  ensureGroup: (type: string) => GroupedComponentGroup;
  /** Add an item to a group */
  addToGroup: (type: string, name: string, data: any) => void;
  /** Register a task with deduplication */
  registerTask: (
    rawTask: any,
    fallbackName: string,
    context?: { groupId?: string; groupName?: string },
  ) => void;
}

/**
 * Interface for data processors.
 */
export interface Processor {
  (projectData: any, ctx: ProcessorContext): void;
}
