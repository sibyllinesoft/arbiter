/**
 * Docker Plugin for Brownfield Detection
 *
 * Comprehensive plugin for detecting Docker artifacts including containers,
 * services, and deployment configurations. Analyzes Dockerfiles and
 * docker-compose files to infer application architecture.
 */

import * as path from 'path';
import * as yaml from 'yaml';
import {
  ConfidenceScore,
  DatabaseArtifact,
  DeploymentArtifact,
  Evidence,
  ImporterPlugin,
  InferenceContext,
  InferredArtifact,
  ParseContext,
  Provenance,
  ServiceArtifact,
} from '../types.js';

// ============================================================================
// Docker Pattern Detection
// ============================================================================

const DOCKER_BASE_IMAGES = {
  // Language runtimes
  node: 'javascript',
  python: 'python',
  openjdk: 'java',
  golang: 'go',
  rust: 'rust',
  ruby: 'ruby',
  php: 'php',
  dotnet: 'csharp',

  // Databases
  postgres: 'database',
  mysql: 'database',
  mongodb: 'database',
  redis: 'database',
  elasticsearch: 'database',

  // Web servers
  nginx: 'web-server',
  apache: 'web-server',
  traefik: 'proxy',
  haproxy: 'proxy',

  // Message queues
  rabbitmq: 'queue',
  kafka: 'queue',
  nats: 'queue',
};

const PORT_DEFAULTS = {
  80: 'http',
  443: 'https',
  3000: 'web-dev',
  8080: 'http-alt',
  5432: 'postgres',
  3306: 'mysql',
  27017: 'mongodb',
  6379: 'redis',
  9200: 'elasticsearch',
  5672: 'rabbitmq',
  9092: 'kafka',
};

// ============================================================================
// Types for structured evidence data
// ============================================================================

interface DockerfileData extends Record<string, unknown> {
  configType: string;
  baseImage: string;
  language?: string;
  exposedPorts: number[];
  environment: Record<string, string>;
  entrypoint?: string[];
  cmd?: string[];
  workdir?: string;
  copyPaths: string[];
  runCommands: string[];
  volumes: string[];
}

interface ComposeServiceData extends Record<string, unknown> {
  configType: string;
  serviceName: string;
  image?: string;
  build?: {
    context: string;
    dockerfile?: string;
  };
  ports: Array<{ host: number; container: number; protocol?: string }>;
  environment: Record<string, string>;
  volumes: string[];
  depends_on: string[];
  networks: string[];
  restart?: string;
  command?: string | string[];
  entrypoint?: string | string[];
}

// ============================================================================
// Main Plugin Implementation
// ============================================================================

export class DockerPlugin implements ImporterPlugin {
  name(): string {
    return 'docker';
  }

  supports(filePath: string, fileContent?: string): boolean {
    const fileName = path.basename(filePath);

    // Support Dockerfiles
    if (fileName.toLowerCase().startsWith('dockerfile')) {
      return true;
    }

    // Support docker-compose files
    if (fileName.match(/^docker-compose.*\.ya?ml$/) || fileName.match(/^compose.*\.ya?ml$/)) {
      return true;
    }

    return false;
  }

  async parse(filePath: string, fileContent?: string, context?: ParseContext): Promise<Evidence[]> {
    if (!fileContent) return [];

    const evidence: Evidence[] = [];
    const fileName = path.basename(filePath);
    const baseId = `docker-${path.relative(context?.projectRoot || '', filePath)}`;

    try {
      if (fileName.toLowerCase().startsWith('dockerfile')) {
        evidence.push(...(await this.parseDockerfile(filePath, fileContent, baseId)));
      } else if (
        fileName.match(/docker-compose.*\.ya?ml$/) ||
        fileName.match(/compose.*\.ya?ml$/)
      ) {
        evidence.push(...(await this.parseComposeFile(filePath, fileContent, baseId)));
      }
    } catch (error) {
      console.warn(`Docker plugin failed to parse ${filePath}:`, error);
    }

    return evidence;
  }

  async infer(evidence: Evidence[], context: InferenceContext): Promise<InferredArtifact[]> {
    const dockerEvidence = evidence.filter(e => e.source === 'docker');
    if (dockerEvidence.length === 0) return [];

    const artifacts: InferredArtifact[] = [];

    try {
      // Infer from Dockerfile evidence
      const dockerfileEvidence = dockerEvidence.filter(
        e => e.type === 'config' && e.data.configType === 'dockerfile'
      );
      for (const dockerfile of dockerfileEvidence) {
        artifacts.push(...(await this.inferFromDockerfile(dockerfile, dockerEvidence, context)));
      }

      // Infer from Compose evidence
      const composeEvidence = dockerEvidence.filter(
        e => e.type === 'config' && e.data.configType === 'compose-service'
      );
      for (const compose of composeEvidence) {
        artifacts.push(...(await this.inferFromCompose(compose, dockerEvidence, context)));
      }
    } catch (error) {
      console.warn('Docker plugin inference failed:', error);
    }

    return artifacts;
  }

  // ============================================================================
  // Private parsing methods
  // ============================================================================

  private async parseDockerfile(
    filePath: string,
    content: string,
    baseId: string
  ): Promise<Evidence[]> {
    const evidence: Evidence[] = [];
    const lines = content.split('\n').map(line => line.trim());

    let baseImage = '';
    const exposedPorts: number[] = [];
    const environment: Record<string, string> = {};
    let entrypoint: string[] = [];
    let cmd: string[] = [];
    let workdir = '';
    const copyPaths: string[] = [];
    const runCommands: string[] = [];
    const volumes: string[] = [];

    for (const line of lines) {
      if (line.startsWith('#') || !line) continue;

      // Parse FROM instruction
      const fromMatch = line.match(/^FROM\s+([^\s]+)/i);
      if (fromMatch) {
        baseImage = fromMatch[1];
        continue;
      }

      // Parse EXPOSE instruction
      const exposeMatch = line.match(/^EXPOSE\s+(.+)/i);
      if (exposeMatch) {
        const ports = exposeMatch[1]
          .split(/\s+/)
          .map(p => parseInt(p))
          .filter(p => !isNaN(p));
        exposedPorts.push(...ports);
        continue;
      }

      // Parse ENV instruction
      const envMatch = line.match(/^ENV\s+([^=\s]+)(?:=(.+)|\s+(.+))/i);
      if (envMatch) {
        const key = envMatch[1];
        const value = envMatch[2] || envMatch[3] || '';
        environment[key] = value.replace(/^["']|["']$/g, '');
        continue;
      }

      // Parse ENTRYPOINT instruction
      const entrypointMatch = line.match(/^ENTRYPOINT\s+(.+)/i);
      if (entrypointMatch) {
        entrypoint = this.parseJsonOrShell(entrypointMatch[1]);
        continue;
      }

      // Parse CMD instruction
      const cmdMatch = line.match(/^CMD\s+(.+)/i);
      if (cmdMatch) {
        cmd = this.parseJsonOrShell(cmdMatch[1]);
        continue;
      }

      // Parse WORKDIR instruction
      const workdirMatch = line.match(/^WORKDIR\s+(.+)/i);
      if (workdirMatch) {
        workdir = workdirMatch[1];
        continue;
      }

      // Parse COPY/ADD instructions
      const copyMatch = line.match(/^(?:COPY|ADD)\s+(.+)/i);
      if (copyMatch) {
        const args = copyMatch[1].split(/\s+/);
        if (args.length >= 2) {
          copyPaths.push(args[0]);
        }
        continue;
      }

      // Parse RUN instructions
      const runMatch = line.match(/^RUN\s+(.+)/i);
      if (runMatch) {
        runCommands.push(runMatch[1]);
        continue;
      }

      // Parse VOLUME instructions
      const volumeMatch = line.match(/^VOLUME\s+(.+)/i);
      if (volumeMatch) {
        const volPaths = this.parseJsonOrShell(volumeMatch[1]);
        volumes.push(...volPaths);
        continue;
      }
    }

    // Detect language from base image
    const language = this.detectLanguageFromImage(baseImage);

    const dockerfileData: DockerfileData = {
      configType: 'dockerfile',
      baseImage,
      language,
      exposedPorts,
      environment,
      entrypoint,
      cmd,
      workdir,
      copyPaths,
      runCommands,
      volumes,
    };

    evidence.push({
      id: `${baseId}-dockerfile`,
      source: 'docker',
      type: 'config',
      filePath,
      data: dockerfileData,
      confidence: 0.95,
      metadata: {
        timestamp: Date.now(),
        fileSize: content.length,
      },
    });

    return evidence;
  }

  private async parseComposeFile(
    filePath: string,
    content: string,
    baseId: string
  ): Promise<Evidence[]> {
    const evidence: Evidence[] = [];

    try {
      const compose = yaml.parse(content);
      if (!compose.services) return evidence;

      for (const [serviceName, serviceConfig] of Object.entries(
        compose.services as Record<string, any>
      )) {
        const ports: Array<{ host: number; container: number; protocol?: string }> = [];

        // Parse port mappings
        if (serviceConfig.ports) {
          for (const port of serviceConfig.ports) {
            if (typeof port === 'string') {
              const match = port.match(/^(?:(\d+):)?(\d+)(?:\/(\w+))?$/);
              if (match) {
                ports.push({
                  host: parseInt(match[1] || match[2]),
                  container: parseInt(match[2]),
                  protocol: match[3] || 'tcp',
                });
              }
            } else if (typeof port === 'object' && port.target) {
              ports.push({
                host: port.published || port.target,
                container: port.target,
                protocol: port.protocol || 'tcp',
              });
            }
          }
        }

        // Parse environment variables
        const environment: Record<string, string> = {};
        if (serviceConfig.environment) {
          if (Array.isArray(serviceConfig.environment)) {
            for (const env of serviceConfig.environment) {
              const [key, value] = env.split('=', 2);
              if (key && value !== undefined) {
                environment[key] = value;
              }
            }
          } else if (typeof serviceConfig.environment === 'object') {
            Object.assign(environment, serviceConfig.environment);
          }
        }

        const composeData: ComposeServiceData = {
          configType: 'compose-service',
          serviceName,
          image: serviceConfig.image,
          build: serviceConfig.build
            ? {
                context: serviceConfig.build.context || serviceConfig.build,
                dockerfile: serviceConfig.build.dockerfile,
              }
            : undefined,
          ports,
          environment,
          volumes: serviceConfig.volumes || [],
          depends_on: this.normalizeDependsOn(serviceConfig.depends_on),
          networks: serviceConfig.networks || [],
          restart: serviceConfig.restart,
          command: serviceConfig.command,
          entrypoint: serviceConfig.entrypoint,
        };

        evidence.push({
          id: `${baseId}-service-${serviceName}`,
          source: 'docker',
          type: 'config',
          filePath,
          data: composeData,
          confidence: 0.9,
          metadata: {
            timestamp: Date.now(),
            fileSize: content.length,
          },
        });
      }
    } catch (error) {
      console.warn('Failed to parse compose file:', error);
    }

    return evidence;
  }

  // ============================================================================
  // Private inference methods
  // ============================================================================

  private async inferFromDockerfile(
    dockerfileEvidence: Evidence,
    allEvidence: Evidence[],
    context: InferenceContext
  ): Promise<InferredArtifact[]> {
    const artifacts: InferredArtifact[] = [];
    const dockerData = dockerfileEvidence.data as unknown as DockerfileData;

    // Infer service artifact if ports are exposed
    if (dockerData.exposedPorts.length > 0) {
      // Don't use the directory name directly, especially for root-level Dockerfiles
      const dockerDir = path.dirname(dockerfileEvidence.filePath);
      const relativeDir = path.relative(context.projectRoot, dockerDir);

      // For root-level Dockerfile, use a generic name or try to infer from context
      let serviceName: string;
      if (!relativeDir || relativeDir === '.') {
        // Root-level Dockerfile - try to infer from WORKDIR or CMD
        if (dockerData.workdir && dockerData.workdir !== '/app' && dockerData.workdir !== '/') {
          serviceName = path.basename(dockerData.workdir);
        } else if (dockerData.cmd.length > 0) {
          // Try to extract service name from CMD
          const cmdFile = dockerData.cmd.find(
            c => c.includes('.js') || c.includes('.ts') || c.includes('.py')
          );
          serviceName = cmdFile ? path.basename(cmdFile, path.extname(cmdFile)) : 'docker-app';
        } else {
          serviceName = 'docker-app'; // Generic name for root-level Docker service
        }
      } else {
        // Dockerfile in a subdirectory - use the directory name
        serviceName = path.basename(dockerDir);
      }

      const serviceArtifact: ServiceArtifact = {
        id: `docker-service-${relativeDir?.replace(/\//g, '-') || 'root'}-${serviceName}`,
        type: 'service',
        name: serviceName,
        description: `Dockerized service: ${serviceName}${relativeDir ? ` (from ${relativeDir})` : ' (root Dockerfile)'}`,
        tags: ['docker', 'container', 'service'],
        metadata: {
          language: dockerData.language || '',
          framework: this.detectFrameworkFromDockerfile(dockerData),
          port: dockerData.exposedPorts[0],
          basePath: '/',
          environmentVariables: Object.keys(dockerData.environment),
          dependencies: [],
          endpoints: [],
          healthCheck: {
            path: '/health',
            expectedStatusCode: 200,
            timeoutMs: 5000,
            intervalSeconds: 30,
          },
          containerImage: dockerData.baseImage, // Store the base image from Dockerfile
        },
      };

      artifacts.push({
        artifact: serviceArtifact,
        confidence: this.calculateConfidence([dockerfileEvidence], 0.85),
        provenance: this.createProvenance([dockerfileEvidence]),
        relationships: [],
      });
    }

    return artifacts;
  }

  private async inferFromCompose(
    composeEvidence: Evidence,
    allEvidence: Evidence[],
    context: InferenceContext
  ): Promise<InferredArtifact[]> {
    const artifacts: InferredArtifact[] = [];
    const composeData = composeEvidence.data as unknown as ComposeServiceData;

    // Determine artifact type based on image and configuration
    const artifactType = this.determineServiceType(composeData);

    if (artifactType === 'database') {
      const dbArtifact: DatabaseArtifact = {
        id: `docker-db-${composeData.serviceName}`,
        type: 'database',
        name: composeData.serviceName,
        description: `Dockerized database: ${composeData.serviceName}`,
        tags: ['docker', 'database'],
        metadata: {
          databaseType: this.detectDatabaseType(composeData.image || ''),
          port: composeData.ports[0]?.container,
          schemas: [],
          configuration: composeData.environment,
        },
      };

      artifacts.push({
        artifact: dbArtifact,
        confidence: this.calculateConfidence([composeEvidence], 0.9),
        provenance: this.createProvenance([composeEvidence]),
        relationships: [],
      });
    } else {
      // Regular service
      const serviceArtifact: ServiceArtifact = {
        id: `docker-service-${composeData.serviceName}`,
        type: 'service',
        name: composeData.serviceName,
        description: `Dockerized service: ${composeData.serviceName}`,
        tags: ['docker', 'container', 'service'],
        metadata: {
          language: this.detectLanguageFromImage(composeData.image || ''),
          framework: this.detectFrameworkFromCompose(composeData),
          port: composeData.ports[0]?.container,
          basePath: '/',
          environmentVariables: Object.keys(composeData.environment),
          dependencies: composeData.depends_on.map(dep => ({
            serviceName: dep,
            type: 'docker-service',
            required: true,
          })),
          endpoints: [],
          healthCheck: {
            path: '/health',
            expectedStatusCode: 200,
            timeoutMs: 5000,
            intervalSeconds: 30,
          },
          containerImage: composeData.image, // Store the actual image from docker-compose
          buildContext: composeData.build?.context,
          dockerfile: composeData.build?.dockerfile,
        },
      };

      artifacts.push({
        artifact: serviceArtifact,
        confidence: this.calculateConfidence([composeEvidence], 0.85),
        provenance: this.createProvenance([composeEvidence]),
        relationships: [],
      });
    }

    return artifacts;
  }

  // ============================================================================
  // Helper methods
  // ============================================================================

  private parseJsonOrShell(instruction: string): string[] {
    instruction = instruction.trim();

    // JSON format ["cmd", "arg1", "arg2"]
    if (instruction.startsWith('[') && instruction.endsWith(']')) {
      try {
        return JSON.parse(instruction);
      } catch {
        return [];
      }
    }

    // Shell format: cmd arg1 arg2
    return instruction.split(/\s+/);
  }

  private detectLanguageFromImage(image: string): string {
    const imageName = image.split(':')[0].split('/').pop() || '';

    for (const [pattern, language] of Object.entries(DOCKER_BASE_IMAGES)) {
      if (imageName.includes(pattern)) {
        return language === 'database' ? 'sql' : language;
      }
    }

    return undefined;
  }

  private detectFrameworkFromDockerfile(dockerData: DockerfileData): string | undefined {
    // Check for framework-specific patterns in RUN commands
    const runCommands = dockerData.runCommands.join(' ').toLowerCase();

    if (runCommands.includes('npm install') || runCommands.includes('yarn install')) {
      return 'node.js';
    }
    if (runCommands.includes('pip install')) {
      return 'python';
    }
    if (runCommands.includes('go build') || runCommands.includes('go mod')) {
      return 'go';
    }
    if (runCommands.includes('cargo build')) {
      return 'rust';
    }

    return undefined;
  }

  private detectFrameworkFromCompose(composeData: ComposeServiceData): string | undefined {
    const image = composeData.image || '';

    if (image.includes('node')) return 'node.js';
    if (image.includes('python')) return 'python';
    if (image.includes('golang')) return 'go';
    if (image.includes('rust')) return 'rust';
    if (image.includes('openjdk')) return 'java';

    return undefined;
  }

  private determineServiceType(
    composeData: ComposeServiceData
  ): 'service' | 'database' | 'queue' | 'proxy' {
    const image = composeData.image || '';

    if (
      image.includes('postgres') ||
      image.includes('mysql') ||
      image.includes('mongodb') ||
      image.includes('redis') ||
      image.includes('elasticsearch')
    ) {
      return 'database';
    }

    if (image.includes('rabbitmq') || image.includes('kafka') || image.includes('nats')) {
      return 'queue';
    }

    if (image.includes('nginx') || image.includes('traefik') || image.includes('haproxy')) {
      return 'proxy';
    }

    return 'service';
  }

  private detectDatabaseType(image: string): string {
    if (image.includes('postgres')) return 'postgresql';
    if (image.includes('mysql')) return 'mysql';
    if (image.includes('mongodb')) return 'mongodb';
    if (image.includes('redis')) return 'redis';
    if (image.includes('elasticsearch')) return 'elasticsearch';

    return undefined;
  }

  /**
   * Normalize depends_on to always be an array of service names
   * Docker Compose allows depends_on to be either:
   * - Array: ['service1', 'service2']
   * - Object: { service1: { condition: 'service_healthy' }, service2: {} }
   */
  private normalizeDependsOn(dependsOn: any): string[] {
    if (!dependsOn) {
      return [];
    }

    if (Array.isArray(dependsOn)) {
      return dependsOn;
    }

    if (typeof dependsOn === 'object') {
      return Object.keys(dependsOn);
    }

    return [];
  }

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
      plugins: ['docker'],
      rules: ['dockerfile-analysis', 'compose-analysis'],
      timestamp: Date.now(),
      pipelineVersion: '1.0.0',
    };
  }
}

// Export the plugin instance
export const dockerPlugin = new DockerPlugin();
