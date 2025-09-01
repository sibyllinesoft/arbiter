/**
 * Coverage analysis gate
 * Analyzes test coverage and enforces minimum thresholds per component
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, access } from 'fs/promises';
import { join, relative } from 'path';
import { 
  GateExecutor,
  GateConfiguration,
  GateExecutionContext,
  GateResult,
  GateStatus,
  GateFinding,
  ValidationResult,
  CoverageMetrics
} from './types.js';

const execAsync = promisify(exec);

export interface CoverageGateSettings {
  /** Minimum line coverage percentage */
  lineThreshold: number;
  /** Minimum branch coverage percentage */
  branchThreshold: number;
  /** Minimum function coverage percentage */
  functionThreshold: number;
  /** Minimum statement coverage percentage */
  statementThreshold?: number;
  /** Only check coverage for changed files */
  differentialOnly: boolean;
  /** Coverage report format */
  reportFormat: 'lcov' | 'json' | 'cobertura';
  /** Coverage report path */
  reportPath?: string;
  /** Files to include in coverage analysis */
  includePatterns: string[];
  /** Files to exclude from coverage analysis */
  excludePatterns: string[];
  /** Fail gate if coverage data is missing */
  failOnMissingData: boolean;
  /** Per-directory coverage thresholds */
  directoryThresholds?: Record<string, Partial<CoverageMetrics>>;
  /** Coverage tools to use */
  tools: CoverageTool[];
}

export interface CoverageTool {
  /** Tool name */
  name: 'nyc' | 'jest' | 'c8' | 'istanbul' | 'custom';
  /** Command to generate coverage */
  command: string;
  /** Working directory */
  workingDir?: string;
  /** Environment variables */
  env?: Record<string, string>;
}

export interface CoverageReport {
  /** Overall coverage metrics */
  overall: CoverageMetrics;
  /** Per-file coverage metrics */
  files: Map<string, FileCoverageMetrics>;
  /** Per-directory coverage metrics */
  directories: Map<string, CoverageMetrics>;
  /** Coverage summary */
  summary: CoverageSummary;
}

export interface FileCoverageMetrics extends CoverageMetrics {
  /** File path */
  path: string;
  /** Uncovered lines */
  uncoveredLines: number[];
  /** Uncovered branches */
  uncoveredBranches: BranchInfo[];
  /** Uncovered functions */
  uncoveredFunctions: FunctionInfo[];
}

export interface BranchInfo {
  /** Line number */
  line: number;
  /** Branch ID */
  branchId: number;
  /** Branch type */
  type: 'if' | 'switch' | 'conditional' | 'logical';
}

export interface FunctionInfo {
  /** Function name */
  name: string;
  /** Line number */
  line: number;
  /** Column number */
  column: number;
}

export interface CoverageSummary {
  /** Number of files analyzed */
  filesAnalyzed: number;
  /** Number of files meeting thresholds */
  filesPassingThreshold: number;
  /** Number of files failing thresholds */
  filesFailingThreshold: number;
  /** Average coverage across all files */
  averageCoverage: number;
}

/**
 * Coverage gate implementation
 */
export class CoverageGate implements GateExecutor {
  private readonly supportedFormats = ['lcov', 'json', 'cobertura'] as const;

  /**
   * Execute the coverage gate
   */
  async executeGate(
    gate: GateConfiguration,
    context: GateExecutionContext
  ): Promise<GateResult> {
    const startTime = new Date();
    const settings = this.validateAndParseSettings(gate.settings);
    
    try {
      // Generate coverage report if needed
      const coverageReport = await this.generateCoverageReport(settings, context);
      
      // Analyze coverage
      const analysis = await this.analyzeCoverage(coverageReport, settings, context);
      
      // Generate findings
      const findings = this.generateFindings(analysis, settings);
      
      // Determine gate status
      const status = this.determineGateStatus(findings, settings);
      
      const endTime = new Date();
      
      return {
        gateId: gate.id,
        name: gate.name,
        status,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        details: {
          summary: this.generateSummary(analysis, status),
          findings,
          recommendations: this.generateRecommendations(analysis, settings),
          reportUrls: this.generateReportUrls(settings, context)
        },
        metrics: this.extractMetrics(analysis)
      };
      
    } catch (error) {
      const endTime = new Date();
      return this.createErrorResult(gate, error as Error, startTime, endTime);
    }
  }

  /**
   * Validate gate configuration
   */
  validateConfiguration(config: GateConfiguration): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
      const settings = config.settings as CoverageGateSettings;
      
      // Validate thresholds
      if (typeof settings.lineThreshold !== 'number' || settings.lineThreshold < 0 || settings.lineThreshold > 100) {
        errors.push('lineThreshold must be a number between 0 and 100');
      }
      
      if (typeof settings.branchThreshold !== 'number' || settings.branchThreshold < 0 || settings.branchThreshold > 100) {
        errors.push('branchThreshold must be a number between 0 and 100');
      }
      
      if (typeof settings.functionThreshold !== 'number' || settings.functionThreshold < 0 || settings.functionThreshold > 100) {
        errors.push('functionThreshold must be a number between 0 and 100');
      }
      
      // Validate report format
      if (!this.supportedFormats.includes(settings.reportFormat)) {
        errors.push(`reportFormat must be one of: ${this.supportedFormats.join(', ')}`);
      }
      
      // Validate tools
      if (!settings.tools || settings.tools.length === 0) {
        errors.push('At least one coverage tool must be configured');
      }
      
      // Validate patterns
      if (!Array.isArray(settings.includePatterns)) {
        warnings.push('includePatterns should be an array of glob patterns');
      }
      
      if (!Array.isArray(settings.excludePatterns)) {
        warnings.push('excludePatterns should be an array of glob patterns');
      }
      
    } catch (error) {
      errors.push(`Invalid settings object: ${error}`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Check if gate should be skipped
   */
  shouldSkip(gate: GateConfiguration, context: GateExecutionContext): boolean {
    const settings = gate.settings as CoverageGateSettings;
    
    // Skip if no test files changed and differential coverage is enabled
    if (settings.differentialOnly) {
      const hasTestChanges = context.changedFiles.some(file => 
        file.includes('test') || 
        file.includes('spec') || 
        file.endsWith('.test.ts') || 
        file.endsWith('.spec.ts')
      );
      
      if (!hasTestChanges) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Generate coverage report
   */
  private async generateCoverageReport(
    settings: CoverageGateSettings,
    context: GateExecutionContext
  ): Promise<CoverageReport> {
    const reports: CoverageReport[] = [];
    
    // Run each configured tool
    for (const tool of settings.tools) {
      try {
        const report = await this.runCoverageTool(tool, settings, context);
        reports.push(report);
      } catch (error) {
        if (settings.failOnMissingData) {
          throw error;
        }
        // Continue with other tools if this one fails
        continue;
      }
    }
    
    if (reports.length === 0) {
      throw new Error('No coverage reports could be generated');
    }
    
    // Merge reports if multiple tools were used
    return reports.length === 1 ? reports[0] : this.mergeCoverageReports(reports);
  }

  /**
   * Run a specific coverage tool
   */
  private async runCoverageTool(
    tool: CoverageTool,
    settings: CoverageGateSettings,
    context: GateExecutionContext
  ): Promise<CoverageReport> {
    const workingDir = tool.workingDir || context.workingDirectory;
    const env = { ...process.env, ...tool.env };
    
    try {
      // Execute coverage command
      const { stdout, stderr } = await execAsync(tool.command, {
        cwd: workingDir,
        env
      });
      
      // Parse coverage output based on format
      return await this.parseCoverageReport(settings, workingDir);
      
    } catch (error) {
      throw new Error(`Coverage tool ${tool.name} failed: ${error}`);
    }
  }

  /**
   * Parse coverage report from file
   */
  private async parseCoverageReport(
    settings: CoverageGateSettings,
    workingDir: string
  ): Promise<CoverageReport> {
    const reportPath = settings.reportPath || this.getDefaultReportPath(settings.reportFormat);
    const fullPath = join(workingDir, reportPath);
    
    try {
      await access(fullPath);
      const reportContent = await readFile(fullPath, 'utf-8');
      
      switch (settings.reportFormat) {
        case 'lcov':
          return this.parseLcovReport(reportContent, workingDir);
        case 'json':
          return this.parseJsonReport(reportContent, workingDir);
        case 'cobertura':
          return this.parseCoberturaReport(reportContent, workingDir);
        default:
          throw new Error(`Unsupported report format: ${settings.reportFormat}`);
      }
    } catch (error) {
      throw new Error(`Failed to read coverage report from ${fullPath}: ${error}`);
    }
  }

  /**
   * Parse LCOV format coverage report
   */
  private parseLcovReport(content: string, workingDir: string): CoverageReport {
    const files = new Map<string, FileCoverageMetrics>();
    const lines = content.split('\n');
    let currentFile: Partial<FileCoverageMetrics> | null = null;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('SF:')) {
        // Source file
        const filePath = relative(workingDir, trimmed.substring(3));
        currentFile = {
          path: filePath,
          linesCovered: 0,
          branchCovered: 0,
          functionsCovered: 0,
          statementsCovered: 0,
          totalLines: 0,
          totalBranches: 0,
          totalFunctions: 0,
          totalStatements: 0,
          uncoveredLines: [],
          uncoveredBranches: [],
          uncoveredFunctions: []
        };
      } else if (trimmed.startsWith('LH:')) {
        // Lines hit
        if (currentFile) {
          currentFile.linesCovered = parseInt(trimmed.substring(3));
        }
      } else if (trimmed.startsWith('LF:')) {
        // Lines found
        if (currentFile) {
          currentFile.totalLines = parseInt(trimmed.substring(3));
        }
      } else if (trimmed.startsWith('BRH:')) {
        // Branches hit
        if (currentFile) {
          currentFile.branchCovered = parseInt(trimmed.substring(4));
        }
      } else if (trimmed.startsWith('BRF:')) {
        // Branches found
        if (currentFile) {
          currentFile.totalBranches = parseInt(trimmed.substring(4));
        }
      } else if (trimmed.startsWith('FNH:')) {
        // Functions hit
        if (currentFile) {
          currentFile.functionsCovered = parseInt(trimmed.substring(4));
        }
      } else if (trimmed.startsWith('FNF:')) {
        // Functions found
        if (currentFile) {
          currentFile.totalFunctions = parseInt(trimmed.substring(4));
        }
      } else if (trimmed === 'end_of_record' && currentFile) {
        // End of current file record
        files.set(currentFile.path!, currentFile as FileCoverageMetrics);
        currentFile = null;
      }
    }
    
    return this.buildCoverageReport(files);
  }

  /**
   * Parse JSON format coverage report
   */
  private parseJsonReport(content: string, workingDir: string): CoverageReport {
    const data = JSON.parse(content);
    const files = new Map<string, FileCoverageMetrics>();
    
    // Handle different JSON formats (nyc, jest, etc.)
    const fileData = data.files || data;
    
    for (const [filePath, fileInfo] of Object.entries(fileData)) {
      const relativePath = relative(workingDir, filePath);
      const info = fileInfo as any;
      
      const metrics: FileCoverageMetrics = {
        path: relativePath,
        linesCovered: info.lines?.covered || 0,
        branchCovered: info.branches?.covered || 0,
        functionsCovered: info.functions?.covered || 0,
        statementsCovered: info.statements?.covered || 0,
        totalLines: info.lines?.total || 0,
        totalBranches: info.branches?.total || 0,
        totalFunctions: info.functions?.total || 0,
        totalStatements: info.statements?.total || 0,
        uncoveredLines: info.uncoveredLines || [],
        uncoveredBranches: info.uncoveredBranches || [],
        uncoveredFunctions: info.uncoveredFunctions || []
      };
      
      files.set(relativePath, metrics);
    }
    
    return this.buildCoverageReport(files);
  }

  /**
   * Parse Cobertura XML format coverage report
   */
  private parseCoberturaReport(content: string, workingDir: string): CoverageReport {
    // For simplicity, we'll implement a basic XML parser
    // In production, you'd want to use a proper XML parsing library
    const files = new Map<string, FileCoverageMetrics>();
    
    // This is a simplified implementation
    // A full implementation would parse XML properly
    const fileMatches = content.match(/<class[^>]+filename="([^"]+)"[^>]*>/g);
    
    if (fileMatches) {
      for (const match of fileMatches) {
        const filePathMatch = match.match(/filename="([^"]+)"/);
        if (filePathMatch) {
          const filePath = relative(workingDir, filePathMatch[1]);
          
          // Extract coverage metrics from XML (simplified)
          const metrics: FileCoverageMetrics = {
            path: filePath,
            linesCovered: 0,
            branchCovered: 0,
            functionsCovered: 0,
            statementsCovered: 0,
            totalLines: 0,
            totalBranches: 0,
            totalFunctions: 0,
            totalStatements: 0,
            uncoveredLines: [],
            uncoveredBranches: [],
            uncoveredFunctions: []
          };
          
          files.set(filePath, metrics);
        }
      }
    }
    
    return this.buildCoverageReport(files);
  }

  /**
   * Build coverage report from file metrics
   */
  private buildCoverageReport(files: Map<string, FileCoverageMetrics>): CoverageReport {
    let totalLinesCovered = 0;
    let totalBranchesCovered = 0;
    let totalFunctionsCovered = 0;
    let totalStatementsCovered = 0;
    let totalLines = 0;
    let totalBranches = 0;
    let totalFunctions = 0;
    let totalStatements = 0;
    
    // Calculate overall metrics
    for (const fileMetrics of files.values()) {
      totalLinesCovered += fileMetrics.linesCovered;
      totalBranchesCovered += fileMetrics.branchCovered;
      totalFunctionsCovered += fileMetrics.functionsCovered;
      totalStatementsCovered += fileMetrics.statementsCovered;
      totalLines += fileMetrics.totalLines;
      totalBranches += fileMetrics.totalBranches;
      totalFunctions += fileMetrics.totalFunctions;
      totalStatements += fileMetrics.totalStatements;
    }
    
    const overall: CoverageMetrics = {
      linesCovered: totalLines > 0 ? (totalLinesCovered / totalLines) * 100 : 0,
      branchCovered: totalBranches > 0 ? (totalBranchesCovered / totalBranches) * 100 : 0,
      functionsCovered: totalFunctions > 0 ? (totalFunctionsCovered / totalFunctions) * 100 : 0,
      statementsCovered: totalStatements > 0 ? (totalStatementsCovered / totalStatements) * 100 : 0,
      totalLines,
      totalBranches,
      totalFunctions,
      totalStatements
    };
    
    // Build directory metrics
    const directories = this.buildDirectoryMetrics(files);
    
    const summary: CoverageSummary = {
      filesAnalyzed: files.size,
      filesPassingThreshold: 0,
      filesFailingThreshold: 0,
      averageCoverage: overall.linesCovered
    };
    
    return {
      overall,
      files,
      directories,
      summary
    };
  }

  /**
   * Build directory-level coverage metrics
   */
  private buildDirectoryMetrics(files: Map<string, FileCoverageMetrics>): Map<string, CoverageMetrics> {
    const directories = new Map<string, CoverageMetrics>();
    const dirFiles = new Map<string, FileCoverageMetrics[]>();
    
    // Group files by directory
    for (const file of files.values()) {
      const dir = file.path.substring(0, file.path.lastIndexOf('/')) || '.';
      if (!dirFiles.has(dir)) {
        dirFiles.set(dir, []);
      }
      dirFiles.get(dir)!.push(file);
    }
    
    // Calculate metrics for each directory
    for (const [dir, dirFilesList] of dirFiles) {
      let totalLinesCovered = 0;
      let totalBranchesCovered = 0;
      let totalFunctionsCovered = 0;
      let totalStatementsCovered = 0;
      let totalLines = 0;
      let totalBranches = 0;
      let totalFunctions = 0;
      let totalStatements = 0;
      
      for (const file of dirFilesList) {
        totalLinesCovered += file.linesCovered;
        totalBranchesCovered += file.branchCovered;
        totalFunctionsCovered += file.functionsCovered;
        totalStatementsCovered += file.statementsCovered;
        totalLines += file.totalLines;
        totalBranches += file.totalBranches;
        totalFunctions += file.totalFunctions;
        totalStatements += file.totalStatements;
      }
      
      directories.set(dir, {
        linesCovered: totalLines > 0 ? (totalLinesCovered / totalLines) * 100 : 0,
        branchCovered: totalBranches > 0 ? (totalBranchesCovered / totalBranches) * 100 : 0,
        functionsCovered: totalFunctions > 0 ? (totalFunctionsCovered / totalFunctions) * 100 : 0,
        statementsCovered: totalStatements > 0 ? (totalStatementsCovered / totalStatements) * 100 : 0,
        totalLines,
        totalBranches,
        totalFunctions,
        totalStatements
      });
    }
    
    return directories;
  }

  /**
   * Merge multiple coverage reports
   */
  private mergeCoverageReports(reports: CoverageReport[]): CoverageReport {
    const allFiles = new Map<string, FileCoverageMetrics>();
    
    // Merge file metrics
    for (const report of reports) {
      for (const [path, metrics] of report.files) {
        if (allFiles.has(path)) {
          // Merge metrics (taking the higher coverage)
          const existing = allFiles.get(path)!;
          allFiles.set(path, {
            ...existing,
            linesCovered: Math.max(existing.linesCovered, metrics.linesCovered),
            branchCovered: Math.max(existing.branchCovered, metrics.branchCovered),
            functionsCovered: Math.max(existing.functionsCovered, metrics.functionsCovered),
            statementsCovered: Math.max(existing.statementsCovered, metrics.statementsCovered)
          });
        } else {
          allFiles.set(path, metrics);
        }
      }
    }
    
    return this.buildCoverageReport(allFiles);
  }

  /**
   * Analyze coverage against thresholds
   */
  private async analyzeCoverage(
    report: CoverageReport,
    settings: CoverageGateSettings,
    context: GateExecutionContext
  ): Promise<CoverageAnalysis> {
    const filesToCheck = settings.differentialOnly 
      ? this.filterChangedFiles(report.files, context.changedFiles)
      : report.files;
    
    const violations: CoverageViolation[] = [];
    let filesPassingThreshold = 0;
    
    // Check overall thresholds
    if (report.overall.linesCovered < settings.lineThreshold) {
      violations.push({
        type: 'overall',
        metric: 'lines',
        actual: report.overall.linesCovered,
        threshold: settings.lineThreshold,
        path: 'overall'
      });
    }
    
    if (report.overall.branchCovered < settings.branchThreshold) {
      violations.push({
        type: 'overall',
        metric: 'branches',
        actual: report.overall.branchCovered,
        threshold: settings.branchThreshold,
        path: 'overall'
      });
    }
    
    if (report.overall.functionsCovered < settings.functionThreshold) {
      violations.push({
        type: 'overall',
        metric: 'functions',
        actual: report.overall.functionsCovered,
        threshold: settings.functionThreshold,
        path: 'overall'
      });
    }
    
    // Check file-level thresholds
    for (const [path, metrics] of filesToCheck) {
      const fileViolations = this.checkFileThresholds(path, metrics, settings);
      violations.push(...fileViolations);
      
      if (fileViolations.length === 0) {
        filesPassingThreshold++;
      }
    }
    
    // Update summary
    report.summary.filesPassingThreshold = filesPassingThreshold;
    report.summary.filesFailingThreshold = filesToCheck.size - filesPassingThreshold;
    
    return {
      report,
      violations,
      checkedFiles: filesToCheck
    };
  }

  /**
   * Filter files to only changed files
   */
  private filterChangedFiles(
    allFiles: Map<string, FileCoverageMetrics>,
    changedFiles: string[]
  ): Map<string, FileCoverageMetrics> {
    const filtered = new Map<string, FileCoverageMetrics>();
    
    for (const [path, metrics] of allFiles) {
      if (changedFiles.some(changed => changed.includes(path) || path.includes(changed))) {
        filtered.set(path, metrics);
      }
    }
    
    return filtered;
  }

  /**
   * Check file-level thresholds
   */
  private checkFileThresholds(
    path: string,
    metrics: FileCoverageMetrics,
    settings: CoverageGateSettings
  ): CoverageViolation[] {
    const violations: CoverageViolation[] = [];
    
    if (metrics.linesCovered < settings.lineThreshold) {
      violations.push({
        type: 'file',
        metric: 'lines',
        actual: metrics.linesCovered,
        threshold: settings.lineThreshold,
        path
      });
    }
    
    if (metrics.branchCovered < settings.branchThreshold) {
      violations.push({
        type: 'file',
        metric: 'branches',
        actual: metrics.branchCovered,
        threshold: settings.branchThreshold,
        path
      });
    }
    
    if (metrics.functionsCovered < settings.functionThreshold) {
      violations.push({
        type: 'file',
        metric: 'functions',
        actual: metrics.functionsCovered,
        threshold: settings.functionThreshold,
        path
      });
    }
    
    return violations;
  }

  /**
   * Generate findings from analysis
   */
  private generateFindings(
    analysis: CoverageAnalysis,
    settings: CoverageGateSettings
  ): GateFinding[] {
    const findings: GateFinding[] = [];
    
    for (const violation of analysis.violations) {
      findings.push({
        severity: 'error',
        category: 'coverage',
        message: `${violation.metric} coverage (${violation.actual.toFixed(1)}%) below threshold (${violation.threshold}%)`,
        file: violation.path !== 'overall' ? violation.path : undefined,
        rule: `${violation.metric}-coverage-threshold`
      });
    }
    
    // Add informational findings for good coverage
    if (analysis.report.overall.linesCovered >= settings.lineThreshold * 1.1) {
      findings.push({
        severity: 'info',
        category: 'coverage',
        message: `Excellent line coverage: ${analysis.report.overall.linesCovered.toFixed(1)}%`,
        rule: 'coverage-excellence'
      });
    }
    
    return findings;
  }

  /**
   * Determine gate status based on findings
   */
  private determineGateStatus(
    findings: GateFinding[],
    settings: CoverageGateSettings
  ): GateStatus {
    const errors = findings.filter(f => f.severity === 'error');
    return errors.length === 0 ? GateStatus.PASSED : GateStatus.FAILED;
  }

  /**
   * Generate summary message
   */
  private generateSummary(analysis: CoverageAnalysis, status: GateStatus): string {
    const { overall } = analysis.report;
    const violationCount = analysis.violations.length;
    
    if (status === GateStatus.PASSED) {
      return `Coverage gate passed. Line: ${overall.linesCovered.toFixed(1)}%, Branch: ${overall.branchCovered.toFixed(1)}%, Function: ${overall.functionsCovered.toFixed(1)}%`;
    } else {
      return `Coverage gate failed with ${violationCount} threshold violation(s). Line: ${overall.linesCovered.toFixed(1)}%, Branch: ${overall.branchCovered.toFixed(1)}%, Function: ${overall.functionsCovered.toFixed(1)}%`;
    }
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    analysis: CoverageAnalysis,
    settings: CoverageGateSettings
  ): string[] {
    const recommendations: string[] = [];
    
    if (analysis.violations.length > 0) {
      recommendations.push('Add tests to increase coverage for failing thresholds');
      
      // Specific recommendations based on violation types
      const lineViolations = analysis.violations.filter(v => v.metric === 'lines');
      if (lineViolations.length > 0) {
        recommendations.push('Focus on testing uncovered lines of code');
      }
      
      const branchViolations = analysis.violations.filter(v => v.metric === 'branches');
      if (branchViolations.length > 0) {
        recommendations.push('Add tests for conditional logic and edge cases');
      }
      
      const functionViolations = analysis.violations.filter(v => v.metric === 'functions');
      if (functionViolations.length > 0) {
        recommendations.push('Ensure all functions have at least one test');
      }
    }
    
    // Performance recommendations
    if (analysis.checkedFiles.size > 100) {
      recommendations.push('Consider enabling differential coverage mode for faster CI builds');
    }
    
    return recommendations;
  }

  /**
   * Generate report URLs
   */
  private generateReportUrls(
    settings: CoverageGateSettings,
    context: GateExecutionContext
  ): string[] {
    const urls: string[] = [];
    
    if (settings.reportPath) {
      urls.push(`file://${join(context.workingDirectory, settings.reportPath)}`);
    }
    
    // Add HTML report URL if available
    const htmlReportPath = join(context.workingDirectory, 'coverage', 'index.html');
    urls.push(`file://${htmlReportPath}`);
    
    return urls;
  }

  /**
   * Extract metrics for reporting
   */
  private extractMetrics(analysis: CoverageAnalysis): Record<string, number> {
    const { overall, summary } = analysis.report;
    
    return {
      'coverage.lines': overall.linesCovered,
      'coverage.branches': overall.branchCovered,
      'coverage.functions': overall.functionsCovered,
      'coverage.statements': overall.statementsCovered,
      'coverage.filesAnalyzed': summary.filesAnalyzed,
      'coverage.filesPassing': summary.filesPassingThreshold,
      'coverage.filesFailing': summary.filesFailingThreshold,
      'coverage.violations': analysis.violations.length
    };
  }

  /**
   * Get default report path based on format
   */
  private getDefaultReportPath(format: string): string {
    switch (format) {
      case 'lcov':
        return 'coverage/lcov.info';
      case 'json':
        return 'coverage/coverage-final.json';
      case 'cobertura':
        return 'coverage/cobertura-coverage.xml';
      default:
        throw new Error(`Unknown coverage format: ${format}`);
    }
  }

  /**
   * Validate and parse gate settings
   */
  private validateAndParseSettings(settings: any): CoverageGateSettings {
    const defaults: CoverageGateSettings = {
      lineThreshold: 80,
      branchThreshold: 75,
      functionThreshold: 80,
      statementThreshold: 80,
      differentialOnly: false,
      reportFormat: 'lcov',
      includePatterns: ['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx'],
      excludePatterns: ['**/node_modules/**', '**/dist/**', '**/build/**'],
      failOnMissingData: true,
      tools: [{
        name: 'nyc',
        command: 'nyc report --reporter=lcov'
      }]
    };
    
    return { ...defaults, ...settings };
  }

  /**
   * Create error result
   */
  private createErrorResult(
    gate: GateConfiguration,
    error: Error,
    startTime: Date,
    endTime: Date
  ): GateResult {
    return {
      gateId: gate.id,
      name: gate.name,
      status: GateStatus.ERROR,
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      details: {
        summary: `Coverage gate error: ${error.message}`,
        findings: [{
          severity: 'error',
          category: 'execution',
          message: error.message,
          rule: 'gate-execution'
        }],
        recommendations: ['Check coverage tool configuration and ensure tests run successfully'],
        reportUrls: []
      },
      error: {
        code: 'COVERAGE_ERROR',
        message: error.message,
        details: error.stack
      },
      metrics: {}
    };
  }
}

// Supporting interfaces for internal use
interface CoverageAnalysis {
  report: CoverageReport;
  violations: CoverageViolation[];
  checkedFiles: Map<string, FileCoverageMetrics>;
}

interface CoverageViolation {
  type: 'overall' | 'file' | 'directory';
  metric: 'lines' | 'branches' | 'functions' | 'statements';
  actual: number;
  threshold: number;
  path: string;
}