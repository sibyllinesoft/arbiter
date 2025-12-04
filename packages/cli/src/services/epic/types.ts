export interface EpicOptions {
  verbose?: boolean;
  format?: "table" | "json";
  status?: string;
  assignee?: string;
  priority?: string;
  shard?: string;
}

export interface EpicCreateOptions extends EpicOptions {
  name: string;
  description?: string;
  priority?: "critical" | "high" | "medium" | "low";
  owner?: string;
  assignee?: string;
  startDate?: string;
  dueDate?: string;
  labels?: string;
  tags?: string;
  allowParallelTasks?: boolean;
  autoProgress?: boolean;
  requireAllTasks?: boolean;
}

export interface TaskOptions {
  verbose?: boolean;
  format?: "table" | "json";
  status?: string;
  type?: string;
  assignee?: string;
  priority?: string;
  name?: string;
  description?: string;
  reviewer?: string;
  dependsOn?: string;
  acceptanceCriteria?: string;
  epic?: string;
  json?: string;
  file?: string;
  canRunInParallel?: boolean;
  requiresReview?: boolean;
  requiresTesting?: boolean;
  blocksOtherTasks?: boolean;
}

export interface TaskCreateOptions extends TaskOptions {
  epic: string;
  name?: string;
  description?: string;
  type?: "feature" | "bug" | "refactor" | "test" | "docs" | "devops" | "research";
  priority?: "critical" | "high" | "medium" | "low";
  assignee?: string;
  reviewer?: string;
  dependsOn?: string;
  acceptanceCriteria?: string;
  canRunInParallel?: boolean;
  requiresReview?: boolean;
  requiresTesting?: boolean;
  blocksOtherTasks?: boolean;
  // Batch creation support
  json?: string;
  file?: string;
}
