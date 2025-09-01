import { spawn } from 'bun';
import { performance } from 'perf_hooks';
import type { SecurityScanResult, ScannerConfig } from './types';

export async function containerScan(config: ScannerConfig): Promise<SecurityScanResult> {
  const startTime = performance.now();
  
  console.log('🐳 Running container security scan...');

  const vulnerabilities = [];
  const scannerVersion = 'docker-scout-v1.0';

  // Skip container scanning if not in CI or if Docker is not available
  if (process.env.CI !== 'true') {
    console.log('  ℹ️  Skipping container scan in local development');
    return createEmptyResult(performance.now() - startTime, scannerVersion);
  }

  try {
    // Check if Docker is available
    const dockerCheckProc = spawn(['docker', '--version'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    await dockerCheckProc.exited;

    if (dockerCheckProc.exitCode !== 0) {
      console.log('  ⚠️  Docker not available, skipping container scan');
      return createEmptyResult(performance.now() - startTime, scannerVersion);
    }

    // Look for Dockerfiles
    const dockerfiles = await findDockerfiles();
    
    if (dockerfiles.length === 0) {
      console.log('  ℹ️  No Dockerfiles found, skipping container scan');
      return createEmptyResult(performance.now() - startTime, scannerVersion);
    }

    console.log(`  🔍 Found ${dockerfiles.length} Dockerfile(s) to scan`);

    // Analyze each Dockerfile for security issues
    for (const dockerfile of dockerfiles) {
      const dockerfileVulns = await analyzeDockerfile(dockerfile);
      vulnerabilities.push(...dockerfileVulns);
    }

    // If we have built images, scan them too
    const builtImages = await findBuiltImages();
    for (const image of builtImages) {
      const imageVulns = await scanDockerImage(image, config);
      vulnerabilities.push(...imageVulns);
    }

    console.log(`  ✅ Container scan completed, found ${vulnerabilities.length} issues`);

  } catch (error) {
    console.error('  ❌ Container scan failed:', error);
    // Don't fail the entire pipeline for container scan issues
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

  console.log(`  📊 Container Summary: ${summary.critical} critical, ${summary.high} high, ${summary.medium} medium, ${summary.low} low`);

  return {
    scanner: 'container-security',
    version: scannerVersion,
    timestamp: new Date().toISOString(),
    scan_duration_ms: duration,
    vulnerabilities,
    summary,
    metadata: {
      dockerfiles_scanned: dockerfiles.length,
      images_scanned: builtImages.length,
    },
  };
}

async function findDockerfiles(): Promise<string[]> {
  try {
    const findProc = spawn(['find', '.', '-name', 'Dockerfile*', '-not', '-path', '*/node_modules/*'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    await findProc.exited;

    if (findProc.exitCode === 0) {
      return (await new Response(findProc.stdout).text())
        .trim()
        .split('\\n')
        .filter(line => line.trim());
    }
  } catch (error) {
    // Fallback
  }

  return [];
}

async function analyzeDockerfile(dockerfilePath: string): Promise<any[]> {
  const vulnerabilities = [];

  try {
    const content = await Bun.file(dockerfilePath).text();
    const lines = content.split('\\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim().toUpperCase();
      const originalLine = lines[i].trim();

      // Check for security issues in Dockerfile
      
      // Running as root
      if (line.startsWith('USER ROOT') || (!content.includes('USER ') && !line.startsWith('#'))) {
        vulnerabilities.push({
          id: `dockerfile-root-user-${i}`,
          severity: 'medium' as const,
          title: 'Container running as root user',
          description: 'Container is configured to run as root, which increases security risk',
          file: dockerfilePath,
          line: i + 1,
          category: 'container-security',
          confidence: 'high' as const,
          recommendation: 'Create and use a non-root user with USER instruction',
        });
      }

      // Outdated base images
      if (line.startsWith('FROM')) {
        const image = originalLine.split(' ')[1];
        if (image && (image.includes(':latest') || !image.includes(':'))) {
          vulnerabilities.push({
            id: `dockerfile-latest-tag-${i}`,
            severity: 'low' as const,
            title: 'Using latest or no tag for base image',
            description: 'Base image uses latest tag or no tag, which can lead to unpredictable builds',
            file: dockerfilePath,
            line: i + 1,
            category: 'container-security',
            confidence: 'medium' as const,
            recommendation: 'Use specific version tags for base images',
          });
        }
      }

      // Exposed unnecessary ports
      if (line.startsWith('EXPOSE')) {
        const port = originalLine.split(' ')[1];
        const portNum = parseInt(port, 10);
        
        if (portNum && (portNum < 1024 || portNum === 22 || portNum === 23 || portNum === 21)) {
          vulnerabilities.push({
            id: `dockerfile-privileged-port-${i}`,
            severity: 'medium' as const,
            title: 'Exposing privileged or dangerous port',
            description: `Port ${port} is privileged or commonly associated with security risks`,
            file: dockerfilePath,
            line: i + 1,
            category: 'container-security',
            confidence: 'medium' as const,
            recommendation: 'Use non-privileged ports (>1024) and avoid common attack vectors',
          });
        }
      }

      // Secrets in environment variables
      if (line.startsWith('ENV') && (originalLine.includes('PASSWORD') || originalLine.includes('SECRET') || originalLine.includes('KEY'))) {
        vulnerabilities.push({
          id: `dockerfile-env-secret-${i}`,
          severity: 'high' as const,
          title: 'Potential secret in environment variable',
          description: 'Environment variable appears to contain sensitive information',
          file: dockerfilePath,
          line: i + 1,
          category: 'secrets',
          confidence: 'medium' as const,
          recommendation: 'Use build arguments or runtime secrets instead of hardcoded environment variables',
        });
      }

      // Using ADD instead of COPY
      if (line.startsWith('ADD ') && !originalLine.includes('http')) {
        vulnerabilities.push({
          id: `dockerfile-add-instead-copy-${i}`,
          severity: 'low' as const,
          title: 'Using ADD instead of COPY',
          description: 'ADD has additional features that may be unnecessary and can pose security risks',
          file: dockerfilePath,
          line: i + 1,
          category: 'container-security',
          confidence: 'medium' as const,
          recommendation: 'Use COPY instead of ADD for local files',
        });
      }

      // Running package managers with no clean
      if ((line.includes('APT-GET') || line.includes('YUM') || line.includes('APK')) && 
          !line.includes('--NO-CACHE') && !line.includes('CLEAN')) {
        vulnerabilities.push({
          id: `dockerfile-package-cache-${i}`,
          severity: 'low' as const,
          title: 'Package manager cache not cleaned',
          description: 'Package manager cache increases image size and may contain outdated information',
          file: dockerfilePath,
          line: i + 1,
          category: 'container-security',
          confidence: 'low' as const,
          recommendation: 'Add --no-cache flag or clean package cache after installation',
        });
      }
    }
  } catch (error) {
    console.log(`    ⚠️  Could not analyze ${dockerfilePath}: ${error}`);
  }

  return vulnerabilities;
}

async function findBuiltImages(): Promise<string[]> {
  try {
    // Look for recently built images related to this project
    const imagesProc = spawn(['docker', 'images', '--format', 'json'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    await imagesProc.exited;

    if (imagesProc.exitCode === 0) {
      const output = await new Response(imagesProc.stdout).text();
      const images = output.split('\\n').filter(line => line.trim()).map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      }).filter(img => img && (
        img.Repository?.includes('arbiter') ||
        img.Repository?.includes('local') ||
        img.Tag === 'latest'
      ));

      return images.map(img => `${img.Repository}:${img.Tag}`).slice(0, 3); // Limit to 3 images
    }
  } catch (error) {
    // Docker images command failed
  }

  return [];
}

async function scanDockerImage(imageName: string, config: ScannerConfig): Promise<any[]> {
  const vulnerabilities = [];

  try {
    console.log(`    🔍 Scanning Docker image: ${imageName}`);

    // Use docker scout if available (new Docker feature)
    const scoutProc = spawn(['docker', 'scout', 'cves', imageName, '--format', 'json'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const timeoutMs = config.timeout_ms || 300000;
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        scoutProc.kill();
        reject(new Error(`Docker scout timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    await Promise.race([scoutProc.exited, timeoutPromise]);

    if (scoutProc.exitCode === 0) {
      const output = await new Response(scoutProc.stdout).text();
      
      try {
        const results = JSON.parse(output);
        
        // Process scout results
        for (const vuln of results.vulnerabilities || []) {
          vulnerabilities.push({
            id: vuln.id || `image-vuln-${vulnerabilities.length}`,
            severity: mapDockerSeverity(vuln.severity),
            title: vuln.title || vuln.id,
            description: vuln.description || 'Container image vulnerability',
            cve: vuln.cve,
            category: 'container-vulnerability',
            confidence: 'high' as const,
            recommendation: vuln.remediation || 'Update base image or affected packages',
          });
        }
      } catch (parseError) {
        console.log(`    ⚠️  Could not parse docker scout results for ${imageName}`);
      }
    } else {
      console.log(`    ℹ️  Docker scout not available for ${imageName}, skipping detailed scan`);
    }

  } catch (error) {
    console.log(`    ⚠️  Could not scan image ${imageName}: ${error}`);
  }

  return vulnerabilities;
}

function mapDockerSeverity(severity: string): 'low' | 'medium' | 'high' | 'critical' {
  switch (severity?.toLowerCase()) {
    case 'critical':
      return 'critical';
    case 'high':
      return 'high';
    case 'medium':
      return 'medium';
    case 'low':
      return 'low';
    default:
      return 'medium';
  }
}

function createEmptyResult(duration: number, version: string): SecurityScanResult {
  return {
    scanner: 'container-security',
    version,
    timestamp: new Date().toISOString(),
    scan_duration_ms: duration,
    vulnerabilities: [],
    summary: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      total: 0,
    },
    metadata: {
      skipped: true,
      reason: 'Docker not available or not in CI environment',
    },
  };
}