import type { BenchmarkSuite, QualityGatesEvaluation } from './types';

export class BenchmarkReporter {
  async generate(suite: BenchmarkSuite, gateResults: QualityGatesEvaluation): Promise<void> {
    console.log('📊 Generating benchmark reports...');

    // Generate JSON report
    await this.generateJsonReport(suite, gateResults);

    // Generate Markdown report  
    await this.generateMarkdownReport(suite, gateResults);

    // Generate HTML report (for CI visualization)
    await this.generateHtmlReport(suite, gateResults);

    // Generate JUnit XML (for CI integration)
    await this.generateJunitReport(suite, gateResults);

    console.log('  ✅ Reports generated in ./benchmarks/ directory');
  }

  private async generateJsonReport(suite: BenchmarkSuite, gateResults: QualityGatesEvaluation): Promise<void> {
    const report = {
      ...suite,
      quality_gates: gateResults,
      generated_at: new Date().toISOString(),
    };

    const reportsDir = './benchmarks/reports';
    await this.ensureDirectory(reportsDir);
    
    await Bun.write(
      `${reportsDir}/benchmark-results.json`,
      JSON.stringify(report, null, 2)
    );
  }

  private async generateMarkdownReport(suite: BenchmarkSuite, gateResults: QualityGatesEvaluation): Promise<void> {
    let markdown = `# Benchmark Report

Generated: ${new Date().toISOString()}  
Duration: ${Math.round(suite.summary.total_duration)}ms  
Quality Score: ${gateResults.score}/100  

`;

    // Environment info
    markdown += `## Environment

- **Bun Version:** ${suite.environment.bun_version}
- **Node Version:** ${suite.environment.node_version}  
- **OS:** ${suite.environment.os}
- **Memory:** ${suite.environment.memory}MB
- **CPU Cores:** ${suite.environment.cpu_count}

`;

    // Quality gates summary
    markdown += `## Quality Gates Summary

| Status | Count | Percentage |
|--------|-------|------------|
| ✅ Passed | ${gateResults.passed.length} | ${Math.round((gateResults.passed.length / (gateResults.passed.length + gateResults.failed.length)) * 100)}% |
| ❌ Failed | ${gateResults.failed.length} | ${Math.round((gateResults.failed.length / (gateResults.passed.length + gateResults.failed.length)) * 100)}% |

`;

    if (gateResults.failed.length > 0) {
      markdown += `### Failed Gates

| Gate | Actual | Threshold | Reason |
|------|--------|-----------|--------|
`;
      for (const gate of gateResults.failed) {
        markdown += `| ${gate.name} | ${gate.actual} | ${gate.threshold} | ${gate.reason} |\\n`;
      }
      markdown += '\\n';
    }

    // Benchmark results
    markdown += `## Benchmark Results

`;

    for (const result of suite.results) {
      markdown += `### ${result.name}

**Type:** ${result.type}  
**Duration:** ${Math.round(result.duration)}ms  

| Metric | Value |
|--------|-------|
`;
      for (const [key, value] of Object.entries(result.metrics)) {
        markdown += `| ${key.replace(/_/g, ' ').replace(/\\b\\w/g, l => l.toUpperCase())} | ${value} |\\n`;
      }
      markdown += '\\n';
    }

    // Performance trends (if baseline exists)
    if (suite.baseline) {
      markdown += `## Performance Trends

Compared to baseline from ${suite.baseline.timestamp}:

`;

      for (const result of suite.results) {
        const baselineResult = suite.baseline;
        if (baselineResult.type === result.type) {
          markdown += `### ${result.name} Trends

| Metric | Current | Baseline | Change |
|--------|---------|----------|--------|
`;
          for (const [key, value] of Object.entries(result.metrics)) {
            const baselineValue = baselineResult.metrics[key];
            if (typeof value === 'number' && typeof baselineValue === 'number') {
              const change = ((value - baselineValue) / baselineValue) * 100;
              const changeStr = change > 0 ? `+${Math.round(change * 100) / 100}%` : `${Math.round(change * 100) / 100}%`;
              const emoji = Math.abs(change) < 5 ? '➡️' : (change > 0 ? '⬆️' : '⬇️');
              markdown += `| ${key.replace(/_/g, ' ')} | ${value} | ${baselineValue} | ${emoji} ${changeStr} |\\n`;
            }
          }
          markdown += '\\n';
        }
      }
    }

    const reportsDir = './benchmarks/reports';
    await this.ensureDirectory(reportsDir);
    
    await Bun.write(`${reportsDir}/benchmark-report.md`, markdown);
  }

  private async generateHtmlReport(suite: BenchmarkSuite, gateResults: QualityGatesEvaluation): Promise<void> {
    const html = `<!DOCTYPE html>
<html>
<head>
    <title>Arbiter Benchmark Report</title>
    <meta charset="utf-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 40px; }
        .header { border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 30px; }
        .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric-card { border: 1px solid #ddd; border-radius: 8px; padding: 20px; }
        .metric-title { font-weight: bold; margin-bottom: 10px; }
        .metric-value { font-size: 24px; margin: 10px 0; }
        .pass { color: #28a745; }
        .fail { color: #dc3545; }
        .warning { color: #ffc107; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { text-align: left; padding: 12px; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; }
        .status-badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        .status-pass { background-color: #d4edda; color: #155724; }
        .status-fail { background-color: #f8d7da; color: #721c24; }
        .chart-container { margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div class="header">
        <h1>🚀 Arbiter Benchmark Report</h1>
        <p><strong>Generated:</strong> ${new Date().toISOString()}</p>
        <p><strong>Duration:</strong> ${Math.round(suite.summary.total_duration)}ms</p>
        <p><strong>Quality Score:</strong> <span class="${gateResults.score >= 80 ? 'pass' : 'fail'}">${gateResults.score}/100</span></p>
    </div>

    <div class="metric-grid">
        <div class="metric-card">
            <div class="metric-title">Environment</div>
            <div>Bun ${suite.environment.bun_version}</div>
            <div>${suite.environment.os}</div>
            <div>${suite.environment.memory}MB RAM, ${suite.environment.cpu_count} cores</div>
        </div>
        <div class="metric-card">
            <div class="metric-title">Quality Gates</div>
            <div class="metric-value pass">${gateResults.passed.length} Passed</div>
            <div class="metric-value fail">${gateResults.failed.length} Failed</div>
        </div>
        <div class="metric-card">
            <div class="metric-title">Performance</div>
            <div class="${gateResults.hasRegression ? 'fail' : 'pass'}">
                ${gateResults.hasRegression ? '⬇️ Regression Detected' : '✅ No Regressions'}
            </div>
        </div>
        <div class="metric-card">
            <div class="metric-title">Security</div>
            <div class="${gateResults.securityIssues > 0 ? 'fail' : 'pass'}">
                ${gateResults.securityIssues} Issues Found
            </div>
        </div>
    </div>

    <h2>Quality Gates</h2>
    <table>
        <thead>
            <tr>
                <th>Gate</th>
                <th>Status</th>
                <th>Actual</th>
                <th>Threshold</th>
                <th>Reason</th>
            </tr>
        </thead>
        <tbody>
            ${[...gateResults.passed, ...gateResults.failed]
              .map(gate => `
                <tr>
                    <td>${gate.name}</td>
                    <td><span class="status-badge ${gate.passed ? 'status-pass' : 'status-fail'}">${gate.passed ? 'PASS' : 'FAIL'}</span></td>
                    <td>${gate.actual}</td>
                    <td>${gate.threshold}</td>
                    <td>${gate.reason}</td>
                </tr>
              `).join('')}
        </tbody>
    </table>

    <h2>Benchmark Results</h2>
    ${suite.results.map(result => `
        <div class="metric-card">
            <h3>${result.name}</h3>
            <p><strong>Type:</strong> ${result.type} | <strong>Duration:</strong> ${Math.round(result.duration)}ms</p>
            <table>
                <tbody>
                    ${Object.entries(result.metrics).map(([key, value]) => `
                        <tr>
                            <td>${key.replace(/_/g, ' ').replace(/\\b\\w/g, l => l.toUpperCase())}</td>
                            <td>${value}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `).join('')}

    <div class="chart-container">
        <h3>Performance Metrics</h3>
        <canvas id="performanceChart" width="400" height="200"></canvas>
    </div>

    <script>
        // Generate performance chart
        const ctx = document.getElementById('performanceChart').getContext('2d');
        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ${JSON.stringify(suite.results.map(r => r.name))},
                datasets: [{
                    label: 'Duration (ms)',
                    data: ${JSON.stringify(suite.results.map(r => r.duration))},
                    backgroundColor: 'rgba(54, 162, 235, 0.6)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    </script>
</body>
</html>`;

    const reportsDir = './benchmarks/reports';
    await this.ensureDirectory(reportsDir);
    
    await Bun.write(`${reportsDir}/benchmark-report.html`, html);
  }

  private async generateJunitReport(suite: BenchmarkSuite, gateResults: QualityGatesEvaluation): Promise<void> {
    const totalTests = gateResults.passed.length + gateResults.failed.length;
    const failures = gateResults.failed.length;
    const time = Math.round(suite.summary.total_duration / 1000);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="Arbiter Benchmarks" tests="${totalTests}" failures="${failures}" time="${time}">
`;

    // Add test cases for each quality gate
    for (const gate of [...gateResults.passed, ...gateResults.failed]) {
      xml += `  <testcase classname="QualityGates" name="${gate.name}" time="0">\\n`;
      
      if (!gate.passed) {
        xml += `    <failure message="${gate.reason}">
Actual: ${gate.actual}
Threshold: ${gate.threshold}
Reason: ${gate.reason}
    </failure>\\n`;
      }
      
      xml += `  </testcase>\\n`;
    }

    xml += `</testsuite>`;

    const reportsDir = './benchmarks/reports';
    await this.ensureDirectory(reportsDir);
    
    await Bun.write(`${reportsDir}/benchmark-junit.xml`, xml);
  }

  private async ensureDirectory(path: string): Promise<void> {
    try {
      await Bun.$`mkdir -p ${path}`;
    } catch (error) {
      // Directory might already exist
    }
  }
}