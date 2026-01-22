import { toSafeId } from "./helpers";
/**
 * Node registration logic for architecture flow graph
 */
import type { BuilderHelpers, DependencyNode, DeploymentGroup } from "./types";

export type NodeRegistryState = {
  nodes: DependencyNode[];
  idMap: Record<string, string>;
  groups: Record<string, DeploymentGroup>;
};

export function createNodeRegistry(helpers: BuilderHelpers): {
  state: NodeRegistryState;
  registerNode: (
    id: string,
    title: string,
    artifactType: string,
    artifact: Record<string, unknown> | undefined,
  ) => string | undefined;
} {
  const state: NodeRegistryState = {
    nodes: [],
    idMap: {},
    groups: {},
  };

  const registerNode = (
    id: string,
    title: string,
    artifactType: string,
    artifact: Record<string, unknown> | undefined,
  ): string | undefined => {
    const primaryId = id?.trim() || "node";
    const rawArtifactId =
      (artifact as Record<string, unknown>)?.artifactId ||
      (artifact as Record<string, unknown>)?.artifact_id;
    const artifactId = typeof rawArtifactId === "string" ? rawArtifactId : undefined;
    const nameKey = (artifact?.name ?? title ?? primaryId).toString().toLowerCase();

    const existingId =
      (artifactId && state.idMap[artifactId]) ||
      (nameKey && state.idMap[nameKey]) ||
      state.idMap[primaryId];
    if (existingId) return existingId;

    const nodeId = toSafeId(artifactType, primaryId);
    state.idMap[primaryId] = nodeId;
    if (artifactId) state.idMap[String(artifactId)] = nodeId;
    if (nameKey) state.idMap[nameKey] = nodeId;

    const deploymentGroup = helpers.deriveDeploymentGroup(artifact);
    const isDeploymentContainer = helpers.looksLikeDeploymentContainer(
      artifact,
      artifactType,
      deploymentGroup,
    );

    state.nodes.push({
      id: nodeId,
      type: "card",
      position: { x: 0, y: 0 },
      data: {
        title: title || id,
        artifact,
        artifactType,
        description:
          ((artifact as Record<string, unknown>)?.description as string | null) ??
          (((artifact as Record<string, unknown>)?.metadata as Record<string, unknown>)
            ?.description as string | null) ??
          null,
      },
    });

    if (deploymentGroup) {
      const existing = state.groups[deploymentGroup.key];

      const merged: DeploymentGroup = existing ?? {
        ...deploymentGroup,
        members: [] as string[],
        ...(isDeploymentContainer && artifact ? { artifact } : {}),
        ...(isDeploymentContainer && artifactType ? { artifactType } : {}),
      };

      if (isDeploymentContainer && artifact && !merged.artifact) {
        merged.artifact = artifact;
      }
      if (isDeploymentContainer && artifactType && !merged.artifactType) {
        merged.artifactType = artifactType;
      }

      merged.members.push(nodeId);
      state.groups[deploymentGroup.key] = merged;
    }
    return nodeId;
  };

  return { state, registerNode };
}
