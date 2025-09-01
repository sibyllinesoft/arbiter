import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import crypto from 'crypto';
import type { SyncOptions, CLIConfig } from '../types.js';

interface ManifestFile {
  path: string;
  type: 'package.json' | 'pyproject.toml' | 'Cargo.toml' | 'Makefile';
  exists: boolean;
  language: string;
}

interface ConflictResolution {
  path: string;
  type: 'value_conflict' | 'section_exists' | 'section_replaced' | 'merge_required' | 'error';
  resolution: 'merged' | 'preserved_existing' | 'replaced_with_template' | 'replaced_with_source' | 'failed';
  applied?: boolean;
  details: string;
}

interface SyncResult {
  modified: boolean;
  conflicts: ConflictResolution[];
  checksum: string;
  backupPath?: string;
}

interface ChangeSet {
  added: Record<string, any>;
  modified: Record<string, { from: any; to: any }>;
  removed: Record<string, any>;
}

/**
 * Detect manifest files in the project
 */
async function detectManifestFiles(projectPath: string): Promise<ManifestFile[]> {
  const manifests: ManifestFile[] = [
    { path: 'package.json', type: 'package.json', exists: false, language: 'typescript' },
    { path: 'pyproject.toml', type: 'pyproject.toml', exists: false, language: 'python' },
    { path: 'Cargo.toml', type: 'Cargo.toml', exists: false, language: 'rust' },
    { path: 'Makefile', type: 'Makefile', exists: false, language: 'bash' }
  ];

  for (const manifest of manifests) {
    const fullPath = path.join(projectPath, manifest.path);
    try {
      await fs.access(fullPath);
      manifest.exists = true;
    } catch {
      manifest.exists = false;
    }
  }

  return manifests.filter(m => m.exists);
}

/**
 * Calculate file checksum for idempotency validation
 */
function calculateChecksum(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
}

/**
 * Create backup of a file with timestamp
 */
async function createBackup(filePath: string): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${filePath}.backup.${timestamp}`;
  await fs.copyFile(filePath, backupPath);
  return backupPath;
}

/**
 * Deep merge objects, handling conflicts intelligently
 */
function deepMerge(target: any, source: any, conflicts: ConflictResolution[], path: string = '', force: boolean = false): any {
  const result = { ...target };
  
  for (const key in source) {
    const currentPath = path ? `${path}.${key}` : key;
    
    if (!(key in result)) {
      // New property - safe to add
      result[key] = source[key];
    } else if (typeof source[key] === 'object' && typeof result[key] === 'object' && !Array.isArray(source[key])) {
      // Both objects - recursive merge
      result[key] = deepMerge(result[key], source[key], conflicts, currentPath, force);
    } else if (JSON.stringify(result[key]) !== JSON.stringify(source[key])) {
      // Conflict detected
      if (force) {
        conflicts.push({
          path: currentPath,
          type: 'value_conflict',
          resolution: 'replaced_with_source',
          applied: true,
          details: `Overwrote ${currentPath}: ${JSON.stringify(result[key])} → ${JSON.stringify(source[key])}`
        });
        result[key] = source[key];
      } else {
        conflicts.push({
          path: currentPath,
          type: 'value_conflict',
          resolution: 'preserved_existing',
          applied: false,
          details: `Preserved existing ${currentPath}: ${JSON.stringify(result[key])} (would be ${JSON.stringify(source[key])})`
        });
      }
    }
  }
  
  return result;
}

/**
 * Generate change set showing what would be modified
 */
function generateChangeSet(original: any, modified: any): ChangeSet {
  const changeSet: ChangeSet = {
    added: {},
    modified: {},
    removed: {}
  };
  
  // Find added and modified keys
  for (const key in modified) {
    if (!(key in original)) {
      changeSet.added[key] = modified[key];
    } else if (JSON.stringify(original[key]) !== JSON.stringify(modified[key])) {
      changeSet.modified[key] = {
        from: original[key],
        to: modified[key]
      };
    }
  }
  
  // Find removed keys
  for (const key in original) {
    if (!(key in modified)) {
      changeSet.removed[key] = original[key];
    }
  }
  
  return changeSet;
}

/**
 * Validate that sync operation is idempotent
 */
async function validateIdempotency(filePath: string, expectedChecksum: string): Promise<boolean> {
  try {
    const currentContent = await fs.readFile(filePath, 'utf8');
    const currentChecksum = calculateChecksum(currentContent);
    return currentChecksum === expectedChecksum;
  } catch {
    return false;
  }
}

/**
 * Enhanced sync package.json with intelligent conflict resolution
 */
async function syncPackageJson(filePath: string, dryRun: boolean, backup: boolean, force: boolean): Promise<SyncResult> {
  try {
    const originalContent = await fs.readFile(filePath, 'utf8');
    const originalPkg = JSON.parse(originalContent);
    const originalChecksum = calculateChecksum(originalContent);
    
    // Create working copy
    const pkg = JSON.parse(originalContent);
    const conflicts: ConflictResolution[] = [];

    // Define Arbiter configurations to merge
    const arbiterUpdates = {
      scripts: {
        'arbiter:check': 'arbiter check',
        'arbiter:watch': 'arbiter watch',
        'arbiter:surface': 'arbiter surface typescript --output surface.json',
        'arbiter:test:scaffold': 'arbiter tests scaffold --language typescript',
        'arbiter:test:cover': 'arbiter tests cover --threshold 0.8',
        'arbiter:version:plan': 'arbiter version plan --strict',
        'arbiter:sync': 'arbiter sync --language typescript'
      },
      devDependencies: {
        '@arbiter/cli': '^0.1.0'
      },
      arbiter: {
        profiles: ['library'],
        coverage: {
          threshold: 0.8
        },
        surface: {
          language: 'typescript',
          output: 'surface.json'
        }
      }
    };

    // Initialize sections if not present
    if (!pkg.scripts) pkg.scripts = {};
    if (!pkg.devDependencies) pkg.devDependencies = {};

    // Use intelligent merge for each section
    pkg.scripts = deepMerge(pkg.scripts, arbiterUpdates.scripts, conflicts, 'scripts', force);
    pkg.devDependencies = deepMerge(pkg.devDependencies, arbiterUpdates.devDependencies, conflicts, 'devDependencies', force);
    pkg.arbiter = deepMerge(pkg.arbiter || {}, arbiterUpdates.arbiter, conflicts, 'arbiter', force);

    // Check if anything actually changed
    const newContent = JSON.stringify(pkg, null, 2) + '\n';
    const newChecksum = calculateChecksum(newContent);
    const modified = originalChecksum !== newChecksum;

    // Generate change set for reporting
    const changeSet = generateChangeSet(originalPkg, pkg);

    // Report changes in dry-run mode
    if (modified) {
      if (Object.keys(changeSet.added).length > 0) {
        console.log(chalk.green('  ✨ Would add:'));
        for (const [key, value] of Object.entries(changeSet.added)) {
          console.log(chalk.dim(`    ${key}: ${JSON.stringify(value, null, 2).split('\n')[0]}...`));
        }
      }
      
      if (Object.keys(changeSet.modified).length > 0) {
        console.log(chalk.yellow('  🔄 Would modify:'));
        for (const [key, change] of Object.entries(changeSet.modified)) {
          console.log(chalk.dim(`    ${key}: ${JSON.stringify(change.from)} → ${JSON.stringify(change.to)}`));
        }
      }
    }

    // Report conflicts
    if (conflicts.length > 0) {
      console.log(chalk.yellow(`  ⚠️  ${conflicts.length} conflict(s) detected:`));
      for (const conflict of conflicts) {
        const status = conflict.applied ? chalk.green('RESOLVED') : chalk.red('PRESERVED');
        console.log(chalk.dim(`    ${status}: ${conflict.details}`));
      }
    }

    // Apply changes if not dry run
    let backupPath: string | undefined;
    if (modified && !dryRun) {
      if (backup) {
        backupPath = await createBackup(filePath);
        console.log(chalk.dim(`  📦 Created backup: ${path.basename(backupPath)}`));
      }

      await fs.writeFile(filePath, newContent);
      
      // Validate idempotency
      const isIdempotent = await validateIdempotency(filePath, newChecksum);
      if (!isIdempotent) {
        console.log(chalk.yellow('  ⚠️  Warning: File was modified by external process during sync'));
      }
    }

    return {
      modified,
      conflicts,
      checksum: newChecksum,
      backupPath
    };
    
  } catch (error) {
    console.error(chalk.red(`  ❌ Failed to sync ${filePath}:`), error instanceof Error ? error.message : String(error));
    return {
      modified: false,
      conflicts: [],
      checksum: '',
      backupPath: undefined
    };
  }
}

/**
 * Sync pyproject.toml with Arbiter configuration
 */
async function syncPyprojectToml(filePath: string, dryRun: boolean, backup: boolean, force: boolean): Promise<SyncResult> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    let modified = false;

    // Check if tool.arbiter section exists
    const arbiterSectionRegex = /\[tool\.arbiter\]/;
    const hasArbiterSection = arbiterSectionRegex.test(content);

    const conflicts: ConflictResolution[] = [];
    let backupPath: string | undefined;

    if (hasArbiterSection && !force) {
      conflicts.push({
        path: '[tool.arbiter]',
        type: 'section_exists',
        resolution: 'preserved_existing',
        details: 'Use --force to overwrite existing Arbiter section'
      });
      console.log(chalk.yellow('⚠️  pyproject.toml already has [tool.arbiter] section. Use --force to overwrite.'));
      return {
        modified: false,
        conflicts,
        checksum: calculateChecksum(content)
      };
    }

    const arbiterConfig = `
[tool.arbiter]
profiles = ["library"]
surface_language = "python"
surface_output = "surface.json"

[tool.arbiter.coverage]
threshold = 0.8

[tool.arbiter.scripts]
check = "arbiter check"
watch = "arbiter watch"
surface = "arbiter surface python --output surface.json"
test_scaffold = "arbiter tests scaffold --language python"
test_cover = "arbiter tests cover --threshold 0.8"
version_plan = "arbiter version plan --strict"
sync = "arbiter sync --language python"
`;

    let newContent = content;

    if (!hasArbiterSection) {
      // Add to end of file
      newContent = content.trim() + '\n' + arbiterConfig;
      modified = true;
    } else if (force) {
      // Replace existing section
      const sectionEnd = content.indexOf('[', content.indexOf('[tool.arbiter]') + 1);
      if (sectionEnd === -1) {
        // Section is at the end of the file
        newContent = content.substring(0, content.indexOf('[tool.arbiter]')) + arbiterConfig.trim();
      } else {
        // Section is in the middle
        newContent = content.substring(0, content.indexOf('[tool.arbiter]')) + 
                    arbiterConfig.trim() + '\n\n' + 
                    content.substring(sectionEnd);
      }
      modified = true;
    }

    if (modified && !dryRun) {
      if (backup) {
        backupPath = await createBackup(filePath);
        console.log(chalk.dim(`📦 Created backup: ${backupPath}`));
      }

      await fs.writeFile(filePath, newContent);
    }

    if (modified && force && hasArbiterSection) {
      conflicts.push({
        path: '[tool.arbiter]',
        type: 'section_replaced',
        resolution: 'replaced_with_template',
        details: 'Existing section replaced due to --force flag'
      });
    }

    const newChecksum = calculateChecksum(modified ? newContent : content);
    return {
      modified,
      conflicts,
      checksum: newChecksum,
      backupPath
    };
  } catch (error) {
    console.error(chalk.red(`❌ Failed to sync ${filePath}:`), error instanceof Error ? error.message : String(error));
    return {
      modified: false,
      conflicts: [{
        path: filePath,
        type: 'error',
        resolution: 'failed',
        details: error instanceof Error ? error.message : String(error)
      }],
      checksum: ''
    };
  }
}

/**
 * Sync Cargo.toml with Arbiter metadata
 */
async function syncCargoToml(filePath: string, dryRun: boolean, backup: boolean, force: boolean): Promise<SyncResult> {
  try {
    const originalContent = await fs.readFile(filePath, 'utf8');
    let newContent = originalContent;
    let modified = false;
    const conflicts: ConflictResolution[] = [];
    let backupPath: string | undefined;

    // Check if [package.metadata.arbiter] section exists
    const arbiterSectionRegex = /\[package\.metadata\.arbiter\]/;
    const hasArbiterSection = arbiterSectionRegex.test(originalContent);

    const arbiterConfig = `
[package.metadata.arbiter]
profiles = ["library"]
surface_language = "rust"
surface_output = "surface.json"
coverage_threshold = 0.8

[package.metadata.arbiter.scripts]
check = "arbiter check"
watch = "arbiter watch"
surface = "arbiter surface rust --output surface.json"
test_scaffold = "arbiter tests scaffold --language rust"
test_cover = "arbiter tests cover --threshold 0.8"
version_plan = "arbiter version plan --strict"
sync = "arbiter sync --language rust"
`;

    if (!hasArbiterSection) {
      // Add after [package] section
      const packageSectionEnd = originalContent.indexOf('\n[', originalContent.indexOf('[package]') + 1);
      if (packageSectionEnd === -1) {
        // No other sections after [package]
        newContent = originalContent.trim() + '\n' + arbiterConfig;
      } else {
        // Insert before next section
        newContent = originalContent.substring(0, packageSectionEnd) + 
                    '\n' + arbiterConfig.trim() + 
                    originalContent.substring(packageSectionEnd);
      }
      modified = true;
    } else if (!force) {
      conflicts.push({
        path: '[package.metadata.arbiter]',
        type: 'section_exists',
        resolution: 'preserved_existing',
        details: 'Use --force to overwrite existing Arbiter section'
      });
      console.log(chalk.yellow('⚠️  Cargo.toml already has [package.metadata.arbiter] section. Use --force to overwrite.'));
    } else {
      // Replace existing section with force
      const sectionStart = originalContent.indexOf('[package.metadata.arbiter]');
      const nextSection = originalContent.indexOf('\n[', sectionStart + 1);
      
      if (nextSection === -1) {
        newContent = originalContent.substring(0, sectionStart) + arbiterConfig.trim();
      } else {
        newContent = originalContent.substring(0, sectionStart) + 
                    arbiterConfig.trim() + '\n' +
                    originalContent.substring(nextSection);
      }
      modified = true;
      conflicts.push({
        path: '[package.metadata.arbiter]',
        type: 'section_replaced',
        resolution: 'replaced_with_template',
        details: 'Existing section replaced due to --force flag'
      });
    }

    if (modified && !dryRun) {
      if (backup) {
        backupPath = await createBackup(filePath);
        console.log(chalk.dim(`📦 Created backup: ${backupPath}`));
      }

      await fs.writeFile(filePath, newContent);
    }

    return {
      modified,
      conflicts,
      checksum: calculateChecksum(newContent),
      backupPath
    };
  } catch (error) {
    console.error(chalk.red(`❌ Failed to sync ${filePath}:`), error instanceof Error ? error.message : String(error));
    return {
      modified: false,
      conflicts: [{
        path: filePath,
        type: 'error',
        resolution: 'failed',
        details: error instanceof Error ? error.message : String(error)
      }],
      checksum: ''
    };
  }
}

/**
 * Sync Makefile with Arbiter targets
 */
async function syncMakefile(filePath: string, dryRun: boolean, backup: boolean, force: boolean): Promise<SyncResult> {
  try {
    const originalContent = await fs.readFile(filePath, 'utf8');
    let newContent = originalContent;
    let modified = false;
    const conflicts: ConflictResolution[] = [];
    let backupPath: string | undefined;

    // Check if Arbiter targets exist
    const hasArbiterTargets = originalContent.includes('# Arbiter targets');

    const arbiterTargets = `
# Arbiter targets
.PHONY: arbiter-check arbiter-watch arbiter-surface arbiter-test-scaffold arbiter-test-cover arbiter-version-plan arbiter-sync

arbiter-check:
	arbiter check

arbiter-watch:
	arbiter watch

arbiter-surface:
	arbiter surface bash --output surface.json

arbiter-test-scaffold:
	arbiter tests scaffold --language bash

arbiter-test-cover:
	arbiter tests cover --threshold 0.8

arbiter-version-plan:
	arbiter version plan --strict

arbiter-sync:
	arbiter sync --language bash
`;

    if (!hasArbiterTargets) {
      // Add to end of file
      newContent = originalContent.trim() + '\n' + arbiterTargets;
      modified = true;
    } else if (!force) {
      conflicts.push({
        path: '# Arbiter targets',
        type: 'section_exists',
        resolution: 'preserved_existing',
        details: 'Use --force to overwrite existing Arbiter targets'
      });
      console.log(chalk.yellow('⚠️  Makefile already has Arbiter targets. Use --force to overwrite.'));
    } else {
      // Replace existing Arbiter section with force
      const sectionStart = originalContent.indexOf('# Arbiter targets');
      const nextSection = originalContent.indexOf('\n# ', sectionStart + 1);
      
      if (nextSection === -1) {
        // Section is at the end
        newContent = originalContent.substring(0, sectionStart) + arbiterTargets.trim();
      } else {
        // Section is in the middle
        newContent = originalContent.substring(0, sectionStart) + 
                    arbiterTargets.trim() + '\n\n' +
                    originalContent.substring(nextSection);
      }
      modified = true;
      conflicts.push({
        path: '# Arbiter targets',
        type: 'section_replaced',
        resolution: 'replaced_with_template',
        details: 'Existing targets replaced due to --force flag'
      });
    }

    if (modified && !dryRun) {
      if (backup) {
        backupPath = await createBackup(filePath);
        console.log(chalk.dim(`📦 Created backup: ${backupPath}`));
      }

      await fs.writeFile(filePath, newContent);
    }

    return {
      modified,
      conflicts,
      checksum: calculateChecksum(newContent),
      backupPath
    };
  } catch (error) {
    console.error(chalk.red(`❌ Failed to sync ${filePath}:`), error instanceof Error ? error.message : String(error));
    return {
      modified: false,
      conflicts: [{
        path: filePath,
        type: 'error',
        resolution: 'failed',
        details: error instanceof Error ? error.message : String(error)
      }],
      checksum: ''
    };
  }
}

/**
 * Sync command implementation
 */
export async function syncCommand(options: SyncOptions, config: CLIConfig): Promise<number> {
  try {
    const projectPath = process.cwd();
    console.log(chalk.blue('🔄 Arbiter manifest synchronization'));
    console.log(chalk.dim(`Project: ${projectPath}`));

    // Detect manifest files
    console.log(chalk.blue('🔍 Detecting manifest files...'));
    const manifests = await detectManifestFiles(projectPath);

    if (manifests.length === 0) {
      console.log(chalk.yellow('⚠️  No supported manifest files found'));
      console.log(chalk.dim('Supported: package.json, pyproject.toml, Cargo.toml, Makefile'));
      return 1;
    }

    console.log(chalk.green(`✅ Found ${manifests.length} manifest file(s):`));
    for (const manifest of manifests) {
      console.log(chalk.dim(`  • ${manifest.path} (${manifest.language})`));
    }

    // Filter by language if specified
    let targetManifests = manifests;
    if (options.language && options.language !== 'all') {
      targetManifests = manifests.filter(m => m.language === options.language);
      if (targetManifests.length === 0) {
        console.log(chalk.yellow(`⚠️  No ${options.language} manifest files found`));
        return 1;
      }
    }

    const dryRun = options.dryRun || false;
    const backup = options.backup || false;
    const force = options.force || false;

    if (dryRun) {
      console.log(chalk.yellow('📋 Dry run mode - no files will be modified'));
    }

    console.log(chalk.blue('\n🔄 Synchronizing manifests...'));
    let totalModified = 0;

    // Process each manifest file
    const syncResults: SyncResult[] = [];
    
    for (const manifest of targetManifests) {
      const filePath = path.join(projectPath, manifest.path);
      console.log(chalk.cyan(`\n📝 Processing ${manifest.path}...`));

      let result: SyncResult;

      switch (manifest.type) {
        case 'package.json':
          result = await syncPackageJson(filePath, dryRun, backup, force);
          break;
        case 'pyproject.toml':
          result = await syncPyprojectToml(filePath, dryRun, backup, force);
          break;
        case 'Cargo.toml':
          result = await syncCargoToml(filePath, dryRun, backup, force);
          break;
        case 'Makefile':
          result = await syncMakefile(filePath, dryRun, backup, force);
          break;
        default:
          result = { modified: false, conflicts: [], checksum: '' };
      }

      syncResults.push(result);

      if (result.modified) {
        totalModified++;
        const status = dryRun ? 'Would modify' : 'Modified';
        const conflictCount = result.conflicts.filter(c => c.applied).length;
        if (conflictCount > 0) {
          console.log(chalk.green(`✅ ${status} ${manifest.path} (${conflictCount} conflict(s) resolved)`));
        } else {
          console.log(chalk.green(`✅ ${status} ${manifest.path}`));
        }
      } else {
        console.log(chalk.dim(`⏭️  No changes needed for ${manifest.path}`));
      }
    }

    console.log(chalk.green(`\n🎉 Synchronization complete!`));
    console.log(chalk.cyan(`📊 Summary: ${totalModified}/${targetManifests.length} files ${dryRun ? 'would be' : 'were'} modified`));

    if (totalModified > 0 && !dryRun) {
      console.log(chalk.cyan('\nNext steps:'));
      
      if (targetManifests.some(m => m.type === 'package.json')) {
        console.log(chalk.dim('  • Run "npm install" to install new dev dependencies'));
        console.log(chalk.dim('  • Use "npm run arbiter:check" to validate CUE files'));
      }
      
      if (targetManifests.some(m => m.type === 'pyproject.toml')) {
        console.log(chalk.dim('  • Run "pip install -e ." to install in development mode'));
      }
      
      if (targetManifests.some(m => m.type === 'Cargo.toml')) {
        console.log(chalk.dim('  • Run "cargo build" to update dependencies'));
      }
      
      if (targetManifests.some(m => m.type === 'Makefile')) {
        console.log(chalk.dim('  • Use "make arbiter-check" to validate CUE files'));
      }
    }

    if (dryRun && totalModified > 0) {
      console.log(chalk.yellow('\n💡 Run without --dry-run to apply these changes'));
    }

    return 0;
  } catch (error) {
    console.error(chalk.red('❌ Synchronization failed:'), error instanceof Error ? error.message : String(error));
    return 1;
  }
}