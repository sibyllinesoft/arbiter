/**
 * Types and interfaces for GitHub sync.
 * Extracted from github-sync.ts for modularity.
 */

import type { IssueSpec } from "@/types.js";
import type { Group, Task } from "@/utils/github/sharded-storage.js";

export interface GitHubIssue {
  number: number;
  title: string;
  body?: string;
  state: "open" | "closed";
  labels: string[];
  milestone?: {
    number: number;
    title: string;
  };
  assignee?: {
    login: string;
  };
}

/** Enhanced GitHub issue template based on exact issue schema */
export interface GitHubIssueTemplate extends IssueSpec {
  /** Additional GitHub-specific fields */
  assignees?: string[];
  milestone?: number;
  projects?: number[];
}

export interface GitHubMilestone {
  number: number;
  title: string;
  state: "open" | "closed";
  description?: string;
}

export interface SyncResult {
  action: "created" | "updated" | "skipped" | "closed";
  type: "group" | "task" | "milestone";
  itemId: string;
  githubNumber?: number;
  details?: string;
  /** External tracking info for updating local entities */
  external?: {
    source: "github";
    externalId: string;
    externalUrl: string;
    externalRepo: string;
  };
}

export interface SyncPreview {
  groups: {
    create: Group[];
    update: Array<{ group: Group; existing: GitHubIssue }>;
    close: Array<{ group: Group; existing: GitHubIssue }>;
  };
  tasks: {
    create: Task[];
    update: Array<{ task: Task; existing: GitHubIssue }>;
    close: Array<{ task: Task; existing: GitHubIssue }>;
  };
  milestones: {
    create: Group[];
    update: Array<{ group: Group; existing: GitHubMilestone }>;
    close: Array<{ group: Group; existing: GitHubMilestone }>;
  };
}

export interface SyncState {
  repository: { owner?: string; repo?: string };
  issues: Record<string, number>;
  milestones: Record<string, number>;
}

/**
 * Build a sync result for a single item
 */
function buildResult(
  action: SyncResult["action"],
  type: SyncResult["type"],
  item: { id: string; name: string },
): SyncResult {
  return {
    action,
    type,
    itemId: item.id,
    details: `Would ${action === "created" ? "create" : action === "updated" ? "update" : "close"} ${type}: ${item.name}`,
  };
}

/**
 * Process a category (groups, tasks, or milestones) and collect results
 */
function processCategory<T extends { id: string; name: string }>(
  category: {
    create: T[];
    update: Array<Record<string, unknown>>;
    close: Array<Record<string, unknown>>;
  },
  type: SyncResult["type"],
  itemKey: string,
): SyncResult[] {
  const results: SyncResult[] = [];

  category.create.forEach((item) => {
    results.push(buildResult("created", type, item));
  });

  category.update.forEach((entry) => {
    const item = entry[itemKey] as T;
    results.push(buildResult("updated", type, item));
  });

  category.close.forEach((entry) => {
    const item = entry[itemKey] as T;
    results.push(buildResult("closed", type, item));
  });

  return results;
}

/**
 * Convert preview to results format
 */
export function convertPreviewToResults(preview: SyncPreview): SyncResult[] {
  return [
    ...processCategory(preview.groups, "group", "group"),
    ...processCategory(preview.tasks, "task", "task"),
    ...processCategory(preview.milestones, "milestone", "group"),
  ];
}
