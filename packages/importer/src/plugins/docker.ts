import * as path from 'path';
import * as yaml from 'yaml';
import type {
  ConfidenceScore,
  Evidence,
  ImporterPlugin,
  InferenceContext,
  InferredArtifact,
  ParseContext,
  Provenance,
} from '../types';
import type { ProjectMetadata } from '../types';

export interface DockerData {
  name: string;
  description: string;
  type: string;
  filePath: string;
  [key: string]: unknown;
}

export class DockerPlugin implements ImporterPlugin {
  name(): string {
    return 'docker';
  }

  supports(filePath: string): boolean {
    const basename = path.basename(filePath).toLowerCase();
    return (
      basename === 'dockerfile' ||
      basename === 'docker-compose.yml' ||
      basename === 'docker-compose.yaml' ||
      basename.includes('compose')
    );
  }

  async parse(filePath: string, fileContent?: string, context?: ParseContext): Promise<Evidence[]> {
    if (!fileContent) {
      throw new Error('File content required for Docker parsing');
    }

    const evidence: Evidence[] = [];
    const basename = path.basename(filePath).toLowerCase();

    try {
      let parsed;
      if (basename === 'dockerfile') {
        // Don't use YAML for Dockerfile
        parsed = null;
      } else {
        parsed = yaml.parse(fileContent);
      }

      if (basename === 'dockerfile') {
        // Parse Dockerfile
        const dockerfileEvidence = this.parseDockerfile(
          fileContent,
          filePath,
          context?.projectRoot || '/'
        );
        evidence.push(...dockerfileEvidence);
      } else if (basename.includes('docker-compose')) {
        // Parse docker-compose.yml
        if (parsed && typeof parsed === 'object') {
          const composeEvidence = this.parseDockerCompose(
            parsed,
            filePath,
            context?.projectRoot || '/'
          );
          evidence.push(...composeEvidence);
        }
      }

      return evidence;
    } catch (error) {
      console.warn(`Failed to parse Docker file ${filePath}:`, error);
      return [];
    }
  }

  private parseDockerfile(content: string, filePath: string, projectRoot: string): Evidence[] {
    const evidence: Evidence[] = [];

    const name = path.basename(path.dirname(filePath)) || 'docker-build';
    const data: DockerData = {
      name,
      description: 'Docker build configuration',
      type: 'dockerfile',
      filePath,
    };

    const evidenceId = path.relative(projectRoot, filePath);
    evidence.push({
      id: evidenceId,
      source: this.name(),
      type: 'config',
      filePath,
      data,
      metadata: {
        timestamp: Date.now(),
        fileSize: content.length,
      },
    });

    return evidence;
  }

  private parseDockerCompose(parsed: any, filePath: string, projectRoot: string): Evidence[] {
    const evidence: Evidence[] = [];

    const services = parsed.services;
    if (!services || typeof services !== 'object') {
      return evidence;
    }

    const relativeComposePath = path.relative(projectRoot, filePath);

    for (const [serviceName, serviceConfigRaw] of Object.entries(services)) {
      const serviceConfig = serviceConfigRaw as any;
      if (typeof serviceConfig !== 'object' || serviceConfig === null) continue;

      const evidenceId = relativeComposePath;
      const data: DockerData = {
        name: serviceName as string,
        description: 'Docker service',
        type: 'service',
        filePath,
      };

      evidence.push({
        id: evidenceId,
        source: this.name(),
        type: 'config',
        filePath,
        data,
        metadata: {
          timestamp: Date.now(),
          fileSize: JSON.stringify(serviceConfig).length,
        },
      });
    }

    return evidence;
  }

  async infer(evidence: Evidence[], context: InferenceContext): Promise<InferredArtifact[]> {
    const artifacts: InferredArtifact[] = [];

    // Filter Docker evidence
    const dockerEvidence = evidence.filter(e => e.source === this.name() && e.type === 'config');

    const hasCompose = dockerEvidence.some(e => e.filePath.toLowerCase().includes('compose'));

    for (const ev of dockerEvidence) {
      const data = ev.data as unknown as DockerData;
      if (data.type !== 'service' && (hasCompose || data.type !== 'dockerfile')) continue;

      const artifactType = data.type === 'dockerfile' ? 'service' : data.type;
      const artifact = {
        id: `docker-${artifactType}-${data.name}`,
        type: artifactType as any,
        name: data.name,
        description: data.description,
        tags: ['docker', artifactType],
        metadata: {
          sourceFile: data.filePath,
          root: path.dirname(data.filePath),
        },
      };

      artifacts.push({
        artifact,
        provenance: {
          evidence: [ev.id],
          plugins: ['docker'],
          rules: ['docker-simplification'],
          timestamp: Date.now(),
          pipelineVersion: '1.0.0',
        },
        relationships: [],
      });
    }

    return artifacts;
  }
}
