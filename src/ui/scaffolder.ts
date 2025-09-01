/**
 * UI Scaffolding Engine
 * 
 * Main scaffolding engine that parses Profile.ui definitions from CUE files
 * and generates platform-specific code using registered generators.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

import {
  UIScaffolder,
  UIGenerator,
  ProfileUI,
  ProfileUISchema,
  GeneratorOptions,
  ScaffoldResult,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  GeneratedArtifact,
  Platform,
  UIScaffoldError,
  SUPPORTED_PLATFORMS,
  DEFAULT_GENERATOR_OPTIONS,
} from './types.js';

const execAsync = promisify(exec);

/**
 * Main UI Scaffolding Engine Implementation
 * 
 * Orchestrates the generation of UI code from CUE specifications by:
 * 1. Parsing CUE files to extract Profile.ui definitions
 * 2. Validating the configuration
 * 3. Delegating to platform-specific generators
 * 4. Collecting and returning results
 */
export class UIScaffolderEngine implements UIScaffolder {
  private generators = new Map<Platform, UIGenerator>();
  private logger: (message: string) => void;

  constructor(logger?: (message: string) => void) {
    this.logger = logger || ((message) => console.log(`[Scaffolder] ${message}`));
  }

  /**
   * Register a platform-specific generator
   */
  addGenerator(generator: UIGenerator): void {
    if (!SUPPORTED_PLATFORMS.includes(generator.platform)) {
      throw new UIScaffoldError(
        `Unsupported platform: ${generator.platform}`,
        'UNSUPPORTED_PLATFORM'
      );
    }
    
    this.generators.set(generator.platform, generator);
    this.logger(`Registered generator for platform: ${generator.platform}`);
  }

  /**
   * Unregister a platform-specific generator
   */
  removeGenerator(platform: Platform): void {
    if (this.generators.has(platform)) {
      this.generators.delete(platform);
      this.logger(`Removed generator for platform: ${platform}`);
    }
  }

  /**
   * Main scaffolding method - parses CUE and generates artifacts
   */
  async scaffold(ui: ProfileUI, options: GeneratorOptions): Promise<ScaffoldResult> {
    const startTime = Date.now();
    const result: ScaffoldResult = {
      success: false,
      artifacts: [],
      errors: [],
      warnings: [],
      stats: {
        routesGenerated: 0,
        componentsGenerated: 0,
        formsGenerated: 0,
        testsGenerated: 0,
        duration: 0,
      },
    };

    try {
      // Validate the UI configuration
      const validation = this.validate(ui);
      if (!validation.valid) {
        result.errors = validation.errors.map(e => `Validation error: ${e.message} (${e.path})`);
        result.warnings = validation.warnings.map(w => `Validation warning: ${w.message} (${w.path})`);
        return result;
      }

      // Get the appropriate generator
      const generator = this.generators.get(options.platform);
      if (!generator) {
        throw new UIScaffoldError(
          `No generator registered for platform: ${options.platform}`,
          'GENERATOR_NOT_FOUND',
          options.platform
        );
      }

      // Validate generator options
      if (!generator.validateOptions(options)) {
        throw new UIScaffoldError(
          `Invalid options for platform: ${options.platform}`,
          'INVALID_OPTIONS',
          options.platform
        );
      }

      // Ensure output directory exists
      await this.ensureDirectory(options.outputDir);

      if (options.verbose) {
        this.logger(`Starting generation for platform: ${options.platform}`);
        this.logger(`Output directory: ${options.outputDir}`);
      }

      // Generate all artifacts
      const artifacts = await generator.generate(ui, options);
      result.artifacts = artifacts;

      // Update statistics
      result.stats.routesGenerated = artifacts.filter(a => a.type === 'route').length;
      result.stats.componentsGenerated = artifacts.filter(a => a.type === 'component').length;
      result.stats.formsGenerated = artifacts.filter(a => a.type === 'form').length;
      result.stats.testsGenerated = artifacts.filter(a => a.type === 'test').length;

      // Write artifacts to disk (unless dry run)
      if (!options.dryRun) {
        await this.writeArtifacts(artifacts, options);
      }

      result.success = true;

      if (options.verbose) {
        this.logger(`Generated ${artifacts.length} artifacts successfully`);
        this.logger(`Routes: ${result.stats.routesGenerated}`);
        this.logger(`Components: ${result.stats.componentsGenerated}`);
        this.logger(`Forms: ${result.stats.formsGenerated}`);
        this.logger(`Tests: ${result.stats.testsGenerated}`);
      }

    } catch (error) {
      if (error instanceof UIScaffoldError) {
        result.errors.push(error.message);
      } else {
        result.errors.push(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
      }
    } finally {
      result.stats.duration = Date.now() - startTime;
    }

    return result;
  }

  /**
   * Parse CUE file and extract Profile.ui configuration
   */
  async parseCUE(cuePath: string): Promise<ProfileUI> {
    try {
      // Ensure the CUE file exists
      await fs.access(cuePath);

      if (path.extname(cuePath) !== '.cue') {
        throw new UIScaffoldError(
          `File is not a CUE file: ${cuePath}`,
          'INVALID_FILE_TYPE'
        );
      }

      // Use CUE CLI to export Profile.ui as JSON
      const { stdout, stderr } = await execAsync(
        `cue export --expression "Profile.ui" "${cuePath}"`,
        { cwd: path.dirname(cuePath) }
      );

      if (stderr) {
        throw new UIScaffoldError(
          `CUE parsing error: ${stderr}`,
          'CUE_PARSE_ERROR'
        );
      }

      if (!stdout.trim()) {
        throw new UIScaffoldError(
          `No Profile.ui found in CUE file: ${cuePath}`,
          'NO_PROFILE_UI'
        );
      }

      // Parse JSON and validate against schema
      const parsed = JSON.parse(stdout);
      const result = ProfileUISchema.safeParse(parsed);

      if (!result.success) {
        const errors = result.error.errors.map(e => 
          `${e.path.join('.')}: ${e.message}`
        ).join(', ');
        
        throw new UIScaffoldError(
          `Invalid Profile.ui schema: ${errors}`,
          'SCHEMA_VALIDATION_ERROR'
        );
      }

      return result.data;

    } catch (error) {
      if (error instanceof UIScaffoldError) {
        throw error;
      }
      
      throw new UIScaffoldError(
        `Failed to parse CUE file: ${error instanceof Error ? error.message : String(error)}`,
        'CUE_FILE_ERROR'
      );
    }
  }

  /**
   * Validate Profile.ui configuration
   */
  validate(ui: ProfileUI): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate schema first
    const schemaResult = ProfileUISchema.safeParse(ui);
    if (!schemaResult.success) {
      schemaResult.error.errors.forEach(error => {
        errors.push({
          path: error.path.join('.'),
          message: error.message,
          code: 'SCHEMA_ERROR',
        });
      });
    }

    // Validate routes
    if (ui.routes) {
      Object.entries(ui.routes).forEach(([path, route]) => {
        // Check for valid URL path format
        if (!path.startsWith('/')) {
          errors.push({
            path: `routes.${path}`,
            message: 'Route path must start with "/"',
            code: 'INVALID_ROUTE_PATH',
          });
        }

        // Validate component exists if specified
        if (route.component && ui.components && !ui.components[route.component]) {
          warnings.push({
            path: `routes.${path}.component`,
            message: `Component "${route.component}" not found in components definition`,
            code: 'COMPONENT_NOT_FOUND',
          });
        }
      });
    }

    // Validate forms
    if (ui.forms) {
      Object.entries(ui.forms).forEach(([formName, form]) => {
        // Validate field names are unique
        const fieldNames = form.fields.map(f => f.name);
        const duplicates = fieldNames.filter((name, index) => fieldNames.indexOf(name) !== index);
        
        if (duplicates.length > 0) {
          errors.push({
            path: `forms.${formName}.fields`,
            message: `Duplicate field names: ${duplicates.join(', ')}`,
            code: 'DUPLICATE_FIELD_NAMES',
          });
        }
      });
    }

    // Validate components
    if (ui.components) {
      Object.entries(ui.components).forEach(([componentName, component]) => {
        // Check if component references exist
        if (component.children) {
          component.children.forEach(childName => {
            if (!ui.components![childName]) {
              warnings.push({
                path: `components.${componentName}.children`,
                message: `Child component "${childName}" not found`,
                code: 'CHILD_COMPONENT_NOT_FOUND',
              });
            }
          });
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Ensure directory exists, creating it if necessary
   */
  private async ensureDirectory(dir: string): Promise<void> {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      throw new UIScaffoldError(
        `Failed to create directory: ${dir}`,
        'DIRECTORY_CREATE_ERROR',
        undefined,
        { directory: dir, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Write generated artifacts to disk
   */
  private async writeArtifacts(
    artifacts: GeneratedArtifact[],
    options: GeneratorOptions
  ): Promise<void> {
    for (const artifact of artifacts) {
      const fullPath = path.resolve(options.outputDir, artifact.path);
      const dir = path.dirname(fullPath);

      // Ensure directory exists
      await this.ensureDirectory(dir);

      // Check if file exists and handle overwrite
      try {
        await fs.access(fullPath);
        
        if (!options.overwrite) {
          this.logger(`Skipping existing file: ${artifact.path}`);
          continue;
        }
      } catch {
        // File doesn't exist, which is fine
      }

      // Write the file
      try {
        await fs.writeFile(fullPath, artifact.content, 'utf8');
        
        if (options.verbose) {
          this.logger(`Generated: ${artifact.path}`);
        }
      } catch (error) {
        throw new UIScaffoldError(
          `Failed to write artifact: ${artifact.path}`,
          'ARTIFACT_WRITE_ERROR',
          artifact.platform,
          { path: fullPath, error: error instanceof Error ? error.message : String(error) }
        );
      }
    }
  }
}

/**
 * Create a default scaffolder instance with common configuration
 */
export function createScaffolder(options?: {
  verbose?: boolean;
  logger?: (message: string) => void;
}): UIScaffolder {
  const scaffolder = new UIScaffolderEngine(options?.logger);
  
  // Auto-register generators when they become available
  // This allows for lazy loading of platform-specific generators
  
  return scaffolder;
}

/**
 * Utility function to scaffold from a CUE file
 */
export async function scaffoldFromCUE(
  cuePath: string,
  options: GeneratorOptions
): Promise<ScaffoldResult> {
  const scaffolder = createScaffolder({ verbose: options.verbose });
  
  // Parse the CUE file
  const ui = await scaffolder.parseCUE(cuePath);
  
  // Perform scaffolding
  return scaffolder.scaffold(ui, options);
}

/**
 * Utility function to get merged options with defaults
 */
export function getScaffolderOptions(
  platform: Platform,
  outputDir: string,
  overrides?: Partial<GeneratorOptions>
): GeneratorOptions {
  return {
    ...DEFAULT_GENERATOR_OPTIONS,
    platform,
    outputDir,
    ...overrides,
  } as GeneratorOptions;
}