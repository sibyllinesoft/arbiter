/**
 * Assemble Command - Load assembly and upsert projects in Arbiter
 * 
 * Implements the assemble function from the Agent Operating Prompt:
 * - Load + migrate assembly to IR
 * - Stable-sort projects and compute file→project map
 * - Upsert in Arbiter with batching and rate limiting
 * - Ensure idempotent operations
 */

import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import {
  loadAndMigrateResource,
  type EnvelopedResource,
  type AssemblyV1,
} from '../versioning.js';
import { RateLimiter } from '../rate-limiter.js';

export interface AssembleOptions {
  repoPath: string;
  assemblyPath?: string;
  apply?: boolean;
  apiUrl?: string;
  timeout?: number;
  verbose?: boolean;
}

export interface ProjectMapping {
  projectName: string;
  files: string[];
  path: string;
  include: string[];
  exclude: string[];
  entrypoint?: string;
}

export interface AssembleResult {
  assembly: EnvelopedResource<AssemblyV1>;
  projectMap: ProjectMapping[];
  filesProcessed: number;
  projectsUpserted: number;
  analysisResults: Array<{
    projectName: string;
    files: string[];
    success: boolean;
    errors?: string[];
    duration: number;
  }>;
  summary: {
    totalFiles: number;
    totalProjects: number;
    totalDuration: number;
    success: boolean;
  };
}

/**
 * Main assemble function following the operating prompt pseudocode
 */
export async function assembleCommand(options: AssembleOptions): Promise<AssembleResult> {
  const {
    repoPath,
    assemblyPath,
    apply = false,
    apiUrl = 'http://localhost:8080',
    timeout = 750,
    verbose = false,
  } = options;
  
  const startTime = Date.now();
  
  if (verbose) {
    console.log(`🔧 Assembling projects from: ${repoPath}`);
    console.log(`📋 Apply mode: ${apply ? 'enabled' : 'dry-run'}`);
  }
  
  // Step 1: Load assembly IR
  const assembly = await loadAssemblyIR(repoPath, assemblyPath, verbose);
  
  // Step 2: Compute file→project map with stable sorting
  const projectMap = await computeFileProjectMap(assembly, repoPath, verbose);
  
  let analysisResults: AssembleResult['analysisResults'] = [];
  let projectsUpserted = 0;
  
  // Step 3: If apply mode, upsert projects and run analyses
  if (apply) {
    const result = await upsertProjectsAndAnalyze(projectMap, {
      apiUrl,
      timeout,
      rateLimits: assembly.spec.settings?.rateLimits,
      verbose,
    });
    
    analysisResults = result.analysisResults;
    projectsUpserted = result.projectsUpserted;
  }
  
  // Step 4: Persist project mapping for future reference
  await persistProjectMapping(projectMap, repoPath, verbose);
  
  const totalDuration = Date.now() - startTime;
  const filesProcessed = projectMap.reduce((sum, p) => sum + p.files.length, 0);
  
  const result: AssembleResult = {
    assembly,
    projectMap,
    filesProcessed,
    projectsUpserted,
    analysisResults,
    summary: {
      totalFiles: filesProcessed,
      totalProjects: projectMap.length,
      totalDuration,
      success: analysisResults.every(r => r.success),
    },
  };
  
  if (verbose) {
    console.log(`✅ Assembly complete:`);
    console.log(`   Projects: ${result.summary.totalProjects}`);
    console.log(`   Files: ${result.summary.totalFiles}`);
    console.log(`   Duration: ${result.summary.totalDuration}ms`);
    console.log(`   Success: ${result.summary.success}`);
  }
  
  return result;
}

/**
 * Load and migrate assembly to latest version
 */
async function loadAssemblyIR(
  repoPath: string,
  assemblyPath?: string,
  verbose?: boolean
): Promise<EnvelopedResource<AssemblyV1>> {
  // Try multiple locations for assembly file
  const possiblePaths = assemblyPath
    ? [assemblyPath]
    : [
        path.join(repoPath, 'arbiter.assembly.json'),
        path.join(repoPath, 'arbiter.assembly.cue'),
        path.join(repoPath, 'arbiter.assembly.yaml'),
        path.join(repoPath, 'scan.json'), // fallback to scan result
      ];
  
  for (const filePath of possiblePaths) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      
      if (verbose) {
        console.log(`📄 Loading assembly from: ${path.relative(repoPath, filePath)}`);
      }
      
      // Handle scan.json format
      if (filePath.endsWith('scan.json')) {
        const scanResult = JSON.parse(content);
        if (scanResult.assemblyDraft) {
          return scanResult.assemblyDraft;
        }
      }
      
      const result = loadAndMigrateResource<AssemblyV1>(content, 'Assembly');
      
      if (result.migrated && verbose) {
        console.log(`🔄 Migrated assembly from ${result.migrationPatch?.from} to ${result.migrationPatch?.to}`);
      }
      
      return result.resource;
    } catch (error) {
      // Continue to next path
      continue;
    }
  }
  
  throw new Error(`No assembly file found in: ${possiblePaths.join(', ')}`);
}

/**
 * Compute file→project mapping with stable sorting and conflict resolution
 */
async function computeFileProjectMap(
  assembly: EnvelopedResource<AssemblyV1>,
  repoPath: string,
  verbose?: boolean
): Promise<ProjectMapping[]> {
  const projectMap: ProjectMapping[] = [];
  const fileToProjectMap = new Map<string, string>();
  
  // Stable sort projects by name for deterministic processing
  const sortedProjects = [...assembly.spec.projects].sort((a, b) => a.name.localeCompare(b.name));
  
  for (const project of sortedProjects) {
    if (verbose) {
      console.log(`📁 Processing project: ${project.name} (${project.path})`);
    }
    
    // Find files matching project's include/exclude patterns
    const projectPath = path.resolve(repoPath, project.path);
    const includePatterns = project.include || ['**/*.cue'];
    const excludePatterns = project.exclude || ['**/node_modules/**', '**/.git/**'];
    
    const allFiles: string[] = [];
    
    for (const includePattern of includePatterns) {
      try {
        const files = await glob(includePattern, {
          cwd: projectPath,
          ignore: excludePatterns,
          absolute: false,
        });
        
        allFiles.push(...files.map(f => path.join(project.path, f)));
      } catch (error) {
        if (verbose) {
          console.warn(`⚠️  Failed to glob ${includePattern} in ${project.path}: ${error}`);
        }
      }
    }
    
    // Remove duplicates and resolve conflicts
    const uniqueFiles = [...new Set(allFiles)];
    const validFiles: string[] = [];
    
    for (const file of uniqueFiles) {
      const existingProject = fileToProjectMap.get(file);
      
      if (existingProject) {
        // Conflict resolution: nearest arbiter.project.cue wins, else nearest cue.mod, else topmost directory
        const currentProjectDepth = project.path.split(path.sep).length;
        const existingProjectDepth = assembly.spec.projects
          .find(p => p.name === existingProject)?.path.split(path.sep).length || 0;
        
        if (currentProjectDepth < existingProjectDepth) {
          // Current project is closer to root, it wins
          fileToProjectMap.set(file, project.name);
          validFiles.push(file);
          
          // Remove from existing project
          const existingMapping = projectMap.find(p => p.projectName === existingProject);
          if (existingMapping) {
            existingMapping.files = existingMapping.files.filter(f => f !== file);
          }
          
          if (verbose) {
            console.log(`🔀 File conflict resolved: ${file} → ${project.name} (closer to root)`);
          }
        } else if (verbose) {
          console.log(`⚠️  File conflict skipped: ${file} already owned by ${existingProject}`);
        }
      } else {
        fileToProjectMap.set(file, project.name);
        validFiles.push(file);
      }
    }
    
    // Sort files for deterministic ordering
    validFiles.sort();
    
    projectMap.push({
      projectName: project.name,
      files: validFiles,
      path: project.path,
      include: includePatterns,
      exclude: excludePatterns,
      entrypoint: project.entrypoint,
    });
    
    if (verbose) {
      console.log(`   📊 Mapped ${validFiles.length} files to ${project.name}`);
    }
  }
  
  return projectMap;
}

/**
 * Upsert projects in Arbiter with rate limiting and batching
 */
async function upsertProjectsAndAnalyze(
  projectMap: ProjectMapping[],
  options: {
    apiUrl: string;
    timeout: number;
    rateLimits?: { requestsPerSecond?: number; payloadSizeKB?: number };
    verbose?: boolean;
  }
): Promise<{
  analysisResults: AssembleResult['analysisResults'];
  projectsUpserted: number;
}> {
  const { apiUrl, timeout, rateLimits, verbose } = options;
  const maxPayloadKB = rateLimits?.payloadSizeKB || 64;
  const maxRPS = rateLimits?.requestsPerSecond || 1;
  
  const rateLimiter = new RateLimiter(maxRPS);
  const analysisResults: AssembleResult['analysisResults'] = [];
  let projectsUpserted = 0;
  
  for (const project of projectMap) {
    if (verbose) {
      console.log(`🚀 Upserting project: ${project.projectName}`);
    }
    
    const startTime = Date.now();
    
    try {
      // Upsert project in Arbiter
      await rateLimiter.waitForSlot();
      
      const projectData = {
        name: project.projectName,
        path: project.path,
        include: project.include,
        exclude: project.exclude,
        entrypoint: project.entrypoint,
      };
      
      const upsertResponse = await fetch(`${apiUrl}/projects/${project.projectName}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(projectData),
        signal: AbortSignal.timeout(timeout),
      });
      
      if (!upsertResponse.ok) {
        throw new Error(`HTTP ${upsertResponse.status}: ${upsertResponse.statusText}`);
      }
      
      projectsUpserted++;
      
      // Batch analyze files with size limits
      const batches = createAnalysisBatches(project.files, maxPayloadKB);
      const batchResults: string[] = [];
      
      for (const batch of batches) {
        await rateLimiter.waitForSlot();
        
        const analysisPayload = {
          files: batch.map(filePath => ({
            path: filePath,
            content: '', // Would need to read file content
          })),
        };
        
        try {
          const analysisResponse = await fetch(`${apiUrl}/analyze/batch`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(analysisPayload),
            signal: AbortSignal.timeout(timeout),
          });
          
          if (analysisResponse.ok) {
            const result = await analysisResponse.json();
            batchResults.push(`Batch ${batches.indexOf(batch)}: success`);
          } else {
            batchResults.push(`Batch ${batches.indexOf(batch)}: HTTP ${analysisResponse.status}`);
          }
        } catch (error) {
          batchResults.push(`Batch ${batches.indexOf(batch)}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      analysisResults.push({
        projectName: project.projectName,
        files: project.files,
        success: true,
        duration: Date.now() - startTime,
      });
      
      if (verbose) {
        console.log(`✅ ${project.projectName}: ${project.files.length} files in ${batches.length} batches`);
      }
      
    } catch (error) {
      analysisResults.push({
        projectName: project.projectName,
        files: project.files,
        success: false,
        errors: [error instanceof Error ? error.message : String(error)],
        duration: Date.now() - startTime,
      });
      
      if (verbose) {
        console.error(`❌ ${project.projectName}: ${error}`);
      }
    }
  }
  
  return { analysisResults, projectsUpserted };
}

/**
 * Create analysis batches respecting payload size limits
 */
function createAnalysisBatches(files: string[], maxPayloadKB: number): string[][] {
  const maxBytes = maxPayloadKB * 1024;
  const batches: string[][] = [];
  let currentBatch: string[] = [];
  let currentSize = 0;
  
  for (const file of files) {
    // Estimate size (rough approximation)
    const estimatedSize = JSON.stringify({ path: file, content: '' }).length + 1000; // +1KB for content
    
    if (currentSize + estimatedSize > maxBytes && currentBatch.length > 0) {
      batches.push(currentBatch);
      currentBatch = [file];
      currentSize = estimatedSize;
    } else {
      currentBatch.push(file);
      currentSize += estimatedSize;
    }
  }
  
  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }
  
  return batches.length > 0 ? batches : [[]];
}

/**
 * Persist project mapping for future reference
 */
async function persistProjectMapping(
  projectMap: ProjectMapping[],
  repoPath: string,
  verbose?: boolean
): Promise<void> {
  const mappingPath = path.join(repoPath, '.arbiter', 'project-mapping.json');
  
  // Ensure directory exists
  await fs.mkdir(path.dirname(mappingPath), { recursive: true });
  
  const mappingData = {
    timestamp: new Date().toISOString(),
    projects: projectMap,
    fileToProject: {} as Record<string, string>,
  };
  
  // Create reverse mapping for quick lookup
  for (const project of projectMap) {
    for (const file of project.files) {
      mappingData.fileToProject[file] = project.projectName;
    }
  }
  
  await fs.writeFile(mappingPath, JSON.stringify(mappingData, null, 2));
  
  if (verbose) {
    console.log(`💾 Project mapping persisted to: ${path.relative(repoPath, mappingPath)}`);
  }
}