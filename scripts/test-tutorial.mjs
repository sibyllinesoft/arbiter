#!/usr/bin/env bun
/**
 * Living tutorial verification script
 * Turns doc/tutorial/kubernetes/ into self-verifying tests
 */

import { spawn } from 'bun';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname, extname, basename } from 'path';

const ROOT_DIR = process.cwd();
const TUTORIAL_DIR = join(ROOT_DIR, 'doc', 'tutorial', 'kubernetes');
const GOLDEN_DIR = join(ROOT_DIR, 'doc', 'tutorial', '_golden');
const UPDATE_GOLDEN = process.env.UPDATE_GOLDEN === '1';

// Colors for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  step: (msg) => console.log(`${colors.cyan}🔄 ${msg}${colors.reset}`),
};

async function main() {
  log.info('Starting living tutorial verification...');
  
  // Ensure required directories exist
  ensureDirectoryExists(GOLDEN_DIR);
  
  if (!existsSync(TUTORIAL_DIR)) {
    log.error(`Tutorial directory not found: ${TUTORIAL_DIR}`);
    process.exit(1);
  }
  
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  
  try {
    // 1. Verify YAML to CUE import consistency
    log.step('Verifying YAML to CUE import consistency...');
    const importResults = await verifyYamlToCueImports();
    totalTests += importResults.total;
    passedTests += importResults.passed;
    failedTests += importResults.failed;
    
    // 2. Verify CUE evaluation golden outputs
    log.step('Verifying CUE evaluation golden outputs...');
    const evalResults = await verifyCueEvaluations();
    totalTests += evalResults.total;
    passedTests += evalResults.passed;
    failedTests += evalResults.failed;
    
    // 3. Verify tutorial consistency
    log.step('Verifying tutorial step consistency...');
    const consistencyResults = await verifyTutorialConsistency();
    totalTests += consistencyResults.total;
    passedTests += consistencyResults.passed;
    failedTests += consistencyResults.failed;
    
    // Summary
    log.info(`\n${colors.bright}Tutorial Verification Results:${colors.reset}`);
    log.info(`  Total tests: ${totalTests}`);
    log.success(`  Passed: ${passedTests}`);
    if (failedTests > 0) {
      log.error(`  Failed: ${failedTests}`);
    }
    
    if (failedTests > 0) {
      if (UPDATE_GOLDEN) {
        log.warning('Some tests failed, but UPDATE_GOLDEN=1 was set. Golden files have been updated.');
      } else {
        log.error('Tutorial verification failed. Run with UPDATE_GOLDEN=1 to update golden files.');
        process.exit(1);
      }
    } else {
      log.success('All tutorial verification tests passed!');
    }
    
  } catch (error) {
    log.error(`Tutorial verification failed with error: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

/**
 * Verify that YAML files can be imported to CUE and match the quick/ versions
 */
async function verifyYamlToCueImports() {
  const results = { total: 0, passed: 0, failed: 0 };
  
  const originalDir = join(TUTORIAL_DIR, 'original');
  const quickDir = join(TUTORIAL_DIR, 'quick');
  
  if (!existsSync(originalDir) || !existsSync(quickDir)) {
    log.warning('Original or quick directory not found, skipping YAML import verification');
    return results;
  }
  
  // Find all YAML files in original/services/
  const originalServicesDir = join(originalDir, 'services');
  if (!existsSync(originalServicesDir)) {
    log.warning('Original services directory not found');
    return results;
  }
  
  const yamlFiles = findFilesRecursively(originalServicesDir, ['.yaml', '.yml']);
  
  for (const yamlFile of yamlFiles) {
    results.total++;
    
    // Get relative path from originalServicesDir
    const relativePath = yamlFile.replace(originalServicesDir, '').replace(/\\/g, '/');
    const expectedCueFile = join(quickDir, 'services', relativePath.replace(/\.ya?ml$/, '.cue'));
    
    try {
      // Import YAML to CUE format
      const importedCue = await importYamlToCue(yamlFile);
      
      if (!existsSync(expectedCueFile)) {
        if (UPDATE_GOLDEN) {
          ensureDirectoryExists(dirname(expectedCueFile));
          writeFileSync(expectedCueFile, importedCue);
          log.info(`Created missing CUE file: ${expectedCueFile}`);
          results.passed++;
        } else {
          log.error(`Expected CUE file not found: ${expectedCueFile}`);
          results.failed++;
        }
        continue;
      }
      
      // Compare with existing CUE file
      const existingCue = readFileSync(expectedCueFile, 'utf8');
      const normalized1 = normalizeCueContent(importedCue);
      const normalized2 = normalizeCueContent(existingCue);
      
      if (normalized1 === normalized2) {
        log.success(`YAML import matches: ${relativePath}`);
        results.passed++;
      } else {
        log.error(`YAML import mismatch: ${relativePath}`);
        if (UPDATE_GOLDEN) {
          writeFileSync(expectedCueFile, importedCue);
          log.info(`Updated CUE file: ${expectedCueFile}`);
          results.passed++;
        } else {
          results.failed++;
          
          // Show diff
          console.log(`\n${colors.yellow}Expected (${expectedCueFile}):${colors.reset}`);
          console.log(normalized2.substring(0, 200) + '...');
          console.log(`\n${colors.yellow}Got (imported from ${yamlFile}):${colors.reset}`);
          console.log(normalized1.substring(0, 200) + '...');
          console.log();
        }
      }
      
    } catch (error) {
      log.error(`Failed to import ${yamlFile}: ${error.message}`);
      results.failed++;
    }
  }
  
  return results;
}

/**
 * Verify CUE evaluations against golden outputs
 */
async function verifyCueEvaluations() {
  const results = { total: 0, passed: 0, failed: 0 };
  
  const quickDir = join(TUTORIAL_DIR, 'quick');
  const manualDir = join(TUTORIAL_DIR, 'manual');
  
  const pathsToTest = [
    { path: join(quickDir, 'services'), name: 'quick-services' },
    { path: join(manualDir, 'services'), name: 'manual-services' },
  ];
  
  for (const { path: servicesPath, name } of pathsToTest) {
    if (!existsSync(servicesPath)) {
      log.warning(`Services directory not found: ${servicesPath}`);
      continue;
    }
    
    results.total++;
    
    try {
      // Evaluate CUE in the services directory
      const evaluation = await evaluateCueDirectory(servicesPath);
      const goldenFile = join(GOLDEN_DIR, `${name}.json`);
      
      // Normalize for consistent comparison
      const normalizedEval = normalizeEvaluation(evaluation);
      
      if (UPDATE_GOLDEN || !existsSync(goldenFile)) {
        writeFileSync(goldenFile, JSON.stringify(normalizedEval, null, 2));
        log.info(`${UPDATE_GOLDEN ? 'Updated' : 'Created'} golden file: ${goldenFile}`);
        results.passed++;
      } else {
        // Compare with golden file
        const goldenContent = JSON.parse(readFileSync(goldenFile, 'utf8'));
        
        if (deepEqual(normalizedEval, goldenContent)) {
          log.success(`CUE evaluation matches: ${name}`);
          results.passed++;
        } else {
          log.error(`CUE evaluation mismatch: ${name}`);
          results.failed++;
          
          // Show summary of differences
          const keys1 = Object.keys(normalizedEval);
          const keys2 = Object.keys(goldenContent);
          
          if (keys1.length !== keys2.length) {
            log.error(`  Key count differs: expected ${keys2.length}, got ${keys1.length}`);
          }
          
          const missingKeys = keys2.filter(k => !keys1.includes(k));
          const extraKeys = keys1.filter(k => !keys2.includes(k));
          
          if (missingKeys.length > 0) {
            log.error(`  Missing keys: ${missingKeys.join(', ')}`);
          }
          if (extraKeys.length > 0) {
            log.error(`  Extra keys: ${extraKeys.join(', ')}`);
          }
        }
      }
      
    } catch (error) {
      log.error(`Failed to evaluate CUE in ${servicesPath}: ${error.message}`);
      results.failed++;
    }
  }
  
  return results;
}

/**
 * Verify tutorial step consistency and completeness
 */
async function verifyTutorialConsistency() {
  const results = { total: 0, passed: 0, failed: 0 };
  
  // Check that all required tutorial files exist
  const requiredPaths = [
    'original/services',
    'quick/services', 
    'manual/services',
  ];
  
  for (const requiredPath of requiredPaths) {
    results.total++;
    const fullPath = join(TUTORIAL_DIR, requiredPath);
    
    if (existsSync(fullPath)) {
      log.success(`Required path exists: ${requiredPath}`);
      results.passed++;
    } else {
      log.error(`Required path missing: ${requiredPath}`);
      results.failed++;
    }
  }
  
  // Verify CUE module structure
  results.total++;
  const cueModFile = join(TUTORIAL_DIR, 'quick', 'cue.mod');
  if (existsSync(cueModFile)) {
    log.success('CUE module file exists in quick/');
    results.passed++;
  } else {
    log.error('CUE module file missing in quick/');
    results.failed++;
  }
  
  return results;
}

/**
 * Import YAML file to CUE format
 */
async function importYamlToCue(yamlFilePath) {
  const proc = spawn(['cue', 'import', 'yaml:', yamlFilePath, '--outfile', '-'], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  
  const result = await proc.exited;
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  
  if (result !== 0) {
    throw new Error(`CUE import failed: ${stderr}`);
  }
  
  return stdout;
}

/**
 * Evaluate CUE directory and return JSON output
 */
async function evaluateCueDirectory(dirPath) {
  const proc = spawn(['cue', 'eval', '--out', 'json', './...'], {
    cwd: dirPath,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  
  const result = await proc.exited;
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  
  if (result !== 0) {
    throw new Error(`CUE evaluation failed in ${dirPath}: ${stderr}`);
  }
  
  if (!stdout.trim()) {
    return {};
  }
  
  try {
    return JSON.parse(stdout);
  } catch (parseError) {
    throw new Error(`Failed to parse CUE output as JSON: ${parseError.message}`);
  }
}

/**
 * Normalize CUE content for comparison (remove comments, normalize whitespace)
 */
function normalizeCueContent(content) {
  return content
    .replace(/\/\/.*$/gm, '') // Remove line comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Normalize evaluation result for consistent comparison
 */
function normalizeEvaluation(evaluation) {
  if (typeof evaluation !== 'object' || evaluation === null) {
    return evaluation;
  }
  
  if (Array.isArray(evaluation)) {
    return evaluation.map(normalizeEvaluation).sort();
  }
  
  const normalized = {};
  const sortedKeys = Object.keys(evaluation).sort();
  
  for (const key of sortedKeys) {
    normalized[key] = normalizeEvaluation(evaluation[key]);
  }
  
  return normalized;
}

/**
 * Find files recursively with given extensions
 */
function findFilesRecursively(dir, extensions) {
  const files = [];
  
  function walk(currentDir) {
    const items = readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = join(currentDir, item);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (extensions.some(ext => fullPath.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  }
  
  walk(dir);
  return files;
}

/**
 * Ensure directory exists, create if it doesn't
 */
function ensureDirectoryExists(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Deep equality check for objects
 */
function deepEqual(obj1, obj2) {
  if (obj1 === obj2) {
    return true;
  }
  
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object' || obj1 === null || obj2 === null) {
    return false;
  }
  
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  if (keys1.length !== keys2.length) {
    return false;
  }
  
  for (const key of keys1) {
    if (!keys2.includes(key) || !deepEqual(obj1[key], obj2[key])) {
      return false;
    }
  }
  
  return true;
}

// Run the script
if (import.meta.main) {
  main().catch((error) => {
    console.error('Tutorial verification script failed:', error);
    process.exit(1);
  });
}