import * as path from "path";
import * as yaml from "yaml";
import type {
  Evidence,
  ImporterPlugin,
  InferenceContext,
  InferredArtifact,
  ParseContext,
} from "../types";

export interface KubernetesData {
  name: string;
  kind: string;
  apiVersion: string;
  namespace?: string;
  fullParsed?: any;
  filePath: string;
  [key: string]: unknown;
}

export class KubernetesPlugin implements ImporterPlugin {
  name(): string {
    return "kubernetes";
  }

  supports(filePath: string): boolean {
    const basename = path.basename(filePath).toLowerCase();
    const relative = path.relative(process.cwd(), filePath).toLowerCase();
    return (
      (basename.endsWith(".yaml") || basename.endsWith(".yml")) &&
      (relative.includes("kubernetes") ||
        relative.includes("k8s") ||
        relative.includes("manifests"))
    );
  }

  async parse(filePath: string, fileContent?: string, context?: ParseContext): Promise<Evidence[]> {
    if (!fileContent) {
      throw new Error("File content required for Kubernetes parsing");
    }

    const evidence: Evidence[] = [];
    const basename = path.basename(filePath).toLowerCase();
    const projectRoot = context?.projectRoot || process.cwd();

    try {
      const documents = yaml.parseAllDocuments(fileContent);
      if (documents.length === 0) {
        return evidence;
      }
      const parsedItems = documents
        .map((doc) => doc.toJSON())
        .filter((item) => item && typeof item === "object" && item !== null);
      if (parsedItems.length === 0) {
        return evidence;
      }
      const kubeEvidence = this.parseKubernetesManifest(parsedItems, filePath, projectRoot);
      evidence.push(...kubeEvidence);
    } catch (error) {
      console.warn(`Failed to parse Kubernetes file ${filePath}:`, error);
    }

    return evidence;
  }

  private parseKubernetesManifest(parsed: any, filePath: string, projectRoot: string): Evidence[] {
    const evidence: Evidence[] = [];

    if (Array.isArray(parsed)) {
      parsed.forEach((item, index) => {
        if (typeof item === "object" && item !== null) {
          const itemEvidence = this.parseSingleItem(item, filePath, projectRoot, index);
          evidence.push(itemEvidence);
        }
      });
    } else if (typeof parsed === "object" && parsed !== null) {
      const itemEvidence = this.parseSingleItem(parsed, filePath, projectRoot, 0);
      evidence.push(itemEvidence);
    }

    return evidence;
  }

  private parseSingleItem(
    parsed: any,
    filePath: string,
    projectRoot: string,
    index: number,
  ): Evidence {
    const name = parsed.metadata?.name;
    const kind = parsed.kind;
    const apiVersion = parsed.apiVersion;
    const namespace = parsed.metadata?.namespace;

    const relativePath = path.relative(projectRoot, filePath);
    const data: KubernetesData = {
      name,
      kind,
      apiVersion,
      namespace,
      fullParsed: parsed,
      filePath: relativePath,
      index,
    };

    const evidenceId = `${relativePath}#${index}`;
    return {
      id: evidenceId,
      source: this.name(),
      type: "infrastructure",
      filePath: relativePath,
      data,
      metadata: {
        timestamp: Date.now(),
        fileSize: JSON.stringify(parsed).length,
      },
    };
  }

  async infer(evidence: Evidence[], context: InferenceContext): Promise<InferredArtifact[]> {
    const artifacts: InferredArtifact[] = [];

    // Filter Kubernetes evidence
    const kubeEvidence = evidence.filter(
      (e) => e.source === this.name() && e.type === "infrastructure",
    );

    if (kubeEvidence.length === 0) return artifacts;

    // Group by root directory (find common ancestor for all kube files)
    const rootDir = this.findRootDirectory(kubeEvidence, context.projectRoot || process.cwd());
    if (!rootDir) return artifacts;

    for (const e of kubeEvidence) {
      const data = e.data as KubernetesData;
      const safeName = (data.name || `resource-${data.index}`).replace(/[^a-zA-Z0-9-]/g, "-");
      const artifactId = `${data.kind.toLowerCase()}-${safeName}`;
      const artifactName = data.name || `Unnamed Resource`;
      const fullParsed = (data as any).fullParsed;
      let description: string;
      if (!fullParsed) {
        description = `Kubernetes ${data.kind} resource`;
      } else {
        switch (data.kind) {
          case "Deployment": {
            const replicas = fullParsed.spec?.replicas || 1;
            const containers = fullParsed.spec?.template?.spec?.containers || [];
            const images = containers.map((c: any) => c.image).join(", ");
            description = `Deploys ${data.name || "unnamed"} with ${replicas} replicas using images: ${images}`;
            if (data.namespace) description += ` in namespace ${data.namespace}`;
            break;
          }
          case "Service": {
            const portValues = (fullParsed.spec?.ports || [])
              .map((p: any) => p?.port)
              .filter(
                (port: any) =>
                  typeof port === "number" || (typeof port === "string" && port.trim().length > 0),
              );
            const selector = JSON.stringify(fullParsed.spec?.selector || {});
            const portSegment =
              portValues.length > 0
                ? `on ports ${portValues.join(", ")}`
                : "without explicit port configuration";
            description = `Exposes service ${data.name || "unnamed"} ${portSegment} selecting pods by ${selector}`;
            if (data.namespace) description += ` in namespace ${data.namespace}`;
            break;
          }
          case "ConfigMap": {
            const keys = Object.keys(fullParsed.data || {}).length;
            description = `Provides configuration for ${data.name || "unnamed"} with ${keys} key-value pairs`;
            if (data.namespace) description += ` in namespace ${data.namespace}`;
            break;
          }
          case "Secret": {
            const secretType = fullParsed.type || "Opaque";
            const dataKeys = Object.keys(fullParsed.data || {}).length;
            description = `Stores ${secretType} secret ${data.name || "unnamed"} with ${dataKeys} entries`;
            if (data.namespace) description += ` in namespace ${data.namespace}`;
            break;
          }
          default:
            description = `Kubernetes ${data.kind} named ${data.name || "unnamed"}`;
            if (data.namespace) description += ` in namespace ${data.namespace}`;
        }
      }

      const artifact = {
        id: artifactId,
        type: "infrastructure" as const,
        name: artifactName,
        description,
        tags: ["kubernetes", "infrastructure"],
        metadata: {
          root: rootDir,
          filePath: e.filePath,
          kind: data.kind,
          name: data.name,
          apiVersion: data.apiVersion,
          namespace: data.namespace,
          index: data.index,
        },
      };

      artifacts.push({
        artifact,
        provenance: {
          evidence: [e.id],
          plugins: [this.name()],
          rules: ["kube-parsing", "resource-extraction"],
          timestamp: Date.now(),
          pipelineVersion: "1.0.0",
        },
        relationships: [],
      });
    }

    return artifacts;
  }

  private findRootDirectory(evidence: Evidence[], projectRoot: string): string | null {
    if (evidence.length === 0) return null;

    // Get all file paths (already relative)
    const relativePaths = evidence.map((e) => e.filePath);

    // Extract directory paths (remove filename and #index)
    const dirPaths = relativePaths.map((relPath) => {
      const withoutIndex = relPath.split("#")[0];
      return path.dirname(withoutIndex);
    });

    if (dirPaths.length === 0) return null;

    // Split all dir paths into parts
    const dirPartsList = dirPaths.map((dir) => dir.split(path.sep));

    // Find the minimum length
    const minLength = Math.min(...dirPartsList.map((parts) => parts.length));

    // Find the first index where not all parts match
    let commonLength = 0;
    for (let i = 0; i < minLength; i++) {
      const part = dirPartsList[0][i];
      if (!dirPartsList.every((parts) => parts[i] === part)) {
        break;
      }
      commonLength = i + 1;
    }

    // Join the common parts
    const commonDir = dirPartsList[0].slice(0, commonLength).join(path.sep);

    if (commonDir === "") return ".";
    return commonDir;
  }
}

export const kubernetesPlugin = new KubernetesPlugin();
