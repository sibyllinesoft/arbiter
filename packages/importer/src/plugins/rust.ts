/**
 * Simplified Rust Plugin for Package Detection
 *
 * Detects Rust packages via Cargo.toml and guesses artifact type based on structure and dependencies.
 */

import * as path from 'path';
import { parse } from '@iarna/toml';
import {
  ConfidenceScore,
  Evidence,
  ImporterPlugin,
  InferenceContext,
  InferredArtifact,
  ParseContext,
  Provenance,
} from '../types.js';

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
    const baseId = path.relative(context?.projectRoot || '', filePath);

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
    const cargoData = cargoEvidence.data as unknown as RustData;
    const name = cargoData.name;
    const artifacts: InferredArtifact[] = [];

    const artifact = {
      id: `rust-${cargoData.type}-${name}`,
      type: cargoData.type as any,
      name,
      description: cargoData.description,
      tags: ['rust', cargoData.type],
      metadata: {
        sourceFile: cargoData.filePath,
        language: 'rust',
      },
    };

    artifacts.push({
      artifact,
      confidence: {
        overall: 0.9,
        breakdown: { evidence: 0.95 },
        factors: [{ description: 'Cargo.toml analysis', weight: 0.95, source: 'rust' }],
      },
      provenance: {
        evidence: [cargoEvidence.id],
        plugins: ['rust'],
        rules: ['cargo-simplification'],
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
    return 'library';
  }
}

export const rustPlugin = new RustPlugin();
