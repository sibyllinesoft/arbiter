/**
 * Simplified Rust Plugin for Package Detection
 *
 * Detects Rust packages via Cargo.toml and guesses artifact type based on structure and dependencies.
 */

import * as path from 'path';
import { parse } from '@iarna/toml';
import {
  Evidence,
  ImporterPlugin,
  InferenceContext,
  InferredArtifact,
  ParseContext,
} from '../types.js';

import type { DetectionContext, DetectionResult } from '../detection/artifact-detector.js';
import { detectArtifactType } from '../detection/artifact-detector.js';
import type { CategoryMatrix } from '../detection/dependency-matrix.js';

// Rust framework detection lists
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

export interface RustData extends Record<string, unknown> {
  name: string;
  description: string;
  type: string;
  filePath: string;
}

export class RustPlugin implements ImporterPlugin {
  name(): string {
    return 'rust';
  }

  supports(filePath: string, fileContent?: string): boolean {
    const fileName = path.basename(filePath);
    const extension = path.extname(filePath);

    // Focus on Cargo.toml and basic Rust sources
    if (fileName === 'Cargo.toml') {
      return true;
    }

    if (extension === '.rs') {
      return fileName === 'main.rs' || fileName === 'lib.rs' || fileName === 'build.rs';
    }

    return false;
  }

  async parse(filePath: string, fileContent?: string, context?: ParseContext): Promise<Evidence[]> {
    if (!fileContent || path.basename(filePath) !== 'Cargo.toml') return [];

    const evidence: Evidence[] = [];
    const baseId = path.relative(context?.projectRoot ?? process.cwd(), filePath);

    try {
      return this.parseCargoToml(filePath, fileContent, baseId);
    } catch (error) {
      console.warn(`Rust plugin failed to parse ${filePath}:`, error);
    }

    return evidence;
  }

  async infer(evidence: Evidence[], context: InferenceContext): Promise<InferredArtifact[]> {
    const rustEvidence = evidence.filter(e => e.source === 'rust');
    if (rustEvidence.length === 0) return [];

    const artifacts: InferredArtifact[] = [];
    const cargoEvidence = rustEvidence.filter(e => e.type === 'config');

    for (const cargo of cargoEvidence) {
      artifacts.push(...this.inferFromCargoToml(cargo, evidence, context));
    }

    return artifacts;
  }

  // Parse Cargo.toml using library
  private parseCargoToml(filePath: string, content: string, baseId: string): Evidence[] {
    const evidence: Evidence[] = [];
    let cargo;

    try {
      cargo = parse(content) as any;
    } catch (error) {
      console.warn('Failed to parse Cargo.toml:', error);
      return evidence;
    }

    const allDeps = {
      ...cargo.dependencies,
      ...cargo['dev-dependencies'],
      ...cargo['build-dependencies'],
    };
    const inferredType = this.determineRustType(allDeps);

    const rustData: RustData = {
      name: cargo.package?.name || path.basename(path.dirname(filePath)),
      description: cargo.package?.description || 'Rust package',
      type: inferredType,
      filePath,
      fullCargo: cargo,
    };

    evidence.push({
      id: baseId,
      source: 'rust',
      type: 'config',
      filePath,
      data: rustData,
      metadata: { timestamp: Date.now(), fileSize: content.length },
    });

    return evidence;
  }

  // Simplified inference
  private inferFromCargoToml(
    cargoEvidence: Evidence,
    allEvidence: Evidence[],
    context: InferenceContext
  ): InferredArtifact[] {
    const cargoData = cargoEvidence.data as any;
    const fullCargo = cargoData.fullCargo;
    const name = cargoData.name;
    const description = cargoData.description;
    const artifacts: InferredArtifact[] = [];

    const allDepsObj = {
      ...(fullCargo.dependencies || {}),
      ...(fullCargo['dev-dependencies'] || {}),
      ...(fullCargo['build-dependencies'] || {}),
    };
    const deps = Object.keys(allDepsObj);

    const filePatterns = Array.from(context.fileIndex?.files?.values() || [])
      .filter((f: any) => f.relativePath.startsWith(path.dirname(cargoData.filePath)))
      .map((f: any) => f.relativePath);

    const detectionContext: DetectionContext = {
      language: 'rust',
      dependencies: deps,
      scripts: {},
      filePatterns,
      packageConfig: fullCargo,
    };

    const result: DetectionResult = detectArtifactType(detectionContext);
    let category = result.primaryType;
    let artifactType = this.mapCategoryToRustType(category);

    // Fallback to simple logic if low confidence
    if (result.confidence < 0.3) {
      const simpleType = this.determineRustType(allDepsObj);
      if (simpleType !== 'module') {
        artifactType = simpleType;
      }
    }

    // Special handling for jobs
    if (artifactType === 'module' && this.hasJobFrameworks(deps)) {
      artifactType = 'job';
    }

    // Override to service if web frameworks detected (prioritize service over binary/CLI for HTTP-enabled crates)
    if (RUST_WEB_FRAMEWORKS.some(framework => deps.includes(framework))) {
      artifactType = 'service';
      category = 'web_service';
    }

    const artifact = {
      id: `rust-${artifactType}-${name}`,
      type: artifactType as any,
      name,
      description,
      tags: ['rust', artifactType],
      metadata: {
        sourceFile: cargoData.filePath,
        language: 'rust',
        detectedCategory: category,
        detectionConfidence: result.confidence,
      },
    };

    artifacts.push({
      artifact,
      provenance: {
        evidence: [cargoEvidence.id],
        plugins: ['rust'],
        rules: ['cargo-detection'],
        timestamp: Date.now(),
        pipelineVersion: '1.0.0',
      },
      relationships: [],
    });

    return artifacts;
  }

  private determineRustType(allDeps: Record<string, any>): string {
    const deps = Object.keys(allDeps);
    const hasWeb = deps.some(d => RUST_WEB_FRAMEWORKS.includes(d));
    const hasCli = deps.some(d => RUST_CLI_FRAMEWORKS.includes(d));
    const hasJob = deps.some(d => RUST_JOB_FRAMEWORKS.includes(d));

    if (hasWeb) return 'service';
    if (hasCli) return 'binary';
    if (hasJob) return 'job';
    return 'module';
  }

  private mapCategoryToRustType(category: keyof CategoryMatrix): string {
    const mapping: Record<keyof CategoryMatrix, string> = {
      cli: 'binary',
      web_service: 'service',
      frontend: 'module',
      module: 'module',
      desktop_app: 'binary',
      data_processing: 'job',
      testing: 'test',
      build_tool: 'module',
      game: 'binary',
      mobile: 'binary',
    };
    return mapping[category] || 'module';
  }

  private hasJobFrameworks(deps: string[]): boolean {
    return deps.some(d => RUST_JOB_FRAMEWORKS.includes(d));
  }
}

export const rustPlugin = new RustPlugin();
