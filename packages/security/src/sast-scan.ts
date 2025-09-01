import { spawn } from 'bun';
import { performance } from 'perf_hooks';
import type { SecurityScanResult, ScannerConfig } from './types';

export async function sastScan(config: ScannerConfig): Promise<SecurityScanResult> {
  const startTime = performance.now();
  
  console.log('🔍 Running Semgrep SAST analysis...');

  // Semgrep rules to focus on
  const rulesets = [
    'p/security-audit',
    'p/javascript',
    'p/typescript', 
    'p/docker',
    'p/secrets',
    'p/owasp-top-ten',
  ];

  const vulnerabilities = [];
  let semgrepVersion = '';

  try {
    // Get Semgrep version
    const versionProc = spawn(['semgrep', '--version'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    
    await versionProc.exited;
    if (versionProc.exitCode === 0) {
      semgrepVersion = (await new Response(versionProc.stdout).text()).trim();
    }

    // Run Semgrep scan
    const args = [
      'semgrep',
      '--config', rulesets.join(','),
      '--json',
      '--no-git-ignore', // Scan all files
      '--timeout', '30', // 30 seconds per file
      '--max-chars-per-line', '10000',
      '--max-lines-per-finding', '10',
      ...(config.additional_args || []),
      '.',
    ];

    console.log(`  📋 Running: ${args.join(' ')}`);

    const proc = spawn(args, {
      stdout: 'pipe',
      stderr: 'pipe',
      cwd: process.cwd(),
    });

    // Set timeout
    const timeoutMs = config.timeout_ms || 300000; // 5 minutes default
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        proc.kill();
        reject(new Error(`SAST scan timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    await Promise.race([proc.exited, timeoutPromise]);

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();

    if (proc.exitCode !== 0 && proc.exitCode !== 1) {
      // Exit code 1 is expected when findings are present
      throw new Error(`Semgrep failed with exit code ${proc.exitCode}: ${stderr}`);
    }

    if (stdout.trim()) {
      const results = JSON.parse(stdout);
      
      console.log(`  🔍 Found ${results.results?.length || 0} potential issues`);

      for (const finding of results.results || []) {
        // Map Semgrep severity to our standard levels
        let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
        
        switch (finding.extra?.severity?.toLowerCase()) {
          case 'error':
            severity = 'high';
            break;
          case 'warning':
            severity = 'medium';
            break;
          case 'info':
            severity = 'low';
            break;
        }

        // Elevate certain categories to critical
        if (finding.extra?.metadata?.category?.includes('security') && 
            finding.extra?.metadata?.cwe?.includes('89')) { // SQL Injection
          severity = 'critical';
        }

        vulnerabilities.push({
          id: finding.check_id,
          severity,
          title: finding.extra?.message || finding.check_id,
          description: finding.extra?.metadata?.shortDescription || finding.extra?.message || '',
          file: finding.path,
          line: finding.start?.line,
          column: finding.start?.col,
          cwe: finding.extra?.metadata?.cwe?.[0],
          category: finding.extra?.metadata?.category || 'security',
          confidence: mapSemgrepConfidence(finding.extra?.metadata?.confidence),
          impact: finding.extra?.metadata?.impact,
          recommendation: finding.extra?.fix || finding.extra?.metadata?.references?.[0],
          references: finding.extra?.metadata?.references || [],
        });
      }
    }

    // Filter out low-confidence findings in non-security categories
    const filteredVulns = vulnerabilities.filter(vuln => {
      if (vuln.category !== 'security' && vuln.confidence === 'low') {
        return false;
      }
      return true;
    });

    console.log(`  ✅ Filtered to ${filteredVulns.length} high-confidence findings`);

  } catch (error) {
    console.error('  ❌ SAST scan failed:', error);
    
    // Don't fail the entire pipeline for SAST issues unless it's a critical error
    if (error instanceof Error && !error.message.includes('timeout')) {
      throw error;
    }
  }

  const duration = performance.now() - startTime;

  // Calculate summary
  const summary = {
    critical: vulnerabilities.filter(v => v.severity === 'critical').length,
    high: vulnerabilities.filter(v => v.severity === 'high').length,
    medium: vulnerabilities.filter(v => v.severity === 'medium').length,
    low: vulnerabilities.filter(v => v.severity === 'low').length,
    total: vulnerabilities.length,
  };

  console.log(`  📊 SAST Summary: ${summary.critical} critical, ${summary.high} high, ${summary.medium} medium, ${summary.low} low`);

  return {
    scanner: 'semgrep-sast',
    version: semgrepVersion,
    timestamp: new Date().toISOString(),
    scan_duration_ms: duration,
    vulnerabilities,
    summary,
    metadata: {
      rulesets_used: rulesets,
      total_files_scanned: vulnerabilities.length > 0 ? new Set(vulnerabilities.map(v => v.file)).size : 0,
    },
  };
}

function mapSemgrepConfidence(confidence?: string): 'low' | 'medium' | 'high' | undefined {
  switch (confidence?.toLowerCase()) {
    case 'high':
      return 'high';
    case 'medium':
      return 'medium';
    case 'low':
      return 'low';
    default:
      return 'medium'; // Default to medium confidence
  }
}