import { writeFile } from 'fs/promises';
import { createWriteStream } from 'fs';
import chalk from 'chalk';

/**
 * Standardized output system for Arbiter CLI
 * Implements section 11 requirements: standardized files and NDJSON streaming
 */

export const API_VERSION = 'arbiter.dev/v2' as const;

/**
 * Standard output file formats with apiVersion stamping
 */
export interface StandardizedOutput {
  apiVersion: typeof API_VERSION;
  timestamp: number;
  command: string;
  version?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Plan output format for deterministic planning
 */
export interface PlanOutput extends StandardizedOutput {
  kind: 'Plan';
  plan: Array<{
    id: string;
    type: 'file' | 'directory' | 'command' | 'validation';
    action: 'create' | 'update' | 'delete' | 'execute' | 'validate';
    target: string;
    content?: string;
    dependencies?: string[];
    estimatedTime?: number;
  }>;
  guards: Array<{
    id: string;
    type: 'constraint' | 'validation' | 'security' | 'performance';
    description: string;
    required: boolean;
  }>;
  diff: {
    added: number;
    modified: number;
    deleted: number;
    summary: string;
  };
}

/**
 * Execution report format
 */
export interface ExecutionReport extends StandardizedOutput {
  kind: 'ExecutionReport';
  applied: Array<{
    id: string;
    action: string;
    target: string;
    status: 'success' | 'failed' | 'skipped';
    error?: string;
    duration?: number;
  }>;
  junit?: JUnitTestSuite;
  report: {
    totalActions: number;
    successful: number;
    failed: number;
    skipped: number;
    duration: number;
  };
}

/**
 * JUnit XML format for test reporting
 */
export interface JUnitTestSuite {
  name: string;
  tests: number;
  failures: number;
  errors: number;
  time: number;
  testcases: Array<{
    classname: string;
    name: string;
    time: number;
    failure?: {
      message: string;
      type: string;
      content: string;
    };
    error?: {
      message: string;
      type: string;
      content: string;
    };
  }>;
}

/**
 * Surface extraction output format
 */
export interface SurfaceOutput extends StandardizedOutput {
  kind: 'Surface';
  language: string;
  surface: {
    symbols: Array<{
      name: string;
      type: string;
      visibility: string;
      signature?: string;
      location: {
        file: string;
        line: number;
        column: number;
      };
    }>;
    statistics: {
      totalSymbols: number;
      publicSymbols: number;
      privateSymbols: number;
      byType: Record<string, number>;
    };
  };
  delta?: {
    added: number;
    modified: number;
    removed: number;
    breaking: boolean;
    requiredBump: 'MAJOR' | 'MINOR' | 'PATCH';
  };
}

/**
 * Trace output for requirements → spec → tests → code traceability
 */
export interface TraceOutput extends StandardizedOutput {
  kind: 'Trace';
  links: {
    requirements: Array<{
      id: string;
      title: string;
      linkedSpecs: string[];
      linkedTests: string[];
      linkedCode: string[];
      coverage: 'complete' | 'partial' | 'missing';
    }>;
    specs: Array<{
      id: string;
      name: string;
      linkedRequirements: string[];
      linkedTests: string[];
      linkedCode: string[];
    }>;
    tests: Array<{
      id: string;
      name: string;
      file: string;
      linkedRequirements: string[];
      linkedSpecs: string[];
      linkedCode: string[];
    }>;
    code: Array<{
      id: string;
      path: string;
      anchor: string;
      linkedRequirements: string[];
      linkedSpecs: string[];
      linkedTests: string[];
    }>;
  };
  coverage: {
    requirements: {
      total: number;
      covered: number;
      percentage: number;
    };
    specs: {
      total: number;
      implemented: number;
      percentage: number;
    };
    contracts: {
      total: number;
      tested: number;
      percentage: number;
    };
  };
}

/**
 * NDJSON event format for --agent-mode streaming
 */
export interface NDJSONEvent {
  phase: string;
  timestamp: number;
  status: 'start' | 'progress' | 'complete' | 'error';
  data?: Record<string, unknown>;
  error?: string;
}

/**
 * Phase-based events for different commands
 */
export type PhaseEvent = 
  | { phase: 'validate', status: 'start' | 'complete', data?: { files?: string[], valid?: boolean, errors?: number } }
  | { phase: 'surface', status: 'start' | 'complete', data?: { language?: string, symbols?: number, delta?: any } }
  | { phase: 'plan', status: 'start' | 'complete', data?: { actions?: number, guards?: number } }
  | { phase: 'execute', status: 'start' | 'progress' | 'complete', data?: { action?: string, progress?: number, total?: number } }
  | { phase: 'test', status: 'start' | 'complete', data?: { tests?: number, passed?: number, failed?: number } }
  | { phase: 'watch', status: 'start' | 'change', data?: { changed?: string[], validate?: any, surface?: any, gates?: any } };

/**
 * Output utility class for managing standardized outputs
 */
export class StandardizedOutputManager {
  private agentMode: boolean;
  private command: string;
  private ndjsonStream?: NodeJS.WritableStream;

  constructor(command: string, agentMode = false, ndjsonOutput?: string) {
    this.command = command;
    this.agentMode = agentMode;
    
    if (agentMode && ndjsonOutput) {
      this.ndjsonStream = createWriteStream(ndjsonOutput);
    }
  }

  /**
   * Create standardized output base with apiVersion stamping
   */
  private createBaseOutput(): StandardizedOutput {
    return {
      apiVersion: API_VERSION,
      timestamp: Date.now(),
      command: this.command,
      version: '0.1.0' // TODO: Get from package.json
    };
  }

  /**
   * Write plan.json file
   */
  async writePlanFile(
    plan: PlanOutput['plan'],
    guards: PlanOutput['guards'],
    diff: PlanOutput['diff'],
    outputPath = 'plan.json',
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const output: PlanOutput = {
      ...this.createBaseOutput(),
      kind: 'Plan',
      plan,
      guards,
      diff,
      metadata
    };

    await writeFile(outputPath, JSON.stringify(output, null, 2));
    
    if (!this.agentMode) {
      console.log(chalk.green(`✅ Plan written to ${outputPath}`));
    }
  }

  /**
   * Write diff.txt file
   */
  async writeDiffFile(
    diff: string,
    outputPath = 'diff.txt'
  ): Promise<void> {
    const header = `# Diff Report\n# Generated by Arbiter CLI v${API_VERSION}\n# Timestamp: ${new Date().toISOString()}\n# Command: ${this.command}\n\n`;
    
    await writeFile(outputPath, header + diff);
    
    if (!this.agentMode) {
      console.log(chalk.green(`✅ Diff written to ${outputPath}`));
    }
  }

  /**
   * Write junit.xml file
   */
  async writeJUnitFile(
    testSuite: JUnitTestSuite,
    outputPath = 'junit.xml'
  ): Promise<void> {
    const xml = this.generateJUnitXML(testSuite);
    await writeFile(outputPath, xml);
    
    if (!this.agentMode) {
      console.log(chalk.green(`✅ JUnit report written to ${outputPath}`));
    }
  }

  /**
   * Write report.json file
   */
  async writeReportFile(
    report: ExecutionReport,
    outputPath = 'report.json'
  ): Promise<void> {
    await writeFile(outputPath, JSON.stringify(report, null, 2));
    
    if (!this.agentMode) {
      console.log(chalk.green(`✅ Execution report written to ${outputPath}`));
    }
  }

  /**
   * Write TRACE.json file
   */
  async writeTraceFile(
    trace: TraceOutput,
    outputPath = 'TRACE.json'
  ): Promise<void> {
    await writeFile(outputPath, JSON.stringify(trace, null, 2));
    
    if (!this.agentMode) {
      console.log(chalk.green(`✅ Trace report written to ${outputPath}`));
    }
  }

  /**
   * Write surface.json file
   */
  async writeSurfaceFile(
    surface: SurfaceOutput,
    outputPath = 'surface.json'
  ): Promise<void> {
    await writeFile(outputPath, JSON.stringify(surface, null, 2));
    
    if (!this.agentMode) {
      console.log(chalk.green(`✅ Surface analysis written to ${outputPath}`));
    }
  }

  /**
   * Emit NDJSON event for agent consumption
   */
  emitEvent(event: PhaseEvent & { timestamp?: number }): void {
    if (!this.agentMode) return;

    const ndjsonEvent: NDJSONEvent = {
      ...event,
      timestamp: event.timestamp || Date.now()
    };

    const line = JSON.stringify(ndjsonEvent) + '\n';

    if (this.ndjsonStream) {
      this.ndjsonStream.write(line);
    } else {
      // Write to stdout for agent consumption
      process.stdout.write(line);
    }
  }

  /**
   * Close NDJSON stream
   */
  close(): void {
    if (this.ndjsonStream) {
      this.ndjsonStream.end();
    }
  }

  /**
   * Generate JUnit XML format
   */
  private generateJUnitXML(testSuite: JUnitTestSuite): string {
    const testCasesXml = testSuite.testcases.map(testcase => {
      let testCaseContent = '';
      
      if (testcase.failure) {
        testCaseContent += `    <failure message="${this.escapeXml(testcase.failure.message)}" type="${this.escapeXml(testcase.failure.type)}">${this.escapeXml(testcase.failure.content)}</failure>\n`;
      }
      
      if (testcase.error) {
        testCaseContent += `    <error message="${this.escapeXml(testcase.error.message)}" type="${this.escapeXml(testcase.error.type)}">${this.escapeXml(testcase.error.content)}</error>\n`;
      }

      return `  <testcase classname="${this.escapeXml(testcase.classname)}" name="${this.escapeXml(testcase.name)}" time="${testcase.time}">
${testCaseContent}  </testcase>`;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated by Arbiter CLI ${API_VERSION} -->
<testsuite name="${this.escapeXml(testSuite.name)}" tests="${testSuite.tests}" failures="${testSuite.failures}" errors="${testSuite.errors}" time="${testSuite.time}" timestamp="${new Date().toISOString()}">
${testCasesXml}
</testsuite>`;
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }
}

/**
 * Helper function to create output manager for commands
 */
export function createOutputManager(
  command: string, 
  agentMode = false, 
  ndjsonOutput?: string
): StandardizedOutputManager {
  return new StandardizedOutputManager(command, agentMode, ndjsonOutput);
}

/**
 * Helper function to add --agent-mode flag to commands
 */
export function addAgentModeOption(command: any): void {
  command.option('--agent-mode', 'output NDJSON events for agent consumption');
  command.option('--ndjson-output <file>', 'write NDJSON events to file instead of stdout');
}

/**
 * Helper function to detect if we should use agent mode
 */
export function shouldUseAgentMode(options: any): boolean {
  return !!options.agentMode || !!options.ndjsonOutput;
}