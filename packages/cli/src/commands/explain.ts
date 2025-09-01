#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
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
export async function explainCommand(options: ExplainOptions, config: Config): Promise<number> {
  try {
    console.log(chalk.blue('🔍 Analyzing arbiter.assembly.cue...'));

    // Check for assembly file
    const assemblyPath = path.resolve('arbiter.assembly.cue');
    
    try {
      await fs.access(assemblyPath);
      console.log(chalk.green('✅ Found arbiter.assembly.cue'));
    } catch {
      console.log(chalk.red('❌ No arbiter.assembly.cue found in current directory'));
      console.log(chalk.dim('To get started:'));
      console.log(chalk.dim('  1. Run: arbiter init --template <type>'));
      console.log(chalk.dim('  2. Or: arbiter generate --template <type>'));
      console.log(chalk.dim('  3. Then: arbiter explain'));
      return 1;
    }

    // Read and parse assembly file
    const assemblyContent = await fs.readFile(assemblyPath, 'utf-8');
    
    // Parse the assembly configuration
    const explanation = await parseAssemblyForExplanation(assemblyContent);
    
    // Generate explanation based on format
    const format = options.format || 'text';
    
    if (format === 'json') {
      return await generateJsonExplanation(explanation, options);
    } else {
      return await generateTextExplanation(explanation, options);
    }

  } catch (error) {
    console.error(chalk.red('Explanation generation failed:'), error instanceof Error ? error.message : String(error));
    return 2;
  }
}

/**
 * Parse assembly file and extract explanation information
 */
async function parseAssemblyForExplanation(content: string): Promise<AssemblyExplanation> {
  const lines = content.split('\n');
  
  const explanation: AssemblyExplanation = {
    summary: '',
    artifact: {
      type: 'unknown',
      language: 'unknown',
      description: '',
      metadata: {}
    },
    profile: {
      type: 'unknown',
      configuration: {},
      features: []
    },
    build: {
      tool: 'unknown',
      targets: [],
      matrix: {}
    },
    tests: {
      types: [],
      coverage: {},
      golden: [],
      property: []
    },
    contracts: {
      invariants: [],
      constraints: []
    },
    nextSteps: [],
    recommendations: [],
    potentialIssues: []
  };

  let currentSection = '';
  let braceDepth = 0;
  let inComment = false;

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip empty lines
    if (!trimmedLine) continue;
    
    // Handle comments at the top for description
    if (trimmedLine.startsWith('//') && explanation.artifact.description === '') {
      explanation.artifact.description += trimmedLine.replace(/^\/\/\s*/, '') + ' ';
      continue;
    }

    // Track brace depth for nested objects
    braceDepth += (line.match(/{/g) || []).length;
    braceDepth -= (line.match(/}/g) || []).length;

    // Extract artifact information
    if (trimmedLine.includes('Artifact:') && trimmedLine.includes('#Artifact')) {
      currentSection = 'artifact';
      continue;
    }

    // Extract profile information
    if (trimmedLine.includes('Profile:') && trimmedLine.includes('#')) {
      currentSection = 'profile';
      const profileMatch = trimmedLine.match(/#(\w+)/);
      if (profileMatch) {
        explanation.profile.type = profileMatch[1];
      }
      continue;
    }

    // Extract specific fields based on current section
    if (currentSection === 'artifact') {
      if (trimmedLine.includes('kind:')) {
        const kindMatch = trimmedLine.match(/kind:\s*"([^"]+)"/);
        if (kindMatch) {
          explanation.artifact.type = kindMatch[1];
        }
      }
      
      if (trimmedLine.includes('language:')) {
        const langMatch = trimmedLine.match(/language:\s*"([^"]+)"/);
        if (langMatch) {
          explanation.artifact.language = langMatch[1];
        }
      }

      if (trimmedLine.includes('name:')) {
        const nameMatch = trimmedLine.match(/name:\s*"([^"]+)"/);
        if (nameMatch) {
          explanation.artifact.metadata.name = nameMatch[1];
        }
      }

      if (trimmedLine.includes('version:')) {
        const versionMatch = trimmedLine.match(/version:\s*"([^"]+)"/);
        if (versionMatch) {
          explanation.artifact.metadata.version = versionMatch[1];
        }
      }
    }

    // Extract build information
    if (trimmedLine.includes('tool:')) {
      const toolMatch = trimmedLine.match(/tool:\s*"([^"]+)"/);
      if (toolMatch) {
        explanation.build.tool = toolMatch[1];
      }
    }

    if (trimmedLine.includes('targets:')) {
      const targetsMatch = trimmedLine.match(/targets:\s*\[([^\]]+)\]/);
      if (targetsMatch) {
        explanation.build.targets = targetsMatch[1]
          .split(',')
          .map(t => t.trim().replace(/"/g, ''));
      }
    }

    // Extract test information
    if (trimmedLine.includes('golden:') || trimmedLine.includes('property:')) {
      if (trimmedLine.includes('golden:')) {
        explanation.tests.types.push('golden');
      }
      if (trimmedLine.includes('property:')) {
        explanation.tests.types.push('property');
      }
    }

    // Extract contracts and invariants
    if (trimmedLine.includes('invariants:')) {
      explanation.tests.types.push('contracts');
    }

    if (trimmedLine.includes('name:') && trimmedLine.includes('formula:')) {
      // This is likely an invariant
      const nameMatch = trimmedLine.match(/name:\s*"([^"]+)"/);
      if (nameMatch) {
        explanation.contracts.invariants.push(nameMatch[1]);
      }
    }
  }

  // Generate summary based on extracted information
  explanation.summary = generateSummary(explanation);
  
  // Generate next steps and recommendations
  explanation.nextSteps = generateNextSteps(explanation);
  explanation.recommendations = generateRecommendations(explanation);
  explanation.potentialIssues = generatePotentialIssues(explanation);

  return explanation;
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
async function generateJsonExplanation(explanation: AssemblyExplanation, options: ExplainOptions): Promise<number> {
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
      potentialIssues: explanation.potentialIssues
    }
  };

  const jsonContent = JSON.stringify(output, null, 2);

  if (options.output) {
    await fs.writeFile(options.output, jsonContent, 'utf-8');
    console.log(chalk.green(`✅ JSON explanation saved to: ${options.output}`));
  } else {
    console.log('\n' + jsonContent);
  }

  return 0;
}

/**
 * Generate text explanation output
 */
async function generateTextExplanation(explanation: AssemblyExplanation, options: ExplainOptions): Promise<number> {
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
    console.log(`  • Use ${chalk.cyan('arbiter watch')} for continuous validation during development`);
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
 * Generate Markdown explanation for file output
 */
function generateMarkdownExplanation(explanation: AssemblyExplanation): string {
  let md = '';

  // Header
  md += `# Project Configuration Explanation\n\n`;
  md += `> Generated on ${new Date().toLocaleString()}\n\n`;

  // Summary
  md += `## Summary\n\n`;
  md += `${explanation.summary}\n\n`;

  // Artifact details
  md += `## Artifact Details\n\n`;
  md += `- **Type**: ${explanation.artifact.type}\n`;
  md += `- **Language**: ${explanation.artifact.language}\n`;
  if (explanation.artifact.metadata.name) {
    md += `- **Name**: ${explanation.artifact.metadata.name}\n`;
  }
  if (explanation.artifact.metadata.version) {
    md += `- **Version**: ${explanation.artifact.metadata.version}\n`;
  }
  if (explanation.artifact.description.trim()) {
    md += `- **Description**: ${explanation.artifact.description.trim()}\n`;
  }
  md += `\n`;

  // Profile configuration
  md += `## Profile Configuration\n\n`;
  md += `- **Profile Type**: ${explanation.profile.type}\n`;
  if (explanation.profile.features.length > 0) {
    md += `- **Features**: ${explanation.profile.features.join(', ')}\n`;
  }
  md += `\n`;

  // Build configuration
  md += `## Build Configuration\n\n`;
  md += `- **Build Tool**: ${explanation.build.tool}\n`;
  if (explanation.build.targets.length > 0) {
    md += `- **Targets**: ${explanation.build.targets.join(', ')}\n`;
  }
  md += `\n`;

  // Test configuration
  if (explanation.tests.types.length > 0) {
    md += `## Test Configuration\n\n`;
    md += `- **Test Types**: ${explanation.tests.types.join(', ')}\n`;
    md += `\n`;
  }

  // Contracts
  if (explanation.contracts.invariants.length > 0) {
    md += `## Contracts & Invariants\n\n`;
    for (const invariant of explanation.contracts.invariants) {
      md += `- ${invariant}\n`;
    }
    md += `\n`;
  }

  // Next steps
  if (explanation.nextSteps.length > 0) {
    md += `## Recommended Next Steps\n\n`;
    for (let i = 0; i < explanation.nextSteps.length; i++) {
      md += `${i + 1}. ${explanation.nextSteps[i]}\n`;
    }
    md += `\n`;
  }

  // Recommendations
  if (explanation.recommendations.length > 0) {
    md += `## Recommendations\n\n`;
    for (const recommendation of explanation.recommendations) {
      md += `- ${recommendation}\n`;
    }
    md += `\n`;
  }

  // Potential issues
  if (explanation.potentialIssues.length > 0) {
    md += `## Potential Issues\n\n`;
    for (const issue of explanation.potentialIssues) {
      md += `- ⚠️ ${issue}\n`;
    }
    md += `\n`;
  }

  return md;
}