#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import type { Config } from '../config.js';

/**
 * Options for explain command
 */
export interface ExplainOptions {
  format?: 'text' | 'json';
  output?: string;
  verbose?: boolean;
  hints?: boolean;
}

/**
 * Assembly explanation structure
 */
interface AssemblyExplanation {
  summary: string;
  artifact: {
    type: string;
    language: string;
    description: string;
    metadata: Record<string, any>;
  };
  profile: {
    type: string;
    configuration: Record<string, any>;
    features: string[];
  };
  build: {
    tool: string;
    targets: string[];
    matrix?: Record<string, any>;
  };
  tests: {
    types: string[];
    coverage?: Record<string, any>;
    golden?: any[];
    property?: any[];
  };
  contracts: {
    invariants: string[];
    constraints: string[];
  };
  nextSteps: string[];
  recommendations: string[];
  potentialIssues: string[];
}

/**
 * Generate plain-English summary of current assembly.cue
 */
export async function explainCommand(options: ExplainOptions, _config: Config): Promise<number> {
  try {
    console.log(chalk.blue('🔍 Analyzing specification...'));

    const assemblyPath = await resolveAssemblyPath();
    if (!assemblyPath) {
      console.log(chalk.red('❌ No assembly specification found'));
      console.log(chalk.dim('To get started:'));
      console.log(chalk.dim('  1. Run: arbiter init --template <type>'));
      console.log(chalk.dim('  2. Or: arbiter add service <name>'));
      console.log(chalk.dim('  3. Then: arbiter explain'));
      return 1;
    }

    console.log(chalk.green(`✅ Found ${path.relative(process.cwd(), assemblyPath)}`));

    // Read and parse assembly file
    const assemblyContent = await fs.readFile(assemblyPath, 'utf-8');

    // Parse the assembly configuration
    const explanation = await parseAssemblyForExplanation(assemblyContent);

    // Generate explanation based on format
    const format = options.format || 'text';

    if (format === 'json') {
      return await generateJsonExplanation(explanation, options);
    }
    return await generateTextExplanation(explanation, options);
  } catch (error) {
    console.error(
      chalk.red('Explanation generation failed:'),
      error instanceof Error ? error.message : String(error)
    );
    return 2;
  }
}

async function resolveAssemblyPath(): Promise<string | null> {
  const arbiterFile = path.resolve('.arbiter', 'assembly.cue');
  if (await fileExists(arbiterFile)) {
    return arbiterFile;
  }

  const arbiterDir = path.resolve('.arbiter');
  if (await directoryExists(arbiterDir)) {
    const entries = await fs.readdir(arbiterDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const candidate = path.join(arbiterDir, entry.name, 'assembly.cue');
      if (await fileExists(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

async function fileExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function directoryExists(target: string): Promise<boolean> {
  try {
    const stats = await fs.stat(target);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Parse assembly file and extract explanation information
 */
async function parseAssemblyForExplanation(content: string): Promise<AssemblyExplanation> {
  const lines = content.split('\n');
  const explanation = initializeEmptyExplanation();
  const context = createParsingContext();

  processContentLines(lines, explanation, context);
  enrichExplanationWithAnalysis(explanation);

  return explanation;
}

/**
 * Initialize an empty explanation structure
 */
function initializeEmptyExplanation(): AssemblyExplanation {
  return {
    summary: '',
    artifact: {
      type: 'unknown',
      language: 'unknown',
      description: '',
      metadata: {},
    },
    profile: {
      type: 'unknown',
      configuration: {},
      features: [],
    },
    build: {
      tool: 'unknown',
      targets: [],
      matrix: {},
    },
    tests: {
      types: [],
      coverage: {},
      golden: [],
      property: [],
    },
    contracts: {
      invariants: [],
      constraints: [],
    },
    nextSteps: [],
    recommendations: [],
    potentialIssues: [],
  };
}

/**
 * Create parsing context for state management
 */
function createParsingContext(): { currentSection: string; braceDepth: number } {
  return {
    currentSection: '',
    braceDepth: 0,
  };
}

/**
 * Process all content lines with state tracking
 */
function processContentLines(
  lines: string[],
  explanation: AssemblyExplanation,
  context: { currentSection: string; braceDepth: number }
): void {
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    processIndividualLine(trimmedLine, line, explanation, context);
  }
}

/**
 * Process a single line with all extraction logic
 */
function processIndividualLine(
  trimmedLine: string,
  fullLine: string,
  explanation: AssemblyExplanation,
  context: { currentSection: string; braceDepth: number }
): void {
  extractCommentDescription(trimmedLine, explanation);
  updateBraceDepth(fullLine, context);
  updateCurrentSection(trimmedLine, context, explanation);
  extractSectionSpecificFields(trimmedLine, explanation, context);
  extractGlobalBuildInfo(trimmedLine, explanation);
  extractTestInformation(trimmedLine, explanation);
  extractContractInformation(trimmedLine, explanation);
}

/**
 * Extract description from comments
 */
function extractCommentDescription(trimmedLine: string, explanation: AssemblyExplanation): void {
  if (trimmedLine.startsWith('//') && explanation.artifact.description === '') {
    explanation.artifact.description += `${trimmedLine.replace(/^\/\/\s*/, '')} `;
  }
}

/**
 * Update brace depth tracking
 */
function updateBraceDepth(
  line: string,
  context: { currentSection: string; braceDepth: number }
): void {
  context.braceDepth += (line.match(/{/g) || []).length;
  context.braceDepth -= (line.match(/}/g) || []).length;
}

/**
 * Update current parsing section
 */
function updateCurrentSection(
  trimmedLine: string,
  context: { currentSection: string; braceDepth: number },
  explanation: AssemblyExplanation
): void {
  if (trimmedLine.includes('Artifact:') && trimmedLine.includes('#Artifact')) {
    context.currentSection = 'artifact';
  } else if (trimmedLine.includes('Profile:') && trimmedLine.includes('#')) {
    context.currentSection = 'profile';
    const profileMatch = trimmedLine.match(/#(\w+)/);
    if (profileMatch) {
      explanation.profile.type = profileMatch[1];
    }
  }
}

/**
 * Extract fields specific to current section
 */
function extractSectionSpecificFields(
  trimmedLine: string,
  explanation: AssemblyExplanation,
  context: { currentSection: string; braceDepth: number }
): void {
  if (context.currentSection === 'artifact') {
    extractArtifactFields(trimmedLine, explanation);
  }
}

/**
 * Extract artifact-specific fields
 */
function extractArtifactFields(trimmedLine: string, explanation: AssemblyExplanation): void {
  const fieldExtractors = [
    {
      pattern: /kind:\s*"([^"]+)"/,
      target: (match: string) => {
        explanation.artifact.type = match;
      },
    },
    {
      pattern: /language:\s*"([^"]+)"/,
      target: (match: string) => {
        explanation.artifact.language = match;
      },
    },
    {
      pattern: /name:\s*"([^"]+)"/,
      target: (match: string) => {
        explanation.artifact.metadata.name = match;
      },
    },
    {
      pattern: /version:\s*"([^"]+)"/,
      target: (match: string) => {
        explanation.artifact.metadata.version = match;
      },
    },
  ];

  for (const extractor of fieldExtractors) {
    if (trimmedLine.includes(extractor.pattern.source.split('\\s')[0])) {
      const match = trimmedLine.match(extractor.pattern);
      if (match) {
        extractor.target(match[1]);
      }
    }
  }
}

/**
 * Extract global build information
 */
function extractGlobalBuildInfo(trimmedLine: string, explanation: AssemblyExplanation): void {
  if (trimmedLine.includes('tool:')) {
    const toolMatch = trimmedLine.match(/tool:\s*"([^"]+)"/);
    if (toolMatch) {
      explanation.build.tool = toolMatch[1];
    }
  }

  if (trimmedLine.includes('targets:')) {
    const targetsMatch = trimmedLine.match(/targets:\s*\[([^\]]+)\]/);
    if (targetsMatch) {
      explanation.build.targets = targetsMatch[1].split(',').map(t => t.trim().replace(/"/g, ''));
    }
  }
}

/**
 * Extract test information
 */
function extractTestInformation(trimmedLine: string, explanation: AssemblyExplanation): void {
  if (trimmedLine.includes('golden:') || trimmedLine.includes('property:')) {
    if (trimmedLine.includes('golden:')) {
      explanation.tests.types.push('golden');
    }
    if (trimmedLine.includes('property:')) {
      explanation.tests.types.push('property');
    }
  }
}

/**
 * Extract contract and invariant information
 */
function extractContractInformation(trimmedLine: string, explanation: AssemblyExplanation): void {
  if (trimmedLine.includes('invariants:')) {
    explanation.tests.types.push('contracts');
  }

  if (trimmedLine.includes('name:') && trimmedLine.includes('formula:')) {
    const nameMatch = trimmedLine.match(/name:\s*"([^"]+)"/);
    if (nameMatch) {
      explanation.contracts.invariants.push(nameMatch[1]);
    }
  }
}

/**
 * Enrich explanation with generated analysis
 */
function enrichExplanationWithAnalysis(explanation: AssemblyExplanation): void {
  explanation.summary = generateSummary(explanation);
  explanation.nextSteps = generateNextSteps(explanation);
  explanation.recommendations = generateRecommendations(explanation);
  explanation.potentialIssues = generatePotentialIssues(explanation);
}

/**
 * Generate a human-readable summary
 */
function generateSummary(explanation: AssemblyExplanation): string {
  const { artifact, profile, build } = explanation;

  let summary = `This project is configured as a ${artifact.type}`;

  if (artifact.language !== 'unknown') {
    summary += ` written in ${artifact.language}`;
  }

  if (artifact.metadata.name) {
    summary += ` called "${artifact.metadata.name}"`;
  }

  if (profile.type !== 'unknown') {
    summary += `, using the ${profile.type} profile`;
  }

  if (build.tool !== 'unknown') {
    summary += `, built with ${build.tool}`;
  }

  if (build.targets.length > 0) {
    summary += `, targeting ${build.targets.join(', ')}`;
  }

  summary += '.';

  return summary;
}

/**
 * Generate next steps based on configuration
 */
function generateNextSteps(explanation: AssemblyExplanation): string[] {
  const steps: string[] = [];
  const { artifact, tests, contracts } = explanation;

  // Basic workflow steps
  steps.push('Run "arbiter check" to validate your configuration');

  if (artifact.language !== 'unknown') {
    steps.push(`Generate API surface with "arbiter surface ${artifact.language}"`);
  }

  // Test-specific steps
  if (tests.types.length === 0) {
    steps.push('Add test configurations to enable "arbiter tests scaffold"');
  } else {
    steps.push('Generate test scaffolding with "arbiter tests scaffold"');
    steps.push('Check test coverage with "arbiter tests cover"');
  }

  // Version management
  if (artifact.type === 'library') {
    steps.push('Set up version planning with "arbiter version plan"');
  }

  // Development workflow
  steps.push('Use "arbiter watch" for continuous validation during development');

  // Integration steps
  steps.push('Generate IDE configuration with "arbiter ide recommend"');
  steps.push('Set up CI/CD with "arbiter integrate"');

  return steps;
}

/**
 * Generate recommendations based on configuration
 */
function generateRecommendations(explanation: AssemblyExplanation): string[] {
  const recommendations: string[] = [];
  const { artifact, profile, tests, contracts } = explanation;

  // Profile-specific recommendations
  if (artifact.type === 'library' && profile.type !== 'library') {
    recommendations.push('Consider using profiles.#library for library-specific features');
  }

  if (artifact.type === 'cli' && profile.type !== 'cli') {
    recommendations.push('Consider using profiles.#cli for CLI-specific testing');
  }

  // Test recommendations
  if (tests.types.length === 0) {
    recommendations.push('Add test configurations for automated quality gates');
  }

  if (!tests.types.includes('golden')) {
    recommendations.push('Add golden tests for stable output verification');
  }

  if (!tests.types.includes('property')) {
    recommendations.push('Add property tests for comprehensive validation');
  }

  // Contract recommendations
  if (contracts.invariants.length === 0) {
    recommendations.push('Define invariants to enable contract-based testing');
  }

  // Build recommendations
  if (explanation.build.matrix && Object.keys(explanation.build.matrix).length === 0) {
    recommendations.push('Configure build matrix for multi-platform testing');
  }

  // Language-specific recommendations
  if (artifact.language === 'typescript') {
    recommendations.push('Use strict TypeScript configuration for better type safety');
    recommendations.push('Enable API surface tracking for semver compliance');
  }

  if (artifact.language === 'python') {
    recommendations.push('Use async patterns for better performance');
    recommendations.push('Add type hints for better tooling support');
  }

  if (artifact.language === 'rust') {
    recommendations.push('Leverage zero-cost abstractions for performance');
    recommendations.push('Use compile-time checks for safety guarantees');
  }

  return recommendations;
}

/**
 * Generate potential issues based on configuration
 */
function generatePotentialIssues(explanation: AssemblyExplanation): string[] {
  const issues: string[] = [];
  const { artifact, build, tests } = explanation;

  // Missing information issues
  if (artifact.type === 'unknown') {
    issues.push('Artifact kind not clearly specified');
  }

  if (artifact.language === 'unknown') {
    issues.push('Programming language not specified');
  }

  if (build.tool === 'unknown') {
    issues.push('Build tool not configured');
  }

  if (build.targets.length === 0) {
    issues.push('No build targets specified');
  }

  // Testing issues
  if (tests.types.length === 0) {
    issues.push('No test strategy configured - consider adding test specifications');
  }

  // Version management issues
  if (artifact.type === 'library' && !artifact.metadata.version) {
    issues.push('Library version not specified - semver tracking may not work correctly');
  }

  // Profile mismatch issues
  if (artifact.type === 'cli' && explanation.profile.type === 'library') {
    issues.push('Profile mismatch: CLI artifact using library profile');
  }

  if (artifact.type === 'library' && explanation.profile.type === 'cli') {
    issues.push('Profile mismatch: Library artifact using CLI profile');
  }

  return issues;
}

/**
 * Generate JSON explanation output
 */
async function generateJsonExplanation(
  explanation: AssemblyExplanation,
  options: ExplainOptions
): Promise<number> {
  console.log(chalk.blue('📄 Generating JSON explanation...'));

  const output = {
    timestamp: new Date().toISOString(),
    summary: explanation.summary,
    artifact: explanation.artifact,
    profile: explanation.profile,
    build: explanation.build,
    tests: explanation.tests,
    contracts: explanation.contracts,
    analysis: {
      nextSteps: explanation.nextSteps,
      recommendations: explanation.recommendations,
      potentialIssues: explanation.potentialIssues,
    },
  };

  const jsonContent = JSON.stringify(output, null, 2);

  if (options.output) {
    await fs.writeFile(options.output, jsonContent, 'utf-8');
    console.log(chalk.green(`✅ JSON explanation saved to: ${options.output}`));
  } else {
    console.log(`\n${jsonContent}`);
  }

  return 0;
}

/**
 * Generate text explanation output
 */
async function generateTextExplanation(
  explanation: AssemblyExplanation,
  options: ExplainOptions
): Promise<number> {
  console.log(chalk.blue('📝 Generating plain-English explanation...\n'));

  // Header
  console.log(chalk.bold.cyan('🏗️  Project Configuration Summary'));
  console.log(chalk.dim('─'.repeat(50)));

  // Main summary
  console.log(chalk.white(explanation.summary));
  console.log();

  // Detailed breakdown
  console.log(chalk.bold.yellow('📦 Artifact Details:'));
  console.log(`  Type: ${chalk.cyan(explanation.artifact.type)}`);
  console.log(`  Language: ${chalk.cyan(explanation.artifact.language)}`);
  if (explanation.artifact.metadata.name) {
    console.log(`  Name: ${chalk.cyan(explanation.artifact.metadata.name)}`);
  }
  if (explanation.artifact.metadata.version) {
    console.log(`  Version: ${chalk.cyan(explanation.artifact.metadata.version)}`);
  }
  if (explanation.artifact.description.trim()) {
    console.log(`  Description: ${chalk.gray(explanation.artifact.description.trim())}`);
  }
  console.log();

  // Profile information
  console.log(chalk.bold.yellow('⚙️  Profile Configuration:'));
  console.log(`  Profile Type: ${chalk.cyan(explanation.profile.type)}`);
  if (explanation.profile.features.length > 0) {
    console.log(`  Features: ${explanation.profile.features.map(f => chalk.cyan(f)).join(', ')}`);
  }
  console.log();

  // Build configuration
  console.log(chalk.bold.yellow('🔨 Build Configuration:'));
  console.log(`  Build Tool: ${chalk.cyan(explanation.build.tool)}`);
  if (explanation.build.targets.length > 0) {
    console.log(`  Targets: ${explanation.build.targets.map(t => chalk.cyan(t)).join(', ')}`);
  }
  if (explanation.build.matrix && Object.keys(explanation.build.matrix).length > 0) {
    console.log(`  Build Matrix: ${chalk.gray('Configured')}`);
  }
  console.log();

  // Test configuration
  if (explanation.tests.types.length > 0) {
    console.log(chalk.bold.yellow('🧪 Test Configuration:'));
    console.log(`  Test Types: ${explanation.tests.types.map(t => chalk.cyan(t)).join(', ')}`);
    console.log();
  }

  // Contracts and invariants
  if (explanation.contracts.invariants.length > 0) {
    console.log(chalk.bold.yellow('📋 Contracts & Invariants:'));
    for (const invariant of explanation.contracts.invariants) {
      console.log(`  • ${chalk.cyan(invariant)}`);
    }
    console.log();
  }

  // Next steps
  if (explanation.nextSteps.length > 0) {
    console.log(chalk.bold.green('🎯 Recommended Next Steps:'));
    for (let i = 0; i < explanation.nextSteps.length; i++) {
      console.log(`  ${i + 1}. ${explanation.nextSteps[i]}`);
    }
    console.log();
  }

  // Recommendations
  if (explanation.recommendations.length > 0) {
    console.log(chalk.bold.blue('💡 Recommendations:'));
    for (const recommendation of explanation.recommendations) {
      console.log(`  • ${recommendation}`);
    }
    console.log();
  }

  // Potential issues
  if (explanation.potentialIssues.length > 0) {
    console.log(chalk.bold.yellow('⚠️  Potential Issues:'));
    for (const issue of explanation.potentialIssues) {
      console.log(`  • ${chalk.yellow(issue)}`);
    }
    console.log();
  }

  // Helpful hints if requested
  if (options.hints !== false) {
    console.log(chalk.bold.magenta('🔮 Helpful Hints:'));
    console.log(
      `  • Use ${chalk.cyan('arbiter watch')} for continuous validation during development`
    );
    console.log(`  • Run ${chalk.cyan('arbiter docs schema')} to generate documentation`);
    console.log(`  • Try ${chalk.cyan('arbiter examples')} to see working project templates`);
    console.log(`  • Get detailed help with ${chalk.cyan('arbiter <command> --help')}`);
    console.log();
  }

  // Save to file if requested
  if (options.output) {
    const textContent = generateMarkdownExplanation(explanation);
    await fs.writeFile(options.output, textContent, 'utf-8');
    console.log(chalk.green(`✅ Explanation saved to: ${options.output}`));
  }

  return 0;
}

/**
 * Markdown explanation generator using Template Method pattern
 */
class MarkdownExplanationGenerator {
  private explanation: AssemblyExplanation;

  constructor(explanation: AssemblyExplanation) {
    this.explanation = explanation;
  }

  /**
   * Template method - defines the algorithm structure
   */
  generateExplanation(): string {
    const sections = this.collectSections();
    return this.combineSections(sections);
  }

  /**
   * Collect all sections in order
   */
  private collectSections(): string[] {
    return [
      this.generateHeader(),
      this.generateSummarySection(),
      this.generateArtifactSection(),
      this.generateProfileSection(),
      this.generateBuildSection(),
      this.generateTestSection(),
      this.generateContractsSection(),
      this.generateNextStepsSection(),
      this.generateRecommendationsSection(),
      this.generateIssuesSection(),
    ];
  }

  /**
   * Combine sections with filtering
   */
  private combineSections(sections: string[]): string {
    return sections.filter(section => section.trim()).join('');
  }

  // Section generation methods - each with single responsibility
  private generateHeader(): string {
    return generateMarkdownHeader();
  }

  private generateSummarySection(): string {
    return generateMarkdownSummary(this.explanation.summary);
  }

  private generateArtifactSection(): string {
    return generateMarkdownArtifactDetails(this.explanation.artifact);
  }

  private generateProfileSection(): string {
    return generateMarkdownProfileConfiguration(this.explanation.profile);
  }

  private generateBuildSection(): string {
    return generateMarkdownBuildConfiguration(this.explanation.build);
  }

  private generateTestSection(): string {
    return generateMarkdownTestConfiguration(this.explanation.tests);
  }

  private generateContractsSection(): string {
    return generateMarkdownContracts(this.explanation.contracts);
  }

  private generateNextStepsSection(): string {
    return generateMarkdownNextSteps(this.explanation.nextSteps);
  }

  private generateRecommendationsSection(): string {
    return generateMarkdownRecommendations(this.explanation.recommendations);
  }

  private generateIssuesSection(): string {
    return generateMarkdownPotentialIssues(this.explanation.potentialIssues);
  }
}

/**
 * Generate Markdown explanation for file output
 */
function generateMarkdownExplanation(explanation: AssemblyExplanation): string {
  const generator = new MarkdownExplanationGenerator(explanation);
  return generator.generateExplanation();
}

/**
 * Generate markdown header section
 */
function generateMarkdownHeader(): string {
  return `# Project Configuration Explanation\n\n> Generated on ${new Date().toLocaleString()}\n\n`;
}

/**
 * Generate markdown summary section
 */
function generateMarkdownSummary(summary: string): string {
  return `## Summary\n\n${summary}\n\n`;
}

/**
 * Generate markdown artifact details section
 */
function generateMarkdownArtifactDetails(artifact: AssemblyExplanation['artifact']): string {
  const lines = [
    '## Artifact Details\n',
    `- **Type**: ${artifact.type}`,
    `- **Language**: ${artifact.language}`,
  ];

  if (artifact.metadata.name) {
    lines.push(`- **Name**: ${artifact.metadata.name}`);
  }
  if (artifact.metadata.version) {
    lines.push(`- **Version**: ${artifact.metadata.version}`);
  }
  if (artifact.description.trim()) {
    lines.push(`- **Description**: ${artifact.description.trim()}`);
  }

  return `${lines.join('\n')}\n\n`;
}

/**
 * Generate markdown profile configuration section
 */
function generateMarkdownProfileConfiguration(profile: AssemblyExplanation['profile']): string {
  const lines = ['## Profile Configuration\n', `- **Profile Type**: ${profile.type}`];

  if (profile.features.length > 0) {
    lines.push(`- **Features**: ${profile.features.join(', ')}`);
  }

  return `${lines.join('\n')}\n\n`;
}

/**
 * Generate markdown build configuration section
 */
function generateMarkdownBuildConfiguration(build: AssemblyExplanation['build']): string {
  const lines = ['## Build Configuration\n', `- **Build Tool**: ${build.tool}`];

  if (build.targets.length > 0) {
    lines.push(`- **Targets**: ${build.targets.join(', ')}`);
  }

  return `${lines.join('\n')}\n\n`;
}

/**
 * Generate markdown test configuration section
 */
function generateMarkdownTestConfiguration(tests: AssemblyExplanation['tests']): string {
  if (tests.types.length === 0) {
    return '';
  }

  return `## Test Configuration\n\n- **Test Types**: ${tests.types.join(', ')}\n\n`;
}

/**
 * Generate markdown contracts section
 */
function generateMarkdownContracts(contracts: AssemblyExplanation['contracts']): string {
  if (contracts.invariants.length === 0) {
    return '';
  }

  const lines = ['## Contracts & Invariants\n'];
  for (const invariant of contracts.invariants) {
    lines.push(`- ${invariant}`);
  }

  return `${lines.join('\n')}\n\n`;
}

/**
 * Generate markdown next steps section
 */
function generateMarkdownNextSteps(nextSteps: string[]): string {
  if (nextSteps.length === 0) {
    return '';
  }

  const lines = ['## Recommended Next Steps\n'];
  for (let i = 0; i < nextSteps.length; i++) {
    lines.push(`${i + 1}. ${nextSteps[i]}`);
  }

  return `${lines.join('\n')}\n\n`;
}

/**
 * Generate markdown recommendations section
 */
function generateMarkdownRecommendations(recommendations: string[]): string {
  if (recommendations.length === 0) {
    return '';
  }

  const lines = ['## Recommendations\n'];
  for (const recommendation of recommendations) {
    lines.push(`- ${recommendation}`);
  }

  return `${lines.join('\n')}\n\n`;
}

/**
 * Generate markdown potential issues section
 */
function generateMarkdownPotentialIssues(potentialIssues: string[]): string {
  if (potentialIssues.length === 0) {
    return '';
  }

  const lines = ['## Potential Issues\n'];
  for (const issue of potentialIssues) {
    lines.push(`- ⚠️ ${issue}`);
  }

  return `${lines.join('\n')}\n\n`;
}
