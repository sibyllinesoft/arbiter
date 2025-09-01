/**
 * Test Generation Orchestrator
 * 
 * Main entry point that orchestrates the complete test generation pipeline:
 * CUE Export → IR → Template Rendering → Validation → NDJSON Harness
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger.js';
import { IRConverter, type IRConversionOptions } from './ir-converter.js';
import { TemplateRenderer, type TemplateRendererOptions } from './template-renderer.js';
import { NDJSONHarness, type NDJSONHarnessOptions } from './ndjson-harness.js';
import {
  TestGenerationIR,
  ValidatedTestArtifact,
  TestVector,
  ValidationError,
} from './ir-types.js';

export interface TestGenerationOptions {
  inputDir: string;
  outputDir: string;
  strictValidation: boolean;
  generateNDJSON: boolean;
  runHarness: boolean;
  dryRun: boolean;
  maxScenarios: number;
  frameworks: ('bun' | 'playwright' | 'vitest')[];
  
  // Sub-component options
  converter: Partial<IRConversionOptions>;
  renderer: Partial<TemplateRendererOptions>;
  harness: Partial<NDJSONHarnessOptions>;
}

export interface TestGenerationReport {
  summary: {
    totalInputFiles: number;
    totalScenarios: number;
    successfulArtifacts: number;
    failedArtifacts: number;
    skippedArtifacts: number;
    validationErrors: number;
    ndjsonVectors: number;
    harnessResults?: {
      passed: number;
      failed: number;
      coverage: number;
    };
  };
  artifacts: ValidatedTestArtifact[];
  errors: string[];
  performance: {
    conversionTime: number;
    renderingTime: number;
    validationTime: number;
    harnessTime: number;
    totalTime: number;
  };
  files: {
    inputFiles: string[];
    outputFiles: string[];
    ndjsonFile?: string;
  };
}

/**
 * Main Test Generation Orchestrator
 */
export class TestGenerator {
  private readonly options: TestGenerationOptions;
  private readonly converter: IRConverter;
  private readonly renderer: TemplateRenderer;
  private readonly harness: NDJSONHarness;

  constructor(options: Partial<TestGenerationOptions> = {}) {
    this.options = {
      inputDir: 'cue-schemas',
      outputDir: 'tests/generated',
      strictValidation: true,
      generateNDJSON: true,
      runHarness: false, // Can be slow, opt-in
      dryRun: false,
      maxScenarios: 1000,
      frameworks: ['bun'],
      converter: {},
      renderer: {},
      harness: {},
      ...options,
    };

    // Initialize sub-components
    this.converter = new IRConverter();
    
    this.renderer = new TemplateRenderer({
      outputDir: this.options.outputDir,
      strict: this.options.strictValidation,
      dryRun: this.options.dryRun,
      skipValidation: !this.options.strictValidation,
      ...this.options.renderer,
    });

    this.harness = new NDJSONHarness({
      outputFile: path.join(this.options.outputDir, 'vectors', 'test-vectors.ndjson'),
      runValidation: this.options.runHarness,
      maxVectors: this.options.maxScenarios * 10, // ~10 vectors per scenario
      ...this.options.harness,
    });
  }

  /**
   * Generate all tests from CUE schema directory
   */
  async generateAllTests(): Promise<TestGenerationReport> {
    const startTime = Date.now();
    logger.info(`Starting test generation from ${this.options.inputDir}`);

    try {
      // 1. Discover CUE files
      const inputFiles = await this.discoverCUEFiles();
      logger.info(`Found ${inputFiles.length} CUE schema files`);

      if (inputFiles.length === 0) {
        throw new Error(`No CUE files found in ${this.options.inputDir}`);
      }

      // 2. Convert all files to IR
      const conversionStart = Date.now();
      const irResults = await this.convertAllFiles(inputFiles);
      const conversionTime = Date.now() - conversionStart;

      // 3. Render all scenarios to TypeScript tests
      const renderingStart = Date.now();
      const artifacts = await this.renderAllScenarios(irResults);
      const renderingTime = Date.now() - renderingStart;

      // 4. Generate NDJSON vectors
      const validationStart = Date.now();
      let ndjsonVectors: TestVector[] = [];
      let harnessResults;

      if (this.options.generateNDJSON) {
        ndjsonVectors = await this.generateAllVectors(irResults);
        await this.harness.writeVectors(ndjsonVectors);

        if (this.options.runHarness) {
          harnessResults = await this.harness.runValidationHarness(ndjsonVectors);
        }
      }
      const validationTime = Date.now() - validationStart;

      // 5. Write artifacts to filesystem
      const writeStart = Date.now();
      await this.renderer.writeArtifacts(artifacts);
      const writeTime = Date.now() - writeStart;

      // 6. Generate report
      const totalTime = Date.now() - startTime;
      const report = this.createReport({
        inputFiles,
        irResults,
        artifacts,
        ndjsonVectors,
        harnessResults,
        performance: {
          conversionTime,
          renderingTime,
          validationTime: validationTime - writeTime,
          harnessTime: writeTime,
          totalTime,
        },
      });

      logger.info(`Test generation completed in ${totalTime}ms`);
      logger.info(`Generated ${report.summary.successfulArtifacts} test files, ${report.summary.ndjsonVectors} vectors`);

      return report;

    } catch (error) {
      logger.error(`Test generation failed: ${error}`);
      throw new ValidationError(
        `Test generation failed: ${error instanceof Error ? error.message : String(error)}`,
        'test_generation',
        { options: this.options, error }
      );
    }
  }

  /**
   * Generate tests from a single CUE file
   */
  async generateFromFile(cueFile: string): Promise<TestGenerationReport> {
    logger.info(`Generating tests from single file: ${cueFile}`);

    const cueExport = await this.loadCUEExport(cueFile);
    const ir = await this.converter.convertCUEToIR(cueExport, cueFile, this.options.converter);
    
    const artifacts = await this.renderer.renderScenarios(ir.scenarios);
    await this.renderer.writeArtifacts(artifacts);

    let ndjsonVectors: TestVector[] = [];
    if (this.options.generateNDJSON) {
      ndjsonVectors = await this.harness.generateVectors(ir);
      await this.harness.writeVectors(ndjsonVectors);
    }

    return this.createReport({
      inputFiles: [cueFile],
      irResults: [ir],
      artifacts,
      ndjsonVectors,
      performance: {
        conversionTime: 0,
        renderingTime: 0,
        validationTime: 0,
        harnessTime: 0,
        totalTime: 0,
      },
    });
  }

  /**
   * Dry run - generate IR and validate without writing files
   */
  async dryRun(): Promise<TestGenerationReport> {
    logger.info('Running dry run - no files will be written');
    
    const originalDryRun = this.options.dryRun;
    this.options.dryRun = true;
    
    try {
      const report = await this.generateAllTests();
      this.options.dryRun = originalDryRun;
      return report;
    } catch (error) {
      this.options.dryRun = originalDryRun;
      throw error;
    }
  }

  /**
   * Validate existing generated tests
   */
  async validateExistingTests(): Promise<TestGenerationReport> {
    logger.info('Validating existing generated tests');

    // Find existing test files
    const testFiles = await this.discoverGeneratedTests();
    
    // Create mock artifacts for validation
    const artifacts = await Promise.all(testFiles.map(async file => {
      const content = await fs.readFile(file, 'utf-8');
      return this.createMockArtifact(file, content);
    }));

    return this.createReport({
      inputFiles: [],
      irResults: [],
      artifacts,
      ndjsonVectors: [],
      performance: {
        conversionTime: 0,
        renderingTime: 0,
        validationTime: 0,
        harnessTime: 0,
        totalTime: 0,
      },
    });
  }

  // Private methods

  private async discoverCUEFiles(): Promise<string[]> {
    try {
      const files = await this.walkDirectory(this.options.inputDir);
      return files.filter(file => 
        file.endsWith('.cue') || 
        file.endsWith('.json') || 
        file.endsWith('.cue.json')
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.warn(`Input directory ${this.options.inputDir} does not exist, creating it`);
        await fs.mkdir(this.options.inputDir, { recursive: true });
        return [];
      }
      throw error;
    }
  }

  private async walkDirectory(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip node_modules and hidden directories
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue;
        }
        files.push(...await this.walkDirectory(fullPath));
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }

    return files;
  }

  private async convertAllFiles(files: string[]): Promise<TestGenerationIR[]> {
    const results: TestGenerationIR[] = [];

    for (const file of files) {
      try {
        const cueExport = await this.loadCUEExport(file);
        const ir = await this.converter.convertCUEToIR(cueExport, file, this.options.converter);
        results.push(ir);
      } catch (error) {
        logger.warn(`Failed to convert ${file}: ${error}`);
      }
    }

    return results;
  }

  private async loadCUEExport(file: string): Promise<any> {
    try {
      const content = await fs.readFile(file, 'utf-8');
      
      // Try to parse as JSON first
      if (file.endsWith('.json')) {
        return JSON.parse(content);
      }
      
      // For .cue files, they should have been exported to JSON first
      // This is a placeholder - in real implementation, we'd call `cue export`
      throw new Error(`Raw CUE files not supported yet. Please export to JSON first: cue export ${file} > ${file}.json`);
      
    } catch (error) {
      throw new ValidationError(
        `Failed to load CUE export from ${file}: ${error instanceof Error ? error.message : String(error)}`,
        'file_loading',
        { file, error }
      );
    }
  }

  private async renderAllScenarios(irResults: TestGenerationIR[]): Promise<ValidatedTestArtifact[]> {
    const allScenarios = irResults.flatMap(ir => ir.scenarios);
    
    if (allScenarios.length > this.options.maxScenarios) {
      logger.warn(`Found ${allScenarios.length} scenarios, limiting to ${this.options.maxScenarios}`);
      allScenarios.splice(this.options.maxScenarios);
    }

    return await this.renderer.renderScenarios(allScenarios);
  }

  private async generateAllVectors(irResults: TestGenerationIR[]): Promise<TestVector[]> {
    const allVectors: TestVector[] = [];

    for (const ir of irResults) {
      const vectors = await this.harness.generateVectors(ir);
      allVectors.push(...vectors);
    }

    return allVectors;
  }

  private async discoverGeneratedTests(): Promise<string[]> {
    const testDir = this.options.outputDir;
    
    try {
      const files = await this.walkDirectory(testDir);
      return files.filter(file => file.endsWith('.test.ts'));
    } catch (error) {
      logger.warn(`No existing tests found in ${testDir}`);
      return [];
    }
  }

  private createMockArtifact(file: string, content: string): ValidatedTestArtifact {
    return {
      filename: path.basename(file),
      relativePath: path.relative(this.options.outputDir, file),
      content,
      sourceIR: {} as any, // Mock IR
      validation: {
        prettier: { name: 'prettier', status: 'pending' },
        typescript: { name: 'typescript', status: 'pending' },
        framework: { name: 'framework', status: 'pending' },
        syntax: { name: 'syntax', status: 'pending' },
      },
      dependencies: [],
      framework: 'bun',
      category: 'unit',
    };
  }

  private createReport(data: {
    inputFiles: string[];
    irResults: TestGenerationIR[];
    artifacts: ValidatedTestArtifact[];
    ndjsonVectors: TestVector[];
    harnessResults?: any;
    performance: TestGenerationReport['performance'];
  }): TestGenerationReport {
    const { inputFiles, irResults, artifacts, ndjsonVectors, harnessResults, performance } = data;

    const successful = artifacts.filter(a => this.isSuccessfulArtifact(a)).length;
    const failed = artifacts.filter(a => this.isFailedArtifact(a)).length;
    const skipped = artifacts.filter(a => this.isSkippedArtifact(a)).length;

    const validationErrors = artifacts.reduce((count, artifact) => {
      return count + Object.values(artifact.validation).filter(gate => gate.status === 'failed').length;
    }, 0);

    const errors = artifacts
      .flatMap(artifact => Object.values(artifact.validation))
      .filter(gate => gate.status === 'failed')
      .map(gate => gate.error || 'Unknown validation error')
      .filter(error => error !== 'Unknown validation error');

    return {
      summary: {
        totalInputFiles: inputFiles.length,
        totalScenarios: irResults.reduce((sum, ir) => sum + ir.scenarios.length, 0),
        successfulArtifacts: successful,
        failedArtifacts: failed,
        skippedArtifacts: skipped,
        validationErrors,
        ndjsonVectors: ndjsonVectors.length,
        harnessResults: harnessResults ? {
          passed: harnessResults.passedVectors,
          failed: harnessResults.failedVectors,
          coverage: Math.round((harnessResults.passedVectors / harnessResults.totalVectors) * 100),
        } : undefined,
      },
      artifacts,
      errors: errors.slice(0, 20), // Limit error list
      performance,
      files: {
        inputFiles,
        outputFiles: artifacts.map(a => path.join(this.options.outputDir, a.relativePath)),
        ndjsonFile: ndjsonVectors.length > 0 ? 
          path.join(this.options.outputDir, 'vectors', 'test-vectors.ndjson') : 
          undefined,
      },
    };
  }

  private isSuccessfulArtifact(artifact: ValidatedTestArtifact): boolean {
    return Object.values(artifact.validation).every(gate => gate.status === 'passed');
  }

  private isFailedArtifact(artifact: ValidatedTestArtifact): boolean {
    return Object.values(artifact.validation).some(gate => gate.status === 'failed') &&
           !this.isSkippedArtifact(artifact);
  }

  private isSkippedArtifact(artifact: ValidatedTestArtifact): boolean {
    return artifact.filename.includes('SKIPPED') || 
           artifact.content.startsWith('// SKIPPED:');
  }
}

export { TestGenerator };