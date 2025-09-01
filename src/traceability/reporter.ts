/**
 * Report Generator
 * 
 * This module generates comprehensive traceability reports including matrices,
 * coverage analysis, impact assessments, and visual representations of the
 * traceability graph. Supports multiple output formats and customizable templates.
 */

import { writeFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import type {
  TraceabilityGraph,
  TraceabilityReport,
  ReportParameters,
  ReportSummary,
  ImpactAnalysis,
  CoverageAnalysis,
  Artifact,
  TraceabilityLink,
  ArtifactType,
  LinkType,
  ExportOptions
} from './types.js';
import { TraceabilityGraphManager } from './graph.js';
import { TraceabilityAnalyzer } from './analyzer.js';

/**
 * Report template configuration
 */
export interface ReportTemplate {
  /** Template identifier */
  id: string;
  /** Template name */
  name: string;
  /** Template type */
  type: 'matrix' | 'coverage' | 'impact' | 'gaps' | 'trends' | 'custom';
  /** Template description */
  description: string;
  /** Default parameters */
  defaultParameters: Partial<ReportParameters>;
  /** Template content (HTML/Markdown/etc.) */
  template: string;
  /** CSS styles (for HTML reports) */
  styles?: string;
  /** JavaScript code (for interactive reports) */
  scripts?: string;
}

/**
 * Matrix cell data
 */
export interface MatrixCell {
  /** Source artifact ID */
  sourceId: string;
  /** Target artifact ID */
  targetId: string;
  /** Whether relationship exists */
  hasRelationship: boolean;
  /** Link details if relationship exists */
  link?: TraceabilityLink;
  /** Relationship strength */
  strength: number;
  /** Cell CSS classes */
  cssClasses: string[];
}

/**
 * Traceability matrix data
 */
export interface TraceabilityMatrix {
  /** Matrix title */
  title: string;
  /** Source artifact type */
  sourceType: ArtifactType;
  /** Target artifact type */
  targetType: ArtifactType;
  /** Source artifacts (rows) */
  sources: Artifact[];
  /** Target artifacts (columns) */
  targets: Artifact[];
  /** Matrix cells */
  cells: MatrixCell[][];
  /** Matrix statistics */
  statistics: {
    totalCells: number;
    filledCells: number;
    coveragePercentage: number;
    averageStrength: number;
  };
}

/**
 * Comprehensive report generator for traceability data
 */
export class TraceabilityReporter {
  private graphManager: TraceabilityGraphManager;
  private analyzer: TraceabilityAnalyzer;
  private templates: Map<string, ReportTemplate>;

  constructor(graphManager: TraceabilityGraphManager, analyzer: TraceabilityAnalyzer) {
    this.graphManager = graphManager;
    this.analyzer = analyzer;
    this.templates = new Map();
    
    this.initializeDefaultTemplates();
  }

  /**
   * Generates a traceability matrix report
   */
  async generateMatrixReport(
    sourceType: ArtifactType,
    targetType: ArtifactType,
    parameters: ReportParameters = {}
  ): Promise<TraceabilityReport> {
    const graph = this.graphManager.getGraph();
    const matrix = this.buildTraceabilityMatrix(graph, sourceType, targetType, parameters);
    
    const reportData = {
      matrix,
      generationTime: new Date().toISOString(),
      parameters
    };

    const summary = this.generateMatrixSummary(matrix);

    return {
      id: this.generateReportId('matrix'),
      name: `Traceability Matrix: ${sourceType} → ${targetType}`,
      type: 'matrix',
      generatedAt: new Date(),
      parameters,
      data: reportData,
      summary,
      format: 'json'
    };
  }

  /**
   * Generates a coverage analysis report
   */
  async generateCoverageReport(parameters: ReportParameters = {}): Promise<TraceabilityReport> {
    const coverageAnalysis = await this.analyzer.analyzeCoverage();
    
    const reportData = {
      ...coverageAnalysis,
      generationTime: new Date().toISOString(),
      parameters
    };

    const summary = this.generateCoverageSummary(coverageAnalysis);

    return {
      id: this.generateReportId('coverage'),
      name: 'Traceability Coverage Analysis',
      type: 'coverage',
      generatedAt: new Date(),
      parameters,
      data: reportData,
      summary,
      format: 'json'
    };
  }

  /**
   * Generates an impact analysis report
   */
  async generateImpactReport(
    impactAnalysis: ImpactAnalysis,
    parameters: ReportParameters = {}
  ): Promise<TraceabilityReport> {
    const reportData = {
      ...impactAnalysis,
      generationTime: new Date().toISOString(),
      parameters
    };

    const summary = this.generateImpactSummary(impactAnalysis);

    return {
      id: this.generateReportId('impact'),
      name: 'Impact Analysis Report',
      type: 'impact',
      generatedAt: new Date(),
      parameters,
      data: reportData,
      summary,
      format: 'json'
    };
  }

  /**
   * Generates a gaps analysis report
   */
  async generateGapsReport(parameters: ReportParameters = {}): Promise<TraceabilityReport> {
    const coverageAnalysis = await this.analyzer.analyzeCoverage();
    const orphanedArtifacts = this.analyzer.findOrphanedArtifacts();
    const missingRelationships = this.analyzer.findMissingRelationships();
    
    const reportData = {
      gaps: coverageAnalysis.gaps,
      orphanedArtifacts,
      missingRelationships,
      generationTime: new Date().toISOString(),
      parameters
    };

    const summary = this.generateGapsSummary(coverageAnalysis.gaps.length, orphanedArtifacts.length, missingRelationships.length);

    return {
      id: this.generateReportId('gaps'),
      name: 'Traceability Gaps Analysis',
      type: 'gaps',
      generatedAt: new Date(),
      parameters,
      data: reportData,
      summary,
      format: 'json'
    };
  }

  /**
   * Generates a trends analysis report
   */
  async generateTrendsReport(parameters: ReportParameters = {}): Promise<TraceabilityReport> {
    const coverageAnalysis = await this.analyzer.analyzeCoverage();
    const qualityMetrics = this.analyzer.calculateQualityMetrics();
    
    const reportData = {
      trends: coverageAnalysis.trends,
      qualityMetrics,
      generationTime: new Date().toISOString(),
      parameters
    };

    const summary = this.generateTrendsSummary(coverageAnalysis.trends, qualityMetrics);

    return {
      id: this.generateReportId('trends'),
      name: 'Traceability Trends Analysis',
      type: 'trends',
      generatedAt: new Date(),
      parameters,
      data: reportData,
      summary,
      format: 'json'
    };
  }

  /**
   * Exports a report to a file in the specified format
   */
  async exportReport(
    report: TraceabilityReport,
    filePath: string,
    format: 'html' | 'csv' | 'json' | 'pdf' = 'html'
  ): Promise<void> {
    await mkdir(dirname(filePath), { recursive: true });

    switch (format) {
      case 'html':
        await this.exportToHTML(report, filePath);
        break;
      case 'csv':
        await this.exportToCSV(report, filePath);
        break;
      case 'json':
        await this.exportToJSON(report, filePath);
        break;
      case 'pdf':
        throw new Error('PDF export not yet implemented');
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Generates a comprehensive dashboard report
   */
  async generateDashboardReport(parameters: ReportParameters = {}): Promise<TraceabilityReport> {
    const graph = this.graphManager.getGraph();
    const graphStats = this.graphManager.getStatistics();
    const coverageAnalysis = await this.analyzer.analyzeCoverage();
    const qualityMetrics = this.analyzer.calculateQualityMetrics();
    const orphanedArtifacts = this.analyzer.findOrphanedArtifacts();

    const reportData = {
      overview: {
        graphStatistics: graphStats,
        qualityMetrics,
        lastUpdated: graph.metadata.lastUpdated
      },
      coverage: coverageAnalysis.overall,
      coverageByType: coverageAnalysis.byType,
      gaps: coverageAnalysis.gaps.slice(0, 5), // Top 5 gaps
      orphanedCount: orphanedArtifacts.length,
      trends: coverageAnalysis.trends.slice(-10), // Last 10 trend points
      generationTime: new Date().toISOString(),
      parameters
    };

    const summary: ReportSummary = {
      totalArtifacts: graphStats.totalArtifacts,
      totalLinks: graphStats.totalLinks,
      keyFindings: [
        `Overall coverage: ${(coverageAnalysis.overall.coveragePercent * 100).toFixed(1)}%`,
        `Quality score: ${(qualityMetrics.overall * 100).toFixed(1)}%`,
        `${coverageAnalysis.gaps.length} coverage gaps identified`,
        `${orphanedArtifacts.length} orphaned artifacts`
      ],
      recommendationsByPriority: {
        critical: coverageAnalysis.gaps.filter(g => g.severity === 'critical').length,
        high: coverageAnalysis.gaps.filter(g => g.severity === 'high').length,
        medium: coverageAnalysis.gaps.filter(g => g.severity === 'medium').length,
        low: coverageAnalysis.gaps.filter(g => g.severity === 'low').length
      },
      healthScore: qualityMetrics.overall * 100
    };

    return {
      id: this.generateReportId('dashboard'),
      name: 'Traceability Dashboard',
      type: 'matrix', // Using matrix as closest type
      generatedAt: new Date(),
      parameters,
      data: reportData,
      summary,
      format: 'json'
    };
  }

  /**
   * Registers a custom report template
   */
  registerTemplate(template: ReportTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Generates a report using a custom template
   */
  async generateCustomReport(
    templateId: string,
    parameters: ReportParameters = {}
  ): Promise<TraceabilityReport> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Merge template defaults with provided parameters
    const mergedParameters = { ...template.defaultParameters, ...parameters };

    // Generate appropriate data based on template type
    let reportData: any;
    let summary: ReportSummary;

    switch (template.type) {
      case 'matrix':
        const matrixReport = await this.generateMatrixReport('requirement', 'test', mergedParameters);
        reportData = matrixReport.data;
        summary = matrixReport.summary;
        break;
      case 'coverage':
        const coverageReport = await this.generateCoverageReport(mergedParameters);
        reportData = coverageReport.data;
        summary = coverageReport.summary;
        break;
      default:
        // For custom templates, provide comprehensive data
        const dashboardReport = await this.generateDashboardReport(mergedParameters);
        reportData = dashboardReport.data;
        summary = dashboardReport.summary;
    }

    return {
      id: this.generateReportId('custom'),
      name: template.name,
      type: 'custom',
      generatedAt: new Date(),
      parameters: mergedParameters,
      data: reportData,
      summary,
      format: 'json'
    };
  }

  // Private methods for building matrices and processing data

  private buildTraceabilityMatrix(
    graph: TraceabilityGraph,
    sourceType: ArtifactType,
    targetType: ArtifactType,
    parameters: ReportParameters
  ): TraceabilityMatrix {
    // Filter artifacts based on parameters
    const sources = this.filterArtifacts(graph, sourceType, parameters);
    const targets = this.filterArtifacts(graph, targetType, parameters);

    const cells: MatrixCell[][] = [];
    let totalCells = 0;
    let filledCells = 0;
    let totalStrength = 0;

    for (let i = 0; i < sources.length; i++) {
      const row: MatrixCell[] = [];
      
      for (let j = 0; j < targets.length; j++) {
        const source = sources[i];
        const target = targets[j];
        const link = this.findLink(graph, source.id, target.id);
        
        const cell: MatrixCell = {
          sourceId: source.id,
          targetId: target.id,
          hasRelationship: !!link,
          link,
          strength: link ? link.strength : 0,
          cssClasses: this.getCellClasses(link)
        };

        row.push(cell);
        totalCells++;

        if (link) {
          filledCells++;
          totalStrength += link.strength;
        }
      }
      
      cells.push(row);
    }

    const statistics = {
      totalCells,
      filledCells,
      coveragePercentage: totalCells > 0 ? (filledCells / totalCells) * 100 : 0,
      averageStrength: filledCells > 0 ? totalStrength / filledCells : 0
    };

    return {
      title: `${sourceType} → ${targetType} Traceability Matrix`,
      sourceType,
      targetType,
      sources,
      targets,
      cells,
      statistics
    };
  }

  private filterArtifacts(
    graph: TraceabilityGraph,
    type: ArtifactType,
    parameters: ReportParameters
  ): Artifact[] {
    let artifacts = Array.from(graph.artifacts.values()).filter(a => a.type === type);

    // Apply filters from parameters
    if (parameters.pathFilters?.length) {
      artifacts = artifacts.filter(a => 
        parameters.pathFilters!.some(pattern => 
          new RegExp(pattern).test(a.filePath)
        )
      );
    }

    if (parameters.timeRange) {
      artifacts = artifacts.filter(a => 
        a.lastModified >= parameters.timeRange!.start && 
        a.lastModified <= parameters.timeRange!.end
      );
    }

    return artifacts.sort((a, b) => a.name.localeCompare(b.name));
  }

  private findLink(graph: TraceabilityGraph, sourceId: string, targetId: string): TraceabilityLink | undefined {
    for (const link of graph.links.values()) {
      if (link.sourceId === sourceId && link.targetId === targetId) {
        return link;
      }
    }
    return undefined;
  }

  private getCellClasses(link?: TraceabilityLink): string[] {
    const classes = ['matrix-cell'];
    
    if (link) {
      classes.push('has-relationship');
      
      if (link.strength >= 0.8) {
        classes.push('strong-relationship');
      } else if (link.strength >= 0.5) {
        classes.push('medium-relationship');
      } else {
        classes.push('weak-relationship');
      }

      if (link.isAutomatic) {
        classes.push('automatic-link');
      } else {
        classes.push('manual-link');
      }
    } else {
      classes.push('no-relationship');
    }

    return classes;
  }

  // Private methods for generating summaries

  private generateMatrixSummary(matrix: TraceabilityMatrix): ReportSummary {
    return {
      totalArtifacts: matrix.sources.length + matrix.targets.length,
      totalLinks: matrix.statistics.filledCells,
      keyFindings: [
        `Coverage: ${matrix.statistics.coveragePercentage.toFixed(1)}%`,
        `${matrix.statistics.filledCells} relationships out of ${matrix.statistics.totalCells} possible`,
        `Average relationship strength: ${matrix.statistics.averageStrength.toFixed(2)}`
      ],
      recommendationsByPriority: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      },
      healthScore: matrix.statistics.coveragePercentage
    };
  }

  private generateCoverageSummary(coverage: CoverageAnalysis): ReportSummary {
    return {
      totalArtifacts: coverage.overall.totalArtifacts,
      totalLinks: coverage.overall.totalLinks,
      keyFindings: [
        `Overall coverage: ${(coverage.overall.coveragePercent * 100).toFixed(1)}%`,
        `${coverage.gaps.length} coverage gaps identified`,
        `Link density: ${coverage.overall.linkDensity.toFixed(2)}`
      ],
      recommendationsByPriority: {
        critical: coverage.gaps.filter(g => g.severity === 'critical').length,
        high: coverage.gaps.filter(g => g.severity === 'high').length,
        medium: coverage.gaps.filter(g => g.severity === 'medium').length,
        low: coverage.gaps.filter(g => g.severity === 'low').length
      },
      healthScore: coverage.overall.completenessScore * 100
    };
  }

  private generateImpactSummary(impact: ImpactAnalysis): ReportSummary {
    return {
      totalArtifacts: impact.changedArtifacts.length + impact.impactedArtifacts.length,
      totalLinks: impact.brokenLinks.length,
      keyFindings: [
        `${impact.changedArtifacts.length} artifacts changed`,
        `${impact.impactedArtifacts.length} artifacts impacted`,
        `Risk level: ${impact.riskAssessment.overallRisk}`,
        `${impact.brokenLinks.length} broken links`
      ],
      recommendationsByPriority: {
        critical: impact.recommendations.filter(r => r.priority === 'critical').length,
        high: impact.recommendations.filter(r => r.priority === 'high').length,
        medium: impact.recommendations.filter(r => r.priority === 'medium').length,
        low: impact.recommendations.filter(r => r.priority === 'low').length
      },
      healthScore: this.calculateImpactHealthScore(impact)
    };
  }

  private generateGapsSummary(gapsCount: number, orphanedCount: number, missingCount: number): ReportSummary {
    const totalIssues = gapsCount + orphanedCount + missingCount;
    
    return {
      totalArtifacts: 0, // Will be filled by caller
      totalLinks: 0, // Will be filled by caller
      keyFindings: [
        `${gapsCount} coverage gaps found`,
        `${orphanedCount} orphaned artifacts`,
        `${missingCount} missing relationships suggested`
      ],
      recommendationsByPriority: {
        critical: Math.floor(totalIssues * 0.2),
        high: Math.floor(totalIssues * 0.3),
        medium: Math.floor(totalIssues * 0.3),
        low: Math.floor(totalIssues * 0.2)
      },
      healthScore: Math.max(0, 100 - totalIssues * 5)
    };
  }

  private generateTrendsSummary(trends: any[], qualityMetrics: any): ReportSummary {
    const latestTrend = trends[trends.length - 1];
    const previousTrend = trends[trends.length - 2];
    
    let changeDirection = 'stable';
    if (latestTrend && previousTrend) {
      if (latestTrend.metrics.coveragePercent > previousTrend.metrics.coveragePercent) {
        changeDirection = 'improving';
      } else if (latestTrend.metrics.coveragePercent < previousTrend.metrics.coveragePercent) {
        changeDirection = 'declining';
      }
    }

    return {
      totalArtifacts: latestTrend?.metrics.totalArtifacts || 0,
      totalLinks: latestTrend?.metrics.totalLinks || 0,
      keyFindings: [
        `Trend: ${changeDirection}`,
        `Quality score: ${(qualityMetrics.overall * 100).toFixed(1)}%`,
        `${trends.length} data points analyzed`
      ],
      recommendationsByPriority: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      },
      healthScore: qualityMetrics.overall * 100
    };
  }

  private calculateImpactHealthScore(impact: ImpactAnalysis): number {
    const riskScores = {
      critical: 0,
      high: 25,
      medium: 50,
      low: 75
    };

    return riskScores[impact.riskAssessment.overallRisk];
  }

  // Private methods for export formats

  private async exportToHTML(report: TraceabilityReport, filePath: string): Promise<void> {
    const template = this.templates.get('default_html') || this.createDefaultHTMLTemplate();
    let html = template.template;

    // Replace template variables
    html = html.replace('{{TITLE}}', report.name);
    html = html.replace('{{GENERATED_AT}}', report.generatedAt.toISOString());
    html = html.replace('{{DATA}}', JSON.stringify(report.data, null, 2));
    html = html.replace('{{SUMMARY}}', this.formatSummaryAsHTML(report.summary));
    html = html.replace('{{STYLES}}', template.styles || '');
    html = html.replace('{{SCRIPTS}}', template.scripts || '');

    // Add report-specific content based on type
    html = html.replace('{{CONTENT}}', this.generateHTMLContent(report));

    await writeFile(filePath, html, 'utf-8');
  }

  private async exportToCSV(report: TraceabilityReport, filePath: string): Promise<void> {
    let csv = '';

    if (report.type === 'matrix' && report.data.matrix) {
      csv = this.matrixToCSV(report.data.matrix);
    } else {
      // For non-matrix reports, create a generic CSV
      csv = this.dataToCSV(report);
    }

    await writeFile(filePath, csv, 'utf-8');
  }

  private async exportToJSON(report: TraceabilityReport, filePath: string): Promise<void> {
    const json = JSON.stringify(report, null, 2);
    await writeFile(filePath, json, 'utf-8');
  }

  private matrixToCSV(matrix: TraceabilityMatrix): string {
    const rows: string[] = [];
    
    // Header row
    const headerRow = ['Source\\Target', ...matrix.targets.map(t => t.name)];
    rows.push(headerRow.map(cell => `"${cell}"`).join(','));

    // Data rows
    for (let i = 0; i < matrix.sources.length; i++) {
      const source = matrix.sources[i];
      const row = [source.name];
      
      for (let j = 0; j < matrix.targets.length; j++) {
        const cell = matrix.cells[i][j];
        row.push(cell.hasRelationship ? 'X' : '');
      }
      
      rows.push(row.map(cell => `"${cell}"`).join(','));
    }

    return rows.join('\n');
  }

  private dataToCSV(report: TraceabilityReport): string {
    const rows: string[] = [];
    
    // Add report metadata
    rows.push('"Report Name","Value"');
    rows.push(`"${report.name}",""`);
    rows.push(`"Generated At","${report.generatedAt.toISOString()}"`);
    rows.push(`"Type","${report.type}"`);
    rows.push('');

    // Add summary data
    rows.push('"Summary","Value"');
    rows.push(`"Total Artifacts","${report.summary.totalArtifacts}"`);
    rows.push(`"Total Links","${report.summary.totalLinks}"`);
    rows.push(`"Health Score","${report.summary.healthScore}"`);

    return rows.join('\n');
  }

  private formatSummaryAsHTML(summary: ReportSummary): string {
    return `
      <div class="summary">
        <h3>Summary</h3>
        <ul>
          <li>Total Artifacts: ${summary.totalArtifacts}</li>
          <li>Total Links: ${summary.totalLinks}</li>
          <li>Health Score: ${summary.healthScore.toFixed(1)}%</li>
        </ul>
        <h4>Key Findings</h4>
        <ul>
          ${summary.keyFindings.map(finding => `<li>${finding}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  private generateHTMLContent(report: TraceabilityReport): string {
    switch (report.type) {
      case 'matrix':
        return this.generateMatrixHTML(report.data.matrix);
      case 'coverage':
        return this.generateCoverageHTML(report.data);
      case 'impact':
        return this.generateImpactHTML(report.data);
      default:
        return `<pre>${JSON.stringify(report.data, null, 2)}</pre>`;
    }
  }

  private generateMatrixHTML(matrix: TraceabilityMatrix): string {
    if (!matrix) return '';

    let html = `<div class="matrix-container">`;
    html += `<h3>${matrix.title}</h3>`;
    html += `<table class="traceability-matrix">`;
    
    // Header row
    html += `<tr><th>Source\\Target</th>`;
    for (const target of matrix.targets) {
      html += `<th class="target-header">${target.name}</th>`;
    }
    html += `</tr>`;

    // Data rows
    for (let i = 0; i < matrix.sources.length; i++) {
      const source = matrix.sources[i];
      html += `<tr><th class="source-header">${source.name}</th>`;
      
      for (let j = 0; j < matrix.targets.length; j++) {
        const cell = matrix.cells[i][j];
        const classes = cell.cssClasses.join(' ');
        const content = cell.hasRelationship ? '●' : '';
        html += `<td class="${classes}" title="${cell.link?.linkType || 'No relationship'}">${content}</td>`;
      }
      
      html += `</tr>`;
    }

    html += `</table>`;
    html += `<div class="matrix-stats">`;
    html += `<p>Coverage: ${matrix.statistics.coveragePercentage.toFixed(1)}%</p>`;
    html += `<p>Filled Cells: ${matrix.statistics.filledCells}/${matrix.statistics.totalCells}</p>`;
    html += `</div>`;
    html += `</div>`;

    return html;
  }

  private generateCoverageHTML(data: any): string {
    return `
      <div class="coverage-analysis">
        <h3>Coverage Analysis</h3>
        <div class="coverage-metrics">
          <div class="metric">
            <span class="metric-label">Overall Coverage:</span>
            <span class="metric-value">${(data.overall.coveragePercent * 100).toFixed(1)}%</span>
          </div>
          <div class="metric">
            <span class="metric-label">Total Artifacts:</span>
            <span class="metric-value">${data.overall.totalArtifacts}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Total Links:</span>
            <span class="metric-value">${data.overall.totalLinks}</span>
          </div>
        </div>
        <h4>Gaps</h4>
        <ul class="gaps-list">
          ${data.gaps.map((gap: any) => `
            <li class="gap-item ${gap.severity}">
              <strong>${gap.type}:</strong> ${gap.description}
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  private generateImpactHTML(data: any): string {
    return `
      <div class="impact-analysis">
        <h3>Impact Analysis</h3>
        <div class="risk-level risk-${data.riskAssessment.overallRisk}">
          Risk Level: ${data.riskAssessment.overallRisk.toUpperCase()}
        </div>
        <h4>Changed Artifacts (${data.changedArtifacts.length})</h4>
        <ul>
          ${data.changedArtifacts.map((change: any) => `
            <li>${change.artifact.name} (${change.changeType})</li>
          `).join('')}
        </ul>
        <h4>Impacted Artifacts (${data.impactedArtifacts.length})</h4>
        <ul>
          ${data.impactedArtifacts.map((impact: any) => `
            <li>${impact.artifact.name} (${impact.impactLevel}, confidence: ${impact.confidence.toFixed(2)})</li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  // Private helper methods

  private generateReportId(type: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${type}-${timestamp}`;
  }

  private initializeDefaultTemplates(): void {
    const defaultHTML: ReportTemplate = {
      id: 'default_html',
      name: 'Default HTML Template',
      type: 'custom',
      description: 'Standard HTML report template',
      defaultParameters: {},
      template: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>{{TITLE}}</title>
          <style>{{STYLES}}</style>
        </head>
        <body>
          <header>
            <h1>{{TITLE}}</h1>
            <p>Generated at: {{GENERATED_AT}}</p>
          </header>
          <main>
            {{SUMMARY}}
            {{CONTENT}}
          </main>
          <script>{{SCRIPTS}}</script>
        </body>
        </html>
      `,
      styles: `
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
        .traceability-matrix { border-collapse: collapse; width: 100%; }
        .traceability-matrix th, .traceability-matrix td { 
          border: 1px solid #ddd; padding: 8px; text-align: center; 
        }
        .traceability-matrix th { background-color: #f2f2f2; }
        .has-relationship { background-color: #d4edda; }
        .no-relationship { background-color: #f8d7da; }
        .strong-relationship { background-color: #28a745; color: white; }
        .medium-relationship { background-color: #ffc107; }
        .weak-relationship { background-color: #fd7e14; }
        .summary { background-color: #f8f9fa; padding: 15px; margin-bottom: 20px; }
        .metric { margin: 10px 0; }
        .metric-label { font-weight: bold; }
        .gaps-list { list-style-type: none; padding: 0; }
        .gap-item { margin: 10px 0; padding: 10px; border-left: 4px solid #ccc; }
        .gap-item.critical { border-left-color: #dc3545; }
        .gap-item.high { border-left-color: #fd7e14; }
        .gap-item.medium { border-left-color: #ffc107; }
        .gap-item.low { border-left-color: #28a745; }
        .risk-critical { background-color: #dc3545; color: white; padding: 10px; }
        .risk-high { background-color: #fd7e14; color: white; padding: 10px; }
        .risk-medium { background-color: #ffc107; color: black; padding: 10px; }
        .risk-low { background-color: #28a745; color: white; padding: 10px; }
      `
    };

    this.templates.set('default_html', defaultHTML);
  }

  private createDefaultHTMLTemplate(): ReportTemplate {
    return this.templates.get('default_html')!;
  }
}