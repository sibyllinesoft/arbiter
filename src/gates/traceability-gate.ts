/**
 * Traceability validation gate
 * Ensures complete REQ→SCENARIO→TEST→CODE traceability and validates links
 */

import { join } from 'path';
import { readFile, readdir } from 'fs/promises';
import {
  GateExecutor,
  GateConfiguration,
  GateExecutionContext,
  GateResult,
  GateStatus,
  GateFinding,
  ValidationResult,
  TraceabilityMetrics
} from './types.js';

export interface TraceabilityGateSettings {
  /** Minimum percentage of requirements with scenarios */
  requirementCoverageThreshold: number;
  /** Minimum percentage of scenarios with tests */
  scenarioCoverageThreshold: number;
  /** Minimum percentage of tests with implementations */
  implementationCoverageThreshold: number;
  /** Allow orphaned artifacts */
  allowOrphanedArtifacts: boolean;
  /** Maximum allowed broken links */
  maxBrokenLinks: number;
  /** Only validate traceability for changed files */
  differentialOnly: boolean;
  /** Requirement file patterns */
  requirementPatterns: string[];
  /** Scenario file patterns */
  scenarioPatterns: string[];
  /** Test file patterns */
  testPatterns: string[];
  /** Implementation file patterns */
  implementationPatterns: string[];
  /** Traceability annotation patterns */
  annotationPatterns: TraceabilityAnnotationPatterns;
  /** Fail gate if no traceability data found */
  failOnNoTraceability: boolean;
}

export interface TraceabilityAnnotationPatterns {
  /** Pattern for requirement IDs in comments */
  requirementId: RegExp;
  /** Pattern for scenario IDs in comments */
  scenarioId: RegExp;
  /** Pattern for test IDs in comments */
  testId: RegExp;
  /** Pattern for implementation references */
  implementationRef: RegExp;
  /** Pattern for traceability links */
  traceabilityLink: RegExp;
}

export interface TraceabilityArtifact {
  /** Unique identifier */
  id: string;
  /** Artifact type */
  type: 'requirement' | 'scenario' | 'test' | 'implementation';
  /** File path */
  filePath: string;
  /** Line number */
  line?: number;
  /** Column number */
  column?: number;
  /** Title or name */
  title: string;
  /** Description */
  description?: string;
  /** Links to other artifacts */
  links: TraceabilityLink[];
  /** Tags or labels */
  tags: string[];
  /** Status */
  status: 'active' | 'deprecated' | 'draft';
}

export interface TraceabilityLink {
  /** Target artifact ID */
  targetId: string;
  /** Link type */
  type: 'covers' | 'implements' | 'tests' | 'traces-to' | 'depends-on';
  /** Link strength */
  strength: 'strong' | 'weak' | 'inferred';
  /** Source file path */
  sourceFile: string;
  /** Source line number */
  sourceLine?: number;
}

export interface TraceabilityChain {
  /** Requirement artifact */
  requirement?: TraceabilityArtifact;
  /** Scenario artifacts */
  scenarios: TraceabilityArtifact[];
  /** Test artifacts */
  tests: TraceabilityArtifact[];
  /** Implementation artifacts */
  implementations: TraceabilityArtifact[];
  /** Chain completeness score */
  completeness: number;
  /** Chain quality score */
  quality: number;
}

export interface TraceabilityGap {
  /** Gap type */
  type: 'missing-scenario' | 'missing-test' | 'missing-implementation' | 'broken-link' | 'orphaned-artifact';
  /** Affected artifact */
  artifact: TraceabilityArtifact;
  /** Gap description */
  description: string;
  /** Severity level */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** Suggested actions */
  suggestions: string[];
}

export interface TraceabilityAnalysis {
  /** All discovered artifacts */
  artifacts: Map<string, TraceabilityArtifact>;
  /** Complete traceability chains */
  chains: TraceabilityChain[];
  /** Traceability gaps */
  gaps: TraceabilityGap[];
  /** Overall metrics */
  metrics: TraceabilityMetrics;
  /** Link validation results */
  linkValidation: LinkValidationResult[];
}

export interface LinkValidationResult {
  /** Source link */
  link: TraceabilityLink;
  /** Validation status */
  valid: boolean;
  /** Error message if invalid */
  error?: string;
  /** Target artifact found */
  targetFound: boolean;
}

/**
 * Traceability validation gate implementation
 */
export class TraceabilityGate implements GateExecutor {
  /**
   * Execute the traceability gate
   */
  async executeGate(
    gate: GateConfiguration,
    context: GateExecutionContext
  ): Promise<GateResult> {
    const startTime = new Date();
    const settings = this.validateAndParseSettings(gate.settings);

    try {
      // Discover traceability artifacts
      const artifacts = await this.discoverArtifacts(settings, context);

      if (artifacts.size === 0) {
        if (settings.failOnNoTraceability) {
          throw new Error('No traceability artifacts found');
        } else {
          return this.createSkippedResult(gate, startTime, 'No traceability artifacts found');
        }
      }

      // Analyze traceability
      const analysis = await this.analyzeTraceability(artifacts, settings, context);

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
      const settings = config.settings as TraceabilityGateSettings;

      // Validate thresholds
      if (typeof settings.requirementCoverageThreshold !== 'number' || 
          settings.requirementCoverageThreshold < 0 || 
          settings.requirementCoverageThreshold > 100) {
        errors.push('requirementCoverageThreshold must be a number between 0 and 100');
      }

      if (typeof settings.scenarioCoverageThreshold !== 'number' || 
          settings.scenarioCoverageThreshold < 0 || 
          settings.scenarioCoverageThreshold > 100) {
        errors.push('scenarioCoverageThreshold must be a number between 0 and 100');
      }

      if (typeof settings.implementationCoverageThreshold !== 'number' || 
          settings.implementationCoverageThreshold < 0 || 
          settings.implementationCoverageThreshold > 100) {
        errors.push('implementationCoverageThreshold must be a number between 0 and 100');
      }

      // Validate patterns
      if (!Array.isArray(settings.requirementPatterns)) {
        errors.push('requirementPatterns must be an array of glob patterns');
      }

      if (!Array.isArray(settings.scenarioPatterns)) {
        errors.push('scenarioPatterns must be an array of glob patterns');
      }

      if (!Array.isArray(settings.testPatterns)) {
        errors.push('testPatterns must be an array of glob patterns');
      }

      if (!Array.isArray(settings.implementationPatterns)) {
        errors.push('implementationPatterns must be an array of glob patterns');
      }

      // Validate broken links threshold
      if (typeof settings.maxBrokenLinks !== 'number' || settings.maxBrokenLinks < 0) {
        errors.push('maxBrokenLinks must be a non-negative number');
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
    const settings = gate.settings as TraceabilityGateSettings;

    // Skip if no relevant files changed and differential mode is enabled
    if (settings.differentialOnly) {
      const hasRelevantChanges = context.changedFiles.some(file =>
        this.matchesAnyPattern(file, [
          ...settings.requirementPatterns,
          ...settings.scenarioPatterns,
          ...settings.testPatterns,
          ...settings.implementationPatterns
        ])
      );

      if (!hasRelevantChanges) {
        return true;
      }
    }

    return false;
  }

  /**
   * Discover traceability artifacts
   */
  private async discoverArtifacts(
    settings: TraceabilityGateSettings,
    context: GateExecutionContext
  ): Promise<Map<string, TraceabilityArtifact>> {
    const artifacts = new Map<string, TraceabilityArtifact>();

    // Discover requirements
    const requirements = await this.discoverArtifactsByType(
      'requirement',
      settings.requirementPatterns,
      settings,
      context
    );
    for (const req of requirements) {
      artifacts.set(req.id, req);
    }

    // Discover scenarios
    const scenarios = await this.discoverArtifactsByType(
      'scenario',
      settings.scenarioPatterns,
      settings,
      context
    );
    for (const scenario of scenarios) {
      artifacts.set(scenario.id, scenario);
    }

    // Discover tests
    const tests = await this.discoverArtifactsByType(
      'test',
      settings.testPatterns,
      settings,
      context
    );
    for (const test of tests) {
      artifacts.set(test.id, test);
    }

    // Discover implementations
    const implementations = await this.discoverArtifactsByType(
      'implementation',
      settings.implementationPatterns,
      settings,
      context
    );
    for (const impl of implementations) {
      artifacts.set(impl.id, impl);
    }

    return artifacts;
  }

  /**
   * Discover artifacts by type
   */
  private async discoverArtifactsByType(
    type: TraceabilityArtifact['type'],
    patterns: string[],
    settings: TraceabilityGateSettings,
    context: GateExecutionContext
  ): Promise<TraceabilityArtifact[]> {
    const artifacts: TraceabilityArtifact[] = [];
    const { glob } = await import('glob');

    for (const pattern of patterns) {
      const files = await glob(pattern, {
        cwd: context.workingDirectory
      });

      for (const file of files) {
        const filePath = join(context.workingDirectory, file);
        const fileArtifacts = await this.extractArtifactsFromFile(
          filePath,
          type,
          settings
        );
        artifacts.push(...fileArtifacts);
      }
    }

    return artifacts;
  }

  /**
   * Extract artifacts from a file
   */
  private async extractArtifactsFromFile(
    filePath: string,
    type: TraceabilityArtifact['type'],
    settings: TraceabilityGateSettings
  ): Promise<TraceabilityArtifact[]> {
    const artifacts: TraceabilityArtifact[] = [];

    try {
      const content = await readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNumber = i + 1;

        // Extract artifacts based on type and patterns
        const extractedArtifacts = this.extractArtifactsFromLine(
          line,
          lineNumber,
          filePath,
          type,
          settings
        );
        artifacts.push(...extractedArtifacts);
      }
    } catch (error) {
      // File might not be accessible, skip it
    }

    return artifacts;
  }

  /**
   * Extract artifacts from a single line
   */
  private extractArtifactsFromLine(
    line: string,
    lineNumber: number,
    filePath: string,
    type: TraceabilityArtifact['type'],
    settings: TraceabilityGateSettings
  ): TraceabilityArtifact[] {
    const artifacts: TraceabilityArtifact[] = [];
    const patterns = settings.annotationPatterns;

    // Extract based on artifact type
    switch (type) {
      case 'requirement': {
        const match = line.match(patterns.requirementId);
        if (match) {
          artifacts.push(this.createArtifact(
            match[1],
            type,
            filePath,
            lineNumber,
            line.trim(),
            line,
            patterns
          ));
        }
        break;
      }
      case 'scenario': {
        const match = line.match(patterns.scenarioId);
        if (match) {
          artifacts.push(this.createArtifact(
            match[1],
            type,
            filePath,
            lineNumber,
            line.trim(),
            line,
            patterns
          ));
        }
        break;
      }
      case 'test': {
        const match = line.match(patterns.testId);
        if (match) {
          artifacts.push(this.createArtifact(
            match[1],
            type,
            filePath,
            lineNumber,
            line.trim(),
            line,
            patterns
          ));
        }
        break;
      }
      case 'implementation': {
        const match = line.match(patterns.implementationRef);
        if (match) {
          artifacts.push(this.createArtifact(
            match[1],
            type,
            filePath,
            lineNumber,
            line.trim(),
            line,
            patterns
          ));
        }
        break;
      }
    }

    return artifacts;
  }

  /**
   * Create artifact from extracted information
   */
  private createArtifact(
    id: string,
    type: TraceabilityArtifact['type'],
    filePath: string,
    line: number,
    title: string,
    content: string,
    patterns: TraceabilityAnnotationPatterns
  ): TraceabilityArtifact {
    // Extract links from content
    const links = this.extractLinks(content, filePath, line, patterns);

    // Extract tags
    const tags = this.extractTags(content);

    return {
      id,
      type,
      filePath,
      line,
      title,
      links,
      tags,
      status: 'active'
    };
  }

  /**
   * Extract traceability links from content
   */
  private extractLinks(
    content: string,
    filePath: string,
    line: number,
    patterns: TraceabilityAnnotationPatterns
  ): TraceabilityLink[] {
    const links: TraceabilityLink[] = [];
    
    const linkMatches = content.matchAll(patterns.traceabilityLink);
    for (const match of linkMatches) {
      if (match.groups) {
        links.push({
          targetId: match.groups.targetId,
          type: (match.groups.type as any) || 'traces-to',
          strength: 'strong',
          sourceFile: filePath,
          sourceLine: line
        });
      }
    }

    return links;
  }

  /**
   * Extract tags from content
   */
  private extractTags(content: string): string[] {
    const tags: string[] = [];
    const tagPattern = /#(\w+)/g;
    
    const tagMatches = content.matchAll(tagPattern);
    for (const match of tagMatches) {
      tags.push(match[1]);
    }

    return tags;
  }

  /**
   * Analyze traceability
   */
  private async analyzeTraceability(
    artifacts: Map<string, TraceabilityArtifact>,
    settings: TraceabilityGateSettings,
    context: GateExecutionContext
  ): Promise<TraceabilityAnalysis> {
    // Build traceability chains
    const chains = this.buildTraceabilityChains(artifacts);

    // Identify gaps
    const gaps = this.identifyTraceabilityGaps(artifacts, chains, settings);

    // Validate links
    const linkValidation = this.validateLinks(artifacts);

    // Calculate metrics
    const metrics = this.calculateTraceabilityMetrics(artifacts, chains, gaps);

    return {
      artifacts,
      chains,
      gaps,
      metrics,
      linkValidation
    };
  }

  /**
   * Build traceability chains
   */
  private buildTraceabilityChains(
    artifacts: Map<string, TraceabilityArtifact>
  ): TraceabilityChain[] {
    const chains: TraceabilityChain[] = [];
    const requirements = Array.from(artifacts.values()).filter(a => a.type === 'requirement');

    for (const requirement of requirements) {
      const chain = this.buildChainFromRequirement(requirement, artifacts);
      chains.push(chain);
    }

    // Add chains for orphaned scenarios, tests, and implementations
    const linkedArtifacts = new Set<string>();
    chains.forEach(chain => {
      linkedArtifacts.add(chain.requirement?.id || '');
      chain.scenarios.forEach(s => linkedArtifacts.add(s.id));
      chain.tests.forEach(t => linkedArtifacts.add(t.id));
      chain.implementations.forEach(i => linkedArtifacts.add(i.id));
    });

    const orphanedArtifacts = Array.from(artifacts.values()).filter(a => 
      !linkedArtifacts.has(a.id) && a.type !== 'requirement'
    );

    for (const orphan of orphanedArtifacts) {
      chains.push({
        scenarios: orphan.type === 'scenario' ? [orphan] : [],
        tests: orphan.type === 'test' ? [orphan] : [],
        implementations: orphan.type === 'implementation' ? [orphan] : [],
        completeness: 0.25, // Partial chain
        quality: 0.5 // Lower quality due to orphaned status
      });
    }

    return chains;
  }

  /**
   * Build chain from requirement
   */
  private buildChainFromRequirement(
    requirement: TraceabilityArtifact,
    artifacts: Map<string, TraceabilityArtifact>
  ): TraceabilityChain {
    const scenarios: TraceabilityArtifact[] = [];
    const tests: TraceabilityArtifact[] = [];
    const implementations: TraceabilityArtifact[] = [];

    // Find linked scenarios
    const scenarioLinks = requirement.links.filter(l => 
      l.type === 'covers' && artifacts.has(l.targetId) && 
      artifacts.get(l.targetId)?.type === 'scenario'
    );

    for (const link of scenarioLinks) {
      const scenario = artifacts.get(link.targetId)!;
      scenarios.push(scenario);

      // Find tests for this scenario
      const testLinks = scenario.links.filter(l => 
        l.type === 'tests' && artifacts.has(l.targetId) &&
        artifacts.get(l.targetId)?.type === 'test'
      );

      for (const testLink of testLinks) {
        const test = artifacts.get(testLink.targetId)!;
        tests.push(test);

        // Find implementations for this test
        const implLinks = test.links.filter(l => 
          l.type === 'implements' && artifacts.has(l.targetId) &&
          artifacts.get(l.targetId)?.type === 'implementation'
        );

        for (const implLink of implLinks) {
          const impl = artifacts.get(implLink.targetId)!;
          implementations.push(impl);
        }
      }
    }

    // Calculate completeness and quality
    const completeness = this.calculateChainCompleteness(scenarios, tests, implementations);
    const quality = this.calculateChainQuality(requirement, scenarios, tests, implementations);

    return {
      requirement,
      scenarios,
      tests,
      implementations,
      completeness,
      quality
    };
  }

  /**
   * Calculate chain completeness
   */
  private calculateChainCompleteness(
    scenarios: TraceabilityArtifact[],
    tests: TraceabilityArtifact[],
    implementations: TraceabilityArtifact[]
  ): number {
    let score = 0;
    
    if (scenarios.length > 0) score += 0.25;
    if (tests.length > 0) score += 0.25;
    if (implementations.length > 0) score += 0.25;
    
    // Bonus for full chain
    if (scenarios.length > 0 && tests.length > 0 && implementations.length > 0) {
      score += 0.25;
    }

    return score;
  }

  /**
   * Calculate chain quality
   */
  private calculateChainQuality(
    requirement: TraceabilityArtifact,
    scenarios: TraceabilityArtifact[],
    tests: TraceabilityArtifact[],
    implementations: TraceabilityArtifact[]
  ): number {
    let score = 0.5; // Base score
    
    // Quality factors
    if (scenarios.length >= 2) score += 0.1; // Multiple scenarios
    if (tests.length >= scenarios.length) score += 0.1; // Good test coverage
    if (implementations.length >= tests.length) score += 0.1; // Good implementation coverage
    
    // Link quality
    const totalLinks = requirement.links.length + 
      scenarios.reduce((sum, s) => sum + s.links.length, 0) +
      tests.reduce((sum, t) => sum + t.links.length, 0) +
      implementations.reduce((sum, i) => sum + i.links.length, 0);
    
    if (totalLinks >= 3) score += 0.1; // Well-linked
    if (totalLinks >= 6) score += 0.1; // Heavily linked

    return Math.min(score, 1.0);
  }

  /**
   * Identify traceability gaps
   */
  private identifyTraceabilityGaps(
    artifacts: Map<string, TraceabilityArtifact>,
    chains: TraceabilityChain[],
    settings: TraceabilityGateSettings
  ): TraceabilityGap[] {
    const gaps: TraceabilityGap[] = [];

    for (const chain of chains) {
      // Check for missing scenarios
      if (chain.requirement && chain.scenarios.length === 0) {
        gaps.push({
          type: 'missing-scenario',
          artifact: chain.requirement,
          description: 'Requirement has no associated scenarios',
          severity: 'high',
          suggestions: ['Create scenarios that cover this requirement']
        });
      }

      // Check for missing tests
      if (chain.scenarios.length > 0 && chain.tests.length === 0) {
        for (const scenario of chain.scenarios) {
          gaps.push({
            type: 'missing-test',
            artifact: scenario,
            description: 'Scenario has no associated tests',
            severity: 'high',
            suggestions: ['Create tests that validate this scenario']
          });
        }
      }

      // Check for missing implementations
      if (chain.tests.length > 0 && chain.implementations.length === 0) {
        for (const test of chain.tests) {
          gaps.push({
            type: 'missing-implementation',
            artifact: test,
            description: 'Test has no associated implementation',
            severity: 'medium',
            suggestions: ['Implement the functionality tested by this test']
          });
        }
      }
    }

    // Check for orphaned artifacts
    if (!settings.allowOrphanedArtifacts) {
      const orphanedArtifacts = this.findOrphanedArtifacts(artifacts, chains);
      for (const artifact of orphanedArtifacts) {
        gaps.push({
          type: 'orphaned-artifact',
          artifact,
          description: `${artifact.type} is not linked to any traceability chain`,
          severity: 'medium',
          suggestions: [`Link this ${artifact.type} to appropriate artifacts in the traceability chain`]
        });
      }
    }

    return gaps;
  }

  /**
   * Find orphaned artifacts
   */
  private findOrphanedArtifacts(
    artifacts: Map<string, TraceabilityArtifact>,
    chains: TraceabilityChain[]
  ): TraceabilityArtifact[] {
    const linkedArtifacts = new Set<string>();
    
    chains.forEach(chain => {
      if (chain.requirement) linkedArtifacts.add(chain.requirement.id);
      chain.scenarios.forEach(s => linkedArtifacts.add(s.id));
      chain.tests.forEach(t => linkedArtifacts.add(t.id));
      chain.implementations.forEach(i => linkedArtifacts.add(i.id));
    });

    return Array.from(artifacts.values()).filter(a => !linkedArtifacts.has(a.id));
  }

  /**
   * Validate traceability links
   */
  private validateLinks(
    artifacts: Map<string, TraceabilityArtifact>
  ): LinkValidationResult[] {
    const results: LinkValidationResult[] = [];

    for (const artifact of artifacts.values()) {
      for (const link of artifact.links) {
        const targetFound = artifacts.has(link.targetId);
        const valid = targetFound;
        
        results.push({
          link,
          valid,
          targetFound,
          error: valid ? undefined : `Target artifact ${link.targetId} not found`
        });
      }
    }

    return results;
  }

  /**
   * Calculate traceability metrics
   */
  private calculateTraceabilityMetrics(
    artifacts: Map<string, TraceabilityArtifact>,
    chains: TraceabilityChain[],
    gaps: TraceabilityGap[]
  ): TraceabilityMetrics {
    const requirements = Array.from(artifacts.values()).filter(a => a.type === 'requirement');
    const scenarios = Array.from(artifacts.values()).filter(a => a.type === 'scenario');
    const tests = Array.from(artifacts.values()).filter(a => a.type === 'test');
    const implementations = Array.from(artifacts.values()).filter(a => a.type === 'implementation');

    const requirementsWithScenarios = chains.filter(c => 
      c.requirement && c.scenarios.length > 0
    ).length;

    const scenariosWithTests = chains.reduce((count, chain) => 
      count + chain.scenarios.filter(s => 
        chain.tests.some(t => t.links.some(l => l.targetId === s.id))
      ).length,
      0
    );

    const testsWithImplementations = chains.reduce((count, chain) => 
      count + chain.tests.filter(t => 
        chain.implementations.some(i => i.links.some(l => l.targetId === t.id))
      ).length,
      0
    );

    return {
      requirementCoverage: requirements.length > 0 
        ? (requirementsWithScenarios / requirements.length) * 100 
        : 0,
      scenarioCoverage: scenarios.length > 0 
        ? (scenariosWithTests / scenarios.length) * 100 
        : 0,
      implementationCoverage: tests.length > 0 
        ? (testsWithImplementations / tests.length) * 100 
        : 0,
      orphanedArtifacts: gaps.filter(g => g.type === 'orphaned-artifact').length,
      brokenLinks: gaps.filter(g => g.type === 'broken-link').length
    };
  }

  /**
   * Generate findings from analysis
   */
  private generateFindings(
    analysis: TraceabilityAnalysis,
    settings: TraceabilityGateSettings
  ): GateFinding[] {
    const findings: GateFinding[] = [];

    // Check coverage thresholds
    if (analysis.metrics.requirementCoverage < settings.requirementCoverageThreshold) {
      findings.push({
        severity: 'error',
        category: 'traceability',
        message: `Requirement coverage (${analysis.metrics.requirementCoverage.toFixed(1)}%) below threshold (${settings.requirementCoverageThreshold}%)`,
        rule: 'requirement-coverage-threshold'
      });
    }

    if (analysis.metrics.scenarioCoverage < settings.scenarioCoverageThreshold) {
      findings.push({
        severity: 'error',
        category: 'traceability',
        message: `Scenario coverage (${analysis.metrics.scenarioCoverage.toFixed(1)}%) below threshold (${settings.scenarioCoverageThreshold}%)`,
        rule: 'scenario-coverage-threshold'
      });
    }

    if (analysis.metrics.implementationCoverage < settings.implementationCoverageThreshold) {
      findings.push({
        severity: 'error',
        category: 'traceability',
        message: `Implementation coverage (${analysis.metrics.implementationCoverage.toFixed(1)}%) below threshold (${settings.implementationCoverageThreshold}%)`,
        rule: 'implementation-coverage-threshold'
      });
    }

    // Check broken links
    const brokenLinks = analysis.linkValidation.filter(v => !v.valid);
    if (brokenLinks.length > settings.maxBrokenLinks) {
      findings.push({
        severity: 'error',
        category: 'traceability',
        message: `Too many broken traceability links: ${brokenLinks.length} (max: ${settings.maxBrokenLinks})`,
        rule: 'broken-links-threshold'
      });
    }

    // Add findings for gaps
    for (const gap of analysis.gaps) {
      const severity = gap.severity === 'critical' || gap.severity === 'high' ? 'error' : 'warning';
      findings.push({
        severity,
        category: 'traceability',
        message: gap.description,
        file: gap.artifact.filePath,
        line: gap.artifact.line,
        rule: `traceability-${gap.type}`
      });
    }

    // Add informational findings
    if (analysis.metrics.requirementCoverage === 100 && 
        analysis.metrics.scenarioCoverage === 100 && 
        analysis.metrics.implementationCoverage === 100) {
      findings.push({
        severity: 'info',
        category: 'traceability',
        message: 'Perfect traceability achieved - all requirements traced through to implementation',
        rule: 'traceability-excellence'
      });
    }

    return findings;
  }

  /**
   * Determine gate status
   */
  private determineGateStatus(
    findings: GateFinding[],
    analysis: TraceabilityAnalysis,
    settings: TraceabilityGateSettings
  ): GateStatus {
    const errors = findings.filter(f => f.severity === 'error');
    return errors.length === 0 ? GateStatus.PASSED : GateStatus.FAILED;
  }

  /**
   * Generate summary message
   */
  private generateSummary(analysis: TraceabilityAnalysis, status: GateStatus): string {
    const { metrics } = analysis;
    
    if (status === GateStatus.PASSED) {
      return `Traceability validation passed. Requirement coverage: ${metrics.requirementCoverage.toFixed(1)}%, Scenario coverage: ${metrics.scenarioCoverage.toFixed(1)}%, Implementation coverage: ${metrics.implementationCoverage.toFixed(1)}%`;
    } else {
      const gapCount = analysis.gaps.length;
      const brokenLinkCount = analysis.linkValidation.filter(v => !v.valid).length;
      return `Traceability validation failed with ${gapCount} gap(s) and ${brokenLinkCount} broken link(s). Requirement coverage: ${metrics.requirementCoverage.toFixed(1)}%`;
    }
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    analysis: TraceabilityAnalysis,
    settings: TraceabilityGateSettings
  ): string[] {
    const recommendations: string[] = [];

    if (analysis.metrics.requirementCoverage < settings.requirementCoverageThreshold) {
      recommendations.push('Create scenarios for requirements that lack coverage');
    }

    if (analysis.metrics.scenarioCoverage < settings.scenarioCoverageThreshold) {
      recommendations.push('Add tests for scenarios that lack test coverage');
    }

    if (analysis.metrics.implementationCoverage < settings.implementationCoverageThreshold) {
      recommendations.push('Implement functionality for tests that lack implementations');
    }

    if (analysis.gaps.length > 0) {
      const gapTypes = [...new Set(analysis.gaps.map(g => g.type))];
      recommendations.push(`Address traceability gaps: ${gapTypes.join(', ')}`);
    }

    const brokenLinks = analysis.linkValidation.filter(v => !v.valid);
    if (brokenLinks.length > 0) {
      recommendations.push('Fix broken traceability links by updating references to valid artifact IDs');
    }

    if (analysis.metrics.orphanedArtifacts > 0) {
      recommendations.push('Link orphaned artifacts to appropriate traceability chains');
    }

    return recommendations;
  }

  /**
   * Generate report URLs
   */
  private generateReportUrls(context: GateExecutionContext): string[] {
    const urls: string[] = [];

    // Add traceability report URL if available
    const reportPath = join(context.workingDirectory, '.arbiter', 'traceability-report.html');
    urls.push(`file://${reportPath}`);

    return urls;
  }

  /**
   * Extract metrics for reporting
   */
  private extractMetrics(analysis: TraceabilityAnalysis): Record<string, number> {
    const { metrics } = analysis;

    return {
      'traceability.requirementCoverage': metrics.requirementCoverage,
      'traceability.scenarioCoverage': metrics.scenarioCoverage,
      'traceability.implementationCoverage': metrics.implementationCoverage,
      'traceability.orphanedArtifacts': metrics.orphanedArtifacts,
      'traceability.brokenLinks': metrics.brokenLinks,
      'traceability.totalArtifacts': analysis.artifacts.size,
      'traceability.totalChains': analysis.chains.length,
      'traceability.totalGaps': analysis.gaps.length,
      'traceability.averageChainCompleteness': analysis.chains.reduce((sum, c) => sum + c.completeness, 0) / analysis.chains.length || 0,
      'traceability.averageChainQuality': analysis.chains.reduce((sum, c) => sum + c.quality, 0) / analysis.chains.length || 0
    };
  }

  /**
   * Check if file matches any pattern
   */
  private matchesAnyPattern(file: string, patterns: string[]): boolean {
    return patterns.some(pattern => 
      new RegExp(pattern.replace(/\*/g, '.*')).test(file)
    );
  }

  /**
   * Validate and parse gate settings
   */
  private validateAndParseSettings(settings: any): TraceabilityGateSettings {
    const defaults: TraceabilityGateSettings = {
      requirementCoverageThreshold: 90,
      scenarioCoverageThreshold: 85,
      implementationCoverageThreshold: 80,
      allowOrphanedArtifacts: false,
      maxBrokenLinks: 0,
      differentialOnly: false,
      requirementPatterns: ['**/*.req.md', '**/requirements/**/*.md'],
      scenarioPatterns: ['**/*.scenario.md', '**/scenarios/**/*.md', '**/*.feature'],
      testPatterns: ['**/*.test.ts', '**/*.spec.ts', '**/*.test.js', '**/*.spec.js'],
      implementationPatterns: ['**/*.ts', '**/*.js', '!**/*.test.*', '!**/*.spec.*'],
      annotationPatterns: {
        requirementId: /\@req\[([^\]]+)\]/,
        scenarioId: /\@scenario\[([^\]]+)\]/,
        testId: /\@test\[([^\]]+)\]/,
        implementationRef: /\@impl\[([^\]]+)\]/,
        traceabilityLink: /\@(?<type>covers|implements|tests|traces-to|depends-on)\[(?<targetId>[^\]]+)\]/g
      },
      failOnNoTraceability: false
    };

    return { ...defaults, ...settings };
  }

  /**
   * Create skipped result
   */
  private createSkippedResult(
    gate: GateConfiguration,
    startTime: Date,
    reason: string
  ): GateResult {
    const endTime = new Date();
    
    return {
      gateId: gate.id,
      name: gate.name,
      status: GateStatus.SKIPPED,
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      details: {
        summary: `Traceability gate skipped: ${reason}`,
        findings: [],
        recommendations: [],
        reportUrls: []
      },
      metrics: {}
    };
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
        summary: `Traceability gate error: ${error.message}`,
        findings: [{
          severity: 'error',
          category: 'execution',
          message: error.message,
          rule: 'gate-execution'
        }],
        recommendations: ['Check traceability configuration and ensure artifact files are accessible'],
        reportUrls: []
      },
      error: {
        code: 'TRACEABILITY_ERROR',
        message: error.message,
        details: error.stack
      },
      metrics: {}
    };
  }
}