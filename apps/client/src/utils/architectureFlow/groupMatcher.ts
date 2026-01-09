/**
 * Compose group matching logic for architecture flow graph
 */
import type { DependencyNode, DeploymentGroup } from "./types";

/** Match and assign nodes to compose groups based on metadata */
export function matchNodesToComposeGroups(
  nodes: DependencyNode[],
  groups: Record<string, DeploymentGroup>,
): void {
  Object.values(groups).forEach((group) => {
    if (group.kind !== "compose") return;
    const memberSet = new Set<string>(group.members);

    nodes
      .filter((node) => shouldNodeJoinComposeGroup(node, group))
      .forEach((n) => memberSet.add(n.id));

    group.members = Array.from(memberSet);
  });
}

/** Determine if a node should join a compose group */
function shouldNodeJoinComposeGroup(node: DependencyNode, group: DeploymentGroup): boolean {
  const artifact = node.data?.artifact as Record<string, unknown> | undefined;
  const meta = (artifact?.metadata ?? {}) as Record<string, unknown>;
  const rawType = String(artifact?.type || meta?.type || "").toLowerCase();

  const nameCandidates = [
    artifact?.name,
    meta?.service,
    meta?.name,
    node.data?.title,
    node.id.split(":")[1],
  ]
    .map((v) => (typeof v === "string" ? v.trim() : null))
    .filter(Boolean) as string[];

  const groupArtifact = group.artifact as Record<string, unknown> | undefined;
  const groupMeta = (groupArtifact?.metadata ?? {}) as Record<string, unknown>;

  const composeFile =
    groupMeta?.composeFile || groupMeta?.compose_file || groupArtifact?.filePath || null;

  const composeServiceNames = Array.isArray(groupMeta?.services)
    ? ((groupMeta.services as Array<Record<string, unknown>>)
        .map((svc) => (typeof svc?.service === "string" ? svc.service.trim() : null))
        .filter(Boolean) as string[])
    : [];

  const sameComposeFile =
    composeFile &&
    [meta.composeFile, meta.compose_file, artifact?.filePath].some(
      (v) => typeof v === "string" && v.trim() === composeFile,
    );

  const hasComposeMetadata = Boolean(
    meta.composeService ||
      meta.composeServiceYaml ||
      meta.compose ||
      meta.compose_file ||
      meta.composeFile,
  );

  const listedInCompose = composeServiceNames.some((svc) =>
    nameCandidates.some((candidate) => candidate === svc || candidate.endsWith(`-${svc}`)),
  );

  const isServiceOrDb =
    ["service:", "database:"].some((prefix) => node.id.startsWith(prefix)) ||
    rawType === "service" ||
    rawType === "database";

  return isServiceOrDb && (sameComposeFile || listedInCompose || hasComposeMetadata);
}
