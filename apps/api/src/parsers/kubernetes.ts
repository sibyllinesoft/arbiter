/**
 * Kubernetes manifest parser.
 * Extracts resource kinds and names from Kubernetes YAML manifests.
 */
import path from "node:path";
import YAML from "js-yaml";
import type { FileParser } from "./base";
import { isInfrastructureYaml } from "./helpers";

/**
 * Parser for Kubernetes manifest files (.yaml, .yml).
 * Parses multi-document YAML files and extracts resource summaries.
 */
export const kubernetesParser: FileParser = {
  name: "kubernetes",
  priority: 5,
  matches: (filePath) => {
    const base = path.basename(filePath).toLowerCase();
    if (!(base.endsWith(".yaml") || base.endsWith(".yml"))) return false;
    return isInfrastructureYaml(base);
  },
  parse: (content, context) => {
    const artifact = context.artifact;
    if (!artifact) return;

    try {
      const documents = YAML.loadAll(content).filter(Boolean) as any[];
      const summaries = documents
        .filter((doc) => typeof doc === "object")
        .map((doc) => ({
          kind: doc.kind,
          name: doc.metadata?.name,
        }));

      if (summaries.length > 0) {
        artifact.metadata = {
          ...artifact.metadata,
          kubernetesResources: summaries,
        };
      }
    } catch {
      // ignore
    }
  },
};
