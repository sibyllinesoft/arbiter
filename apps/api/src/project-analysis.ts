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
  type: 'service' | 'database' | 'infrastructure' | 'config' | 'tool' | 'module' | 'frontend';
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

const NODE_WEB_FRAMEWORKS = [
  'express',
  'fastify',
  'koa',
  'hapi',
  'nest',
  'adonis',
  'meteor',
  'sails',
  'loopback',
  'restify',
  'hono',
];

const NODE_FRONTEND_FRAMEWORKS = [
  'react',
  'react-dom',
  'next',
  'vue',
  'angular',
  'svelte',
  'solid-js',
  'preact',
  'nuxt',
  'gatsby',
];

const NODE_CLI_FRAMEWORKS = ['commander', 'yargs', 'inquirer', 'oclif', 'meow', 'cac', 'clipanion'];

const TYPESCRIPT_SIGNALS = ['typescript', 'ts-node', 'ts-node-dev', 'tsx', 'tsup', '@swc/core'];

const TSOA_ROUTE_PATTERN = /controller|route|api/i;

function normalizeSlashes(value: string): string {
  return value.replace(/\\+/g, '/');
}

function collectPackageDependencies(pkg: any): Record<string, string> {
  return {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
    ...(pkg.optionalDependencies || {}),
    ...(pkg.peerDependencies || {}),
  };
}

function detectPackageFrameworks(pkg: any): string[] {
  const deps = collectPackageDependencies(pkg);
  return NODE_WEB_FRAMEWORKS.filter(dep => Boolean(deps[dep]));
}

function packageUsesTypeScript(pkg: any): boolean {
  const deps = collectPackageDependencies(pkg);
  if (TYPESCRIPT_SIGNALS.some(signal => Boolean(deps[signal]))) {
    return true;
  }

  if (typeof pkg.types === 'string' || typeof pkg.typings === 'string') {
    return true;
  }

  const scripts = pkg.scripts || {};
  const scriptSignals = ['ts-node', 'tsx', 'ts-node-dev', 'tsup', 'tsc'];
  return Object.values(scripts)
    .filter((command): command is string => typeof command === 'string')
    .some(command => scriptSignals.some(signal => command.includes(signal)));
}

function classifyPackageManifest(pkg: any): {
  type: 'service' | 'frontend' | 'tool' | 'module';
  detectedType: string;
  reason: string;
} {
  const deps = collectPackageDependencies(pkg);
  const depNames = Object.keys(deps).map(dep => dep.toLowerCase());
  const hasDependency = (candidates: string[]) =>
    candidates.some(candidate => depNames.includes(candidate));

  if (hasDependency(NODE_WEB_FRAMEWORKS)) {
    return {
      type: 'service',
      detectedType: 'web_service',
      reason: 'web-framework',
    };
  }

  const hasFrontendFramework = hasDependency(NODE_FRONTEND_FRAMEWORKS) || Boolean(pkg.browserslist);
  if (hasFrontendFramework) {
    return {
      type: 'frontend',
      detectedType: 'frontend',
      reason: 'frontend-framework',
    };
  }

  const hasBin = Boolean(
    typeof pkg.bin === 'string' || (pkg.bin && Object.keys(pkg.bin).length > 0)
  );
  const hasCliDependency = hasDependency(NODE_CLI_FRAMEWORKS);
  if (hasBin || hasCliDependency) {
    return {
      type: 'tool',
      detectedType: 'tool',
      reason: hasBin ? 'manifest-bin' : 'cli-dependency',
    };
  }

  return {
    type: 'module',
    detectedType: 'module',
    reason: 'default-module',
  };
}

function stripPackageRoot(filePath: string, packageRoot: string): string {
  if (!packageRoot) {
    return filePath;
  }
  if (filePath === packageRoot) {
    return '';
  }
  if (filePath.startsWith(`${packageRoot}/`)) {
    return filePath.slice(packageRoot.length + 1);
  }
  return filePath;
}

function buildTsoaAnalysisFromPackage(
  packageJsonPath: string,
  pkg: any,
  allFiles: string[]
): {
  root: string;
  frameworks: string[];
  usesTypeScript: true;
  hasTsoaDependency: boolean;
  totalTypeScriptFiles: number;
  controllerCandidates: string[];
  configFiles: string[];
  scriptsUsingTsoa: string[];
  recommendedCommands: string[];
} | null {
  const frameworks = detectPackageFrameworks(pkg);
  if (frameworks.length === 0) {
    return null;
  }

  if (!packageUsesTypeScript(pkg)) {
    return null;
  }

  const packageDir = normalizeSlashes(path.dirname(packageJsonPath));
  const normalizedRoot = packageDir === '.' ? '' : packageDir;
  const deps = collectPackageDependencies(pkg);
  const hasTsoaDependency = Boolean(deps.tsoa);
  const scripts = pkg.scripts || {};

  const relevantFiles = allFiles
    .map(normalizeSlashes)
    .filter(file => {
      if (file.endsWith('.d.ts')) return false;
      if (!normalizedRoot) {
        return !file.startsWith('node_modules/');
      }
      return file === normalizedRoot || file.startsWith(`${normalizedRoot}/`);
    })
    .map(file => stripPackageRoot(file, normalizedRoot))
    .filter(rel => rel && !rel.startsWith('node_modules/'));

  if (relevantFiles.length === 0) {
    return null;
  }

  const tsFiles = relevantFiles.filter(rel => /\.(ts|tsx)$/i.test(rel));
  if (tsFiles.length === 0) {
    return null;
  }

  const controllerCandidates = tsFiles
    .filter(rel => TSOA_ROUTE_PATTERN.test(rel))
    .filter(rel => !/\.d\.ts$/i.test(rel))
    .filter(rel => !/\btests?\//i.test(rel) && !/__tests__\//i.test(rel))
    .slice(0, 50);

  const configFiles = relevantFiles.filter(rel => /tsoa\.json$/i.test(rel)).slice(0, 10);

  const scriptsUsingTsoa = Object.entries(scripts)
    .filter(([, command]) => typeof command === 'string' && command.includes('tsoa'))
    .map(([name]) => name);

  if (controllerCandidates.length === 0 && configFiles.length === 0 && !hasTsoaDependency) {
    return null;
  }

  return {
    root: normalizedRoot || '.',
    frameworks,
    usesTypeScript: true,
    hasTsoaDependency,
    totalTypeScriptFiles: tsFiles.length,
    controllerCandidates,
    configFiles,
    scriptsUsingTsoa,
    recommendedCommands: hasTsoaDependency
      ? ['npx tsoa spec', 'npx tsoa routes']
      : ['npm install --save-dev tsoa', 'npx tsoa spec', 'npx tsoa routes'],
  };
}

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
          allFiles: files,
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
    const displayName = path.basename(filePath);
    return {
      id,
      name: displayName,
      type: 'infrastructure',
      description: `Docker Compose configuration detected in ${displayName}.`,
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
  allFiles: string[];
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

        console.log('[project-analysis] parsed package manifest', {
          path: context.filePath,
          originalType: artifact.type,
        });

        const classification = classifyPackageManifest(pkg);
        if (classification) {
          const previousType = artifact.type;
          artifact.type = classification.type;
          artifact.metadata = {
            ...artifact.metadata,
            detectedType: classification.detectedType,
            classification: {
              source: 'manifest',
              reason: classification.reason,
              previousType,
            },
          };
          if (classification.type === 'tool' && !artifact.framework) {
            artifact.framework = 'cli';
          }
          console.log('[project-analysis] classified package', {
            path: context.filePath,
            name: pkg.name,
            type: artifact.type,
            detectedType: classification.detectedType,
            reason: classification.reason,
          });
        }

        const tsoaAnalysis = buildTsoaAnalysisFromPackage(context.filePath, pkg, context.allFiles);
        if (tsoaAnalysis) {
          artifact.metadata = {
            ...artifact.metadata,
            tsoaAnalysis,
          };
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
