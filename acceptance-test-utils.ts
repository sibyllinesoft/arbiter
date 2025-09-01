/**
 * ACCEPTANCE TEST UTILITIES
 * Supporting utilities for the comprehensive acceptance suite
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export interface TestFixture {
  name: string;
  directory: string;
  files: Record<string, string>;
  assembly?: string;
  requirements?: string;
}

export interface PerformanceBenchmark {
  operation: string;
  threshold_ms: number;
  actual_ms?: number;
  passed?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metrics?: Record<string, any>;
}

/**
 * Fixture generator for different project types
 */
export class TestFixtureGenerator {
  
  static generateTypescriptLibrary(name: string): TestFixture {
    return {
      name,
      directory: name,
      files: {
        'package.json': JSON.stringify({
          name,
          version: '1.0.0',
          type: 'module',
          scripts: {
            build: 'tsc',
            test: 'vitest run'
          },
          devDependencies: {
            typescript: '^5.0.0',
            vitest: '^1.0.0'
          }
        }, null, 2),
        'tsconfig.json': JSON.stringify({
          compilerOptions: {
            target: 'ES2022',
            module: 'NodeNext',
            moduleResolution: 'NodeNext',
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            forceConsistentCasingInFileNames: true,
            outDir: './dist'
          },
          include: ['src/**/*'],
          exclude: ['node_modules', 'dist']
        }, null, 2),
        'src/index.ts': `
export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  error?: string;
}

export class DataProcessor {
  process<T>(input: T): ApiResponse<T> {
    if (!input) {
      return { success: false, data: input, error: 'Invalid input' };
    }
    return { success: true, data: input };
  }

  validate(input: unknown): boolean {
    return input !== null && input !== undefined;
  }
}

export function formatResponse<T>(data: T, error?: string): ApiResponse<T> {
  return {
    success: !error,
    data,
    error
  };
}
        `.trim()
      },
      assembly: `
import "github.com/arbiter-framework/schemas/artifact"
import "github.com/arbiter-framework/schemas/profiles"

Artifact: artifact.#Artifact & {
  kind: "library"
  language: "typescript"
  metadata: {
    name: "${name}"
    version: "1.0.0"
    description: "Test library for ${name}"
  }
}

Profile: profiles.#library & {
  contracts: {
    invariants: [
      {
        name: "data_processing"
        description: "Data processor handles all input types"
        formula: "∀x. process(x) → ApiResponse"
        testable: true
      },
      {
        name: "validation"
        description: "Validation rejects null/undefined"
        formula: "validate(null) = false ∧ validate(undefined) = false"
        testable: true
      }
    ]
  }
  tests: {
    coverage: {
      threshold: 90
      contracts: true
    }
  }
}
      `.trim()
    };
  }

  static generateRustLibrary(name: string): TestFixture {
    return {
      name,
      directory: name,
      files: {
        'Cargo.toml': `
[package]
name = "${name.replace(/-/g, '_')}"
version = "0.1.0"
edition = "2021"

[dependencies]
serde = { version = "1.0", features = ["derive"] }
        `.trim(),
        'src/lib.rs': `
//! ${name} - Test Rust library

use serde::{Deserialize, Serialize};

/// Result type for API operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResult<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

/// Data processor service
pub struct DataProcessor;

impl DataProcessor {
    /// Create new processor
    pub fn new() -> Self {
        Self
    }
    
    /// Process input data
    pub fn process<T>(&self, input: Option<T>) -> ApiResult<T> {
        match input {
            Some(data) => ApiResult {
                success: true,
                data: Some(data),
                error: None,
            },
            None => ApiResult {
                success: false,
                data: None,
                error: Some("Invalid input".to_string()),
            },
        }
    }
    
    /// Validate input
    pub fn validate<T>(&self, input: &Option<T>) -> bool {
        input.is_some()
    }
}

/// Format API response
pub fn format_response<T>(data: T, error: Option<String>) -> ApiResult<T> {
    ApiResult {
        success: error.is_none(),
        data: Some(data),
        error,
    }
}

/// Remove public function - this will create breaking change
pub fn helper_function(input: &str) -> String {
    format!("processed: {}", input)
}
        `.trim()
      },
      assembly: `
import "github.com/arbiter-framework/schemas/artifact"
import "github.com/arbiter-framework/schemas/profiles"

Artifact: artifact.#Artifact & {
  kind: "library"
  language: "rust"
  metadata: {
    name: "${name}"
    version: "0.1.0"
    description: "Test Rust library for ${name}"
  }
}

Profile: profiles.#library & {
  semver: "strict"
  contracts: {
    forbidBreaking: true
    invariants: [
      {
        name: "error_handling"
        description: "All operations return Result types"
        formula: "∀x. process(x) → ApiResult<T>"
        testable: true
      }
    ]
  }
}
      `.trim()
    };
  }

  static generateServiceProject(name: string): TestFixture {
    return {
      name,
      directory: name,
      files: {
        'package.json': JSON.stringify({
          name,
          version: '1.0.0',
          type: 'module',
          scripts: {
            start: 'node dist/server.js',
            dev: 'tsx src/server.ts',
            build: 'tsc',
            test: 'vitest run'
          }
        }, null, 2),
        'src/server.ts': `
import express from 'express';

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.post('/api/data', (req, res) => {
  const { data } = req.body;
  if (!data) {
    return res.status(400).json({ error: 'Data is required' });
  }
  res.json({ processed: data, timestamp: new Date().toISOString() });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(\`Server running on port \${port}\`);
});
        `.trim()
      },
      assembly: `
import "github.com/arbiter-framework/schemas/artifact"
import "github.com/arbiter-framework/schemas/profiles"

Artifact: artifact.#Artifact & {
  kind: "service"
  language: "typescript"
  metadata: {
    name: "${name}"
    version: "1.0.0"
    description: "Test service for ${name}"
  }
}

Profile: profiles.#service & {
  contracts: {
    invariants: [
      {
        name: "health_endpoint"
        description: "Health endpoint always responds"
        formula: "GET /health → 200"
        testable: true
      },
      {
        name: "data_validation"
        description: "API validates input data"
        formula: "POST /api/data ∧ data=null → 400"
        testable: true
      }
    ]
  }
  performance: {
    latency: {
      p95: "200ms"
      p99: "500ms"
    }
  }
}
      `.trim(),
      requirements: `
# ${name} Service Requirements

## Milestone: M1 - Core API
**Deliverable:** RESTful API service

### Requirements
- **Gate: Health** - Health check endpoint responds in <100ms
- **Gate: Validation** - All inputs validated with clear error messages
- **Gate: Performance** - API responses under 200ms p95

### API Endpoints
- GET /health - Returns service status
- POST /api/data - Processes input data with validation

### Performance Requirements
- Health check response time <100ms
- Data processing response time <200ms p95
- Support 100 concurrent requests
      `.trim()
    };
  }
}

/**
 * Performance benchmarking utilities
 */
export class PerformanceBenchmarker {
  private benchmarks: PerformanceBenchmark[] = [];

  addBenchmark(operation: string, threshold_ms: number): void {
    this.benchmarks.push({ operation, threshold_ms });
  }

  async measureOperation<T>(
    operation: string, 
    fn: () => Promise<T> | T
  ): Promise<{ result: T; duration_ms: number; passed: boolean }> {
    const benchmark = this.benchmarks.find(b => b.operation === operation);
    const threshold = benchmark?.threshold_ms || 5000;

    const start = Date.now();
    const result = await fn();
    const duration_ms = Date.now() - start;
    const passed = duration_ms <= threshold;

    if (benchmark) {
      benchmark.actual_ms = duration_ms;
      benchmark.passed = passed;
    }

    return { result, duration_ms, passed };
  }

  getResults(): PerformanceBenchmark[] {
    return [...this.benchmarks];
  }

  generateReport(): string {
    const total = this.benchmarks.length;
    const passed = this.benchmarks.filter(b => b.passed).length;
    const failed = total - passed;

    let report = `\n📊 PERFORMANCE BENCHMARK REPORT\n`;
    report += `${'='.repeat(40)}\n`;
    report += `Total: ${total} | Passed: ${passed} | Failed: ${failed}\n\n`;

    this.benchmarks.forEach(bench => {
      const status = bench.passed ? '✅ PASS' : '❌ FAIL';
      const duration = bench.actual_ms ? `${bench.actual_ms}ms` : 'N/A';
      report += `${status} ${bench.operation}: ${duration} (threshold: ${bench.threshold_ms}ms)\n`;
    });

    return report;
  }
}

/**
 * File and directory utilities
 */
export class TestFileUtils {
  static ensureDirectory(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  static writeFiles(baseDir: string, files: Record<string, string>): void {
    this.ensureDirectory(baseDir);
    
    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = path.join(baseDir, filePath);
      const dir = path.dirname(fullPath);
      this.ensureDirectory(dir);
      fs.writeFileSync(fullPath, content);
    }
  }

  static createFixture(fixture: TestFixture, baseDir: string): string {
    const fixtureDir = path.join(baseDir, fixture.directory);
    this.writeFiles(fixtureDir, fixture.files);
    
    if (fixture.assembly) {
      fs.writeFileSync(path.join(fixtureDir, 'arbiter.assembly.cue'), fixture.assembly);
    }
    
    if (fixture.requirements) {
      fs.writeFileSync(path.join(fixtureDir, 'requirements.md'), fixture.requirements);
    }
    
    return fixtureDir;
  }

  static hashFile(filepath: string): string {
    if (!fs.existsSync(filepath)) return '';
    const crypto = require('crypto');
    const content = fs.readFileSync(filepath);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  static compareFiles(file1: string, file2: string): boolean {
    return this.hashFile(file1) === this.hashFile(file2);
  }

  static findFilesRecursive(dir: string, pattern?: RegExp): string[] {
    if (!fs.existsSync(dir)) return [];
    
    const files: string[] = [];
    const items = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      
      if (item.isDirectory()) {
        files.push(...this.findFilesRecursive(fullPath, pattern));
      } else if (item.isFile()) {
        if (!pattern || pattern.test(item.name)) {
          files.push(fullPath);
        }
      }
    }
    
    return files;
  }
}

/**
 * Command execution utilities with detailed logging
 */
export class CommandRunner {
  private verbose: boolean;

  constructor(verbose = false) {
    this.verbose = verbose;
  }

  run(
    command: string, 
    cwd?: string, 
    timeout = 30000
  ): { stdout: string; stderr: string; code: number; duration: number } {
    const start = Date.now();
    
    if (this.verbose) {
      console.log(`🔧 Running: ${command}${cwd ? ` (in ${cwd})` : ''}`);
    }

    try {
      const result = execSync(command, {
        encoding: 'utf8',
        cwd: cwd || process.cwd(),
        timeout,
        stdio: ['inherit', 'pipe', 'pipe']
      });
      
      const duration = Date.now() - start;
      
      if (this.verbose) {
        console.log(`✅ Success (${duration}ms)`);
      }
      
      return { stdout: result.toString(), stderr: '', code: 0, duration };
    } catch (error: any) {
      const duration = Date.now() - start;
      
      if (this.verbose) {
        console.log(`❌ Failed (${duration}ms): ${error.message}`);
      }
      
      return {
        stdout: error.stdout?.toString() || '',
        stderr: error.stderr?.toString() || error.message,
        code: error.status || 1,
        duration
      };
    }
  }

  async runAsync(
    command: string,
    cwd?: string,
    timeout = 30000
  ): Promise<{ stdout: string; stderr: string; code: number; duration: number }> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(this.run(command, cwd, timeout));
      }, 0);
    });
  }
}

/**
 * Test result validation utilities
 */
export class TestValidator {
  static validateJsonFile(filepath: string, schema?: any): ValidationResult {
    const result: ValidationResult = {
      valid: false,
      errors: [],
      warnings: []
    };

    if (!fs.existsSync(filepath)) {
      result.errors.push(`File does not exist: ${filepath}`);
      return result;
    }

    try {
      const content = fs.readFileSync(filepath, 'utf8');
      const json = JSON.parse(content);
      
      result.valid = true;
      result.metrics = {
        file_size: content.length,
        object_keys: typeof json === 'object' ? Object.keys(json).length : 0
      };

      // Basic schema validation if provided
      if (schema && typeof json === 'object') {
        for (const [key, type] of Object.entries(schema)) {
          if (!(key in json)) {
            result.warnings.push(`Missing expected key: ${key}`);
          } else if (typeof json[key] !== type) {
            result.errors.push(`Key '${key}' should be ${type}, got ${typeof json[key]}`);
            result.valid = false;
          }
        }
      }

    } catch (error) {
      result.errors.push(`JSON parse error: ${error}`);
    }

    return result;
  }

  static validateTraceJson(filepath: string): ValidationResult {
    const schema = {
      requirements: 'object',
      specifications: 'object', 
      tests: 'object',
      code: 'object',
      links: 'object'
    };

    const result = this.validateJsonFile(filepath, schema);
    
    if (result.valid && fs.existsSync(filepath)) {
      try {
        const trace = JSON.parse(fs.readFileSync(filepath, 'utf8'));
        
        // Check for dangling references
        const allIds = new Set<string>();
        const referencedIds = new Set<string>();

        // Collect all IDs
        ['requirements', 'specifications', 'tests', 'code'].forEach(section => {
          if (Array.isArray(trace[section])) {
            trace[section].forEach((item: any) => {
              if (item.id) allIds.add(item.id);
            });
          }
        });

        // Collect referenced IDs
        if (Array.isArray(trace.links)) {
          trace.links.forEach((link: any) => {
            if (link.from) referencedIds.add(link.from);
            if (link.to) referencedIds.add(link.to);
          });
        }

        // Find dangling references
        const danglingIds: string[] = [];
        referencedIds.forEach(id => {
          if (!allIds.has(id)) {
            danglingIds.push(id);
          }
        });

        if (danglingIds.length > 0) {
          result.errors.push(`Dangling references found: ${danglingIds.join(', ')}`);
          result.valid = false;
        }

        result.metrics = {
          ...result.metrics,
          total_ids: allIds.size,
          total_references: referencedIds.size,
          dangling_ids: danglingIds.length
        };

      } catch (error) {
        result.errors.push(`Trace validation error: ${error}`);
        result.valid = false;
      }
    }

    return result;
  }

  static validateSurfaceJson(filepath: string): ValidationResult {
    const result = this.validateJsonFile(filepath);
    
    if (result.valid && fs.existsSync(filepath)) {
      try {
        const surface = JSON.parse(fs.readFileSync(filepath, 'utf8'));
        
        // Check if surface is non-empty
        const hasContent = surface && 
          (Array.isArray(surface) ? surface.length > 0 : Object.keys(surface).length > 0);
        
        if (!hasContent) {
          result.warnings.push('Surface extraction appears to be empty');
        }

        result.metrics = {
          ...result.metrics,
          has_content: hasContent
        };

      } catch (error) {
        result.errors.push(`Surface validation error: ${error}`);
        result.valid = false;
      }
    }

    return result;
  }
}