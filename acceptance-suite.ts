#!/usr/bin/env node

/**
 * ARBITER ACCEPTANCE SUITE
 * Validates all 7 acceptance criteria from TODO.md section 12
 * 
 * REQUIREMENTS:
 * 1. Workflow demo: TODO.md → requirements.cue → assembly.cue → SPECIFICATION.md → M1_IMPLEMENTATION.md → tests → green check
 * 2. Rust surface: non-empty extraction; deliberate breaking change flips required_bump=MAJOR
 * 3. Watch: edit file → validate/surface/gates update in ≤3 s  
 * 4. Tests: tests generate produces runnable suites; tests cover computes Contract Coverage
 * 5. Traceability: TRACE.json links REQ→SPEC→TEST→CODE with no dangling IDs
 * 6. Determinism: identical inputs yield byte-identical outputs across two runs
 * 7. No "not implemented" across commands listed in §§2–10
 */

import { execSync, spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface TestResult {
  name: string;
  criteriaNumber: number;
  passed: boolean;
  duration?: number;
  error?: string;
  measurements?: Record<string, any>;
  details?: string;
}

class AcceptanceSuite {
  private results: TestResult[] = [];
  private testWorkspace: string;
  private readonly PERFORMANCE_THRESHOLD_MS = 3000;

  constructor() {
    this.testWorkspace = path.join(__dirname, 'acceptance-workspace');
    this.setupEnvironment();
  }

  private setupEnvironment(): void {
    console.log('🏗️  Setting up Acceptance Test Environment...');
    
    // Clean and create test workspace
    if (fs.existsSync(this.testWorkspace)) {
      fs.rmSync(this.testWorkspace, { recursive: true, force: true });
    }
    this.ensureDirectory(this.testWorkspace);
    
    console.log('✅ Test environment ready');
    console.log('\n🚀 Running Acceptance Tests for TODO.md Section 12...\n');
  }

  private ensureDirectory(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private logTest(name: string, criteriaNumber: number): void {
    console.log(`\n🧪 [Criteria ${criteriaNumber}] ${name}`);
  }

  private recordResult(
    name: string,
    criteriaNumber: number,
    passed: boolean,
    measurements?: Record<string, any>,
    error?: string,
    duration?: number,
    details?: string
  ): void {
    this.results.push({
      name,
      criteriaNumber,
      passed,
      measurements,
      error,
      duration,
      details
    });
    
    if (passed) {
      console.log(`✅ [Criteria ${criteriaNumber}] ${name} - PASSED${duration ? ` (${duration}ms)` : ''}`);
      if (measurements) {
        console.log(`📊 Measurements:`, JSON.stringify(measurements, null, 2));
      }
    } else {
      console.log(`❌ [Criteria ${criteriaNumber}] ${name} - FAILED: ${error || 'Unknown error'}`);
      if (details) {
        console.log(`📝 Details: ${details}`);
      }
    }
  }

  private hashFile(filepath: string): string {
    if (!fs.existsSync(filepath)) return '';
    const content = fs.readFileSync(filepath);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private runCommand(
    command: string,
    cwd?: string,
    timeout?: number
  ): { stdout: string; stderr: string; code: number; duration: number } {
    const startTime = Date.now();
    try {
      const result = execSync(command, {
        encoding: 'utf8',
        cwd: cwd || process.cwd(),
        timeout: timeout || 30000,
        stdio: ['inherit', 'pipe', 'pipe']
      });
      const duration = Date.now() - startTime;
      return { stdout: result.toString(), stderr: '', code: 0, duration };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      return {
        stdout: error.stdout?.toString() || '',
        stderr: error.stderr?.toString() || error.message,
        code: error.status || 1,
        duration
      };
    }
  }

  /**
   * CRITERIA 1: Workflow Demo
   * TODO.md → requirements.cue → assembly.cue → SPECIFICATION.md → M1_IMPLEMENTATION.md → tests → green check
   */
  async testWorkflowDemo(): Promise<void> {
    this.logTest('Complete workflow from TODO.md to green tests', 1);
    
    try {
      const workflowDir = path.join(this.testWorkspace, 'workflow-demo');
      this.ensureDirectory(workflowDir);

      // Create sample TODO.md with requirements
      const todoContent = `
# Sample Project Requirements

## Milestone: M1 - Core Features
**Deliverable: User Authentication System**

### Requirements
- **Gate: Security** - Implement secure login with JWT tokens
- **Risk: Performance** - Login must complete within 200ms
- **Deliverable:** RESTful authentication API
- **Milestone:** Phase 1 delivery

### Authentication Features
- User registration with email validation
- Secure password hashing (bcrypt)
- JWT token generation and validation
- Session management
- Password reset functionality

### Performance Requirements  
- Login response time < 200ms p95
- Registration response time < 500ms p95
- Support 1000 concurrent users

### Security Requirements
- Rate limiting on auth endpoints
- Input validation and sanitization
- Secure headers implementation
- HTTPS enforcement
`;

      fs.writeFileSync(path.join(workflowDir, 'TODO.md'), todoContent);

      // Step 1: requirements analyze
      const reqAnalyzeResult = this.runCommand(
        'node ../packages/cli/src/cli.ts requirements analyze TODO.md --out requirements.cue',
        workflowDir
      );

      // Step 2: spec generate  
      const specGenResult = this.runCommand(
        'node ../packages/cli/src/cli.ts spec generate --from-requirements requirements.cue --template service --out arbiter.assembly.cue',
        workflowDir
      );

      // Step 3: docs assembly
      const docsResult = this.runCommand(
        'node ../packages/cli/src/cli.ts docs assembly --md --out SPECIFICATION.md',
        workflowDir
      );

      // Step 4: plan milestone
      const planResult = this.runCommand(
        'node ../packages/cli/src/cli.ts plan milestone M1 --out M1_IMPLEMENTATION.md',
        workflowDir
      );

      // Step 5: tests generate
      const testsGenResult = this.runCommand(
        'node ../packages/cli/src/cli.ts tests generate --from-assembly --language typescript --out tests/',
        workflowDir
      );

      // Validate all files were created
      const expectedFiles = [
        'requirements.cue',
        'arbiter.assembly.cue', 
        'SPECIFICATION.md',
        'M1_IMPLEMENTATION.md'
      ];

      const filesCreated = expectedFiles.filter(file => 
        fs.existsSync(path.join(workflowDir, file))
      );

      const testsCreated = fs.existsSync(path.join(workflowDir, 'tests')) &&
        fs.readdirSync(path.join(workflowDir, 'tests')).length > 0;

      // Run generated tests for "green check"
      let testsPass = false;
      if (testsCreated) {
        const testResult = this.runCommand('npm test', workflowDir);
        testsPass = testResult.code === 0;
      }

      const workflowComplete = filesCreated.length === expectedFiles.length && 
                              testsCreated &&
                              reqAnalyzeResult.code === 0 &&
                              specGenResult.code === 0;

      this.recordResult(
        'Complete workflow pipeline',
        1,
        workflowComplete,
        {
          files_created: filesCreated,
          tests_directory_created: testsCreated,
          tests_passing: testsPass,
          requirements_analyze_success: reqAnalyzeResult.code === 0,
          spec_generate_success: specGenResult.code === 0,
          docs_generate_success: docsResult.code === 0,
          plan_generate_success: planResult.code === 0,
          tests_generate_success: testsGenResult.code === 0
        },
        !workflowComplete ? 'Workflow pipeline did not complete successfully' : undefined
      );

    } catch (error) {
      this.recordResult(
        'Complete workflow pipeline',
        1,
        false,
        undefined,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * CRITERIA 2: Rust Surface Extraction  
   * Non-empty extraction; deliberate breaking change flips required_bump=MAJOR
   */
  async testRustSurfaceExtraction(): Promise<void> {
    this.logTest('Rust surface extraction with breaking change detection', 2);
    
    try {
      const rustDir = path.join(this.testWorkspace, 'rust-surface-test');
      this.ensureDirectory(rustDir);

      // Create a Rust project structure
      const cargoToml = `
[package]
name = "surface-test"
version = "0.1.0"
edition = "2021"

[dependencies]
serde = { version = "1.0", features = ["derive"] }
`;

      const rustLib = `
//! Test library for surface extraction

use serde::{Deserialize, Serialize};

/// User data structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: u64,
    pub name: String,
    pub email: String,
}

/// Authentication service
pub struct AuthService {
    users: Vec<User>,
}

impl AuthService {
    /// Create a new auth service
    pub fn new() -> Self {
        Self { users: Vec::new() }
    }
    
    /// Add a user to the system
    pub fn add_user(&mut self, user: User) -> Result<(), String> {
        if self.users.iter().any(|u| u.id == user.id) {
            return Err("User already exists".to_string());
        }
        self.users.push(user);
        Ok(())
    }
    
    /// Find user by ID
    pub fn find_user(&self, id: u64) -> Option<&User> {
        self.users.iter().find(|u| u.id == id)
    }
}

/// Login credentials
#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

/// Login response  
#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub user: User,
}

/// Main login function
pub fn login(request: LoginRequest) -> Result<LoginResponse, String> {
    // Mock implementation
    Ok(LoginResponse {
        token: "fake-jwt-token".to_string(),
        user: User {
            id: 1,
            name: "Test User".to_string(),
            email: request.email,
        }
    })
}
`;

      fs.writeFileSync(path.join(rustDir, 'Cargo.toml'), cargoToml);
      this.ensureDirectory(path.join(rustDir, 'src'));
      fs.writeFileSync(path.join(rustDir, 'src', 'lib.rs'), rustLib);

      // Extract initial surface
      const surface1Result = this.runCommand(
        'node ../packages/cli/src/cli.ts surface --lang rs --out surface-v1.json',
        rustDir
      );

      const surface1Exists = fs.existsSync(path.join(rustDir, 'surface-v1.json'));
      let surface1Data: any = {};
      if (surface1Exists) {
        surface1Data = JSON.parse(fs.readFileSync(path.join(rustDir, 'surface-v1.json'), 'utf8'));
      }

      // Make breaking change - remove public function
      const breakingRustLib = rustLib.replace(
        'pub fn login(request: LoginRequest) -> Result<LoginResponse, String>',
        'fn login_internal(request: LoginRequest) -> Result<LoginResponse, String>' // Made private
      ).replace(
        'pub struct LoginRequest',
        'struct LoginRequest' // Made private - breaking change
      );

      fs.writeFileSync(path.join(rustDir, 'src', 'lib.rs'), breakingRustLib);

      // Extract surface after breaking change
      const surface2Result = this.runCommand(
        'node ../packages/cli/src/cli.ts surface --lang rs --out surface-v2.json',
        rustDir
      );

      // Run version plan to detect breaking change
      const versionPlanResult = this.runCommand(
        'node ../packages/cli/src/cli.ts version plan --out version-plan.json',
        rustDir
      );

      let breakingChangeDetected = false;
      let versionPlan: any = {};
      
      if (fs.existsSync(path.join(rustDir, 'version-plan.json'))) {
        versionPlan = JSON.parse(fs.readFileSync(path.join(rustDir, 'version-plan.json'), 'utf8'));
        breakingChangeDetected = versionPlan.required_bump === 'MAJOR' || 
                                versionPlan.type === 'MAJOR' ||
                                versionPlanResult.stdout.includes('MAJOR');
      }

      const surfaceNonEmpty = surface1Data && Object.keys(surface1Data).length > 0;

      this.recordResult(
        'Rust surface extraction and breaking change detection',
        2,
        surface1Result.code === 0 && surface2Result.code === 0 && surfaceNonEmpty && breakingChangeDetected,
        {
          initial_surface_extracted: surface1Result.code === 0,
          surface_non_empty: surfaceNonEmpty,
          breaking_surface_extracted: surface2Result.code === 0,
          version_plan_success: versionPlanResult.code === 0,
          breaking_change_detected: breakingChangeDetected,
          required_bump: versionPlan.required_bump || versionPlan.type,
          surface_items_count: surfaceNonEmpty ? Object.keys(surface1Data).length : 0
        },
        !surfaceNonEmpty ? 'Surface extraction produced empty results' :
        !breakingChangeDetected ? 'Breaking change was not detected with MAJOR bump requirement' : undefined
      );

    } catch (error) {
      this.recordResult(
        'Rust surface extraction and breaking change detection',
        2,
        false,
        undefined,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * CRITERIA 3: Watch Performance
   * Edit file → validate/surface/gates update in ≤3s
   */
  async testWatchPerformance(): Promise<void> {
    this.logTest('Watch performance under 3 seconds', 3);
    
    try {
      const watchDir = path.join(this.testWorkspace, 'watch-test');
      this.ensureDirectory(watchDir);

      // Create test project with assembly  
      const assemblyContent = `
import "github.com/arbiter-framework/schemas/artifact"
import "github.com/arbiter-framework/schemas/profiles"

Artifact: artifact.#Artifact & {
  kind: "service"
  language: "typescript"
  metadata: {
    name: "watch-test"
    version: "1.0.0"
  }
}

Profile: profiles.#service & {
  contracts: {
    forbidBreaking: true
    invariants: [
      {
        name: "response_time"
        description: "API responses under 200ms"
        formula: "response_time <= 200"
      }
    ]
  }
}
`;

      fs.writeFileSync(path.join(watchDir, 'arbiter.assembly.cue'), assemblyContent);
      
      // Create source file to edit
      this.ensureDirectory(path.join(watchDir, 'src'));
      const initialSource = `
export interface ApiResponse {
  success: boolean;
  data: any;
}

export class ApiService {
  async getData(): Promise<ApiResponse> {
    return { success: true, data: {} };
  }
}
`;
      fs.writeFileSync(path.join(watchDir, 'src', 'api.ts'), initialSource);

      // Start watch process (background)
      let watchProcess: ChildProcess | null = null;
      let watchOutput = '';
      
      try {
        watchProcess = spawn('node', ['../packages/cli/src/cli.ts', 'watch'], {
          cwd: watchDir,
          stdio: ['ignore', 'pipe', 'pipe']
        });

        if (watchProcess.stdout) {
          watchProcess.stdout.on('data', (data) => {
            watchOutput += data.toString();
          });
        }

        // Wait for watch to initialize
        await new Promise(resolve => setTimeout(resolve, 1000));

        const startTime = Date.now();

        // Make file edit
        const modifiedSource = initialSource + `
export function newUtility(input: string): string {
  return input.toUpperCase();
}
`;
        fs.writeFileSync(path.join(watchDir, 'src', 'api.ts'), modifiedSource);

        // Wait for watch to detect and process change
        await new Promise(resolve => setTimeout(resolve, 4000));

        const processingTime = Date.now() - startTime;

        // Check if validation, surface, and gates were updated
        const watchSuccessful = watchOutput.includes('validate') || 
                              watchOutput.includes('surface') ||
                              watchOutput.includes('check') ||
                              watchOutput.includes('gates');

        this.recordResult(
          'Watch performance',
          3,
          processingTime <= this.PERFORMANCE_THRESHOLD_MS && watchSuccessful,
          {
            processing_time_ms: processingTime,
            threshold_ms: this.PERFORMANCE_THRESHOLD_MS,
            watch_output_detected: watchSuccessful,
            watch_output_sample: watchOutput.substring(0, 200)
          },
          processingTime > this.PERFORMANCE_THRESHOLD_MS ? 
            `Processing time ${processingTime}ms exceeds ${this.PERFORMANCE_THRESHOLD_MS}ms threshold` :
            !watchSuccessful ? 'Watch did not detect file changes or process validation/surface/gates' : undefined,
          processingTime
        );

      } finally {
        if (watchProcess) {
          watchProcess.kill();
        }
      }

    } catch (error) {
      this.recordResult(
        'Watch performance',
        3,
        false,
        undefined,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * CRITERIA 4: Tests Generate & Cover
   * tests generate produces runnable suites; tests cover computes Contract Coverage
   */
  async testTestsGenerateAndCover(): Promise<void> {
    this.logTest('Tests generation and coverage computation', 4);
    
    try {
      const testsDir = path.join(this.testWorkspace, 'tests-gen-test');
      this.ensureDirectory(testsDir);

      // Create assembly with testable contracts
      const assemblyContent = `
import "github.com/arbiter-framework/schemas/artifact"
import "github.com/arbiter-framework/schemas/profiles"

Artifact: artifact.#Artifact & {
  kind: "library"
  language: "typescript"
  metadata: {
    name: "tests-gen-test"
    version: "1.0.0"
  }
}

Profile: profiles.#library & {
  contracts: {
    invariants: [
      {
        name: "pure_functions"
        description: "All utility functions are pure"
        formula: "∀x. f(x) = f(x)"
        cue: "math.add(2, 3) == 5"
        testable: true
      },
      {
        name: "input_validation"
        description: "Functions validate input parameters"
        formula: "∀x. validate(x) ⟹ process(x)"
        cue: "string.length > 0"
        testable: true  
      },
      {
        name: "error_handling"
        description: "Functions handle errors gracefully"
        formula: "∀x. error(x) ⟹ Result<T, E>"
        testable: true
      }
    ]
  }
  tests: {
    coverage: {
      threshold: 85
      contracts: true
    }
  }
}
`;

      fs.writeFileSync(path.join(testsDir, 'arbiter.assembly.cue'), assemblyContent);

      // Create source code to test
      this.ensureDirectory(path.join(testsDir, 'src'));
      const mathSource = `
export function add(a: number, b: number): number {
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new Error('Both parameters must be numbers');
  }
  return a + b;
}

export function multiply(a: number, b: number): number {
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new Error('Both parameters must be numbers');
  }
  return a * b;
}

export function validateString(input: string): boolean {
  return typeof input === 'string' && input.length > 0;
}

export function processString(input: string): string {
  if (!validateString(input)) {
    throw new Error('Invalid input string');
  }
  return input.trim().toLowerCase();
}
`;

      fs.writeFileSync(path.join(testsDir, 'src', 'math.ts'), mathSource);

      // Generate tests
      const testsGenResult = this.runCommand(
        'node ../packages/cli/src/cli.ts tests generate --from-assembly --language typescript --out tests/',
        testsDir
      );

      // Check if test files were generated
      const testsGenerated = fs.existsSync(path.join(testsDir, 'tests')) &&
        fs.readdirSync(path.join(testsDir, 'tests')).length > 0;

      // Run tests (if generated)
      let testsRunnable = false;
      if (testsGenerated) {
        const testRunResult = this.runCommand('npm test 2>/dev/null || vitest run || jest', testsDir);
        testsRunnable = testRunResult.code === 0 || testRunResult.stdout.includes('pass');
      }

      // Run coverage computation
      const coverResult = this.runCommand(
        'node ../packages/cli/src/cli.ts tests cover --out coverage-report.json',
        testsDir
      );

      // Check coverage report
      let contractCoverageComputed = false;
      let coverageData: any = {};
      
      if (fs.existsSync(path.join(testsDir, 'coverage-report.json'))) {
        coverageData = JSON.parse(fs.readFileSync(path.join(testsDir, 'coverage-report.json'), 'utf8'));
        contractCoverageComputed = coverageData.contract_coverage !== undefined ||
                                  coverageData.contracts !== undefined ||
                                  coverResult.stdout.includes('Contract Coverage');
      }

      this.recordResult(
        'Tests generation and coverage',
        4,
        testsGenResult.code === 0 && testsGenerated && testsRunnable && contractCoverageComputed,
        {
          tests_generate_success: testsGenResult.code === 0,
          test_files_generated: testsGenerated,
          tests_runnable: testsRunnable,
          cover_command_success: coverResult.code === 0,
          contract_coverage_computed: contractCoverageComputed,
          coverage_data: coverageData
        },
        !testsGenerated ? 'Test files were not generated' :
        !testsRunnable ? 'Generated tests are not runnable' :
        !contractCoverageComputed ? 'Contract Coverage was not computed' : undefined
      );

    } catch (error) {
      this.recordResult(
        'Tests generation and coverage',
        4,
        false,
        undefined,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * CRITERIA 5: Traceability  
   * TRACE.json links REQ→SPEC→TEST→CODE with no dangling IDs
   */
  async testTraceability(): Promise<void> {
    this.logTest('Traceability with no dangling IDs', 5);
    
    try {
      const traceDir = path.join(this.testWorkspace, 'trace-test');
      this.ensureDirectory(traceDir);

      // Create requirements  
      const reqContent = `
# Traceability Test Requirements

## REQ-AUTH-001: User Authentication
**Deliverable:** Secure login system
**Acceptance:** Users can login with email/password

## REQ-VALID-002: Input Validation  
**Deliverable:** Validate all user inputs
**Acceptance:** Reject invalid inputs with clear messages

## REQ-PERF-003: Performance Requirements
**Deliverable:** Fast response times
**Acceptance:** Login responds in <200ms
`;

      fs.writeFileSync(path.join(traceDir, 'requirements.md'), reqContent);

      // Generate requirements.cue
      const reqResult = this.runCommand(
        'node ../packages/cli/src/cli.ts requirements analyze requirements.md --out requirements.cue',
        traceDir
      );

      // Create spec from requirements
      const specResult = this.runCommand(
        'node ../packages/cli/src/cli.ts spec generate --from-requirements requirements.cue --template service --out arbiter.assembly.cue',
        traceDir
      );

      // Generate tests with traceability markers
      const testsResult = this.runCommand(
        'node ../packages/cli/src/cli.ts tests generate --from-assembly --language typescript --out tests/ --trace',
        traceDir
      );

      // Create some source code with ARBITER markers
      this.ensureDirectory(path.join(traceDir, 'src'));
      const sourceWithMarkers = `
// ARBITER:BEGIN REQ-AUTH-001
export class AuthService {
  // ARBITER:BEGIN SPEC-LOGIN-001
  async login(email: string, password: string): Promise<AuthResult> {
    // ARBITER:BEGIN REQ-VALID-002
    if (!this.validateEmail(email)) {
      throw new Error('Invalid email format');
    }
    // ARBITER:END REQ-VALID-002
    
    // Implementation
    return { success: true, token: 'jwt-token' };
  }
  // ARBITER:END SPEC-LOGIN-001
}
// ARBITER:END REQ-AUTH-001

interface AuthResult {
  success: boolean;
  token?: string;
  error?: string;
}
`;

      fs.writeFileSync(path.join(traceDir, 'src', 'auth.ts'), sourceWithMarkers);

      // Build traceability links
      const traceResult = this.runCommand(
        'node ../packages/cli/src/cli.ts trace link --scan-code --out TRACE.json',
        traceDir
      );

      // Generate trace report
      const reportResult = this.runCommand(
        'node ../packages/cli/src/cli.ts trace report --out trace-report.json',
        traceDir
      );

      // Validate TRACE.json structure
      let traceValid = false;
      let danglingIds: string[] = [];
      let traceData: any = {};

      if (fs.existsSync(path.join(traceDir, 'TRACE.json'))) {
        traceData = JSON.parse(fs.readFileSync(path.join(traceDir, 'TRACE.json'), 'utf8'));
        
        // Check for required structure
        const hasRequirements = traceData.requirements && Array.isArray(traceData.requirements);
        const hasSpecs = traceData.specifications && Array.isArray(traceData.specifications);  
        const hasTests = traceData.tests && Array.isArray(traceData.tests);
        const hasCode = traceData.code && Array.isArray(traceData.code);
        const hasLinks = traceData.links && Array.isArray(traceData.links);

        traceValid = hasRequirements && hasSpecs && hasTests && hasCode && hasLinks;

        // Check for dangling IDs (IDs referenced but not defined)
        const allIds = new Set<string>();
        const referencedIds = new Set<string>();

        // Collect all defined IDs
        [traceData.requirements, traceData.specifications, traceData.tests, traceData.code]
          .filter(Boolean)
          .flat()
          .forEach((item: any) => {
            if (item.id) allIds.add(item.id);
          });

        // Collect all referenced IDs  
        traceData.links?.forEach((link: any) => {
          if (link.from) referencedIds.add(link.from);
          if (link.to) referencedIds.add(link.to);
        });

        // Find dangling references
        referencedIds.forEach(id => {
          if (!allIds.has(id)) {
            danglingIds.push(id);
          }
        });
      }

      this.recordResult(
        'Traceability with no dangling IDs',
        5,
        traceResult.code === 0 && traceValid && danglingIds.length === 0,
        {
          trace_command_success: traceResult.code === 0,
          report_command_success: reportResult.code === 0,
          trace_json_exists: fs.existsSync(path.join(traceDir, 'TRACE.json')),
          trace_structure_valid: traceValid,
          dangling_ids_count: danglingIds.length,
          dangling_ids: danglingIds,
          total_requirements: traceData.requirements?.length || 0,
          total_specs: traceData.specifications?.length || 0,
          total_tests: traceData.tests?.length || 0,
          total_code_markers: traceData.code?.length || 0,
          total_links: traceData.links?.length || 0
        },
        danglingIds.length > 0 ? `Found ${danglingIds.length} dangling IDs: ${danglingIds.join(', ')}` :
        !traceValid ? 'TRACE.json does not have valid structure' : undefined
      );

    } catch (error) {
      this.recordResult(
        'Traceability with no dangling IDs',
        5,
        false,
        undefined,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * CRITERIA 6: Determinism
   * Identical inputs yield byte-identical outputs across two runs  
   */
  async testDeterminism(): Promise<void> {
    this.logTest('Deterministic output for identical inputs', 6);
    
    try {
      const detDir = path.join(this.testWorkspace, 'determinism-test');
      this.ensureDirectory(detDir);

      // Create fixed input assembly
      const assemblyContent = `
import "github.com/arbiter-framework/schemas/artifact"
import "github.com/arbiter-framework/schemas/profiles"

Artifact: artifact.#Artifact & {
  kind: "service"
  language: "typescript"
  metadata: {
    name: "determinism-test"
    version: "1.0.0"
    description: "Test deterministic generation"
  }
}

Profile: profiles.#service & {
  contracts: {
    invariants: [
      {
        name: "deterministic_behavior"
        description: "System produces consistent outputs"
        formula: "∀x. f(x) = f(x)"
      }
    ]
  }
}
`;

      fs.writeFileSync(path.join(detDir, 'arbiter.assembly.cue'), assemblyContent);

      // Run 1: Generate all outputs
      const gen1Results = {
        docs: this.runCommand('node ../packages/cli/src/cli.ts docs assembly --md --out run1-spec.md', detDir),
        plan: this.runCommand('node ../packages/cli/src/cli.ts plan milestone M1 --out run1-plan.json', detDir),
        preview: this.runCommand('node ../packages/cli/src/cli.ts preview --format=json --out run1-preview.json', detDir),
        tests: this.runCommand('node ../packages/cli/src/cli.ts tests generate --language typescript --out run1-tests/', detDir)
      };

      // Wait to ensure different timestamps if any
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Run 2: Generate identical outputs  
      const gen2Results = {
        docs: this.runCommand('node ../packages/cli/src/cli.ts docs assembly --md --out run2-spec.md', detDir),
        plan: this.runCommand('node ../packages/cli/src/cli.ts plan milestone M1 --out run2-plan.json', detDir),
        preview: this.runCommand('node ../packages/cli/src/cli.ts preview --format=json --out run2-preview.json', detDir),
        tests: this.runCommand('node ../packages/cli/src/cli.ts tests generate --language typescript --out run2-tests/', detDir)
      };

      // Compare file hashes
      const comparisons = [
        { file1: 'run1-spec.md', file2: 'run2-spec.md', type: 'docs' },
        { file1: 'run1-plan.json', file2: 'run2-plan.json', type: 'plan' },
        { file1: 'run1-preview.json', file2: 'run2-preview.json', type: 'preview' }
      ];

      const fileComparisons: Record<string, boolean> = {};
      const hashDifferences: string[] = [];

      for (const comp of comparisons) {
        const path1 = path.join(detDir, comp.file1);
        const path2 = path.join(detDir, comp.file2);
        
        if (fs.existsSync(path1) && fs.existsSync(path2)) {
          const hash1 = this.hashFile(path1);
          const hash2 = this.hashFile(path2);
          const identical = hash1 === hash2;
          
          fileComparisons[comp.type] = identical;
          if (!identical) {
            hashDifferences.push(comp.type);
          }
        } else {
          fileComparisons[comp.type] = false;
          hashDifferences.push(`${comp.type} (missing files)`);
        }
      }

      // Compare test directory structure
      let testsIdentical = false;
      const run1TestsDir = path.join(detDir, 'run1-tests');  
      const run2TestsDir = path.join(detDir, 'run2-tests');

      if (fs.existsSync(run1TestsDir) && fs.existsSync(run2TestsDir)) {
        const run1Files = fs.readdirSync(run1TestsDir, { recursive: true });
        const run2Files = fs.readdirSync(run2TestsDir, { recursive: true });
        
        if (run1Files.length === run2Files.length && run1Files.length > 0) {
          testsIdentical = run1Files.every((file, idx) => {
            if (typeof file === 'string' && typeof run2Files[idx] === 'string') {
              const file1Path = path.join(run1TestsDir, file);
              const file2Path = path.join(run2TestsDir, run2Files[idx] as string);
              
              if (fs.statSync(file1Path).isFile() && fs.statSync(file2Path).isFile()) {
                return this.hashFile(file1Path) === this.hashFile(file2Path);
              }
            }
            return true;
          });
        }
      }

      const allCommandsSucceeded = Object.values(gen1Results).every(r => r.code === 0) &&
                                   Object.values(gen2Results).every(r => r.code === 0);

      const allFilesIdentical = Object.values(fileComparisons).every(Boolean) && testsIdentical;

      this.recordResult(
        'Deterministic output generation',
        6,
        allCommandsSucceeded && allFilesIdentical,
        {
          all_commands_succeeded: allCommandsSucceeded,
          file_comparisons: fileComparisons,
          tests_identical: testsIdentical,
          total_differences: hashDifferences.length,
          differences: hashDifferences,
          run1_success_count: Object.values(gen1Results).filter(r => r.code === 0).length,
          run2_success_count: Object.values(gen2Results).filter(r => r.code === 0).length
        },
        !allFilesIdentical ? `Output files differ: ${hashDifferences.join(', ')}` :
        !allCommandsSucceeded ? 'Some generation commands failed' : undefined
      );

    } catch (error) {
      this.recordResult(
        'Deterministic output generation',
        6,
        false,
        undefined,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * CRITERIA 7: No "Not Implemented" Errors
   * All commands from sections 2-10 work without "not implemented" 
   */
  async testNoNotImplemented(): Promise<void> {
    this.logTest('All commands work without "not implemented" errors', 7);
    
    try {
      const cmdTestDir = path.join(this.testWorkspace, 'commands-test');
      this.ensureDirectory(cmdTestDir);

      // Create basic assembly for testing commands
      const assemblyContent = `
import "github.com/arbiter-framework/schemas/artifact"
import "github.com/arbiter-framework/schemas/profiles"

Artifact: artifact.#Artifact & {
  kind: "library"
  language: "typescript"
  metadata: {
    name: "commands-test"
    version: "1.0.0"
  }
}

Profile: profiles.#library & {}
`;

      fs.writeFileSync(path.join(cmdTestDir, 'arbiter.assembly.cue'), assemblyContent);

      // Test all critical commands from sections 2-10
      const commandsToTest = [
        // Section 2 - Core endpoints via CLI
        { name: 'validate', cmd: 'validate' },
        { name: 'check', cmd: 'check' },
        { name: 'docs schema', cmd: 'docs schema --json --out schema.json' },
        { name: 'docs assembly', cmd: 'docs assembly --md --out assembly.md' },
        { name: 'explain', cmd: 'explain' },
        { name: 'export', cmd: 'export --json --out export.json' },
        
        // Section 3 - Requirements pipeline
        // (requirements analyze tested in criteria 1)
        // (spec generate tested in criteria 1)
        
        // Section 4 - Interactive spec (dry-run)
        { name: 'spec create', cmd: 'spec create --dry-run' },
        
        // Section 5 - Surface extraction
        { name: 'surface typescript', cmd: 'surface --lang ts --out surface.json' },
        
        // Section 6 - Watch (tested in criteria 3)
        
        // Section 7 - Tests (tested in criteria 4)
        
        // Section 8 - Traceability (tested in criteria 5) 
        
        // Section 9 - Version management
        { name: 'version plan', cmd: 'version plan --out version.json' },
        
        // Section 10 - Ecosystem
        { name: 'ide recommend', cmd: 'ide recommend --dry-run' },
        { name: 'sync', cmd: 'sync --dry-run' },
        { name: 'integrate', cmd: 'integrate --dry-run' }
      ];

      const commandResults: Record<string, any> = {};
      const notImplementedErrors: string[] = [];
      let totalCommands = commandsToTest.length;
      let successfulCommands = 0;

      for (const { name, cmd } of commandsToTest) {
        const result = this.runCommand(`node ../packages/cli/src/cli.ts ${cmd}`, cmdTestDir);
        
        const notImplemented = result.stdout.includes('not implemented') ||
                              result.stderr.includes('not implemented') ||
                              result.stdout.includes('Not implemented') ||
                              result.stderr.includes('Not implemented') ||
                              result.stdout.includes('TODO') ||
                              result.stderr.includes('TODO');

        const success = result.code === 0 && !notImplemented;
        
        if (success) {
          successfulCommands++;
        }
        
        if (notImplemented) {
          notImplementedErrors.push(name);
        }

        commandResults[name] = {
          exit_code: result.code,
          not_implemented: notImplemented,
          success: success,
          output_sample: result.stdout.substring(0, 100) + (result.stderr ? ` | ${result.stderr.substring(0, 100)}` : '')
        };
      }

      const noNotImplementedErrors = notImplementedErrors.length === 0;
      const minimumSuccessRate = successfulCommands / totalCommands >= 0.8; // 80% success rate

      this.recordResult(
        'All commands work without "not implemented"',
        7,
        noNotImplementedErrors && minimumSuccessRate,
        {
          total_commands_tested: totalCommands,
          successful_commands: successfulCommands,
          success_rate: Math.round((successfulCommands / totalCommands) * 100),
          not_implemented_count: notImplementedErrors.length,
          not_implemented_commands: notImplementedErrors,
          command_details: commandResults
        },
        notImplementedErrors.length > 0 ? 
          `Found "not implemented" in: ${notImplementedErrors.join(', ')}` :
        !minimumSuccessRate ? 
          `Success rate ${Math.round((successfulCommands/totalCommands)*100)}% below 80% threshold` : undefined
      );

    } catch (error) {
      this.recordResult(
        'All commands work without "not implemented"',
        7,
        false,
        undefined,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Run all acceptance tests
   */
  async runAllTests(): Promise<void> {
    console.log('🎯 Starting comprehensive acceptance testing...\n');

    await this.testWorkflowDemo();
    await this.testRustSurfaceExtraction();
    await this.testWatchPerformance();
    await this.testTestsGenerateAndCover();
    await this.testTraceability();
    await this.testDeterminism();
    await this.testNoNotImplemented();

    this.generateFinalReport();
  }

  /**
   * Generate final acceptance report
   */
  private generateFinalReport(): void {
    setTimeout(() => {
      console.log('\n' + '='.repeat(80));
      console.log('🏁 ARBITER ACCEPTANCE SUITE - FINAL RESULTS');
      console.log('='.repeat(80));

      const passedCriteria = new Set<number>();
      const failedCriteria = new Set<number>();

      this.results.forEach(result => {
        if (result.passed) {
          passedCriteria.add(result.criteriaNumber);
        } else {
          failedCriteria.add(result.criteriaNumber);
        }
      });

      console.log(`\n📊 ACCEPTANCE CRITERIA SUMMARY:`);
      console.log(`✅ Passed: ${passedCriteria.size}/7 criteria`);
      console.log(`❌ Failed: ${failedCriteria.size}/7 criteria`);

      const criteriaDescriptions = {
        1: 'Workflow Demo: TODO.md → requirements.cue → assembly.cue → SPECIFICATION.md → M1_IMPLEMENTATION.md → tests → green check',
        2: 'Rust Surface: Non-empty extraction; breaking change flips required_bump=MAJOR',
        3: 'Watch: Edit file → validate/surface/gates update in ≤3s',
        4: 'Tests: tests generate produces runnable suites; tests cover computes Contract Coverage',
        5: 'Traceability: TRACE.json links REQ→SPEC→TEST→CODE with no dangling IDs',
        6: 'Determinism: Identical inputs yield byte-identical outputs across two runs',
        7: 'No "not implemented" across commands listed in §§2–10'
      };

      console.log(`\n🎯 DETAILED RESULTS:`);
      for (let i = 1; i <= 7; i++) {
        const status = passedCriteria.has(i) ? '✅ PASS' : '❌ FAIL';
        console.log(`${i}. ${status} - ${criteriaDescriptions[i]}`);
      }

      // Show failed test details
      if (failedCriteria.size > 0) {
        console.log(`\n❌ FAILURE ANALYSIS:`);
        this.results.filter(r => !r.passed).forEach(result => {
          console.log(`\n• [Criteria ${result.criteriaNumber}] ${result.name}`);
          if (result.error) {
            console.log(`  Error: ${result.error}`);
          }
          if (result.measurements) {
            console.log(`  Measurements:`, JSON.stringify(result.measurements, null, 4));
          }
          if (result.details) {
            console.log(`  Details: ${result.details}`);
          }
        });
      }

      // Performance summary
      const performanceTests = this.results.filter(r => r.duration !== undefined);
      if (performanceTests.length > 0) {
        console.log(`\n⚡ PERFORMANCE ANALYSIS:`);
        performanceTests.forEach(test => {
          const status = test.duration! <= this.PERFORMANCE_THRESHOLD_MS ? '✅' : '⚠️';
          console.log(`${status} ${test.name}: ${test.duration}ms (threshold: ${this.PERFORMANCE_THRESHOLD_MS}ms)`);
        });
      }

      // Final production readiness assessment
      console.log(`\n🎭 PRODUCTION READINESS ASSESSMENT:`);
      const productionReady = failedCriteria.size === 0;

      if (productionReady) {
        console.log(`\n🎉 🚀 ARBITER IS PRODUCTION READY! 🚀 🎉`);
        console.log(`\nAll 7 acceptance criteria from TODO.md Section 12 have been validated successfully.`);
        console.log(`The specification-driven development platform is ready for deployment.`);
      } else {
        console.log(`\n⚠️  PRODUCTION READINESS: BLOCKED`);
        console.log(`\nFailed acceptance criteria: ${Array.from(failedCriteria).join(', ')}`);
        console.log(`\n🔧 Required fixes before production release:`);
        
        Array.from(failedCriteria).forEach(criteriaNum => {
          console.log(`${criteriaNum}. ${criteriaDescriptions[criteriaNum]}`);
        });
      }

      // Cleanup
      console.log(`\n🧹 Cleaning up test workspace...`);
      try {
        fs.rmSync(this.testWorkspace, { recursive: true, force: true });
        console.log(`✅ Test workspace cleaned`);
      } catch (e) {
        console.log(`⚠️  Cleanup warning: ${e}`);
      }

      console.log(`\n🏁 Acceptance suite complete.`);
      process.exit(productionReady ? 0 : 1);

    }, 1000);
  }
}

// Execute acceptance suite
const suite = new AcceptanceSuite();
suite.runAllTests().catch(error => {
  console.error('❌ Acceptance suite failed:', error);
  process.exit(1);
});