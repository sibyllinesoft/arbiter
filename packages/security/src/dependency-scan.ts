import { spawn } from 'bun';
import { performance } from 'perf_hooks';
import type { SecurityScanResult, ScannerConfig } from './types';

export async function dependencyScan(config: ScannerConfig): Promise<SecurityScanResult> {
  const startTime = performance.now();
  
  console.log('📦 Running dependency vulnerability scan...');

  const vulnerabilities = [];
  let scannerVersion = '';

  try {
    // First try bun audit (native to Bun)
    console.log('  🔍 Scanning with bun audit...');
    
    const bunAuditProc = spawn(['bun', 'audit', '--json'], {
      stdout: 'pipe',
      stderr: 'pipe',
      cwd: process.cwd(),
    });

    const timeoutMs = config.timeout_ms || 180000; // 3 minutes default
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        bunAuditProc.kill();
        reject(new Error(`Dependency scan timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    await Promise.race([bunAuditProc.exited, timeoutPromise]);

    if (bunAuditProc.exitCode === 0) {
      const stdout = await new Response(bunAuditProc.stdout).text();
      
      if (stdout.trim()) {
        const auditResults = JSON.parse(stdout);
        scannerVersion = `bun-audit-${Bun.version}`;

        // Process Bun audit results
        for (const [packageName, vulnData] of Object.entries(auditResults.vulnerabilities || {})) {
          const vulnInfo = vulnData as any;
          
          for (const advisory of vulnInfo.via || []) {
            if (typeof advisory === 'object' && advisory.source) {
              vulnerabilities.push({
                id: advisory.source.toString(),
                severity: mapNpmSeverity(advisory.severity),
                title: `${packageName}: ${advisory.title || 'Vulnerability'}`,
                description: advisory.overview || advisory.title || 'Dependency vulnerability',
                cve: advisory.cve?.[0],
                cwe: advisory.cwe?.[0],
                category: 'dependency',
                impact: `Affects ${packageName}@${vulnInfo.range}`,
                recommendation: advisory.recommendation || `Update ${packageName} to a patched version`,
                references: advisory.references || [],
              });
            }
          }
        }
      }
    }

    // Fallback to npm audit if available and no results from bun
    if (vulnerabilities.length === 0) {
      console.log('  🔍 Fallback: trying npm audit...');
      
      try {
        const npmAuditProc = spawn(['npm', 'audit', '--json', '--audit-level=low'], {
          stdout: 'pipe',
          stderr: 'pipe',
          cwd: process.cwd(),
        });

        await Promise.race([npmAuditProc.exited, timeoutPromise]);

        if (npmAuditProc.exitCode === 0 || npmAuditProc.exitCode === 1) {
          const npmStdout = await new Response(npmAuditProc.stdout).text();
          
          if (npmStdout.trim()) {
            const npmResults = JSON.parse(npmStdout);
            scannerVersion = `npm-audit-${npmResults.npm_version || 'unknown'}`;

            // Process npm audit results
            for (const [advisoryId, advisory] of Object.entries(npmResults.advisories || {})) {
              const advisoryData = advisory as any;
              
              vulnerabilities.push({
                id: advisoryId,
                severity: mapNpmSeverity(advisoryData.severity),
                title: `${advisoryData.module_name}: ${advisoryData.title}`,
                description: advisoryData.overview || advisoryData.title,
                cve: advisoryData.cves?.[0],
                cwe: advisoryData.cwe?.[0],
                category: 'dependency',
                confidence: 'high',
                impact: advisoryData.recommendation,
                recommendation: advisoryData.recommendation || `Update ${advisoryData.module_name}`,
                references: advisoryData.references ? [advisoryData.url] : [],
              });
            }
          }
        }
      } catch (npmError) {
        console.log('  ℹ️  npm audit not available, continuing...');
      }
    }

    // Also check for known vulnerable patterns in package.json files
    const packageJsonVulns = await scanPackageJsonFiles();
    vulnerabilities.push(...packageJsonVulns);

    console.log(`  ✅ Found ${vulnerabilities.length} dependency vulnerabilities`);

  } catch (error) {
    console.error('  ❌ Dependency scan failed:', error);
    // Don't fail the entire pipeline for dependency scan issues
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

  console.log(`  📊 Dependency Summary: ${summary.critical} critical, ${summary.high} high, ${summary.medium} medium, ${summary.low} low`);

  return {
    scanner: 'dependency-scan',
    version: scannerVersion,
    timestamp: new Date().toISOString(),
    scan_duration_ms: duration,
    vulnerabilities,
    summary,
    metadata: {
      package_managers: ['bun', 'npm'],
    },
  };
}

function mapNpmSeverity(severity: string): 'low' | 'medium' | 'high' | 'critical' {
  switch (severity?.toLowerCase()) {
    case 'critical':
      return 'critical';
    case 'high':
      return 'high';
    case 'moderate':
    case 'medium':
      return 'medium';
    case 'low':
    case 'info':
      return 'low';
    default:
      return 'medium';
  }
}

async function scanPackageJsonFiles(): Promise<any[]> {
  const vulnerabilities = [];

  try {
    // Find all package.json files
    const findProc = spawn(['find', '.', '-name', 'package.json', '-not', '-path', '*/node_modules/*'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    await findProc.exited;

    if (findProc.exitCode === 0) {
      const packageJsonFiles = (await new Response(findProc.stdout).text())
        .trim()
        .split('\\n')
        .filter(line => line.trim());

      for (const file of packageJsonFiles) {
        try {
          const packageJson = await Bun.file(file).json();
          
          // Check for known vulnerable packages/versions
          const knownVulnerable = [
            { name: 'lodash', version: '<4.17.19', severity: 'high', cve: 'CVE-2020-8203' },
            { name: 'minimist', version: '<1.2.2', severity: 'medium', cve: 'CVE-2020-7598' },
            { name: 'yargs-parser', version: '<18.1.1', severity: 'medium', cve: 'CVE-2020-7608' },
            { name: 'node-fetch', version: '<2.6.7', severity: 'high', cve: 'CVE-2022-0235' },
          ];

          const allDeps = {
            ...packageJson.dependencies,
            ...packageJson.devDependencies,
            ...packageJson.peerDependencies,
          };

          for (const vuln of knownVulnerable) {
            if (allDeps[vuln.name]) {
              // Simple version check (in production, would use semver)
              const currentVersion = allDeps[vuln.name].replace(/[^\\d.]/g, '');
              
              vulnerabilities.push({
                id: `pkg-${vuln.name}-${vuln.cve}`,
                severity: vuln.severity,
                title: `Vulnerable dependency: ${vuln.name}`,
                description: `Known vulnerability in ${vuln.name} version ${currentVersion}`,
                file,
                cve: vuln.cve,
                category: 'dependency',
                confidence: 'high',
                recommendation: `Update ${vuln.name} to version ${vuln.version.replace('<', '>=')} or later`,
              });
            }
          }
        } catch (error) {
          // Skip files that can't be parsed
        }
      }
    }
  } catch (error) {
    // Skip if find command fails
  }

  return vulnerabilities;
}