/**
 * Node.js Plugin for Brownfield Detection
 *
 * Comprehensive plugin for detecting Node.js artifacts including services,
 * libraries, CLIs, and frontends. Analyzes package.json, source files, and
 * dependency patterns to infer application architecture.
 */

import * as path from "path";
import {
  BinaryArtifact,
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
} from "../types.js";

// ============================================================================
// Node.js Framework and Library Detection
// ============================================================================

const NODE_WEB_FRAMEWORKS = [
  "express",
  "fastify",
  "koa",
  "hapi",
  "nest",
  "adonis",
  "meteor",
  "sails",
  "loopback",
  "restify",
];

const NODE_FRONTEND_FRAMEWORKS = [
  "react",
  "vue",
  "angular",
  "svelte",
  "solid-js",
  "preact",
  "lit",
  "stimulus",
];

const NODE_BUILD_TOOLS = [
  "webpack",
  "vite",
  "rollup",
  "parcel",
  "esbuild",
  "snowpack",
  "turbopack",
];

const NODE_TESTING_FRAMEWORKS = [
  "jest",
  "mocha",
  "vitest",
  "cypress",
  "playwright",
  "puppeteer",
  "testing-library",
];

const NODE_DATABASE_DRIVERS = [
  "mongoose",
  "sequelize",
  "typeorm",
  "prisma",
  "pg",
  "mysql",
  "redis",
  "mongodb",
  "sqlite3",
  "better-sqlite3",
];

const NODE_CLI_FRAMEWORKS = [
  "commander",
  "yargs",
  "inquirer",
  "ora",
  "chalk",
  "boxen",
  "cli-table3",
];

// ============================================================================
// Types for structured evidence data
// ============================================================================

interface PackageJsonData extends Record<string, unknown> {
  configType: string;
  name: string;
  version?: string;
  description?: string;
  main?: string;
  type?: "module" | "commonjs";
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
    return "nodejs";
  }

  supports(filePath: string, fileContent?: string): boolean {
    const fileName = path.basename(filePath);
    const extension = path.extname(filePath);

    // Support package.json files
    if (fileName === "package.json") {
      return true;
    }

    // Support JavaScript/TypeScript files
    if ([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"].includes(extension)) {
      return true;
    }

    // Support lock files
    if (["package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb"].includes(fileName)) {
      return true;
    }

    return false;
  }

  async parse(filePath: string, fileContent?: string, context?: ParseContext): Promise<Evidence[]> {
    if (!fileContent) return [];

    const evidence: Evidence[] = [];
    const fileName = path.basename(filePath);
    const baseId = `nodejs-${path.relative(context?.projectRoot || "", filePath)}`;

    try {
      if (fileName === "package.json") {
        evidence.push(...(await this.parsePackageJson(filePath, fileContent, baseId)));
      } else if (
        fileName === "package-lock.json" ||
        fileName === "yarn.lock" ||
        fileName === "pnpm-lock.yaml"
      ) {
        evidence.push(...(await this.parseLockFile(filePath, fileContent, baseId)));
      } else if ([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"].includes(path.extname(filePath))) {
        evidence.push(...(await this.parseSourceFile(filePath, fileContent, baseId)));
      }
    } catch (error) {
      console.warn(`Node.js plugin failed to parse ${filePath}:`, error);
    }

    return evidence;
  }

  async infer(evidence: Evidence[], context: InferenceContext): Promise<InferredArtifact[]> {
    const nodeEvidence = evidence.filter((e) => e.source === "nodejs");
    if (nodeEvidence.length === 0) return [];

    const artifacts: InferredArtifact[] = [];

    try {
      // Infer from package.json evidence
      const packageEvidence = nodeEvidence.filter(
        (e) => e.type === "config" && e.data.configType === "package-json",
      );
      for (const pkg of packageEvidence) {
        artifacts.push(...(await this.inferFromPackageJson(pkg, nodeEvidence, context)));
      }
    } catch (error) {
      console.warn("Node.js plugin inference failed:", error);
    }

    return artifacts;
  }

  // ============================================================================
  // Private parsing methods
  // ============================================================================

  private async parsePackageJson(
    filePath: string,
    content: string,
    baseId: string,
  ): Promise<Evidence[]> {
    const evidence: Evidence[] = [];

    try {
      const pkg = JSON.parse(content);

      const packageData: PackageJsonData = {
        configType: "package-json",
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
        source: "nodejs",
        type: "config",
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
        (pkg.scripts as Record<string, string>) || {},
      )) {
        evidence.push({
          id: `${baseId}-script-${scriptName}`,
          source: "nodejs",
          type: "build",
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
          source: "nodejs",
          type: "dependency",
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
      console.warn("Failed to parse package.json:", error);
    }

    return evidence;
  }

  private async parseLockFile(
    filePath: string,
    content: string,
    baseId: string,
  ): Promise<Evidence[]> {
    const evidence: Evidence[] = [];
    const fileName = path.basename(filePath);

    // Basic lock file analysis - track that dependencies are locked
    evidence.push({
      id: `${baseId}-lockfile`,
      source: "nodejs",
      type: "dependency",
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
    baseId: string,
  ): Promise<Evidence[]> {
    const evidence: Evidence[] = [];
    const fileName = path.basename(filePath);

    // Detect imports/exports
    const hasImports = /(?:import\s+|require\s*\(|from\s+['"])/m.test(content);
    const hasExports = /(?:export\s+|module\.exports\s*=|exports\.[a-zA-Z])/m.test(content);

    // Detect if this is likely an entry point
    const isEntryPoint =
      fileName === "index.js" ||
      fileName === "index.ts" ||
      fileName === "main.js" ||
      fileName === "main.ts" ||
      fileName === "app.js" ||
      fileName === "app.ts" ||
      fileName === "server.js" ||
      fileName === "server.ts" ||
      content.includes("process.argv") ||
      content.includes("app.listen") ||
      content.includes("server.listen");

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
      configType: "source-file",
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
      source: "nodejs",
      type: isEntryPoint ? "function" : hasExports ? "export" : "import",
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
    context: InferenceContext,
  ): Promise<InferredArtifact[]> {
    const artifacts: InferredArtifact[] = [];
    const packageData = packageEvidence.data as unknown as PackageJsonData;

    // Determine primary artifact type based on analysis
    const artifactType = this.determineArtifactType(packageData, allEvidence);

    switch (artifactType) {
      case "service":
        artifacts.push(...(await this.createServiceArtifact(packageData, allEvidence)));
        break;
      case "frontend":
        artifacts.push(...(await this.createFrontendArtifact(packageData, allEvidence)));
        break;
      case "binary":
        artifacts.push(...(await this.createBinaryArtifact(packageData, allEvidence)));
        break;
      case "library":
        artifacts.push(...(await this.createLibraryArtifact(packageData, allEvidence)));
        break;
    }

    return artifacts;
  }

  private determineArtifactType(packageData: PackageJsonData, allEvidence: Evidence[]): string {
    // Check for binary/CLI
    if (packageData.bin) {
      return "binary";
    }

    // Check for web frameworks (service)
    const hasWebFramework = Object.keys(packageData.dependencies).some((dep) =>
      NODE_WEB_FRAMEWORKS.includes(dep),
    );
    if (hasWebFramework) {
      return "service";
    }

    // Check for frontend frameworks
    const hasFrontendFramework = Object.keys(packageData.dependencies).some((dep) =>
      NODE_FRONTEND_FRAMEWORKS.includes(dep),
    );
    if (hasFrontendFramework) {
      return "frontend";
    }

    // Check for private flag (likely application)
    if (packageData.private) {
      // Check source files for server patterns
      const sourceEvidence = allEvidence.filter((e) => e.data.configType === "source-file");
      const hasServerPatterns = sourceEvidence.some((e) => {
        const sourceData = e.data as unknown as SourceFileData;
        return sourceData.serverPatterns?.length > 0 || sourceData.portBindings?.length > 0;
      });

      if (hasServerPatterns) {
        return "service";
      }

      return "frontend"; // Default for private packages
    }

    // Default to library for public packages
    return "library";
  }

  private async createServiceArtifact(
    packageData: PackageJsonData,
    allEvidence: Evidence[],
  ): Promise<InferredArtifact[]> {
    const framework = this.detectWebFramework(packageData.dependencies);
    const port = this.extractServicePort(packageData, allEvidence);

    const serviceArtifact: ServiceArtifact = {
      id: `nodejs-service-${packageData.name}`,
      type: "service",
      name: packageData.name,
      description: packageData.description || `Node.js service: ${packageData.name}`,
      tags: ["nodejs", "service", framework].filter(Boolean),
      metadata: {
        language: "javascript",
        framework,
        port,
        basePath: "/",
        environmentVariables: this.extractEnvVars(allEvidence),
        dependencies: this.extractServiceDependencies(packageData),
        endpoints: this.extractEndpoints(allEvidence),
        healthCheck: {
          path: "/health",
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
    allEvidence: Evidence[],
  ): Promise<InferredArtifact[]> {
    const framework = this.detectFrontendFramework(packageData.dependencies);
    const buildSystem = this.detectBuildSystem(packageData.dependencies);

    const frontendArtifact: FrontendArtifact = {
      id: `nodejs-frontend-${packageData.name}`,
      type: "frontend",
      name: packageData.name,
      description: packageData.description || `Node.js frontend: ${packageData.name}`,
      tags: ["nodejs", "frontend", framework].filter(Boolean),
      metadata: {
        framework,
        buildSystem,
        routes: this.extractFrontendRoutes(allEvidence),
        apiDependencies: this.extractApiDependencies(allEvidence),
        environmentVariables: this.extractEnvVars(allEvidence),
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

  private async createBinaryArtifact(
    packageData: PackageJsonData,
    allEvidence: Evidence[],
  ): Promise<InferredArtifact[]> {
    const binEntries =
      typeof packageData.bin === "string"
        ? { [packageData.name]: packageData.bin }
        : packageData.bin || {};

    const artifacts: InferredArtifact[] = [];

    for (const [binName, binPath] of Object.entries(binEntries)) {
      const binaryArtifact: BinaryArtifact = {
        id: `nodejs-binary-${binName}`,
        type: "binary",
        name: binName,
        description: `Node.js CLI tool: ${binName}`,
        tags: ["nodejs", "cli", "binary"],
        metadata: {
          language: "javascript",
          buildSystem: "npm",
          entryPoint: binPath,
          arguments: [],
          environmentVariables: this.extractEnvVars(allEvidence),
          dependencies: Object.keys(packageData.dependencies),
        },
      };

      artifacts.push({
        artifact: binaryArtifact,
        confidence: this.calculateConfidence([...allEvidence], 0.9),
        provenance: this.createProvenance([...allEvidence]),
        relationships: [],
      });
    }

    return artifacts;
  }

  private async createLibraryArtifact(
    packageData: PackageJsonData,
    allEvidence: Evidence[],
  ): Promise<InferredArtifact[]> {
    const libraryArtifact: LibraryArtifact = {
      id: `nodejs-library-${packageData.name}`,
      type: "library",
      name: packageData.name,
      description: packageData.description || `Node.js library: ${packageData.name}`,
      tags: ["nodejs", "library"],
      metadata: {
        language: "javascript",
        packageManager: "npm",
        publicApi: this.extractPublicApi(allEvidence),
        dependencies: Object.keys(packageData.dependencies),
        version: packageData.version,
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
    if (name === "start" || command.includes("node")) return "start";
    if (name === "build" || command.includes("build")) return "build";
    if (name === "test" || command.includes("test")) return "test";
    if (name === "dev" || name === "develop") return "dev";
    if (name === "lint") return "lint";
    return "other";
  }

  private classifyFramework(depName: string): string | undefined {
    if (NODE_WEB_FRAMEWORKS.includes(depName)) return "web";
    if (NODE_FRONTEND_FRAMEWORKS.includes(depName)) return "frontend";
    if (NODE_BUILD_TOOLS.includes(depName)) return "build";
    if (NODE_TESTING_FRAMEWORKS.includes(depName)) return "test";
    if (NODE_DATABASE_DRIVERS.includes(depName)) return "database";
    if (NODE_CLI_FRAMEWORKS.includes(depName)) return "cli";
    return undefined;
  }

  private detectFrameworkUsage(content: string): string[] {
    const frameworks: string[] = [];

    const patterns = [
      { pattern: /import\s+.*?\s+from\s+['"]express['"]/, framework: "express" },
      { pattern: /import\s+.*?\s+from\s+['"]fastify['"]/, framework: "fastify" },
      { pattern: /import\s+.*?\s+from\s+['"]react['"]/, framework: "react" },
      { pattern: /import\s+.*?\s+from\s+['"]vue['"]/, framework: "vue" },
      { pattern: /require\s*\(\s*['"]express['"]\s*\)/, framework: "express" },
      { pattern: /require\s*\(\s*['"]fastify['"]\s*\)/, framework: "fastify" },
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

    if (/app\.listen|server\.listen/.test(content)) patterns.push("http-server");
    if (/express\(\)/.test(content)) patterns.push("express-app");
    if (/fastify\(\)/.test(content)) patterns.push("fastify-app");
    if (/http\.createServer/.test(content)) patterns.push("http-createserver");
    if (/https\.createServer/.test(content)) patterns.push("https-createserver");

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
      /app\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g,
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

  private detectWebFramework(dependencies: Record<string, string>): string {
    for (const framework of NODE_WEB_FRAMEWORKS) {
      if (dependencies[framework]) {
        return framework;
      }
    }
    return "unknown";
  }

  private detectFrontendFramework(dependencies: Record<string, string>): string {
    for (const framework of NODE_FRONTEND_FRAMEWORKS) {
      if (dependencies[framework]) {
        return framework;
      }
    }
    return "unknown";
  }

  private detectBuildSystem(dependencies: Record<string, string>): string | undefined {
    for (const tool of NODE_BUILD_TOOLS) {
      if (dependencies[tool]) {
        return tool;
      }
    }
    return undefined;
  }

  private extractServicePort(packageData: PackageJsonData, allEvidence: Evidence[]): number {
    // Check source files for port bindings
    const sourceEvidence = allEvidence.filter((e) => e.data.configType === "source-file");
    for (const source of sourceEvidence) {
      const sourceData = source.data as unknown as SourceFileData;
      if (sourceData.portBindings?.length > 0) {
        return sourceData.portBindings[0];
      }
    }

    // Default based on framework
    const framework = this.detectWebFramework(packageData.dependencies);
    return framework === "express" ? 3000 : 8080;
  }

  private extractEnvVars(allEvidence: Evidence[]): string[] {
    const envVars = new Set<string>();

    // Extract from source files
    const sourceEvidence = allEvidence.filter((e) => e.data.configType === "source-file");
    for (const source of sourceEvidence) {
      // This would require more sophisticated parsing
      // For now, add common patterns
      envVars.add("NODE_ENV");
      envVars.add("PORT");
    }

    return Array.from(envVars);
  }

  private extractServiceDependencies(packageData: PackageJsonData): any[] {
    const dependencies: any[] = [];

    for (const dep of Object.keys(packageData.dependencies)) {
      if (NODE_DATABASE_DRIVERS.includes(dep)) {
        dependencies.push({
          serviceName: dep,
          type: "database",
          required: true,
        });
      }
    }

    return dependencies;
  }

  private extractEndpoints(allEvidence: Evidence[]): any[] {
    const endpoints: any[] = [];

    const sourceEvidence = allEvidence.filter((e) => e.data.configType === "source-file");
    for (const source of sourceEvidence) {
      for (const route of (source.data as any).routeDefinitions || []) {
        endpoints.push({
          method: "GET", // Would need more sophisticated parsing
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

    const sourceEvidence = allEvidence.filter((e) => e.data.hasExports);
    for (const source of sourceEvidence) {
      const fileName = path.basename(
        (source.data as any).filePath as string,
        path.extname((source.data as any).filePath as string),
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
      factors: evidence.map((e) => ({
        description: `Evidence from ${e.type}`,
        weight: e.confidence,
        source: e.source,
      })),
    };
  }

  private createProvenance(evidence: Evidence[]): Provenance {
    return {
      evidence: evidence.map((e) => e.id),
      plugins: ["nodejs"],
      rules: ["package-json-analysis", "source-file-analysis"],
      timestamp: Date.now(),
      pipelineVersion: "1.0.0",
    };
  }
}

// Export the plugin instance
export const nodejsPlugin = new NodeJSPlugin();
