/**
 * Node.js Plugin for Brownfield Detection
 *
 * Simplified to focus on package.json parsing for name, description, type, and file path.
 */

import * as path from 'path';

import {
  Evidence,
  ImporterPlugin,
  InferenceContext,
  InferredArtifact,
  ParseContext,
} from '../types.js';

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
  'vue',
  'angular',
  'svelte',
  'solid-js',
  'preact',
  'lit',
  'stimulus',
];

const NODE_CLI_FRAMEWORKS = [
  'commander',
  'yargs',
  'inquirer',
  'ora',
  'chalk',
  'boxen',
  'cli-table3',
];

export interface PackageJsonData extends Record<string, unknown> {
  name: string;
  description?: string;
  type: string;
  filePath: string;
}

export class NodeJSPlugin implements ImporterPlugin {
  name(): string {
    return 'nodejs';
  }

  supports(filePath: string, fileContent?: string): boolean {
    const fileName = path.basename(filePath);
    return fileName === 'package.json';
  }

  async parse(filePath: string, fileContent?: string, context?: ParseContext): Promise<Evidence[]> {
    if (!fileContent || path.basename(filePath) !== 'package.json') return [];

    const evidence: Evidence[] = [];
    const baseId = `nodejs-${path.relative(context?.projectRoot || '', filePath)}`;

    try {
      evidence.push(...(await this.parsePackageJson(filePath, fileContent, baseId)));
    } catch (error) {
      console.warn(`Node.js plugin failed to parse ${filePath}:`, error);
    }

    return evidence;
  }

  async infer(evidence: Evidence[], context: InferenceContext): Promise<InferredArtifact[]> {
    const nodeEvidence = evidence.filter(e => e.source === 'nodejs');
    if (nodeEvidence.length === 0) return [];

    const artifacts: InferredArtifact[] = [];

    try {
      // Infer from package.json evidence
      const packageEvidence = nodeEvidence.filter(e => e.type === 'config');
      for (const pkg of packageEvidence) {
        artifacts.push(...(await this.inferFromPackageJson(pkg, context)));
      }
    } catch (error) {
      console.warn('Node.js plugin inference failed:', error);
    }

    return artifacts;
  }

  private async parsePackageJson(
    filePath: string,
    content: string,
    baseId: string
  ): Promise<Evidence[]> {
    const evidence: Evidence[] = [];

    try {
      const pkg = JSON.parse(content);

      const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      const inferredType = this.determineArtifactType({
        dependencies: allDeps,
        devDependencies: {},
      } as any);

      const packageData: PackageJsonData = {
        name: pkg.name || path.basename(path.dirname(filePath)),
        description: pkg.description || '',
        type: inferredType,
        filePath,
      };

      evidence.push({
        id: `${baseId}-package`,
        source: 'nodejs',
        type: 'config',
        filePath,
        data: packageData,
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

  private async inferFromPackageJson(
    packageEvidence: Evidence,
    context: InferenceContext
  ): Promise<InferredArtifact[]> {
    const artifacts: InferredArtifact[] = [];
    const packageData = packageEvidence.data as unknown as PackageJsonData;

    const artifact = {
      id: `nodejs-${packageData.name}`,
      type: packageData.type as any,
      name: packageData.name,
      description: packageData.description || `Node.js ${packageData.type}: ${packageData.name}`,
      tags: ['nodejs', packageData.type],
      metadata: {
        sourceFile: packageData.filePath,
        language: 'javascript',
      },
    };

    artifacts.push({
      artifact,
      confidence: {
        overall: 0.9,
        breakdown: { evidence: 0.95 },
        factors: [{ description: 'package.json analysis', weight: 0.95, source: 'nodejs' }],
      },
      provenance: {
        evidence: [packageEvidence.id],
        plugins: ['nodejs'],
        rules: ['package-json-simplification'],
        timestamp: Date.now(),
        pipelineVersion: '1.0.0',
      },
      relationships: [],
    });

    return artifacts;
  }

  private determineArtifactType(packageData: any): string {
    // Simple rule-based detection
    const allDeps = { ...packageData.dependencies, ...packageData.devDependencies };
    const hasWeb = NODE_WEB_FRAMEWORKS.some(fw => allDeps[fw]);
    const hasFrontend = NODE_FRONTEND_FRAMEWORKS.some(fw => allDeps[fw]);
    const hasCli = NODE_CLI_FRAMEWORKS.some(fw => allDeps[fw]);

    if (hasWeb) return 'service';
    if (hasFrontend) return 'frontend';
    if (hasCli) return 'cli';
    return 'library';
  }
}

export const nodejsPlugin = new NodeJSPlugin();
