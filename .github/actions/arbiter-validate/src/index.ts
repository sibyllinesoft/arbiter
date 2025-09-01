import * as core from '@actions/core';
import * as github from '@actions/github';
import * as fs from 'fs-extra';
import * as path from 'path';
import { ArbiterClient, ArbiterError, NetworkError, ValidationError } from '@arbiter/sdk';

/**
 * Action inputs
 */
interface ActionInputs {
  schemaPath: string;
  configPath: string;
  arbiterUrl: string;
  failOn: 'error' | 'warning' | 'info';
  timeout: number;
  apiKey?: string;
  workingDirectory: string;
  outputFormat: 'table' | 'json' | 'github-actions';
  exportFormats: string[];
}

/**
 * Validation result for action
 */
interface ActionResult {
  valid: boolean;
  violationsSummary: {
    errors: number;
    warnings: number;
    info: number;
  };
  exportArtifacts: string[];
}

/**
 * Get action inputs from GitHub Actions environment
 */
function getInputs(): ActionInputs {
  return {
    schemaPath: core.getInput('schema-path') || 'schema.cue',
    configPath: core.getInput('config-path') || 'config.cue',
    arbiterUrl: core.getInput('arbiter-url') || 'http://localhost:3000',
    failOn: (core.getInput('fail-on') || 'error') as 'error' | 'warning' | 'info',
    timeout: parseInt(core.getInput('timeout') || '30', 10) * 1000,
    apiKey: core.getInput('api-key') || undefined,
    workingDirectory: core.getInput('working-directory') || '.',
    outputFormat: (core.getInput('output-format') || 'github-actions') as 'table' | 'json' | 'github-actions',
    exportFormats: (core.getInput('export-formats') || '')
      .split(',')
      .map(f => f.trim())
      .filter(f => f.length > 0),
  };
}

/**
 * Read file content safely
 */
async function readFileContent(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to read file '${filePath}': ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Create GitHub annotations from validation errors
 */
function createAnnotations(errors: any[], basePath: string): void {
  for (const error of errors) {
    const level = error.severity === 'error' ? 'error' : 
                  error.severity === 'warning' ? 'warning' : 'notice';
    
    let file = 'schema.cue'; // Default file
    if (error.filename && !error.filename.startsWith('/')) {
      file = path.relative(basePath, error.filename);
    }

    const properties: Record<string, any> = {
      title: `Architecture Validation ${level.toUpperCase()}`,
    };

    if (error.line !== undefined) {
      properties.startLine = error.line;
      if (error.column !== undefined) {
        properties.startColumn = error.column;
      }
    }

    // Create the annotation
    if (level === 'error') {
      core.error(error.friendlyMessage || error.message, {
        file,
        ...properties,
      });
    } else if (level === 'warning') {
      core.warning(error.friendlyMessage || error.message, {
        file,
        ...properties,
      });
    } else {
      core.notice(error.friendlyMessage || error.message, {
        file,
        ...properties,
      });
    }
  }
}

/**
 * Create PR comment with validation results
 */
async function createPRComment(
  result: any,
  explanations: any[],
  exportArtifacts: string[]
): Promise<void> {
  const context = github.context;
  if (!context.payload.pull_request) {
    core.debug('Not a pull request, skipping comment creation');
    return;
  }

  const token = core.getInput('GITHUB_TOKEN') || process.env.GITHUB_TOKEN;
  if (!token) {
    core.warning('GITHUB_TOKEN not provided, cannot create PR comments');
    return;
  }

  const octokit = github.getOctokit(token);
  const { owner, repo } = context.repo;
  const pull_number = context.payload.pull_request.number;

  // Build comment content
  let comment = '## 🏗️ Arbiter Architecture Validation\n\n';

  if (result.valid) {
    comment += '✅ **Validation Passed** - Architecture is compliant!\n\n';
  } else {
    comment += '❌ **Validation Failed** - Architecture violations detected\n\n';
    
    // Summary
    const { violations } = result;
    comment += '### Summary\n';
    comment += `- **Errors**: ${violations.errors}\n`;
    comment += `- **Warnings**: ${violations.warnings}\n`;
    comment += `- **Info**: ${violations.info}\n\n`;

    // Detailed explanations
    if (explanations.length > 0) {
      comment += '### Issues Found\n\n';
      explanations.slice(0, 10).forEach((explanation, index) => {
        const error = explanation.error;
        const severity = error.severity || 'error';
        const icon = severity === 'error' ? '❌' : severity === 'warning' ? '⚠️' : 'ℹ️';
        
        comment += `${icon} **${severity.toUpperCase()}** `;
        if (error.line) {
          comment += `(Line ${error.line}`;
          if (error.column) comment += `, Col ${error.column}`;
          comment += ') ';
        }
        comment += `\n`;
        comment += `${explanation.explanation}\n`;
        
        if (explanation.suggestions.length > 0) {
          comment += '\n**Suggestions:**\n';
          explanation.suggestions.forEach((suggestion: string) => {
            comment += `- ${suggestion}\n`;
          });
        }
        comment += '\n---\n';
      });

      if (explanations.length > 10) {
        comment += `\n*... and ${explanations.length - 10} more issues*\n`;
      }
    }
  }

  // Export artifacts
  if (exportArtifacts.length > 0) {
    comment += '\n### 📤 Generated Exports\n\n';
    exportArtifacts.forEach(artifact => {
      const basename = path.basename(artifact);
      comment += `- \`${basename}\`\n`;
    });
  }

  comment += '\n---\n';
  comment += '*🤖 Generated by [Arbiter](https://github.com/nathanrice/arbiter) - Architecture Validation Platform*';

  try {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: pull_number,
      body: comment,
    });
    core.info('Created PR comment with validation results');
  } catch (error) {
    core.warning(`Failed to create PR comment: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Generate export artifacts
 */
async function generateExports(
  client: ArbiterClient,
  configContent: string,
  formats: string[],
  workingDirectory: string
): Promise<string[]> {
  const artifacts: string[] = [];

  for (const format of formats) {
    try {
      core.info(`Generating ${format} export...`);
      
      const result = await client.export(configContent, {
        format: format as any,
        includeExamples: true,
        strict: false,
      });

      if (result.success) {
        const filename = `arbiter-export-${format}.${getExtensionForFormat(format)}`;
        const filepath = path.join(workingDirectory, filename);
        
        const output = typeof result.output === 'string' 
          ? result.output 
          : JSON.stringify(result.output, null, 2);
        
        await fs.writeFile(filepath, output, 'utf-8');
        artifacts.push(filepath);
        
        core.info(`✅ Generated ${format} export: ${filename}`);
      } else {
        core.warning(`❌ Failed to generate ${format} export`);
      }
    } catch (error) {
      core.warning(`Failed to generate ${format} export: ${error instanceof Error ? error.message : error}`);
    }
  }

  return artifacts;
}

/**
 * Get file extension for export format
 */
function getExtensionForFormat(format: string): string {
  switch (format.toLowerCase()) {
    case 'openapi':
      return 'yaml';
    case 'typescript':
      return 'ts';
    case 'kubernetes':
      return 'yaml';
    case 'terraform':
      return 'tf';
    case 'json-schema':
      return 'json';
    default:
      return 'txt';
  }
}

/**
 * Determine if validation should fail based on violations
 */
function shouldFail(violations: { errors: number; warnings: number; info: number }, failOn: string): boolean {
  switch (failOn) {
    case 'error':
      return violations.errors > 0;
    case 'warning':
      return violations.errors > 0 || violations.warnings > 0;
    case 'info':
      return violations.errors > 0 || violations.warnings > 0 || violations.info > 0;
    default:
      return violations.errors > 0;
  }
}

/**
 * Main action function
 */
async function run(): Promise<void> {
  try {
    const inputs = getInputs();
    
    core.info('🏗️ Starting Arbiter architecture validation...');
    core.info(`Schema: ${inputs.schemaPath}`);
    core.info(`Config: ${inputs.configPath}`);
    core.info(`Arbiter URL: ${inputs.arbiterUrl}`);
    core.info(`Fail on: ${inputs.failOn}`);

    // Change to working directory
    process.chdir(inputs.workingDirectory);

    // Check if files exist
    if (!await fs.pathExists(inputs.schemaPath)) {
      throw new Error(`Schema file not found: ${inputs.schemaPath}`);
    }
    if (!await fs.pathExists(inputs.configPath)) {
      throw new Error(`Configuration file not found: ${inputs.configPath}`);
    }

    // Read schema and config files
    const schemaContent = await readFileContent(inputs.schemaPath);
    const configContent = await readFileContent(inputs.configPath);

    core.info(`📖 Read schema (${schemaContent.length} chars) and config (${configContent.length} chars)`);

    // Create Arbiter client
    const client = new ArbiterClient({
      baseUrl: inputs.arbiterUrl,
      timeout: inputs.timeout,
      apiKey: inputs.apiKey,
      clientId: `github-action-${github.context.runId}`,
      debug: core.isDebug(),
    });

    // Check server compatibility
    try {
      core.info('🔍 Checking server compatibility...');
      const compatibility = await client.checkCompatibility();
      core.info(`Server: ${compatibility.serverVersion}, Protocol: ${compatibility.protocolVersion}`);
      
      if (!compatibility.compatible) {
        core.warning('⚠️ Server compatibility issues detected:');
        compatibility.messages?.forEach(msg => core.warning(`  ${msg}`));
      }
    } catch (error) {
      core.warning(`Failed to check compatibility: ${error instanceof Error ? error.message : error}`);
    }

    // Validate architecture
    core.info('✅ Running architecture validation...');
    const result = await client.validateArchitecture({
      schema: schemaContent,
      config: configContent,
      requestId: `github-action-${github.context.runId}-${Date.now()}`,
    });

    core.info(`Validation result: ${result.valid ? 'VALID' : 'INVALID'}`);
    core.info(`Violations: ${result.violations.errors} errors, ${result.violations.warnings} warnings, ${result.violations.info} info`);

    // Get explanations for errors
    let explanations: any[] = [];
    if (result.errors.length > 0) {
      core.info('📝 Generating error explanations...');
      explanations = await client.explain(result.errors);
      core.info(`Generated explanations for ${explanations.length} errors`);
    }

    // Create GitHub annotations
    if (inputs.outputFormat === 'github-actions') {
      core.info('📝 Creating GitHub annotations...');
      createAnnotations(result.errors, process.cwd());
    }

    // Generate exports if requested
    let exportArtifacts: string[] = [];
    if (inputs.exportFormats.length > 0 && result.valid) {
      core.info(`📤 Generating exports: ${inputs.exportFormats.join(', ')}`);
      exportArtifacts = await generateExports(
        client,
        configContent,
        inputs.exportFormats,
        process.cwd()
      );
      core.info(`Generated ${exportArtifacts.length} export artifacts`);
    }

    // Create PR comment if this is a pull request
    await createPRComment(result, explanations, exportArtifacts);

    // Set outputs
    const actionResult: ActionResult = {
      valid: result.valid,
      violationsSummary: result.violations,
      exportArtifacts,
    };

    core.setOutput('valid', result.valid.toString());
    core.setOutput('violations-summary', JSON.stringify(result.violations));
    core.setOutput('export-artifacts', exportArtifacts.join(','));

    // Determine if action should fail
    const shouldFailValidation = shouldFail(result.violations, inputs.failOn);
    
    if (shouldFailValidation) {
      const failureMessage = `Architecture validation failed: ${result.violations.errors} errors, ${result.violations.warnings} warnings, ${result.violations.info} info (failing on: ${inputs.failOn})`;
      core.setFailed(failureMessage);
    } else {
      core.info('✅ Architecture validation passed!');
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (error instanceof ArbiterError) {
      core.setFailed(`Arbiter error: ${errorMessage}`);
    } else if (error instanceof NetworkError) {
      core.setFailed(`Network error: ${errorMessage}. Check if Arbiter server is running at the specified URL.`);
    } else if (error instanceof ValidationError) {
      core.setFailed(`Validation error: ${errorMessage}`);
    } else {
      core.setFailed(`Unexpected error: ${errorMessage}`);
    }

    // Log full error details in debug mode
    if (core.isDebug() && error instanceof Error) {
      core.debug(`Error stack: ${error.stack}`);
    }
  }
}

// Execute the action
run();