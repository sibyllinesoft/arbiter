/**
 * Security validation gate
 * Performs security analysis, vulnerability scanning, and policy validation
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, access } from 'fs/promises';
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

export interface SecurityGateSettings {
  /** Maximum allowed critical vulnerabilities */
  maxCriticalVulnerabilities: number;
  /** Maximum allowed high vulnerabilities */
  maxHighVulnerabilities: number;
  /** Maximum allowed medium vulnerabilities */
  maxMediumVulnerabilities: number;
  /** Scan dependencies for vulnerabilities */
  scanDependencies: boolean;
  /** Check for hardcoded secrets */
  checkSecrets: boolean;
  /** Perform static analysis security testing */
  performSAST: boolean;
  /** Check for common security anti-patterns */
  checkAntiPatterns: boolean;
  /** Security scanners to use */
  scanners: SecurityScanner[];
  /** Files to include in security scanning */
  includePatterns: string[];
  /** Files to exclude from security scanning */
  excludePatterns: string[];
  /** Only scan changed files */
  differentialOnly: boolean;
  /** Custom security rules */
  customRules: SecurityRule[];
  /** Allowed licenses for dependencies */
  allowedLicenses: string[];
  /** Blocked licenses for dependencies */
  blockedLicenses: string[];
}

export interface SecurityScanner {
  /** Scanner name */
  name: 'semgrep' | 'bandit' | 'eslint-security' | 'safety' | 'npm-audit' | 'snyk' | 'custom';
  /** Scanner command */
  command: string;
  /** Working directory */
  workingDir?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Configuration file path */
  configFile?: string;
  /** Output format */
  outputFormat: 'json' | 'sarif' | 'xml' | 'text';
  /** Timeout in milliseconds */
  timeout: number;
}

export interface SecurityRule {
  /** Rule ID */
  id: string;
  /** Rule name */
  name: string;
  /** Rule description */
  description: string;
  /** Rule severity */
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  /** Pattern to match */
  pattern: string | RegExp;
  /** File types to apply rule to */
  fileTypes: string[];
  /** Rule category */
  category: string;
}

export interface SecurityVulnerability {
  /** Vulnerability ID */
  id: string;
  /** Vulnerability title */
  title: string;
  /** Description */
  description: string;
  /** Severity level */
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  /** File path */
  filePath?: string;
  /** Line number */
  line?: number;
  /** Column number */
  column?: number;
  /** Rule that triggered this finding */
  rule: string;
  /** CWE (Common Weakness Enumeration) ID */
  cwe?: string;
  /** CVE (Common Vulnerabilities and Exposures) ID */
  cve?: string;
  /** CVSS score */
  cvssScore?: number;
  /** Confidence level */
  confidence: 'high' | 'medium' | 'low';
  /** Suggested fix */
  fix?: string;
  /** External references */
  references: string[];
}

export interface DependencyVulnerability {
  /** Package name */
  packageName: string;
  /** Package version */
  packageVersion: string;
  /** Vulnerability details */
  vulnerability: SecurityVulnerability;
  /** Fixed versions */
  fixedVersions: string[];
  /** Dependency path */
  dependencyPath: string[];
}

export interface SecretDetection {
  /** Secret type */
  type: 'api-key' | 'password' | 'token' | 'certificate' | 'private-key' | 'connection-string' | 'other';
  /** File path */
  filePath: string;
  /** Line number */
  line: number;
  /** Column number */
  column: number;
  /** Matched pattern */
  pattern: string;
  /** Confidence level */
  confidence: 'high' | 'medium' | 'low';
  /** Context around the match */
  context: string;
}

export interface SecurityAnalysisResult {
  /** Static analysis vulnerabilities */
  staticVulnerabilities: SecurityVulnerability[];
  /** Dependency vulnerabilities */
  dependencyVulnerabilities: DependencyVulnerability[];
  /** Detected secrets */
  secrets: SecretDetection[];
  /** License violations */
  licenseViolations: LicenseViolation[];
  /** Security metrics */
  metrics: SecurityMetrics;
  /** Scanner results */
  scannerResults: Map<string, ScannerResult>;
}

export interface LicenseViolation {
  /** Package name */
  packageName: string;
  /** Package version */
  packageVersion: string;
  /** License name */
  licenseName: string;
  /** Violation type */
  violationType: 'blocked' | 'unknown' | 'incompatible';
  /** Risk level */
  riskLevel: 'high' | 'medium' | 'low';
}

export interface SecurityMetrics {
  /** Total vulnerabilities by severity */
  vulnerabilities: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  /** Security score (0-100) */
  securityScore: number;
  /** Dependency security score */
  dependencySecurityScore: number;
  /** Secret detection score */
  secretDetectionScore: number;
  /** Compliance score */
  complianceScore: number;
}

export interface ScannerResult {
  /** Scanner name */
  scanner: string;
  /** Execution status */
  status: 'success' | 'failure' | 'timeout';
  /** Execution time */
  executionTime: number;
  /** Vulnerabilities found */
  vulnerabilities: SecurityVulnerability[];
  /** Error message if failed */
  error?: string;
  /** Raw output */
  rawOutput?: string;
}

/**
 * Security validation gate implementation
 */
export class SecurityGate implements GateExecutor {
  private readonly secretPatterns: Map<string, RegExp> = new Map([
    ['api-key', /(?:api[_-]?key|apikey)[^\w]*[:=][^\w]*[\'\"]?([a-zA-Z0-9_\-]{20,})/i],
    ['password', /(?:password|pwd|pass)[^\w]*[:=][^\w]*[\'\"]?([^\s\'\";]{8,})/i],
    ['token', /(?:token|jwt|bearer)[^\w]*[:=][^\w]*[\'\"]?([a-zA-Z0-9_\-\.]{20,})/i],
    ['private-key', /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/],
    ['certificate', /-----BEGIN\s+CERTIFICATE-----/],
    ['connection-string', /(?:connectionstring|connstr)[^\w]*[:=][^\w]*[\'\"]?([^\s\'\";]{20,})/i]
  ]);

  /**
   * Execute the security gate
   */
  async executeGate(
    gate: GateConfiguration,
    context: GateExecutionContext
  ): Promise<GateResult> {
    const startTime = new Date();
    const settings = this.validateAndParseSettings(gate.settings);

    try {
      // Perform security analysis
      const analysis = await this.performSecurityAnalysis(settings, context);

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
      const settings = config.settings as SecurityGateSettings;

      // Validate vulnerability thresholds
      if (typeof settings.maxCriticalVulnerabilities !== 'number' || settings.maxCriticalVulnerabilities < 0) {
        errors.push('maxCriticalVulnerabilities must be a non-negative number');
      }

      if (typeof settings.maxHighVulnerabilities !== 'number' || settings.maxHighVulnerabilities < 0) {
        errors.push('maxHighVulnerabilities must be a non-negative number');
      }

      if (typeof settings.maxMediumVulnerabilities !== 'number' || settings.maxMediumVulnerabilities < 0) {
        errors.push('maxMediumVulnerabilities must be a non-negative number');
      }

      // Validate boolean settings
      if (typeof settings.scanDependencies !== 'boolean') {
        errors.push('scanDependencies must be a boolean');
      }

      if (typeof settings.checkSecrets !== 'boolean') {
        errors.push('checkSecrets must be a boolean');
      }

      if (typeof settings.performSAST !== 'boolean') {
        errors.push('performSAST must be a boolean');
      }

      // Validate scanners
      if (!Array.isArray(settings.scanners)) {
        errors.push('scanners must be an array');
      } else {
        for (const scanner of settings.scanners) {
          if (!scanner.name || !scanner.command) {
            errors.push('Each scanner must have a name and command');
          }
          if (!scanner.outputFormat) {
            warnings.push(`Scanner ${scanner.name} should specify outputFormat`);
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
    const settings = gate.settings as SecurityGateSettings;

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
   * Perform comprehensive security analysis
   */
  private async performSecurityAnalysis(
    settings: SecurityGateSettings,
    context: GateExecutionContext
  ): Promise<SecurityAnalysisResult> {
    const results: Partial<SecurityAnalysisResult> = {
      staticVulnerabilities: [],
      dependencyVulnerabilities: [],
      secrets: [],
      licenseViolations: [],
      scannerResults: new Map()
    };

    // Run static analysis security testing
    if (settings.performSAST) {
      const sastResults = await this.performStaticAnalysis(settings, context);
      results.staticVulnerabilities = sastResults.staticVulnerabilities;
      for (const [scanner, result] of sastResults.scannerResults!) {
        results.scannerResults!.set(scanner, result);
      }
    }

    // Scan dependencies
    if (settings.scanDependencies) {
      results.dependencyVulnerabilities = await this.scanDependencies(settings, context);
      results.licenseViolations = await this.checkLicenses(settings, context);
    }

    // Check for secrets
    if (settings.checkSecrets) {
      results.secrets = await this.detectSecrets(settings, context);
    }

    // Calculate security metrics
    results.metrics = this.calculateSecurityMetrics(results as SecurityAnalysisResult);

    return results as SecurityAnalysisResult;
  }

  /**
   * Perform static analysis security testing
   */
  private async performStaticAnalysis(
    settings: SecurityGateSettings,
    context: GateExecutionContext
  ): Promise<Partial<SecurityAnalysisResult>> {
    const staticVulnerabilities: SecurityVulnerability[] = [];
    const scannerResults = new Map<string, ScannerResult>();

    // Run each configured scanner
    for (const scanner of settings.scanners) {
      try {
        const result = await this.runSecurityScanner(scanner, settings, context);
        scannerResults.set(scanner.name, result);
        staticVulnerabilities.push(...result.vulnerabilities);
      } catch (error) {
        scannerResults.set(scanner.name, {
          scanner: scanner.name,
          status: 'failure',
          executionTime: 0,
          vulnerabilities: [],
          error: (error as Error).message
        });
      }
    }

    // Apply custom rules
    if (settings.customRules.length > 0) {
      const customVulns = await this.applyCustomRules(settings, context);
      staticVulnerabilities.push(...customVulns);
    }

    return {
      staticVulnerabilities,
      scannerResults
    };
  }

  /**
   * Run a security scanner
   */
  private async runSecurityScanner(
    scanner: SecurityScanner,
    settings: SecurityGateSettings,
    context: GateExecutionContext
  ): Promise<ScannerResult> {
    const startTime = Date.now();
    const workingDir = scanner.workingDir || context.workingDirectory;
    const env = { ...process.env, ...scanner.env };

    try {
      // Build scanner command
      let command = scanner.command;
      if (scanner.configFile) {
        command += ` --config ${scanner.configFile}`;
      }

      // Add differential scanning if enabled
      if (settings.differentialOnly && context.changedFiles.length > 0) {
        const changedFiles = context.changedFiles.join(' ');
        command += ` ${changedFiles}`;
      }

      // Execute scanner
      const { stdout, stderr } = await execAsync(command, {
        cwd: workingDir,
        env,
        timeout: scanner.timeout
      });

      // Parse results based on output format
      const vulnerabilities = await this.parseScannerOutput(
        scanner,
        stdout,
        workingDir
      );

      return {
        scanner: scanner.name,
        status: 'success',
        executionTime: Date.now() - startTime,
        vulnerabilities,
        rawOutput: stdout
      };

    } catch (error) {
      return {
        scanner: scanner.name,
        status: 'failure',
        executionTime: Date.now() - startTime,
        vulnerabilities: [],
        error: (error as Error).message
      };
    }
  }

  /**
   * Parse scanner output based on format
   */
  private async parseScannerOutput(
    scanner: SecurityScanner,
    output: string,
    workingDir: string
  ): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];

    try {
      switch (scanner.outputFormat) {
        case 'json':
          vulnerabilities.push(...this.parseJsonScannerOutput(output, scanner.name));
          break;
        case 'sarif':
          vulnerabilities.push(...this.parseSarifOutput(output, scanner.name));
          break;
        case 'xml':
          vulnerabilities.push(...this.parseXmlScannerOutput(output, scanner.name));
          break;
        case 'text':
          vulnerabilities.push(...this.parseTextScannerOutput(output, scanner.name));
          break;
        default:
          throw new Error(`Unsupported scanner output format: ${scanner.outputFormat}`);
      }
    } catch (error) {
      // If parsing fails, create a generic vulnerability
      vulnerabilities.push({
        id: `${scanner.name}-parse-error`,
        title: 'Scanner Output Parse Error',
        description: `Failed to parse ${scanner.name} output: ${error}`,
        severity: 'medium',
        rule: 'scanner-parse-error',
        confidence: 'low',
        references: []
      });
    }

    return vulnerabilities;
  }

  /**
   * Parse JSON scanner output
   */
  private parseJsonScannerOutput(output: string, scannerName: string): SecurityVulnerability[] {
    const vulnerabilities: SecurityVulnerability[] = [];
    const data = JSON.parse(output);

    // Handle different JSON formats based on scanner
    if (scannerName === 'semgrep') {
      const results = data.results || [];
      for (const result of results) {
        vulnerabilities.push({
          id: result.check_id || 'unknown',
          title: result.message || 'Security issue detected',
          description: result.extra?.message || result.message || '',
          severity: this.mapSeverity(result.extra?.severity || 'medium'),
          filePath: result.path,
          line: result.start?.line,
          column: result.start?.col,
          rule: result.check_id || 'unknown',
          confidence: 'high',
          references: result.extra?.references || []
        });
      }
    } else {
      // Generic JSON parsing
      const issues = data.issues || data.results || data.vulnerabilities || [];
      for (const issue of issues) {
        vulnerabilities.push({
          id: issue.id || issue.ruleId || 'unknown',
          title: issue.title || issue.message || 'Security issue',
          description: issue.description || issue.message || '',
          severity: this.mapSeverity(issue.severity || 'medium'),
          filePath: issue.file || issue.path || issue.filename,
          line: issue.line || issue.lineNumber,
          column: issue.column || issue.columnNumber,
          rule: issue.rule || issue.ruleId || 'unknown',
          confidence: this.mapConfidence(issue.confidence || 'medium'),
          references: issue.references || []
        });
      }
    }

    return vulnerabilities;
  }

  /**
   * Parse SARIF output
   */
  private parseSarifOutput(output: string, scannerName: string): SecurityVulnerability[] {
    const vulnerabilities: SecurityVulnerability[] = [];
    const sarif = JSON.parse(output);

    const runs = sarif.runs || [];
    for (const run of runs) {
      const results = run.results || [];
      for (const result of results) {
        const ruleId = result.ruleId;
        const message = result.message?.text || 'Security issue detected';
        const locations = result.locations || [];

        for (const location of locations) {
          const physicalLocation = location.physicalLocation;
          if (physicalLocation) {
            vulnerabilities.push({
              id: ruleId || 'unknown',
              title: message,
              description: message,
              severity: this.mapSeverity(result.level || 'warning'),
              filePath: physicalLocation.artifactLocation?.uri,
              line: physicalLocation.region?.startLine,
              column: physicalLocation.region?.startColumn,
              rule: ruleId || 'unknown',
              confidence: 'high',
              references: []
            });
          }
        }
      }
    }

    return vulnerabilities;
  }

  /**
   * Parse XML scanner output
   */
  private parseXmlScannerOutput(output: string, scannerName: string): SecurityVulnerability[] {
    // For simplicity, return empty array
    // In production, you'd use an XML parser library
    return [];
  }

  /**
   * Parse text scanner output
   */
  private parseTextScannerOutput(output: string, scannerName: string): SecurityVulnerability[] {
    const vulnerabilities: SecurityVulnerability[] = [];
    const lines = output.split('\n');

    // Simple text parsing - this would be scanner-specific in production
    for (const line of lines) {
      if (line.toLowerCase().includes('vulnerability') || 
          line.toLowerCase().includes('security') ||
          line.toLowerCase().includes('warning')) {
        vulnerabilities.push({
          id: 'text-parsed-issue',
          title: line.trim(),
          description: line.trim(),
          severity: 'medium',
          rule: 'text-parser',
          confidence: 'low',
          references: []
        });
      }
    }

    return vulnerabilities;
  }

  /**
   * Apply custom security rules
   */
  private async applyCustomRules(
    settings: SecurityGateSettings,
    context: GateExecutionContext
  ): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const { glob } = await import('glob');

    // Get files to scan
    const filesToScan = await glob('**/*', {
      cwd: context.workingDirectory,
      ignore: settings.excludePatterns,
      nodir: true
    });

    for (const rule of settings.customRules) {
      for (const file of filesToScan) {
        // Check if file type matches rule
        if (!this.fileMatchesTypes(file, rule.fileTypes)) {
          continue;
        }

        try {
          const filePath = join(context.workingDirectory, file);
          const content = await readFile(filePath, 'utf-8');
          const matches = this.findRuleMatches(content, rule);

          for (const match of matches) {
            vulnerabilities.push({
              id: rule.id,
              title: rule.name,
              description: rule.description,
              severity: rule.severity,
              filePath: file,
              line: match.line,
              column: match.column,
              rule: rule.id,
              confidence: 'high',
              references: []
            });
          }
        } catch (error) {
          // Skip files that can't be read
        }
      }
    }

    return vulnerabilities;
  }

  /**
   * Find matches for a custom rule
   */
  private findRuleMatches(
    content: string,
    rule: SecurityRule
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
   * Scan dependencies for vulnerabilities
   */
  private async scanDependencies(
    settings: SecurityGateSettings,
    context: GateExecutionContext
  ): Promise<DependencyVulnerability[]> {
    const vulnerabilities: DependencyVulnerability[] = [];

    try {
      // Check for different package managers
      const packageFiles = [
        'package.json',
        'requirements.txt',
        'Pipfile',
        'composer.json',
        'pom.xml',
        'build.gradle'
      ];

      for (const packageFile of packageFiles) {
        const filePath = join(context.workingDirectory, packageFile);
        
        try {
          await access(filePath);
          const depVulns = await this.scanPackageFile(filePath, context);
          vulnerabilities.push(...depVulns);
        } catch (error) {
          // File doesn't exist, skip
        }
      }
    } catch (error) {
      // Error scanning dependencies
    }

    return vulnerabilities;
  }

  /**
   * Scan specific package file for vulnerabilities
   */
  private async scanPackageFile(
    filePath: string,
    context: GateExecutionContext
  ): Promise<DependencyVulnerability[]> {
    const vulnerabilities: DependencyVulnerability[] = [];

    // This would integrate with actual vulnerability databases
    // For now, return empty array
    return vulnerabilities;
  }

  /**
   * Check license compliance
   */
  private async checkLicenses(
    settings: SecurityGateSettings,
    context: GateExecutionContext
  ): Promise<LicenseViolation[]> {
    const violations: LicenseViolation[] = [];

    // This would scan package files and check licenses
    // For now, return empty array
    return violations;
  }

  /**
   * Detect hardcoded secrets
   */
  private async detectSecrets(
    settings: SecurityGateSettings,
    context: GateExecutionContext
  ): Promise<SecretDetection[]> {
    const secrets: SecretDetection[] = [];
    const { glob } = await import('glob');

    // Get files to scan
    const filesToScan = await glob('**/*', {
      cwd: context.workingDirectory,
      ignore: settings.excludePatterns,
      nodir: true
    });

    for (const file of filesToScan) {
      if (!this.matchesPatterns(file, settings.includePatterns)) {
        continue;
      }

      try {
        const filePath = join(context.workingDirectory, file);
        const content = await readFile(filePath, 'utf-8');
        const fileSecrets = this.scanFileForSecrets(file, content);
        secrets.push(...fileSecrets);
      } catch (error) {
        // Skip files that can't be read
      }
    }

    return secrets;
  }

  /**
   * Scan file content for secrets
   */
  private scanFileForSecrets(filePath: string, content: string): SecretDetection[] {
    const secrets: SecretDetection[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      for (const [secretType, pattern] of this.secretPatterns) {
        const matches = line.matchAll(new RegExp(pattern, 'gi'));
        
        for (const match of matches) {
          secrets.push({
            type: secretType as any,
            filePath,
            line: lineNumber,
            column: match.index || 0,
            pattern: pattern.source,
            confidence: this.calculateSecretConfidence(secretType, match[0]),
            context: line.trim()
          });
        }
      }
    }

    return secrets;
  }

  /**
   * Calculate confidence for secret detection
   */
  private calculateSecretConfidence(
    secretType: string,
    match: string
  ): 'high' | 'medium' | 'low' {
    // Basic heuristics for confidence
    if (secretType === 'private-key' || secretType === 'certificate') {
      return 'high';
    }
    
    if (match.length > 30) {
      return 'high';
    } else if (match.length > 20) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Calculate security metrics
   */
  private calculateSecurityMetrics(analysis: SecurityAnalysisResult): SecurityMetrics {
    const vulnerabilities = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0
    };

    // Count static vulnerabilities
    for (const vuln of analysis.staticVulnerabilities) {
      vulnerabilities[vuln.severity]++;
    }

    // Count dependency vulnerabilities
    for (const depVuln of analysis.dependencyVulnerabilities) {
      vulnerabilities[depVuln.vulnerability.severity]++;
    }

    // Calculate security score
    const totalVulns = Object.values(vulnerabilities).reduce((sum, count) => sum + count, 0);
    const weightedScore = 
      vulnerabilities.critical * 10 +
      vulnerabilities.high * 5 +
      vulnerabilities.medium * 2 +
      vulnerabilities.low * 1;

    const securityScore = Math.max(0, 100 - weightedScore);

    // Calculate dependency security score
    const depScore = analysis.dependencyVulnerabilities.length === 0 ? 100 : 
      Math.max(0, 100 - analysis.dependencyVulnerabilities.length * 5);

    // Calculate secret detection score
    const secretScore = analysis.secrets.length === 0 ? 100 :
      Math.max(0, 100 - analysis.secrets.length * 10);

    // Calculate compliance score
    const complianceScore = analysis.licenseViolations.length === 0 ? 100 :
      Math.max(0, 100 - analysis.licenseViolations.length * 15);

    return {
      vulnerabilities,
      securityScore,
      dependencySecurityScore: depScore,
      secretDetectionScore: secretScore,
      complianceScore
    };
  }

  /**
   * Generate findings from analysis
   */
  private generateFindings(
    analysis: SecurityAnalysisResult,
    settings: SecurityGateSettings
  ): GateFinding[] {
    const findings: GateFinding[] = [];

    // Add findings for static vulnerabilities
    for (const vuln of analysis.staticVulnerabilities) {
      findings.push({
        severity: vuln.severity === 'critical' || vuln.severity === 'high' ? 'error' : 'warning',
        category: 'security',
        message: `${vuln.title}: ${vuln.description}`,
        file: vuln.filePath,
        line: vuln.line,
        column: vuln.column,
        rule: vuln.rule
      });
    }

    // Add findings for dependency vulnerabilities
    for (const depVuln of analysis.dependencyVulnerabilities) {
      findings.push({
        severity: depVuln.vulnerability.severity === 'critical' || 
                 depVuln.vulnerability.severity === 'high' ? 'error' : 'warning',
        category: 'dependency-security',
        message: `Vulnerable dependency: ${depVuln.packageName}@${depVuln.packageVersion} - ${depVuln.vulnerability.title}`,
        rule: 'vulnerable-dependency'
      });
    }

    // Add findings for secrets
    for (const secret of analysis.secrets) {
      findings.push({
        severity: 'error',
        category: 'secrets',
        message: `Potential ${secret.type} detected`,
        file: secret.filePath,
        line: secret.line,
        column: secret.column,
        rule: 'hardcoded-secret'
      });
    }

    // Add findings for license violations
    for (const violation of analysis.licenseViolations) {
      findings.push({
        severity: violation.riskLevel === 'high' ? 'error' : 'warning',
        category: 'license',
        message: `License violation: ${violation.packageName}@${violation.packageVersion} uses ${violation.licenseName} license`,
        rule: 'license-violation'
      });
    }

    // Check thresholds
    const { vulnerabilities } = analysis.metrics;
    
    if (vulnerabilities.critical > settings.maxCriticalVulnerabilities) {
      findings.push({
        severity: 'error',
        category: 'security',
        message: `Too many critical vulnerabilities: ${vulnerabilities.critical} (max: ${settings.maxCriticalVulnerabilities})`,
        rule: 'critical-vulnerability-threshold'
      });
    }

    if (vulnerabilities.high > settings.maxHighVulnerabilities) {
      findings.push({
        severity: 'error',
        category: 'security',
        message: `Too many high vulnerabilities: ${vulnerabilities.high} (max: ${settings.maxHighVulnerabilities})`,
        rule: 'high-vulnerability-threshold'
      });
    }

    if (vulnerabilities.medium > settings.maxMediumVulnerabilities) {
      findings.push({
        severity: 'warning',
        category: 'security',
        message: `Many medium vulnerabilities: ${vulnerabilities.medium} (max: ${settings.maxMediumVulnerabilities})`,
        rule: 'medium-vulnerability-threshold'
      });
    }

    return findings;
  }

  /**
   * Determine gate status
   */
  private determineGateStatus(
    findings: GateFinding[],
    analysis: SecurityAnalysisResult,
    settings: SecurityGateSettings
  ): GateStatus {
    const errors = findings.filter(f => f.severity === 'error');
    return errors.length === 0 ? GateStatus.PASSED : GateStatus.FAILED;
  }

  /**
   * Generate summary message
   */
  private generateSummary(analysis: SecurityAnalysisResult, status: GateStatus): string {
    const { vulnerabilities } = analysis.metrics;
    const totalVulns = Object.values(vulnerabilities).reduce((sum, count) => sum + count, 0);
    
    if (status === GateStatus.PASSED) {
      return `Security validation passed. Security score: ${analysis.metrics.securityScore}/100. Found ${totalVulns} total vulnerabilities (Critical: ${vulnerabilities.critical}, High: ${vulnerabilities.high}).`;
    } else {
      const secretCount = analysis.secrets.length;
      return `Security validation failed. Found ${totalVulns} vulnerabilities and ${secretCount} potential secrets. Critical: ${vulnerabilities.critical}, High: ${vulnerabilities.high}.`;
    }
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    analysis: SecurityAnalysisResult,
    settings: SecurityGateSettings
  ): string[] {
    const recommendations: string[] = [];

    if (analysis.metrics.vulnerabilities.critical > 0) {
      recommendations.push('Address all critical security vulnerabilities immediately');
    }

    if (analysis.metrics.vulnerabilities.high > 0) {
      recommendations.push('Fix high-severity security vulnerabilities as soon as possible');
    }

    if (analysis.secrets.length > 0) {
      recommendations.push('Remove hardcoded secrets and use secure secret management');
      recommendations.push('Rotate any exposed credentials');
    }

    if (analysis.dependencyVulnerabilities.length > 0) {
      recommendations.push('Update vulnerable dependencies to secure versions');
      recommendations.push('Consider using dependency scanning tools in CI/CD pipeline');
    }

    if (analysis.licenseViolations.length > 0) {
      recommendations.push('Review and resolve license compliance issues');
      recommendations.push('Implement license scanning in your build process');
    }

    if (analysis.metrics.securityScore < 80) {
      recommendations.push('Implement security linting in your IDE and CI/CD pipeline');
      recommendations.push('Conduct regular security reviews and threat modeling');
    }

    return recommendations;
  }

  /**
   * Generate report URLs
   */
  private generateReportUrls(context: GateExecutionContext): string[] {
    const urls: string[] = [];

    // Add security report URL if available
    const reportPath = join(context.workingDirectory, '.arbiter', 'security-report.html');
    urls.push(`file://${reportPath}`);

    return urls;
  }

  /**
   * Extract metrics for reporting
   */
  private extractMetrics(analysis: SecurityAnalysisResult): Record<string, number> {
    const { metrics } = analysis;

    return {
      'security.score': metrics.securityScore,
      'security.vulnerabilities.critical': metrics.vulnerabilities.critical,
      'security.vulnerabilities.high': metrics.vulnerabilities.high,
      'security.vulnerabilities.medium': metrics.vulnerabilities.medium,
      'security.vulnerabilities.low': metrics.vulnerabilities.low,
      'security.vulnerabilities.total': Object.values(metrics.vulnerabilities).reduce((sum, count) => sum + count, 0),
      'security.dependencyScore': metrics.dependencySecurityScore,
      'security.secretScore': metrics.secretDetectionScore,
      'security.complianceScore': metrics.complianceScore,
      'security.secrets': analysis.secrets.length,
      'security.dependencyVulnerabilities': analysis.dependencyVulnerabilities.length,
      'security.licenseViolations': analysis.licenseViolations.length
    };
  }

  /**
   * Map severity levels
   */
  private mapSeverity(severity: string): 'critical' | 'high' | 'medium' | 'low' | 'info' {
    const lower = severity.toLowerCase();
    if (lower.includes('critical') || lower.includes('error')) return 'critical';
    if (lower.includes('high')) return 'high';
    if (lower.includes('medium') || lower.includes('warning') || lower.includes('warn')) return 'medium';
    if (lower.includes('low')) return 'low';
    return 'info';
  }

  /**
   * Map confidence levels
   */
  private mapConfidence(confidence: string): 'high' | 'medium' | 'low' {
    const lower = confidence.toLowerCase();
    if (lower.includes('high')) return 'high';
    if (lower.includes('medium')) return 'medium';
    return 'low';
  }

  /**
   * Check if file matches any pattern
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
  private validateAndParseSettings(settings: any): SecurityGateSettings {
    const defaults: SecurityGateSettings = {
      maxCriticalVulnerabilities: 0,
      maxHighVulnerabilities: 2,
      maxMediumVulnerabilities: 10,
      scanDependencies: true,
      checkSecrets: true,
      performSAST: true,
      checkAntiPatterns: true,
      scanners: [
        {
          name: 'semgrep',
          command: 'semgrep --config=auto --json',
          outputFormat: 'json',
          timeout: 300000
        }
      ],
      includePatterns: ['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx', '**/*.py', '**/*.java', '**/*.go'],
      excludePatterns: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
      differentialOnly: false,
      customRules: [],
      allowedLicenses: ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'ISC'],
      blockedLicenses: ['GPL-2.0', 'GPL-3.0', 'AGPL-3.0']
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
        summary: `Security gate error: ${error.message}`,
        findings: [{
          severity: 'error',
          category: 'execution',
          message: error.message,
          rule: 'gate-execution'
        }],
        recommendations: ['Check security scanner configuration and ensure all tools are installed'],
        reportUrls: []
      },
      error: {
        code: 'SECURITY_ERROR',
        message: error.message,
        details: error.stack
      },
      metrics: {}
    };
  }
}