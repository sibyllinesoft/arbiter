/**
 * Node.js Plugin for Brownfield Detection
 *
 * Comprehensive plugin for detecting Node.js artifacts including services,
 * libraries, CLIs, and frontends. Analyzes package.json, source files, and
 * dependency patterns to infer application architecture.
 */

import * as path from 'path';
import {
  type DetectionContext,
  type SourceAnalysis,
  detectArtifactType,
} from '../detection/artifact-detector.js';
import {
  BinaryArtifact,
  CliArtifact,
  ConfidenceScore,
  Evidence,
  FrontendArtifact,
  ImporterPlugin,
  InferenceContext,
  InferredArtifact,
  LibraryArtifact,
  ParseContext,
  Provenance,
  ServiceArtifact,
} from '../types.js';

// ============================================================================
// Node.js Framework and Library Detection
// ============================================================================

const NODE_WEB_FRAMEWORKS = [
  'express',
  'fastify',
  'koa',
  'hapi',
  'nest',
  'adonis',
  'meteor',
  'sails',
  'loopback',
  'restify',
];

const NODE_FRONTEND_FRAMEWORKS = [
  'react',
  'vue',
  'angular',
  'svelte',
  'solid-js',
  'preact',
  'lit',
  'stimulus',
];

const NODE_BUILD_TOOLS = [
  'webpack',
  'vite',
  'rollup',
  'parcel',
  'esbuild',
  'snowpack',
  'turbopack',
];

const NODE_TESTING_FRAMEWORKS = [
  'jest',
  'mocha',
  'vitest',
  'cypress',
  'playwright',
  'puppeteer',
  'testing-library',
];

const NODE_DATABASE_DRIVERS = [
  'mongoose',
  'sequelize',
  'typeorm',
  'prisma',
  'pg',
  'mysql',
  'redis',
  'mongodb',
  'sqlite3',
  'better-sqlite3',
];

const NODE_CLI_FRAMEWORKS = [
  'commander',
  'yargs',
  'inquirer',
  'ora',
  'chalk',
  'boxen',
  'cli-table3',
];

// ============================================================================
// Types for structured evidence data
// ============================================================================

export interface PackageJsonData extends Record<string, unknown> {
  configType: string;
  name: string;
  version?: string;
  description?: string;
  main?: string;
  type?: 'module' | 'commonjs';
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
  bin?: Record<string, string> | string;
  engines?: Record<string, string>;
  workspaces?: string[] | { packages: string[] };
  private?: boolean;
  homepage?: string;
  repository?: any;
  author?: string | { name: string; email?: string };
  license?: string;
  keywords?: string[];
}

interface SourceFileData extends Record<string, unknown> {
  configType: string;
  filePath: string;
  hasExports: boolean;
  hasImports: boolean;
  isEntryPoint: boolean;
  frameworkUsage: string[];
  serverPatterns: string[];
  portBindings: number[];
  routeDefinitions: string[];
  testPatterns: boolean;
}

// ============================================================================
// Main Plugin Implementation
// ============================================================================

export class NodeJSPlugin implements ImporterPlugin {
  name(): string {
    return 'nodejs';
  }

  supports(filePath: string, fileContent?: string): boolean {
    const fileName = path.basename(filePath);
    const extension = path.extname(filePath);

    // Support package.json files
    if (fileName === 'package.json') {
      return true;
    }

    // Support JavaScript/TypeScript files
    if (['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'].includes(extension)) {
      return true;
    }

    // Support lock files
    if (['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb'].includes(fileName)) {
      return true;
    }

    return false;
  }

  async parse(filePath: string, fileContent?: string, context?: ParseContext): Promise<Evidence[]> {
    if (!fileContent) return [];

    const evidence: Evidence[] = [];
    const fileName = path.basename(filePath);
    const baseId = `nodejs-${path.relative(context?.projectRoot || '', filePath)}`;

    try {
      if (fileName === 'package.json') {
        evidence.push(...(await this.parsePackageJson(filePath, fileContent, baseId)));
      } else if (
        fileName === 'package-lock.json' ||
        fileName === 'yarn.lock' ||
        fileName === 'pnpm-lock.yaml'
      ) {
        evidence.push(...(await this.parseLockFile(filePath, fileContent, baseId)));
      } else if (['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'].includes(path.extname(filePath))) {
        evidence.push(...(await this.parseSourceFile(filePath, fileContent, baseId)));
      }
    } catch (error) {
      console.warn(`Node.js plugin failed to parse ${filePath}:`, error);
    }

    return evidence;
  }

  async infer(evidence: Evidence[], context: InferenceContext): Promise<InferredArtifact[]> {
    const nodeEvidence = evidence.filter(e => e.source === 'nodejs');
    if (nodeEvidence.length === 0) return [];

    const artifacts: InferredArtifact[] = [];

    try {
      // Infer from package.json evidence
      const packageEvidence = nodeEvidence.filter(
        e => e.type === 'config' && e.data.configType === 'package-json'
      );
      for (const pkg of packageEvidence) {
        artifacts.push(...(await this.inferFromPackageJson(pkg, nodeEvidence, context)));
      }
    } catch (error) {
      console.warn('Node.js plugin inference failed:', error);
    }

    return artifacts;
  }

  // ============================================================================
  // Private parsing methods
  // ============================================================================

  private async parsePackageJson(
    filePath: string,
    content: string,
    baseId: string
  ): Promise<Evidence[]> {
    const evidence: Evidence[] = [];

    try {
      const pkg = JSON.parse(content);

      const packageData: PackageJsonData = {
        configType: 'package-json',
        name: pkg.name || path.basename(path.dirname(filePath)),
        version: pkg.version,
        description: pkg.description,
        main: pkg.main,
        type: pkg.type,
        scripts: pkg.scripts || {},
        dependencies: pkg.dependencies || {},
        devDependencies: pkg.devDependencies || {},
        peerDependencies: pkg.peerDependencies || {},
        bin: pkg.bin,
        engines: pkg.engines,
        workspaces: pkg.workspaces,
        private: pkg.private,
        homepage: pkg.homepage,
        repository: pkg.repository,
        author: pkg.author,
        license: pkg.license,
        keywords: pkg.keywords,
      };

      evidence.push({
        id: `${baseId}-package`,
        source: 'nodejs',
        type: 'config',
        filePath,
        data: packageData,
        confidence: 0.95,
        metadata: {
          timestamp: Date.now(),
          fileSize: content.length,
        },
      });

      // Analyze scripts for insights
      for (const [scriptName, scriptCommand] of Object.entries(
        (pkg.scripts as Record<string, string>) || {}
      )) {
        evidence.push({
          id: `${baseId}-script-${scriptName}`,
          source: 'nodejs',
          type: 'build',
          filePath,
          data: {
            scriptName,
            scriptCommand,
            scriptType: this.classifyScript(scriptName, scriptCommand),
          },
          confidence: 0.8,
          metadata: {
            timestamp: Date.now(),
            fileSize: content.length,
          },
        });
      }

      // Analyze dependencies
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      for (const [depName, depVersion] of Object.entries(allDeps)) {
        evidence.push({
          id: `${baseId}-dep-${depName}`,
          source: 'nodejs',
          type: 'dependency',
          filePath,
          data: {
            dependencyName: depName,
            dependencyVersion: depVersion,
            framework: this.classifyFramework(depName),
            isDev: Boolean(pkg.devDependencies?.[depName]),
          },
          confidence: 0.8,
          metadata: {
            timestamp: Date.now(),
            fileSize: content.length,
          },
        });
      }
    } catch (error) {
      console.warn('Failed to parse package.json:', error);
    }

    return evidence;
  }

  private async parseLockFile(
    filePath: string,
    content: string,
    baseId: string
  ): Promise<Evidence[]> {
    const evidence: Evidence[] = [];
    const fileName = path.basename(filePath);

    // Basic lock file analysis - track that dependencies are locked
    evidence.push({
      id: `${baseId}-lockfile`,
      source: 'nodejs',
      type: 'dependency',
      filePath,
      data: {
        lockFileType: fileName,
        locked: true,
      },
      confidence: 0.7,
      metadata: {
        timestamp: Date.now(),
        fileSize: content.length,
      },
    });

    return evidence;
  }

  private async parseSourceFile(
    filePath: string,
    content: string,
    baseId: string
  ): Promise<Evidence[]> {
    const evidence: Evidence[] = [];
    const fileName = path.basename(filePath);

    // Detect imports/exports
    const hasImports = /(?:import\s+|require\s*\(|from\s+['"])/m.test(content);
    const hasExports = /(?:export\s+|module\.exports\s*=|exports\.[a-zA-Z])/m.test(content);

    // Detect if this is likely an entry point
    const isEntryPoint =
      fileName === 'index.js' ||
      fileName === 'index.ts' ||
      fileName === 'main.js' ||
      fileName === 'main.ts' ||
      fileName === 'app.js' ||
      fileName === 'app.ts' ||
      fileName === 'server.js' ||
      fileName === 'server.ts' ||
      content.includes('process.argv') ||
      content.includes('app.listen') ||
      content.includes('server.listen');

    // Detect framework usage
    const frameworkUsage = this.detectFrameworkUsage(content);

    // Detect server patterns
    const serverPatterns = this.detectServerPatterns(content);

    // Extract port bindings
    const portBindings = this.extractPortBindings(content);

    // Detect route definitions
    const routeDefinitions = this.extractRouteDefinitions(content);

    // Detect test patterns
    const testPatterns = this.detectTestPatterns(content);

    const sourceData: SourceFileData = {
      configType: 'source-file',
      filePath,
      hasExports,
      hasImports,
      isEntryPoint,
      frameworkUsage,
      serverPatterns,
      portBindings,
      routeDefinitions,
      testPatterns,
    };

    evidence.push({
      id: `${baseId}-source`,
      source: 'nodejs',
      type: isEntryPoint ? 'function' : hasExports ? 'export' : 'import',
      filePath,
      data: sourceData,
      confidence: 0.8,
      metadata: {
        timestamp: Date.now(),
        fileSize: content.length,
      },
    });

    return evidence;
  }

  // ============================================================================
  // Private inference methods
  // ============================================================================

  private async inferFromPackageJson(
    packageEvidence: Evidence,
    allEvidence: Evidence[],
    context: InferenceContext
  ): Promise<InferredArtifact[]> {
    const artifacts: InferredArtifact[] = [];
    const packageData = packageEvidence.data as unknown as PackageJsonData;

    // Skip root package.json if it has workspaces (monorepo root)
    // The actual packages will be processed from their own package.json files
    if (packageData.workspaces && packageData.private) {
      console.log(`   ⏭️  Skipping monorepo root package: ${packageData.name}`);
      return [];
    }

    // Determine primary artifact type based on analysis
    const artifactType = this.determineArtifactType(packageData, allEvidence);

    switch (artifactType) {
      case 'service':
        artifacts.push(...(await this.createServiceArtifact(packageData, allEvidence)));
        break;
      case 'frontend':
        artifacts.push(...(await this.createFrontendArtifact(packageData, allEvidence)));
        break;
      case 'cli':
        artifacts.push(...(await this.createCliArtifact(packageData, allEvidence)));
        break;
      case 'binary':
        artifacts.push(...(await this.createBinaryArtifact(packageData, allEvidence)));
        break;
      case 'library':
        artifacts.push(...(await this.createLibraryArtifact(packageData, allEvidence)));
        break;
    }

    return artifacts;
  }

  private determineArtifactType(packageData: PackageJsonData, allEvidence: Evidence[]): string {
    const name = packageData.name || 'unknown';
    console.log(`🔍 Detecting type for ${name}`);

    // SIMPLE RULE-BASED DETECTION - No complex scoring, just clear rules

    // Merge all dependencies for checking
    const deps = { ...packageData.dependencies, ...packageData.devDependencies };

    // 1. CLI - Has bin field or CLI framework
    if (packageData.bin) {
      console.log(`   ✅ CLI: Has bin field`);
      return 'cli';
    }

    // Check for CLI frameworks even without bin field
    const cliFrameworks = [
      'commander',
      'yargs',
      'inquirer',
      'oclif',
      'meow',
      'caporal',
      'cac',
      'clipanion',
    ];
    const hasCliFramework = Object.keys(deps).some(dep =>
      cliFrameworks.some(cli => dep.toLowerCase().includes(cli))
    );

    if (hasCliFramework && !packageData.private) {
      console.log(`   ✅ CLI: Has CLI framework (public package)`);
      return 'cli';
    }

    // 2. Types packages - Special case for type definition packages
    // These are libraries even if they have web framework dependencies
    const isTypesPackage =
      name.toLowerCase().includes('types') ||
      name.toLowerCase().includes('type-definitions') ||
      (packageData.types && !packageData.main) ||
      (packageData.typings && !packageData.main);

    if (isTypesPackage) {
      console.log(`   ✅ LIBRARY: Type definitions package`);
      return 'library';
    }

    // 3. Web Service - Has web framework, database driver, or server-related scripts
    const webFrameworks = [
      'express',
      'fastify',
      'koa',
      'hono',
      'hapi',
      'nestjs',
      'restify',
      'sails',
      'feathers',
      'apollo-server',
      'graphql-yoga',
      'trpc',
      'socket.io',
      'ws',
    ];
    const databases = [
      'mongoose',
      'sequelize',
      'typeorm',
      'prisma',
      'drizzle-orm',
      'pg',
      'mysql',
      'mysql2',
      'mongodb',
      'redis',
      'ioredis',
      'knex',
      'objection',
      'mikro-orm',
    ];

    const hasWebFramework = Object.keys(deps).some(dep =>
      webFrameworks.some(fw => dep.toLowerCase().includes(fw))
    );

    const hasDatabase = Object.keys(deps).some(dep =>
      databases.some(db => dep.toLowerCase().includes(db))
    );

    const hasServerScript =
      packageData.scripts &&
      (packageData.scripts.start?.includes('server') ||
        packageData.scripts.start?.includes('src/server') ||
        packageData.scripts.dev?.includes('server') ||
        packageData.scripts.serve ||
        packageData.main?.includes('server'));

    if (hasWebFramework || hasDatabase || hasServerScript) {
      console.log(
        `   ✅ SERVICE: Has web framework (${hasWebFramework}), database (${hasDatabase}), or server script (${hasServerScript})`
      );
      return 'service';
    }

    // 4. Build tools - webpack, rollup, etc.
    const buildTools = [
      'webpack',
      'rollup',
      'parcel',
      'esbuild',
      'turbopack',
      'tsup',
      'vite',
      'snowpack',
    ];
    const hasBuildTool = Object.keys(deps).some(dep =>
      buildTools.some(tool => dep.toLowerCase().includes(tool))
    );

    // Check if it's primarily a build tool (not a frontend app using vite)
    const isBuildTool = hasBuildTool && !packageData.private && !packageData.browserslist;
    if (isBuildTool) {
      console.log(`   ✅ CLI/BUILD: Has build tool dependencies`);
      return 'cli';
    }

    // 5. Frontend - Has frontend framework OR frontend build tool with appropriate scripts
    const frontendFrameworks = [
      'react',
      'vue',
      'angular',
      'svelte',
      'solid',
      'preact',
      'next',
      'nuxt',
      'gatsby',
    ];
    const hasFrontendFramework = Object.keys(deps).some(dep =>
      frontendFrameworks.some(fw => dep.toLowerCase().includes(fw))
    );

    // Check for frontend build tools with dev/build scripts (indicates a frontend app)
    const hasFrontendBuildTool = Object.keys(deps).some(dep =>
      ['vite', 'webpack', 'parcel', 'snowpack'].includes(dep.toLowerCase())
    );

    // Check for frontend-specific scripts (even if build tool is not in dependencies)
    const hasFrontendScripts =
      packageData.scripts &&
      (packageData.scripts.dev?.includes('vite') ||
        packageData.scripts.build?.includes('vite build') ||
        packageData.scripts.preview?.includes('vite preview') ||
        packageData.scripts.serve?.includes('webpack serve') ||
        packageData.scripts.start?.includes('react-scripts') ||
        packageData.scripts.start?.includes('vue-cli-service') ||
        packageData.scripts.start?.includes('parcel') ||
        packageData.scripts.start?.includes('snowpack'));

    // It's a frontend app if:
    // 1. Has a frontend framework AND is private/has browserslist
    // 2. Has a frontend build tool with frontend scripts AND is private
    // 3. Has frontend scripts (even without deps) AND is private
    if (
      hasFrontendFramework ||
      (hasFrontendBuildTool && hasFrontendScripts) ||
      hasFrontendScripts
    ) {
      const isComponentLibrary =
        packageData.peerDependencies &&
        Object.keys(packageData.peerDependencies).some(peer =>
          frontendFrameworks.some(fw => peer.toLowerCase().includes(fw))
        );

      if (isComponentLibrary) {
        console.log(`   ✅ LIBRARY: React/Vue component library (has peer deps)`);
        return 'library';
      }

      if (packageData.private || packageData.browserslist) {
        const reason = hasFrontendFramework
          ? 'Has frontend framework'
          : 'Has frontend build tool with scripts';
        console.log(`   ✅ FRONTEND: ${reason} (private app)`);
        return 'frontend';
      }
    }

    // 6. Library - Everything else (has main/exports, types, or is just a package)
    console.log(
      `   ✅ LIBRARY: Default (has main: ${!!packageData.main}, types: ${!!packageData.types})`
    );
    return 'library';
  }

  private detectLanguage(allEvidence: Evidence[], packageData: PackageJsonData): string {
    // Check for TypeScript indicators
    const hasTypeScript =
      // TypeScript dependency
      packageData.dependencies?.typescript ||
      packageData.devDependencies?.typescript ||
      // TypeScript files in evidence
      allEvidence.some(e => e.filePath?.match(/\.tsx?$/)) ||
      // TypeScript config files
      allEvidence.some(e => e.filePath?.includes('tsconfig.json')) ||
      // TypeScript type definitions
      packageData.types ||
      packageData.typings;

    return hasTypeScript ? 'typescript' : 'javascript';
  }

  private extractFilePatterns(allEvidence: Evidence[]): string[] {
    const patterns: string[] = [];

    // Extract file paths from evidence
    allEvidence.forEach(evidence => {
      if (evidence.filePath) {
        patterns.push(evidence.filePath);
      }
      if (evidence.data?.filePath) {
        patterns.push(evidence.data.filePath as string);
      }
    });

    return patterns;
  }

  private createSourceAnalysis(allEvidence: Evidence[]): SourceAnalysis {
    const sourceEvidence = allEvidence.filter(e => e.data?.configType === 'source-file');

    let hasBinaryExecution = false;
    let hasServerPatterns = false;
    let hasFrontendPatterns = false;
    let hasCliPatterns = false;
    let hasDataProcessingPatterns = false;
    let hasTestPatterns = false;
    let hasBuildPatterns = false;
    let hasGamePatterns = false;
    let hasMobilePatterns = false;
    let hasDesktopPatterns = false;

    sourceEvidence.forEach(evidence => {
      const sourceData = evidence.data as unknown as SourceFileData;

      // Check for CLI patterns - enhanced detection
      if (sourceData.isEntryPoint) {
        const filePath = sourceData.filePath || evidence.filePath || '';
        // More comprehensive CLI detection
        if (
          filePath.includes('bin/') ||
          filePath.includes('cli/') ||
          filePath.includes('cli.') ||
          filePath.endsWith('/cli.js') ||
          filePath.endsWith('/cli.ts') ||
          (filePath.endsWith('/index.js') && filePath.includes('cli'))
        ) {
          hasBinaryExecution = true;
          hasCliPatterns = true;
        }
      }

      // Check for server patterns
      if (sourceData.serverPatterns?.length > 0 || sourceData.portBindings?.length > 0) {
        hasServerPatterns = true;
      }

      // Check for frontend patterns
      if (sourceData.frameworkUsage?.some(fw => NODE_FRONTEND_FRAMEWORKS.includes(fw))) {
        hasFrontendPatterns = true;
      }

      // Check for test patterns
      if (sourceData.testPatterns) {
        hasTestPatterns = true;
      }

      // Check for CLI patterns in framework usage
      if (sourceData.frameworkUsage?.some(fw => NODE_CLI_FRAMEWORKS.includes(fw))) {
        hasCliPatterns = true;
      }

      // Check file patterns for additional indicators
      const filePath = sourceData.filePath || evidence.filePath || '';

      // Enhanced path patterns
      if (/electron|tauri|desktop/.test(filePath)) {
        hasDesktopPatterns = true;
      }

      if (/game|phaser|three|babylon/.test(filePath)) {
        hasGamePatterns = true;
      }

      if (/mobile|react-native|ionic/.test(filePath)) {
        hasMobilePatterns = true;
      }

      if (/data|csv|xml|etl|transform|pipeline/.test(filePath)) {
        hasDataProcessingPatterns = true;
      }

      if (/build|webpack|rollup|gulp|grunt|make/.test(filePath)) {
        hasBuildPatterns = true;
      }

      // Additional server/service patterns in file paths
      if (/server|api|routes|controllers|middleware|models/.test(filePath)) {
        hasServerPatterns = true;
      }

      // Additional frontend patterns
      if (/components?|pages?|views?|layouts?|styles?/.test(filePath)) {
        hasFrontendPatterns = true;
      }
    });

    return {
      hasBinaryExecution,
      hasServerPatterns,
      hasFrontendPatterns,
      hasCliPatterns,
      hasDataProcessingPatterns,
      hasTestPatterns,
      hasBuildPatterns,
      hasGamePatterns,
      hasMobilePatterns,
      hasDesktopPatterns,
    };
  }

  private async createServiceArtifact(
    packageData: PackageJsonData,
    allEvidence: Evidence[]
  ): Promise<InferredArtifact[]> {
    const framework = this.detectWebFramework(packageData.dependencies);
    const port = this.extractServicePort(packageData, allEvidence);

    const serviceArtifact: ServiceArtifact = {
      id: `nodejs-service-${packageData.name}`,
      type: 'service',
      name: packageData.name,
      description: packageData.description || `Node.js service: ${packageData.name}`,
      tags: ['nodejs', 'service', framework].filter(Boolean) as string[],
      metadata: {
        language: this.detectLanguage(allEvidence, packageData),
        ...(framework && { framework }),
        port,
        basePath: '/',
        environmentVariables: this.extractEnvVars(allEvidence),
        dependencies: this.extractServiceDependencies(packageData),
        endpoints: this.extractEndpoints(allEvidence),
        keywords: packageData.keywords || [],
        moduleType: packageData.type,
        healthCheck: {
          path: '/health',
          expectedStatusCode: 200,
          timeoutMs: 5000,
          intervalSeconds: 30,
        },
      },
    };

    return [
      {
        artifact: serviceArtifact,
        confidence: this.calculateConfidence([...allEvidence], 0.9),
        provenance: this.createProvenance([...allEvidence]),
        relationships: [],
      },
    ];
  }

  private async createFrontendArtifact(
    packageData: PackageJsonData,
    allEvidence: Evidence[]
  ): Promise<InferredArtifact[]> {
    const framework = this.detectFrontendFramework(packageData.dependencies);
    const buildSystem = this.detectBuildSystem(packageData.dependencies);

    const frontendArtifact: FrontendArtifact = {
      id: `nodejs-frontend-${packageData.name}`,
      type: 'frontend',
      name: packageData.name,
      description: packageData.description || `Node.js frontend: ${packageData.name}`,
      tags: ['nodejs', 'frontend', framework].filter(Boolean) as string[],
      metadata: {
        framework: framework || 'unknown',
        buildSystem,
        routes: this.extractFrontendRoutes(allEvidence),
        apiDependencies: this.extractApiDependencies(allEvidence),
        environmentVariables: this.extractEnvVars(allEvidence),
        keywords: packageData.keywords || [],
        moduleType: packageData.type,
      },
    };

    return [
      {
        artifact: frontendArtifact,
        confidence: this.calculateConfidence([...allEvidence], 0.85),
        provenance: this.createProvenance([...allEvidence]),
        relationships: [],
      },
    ];
  }

  private async createCliArtifact(
    packageData: PackageJsonData,
    allEvidence: Evidence[]
  ): Promise<InferredArtifact[]> {
    const binEntries =
      typeof packageData.bin === 'string'
        ? { [packageData.name]: packageData.bin }
        : packageData.bin || {};

    const artifacts: InferredArtifact[] = [];

    // If there are explicit bin entries, create artifacts for each
    if (Object.keys(binEntries).length > 0) {
      for (const [binName, binPath] of Object.entries(binEntries)) {
        const cliArtifact: CliArtifact = {
          id: `nodejs-cli-${binName}`,
          type: 'cli',
          name: binName,
          description: `Node.js CLI tool: ${binName}`,
          tags: ['nodejs', 'cli', 'command-line'],
          metadata: {
            language: this.detectLanguage(allEvidence, packageData),
            ...(() => {
              const cliFramework = this.detectCliFramework(packageData.dependencies);
              return cliFramework ? { framework: cliFramework } : {};
            })(),
            buildSystem: 'npm',
            entryPoint: binPath,
            commands: [binName], // The bin name is the primary command
            arguments: [],
            environmentVariables: this.extractEnvVars(allEvidence),
            dependencies: Object.keys(packageData.dependencies || {}),
          },
        };

        artifacts.push({
          artifact: cliArtifact,
          confidence: this.calculateConfidence([...allEvidence], 0.9),
          provenance: this.createProvenance([...allEvidence]),
          relationships: [],
        });
      }
    } else {
      // If no bin field but detected as CLI (e.g., build tools), create a generic CLI artifact
      const cliArtifact: CliArtifact = {
        id: `nodejs-cli-${packageData.name}`,
        type: 'cli',
        name: packageData.name,
        description: packageData.description || `Node.js CLI tool: ${packageData.name}`,
        tags: ['nodejs', 'cli', 'command-line'],
        metadata: {
          language: this.detectLanguage(allEvidence, packageData),
          ...(() => {
            const cliFramework = this.detectCliFramework(packageData.dependencies);
            return cliFramework ? { framework: cliFramework } : {};
          })(),
          buildSystem: 'npm',
          entryPoint: packageData.main || 'index.js',
          commands: [packageData.name],
          arguments: [],
          environmentVariables: this.extractEnvVars(allEvidence),
          dependencies: Object.keys(packageData.dependencies || {}),
          keywords: packageData.keywords || [],
          moduleType: packageData.type,
        },
      };

      artifacts.push({
        artifact: cliArtifact,
        confidence: this.calculateConfidence([...allEvidence], 0.7), // Lower confidence without bin
        provenance: this.createProvenance([...allEvidence]),
        relationships: [],
      });
    }

    return artifacts;
  }

  private async createBinaryArtifact(
    packageData: PackageJsonData,
    allEvidence: Evidence[]
  ): Promise<InferredArtifact[]> {
    const binEntries =
      typeof packageData.bin === 'string'
        ? { [packageData.name]: packageData.bin }
        : packageData.bin || {};

    const artifacts: InferredArtifact[] = [];

    if (Object.keys(binEntries).length > 0) {
      for (const [binName, binPath] of Object.entries(binEntries)) {
        const binaryArtifact: BinaryArtifact = {
          id: `nodejs-binary-${binName}`,
          type: 'binary',
          name: binName,
          description: `Node.js CLI tool: ${binName}`,
          tags: ['nodejs', 'cli', 'binary'],
          metadata: {
            language: this.detectLanguage(allEvidence, packageData),
            buildSystem: 'npm',
            entryPoint: binPath,
            arguments: [],
            environmentVariables: this.extractEnvVars(allEvidence),
            dependencies: Object.keys(packageData.dependencies || {}),
            keywords: packageData.keywords || [],
            moduleType: packageData.type,
          },
        };

        artifacts.push({
          artifact: binaryArtifact,
          confidence: this.calculateConfidence([...allEvidence], 0.9),
          provenance: this.createProvenance([...allEvidence]),
          relationships: [],
        });
      }
    } else {
      // If no bin field but detected as binary/desktop app, create a generic binary artifact
      const binaryArtifact: BinaryArtifact = {
        id: `nodejs-binary-${packageData.name}`,
        type: 'binary',
        name: packageData.name,
        description: packageData.description || `Node.js binary: ${packageData.name}`,
        tags: ['nodejs', 'binary'],
        metadata: {
          language: this.detectLanguage(allEvidence, packageData),
          buildSystem: 'npm',
          entryPoint: packageData.main || 'index.js',
          arguments: [],
          environmentVariables: this.extractEnvVars(allEvidence),
          dependencies: Object.keys(packageData.dependencies || {}),
          keywords: packageData.keywords || [],
          moduleType: packageData.type,
        },
      };

      artifacts.push({
        artifact: binaryArtifact,
        confidence: this.calculateConfidence([...allEvidence], 0.7),
        provenance: this.createProvenance([...allEvidence]),
        relationships: [],
      });
    }

    return artifacts;
  }

  private async createLibraryArtifact(
    packageData: PackageJsonData,
    allEvidence: Evidence[]
  ): Promise<InferredArtifact[]> {
    const libraryArtifact: LibraryArtifact = {
      id: `nodejs-library-${packageData.name}`,
      type: 'library',
      name: packageData.name,
      description: packageData.description || `Node.js library: ${packageData.name}`,
      tags: ['nodejs', 'library'],
      metadata: {
        language: this.detectLanguage(allEvidence, packageData),
        packageManager: 'npm',
        publicApi: this.extractPublicApi(allEvidence),
        dependencies: Object.keys(packageData.dependencies || {}),
        version: packageData.version,
        keywords: packageData.keywords || [],
        moduleType: packageData.type,
      },
    };

    return [
      {
        artifact: libraryArtifact,
        confidence: this.calculateConfidence([...allEvidence], 0.8),
        provenance: this.createProvenance([...allEvidence]),
        relationships: [],
      },
    ];
  }

  // ============================================================================
  // Helper methods
  // ============================================================================

  private classifyScript(name: string, command: string): string {
    if (name === 'start' || command.includes('node')) return 'start';
    if (name === 'build' || command.includes('build')) return 'build';
    if (name === 'test' || command.includes('test')) return 'test';
    if (name === 'dev' || name === 'develop') return 'dev';
    if (name === 'lint') return 'lint';
    return 'other';
  }

  private classifyFramework(depName: string): string | undefined {
    if (NODE_WEB_FRAMEWORKS.includes(depName)) return 'web';
    if (NODE_FRONTEND_FRAMEWORKS.includes(depName)) return 'frontend';
    if (NODE_BUILD_TOOLS.includes(depName)) return 'build';
    if (NODE_TESTING_FRAMEWORKS.includes(depName)) return 'test';
    if (NODE_DATABASE_DRIVERS.includes(depName)) return 'database';
    if (NODE_CLI_FRAMEWORKS.includes(depName)) return 'cli';
    return undefined;
  }

  private detectFrameworkUsage(content: string): string[] {
    const frameworks: string[] = [];

    const patterns = [
      { pattern: /import\s+.*?\s+from\s+['"]express['"]/, framework: 'express' },
      { pattern: /import\s+.*?\s+from\s+['"]fastify['"]/, framework: 'fastify' },
      { pattern: /import\s+.*?\s+from\s+['"]react['"]/, framework: 'react' },
      { pattern: /import\s+.*?\s+from\s+['"]vue['"]/, framework: 'vue' },
      { pattern: /require\s*\(\s*['"]express['"]\s*\)/, framework: 'express' },
      { pattern: /require\s*\(\s*['"]fastify['"]\s*\)/, framework: 'fastify' },
    ];

    for (const { pattern, framework } of patterns) {
      if (pattern.test(content)) {
        frameworks.push(framework);
      }
    }

    return [...new Set(frameworks)];
  }

  private detectServerPatterns(content: string): string[] {
    const patterns: string[] = [];

    if (/app\.listen|server\.listen/.test(content)) patterns.push('http-server');
    if (/express\(\)/.test(content)) patterns.push('express-app');
    if (/fastify\(\)/.test(content)) patterns.push('fastify-app');
    if (/http\.createServer/.test(content)) patterns.push('http-createserver');
    if (/https\.createServer/.test(content)) patterns.push('https-createserver');

    return patterns;
  }

  private extractPortBindings(content: string): number[] {
    const ports: number[] = [];
    const portMatches = content.match(/(?:listen|port)\s*(?:\(|=|:)\s*(\d+)/g);

    if (portMatches) {
      for (const match of portMatches) {
        const portMatch = match.match(/(\d+)/);
        if (portMatch) {
          ports.push(parseInt(portMatch[1]));
        }
      }
    }

    // Check for process.env.PORT patterns
    if (/process\.env\.PORT/.test(content)) {
      ports.push(3000); // Default assumption
    }

    return [...new Set(ports)];
  }

  private extractRouteDefinitions(content: string): string[] {
    const routes: string[] = [];
    const routeMatches = content.match(
      /app\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g
    );

    if (routeMatches) {
      for (const match of routeMatches) {
        const routeMatch = match.match(/['"`]([^'"`]+)['"`]/);
        if (routeMatch) {
          routes.push(routeMatch[1]);
        }
      }
    }

    return routes;
  }

  private detectTestPatterns(content: string): boolean {
    return /(?:describe|it|test|expect)\s*\(/.test(content);
  }

  private detectWebFramework(dependencies: Record<string, string>): string | undefined {
    for (const framework of NODE_WEB_FRAMEWORKS) {
      if (dependencies[framework]) {
        return framework;
      }
    }
    return undefined;
  }

  private detectFrontendFramework(dependencies: Record<string, string>): string | undefined {
    for (const framework of NODE_FRONTEND_FRAMEWORKS) {
      if (dependencies[framework]) {
        return framework;
      }
    }
    return undefined;
  }

  private detectBuildSystem(dependencies: Record<string, string>): string | undefined {
    for (const tool of NODE_BUILD_TOOLS) {
      if (dependencies[tool]) {
        return tool;
      }
    }
    return undefined;
  }

  private detectCliFramework(dependencies: Record<string, string> = {}): string | undefined {
    // Common CLI frameworks in order of preference
    const cliFrameworks = [
      'commander',
      'yargs',
      'inquirer',
      'chalk',
      '@oclif/core',
      'meow',
      'minimist',
      'arg',
    ];

    for (const framework of cliFrameworks) {
      if (dependencies[framework]) {
        return framework;
      }
    }
    return undefined;
  }

  private extractServicePort(packageData: PackageJsonData, allEvidence: Evidence[]): number {
    // Check source files for port bindings
    const sourceEvidence = allEvidence.filter(e => e.data.configType === 'source-file');
    for (const source of sourceEvidence) {
      const sourceData = source.data as unknown as SourceFileData;
      if (sourceData.portBindings?.length > 0) {
        return sourceData.portBindings[0];
      }
    }

    // Default based on framework
    const framework = this.detectWebFramework(packageData.dependencies);
    return framework === 'express' ? 3000 : 8080;
  }

  private extractEnvVars(allEvidence: Evidence[]): string[] {
    const envVars = new Set<string>();

    // Extract from source files
    const sourceEvidence = allEvidence.filter(e => e.data.configType === 'source-file');
    for (const source of sourceEvidence) {
      // This would require more sophisticated parsing
      // For now, add common patterns
      envVars.add('NODE_ENV');
      envVars.add('PORT');
    }

    return Array.from(envVars);
  }

  private extractServiceDependencies(packageData: PackageJsonData): any[] {
    const dependencies: any[] = [];

    for (const dep of Object.keys(packageData.dependencies)) {
      if (NODE_DATABASE_DRIVERS.includes(dep)) {
        dependencies.push({
          serviceName: dep,
          type: 'database',
          required: true,
        });
      }
    }

    return dependencies;
  }

  private extractEndpoints(allEvidence: Evidence[]): any[] {
    const endpoints: any[] = [];

    const sourceEvidence = allEvidence.filter(e => e.data.configType === 'source-file');
    for (const source of sourceEvidence) {
      for (const route of (source.data as any).routeDefinitions || []) {
        endpoints.push({
          method: 'GET', // Would need more sophisticated parsing
          path: route,
        });
      }
    }

    return endpoints;
  }

  private extractFrontendRoutes(allEvidence: Evidence[]): any[] {
    // This would require framework-specific route parsing
    return [];
  }

  private extractApiDependencies(allEvidence: Evidence[]): string[] {
    // This would require analysis of API calls in the code
    return [];
  }

  private extractPublicApi(allEvidence: Evidence[]): string[] {
    const api: string[] = [];

    const sourceEvidence = allEvidence.filter(e => e.data.hasExports);
    for (const source of sourceEvidence) {
      const fileName = path.basename(
        (source.data as any).filePath as string,
        path.extname((source.data as any).filePath as string)
      );
      api.push(fileName);
    }

    return api;
  }

  private calculateConfidence(evidence: Evidence[], baseConfidence: number): ConfidenceScore {
    const avgEvidence = evidence.reduce((sum, e) => sum + e.confidence, 0) / evidence.length;
    const overall = Math.min(0.95, baseConfidence * avgEvidence);

    return {
      overall,
      breakdown: {
        evidence: avgEvidence,
        base: baseConfidence,
      },
      factors: evidence.map(e => ({
        description: `Evidence from ${e.type}`,
        weight: e.confidence,
        source: e.source,
      })),
    };
  }

  private createProvenance(evidence: Evidence[]): Provenance {
    return {
      evidence: evidence.map(e => e.id),
      plugins: ['nodejs'],
      rules: ['package-json-analysis', 'source-file-analysis'],
      timestamp: Date.now(),
      pipelineVersion: '1.0.0',
    };
  }
}

// Export the plugin instance
export const nodejsPlugin = new NodeJSPlugin();
