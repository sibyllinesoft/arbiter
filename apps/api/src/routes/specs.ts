import path from 'path';
import fs from 'fs-extra';
import { Hono } from 'hono';

type Dependencies = Record<string, unknown>;

export function createSpecsRouter(deps: Dependencies) {
  const router = new Hono();

  // Specifications endpoint for CLI
  router.get('/specifications', async c => {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substr(2, 9);

    try {
      console.log(`[SPECS-GET] ${requestId} - Request started at ${new Date().toISOString()}`);

      const query = c.req.query();
      const { type, path: specPath } = query;
      console.log(`[SPECS-GET] ${requestId} - Query params:`, { type, path: specPath });

      if (specPath && (await fs.pathExists(specPath))) {
        console.log(`[SPECS-GET] ${requestId} - File exists, reading content...`);
        const content = await fs.readFile(specPath, 'utf-8');
        const stat = await fs.stat(specPath);
        const duration = Date.now() - startTime;

        console.log(`[SPECS-GET] ${requestId} - Success after ${duration}ms`);

        return c.json({
          success: true,
          type,
          path: specPath,
          content,
          lastModified: stat.mtime.toISOString(),
        });
      }

      const duration = Date.now() - startTime;
      console.log(`[SPECS-GET] ${requestId} - File not found after ${duration}ms`);

      return c.json(
        {
          success: false,
          error: 'Specification not found',
          type,
          path: specPath,
        },
        404
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[SPECS-GET] ${requestId} - Error after ${duration}ms:`, error);

      return c.json(
        {
          success: false,
          error: 'Failed to retrieve specification',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      );
    }
  });

  router.post('/specifications', async c => {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substr(2, 9);

    try {
      console.log(`[SPECS-POST] ${requestId} - Request started at ${new Date().toISOString()}`);

      const body = await c.req.json();
      const { type, path: specPath, content } = body;
      console.log(`[SPECS-POST] ${requestId} - Body params:`, {
        type,
        path: specPath,
        contentLength: content?.length || 0,
      });

      if (!specPath || !content) {
        const duration = Date.now() - startTime;
        console.log(
          `[SPECS-POST] ${requestId} - Bad request after ${duration}ms - missing path or content`
        );

        return c.json(
          {
            success: false,
            error: 'path and content are required',
          },
          400
        );
      }

      console.log(`[SPECS-POST] ${requestId} - Ensuring directory exists...`);
      // Ensure directory exists
      await fs.ensureDir(path.dirname(specPath));

      console.log(`[SPECS-POST] ${requestId} - Writing file...`);
      // Write the specification file
      await fs.writeFile(specPath, content, 'utf-8');

      const duration = Date.now() - startTime;
      console.log(`[SPECS-POST] ${requestId} - Success after ${duration}ms`);

      return c.json({
        success: true,
        type,
        path: specPath,
        message: 'Specification created successfully',
        lastModified: new Date().toISOString(),
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[SPECS-POST] ${requestId} - Error after ${duration}ms:`, error);

      return c.json(
        {
          success: false,
          error: 'Failed to create specification',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      );
    }
  });

  // Missing endpoints that the frontend expects
  router.get('/resolved', async c => {
    const projectId = c.req.query('projectId');

    if (!projectId) {
      return c.json({ error: 'projectId parameter is required' }, 400);
    }

    try {
      // Get project from database to fetch real brownfield detection data
      const db = deps.db as any;
      const projects = await db.listProjects();
      const project = projects.find((p: any) => p.id === projectId);

      if (!project) {
        return c.json({ error: 'Project not found' }, 404);
      }

      // Get real artifacts from database
      const artifacts = await db.getArtifacts(projectId);

      // Use the project name for cleaning artifact names
      const actualProjectName = project.name;

      // Helper function to clean artifact names from temp directory patterns
      const getCleanArtifactName = (originalName: string): string => {
        // Detect temp directory patterns and replace with project name
        if (
          originalName.includes('arbiter-git-scan') ||
          originalName.includes('Arbiter Git Scan') ||
          /arbiter.*git.*scan.*\d+.*[a-z0-9]+/i.test(originalName) ||
          /^[a-zA-Z0-9_-]*\d{13}[a-zA-Z0-9_-]*$/i.test(originalName)
        ) {
          return actualProjectName;
        }
        return originalName;
      };

      // Build services from real artifacts
      const services: Record<string, any> = {};
      const serviceArtifacts = artifacts.filter((a: any) => a.type === 'service');

      for (const artifact of serviceArtifacts) {
        const serviceName = artifact.name.replace(/_/g, '-');

        // Determine image based on language/framework
        const getContainerImage = (language: string, framework?: string) => {
          switch (language?.toLowerCase()) {
            case 'rust':
              return 'rust:alpine';
            case 'nodejs':
            case 'javascript':
            case 'typescript':
              return 'node:alpine';
            case 'python':
              return 'python:slim';
            case 'go':
              return 'golang:alpine';
            case 'java':
              return 'openjdk:slim';
            default:
              return 'alpine:latest';
          }
        };

        // Determine default port based on framework
        const getDefaultPort = (language: string, framework?: string) => {
          if (framework?.includes('express') || framework?.includes('fastify')) return 3000;
          if (framework?.includes('flask') || framework?.includes('fastapi')) return 5000;
          if (framework?.includes('axum') || framework?.includes('warp')) return 8080;
          if (framework?.includes('gin') || framework?.includes('echo')) return 8080;
          if (language?.toLowerCase() === 'nodejs') return 3000;
          if (language?.toLowerCase() === 'python') return 5000;
          if (language?.toLowerCase() === 'rust') return 8080;
          if (language?.toLowerCase() === 'go') return 8080;
          return 8080; // fallback
        };

        const language = artifact.language || 'unknown';
        const framework = artifact.framework || 'unknown';
        const port = artifact.metadata?.port || getDefaultPort(language, framework);

        // Use actual container image if available, otherwise fall back to generated one
        const actualImage = artifact.metadata?.containerImage;
        const imageToUse = actualImage || getContainerImage(language, framework);

        services[serviceName] = {
          name: artifact.name, // Use the original name from docker-compose.yml
          type: 'service',
          image: imageToUse,
          ports: [{ port, targetPort: port }],
          metadata: {
            ...artifact.metadata,
            language,
            framework,
            workspaceMember: artifact.metadata?.workspaceMember,
            filePath: artifact.file_path,
            detected: true,
            originalImage: actualImage, // Keep track of original detected image
            buildContext: artifact.metadata?.buildContext,
            dockerfile: artifact.metadata?.dockerfile,
          },
        };
      }

      // Deduplicate: merge deployments into services and exclude from components
      const serviceNames = new Set(serviceArtifacts.map((a: any) => a.name));
      const deploymentArtifacts = artifacts.filter((a: any) => a.type === 'deployment');
      for (const dep of deploymentArtifacts) {
        if (serviceNames.has(dep.name)) {
          const serviceKey = dep.name.replace(/_/g, '-');
          if (services[serviceKey]) {
            if (!services[serviceKey].metadata.deployment) {
              services[serviceKey].metadata.deployment = {};
            }
            services[serviceKey].metadata.deployment = {
              ...services[serviceKey].metadata.deployment,
              ...dep.metadata,
              type: 'deployment',
              source: 'inferred', // since no K8s files
            };
          }
        }
      }

      // Build databases from real artifacts
      const databases: Record<string, any> = {};
      const databaseArtifacts = artifacts.filter((a: any) => a.type === 'database');

      for (const artifact of databaseArtifacts) {
        const dbName = artifact.name.replace(/_/g, '-');

        // Determine database type from artifact or framework
        const getDatabaseType = (framework?: string, name?: string) => {
          if (framework) return framework.toLowerCase();
          if (name?.includes('postgres') || name?.includes('pg')) return 'postgresql';
          if (name?.includes('mysql') || name?.includes('maria')) return 'mysql';
          if (name?.includes('mongo')) return 'mongodb';
          if (name?.includes('redis')) return 'redis';
          if (name?.includes('sqlite')) return 'sqlite';
          return 'postgresql'; // fallback
        };

        // Determine version based on database type
        const getDatabaseVersion = (dbType: string, explicitVersion?: string) => {
          if (explicitVersion) return explicitVersion;
          switch (dbType) {
            case 'postgresql':
              return '15';
            case 'mysql':
              return '8.0';
            case 'mongodb':
              return '7.0';
            case 'redis':
              return '7.2';
            case 'sqlite':
              return '3';
            default:
              return 'latest';
          }
        };

        const dbType = getDatabaseType(artifact.framework, artifact.name);
        const version = getDatabaseVersion(dbType, artifact.metadata?.version);

        databases[dbName] = {
          name: artifact.name, // Use the original name from docker-compose.yml
          type: dbType,
          version,
          metadata: {
            ...artifact.metadata,
            configFile: artifact.metadata?.configFile,
            detected: true,
            language: artifact.language || 'sql',
            framework: artifact.framework || dbType,
          },
        };
      }

      // Build other artifacts (clients, tools, modules), excluding those merged into services
      const components: Record<string, any> = {};
      const otherArtifacts = artifacts.filter(
        (a: any) =>
          !['service', 'database', 'deployment'].includes(a.type) || !serviceNames.has(a.name)
      );

      for (const artifact of otherArtifacts) {
        const componentName = artifact.name.replace(/_/g, '-');

        const language = artifact.language || 'unknown';
        const framework = artifact.framework || 'unknown';

        let componentType = artifact.type;
        const detectedType = String(
          artifact.metadata?.detectedType || artifact.metadata?.classification?.detectedType || ''
        ).toLowerCase();
        const classificationReason = artifact.metadata?.classification?.reason;
        const packageData = artifact.metadata?.package || {};
        const hasCliBin = Boolean(
          typeof packageData.bin === 'string' ||
            (packageData.bin && Object.keys(packageData.bin).length > 0)
        );

        if (detectedType === 'tool' || classificationReason === 'manifest-bin' || hasCliBin) {
          componentType = 'tool';
        }

        components[componentName] = {
          name: artifact.name, // Use the original name
          type: componentType,
          description: artifact.description || artifact.metadata?.description || '',
          language,
          framework,
          metadata: {
            ...artifact.metadata,
            workspaceMember: artifact.metadata?.workspaceMember,
            filePath: artifact.file_path,
            detected: true,
          },
        };
      }

      const typeGroups = Object.values(components).reduce(
        (acc: Record<string, { count: number; names: string[] }>, component: any) => {
          const key = component.type || 'unknown';
          if (!acc[key]) {
            acc[key] = { count: 0, names: [] };
          }
          acc[key].count += 1;
          if (acc[key].names.length < 5) {
            acc[key].names.push(component.name);
          }
          return acc;
        },
        {}
      );

      console.log('[specs.resolved] aggregated components', {
        total: Object.keys(components).length,
        types: typeGroups,
      });

      // Aggregate frontend analysis from node packages
      const frontendPackages = artifacts
        .filter((artifact: any) => artifact.metadata?.frontendAnalysis)
        .map((artifact: any) => {
          const analysis = artifact.metadata.frontendAnalysis as any;
          const packageRoot = artifact.metadata?.root ?? '.';
          const packageJsonPath = artifact.metadata?.sourceFile ?? 'package.json';

          const componentEntries = (analysis.components || []).map((component: any) => ({
            name: component.name,
            filePath: component.filePath || '',
            framework: component.framework,
            description: component.description,
            props: component.props,
          }));

          const routeEntries = (analysis.routers || []).flatMap((router: any) =>
            (router.routes || []).map((route: any) => ({
              path: route.path,
              filePath: route.filePath || '',
              routerType:
                router.type || router.routerType || analysis.frameworks?.[0] || 'react-router',
            }))
          );

          return {
            packageName: artifact.name,
            packageRoot,
            packageJsonPath,
            frameworks: analysis.frameworks || [],
            components: componentEntries,
            routes: routeEntries,
          };
        });

      // Generate UI routes from detected frontend packages as primary source
      const derivedRoutes = frontendPackages.flatMap((pkg: any) =>
        (pkg.routes || []).map((route: any, idx: number) => {
          const safeIdSegment = (route.path || route.filePath || 'route')
            .replace(/[^a-zA-Z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .toLowerCase();
          const id = `${pkg.packageName.replace(/[^a-zA-Z0-9]+/g, '-')}-${safeIdSegment || idx}`;
          const displayName = route.path || route.filePath || `${pkg.packageName} route`;
          return {
            id,
            path: route.path || '/',
            name: displayName,
            component: route.filePath || displayName,
            capabilities: [],
            type: 'route',
            metadata: {
              packageName: pkg.packageName,
              packageRoot: pkg.packageRoot,
              routerType: route.routerType,
              filePath: route.filePath || null,
            },
          };
        })
      );

      const backendRoutes = serviceArtifacts.flatMap((artifact: any) => {
        const analysis = artifact.metadata?.tsoaAnalysis;
        if (!analysis) {
          console.debug('[specs.resolved] No TSOA analysis for service', {
            service: artifact.name,
          });
          return [] as any[];
        }

        const toSlug = (value: string) =>
          value
            .replace(/[^a-z0-9]+/gi, '-')
            .replace(/^-+|-+$/g, '')
            .toLowerCase();

        const rawServiceName = artifact.name.replace(/^@[^/]+\//, '') || artifact.name;
        const slugRoot = toSlug(artifact.name) || 'service';
        const serviceSlug = toSlug(rawServiceName) || slugRoot;
        const baseRoutePath = `/${serviceSlug}`.replace(/\/+/g, '/');

        const baseMetadata = {
          source: 'tsoa',
          serviceName: artifact.name,
          serviceDisplayName: rawServiceName,
          packageName: rawServiceName,
          packageRoot: artifact.metadata?.root || '.',
          routerType: 'tsoa',
          routeBasePath: baseRoutePath,
        };

        const routesForService: any[] = [
          {
            id: `backend-${slugRoot}-root`,
            path: baseRoutePath,
            name: baseRoutePath,
            component: `${rawServiceName} service`,
            capabilities: [],
            type: 'route',
            metadata: {
              ...baseMetadata,
              displayName: baseRoutePath,
              routePath: baseRoutePath,
            },
            displayLabel: baseRoutePath,
          },
        ];

        const controllerCandidates = Array.isArray(analysis.controllerCandidates)
          ? analysis.controllerCandidates
          : [];

        if (controllerCandidates.length === 0) {
          console.debug('[specs.resolved] TSOA analysis missing controller candidates', {
            service: artifact.name,
            hasAnalysis: true,
            totalTypeScriptFiles: analysis.totalTypeScriptFiles,
            configFiles: analysis.configFiles,
            scriptsUsingTsoa: analysis.scriptsUsingTsoa,
          });
          return routesForService;
        }

        console.debug('[specs.resolved] TSOA controller candidates detected', {
          service: artifact.name,
          count: controllerCandidates.length,
        });

        controllerCandidates.forEach((candidate: string, index: number) => {
          const normalized = candidate.split('\\').join('/');
          const fileName = normalized.split('/').pop() || normalized;
          const baseSegment = toSlug(
            fileName
              .replace(/\.[tj]sx?$/i, '')
              .replace(/controller$/i, '')
              .replace(/route$/i, '')
          );
          const safeId = `${slugRoot}-${baseSegment || 'controller'}-${index}`;
          const routePath = baseSegment
            ? `${baseRoutePath}/${baseSegment}`.replace(/\/+/g, '/')
            : baseRoutePath;
          const displayNameBase = fileName
            .replace(/\.[tj]sx?$/i, '')
            .replace(/controller$/i, '')
            .replace(/route$/i, '')
            .replace(/[-_]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          const formatLabel = (value: string) =>
            value
              .split(/[-_\s]+/)
              .filter(Boolean)
              .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
              .join(' ');
          const displayName = displayNameBase
            ? formatLabel(displayNameBase)
            : formatLabel(rawServiceName);

          const route = {
            id: `backend-${safeId}`,
            path: routePath,
            name: displayName,
            component: normalized,
            capabilities: [],
            type: 'route',
            metadata: {
              ...baseMetadata,
              controllerPath: normalized,
              filePath: normalized,
              displayName,
              routePath,
            },
            displayLabel: routePath,
          };
          console.debug('[specs.resolved] emitting backend route', {
            service: artifact.name,
            id: route.id,
            path: route.path,
            packageName: route.metadata.packageName,
            filePath: route.metadata.filePath,
          });
          routesForService.push(route);
        });

        return routesForService;
      });

      const servicesWithBackendRoutes = new Set(
        backendRoutes.flatMap((route: any) => {
          const meta = route.metadata || {};
          const rawName = meta.serviceName as string | undefined;
          const displayName = meta.packageName as string | undefined;
          return [rawName, displayName].filter(
            (name): name is string => typeof name === 'string' && name.trim().length > 0
          );
        })
      );

      // Fallback: derive a small set of sample routes from components if no frontend analysis is available
      const allComponents = { ...services, ...components };
      const fallbackRoutes = Object.keys(allComponents)
        .slice(0, 5)
        .map(compName => {
          const comp = allComponents[compName];
          if (!comp) return null;
          const baseId = compName
            .replace('-service', '')
            .replace('service-', '')
            .replace('@arbiter/', '');
          if (
            servicesWithBackendRoutes.has(comp.name) ||
            servicesWithBackendRoutes.has(compName) ||
            servicesWithBackendRoutes.has(baseId)
          ) {
            return null;
          }
          const safeIdSegment = baseId.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
          return {
            id: `fallback-${safeIdSegment}`,
            path: `/${baseId}`,
            name: comp.name,
            component: `${baseId.charAt(0).toUpperCase() + baseId.slice(1)}Page`,
            capabilities:
              comp.metadata?.scope === 'arbiter-package' ? ['api-access'] : ['read-data'],
            type: comp.type || 'route',
            metadata: {
              source: 'fallback',
            },
          };
        })
        .filter((route): route is any => Boolean(route));

      const routeMap = new Map<string, any>();
      derivedRoutes.forEach((route: any) => {
        routeMap.set(route.id, route);
      });
      backendRoutes.forEach((route: any) => {
        routeMap.set(route.id, route);
      });
      fallbackRoutes.forEach((route: any) => {
        if (!routeMap.has(route.id)) {
          routeMap.set(route.id, route);
        }
      });

      const routes = Array.from(routeMap.values());

      return c.json({
        success: true,
        projectId,
        resolved: {
          apiVersion: 'v2',
          kind: 'Application',
          metadata: {
            name: project.name,
            version: project.version || '1.0.0',
            brownfield: true,
            detectedServices: serviceArtifacts.length,
            detectedDatabases: databaseArtifacts.length,
            totalArtifacts: artifacts.length,
          },
          spec: {
            services,
            databases,
            components,
            frontend: {
              packages: frontendPackages,
            },
            ui: {
              routes,
            },
            flows: [
              {
                id: 'service-flow',
                name: 'Service Integration Flow',
                steps: [{ visit: '/' }, { expect_api: { method: 'GET', path: '/health' } }],
              },
            ],
            capabilities: {
              'read-data': {
                name: 'Read Data',
                description: 'Capability to read application data',
              },
            },
          },
        },
      });
    } catch (error) {
      console.error('Error fetching resolved spec:', error);
      return c.json({ error: 'Failed to fetch project specification' }, 500);
    }
  });

  return router;
}
