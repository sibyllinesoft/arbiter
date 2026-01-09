/**
 * GitHub sync helper functions.
 * Extracted from github-sync.ts for modularity.
 */

import type { GitHubSyncConfig } from "@/types.js";
import type { Group, Task } from "@/utils/github/sharded-storage.js";

/**
 * Generate milestone title for a group
 */
export function generateMilestoneTitle(group: Group): string {
  return `Group: ${group.name}`;
}

/**
 * Generate milestone description for a group
 */
export function generateMilestoneDescription(group: Group): string {
  let description = `<!-- arbiter-id: ${group.id} -->\n\n`;

  if (group.description) {
    description += `${group.description}\n\n`;
  }

  description += `Arbiter Group: ${group.name}\n`;
  description += `Tasks: ${group.tasks.length}\n`;

  if (group.estimatedHours) {
    const totalEstimated = group.tasks.reduce((sum, task) => sum + (task.estimatedHours || 0), 0);
    description += `Estimated Hours: ${totalEstimated}\n`;
  }

  return description;
}

/**
 * Map semantic labels to GitHub/GitLab platform labels
 */
export function mapSemanticLabels(
  config: GitHubSyncConfig,
  labels: string[],
  itemType: "group" | "task",
  item: Group | Task,
): string[] {
  const mappedLabels: string[] = [];

  // Add default labels from configuration
  if (config.labels?.default) {
    mappedLabels.push(...config.labels.default);
  }

  // Map semantic labels using configuration
  for (const label of labels) {
    // Check type-specific mappings first
    const typeSpecificLabels =
      itemType === "group" ? config.labels?.groups?.[label] : config.labels?.tasks?.[label];

    if (typeSpecificLabels) {
      mappedLabels.push(...typeSpecificLabels);
    } else {
      // Use label as-is if no mapping found
      mappedLabels.push(label);
    }
  }

  // Add contextual labels based on item properties
  if (itemType === "group") {
    const group = item as Group;
    mappedLabels.push(`priority:${group.priority}`);
    mappedLabels.push(`status:${group.status}`);
    mappedLabels.push("type:group");
  } else {
    const task = item as Task;
    mappedLabels.push(`priority:${task.priority}`);
    mappedLabels.push(`status:${task.status}`);
    mappedLabels.push(`type:${task.type}`);
  }

  // Add prefix labels if configured
  const prefix = itemType === "group" ? config.prefixes?.group : config.prefixes?.task;
  if (prefix) {
    mappedLabels.unshift(prefix);
  }

  // Remove duplicates and return
  return Array.from(new Set(mappedLabels)).filter((label) => label.trim() !== "");
}
