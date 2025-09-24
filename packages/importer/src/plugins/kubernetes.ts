import * as path from 'path';
import * as yaml from 'yaml';
import type {
  Evidence,
  ImporterPlugin,
  InferenceContext,
  InferredArtifact,
  ParseContext,
} from '../types';

export interface KubernetesData {
  name: string;
  kind: string;
  apiVersion: string;
  namespace?: string;
  filePath: string;
  [key: string]: unknown;
}

export class KubernetesPlugin implements ImporterPlugin {
  name(): string {
    return 'kubernetes';
  }

  supports(filePath: string): boolean {
    const basename = path.basename(filePath).toLowerCase();
    const relative = path.relative(process.cwd(), filePath).toLowerCase();
    return (
      (basename.endsWith('.yaml') || basename.endsWith('.yml')) &&
      (relative.includes('kubernetes') ||
        relative.includes('k8s') ||
        relative.includes('manifests'))
    );
  }

  async parse(filePath: string, fileContent?: string, context?: ParseContext): Promise<Evidence[]> {
    if (!fileContent) {
      throw new Error('File content required for Kubernetes parsing');
    }

    const evidence: Evidence[] = [];
    const basename = path.basename(filePath).toLowerCase();

    try {
      const documents = yaml.parseAllDocuments(fileContent);
      if (documents.length === 0) {
        return evidence;
      }
      const parsedItems = documents
        .map(doc => doc.toJSON())
        .filter(item => item && typeof item === 'object' && item !== null);
      if (parsedItems.length === 0) {
        return evidence;
      }
      const kubeEvidence = this.parseKubernetesManifest(
        parsedItems,
        filePath,
        context?.projectRoot || '/'
      );
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
        if (typeof item === 'object' && item !== null) {
          const itemEvidence = this.parseSingleItem(item, filePath, projectRoot, index);
          evidence.push(itemEvidence);
        }
      });
    } else if (typeof parsed === 'object' && parsed !== null) {
      const itemEvidence = this.parseSingleItem(parsed, filePath, projectRoot, 0);
      evidence.push(itemEvidence);
    }

    return evidence;
  }

  private parseSingleItem(
    parsed: any,
    filePath: string,
    projectRoot: string,
    index: number
  ): Evidence {
    const name = parsed.metadata?.name;
    const kind = parsed.kind;
    const apiVersion = parsed.apiVersion;
    const namespace = parsed.metadata?.namespace;

    const data: KubernetesData = {
      name,
      kind,
      apiVersion,
      namespace,
      filePath,
      index,
    };

    const relativePath = path.relative(projectRoot, filePath);
    const evidenceId = `${relativePath}#${index}`;
    return {
      id: evidenceId,
      source: this.name(),
      type: 'infrastructure',
      filePath,
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
      e => e.source === this.name() && e.type === 'infrastructure'
    );

    if (kubeEvidence.length === 0) return artifacts;

    // Group by root directory (find common ancestor for all kube files)
    const rootDir = this.findRootDirectory(kubeEvidence, context.projectRoot || '/');
    if (!rootDir) return artifacts;

    // Collect all unique files in this group
    const files = [...new Set(kubeEvidence.map(e => e.filePath))];

    // Extract resources from evidence
    const resources = kubeEvidence.map(e => {
      const data = e.data as KubernetesData;
      return { kind: data.kind, name: data.name, apiVersion: data.apiVersion };
    });

    const artifact = {
      id: `kubernetes-infrastructure-${path.basename(rootDir)}`,
      type: 'infrastructure' as const,
      name: `Kubernetes Infrastructure (${path.basename(rootDir)})`,
      description: `Kubernetes manifests in ${rootDir}`,
      tags: ['kubernetes', 'infrastructure'],
      metadata: {
        root: rootDir,
        files,
        kind: 'kubernetes' as const,
        resources,
      },
    };

    artifacts.push({
      artifact,
      provenance: {
        evidence: kubeEvidence.map(e => e.id),
        plugins: ['kubernetes'],
        rules: ['kube-grouping', 'manifest-parsing'],
        timestamp: Date.now(),
        pipelineVersion: '1.0.0',
      },
      relationships: [],
    });

    return artifacts;
  }

  private findRootDirectory(evidence: Evidence[], projectRoot: string): string | null {
    if (evidence.length === 0) return null;

    // Get all file paths relative to project root
    const relativePaths = evidence.map(e => path.relative(projectRoot, e.filePath));

    // Find the longest common prefix (LCA for directories)
    let commonPrefix = relativePaths[0].split(path.sep).slice(0, -1).join(path.sep); // remove filename

    for (const relPath of relativePaths) {
      const parts = relPath.split(path.sep).slice(0, -1); // remove filename
      let currentPrefix = '';
      for (let i = 0; i < Math.min(commonPrefix.split(path.sep).length, parts.length); i++) {
        if (commonPrefix.split(path.sep)[i] !== parts[i]) {
          commonPrefix = currentPrefix;
          break;
        }
        currentPrefix = parts.slice(0, i + 1).join(path.sep);
      }
    }

    if (commonPrefix === '') return projectRoot;
    return path.join(projectRoot, commonPrefix);
  }
}

export const kubernetesPlugin = new KubernetesPlugin();
