#!/usr/bin/env bun
/**
 * Export intermediate detection data for faster iteration on type detection logic
 *
 * This script scans a project and exports the detection context data to JSON
 * so we can test detection logic changes without re-scanning.
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import { glob } from 'glob';
import { NodeJSPlugin } from './plugins/nodejs.js';
import type { PackageJsonData } from './plugins/nodejs.js';
// Mock InferenceContext for test script
interface MockInferenceContext {
  projectRoot: string;
  fileIndex: any;
  allEvidence: any[];
  options: any;
  cache: any;
  projectMetadata: any;
}
import type { InferenceContext } from './types';

interface DetectionData {
  projectPath: string;
  projectName: string;
  packages: PackageDetectionData[];
}

interface PackageDetectionData {
  name: string;
  path: string;
  packageJson: PackageJsonData;
  filePatterns: string[];
  detectedType?: string;
}

async function scanProject(projectPath: string): Promise<DetectionData> {
  const projectName = path.basename(projectPath);
  console.log(`📦 Scanning project: ${projectName} at ${projectPath}`);

  // Find all package.json files
  const packageJsonPaths = await glob('**/package.json', {
    cwd: projectPath,
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**'],
    absolute: false,
  });

  const packages: PackageDetectionData[] = [];
  const plugin = new NodeJSPlugin();

  for (const pkgPath of packageJsonPaths) {
    const fullPath = path.join(projectPath, pkgPath);
    const packageDir = path.join(projectPath, path.dirname(pkgPath));

    try {
      const packageJson = await fs.readJson(fullPath);

      // Get file patterns in the package directory - use projectPath as cwd
      const filePatterns = await glob('**/*.{js,jsx,ts,tsx,mjs,cjs}', {
        cwd: packageDir,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
        absolute: false,
      });

      // Build a simple fileIndex for hasSourceFiles check
      const fileIndex = {
        root: projectPath,
        files: new Map(),
        directories: new Map(),
        timestamp: Date.now(),
      };
      const sourceFiles = await glob('**/*.{js,jsx,ts,tsx,mjs,cjs}', {
        cwd: packageDir,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
        absolute: false,
      });
      sourceFiles.forEach(relPath => {
        const absPath = path.join(packageDir, relPath);
        fileIndex.files.set(absPath, {
          path: absPath,
          relativePath: path.relative(projectPath, absPath),
          size: 0, // Mock
          lastModified: Date.now(),
          extension: path.extname(relPath),
          isBinary: false,
          hash: '',
          language: undefined,
          metadata: {},
        });
      });

      // Create mock evidence for detection
      const evidence = [
        {
          id: 'test-package',
          source: 'nodejs',
          type: 'config' as const,
          filePath: pkgPath,
          data: {
            name: packageJson.name,
            description: packageJson.description || '',
            type: 'library',
            filePath: pkgPath,
          },
          confidence: 0.95,
          metadata: {
            timestamp: Date.now(),
            fileSize: JSON.stringify(packageJson).length,
          },
        },
      ];

      // Create full inference context with proper fileIndex
      const fullEvidence = evidence;
      const projectMetadata = {
        name: projectName,
        root: projectPath,
        languages: [],
        frameworks: [],
        fileCount: 0,
        totalSize: 0,
      };
      const inferenceContext: InferenceContext = {
        projectRoot: projectPath,
        fileIndex,
        allEvidence: fullEvidence,
        options: {
          minConfidence: 0.3,
          inferRelationships: true,
          maxDependencyDepth: 5,
          useHeuristics: true,
        },
        cache: new Map(),
        projectMetadata,
      };
      // Run detection to get the type
      const artifacts = await plugin.infer(fullEvidence, inferenceContext);
      const detectedType = artifacts[0]?.artifact?.type || 'unknown';

      packages.push({
        name: packageJson.name || path.basename(packageDir),
        path: pkgPath,
        packageJson: {
          name: packageJson.name,
          description: packageJson.description || '',
          type: 'library',
          filePath: pkgPath,
        },
        filePatterns: filePatterns.slice(0, 20), // Limit to first 20 files for brevity
        detectedType,
      });

      console.log(
        `  ✅ ${packageJson.name || path.basename(packageDir)}: ${detectedType} (found ${filePatterns.length} source files)`
      );
    } catch (error) {
      console.error(`  ❌ Error processing ${pkgPath}:`, error);
    }
  }

  return {
    projectPath,
    projectName,
    packages,
  };
}

async function main() {
  const projects = ['/home/nathan/Projects/arbiter', '/home/nathan/Projects/smith'];

  const allData: DetectionData[] = [];

  for (const projectPath of projects) {
    if (await fs.pathExists(projectPath)) {
      const data = await scanProject(projectPath);
      allData.push(data);
    } else {
      console.log(`⚠️  Project not found: ${projectPath}`);
    }
  }

  // Save the detection data
  const outputPath = '/home/nathan/Projects/arbiter/detection-test-data.json';
  await fs.writeJson(outputPath, allData, { spaces: 2 });
  console.log(`\n💾 Detection data saved to: ${outputPath}`);

  // Summary
  console.log('\n📊 Summary:');
  for (const project of allData) {
    console.log(`\n${project.projectName}:`);
    const typeCounts: Record<string, number> = {};
    for (const pkg of project.packages) {
      typeCounts[pkg.detectedType || 'unknown'] =
        (typeCounts[pkg.detectedType || 'unknown'] || 0) + 1;
    }
    for (const [type, count] of Object.entries(typeCounts)) {
      console.log(`  ${type}: ${count}`);
    }
  }
}

main().catch(console.error);
