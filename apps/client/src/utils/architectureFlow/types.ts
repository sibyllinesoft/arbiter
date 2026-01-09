/**
 * Type definitions for architecture flow graph building
 */
import type { Edge, Node } from "reactflow";

export type DependencyNode = Node<{
  title: string;
  artifact: Record<string, unknown> | undefined;
  artifactType: string;
  description?: string | null;
}>;

export type DependencyEdge = Edge<{ label?: string }>;

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
