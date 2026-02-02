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

/** Importer plugin for Kubernetes manifests and Helm charts. */
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

  /**
   * Parse YAML documents and filter to valid objects.
   */
  private parseYamlDocuments(fileContent: string): any[] {
    const documents = yaml.parseAllDocuments(fileContent);
    return documents
      .map((doc) => doc.toJSON())
      .filter((item) => item && typeof item === "object" && item !== null);
  }

  async parse(filePath: string, fileContent?: string, context?: ParseContext): Promise<Evidence[]> {
    if (!fileContent) {
      throw new Error("File content required for Kubernetes parsing");
    }

    const projectRoot = context?.projectRoot || process.cwd();

    try {
      const parsedItems = this.parseYamlDocuments(fileContent);
      if (parsedItems.length === 0) {
        return [];
      }
      return this.parseKubernetesManifest(parsedItems, filePath, projectRoot);
    } catch (error) {
      console.warn(`Failed to parse Kubernetes file ${filePath}:`, error);
      return [];
    }
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
    const kubeEvidence = evidence.filter(
      (e) => e.source === this.name() && e.type === "infrastructure",
    );

    if (kubeEvidence.length === 0) return [];

    const rootDir = this.findRootDirectory(kubeEvidence, context.projectRoot || process.cwd());
    if (!rootDir) return [];

    return kubeEvidence.map((e) => this.buildArtifactFromEvidence(e, rootDir));
  }

  /**
   * Builds an InferredArtifact from a single evidence item.
   */
  private buildArtifactFromEvidence(e: Evidence, rootDir: string): InferredArtifact {
    const data = e.data as KubernetesData;
    const safeName = (data.name || `resource-${data.index}`).replace(/[^a-zA-Z0-9-]/g, "-");
    const artifactId = `${data.kind.toLowerCase()}-${safeName}`;
    const artifactName = data.name || `Unnamed Resource`;
    const description = this.generateResourceDescription(data);

    return {
      artifact: {
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
      },
      provenance: {
        evidence: [e.id],
        plugins: [this.name()],
        rules: ["kube-parsing", "resource-extraction"],
        timestamp: Date.now(),
        pipelineVersion: "1.0.0",
      },
      relationships: [],
    };
  }

  /**
   * Generates a human-readable description for a Kubernetes resource.
   */
  private generateResourceDescription(data: KubernetesData): string {
    const fullParsed = data.fullParsed;
    const nameFragment = data.name || "unnamed";
    const namespaceFragment = data.namespace ? ` in namespace ${data.namespace}` : "";

    if (!fullParsed) {
      return `Kubernetes ${data.kind} resource`;
    }

    const descriptionGenerators: Record<string, () => string> = {
      Deployment: () => this.describeDeployment(fullParsed, nameFragment, namespaceFragment),
      Service: () => this.describeService(fullParsed, nameFragment, namespaceFragment),
      ConfigMap: () => this.describeConfigMap(fullParsed, nameFragment, namespaceFragment),
      Secret: () => this.describeSecret(fullParsed, nameFragment, namespaceFragment),
    };

    const generator = descriptionGenerators[data.kind];
    if (generator) {
      return generator();
    }

    return `Kubernetes ${data.kind} named ${nameFragment}${namespaceFragment}`;
  }

  private describeDeployment(parsed: any, name: string, namespace: string): string {
    const replicas = parsed.spec?.replicas || 1;
    const containers = parsed.spec?.template?.spec?.containers || [];
    const images = containers.map((c: any) => c.image).join(", ");
    return `Deploys ${name} with ${replicas} replicas using images: ${images}${namespace}`;
  }

  private describeService(parsed: any, name: string, namespace: string): string {
    const portValues = (parsed.spec?.ports || [])
      .map((p: any) => p?.port)
      .filter(
        (port: any) =>
          typeof port === "number" || (typeof port === "string" && port.trim().length > 0),
      );
    const selector = JSON.stringify(parsed.spec?.selector || {});
    const portSegment =
      portValues.length > 0
        ? `on ports ${portValues.join(", ")}`
        : "without explicit port configuration";
    return `Exposes service ${name} ${portSegment} selecting pods by ${selector}${namespace}`;
  }

  private describeConfigMap(parsed: any, name: string, namespace: string): string {
    const keys = Object.keys(parsed.data || {}).length;
    return `Provides configuration for ${name} with ${keys} key-value pairs${namespace}`;
  }

  private describeSecret(parsed: any, name: string, namespace: string): string {
    const secretType = parsed.type || "Opaque";
    const dataKeys = Object.keys(parsed.data || {}).length;
    return `Stores ${secretType} secret ${name} with ${dataKeys} entries${namespace}`;
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
