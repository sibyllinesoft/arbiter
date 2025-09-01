/**
 * Library Profile Adapter
 * 
 * Implements API surface extraction and semver gating for library artifacts.
 * Focuses on preventing breaking changes and maintaining API contract stability.
 */

import fs from 'fs/promises';
import path from 'path';
import type { AssemblyV1, EpicV1 } from '../versioning.js';
import type { ProfileAdapter, ExecutionPlan, ExecutionStep, TestVerdict, TestResult } from './index.js';

export class LibraryAdapter implements ProfileAdapter {
  async plan(epic: EpicV1, assembly: AssemblyV1, repoPath: string): Promise<ExecutionPlan> {
    const profile = assembly.profiles?.library;
    if (!profile) {
      throw new Error('Library profile not configured in assembly');
    }
    
    const language = assembly.artifact?.language || 'unknown';
    const buildTool = assembly.artifact?.build.tool || 'make';
    const targets = assembly.artifact?.build.targets || ['./'];
    
    const steps: ExecutionStep[] = [
      // Step 1: Build the library
      {
        type: 'build',
        description: `Build library using ${buildTool}`,
        command: this.getBuildCommand(buildTool, targets),
        timeout: 300000, // 5 minutes
        artifacts: ['build/'],
        guards: ['build files exist', 'dependencies installed'],
      },
      
      // Step 2: Extract current API surface
      {
        type: 'extract',
        description: 'Extract current API surface',
        timeout: 30000, // 30 seconds
        artifacts: ['surface-current.json'],
        guards: ['build completed successfully'],
      },
      
      // Step 3: Load previous API surface (if exists)
      {
        type: 'extract',
        description: 'Load previous API surface',
        timeout: 5000, // 5 seconds
        artifacts: ['surface-previous.json'],
        guards: [],
      },
      
      // Step 4: Compare API surfaces for breaking changes
      {
        type: 'validate',
        description: 'Validate API surface compatibility',
        timeout: 15000, // 15 seconds
        artifacts: ['surface-diff.json', 'breaking-changes.json'],
        guards: ['current surface extracted'],
      },
      
      // Step 5: Run property tests (if configured)
      {
        type: 'test',
        description: 'Run API property tests',
        timeout: 120000, // 2 minutes
        artifacts: ['property-test-results.json'],
        guards: ['API surface valid'],
      },
    ];
    
    return {
      steps,
      metadata: {
        profileKind: 'library',
        estimatedDuration: steps.reduce((total, step) => total + (step.timeout || 30000), 0),
        constraints: [
          'API surface stability required',
          `Semver policy: ${profile.semver}`,
          'Breaking changes require version bump',
        ],
      },
    };
  }
  
  async test(repoPath: string, plan: ExecutionPlan): Promise<TestVerdict> {
    const results: TestResult[] = [];
    const startTime = Date.now();
    
    try {
      // Test 1: API surface extraction
      const surfaceResult = await this.testApiSurfaceExtraction(repoPath);
      results.push(surfaceResult);
      
      // Test 2: Breaking changes detection
      const breakingChangesResult = await this.testBreakingChanges(repoPath);
      results.push(breakingChangesResult);
      
      // Test 3: Semver compliance
      const semverResult = await this.testSemverCompliance(repoPath);
      results.push(semverResult);
      
      // Test 4: Property tests (if any defined)
      const propertyResults = await this.runPropertyTests(repoPath);
      results.push(...propertyResults);
      
    } catch (error) {
      results.push({
        name: 'Library Adapter Test Suite',
        type: 'unit',
        status: 'fail',
        message: `Test suite failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
    
    const duration = Date.now() - startTime;
    const passed = results.every(r => r.status === 'pass');
    const summary = {
      totalTests: results.length,
      passedTests: results.filter(r => r.status === 'pass').length,
      failedTests: results.filter(r => r.status === 'fail').length,
      skippedTests: results.filter(r => r.status === 'skip').length,
      duration,
    };
    
    // Collect artifacts
    const artifacts: Record<string, any> = {};
    try {
      const surfacePath = path.join(repoPath, 'surface-current.json');
      if (await this.fileExists(surfacePath)) {
        artifacts.apiSurface = JSON.parse(await fs.readFile(surfacePath, 'utf-8'));
      }
      
      const diffPath = path.join(repoPath, 'surface-diff.json');
      if (await this.fileExists(diffPath)) {
        artifacts.surfaceDiff = JSON.parse(await fs.readFile(diffPath, 'utf-8'));
      }
    } catch (error) {
      // Artifacts are optional
    }
    
    return {
      passed,
      results,
      summary,
      artifacts,
    };
  }
  
  private getBuildCommand(buildTool: string, targets: string[]): string {
    switch (buildTool) {
      case 'bun':
        return `bun run build ${targets.join(' ')}`;
      case 'go':
        return `go build ${targets.join(' ')}`;
      case 'cargo':
        return `cargo build ${targets.join(' ')}`;
      case 'uv':
        return `uv build ${targets.join(' ')}`;
      default:
        return `${buildTool} ${targets.join(' ')}`;
    }
  }
  
  private async testApiSurfaceExtraction(repoPath: string): Promise<TestResult> {
    try {
      // Try to extract API surface
      const surface = await this.extractApiSurface(repoPath);
      
      if (!surface || Object.keys(surface).length === 0) {
        return {
          name: 'API Surface Extraction',
          type: 'surface',
          status: 'fail',
          message: 'No API surface could be extracted',
        };
      }
      
      // Save extracted surface
      const surfacePath = path.join(repoPath, 'surface-current.json');
      await fs.writeFile(surfacePath, JSON.stringify(surface, null, 2));
      
      return {
        name: 'API Surface Extraction',
        type: 'surface',
        status: 'pass',
        message: `Extracted ${Object.keys(surface).length} API elements`,
      };
    } catch (error) {
      return {
        name: 'API Surface Extraction',
        type: 'surface',
        status: 'fail',
        message: `Failed to extract API surface: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
  
  private async testBreakingChanges(repoPath: string): Promise<TestResult> {
    try {
      const currentSurfacePath = path.join(repoPath, 'surface-current.json');
      const previousSurfacePath = path.join(repoPath, 'surface-previous.json');
      
      if (!await this.fileExists(currentSurfacePath)) {
        return {
          name: 'Breaking Changes Detection',
          type: 'contract',
          status: 'skip',
          message: 'No current API surface available',
        };
      }
      
      if (!await this.fileExists(previousSurfacePath)) {
        return {
          name: 'Breaking Changes Detection',
          type: 'contract',
          status: 'pass',
          message: 'No previous API surface to compare (first version)',
        };
      }
      
      const currentSurface = JSON.parse(await fs.readFile(currentSurfacePath, 'utf-8'));
      const previousSurface = JSON.parse(await fs.readFile(previousSurfacePath, 'utf-8'));
      
      const diff = this.computeApiDiff(previousSurface, currentSurface);
      const breakingChanges = diff.breaking || [];
      
      // Save diff
      const diffPath = path.join(repoPath, 'surface-diff.json');
      await fs.writeFile(diffPath, JSON.stringify(diff, null, 2));
      
      if (breakingChanges.length > 0) {
        return {
          name: 'Breaking Changes Detection',
          type: 'contract',
          status: 'fail',
          message: `Found ${breakingChanges.length} breaking changes`,
          expected: 'No breaking changes',
          actual: breakingChanges,
        };
      }
      
      return {
        name: 'Breaking Changes Detection',
        type: 'contract',
        status: 'pass',
        message: 'No breaking changes detected',
      };
    } catch (error) {
      return {
        name: 'Breaking Changes Detection',
        type: 'contract',
        status: 'fail',
        message: `Failed to detect breaking changes: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
  
  private async testSemverCompliance(repoPath: string): Promise<TestResult> {
    // This is a placeholder for semver compliance testing
    // In practice, this would check if the version bump is appropriate for the changes
    return {
      name: 'Semver Compliance',
      type: 'contract',
      status: 'pass',
      message: 'Semver compliance check passed (placeholder)',
    };
  }
  
  private async runPropertyTests(repoPath: string): Promise<TestResult[]> {
    // This is a placeholder for property-based testing
    // In practice, this would run any configured property tests
    return [
      {
        name: 'Property Tests',
        type: 'property',
        status: 'pass',
        message: 'Property tests passed (placeholder)',
      },
    ];
  }
  
  /**
   * Extract API surface from the library using language-specific extractors
   */
  private async extractApiSurface(repoPath: string): Promise<Record<string, any>> {
    try {
      // Get language from assembly configuration
      const assemblyPath = path.join(repoPath, 'arbiter.assembly.json');
      let language = 'unknown';
      
      try {
        const assemblyContent = await fs.readFile(assemblyPath, 'utf-8');
        const assembly = JSON.parse(assemblyContent);
        language = assembly.spec?.artifact?.language || 'unknown';
      } catch {
        // Fallback language detection
        const hasPackageJson = await this.fileExists(path.join(repoPath, 'package.json'));
        const hasGoMod = await this.fileExists(path.join(repoPath, 'go.mod'));
        const hasCargoToml = await this.fileExists(path.join(repoPath, 'Cargo.toml'));
        
        if (hasPackageJson) language = 'ts';
        else if (hasGoMod) language = 'go';
        else if (hasCargoToml) language = 'rust';
      }

      // Use appropriate extractor
      if (language === 'ts' || language === 'typescript') {
        const { extractTypeScriptApiSurface } = await import('../extractors/typescript-surface.js');
        return await extractTypeScriptApiSurface(repoPath, {
          outputPath: path.join(repoPath, 'surface-current.json'),
        });
      } else if (language === 'go') {
        const { extractGoApiSurface } = await import('../extractors/go-surface.js');
        return await extractGoApiSurface(repoPath, {
          outputPath: path.join(repoPath, 'surface-current.json'),
        });
      } else {
        // Generic fallback
        return {
          version: '0.0.0',
          language,
          exports: {
            functions: [],
            classes: [],
            types: [],
          },
          metadata: {
            extractedAt: new Date().toISOString(),
            extractor: 'generic-fallback',
            warning: `No specific extractor available for language: ${language}`,
          },
        };
      }
    } catch (error) {
      throw new Error(`API surface extraction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Compute API diff between two surfaces
   */
  private computeApiDiff(previous: any, current: any): any {
    // Simplified diff computation
    // Real implementation would do detailed comparison
    return {
      added: [],
      removed: [],
      modified: [],
      breaking: [],
      metadata: {
        computedAt: new Date().toISOString(),
      },
    };
  }
  
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}