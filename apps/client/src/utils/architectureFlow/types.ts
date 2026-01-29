/**
 * Type definitions for architecture flow graph building
 */
import type { Edge, Node } from "reactflow";

export type DependencyNode = Node<{
  title: string;
  artifact: Record<string, unknown> | undefined;
  artifactType: string;
  description?: string | null;
  /** Whether this node is expanded (desktop metaphor) */
  isExpanded?: boolean | undefined;
  /** Callback to expand this node */
  onExpand?: (() => void) | undefined;
  /** Callback to collapse this node */
  onCollapse?: (() => void) | undefined;
  /** Callback to delete this node */
  onDelete?: (() => void) | undefined;
  /** Callback to rename this node */
  onRename?: ((newName: string) => void) | undefined;
}>;

export type DependencyEdge = Edge<{
  /** Display label for the edge */
  label?: string | undefined;
  /** Optional description/details for the relationship */
  description?: string | undefined;
  /** Callback to update the edge label */
  onLabelChange?: ((newLabel: string) => void) | undefined;
  /** Backend relationship entity ID for persistence */
  relationshipId?: string | undefined;
}>;

export type DeploymentGroup = {
  key: string;
  label: string;
  kind: "compose" | "kubernetes";
  artifact?: Record<string, unknown>;
  artifactType?: string;
  members: string[];
};

export type ArchitectureFlowGraph = {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  groups: Record<string, DeploymentGroup>;
};

export type BuilderHelpers = {
  deriveDeploymentGroup: (artifact: Record<string, unknown> | undefined) => DeploymentGroup | null;
  looksLikeDeploymentContainer: (
    artifact: Record<string, unknown> | undefined,
    artifactType: string,
    deploymentGroup: DeploymentGroup | null,
  ) => boolean;
};
