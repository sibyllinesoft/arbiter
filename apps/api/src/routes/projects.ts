import { createHash } from 'node:crypto';
import path from 'node:path';
import { ProjectEntities } from '@arbiter/shared/types/entities';
import { Hono } from 'hono';
import type { ContentFetcher } from '../content-fetcher';
import { createGithubContentFetcher, createLocalContentFetcher } from '../content-fetcher';
import { gitScanner } from '../git-scanner';
import { parseGitUrl } from '../git-url';
import { analyzeProjectFiles } from '../project-analysis';
type Dependencies = Record<string, unknown>;

const DEFAULT_STRUCTURE = {
  servicesDirectory: 'services',
  clientsDirectory: 'clients',
  modulesDirectory: 'modules',
  toolsDirectory: 'tools',
  docsDirectory: 'docs',
  testsDirectory: 'tests',
  infraDirectory: 'infra',
};

interface PresetArtifactInput {
  name: string;
  type: string;
  description?: string | null;
  language?: string | null;
  framework?: string | null;
  metadata?: Record<string, unknown>;
  filePath?: string | null;
}

interface PresetProjectData {
  resolvedSpec: Record<string, unknown>;
  artifacts: PresetArtifactInput[];
  structure?: Record<string, unknown>;
}

const PRESET_BUILDERS: Record<
  string,
  (projectId: string, projectName: string) => PresetProjectData
> = {
  'web-app': (_projectId, projectName) => {
    const timestamp = new Date().toISOString();
    const composeYaml = `version: '3.9'
services:
  frontend:
    build: ./clients/web
    environment:
      NODE_ENV: development
      API_HTTP_URL: http://rest:3000
    ports:
      - '5173:5173'
    depends_on:
      - rest
  rest:
    build: ./services/rest
    environment:
      NODE_ENV: development
      DATABASE_URL: postgres://postgres:postgres@postgres:5432/app
    ports:
      - '3000:3000'
    depends_on:
      - postgres
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: app
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
volumes:
  postgres_data: {}
`;
    const resolvedSpec = {
      spec: {
        product: {
          name: projectName,
          description:
            'Full-stack web application preset with a React frontend, Node.js API tier, and PostgreSQL database.',
          goals: [
            'Deliver a responsive user experience',
            'Expose a well-documented REST API',
            'Support secure authentication and account management',
          ],
        },
        ui: {
          routes: [{ id: 'root', path: '/' }],
          views: [
            {
              id: 'root-view',
              name: 'RootView',
              filePath: 'clients/web/src/routes/root.tsx',
              description: 'Entry view rendered at the application root.',
            },
          ],
        },
        services: {
          rest: {
            name: 'rest-service',
            description: 'Fastify REST API providing backend capabilities for the web application.',
            technology: 'Node.js 20 + Fastify',
            language: 'TypeScript',
            endpoints: [
              { method: 'GET', path: '/api/rest', description: 'List resources.' },
              { method: 'POST', path: '/api/rest', description: 'Create a resource.' },
            ],
            metadata: {
              presetId: 'web-app',
              type: 'service',
              packagePath: 'services/rest',
            },
          },
        },
        databases: {
          primary: {
            name: 'app-db',
            engine: 'postgresql',
            description: 'Primary relational database storing transactional data.',
            schemas: ['public', 'audit'],
          },
        },
        modules: {
          frontend: {
            name: 'frontend-app',
            description: 'React frontend package served via Vite.',
            language: 'TypeScript',
            metadata: {
              presetId: 'web-app',
              type: 'frontend',
              packagePath: 'clients/web',
            },
          },
          shared: {
            name: 'shared-library',
            description: 'Reusable TypeScript utilities shared across services.',
            language: 'TypeScript',
          },
        },
        frontend: {
          packages: [
            {
              packageName: 'frontend-app',
              packageRoot: 'clients/web',
              frameworks: ['react'],
              components: [
                {
                  name: 'RootView',
                  filePath: 'clients/web/src/routes/root.tsx',
                  framework: 'React',
                  description: 'Entry view rendered at the application root.',
                },
              ],
              routes: [
                {
                  path: '/',
                  filePath: 'clients/web/src/routes/root.tsx',
                  displayLabel: '/',
                  routerType: 'react-router',
                  isBaseRoute: true,
                },
              ],
            },
          ],
        },
        tools: {
          cli: {
            name: 'project-cli',
            description: 'Developer experience CLI with build and test helpers.',
            commands: ['dev', 'lint', 'test'],
          },
        },
        infrastructure: {
          containers: [
            {
              name: 'frontend',
              image: 'node:20-alpine',
              scope: 'frontend',
              ports: [{ containerPort: 5173 }],
            },
            {
              name: 'rest',
              image: 'node:20-alpine',
              scope: 'service',
              ports: [{ containerPort: 3000 }],
            },
            {
              name: 'postgres',
              image: 'postgres:15',
              scope: 'database',
              ports: [{ containerPort: 5432 }],
            },
          ],
          compose: {
            file: 'docker-compose.yml',
            services: ['frontend', 'rest', 'postgres'],
          },
        },
      },
      meta: {
        presetId: 'web-app',
        generatedAt: timestamp,
      },
    } as Record<string, unknown>;

    const artifacts: PresetArtifactInput[] = [
      {
        name: 'frontend-app',
        type: 'frontend',
        description: 'React SPA delivered with Vite dev server.',
        language: 'typescript',
        framework: 'react',
        filePath: 'clients/web',
        metadata: {
          presetId: 'web-app',
          detectedType: 'frontend',
          technology: 'React 18 + Vite',
          role: 'frontend',
        },
      },
      {
        name: 'rest-service',
        type: 'service',
        description: 'Fastify REST API serving the web application.',
        language: 'typescript',
        framework: 'fastify',
        filePath: 'services/rest',
        metadata: {
          presetId: 'web-app',
          endpoints: ['/api/rest'],
        },
      },
      {
        name: 'app-db',
        type: 'database',
        description: 'PostgreSQL database for transactional data.',
        language: null,
        framework: null,
        filePath: 'infra/database',
        metadata: {
          presetId: 'web-app',
          engine: 'postgresql',
          version: '15',
        },
      },
      {
        name: 'project-cli',
        type: 'tool',
        description: 'Developer productivity CLI.',
        language: 'typescript',
        framework: null,
        filePath: 'tools/cli',
        metadata: {
          presetId: 'web-app',
          commands: ['dev', 'lint', 'test'],
        },
      },
      {
        name: 'docker-compose',
        type: 'infrastructure',
        description:
          'Docker Compose definition for the frontend, REST API, and PostgreSQL database.',
        language: null,
        framework: null,
        filePath: 'infra/docker-compose.yml',
        metadata: {
          presetId: 'web-app',
          compose: true,
          composeYaml,
        },
      },
    ];

    return {
      resolvedSpec,
      artifacts,
      structure: { ...DEFAULT_STRUCTURE },
    };
  },
  'mobile-app': (_projectId, projectName) => {
    const timestamp = new Date().toISOString();
    const frontendPackage = {
      packageName: 'mobile-app',
      packageRoot: 'clients/mobile',
      frameworks: ['react-native'],
      components: [
        {
          name: 'HomeScreen',
          filePath: 'clients/mobile/src/screens/Home.tsx',
          framework: 'React Native',
          description: 'Landing experience with personalized content.',
        },
        {
          name: 'ProfileScreen',
          filePath: 'clients/mobile/src/screens/Profile.tsx',
          framework: 'React Native',
          description: 'Profile management and account preferences.',
        },
      ],
      routes: [
        {
          path: '/home',
          filePath: 'clients/mobile/src/screens/Home.tsx',
          displayLabel: '/home',
          routerType: 'react-native-stack',
        },
        {
          path: '/profile',
          filePath: 'clients/mobile/src/screens/Profile.tsx',
          displayLabel: '/profile',
          routerType: 'react-native-stack',
        },
        {
          path: '/settings',
          filePath: 'clients/mobile/src/screens/Settings.tsx',
          displayLabel: '/settings',
          routerType: 'react-native-stack',
        },
      ],
    };

    const resolvedSpec = {
      spec: {
        product: {
          name: projectName,
          description:
            'Cross-platform mobile application preset with React Native UI and supporting API.',
          goals: [
            'Provide native-feeling mobile experience',
            'Sync data when online and offline',
            'Deliver push notification capabilities',
          ],
        },
        ui: {
          routes:
            frontendPackage.routes?.map(route => ({
              id: route.path.replace('/', '') || 'home',
              path: route.path,
              name: `${route.displayLabel} Screen`.trim(),
            })) ?? [],
          views:
            frontendPackage.components?.map(component => ({
              id: component.name.toLowerCase(),
              name: component.name,
              filePath: component.filePath,
              description: component.description,
            })) ?? [],
        },
        services: {
          api: {
            name: 'mobile-api',
            description: 'Node.js API optimized for mobile use-cases.',
            technology: 'Node.js 20 + Fastify',
            language: 'TypeScript',
            endpoints: [
              { method: 'GET', path: '/api/feed', description: 'Fetch personalized feed.' },
              { method: 'POST', path: '/api/profile', description: 'Update profile information.' },
            ],
            metadata: {
              presetId: 'mobile-app',
              type: 'service',
            },
          },
          notifications: {
            name: 'notifications-worker',
            description: 'Background worker dispatching push notifications.',
            technology: 'Node.js 20 + BullMQ',
            language: 'TypeScript',
            metadata: {
              presetId: 'mobile-app',
              type: 'job',
            },
          },
        },
        frontend: {
          packages: [frontendPackage],
        },
        databases: {
          cache: {
            name: 'mobile-cache',
            engine: 'redis',
            description: 'Caching layer for offline synchronization.',
          },
        },
        tools: {
          pipeline: {
            name: 'mobile-pipeline',
            description: 'CI pipeline for building and distributing mobile binaries.',
            commands: ['build:ios', 'build:android', 'publish'],
          },
        },
        infrastructure: {
          containers: [
            {
              name: 'mobile-api',
              image: 'node:20-alpine',
              scope: 'service',
              ports: [{ containerPort: 3001 }],
            },
            { name: 'notifications-worker', image: 'node:20-alpine', scope: 'job', ports: [] },
            {
              name: 'redis',
              image: 'redis:7-alpine',
              scope: 'cache',
              ports: [{ containerPort: 6379 }],
            },
          ],
        },
      },
      meta: {
        presetId: 'mobile-app',
        generatedAt: timestamp,
      },
    } as Record<string, unknown>;

    const artifacts: PresetArtifactInput[] = [
      {
        name: 'mobile-app',
        type: 'frontend',
        description: 'React Native application delivered through Expo.',
        language: 'typescript',
        framework: 'react-native',
        filePath: frontendPackage.packageRoot,
        metadata: {
          presetId: 'mobile-app',
          detectedType: 'frontend',
          packageRoot: frontendPackage.packageRoot,
          frameworks: frontendPackage.frameworks,
        },
      },
      {
        name: 'mobile-api',
        type: 'service',
        description: 'API optimized for mobile workloads.',
        language: 'typescript',
        framework: 'fastify',
        filePath: 'services/mobile-api',
        metadata: {
          presetId: 'mobile-app',
          endpoints: ['/api/feed', '/api/profile'],
        },
      },
      {
        name: 'notifications-worker',
        type: 'service',
        description: 'Background worker delivering push notifications.',
        language: 'typescript',
        framework: 'bullmq',
        filePath: 'services/notifications-worker',
        metadata: {
          presetId: 'mobile-app',
          type: 'job',
        },
      },
      {
        name: 'mobile-cache',
        type: 'database',
        description: 'Redis cache supporting offline sync.',
        language: null,
        framework: null,
        filePath: 'infra/cache',
        metadata: {
          presetId: 'mobile-app',
          engine: 'redis',
        },
      },
    ];

    return {
      resolvedSpec,
      artifacts,
      structure: { ...DEFAULT_STRUCTURE },
    };
  },
  'api-service': (_projectId, projectName) => {
    const timestamp = new Date().toISOString();
    const resolvedSpec = {
      spec: {
        product: {
          name: projectName,
          description:
            'Preset for a production-ready REST API with documentation and observability.',
          goals: [
            'Expose versioned REST endpoints',
            'Provide comprehensive API documentation',
            'Instrument metrics for monitoring',
          ],
        },
        services: {
          api: {
            name: 'core-api',
            description: 'REST API built with Fastify.',
            technology: 'Node.js 20 + Fastify',
            language: 'TypeScript',
            endpoints: [
              { method: 'GET', path: '/v1/resources', description: 'List resources.' },
              { method: 'POST', path: '/v1/resources', description: 'Create a resource.' },
            ],
            metadata: {
              presetId: 'api-service',
              type: 'service',
            },
          },
          worker: {
            name: 'background-worker',
            description: 'Queue processing worker for async jobs.',
            technology: 'Node.js 20 + BullMQ',
            language: 'TypeScript',
            metadata: {
              presetId: 'api-service',
              type: 'job',
            },
          },
        },
        databases: {
          primary: {
            name: 'api-db',
            engine: 'postgresql',
            description: 'Transactional database backing the API.',
          },
        },
        tools: {
          docs: {
            name: 'api-docs',
            description: 'OpenAPI documentation bundle.',
            commands: ['docs:generate'],
          },
          tests: {
            name: 'contract-tests',
            description: 'Postman collection runner for contract testing.',
          },
        },
        infrastructure: {
          containers: [
            {
              name: 'core-api',
              image: 'node:20-alpine',
              scope: 'service',
              ports: [{ containerPort: 3000 }],
            },
            { name: 'worker', image: 'node:20-alpine', scope: 'job', ports: [] },
            {
              name: 'postgres',
              image: 'postgres:15',
              scope: 'database',
              ports: [{ containerPort: 5432 }],
            },
          ],
        },
      },
      meta: {
        presetId: 'api-service',
        generatedAt: timestamp,
      },
    } as Record<string, unknown>;

    const artifacts: PresetArtifactInput[] = [
      {
        name: 'core-api',
        type: 'service',
        description: 'Fastify REST API exposing versioned endpoints.',
        language: 'typescript',
        framework: 'fastify',
        filePath: 'services/core-api',
        metadata: {
          presetId: 'api-service',
          endpoints: ['/v1/resources'],
        },
      },
      {
        name: 'background-worker',
        type: 'service',
        description: 'Queue processing worker handling asynchronous tasks.',
        language: 'typescript',
        framework: 'bullmq',
        filePath: 'services/background-worker',
        metadata: {
          presetId: 'api-service',
          type: 'job',
        },
      },
      {
        name: 'api-db',
        type: 'database',
        description: 'Primary PostgreSQL database for the API.',
        language: null,
        framework: null,
        filePath: 'infra/database',
        metadata: {
          presetId: 'api-service',
          engine: 'postgresql',
        },
      },
      {
        name: 'api-docs',
        type: 'tool',
        description: 'OpenAPI documentation package.',
        language: 'typescript',
        framework: null,
        filePath: 'tools/docs',
        metadata: {
          presetId: 'api-service',
          commands: ['docs:generate'],
        },
      },
    ];

    return {
      resolvedSpec,
      artifacts,
      structure: { ...DEFAULT_STRUCTURE },
    };
  },
  microservice: (_projectId, projectName) => {
    const timestamp = new Date().toISOString();
    const resolvedSpec = {
      spec: {
        product: {
          name: projectName,
          description:
            'Containerized microservice preset with observability and asynchronous messaging.',
          goals: [
            'Deploy as an independent container',
            'Expose health checks for orchestration',
            'Publish domain events to a message broker',
          ],
        },
        services: {
          microservice: {
            name: 'inventory-service',
            description: 'Go microservice managing inventory levels.',
            technology: 'Go 1.22 + Echo',
            language: 'Go',
            endpoints: [
              { method: 'GET', path: '/inventory', description: 'List inventory items.' },
              { method: 'POST', path: '/inventory/reserve', description: 'Reserve inventory.' },
            ],
            metadata: {
              presetId: 'microservice',
              type: 'service',
            },
          },
          metrics: {
            name: 'metrics-collector',
            description: 'Prometheus metrics exporter for the service.',
            technology: 'Go 1.22',
            language: 'Go',
            metadata: {
              presetId: 'microservice',
              type: 'service',
            },
          },
        },
        infrastructure: {
          containers: [
            {
              name: 'inventory-service',
              image: 'golang:1.22-alpine',
              scope: 'service',
              ports: [{ containerPort: 8080 }],
            },
            {
              name: 'metrics',
              image: 'prom/prometheus',
              scope: 'observability',
              ports: [{ containerPort: 9090 }],
            },
            {
              name: 'nats',
              image: 'nats:2-alpine',
              scope: 'messaging',
              ports: [{ containerPort: 4222 }],
            },
          ],
        },
        tools: {
          ci: {
            name: 'service-pipeline',
            description: 'CI pipeline with build, test, and deploy stages.',
            commands: ['build', 'test', 'docker:publish'],
          },
        },
      },
      meta: {
        presetId: 'microservice',
        generatedAt: timestamp,
      },
    } as Record<string, unknown>;

    const artifacts: PresetArtifactInput[] = [
      {
        name: 'inventory-service',
        type: 'service',
        description: 'Go microservice exposing inventory APIs.',
        language: 'go',
        framework: 'echo',
        filePath: 'services/inventory',
        metadata: {
          presetId: 'microservice',
          technology: 'Go 1.22 + Echo',
        },
      },
      {
        name: 'metrics-collector',
        type: 'service',
        description: 'Prometheus metrics sidecar.',
        language: 'go',
        framework: null,
        filePath: 'services/metrics',
        metadata: {
          presetId: 'microservice',
          role: 'observability',
        },
      },
      {
        name: 'event-bus',
        type: 'infrastructure',
        description: 'NATS message broker for asynchronous communication.',
        language: null,
        framework: null,
        filePath: 'infra/messaging',
        metadata: {
          presetId: 'microservice',
          technology: 'nats',
        },
      },
    ];

    return {
      resolvedSpec,
      artifacts,
      structure: { ...DEFAULT_STRUCTURE },
    };
  },
};

export function createProjectsRouter(deps: Dependencies) {
  const router = new Hono();

  // GET single project with full resolved spec and artifacts
  router.get('/projects/:id', async c => {
    const projectId = c.req.param('id');

    if (!projectId) {
      return c.json({ error: 'Project ID is required' }, 400);
    }

    try {
      const db = deps.db as any;

      // Fetch project details
      const projects = await db.listProjects();
      const project = projects.find((p: any) => p.id === projectId);

      if (!project) {
        return c.json({ error: 'Project not found' }, 404);
      }

      // Fetch all artifacts for this project
      const artifacts = await db.getArtifacts(projectId);

      // Map artifacts to the expected spec structure for frontend rendering
      const services: Record<string, any> = {};
      const databases: Record<string, any> = {};
      const components: Record<string, any> = {};

      artifacts.forEach((artifact: any) => {
        const cleanName = artifact.name.replace(/_/g, '-');
        const baseData = {
          name: artifact.name,
          type: artifact.type,
          description: artifact.description || artifact.metadata?.description || '',
          metadata: {
            ...artifact.metadata,
            detected: true,
            language: artifact.language,
            framework: artifact.framework,
          },
        };

        switch (artifact.type) {
          case 'service':
            services[cleanName] = baseData;
            break;
          case 'database':
            databases[cleanName] = baseData;
            break;
          case 'module':
          case 'tool':
          case 'binary':
          case 'frontend':
          case 'job':
          case 'infrastructure':
          case 'deployment':
            components[cleanName] = baseData;
            break;
          default:
            // Handle other types as components
            components[cleanName] = baseData;
        }
      });

      // Calculate infrastructure and external counts for consistency
      let infrastructureCount = 0;
      let externalCount = 0;
      for (const [key, comp] of Object.entries(components)) {
        if (comp.type === 'infrastructure') {
          infrastructureCount++;
        } else if (!['module', 'tool', 'binary', 'frontend'].includes(comp.type)) {
          externalCount++;
        }
      }

      // Generate routes from services (for UI consistency)
      const routes = Object.keys(services).map(serviceName => ({
        id: serviceName,
        path: `/${serviceName}`,
        name: services[serviceName].name,
      }));

      const frontendViewSet = new Set<string>();
      artifacts
        .filter((artifact: any) => artifact.metadata?.frontendAnalysis)
        .forEach((artifact: any) => {
          const analysis = artifact.metadata?.frontendAnalysis;
          if (!analysis) return;
          (analysis.routers || []).forEach((router: any) => {
            (router.routes || []).forEach((route: any) => {
              const rawPath = String(route.path || '').trim();
              if (!rawPath) return;
              const normalized = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
              frontendViewSet.add(normalized.replace(/\/+/g, '/'));
            });
          });
        });

      const resolvedSpec = {
        version: '1.0',
        services,
        databases,
        components,
        routes,
        // Add placeholder flows and capabilities based on services
        flows:
          Object.keys(services).length > 0
            ? [{ id: 'main-flow', name: 'Main Application Flow' }]
            : [],
        capabilities:
          Object.keys(services).length > 0 ? [{ id: 'api-capability', name: 'API Services' }] : [],
        // Include raw artifacts for detailed rendering
        artifacts,
        project: {
          id: project.id,
          name: project.name,
          entities: {
            services: Object.keys(services).length,
            databases: Object.keys(databases).length,
            modules: Object.keys(components).filter(k => components[k].type === 'module').length,
            tools: Object.keys(components).filter(
              k => components[k].type === 'tool' || components[k].type === 'binary'
            ).length,
            frontends: Object.keys(components).filter(k => components[k].type === 'frontend')
              .length,
            infrastructure: infrastructureCount,
            external: externalCount,
            views: frontendViewSet.size,
            routes: routes.length,
            flows: Object.keys(services).length > 0 ? 1 : 0,
            capabilities: Object.keys(services).length > 0 ? 1 : 0,
          },
        },
      };

      return c.json({ resolved: resolvedSpec });
    } catch (error) {
      console.error('Error fetching project details:', error);
      return c.json({ error: 'Failed to fetch project details' }, 500);
    }
  });

  // Projects endpoint - using real database with entity counts
  router.get('/projects', async c => {
    console.log(
      '🔄 GET /api/projects - Request received from:',
      c.req.header('origin') || 'unknown'
    );
    try {
      const db = deps.db as any;
      const projects = await db.listProjects();
      console.log('📊 GET /api/projects - Raw projects from DB:', projects.length, 'projects');

      // Transform database projects and calculate entity counts from specs
      const formattedProjects = await Promise.all(
        projects.map(async (project: any) => {
          let entities: ProjectEntities = {
            services: 0,
            databases: 0,
            modules: 0,
            tools: 0,
            frontends: 0,
            views: 0,
            infrastructure: 0,
            external: 0,
            // CUE spec entities
            routes: 0,
            flows: 0,
            capabilities: 0,
          };

          try {
            // Get real artifacts from database for entity calculation
            const artifacts = await db.getArtifacts(project.id);

            // Build services from real artifacts
            const services: Record<string, any> = {};
            const serviceArtifacts = artifacts.filter((a: any) => a.type === 'service');
            const routeSet = new Set<string>();

            const toSlug = (value: string) =>
              String(value || '')
                .replace(/[^a-z0-9]+/gi, '-')
                .replace(/^-+|-+$/g, '')
                .toLowerCase();

            for (const artifact of serviceArtifacts) {
              const serviceName = artifact.name.replace(/_/g, '-');
              services[serviceName] = {
                name: artifact.name,
                type: 'service',
                metadata: { detected: true },
              };

              const analysis = artifact.metadata?.tsoaAnalysis;
              if (analysis) {
                const rawServiceName = artifact.name.replace(/^@[^/]+\//, '') || artifact.name;
                const slugRoot = toSlug(artifact.name) || 'service';
                const serviceSlug = toSlug(rawServiceName) || slugRoot;
                const baseRoutePath = `/${serviceSlug}`.replace(/\/+/g, '/');
                if (baseRoutePath) {
                  routeSet.add(baseRoutePath);
                }

                const controllerCandidates = Array.isArray(analysis.controllerCandidates)
                  ? analysis.controllerCandidates
                  : [];

                controllerCandidates.forEach((candidate: string) => {
                  const normalized = candidate.split('\\').join('/');
                  const fileName = normalized.split('/').pop() || normalized;
                  const baseSegment = toSlug(
                    fileName
                      .replace(/\.[tj]sx?$/i, '')
                      .replace(/controller$/i, '')
                      .replace(/route$/i, '')
                  );
                  const routePath = baseSegment
                    ? `${baseRoutePath}/${baseSegment}`.replace(/\/+/g, '/')
                    : baseRoutePath;
                  routeSet.add(routePath);
                });
              }
            }

            // Build databases from real artifacts
            const databases: Record<string, any> = {};
            const databaseArtifacts = artifacts.filter((a: any) => a.type === 'database');

            for (const artifact of databaseArtifacts) {
              const dbName = artifact.name.replace(/_/g, '-');

              // Determine database type from artifact
              const getDatabaseType = (framework?: string, name?: string) => {
                if (framework) return framework.toLowerCase();
                if (name?.includes('postgres') || name?.includes('pg')) return 'postgresql';
                if (name?.includes('mysql') || name?.includes('maria')) return 'mysql';
                if (name?.includes('mongo')) return 'mongodb';
                if (name?.includes('redis')) return 'redis';
                if (name?.includes('sqlite')) return 'sqlite';
                return 'unknown';
              };

              databases[dbName] = {
                name: artifact.name,
                type: getDatabaseType(artifact.framework, artifact.name),
                metadata: {
                  detected: true,
                  language: artifact.language || 'sql',
                  framework: artifact.framework || 'unknown',
                },
              };
            }

            // Count other artifact types properly
            const otherArtifacts = artifacts.filter(
              (a: any) => !['service', 'database'].includes(a.type)
            );

            // Group artifacts by type for debugging
            const typeGroups: Record<string, number> = {};
            for (const artifact of otherArtifacts) {
              const type = artifact.type;
              typeGroups[type] = (typeGroups[type] || 0) + 1;
            }
            console.log(`[DEBUG] Artifact types for project ${project.name}:`, typeGroups);

            let moduleCount = 0;
            let toolCount = 0;
            let frontendCount = 0;
            let infrastructureCount = 0;
            let externalCount = 0;

            for (const artifact of otherArtifacts) {
              // Normalize types
              let type = artifact.type;
              if (type === 'binary') type = 'tool';

              switch (type) {
                case 'module':
                  moduleCount++;
                  break;
                case 'tool':
                  toolCount++;
                  break;
                case 'frontend':
                  frontendCount++;
                  break;
                case 'infrastructure':
                  infrastructureCount++;
                  break;
                default:
                  {
                    const detectedType = String(
                      artifact.metadata?.detectedType || artifact.metadata?.type || ''
                    ).toLowerCase();
                    if (detectedType === 'tool' || detectedType === 'build_tool') {
                      toolCount++;
                    } else if (detectedType === 'frontend') {
                      frontendCount++;
                    } else if (detectedType === 'infrastructure') {
                      infrastructureCount++;
                    } else {
                      externalCount++;
                    }
                  }
                  break;
              }
            }

            // Include frontend-detected routes
            const frontendRouteSet = new Set<string>();
            const frontendRoutes: string[] = artifacts
              .filter((artifact: any) => artifact.metadata?.frontendAnalysis)
              .flatMap((artifact: any) => {
                const analysis = artifact.metadata?.frontendAnalysis;
                if (!analysis) return [] as string[];
                const packageRoutes = (analysis.routers || []).flatMap((router: any) =>
                  (router.routes || []).map((route: any) => String(route.path || ''))
                );
                return packageRoutes;
              });

            frontendRoutes
              .map((path: string) => String(path || '').trim())
              .filter(Boolean)
              .forEach((path: string) => {
                const normalized = path.startsWith('/') ? path : `/${path}`;
                const cleaned = normalized.replace(/\/+/g, '/');
                routeSet.add(cleaned);
                frontendRouteSet.add(cleaned);
              });

            const routes = Array.from(routeSet);
            const frontendViews = Array.from(frontendRouteSet);

            // Calculate entity counts
            entities = {
              services: Object.keys(services).length,
              databases: Object.keys(databases).length,
              modules: moduleCount,
              tools: toolCount,
              frontends: frontendCount,
              infrastructure: infrastructureCount,
              external: externalCount,
              views: frontendViews.length,
              routes: routes.length,
              flows: routes.length > 0 ? 1 : 0, // Generate one flow if we have routes
              capabilities: routes.length > 0 ? 1 : 0, // Generate one capability if we have routes
            } as ProjectEntities;
          } catch (error) {
            console.warn(`Failed to calculate entities for project ${project.id}:`, error);
            // Fall back to basic database counts
            entities = {
              services: project.service_count || 0,
              databases: project.database_count || 0,
              modules: 0,
              tools: 0,
              frontends: 0,
              infrastructure: 0,
              external: 0,
              views: 0,
              routes: 0,
              flows: 0,
              capabilities: 0,
            } as ProjectEntities;
          }

          return {
            id: project.id,
            name: project.name,
            status: 'active',
            entities,
            lastActivity: project.updated_at,
          };
        })
      );

      return c.json({ projects: formattedProjects });
    } catch (error) {
      console.error('Error fetching projects:', error);
      return c.json({ projects: [] });
    }
  });

  // Create project endpoint
  router.post('/projects', async c => {
    try {
      const db = deps.db as any;
      const body = await c.req.json();
      const { name, path: projectPath, presetId } = body;

      if (!name) {
        return c.json({ error: 'Project name is required' }, 400);
      }

      // Generate project ID
      const projectId = `project-${Date.now()}`;

      // Use the provided name (which should be extracted from git URL on frontend)
      let actualProjectName = name;

      let services = 0;
      let databases = 0;
      let artifacts: any[] = [];
      let detectedStructure: any;
      let presetData: PresetProjectData | null = null;

      if (presetId) {
        const builder = PRESET_BUILDERS[presetId];
        if (!builder) {
          return c.json({ error: `Unknown preset: ${presetId}` }, 400);
        }

        presetData = builder(projectId, actualProjectName);
        const generatedArtifacts = presetData.artifacts.map((artifact, index) => ({
          id: `${projectId}-preset-artifact-${index + 1}`,
          ...artifact,
        }));

        artifacts = generatedArtifacts;
        services = Object.keys(
          ((presetData.resolvedSpec as Record<string, any>)?.spec?.services as Record<
            string,
            unknown
          >) ?? {}
        ).length;
        databases = Object.keys(
          ((presetData.resolvedSpec as Record<string, any>)?.spec?.databases as Record<
            string,
            unknown
          >) ?? {}
        ).length;
        detectedStructure = presetData.structure
          ? { ...presetData.structure }
          : { ...DEFAULT_STRUCTURE };
      } else if (projectPath) {
        let files: string[] = [];
        let structure = undefined;
        let gitUrl: string | undefined;
        let branch: string | undefined;
        let contentFetcher: ContentFetcher | undefined;

        const resolved = gitScanner.resolveTempPath
          ? await gitScanner.resolveTempPath(projectPath)
          : null;

        if (resolved?.success) {
          files = resolved.files ?? [];
          structure = resolved.projectStructure;
          gitUrl = resolved.gitUrl;
          branch = resolved.branch;

          if (gitUrl) {
            const parsedGit = parseGitUrl(gitUrl);
            if (parsedGit) {
              const ref = branch ?? parsedGit.ref ?? 'main';
              const token = typeof process !== 'undefined' ? process.env.GITHUB_TOKEN : undefined;
              contentFetcher = createGithubContentFetcher({
                owner: parsedGit.owner,
                repo: parsedGit.repo,
                ref,
                token,
              });
            }
          }
        }

        if (!files.length) {
          const scanResult = await gitScanner.scanLocalPath(projectPath);
          if (scanResult.success) {
            files = scanResult.files ?? [];
            structure = scanResult.projectStructure;
            contentFetcher = createLocalContentFetcher(projectPath);
            branch = scanResult.branch;
          }
        }

        if (files.length > 0) {
          const absoluteProjectRoot = projectPath ? path.resolve(projectPath) : undefined;
          const analysis = await analyzeProjectFiles(projectId, actualProjectName, files, {
            gitUrl,
            structure,
            branch,
            fetcher: contentFetcher,
            projectRoot: absoluteProjectRoot,
          });

          artifacts = analysis.artifacts;
          services = analysis.serviceCount;
          databases = analysis.databaseCount;
          detectedStructure = analysis.structure;
        }
      }

      if (!detectedStructure) {
        detectedStructure = { ...DEFAULT_STRUCTURE };
      }

      // Create project with detected counts
      const project = await db.createProject(projectId, actualProjectName, services, databases);

      // Now create all the artifacts for the project
      for (const artifact of artifacts) {
        try {
          console.debug('[projects.create] storing artifact', {
            projectId,
            name: artifact.name,
            type: artifact.type,
            language: artifact.language,
            classification: artifact.metadata?.classification,
          });
          await db.createArtifact(
            artifact.id,
            projectId,
            artifact.name,
            typeof artifact.description === 'string' ? artifact.description?.trim() || null : null,
            artifact.type,
            artifact.language,
            artifact.framework,
            artifact.metadata,
            artifact.filePath
          );
        } catch (error) {
          console.warn(`Failed to create artifact ${artifact.name}:`, error);
        }
      }

      if (presetData?.resolvedSpec) {
        const resolvedJson = JSON.stringify(presetData.resolvedSpec, null, 2);
        const specHash = createHash('sha1').update(resolvedJson).digest('hex');
        await db.createVersion(`version-${Date.now()}`, project.id, specHash, resolvedJson);
      }

      return c.json({
        id: project.id,
        name: project.name,
        status: 'active',
        services,
        databases,
        artifacts: artifacts.length,
        lastActivity: project.created_at,
        structure: detectedStructure,
      });
    } catch (error) {
      console.error('Error creating project:', error);
      return c.json({ error: 'Failed to create project' }, 500);
    }
  });

  // Delete project endpoint
  router.delete('/projects/:id', async c => {
    const projectId = c.req.param('id');

    if (!projectId) {
      return c.json({ error: 'Project ID is required' }, 400);
    }

    try {
      const db = deps.db as any;

      // Check if project exists
      const projects = await db.listProjects();
      const project = projects.find((p: any) => p.id === projectId);

      if (!project) {
        return c.json({ error: 'Project not found' }, 404);
      }

      // Delete all related artifacts first
      await db.deleteArtifacts(projectId);

      // Delete the project
      await db.deleteProject(projectId);

      console.log(`🗑️ Project deleted: ${projectId} (${project.name})`);

      return c.json({
        success: true,
        message: `Project "${project.name}" deleted successfully`,
        projectId,
      });
    } catch (error) {
      console.error('Error deleting project:', error);
      return c.json({ error: 'Failed to delete project' }, 500);
    }
  });

  // Action log endpoint for service activities
  router.get('/activities', c => {
    return c.json({
      activities: [
        {
          id: 'act-1',
          type: 'service',
          message: 'Service added: user-auth-service',
          timestamp: '2025-09-20T10:30:00Z',
          projectId: 'project-1',
        },
        {
          id: 'act-2',
          type: 'database',
          message: 'Database configured: postgres-main',
          timestamp: '2025-09-20T10:15:00Z',
          projectId: 'project-1',
        },
        {
          id: 'act-3',
          type: 'service',
          message: 'Service deployed to staging environment',
          timestamp: '2025-09-20T09:45:00Z',
          projectId: 'project-2',
        },
      ],
    });
  });

  return router;
}
