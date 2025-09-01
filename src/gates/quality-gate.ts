/**
 * Code quality gate
 * Analyzes code complexity, maintainability, and enforces coding standards
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import { join } from 'path';
import {
  GateExecutor,
  GateConfiguration,
  GateExecutionContext,
  GateResult,
  GateStatus,
  GateFinding,
  ValidationResult,
  QualityMetrics
} from './types.js';

const execAsync = promisify(exec);

export interface QualityGateSettings {
  /** Maximum allowed cyclomatic complexity per function */
  maxComplexity: number;
  /** Minimum maintainability index */
  minMaintainabilityIndex: number;
  /** Maximum allowed code duplication percentage */
  maxDuplication: number;
  /** Maximum lines of code per file */
  maxLinesPerFile: number;
  /** Maximum lines of code per function */
  maxLinesPerFunction: number;
  /** Maximum nesting depth */
  maxNestingDepth: number;
  /** Maximum number of parameters per function */
  maxParameters: number;
  /** Enforce coding standards */
  enforceStandards: boolean;
  /** Quality analyzers to use */
  analyzers: QualityAnalyzer[];
  /** Files to include in analysis */
  includePatterns: string[];
  /** Files to exclude from analysis */
  excludePatterns: string[];
  /** Only analyze changed files */
  differentialOnly: boolean;
  /** Custom quality rules */
  customRules: QualityRule[];
  /** Documentation requirements */
  documentationRules: DocumentationRules;
  /** Code style rules */
  styleRules: StyleRules;
}

export interface QualityAnalyzer {
  /** Analyzer name */
  name: 'eslint' | 'tslint' | 'pylint' | 'sonarjs' | 'jscpd' | 'complexity-report' | 'custom';
  /** Analyzer command */
  command: string;
  /** Working directory */
  workingDir?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Configuration file path */
  configFile?: string;
  /** Output format */
  outputFormat: 'json' | 'xml' | 'checkstyle' | 'junit' | 'text';
  /** Timeout in milliseconds */
  timeout: number;
  /** Rules to enable/disable */
  rules?: Record<string, 'error' | 'warn' | 'off'>;
}

export interface QualityRule {
  /** Rule ID */
  id: string;
  /** Rule name */
  name: string;
  /** Rule description */
  description: string;
  /** Rule severity */
  severity: 'error' | 'warning' | 'info';
  /** Pattern to match */
  pattern: string | RegExp;
  /** File types to apply rule to */
  fileTypes: string[];
  /** Rule category */
  category: 'complexity' | 'maintainability' | 'style' | 'documentation' | 'performance';
}

export interface DocumentationRules {
  /** Require JSDoc for public functions */
  requirePublicFunctionDocs: boolean;
  /** Require JSDoc for public classes */
  requirePublicClassDocs: boolean;
  /** Require README files in directories */
  requireReadmeFiles: boolean;
  /** Minimum documentation coverage percentage */
  minDocumentationCoverage: number;
}

export interface StyleRules {
  /** Enforce consistent indentation */
  enforceIndentation: boolean;
  /** Enforce consistent naming conventions */
  enforceNamingConventions: boolean;
  /** Enforce consistent import ordering */
  enforceImportOrdering: boolean;
  /** Enforce consistent code formatting */
  enforceFormatting: boolean;
}

export interface QualityIssue {
  /** Issue ID */
  id: string;
  /** Issue title */
  title: string;
  /** Issue description */
  description: string;
  /** Issue severity */
  severity: 'error' | 'warning' | 'info';
  /** File path */
  filePath?: string;
  /** Line number */
  line?: number;
  /** Column number */
  column?: number;
  /** Rule that triggered this issue */
  rule: string;
  /** Issue category */
  category: string;
  /** Suggested fix */
  fix?: string;
  /** Code snippet */
  snippet?: string;
}

export interface ComplexityMetrics {
  /** Cyclomatic complexity */
  cyclomatic: number;
  /** Cognitive complexity */
  cognitive: number;
  /** Halstead complexity */
  halstead?: HalsteadMetrics;
  /** Lines of code */
  linesOfCode: number;
  /** Number of functions */
  functions: number;
  /** Average complexity per function */
  averageComplexity: number;
}

export interface HalsteadMetrics {
  /** Program length */
  length: number;
  /** Program vocabulary */
  vocabulary: number;
  /** Program volume */
  volume: number;
  /** Program difficulty */
  difficulty: number;
  /** Program effort */
  effort: number;
}

export interface MaintainabilityMetrics {
  /** Maintainability index (0-100) */
  index: number;
  /** Technical debt ratio */
  technicalDebtRatio: number;
  /** Code duplication percentage */
  duplication: number;
  /** Test coverage percentage */
  testCoverage?: number;
}

export interface QualityAnalysisResult {
  /** Quality issues found */
  issues: QualityIssue[];
  /** Complexity metrics */
  complexity: ComplexityMetrics;
  /** Maintainability metrics */
  maintainability: MaintainabilityMetrics;
  /** Overall quality metrics */
  metrics: QualityMetrics;
  /** Analyzer results */
  analyzerResults: Map<string, AnalyzerResult>;
  /** File-level metrics */
  fileMetrics: Map<string, FileQualityMetrics>;
}

export interface AnalyzerResult {
  /** Analyzer name */
  analyzer: string;
  /** Execution status */
  status: 'success' | 'failure' | 'timeout';
  /** Execution time */
  executionTime: number;
  /** Issues found */
  issues: QualityIssue[];
  /** Error message if failed */
  error?: string;
  /** Raw output */
  rawOutput?: string;
}

export interface FileQualityMetrics {
  /** File path */
  filePath: string;
  /** Lines of code */
  linesOfCode: number;
  /** Cyclomatic complexity */
  complexity: number;
  /** Maintainability index */
  maintainability: number;
  /** Duplication percentage */
  duplication: number;
  /** Number of issues */
  issueCount: number;
  /** Quality score (0-100) */
  qualityScore: number;
}

/**
 * Code quality gate implementation
 */
export class QualityGate implements GateExecutor {
  /**
   * Execute the quality gate
   */
  async executeGate(
    gate: GateConfiguration,
    context: GateExecutionContext
  ): Promise<GateResult> {
    const startTime = new Date();
    const settings = this.validateAndParseSettings(gate.settings);

    try {
      // Perform quality analysis
      const analysis = await this.performQualityAnalysis(settings, context);

      // Generate findings
      const findings = this.generateFindings(analysis, settings);

      // Determine gate status
      const status = this.determineGateStatus(findings, analysis, settings);

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
          reportUrls: this.generateReportUrls(context)
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
      const settings = config.settings as QualityGateSettings;

      // Validate numeric thresholds
      if (typeof settings.maxComplexity !== 'number' || settings.maxComplexity < 1) {
        errors.push('maxComplexity must be a positive number');
      }

      if (typeof settings.minMaintainabilityIndex !== 'number' || 
          settings.minMaintainabilityIndex < 0 || 
          settings.minMaintainabilityIndex > 100) {
        errors.push('minMaintainabilityIndex must be a number between 0 and 100');
      }

      if (typeof settings.maxDuplication !== 'number' || 
          settings.maxDuplication < 0 || 
          settings.maxDuplication > 100) {
        errors.push('maxDuplication must be a percentage between 0 and 100');
      }

      if (typeof settings.maxLinesPerFile !== 'number' || settings.maxLinesPerFile < 1) {
        errors.push('maxLinesPerFile must be a positive number');
      }

      if (typeof settings.maxLinesPerFunction !== 'number' || settings.maxLinesPerFunction < 1) {
        errors.push('maxLinesPerFunction must be a positive number');
      }

      if (typeof settings.maxNestingDepth !== 'number' || settings.maxNestingDepth < 1) {
        errors.push('maxNestingDepth must be a positive number');
      }

      if (typeof settings.maxParameters !== 'number' || settings.maxParameters < 1) {
        errors.push('maxParameters must be a positive number');
      }

      // Validate analyzers
      if (!Array.isArray(settings.analyzers)) {
        errors.push('analyzers must be an array');
      } else {
        for (const analyzer of settings.analyzers) {
          if (!analyzer.name || !analyzer.command) {
            errors.push('Each analyzer must have a name and command');
          }
          if (!analyzer.outputFormat) {
            warnings.push(`Analyzer ${analyzer.name} should specify outputFormat`);
          }
        }
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
    const settings = gate.settings as QualityGateSettings;

    // Skip if no relevant files changed and differential mode is enabled
    if (settings.differentialOnly) {
      const hasRelevantChanges = context.changedFiles.some(file =>
        this.matchesPatterns(file, settings.includePatterns) &&
        !this.matchesPatterns(file, settings.excludePatterns)
      );

      if (!hasRelevantChanges) {
        return true;
      }
    }

    return false;
  }

  /**
   * Perform comprehensive quality analysis
   */
  private async performQualityAnalysis(
    settings: QualityGateSettings,
    context: GateExecutionContext
  ): Promise<QualityAnalysisResult> {
    const issues: QualityIssue[] = [];
    const analyzerResults = new Map<string, AnalyzerResult>();
    const fileMetrics = new Map<string, FileQualityMetrics>();

    // Run quality analyzers
    for (const analyzer of settings.analyzers) {
      try {
        const result = await this.runQualityAnalyzer(analyzer, settings, context);
        analyzerResults.set(analyzer.name, result);
        issues.push(...result.issues);
      } catch (error) {
        analyzerResults.set(analyzer.name, {
          analyzer: analyzer.name,
          status: 'failure',
          executionTime: 0,
          issues: [],
          error: (error as Error).message
        });
      }
    }

    // Apply custom rules
    if (settings.customRules.length > 0) {
      const customIssues = await this.applyCustomRules(settings, context);
      issues.push(...customIssues);
    }

    // Calculate file-level metrics
    const filesToAnalyze = await this.getFilesToAnalyze(settings, context);
    for (const file of filesToAnalyze) {
      try {
        const metrics = await this.calculateFileMetrics(file, context);
        fileMetrics.set(file, metrics);
      } catch (error) {
        // Skip files that can't be analyzed
      }
    }

    // Calculate overall metrics
    const complexity = this.calculateComplexityMetrics(fileMetrics);
    const maintainability = this.calculateMaintainabilityMetrics(fileMetrics, issues);
    const metrics = this.calculateQualityMetrics(complexity, maintainability, issues);

    return {
      issues,
      complexity,
      maintainability,
      metrics,
      analyzerResults,
      fileMetrics
    };
  }

  /**
   * Run a quality analyzer
   */
  private async runQualityAnalyzer(
    analyzer: QualityAnalyzer,
    settings: QualityGateSettings,
    context: GateExecutionContext
  ): Promise<AnalyzerResult> {
    const startTime = Date.now();
    const workingDir = analyzer.workingDir || context.workingDirectory;
    const env = { ...process.env, ...analyzer.env };

    try {
      // Build analyzer command
      let command = analyzer.command;
      if (analyzer.configFile) {
        command += ` --config ${analyzer.configFile}`;
      }

      // Add output format if supported
      if (analyzer.outputFormat === 'json') {
        command += ' --format json';
      }

      // Add differential analysis if enabled
      if (settings.differentialOnly && context.changedFiles.length > 0) {
        const changedFiles = context.changedFiles
          .filter(file => this.matchesPatterns(file, settings.includePatterns))
          .join(' ');
        if (changedFiles) {
          command += ` ${changedFiles}`;
        }
      }

      // Execute analyzer
      const { stdout, stderr } = await execAsync(command, {
        cwd: workingDir,
        env,
        timeout: analyzer.timeout
      });

      // Parse results
      const issues = await this.parseAnalyzerOutput(
        analyzer,
        stdout,
        workingDir
      );

      return {
        analyzer: analyzer.name,
        status: 'success',
        executionTime: Date.now() - startTime,
        issues,
        rawOutput: stdout
      };

    } catch (error) {
      return {
        analyzer: analyzer.name,
        status: 'failure',
        executionTime: Date.now() - startTime,
        issues: [],
        error: (error as Error).message
      };
    }
  }

  /**
   * Parse analyzer output
   */
  private async parseAnalyzerOutput(
    analyzer: QualityAnalyzer,
    output: string,
    workingDir: string
  ): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];

    try {
      switch (analyzer.outputFormat) {
        case 'json':
          issues.push(...this.parseJsonAnalyzerOutput(output, analyzer.name));
          break;
        case 'xml':
          issues.push(...this.parseXmlAnalyzerOutput(output, analyzer.name));
          break;
        case 'checkstyle':
          issues.push(...this.parseCheckstyleOutput(output, analyzer.name));
          break;
        case 'junit':
          issues.push(...this.parseJunitOutput(output, analyzer.name));
          break;
        case 'text':
          issues.push(...this.parseTextAnalyzerOutput(output, analyzer.name));
          break;
        default:
          throw new Error(`Unsupported analyzer output format: ${analyzer.outputFormat}`);
      }
    } catch (error) {
      // Create a generic issue if parsing fails
      issues.push({
        id: `${analyzer.name}-parse-error`,
        title: 'Analyzer Output Parse Error',
        description: `Failed to parse ${analyzer.name} output: ${error}`,
        severity: 'warning',
        rule: 'analyzer-parse-error',
        category: 'quality'
      });
    }

    return issues;
  }

  /**
   * Parse JSON analyzer output
   */
  private parseJsonAnalyzerOutput(output: string, analyzerName: string): QualityIssue[] {
    const issues: QualityIssue[] = [];
    const data = JSON.parse(output);

    // Handle different JSON formats based on analyzer
    if (analyzerName === 'eslint') {
      for (const file of data) {
        for (const message of file.messages) {
          issues.push({
            id: message.ruleId || 'unknown',
            title: message.message,
            description: message.message,
            severity: this.mapSeverity(message.severity),
            filePath: file.filePath,
            line: message.line,
            column: message.column,
            rule: message.ruleId || 'unknown',
            category: this.categorizeRule(message.ruleId || 'unknown')
          });
        }
      }
    } else {
      // Generic JSON parsing
      const results = data.results || data.issues || data;
      for (const result of results) {
        issues.push({
          id: result.id || result.ruleId || 'unknown',
          title: result.title || result.message || 'Quality issue',
          description: result.description || result.message || '',
          severity: this.mapSeverity(result.severity || 'warning'),
          filePath: result.file || result.path || result.filename,
          line: result.line || result.lineNumber,
          column: result.column || result.columnNumber,
          rule: result.rule || result.ruleId || 'unknown',
          category: this.categorizeRule(result.rule || result.ruleId || 'unknown')
        });
      }
    }

    return issues;
  }

  /**
   * Parse XML analyzer output
   */
  private parseXmlAnalyzerOutput(output: string, analyzerName: string): QualityIssue[] {
    // For simplicity, return empty array
    // In production, you'd use an XML parser library
    return [];
  }

  /**
   * Parse Checkstyle format output
   */
  private parseCheckstyleOutput(output: string, analyzerName: string): QualityIssue[] {
    // For simplicity, return empty array
    // In production, you'd parse the Checkstyle XML format
    return [];
  }

  /**
   * Parse JUnit format output
   */
  private parseJunitOutput(output: string, analyzerName: string): QualityIssue[] {
    // For simplicity, return empty array
    // In production, you'd parse the JUnit XML format
    return [];
  }

  /**
   * Parse text analyzer output
   */
  private parseTextAnalyzerOutput(output: string, analyzerName: string): QualityIssue[] {
    const issues: QualityIssue[] = [];
    const lines = output.split('\n');

    // Simple text parsing - this would be analyzer-specific in production
    for (const line of lines) {
      if (line.toLowerCase().includes('warning') || 
          line.toLowerCase().includes('error') ||
          line.toLowerCase().includes('issue')) {
        issues.push({
          id: 'text-parsed-issue',
          title: line.trim(),
          description: line.trim(),
          severity: 'warning',
          rule: 'text-parser',
          category: 'quality'
        });
      }
    }

    return issues;
  }

  /**
   * Apply custom quality rules
   */
  private async applyCustomRules(
    settings: QualityGateSettings,
    context: GateExecutionContext
  ): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];
    const filesToAnalyze = await this.getFilesToAnalyze(settings, context);

    for (const rule of settings.customRules) {
      for (const file of filesToAnalyze) {
        // Check if file type matches rule
        if (!this.fileMatchesTypes(file, rule.fileTypes)) {
          continue;
        }

        try {
          const filePath = join(context.workingDirectory, file);
          const content = await readFile(filePath, 'utf-8');
          const matches = this.findRuleMatches(content, rule);

          for (const match of matches) {
            issues.push({
              id: rule.id,
              title: rule.name,
              description: rule.description,
              severity: rule.severity,
              filePath: file,
              line: match.line,
              column: match.column,
              rule: rule.id,
              category: rule.category
            });
          }
        } catch (error) {
          // Skip files that can't be read
        }
      }
    }

    return issues;
  }

  /**
   * Get files to analyze
   */
  private async getFilesToAnalyze(
    settings: QualityGateSettings,
    context: GateExecutionContext
  ): Promise<string[]> {
    if (settings.differentialOnly && context.changedFiles.length > 0) {
      return context.changedFiles.filter(file =>
        this.matchesPatterns(file, settings.includePatterns) &&
        !this.matchesPatterns(file, settings.excludePatterns)
      );
    }

    const { glob } = await import('glob');
    const files = await glob('**/*', {
      cwd: context.workingDirectory,
      ignore: settings.excludePatterns,
      nodir: true
    });

    return files.filter(file =>
      this.matchesPatterns(file, settings.includePatterns)
    );
  }

  /**
   * Calculate file-level quality metrics
   */
  private async calculateFileMetrics(
    file: string,
    context: GateExecutionContext
  ): Promise<FileQualityMetrics> {
    const filePath = join(context.workingDirectory, file);
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    // Basic metrics calculation
    const linesOfCode = lines.filter(line => 
      line.trim().length > 0 && 
      !line.trim().startsWith('//')
    ).length;

    // Simple complexity calculation (count of control flow statements)
    const complexity = this.calculateSimpleComplexity(content);

    // Simple maintainability calculation
    const maintainability = Math.max(0, 100 - (complexity * 2) - (linesOfCode / 10));

    return {
      filePath: file,
      linesOfCode,
      complexity,
      maintainability,
      duplication: 0, // Would be calculated by actual duplication analyzer
      issueCount: 0,  // Will be filled later
      qualityScore: maintainability
    };
  }

  /**
   * Calculate simple complexity score
   */
  private calculateSimpleComplexity(content: string): number {
    const keywords = ['if', 'else', 'while', 'for', 'switch', 'case', 'catch', 'try'];
    let complexity = 1; // Base complexity

    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = content.match(regex);
      if (matches) {
        complexity += matches.length;
      }
    }

    return complexity;
  }

  /**
   * Calculate overall complexity metrics
   */
  private calculateComplexityMetrics(
    fileMetrics: Map<string, FileQualityMetrics>
  ): ComplexityMetrics {
    const files = Array.from(fileMetrics.values());
    
    if (files.length === 0) {
      return {
        cyclomatic: 0,
        cognitive: 0,
        linesOfCode: 0,
        functions: 0,
        averageComplexity: 0
      };
    }

    const totalComplexity = files.reduce((sum, file) => sum + file.complexity, 0);
    const totalLoc = files.reduce((sum, file) => sum + file.linesOfCode, 0);

    return {
      cyclomatic: totalComplexity,
      cognitive: totalComplexity, // Simplified - would be calculated separately
      linesOfCode: totalLoc,
      functions: files.length, // Simplified - would count actual functions
      averageComplexity: totalComplexity / files.length
    };
  }

  /**
   * Calculate maintainability metrics
   */
  private calculateMaintainabilityMetrics(
    fileMetrics: Map<string, FileQualityMetrics>,
    issues: QualityIssue[]
  ): MaintainabilityMetrics {
    const files = Array.from(fileMetrics.values());
    
    if (files.length === 0) {
      return {
        index: 0,
        technicalDebtRatio: 0,
        duplication: 0
      };
    }

    const averageMaintainability = files.reduce((sum, file) => 
      sum + file.maintainability, 0) / files.length;

    // Calculate technical debt ratio based on issues
    const criticalIssues = issues.filter(i => i.severity === 'error').length;
    const totalIssues = issues.length;
    const debtRatio = totalIssues > 0 ? (criticalIssues / totalIssues) * 100 : 0;

    return {
      index: averageMaintainability,
      technicalDebtRatio: debtRatio,
      duplication: 0 // Would be calculated by duplication analyzer
    };
  }

  /**
   * Calculate overall quality metrics
   */
  private calculateQualityMetrics(
    complexity: ComplexityMetrics,
    maintainability: MaintainabilityMetrics,
    issues: QualityIssue[]
  ): QualityMetrics {
    // Count vulnerabilities (quality issues treated as vulnerabilities for consistency)
    const vulnerabilities = {
      critical: issues.filter(i => i.severity === 'error' && i.category === 'complexity').length,
      high: issues.filter(i => i.severity === 'error').length,
      medium: issues.filter(i => i.severity === 'warning').length,
      low: issues.filter(i => i.severity === 'info').length,
      info: 0
    };

    return {
      complexity: complexity.averageComplexity,
      maintainability: maintainability.index,
      technicalDebt: maintainability.technicalDebtRatio,
      duplication: maintainability.duplication,
      vulnerabilities
    };
  }

  /**
   * Generate findings from analysis
   */
  private generateFindings(
    analysis: QualityAnalysisResult,
    settings: QualityGateSettings
  ): GateFinding[] {
    const findings: GateFinding[] = [];

    // Convert quality issues to findings
    for (const issue of analysis.issues) {
      findings.push({
        severity: issue.severity,
        category: 'quality',
        message: `${issue.title}: ${issue.description}`,
        file: issue.filePath,
        line: issue.line,
        column: issue.column,
        rule: issue.rule
      });
    }

    // Check complexity thresholds
    if (analysis.complexity.averageComplexity > settings.maxComplexity) {
      findings.push({
        severity: 'warning',
        category: 'complexity',
        message: `Average complexity (${analysis.complexity.averageComplexity.toFixed(1)}) exceeds threshold (${settings.maxComplexity})`,
        rule: 'complexity-threshold'
      });
    }

    // Check maintainability threshold
    if (analysis.maintainability.index < settings.minMaintainabilityIndex) {
      findings.push({
        severity: 'warning',
        category: 'maintainability',
        message: `Maintainability index (${analysis.maintainability.index.toFixed(1)}) below threshold (${settings.minMaintainabilityIndex})`,
        rule: 'maintainability-threshold'
      });
    }

    // Check duplication threshold
    if (analysis.maintainability.duplication > settings.maxDuplication) {
      findings.push({
        severity: 'warning',
        category: 'duplication',
        message: `Code duplication (${analysis.maintainability.duplication.toFixed(1)}%) exceeds threshold (${settings.maxDuplication}%)`,
        rule: 'duplication-threshold'
      });
    }

    // Check file-level thresholds
    for (const [file, metrics] of analysis.fileMetrics) {
      if (metrics.linesOfCode > settings.maxLinesPerFile) {
        findings.push({
          severity: 'warning',
          category: 'size',
          message: `File too large: ${metrics.linesOfCode} lines (max: ${settings.maxLinesPerFile})`,
          file,
          rule: 'file-size-limit'
        });
      }

      if (metrics.complexity > settings.maxComplexity * 2) { // File-level threshold
        findings.push({
          severity: 'warning',
          category: 'complexity',
          message: `File complexity too high: ${metrics.complexity} (threshold: ${settings.maxComplexity * 2})`,
          file,
          rule: 'file-complexity-limit'
        });
      }
    }

    return findings;
  }

  /**
   * Determine gate status
   */
  private determineGateStatus(
    findings: GateFinding[],
    analysis: QualityAnalysisResult,
    settings: QualityGateSettings
  ): GateStatus {
    const errors = findings.filter(f => f.severity === 'error');
    
    // Quality gates typically don't block on warnings unless configured strictly
    if (errors.length > 0) {
      return GateStatus.FAILED;
    }

    // Check for critical thresholds
    if (analysis.complexity.averageComplexity > settings.maxComplexity * 2) {
      return GateStatus.FAILED;
    }

    if (analysis.maintainability.index < settings.minMaintainabilityIndex * 0.5) {
      return GateStatus.FAILED;
    }

    return GateStatus.PASSED;
  }

  /**
   * Generate summary message
   */
  private generateSummary(analysis: QualityAnalysisResult, status: GateStatus): string {
    const issueCount = analysis.issues.length;
    const avgComplexity = analysis.complexity.averageComplexity;
    const maintainability = analysis.maintainability.index;
    
    if (status === GateStatus.PASSED) {
      return `Quality gate passed. Found ${issueCount} issues. Average complexity: ${avgComplexity.toFixed(1)}, Maintainability: ${maintainability.toFixed(1)}/100.`;
    } else {
      return `Quality gate failed with ${issueCount} issues. Average complexity: ${avgComplexity.toFixed(1)}, Maintainability: ${maintainability.toFixed(1)}/100.`;
    }
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    analysis: QualityAnalysisResult,
    settings: QualityGateSettings
  ): string[] {
    const recommendations: string[] = [];

    if (analysis.complexity.averageComplexity > settings.maxComplexity) {
      recommendations.push('Reduce code complexity by breaking down large functions');
      recommendations.push('Consider extracting common logic into utility functions');
    }

    if (analysis.maintainability.index < settings.minMaintainabilityIndex) {
      recommendations.push('Improve code maintainability by adding documentation and reducing complexity');
      recommendations.push('Refactor large files and functions into smaller, focused components');
    }

    if (analysis.maintainability.technicalDebtRatio > 20) {
      recommendations.push('Address technical debt by fixing quality issues');
      recommendations.push('Implement regular code review practices');
    }

    const errorCount = analysis.issues.filter(i => i.severity === 'error').length;
    if (errorCount > 0) {
      recommendations.push(`Fix ${errorCount} critical quality issue(s)`);
    }

    const warningCount = analysis.issues.filter(i => i.severity === 'warning').length;
    if (warningCount > 10) {
      recommendations.push(`Consider addressing ${warningCount} quality warning(s)`);
      recommendations.push('Enable quality linters in your IDE and CI pipeline');
    }

    return recommendations;
  }

  /**
   * Generate report URLs
   */
  private generateReportUrls(context: GateExecutionContext): string[] {
    const urls: string[] = [];

    // Add quality report URL if available
    const reportPath = join(context.workingDirectory, '.arbiter', 'quality-report.html');
    urls.push(`file://${reportPath}`);

    return urls;
  }

  /**
   * Extract metrics for reporting
   */
  private extractMetrics(analysis: QualityAnalysisResult): Record<string, number> {
    return {
      'quality.complexity': analysis.complexity.averageComplexity,
      'quality.maintainability': analysis.maintainability.index,
      'quality.technicalDebt': analysis.maintainability.technicalDebtRatio,
      'quality.duplication': analysis.maintainability.duplication,
      'quality.linesOfCode': analysis.complexity.linesOfCode,
      'quality.issues.total': analysis.issues.length,
      'quality.issues.errors': analysis.issues.filter(i => i.severity === 'error').length,
      'quality.issues.warnings': analysis.issues.filter(i => i.severity === 'warning').length,
      'quality.issues.info': analysis.issues.filter(i => i.severity === 'info').length,
      'quality.filesAnalyzed': analysis.fileMetrics.size,
      'quality.averageFileComplexity': Array.from(analysis.fileMetrics.values())
        .reduce((sum, file) => sum + file.complexity, 0) / analysis.fileMetrics.size || 0
    };
  }

  /**
   * Map severity levels
   */
  private mapSeverity(severity: string | number): 'error' | 'warning' | 'info' {
    if (typeof severity === 'number') {
      if (severity >= 2) return 'error';
      if (severity >= 1) return 'warning';
      return 'info';
    }
    
    const lower = severity.toLowerCase();
    if (lower.includes('error') || lower.includes('critical')) return 'error';
    if (lower.includes('warn')) return 'warning';
    return 'info';
  }

  /**
   * Categorize rule by ID
   */
  private categorizeRule(ruleId: string): string {
    const categories: Record<string, string> = {
      'complexity': 'complexity',
      'cyclomatic': 'complexity',
      'max-len': 'style',
      'indent': 'style',
      'quotes': 'style',
      'semi': 'style',
      'no-unused': 'maintainability',
      'no-console': 'maintainability',
      'prefer-const': 'maintainability',
      'jsdoc': 'documentation'
    };

    for (const [key, category] of Object.entries(categories)) {
      if (ruleId.includes(key)) {
        return category;
      }
    }

    return 'quality';
  }

  /**
   * Find matches for a custom rule
   */
  private findRuleMatches(
    content: string,
    rule: QualityRule
  ): Array<{ line: number; column: number }> {
    const matches: Array<{ line: number; column: number }> = [];
    const lines = content.split('\n');
    const pattern = typeof rule.pattern === 'string' 
      ? new RegExp(rule.pattern, 'gi') 
      : rule.pattern;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineMatches = line.matchAll(pattern);

      for (const match of lineMatches) {
        matches.push({
          line: i + 1,
          column: match.index || 0
        });
      }
    }

    return matches;
  }

  /**
   * Check if file matches patterns
   */
  private matchesPatterns(file: string, patterns: string[]): boolean {
    return patterns.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
      return regex.test(file);
    });
  }

  /**
   * Check if file matches rule file types
   */
  private fileMatchesTypes(file: string, types: string[]): boolean {
    const ext = file.split('.').pop()?.toLowerCase() || '';
    return types.includes(ext) || types.includes('*');
  }

  /**
   * Validate and parse gate settings
   */
  private validateAndParseSettings(settings: any): QualityGateSettings {
    const defaults: QualityGateSettings = {
      maxComplexity: 15,
      minMaintainabilityIndex: 60,
      maxDuplication: 5,
      maxLinesPerFile: 500,
      maxLinesPerFunction: 50,
      maxNestingDepth: 5,
      maxParameters: 7,
      enforceStandards: true,
      analyzers: [
        {
          name: 'eslint',
          command: 'eslint --format json',
          outputFormat: 'json',
          timeout: 120000
        }
      ],
      includePatterns: ['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx'],
      excludePatterns: ['**/node_modules/**', '**/dist/**', '**/build/**'],
      differentialOnly: false,
      customRules: [],
      documentationRules: {
        requirePublicFunctionDocs: false,
        requirePublicClassDocs: false,
        requireReadmeFiles: false,
        minDocumentationCoverage: 0
      },
      styleRules: {
        enforceIndentation: true,
        enforceNamingConventions: true,
        enforceImportOrdering: false,
        enforceFormatting: true
      }
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
        summary: `Quality gate error: ${error.message}`,
        findings: [{
          severity: 'error',
          category: 'execution',
          message: error.message,
          rule: 'gate-execution'
        }],
        recommendations: ['Check quality analyzer configuration and ensure all tools are installed'],
        reportUrls: []
      },
      error: {
        code: 'QUALITY_ERROR',
        message: error.message,
        details: error.stack
      },
      metrics: {}
    };
  }
}