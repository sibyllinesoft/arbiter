import type { Edge, Node } from "reactflow";

export type UnknownRecord = Record<string, unknown>;

export type ResolvedSpec = UnknownRecord & {
  spec?: UnknownRecord;
};

export interface NormalizedTask {
  /** Original identifier (if supplied) */
  rawId: string;
  /** Human friendly display name */
  name: string;
  /** Normalized slug used for dependency matching */
  slug: string;
  /** Optional status (lowercased) */
  status?: string;
  /** Optional assignee or owner */
  assignee?: string;
  /** Optional priority */
  priority?: string;
  /** Optional description */
  description?: string;
  /** Dependency strings as provided */
  dependsOn: string[];
  /** Stable node identifier for graph rendering */
  nodeId: string;
  /** Graph status class derived from task status */
  statusClass: string;
  /** Whether the task appears to be completed */
  completed: boolean;
  /** Keys that can resolve this task during dependency matching */
  matchKeys: string[];
  /** Backing artifact identifier when available */
  artifactId?: string;
  /** Associated group identifier if scoped */
  groupId?: string | null;
  /** Associated group display name if scoped */
  groupName?: string;
}

export interface NormalizedTaskGroup {
  /** Stable identifier used for tab routing and dependency mapping */
  id: string;
  /** Raw identifier preserved from the source data */
  rawId?: string;
  /** Backing artifact identifier when available */
  artifactId?: string | null;
  /** Human-friendly label */
  name: string;
  /** Optional descriptive text */
  description?: string;
  /** Normalized tasks contained within the group */
  tasks: NormalizedTask[];
  /** Group type - either dedicated group or global unscoped tasks */
  type: "group" | "unscoped";
  /** Slug match keys to correlate tasks with this group */
  matchKeys: string[];
}

export interface TaskNodeData {
  task: NormalizedTask;
  isSelected: boolean;
}

export interface NormalizeTaskArgs {
  value: unknown;
  key: string;
  index: number;
  nodePrefix: string;
  groupContext?: { id?: string | null; slug: string; name: string };
}

export interface TaskGroupPanelProps {
  group: NormalizedTaskGroup;
  isActive: boolean;
  onTaskClick: (task: NormalizedTask) => void;
  onGroupEdit?: (group: NormalizedTaskGroup) => void;
}

export interface TaskFlowData {
  nodes: Node<TaskNodeData>[];
  edges: Edge[];
  missingDependencies: string[];
}

export interface TasksDiagramProps {
  projectId: string;
  className?: string;
}

export interface TasksDiagramHandle {
  openTaskCreator: () => void;
  openGroupCreator: () => void;
}

export interface TaskDetailCardProps {
  task: NormalizedTask;
}

export interface TaskFlowProps {
  nodes: Node<TaskNodeData>[];
  edges: Edge[];
  onSelectTask: (task: NormalizedTask | null) => void;
  width: number;
  height: number;
  onTaskClick: (task: NormalizedTask) => void;
}
