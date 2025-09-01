/**
 * Scan Command - Discover or synthesize assembly files
 * 
 * Implements the scan function from the Agent Operating Prompt:
 * - Read arbiter.assembly.cue if present; else synthesize from repo layout
 * - Detect legacy and prepare migration patch
 * - Emit scan.json and assembly draft
 */

import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import {
  detectEnvelope,
  loadAndMigrateResource,
  type EnvelopedResource,
  type AssemblyV1,
  type MigrationPatch,
  CURRENT_API_VERSION,
} from '../versioning.js';

export interface ScanOptions {
  repoPath: string;
  outputDir?: string;
  verbose?: boolean;
}

export interface ScanResult {
  assemblyFound: boolean;
  assemblyPath?: string;
  legacy: boolean;
  migrationRequired: boolean;
  migrationPatch?: MigrationPatch;
  artifacts: {
    kind: 'library' | 'cli' | 'service' | 'job' | 'unknown';
    language: 'go' | 'ts' | 'rust' | 'python' | 'unknown';
    confidence: 'high' | 'medium' | 'low';
    evidence: string[];
  };
  discoveries: {
    cuePackages: string[];
    yamlTrees: string[];
    buildFiles: Array<{
      type: 'package.json' | 'go.mod' | 'Cargo.toml' | 'pyproject.toml' | 'requirements.txt' | 'cue.mod';
      path: string;
    }>;
    suggestedProjects: Array<{
      name: string;
      path: string;
      type: 'cue' | 'yaml' | 'mixed';
      entrypoint?: string;
      artifact?: {
        kind: 'library' | 'cli' | 'service' | 'job' | 'unknown';
        language: 'go' | 'ts' | 'rust' | 'python' | 'unknown';
      };
    }>;
  };
  assemblyDraft: EnvelopedResource<AssemblyV1>;
}

/**
 * Main scan function following the pseudocode from the operating prompt
 */
export async function scanCommand(options: ScanOptions): Promise<ScanResult> {
  const { repoPath, outputDir = repoPath, verbose = false } = options;
  
  if (verbose) {
    console.log(`🔍 Scanning repository: ${repoPath}`);
  }
  
  let assemblyFound = false;
  let assemblyPath: string | undefined;
  let resource: EnvelopedResource<AssemblyV1> | undefined;
  let migrated = false;
  let migrationPatch: MigrationPatch | undefined;
  
  // Step 1: Try to read existing arbiter.assembly.cue
  const possiblePaths = [
    path.join(repoPath, 'arbiter.assembly.cue'),
    path.join(repoPath, 'arbiter.assembly.json'),
    path.join(repoPath, 'arbiter.assembly.yaml'),
    path.join(repoPath, 'arbiter.assembly.yml'),
  ];
  
  for (const filePath of possiblePaths) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      
      if (verbose) {
        console.log(`📄 Found assembly file: ${path.relative(repoPath, filePath)}`);
      }
      
      const result = loadAndMigrateResource<AssemblyV1>(content, 'Assembly');
      resource = result.resource;
      migrated = result.migrated;
      migrationPatch = result.migrationPatch;
      
      assemblyFound = true;
      assemblyPath = filePath;
      break;
    } catch (error) {
      // File doesn't exist or can't be read, continue
      continue;
    }
  }
  
  // Step 2: Discover repository structure
  const discoveries = await discoverRepositoryStructure(repoPath, verbose);
  
  // Step 2.5: Detect artifact kind and language
  const artifacts = await detectArtifacts(repoPath, discoveries, verbose);
  
  // Step 3: If no assembly found, synthesize one from discoveries
  if (!resource) {
    if (verbose) {
      console.log('📋 No assembly found, synthesizing from repository structure');
    }
    
    resource = synthesizeAssemblyFromDiscoveries(discoveries, artifacts);
    assemblyPath = path.join(repoPath, 'arbiter.assembly.json');
  }
  
  // Step 4: Prepare result
  const result: ScanResult = {
    assemblyFound,
    assemblyPath,
    legacy: migrated,
    migrationRequired: migrated,
    migrationPatch,
    artifacts,
    discoveries,
    assemblyDraft: resource,
  };
  
  // Step 5: Emit outputs
  await emitScanResults(result, outputDir, verbose);
  
  return result;
}

/**
 * Discover CUE packages, YAML trees, and suggest projects
 */
async function discoverRepositoryStructure(repoPath: string, verbose: boolean) {
  const discoveries = {
    cuePackages: [] as string[],
    yamlTrees: [] as string[],
    buildFiles: [] as Array<{
      type: 'package.json' | 'go.mod' | 'Cargo.toml' | 'pyproject.toml' | 'requirements.txt' | 'cue.mod';
      path: string;
    }>,
    suggestedProjects: [] as Array<{
      name: string;
      path: string;
      type: 'cue' | 'yaml' | 'mixed';
      entrypoint?: string;
      artifact?: {
        kind: 'library' | 'cli' | 'service' | 'job' | 'unknown';
        language: 'go' | 'ts' | 'rust' | 'python' | 'unknown';
      };
    }>,
  };
  
  // Find CUE packages (directories with cue.mod or .cue files)
  const cueFiles = await glob('**/*.cue', { 
    cwd: repoPath, 
    ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'] 
  });
  
  const cueDirs = new Set<string>();
  for (const cueFile of cueFiles) {
    const dir = path.dirname(cueFile);
    cueDirs.add(dir);
  }
  
  // Check for cue.mod files to identify package roots
  const cueModFiles = await glob('**/cue.mod', { 
    cwd: repoPath,
    ignore: ['**/node_modules/**', '**/.git/**'] 
  });
  
  for (const cueModFile of cueModFiles) {
    const packageDir = path.dirname(cueModFile);
    discoveries.cuePackages.push(packageDir);
    discoveries.buildFiles.push({
      type: 'cue.mod',
      path: cueModFile,
    });
    
    // Suggest as project
    const projectName = packageDir === '.' ? path.basename(repoPath) : packageDir.replace(/[\/\\]/g, '-');
    discoveries.suggestedProjects.push({
      name: projectName,
      path: packageDir,
      type: 'cue',
      entrypoint: findCueEntrypoint(path.join(repoPath, packageDir), cueFiles.filter(f => f.startsWith(packageDir))),
    });
  }
  
  // Detect build files (package managers and build tools)
  const buildFilePatterns = [
    { pattern: '**/package.json', type: 'package.json' as const },
    { pattern: '**/go.mod', type: 'go.mod' as const },
    { pattern: '**/Cargo.toml', type: 'Cargo.toml' as const },
    { pattern: '**/pyproject.toml', type: 'pyproject.toml' as const },
    { pattern: '**/requirements.txt', type: 'requirements.txt' as const },
  ];
  
  for (const { pattern, type } of buildFilePatterns) {
    const files = await glob(pattern, {
      cwd: repoPath,
      ignore: ['**/node_modules/**', '**/.git/**', '**/vendor/**', '**/target/**'],
    });
    
    for (const file of files) {
      discoveries.buildFiles.push({ type, path: file });
    }
  }
  
  // For directories with .cue files but no cue.mod, suggest as projects too
  for (const dir of cueDirs) {
    if (!discoveries.cuePackages.some(pkg => dir.startsWith(pkg))) {
      const projectName = dir === '.' ? path.basename(repoPath) : dir.replace(/[\/\\]/g, '-');
      discoveries.suggestedProjects.push({
        name: projectName,
        path: dir,
        type: 'cue',
        entrypoint: findCueEntrypoint(path.join(repoPath, dir), cueFiles.filter(f => f.startsWith(dir))),
      });
    }
  }
  
  // Find YAML/Kubernetes trees
  const yamlFiles = await glob('**/*.{yaml,yml}', { 
    cwd: repoPath,
    ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/.*/**'] 
  });
  
  const yamlDirs = new Set<string>();
  for (const yamlFile of yamlFiles) {
    const dir = path.dirname(yamlFile);
    yamlDirs.add(dir);
  }
  
  // Group YAML files by directory and suggest as projects
  for (const dir of yamlDirs) {
    const yamlInDir = yamlFiles.filter(f => path.dirname(f) === dir);
    
    // If directory has both CUE and YAML files, mark as mixed
    const hasCue = cueFiles.some(f => path.dirname(f) === dir);
    const type = hasCue ? 'mixed' : 'yaml';
    
    // Skip if already suggested as CUE project
    if (!discoveries.suggestedProjects.some(p => p.path === dir)) {
      const projectName = dir === '.' ? `${path.basename(repoPath)}-yaml` : `${dir.replace(/[\/\\]/g, '-')}-yaml`;
      discoveries.suggestedProjects.push({
        name: projectName,
        path: dir,
        type,
      });
    }
    
    discoveries.yamlTrees.push(dir);
  }
  
  if (verbose) {
    console.log(`📦 Found ${discoveries.cuePackages.length} CUE packages`);
    console.log(`📄 Found ${discoveries.yamlTrees.length} YAML trees`);
    console.log(`🔧 Found ${discoveries.buildFiles.length} build files`);
    console.log(`💡 Suggested ${discoveries.suggestedProjects.length} projects`);
  }
  
  return discoveries;
}

/**
 * Detect artifact kind and language from repository structure
 */
async function detectArtifacts(
  repoPath: string, 
  discoveries: ScanResult['discoveries'], 
  verbose: boolean
): Promise<ScanResult['artifacts']> {
  const evidence: string[] = [];
  let kind: ScanResult['artifacts']['kind'] = 'unknown';
  let language: ScanResult['artifacts']['language'] = 'unknown';
  let confidence: ScanResult['artifacts']['confidence'] = 'low';

  // Language detection based on build files
  const buildFileCounts = discoveries.buildFiles.reduce((acc, file) => {
    acc[file.type] = (acc[file.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (buildFileCounts['package.json'] > 0) {
    language = 'ts';
    evidence.push(`Found ${buildFileCounts['package.json']} package.json files`);
    confidence = 'high';
  } else if (buildFileCounts['go.mod'] > 0) {
    language = 'go';
    evidence.push(`Found ${buildFileCounts['go.mod']} go.mod files`);
    confidence = 'high';
  } else if (buildFileCounts['Cargo.toml'] > 0) {
    language = 'rust';
    evidence.push(`Found ${buildFileCounts['Cargo.toml']} Cargo.toml files`);
    confidence = 'high';
  } else if (buildFileCounts['pyproject.toml'] > 0 || buildFileCounts['requirements.txt'] > 0) {
    language = 'python';
    evidence.push(`Found Python build files (pyproject.toml: ${buildFileCounts['pyproject.toml'] || 0}, requirements.txt: ${buildFileCounts['requirements.txt'] || 0})`);
    confidence = 'high';
  }

  // Kind detection based on build files and directory structure
  if (language === 'ts' && buildFileCounts['package.json'] > 0) {
    try {
      // Analyze package.json for CLI indicators
      const packageJsonFiles = discoveries.buildFiles
        .filter(f => f.type === 'package.json')
        .map(f => path.join(repoPath, f.path));

      for (const packagePath of packageJsonFiles) {
        try {
          const packageContent = await fs.readFile(packagePath, 'utf-8');
          const packageData = JSON.parse(packageContent);
          
          if (packageData.bin || packageData.preferGlobal) {
            kind = 'cli';
            evidence.push(`package.json has bin field or preferGlobal flag`);
            confidence = 'high';
            break;
          }
          
          if (packageData.main || packageData.module || packageData.exports) {
            kind = 'library';
            evidence.push(`package.json has main/module/exports fields (library)`);
            confidence = 'medium';
          }
        } catch (err) {
          // Skip malformed package.json files
          continue;
        }
      }
    } catch (error) {
      evidence.push('Could not analyze package.json files');
    }
  }

  if (language === 'go' && buildFileCounts['go.mod'] > 0) {
    // Check for cmd/ directory pattern (common for Go CLIs)
    try {
      const cmdDirs = await glob('**/cmd/**', { 
        cwd: repoPath, 
        ignore: ['**/node_modules/**', '**/.git/**', '**/vendor/**'] 
      });
      
      if (cmdDirs.length > 0) {
        kind = 'cli';
        evidence.push(`Found ${cmdDirs.length} cmd/ directories (Go CLI pattern)`);
        confidence = 'high';
      } else {
        // Check for main.go files
        const mainFiles = await glob('**/main.go', {
          cwd: repoPath,
          ignore: ['**/node_modules/**', '**/.git/**', '**/vendor/**']
        });
        
        if (mainFiles.length > 0) {
          kind = 'cli';
          evidence.push(`Found ${mainFiles.length} main.go files`);
          confidence = 'medium';
        } else {
          kind = 'library';
          evidence.push('Go module without main.go (likely library)');
          confidence = 'medium';
        }
      }
    } catch (error) {
      evidence.push('Could not analyze Go project structure');
    }
  }

  if (language === 'rust' && buildFileCounts['Cargo.toml'] > 0) {
    try {
      const cargoFiles = discoveries.buildFiles
        .filter(f => f.type === 'Cargo.toml')
        .map(f => path.join(repoPath, f.path));

      for (const cargoPath of cargoFiles) {
        try {
          const cargoContent = await fs.readFile(cargoPath, 'utf-8');
          
          // Simple heuristics for Rust projects
          if (cargoContent.includes('[[bin]]') || cargoContent.includes('name = "')) {
            kind = 'cli';
            evidence.push('Cargo.toml contains [[bin]] section');
            confidence = 'high';
            break;
          }
          
          if (cargoContent.includes('[lib]')) {
            kind = 'library';
            evidence.push('Cargo.toml contains [lib] section');
            confidence = 'high';
            break;
          }
        } catch (err) {
          continue;
        }
      }
      
      if (kind === 'unknown') {
        kind = 'library';
        evidence.push('Rust crate (default to library)');
        confidence = 'low';
      }
    } catch (error) {
      evidence.push('Could not analyze Cargo.toml files');
    }
  }

  // Service detection based on deployment files
  const deploymentIndicators = await glob('**/docker-compose.{yml,yaml}', {
    cwd: repoPath,
    ignore: ['**/node_modules/**', '**/.git/**']
  });
  
  if (deploymentIndicators.length > 0) {
    kind = 'service';
    evidence.push(`Found ${deploymentIndicators.length} docker-compose files`);
    confidence = 'medium';
  }

  // Kubernetes/deployment files
  const k8sFiles = await glob('**/{k8s,kubernetes,deploy,manifests}/**/*.{yml,yaml}', {
    cwd: repoPath,
    ignore: ['**/node_modules/**', '**/.git/**']
  });
  
  if (k8sFiles.length > 0) {
    kind = 'service';
    evidence.push(`Found ${k8sFiles.length} Kubernetes/deployment files`);
    confidence = 'medium';
  }

  // Job detection based on workflow files
  const workflowFiles = await glob('**/.github/workflows/**/*.{yml,yaml}', {
    cwd: repoPath,
  });
  
  const hasJobKeywords = workflowFiles.length > 0;
  if (hasJobKeywords && kind === 'unknown') {
    kind = 'job';
    evidence.push(`Found ${workflowFiles.length} GitHub workflow files`);
    confidence = 'low';
  }

  if (verbose) {
    console.log(`🔍 Artifact detection: ${kind} (${language}) - confidence: ${confidence}`);
    if (evidence.length > 0) {
      console.log(`   Evidence: ${evidence.join(', ')}`);
    }
  }

  return { kind, language, confidence, evidence };
}

/**
 * Find likely entrypoint for a CUE package
 */
function findCueEntrypoint(packagePath: string, cueFiles: string[]): string | undefined {
  const basenames = cueFiles.map(f => path.basename(f));
  
  // Common entrypoint patterns
  const entrypointCandidates = [
    'main.cue',
    'index.cue',
    'schema.cue',
    'config.cue',
    basenames.find(f => f.includes('spec.cue')),
    basenames.find(f => f.includes('defs.cue')),
    basenames[0], // fallback to first file
  ].filter(Boolean);
  
  return entrypointCandidates[0];
}

/**
 * Synthesize assembly from discoveries
 */
function synthesizeAssemblyFromDiscoveries(
  discoveries: ScanResult['discoveries'], 
  artifacts: ScanResult['artifacts']
): EnvelopedResource<AssemblyV1> {
  const now = new Date().toISOString();
  
  return {
    apiVersion: CURRENT_API_VERSION,
    kind: 'Assembly',
    metadata: {
      name: 'synthesized-assembly',
      createdAt: now,
      updatedAt: now,
      annotations: {
        'arbiter.dev/synthesized': 'true',
        'arbiter.dev/scan-version': '1.0.0',
      },
    },
    spec: {
      // Include detected artifact information
      artifact: artifacts.confidence !== 'low' ? {
        kind: artifacts.kind,
        language: artifacts.language,
        build: {
          tool: getBuildTool(artifacts.language),
          targets: getDefaultTargets(artifacts.kind, artifacts.language),
        },
        packaging: {
          publish: false, // Default to not publishing
        },
      } : undefined,
      
      // Include basic profile based on detected kind
      profiles: artifacts.confidence !== 'low' && artifacts.kind !== 'unknown' ? 
        generateDefaultProfile(artifacts.kind) : undefined,
      
      projects: discoveries.suggestedProjects.map(project => ({
        name: project.name,
        path: project.path,
        include: project.type === 'yaml' ? ['**/*.yaml', '**/*.yml'] : ['**/*.cue'],
        exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
        entrypoint: project.entrypoint,
      })),
      settings: {
        defaultTimeout: 750,
        maxConcurrency: 4,
        rateLimits: {
          requestsPerSecond: 1,
          payloadSizeKB: 64,
        },
      },
    },
  };
}

/**
 * Get default build tool for language
 */
function getBuildTool(language: string): string {
  switch (language) {
    case 'ts': return 'bun';
    case 'go': return 'go';
    case 'rust': return 'cargo';
    case 'python': return 'uv';
    default: return 'make';
  }
}

/**
 * Get default build targets for kind and language
 */
function getDefaultTargets(kind: string, language: string): string[] {
  switch (language) {
    case 'ts':
      return kind === 'cli' ? ['./bin/*'] : ['./src/**/*'];
    case 'go':
      return kind === 'cli' ? ['./cmd/...'] : ['./...'];
    case 'rust':
      return kind === 'cli' ? ['--bin'] : ['--lib'];
    case 'python':
      return ['./'];
    default:
      return ['./'];
  }
}

/**
 * Generate default profile configuration for artifact kind
 */
function generateDefaultProfile(kind: string): AssemblyV1['profiles'] {
  switch (kind) {
    case 'library':
      return {
        library: {
          semver: 'strict',
          apiSurface: {
            source: 'generated',
          },
          contracts: {
            forbidBreaking: true,
            invariants: [],
          },
        },
      };
    
    case 'cli':
      return {
        cli: {
          commands: [
            {
              name: 'help',
              summary: 'Show help information',
              args: [],
              flags: [],
              exits: [
                { code: 0, meaning: 'Success' },
                { code: 1, meaning: 'General error' },
              ],
              io: {
                out: 'stdout',
              },
            },
          ],
          tests: {
            golden: [
              {
                cmd: '--help',
                wantCode: 0,
                wantRE: '(?i)(help|usage)',
              },
            ],
            property: [],
          },
        },
      };
    
    case 'job':
      return {
        job: {
          resources: {
            cpu: '100m',
            mem: '128Mi',
            wall: '30m',
          },
          ioContracts: {
            reads: ['**/*'],
            writes: ['./output/**/*'],
            net: false,
          },
        },
      };
    
    case 'service':
      // No specific profile for service - handled by existing patterns
      return undefined;
    
    default:
      return undefined;
  }
}

/**
 * Emit scan results to files
 */
async function emitScanResults(result: ScanResult, outputDir: string, verbose: boolean) {
  // Emit scan.json
  const scanJsonPath = path.join(outputDir, 'scan.json');
  const scanData = {
    timestamp: new Date().toISOString(),
    assemblyFound: result.assemblyFound,
    assemblyPath: result.assemblyPath,
    legacy: result.legacy,
    migrationRequired: result.migrationRequired,
    artifacts: result.artifacts,
    discoveries: result.discoveries,
    migrationPatch: result.migrationPatch,
  };
  
  await fs.writeFile(scanJsonPath, JSON.stringify(scanData, null, 2));
  
  if (verbose) {
    console.log(`📊 Scan results written to: ${path.relative(outputDir, scanJsonPath)}`);
  }
  
  // Emit assembly draft (dry-run)
  if (!result.assemblyFound) {
    const assemblyDraftPath = path.join(outputDir, 'arbiter.assembly.json');
    const assemblyContent = JSON.stringify(result.assemblyDraft, null, 2);
    
    await fs.writeFile(assemblyDraftPath, assemblyContent);
    
    if (verbose) {
      console.log(`📋 Assembly draft written to: ${path.relative(outputDir, assemblyDraftPath)}`);
    }
  }
  
  // Emit migration patch if needed
  if (result.migrationPatch) {
    const migrationPatchPath = path.join(outputDir, 'migration-patch.json');
    const patchContent = JSON.stringify(result.migrationPatch, null, 2);
    
    await fs.writeFile(migrationPatchPath, patchContent);
    
    if (verbose) {
      console.log(`🔄 Migration patch written to: ${path.relative(outputDir, migrationPatchPath)}`);
    }
  }
}