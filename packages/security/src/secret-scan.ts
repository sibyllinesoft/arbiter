import { spawn } from 'bun';
import { performance } from 'perf_hooks';
import type { SecurityScanResult, ScannerConfig } from './types';

export async function secretScan(config: ScannerConfig): Promise<SecurityScanResult> {
  const startTime = performance.now();
  
  console.log('🔐 Running secrets detection scan...');

  const vulnerabilities = [];
  const scannerVersion = 'builtin-v1.0';

  try {
    // Use multiple approaches for secret detection
    const secretPatterns = [
      // API Keys
      { pattern: /(?:api[_-]?key|apikey)[\\s]*[=:][\\s]*['"]['"]?([a-zA-Z0-9]{20,})/gi, name: 'API Key', severity: 'high' },
      { pattern: /(?:secret[_-]?key|secretkey)[\\s]*[=:][\\s]*['"]['"]?([a-zA-Z0-9]{20,})/gi, name: 'Secret Key', severity: 'high' },
      
      // Database URLs
      { pattern: /(mongodb:\\/\\/[^\\s\\n]+)/gi, name: 'MongoDB Connection String', severity: 'critical' },
      { pattern: /(postgres:\\/\\/[^\\s\\n]+)/gi, name: 'PostgreSQL Connection String', severity: 'critical' },
      { pattern: /(mysql:\\/\\/[^\\s\\n]+)/gi, name: 'MySQL Connection String', severity: 'critical' },
      
      // AWS Credentials
      { pattern: /AKIA[0-9A-Z]{16}/gi, name: 'AWS Access Key ID', severity: 'critical' },
      { pattern: /(?:aws[_-]?secret[_-]?access[_-]?key)[\\s]*[=:][\\s]*['"]['"]?([a-zA-Z0-9/+]{40})/gi, name: 'AWS Secret Access Key', severity: 'critical' },
      
      // JWT Tokens
      { pattern: /eyJ[a-zA-Z0-9_-]*\\.eyJ[a-zA-Z0-9_-]*\\.[a-zA-Z0-9_-]*/gi, name: 'JWT Token', severity: 'medium' },
      
      // Private Keys
      { pattern: /-----BEGIN [A-Z ]+ PRIVATE KEY-----[\\s\\S]*?-----END [A-Z ]+ PRIVATE KEY-----/gi, name: 'Private Key', severity: 'critical' },
      
      // Generic passwords
      { pattern: /(?:password|passwd|pwd)[\\s]*[=:][\\s]*['"]['"]?([^\\s'"]{8,})/gi, name: 'Password', severity: 'medium' },
      
      // GitHub Tokens
      { pattern: /ghp_[a-zA-Z0-9]{36}/gi, name: 'GitHub Personal Access Token', severity: 'high' },
      { pattern: /github_pat_[a-zA-Z0-9_]{82}/gi, name: 'GitHub Fine-grained PAT', severity: 'high' },
      
      // Other common secrets
      { pattern: /(?:bearer[\\s]+)([a-zA-Z0-9_-]{20,})/gi, name: 'Bearer Token', severity: 'medium' },
      { pattern: /(?:token)[\\s]*[=:][\\s]*['"]['"]?([a-zA-Z0-9_-]{20,})/gi, name: 'Generic Token', severity: 'medium' },
    ];

    // Files to exclude from scanning
    const excludePatterns = [
      /node_modules/,
      /\\.git/,
      /dist/,
      /build/,
      /coverage/,
      /\\.next/,
      /\\.nuxt/,
      /\\.vscode/,
      /\\.idea/,
    ];

    // File extensions to scan
    const includeExtensions = [
      '.js', '.ts', '.jsx', '.tsx',
      '.json', '.yaml', '.yml',
      '.env', '.env.local', '.env.example',
      '.config.js', '.config.ts',
      '.md', '.txt',
      'Dockerfile', 'docker-compose.yml',
    ];

    // Find files to scan
    const filesToScan = await findFilesToScan(includeExtensions, excludePatterns);
    
    console.log(`  🔍 Scanning ${filesToScan.length} files for secrets...`);

    for (const filePath of filesToScan) {
      try {
        const content = await Bun.file(filePath).text();
        const lines = content.split('\\n');

        for (const pattern of secretPatterns) {
          let match;
          const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);
          
          while ((match = regex.exec(content)) !== null) {
            const matchedText = match[0];
            const secretValue = match[1] || matchedText;

            // Skip if it looks like a placeholder or example
            if (isPlaceholderSecret(secretValue, content, matchedText)) {
              continue;
            }

            // Find line number
            let lineNumber = 1;
            let charCount = 0;
            for (const line of lines) {
              charCount += line.length + 1; // +1 for newline
              if (charCount >= match.index!) {
                break;
              }
              lineNumber++;
            }

            vulnerabilities.push({
              id: `secret-${pattern.name.toLowerCase().replace(/\\s/g, '-')}-${vulnerabilities.length}`,
              severity: pattern.severity as 'low' | 'medium' | 'high' | 'critical',
              title: `${pattern.name} detected`,
              description: `Potential ${pattern.name.toLowerCase()} found in source code`,
              file: filePath,
              line: lineNumber,
              category: 'secrets',
              confidence: 'high',
              impact: 'Hardcoded secrets in source code can lead to unauthorized access',
              recommendation: 'Move secrets to environment variables or secure secret management',
            });
          }
        }
      } catch (error) {
        // Skip files that can't be read
        console.log(`    ⚠️  Skipping ${filePath}: ${error}`);
      }
    }

    // Additional check for .env files with suspicious content
    const envVulns = await scanEnvFiles();
    vulnerabilities.push(...envVulns);

    console.log(`  ✅ Found ${vulnerabilities.length} potential secrets`);

  } catch (error) {
    console.error('  ❌ Secret scan failed:', error);
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

  console.log(`  📊 Secrets Summary: ${summary.critical} critical, ${summary.high} high, ${summary.medium} medium, ${summary.low} low`);

  return {
    scanner: 'secret-scan',
    version: scannerVersion,
    timestamp: new Date().toISOString(),
    scan_duration_ms: duration,
    vulnerabilities,
    summary,
    metadata: {
      files_scanned: vulnerabilities.length > 0 ? new Set(vulnerabilities.map(v => v.file)).size : 0,
      patterns_used: 15,
    },
  };
}

async function findFilesToScan(includeExtensions: string[], excludePatterns: RegExp[]): Promise<string[]> {
  try {
    const findProc = spawn(['find', '.', '-type', 'f'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    await findProc.exited;

    if (findProc.exitCode === 0) {
      const allFiles = (await new Response(findProc.stdout).text())
        .trim()
        .split('\\n')
        .filter(line => line.trim());

      return allFiles.filter(file => {
        // Skip excluded paths
        for (const pattern of excludePatterns) {
          if (pattern.test(file)) {
            return false;
          }
        }

        // Include files with matching extensions or specific filenames
        const hasExtension = includeExtensions.some(ext => file.endsWith(ext));
        const isSpecialFile = file.includes('Dockerfile') || file.includes('docker-compose') || file.includes('.env');
        
        return hasExtension || isSpecialFile;
      });
    }
  } catch (error) {
    console.log('  ⚠️  Could not scan files, using fallback approach');
  }

  return [];
}

function isPlaceholderSecret(secretValue: string, fileContent: string, matchedText: string): boolean {
  // Common placeholder patterns
  const placeholderPatterns = [
    /^(your|my|test|demo|example|placeholder|xxx+|yyy+|zzz+|123+)/i,
    /^(sk_test|pk_test)/i, // Test keys
    /^\\${.*}$/i, // Environment variable references
    /<[^>]+>/i, // Template placeholders
    /\\$\\{[^}]+\\}/i, // Template literals
  ];

  for (const pattern of placeholderPatterns) {
    if (pattern.test(secretValue)) {
      return true;
    }
  }

  // Check if it appears in comments or documentation
  const lowerContent = fileContent.toLowerCase();
  const lowerMatched = matchedText.toLowerCase();
  
  if (lowerContent.includes(`# ${lowerMatched}`) || 
      lowerContent.includes(`// ${lowerMatched}`) ||
      lowerContent.includes(`example`) ||
      lowerContent.includes(`sample`)) {
    return true;
  }

  // Skip very short values (likely false positives)
  if (secretValue.length < 8) {
    return true;
  }

  return false;
}

async function scanEnvFiles(): Promise<any[]> {
  const vulnerabilities = [];

  try {
    const envFiles = await findEnvFiles();
    
    for (const envFile of envFiles) {
      try {
        const content = await Bun.file(envFile).text();
        const lines = content.split('\\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          
          if (line && !line.startsWith('#')) {
            const [key, ...valueParts] = line.split('=');
            const value = valueParts.join('=').trim();

            // Skip empty values or obvious placeholders
            if (!value || value === '""' || value === "''" || value === 'your_value_here') {
              continue;
            }

            // Check for production-like values in development files
            if (envFile.includes('.env.example') && value.length > 20 && !value.includes('example')) {
              vulnerabilities.push({
                id: `env-real-value-${i}`,
                severity: 'medium' as const,
                title: 'Real value in example env file',
                description: `Environment variable ${key} appears to contain a real value in example file`,
                file: envFile,
                line: i + 1,
                category: 'secrets',
                confidence: 'medium' as const,
                recommendation: 'Use placeholder values in .env.example files',
              });
            }
          }
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }
  } catch (error) {
    // Skip if env file scanning fails
  }

  return vulnerabilities;
}

async function findEnvFiles(): Promise<string[]> {
  try {
    const findProc = spawn(['find', '.', '-name', '.env*', '-not', '-path', '*/node_modules/*'], {
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