import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import { spawn } from 'child_process';
import yaml from 'js-yaml';

/**
 * Unified test harness for Epic v2 test execution
 * Supports static analysis, property tests, golden file tests, and CLI tests
 */

export interface TestOptions {
  epic?: string;
  types?: string[];
  junit?: string;
  timeout?: number;
  verbose?: boolean;
  parallel?: boolean;
  updateGolden?: boolean;
}

export interface TestResult {
  name: string;
  type: 'static' | 'property' | 'golden' | 'cli';
  passed: boolean;
  duration: number;
  error?: string;
  details?: any;
}

export interface TestSuite {
  name: string;
  results: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    duration: number;
  };
}

/**
 * Run static analysis test using the API server
 */
async function runStaticTest(
  selector: string, 
  apiUrl: string, 
  timeout: number
): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    // Find files matching selector
    const { glob } = await import('glob');
    const files = await glob(selector);
    
    if (files.length === 0) {
      return {
        name: `Static: ${selector}`,
        type: 'static',
        passed: false,
        duration: Date.now() - startTime,
        error: 'No files found matching selector',
      };
    }
    
    // Analyze each file
    const errors: string[] = [];
    
    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        
        const response = await fetch(`${apiUrl}/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content, filename: file }),
          signal: AbortSignal.timeout(timeout),
        });
        
        if (!response.ok) {
          errors.push(`${file}: HTTP ${response.status}`);
          continue;
        }
        
        const result = await response.json();
        
        // Check for CUE errors (bottom values or validation errors)
        if (result.errors && result.errors.length > 0) {
          errors.push(`${file}: ${result.errors.map((e: any) => e.message).join(', ')}`);
        }
        
      } catch (error) {
        errors.push(`${file}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    return {
      name: `Static: ${selector}`,
      type: 'static',
      passed: errors.length === 0,
      duration: Date.now() - startTime,
      error: errors.length > 0 ? errors.join('; ') : undefined,
      details: { filesAnalyzed: files.length, errors },
    };
    
  } catch (error) {
    return {
      name: `Static: ${selector}`,
      type: 'static',
      passed: false,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Run property test using CUE evaluation
 */
async function runPropertyTest(
  name: string, 
  cueExpression: string, 
  apiUrl: string, 
  timeout: number
): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    // Create a simple CUE document to evaluate the expression
    const cueContent = `
package test

result: ${cueExpression}
`;
    
    const response = await fetch(`${apiUrl}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        content: cueContent, 
        filename: `property-${name}.cue`,
      }),
      signal: AbortSignal.timeout(timeout),
    });
    
    if (!response.ok) {
      return {
        name: `Property: ${name}`,
        type: 'property',
        passed: false,
        duration: Date.now() - startTime,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
    
    const result = await response.json();
    
    // Check if evaluation succeeded and result is true
    const passed = result.errors.length === 0 && 
                   result.value && 
                   result.value.result === true;
    
    return {
      name: `Property: ${name}`,
      type: 'property',
      passed,
      duration: Date.now() - startTime,
      error: passed ? undefined : 'Property evaluation failed or returned false',
      details: { expression: cueExpression, result: result.value },
    };
    
  } catch (error) {
    return {
      name: `Property: ${name}`,
      type: 'property',
      passed: false,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Run golden file test
 */
async function runGoldenTest(
  input: string, 
  want: string, 
  apiUrl: string, 
  timeout: number,
  updateGolden: boolean = false
): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    // Read input file
    const inputContent = await fs.readFile(input, 'utf-8');
    
    // Analyze input to get output
    const response = await fetch(`${apiUrl}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        content: inputContent, 
        filename: input,
      }),
      signal: AbortSignal.timeout(timeout),
    });
    
    if (!response.ok) {
      return {
        name: `Golden: ${path.basename(input)}`,
        type: 'golden',
        passed: false,
        duration: Date.now() - startTime,
        error: `Analysis failed: HTTP ${response.status}`,
      };
    }
    
    const result = await response.json();
    const actualOutput = JSON.stringify(result, null, 2);
    
    if (updateGolden) {
      // Update golden file
      await fs.mkdir(path.dirname(want), { recursive: true });
      await fs.writeFile(want, actualOutput);
      
      return {
        name: `Golden: ${path.basename(input)} (updated)`,
        type: 'golden',
        passed: true,
        duration: Date.now() - startTime,
        details: { updated: true },
      };
    }
    
    // Compare with expected output
    let expectedOutput: string;
    try {
      expectedOutput = await fs.readFile(want, 'utf-8');
    } catch (error) {
      return {
        name: `Golden: ${path.basename(input)}`,
        type: 'golden',
        passed: false,
        duration: Date.now() - startTime,
        error: `Golden file not found: ${want}`,
      };
    }
    
    // Normalize whitespace for comparison
    const actualNormalized = actualOutput.trim().replace(/\s+/g, ' ');
    const expectedNormalized = expectedOutput.trim().replace(/\s+/g, ' ');
    
    const passed = actualNormalized === expectedNormalized;
    
    return {
      name: `Golden: ${path.basename(input)}`,
      type: 'golden',
      passed,
      duration: Date.now() - startTime,
      error: passed ? undefined : 'Output does not match golden file',
      details: { 
        expected: expectedOutput.slice(0, 200), 
        actual: actualOutput.slice(0, 200),
      },
    };
    
  } catch (error) {
    return {
      name: `Golden: ${path.basename(input)}`,
      type: 'golden',
      passed: false,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Run CLI test
 */
async function runCliTest(
  cmd: string, 
  expectExit: number, 
  expectRE?: string, 
  timeout: number = 30000
): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    const [command, ...args] = cmd.split(' ');
    
    return new Promise((resolve) => {
      const proc = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout,
      });
      
      let stdout = '';
      let stderr = '';
      
      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });
      
      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
      
      proc.on('close', (code) => {
        const duration = Date.now() - startTime;
        
        if (code !== expectExit) {
          resolve({
            name: `CLI: ${cmd}`,
            type: 'cli',
            passed: false,
            duration,
            error: `Expected exit code ${expectExit}, got ${code}. stderr: ${stderr}`,
            details: { stdout, stderr, exitCode: code },
          });
          return;
        }
        
        if (expectRE && !new RegExp(expectRE).test(stdout)) {
          resolve({
            name: `CLI: ${cmd}`,
            type: 'cli',
            passed: false,
            duration,
            error: `Output didn't match expected regex: ${expectRE}`,
            details: { stdout, stderr, expectRE },
          });
          return;
        }
        
        resolve({
          name: `CLI: ${cmd}`,
          type: 'cli',
          passed: true,
          duration,
          details: { stdout, stderr, exitCode: code },
        });
      });
      
      proc.on('error', (error) => {
        resolve({
          name: `CLI: ${cmd}`,
          type: 'cli',
          passed: false,
          duration: Date.now() - startTime,
          error: error.message,
        });
      });
    });
    
  } catch (error) {
    return {
      name: `CLI: ${cmd}`,
      type: 'cli',
      passed: false,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Load epic and extract test configuration
 */
async function loadEpicTests(epicPath: string): Promise<any> {
  try {
    const content = await fs.readFile(epicPath, 'utf-8');
    
    let epic: any;
    try {
      epic = JSON.parse(content);
    } catch {
      epic = yaml.load(content);
    }
    
    if (!epic.tests) {
      throw new Error('Epic has no test configuration');
    }
    
    return epic.tests;
  } catch (error) {
    throw new Error(`Failed to load epic tests: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generate JUnit XML report
 */
function generateJUnitXML(suites: TestSuite[]): string {
  const totalTests = suites.reduce((sum, suite) => sum + suite.summary.total, 0);
  const totalFailures = suites.reduce((sum, suite) => sum + suite.summary.failed, 0);
  const totalTime = suites.reduce((sum, suite) => sum + suite.summary.duration, 0) / 1000;
  
  const testsuites = suites.map(suite => {
    const testcases = suite.results.map(result => `
    <testcase 
      classname="${suite.name}" 
      name="${result.name}" 
      time="${result.duration / 1000}">
      ${result.passed ? '' : `<failure message="${result.error || 'Test failed'}">${result.error || 'Test failed'}</failure>`}
    </testcase>`).join('');
    
    return `
  <testsuite 
    name="${suite.name}" 
    tests="${suite.summary.total}" 
    failures="${suite.summary.failed}" 
    time="${suite.summary.duration / 1000}">
    ${testcases}
  </testsuite>`;
  }).join('');
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites tests="${totalTests}" failures="${totalFailures}" time="${totalTime}">
  ${testsuites}
</testsuites>`;
}

/**
 * Main test command
 */
export async function testCommand(options: TestOptions): Promise<number> {
  const startTime = Date.now();
  const apiUrl = 'http://localhost:8080'; // Should be configurable
  const timeout = options.timeout || 30000;
  const types = options.types || ['static', 'property', 'golden', 'cli'];
  
  console.log(chalk.blue('🧪 Running unified test harness'));
  
  let allResults: TestResult[] = [];
  let suites: TestSuite[] = [];
  
  try {
    if (options.epic) {
      // Load tests from epic
      console.log(chalk.cyan(`📋 Loading tests from epic: ${options.epic}`));
      const epicTests = await loadEpicTests(options.epic);
      
      // Run static tests
      if (types.includes('static') && epicTests.static) {
        console.log(chalk.blue('\n📊 Running static analysis tests...'));
        const results: TestResult[] = [];
        
        for (const test of epicTests.static) {
          console.log(chalk.dim(`  Analyzing: ${test.selector}`));
          const result = await runStaticTest(test.selector, apiUrl, timeout);
          results.push(result);
          
          if (result.passed) {
            console.log(chalk.green(`  ✓ ${result.name} (${result.duration}ms)`));
          } else {
            console.log(chalk.red(`  ✗ ${result.name} (${result.duration}ms)`));
            if (options.verbose && result.error) {
              console.log(chalk.red(`    ${result.error}`));
            }
          }
        }
        
        suites.push({
          name: 'Static Analysis',
          results,
          summary: {
            total: results.length,
            passed: results.filter(r => r.passed).length,
            failed: results.filter(r => !r.passed).length,
            duration: results.reduce((sum, r) => sum + r.duration, 0),
          },
        });
        
        allResults.push(...results);
      }
      
      // Run property tests
      if (types.includes('property') && epicTests.property) {
        console.log(chalk.blue('\n🔍 Running property tests...'));
        const results: TestResult[] = [];
        
        for (const test of epicTests.property) {
          console.log(chalk.dim(`  Testing: ${test.name}`));
          const result = await runPropertyTest(test.name, test.cue, apiUrl, timeout);
          results.push(result);
          
          if (result.passed) {
            console.log(chalk.green(`  ✓ ${result.name} (${result.duration}ms)`));
          } else {
            console.log(chalk.red(`  ✗ ${result.name} (${result.duration}ms)`));
            if (options.verbose && result.error) {
              console.log(chalk.red(`    ${result.error}`));
            }
          }
        }
        
        suites.push({
          name: 'Property Tests',
          results,
          summary: {
            total: results.length,
            passed: results.filter(r => r.passed).length,
            failed: results.filter(r => !r.passed).length,
            duration: results.reduce((sum, r) => sum + r.duration, 0),
          },
        });
        
        allResults.push(...results);
      }
      
      // Run golden tests
      if (types.includes('golden') && epicTests.golden) {
        console.log(chalk.blue('\n🏆 Running golden file tests...'));
        const results: TestResult[] = [];
        
        for (const test of epicTests.golden) {
          console.log(chalk.dim(`  Comparing: ${test.input} → ${test.want}`));
          const result = await runGoldenTest(test.input, test.want, apiUrl, timeout, options.updateGolden);
          results.push(result);
          
          if (result.passed) {
            console.log(chalk.green(`  ✓ ${result.name} (${result.duration}ms)`));
          } else {
            console.log(chalk.red(`  ✗ ${result.name} (${result.duration}ms)`));
            if (options.verbose && result.error) {
              console.log(chalk.red(`    ${result.error}`));
            }
          }
        }
        
        suites.push({
          name: 'Golden Tests',
          results,
          summary: {
            total: results.length,
            passed: results.filter(r => r.passed).length,
            failed: results.filter(r => !r.passed).length,
            duration: results.reduce((sum, r) => sum + r.duration, 0),
          },
        });
        
        allResults.push(...results);
      }
      
      // Run CLI tests
      if (types.includes('cli') && epicTests.cli) {
        console.log(chalk.blue('\n🖥️  Running CLI tests...'));
        const results: TestResult[] = [];
        
        for (const test of epicTests.cli) {
          console.log(chalk.dim(`  Executing: ${test.cmd}`));
          const result = await runCliTest(test.cmd, test.expectExit, test.expectRE, timeout);
          results.push(result);
          
          if (result.passed) {
            console.log(chalk.green(`  ✓ ${result.name} (${result.duration}ms)`));
          } else {
            console.log(chalk.red(`  ✗ ${result.name} (${result.duration}ms)`));
            if (options.verbose && result.error) {
              console.log(chalk.red(`    ${result.error}`));
            }
          }
        }
        
        suites.push({
          name: 'CLI Tests',
          results,
          summary: {
            total: results.length,
            passed: results.filter(r => r.passed).length,
            failed: results.filter(r => !r.passed).length,
            duration: results.reduce((sum, r) => sum + r.duration, 0),
          },
        });
        
        allResults.push(...results);
      }
      
    } else {
      console.log(chalk.yellow('No epic specified - skipping tests'));
      return 0;
    }
    
    // Print summary
    const totalDuration = Date.now() - startTime;
    const totalTests = allResults.length;
    const totalPassed = allResults.filter(r => r.passed).length;
    const totalFailed = totalTests - totalPassed;
    
    console.log(chalk.blue('\n📊 Test Summary:'));
    
    for (const suite of suites) {
      console.log(chalk.cyan(`  ${suite.name}:`));
      console.log(`    Tests: ${suite.summary.passed}/${suite.summary.total} passed`);
      console.log(`    Duration: ${suite.summary.duration}ms`);
    }
    
    console.log(chalk.blue('\n🏁 Overall:'));
    console.log(`  Total tests: ${totalTests}`);
    console.log(`  Passed: ${chalk.green(totalPassed)}`);
    console.log(`  Failed: ${totalFailed > 0 ? chalk.red(totalFailed) : totalFailed}`);
    console.log(`  Duration: ${totalDuration}ms`);
    console.log(`  Success rate: ${((totalPassed / totalTests) * 100).toFixed(1)}%`);
    
    // Write JUnit XML if requested
    if (options.junit) {
      const junitXml = generateJUnitXML(suites);
      await fs.writeFile(options.junit, junitXml);
      console.log(chalk.dim(`\nJUnit report written to: ${options.junit}`));
    }
    
    return totalFailed === 0 ? 0 : 1;
    
  } catch (error) {
    console.error(chalk.red('❌ Test execution failed:'), error instanceof Error ? error.message : String(error));
    return 2;
  }
}