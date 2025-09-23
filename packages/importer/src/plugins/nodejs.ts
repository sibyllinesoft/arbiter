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

import type { DetectionContext } from '../detection/artifact-detector.js';
import { detectArtifactType } from '../detection/artifact-detector.js';
import type { CategoryMatrix } from '../detection/dependency-matrix.js';
import type { ArtifactType } from '../types.js';

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
    const baseId = path.relative(context?.projectRoot || '', filePath);

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
      for (const pkgEv of packageEvidence) {
        artifacts.push(...(await this.inferFromPackageJson(pkgEv, context)));
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

      // Compute logical file path based on package name
      const relativeDir = path.dirname(baseId);
      const actualSubdir = path.basename(relativeDir);
      const scopedPart = pkg.name.replace(/^@[^/]+\//, '');
      const logicalSubdir = scopedPart;
      const logicalRelativeDir = relativeDir.replace(
        new RegExp(`/${actualSubdir}$`),
        `/${logicalSubdir}`
      );
      const logicalFilePath = path.join(logicalRelativeDir, 'package.json');

      const packageData = {
        name: pkg.name || path.basename(path.dirname(filePath)),
        description: pkg.description || '',
        fullPackage: pkg,
        filePath: logicalFilePath,
      };

      evidence.push({
        id: baseId,
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
    const packageData = packageEvidence.data as any;
    const pkg = packageData.fullPackage;

    // Prepare detection context
    const allDeps = Object.keys({ ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) });
    const scripts = pkg.scripts || {};
    const filePatterns = Array.from(context.fileIndex.files.values())
      .filter(f => f.relativePath.startsWith(path.dirname(packageData.filePath)))
      .map(f => f.relativePath);

    const detectionContext = {
      language: 'javascript',
      dependencies: allDeps,
      scripts,
      filePatterns,
      packageConfig: pkg,
    };

    // Use artifact detector
    const { primaryType, confidence } = this.detectArtifactType(detectionContext);

    // Map category to artifact type
    const artifactType = this.mapCategoryToType(primaryType);

    const artifact = {
      id: `nodejs-${packageData.name}`,
      type: artifactType,
      name: packageData.name,
      description: packageData.description || `Node.js ${artifactType}: ${packageData.name}`,
      tags: ['nodejs', artifactType],
      metadata: {
        sourceFile: packageData.filePath,
        language: 'javascript',
        framework: this.inferFramework(pkg),
        detectedType: primaryType,
      },
    };

    artifacts.push({
      artifact,
      confidence: {
        overall: confidence,
        breakdown: { detection: confidence },
        factors: [
          {
            description: 'Advanced package.json analysis with dependency matrix',
            weight: confidence,
            source: 'nodejs',
          },
        ],
      },
      provenance: {
        evidence: [packageEvidence.id],
        plugins: ['nodejs'],
        rules: ['advanced-package-detection'],
        timestamp: Date.now(),
        pipelineVersion: '1.0.0',
      },
      relationships: [],
    });

    return artifacts;
  }

  private detectArtifactType(context: DetectionContext): {
    primaryType: keyof CategoryMatrix;
    confidence: number;
  } {
    const result = detectArtifactType(context);
    return { primaryType: result.primaryType, confidence: result.confidence };
  }

  private mapCategoryToType(category: keyof CategoryMatrix): ArtifactType {
    const mapping: Record<keyof CategoryMatrix, ArtifactType> = {
      cli: 'cli',
      web_service: 'service',
      frontend: 'frontend',
      library: 'module',
      desktop_app: 'binary', // or 'library' depending on context
      data_processing: 'module',
      testing: 'test',
      build_tool: 'module',
      game: 'frontend',
      mobile: 'frontend',
    };
    return mapping[category] || 'module';
  }

  private inferFramework(pkg: any): string {
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    if (NODE_WEB_FRAMEWORKS.some(fw => deps[fw])) return 'web';
    if (NODE_FRONTEND_FRAMEWORKS.some(fw => deps[fw])) return 'frontend';
    if (NODE_CLI_FRAMEWORKS.some(fw => deps[fw])) return 'cli';
    return 'unknown';
  }
}

export const nodejsPlugin = new NodeJSPlugin();
