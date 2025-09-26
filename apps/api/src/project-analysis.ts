import { createHash } from 'node:crypto';
import path from 'node:path';
import YAML from 'js-yaml';
import type { ContentFetcher } from './content-fetcher';
import { FetchQueue } from './fetch-queue';
import type { ProjectStructure } from './git-scanner.types';

export interface ArtifactLink {
  type: string;
  target: string;
  description?: string;
}

export interface AnalyzedArtifact {
  id: string;
  name: string;
  type: 'service' | 'database' | 'infrastructure' | 'config' | 'summary';
  description: string;
  language: string | null;
  framework: string | null;
  metadata: Record<string, unknown>;
  filePath: string | null;
  links?: ArtifactLink[];
}

export interface TreeAnalysisResult {
  structure: ProjectStructure;
  artifacts: AnalyzedArtifact[];
  serviceCount: number;
  databaseCount: number;
}

interface StructureMetrics {
  filesScanned: number;
  usedGitLsFiles?: boolean;
}

const DOCKER_COMPOSE_FILES = new Set(['docker-compose.yml', 'docker-compose.yaml']);
const PACKAGE_MANIFESTS = new Set(['package.json', 'bunfig.toml']);
const DATABASE_HINTS = [
  'schema.prisma',
  'schema.sql',
  'migration.sql',
  'docker-compose.db',
  'docker-compose.database',
];
const KUBERNETES_KEYWORDS = [
  'deployment',
  'statefulset',
  'daemonset',
  'service',
  'configmap',
  'secret',
  'ingress',
  'namespace',
];

export function buildProjectStructure(
  files: string[],
  metrics?: StructureMetrics
): ProjectStructure {
  const structure: ProjectStructure = {
    hasPackageJson: false,
    hasCargoToml: false,
    hasDockerfile: false,
    hasCueFiles: false,
    hasYamlFiles: false,
    hasJsonFiles: false,
    importableFiles: [],
  };

  for (const file of files) {
    const lower = file.toLowerCase();
    const ext = path.extname(lower);
    const base = path.basename(lower);

    if (PACKAGE_MANIFESTS.has(base)) {
      structure.hasPackageJson = true;
      structure.importableFiles.push(file);
    } else if (base === 'cargo.toml') {
      structure.hasCargoToml = true;
      structure.importableFiles.push(file);
    } else if (base === 'dockerfile' || base.startsWith('dockerfile.')) {
      structure.hasDockerfile = true;
      structure.importableFiles.push(file);
    } else if (ext === '.cue') {
      structure.hasCueFiles = true;
      structure.importableFiles.push(file);
    } else if (ext === '.yaml' || ext === '.yml') {
      structure.hasYamlFiles = true;
      if (isInfrastructureYaml(base)) {
        structure.importableFiles.push(file);
      }
    } else if (ext === '.json') {
      structure.hasJsonFiles = true;
      if (isConfigJson(base)) {
        structure.importableFiles.push(file);
      }
    } else if (ext === '.tf' || ext === '.tf.json') {
      structure.importableFiles.push(file);
    }
  }

  if (metrics) {
    structure.performanceMetrics = {
      filesScanned: metrics.filesScanned,
      usedGitLsFiles: metrics.usedGitLsFiles,
    };
  }

  // Deduplicate importable files
  structure.importableFiles = Array.from(new Set(structure.importableFiles));
  return structure;
}

interface AnalysisOptions {
  gitUrl?: string;
  structure?: ProjectStructure;
  branch?: string;
  fetcher?: ContentFetcher;
  maxConcurrency?: number;
}

export async function analyzeProjectFiles(
  projectId: string,
  projectName: string,
  files: string[],
  options: AnalysisOptions = {}
): Promise<TreeAnalysisResult> {
  const structure = options.structure ?? buildProjectStructure(files);
  const artifacts: AnalyzedArtifact[] = [];
  const artifactsByPath = new Map<string, AnalyzedArtifact>();

  const summaryArtifact: AnalyzedArtifact = {
    id: `${projectId}-summary`,
    name: `${projectName}-summary`,
    type: 'summary',
    description: 'Summary generated from repository tree analysis.',
    language: null,
    framework: null,
    metadata: {
      detectedBy: 'tree-analysis',
      gitUrl: options.gitUrl,
      branch: options.branch,
      structure,
      importableFiles: structure.importableFiles,
    },
    filePath: null,
    links: [],
  };

  artifacts.push(summaryArtifact);

  for (const file of files) {
    const classified = classifyFile(projectId, file);
    if (!classified) continue;

    const enriched = {
      ...classified,
      metadata: {
        ...classified.metadata,
        detectedBy: 'tree-analysis',
      },
    } satisfies AnalyzedArtifact;

    artifacts.push(enriched);
    artifactsByPath.set(file, enriched);
  }

  if (options.fetcher) {
    const queue = new FetchQueue(
      path => options.fetcher!.fetchText(path),
      options.maxConcurrency ?? 4
    );
    const parseTargets = collectParserTargets(files);
    const parsePromises = parseTargets.map(target =>
      queue.enqueue(target.path, target.priority).then(async content => {
        if (!content) return;
        await target.parser.parse(content, {
          projectId,
          projectName,
          filePath: target.path,
          artifact: artifactsByPath.get(target.path),
          addArtifact: artifact => {
            artifacts.push(artifact);
            if (artifact.filePath) {
              artifactsByPath.set(artifact.filePath, artifact);
            }
          },
          structure,
        });
      })
    );

    await Promise.all(parsePromises);
  }

  for (const artifact of artifacts) {
    if (artifact.links && artifact.links.length > 0) {
      artifact.metadata = {
        ...artifact.metadata,
        links: artifact.links,
      };
    }
  }

  const serviceCount = artifacts.filter(a => a.type === 'service').length;
  const databaseCount = artifacts.filter(a => a.type === 'database').length;

  return {
    structure,
    artifacts,
    serviceCount,
    databaseCount,
  };
}

function classifyFile(projectId: string, filePath: string): AnalyzedArtifact | null {
  const lower = filePath.toLowerCase();
  const base = path.basename(lower);
  const ext = path.extname(lower);
  const name = prettifyName(filePath);
  const id = makeArtifactId(projectId, filePath);

  if (base === 'package.json') {
    return {
      id,
      name: `${name}-service`,
      type: 'service',
      description: 'Node.js service detected from package.json manifest.',
      language: 'nodejs',
      framework: null,
      metadata: {
        filePath,
        manifest: 'package.json',
      },
      filePath,
      links: [],
    };
  }

  if (base === 'cargo.toml') {
    return {
      id,
      name: `${name}-service`,
      type: 'service',
      description: 'Rust service detected from Cargo manifest.',
      language: 'rust',
      framework: null,
      metadata: {
        filePath,
        manifest: 'cargo.toml',
      },
      filePath,
      links: [],
    };
  }

  if (base === 'dockerfile' || base.startsWith('dockerfile.')) {
    return {
      id,
      name: `${name}-container`,
      type: 'service',
      description: 'Dockerfile detected for containerized service.',
      language: null,
      framework: null,
      metadata: {
        filePath,
        dockerfile: true,
      },
      filePath,
      links: [],
    };
  }

  if (DOCKER_COMPOSE_FILES.has(base)) {
    return {
      id,
      name: `${name}-compose`,
      type: 'infrastructure',
      description: 'Docker Compose configuration detected.',
      language: null,
      framework: null,
      metadata: {
        filePath,
        compose: true,
      },
      filePath,
      links: [],
    };
  }

  if (ext === '.cue') {
    return {
      id,
      name: `${name}-cue`,
      type: 'config',
      description: 'CUE configuration file detected.',
      language: null,
      framework: null,
      metadata: {
        filePath,
        cue: true,
      },
      filePath,
      links: [],
    };
  }

  if ((ext === '.yaml' || ext === '.yml') && isInfrastructureYaml(base)) {
    return {
      id,
      name: `${name}-k8s`,
      type: 'infrastructure',
      description: 'Infrastructure definition detected from YAML.',
      language: null,
      framework: null,
      metadata: {
        filePath,
        kubernetes: true,
      },
      filePath,
      links: [],
    };
  }

  if (ext === '.tf' || ext === '.tf.json') {
    return {
      id,
      name: `${name}-terraform`,
      type: 'infrastructure',
      description: 'Terraform IaC file detected.',
      language: null,
      framework: null,
      metadata: {
        filePath,
        terraform: true,
      },
      filePath,
      links: [],
    };
  }

  if (DATABASE_HINTS.some(hint => lower.includes(hint))) {
    return {
      id,
      name: `${name}-database`,
      type: 'database',
      description: 'Database-related definition detected.',
      language: null,
      framework: null,
      metadata: {
        filePath,
        hint: 'database-file-name',
      },
      filePath,
      links: [],
    };
  }

  return null;
}

function makeArtifactId(projectId: string, filePath: string): string {
  const hash = createHash('sha1').update(`${projectId}:${filePath}`).digest('hex');
  return `artifact-${hash}`;
}

function prettifyName(filePath: string): string {
  const base = path.basename(filePath);
  const withoutExt = base.replace(path.extname(base), '');
  return (
    withoutExt
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'artifact'
  );
}

function isInfrastructureYaml(base: string): boolean {
  if (DOCKER_COMPOSE_FILES.has(base)) {
    return true;
  }

  return KUBERNETES_KEYWORDS.some(keyword => base.includes(keyword));
}

function isConfigJson(base: string): boolean {
  return base === 'package.json' || base.endsWith('config.json') || base.includes('manifest');
}

interface ParserContext {
  projectId: string;
  projectName: string;
  filePath: string;
  artifact?: AnalyzedArtifact;
  addArtifact: (artifact: AnalyzedArtifact) => void;
  structure: ProjectStructure;
}

interface ParserDefinition {
  name: string;
  matches: (filePath: string) => boolean;
  priority: number;
  parse: (content: string, context: ParserContext) => void | Promise<void>;
}

const PARSERS: ParserDefinition[] = [
  {
    name: 'dockerfile',
    matches: filePath => path.basename(filePath).toLowerCase().startsWith('dockerfile'),
    priority: 10,
    parse: (content, context) => {
      const artifact = context.artifact;
      if (!artifact) return;

      const lines = content.split(/\r?\n/);
      const metadata: Record<string, unknown> = { ...(artifact.metadata ?? {}) };

      const fromLine = lines.find(line => /^\s*FROM\s+/i.test(line));
      if (fromLine) {
        const baseImage = fromLine.replace(/^\s*FROM\s+/i, '').split('s')[0];
        metadata.baseImage = baseImage;
      }

      const exposePorts = lines
        .filter(line => /^\s*EXPOSE\s+/i.test(line))
        .flatMap(line => line.replace(/^\s*EXPOSE\s+/i, '').split(/\s+/))
        .filter(Boolean);

      if (exposePorts.length > 0) {
        metadata.exposedPorts = exposePorts;
      }

      artifact.metadata = metadata;
    },
  },
  {
    name: 'docker-compose',
    matches: filePath => DOCKER_COMPOSE_FILES.has(path.basename(filePath).toLowerCase()),
    priority: 9,
    parse: (content, context) => {
      let parsedYaml: any;
      try {
        parsedYaml = YAML.load(content);
      } catch {
        return;
      }

      const artifact = context.artifact;
      if (!artifact) return;

      if (typeof parsedYaml !== 'object' || parsedYaml === null) return;

      const servicesSection = parsedYaml.services;
      if (!servicesSection || typeof servicesSection !== 'object') return;

      const serviceKeys = Object.keys(servicesSection);
      const composeServices: Array<Record<string, unknown>> = [];

      for (const serviceName of serviceKeys) {
        const service = servicesSection[serviceName];
        if (!service || typeof service !== 'object') continue;

        const serviceArtifact: AnalyzedArtifact = {
          id: makeArtifactId(context.projectId, `${context.filePath}#${serviceName}`),
          name: `${serviceName}-compose-service`,
          type: 'service',
          description: `Service defined in docker-compose file ${context.filePath}`,
          language: null,
          framework: null,
          metadata: {
            composeFile: context.filePath,
            service: serviceName,
            image: service.image,
            ports: service.ports,
            environment: service.environment,
          },
          filePath: context.filePath,
          links: [
            {
              type: 'defined_in',
              target: context.filePath,
            },
          ],
        };

        context.addArtifact(serviceArtifact);
        composeServices.push({
          service: serviceName,
          image: service.image,
          ports: service.ports,
        });
      }

      artifact.metadata = {
        ...artifact.metadata,
        services: composeServices,
      };
    },
  },
  {
    name: 'package-json',
    matches: filePath => path.basename(filePath).toLowerCase() === 'package.json',
    priority: 8,
    parse: (content, context) => {
      const artifact = context.artifact;
      if (!artifact) return;

      try {
        const pkg = JSON.parse(content);
        artifact.metadata = {
          ...artifact.metadata,
          package: {
            name: pkg.name,
            scripts: pkg.scripts ? Object.keys(pkg.scripts) : [],
            dependencies: pkg.dependencies ? Object.keys(pkg.dependencies) : [],
            devDependencies: pkg.devDependencies ? Object.keys(pkg.devDependencies) : [],
          },
        };

        if (typeof pkg.name === 'string') {
          artifact.name = pkg.name;
        }
        if (pkg.dependencies) {
          if (pkg.dependencies.express) artifact.framework = 'express';
          if (pkg.dependencies.fastify) artifact.framework = 'fastify';
          if (pkg.dependencies.nestjs) artifact.framework = 'nestjs';
        }
      } catch {
        // ignore parse errors
      }
    },
  },
  {
    name: 'prisma',
    matches: filePath => path.basename(filePath).toLowerCase().includes('schema.prisma'),
    priority: 6,
    parse: (content, context) => {
      const artifact = context.artifact;
      if (!artifact) return;

      const datasourceMatch = content.match(
        /datasource\s+\w+\s+\{[\s\S]*?provider\s*=\s*"([^"]+)"/
      );
      if (datasourceMatch) {
        artifact.metadata = {
          ...artifact.metadata,
          prismaProvider: datasourceMatch[1],
        };
        artifact.type = 'database';
        artifact.description = `Database schema (provider: ${datasourceMatch[1]})`;
      }
    },
  },
  {
    name: 'kubernetes',
    matches: filePath => {
      const base = path.basename(filePath).toLowerCase();
      if (!(base.endsWith('.yaml') || base.endsWith('.yml'))) return false;
      return isInfrastructureYaml(base);
    },
    priority: 5,
    parse: (content, context) => {
      const artifact = context.artifact;
      if (!artifact) return;

      try {
        const documents = YAML.loadAll(content).filter(Boolean) as any[];
        const summaries = documents
          .filter(doc => typeof doc === 'object')
          .map(doc => ({
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
  },
  {
    name: 'terraform',
    matches: filePath => {
      const base = path.basename(filePath).toLowerCase();
      return base.endsWith('.tf') || base.endsWith('.tf.json');
    },
    priority: 4,
    parse: (content, context) => {
      const artifact = context.artifact;
      if (!artifact) return;

      const resourceCount = (content.match(/resource\s+"/g) || []).length;
      const moduleCount = (content.match(/module\s+"/g) || []).length;

      artifact.metadata = {
        ...artifact.metadata,
        terraform: {
          resourceCount,
          moduleCount,
        },
      };
    },
  },
];

interface ParserTarget {
  parser: ParserDefinition;
  path: string;
  priority: number;
}

function collectParserTargets(files: string[]): ParserTarget[] {
  const targets: ParserTarget[] = [];
  for (const file of files) {
    for (const parser of PARSERS) {
      if (parser.matches(file)) {
        targets.push({ parser, path: file, priority: parser.priority });
      }
    }
  }
  return targets;
}
