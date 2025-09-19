/**
 * SRF (Structured Requirements Format) commands
 *
 * Handles the conversion of proto-specs (like EMBEDDED_SRF.md, requirements.md)
 * to formal CUE specifications through a structured intermediate format.
 *
 * Workflow:
 * 1. arbiter srf create requirements.md → Generate SRF from proto-spec
 * 2. arbiter srf import spec.srf → Convert SRF to CUE specification
 */

import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import type { Config } from '../config.js';

export interface SrfOptions {
  output?: string;
  outputDir?: string;
  force?: boolean;
  verbose?: boolean;
  dryRun?: boolean;
  template?: string;
  format?: 'json' | 'yaml' | 'cue';
}

/**
 * Main SRF command dispatcher
 */
export async function srfCommand(
  subcommand: 'create' | 'import' | 'validate' | 'help',
  input?: string,
  options?: SrfOptions,
  config?: Config
): Promise<number> {
  try {
    switch (subcommand) {
      case 'create':
        return await srfCreateCommand(input, options || {}, config);
      case 'import':
        return await srfImportCommand(input, options || {}, config);
      case 'validate':
        return await srfValidateCommand(input, options || {}, config);
      case 'help':
        return srfHelpCommand();
      default:
        console.error(chalk.red(`Unknown SRF subcommand: ${subcommand}`));
        return srfHelpCommand();
    }
  } catch (error) {
    console.error(
      chalk.red('❌ SRF command failed:'),
      error instanceof Error ? error.message : String(error)
    );
    return 1;
  }
}

/**
 * Normalize spec name for directory naming
 */
function normalizeSpecName(filename: string): string {
  return path
    .basename(filename, path.extname(filename))
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Discover available specs in .arbiter/ directories
 */
function discoverAvailableSpecs(): string[] {
  const specs: string[] = [];

  if (fs.existsSync('.arbiter')) {
    const specDirs = fs
      .readdirSync('.arbiter', { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const specName of specDirs) {
      const assemblyPath = path.join('.arbiter', specName, 'assembly.cue');
      if (fs.existsSync(assemblyPath)) {
        specs.push(specName);
      }
    }
  }

  return specs.sort();
}

/**
 * Get structured output directory for a spec
 */
function getSpecOutputDir(inputFile: string, options: SrfOptions): string {
  if (options.outputDir) {
    return options.outputDir;
  }

  const specName = normalizeSpecName(inputFile);
  return path.join('.arbiter', specName);
}

/**
 * Create SRF from proto-spec (EMBEDDED_SRF.md, requirements.md, etc.)
 */
async function srfCreateCommand(
  input: string | undefined,
  options: SrfOptions,
  _config?: Config
): Promise<number> {
  if (!input) {
    console.error(chalk.red('❌ Input file required'));
    console.log(chalk.dim('Usage: arbiter srf create <proto-spec-file>'));
    console.log(chalk.dim('Example: arbiter srf create EMBEDDED_SRF.md'));
    return 1;
  }

  if (!fs.existsSync(input)) {
    console.error(chalk.red(`❌ Input file not found: ${input}`));
    return 1;
  }

  console.log(chalk.blue('🔄 Converting proto-spec to SRF format...'));
  console.log(chalk.dim(`Input: ${input}`));

  // Read the proto-spec file
  const content = fs.readFileSync(input, 'utf-8');

  // Parse proto-spec and extract structured requirements
  const srf = await parseProtoSpecToSrf(content, input);

  // Determine output path using structured directory
  const outputDir = getSpecOutputDir(input, options);
  const outputPath = options.output || path.join(outputDir, 'spec.srf');

  if (options.verbose) {
    console.log(chalk.dim('Parsed SRF structure:'));
    console.log(chalk.dim(JSON.stringify(srf, null, 2)));
  }

  // Write SRF file
  if (!options.dryRun) {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(chalk.dim(`📁 Created directory: ${outputDir}`));
    }

    if (fs.existsSync(outputPath) && !options.force) {
      console.error(chalk.red(`❌ Output file exists: ${outputPath}`));
      console.log(chalk.dim('Use --force to overwrite'));
      return 1;
    }

    fs.writeFileSync(outputPath, JSON.stringify(srf, null, 2));
    console.log(chalk.green(`✅ Created SRF: ${outputPath}`));
  } else {
    console.log(chalk.yellow(`🔍 Would create: ${outputPath}`));
  }

  console.log(chalk.cyan('\nNext step:'));
  console.log(chalk.dim(`  arbiter srf import ${input}`));

  return 0;
}

/**
 * Import SRF and convert to CUE specification
 */
async function srfImportCommand(
  input: string | undefined,
  options: SrfOptions,
  _config?: Config
): Promise<number> {
  if (!input) {
    console.error(chalk.red('❌ Input file required'));
    console.log(chalk.dim('Usage: arbiter srf import <file>'));
    console.log(chalk.dim('Example: arbiter srf import EMBEDDED_SRF.md'));
    console.log(chalk.dim('Example: arbiter srf import requirements.srf'));
    return 1;
  }

  if (!fs.existsSync(input)) {
    console.error(chalk.red(`❌ Input file not found: ${input}`));
    return 1;
  }

  console.log(chalk.blue('🔄 Converting to CUE specification...'));
  console.log(chalk.dim(`Input: ${input}`));

  // Read the input file
  const inputContent = fs.readFileSync(input, 'utf-8');
  let srf;

  // Detect file format and parse accordingly
  const inputExt = path.extname(input).toLowerCase();
  const isJsonSrf = inputExt === '.srf' || inputExt === '.json';

  try {
    if (isJsonSrf) {
      // Try to parse as JSON SRF file
      try {
        srf = JSON.parse(inputContent);
        console.log(chalk.dim('📄 Detected JSON SRF format'));
      } catch (jsonError) {
        console.error(chalk.red('❌ Invalid JSON SRF format'));
        return 1;
      }
    } else {
      // Parse as markdown proto-spec
      console.log(chalk.dim('📝 Detected markdown proto-spec format'));
      srf = await parseProtoSpecToSrf(inputContent, input);
    }
  } catch (error) {
    console.error(
      chalk.red('❌ Failed to parse input file:'),
      error instanceof Error ? error.message : String(error)
    );
    return 1;
  }

  // Convert SRF to CUE specification
  const cueSpec = await convertSrfToCue(srf, options);

  // Determine output path using structured directory
  const outputDir = getSpecOutputDir(input, options);
  const outputPath = options.output || path.join(outputDir, 'assembly.cue');

  if (options.verbose) {
    console.log(chalk.dim('Generated CUE specification:'));
    console.log(chalk.dim(cueSpec));
  }

  // Write CUE specification
  if (!options.dryRun) {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(chalk.dim(`📁 Created directory: ${outputDir}`));
    }

    if (fs.existsSync(outputPath) && !options.force) {
      console.error(chalk.red(`❌ Output file exists: ${outputPath}`));
      console.log(chalk.dim('Use --force to overwrite'));
      return 1;
    }

    fs.writeFileSync(outputPath, cueSpec);
    console.log(chalk.green(`✅ Created CUE specification: ${outputPath}`));
  } else {
    console.log(chalk.yellow(`🔍 Would create: ${outputPath}`));
  }

  // Extract spec name from the output path for better user experience
  const specName = path.basename(path.dirname(outputPath));

  console.log(chalk.red.bold('\n🚨 CRITICAL: WORKFLOW NOT COMPLETE! 🚨'));
  console.log(
    chalk.yellow.bold('⚠️  CUE specification created but project files NOT generated yet!')
  );
  console.log(chalk.cyan.bold('\n📋 YOU MUST COMPLETE THESE STEPS NOW:'));
  console.log(
    chalk.green.bold(
      `✅ STEP 1: arbiter generate ${specName}     # REQUIRED: Generate project files`
    )
  );
  console.log(
    chalk.green.bold(
      '✅ STEP 2: arbiter check                    # REQUIRED: Validate specification'
    )
  );
  console.log(
    chalk.red(
      '\n⛔ DO NOT STOP - The CUE spec alone is incomplete without generated project files!'
    )
  );
  console.log(chalk.yellow(`💡 The spec "${specName}" is now available in the system.`));

  // Show available specs in system
  const availableSpecs = discoverAvailableSpecs();
  if (availableSpecs.length > 0) {
    console.log(chalk.cyan('\n📋 All available specs in system:'));
    availableSpecs.forEach(spec => {
      const marker = spec === specName ? '← NEW' : '';
      console.log(chalk.dim(`  • ${spec} ${marker}`));
    });
  }

  return 0;
}

/**
 * Validate SRF file format and structure
 */
async function srfValidateCommand(
  input: string | undefined,
  options: SrfOptions,
  _config?: Config
): Promise<number> {
  // Validate input parameters
  const inputValidation = validateSrfInputParameters(input);
  if (inputValidation.error) {
    console.error(chalk.red(inputValidation.error));
    if (inputValidation.usage) {
      console.log(chalk.dim(inputValidation.usage));
    }
    return 1;
  }

  console.log(chalk.blue('🔍 Validating SRF file...'));

  try {
    const srf = readAndParseSrfFile(input!);
    const validationResult = performSrfValidation(srf);

    return handleValidationResult(validationResult, srf, options);
  } catch (error) {
    return handleSrfValidationError(error);
  }
}

/**
 * Validate input parameters for SRF validation
 */
function validateSrfInputParameters(input: string | undefined): { error?: string; usage?: string } {
  if (!input) {
    return {
      error: '❌ SRF file required',
      usage: 'Usage: arbiter srf validate <srf-file>',
    };
  }

  if (!fs.existsSync(input)) {
    return {
      error: `❌ SRF file not found: ${input}`,
    };
  }

  return {}; // No errors
}

/**
 * Read and parse SRF file
 */
function readAndParseSrfFile(filePath: string): any {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Perform SRF structure validation
 */
function performSrfValidation(srf: any): { isValid: boolean; errors: string[] } {
  const errors = validateSrfStructure(srf);
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Handle validation result and output
 */
function handleValidationResult(
  validationResult: { isValid: boolean; errors: string[] },
  srf: any,
  options: SrfOptions
): number {
  if (validationResult.isValid) {
    console.log(chalk.green('✅ SRF file is valid'));

    if (options.verbose) {
      displaySrfSummary(srf);
    }

    return 0;
  }
  console.log(chalk.red('❌ SRF validation failed:'));
  validationResult.errors.forEach(error => console.log(chalk.red(`  - ${error}`)));
  return 1;
}

/**
 * Display SRF summary information
 */
function displaySrfSummary(srf: any): void {
  console.log(chalk.dim('\nSRF Summary:'));
  console.log(chalk.dim(`  Project: ${srf.project?.name || 'Unknown'}`));
  console.log(chalk.dim(`  Requirements: ${srf.requirements?.length || 0}`));
  console.log(chalk.dim(`  Constraints: ${srf.constraints?.length || 0}`));
}

/**
 * Handle SRF validation errors
 */
function handleSrfValidationError(error: unknown): number {
  if (error instanceof SyntaxError) {
    console.error(chalk.red('❌ Invalid JSON format'));
  } else {
    console.error(chalk.red('❌ Validation error:'), error);
  }
  return 1;
}

/**
 * Show SRF command help
 */
function srfHelpCommand(): number {
  console.log(chalk.cyan('SRF (Structured Requirements Format) Commands'));
  console.log(chalk.dim('Convert proto-specs to formal CUE specifications'));
  console.log();

  console.log(chalk.yellow('Commands:'));
  console.log('  import <file>     Convert proto-spec to CUE specification');
  console.log('  create <file>     Convert proto-spec to intermediate SRF format (optional)');
  console.log('  validate <file>   Validate SRF file structure');
  console.log('  help             Show this help');
  console.log();

  console.log(chalk.yellow('📝 RECOMMENDED: Complete 3-Step Workflow'));
  console.log(chalk.green('  STEP 1: arbiter srf import EMBEDDED_SRF.md  # Proto-spec → CUE spec'));
  console.log(chalk.dim('          Creates: .arbiter/embedded-srf/assembly.cue'));
  console.log(
    chalk.red.bold(
      '  STEP 2: arbiter generate embedded-srf       # REQUIRED: Generate project files'
    )
  );
  console.log(
    chalk.red.bold(
      '  STEP 3: arbiter check                       # REQUIRED: Validate specification'
    )
  );
  console.log(
    chalk.yellow.bold('\n⚠️  AGENTS: You MUST complete ALL 3 STEPS for a successful workflow!')
  );
  console.log();

  console.log(chalk.yellow('Alternative: Multi-step workflow'));
  console.log(chalk.dim('  1. arbiter srf create EMBEDDED_SRF.md   # Proto-spec → SRF'));
  console.log(chalk.dim('     Creates: .arbiter/embedded-srf/spec.srf'));
  console.log(chalk.dim('  2. arbiter srf import EMBEDDED_SRF.md   # SRF → CUE spec'));
  console.log(chalk.dim('     Creates: .arbiter/embedded-srf/assembly.cue'));
  console.log(
    chalk.red.bold('  3. arbiter generate embedded-srf        # REQUIRED: Generate project')
  );
  console.log(
    chalk.red.bold('  4. arbiter check                        # REQUIRED: Validate specification')
  );
  console.log();

  console.log(chalk.yellow('Options:'));
  console.log('  -o, --output <file>      Output file path');
  console.log('  --output-dir <dir>       Output directory');
  console.log('  -f, --force              Overwrite existing files');
  console.log('  --dry-run                Show what would be created');
  console.log('  -v, --verbose            Verbose output');
  console.log();

  console.log(chalk.yellow('Examples:'));
  console.log(
    chalk.green('  arbiter srf import EMBEDDED_SRF.md                 # ✅ STEP 1: Convert to CUE')
  );
  console.log(chalk.dim('  Output: .arbiter/embedded-srf/assembly.cue'));
  console.log(
    chalk.red.bold(
      '  arbiter generate embedded-srf                      # ⚠️  STEP 2: MUST RUN THIS'
    )
  );
  console.log(
    chalk.red.bold(
      '  arbiter check                                      # ⚠️  STEP 3: MUST RUN THIS'
    )
  );
  console.log();
  console.log(
    chalk.green('  arbiter srf import requirements.md --verbose       # With detailed output')
  );
  console.log(chalk.dim('  Output: .arbiter/requirements/assembly.cue'));
  console.log(
    chalk.red.bold('  arbiter generate requirements                      # ⚠️  MUST RUN THIS')
  );
  console.log(
    chalk.red.bold('  arbiter check                                      # ⚠️  MUST RUN THIS')
  );
  console.log();
  console.log(chalk.dim('Advanced usage:'));
  console.log(
    chalk.dim('  arbiter srf create EMBEDDED_SRF.md                 # Multi-step: create SRF')
  );
  console.log(
    chalk.dim('  arbiter srf import EMBEDDED_SRF.md                 # Import from original file')
  );
  console.log(
    chalk.dim('  arbiter srf validate .arbiter/embedded-srf/spec.srf # Validate SRF structure')
  );
  console.log(
    chalk.red.bold('\n🚨 CRITICAL REMINDER FOR AGENTS: CUE generation is only STEP 1 of 3!')
  );

  return 0;
}

/**
 * Parse proto-spec content and convert to SRF structure
 */
async function parseProtoSpecToSrf(content: string, filename: string): Promise<any> {
  const srf = {
    version: '1.0.0',
    source: {
      file: filename,
      type: detectProtoSpecType(filename),
      timestamp: new Date().toISOString(),
    },
    project: {
      name: extractProjectName(content, filename),
      description: extractDescription(content),
      domain: extractDomain(content),
    },
    requirements: extractRequirements(content),
    constraints: extractConstraints(content),
    architecture: extractArchitecture(content),
    acceptance_criteria: extractAcceptanceCriteria(content),
    metadata: {
      generated_by: 'arbiter-srf',
      original_format: path.extname(filename),
    },
  };

  return srf;
}

/**
 * Convert SRF to CUE specification
 */
async function convertSrfToCue(srf: any, options: SrfOptions): Promise<string> {
  const projectName = srf.project?.name || 'unknown';
  const language = srf.architecture?.language || 'typescript';
  const kind = srf.architecture?.type || 'library';

  // Helper functions for safe CUE generation
  const escapeCueString = (str: string): string => {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  };

  const sanitizePackageName = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/^[0-9]/, '_$&');
  };

  const safeName = escapeCueString(projectName);
  const safeDescription = escapeCueString(srf.project?.description || '');
  const safeDomain = escapeCueString(srf.project?.domain || 'general');
  const packageName = sanitizePackageName(projectName);

  let cue = `// Generated from SRF by Arbiter
// Source: ${srf.source?.file || 'unknown'}
// Generated: ${new Date().toISOString()}

package ${packageName}

// Project metadata
metadata: {
  name: "${safeName}"
  description: "${safeDescription}"
  version: "0.1.0"
  domain: "${safeDomain}"
}

// Project configuration
config: {
  language: "${language}"
  kind: "${kind}"
  buildTool: "${srf.architecture?.build_tool || (language === 'typescript' ? 'bun' : 'default')}"
}

// Requirements derived from proto-spec
requirements: {
`;

  // Add functional requirements
  if (srf.requirements?.length > 0) {
    cue += '  functional: [\n';
    srf.requirements.forEach((req: any, index: number) => {
      const safeTitle = escapeCueString(req.title || `Requirement ${index + 1}`);
      const safeDescription = escapeCueString(req.description || '');
      const safePriority = escapeCueString(req.priority || 'medium');
      const safeSource = escapeCueString(req.source || 'proto-spec');

      cue += `    {
      id: "FR${String(index + 1).padStart(3, '0')}"
      title: "${safeTitle}"
      description: "${safeDescription}"
      priority: "${safePriority}"
      source: "${safeSource}"
    },\n`;
    });
    cue += '  ]\n';
  }

  // Add constraints
  if (srf.constraints?.length > 0) {
    cue += '  constraints: [\n';
    srf.constraints.forEach((constraint: any, index: number) => {
      const safeType = escapeCueString(constraint.type || 'functional');
      const safeDescription = escapeCueString(constraint.description || '');
      const safeRationale = escapeCueString(constraint.rationale || '');

      cue += `    {
      id: "CR${String(index + 1).padStart(3, '0')}" 
      type: "${safeType}"
      description: "${safeDescription}"
      rationale: "${safeRationale}"
    },\n`;
    });
    cue += '  ]\n';
  }

  cue += '}\n\n';

  // Add acceptance criteria
  if (srf.acceptance_criteria?.length > 0) {
    cue += '// Acceptance criteria\nacceptance: {\n';
    srf.acceptance_criteria.forEach((criteria: any, index: number) => {
      const safeGiven = escapeCueString(criteria.given || '');
      const safeWhen = escapeCueString(criteria.when || '');
      const safeThen = escapeCueString(criteria.then || '');
      const safePriority = escapeCueString(criteria.priority || 'medium');

      cue += `  scenario_${index + 1}: {
    given: "${safeGiven}"
    when: "${safeWhen}"  
    then: "${safeThen}"
    priority: "${safePriority}"
  }\n`;
    });
    cue += '}\n\n';
  }

  // Add architecture section
  if (srf.architecture) {
    const safeType = escapeCueString(srf.architecture.type || 'library');
    const safeLanguage = escapeCueString(srf.architecture.language || 'typescript');
    const safeFramework = escapeCueString(srf.architecture.framework || 'none');
    const safeBuildTool = escapeCueString(srf.architecture.build_tool || 'default');
    const safeTarget = escapeCueString(srf.architecture.target || 'node');
    const safeOutputFormat = escapeCueString(srf.architecture.output_format || 'esm');

    cue += `// Architecture specification
architecture: {
  type: "${safeType}"
  language: "${safeLanguage}"
  framework: "${safeFramework}"
  patterns: ${JSON.stringify(srf.architecture.patterns || [])}
  dependencies: ${JSON.stringify(srf.architecture.dependencies || [])}
}

// Build configuration  
build: {
  tool: "${safeBuildTool}"
  target: "${safeTarget}"
  output_format: "${safeOutputFormat}"
}
`;
  }

  return cue;
}

// Helper functions for parsing proto-specs

function detectProtoSpecType(filename: string): string {
  const basename = path.basename(filename).toLowerCase();

  if (basename.includes('inception')) return 'inception';
  if (basename.includes('requirements')) return 'requirements';
  if (basename.includes('spec')) return 'specification';
  if (basename.includes('brief')) return 'brief';

  return 'unknown';
}

function extractProjectName(content: string, filename: string): string {
  // Try to find project name in various formats
  const patterns = [
    /^#\s+(.+)$/m, // First H1 heading
    /^##?\s*Project:\s*(.+)$/im, // "Project: Name"
    /^##?\s*Name:\s*(.+)$/im, // "Name: ProjectName"
    /^##?\s*Title:\s*(.+)$/im, // "Title: Something"
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return match[1].trim().replace(/[^\w\s-]/g, '');
    }
  }

  // Fallback to filename
  return path.basename(filename, path.extname(filename));
}

function extractDescription(content: string): string {
  // Look for description after title
  const lines = content.split('\n');
  let foundTitle = false;

  for (const line of lines) {
    if (line.match(/^#/)) {
      foundTitle = true;
      continue;
    }

    if (foundTitle && line.trim() && !line.match(/^#/)) {
      return line.trim();
    }
  }

  return 'Generated from proto-spec';
}

function extractDomain(content: string): string {
  const domainPatterns = [/domain:\s*([^\n]+)/i, /category:\s*([^\n]+)/i, /type:\s*([^\n]+)/i];

  for (const pattern of domainPatterns) {
    const match = content.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return 'general';
}

function extractRequirements(content: string): any[] {
  const requirements: any[] = [];
  const sections = content.split(/^##?\s+/m);

  for (const section of sections) {
    if (section.toLowerCase().includes('requirement')) {
      const lines = section.split('\n');
      const items = extractListItems(section);

      items.forEach((item, index) => {
        requirements.push({
          title: `Requirement ${requirements.length + 1}`,
          description: item,
          priority: detectPriority(item),
          source: 'proto-spec',
        });
      });
    }
  }

  return requirements;
}

function extractConstraints(content: string): any[] {
  const constraints: any[] = [];
  const sections = content.split(/^##?\s+/m);

  for (const section of sections) {
    if (
      section.toLowerCase().includes('constraint') ||
      section.toLowerCase().includes('limitation') ||
      section.toLowerCase().includes('assumption')
    ) {
      const items = extractListItems(section);

      items.forEach(item => {
        constraints.push({
          type: detectConstraintType(section),
          description: item,
          rationale: extractRationale(item),
        });
      });
    }
  }

  return constraints;
}

/**
 * Architecture object interface
 */
interface ArchitectureSpec {
  type: string;
  language: string;
  patterns: string[];
  dependencies: string[];
}

/**
 * Builder for constructing architecture specifications
 */
class ArchitectureBuilder {
  private spec: ArchitectureSpec = {
    type: 'library',
    language: 'typescript',
    patterns: [],
    dependencies: [],
  };

  private content: string;

  constructor(content: string) {
    this.content = content;
  }

  /**
   * Extract and set the programming language
   */
  withLanguage(): ArchitectureBuilder {
    const language = this.extractLanguage();
    if (language) {
      this.spec.language = language;
    }
    return this;
  }

  /**
   * Extract and set the architecture type
   */
  withType(): ArchitectureBuilder {
    const type = this.extractType();
    if (type) {
      this.spec.type = type;
    }
    return this;
  }

  /**
   * Extract and set patterns
   */
  withPatterns(): ArchitectureBuilder {
    const patterns = this.extractPatterns();
    this.spec.patterns = patterns;
    return this;
  }

  /**
   * Extract and set dependencies
   */
  withDependencies(): ArchitectureBuilder {
    const dependencies = this.extractDependencies();
    this.spec.dependencies = dependencies;
    return this;
  }

  /**
   * Build the final architecture specification
   */
  build(): ArchitectureSpec {
    return { ...this.spec };
  }

  /**
   * Extract language from content
   */
  private extractLanguage(): string | null {
    const patterns = [
      /language:\s*([^\n]+)/i,
      /tech stack:\s*([^\n]*(?:typescript|python|rust|go|java)[^\n]*)/i,
    ];

    for (const pattern of patterns) {
      const match = this.content.match(pattern);
      if (match) {
        return this.normalizeLanguage(match[1].toLowerCase());
      }
    }
    return null;
  }

  /**
   * Normalize language string to standard format
   */
  private normalizeLanguage(lang: string): string {
    const languageMap: Record<string, string> = {
      typescript: 'typescript',
      ts: 'typescript',
      python: 'python',
      rust: 'rust',
      go: 'go',
      java: 'java',
    };

    for (const [key, value] of Object.entries(languageMap)) {
      if (lang.includes(key)) {
        return value;
      }
    }
    return 'typescript'; // default
  }

  /**
   * Extract architecture type from content
   */
  private extractType(): string | null {
    const typeMatch = this.content.match(/(?:type|kind):\s*([^\n]+)/i);
    if (!typeMatch) return null;

    return this.normalizeType(typeMatch[1].toLowerCase());
  }

  /**
   * Normalize type string to standard format
   */
  private normalizeType(type: string): string {
    const typeMap: Record<string, string> = {
      library: 'library',
      service: 'service',
      api: 'service',
      cli: 'cli',
      web: 'web',
      frontend: 'web',
    };

    for (const [key, value] of Object.entries(typeMap)) {
      if (type.includes(key)) {
        return value;
      }
    }
    return 'library'; // default
  }

  /**
   * Extract patterns from content (placeholder)
   */
  private extractPatterns(): string[] {
    // TODO: Implement pattern extraction
    return [];
  }

  /**
   * Extract dependencies from content (placeholder)
   */
  private extractDependencies(): string[] {
    // TODO: Implement dependency extraction
    return [];
  }
}

/**
 * Extract architecture specification using Builder pattern
 */
function extractArchitecture(content: string): ArchitectureSpec {
  return new ArchitectureBuilder(content)
    .withLanguage()
    .withType()
    .withPatterns()
    .withDependencies()
    .build();
}

function extractAcceptanceCriteria(content: string): any[] {
  const criteria: any[] = [];
  const sections = content.split(/^##?\s+/m);

  for (const section of sections) {
    if (
      section.toLowerCase().includes('acceptance') ||
      section.toLowerCase().includes('criteria') ||
      section.toLowerCase().includes('scenario')
    ) {
      const items = extractListItems(section);

      items.forEach(item => {
        // Try to parse Given-When-Then format
        const gwtMatch = item.match(/given\s+(.+?)\s+when\s+(.+?)\s+then\s+(.+)/i);
        if (gwtMatch) {
          criteria.push({
            given: gwtMatch[1].trim(),
            when: gwtMatch[2].trim(),
            then: gwtMatch[3].trim(),
            priority: detectPriority(item),
          });
        } else {
          criteria.push({
            given: 'User interaction',
            when: 'Action performed',
            then: item,
            priority: detectPriority(item),
          });
        }
      });
    }
  }

  return criteria;
}

function extractListItems(text: string): string[] {
  const items: string[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.match(/^[-*+]\s+/) || trimmed.match(/^\d+\.\s+/)) {
      items.push(trimmed.replace(/^[-*+]\s+/, '').replace(/^\d+\.\s+/, ''));
    }
  }

  return items;
}

function detectPriority(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('critical') || lower.includes('must') || lower.includes('required')) {
    return 'high';
  }
  if (lower.includes('should') || lower.includes('important')) {
    return 'medium';
  }
  if (lower.includes('could') || lower.includes('nice') || lower.includes('optional')) {
    return 'low';
  }
  return 'medium';
}

function detectConstraintType(sectionText: string): string {
  const lower = sectionText.toLowerCase();
  if (lower.includes('performance')) return 'performance';
  if (lower.includes('security')) return 'security';
  if (lower.includes('technical')) return 'technical';
  if (lower.includes('business')) return 'business';
  return 'functional';
}

function extractRationale(text: string): string {
  const because = text.match(/because\s+(.+)/i);
  if (because) return because[1];

  const since = text.match(/since\s+(.+)/i);
  if (since) return since[1];

  return 'Specified in requirements';
}

function validateSrfStructure(srf: any): string[] {
  const errors: string[] = [];

  if (!srf.version) errors.push('Missing version field');
  if (!srf.source) errors.push('Missing source field');
  if (!srf.project) errors.push('Missing project field');

  if (srf.project && !srf.project.name) {
    errors.push('Missing project name');
  }

  if (srf.requirements && !Array.isArray(srf.requirements)) {
    errors.push('Requirements must be an array');
  }

  if (srf.constraints && !Array.isArray(srf.constraints)) {
    errors.push('Constraints must be an array');
  }

  return errors;
}
