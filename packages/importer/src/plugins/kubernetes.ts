/**
 * Kubernetes Plugin for Brownfield Detection
 *
 * Comprehensive plugin for detecting Kubernetes artifacts including deployments,
 * services, ingresses, and other K8s resources. Analyzes YAML manifests to
 * infer application architecture and deployment patterns.
 */

import * as path from 'path';
import * as yaml from 'yaml';
import {
  ConfidenceScore,
  Evidence,
  ImporterPlugin,
  InferenceContext,
  InferredArtifact,
  ParseContext,
  Provenance,
} from '../types.js';

// ============================================================================
// Kubernetes Resource Types and Patterns
// ============================================================================

// ============================================================================
// Types for structured evidence data
// ============================================================================

export interface K8sData extends Record<string, unknown> {
  name: string;
  description: string;
  type: string;
  filePath: string;
}

// ============================================================================
// Main Plugin Implementation
// ============================================================================

export class KubernetesPlugin implements ImporterPlugin {
  name(): string {
    return 'kubernetes';
  }

  supports(filePath: string, fileContent?: string): boolean {
    const fileName = path.basename(filePath);
    const extension = path.extname(filePath).toLowerCase();

    // Support YAML files in kubernetes directories
    if (
      (extension === '.yaml' || extension === '.yml') &&
      (filePath.includes('kubernetes') ||
        filePath.includes('k8s') ||
        filePath.includes('manifests') ||
        fileName.includes('k8s'))
    ) {
      return true;
    }

    // Support files with k8s in the name
    if (
      (extension === '.yaml' || extension === '.yml') &&
      (fileName.includes('deployment') ||
        fileName.includes('service') ||
        fileName.includes('ingress') ||
        fileName.includes('configmap'))
    ) {
      return true;
    }

    // Content-based detection - check for apiVersion and kind
    if (fileContent && (extension === '.yaml' || extension === '.yml')) {
      return /apiVersion:\s*[\w\/]+/.test(fileContent) && /kind:\s*\w+/.test(fileContent);
    }

    return false;
  }

  async parse(filePath: string, fileContent?: string, context?: ParseContext): Promise<Evidence[]> {
    if (!fileContent) return [];

    const evidence: Evidence[] = [];
    const baseId = path.relative(context?.projectRoot || '', filePath);

    try {
      // Parse YAML content - may contain multiple documents
      const documents = yaml.parseAllDocuments(fileContent);

      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        if (doc.errors.length > 0) continue;

        const resource = doc.toJS();
        if (!resource || !resource.apiVersion || !resource.kind) continue;

        evidence.push(...(await this.parseK8sResource(filePath, resource, baseId)));
      }
    } catch (error) {
      console.warn(`Kubernetes plugin failed to parse ${filePath}:`, error);
    }

    return evidence;
  }

  async infer(evidence: Evidence[], context: InferenceContext): Promise<InferredArtifact[]> {
    const k8sEvidence = evidence.filter(e => e.source === 'kubernetes');
    if (k8sEvidence.length === 0) return [];

    const artifacts: InferredArtifact[] = [];

    try {
      for (const ev of k8sEvidence) {
        artifacts.push(...(await this.inferFromK8sEvidence(ev, context)));
      }
    } catch (error) {
      console.warn('Kubernetes plugin inference failed:', error);
    }

    return artifacts;
  }

  // ============================================================================
  // Private parsing methods
  // ============================================================================

  private async parseK8sResource(
    filePath: string,
    resource: any,
    baseId: string
  ): Promise<Evidence[]> {
    const evidence: Evidence[] = [];
    const { kind, metadata = {} } = resource;
    const name = (metadata.name as string) || 'unnamed';
    const description = `Kubernetes ${kind.toLowerCase()}`;
    const type = this.determineK8sType(kind);
    const k8sData: K8sData = {
      name,
      description,
      type,
      filePath,
    };
    evidence.push({
      id: `${baseId}-${name}`,
      source: 'kubernetes',
      type: 'config',
      filePath,
      data: k8sData,
      metadata: {
        timestamp: Date.now(),
        fileSize: JSON.stringify(resource).length,
      },
    });
    return evidence;
  }

  private determineK8sType(kind: string): string {
    if (
      kind === 'Deployment' ||
      kind === 'StatefulSet' ||
      kind === 'DaemonSet' ||
      kind === 'Job' ||
      kind === 'CronJob' ||
      kind === 'ReplicaSet' ||
      kind === 'Pod'
    ) {
      return 'deployment';
    }
    if (kind === 'Service' || kind === 'Ingress') {
      return 'service';
    }
    if (
      kind === 'ConfigMap' ||
      kind === 'Secret' ||
      kind === 'PersistentVolume' ||
      kind === 'PersistentVolumeClaim' ||
      kind === 'ServiceAccount'
    ) {
      return 'infrastructure';
    }
    return 'config';
  }

  // ============================================================================
  // Private inference methods
  // ============================================================================

  private async inferFromK8sEvidence(
    k8sEvidence: Evidence,
    context: InferenceContext
  ): Promise<InferredArtifact[]> {
    const artifacts: InferredArtifact[] = [];
    const k8sData = k8sEvidence.data as unknown as K8sData;
    const artifact = {
      id: `k8s-${k8sData.type}-${k8sData.name}`,
      type: k8sData.type as any,
      name: k8sData.name,
      description: k8sData.description,
      tags: ['kubernetes', k8sData.type],
      metadata: {
        sourceFile: k8sData.filePath,
      },
    };
    artifacts.push({
      artifact,
      confidence: {
        overall: 0.9,
        breakdown: { evidence: 0.9 },
        factors: [{ description: 'K8s resource analysis', weight: 0.9, source: 'kubernetes' }],
      },
      provenance: {
        evidence: [k8sEvidence.id],
        plugins: ['kubernetes'],
        rules: ['k8s-simplification'],
        timestamp: Date.now(),
        pipelineVersion: '1.0.0',
      },
      relationships: [],
    });
    return artifacts;
  }
}

// Export the plugin instance
export const kubernetesPlugin = new KubernetesPlugin();
