import type { SecuritySuite, SecurityGatesEvaluation } from './types';

export class SecurityReporter {
  async generate(
    suite: SecuritySuite, 
    gateResults: SecurityGatesEvaluation, 
    formats: ('json' | 'html' | 'sarif' | 'junit')[]
  ): Promise<void> {
    console.log('📊 Generating security reports...');

    const reportsDir = './security/reports';
    await this.ensureDirectory(reportsDir);

    // Generate requested formats
    for (const format of formats) {
      switch (format) {
        case 'json':
          await this.generateJsonReport(suite, gateResults, reportsDir);
          break;
        case 'html':
          await this.generateHtmlReport(suite, gateResults, reportsDir);
          break;
        case 'sarif':
          await this.generateSarifReport(suite, reportsDir);
          break;
        case 'junit':
          await this.generateJunitReport(suite, gateResults, reportsDir);
          break;
      }
    }

    console.log('  ✅ Security reports generated');
  }

  private async generateJsonReport(
    suite: SecuritySuite, 
    gateResults: SecurityGatesEvaluation, 
    reportsDir: string
  ): Promise<void> {
    const report = {
      ...suite,
      quality_gates: gateResults,
      generated_at: new Date().toISOString(),
    };

    await Bun.write(
      `${reportsDir}/security-results.json`,
      JSON.stringify(report, null, 2)
    );
  }

  private async generateHtmlReport(
    suite: SecuritySuite, 
    gateResults: SecurityGatesEvaluation, 
    reportsDir: string
  ): Promise<void> {
    const html = `<!DOCTYPE html>
<html>
<head>
    <title>Arbiter Security Report</title>
    <meta charset="utf-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 40px; background: #f5f5f5; }
        .container { background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 30px; }
        .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric-card { border: 1px solid #ddd; border-radius: 8px; padding: 20px; background: #f9f9f9; }
        .metric-title { font-weight: bold; margin-bottom: 10px; color: #333; }
        .metric-value { font-size: 24px; margin: 10px 0; font-weight: bold; }
        .critical { color: #d73a49; }
        .high { color: #e36209; }
        .medium { color: #f66a0a; }
        .low { color: #28a745; }
        .pass { color: #28a745; }
        .fail { color: #d73a49; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { text-align: left; padding: 12px; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; font-weight: 600; }
        .severity-badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
        .severity-critical { background-color: #ffeaea; color: #d73a49; }
        .severity-high { background-color: #fff4e6; color: #e36209; }
        .severity-medium { background-color: #fff8e6; color: #f66a0a; }
        .severity-low { background-color: #f0fff4; color: #28a745; }
        .gate-passed { background-color: #d4edda; color: #155724; }
        .gate-failed { background-color: #f8d7da; color: #721c24; }
        .scanner-section { margin: 30px 0; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
        .vulnerability-list { max-height: 300px; overflow-y: auto; }
        .chart-container { margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔒 Arbiter Security Report</h1>
            <p><strong>Generated:</strong> ${new Date().toISOString()}</p>
            <p><strong>Duration:</strong> ${Math.round(suite.summary.scan_duration_ms)}ms</p>
            <p><strong>Quality Score:</strong> <span class="${gateResults.score >= 80 ? 'pass' : 'fail'}">${gateResults.score}/100</span></p>
        </div>

        <div class="metric-grid">
            <div class="metric-card">
                <div class="metric-title">Environment</div>
                <div>Bun ${suite.environment.bun_version}</div>
                <div>${suite.environment.os}</div>
                <div>Node ${suite.environment.node_version}</div>
            </div>
            <div class="metric-card">
                <div class="metric-title">Total Vulnerabilities</div>
                <div class="metric-value ${suite.summary.total_vulnerabilities > 0 ? 'fail' : 'pass'}">
                    ${suite.summary.total_vulnerabilities}
                </div>
            </div>
            <div class="metric-card">
                <div class="metric-title">Critical Issues</div>
                <div class="metric-value critical">${suite.summary.critical_vulnerabilities}</div>
            </div>
            <div class="metric-card">
                <div class="metric-title">Quality Gates</div>
                <div class="metric-value pass">${suite.summary.passed_gates} Passed</div>
                <div class="metric-value fail">${suite.summary.failed_gates} Failed</div>
            </div>
        </div>

        <h2>Security Gates Results</h2>
        <table>
            <thead>
                <tr>
                    <th>Gate</th>
                    <th>Status</th>
                    <th>Found</th>
                    <th>Max Allowed</th>
                    <th>Severity</th>
                    <th>Blocking</th>
                </tr>
            </thead>
            <tbody>
                ${[...gateResults.passed, ...gateResults.failed]
                  .map(gate => `
                    <tr class="${gate.passed ? 'gate-passed' : 'gate-failed'}">
                        <td><strong>${gate.name}</strong></td>
                        <td>${gate.passed ? '✅ PASS' : '❌ FAIL'}</td>
                        <td>${gate.actual_count}</td>
                        <td>${gate.max_allowed}</td>
                        <td><span class="severity-badge severity-${gate.severity}">${gate.severity}</span></td>
                        <td>${gate.blocking ? '🚫 Yes' : '⚠️ No'}</td>
                    </tr>
                  `).join('')}
            </tbody>
        </table>

        <h2>Scanner Results</h2>
        ${suite.scans.map(scan => `
            <div class="scanner-section">
                <h3>🔍 ${scan.scanner} ${scan.version ? `(${scan.version})` : ''}</h3>
                <div class="metric-grid">
                    <div class="metric-card">
                        <div class="metric-title">Scan Duration</div>
                        <div class="metric-value">${Math.round(scan.scan_duration_ms)}ms</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-title">Total Issues</div>
                        <div class="metric-value">${scan.summary.total}</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-title">By Severity</div>
                        <div><span class="critical">Critical: ${scan.summary.critical}</span></div>
                        <div><span class="high">High: ${scan.summary.high}</span></div>
                        <div><span class="medium">Medium: ${scan.summary.medium}</span></div>
                        <div><span class="low">Low: ${scan.summary.low}</span></div>
                    </div>
                </div>
                
                ${scan.vulnerabilities.length > 0 ? `
                <div class="vulnerability-list">
                    <table>
                        <thead>
                            <tr>
                                <th>Issue</th>
                                <th>Severity</th>
                                <th>File</th>
                                <th>Line</th>
                                <th>Category</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${scan.vulnerabilities.slice(0, 20).map(vuln => `
                                <tr>
                                    <td><strong>${vuln.title}</strong><br><small>${vuln.description}</small></td>
                                    <td><span class="severity-badge severity-${vuln.severity}">${vuln.severity}</span></td>
                                    <td>${vuln.file || 'N/A'}</td>
                                    <td>${vuln.line || 'N/A'}</td>
                                    <td>${vuln.category}</td>
                                </tr>
                            `).join('')}
                            ${scan.vulnerabilities.length > 20 ? `
                                <tr>
                                    <td colspan="5"><em>... and ${scan.vulnerabilities.length - 20} more issues</em></td>
                                </tr>
                            ` : ''}
                        </tbody>
                    </table>
                </div>
                ` : '<p>✅ No vulnerabilities found by this scanner.</p>'}
            </div>
        `).join('')}

        <div class="chart-container">
            <h3>Vulnerability Distribution</h3>
            <canvas id="vulnerabilityChart" width="400" height="200"></canvas>
        </div>

    </div>

    <script>
        // Generate vulnerability distribution chart
        const ctx = document.getElementById('vulnerabilityChart').getContext('2d');
        const chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Critical', 'High', 'Medium', 'Low'],
                datasets: [{
                    data: [
                        ${suite.summary.critical_vulnerabilities},
                        ${suite.summary.high_vulnerabilities},
                        ${suite.scans.reduce((sum, scan) => sum + scan.summary.medium, 0)},
                        ${suite.scans.reduce((sum, scan) => sum + scan.summary.low, 0)}
                    ],
                    backgroundColor: [
                        '#d73a49',
                        '#e36209', 
                        '#f66a0a',
                        '#28a745'
                    ],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    </script>
</body>
</html>`;

    await Bun.write(`${reportsDir}/security-report.html`, html);
  }

  private async generateSarifReport(suite: SecuritySuite, reportsDir: string): Promise<void> {
    // SARIF (Static Analysis Results Interchange Format) report
    const sarif = {
      version: '2.1.0',
      '$schema': 'https://json.schemastore.org/sarif-2.1.0.json',
      runs: suite.scans.map(scan => ({
        tool: {
          driver: {
            name: scan.scanner,
            version: scan.version || '1.0.0',
            informationUri: 'https://github.com/arbiter-project/security',
          },
        },
        results: scan.vulnerabilities.map(vuln => ({
          ruleId: vuln.id,
          level: this.mapSeverityToSarifLevel(vuln.severity),
          message: {
            text: vuln.description,
          },
          locations: vuln.file ? [{
            physicalLocation: {
              artifactLocation: {
                uri: vuln.file,
              },
              region: vuln.line ? {
                startLine: vuln.line,
                startColumn: vuln.column || 1,
              } : undefined,
            },
          }] : [],
          properties: {
            category: vuln.category,
            confidence: vuln.confidence,
            cve: vuln.cve,
            cwe: vuln.cwe,
          },
        })),
        properties: {
          scanDuration: scan.scan_duration_ms,
          summary: scan.summary,
        },
      })),
    };

    await Bun.write(
      `${reportsDir}/security-report.sarif`,
      JSON.stringify(sarif, null, 2)
    );
  }

  private async generateJunitReport(
    suite: SecuritySuite, 
    gateResults: SecurityGatesEvaluation, 
    reportsDir: string
  ): Promise<void> {
    const totalTests = gateResults.passed.length + gateResults.failed.length;
    const failures = gateResults.failed.length;
    const time = Math.round(suite.summary.scan_duration_ms / 1000);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="Arbiter Security Scans" tests="${totalTests}" failures="${failures}" time="${time}">
`;

    // Add test cases for each security gate
    for (const gate of [...gateResults.passed, ...gateResults.failed]) {
      xml += `  <testcase classname="SecurityGates" name="${gate.name}" time="0">\\n`;
      
      if (!gate.passed) {
        xml += `    <failure message="Security gate failed">
Found: ${gate.actual_count}
Max Allowed: ${gate.max_allowed}
Severity: ${gate.severity}
Blocking: ${gate.blocking}
    </failure>\\n`;
      }
      
      xml += `  </testcase>\\n`;
    }

    // Add test cases for each scanner
    for (const scan of suite.scans) {
      xml += `  <testcase classname="SecurityScanners" name="${scan.scanner}" time="${Math.round(scan.scan_duration_ms / 1000)}">\\n`;
      
      if (scan.summary.critical > 0 || scan.summary.high > 0) {
        xml += `    <failure message="Security vulnerabilities found">
Critical: ${scan.summary.critical}
High: ${scan.summary.high}
Medium: ${scan.summary.medium}
Low: ${scan.summary.low}
    </failure>\\n`;
      }
      
      xml += `  </testcase>\\n`;
    }

    xml += `</testsuite>`;

    await Bun.write(`${reportsDir}/security-junit.xml`, xml);
  }

  private mapSeverityToSarifLevel(severity: string): string {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'note';
      default:
        return 'info';
    }
  }

  private async ensureDirectory(path: string): Promise<void> {
    try {
      await Bun.$`mkdir -p ${path}`;
    } catch (error) {
      // Directory might already exist
    }
  }
}