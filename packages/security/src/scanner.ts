#!/usr/bin/env bun

import { performance } from 'perf_hooks';
import { sastScan } from './sast-scan';
import { dependencyScan } from './dependency-scan';
import { containerScan } from './container-scan';
import { secretScan } from './secret-scan';
import { apiSecurityScan } from './api-security-scan';
import { SecurityGates } from './security-gates';
import { SecurityReporter } from './security-reporter';
import type { SecuritySuite, SecurityConfig } from './types';

export class SecurityScanner {
  private config: SecurityConfig;
  private gates: SecurityGates;
  private reporter: SecurityReporter;

  constructor(config: SecurityConfig) {
    this.config = config;
    this.gates = new SecurityGates(config.gates);
    this.reporter = new SecurityReporter();
  }

  async scanAll(): Promise<SecuritySuite> {
    const startTime = performance.now();

    console.log('🔒 Starting Arbiter Security Scanning Suite');
    console.log('==========================================');

    // Environment information
    const environment = {
      os: `${process.platform} ${process.arch}`,
      arch: process.arch,
      node_version: process.version,
      bun_version: Bun.version,
    };

    console.log('📋 Environment:', environment);

    const scans = [];
    let totalVulnerabilities = 0;
    let criticalVulnerabilities = 0;
    let highVulnerabilities = 0;

    try {
      // Static Application Security Testing (SAST)
      if (this.config.scanners.sast.enabled) {
        console.log('\\n🔍 Running SAST Analysis...');
        const sastResult = await sastScan(this.config.scanners.sast);
        scans.push(sastResult);
        totalVulnerabilities += sastResult.summary.total;
        criticalVulnerabilities += sastResult.summary.critical;
        highVulnerabilities += sastResult.summary.high;
      }

      // Dependency Vulnerability Scanning
      if (this.config.scanners.dependency.enabled) {
        console.log('\\n📦 Running Dependency Vulnerability Scan...');
        const depResult = await dependencyScan(this.config.scanners.dependency);
        scans.push(depResult);
        totalVulnerabilities += depResult.summary.total;
        criticalVulnerabilities += depResult.summary.critical;
        highVulnerabilities += depResult.summary.high;
      }

      // Container Security Scanning
      if (this.config.scanners.container.enabled) {
        console.log('\\n🐳 Running Container Security Scan...');
        const containerResult = await containerScan(this.config.scanners.container);
        scans.push(containerResult);
        totalVulnerabilities += containerResult.summary.total;
        criticalVulnerabilities += containerResult.summary.critical;
        highVulnerabilities += containerResult.summary.high;
      }

      // Secrets Detection
      if (this.config.scanners.secrets.enabled) {
        console.log('\\n🔐 Running Secrets Detection...');
        const secretResult = await secretScan(this.config.scanners.secrets);
        scans.push(secretResult);
        totalVulnerabilities += secretResult.summary.total;
        criticalVulnerabilities += secretResult.summary.critical;
        highVulnerabilities += secretResult.summary.high;
      }

      // API Security Testing
      if (this.config.scanners.api_security.enabled) {
        console.log('\\n🌐 Running API Security Analysis...');
        const apiResult = await apiSecurityScan(this.config.scanners.api_security);
        scans.push(apiResult);
        totalVulnerabilities += apiResult.summary.total;
        criticalVulnerabilities += apiResult.summary.critical;
        highVulnerabilities += apiResult.summary.high;
      }

    } catch (error) {
      console.error('❌ Security scanning failed:', error);
      if (this.config.fail_on_error) {
        throw error;
      }
    }

    const scanDuration = performance.now() - startTime;

    // Evaluate security gates
    console.log('\\n🚧 Evaluating Security Gates...');
    const gateResults = await this.gates.evaluate(scans);

    const suite: SecuritySuite = {
      version: '0.1.0',
      environment,
      scans,
      summary: {
        total_vulnerabilities: totalVulnerabilities,
        critical_vulnerabilities: criticalVulnerabilities,
        high_vulnerabilities: highVulnerabilities,
        passed_gates: gateResults.passed.length,
        failed_gates: gateResults.failed.length,
        scan_duration_ms: scanDuration,
      },
      generated_at: new Date().toISOString(),
    };

    // Generate reports
    console.log('\\n📊 Generating Security Reports...');
    await this.reporter.generate(suite, gateResults, this.config.report_formats);

    // Print summary
    this.printSummary(suite, gateResults);

    return suite;
  }

  private printSummary(suite: SecuritySuite, gateResults: any) {
    console.log('\\n📋 SECURITY SCAN SUMMARY');
    console.log('========================');
    console.log(`⏱️  Total Duration: ${Math.round(suite.summary.scan_duration_ms)}ms`);
    console.log(`🔍 Scanners Run: ${suite.scans.length}`);
    console.log(`🚨 Total Vulnerabilities: ${suite.summary.total_vulnerabilities}`);
    console.log(`  - Critical: ${suite.summary.critical_vulnerabilities}`);
    console.log(`  - High: ${suite.summary.high_vulnerabilities}`);
    console.log(`✅ Passed Gates: ${suite.summary.passed_gates}`);
    console.log(`❌ Failed Gates: ${suite.summary.failed_gates}`);

    if (gateResults.failed.length > 0) {
      console.log('\\n⚠️  FAILED SECURITY GATES:');
      gateResults.failed.forEach((gate: any) => {
        console.log(`  - ${gate.name}: ${gate.actual_count}/${gate.max_allowed} ${gate.severity} issues${gate.blocking ? ' (BLOCKING)' : ''}`);
      });
    }

    // Determine exit status
    const hasBlockingFailures = gateResults.failed.some((gate: any) => gate.blocking);
    const hasCriticalVulns = suite.summary.critical_vulnerabilities > 0;

    if (hasBlockingFailures || hasCriticalVulns) {
      console.log('\\n❌ SECURITY GATES FAILED - Build should be blocked');
      if (this.config.fail_on_error) {
        process.exit(1);
      }
    } else if (suite.summary.high_vulnerabilities > 0) {
      console.log('\\n⚠️  HIGH SEVERITY VULNERABILITIES FOUND - Review recommended');
    } else {
      console.log('\\n✅ ALL SECURITY GATES PASSED - Build can proceed');
    }
  }
}

// CLI entry point
if (import.meta.main) {
  const config: SecurityConfig = {
    scanners: {
      sast: {
        enabled: true,
        timeout_ms: 300000, // 5 minutes
        additional_args: ['--config=auto', '--severity=INFO'],
      },
      dependency: {
        enabled: true,
        timeout_ms: 180000, // 3 minutes
      },
      container: {
        enabled: process.env.CI === 'true', // Only in CI by default
        timeout_ms: 600000, // 10 minutes
      },
      secrets: {
        enabled: true,
        timeout_ms: 120000, // 2 minutes
      },
      api_security: {
        enabled: true,
        timeout_ms: 300000, // 5 minutes
      },
    },
    gates: [
      {
        name: 'No Critical Vulnerabilities',
        severity: 'critical',
        max_count: 0,
        blocking: true,
      },
      {
        name: 'Limited High Severity Issues',
        severity: 'high',
        max_count: 5,
        blocking: true,
      },
      {
        name: 'No Secrets in Code',
        severity: 'high',
        max_count: 0,
        scanner: 'secrets',
        blocking: true,
      },
    ],
    report_formats: ['json', 'html', 'sarif'],
    fail_on_error: process.env.CI === 'true',
  };

  const scanner = new SecurityScanner(config);

  try {
    await scanner.scanAll();
  } catch (error) {
    console.error('💥 Security scanning failed:', error);
    process.exit(1);
  }
}