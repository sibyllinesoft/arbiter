/**
 * Template-based Test Renderer with Validation Gates
 * 
 * Renders TypeScript test files from IR using templates, with mandatory
 * validation gates (Prettier, TSC, framework) to prevent syntax errors.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  ScenarioIR,
  ValidatedTestArtifact,
  TemplateContext,
  ImportResolver,
  ValidationError,
  ValidationGate,
  TestVector,
} from './ir-types.js';
import { logger } from '../utils/logger.js';

const execAsync = promisify(exec);

export interface TemplateRendererOptions {
  outputDir: string;
  strict: boolean;
  dryRun: boolean;
  skipValidation: boolean;
  timeout: number;
}

export class TemplateRenderer {
  private readonly options: TemplateRendererOptions;
  private readonly importResolvers: Map<string, ImportResolver>;

  constructor(options: Partial<TemplateRendererOptions> = {}) {
    this.options = {
      outputDir: 'tests/generated',
      strict: true,
      dryRun: false,
      skipValidation: false,
      timeout: 30000,
      ...options,
    };

    this.importResolvers = new Map([
      ['bun', this.createBunImportResolver()],
      ['playwright', this.createPlaywrightImportResolver()],
      ['vitest', this.createVitestImportResolver()],
    ]);
  }

  /**
   * Render scenario to validated TypeScript test file
   */
  async renderScenario(scenario: ScenarioIR): Promise<ValidatedTestArtifact> {
    try {
      logger.info(`Rendering scenario: ${scenario.name}`);

      // 1. Determine output paths and imports
      const { filename, relativePath, category } = this.getOutputPaths(scenario);
      const importResolver = this.getImportResolver(scenario.framework);

      // 2. Create template context with safe string emission
      const context = this.createTemplateContext(scenario, importResolver);

      // 3. Render content using templates (not concatenation)
      const rawContent = this.renderTemplate(context);

      // 4. Apply validation gates
      const artifact: ValidatedTestArtifact = {
        filename,
        relativePath,
        content: rawContent,
        sourceIR: scenario,
        validation: {
          prettier: { name: 'prettier', status: 'pending' },
          typescript: { name: 'typescript', status: 'pending' },
          framework: { name: 'framework', status: 'pending' },
          syntax: { name: 'syntax', status: 'pending' },
        },
        dependencies: importResolver.dependencies,
        framework: scenario.framework,
        category,
      };

      if (!this.options.skipValidation) {
        await this.applyValidationGates(artifact);
      }

      return artifact;

    } catch (error) {
      throw new ValidationError(
        `Failed to render scenario ${scenario.name}: ${error instanceof Error ? error.message : String(error)}`,
        'rendering',
        { scenario: scenario.name, error }
      );
    }
  }

  /**
   * Render multiple scenarios in parallel
   */
  async renderScenarios(scenarios: ScenarioIR[]): Promise<ValidatedTestArtifact[]> {
    const results = await Promise.allSettled(
      scenarios.map(scenario => this.renderScenario(scenario))
    );

    const artifacts: ValidatedTestArtifact[] = [];
    const errors: string[] = [];

    for (const [index, result] of results.entries()) {
      if (result.status === 'fulfilled') {
        artifacts.push(result.value);
      } else {
        const scenario = scenarios[index];
        errors.push(`${scenario.name}: ${result.reason}`);
        
        // Create a skipped artifact for failed scenarios
        artifacts.push(this.createSkippedArtifact(scenario, result.reason));
      }
    }

    if (errors.length > 0) {
      logger.warn(`Failed to render ${errors.length} scenarios:\n${errors.join('\n')}`);
    }

    logger.info(`Successfully rendered ${artifacts.length - errors.length}/${scenarios.length} scenarios`);

    return artifacts;
  }

  /**
   * Generate NDJSON test vectors for runtime validation
   */
  generateTestVectors(scenarios: ScenarioIR[]): TestVector[] {
    const vectors: TestVector[] = [];

    for (const scenario of scenarios) {
      // Generate positive test vectors
      for (const assertion of scenario.assertions) {
        if (assertion.type !== 'schema-validation') continue;

        vectors.push({
          scenarioId: scenario.id,
          schemaRef: scenario.schema.type,
          sample: this.generateSampleData(scenario.schema),
          expectValid: true,
          description: `Valid sample for ${scenario.name}`,
          tags: [scenario.type, scenario.framework, 'positive'],
          metadata: {
            assertion: assertion.type,
            priority: scenario.priority,
          },
        });

        // Generate negative test vector if applicable
        if (!scenario.schema.open) {
          vectors.push({
            scenarioId: scenario.id,
            schemaRef: scenario.schema.type,
            sample: this.generateInvalidSample(scenario.schema),
            expectValid: false,
            description: `Invalid sample for ${scenario.name}`,
            tags: [scenario.type, scenario.framework, 'negative'],
            metadata: {
              assertion: assertion.type,
              priority: scenario.priority,
            },
          });
        }
      }
    }

    return vectors;
  }

  /**
   * Write artifacts to filesystem with directory routing
   */
  async writeArtifacts(artifacts: ValidatedTestArtifact[]): Promise<void> {
    if (this.options.dryRun) {
      logger.info(`Dry run: Would write ${artifacts.length} test files`);
      return;
    }

    const writes = artifacts.map(async (artifact) => {
      const fullPath = path.join(this.options.outputDir, artifact.relativePath);
      const dir = path.dirname(fullPath);

      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(fullPath, artifact.content, 'utf-8');

      logger.debug(`Written test file: ${fullPath}`);
    });

    await Promise.all(writes);
    logger.info(`Written ${artifacts.length} test files to ${this.options.outputDir}`);
  }

  // Private methods

  private getOutputPaths(scenario: ScenarioIR): { filename: string; relativePath: string; category: string } {
    const sanitizedName = scenario.name
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();

    const filename = `${sanitizedName}.test.ts`;
    
    // Directory routing based on test type
    const category = scenario.type;
    const subDir = category === 'e2e' ? 'e2e' : 'unit';
    const relativePath = path.join(subDir, filename);

    return { filename, relativePath, category: subDir };
  }

  private getImportResolver(framework: string): ImportResolver {
    const resolver = this.importResolvers.get(framework);
    if (!resolver) {
      throw new ValidationError(`Unknown test framework: ${framework}`, 'import_resolution');
    }
    return resolver;
  }

  private createTemplateContext(scenario: ScenarioIR, imports: ImportResolver): TemplateContext {
    return {
      scenario,
      imports,
      helpers: {
        emitString: this.createSafeStringEmitter(),
        emitType: this.createTypeEmitter(),
        emitAssertion: this.createAssertionEmitter(),
      },
      config: {
        strict: this.options.strict,
        coverage: true,
        timeout: this.options.timeout,
      },
    };
  }

  private createSafeStringEmitter() {
    return (value: unknown): string => {
      // CRITICAL: Always use JSON.stringify for string literals
      // This guarantees proper quotes and escaping
      return JSON.stringify(String(value));
    };
  }

  private createTypeEmitter() {
    return (schema: any): string => {
      switch (schema.kind) {
        case 'primitive':
          return schema.type;
        case 'array':
          return `Array<${schema.items ? this.createTypeEmitter()(schema.items) : 'unknown'}>`;
        case 'object':
          if (schema.open) {
            return `Record<string, unknown>`;
          }
          return 'object';
        case 'union':
          return schema.alternatives?.map((alt: any) => this.createTypeEmitter()(alt)).join(' | ') || 'unknown';
        default:
          return 'unknown';
      }
    };
  }

  private createAssertionEmitter() {
    return (assertion: any): string => {
      const params = Object.entries(assertion.params || {})
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        .join(', ');
      
      return `${assertion.predicate}(${params})`;
    };
  }

  private renderTemplate(context: TemplateContext): string {
    const { scenario, imports, helpers } = context;

    // Template rendering using safe string interpolation
    return `/**
 * ${helpers.emitString(scenario.name)} Test
 * Auto-generated from Arbiter IR
 * 
 * @description ${helpers.emitString(scenario.description)}
 * @priority ${helpers.emitString(scenario.priority)}
 * @framework ${helpers.emitString(scenario.framework)}
 */

${imports.imports.test}

describe(${helpers.emitString(scenario.name)}, () => {
  ${this.renderTestCases(context)}
});
`;
  }

  private renderTestCases(context: TemplateContext): string {
    const { scenario, helpers } = context;
    const testCases: string[] = [];

    if (scenario.assertions.length === 0) {
      // Always provide at least one assertion or skip explicitly
      testCases.push(`  test.skip(${helpers.emitString('No assertions defined')}, () => {
    // TODO: Add assertions for ${helpers.emitString(scenario.name)}
  });`);
    } else {
      for (const assertion of scenario.assertions) {
        if (assertion.predicate === 'skip') {
          testCases.push(`  test.skip(${helpers.emitString(assertion.description)}, () => {
    // ${helpers.emitString(assertion.params.reason || 'Skipped')}
  });`);
        } else {
          testCases.push(`  test(${helpers.emitString(assertion.description)}, () => {
    // Arrange
    const sample = ${this.generateSampleLiteral(scenario.schema, helpers)};
    
    // Act & Assert
    expect(() => ${helpers.emitAssertion(assertion)}).not.toThrow();
  });`);
        }
      }
    }

    return testCases.join('\n\n');
  }

  private generateSampleLiteral(schema: any, helpers: TemplateContext['helpers']): string {
    switch (schema.kind) {
      case 'primitive':
        switch (schema.type) {
          case 'string': return helpers.emitString('test-value');
          case 'number': return '42';
          case 'boolean': return 'true';
          default: return 'null';
        }
      case 'array':
        return '[]';
      case 'object':
        const fields = schema.fields || {};
        const props = Object.entries(fields).map(([key, fieldSchema]: [string, any]) => {
          const value = this.generateSampleLiteral(fieldSchema, helpers);
          return `  ${JSON.stringify(key)}: ${value}`;
        }).join(',\n');
        return `{\n${props}\n}`;
      default:
        return 'null';
    }
  }

  private async applyValidationGates(artifact: ValidatedTestArtifact): Promise<void> {
    try {
      // Gate 1: Prettier formatting
      artifact.validation.prettier = await this.runPrettierGate(artifact.content);
      
      // Gate 2: TypeScript compilation check
      artifact.validation.typescript = await this.runTypeScriptGate(artifact);
      
      // Gate 3: Test framework syntax check
      artifact.validation.framework = await this.runFrameworkGate(artifact);
      
      // Gate 4: General syntax validation
      artifact.validation.syntax = await this.runSyntaxGate(artifact.content);

      // Apply formatted content if all gates pass
      if (this.allGatesPassed(artifact)) {
        artifact.content = await this.formatContent(artifact.content);
      }

    } catch (error) {
      throw new ValidationError(
        `Validation gates failed: ${error instanceof Error ? error.message : String(error)}`,
        'validation_gates',
        { artifact: artifact.filename, error }
      );
    }
  }

  private async runPrettierGate(content: string): Promise<ValidationGate> {
    try {
      // Use npx prettier to check formatting
      const tempFile = `/tmp/arbiter-test-${Date.now()}.ts`;
      await fs.writeFile(tempFile, content);
      
      await execAsync(`npx prettier --check "${tempFile}"`);
      
      await fs.unlink(tempFile);
      
      return {
        name: 'prettier',
        status: 'passed',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        name: 'prettier',
        status: 'failed',
        error: `Prettier check failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private async runTypeScriptGate(artifact: ValidatedTestArtifact): Promise<ValidationGate> {
    try {
      // Create temporary TypeScript file and run tsc --noEmit
      const tempFile = `/tmp/arbiter-test-${Date.now()}.ts`;
      await fs.writeFile(tempFile, artifact.content);
      
      await execAsync(`npx tsc --noEmit --skipLibCheck "${tempFile}"`);
      
      await fs.unlink(tempFile);
      
      return {
        name: 'typescript',
        status: 'passed',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        name: 'typescript',
        status: 'failed',
        error: `TypeScript check failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private async runFrameworkGate(artifact: ValidatedTestArtifact): Promise<ValidationGate> {
    try {
      // Framework-specific validation
      const requiredImports = this.getRequiredImports(artifact.framework);
      const hasImports = requiredImports.every(imp => 
        artifact.content.includes(imp)
      );

      if (!hasImports) {
        throw new Error(`Missing required imports for ${artifact.framework}`);
      }

      return {
        name: 'framework',
        status: 'passed',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        name: 'framework',
        status: 'failed',
        error: `Framework check failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private async runSyntaxGate(content: string): Promise<ValidationGate> {
    try {
      // Basic syntax checks
      if (content.includes('}...')) {
        throw new Error('CUE ellipsis syntax found in output');
      }
      
      if (/[^\\]"[^"]*$/.test(content)) {
        throw new Error('Unterminated string literal detected');
      }

      if (/\b(undefined|null)\s*[,}]/.test(content) === false && content.includes('undefined')) {
        throw new Error('Potentially malformed object structure');
      }

      return {
        name: 'syntax',
        status: 'passed',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        name: 'syntax',
        status: 'failed',
        error: `Syntax check failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private allGatesPassed(artifact: ValidatedTestArtifact): boolean {
    return Object.values(artifact.validation).every(gate => gate.status === 'passed');
  }

  private async formatContent(content: string): Promise<string> {
    try {
      const tempFile = `/tmp/arbiter-format-${Date.now()}.ts`;
      await fs.writeFile(tempFile, content);
      
      const { stdout } = await execAsync(`npx prettier --write "${tempFile}" && cat "${tempFile}"`);
      
      await fs.unlink(tempFile);
      
      return stdout;
    } catch (error) {
      logger.warn(`Failed to format content: ${error}`);
      return content; // Return unformatted on error
    }
  }

  private createSkippedArtifact(scenario: ScenarioIR, error: unknown): ValidatedTestArtifact {
    const { filename, relativePath, category } = this.getOutputPaths(scenario);

    return {
      filename,
      relativePath,
      content: `// SKIPPED: ${scenario.name}\n// Error: ${String(error)}\n\nexport {};`,
      sourceIR: scenario,
      validation: {
        prettier: { name: 'prettier', status: 'failed', error: 'Skipped due to rendering error' },
        typescript: { name: 'typescript', status: 'failed', error: 'Skipped due to rendering error' },
        framework: { name: 'framework', status: 'failed', error: 'Skipped due to rendering error' },
        syntax: { name: 'syntax', status: 'failed', error: 'Skipped due to rendering error' },
      },
      dependencies: [],
      framework: scenario.framework,
      category,
    };
  }

  // Import resolver factories

  private createBunImportResolver(): ImportResolver {
    return {
      framework: 'bun',
      imports: {
        test: "import { describe, test, expect } from 'bun:test';",
        expect: 'expect',
        additional: [],
      },
      dependencies: ['bun'],
    };
  }

  private createPlaywrightImportResolver(): ImportResolver {
    return {
      framework: 'playwright',
      imports: {
        test: "import { test, expect } from '@playwright/test';",
        expect: 'expect',
        additional: [],
      },
      dependencies: ['@playwright/test'],
    };
  }

  private createVitestImportResolver(): ImportResolver {
    return {
      framework: 'vitest',
      imports: {
        test: "import { describe, test, expect } from 'vitest';",
        expect: 'expect',
        additional: [],
      },
      dependencies: ['vitest'],
    };
  }

  private getRequiredImports(framework: string): string[] {
    switch (framework) {
      case 'bun': return ['bun:test'];
      case 'playwright': return ['@playwright/test'];
      case 'vitest': return ['vitest'];
      default: return [];
    }
  }

  private generateSampleData(schema: any): unknown {
    switch (schema.kind) {
      case 'primitive':
        switch (schema.type) {
          case 'string': return 'sample-string';
          case 'number': return 42;
          case 'boolean': return true;
          default: return null;
        }
      case 'array': return [];
      case 'object': return {};
      default: return null;
    }
  }

  private generateInvalidSample(schema: any): unknown {
    // Generate data that should fail validation
    switch (schema.kind) {
      case 'primitive':
        switch (schema.type) {
          case 'string': return 42; // Wrong type
          case 'number': return 'not-a-number'; // Wrong type
          case 'boolean': return 'not-a-boolean'; // Wrong type
          default: return undefined;
        }
      case 'object':
        return schema.open ? {} : { unknownProperty: 'should-fail' };
      default:
        return undefined;
    }
  }
}

export { TemplateRenderer };