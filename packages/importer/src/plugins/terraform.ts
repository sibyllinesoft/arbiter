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

interface TerraformLockfileData extends Record<string, unknown> {
  configType: string;
  providers: Array<{
    name: string;
    version?: string;
    source?: string;
  }>;
  terraformRoot: string;
}

interface TerraformConfigData extends Record<string, unknown> {
  configType: string;
  resources: Array<{
    type: string;
    name: string;
    provider?: string;
  }>;
  modules: Array<{
    name: string;
    source: string;
  }>;
  variables: string[];
  outputs: string[];
  terraformRoot: string;
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

    const lockfileData: TerraformLockfileData = {
      configType: 'terraform-lockfile',
      providers,
      terraformRoot,
    };

    evidence.push({
      id: `${baseId}-lockfile`,
      source: 'terraform',
      type: 'config',
      filePath,
      data: lockfileData,
      confidence: 0.95,
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
    const lockfileData = lockfileEvidence.data as unknown as TerraformLockfileData;
    const rootDir = lockfileData.terraformRoot;

    // Determine the type of infrastructure based on providers
    const providerNames = lockfileData.providers.map(p => p.name.toLowerCase());

    // Infer the infrastructure type
    let infrastructureType = 'infrastructure';
    let description = 'Terraform Infrastructure';

    if (providerNames.includes('aws')) {
      infrastructureType = 'aws-infrastructure';
      description = 'AWS Infrastructure managed by Terraform';
    } else if (providerNames.includes('azurerm')) {
      infrastructureType = 'azure-infrastructure';
      description = 'Azure Infrastructure managed by Terraform';
    } else if (providerNames.includes('google')) {
      infrastructureType = 'gcp-infrastructure';
      description = 'Google Cloud Infrastructure managed by Terraform';
    } else if (providerNames.includes('kubernetes')) {
      infrastructureType = 'kubernetes-infrastructure';
      description = 'Kubernetes resources managed by Terraform';
    } else if (providerNames.includes('docker')) {
      infrastructureType = 'docker-infrastructure';
      description = 'Docker containers managed by Terraform';
    }

    // Extract the name from the directory path
    const dirName = path.basename(rootDir);
    const artifactName = dirName === '.' || dirName === '' ? 'terraform-root' : dirName;

    const serviceArtifact: ServiceArtifact = {
      id: `terraform-${artifactName}`,
      type: 'service',
      name: artifactName,
      description,
      tags: ['terraform', 'infrastructure-as-code', ...providerNames],
      metadata: {
        language: 'hcl',
        framework: 'terraform',
        port: undefined, // Terraform doesn't expose ports
        basePath: rootDir,
        environmentVariables: [],
        dependencies: lockfileData.providers.map(p => ({
          serviceName: p.name,
          type: 'terraform-provider',
          required: true,
        })),
        endpoints: [],
        providers: lockfileData.providers,
        infrastructureType,
      },
    };

    artifacts.push({
      artifact: serviceArtifact,
      confidence: this.calculateConfidence([lockfileEvidence], 0.9),
      provenance: this.createProvenance([lockfileEvidence]),
      relationships: [],
    });

    return artifacts;
  }

  // ============================================================================
  // Helper methods
  // ============================================================================

  private calculateConfidence(evidence: Evidence[], baseConfidence: number): ConfidenceScore {
    const avgEvidence = evidence.reduce((sum, e) => sum + e.confidence, 0) / evidence.length;
    const overall = Math.min(0.95, baseConfidence * avgEvidence);

    return {
      overall,
      breakdown: {
        evidence: avgEvidence,
        base: baseConfidence,
      },
      factors: evidence.map(e => ({
        description: `Evidence from ${e.type}`,
        weight: e.confidence,
        source: e.source,
      })),
    };
  }

  private createProvenance(evidence: Evidence[]): Provenance {
    return {
      evidence: evidence.map(e => e.id),
      plugins: ['terraform'],
      rules: ['lockfile-analysis'],
      timestamp: Date.now(),
      pipelineVersion: '1.0.0',
    };
  }
}

// Export the plugin instance
export const terraformPlugin = new TerraformPlugin();
