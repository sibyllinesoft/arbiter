/**
 * Impact and Coverage Analyzer
 * 
 * This module provides comprehensive analysis capabilities for traceability data,
 * including impact analysis for changes, coverage analysis for gaps, and 
 * recommendations for improving traceability relationships.
 */

import type {
  Artifact,
  TraceabilityLink,
  TraceabilityGraph,
  ImpactAnalysis,
  CoverageAnalysis,
  ArtifactChange,
  ArtifactImpact,
  RiskAssessment,
  RiskFactor,
  Recommendation,
  CoverageMetrics,
  CoverageGap,
  CoverageTrend,
  ChangeType,
  ArtifactType,
  LinkType,
  ChangeDetail
} from './types.js';
import { TraceabilityGraphManager } from './graph.js';

/**
 * Analysis configuration options
 */
export interface AnalysisConfig {
  /** Maximum depth for impact analysis traversal */
  maxImpactDepth: number;
  /** Minimum confidence threshold for recommendations */
  minRecommendationConfidence: number;
  /** Risk factor weights */
  riskWeights: {
    complexity: number;
    coverage: number;
    dependencies: number;
    changeFrequency: number;
  };
  /** Coverage thresholds */
  coverageThresholds: {
    excellent: number;
    good: number;
    acceptable: number;
  };
  /** Enable advanced analysis features */
  features: {
    transitiveImpactAnalysis: boolean;
    riskPrediction: boolean;
    trendAnalysis: boolean;
    semanticAnalysis: boolean;
  };
}

/**
 * Historical data for trend analysis
 */
export interface HistoricalSnapshot {
  timestamp: Date;
  graph: TraceabilityGraph;
  metrics: CoverageMetrics;
  changes: ArtifactChange[];
}

/**
 * Comprehensive analyzer for traceability data
 */
export class TraceabilityAnalyzer {
  private graphManager: TraceabilityGraphManager;
  private config: AnalysisConfig;
  private history: HistoricalSnapshot[];

  constructor(graphManager: TraceabilityGraphManager, config: Partial<AnalysisConfig> = {}) {
    this.graphManager = graphManager;
    this.config = {
      maxImpactDepth: 5,
      minRecommendationConfidence: 0.7,
      riskWeights: {
        complexity: 0.3,
        coverage: 0.25,
        dependencies: 0.25,
        changeFrequency: 0.2
      },
      coverageThresholds: {
        excellent: 0.9,
        good: 0.75,
        acceptable: 0.6
      },
      features: {
        transitiveImpactAnalysis: true,
        riskPrediction: true,
        trendAnalysis: true,
        semanticAnalysis: false
      },
      ...config
    };
    this.history = [];
  }

  /**
   * Analyzes the impact of artifact changes
   */
  async analyzeImpact(changes: ArtifactChange[]): Promise<ImpactAnalysis> {
    const graph = this.graphManager.getGraph();
    const impactedArtifacts = new Map<string, ArtifactImpact>();
    const brokenLinks: TraceabilityLink[] = [];

    // Analyze direct impacts for each change
    for (const change of changes) {
      await this.analyzeArtifactImpact(
        change,
        graph,
        impactedArtifacts,
        brokenLinks
      );
    }

    // Analyze transitive impacts if enabled
    if (this.config.features.transitiveImpactAnalysis) {
      await this.analyzeTransitiveImpacts(
        changes,
        graph,
        impactedArtifacts
      );
    }

    // Generate risk assessment
    const riskAssessment = this.assessRisk(changes, Array.from(impactedArtifacts.values()));

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      changes,
      Array.from(impactedArtifacts.values()),
      brokenLinks,
      graph
    );

    return {
      changedArtifacts: changes,
      impactedArtifacts: Array.from(impactedArtifacts.values()),
      brokenLinks,
      riskAssessment,
      recommendations
    };
  }

  /**
   * Analyzes coverage metrics and gaps
   */
  async analyzeCoverage(): Promise<CoverageAnalysis> {
    const graph = this.graphManager.getGraph();
    const overall = this.calculateOverallCoverage(graph);
    const byType = this.calculateCoverageByType(graph);
    const gaps = this.identifyCoverageGaps(graph);
    const trends = this.calculateCoverageTrends();

    return {
      overall,
      byType,
      gaps,
      trends
    };
  }

  /**
   * Records a snapshot for trend analysis
   */
  recordSnapshot(changes: ArtifactChange[] = []): void {
    const graph = this.graphManager.getGraph();
    const metrics = this.calculateOverallCoverage(graph);

    this.history.push({
      timestamp: new Date(),
      graph: this.deepCloneGraph(graph),
      metrics,
      changes
    });

    // Keep only last 100 snapshots to manage memory
    if (this.history.length > 100) {
      this.history = this.history.slice(-100);
    }
  }

  /**
   * Finds orphaned artifacts (no relationships)
   */
  findOrphanedArtifacts(): Artifact[] {
    return this.graphManager.findOrphanedArtifacts();
  }

  /**
   * Finds missing relationships based on patterns
   */
  findMissingRelationships(): Recommendation[] {
    const graph = this.graphManager.getGraph();
    const recommendations: Recommendation[] = [];

    // Find requirements without tests
    const requirementsWithoutTests = this.findRequirementsWithoutTests(graph);
    recommendations.push(...requirementsWithoutTests);

    // Find code without tests
    const codeWithoutTests = this.findCodeWithoutTests(graph);
    recommendations.push(...codeWithoutTests);

    // Find scenarios without implementations
    const scenariosWithoutImplementations = this.findScenariosWithoutImplementations(graph);
    recommendations.push(...scenariosWithoutImplementations);

    return recommendations.filter(r => r.priority !== 'low');
  }

  /**
   * Calculates quality metrics for the traceability graph
   */
  calculateQualityMetrics(): {
    completeness: number;
    consistency: number;
    correctness: number;
    currentness: number;
    overall: number;
  } {
    const graph = this.graphManager.getGraph();
    
    const completeness = this.calculateCompleteness(graph);
    const consistency = this.calculateConsistency(graph);
    const correctness = this.calculateCorrectness(graph);
    const currentness = this.calculateCurrentness(graph);
    
    const overall = (completeness + consistency + correctness + currentness) / 4;

    return {
      completeness,
      consistency,
      correctness,
      currentness,
      overall
    };
  }

  // Private methods for impact analysis

  private async analyzeArtifactImpact(
    change: ArtifactChange,
    graph: TraceabilityGraph,
    impactedArtifacts: Map<string, ArtifactImpact>,
    brokenLinks: TraceabilityLink[]
  ): Promise<void> {
    const artifact = change.artifact;

    // Find directly connected artifacts
    const connectedArtifacts = this.graphManager.getLinkedArtifacts(artifact.id);

    for (const connected of connectedArtifacts) {
      if (!impactedArtifacts.has(connected.id)) {
        const impact: ArtifactImpact = {
          artifact: connected,
          impactLevel: 'direct',
          distance: 1,
          confidence: this.calculateImpactConfidence(change, connected),
          reasons: this.generateImpactReasons(change, connected)
        };

        impactedArtifacts.set(connected.id, impact);
      }
    }

    // Check for broken links
    if (change.changeType === 'deleted') {
      const incomingLinks = graph.linksByTarget.get(artifact.id) || new Set();
      const outgoingLinks = graph.linksBySource.get(artifact.id) || new Set();

      for (const linkId of [...incomingLinks, ...outgoingLinks]) {
        const link = graph.links.get(linkId);
        if (link) {
          brokenLinks.push(link);
        }
      }
    }
  }

  private async analyzeTransitiveImpacts(
    changes: ArtifactChange[],
    graph: TraceabilityGraph,
    impactedArtifacts: Map<string, ArtifactImpact>
  ): Promise<void> {
    const directlyImpacted = new Set(impactedArtifacts.keys());

    for (const impactedId of directlyImpacted) {
      const traversed = this.graphManager.traverse(impactedId, {
        maxDepth: this.config.maxImpactDepth - 1,
        preventCycles: true
      });

      for (const artifact of traversed) {
        if (!impactedArtifacts.has(artifact.id) && !directlyImpacted.has(artifact.id)) {
          const distance = this.calculateDistance(impactedId, artifact.id);
          const impact: ArtifactImpact = {
            artifact,
            impactLevel: distance > 2 ? 'transitive' : 'indirect',
            distance,
            confidence: this.calculateTransitiveConfidence(distance),
            reasons: [`Transitively impacted through ${impactedId}`]
          };

          impactedArtifacts.set(artifact.id, impact);
        }
      }
    }
  }

  private calculateImpactConfidence(change: ArtifactChange, impacted: Artifact): number {
    let confidence = 0.8; // Base confidence

    // Adjust based on change type
    switch (change.changeType) {
      case 'deleted':
        confidence = 0.95; // High confidence for deletions
        break;
      case 'modified':
        confidence = 0.7; // Medium confidence for modifications
        break;
      case 'added':
        confidence = 0.5; // Lower confidence for additions
        break;
    }

    // Adjust based on artifact types
    if (change.artifact.type === 'requirement' && impacted.type === 'test') {
      confidence += 0.1; // Requirements strongly impact tests
    }

    if (change.artifact.type === 'code' && impacted.type === 'test') {
      confidence += 0.15; // Code strongly impacts tests
    }

    return Math.min(confidence, 1.0);
  }

  private generateImpactReasons(change: ArtifactChange, impacted: Artifact): string[] {
    const reasons: string[] = [];
    const changeArtifact = change.artifact;

    if (changeArtifact.type === 'requirement' && impacted.type === 'scenario') {
      reasons.push('Requirement change may affect scenario validity');
    }

    if (changeArtifact.type === 'code' && impacted.type === 'test') {
      reasons.push('Code change may require test updates');
    }

    if (changeArtifact.type === 'scenario' && impacted.type === 'test') {
      reasons.push('Scenario change may require test case updates');
    }

    if (change.changeType === 'deleted') {
      reasons.push('Deletion breaks existing relationship');
    }

    if (change.changeDetails.some(d => d.impact === 'high')) {
      reasons.push('High-impact changes detected in source artifact');
    }

    return reasons;
  }

  private calculateDistance(sourceId: string, targetId: string): number {
    const paths = this.graphManager.findPaths(sourceId, targetId, 5);
    return paths.length > 0 ? paths[0].length : Infinity;
  }

  private calculateTransitiveConfidence(distance: number): number {
    // Confidence decreases with distance
    return Math.max(0.1, 0.8 - (distance - 1) * 0.2);
  }

  // Private methods for risk assessment

  private assessRisk(changes: ArtifactChange[], impacts: ArtifactImpact[]): RiskAssessment {
    const riskFactors = this.identifyRiskFactors(changes, impacts);
    const overallRisk = this.calculateOverallRisk(riskFactors);
    const mitigationStrategies = this.generateMitigationStrategies(riskFactors);
    const validationSteps = this.generateValidationSteps(changes, impacts);

    return {
      overallRisk,
      riskFactors,
      mitigationStrategies,
      validationSteps
    };
  }

  private identifyRiskFactors(changes: ArtifactChange[], impacts: ArtifactImpact[]): RiskFactor[] {
    const factors: RiskFactor[] = [];

    // High-impact changes
    const criticalChanges = changes.filter(c => 
      c.artifact.type === 'requirement' || 
      c.changeDetails.some(d => d.impact === 'high')
    );

    if (criticalChanges.length > 0) {
      factors.push({
        id: 'critical_changes',
        description: `${criticalChanges.length} critical artifacts changed`,
        level: 'high',
        likelihood: 0.8,
        impact: 0.9,
        score: 0.72
      });
    }

    // Many impacted artifacts
    if (impacts.length > 10) {
      factors.push({
        id: 'wide_impact',
        description: `${impacts.length} artifacts potentially impacted`,
        level: 'medium',
        likelihood: 0.7,
        impact: 0.6,
        score: 0.42
      });
    }

    // Low-confidence impacts
    const lowConfidenceImpacts = impacts.filter(i => i.confidence < 0.5);
    if (lowConfidenceImpacts.length > 0) {
      factors.push({
        id: 'uncertain_impacts',
        description: `${lowConfidenceImpacts.length} impacts with low confidence`,
        level: 'medium',
        likelihood: 0.6,
        impact: 0.4,
        score: 0.24
      });
    }

    return factors;
  }

  private calculateOverallRisk(factors: RiskFactor[]): 'critical' | 'high' | 'medium' | 'low' {
    if (factors.length === 0) return 'low';

    const maxScore = Math.max(...factors.map(f => f.score));
    const avgScore = factors.reduce((sum, f) => sum + f.score, 0) / factors.length;

    if (maxScore > 0.7 || avgScore > 0.5) return 'critical';
    if (maxScore > 0.5 || avgScore > 0.3) return 'high';
    if (maxScore > 0.3 || avgScore > 0.2) return 'medium';
    return 'low';
  }

  private generateMitigationStrategies(factors: RiskFactor[]): string[] {
    const strategies: string[] = [];

    if (factors.some(f => f.id === 'critical_changes')) {
      strategies.push('Conduct thorough review of requirement changes');
      strategies.push('Update dependent scenarios and test cases');
    }

    if (factors.some(f => f.id === 'wide_impact')) {
      strategies.push('Implement phased rollout approach');
      strategies.push('Increase monitoring and validation coverage');
    }

    if (factors.some(f => f.id === 'uncertain_impacts')) {
      strategies.push('Manual review of low-confidence impact predictions');
      strategies.push('Improve traceability link documentation');
    }

    return strategies;
  }

  private generateValidationSteps(changes: ArtifactChange[], impacts: ArtifactImpact[]): string[] {
    const steps: string[] = [];

    // Test validation
    const testImpacts = impacts.filter(i => i.artifact.type === 'test');
    if (testImpacts.length > 0) {
      steps.push(`Run ${testImpacts.length} potentially affected tests`);
    }

    // Code validation
    const codeImpacts = impacts.filter(i => i.artifact.type === 'code');
    if (codeImpacts.length > 0) {
      steps.push(`Review ${codeImpacts.length} affected code artifacts`);
    }

    // Documentation validation
    const docChanges = changes.filter(c => c.artifact.filePath.endsWith('.md'));
    if (docChanges.length > 0) {
      steps.push('Update and review documentation consistency');
    }

    return steps;
  }

  // Private methods for coverage analysis

  private calculateOverallCoverage(graph: TraceabilityGraph): CoverageMetrics {
    const totalArtifacts = graph.artifacts.size;
    const totalLinks = graph.links.size;

    // Calculate coverage based on expected relationships
    const requirements = Array.from(graph.artifacts.values()).filter(a => a.type === 'requirement');
    const scenarios = Array.from(graph.artifacts.values()).filter(a => a.type === 'scenario');
    const tests = Array.from(graph.artifacts.values()).filter(a => a.type === 'test');
    const code = Array.from(graph.artifacts.values()).filter(a => a.type === 'code');

    // Count covered artifacts (artifacts with at least one link)
    let coveredArtifacts = 0;
    for (const artifact of graph.artifacts.values()) {
      const hasIncoming = (graph.linksByTarget.get(artifact.id)?.size || 0) > 0;
      const hasOutgoing = (graph.linksBySource.get(artifact.id)?.size || 0) > 0;
      
      if (hasIncoming || hasOutgoing) {
        coveredArtifacts++;
      }
    }

    const coveragePercent = totalArtifacts > 0 ? coveredArtifacts / totalArtifacts : 0;
    const linkDensity = totalArtifacts > 0 ? totalLinks / totalArtifacts : 0;

    // Calculate completeness score based on expected relationships
    let expectedRelationships = 0;
    let actualRelationships = 0;

    // Requirements should have scenarios
    expectedRelationships += requirements.length;
    actualRelationships += this.countRelationships(graph, 'requirement', 'scenario');

    // Scenarios should have tests
    expectedRelationships += scenarios.length;
    actualRelationships += this.countRelationships(graph, 'scenario', 'test');

    // Code should have tests
    expectedRelationships += code.length;
    actualRelationships += this.countRelationships(graph, 'code', 'test');

    const completenessScore = expectedRelationships > 0 ? 
      actualRelationships / expectedRelationships : 1;

    return {
      totalArtifacts,
      coveredArtifacts,
      coveragePercent,
      totalLinks,
      linkDensity,
      completenessScore
    };
  }

  private calculateCoverageByType(graph: TraceabilityGraph): Record<ArtifactType, CoverageMetrics> {
    const result: Record<ArtifactType, CoverageMetrics> = {
      requirement: this.calculateTypeCoverage(graph, 'requirement'),
      scenario: this.calculateTypeCoverage(graph, 'scenario'),
      test: this.calculateTypeCoverage(graph, 'test'),
      code: this.calculateTypeCoverage(graph, 'code')
    };

    return result;
  }

  private calculateTypeCoverage(graph: TraceabilityGraph, type: ArtifactType): CoverageMetrics {
    const artifacts = Array.from(graph.artifacts.values()).filter(a => a.type === type);
    const totalArtifacts = artifacts.length;

    let coveredArtifacts = 0;
    let totalLinks = 0;

    for (const artifact of artifacts) {
      const incomingCount = graph.linksByTarget.get(artifact.id)?.size || 0;
      const outgoingCount = graph.linksBySource.get(artifact.id)?.size || 0;
      const linkCount = incomingCount + outgoingCount;

      if (linkCount > 0) {
        coveredArtifacts++;
      }
      totalLinks += linkCount;
    }

    const coveragePercent = totalArtifacts > 0 ? coveredArtifacts / totalArtifacts : 0;
    const linkDensity = totalArtifacts > 0 ? totalLinks / totalArtifacts : 0;

    return {
      totalArtifacts,
      coveredArtifacts,
      coveragePercent,
      totalLinks,
      linkDensity,
      completenessScore: coveragePercent // Simplified for type-specific coverage
    };
  }

  private identifyCoverageGaps(graph: TraceabilityGraph): CoverageGap[] {
    const gaps: CoverageGap[] = [];

    // Find uncovered requirements
    const uncoveredRequirements = this.findUncoveredArtifacts(graph, 'requirement');
    if (uncoveredRequirements.length > 0) {
      gaps.push({
        id: 'uncovered_requirements',
        type: 'uncovered_requirement',
        description: `${uncoveredRequirements.length} requirements without scenarios or tests`,
        artifacts: uncoveredRequirements.map(a => a.id),
        severity: 'high',
        suggestions: [
          'Create scenarios for uncovered requirements',
          'Add direct requirement-to-test links where appropriate'
        ]
      });
    }

    // Find untested code
    const untestedCode = this.findUntestedCode(graph);
    if (untestedCode.length > 0) {
      gaps.push({
        id: 'untested_code',
        type: 'untested_code',
        description: `${untestedCode.length} code artifacts without tests`,
        artifacts: untestedCode.map(a => a.id),
        severity: 'critical',
        suggestions: [
          'Add unit tests for untested code',
          'Create integration tests for complex components'
        ]
      });
    }

    // Find orphaned tests
    const orphanedTests = this.findOrphanedTests(graph);
    if (orphanedTests.length > 0) {
      gaps.push({
        id: 'orphaned_tests',
        type: 'orphaned_test',
        description: `${orphanedTests.length} tests not linked to requirements or code`,
        artifacts: orphanedTests.map(a => a.id),
        severity: 'medium',
        suggestions: [
          'Link tests to the code they validate',
          'Connect tests to related requirements'
        ]
      });
    }

    return gaps;
  }

  private calculateCoverageTrends(): CoverageTrend[] {
    return this.history.map(snapshot => ({
      timestamp: snapshot.timestamp,
      metrics: snapshot.metrics,
      changes: snapshot.changes.length
    }));
  }

  // Helper methods

  private countRelationships(graph: TraceabilityGraph, sourceType: ArtifactType, targetType: ArtifactType): number {
    let count = 0;

    for (const link of graph.links.values()) {
      const source = graph.artifacts.get(link.sourceId);
      const target = graph.artifacts.get(link.targetId);

      if (source?.type === sourceType && target?.type === targetType) {
        count++;
      }
    }

    return count;
  }

  private findUncoveredArtifacts(graph: TraceabilityGraph, type: ArtifactType): Artifact[] {
    const artifacts = Array.from(graph.artifacts.values()).filter(a => a.type === type);
    return artifacts.filter(artifact => {
      const hasOutgoing = (graph.linksBySource.get(artifact.id)?.size || 0) > 0;
      return !hasOutgoing;
    });
  }

  private findUntestedCode(graph: TraceabilityGraph): Artifact[] {
    const codeArtifacts = Array.from(graph.artifacts.values()).filter(a => a.type === 'code');
    return codeArtifacts.filter(artifact => {
      const outgoingLinks = graph.linksBySource.get(artifact.id) || new Set();
      const hasTestLinks = Array.from(outgoingLinks).some(linkId => {
        const link = graph.links.get(linkId);
        const target = link ? graph.artifacts.get(link.targetId) : null;
        return target?.type === 'test';
      });

      const incomingLinks = graph.linksByTarget.get(artifact.id) || new Set();
      const hasTestingLinks = Array.from(incomingLinks).some(linkId => {
        const link = graph.links.get(linkId);
        const source = link ? graph.artifacts.get(link.sourceId) : null;
        return source?.type === 'test' && link?.linkType === 'tests';
      });

      return !hasTestLinks && !hasTestingLinks;
    });
  }

  private findOrphanedTests(graph: TraceabilityGraph): Artifact[] {
    const testArtifacts = Array.from(graph.artifacts.values()).filter(a => a.type === 'test');
    return testArtifacts.filter(artifact => {
      const hasIncoming = (graph.linksByTarget.get(artifact.id)?.size || 0) > 0;
      const hasOutgoing = (graph.linksBySource.get(artifact.id)?.size || 0) > 0;
      return !hasIncoming && !hasOutgoing;
    });
  }

  // Recommendation generation methods

  private generateRecommendations(
    changes: ArtifactChange[],
    impacts: ArtifactImpact[],
    brokenLinks: TraceabilityLink[],
    graph: TraceabilityGraph
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Recommendations for broken links
    for (const link of brokenLinks) {
      recommendations.push({
        id: `broken_link_${link.id}`,
        type: 'broken_link',
        priority: 'high',
        description: `Broken link from ${link.sourceId} to ${link.targetId}`,
        actions: [
          'Remove the broken link reference',
          'Find alternative relationship',
          'Update related documentation'
        ],
        artifacts: [link.sourceId, link.targetId],
        benefit: 'Maintains data integrity and prevents confusion',
        effort: 'low'
      });
    }

    // Recommendations for missing test coverage
    const untestedCode = this.findUntestedCode(graph);
    if (untestedCode.length > 0) {
      recommendations.push({
        id: 'add_missing_tests',
        type: 'coverage_gap',
        priority: 'critical',
        description: `${untestedCode.length} code artifacts lack test coverage`,
        actions: [
          'Create unit tests for each untested code artifact',
          'Add integration tests for complex components',
          'Link tests to their target code'
        ],
        artifacts: untestedCode.map(a => a.id),
        benefit: 'Improves code quality and reduces regression risk',
        effort: 'high'
      });
    }

    return recommendations.filter(r => this.meetsConfidenceThreshold(r));
  }

  private findRequirementsWithoutTests(graph: TraceabilityGraph): Recommendation[] {
    const requirements = Array.from(graph.artifacts.values()).filter(a => a.type === 'requirement');
    const recommendations: Recommendation[] = [];

    for (const req of requirements) {
      const hasTests = this.hasDirectOrIndirectTests(graph, req.id);
      
      if (!hasTests) {
        recommendations.push({
          id: `req_no_tests_${req.id}`,
          type: 'missing_link',
          priority: 'high',
          description: `Requirement "${req.name}" has no associated tests`,
          actions: [
            'Create test scenarios for this requirement',
            'Link existing tests if they validate this requirement'
          ],
          artifacts: [req.id],
          benefit: 'Ensures requirement validation and traceability',
          effort: 'medium'
        });
      }
    }

    return recommendations;
  }

  private findCodeWithoutTests(graph: TraceabilityGraph): Recommendation[] {
    const untestedCode = this.findUntestedCode(graph);
    
    return untestedCode.map(code => ({
      id: `code_no_tests_${code.id}`,
      type: 'missing_link',
      priority: 'critical',
      description: `Code "${code.name}" has no associated tests`,
      actions: [
        'Create unit tests for this code',
        'Add integration tests if applicable',
        'Link to existing tests if they cover this code'
      ],
      artifacts: [code.id],
      benefit: 'Reduces technical debt and improves maintainability',
      effort: 'medium'
    }));
  }

  private findScenariosWithoutImplementations(graph: TraceabilityGraph): Recommendation[] {
    const scenarios = Array.from(graph.artifacts.values()).filter(a => a.type === 'scenario');
    const recommendations: Recommendation[] = [];

    for (const scenario of scenarios) {
      const hasImplementation = this.hasImplementation(graph, scenario.id);
      
      if (!hasImplementation) {
        recommendations.push({
          id: `scenario_no_impl_${scenario.id}`,
          type: 'missing_link',
          priority: 'medium',
          description: `Scenario "${scenario.name}" has no implementation`,
          actions: [
            'Implement code to satisfy this scenario',
            'Create tests that validate this scenario',
            'Link to existing implementation if it exists'
          ],
          artifacts: [scenario.id],
          benefit: 'Ensures scenarios are implemented and testable',
          effort: 'high'
        });
      }
    }

    return recommendations;
  }

  private hasDirectOrIndirectTests(graph: TraceabilityGraph, artifactId: string): boolean {
    // Check direct test links
    const outgoingLinks = graph.linksBySource.get(artifactId) || new Set();
    for (const linkId of outgoingLinks) {
      const link = graph.links.get(linkId);
      const target = link ? graph.artifacts.get(link.targetId) : null;
      if (target?.type === 'test') {
        return true;
      }
    }

    // Check indirect through scenarios
    for (const linkId of outgoingLinks) {
      const link = graph.links.get(linkId);
      const target = link ? graph.artifacts.get(link.targetId) : null;
      if (target?.type === 'scenario') {
        if (this.hasDirectOrIndirectTests(graph, target.id)) {
          return true;
        }
      }
    }

    return false;
  }

  private hasImplementation(graph: TraceabilityGraph, scenarioId: string): boolean {
    const outgoingLinks = graph.linksBySource.get(scenarioId) || new Set();
    const incomingLinks = graph.linksByTarget.get(scenarioId) || new Set();

    // Check for code implementations
    for (const linkId of [...outgoingLinks, ...incomingLinks]) {
      const link = graph.links.get(linkId);
      if (!link) continue;

      const otherArtifactId = link.sourceId === scenarioId ? link.targetId : link.sourceId;
      const otherArtifact = graph.artifacts.get(otherArtifactId);
      
      if (otherArtifact?.type === 'code' || otherArtifact?.type === 'test') {
        return true;
      }
    }

    return false;
  }

  private meetsConfidenceThreshold(recommendation: Recommendation): boolean {
    // Simple heuristic based on recommendation type and priority
    const typeConfidence = {
      'broken_link': 0.9,
      'missing_link': 0.8,
      'coverage_gap': 0.85,
      'quality_issue': 0.7,
      'orphaned_artifact': 0.75
    };

    const priorityBonus = {
      'critical': 0.1,
      'high': 0.05,
      'medium': 0,
      'low': -0.1
    };

    const confidence = (typeConfidence[recommendation.type] || 0.5) + 
                     (priorityBonus[recommendation.priority] || 0);

    return confidence >= this.config.minRecommendationConfidence;
  }

  // Quality calculation methods

  private calculateCompleteness(graph: TraceabilityGraph): number {
    const metrics = this.calculateOverallCoverage(graph);
    return metrics.completenessScore;
  }

  private calculateConsistency(graph: TraceabilityGraph): number {
    // Check for consistent naming and structure
    let consistencyScore = 0;
    let totalChecks = 0;

    // Check link consistency
    for (const link of graph.links.values()) {
      totalChecks++;
      const source = graph.artifacts.get(link.sourceId);
      const target = graph.artifacts.get(link.targetId);
      
      if (source && target) {
        // Check if link type makes sense for artifact types
        if (this.isValidLinkType(source.type, target.type, link.linkType)) {
          consistencyScore++;
        }
      }
    }

    return totalChecks > 0 ? consistencyScore / totalChecks : 1;
  }

  private calculateCorrectness(graph: TraceabilityGraph): number {
    // Measure based on validation rules and constraints
    let correctnessScore = 0;
    let totalArtifacts = graph.artifacts.size;

    for (const artifact of graph.artifacts.values()) {
      let artifactScore = 1;

      // Check required fields
      if (!artifact.name || !artifact.filePath) {
        artifactScore -= 0.5;
      }

      // Check location validity
      if (artifact.location.startLine < 1) {
        artifactScore -= 0.3;
      }

      correctnessScore += Math.max(0, artifactScore);
    }

    return totalArtifacts > 0 ? correctnessScore / totalArtifacts : 1;
  }

  private calculateCurrentness(graph: TraceabilityGraph): number {
    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    let currentArtifacts = 0;
    
    for (const artifact of graph.artifacts.values()) {
      if (artifact.lastModified > oneMonthAgo) {
        currentArtifacts++;
      }
    }

    return graph.artifacts.size > 0 ? currentArtifacts / graph.artifacts.size : 1;
  }

  private isValidLinkType(sourceType: ArtifactType, targetType: ArtifactType, linkType: LinkType): boolean {
    const validCombinations = {
      'implements': [
        ['code', 'requirement'],
        ['code', 'scenario']
      ],
      'tests': [
        ['test', 'code'],
        ['test', 'requirement'],
        ['test', 'scenario']
      ],
      'validates': [
        ['scenario', 'requirement'],
        ['test', 'requirement']
      ],
      'derives_from': [
        ['scenario', 'requirement'],
        ['test', 'scenario']
      ],
      'references': [
        ['requirement', 'requirement'],
        ['scenario', 'scenario'],
        ['code', 'code']
      ]
    };

    const validForType = validCombinations[linkType] || [];
    return validForType.some(([src, tgt]) => src === sourceType && tgt === targetType);
  }

  private deepCloneGraph(graph: TraceabilityGraph): TraceabilityGraph {
    // Create a deep clone for historical snapshots
    // This is a simplified version - in practice, you might want to use a proper deep cloning library
    return {
      artifacts: new Map(Array.from(graph.artifacts.entries()).map(([k, v]) => [k, { ...v }])),
      links: new Map(Array.from(graph.links.entries()).map(([k, v]) => [k, { ...v }])),
      linksBySource: new Map(Array.from(graph.linksBySource.entries()).map(([k, v]) => [k, new Set(v)])),
      linksByTarget: new Map(Array.from(graph.linksByTarget.entries()).map(([k, v]) => [k, new Set(v)])),
      artifactsByType: new Map(Array.from(graph.artifactsByType.entries()).map(([k, v]) => [k, new Set(v)])),
      artifactsByFile: new Map(Array.from(graph.artifactsByFile.entries()).map(([k, v]) => [k, new Set(v)])),
      metadata: { ...graph.metadata }
    };
  }
}