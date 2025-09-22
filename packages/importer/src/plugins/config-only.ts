/**
 * Config-Only Plugin for Simplified Brownfield Detection
 *
 * This plugin follows the config-only approach: enumerate known project config files,
 * extract simple features, classify by rule signatures, and fall back to "package"
 * when uncertain. Multi-signal within one ecosystem beats single weak cues.
 *
 * Focus: High precision, low false positives, signature-based classification
 */

import * as path from 'path';
import {
  BinaryArtifact,
  ConfidenceScore,
  Evidence,
  ImporterPlugin,
  InferenceContext,
  InferredArtifact,
  LibraryArtifact,
  ParseContext,
  Provenance,
  ServiceArtifact,
} from '../types.js';

// ============================================================================
// Detection Signatures (Table-Driven)
// ============================================================================

interface DetectionSignature {
  ecosystem: string;
  artifactType: 'cli' | 'web' | 'database' | 'package';
  dependencies?: string[];
  scripts?: string[];
  configs?: string[];
  definitive?: boolean; // if true, presence alone is sufficient
  minConfidence?: number;
}

// Node.js ecosystem signatures
const nodeSignatures: DetectionSignature[] = [
  // CLI tools
  {
    ecosystem: 'node',
    artifactType: 'cli',
    dependencies: ['yargs', 'commander', 'oclif', 'meow', '@oclif/core'],
    minConfidence: 0.6,
  },
  {
    ecosystem: 'node',
    artifactType: 'cli',
    configs: ['bin'], // package.json has bin field
    definitive: true,
    minConfidence: 0.8,
  },
  {
    ecosystem: 'node',
    artifactType: 'cli',
    scripts: ['cli', 'dev:cli'],
    minConfidence: 0.4,
  },

  // Web services
  {
    ecosystem: 'node',
    artifactType: 'web',
    dependencies: ['express', 'fastify', 'koa', 'hapi', '@hapi/hapi', 'next', 'nuxt'],
    minConfidence: 0.6,
  },
  {
    ecosystem: 'node',
    artifactType: 'web',
    scripts: ['start', 'serve', 'dev', 'preview'],
    minConfidence: 0.3,
  },

  // Database tools
  {
    ecosystem: 'node',
    artifactType: 'database',
    dependencies: ['typeorm', 'sequelize', 'prisma', 'mongoose', 'knex', '@prisma/client'],
    minConfidence: 0.5,
  },
];

// Python ecosystem signatures
const pythonSignatures: DetectionSignature[] = [
  // CLI tools
  {
    ecosystem: 'python',
    artifactType: 'cli',
    dependencies: ['click', 'typer', 'fire', 'docopt'],
    minConfidence: 0.6,
  },
  {
    ecosystem: 'python',
    artifactType: 'cli',
    configs: ['console_scripts', 'scripts'], // setup.py/pyproject.toml
    definitive: true,
    minConfidence: 0.8,
  },

  // Web services
  {
    ecosystem: 'python',
    artifactType: 'web',
    dependencies: ['flask', 'django', 'fastapi', 'starlette', 'tornado', 'gunicorn', 'uvicorn'],
    minConfidence: 0.6,
  },

  // Database tools
  {
    ecosystem: 'python',
    artifactType: 'database',
    dependencies: ['sqlalchemy', 'psycopg2', 'mysqlclient', 'asyncpg', 'alembic'],
    minConfidence: 0.5,
  },
];

// Go ecosystem signatures
const goSignatures: DetectionSignature[] = [
  // Web services
  {
    ecosystem: 'go',
    artifactType: 'web',
    dependencies: [
      'github.com/gin-gonic/gin',
      'github.com/gorilla/mux',
      'github.com/labstack/echo',
      'github.com/go-chi/chi',
    ],
    minConfidence: 0.6,
  },

  // Database tools
  {
    ecosystem: 'go',
    artifactType: 'database',
    dependencies: ['gorm.io/gorm', 'github.com/jmoiron/sqlx', 'github.com/lib/pq'],
    minConfidence: 0.5,
  },
];

// Rust ecosystem signatures
const rustSignatures: DetectionSignature[] = [
  // CLI tools
  {
    ecosystem: 'rust',
    artifactType: 'cli',
    dependencies: ['clap', 'structopt', 'argh'],
    minConfidence: 0.6,
  },
  {
    ecosystem: 'rust',
    artifactType: 'cli',
    configs: ['bin'], // Cargo.toml [[bin]]
    definitive: true,
    minConfidence: 0.8,
  },

  // Web services
  {
    ecosystem: 'rust',
    artifactType: 'web',
    dependencies: ['axum', 'actix-web', 'rocket', 'warp', 'tokio'],
    minConfidence: 0.6,
  },

  // Database tools
  {
    ecosystem: 'rust',
    artifactType: 'database',
    dependencies: ['sqlx', 'diesel', 'sea-orm'],
    minConfidence: 0.5,
  },
];

// Docker signatures
const dockerSignatures: DetectionSignature[] = [
  {
    ecosystem: 'docker',
    artifactType: 'web',
    configs: ['EXPOSE'], // Dockerfile has EXPOSE
    minConfidence: 0.7,
  },
];

// All signatures combined
const allSignatures = [
  ...nodeSignatures,
  ...pythonSignatures,
  ...goSignatures,
  ...rustSignatures,
  ...dockerSignatures,
];

// Weak/generic dependencies to ignore or downweight
const weakDependencies = new Set([
  // Node
  'lodash',
  'moment',
  'axios',
  'chalk',
  'debug',
  // Python
  'requests',
  'urllib3',
  'six',
  'setuptools',
  // Generic
  'typescript',
  '@types/node',
]);

// ============================================================================
// Feature Extraction
// ============================================================================

interface ArtifactFeatures {
  ecosystem: string;
  evidence: Array<{
    source: string;
    type: 'definitive' | 'strong' | 'weak';
    value: string;
    confidence: number;
  }>;
  scores: Record<string, number>;
  metadata: Record<string, any>;
}

// ============================================================================
// Main Plugin Implementation
// ============================================================================

export class ConfigOnlyPlugin implements ImporterPlugin {
  name(): string {
    return 'config-only';
  }

  supports(filePath: string, fileContent?: string): boolean {
    const fileName = path.basename(filePath);

    // Config files we care about
    const configPatterns = [
      // Package manifests
      'package.json',
      'pyproject.toml',
      'requirements.txt',
      'Pipfile',
      'setup.cfg',
      'Cargo.toml',
      'go.mod',
      'pom.xml',
      'build.gradle',

      // Docker/Compose
      'Dockerfile',
      'docker-compose.yml',
      'docker-compose.yaml',
      'compose.yml',
      'compose.yaml',
    ];

    return configPatterns.some(pattern => fileName.includes(pattern));
  }

  async parse(filePath: string, fileContent?: string, context?: ParseContext): Promise<Evidence[]> {
    if (!fileContent) return [];

    const evidence: Evidence[] = [];
    const fileName = path.basename(filePath);
    const baseId = `config-only-${path.relative(context?.projectRoot || '', filePath)}`;

    try {
      if (fileName === 'package.json') {
        evidence.push(...this.parsePackageJson(filePath, fileContent, baseId));
      } else if (fileName === 'pyproject.toml') {
        evidence.push(...this.parsePyprojectToml(filePath, fileContent, baseId));
      } else if (fileName === 'Cargo.toml') {
        evidence.push(...this.parseCargoToml(filePath, fileContent, baseId));
      } else if (fileName === 'go.mod') {
        evidence.push(...this.parseGoMod(filePath, fileContent, baseId));
      } else if (fileName.startsWith('Dockerfile')) {
        evidence.push(...this.parseDockerfile(filePath, fileContent, baseId));
      } else if (fileName.includes('docker-compose') || fileName.includes('compose')) {
        evidence.push(...this.parseDockerCompose(filePath, fileContent, baseId));
      }
    } catch (error) {
      console.warn(`Config-only plugin failed to parse ${filePath}:`, error);
    }

    return evidence;
  }

  async infer(evidence: Evidence[], context: InferenceContext): Promise<InferredArtifact[]> {
    const configEvidence = evidence.filter(e => e.source === 'config-only');
    if (configEvidence.length === 0) return [];

    const artifacts: InferredArtifact[] = [];

    // Group evidence by project (directory) instead of ecosystem
    const projectGroups = new Map<string, Evidence[]>();
    for (const e of configEvidence) {
      // Use directory containing the config file as project identifier
      const projectDir = path.dirname(e.filePath);
      if (!projectGroups.has(projectDir)) {
        projectGroups.set(projectDir, []);
      }
      projectGroups.get(projectDir)!.push(e);
    }

    // Analyze each project
    for (const [projectDir, evidenceList] of projectGroups) {
      const features = this.extractFeatures(evidenceList);
      const classification = this.classifyArtifact(features);

      // Create artifact for any classification (no confidence gate)
      const artifact = await this.createArtifact(classification, features, evidenceList);
      if (artifact) {
        artifacts.push(artifact);
      }
    }

    return artifacts;
  }

  // ============================================================================
  // Private parsing methods
  // ============================================================================

  private parsePackageJson(filePath: string, content: string, baseId: string): Evidence[] {
    const evidence: Evidence[] = [];

    try {
      const pkg = JSON.parse(content);
      const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };

      evidence.push({
        id: `${baseId}-package`,
        source: 'config-only',
        type: 'config',
        filePath,
        data: {
          ecosystem: 'node',
          configType: 'package-json',
          name: pkg.name,
          dependencies,
          scripts: pkg.scripts || {},
          bin: pkg.bin,
          private: pkg.private,
        },
        confidence: 0.95,
        metadata: {
          timestamp: Date.now(),
          fileSize: content.length,
        },
      });
    } catch (error) {
      console.warn('Failed to parse package.json:', error);
    }

    return evidence;
  }

  private parsePyprojectToml(filePath: string, content: string, baseId: string): Evidence[] {
    const evidence: Evidence[] = [];

    // Simple TOML parsing for dependencies
    const dependencies: string[] = [];
    const scriptMatches = content.match(/\[project\.scripts\][\s\S]*?(?=\[|$)/);
    const depMatches = content.match(/dependencies\s*=\s*\[([\s\S]*?)\]/);

    if (depMatches) {
      const depList = depMatches[1];
      const deps = depList.match(/"([^"]+)"/g);
      if (deps) {
        dependencies.push(...deps.map(d => d.replace(/"/g, '').split('>=')[0].split('==')[0]));
      }
    }

    evidence.push({
      id: `${baseId}-pyproject`,
      source: 'config-only',
      type: 'config',
      filePath,
      data: {
        ecosystem: 'python',
        configType: 'pyproject-toml',
        dependencies,
        hasScripts: !!scriptMatches,
      },
      confidence: 0.9,
      metadata: {
        timestamp: Date.now(),
        fileSize: content.length,
      },
    });

    return evidence;
  }

  private parseCargoToml(filePath: string, content: string, baseId: string): Evidence[] {
    const evidence: Evidence[] = [];

    // Simple TOML parsing for Rust
    const dependencies: string[] = [];
    const binSection = content.includes('[[bin]]');

    const depMatches = content.match(/\[dependencies\]([\s\S]*?)(?=\[|$)/);
    if (depMatches) {
      const depSection = depMatches[1];
      const deps = depSection.match(/^(\w+(?:-\w+)*)\s*=/gm);
      if (deps) {
        dependencies.push(...deps.map(d => d.replace(/\s*=.*/, '')));
      }
    }

    evidence.push({
      id: `${baseId}-cargo`,
      source: 'config-only',
      type: 'config',
      filePath,
      data: {
        ecosystem: 'rust',
        configType: 'cargo-toml',
        dependencies,
        hasBin: binSection,
      },
      confidence: 0.9,
      metadata: {
        timestamp: Date.now(),
        fileSize: content.length,
      },
    });

    return evidence;
  }

  private parseGoMod(filePath: string, content: string, baseId: string): Evidence[] {
    const evidence: Evidence[] = [];

    const dependencies: string[] = [];
    const requireMatches = content.match(/require\s+\(([\s\S]*?)\)/);

    if (requireMatches) {
      const requireSection = requireMatches[1];
      const deps = requireSection.match(/^\s*(\S+)/gm);
      if (deps) {
        dependencies.push(...deps.map(d => d.trim()));
      }
    }

    evidence.push({
      id: `${baseId}-gomod`,
      source: 'config-only',
      type: 'config',
      filePath,
      data: {
        ecosystem: 'go',
        configType: 'go-mod',
        dependencies,
      },
      confidence: 0.9,
      metadata: {
        timestamp: Date.now(),
        fileSize: content.length,
      },
    });

    return evidence;
  }

  private parseDockerfile(filePath: string, content: string, baseId: string): Evidence[] {
    const evidence: Evidence[] = [];

    const exposePorts: number[] = [];
    const exposeMatches = content.match(/^EXPOSE\s+(\d+)/gm);

    if (exposeMatches) {
      for (const match of exposeMatches) {
        const portMatch = match.match(/(\d+)/);
        if (portMatch) {
          exposePorts.push(parseInt(portMatch[1]));
        }
      }
    }

    evidence.push({
      id: `${baseId}-dockerfile`,
      source: 'config-only',
      type: 'config',
      filePath,
      data: {
        ecosystem: 'docker',
        configType: 'dockerfile',
        exposedPorts: exposePorts,
        hasEntrypoint: content.includes('ENTRYPOINT'),
        hasCmd: content.includes('CMD'),
      },
      confidence: 0.9,
      metadata: {
        timestamp: Date.now(),
        fileSize: content.length,
      },
    });

    return evidence;
  }

  private parseDockerCompose(filePath: string, content: string, baseId: string): Evidence[] {
    const evidence: Evidence[] = [];

    // Basic YAML parsing for services
    const hasServices = /services:\s*$/m.test(content);
    const portMatches = content.match(/ports:\s*\n\s*-\s*["']?(\d+)/g);
    const ports: number[] = [];

    if (portMatches) {
      for (const match of portMatches) {
        const portMatch = match.match(/(\d+)/);
        if (portMatch) {
          ports.push(parseInt(portMatch[1]));
        }
      }
    }

    if (hasServices) {
      evidence.push({
        id: `${baseId}-compose`,
        source: 'config-only',
        type: 'config',
        filePath,
        data: {
          ecosystem: 'docker',
          configType: 'compose-service',
          ports,
          hasDatabase: /postgres|mysql|mongo|redis/.test(content),
        },
        confidence: 0.8,
        metadata: {
          timestamp: Date.now(),
          fileSize: content.length,
        },
      });
    }

    return evidence;
  }

  // ============================================================================
  // Feature extraction and classification
  // ============================================================================

  private extractFeatures(evidence: Evidence[]): ArtifactFeatures {
    const ecosystem = (evidence[0]?.data as any)?.ecosystem;
    const features: ArtifactFeatures = {
      ecosystem,
      evidence: [],
      scores: { cli: 0, web: 0, database: 0, package: 0.5 }, // default fallback
      metadata: {},
    };

    for (const e of evidence) {
      const data = e.data as any;

      // Extract dependencies
      if (data.dependencies) {
        const deps = Array.isArray(data.dependencies)
          ? data.dependencies
          : Object.keys(data.dependencies);
        features.metadata.dependencies = deps;

        // Check against signatures
        for (const signature of allSignatures) {
          if (signature.ecosystem === ecosystem && signature.dependencies) {
            const matches = signature.dependencies.filter(dep => deps.includes(dep));
            if (matches.length > 0) {
              const confidence = signature.minConfidence || 0.5;
              features.scores[signature.artifactType] +=
                confidence * (matches.length / signature.dependencies.length);

              features.evidence.push({
                source: e.filePath,
                type: signature.definitive ? 'definitive' : 'strong',
                value: matches.join(', '),
                confidence,
              });
            }
          }
        }
      }

      // Check scripts
      if (data.scripts) {
        const scripts = Object.keys(data.scripts);
        for (const signature of allSignatures) {
          if (signature.ecosystem === ecosystem && signature.scripts) {
            const matches = signature.scripts.filter(script => scripts.includes(script));
            if (matches.length > 0) {
              const confidence = signature.minConfidence || 0.3;
              features.scores[signature.artifactType] += confidence;

              features.evidence.push({
                source: e.filePath,
                type: 'weak',
                value: matches.join(', '),
                confidence,
              });
            }
          }
        }
      }

      // Check configs
      if (data.bin || data.hasBin) {
        features.scores.cli += 0.8;
        features.evidence.push({
          source: e.filePath,
          type: 'definitive',
          value: 'has binary configuration',
          confidence: 0.8,
        });
      }

      if (data.exposedPorts?.length > 0) {
        features.scores.web += 0.7;
        features.metadata.ports = data.exposedPorts;
        features.evidence.push({
          source: e.filePath,
          type: 'strong',
          value: `exposes ports: ${data.exposedPorts.join(', ')}`,
          confidence: 0.7,
        });
      }
    }

    return features;
  }

  private classifyArtifact(features: ArtifactFeatures): { type: string; confidence: number } {
    // Find the highest scoring type
    const scores = features.scores;
    const maxScore = Math.max(...Object.values(scores));
    const bestType =
      Object.entries(scores).find(([_, score]) => score === maxScore)?.[0] || 'package';

    // No confidence gate - return whatever scored highest
    return { type: bestType, confidence: Math.min(0.95, Math.max(0.1, maxScore)) };
  }

  private async createArtifact(
    classification: { type: string; confidence: number },
    features: ArtifactFeatures,
    evidence: Evidence[]
  ): Promise<InferredArtifact | null> {
    const { type, confidence } = classification;

    // Use project name from evidence
    const projectName =
      (evidence[0]?.data as any)?.name ||
      path.basename(path.dirname(evidence[0]?.filePath || '')) ||
      features.ecosystem;

    let artifact: any;

    switch (type) {
      case 'cli':
        artifact = this.createBinaryArtifact(projectName, features);
        break;
      case 'web':
        artifact = this.createServiceArtifact(projectName, features);
        break;
      case 'database':
        // Could create database artifact here
        return null;
      case 'package':
        artifact = this.createLibraryArtifact(projectName, features);
        break;
      default:
        return null;
    }

    if (!artifact) return null;

    return {
      artifact,
      confidence: this.calculateConfidence(evidence, confidence),
      provenance: this.createProvenance(evidence),
      relationships: [],
    };
  }

  private createServiceArtifact(name: string, features: ArtifactFeatures): ServiceArtifact {
    return {
      id: `${features.ecosystem}-service-${name}`,
      type: 'service',
      name,
      description: `${features.ecosystem} service: ${name}`,
      tags: [features.ecosystem, 'service'],
      metadata: {
        language: features.ecosystem,
        framework: this.detectFramework(features.metadata.dependencies || []),
        port: features.metadata.ports?.[0] || 8080,
        basePath: '/',
        environmentVariables: [],
        dependencies: [],
        endpoints: [],
        healthCheck: {
          path: '/health',
          expectedStatusCode: 200,
          timeoutMs: 5000,
          intervalSeconds: 30,
        },
      },
    };
  }

  private createBinaryArtifact(name: string, features: ArtifactFeatures): BinaryArtifact {
    return {
      id: `${features.ecosystem}-binary-${name}`,
      type: 'binary',
      name,
      description: `${features.ecosystem} CLI tool: ${name}`,
      tags: [features.ecosystem, 'cli', 'binary'],
      metadata: {
        language: features.ecosystem,
        buildSystem: features.ecosystem === 'node' ? 'npm' : features.ecosystem,
        entryPoint: 'main',
        arguments: [],
        environmentVariables: [],
        dependencies: features.metadata.dependencies || [],
      },
    };
  }

  private createLibraryArtifact(name: string, features: ArtifactFeatures): LibraryArtifact {
    return {
      id: `${features.ecosystem}-library-${name}`,
      type: 'library',
      name,
      description: `${features.ecosystem} library: ${name}`,
      tags: [features.ecosystem, 'library'],
      metadata: {
        language: features.ecosystem,
        packageManager: features.ecosystem === 'node' ? 'npm' : features.ecosystem,
        publicApi: [],
        dependencies: features.metadata.dependencies || [],
        version: undefined,
      },
    };
  }

  private detectFramework(dependencies: string[]): string {
    const frameworks = {
      express: 'express',
      fastify: 'fastify',
      koa: 'koa',
      flask: 'flask',
      django: 'django',
      fastapi: 'fastapi',
      axum: 'axum',
      'actix-web': 'actix-web',
    };

    for (const dep of dependencies) {
      if (frameworks[dep as keyof typeof frameworks]) {
        return frameworks[dep as keyof typeof frameworks];
      }
    }

    return undefined;
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
      plugins: ['config-only'],
      rules: ['signature-based-classification', 'multi-signal-gating'],
      timestamp: Date.now(),
      pipelineVersion: '1.0.0',
    };
  }
}

// Export the plugin instance
export const configOnlyPlugin = new ConfigOnlyPlugin();
