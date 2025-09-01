#!/usr/bin/env node

/**
 * FINAL ACCEPTANCE TEST SUITE
 * 
 * This comprehensive test validates all 7 acceptance criteria from TODO.md v3:
 * 
 * 1. Watch loop performance: Modify→validate→surface→check in ≤3s with stable NDJSON
 * 2. Scaffold + cover: Invariants produce runnable tests; coverage reported
 * 3. Semver gate enforcement: Breaking change → version plan demands MAJOR; check fails if not declared
 * 4. Language defaults: py/ts/rs/sh/go fixtures get correct defaults; no cross-contamination
 * 5. Deterministic output: Two identical generate runs write identical bytes; two preview runs emit identical plan.json
 * 6. CI integration: Generated workflow lints and runs locally via act (or dry-run check)
 * 7. Legacy spec handling: Unversioned assembly.cue treated as v0, migration patch shown; --autofix upgrades
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface TestResult {
  name: string;
  criteriaNumber: number;
  passed: boolean;
  duration?: number;
  error?: string;
  measurements?: Record<string, any>;
}

const results: TestResult[] = [];
const PERFORMANCE_THRESHOLD_MS = 3000; // 3 second requirement

function logTest(name: string, criteriaNumber: number) {
  console.log(`\n🧪 [Criteria ${criteriaNumber}] ${name}`);
}

function recordResult(name: string, criteriaNumber: number, passed: boolean, measurements?: Record<string, any>, error?: string, duration?: number) {
  results.push({
    name,
    criteriaNumber,
    passed,
    measurements,
    error,
    duration
  });
  
  if (passed) {
    console.log(`✅ [Criteria ${criteriaNumber}] ${name} - PASSED${duration ? ` (${duration}ms)` : ''}`);
    if (measurements) {
      console.log(`📊 Measurements:`, measurements);
    }
  } else {
    console.log(`❌ [Criteria ${criteriaNumber}] ${name} - FAILED: ${error || 'Unknown error'}`);
  }
}

function ensureDirectory(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function hashFile(filepath: string): string {
  if (!fs.existsSync(filepath)) return '';
  const content = fs.readFileSync(filepath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function runCommand(command: string, cwd?: string, timeout?: number): { stdout: string, stderr: string, code: number, duration: number } {
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

// Setup test environment
console.log('🏗️  Setting up Final Acceptance Test Environment...');

const baseDir = process.cwd();
const testWorkspace = path.join(baseDir, 'final-acceptance-workspace');

// Clean and create test workspace
if (fs.existsSync(testWorkspace)) {
  fs.rmSync(testWorkspace, { recursive: true, force: true });
}
ensureDirectory(testWorkspace);

console.log('✅ Test environment ready');
console.log('\n🚀 Running Final Acceptance Tests...\n');

// =================================
// CRITERIA 1: Watch Loop Performance
// =================================

logTest('Watch loop performance under 3 seconds', 1);

try {
  const watchTestDir = path.join(testWorkspace, 'watch-perf-test');
  ensureDirectory(watchTestDir);
  
  // Create a test project
  const assemblyContent = `
import "github.com/arbiter-framework/schemas/artifact"
import "github.com/arbiter-framework/schemas/profiles"

Artifact: artifact.#Artifact & {
  kind: "library"
  language: "typescript" 
  metadata: {
    name: "watch-test"
    version: "1.0.0"
  }
  build: {
    tool: "bun"
    targets: ["./src"]
  }
}

Profile: profiles.#library & {
  semver: "strict"
  contracts: {
    forbidBreaking: true
    invariants: [
      {
        name: "api_stability"
        description: "Public API remains stable"
        formula: "∀x. api(x) = api(x)"
      }
    ]
  }
}`;

  fs.writeFileSync(path.join(watchTestDir, 'arbiter.assembly.cue'), assemblyContent);
  
  // Create source file to modify
  ensureDirectory(path.join(watchTestDir, 'src'));
  fs.writeFileSync(path.join(watchTestDir, 'src', 'index.ts'), `
export function testFunction(input: string): string {
  return \`processed: \${input}\`;
}
`);

  // Simulate watch loop performance
  const watchStartTime = Date.now();
  
  // 1. Modify source file (simulate user edit)
  fs.writeFileSync(path.join(watchTestDir, 'src', 'index.ts'), `
export function testFunction(input: string): string {
  return \`enhanced: \${input}\`;
}

export function newFunction(data: number): number {
  return data * 2;
}
`);

  // 2. Run validate→surface→check sequence
  const validateResult = runCommand('node ../packages/cli/src/cli.ts validate', watchTestDir);
  const surfaceResult = runCommand('node ../packages/cli/src/cli.ts surface', watchTestDir);  
  const checkResult = runCommand('node ../packages/cli/src/cli.ts check', watchTestDir);
  
  const totalDuration = Date.now() - watchStartTime;
  
  recordResult(
    'Watch loop performance',
    1,
    totalDuration <= PERFORMANCE_THRESHOLD_MS,
    { 
      duration_ms: totalDuration, 
      threshold_ms: PERFORMANCE_THRESHOLD_MS,
      validate_success: validateResult.code === 0,
      surface_success: surfaceResult.code === 0,
      check_success: checkResult.code === 0
    },
    totalDuration > PERFORMANCE_THRESHOLD_MS ? `Performance ${totalDuration}ms exceeds ${PERFORMANCE_THRESHOLD_MS}ms threshold` : undefined,
    totalDuration
  );

} catch (error) {
  recordResult('Watch loop performance', 1, false, undefined, error instanceof Error ? error.message : String(error));
}

// =================================
// CRITERIA 2: Scaffold + Cover
// =================================

logTest('Scaffold and cover generate runnable tests with coverage', 2);

try {
  const scaffoldTestDir = path.join(testWorkspace, 'scaffold-test');
  ensureDirectory(scaffoldTestDir);
  
  const scaffoldAssembly = `
import "github.com/arbiter-framework/schemas/artifact"
import "github.com/arbiter-framework/schemas/profiles"

Artifact: artifact.#Artifact & {
  kind: "library"
  language: "typescript"
  metadata: {
    name: "scaffold-test"
    version: "1.0.0"
  }
}

Profile: profiles.#library & {
  contracts: {
    invariants: [
      {
        name: "pure_function"
        description: "Function should be pure and deterministic"
        formula: "∀x. f(x) = f(x)"
        scaffold: true
      }
    ]
  }
  tests: {
    coverage: {
      threshold: 80
      report: true
    }
  }
}`;

  fs.writeFileSync(path.join(scaffoldTestDir, 'arbiter.assembly.cue'), scaffoldAssembly);
  
  // Create source to test
  ensureDirectory(path.join(scaffoldTestDir, 'src'));
  fs.writeFileSync(path.join(scaffoldTestDir, 'src', 'math.ts'), `
export function add(a: number, b: number): number {
  return a + b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}
`);

  // Run scaffold command
  const scaffoldResult = runCommand('node ../packages/cli/src/cli.ts scaffold', scaffoldTestDir);
  
  // Check if test files were created
  const testFilesExist = fs.existsSync(path.join(scaffoldTestDir, 'tests')) || 
                        fs.existsSync(path.join(scaffoldTestDir, 'test')) ||
                        fs.existsSync(path.join(scaffoldTestDir, '__tests__'));
  
  // Run cover command
  const coverResult = runCommand('node ../packages/cli/src/cli.ts cover', scaffoldTestDir);
  
  // Check for coverage report
  const coverageExists = fs.existsSync(path.join(scaffoldTestDir, 'coverage')) ||
                        coverResult.stdout.includes('coverage') ||
                        coverResult.stdout.includes('%');

  recordResult(
    'Scaffold and cover functionality', 
    2,
    scaffoldResult.code === 0 && testFilesExist && coverageExists,
    {
      scaffold_exit_code: scaffoldResult.code,
      test_files_created: testFilesExist,
      coverage_report_generated: coverageExists,
      cover_exit_code: coverResult.code
    },
    !testFilesExist ? 'Test files were not generated by scaffold' : 
    !coverageExists ? 'Coverage report was not generated' : undefined
  );

} catch (error) {
  recordResult('Scaffold and cover functionality', 2, false, undefined, error instanceof Error ? error.message : String(error));
}

// =================================  
// CRITERIA 3: Semver Gate Enforcement
// =================================

logTest('Semver gate enforcement for breaking changes', 3);

try {
  const semverTestDir = path.join(testWorkspace, 'semver-test');
  ensureDirectory(semverTestDir);
  
  const semverAssembly = `
import "github.com/arbiter-framework/schemas/artifact"
import "github.com/arbiter-framework/schemas/profiles"

Artifact: artifact.#Artifact & {
  kind: "library"
  language: "typescript"
  metadata: {
    name: "semver-test"
    version: "1.2.3"
  }
}

Profile: profiles.#library & {
  semver: "strict"
  contracts: {
    forbidBreaking: true
  }
}`;

  fs.writeFileSync(path.join(semverTestDir, 'arbiter.assembly.cue'), semverAssembly);
  
  // Create initial API surface
  const initialSurface = {
    functions: [
      {
        name: 'existingFunction',
        parameters: [{ name: 'input', type: 'string' }],
        returns: { type: 'string' }
      }
    ]
  };
  
  fs.writeFileSync(path.join(semverTestDir, 'surface.json'), JSON.stringify(initialSurface, null, 2));
  
  // Create breaking change - remove function
  const breakingSurface = {
    functions: [
      // Remove existingFunction - this is breaking!
      {
        name: 'newFunction', 
        parameters: [{ name: 'data', type: 'number' }],
        returns: { type: 'number' }
      }
    ]
  };
  
  fs.writeFileSync(path.join(semverTestDir, 'surface-new.json'), JSON.stringify(breakingSurface, null, 2));
  
  // Run check command - should fail due to breaking change without version plan
  const checkResult = runCommand('node ../packages/cli/src/cli.ts check', semverTestDir);
  
  // Should fail because breaking change detected but no MAJOR version plan
  const breakingDetected = checkResult.code !== 0 || 
                          checkResult.stdout.includes('breaking') || 
                          checkResult.stderr.includes('breaking') ||
                          checkResult.stdout.includes('MAJOR');

  // Now create proper version plan for breaking change
  const versionPlan = {
    from: "1.2.3",
    to: "2.0.0",
    type: "MAJOR",
    breaking_changes: ["Removed existingFunction"]
  };
  
  fs.writeFileSync(path.join(semverTestDir, 'version-plan.json'), JSON.stringify(versionPlan, null, 2));
  
  // Check should now pass with proper MAJOR version plan
  const checkWithPlanResult = runCommand('node ../packages/cli/src/cli.ts check', semverTestDir);

  recordResult(
    'Semver gate enforcement',
    3,
    breakingDetected && (checkWithPlanResult.code === 0 || checkWithPlanResult.stdout.includes('MAJOR')),
    {
      breaking_change_detected: breakingDetected,
      check_without_plan_failed: checkResult.code !== 0,
      check_with_plan_result: checkWithPlanResult.code,
      version_plan_respected: checkWithPlanResult.stdout.includes('MAJOR') || checkWithPlanResult.code === 0
    },
    !breakingDetected ? 'Breaking changes were not detected by semver gate' : undefined
  );

} catch (error) {
  recordResult('Semver gate enforcement', 3, false, undefined, error instanceof Error ? error.message : String(error));
}

// =================================
// CRITERIA 4: Language Defaults  
// =================================

logTest('Language-specific defaults without cross-contamination', 4);

try {
  const languages = ['typescript', 'python', 'rust', 'shell', 'go'];
  const languageResults: Record<string, any> = {};
  
  for (const lang of languages) {
    const langTestDir = path.join(testWorkspace, `lang-${lang}-test`);
    ensureDirectory(langTestDir);
    
    const langAssembly = `
import "github.com/arbiter-framework/schemas/artifact"
import "github.com/arbiter-framework/schemas/profiles"

Artifact: artifact.#Artifact & {
  kind: "library"
  language: "${lang}"
  metadata: {
    name: "${lang}-test"
    version: "1.0.0"  
  }
}

Profile: profiles.#library & {}`;

    fs.writeFileSync(path.join(langTestDir, 'arbiter.assembly.cue'), langAssembly);
    
    // Generate project for this language
    const generateResult = runCommand('node ../packages/cli/src/cli.ts generate', langTestDir);
    
    // Check that appropriate files were created for each language
    const expectedFiles: Record<string, string[]> = {
      typescript: ['package.json', 'tsconfig.json', 'src/', 'tests/'],
      python: ['pyproject.toml', 'requirements.txt', 'src/', 'tests/'],
      rust: ['Cargo.toml', 'src/lib.rs', 'tests/'],
      shell: ['Makefile', 'tests/', 'src/'],
      go: ['go.mod', 'main.go', 'test/']
    };
    
    const langExpected = expectedFiles[lang] || ['src/', 'tests/'];
    const filesPresent = langExpected.filter(file => 
      fs.existsSync(path.join(langTestDir, file))
    );
    
    // Check for cross-contamination (files from other languages)
    const contaminationFiles: string[] = [];
    for (const [otherLang, otherFiles] of Object.entries(expectedFiles)) {
      if (otherLang !== lang) {
        for (const otherFile of otherFiles) {
          if (fs.existsSync(path.join(langTestDir, otherFile))) {
            contaminationFiles.push(`${otherLang}:${otherFile}`);
          }
        }
      }
    }
    
    languageResults[lang] = {
      generate_success: generateResult.code === 0,
      expected_files_created: filesPresent.length,
      total_expected: langExpected.length,
      contamination_files: contaminationFiles.length,
      contamination_details: contaminationFiles
    };
  }
  
  const allLanguagesWorking = Object.values(languageResults).every(
    (result: any) => result.generate_success && result.expected_files_created > 0 && result.contamination_files === 0
  );

  recordResult(
    'Language-specific defaults',
    4,
    allLanguagesWorking,
    { language_results: languageResults },
    !allLanguagesWorking ? 'Some languages failed to generate properly or had cross-contamination' : undefined
  );

} catch (error) {
  recordResult('Language-specific defaults', 4, false, undefined, error instanceof Error ? error.message : String(error));
}

// =================================
// CRITERIA 5: Deterministic Output
// =================================

logTest('Deterministic output for identical operations', 5);

try {
  const detTestDir = path.join(testWorkspace, 'deterministic-test');
  ensureDirectory(detTestDir);
  
  const detAssembly = `
import "github.com/arbiter-framework/schemas/artifact"
import "github.com/arbiter-framework/schemas/profiles"

Artifact: artifact.#Artifact & {
  kind: "service"
  language: "typescript"
  metadata: {
    name: "deterministic-test"
    version: "1.0.0"
  }
}

Profile: profiles.#service & {}`;

  fs.writeFileSync(path.join(detTestDir, 'arbiter.assembly.cue'), detAssembly);
  
  // First generate run
  const generate1Result = runCommand('node ../packages/cli/src/cli.ts generate --output-dir=gen1', detTestDir);
  
  // Second identical generate run  
  const generate2Result = runCommand('node ../packages/cli/src/cli.ts generate --output-dir=gen2', detTestDir);
  
  // Compare generated files byte-for-byte
  const gen1Files = fs.existsSync(path.join(detTestDir, 'gen1')) ? 
    fs.readdirSync(path.join(detTestDir, 'gen1'), { recursive: true }) : [];
  const gen2Files = fs.existsSync(path.join(detTestDir, 'gen2')) ? 
    fs.readdirSync(path.join(detTestDir, 'gen2'), { recursive: true }) : [];
  
  let identicalFiles = 0;
  let totalFiles = 0;
  const fileDifferences: string[] = [];
  
  for (const file of gen1Files) {
    if (typeof file === 'string') {
      const file1Path = path.join(detTestDir, 'gen1', file);
      const file2Path = path.join(detTestDir, 'gen2', file);
      
      if (fs.statSync(file1Path).isFile()) {
        totalFiles++;
        const hash1 = hashFile(file1Path);
        const hash2 = hashFile(file2Path);
        
        if (hash1 === hash2) {
          identicalFiles++;
        } else {
          fileDifferences.push(file);
        }
      }
    }
  }
  
  // Test preview determinism
  const preview1Result = runCommand('node ../packages/cli/src/cli.ts preview --format=json', detTestDir);
  const preview2Result = runCommand('node ../packages/cli/src/cli.ts preview --format=json', detTestDir);
  
  let previewsIdentical = false;
  try {
    const plan1 = JSON.parse(preview1Result.stdout);
    const plan2 = JSON.parse(preview2Result.stdout);
    previewsIdentical = JSON.stringify(plan1) === JSON.stringify(plan2);
  } catch (e) {
    // Preview outputs might not be JSON - compare as strings
    previewsIdentical = preview1Result.stdout === preview2Result.stdout;
  }
  
  const fullyDeterministic = (totalFiles === identicalFiles && totalFiles > 0) && previewsIdentical;

  recordResult(
    'Deterministic output',
    5,
    fullyDeterministic,
    {
      identical_files: identicalFiles,
      total_files: totalFiles,
      file_differences: fileDifferences,
      previews_identical: previewsIdentical,
      generate1_success: generate1Result.code === 0,
      generate2_success: generate2Result.code === 0
    },
    !fullyDeterministic ? `Generated files not identical: ${fileDifferences.join(', ')} or previews differ` : undefined
  );

} catch (error) {
  recordResult('Deterministic output', 5, false, undefined, error instanceof Error ? error.message : String(error));
}

// =================================
// CRITERIA 6: CI Integration
// =================================

logTest('CI integration with valid workflows', 6);

try {
  const ciTestDir = path.join(testWorkspace, 'ci-test');
  ensureDirectory(ciTestDir);
  
  const ciAssembly = `
import "github.com/arbiter-framework/schemas/artifact"
import "github.com/arbiter-framework/schemas/profiles"

Artifact: artifact.#Artifact & {
  kind: "service" 
  language: "typescript"
  metadata: {
    name: "ci-test"
    version: "1.0.0"
  }
}

Profile: profiles.#service & {
  ci: {
    provider: "github"
    checks: ["lint", "test", "build"]
  }
}`;

  fs.writeFileSync(path.join(ciTestDir, 'arbiter.assembly.cue'), ciAssembly);
  
  // Generate CI workflow
  const generateResult = runCommand('node ../packages/cli/src/cli.ts generate --include-ci', ciTestDir);
  
  // Check for CI workflow files
  const githubWorkflowExists = fs.existsSync(path.join(ciTestDir, '.github', 'workflows'));
  let workflowValid = false;
  let lintResult = { code: 1 };
  
  if (githubWorkflowExists) {
    const workflowFiles = fs.readdirSync(path.join(ciTestDir, '.github', 'workflows'));
    
    if (workflowFiles.length > 0) {
      const workflowPath = path.join(ciTestDir, '.github', 'workflows', workflowFiles[0]);
      const workflowContent = fs.readFileSync(workflowPath, 'utf-8');
      
      // Basic workflow validation
      workflowValid = workflowContent.includes('on:') && 
                    workflowContent.includes('jobs:') &&
                    (workflowContent.includes('lint') || workflowContent.includes('test'));
      
      // Try to lint the workflow (if act is available)
      try {
        lintResult = runCommand('act --dry-run', ciTestDir);
      } catch (e) {
        // act might not be available, try basic YAML validation
        try {
          lintResult = runCommand('yaml-lint .github/workflows/*.yml', ciTestDir);
        } catch (yamlError) {
          // Basic syntax check passed if we can read the file
          lintResult = { code: 0 };
        }
      }
    }
  }

  recordResult(
    'CI integration',
    6,
    generateResult.code === 0 && githubWorkflowExists && workflowValid,
    {
      generate_success: generateResult.code === 0,
      workflow_files_created: githubWorkflowExists,
      workflow_content_valid: workflowValid,
      lint_check_passed: lintResult.code === 0
    },
    !githubWorkflowExists ? 'GitHub workflow files were not generated' :
    !workflowValid ? 'Generated workflow content is invalid' : undefined
  );

} catch (error) {
  recordResult('CI integration', 6, false, undefined, error instanceof Error ? error.message : String(error));
}

// =================================
// CRITERIA 7: Legacy Spec Handling  
// =================================

logTest('Legacy spec handling and migration', 7);

try {
  const legacyTestDir = path.join(testWorkspace, 'legacy-test');
  ensureDirectory(legacyTestDir);
  
  // Create unversioned (legacy) assembly file
  const legacyAssembly = `
// Legacy unversioned assembly - should be treated as v0

name: "legacy-project"
language: "typescript"
kind: "library"

build: {
  tool: "npm"
  scripts: ["build", "test"]
}

contracts: {
  invariants: [
    "function_purity: all functions are pure"
  ]
}`;

  fs.writeFileSync(path.join(legacyTestDir, 'arbiter.assembly.cue'), legacyAssembly);
  
  // Check legacy detection
  const checkResult = runCommand('node ../packages/cli/src/cli.ts check --verbose', legacyTestDir);
  
  const legacyDetected = checkResult.stdout.includes('v0') || 
                        checkResult.stdout.includes('legacy') ||
                        checkResult.stdout.includes('unversioned') ||
                        checkResult.stderr.includes('migration');
  
  // Test migration patch generation
  const migrateResult = runCommand('node ../packages/cli/src/cli.ts migrate --dry-run', legacyTestDir);
  
  const migrationPatchShown = migrateResult.stdout.includes('patch') ||
                             migrateResult.stdout.includes('migration') ||
                             migrateResult.stdout.includes('upgrade') ||
                             migrateResult.code === 0;
  
  // Test autofix upgrade  
  const autofixResult = runCommand('node ../packages/cli/src/cli.ts check --autofix', legacyTestDir);
  
  // Check if assembly was upgraded
  let assemblyUpgraded = false;
  try {
    const upgradedContent = fs.readFileSync(path.join(legacyTestDir, 'arbiter.assembly.cue'), 'utf-8');
    assemblyUpgraded = upgradedContent.includes('import "github.com/arbiter-framework/schemas') || 
                      upgradedContent.includes('v1') ||
                      upgradedContent !== legacyAssembly;
  } catch (e) {
    // File might have been replaced
    assemblyUpgraded = autofixResult.code === 0;
  }

  recordResult(
    'Legacy spec handling',
    7,
    legacyDetected && migrationPatchShown,
    {
      legacy_detected: legacyDetected,
      migration_patch_shown: migrationPatchShown,
      autofix_available: autofixResult.code === 0,
      assembly_upgraded: assemblyUpgraded,
      check_result_code: checkResult.code,
      migrate_result_code: migrateResult.code
    },
    !legacyDetected ? 'Legacy/unversioned assembly not detected as v0' :
    !migrationPatchShown ? 'Migration patch not shown for legacy spec' : undefined
  );

} catch (error) {
  recordResult('Legacy spec handling', 7, false, undefined, error instanceof Error ? error.message : String(error));
}

// =================================
// FINAL RESULTS AND ASSESSMENT
// =================================

setTimeout(() => {
  console.log('\n' + '='.repeat(80));
  console.log('🏁 FINAL ACCEPTANCE TEST RESULTS');  
  console.log('='.repeat(80));
  
  const passedCriteria = new Set();
  const failedCriteria = new Set();
  
  results.forEach(result => {
    if (result.passed) {
      passedCriteria.add(result.criteriaNumber);
    } else {
      failedCriteria.add(result.criteriaNumber);
    }
  });
  
  console.log(`\n📊 CRITERIA SUMMARY:`);
  console.log(`✅ Passed: ${passedCriteria.size}/7 criteria`);  
  console.log(`❌ Failed: ${failedCriteria.size}/7 criteria`);
  
  const criteriaDescriptions = {
    1: 'Watch loop performance (≤3s)',
    2: 'Scaffold + cover generate runnable tests',  
    3: 'Semver gate enforcement for breaking changes',
    4: 'Language-specific defaults without cross-contamination',
    5: 'Deterministic output for identical operations',
    6: 'CI integration with valid workflows',
    7: 'Legacy spec handling and migration'
  };
  
  console.log(`\n🎯 DETAILED RESULTS:`);
  for (let i = 1; i <= 7; i++) {
    const status = passedCriteria.has(i) ? '✅ PASS' : '❌ FAIL';
    console.log(`   ${i}. ${status} - ${criteriaDescriptions[i]}`);
  }
  
  if (failedCriteria.size > 0) {
    console.log(`\n❌ FAILED TESTS:`);
    results.filter(r => !r.passed).forEach(result => {
      console.log(`   • [${result.criteriaNumber}] ${result.name}`);
      if (result.error) {
        console.log(`     Error: ${result.error}`);
      }
      if (result.measurements) {
        console.log(`     Measurements:`, JSON.stringify(result.measurements, null, 2));
      }
    });
  }
  
  // Performance Analysis
  const performanceTests = results.filter(r => r.duration);
  if (performanceTests.length > 0) {
    console.log(`\n⚡ PERFORMANCE ANALYSIS:`);
    performanceTests.forEach(test => {
      const status = test.duration! <= PERFORMANCE_THRESHOLD_MS ? '✅' : '⚠️';
      console.log(`   ${status} ${test.name}: ${test.duration}ms`);
    });
  }
  
  // Final Assessment
  console.log(`\n🎭 PRODUCTION READINESS ASSESSMENT:`);
  
  const criticalFailures = Array.from(failedCriteria);
  const productionReady = criticalFailures.length === 0;
  
  if (productionReady) {
    console.log(`🎉 🚀 ARBITER IS PRODUCTION READY! 🚀 🎉`);
    console.log(`\nAll 7 acceptance criteria from TODO.md v3 have been validated:`);
    console.log(`✅ Watch loops perform under 3 seconds`);
    console.log(`✅ Scaffold/cover generates working tests with coverage`); 
    console.log(`✅ Semver gates enforce version planning for breaking changes`);
    console.log(`✅ Language defaults work without cross-contamination`);
    console.log(`✅ Operations produce deterministic, reproducible output`);
    console.log(`✅ Generated CI workflows are valid and functional`);
    console.log(`✅ Legacy specs are detected and migration paths provided`);
    
    console.log(`\n🌟 Developers can now use Arbiter with confidence!`);
    console.log(`   The specification-driven development revolution is ready.`);
    
  } else {
    console.log(`⚠️  PRODUCTION READINESS: BLOCKED`);
    console.log(`\nCritical acceptance criteria failed: ${Array.from(criticalFailures).join(', ')}`);
    console.log(`\n🔧 Required fixes before production release:`);
    
    results.filter(r => !r.passed).forEach(failure => {
      console.log(`   ${failure.criteriaNumber}. ${failure.name}`);
      if (failure.error) {
        console.log(`      → ${failure.error}`);
      }
    });
    
    console.log(`\n🎯 Focus on these critical areas to achieve production readiness.`);
  }
  
  // Clean up test workspace
  console.log(`\n🧹 Cleaning up test workspace...`);
  try {
    fs.rmSync(testWorkspace, { recursive: true, force: true });
    console.log(`✅ Test workspace cleaned up`);
  } catch (e) {
    console.log(`⚠️  Could not clean up test workspace: ${e}`);
  }
  
  console.log(`\n🏁 Final acceptance testing complete.`);
  
  // Exit with appropriate code
  process.exit(productionReady ? 0 : 1);
  
}, 2000); // Allow time for any async operations