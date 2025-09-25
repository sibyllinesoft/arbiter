/**
 * Rust plugin with lightweight heuristics.
 *
 * Focused on a handful of strong signals that are simple to understand and
 * maintain: Cargo manifests, obvious CLI/web frameworks, and basic source
 * patterns. The goal is to surface useful artifacts without deep AST analysis.
 */

import * as path from 'path';
import { parse } from '@iarna/toml';
import {
  type ArtifactType,
  type Evidence,
  type ImporterPlugin,
  type InferenceContext,
  type InferredArtifact,
  type ParseContext,
  type Provenance,
} from '../types';

// Heuristic dependency buckets ------------------------------------------------
const RUST_WEB_FRAMEWORKS = [
  'axum',
  'warp',
  'actix-web',
  'rocket',
  'tide',
  'gotham',
  'iron',
  'nickel',
  'tower-web',
  'salvo',
  'poem',
];

const RUST_CLI_FRAMEWORKS = ['clap', 'structopt', 'argh', 'gumdrop'];
const RUST_JOB_FRAMEWORKS = ['tokio-cron-scheduler', 'cron', 'job-scheduler'];
const RUST_DATABASE_DRIVERS = [
  'sqlx',
  'diesel',
  'rusqlite',
  'postgres',
  'mysql',
  'mongodb',
  'redis',
];

interface CargoDependency {
  name: string;
  version: string;
  kind: 'runtime' | 'dev' | 'build';
}

interface CargoBinaryDefinition {
  name: string;
  path?: string;
}

interface CargoEvidenceData extends Record<string, unknown> {
  configType: 'cargo-toml';
  package?: {
    name?: string;
    version?: string;
    description?: string;
  };
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  buildDependencies: Record<string, string>;
  hasBinaries: boolean;
  hasLibrary: boolean;
  binaries: CargoBinaryDefinition[];
  fullCargo: Record<string, unknown>;
}

function isCargoEvidenceData(data: Record<string, unknown>): data is CargoEvidenceData {
  const configType = data['configType'];
  return typeof configType === 'string' && configType === 'cargo-toml';
}

export class RustPlugin implements ImporterPlugin {
  name(): string {
    return 'rust';
  }

  supports(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/');
    const fileName = path.basename(normalized);

    if (fileName === 'Cargo.toml' || fileName === 'Cargo.lock') {
      return true;
    }

    if (fileName.endsWith('.rs') && normalized.includes('/src/')) {
      return true;
    }

    return false;
  }

  async parse(filePath: string, fileContent?: string, context?: ParseContext): Promise<Evidence[]> {
    if (!fileContent) return [];

    const normalized = filePath.replace(/\\/g, '/');
    const fileName = path.basename(normalized);

    if (fileName === 'Cargo.toml') {
      return this.parseCargoToml(normalized, fileContent, context);
    }

    if (fileName === 'Cargo.lock') {
      return [
        {
          id: this.createEvidenceId(normalized, context),
          source: 'rust',
          type: 'config',
          filePath: normalized,
          data: { configType: 'cargo-lock' },
          metadata: this.createMetadata(fileContent.length),
        },
      ];
    }

    if (normalized.includes('/src/') && fileName.endsWith('.rs')) {
      return this.parseRustSource(normalized, fileContent, context);
    }

    return [];
  }

  async infer(evidence: Evidence[], context: InferenceContext): Promise<InferredArtifact[]> {
    const rustConfigs = evidence.filter(
      e => e.source === 'rust' && e.type === 'config' && (e.data as any).configType === 'cargo-toml'
    );

    if (rustConfigs.length === 0) {
      return [];
    }

    const binaryDefinitions = evidence.filter(
      e =>
        e.source === 'rust' &&
        e.type === 'config' &&
        (e.data as any).configType === 'binary-definition'
    );

    const artifacts: InferredArtifact[] = [];

    for (const cargoEvidence of rustConfigs) {
      artifacts.push(...this.inferFromCargoToml(cargoEvidence, binaryDefinitions, context));
    }

    return artifacts;
  }

  // ---------------------------------------------------------------------------
  // Parsing helpers
  // ---------------------------------------------------------------------------
  private parseCargoToml(filePath: string, content: string, context?: ParseContext): Evidence[] {
    let cargo: Record<string, any>;

    try {
      cargo = parse(content) as Record<string, any>;
    } catch (error) {
      console.warn('Rust plugin: failed to parse Cargo.toml', error);
      return [];
    }

    const runtimeDeps = this.extractDependencies(cargo.dependencies, 'runtime');
    const devDeps = this.extractDependencies(cargo['dev-dependencies'], 'dev');
    const buildDeps = this.extractDependencies(cargo['build-dependencies'], 'build');
    const binaries = this.extractBinaries(cargo.bin ?? cargo.binaries ?? cargo['bin']);

    const data: CargoEvidenceData = {
      configType: 'cargo-toml',
      package: cargo.package ?? {},
      dependencies: this.dependenciesRecord(runtimeDeps),
      devDependencies: this.dependenciesRecord(devDeps),
      buildDependencies: this.dependenciesRecord(buildDeps),
      hasBinaries: binaries.length > 0,
      hasLibrary: Boolean(cargo.lib),
      binaries,
      fullCargo: cargo,
    };

    const evidence: Evidence[] = [
      {
        id: this.createEvidenceId(filePath, context),
        source: 'rust',
        type: 'config',
        filePath,
        data,
        metadata: this.createMetadata(content.length),
      },
    ];

    for (const dep of [...runtimeDeps, ...devDeps, ...buildDeps]) {
      evidence.push({
        id: `${this.createEvidenceId(filePath, context)}#${dep.kind}-${dep.name}`,
        source: 'rust',
        type: 'dependency',
        filePath,
        data: {
          dependencyType: dep.kind,
          name: dep.name,
          version: dep.version,
        },
        metadata: this.createMetadata(0),
      });
    }

    for (const bin of binaries) {
      evidence.push({
        id: `${this.createEvidenceId(filePath, context)}#bin-${bin.name}`,
        source: 'rust',
        type: 'config',
        filePath,
        data: {
          configType: 'binary-definition',
          binaryName: bin.name,
          binaryPath: bin.path,
        },
        metadata: this.createMetadata(0),
      });
    }

    return evidence;
  }

  private parseRustSource(filePath: string, content: string, context?: ParseContext): Evidence[] {
    const evidence: Evidence[] = [];
    const baseId = this.createEvidenceId(filePath, context);
    const metadata = this.createMetadata(content.length);

    if (/fn\s+main\s*\(/.test(content)) {
      evidence.push({
        id: `${baseId}#main`,
        source: 'rust',
        type: 'function',
        filePath,
        data: {
          functionType: 'main',
          isEntryPoint: true,
        },
        metadata,
      });
    }

    if (/#\s*\[\s*tokio::main/.test(content)) {
      evidence.push({
        id: `${baseId}#async-main`,
        source: 'rust',
        type: 'function',
        filePath,
        data: {
          functionType: 'async-main',
          runtime: 'tokio',
        },
        metadata,
      });
    }

    const frameworkMatch = this.findFirstMatch(content, RUST_WEB_FRAMEWORKS);
    if (frameworkMatch) {
      evidence.push({
        id: `${baseId}#framework-${frameworkMatch}`,
        source: 'rust',
        type: 'config',
        filePath,
        data: {
          configType: 'source-framework',
          framework: frameworkMatch,
        },
        metadata,
      });
    }

    return evidence;
  }

  // ---------------------------------------------------------------------------
  // Inference helpers
  // ---------------------------------------------------------------------------
  private inferFromCargoToml(
    cargoEvidence: Evidence,
    binaryEvidence: Evidence[],
    context: InferenceContext
  ): InferredArtifact[] {
    const cargoData = cargoEvidence.data;
    if (!isCargoEvidenceData(cargoData)) {
      return [];
    }
    const data = cargoData;
    const packageName = data.package?.name || path.basename(path.dirname(cargoEvidence.filePath));
    const description = data.package?.description || 'Rust project';

    const mergedDeps: Record<string, string> = {
      ...data.dependencies,
      ...data.devDependencies,
      ...data.buildDependencies,
    };
    const dependencyNames = Object.keys(mergedDeps);

    const framework = this.findFirstMatch(dependencyNames, RUST_WEB_FRAMEWORKS);
    const cliFramework = this.findFirstMatch(dependencyNames, RUST_CLI_FRAMEWORKS);
    const jobFramework = this.findFirstMatch(dependencyNames, RUST_JOB_FRAMEWORKS);
    const databaseDriver = this.findFirstMatch(dependencyNames, RUST_DATABASE_DRIVERS);

    let artifactType: ArtifactType = 'module';
    if (framework) {
      artifactType = 'service';
    } else if (cliFramework || data.hasBinaries) {
      artifactType = 'binary';
    } else if (jobFramework) {
      artifactType = 'job';
    }

    // Prefer binary names when available to avoid generic package titles.
    const binaryMatch = binaryEvidence.find(e => {
      if (e.filePath !== cargoEvidence.filePath) return false;
      const data = e.data as Record<string, unknown>;
      return typeof data['binaryName'] === 'string';
    });
    const binaryData = binaryMatch?.data as Record<string, unknown> | undefined;
    const binaryNameValue = binaryData?.binaryName;
    const artifactName = typeof binaryNameValue === 'string' ? binaryNameValue : packageName;

    const metadata: Record<string, unknown> = {
      language: 'rust',
      packageManager: 'cargo',
      dependencies: dependencyNames,
    };

    if (framework) metadata.framework = framework;
    if (cliFramework) metadata.cliFramework = cliFramework;
    if (jobFramework) metadata.jobFramework = jobFramework;
    if (databaseDriver) metadata.databaseDriver = databaseDriver;
    if (data.package?.version) metadata.version = data.package.version;
    const binaryPath = binaryData?.binaryPath;
    if (typeof binaryPath === 'string') {
      metadata.entryPoint = binaryPath;
    }

    const tags = new Set<string>(['rust']);
    if (artifactType === 'binary') tags.add('tool');
    if (artifactType === 'service') tags.add('service');
    if (data.hasLibrary) tags.add('library');

    const provenance: Provenance = {
      evidence: [cargoEvidence.id],
      plugins: ['rust'],
      rules: ['cargo-heuristics'],
      timestamp: Date.now(),
      pipelineVersion: '1.0.0',
    };

    const artifact = {
      id: `rust-${artifactType}-${artifactName}`,
      type: artifactType,
      name: artifactName,
      description,
      tags: Array.from(tags),
      metadata,
    };

    return [
      {
        artifact,
        provenance,
        relationships: [],
      },
    ];
  }

  private extractDependencies(
    deps: Record<string, any> | undefined,
    kind: CargoDependency['kind']
  ): CargoDependency[] {
    if (!deps) return [];

    return Object.entries(deps).map(([name, value]) => {
      if (typeof value === 'string') {
        return { name, version: value, kind };
      }
      if (value && typeof value === 'object' && typeof value.version === 'string') {
        return { name, version: value.version, kind };
      }
      return { name, version: 'workspace', kind };
    });
  }

  private extractBinaries(binSection: unknown): CargoBinaryDefinition[] {
    if (!binSection) return [];
    if (Array.isArray(binSection)) {
      // [[bin]] tables are common but resolving them accurately requires
      // more context (workspace membership, globbing, etc.). We opt out to
      // keep the plugin predictable.
      return [];
    }
    if (typeof binSection === 'object') {
      const name = (binSection as Record<string, any>).name;
      if (typeof name === 'string') {
        return [
          {
            name,
            path: (binSection as Record<string, any>).path as string | undefined,
          },
        ];
      }
    }
    return [];
  }

  private dependenciesRecord(deps: CargoDependency[]): Record<string, string> {
    return deps.reduce<Record<string, string>>((acc, dep) => {
      acc[dep.name] = dep.version;
      return acc;
    }, {});
  }

  private findFirstMatch(source: string | string[], candidates: string[]): string | undefined {
    const haystack = Array.isArray(source) ? source : [source];
    for (const item of haystack) {
      const lower = item.toLowerCase();
      const match = candidates.find(candidate => lower.includes(candidate.toLowerCase()));
      if (match) return match;
    }
    return undefined;
  }

  private createEvidenceId(filePath: string, context?: { projectRoot?: string }): string {
    const root = context?.projectRoot ?? process.cwd();
    const relative = path.relative(root, filePath);
    return relative === '' ? filePath : relative;
  }

  private createMetadata(size: number) {
    return {
      timestamp: Date.now(),
      fileSize: size,
    };
  }
}

export const rustPlugin = new RustPlugin();
