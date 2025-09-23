/**
 * Terraform Plugin for Brownfield Detection
 *
 * Detects Terraform infrastructure by looking for .terraform.lock.hcl files
 * which indicate initialized Terraform directories. The lockfile directory
 * is treated as the Terraform root.
 */

import * as path from 'path';
import {
  ConfidenceScore,
  Evidence,
  ImporterPlugin,
  InferenceContext,
  InferredArtifact,
  ParseContext,
  Provenance,
  ServiceArtifact,
} from '../types.js';

// ============================================================================
// Types for structured evidence data
// ============================================================================

export interface TerraformData extends Record<string, unknown> {
  name: string;
  description: string;
  type: string;
  filePath: string;
}

// ============================================================================
// Main Plugin Implementation
// ============================================================================

export class TerraformPlugin implements ImporterPlugin {
  name(): string {
    return 'terraform';
  }

  supports(filePath: string, fileContent?: string): boolean {
    const fileName = path.basename(filePath);

    // ONLY detect Terraform if we find a lockfile
    // This ensures we only process initialized Terraform directories
    if (fileName === '.terraform.lock.hcl') {
      return true;
    }

    // Also process .tf files but ONLY if they're in a directory
    // that we've already identified as having a lockfile
    // This will be handled during inference phase

    return false;
  }

  async parse(filePath: string, fileContent?: string, context?: ParseContext): Promise<Evidence[]> {
    if (!fileContent) return [];

    const evidence: Evidence[] = [];
    const fileName = path.basename(filePath);
    const dirPath = path.dirname(filePath);
    const baseId = `terraform-${path.relative(context?.projectRoot || '', filePath)}`;

    try {
      if (fileName === '.terraform.lock.hcl') {
        evidence.push(...(await this.parseLockfile(filePath, fileContent, baseId, dirPath)));
      }
    } catch (error) {
      console.warn(`Terraform plugin failed to parse ${filePath}:`, error);
    }

    return evidence;
  }

  async infer(evidence: Evidence[], context: InferenceContext): Promise<InferredArtifact[]> {
    const terraformEvidence = evidence.filter(e => e.source === 'terraform');
    if (terraformEvidence.length === 0) return [];

    const artifacts: InferredArtifact[] = [];

    try {
      // Group evidence by Terraform root directory
      const rootDirs = new Map<string, Evidence[]>();

      for (const ev of terraformEvidence) {
        const root = (ev.data as any).terraformRoot;
        if (root) {
          if (!rootDirs.has(root)) {
            rootDirs.set(root, []);
          }
          rootDirs.get(root)!.push(ev);
        }
      }

      // Create an artifact for each Terraform root
      for (const [rootDir, rootEvidence] of rootDirs) {
        const lockfileEvidence = rootEvidence.find(
          e => e.type === 'config' && (e.data as any).configType === 'terraform-lockfile'
        );

        if (lockfileEvidence) {
          artifacts.push(
            ...(await this.inferFromTerraformRoot(lockfileEvidence, rootEvidence, context))
          );
        }
      }
    } catch (error) {
      console.warn('Terraform plugin inference failed:', error);
    }

    return artifacts;
  }

  // ============================================================================
  // Private parsing methods
  // ============================================================================

  private async parseLockfile(
    filePath: string,
    content: string,
    baseId: string,
    terraformRoot: string
  ): Promise<Evidence[]> {
    const evidence: Evidence[] = [];
    const lines = content.split('\n');

    const providers: Array<{
      name: string;
      version?: string;
      source?: string;
    }> = [];

    let currentProvider: { name: string; version?: string; source?: string } | null = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // Parse provider blocks
      if (trimmed.startsWith('provider "')) {
        const match = trimmed.match(/provider "([^"]+)"/);
        if (match) {
          if (currentProvider) {
            providers.push(currentProvider);
          }
          const fullName = match[1];
          // Extract the provider name from registry paths like "registry.terraform.io/hashicorp/aws"
          const parts = fullName.split('/');
          const name = parts[parts.length - 1];
          currentProvider = {
            name,
            source: fullName,
          };
        }
      } else if (currentProvider && trimmed.startsWith('version =')) {
        const match = trimmed.match(/version\s*=\s*"([^"]+)"/);
        if (match) {
          currentProvider.version = match[1];
        }
      }
    }

    // Don't forget the last provider
    if (currentProvider) {
      providers.push(currentProvider);
    }

    const dirName = path.basename(terraformRoot);
    const artifactName = dirName === '.' || dirName === '' ? 'terraform-root' : dirName;
    const providerNames = providers.map(p => p.name.toLowerCase()).join(', ') || 'unknown';

    const terraformData: TerraformData = {
      name: artifactName,
      description: `Terraform config with providers: ${providerNames}`,
      type: 'infrastructure',
      filePath,
    };

    evidence.push({
      id: `${baseId}-lockfile`,
      source: 'terraform',
      type: 'config',
      filePath,
      data: terraformData,
      metadata: {
        timestamp: Date.now(),
        fileSize: content.length,
      },
    });

    return evidence;
  }

  // ============================================================================
  // Private inference methods
  // ============================================================================

  private async inferFromTerraformRoot(
    lockfileEvidence: Evidence,
    allEvidence: Evidence[],
    context: InferenceContext
  ): Promise<InferredArtifact[]> {
    const artifacts: InferredArtifact[] = [];
    const lockfileData = lockfileEvidence.data as unknown as TerraformData;
    const rootDir = path.dirname(lockfileEvidence.filePath);

    // Determine the type of infrastructure based on providers
    const providerNames = lockfileData.name.toLowerCase().includes('aws') ? ['aws'] : []; // Simplified, use name or add parsing if needed

    // Infer the infrastructure type
    let infrastructureType = 'infrastructure';
    let description = 'Terraform Infrastructure';

    if (providerNames.includes('aws')) {
      infrastructureType = 'aws-infrastructure';
      description = 'AWS Infrastructure managed by Terraform';
    } else if (lockfileData.name.toLowerCase().includes('azure')) {
      infrastructureType = 'azure-infrastructure';
      description = 'Azure Infrastructure managed by Terraform';
    } else if (lockfileData.name.toLowerCase().includes('google')) {
      infrastructureType = 'gcp-infrastructure';
      description = 'Google Cloud Infrastructure managed by Terraform';
    } else if (lockfileData.name.toLowerCase().includes('k8s')) {
      infrastructureType = 'kubernetes-infrastructure';
      description = 'Kubernetes resources managed by Terraform';
    } else if (lockfileData.name.toLowerCase().includes('docker')) {
      infrastructureType = 'docker-infrastructure';
      description = 'Docker containers managed by Terraform';
    }

    const artifact = {
      id: `terraform-${lockfileData.name}`,
      type: lockfileData.type as any,
      name: lockfileData.name,
      description,
      tags: ['terraform', 'infrastructure-as-code'],
      metadata: {
        sourceFile: lockfileData.filePath,
        language: 'hcl',
        framework: 'terraform',
      },
    };

    artifacts.push({
      artifact,
      confidence: {
        overall: 0.9,
        breakdown: { evidence: 0.95 },
        factors: [
          { description: 'Terraform lockfile analysis', weight: 0.95, source: 'terraform' },
        ],
      },
      provenance: {
        evidence: [lockfileEvidence.id],
        plugins: ['terraform'],
        rules: ['terraform-simplification'],
        timestamp: Date.now(),
        pipelineVersion: '1.0.0',
      },
      relationships: [],
    });

    return artifacts;
  }

  // ============================================================================
  // Helper methods
  // ============================================================================
}

// Export the plugin instance
export const terraformPlugin = new TerraformPlugin();
