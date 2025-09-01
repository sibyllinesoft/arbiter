#!/usr/bin/env node

/**
 * ACCEPTANCE SUITE VALIDATOR
 * Validates the acceptance suite structure and dependencies without running full tests
 * Useful for CI/CD pre-checks and development validation
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface ValidationResult {
  component: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: string;
}

class AcceptanceSuiteValidator {
  private results: ValidationResult[] = [];

  private addResult(component: string, status: 'pass' | 'fail' | 'warning', message: string, details?: string): void {
    this.results.push({ component, status, message, details });
    
    const emoji = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️';
    console.log(`${emoji} ${component}: ${message}`);
    if (details) {
      console.log(`   Details: ${details}`);
    }
  }

  validateFileStructure(): void {
    console.log('\n🔍 Validating file structure...');

    const requiredFiles = [
      'acceptance-suite.ts',
      'acceptance-test-utils.ts', 
      'run-acceptance-tests.sh',
      'ACCEPTANCE_SUITE_DOCUMENTATION.md'
    ];

    const optionalFiles = [
      'validate-acceptance-suite.ts',
      'final-acceptance-tests.ts'
    ];

    // Check required files
    for (const file of requiredFiles) {
      if (fs.existsSync(path.join(__dirname, file))) {
        this.addResult('File Structure', 'pass', `Required file exists: ${file}`);
      } else {
        this.addResult('File Structure', 'fail', `Missing required file: ${file}`);
      }
    }

    // Check optional files  
    for (const file of optionalFiles) {
      if (fs.existsSync(path.join(__dirname, file))) {
        this.addResult('File Structure', 'pass', `Optional file exists: ${file}`);
      }
    }

    // Check CLI structure
    const cliPath = path.join(__dirname, 'packages', 'cli', 'src', 'cli.ts');
    if (fs.existsSync(cliPath)) {
      this.addResult('CLI Structure', 'pass', 'CLI found at expected location');
    } else {
      this.addResult('CLI Structure', 'warning', 'CLI not found at expected location', 
        'Tests may fail if CLI path is incorrect');
    }
  }

  validateSuiteStructure(): void {
    console.log('\n🔍 Validating acceptance suite structure...');

    try {
      const suiteContent = fs.readFileSync(path.join(__dirname, 'acceptance-suite.ts'), 'utf8');

      // Check for all 7 test methods
      const expectedMethods = [
        'testWorkflowDemo',
        'testRustSurfaceExtraction', 
        'testWatchPerformance',
        'testTestsGenerateAndCover',
        'testTraceability',
        'testDeterminism',
        'testNoNotImplemented'
      ];

      for (const method of expectedMethods) {
        if (suiteContent.includes(method)) {
          this.addResult('Test Methods', 'pass', `Method implemented: ${method}`);
        } else {
          this.addResult('Test Methods', 'fail', `Missing test method: ${method}`);
        }
      }

      // Check for proper TypeScript structure
      if (suiteContent.includes('class AcceptanceSuite')) {
        this.addResult('TypeScript Structure', 'pass', 'AcceptanceSuite class found');
      } else {
        this.addResult('TypeScript Structure', 'fail', 'AcceptanceSuite class not found');
      }

      // Check for result recording
      if (suiteContent.includes('recordResult')) {
        this.addResult('Result Recording', 'pass', 'Result recording mechanism present');
      } else {
        this.addResult('Result Recording', 'warning', 'Result recording mechanism not found');
      }

    } catch (error) {
      this.addResult('Suite Structure', 'fail', 'Cannot read acceptance-suite.ts', String(error));
    }
  }

  validateUtilities(): void {
    console.log('\n🔍 Validating utility structure...');

    try {
      const utilsContent = fs.readFileSync(path.join(__dirname, 'acceptance-test-utils.ts'), 'utf8');

      const expectedClasses = [
        'TestFixtureGenerator',
        'PerformanceBenchmarker',
        'TestFileUtils',
        'CommandRunner',
        'TestValidator'
      ];

      for (const className of expectedClasses) {
        if (utilsContent.includes(`class ${className}`)) {
          this.addResult('Utility Classes', 'pass', `Class implemented: ${className}`);
        } else {
          this.addResult('Utility Classes', 'fail', `Missing utility class: ${className}`);
        }
      }

      // Check for key methods
      const keyMethods = [
        'generateTypescriptLibrary',
        'generateRustLibrary',
        'measureOperation',
        'ensureDirectory',
        'validateTraceJson'
      ];

      for (const method of keyMethods) {
        if (utilsContent.includes(method)) {
          this.addResult('Utility Methods', 'pass', `Method implemented: ${method}`);
        } else {
          this.addResult('Utility Methods', 'warning', `Method not found: ${method}`);
        }
      }

    } catch (error) {
      this.addResult('Utilities', 'fail', 'Cannot read acceptance-test-utils.ts', String(error));
    }
  }

  validateDocumentation(): void {
    console.log('\n🔍 Validating documentation...');

    try {
      const docContent = fs.readFileSync(path.join(__dirname, 'ACCEPTANCE_SUITE_DOCUMENTATION.md'), 'utf8');

      // Check for required sections
      const requiredSections = [
        '## Overview',
        '## Quick Start', 
        '## Acceptance Criteria',
        '## File Structure',
        '## Running Individual Tests',
        '## Troubleshooting'
      ];

      for (const section of requiredSections) {
        if (docContent.includes(section)) {
          this.addResult('Documentation', 'pass', `Section present: ${section.replace('## ', '')}`);
        } else {
          this.addResult('Documentation', 'warning', `Section missing: ${section.replace('## ', '')}`);
        }
      }

      // Check for all 7 criteria documentation
      for (let i = 1; i <= 7; i++) {
        if (docContent.includes(`### ${i}.`)) {
          this.addResult('Criteria Docs', 'pass', `Criteria ${i} documented`);
        } else {
          this.addResult('Criteria Docs', 'warning', `Criteria ${i} documentation missing`);
        }
      }

    } catch (error) {
      this.addResult('Documentation', 'fail', 'Cannot read documentation', String(error));
    }
  }

  validateRunnerScript(): void {
    console.log('\n🔍 Validating runner script...');

    try {
      const scriptPath = path.join(__dirname, 'run-acceptance-tests.sh');
      const scriptContent = fs.readFileSync(scriptPath, 'utf8');

      // Check shebang
      if (scriptContent.startsWith('#!/bin/bash')) {
        this.addResult('Runner Script', 'pass', 'Proper shebang found');
      } else {
        this.addResult('Runner Script', 'warning', 'Shebang missing or incorrect');
      }

      // Check for error handling
      if (scriptContent.includes('set -euo pipefail')) {
        this.addResult('Error Handling', 'pass', 'Strict error handling enabled');
      } else {
        this.addResult('Error Handling', 'warning', 'Strict error handling not found');
      }

      // Check for dependency checks
      if (scriptContent.includes('command -v node')) {
        this.addResult('Dependency Checks', 'pass', 'Node.js dependency check present');
      } else {
        this.addResult('Dependency Checks', 'warning', 'Node.js dependency check missing');
      }

      // Check for execution permissions
      const stats = fs.statSync(scriptPath);
      if (stats.mode & parseInt('111', 8)) {
        this.addResult('Permissions', 'pass', 'Script has execute permissions');
      } else {
        this.addResult('Permissions', 'warning', 'Script lacks execute permissions', 
          'Run: chmod +x run-acceptance-tests.sh');
      }

    } catch (error) {
      this.addResult('Runner Script', 'fail', 'Cannot read runner script', String(error));
    }
  }

  validateTODOMapping(): void {
    console.log('\n🔍 Validating TODO.md criteria mapping...');

    try {
      const todoPath = path.join(__dirname, 'TODO.md');
      if (!fs.existsSync(todoPath)) {
        this.addResult('TODO Mapping', 'warning', 'TODO.md not found for validation');
        return;
      }

      const todoContent = fs.readFileSync(todoPath, 'utf8');
      
      // Check for section 12
      if (todoContent.includes('## 12) Acceptance suite')) {
        this.addResult('TODO Mapping', 'pass', 'Section 12 found in TODO.md');

        // Check for the 7 criteria mentioned in TODO.md
        const todoCriteria = [
          'Workflow demo',
          'Rust surface',
          'Watch:',
          'Tests:',
          'Traceability:',
          'Determinism:',
          'No "not implemented"'
        ];

        for (const criteria of todoCriteria) {
          if (todoContent.includes(criteria)) {
            this.addResult('TODO Criteria', 'pass', `Criteria mentioned: ${criteria}`);
          } else {
            this.addResult('TODO Criteria', 'warning', `Criteria not explicitly mentioned: ${criteria}`);
          }
        }
      } else {
        this.addResult('TODO Mapping', 'warning', 'Section 12 not found in TODO.md');
      }

    } catch (error) {
      this.addResult('TODO Mapping', 'fail', 'Cannot validate TODO.md mapping', String(error));
    }
  }

  validateDependencies(): void {
    console.log('\n🔍 Validating dependencies...');

    // Check Node.js
    try {
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
      
      if (majorVersion >= 18) {
        this.addResult('Dependencies', 'pass', `Node.js ${nodeVersion} (compatible)`);
      } else {
        this.addResult('Dependencies', 'warning', `Node.js ${nodeVersion} (recommend 18+)`);
      }
    } catch (error) {
      this.addResult('Dependencies', 'fail', 'Cannot check Node.js version');
    }

    // Check for package.json
    const packagePath = path.join(__dirname, 'package.json');
    if (fs.existsSync(packagePath)) {
      try {
        const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        this.addResult('Package Config', 'pass', 'package.json found and valid');
        
        // Check for TypeScript in devDependencies
        if (packageContent.devDependencies?.typescript) {
          this.addResult('TypeScript', 'pass', 'TypeScript dependency found');
        } else {
          this.addResult('TypeScript', 'warning', 'TypeScript dependency not found in devDependencies');
        }
      } catch (error) {
        this.addResult('Package Config', 'fail', 'package.json exists but invalid JSON');
      }
    } else {
      this.addResult('Package Config', 'warning', 'package.json not found');
    }
  }

  generateReport(): void {
    console.log('\n' + '='.repeat(80));
    console.log('🏁 ACCEPTANCE SUITE VALIDATION REPORT');
    console.log('='.repeat(80));

    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length; 
    const warnings = this.results.filter(r => r.status === 'warning').length;
    const total = this.results.length;

    console.log(`\n📊 VALIDATION SUMMARY:`);
    console.log(`✅ Passed: ${passed}/${total}`);
    console.log(`❌ Failed: ${failed}/${total}`);
    console.log(`⚠️  Warnings: ${warnings}/${total}`);

    if (failed > 0) {
      console.log(`\n❌ CRITICAL ISSUES:`);
      this.results.filter(r => r.status === 'fail').forEach(result => {
        console.log(`   • ${result.component}: ${result.message}`);
        if (result.details) {
          console.log(`     ${result.details}`);
        }
      });
    }

    if (warnings > 0) {
      console.log(`\n⚠️  WARNINGS:`);
      this.results.filter(r => r.status === 'warning').forEach(result => {
        console.log(`   • ${result.component}: ${result.message}`);
      });
    }

    console.log(`\n🎯 READINESS ASSESSMENT:`);
    if (failed === 0) {
      console.log(`🎉 ACCEPTANCE SUITE IS READY FOR EXECUTION!`);
      console.log(`   All critical components are present and properly structured.`);
      if (warnings > 0) {
        console.log(`   Address warnings for optimal experience.`);
      }
    } else {
      console.log(`⚠️  ACCEPTANCE SUITE HAS CRITICAL ISSUES`);
      console.log(`   Fix ${failed} critical issue${failed > 1 ? 's' : ''} before running full tests.`);
    }

    console.log(`\n🚀 Next Steps:`);
    if (failed === 0) {
      console.log(`   1. Run: ./run-acceptance-tests.sh`);
      console.log(`   2. Review full acceptance test results`);
      console.log(`   3. Address any runtime issues discovered`);
    } else {
      console.log(`   1. Fix critical issues listed above`);
      console.log(`   2. Re-run this validator: bun run validate-acceptance-suite.ts`);
      console.log(`   3. Once clean, run full suite: ./run-acceptance-tests.sh`);
    }
  }

  async runValidation(): Promise<void> {
    console.log('🔍 ACCEPTANCE SUITE VALIDATOR');
    console.log('Validates structure and dependencies without running full tests');
    console.log('='.repeat(70));

    this.validateFileStructure();
    this.validateSuiteStructure();
    this.validateUtilities();
    this.validateDocumentation();
    this.validateRunnerScript();
    this.validateTODOMapping();
    this.validateDependencies();

    this.generateReport();

    const failed = this.results.filter(r => r.status === 'fail').length;
    process.exit(failed > 0 ? 1 : 0);
  }
}

// Execute validation
const validator = new AcceptanceSuiteValidator();
validator.runValidation().catch(error => {
  console.error('❌ Validation failed:', error);
  process.exit(1);
});