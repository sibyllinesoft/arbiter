/**
 * Enhanced Project Onboarding System for Arbiter
 *
 * This command provides intelligent analysis and smooth migration of existing projects
 * into the Arbiter ecosystem with minimal friction and maximum safety.
 */

import path from 'node:path';
import chalk from 'chalk';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import type { CLIConfig } from '../types.js';
import { withProgress } from '../utils/progress.js';
import { syncCommand } from './sync.js';

interface OnboardOptions {
  projectPath?: string;
  dryRun?: boolean;
  force?: boolean;
  verbose?: boolean;
  skipAnalysis?: boolean;
  interactive?: boolean;
}

interface ProjectStructure {
  root: string;
  files: string[];
  directories: string[];
  hasFile: (filename: string) => boolean;
  hasDirectory: (dirname: string) => boolean;
  hasPackage: (packageName: string) => boolean;
  hasPattern: (pattern: RegExp) => boolean;
}

interface ServiceDetection {
  name: string;
  type: 'api' | 'frontend' | 'worker' | 'database' | 'cache' | 'message-queue' | 'unknown';
  language: string;
  framework?: string;
  port?: number;
  configFiles: string[];
  dependencies: string[];
  confidence: number;
}

interface ProjectAnalysis {
  projectType: 'monorepo' | 'single-service' | 'multi-service' | 'library' | 'unknown';
  languages: string[];
  frameworks: string[];
  services: ServiceDetection[];
  databases: string[];
  infrastructure: string[];
  buildSystem: string[];
  testFrameworks: string[];
  configFiles: string[];
  environmentFiles: string[];
  packageManagers: string[];
}

interface OnboardingPlan {
  analysis: ProjectAnalysis;
  recommendations: string[];
  migrationSteps: MigrationStep[];
  arbiterStructure: ArbiterStructure;
  estimatedTime: string;
  riskLevel: 'low' | 'medium' | 'high';
}

interface MigrationStep {
  id: string;
  title: string;
  description: string;
  type: 'analysis' | 'setup' | 'generation' | 'validation' | 'cleanup';
  required: boolean;
  estimatedTime: string;
  dependencies: string[];
}

interface ArbiterStructure {
  directories: string[];
  configFiles: { path: string; content: string }[];
  templates: { name: string; content: string }[];
  profiles: string[];
}

/**
 * Create project structure analyzer
 */
async function analyzeProjectStructure(projectPath: string): Promise<ProjectStructure> {
  const files: string[] = [];
  const directories: string[] = [];

  async function scanDirectory(dirPath: string, relativePath = ''): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativeEntryPath = path.join(relativePath, entry.name);

      // Skip node_modules, .git, and other common ignore patterns
      if (
        ['.git', 'node_modules', '.DS_Store', '__pycache__', 'target', 'dist', 'build'].some(
          ignore => entry.name.startsWith(ignore) || relativeEntryPath.includes(ignore)
        )
      ) {
        continue;
      }

      if (entry.isDirectory()) {
        directories.push(relativeEntryPath);
        await scanDirectory(fullPath, relativeEntryPath);
      } else {
        files.push(relativeEntryPath);
      }
    }
  }

  await scanDirectory(projectPath);

  return {
    root: projectPath,
    files,
    directories,
    hasFile: (filename: string) => files.includes(filename),
    hasDirectory: (dirname: string) => directories.includes(dirname),
    hasPackage: (packageName: string) => {
      // Check in package.json
      try {
        const pkgPath = path.join(projectPath, 'package.json');
        if (fs.existsSync(pkgPath)) {
          const pkg = fs.readJsonSync(pkgPath);
          return !!(pkg.dependencies?.[packageName] || pkg.devDependencies?.[packageName]);
        }
      } catch {}

      // Check in requirements.txt, Cargo.toml, etc.
      return files.some(
        file =>
          file.includes('requirements') &&
          fs.readFileSync(path.join(projectPath, file), 'utf-8').includes(packageName)
      );
    },
    hasPattern: (pattern: RegExp) => files.some(file => pattern.test(file)),
  };
}

/**
 * Docker Compose service parsers - pluggable and graceful
 */
const DOCKER_COMPOSE_PARSERS = {
  postgres: {
    detect: (content: string) => content.includes('postgres'),
    parse: () => ({
      name: 'postgres',
      type: 'database' as const,
      language: 'container',
      framework: 'postgres',
      port: 5432,
    }),
  },
  redis: {
    detect: (content: string) => content.includes('redis'),
    parse: () => ({
      name: 'redis',
      type: 'cache' as const,
      language: 'container',
      framework: 'redis',
      port: 6379,
    }),
  },
  kafka: {
    detect: (content: string) => content.includes('kafka') || content.includes('cp-kafka'),
    parse: () => ({
      name: 'kafka',
      type: 'message-queue' as const,
      language: 'container',
      framework: 'kafka',
      port: 9092,
    }),
  },
  zookeeper: {
    detect: (content: string) => content.includes('zookeeper') || content.includes('cp-zookeeper'),
    parse: () => ({
      name: 'zookeeper',
      type: 'message-queue' as const,
      language: 'container',
      framework: 'zookeeper',
      port: 2181,
    }),
  },
  opensearch: {
    detect: (content: string) => content.includes('opensearch'),
    parse: () => ({
      name: 'opensearch',
      type: 'database' as const,
      language: 'container',
      framework: 'opensearch',
      port: 9200,
    }),
  },
  elasticsearch: {
    detect: (content: string) => content.includes('elasticsearch'),
    parse: () => ({
      name: 'elasticsearch',
      type: 'database' as const,
      language: 'container',
      framework: 'elasticsearch',
      port: 9200,
    }),
  },
  prometheus: {
    detect: (content: string) => content.includes('prometheus'),
    parse: () => ({
      name: 'prometheus',
      type: 'unknown' as const,
      language: 'container',
      framework: 'prometheus',
      port: 9090,
    }),
  },
  grafana: {
    detect: (content: string) => content.includes('grafana'),
    parse: () => ({
      name: 'grafana',
      type: 'unknown' as const,
      language: 'container',
      framework: 'grafana',
      port: 3000,
    }),
  },
  mongodb: {
    detect: (content: string) => content.includes('mongo'),
    parse: () => ({
      name: 'mongodb',
      type: 'database' as const,
      language: 'container',
      framework: 'mongodb',
      port: 27017,
    }),
  },
  mysql: {
    detect: (content: string) => content.includes('mysql'),
    parse: () => ({
      name: 'mysql',
      type: 'database' as const,
      language: 'container',
      framework: 'mysql',
      port: 3306,
    }),
  },
};

/**
 * Service detection plugins - pluggable architecture
 */
interface ServiceDetector {
  name: string;
  detect: (structure: ProjectStructure) => Promise<ServiceDetection[]>;
}

/**
 * Service type classifiers - pluggable type detection
 */
interface ServiceTypeClassifier {
  name: string;
  classify: (
    serviceName: string,
    context: { language: string; framework?: string; files?: string[] }
  ) => {
    type: ServiceDetection['type'];
    port?: number;
  };
}

const SERVICE_TYPE_CLASSIFIERS: ServiceTypeClassifier[] = [
  {
    name: 'go-service-classifier',
    classify: (serviceName: string, context: { language: string; framework?: string }) => {
      if (context.language !== 'go') return { type: 'api', port: 8080 };

      // CLI tools and utilities
      if (
        serviceName.includes('cli') ||
        serviceName.includes('tool') ||
        serviceName.includes('cmd') ||
        context.framework === 'cobra'
      ) {
        return { type: 'unknown' }; // No port for CLI tools
      }

      // Background workers and processors
      if (
        serviceName.includes('worker') ||
        serviceName.includes('processor') ||
        serviceName.includes('consumer')
      ) {
        return { type: 'worker' };
      }

      // Test utilities, simulators, analyzers
      if (
        serviceName.includes('simulator') ||
        serviceName.includes('test') ||
        serviceName.includes('analyzer')
      ) {
        return { type: 'unknown' };
      }

      // Default to API service
      return { type: 'api', port: 8080 };
    },
  },

  {
    name: 'rust-service-classifier',
    classify: (serviceName: string, context: { language: string }) => {
      if (context.language !== 'rust') return { type: 'api', port: 3000 };

      // CLI tools
      if (
        serviceName.includes('cli') ||
        serviceName.endsWith('-cli') ||
        serviceName.includes('tool')
      ) {
        return { type: 'unknown' };
      }

      // Background workers
      if (serviceName.includes('worker') || serviceName.includes('processor')) {
        return { type: 'worker' };
      }

      // Web frontends
      if (serviceName.includes('web') || serviceName.includes('frontend')) {
        return { type: 'frontend', port: 8080 };
      }

      // Search and indexing services
      if (
        serviceName.includes('search') ||
        serviceName.includes('index') ||
        serviceName.includes('query')
      ) {
        return { type: 'api', port: 3000 };
      }

      // Default to API service
      return { type: 'api', port: 3000 };
    },
  },

  {
    name: 'nodejs-service-classifier',
    classify: (serviceName: string, context: { language: string }) => {
      if (context.language !== 'typescript' && context.language !== 'javascript') {
        return { type: 'api', port: 3000 };
      }

      // CLI tools
      if (serviceName.includes('cli') || serviceName.includes('tool')) {
        return { type: 'unknown' };
      }

      // Workers
      if (serviceName.includes('worker') || serviceName.includes('processor')) {
        return { type: 'worker' };
      }

      // Default based on common patterns
      return { type: 'api', port: 3000 };
    },
  },
];

/**
 * Framework detection plugins - pluggable framework detection
 */
interface FrameworkDetector {
  name: string;
  detect: (structure: ProjectStructure, language: string) => Promise<string | null>;
}

const FRAMEWORK_DETECTORS: FrameworkDetector[] = [
  {
    name: 'go-framework-detector',
    detect: async (structure: ProjectStructure, language: string) => {
      if (language !== 'go' || !structure.hasFile('go.mod')) return null;

      try {
        const goMod = await fs.readFile(path.join(structure.root, 'go.mod'), 'utf-8');

        if (goMod.includes('gin-gonic/gin')) return 'gin';
        if (goMod.includes('gofiber/fiber')) return 'fiber';
        if (goMod.includes('gorilla/mux')) return 'gorilla-mux';
        if (goMod.includes('labstack/echo')) return 'echo';
        if (goMod.includes('spf13/cobra')) return 'cobra';

        return 'go'; // Default Go framework
      } catch {
        return 'go';
      }
    },
  },

  {
    name: 'rust-framework-detector',
    detect: async (structure: ProjectStructure, language: string) => {
      if (language !== 'rust' || !structure.hasFile('Cargo.toml')) return null;

      try {
        const cargoToml = await fs.readFile(path.join(structure.root, 'Cargo.toml'), 'utf-8');

        if (cargoToml.includes('axum')) return 'axum';
        if (cargoToml.includes('actix-web')) return 'actix-web';
        if (cargoToml.includes('warp')) return 'warp';
        if (cargoToml.includes('yew')) return 'yew';

        return 'axum'; // Default Rust framework
      } catch {
        return 'axum';
      }
    },
  },
];

/**
 * Classify service using pluggable classifiers
 */
function classifyService(
  serviceName: string,
  language: string,
  framework?: string
): { type: ServiceDetection['type']; port?: number } {
  for (const classifier of SERVICE_TYPE_CLASSIFIERS) {
    const result = classifier.classify(serviceName, { language, framework });
    if (result.type !== 'api' || classifier.name.includes(language)) {
      return result;
    }
  }

  // Default fallback
  return { type: 'api', port: language === 'go' ? 8080 : 3000 };
}

/**
 * Detect framework using pluggable detectors
 */
async function detectFramework(structure: ProjectStructure, language: string): Promise<string> {
  for (const detector of FRAMEWORK_DETECTORS) {
    const framework = await detector.detect(structure, language);
    if (framework) return framework;
  }

  // Language defaults
  switch (language) {
    case 'go':
      return 'go';
    case 'rust':
      return 'axum';
    case 'typescript':
    case 'javascript':
      return 'node';
    default:
      return language;
  }
}

const SERVICE_DETECTORS: ServiceDetector[] = [
  {
    name: 'nodejs',
    detect: async (structure: ProjectStructure) => {
      if (!structure.hasFile('package.json')) return [];

      const services: ServiceDetection[] = [];
      try {
        const pkg = await fs.readJson(path.join(structure.root, 'package.json'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };

        // API Framework Detection
        let apiFramework = null;
        let confidence = 0;

        if (deps.express) {
          apiFramework = 'express';
          confidence = 0.9;
        } else if (deps.fastify) {
          apiFramework = 'fastify';
          confidence = 0.9;
        } else if (deps.koa) {
          apiFramework = 'koa';
          confidence = 0.85;
        } else if (deps.hapi) {
          apiFramework = 'hapi';
          confidence = 0.85;
        } else if (
          pkg.scripts?.start &&
          (pkg.scripts.start.includes('server') || pkg.scripts.dev?.includes('server'))
        ) {
          // Detect server from scripts
          apiFramework = 'unknown';
          confidence = 0.7;
        }

        if (apiFramework) {
          services.push({
            name: pkg.name || 'api',
            type: 'api',
            language: 'typescript',
            framework: apiFramework,
            configFiles: ['package.json'],
            dependencies: Object.keys(deps),
            confidence,
          });
        }

        // Frontend Detection
        if (deps.next) {
          services.push({
            name: pkg.name || 'frontend',
            type: 'frontend',
            language: 'typescript',
            framework: 'nextjs',
            port: 3000,
            configFiles: ['package.json', 'next.config.js'].filter(f => structure.hasFile(f)),
            dependencies: Object.keys(deps),
            confidence: 0.95,
          });
        } else if (deps.react) {
          services.push({
            name: pkg.name || 'frontend',
            type: 'frontend',
            language: 'typescript',
            framework: 'react',
            port: 3000,
            configFiles: ['package.json', 'vite.config.ts', 'webpack.config.js'].filter(f =>
              structure.hasFile(f)
            ),
            dependencies: Object.keys(deps),
            confidence: 0.85,
          });
        } else if (deps.vue) {
          services.push({
            name: pkg.name || 'frontend',
            type: 'frontend',
            language: 'typescript',
            framework: 'vue',
            port: 3000,
            configFiles: ['package.json', 'vite.config.ts', 'vue.config.js'].filter(f =>
              structure.hasFile(f)
            ),
            dependencies: Object.keys(deps),
            confidence: 0.85,
          });
        }
      } catch (error) {
        console.warn(`Could not read package.json: ${error}`);
      }
      return services;
    },
  },

  {
    name: 'python',
    detect: async (structure: ProjectStructure) => {
      if (!structure.hasFile('requirements.txt') && !structure.hasFile('pyproject.toml')) return [];

      let framework = 'unknown';
      let confidence = 0.7;

      // FastAPI
      if (structure.hasPackage('fastapi')) {
        framework = 'fastapi';
        confidence = 0.9;
      }
      // Django
      else if (structure.hasPackage('django')) {
        framework = 'django';
        confidence = 0.9;
      }
      // Flask
      else if (structure.hasPackage('flask')) {
        framework = 'flask';
        confidence = 0.85;
      }

      return [
        {
          name: path.basename(structure.root),
          type: 'api',
          language: 'python',
          framework,
          port: 8000,
          configFiles: ['requirements.txt', 'pyproject.toml'].filter(f => structure.hasFile(f)),
          dependencies: [],
          confidence,
        },
      ];
    },
  },

  {
    name: 'go',
    detect: async (structure: ProjectStructure) => {
      if (!structure.hasFile('go.mod')) return [];

      const services: ServiceDetection[] = [];
      try {
        const moduleName = path.basename(structure.root);
        const framework = await detectFramework(structure, 'go');

        // Find main.go files
        const mainFiles = structure.files.filter(f => f.endsWith('main.go'));
        const cmdMainFiles = mainFiles.filter(f => f.includes('cmd/'));

        if (cmdMainFiles.length > 0) {
          // Multiple commands/services - extract service names from cmd paths
          const cmdServices = new Map();

          for (const file of cmdMainFiles) {
            // Extract service name from path like "cmd/service-name/main.go"
            const match = file.match(/cmd\/([^/]+)\//);
            if (match) {
              const cmdName = match[1];
              cmdServices.set(cmdName, file);
            }
          }

          // Create a service for each unique cmd directory
          for (const [cmdName, file] of cmdServices) {
            const { type, port } = classifyService(cmdName, 'go', framework);

            services.push({
              name: cmdName,
              type,
              language: 'go',
              framework,
              port,
              configFiles: ['go.mod', file],
              dependencies: [],
              confidence: 0.85,
            });
          }
        } else if (mainFiles.length > 0) {
          // Single service with root main.go
          const { type, port } = classifyService(moduleName, 'go', framework);

          services.push({
            name: moduleName,
            type,
            language: 'go',
            framework,
            port,
            configFiles: ['go.mod', 'main.go'],
            dependencies: [],
            confidence: 0.8,
          });
        }
      } catch (error) {
        console.warn(`Could not read go.mod: ${error}`);
      }
      return services;
    },
  },

  {
    name: 'rust',
    detect: async (structure: ProjectStructure) => {
      if (!structure.hasFile('Cargo.toml')) return [];

      const services: ServiceDetection[] = [];
      try {
        const cargoToml = await fs.readFile(path.join(structure.root, 'Cargo.toml'), 'utf-8');
        const framework = await detectFramework(structure, 'rust');

        // Check if it's a workspace
        if (cargoToml.includes('[workspace]')) {
          const members = cargoToml.match(/members\s*=\s*\[([\s\S]*?)\]/)?.[1];
          if (members) {
            const membersList = members
              .split(',')
              .map(m => m.trim().replace(/['"]/g, ''))
              .filter(Boolean);

            for (const member of membersList) {
              const { type, port } = classifyService(member, 'rust', framework);

              services.push({
                name: member,
                type,
                language: 'rust',
                framework,
                port,
                configFiles: ['Cargo.toml', `${member}/Cargo.toml`],
                dependencies: [],
                confidence: 0.8,
              });
            }
          }
        } else {
          // Single Rust service
          const projectName = path.basename(structure.root);
          const { type, port } = classifyService(projectName, 'rust', framework);

          services.push({
            name: projectName,
            type,
            language: 'rust',
            framework,
            port,
            configFiles: ['Cargo.toml'],
            dependencies: [],
            confidence: 0.8,
          });
        }
      } catch (error) {
        console.warn(`Could not read Cargo.toml: ${error}`);
      }
      return services;
    },
  },

  {
    name: 'docker-compose',
    detect: async (structure: ProjectStructure) => {
      const composePath = structure.hasFile('docker-compose.yml')
        ? 'docker-compose.yml'
        : structure.hasFile('docker-compose.yaml')
          ? 'docker-compose.yaml'
          : null;

      if (!composePath) return [];

      const services: ServiceDetection[] = [];
      try {
        const composeContent = await fs.readFile(path.join(structure.root, composePath), 'utf-8');

        // Use pluggable parsers
        for (const [serviceName, parser] of Object.entries(DOCKER_COMPOSE_PARSERS)) {
          try {
            if (parser.detect(composeContent)) {
              const serviceConfig = parser.parse();
              services.push({
                ...serviceConfig,
                configFiles: [composePath],
                dependencies: [],
                confidence: 0.95,
              });
            }
          } catch (error) {
            console.warn(`Failed to parse ${serviceName} from docker-compose: ${error}`);
            // Continue with other parsers
          }
        }
      } catch (error) {
        console.warn(`Could not read docker-compose file: ${error}`);
      }
      return services;
    },
  },
];

/**
 * Intelligent service detection with confidence scoring
 */
async function detectServices(structure: ProjectStructure): Promise<ServiceDetection[]> {
  const allServices: ServiceDetection[] = [];

  // Run all detectors in parallel
  const detectionResults = await Promise.all(
    SERVICE_DETECTORS.map(async detector => {
      try {
        const result = await detector.detect(structure);
        return result;
      } catch (error) {
        console.warn(`Detector ${detector.name} failed: ${error}`);
        return [];
      }
    })
  );

  // Flatten results
  detectionResults.forEach(services => allServices.push(...services));

  return allServices.filter(service => service.confidence > 0.5);
}

/**
 * Comprehensive project analysis
 */
async function analyzeProject(structure: ProjectStructure): Promise<ProjectAnalysis> {
  const services = await detectServices(structure);

  // Detect languages
  const languages = new Set<string>();
  if (structure.hasFile('package.json')) languages.add('typescript');
  if (structure.hasFile('requirements.txt') || structure.hasFile('pyproject.toml'))
    languages.add('python');
  if (structure.hasFile('Cargo.toml')) languages.add('rust');
  if (structure.hasFile('go.mod')) languages.add('go');
  if (structure.hasPattern(/\.java$/)) languages.add('java');

  // Detect project type
  let projectType: ProjectAnalysis['projectType'] = 'unknown';
  if (services.length === 0) projectType = 'library';
  else if (services.length === 1) projectType = 'single-service';
  else if (services.length > 1) {
    // Check for monorepo indicators
    if (
      structure.hasFile('lerna.json') ||
      structure.hasFile('pnpm-workspace.yaml') ||
      structure.hasDirectory('packages') ||
      structure.hasDirectory('apps')
    ) {
      projectType = 'monorepo';
    } else {
      projectType = 'multi-service';
    }
  }

  // Detect frameworks
  const frameworks = [...new Set(services.map(s => s.framework).filter(Boolean))];

  return {
    projectType,
    languages: Array.from(languages),
    frameworks,
    services,
    databases: services.filter(s => s.type === 'database').map(s => s.name),
    infrastructure: services
      .filter(s => ['database', 'cache', 'message-queue'].includes(s.type))
      .map(s => s.name),
    buildSystem: [],
    testFrameworks: [],
    configFiles: structure.files.filter(
      f => f.endsWith('.json') || f.endsWith('.toml') || f.endsWith('.yaml') || f.endsWith('.yml')
    ),
    environmentFiles: structure.files.filter(f => f.startsWith('.env')),
    packageManagers: [],
  };
}

/**
 * Create migration plan based on analysis
 */
function createMigrationPlan(analysis: ProjectAnalysis): OnboardingPlan {
  const steps: MigrationStep[] = [
    {
      id: 'analyze',
      title: 'Project Analysis',
      description: 'Analyze existing project structure and services',
      type: 'analysis',
      required: true,
      estimatedTime: '30 seconds',
      dependencies: [],
    },
    {
      id: 'setup-arbiter',
      title: 'Setup .arbiter Directory',
      description: 'Create .arbiter directory structure with configuration',
      type: 'setup',
      required: true,
      estimatedTime: '10 seconds',
      dependencies: ['analyze'],
    },
    {
      id: 'generate-specs',
      title: 'Generate CUE Specifications',
      description: 'Create initial CUE specifications from detected services',
      type: 'generation',
      required: true,
      estimatedTime: '20 seconds',
      dependencies: ['setup-arbiter'],
    },
    {
      id: 'sync-manifests',
      title: 'Sync Manifest Files',
      description: 'Update package.json, pyproject.toml, etc. with Arbiter integration',
      type: 'generation',
      required: false,
      estimatedTime: '15 seconds',
      dependencies: ['generate-specs'],
    },
    {
      id: 'validate',
      title: 'Validate Configuration',
      description: 'Ensure generated CUE specifications are valid',
      type: 'validation',
      required: true,
      estimatedTime: '10 seconds',
      dependencies: ['generate-specs'],
    },
  ];

  const recommendations = [
    `Detected ${analysis.services.length} service(s) in ${analysis.languages.join(', ')}`,
    'Consider using templates for consistent service configuration',
    'Set up CI/CD integration for automated validation',
  ];

  // Calculate risk level
  let riskLevel: OnboardingPlan['riskLevel'] = 'low';
  if (analysis.services.length > 5) riskLevel = 'medium';
  if (analysis.projectType === 'monorepo' && analysis.services.length > 10) riskLevel = 'high';

  return {
    analysis,
    recommendations,
    migrationSteps: steps,
    arbiterStructure: {
      directories: ['.arbiter', '.arbiter/profiles', '.arbiter/templates', '.arbiter/config'],
      configFiles: [],
      templates: [],
      profiles: [],
    },
    estimatedTime: '2-5 minutes',
    riskLevel,
  };
}

/**
 * Setup .arbiter directory structure
 */
async function setupArbiterDirectory(
  projectPath: string,
  analysis: ProjectAnalysis,
  dryRun: boolean
): Promise<void> {
  const arbiterPath = path.join(projectPath, '.arbiter');

  if (!dryRun) {
    await fs.ensureDir(arbiterPath);
    await fs.ensureDir(path.join(arbiterPath, 'profiles'));
    await fs.ensureDir(path.join(arbiterPath, 'templates'));
    await fs.ensureDir(path.join(arbiterPath, 'config'));
  }

  // Create .arbiterignore
  const arbiterIgnore = `
# Arbiter ignore patterns
*.log
*.tmp
.env.local
.env.*.local
node_modules/
__pycache__/
target/
*.pyc
`.trim();

  if (!dryRun) {
    await fs.writeFile(path.join(arbiterPath, '.arbiterignore'), arbiterIgnore);
  }

  // Create config.json
  const config = {
    version: '1.0.0',
    project: {
      name: path.basename(projectPath),
      type: analysis.projectType,
      languages: analysis.languages,
    },
    services: analysis.services.map(s => ({
      name: s.name,
      type: s.type,
      language: s.language,
      framework: s.framework,
    })),
    onboarded: new Date().toISOString(),
  };

  if (!dryRun) {
    await fs.writeJson(path.join(arbiterPath, 'config.json'), config, { spaces: 2 });
  }

  console.log(chalk.green('✅ Created .arbiter directory structure'));
}

/**
 * Generate initial CUE specification
 */
async function generateInitialSpec(
  projectPath: string,
  analysis: ProjectAnalysis,
  dryRun: boolean
): Promise<void> {
  const specPath = path.join(projectPath, 'arbiter.assembly.cue');

  // Generate package name from project path
  const packageName =
    path
      .basename(projectPath)
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase() || 'project';

  let cueContent = `package ${packageName}\n\n`;

  // Add basic structure
  cueContent += '{\n';
  cueContent += '\tproduct: {\n';
  cueContent += `\t\tname: "${path.basename(projectPath)}"\n`;
  cueContent += '\t\tgoals: [\n';
  cueContent += `\t\t\t"Generated from existing project structure",\n`;
  cueContent += '\t\t]\n';
  cueContent += '\t}\n';

  cueContent += '\tui: {\n';
  cueContent += '\t\troutes: [\n';

  // Add routes for frontend services
  const frontendServices = analysis.services.filter(s => s.type === 'frontend');
  for (const service of frontendServices) {
    cueContent += '\t\t\t{\n';
    cueContent += `\t\t\t\tid:   "${service.name}:main"\n`;
    cueContent += `\t\t\t\tpath: "/"\n`;
    cueContent += '\t\t\t\tcapabilities: [\n';
    cueContent += `\t\t\t\t\t"view",\n`;
    cueContent += '\t\t\t\t]\n';
    cueContent += '\t\t\t\tcomponents: [\n';
    cueContent += `\t\t\t\t\t"${service.name.charAt(0).toUpperCase() + service.name.slice(1)}Page",\n`;
    cueContent += '\t\t\t\t]\n';
    cueContent += '\t\t\t},\n';
  }

  cueContent += '\t\t]\n';
  cueContent += '\t}\n';

  // Add locators
  cueContent += '\tlocators: {\n';
  for (const service of frontendServices) {
    cueContent += `\t\t"page:${service.name}": "[data-testid=\\"${service.name}-page\\"]"\n`;
  }
  cueContent += '\t}\n';

  cueContent += '\tflows: []\n';

  // Add metadata
  cueContent += '\tconfig: {\n';
  cueContent += `\t\tlanguage: "${analysis.languages[0] || 'typescript'}"\n`;
  cueContent += `\t\tkind:     "${analysis.projectType}"\n`;
  cueContent += '\t}\n';

  cueContent += '\tmetadata: {\n';
  cueContent += `\t\tname:    "${packageName}"\n`;
  cueContent += `\t\tversion: "1.0.0"\n`;
  cueContent += '\t}\n';

  cueContent += '\tdeployment: {\n';
  cueContent += `\t\ttarget: "kubernetes"\n`;
  cueContent += '\t}\n';

  // Add services
  if (analysis.services.length > 0) {
    cueContent += '\tservices: {\n';

    for (const service of analysis.services) {
      const needsQuotes = service.name.includes('-');
      const serviceName = needsQuotes ? `"${service.name}"` : service.name;

      cueContent += `\t\t${serviceName}: {\n`;
      cueContent += `\t\t\tserviceType:     "${service.type === 'database' || service.type === 'cache' ? 'prebuilt' : 'bespoke'}"\n`;
      cueContent += `\t\t\tlanguage:        "${service.language}"\n`;
      cueContent += `\t\t\ttype:            "${service.type === 'database' ? 'statefulset' : 'deployment'}"\n`;

      if (service.type !== 'database' && service.type !== 'cache') {
        cueContent += `\t\t\tsourceDirectory: "./src/${service.name}"\n`;
      }

      if (service.type === 'database' || service.type === 'cache') {
        cueContent += `\t\t\timage:           "${service.framework}:latest"\n`;
      }

      if (service.port) {
        cueContent += '\t\t\tports: [\n';
        cueContent += '\t\t\t\t{\n';
        cueContent += `\t\t\t\t\tname:       "${service.type === 'database' ? 'db' : service.type === 'cache' ? 'cache' : 'http'}"\n`;
        cueContent += `\t\t\t\t\tport:       ${service.port}\n`;
        cueContent += `\t\t\t\t\ttargetPort: ${service.port}\n`;
        cueContent += '\t\t\t\t},\n';
        cueContent += '\t\t\t]\n';
      }

      cueContent += '\t\t}\n';
    }

    cueContent += '\t}\n';
  }

  cueContent += '}\n';

  if (!dryRun) {
    await fs.writeFile(specPath, cueContent);
  }

  console.log(chalk.green('✅ Generated initial CUE specification: arbiter.assembly.cue'));
}

/**
 * Main onboard command
 */
export async function onboardCommand(options: OnboardOptions, config: CLIConfig): Promise<number> {
  try {
    const projectPath = options.projectPath ? path.resolve(options.projectPath) : process.cwd();

    console.log(chalk.blue('🚀 Arbiter Project Onboarding'));
    console.log(chalk.dim(`Project: ${projectPath}`));
    console.log();

    // Check if project already has Arbiter
    if (await fs.pathExists(path.join(projectPath, '.arbiter'))) {
      if (!options.force) {
        console.log(chalk.yellow('⚠️  Project appears to already be onboarded to Arbiter'));
        console.log(chalk.dim('Use --force to re-onboard'));
        return 1;
      }
    }

    // Step 1: Analyze project structure
    console.log(chalk.blue('🔍 Analyzing project structure...'));
    const structure = await withProgress({ text: 'Scanning files and directories' }, () =>
      analyzeProjectStructure(projectPath)
    );

    console.log(
      chalk.green(
        `✅ Scanned ${structure.files.length} files in ${structure.directories.length} directories`
      )
    );

    // Step 2: Detect services and analyze
    console.log(chalk.blue('🔍 Detecting services and dependencies...'));
    const analysis = await withProgress({ text: 'Analyzing project components' }, () =>
      analyzeProject(structure)
    );

    console.log(
      chalk.green(
        `✅ Detected ${analysis.services.length} service(s) in ${analysis.languages.join(', ')}`
      )
    );

    // Step 3: Show analysis results
    console.log(chalk.cyan('\n📊 Project Analysis Results:'));
    console.log(chalk.dim(`Project Type: ${analysis.projectType}`));
    console.log(chalk.dim(`Languages: ${analysis.languages.join(', ')}`));
    console.log(chalk.dim(`Frameworks: ${analysis.frameworks.join(', ')}`));

    if (analysis.services.length > 0) {
      console.log(chalk.dim('\n🔧 Detected Services:'));
      for (const service of analysis.services) {
        const confidence = Math.round(service.confidence * 100);
        console.log(
          chalk.dim(
            `  • ${service.name} (${service.type}, ${service.language}, ${confidence}% confidence)`
          )
        );
      }
    }

    // Step 4: Create migration plan
    const plan = createMigrationPlan(analysis);

    console.log(chalk.cyan(`\n📋 Migration Plan (${plan.estimatedTime}, ${plan.riskLevel} risk):`));
    for (const step of plan.migrationSteps) {
      const required = step.required ? chalk.red('*') : ' ';
      console.log(chalk.dim(`  ${required} ${step.title} (${step.estimatedTime})`));
    }

    // Step 5: Confirm with user (if interactive)
    if (options.interactive !== false) {
      const { proceed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'proceed',
          message: 'Proceed with onboarding?',
          default: true,
        },
      ]);

      if (!proceed) {
        console.log(chalk.yellow('Onboarding cancelled'));
        return 0;
      }
    }

    console.log(chalk.blue('\n🛠️  Starting migration...'));

    // Step 6: Setup .arbiter directory
    console.log(chalk.blue('📁 Setting up .arbiter directory...'));
    await withProgress({ text: 'Creating directory structure' }, () =>
      setupArbiterDirectory(projectPath, analysis, options.dryRun || false)
    );

    // Step 7: Generate CUE specification
    console.log(chalk.blue('📝 Generating CUE specifications...'));
    await withProgress({ text: 'Creating arbiter.assembly.cue' }, () =>
      generateInitialSpec(projectPath, analysis, options.dryRun || false)
    );

    // Step 8: Sync manifest files (optional)
    if (plan.migrationSteps.find(s => s.id === 'sync-manifests')?.required !== false) {
      console.log(chalk.blue('🔄 Syncing manifest files...'));
      await syncCommand(
        {
          dryRun: options.dryRun,
          backup: true,
          force: false,
        },
        config
      );
    }

    // Step 9: Success message and next steps
    console.log(chalk.green('\n🎉 Project onboarding complete!'));
    console.log(chalk.cyan('📊 Summary:'));
    console.log(chalk.dim('  • Created .arbiter directory structure'));
    console.log(chalk.dim('  • Generated initial CUE specification'));
    console.log(chalk.dim(`  • Detected ${analysis.services.length} services`));
    console.log(chalk.dim('  • Updated manifest files'));

    console.log(chalk.cyan('\n🚀 Next steps:'));
    console.log(chalk.dim('  1. Review generated arbiter.assembly.cue'));
    console.log(chalk.dim("  2. Run 'arbiter check' to validate configuration"));
    console.log(chalk.dim("  3. Run 'arbiter generate' to create project files"));
    console.log(chalk.dim('  4. Customize templates and profiles as needed'));

    if (options.dryRun) {
      console.log(chalk.yellow('\n💡 This was a dry run - no files were actually modified'));
      console.log(chalk.dim('Run without --dry-run to apply changes'));
    }

    return 0;
  } catch (error) {
    console.error(
      chalk.red('❌ Onboarding failed:'),
      error instanceof Error ? error.message : String(error)
    );
    return 1;
  }
}
