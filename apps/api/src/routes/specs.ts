import path from 'path';
import fs from 'fs-extra';
import { Hono } from 'hono';
import ts from 'typescript';

const HTTP_METHOD_DECORATORS = new Map<string, string>([
  ['Get', 'GET'],
  ['Post', 'POST'],
  ['Put', 'PUT'],
  ['Patch', 'PATCH'],
  ['Delete', 'DELETE'],
  ['Head', 'HEAD'],
  ['Options', 'OPTIONS'],
]);

const HTTP_METHOD_ORDER = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];

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

        const metadata: Record<string, unknown> = {
          ...artifact.metadata,
          language,
          framework,
          workspaceMember: artifact.metadata?.workspaceMember,
          filePath: artifact.file_path,
          detected: true,
          originalImage: actualImage, // Keep track of original detected image
          buildContext: artifact.metadata?.buildContext,
          dockerfilePath: artifact.metadata?.dockerfile,
          dockerfile: artifact.metadata?.dockerfile,
        };

        const dockerInfo = artifact.metadata?.docker;
        if (dockerInfo && typeof dockerInfo === 'object') {
          metadata.docker = dockerInfo;

          const composeYaml = (dockerInfo as Record<string, unknown>).composeServiceYaml;
          if (typeof composeYaml === 'string') {
            metadata.composeServiceYaml = composeYaml;
          }

          const composeService = (dockerInfo as Record<string, unknown>).composeService;
          if (composeService && typeof composeService === 'object') {
            metadata.composeService = composeService;
          }

          const composeName = (dockerInfo as Record<string, unknown>).composeServiceName;
          if (typeof composeName === 'string') {
            metadata.composeServiceName = composeName;
          }

          const composeFile = (dockerInfo as Record<string, unknown>).composeFile;
          if (typeof composeFile === 'string') {
            metadata.composeFile = composeFile;
          }

          const dockerfileContent = (dockerInfo as Record<string, unknown>).dockerfile;
          if (typeof dockerfileContent === 'string' && dockerfileContent.trim()) {
            metadata.dockerfileContent = dockerfileContent;
          }

          const buildContext = (dockerInfo as Record<string, unknown>).buildContext;
          if (typeof buildContext === 'string') {
            metadata.buildContext = buildContext;
          }

          const dockerfilePath = (dockerInfo as Record<string, unknown>).dockerfilePath;
          if (typeof dockerfilePath === 'string') {
            metadata.dockerfilePath = dockerfilePath;
          }
        }

        services[serviceName] = {
          name: artifact.name, // Use the original name from docker-compose.yml
          type: 'service',
          image: imageToUse,
          ports: [{ port, targetPort: port }],
          metadata,
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

        if (componentType === 'frontend' && artifact.metadata?.frontendAnalysis) {
          continue;
        }

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
              source: 'frontend-detection',
            },
          };
        })
      );

      const backendRoutes: any[] = [];

      const toSlug = (value: string) =>
        value
          .replace(/[^a-z0-9]+/gi, '-')
          .replace(/^-+|-+$/g, '')
          .toLowerCase();

      const resolveControllerPath = async (
        relatives: string[],
        normalized: string
      ): Promise<string | null> => {
        for (const relative of relatives) {
          if (!relative) continue;
          const absoluteRoot = path.isAbsolute(relative) ? relative : path.resolve(relative);
          const attempt = path.resolve(absoluteRoot, normalized);
          if (await fs.pathExists(attempt)) {
            return attempt;
          }
        }

        const fallback = path.resolve(normalized);
        if (await fs.pathExists(fallback)) {
          return fallback;
        }

        return null;
      };

      const extractControllerDetails = async (
        controllerAbsolute: string
      ): Promise<{
        httpMethods: string[];
        endpoints: Array<{
          method: string;
          path?: string;
          fullPath?: string;
          handler?: string;
          signature: string;
          returnType?: string;
          documentation?: {
            summary?: string;
            description?: string;
            returns?: string;
            remarks?: string[];
            examples?: string[];
            deprecated?: string | boolean;
          };
          parameters: Array<{
            name: string;
            type?: string;
            optional: boolean;
            description?: string;
            decorators?: string[];
          }>;
          responses: Array<{
            status?: string;
            description?: string;
            decorator: 'SuccessResponse' | 'Response';
          }>;
          tags?: string[];
          source?: { line: number };
        }>;
        routeDecorator?: string;
        tags: string[];
        className?: string;
      }> => {
        try {
          const content = await fs.readFile(controllerAbsolute, 'utf-8');
          const sourceFile = ts.createSourceFile(
            controllerAbsolute,
            content,
            ts.ScriptTarget.Latest,
            true,
            ts.ScriptKind.TS
          );

          const methodSet = new Set<string>();
          const endpoints: Array<{
            method: string;
            path?: string;
            fullPath?: string;
            handler?: string;
            signature: string;
            returnType?: string;
            documentation?: {
              summary?: string;
              description?: string;
              returns?: string;
              remarks?: string[];
              examples?: string[];
              deprecated?: string | boolean;
            };
            parameters: Array<{
              name: string;
              type?: string;
              optional: boolean;
              description?: string;
              decorators?: string[];
            }>;
            responses: Array<{
              status?: string;
              description?: string;
              decorator: 'SuccessResponse' | 'Response';
            }>;
            tags?: string[];
            source?: { line: number };
          }> = [];
          const tagsSet = new Set<string>();
          let routeDecorator: string | undefined;
          let className: string | undefined;

          const normalizeComment = (
            comment?: string | ts.NodeArray<ts.JSDocComment>
          ): string | undefined => {
            if (!comment) {
              return undefined;
            }
            if (typeof comment === 'string') {
              return comment.trim();
            }
            const text = comment
              .map(part => {
                if (typeof part === 'string') {
                  return part;
                }
                if ('text' in part && typeof (part as { text?: unknown }).text === 'string') {
                  return String(part.text);
                }
                return part.getText(sourceFile);
              })
              .join('');
            return text.trim();
          };

          const getDecorators = (node: ts.Node): readonly ts.Decorator[] => {
            const direct = (node as { decorators?: readonly ts.Decorator[] }).decorators;
            if (direct && direct.length > 0) {
              return direct;
            }
            if (
              typeof (ts as any).canHaveDecorators === 'function' &&
              (ts as any).canHaveDecorators(node)
            ) {
              const resolved = (ts as any).getDecorators?.(node);
              if (resolved && resolved.length > 0) {
                return resolved;
              }
            }
            return [];
          };

          const parseDecorator = (
            decorator: ts.Decorator
          ): { name: string; arguments: readonly ts.Expression[] } | null => {
            const expression = decorator.expression;
            if (ts.isCallExpression(expression)) {
              const callee = expression.expression;
              const name = ts.isIdentifier(callee)
                ? callee.text
                : ts.isPropertyAccessExpression(callee)
                  ? callee.name.text
                  : callee.getText(sourceFile);
              return { name, arguments: expression.arguments };
            }
            if (ts.isIdentifier(expression)) {
              return { name: expression.text, arguments: [] };
            }
            if (ts.isPropertyAccessExpression(expression)) {
              return { name: expression.name.text, arguments: [] };
            }
            return { name: expression.getText(sourceFile), arguments: [] };
          };

          const combinePaths = (base?: string, sub?: string): string | undefined => {
            if (!base && !sub) return undefined;
            if (!base) return sub;
            if (!sub) return base;
            const trimmedBase = base.endsWith('/') ? base.slice(0, -1) : base;
            const trimmedSub = sub.startsWith('/') ? sub : `/${sub}`;
            return `${trimmedBase}${trimmedSub}`.replace(/\/+/g, '/');
          };

          const recordHttpMethod = (method: string) => {
            if (!method) return;
            methodSet.add(method);
          };

          const httpOrderSort = (values: Iterable<string>) => {
            return Array.from(values).sort((a, b) => {
              const aIndex = HTTP_METHOD_ORDER.indexOf(a);
              const bIndex = HTTP_METHOD_ORDER.indexOf(b);
              if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
              if (aIndex === -1) return 1;
              if (bIndex === -1) return -1;
              return aIndex - bIndex;
            });
          };

          const controllers: ts.ClassDeclaration[] = [];
          sourceFile.forEachChild(node => {
            if (ts.isClassDeclaration(node)) {
              controllers.push(node);
            }
          });

          for (const controller of controllers) {
            if (!className && controller.name) {
              className = controller.name.text;
            }

            for (const decorator of getDecorators(controller)) {
              const parsed = parseDecorator(decorator);
              if (!parsed) continue;
              const decoratorName = parsed.name;
              if (decoratorName === 'Route' && parsed.arguments[0]) {
                const arg = parsed.arguments[0];
                if (ts.isStringLiteralLike(arg)) {
                  routeDecorator = arg.text;
                } else {
                  routeDecorator = arg.getText(sourceFile);
                }
              }
              if (decoratorName === 'Tags') {
                parsed.arguments.forEach(arg => {
                  if (ts.isStringLiteralLike(arg)) {
                    tagsSet.add(arg.text);
                  } else {
                    const text = arg.getText(sourceFile);
                    if (text) {
                      tagsSet.add(text);
                    }
                  }
                });
              }
            }

            controller.members.forEach(member => {
              if (!ts.isMethodDeclaration(member)) {
                return;
              }

              const methodDecorators = getDecorators(member);
              if (!methodDecorators.length) {
                return;
              }

              let httpMethodName: string | undefined;
              let subPath: string | undefined;
              const endpointTags = new Set<string>();
              const responses: Array<{
                status?: string;
                description?: string;
                decorator: 'SuccessResponse' | 'Response';
              }> = [];
              let deprecatedViaDecorator: string | boolean | undefined;

              for (const decorator of methodDecorators) {
                const parsed = parseDecorator(decorator);
                if (!parsed) continue;
                const decoratorName = parsed.name;
                const normalizedMethod =
                  HTTP_METHOD_DECORATORS.get(decoratorName) || decoratorName.toUpperCase();
                if (
                  HTTP_METHOD_DECORATORS.has(decoratorName) ||
                  HTTP_METHOD_DECORATORS.has(normalizedMethod)
                ) {
                  httpMethodName = HTTP_METHOD_DECORATORS.get(decoratorName) || normalizedMethod;
                  const firstArg = parsed.arguments[0];
                  if (firstArg) {
                    if (ts.isStringLiteralLike(firstArg)) {
                      subPath = firstArg.text || undefined;
                    } else {
                      const text = firstArg.getText(sourceFile).trim();
                      subPath = text || undefined;
                    }
                  }
                  continue;
                }

                if (decoratorName === 'Tags') {
                  parsed.arguments.forEach(arg => {
                    if (ts.isStringLiteralLike(arg)) {
                      endpointTags.add(arg.text);
                      tagsSet.add(arg.text);
                    } else {
                      const text = arg.getText(sourceFile);
                      if (text) {
                        endpointTags.add(text);
                        tagsSet.add(text);
                      }
                    }
                  });
                  continue;
                }

                if (decoratorName === 'SuccessResponse' || decoratorName === 'Response') {
                  const statusArg = parsed.arguments[0];
                  const descriptionArg = parsed.arguments[1];
                  const status = statusArg
                    ? ts.isStringLiteralLike(statusArg)
                      ? statusArg.text
                      : statusArg.getText(sourceFile)
                    : undefined;
                  const description = descriptionArg
                    ? ts.isStringLiteralLike(descriptionArg)
                      ? descriptionArg.text
                      : descriptionArg.getText(sourceFile)
                    : undefined;
                  responses.push({
                    status,
                    description,
                    decorator: decoratorName as 'SuccessResponse' | 'Response',
                  });
                  continue;
                }

                if (decoratorName === 'Deprecated') {
                  const reasonArg = parsed.arguments[0];
                  deprecatedViaDecorator = reasonArg
                    ? ts.isStringLiteralLike(reasonArg)
                      ? reasonArg.text
                      : reasonArg.getText(sourceFile)
                    : true;
                }
              }

              if (!httpMethodName) {
                return;
              }

              recordHttpMethod(httpMethodName);

              const docsAccumulator = {
                summary: undefined as string | undefined,
                description: undefined as string | undefined,
                returns: undefined as string | undefined,
                remarks: [] as string[],
                examples: [] as string[],
                deprecated: deprecatedViaDecorator as string | boolean | undefined,
                paramComments: new Map<string, string>(),
              };

              const jsDocs = (member as { jsDoc?: readonly ts.JSDoc[] }).jsDoc ?? [];
              for (const jsDoc of jsDocs) {
                const comment = normalizeComment(jsDoc.comment);
                if (comment) {
                  if (!docsAccumulator.summary) {
                    const [firstLine, ...rest] = comment.split(/\r?\n/);
                    docsAccumulator.summary = firstLine?.trim() || undefined;
                    const remainder = rest.join('\n').trim();
                    if (remainder) {
                      docsAccumulator.description = remainder;
                    }
                  } else {
                    const joined = docsAccumulator.description
                      ? `${docsAccumulator.description}\n${comment}`
                      : comment;
                    docsAccumulator.description = joined.trim();
                  }
                }

                (jsDoc.tags ?? []).forEach(tag => {
                  const tagName = tag.tagName.text.toLowerCase();
                  const tagComment = normalizeComment(tag.comment);

                  if (ts.isJSDocParameterTag(tag)) {
                    const paramName = tag.name.getText(sourceFile);
                    if (paramName && tagComment) {
                      docsAccumulator.paramComments.set(paramName, tagComment);
                    }
                    return;
                  }

                  if (tagName === 'returns' || tagName === 'return') {
                    if (tagComment) {
                      docsAccumulator.returns = docsAccumulator.returns
                        ? `${docsAccumulator.returns}\n${tagComment}`
                        : tagComment;
                    }
                    return;
                  }

                  if (tagName === 'example' && tagComment) {
                    docsAccumulator.examples.push(tagComment);
                    return;
                  }

                  if (tagName === 'remarks' && tagComment) {
                    docsAccumulator.remarks.push(tagComment);
                    return;
                  }

                  if (tagName === 'deprecated') {
                    docsAccumulator.deprecated = tagComment || true;
                  }
                });
              }

              const parameterDetails = member.parameters.map(param => {
                const name = param.name.getText(sourceFile);
                const type = param.type ? param.type.getText(sourceFile) : undefined;
                const optional = Boolean(param.questionToken || param.initializer);
                const parameterDecorators = getDecorators(param).map(decorator => {
                  const parsed = parseDecorator(decorator);
                  return parsed?.name;
                });
                const decoratorsCleaned = parameterDecorators.filter((value): value is string =>
                  Boolean(value)
                );

                return {
                  name,
                  type,
                  optional,
                  description: docsAccumulator.paramComments.get(name),
                  decorators: decoratorsCleaned.length > 0 ? decoratorsCleaned : undefined,
                };
              });

              const handlerName = member.name?.getText(sourceFile) ?? 'handler';
              const returnType = member.type ? member.type.getText(sourceFile) : undefined;
              const signatureParameters = parameterDetails
                .map(param => {
                  const optionalMark = param.optional ? '?' : '';
                  const typePart = param.type ? `: ${param.type}` : '';
                  return `${param.name}${optionalMark}${typePart}`;
                })
                .join(', ');
              const signature = `${handlerName}(${signatureParameters})${returnType ? `: ${returnType}` : ''}`;

              const documentationPayload = {
                summary: docsAccumulator.summary,
                description: docsAccumulator.description,
                returns: docsAccumulator.returns,
                remarks: docsAccumulator.remarks.length ? docsAccumulator.remarks : undefined,
                examples: docsAccumulator.examples.length ? docsAccumulator.examples : undefined,
                deprecated: docsAccumulator.deprecated,
              };
              const hasDocumentation = Boolean(
                documentationPayload.summary ||
                  documentationPayload.description ||
                  documentationPayload.returns ||
                  (documentationPayload.remarks && documentationPayload.remarks.length > 0) ||
                  (documentationPayload.examples && documentationPayload.examples.length > 0) ||
                  documentationPayload.deprecated
              );

              const position = sourceFile.getLineAndCharacterOfPosition(member.getStart());
              const endpoint = {
                method: httpMethodName,
                path: subPath,
                fullPath: combinePaths(routeDecorator, subPath),
                handler: handlerName,
                signature,
                returnType,
                documentation: hasDocumentation ? documentationPayload : undefined,
                parameters: parameterDetails.map(param => ({
                  name: param.name,
                  type: param.type,
                  optional: param.optional,
                  description: param.description,
                  decorators: param.decorators,
                })),
                responses,
                tags: endpointTags.size ? Array.from(endpointTags) : undefined,
                source: { line: position.line + 1 },
              };

              endpoints.push(endpoint);
            });
          }

          const httpMethods = httpOrderSort(methodSet);

          return {
            httpMethods,
            endpoints,
            routeDecorator,
            tags: Array.from(tagsSet),
            className,
          };
        } catch (error) {
          console.warn('[specs.resolved] Failed to analyze TSOA controller via TypeScript API', {
            controller: controllerAbsolute,
            error,
          });
          return { httpMethods: [], endpoints: [], routeDecorator: undefined, tags: [] };
        }
      };

      for (const artifact of serviceArtifacts) {
        const analysis = artifact.metadata?.tsoaAnalysis;
        if (!analysis) {
          console.debug('[specs.resolved] No TSOA analysis for service', {
            service: artifact.name,
          });
          continue;
        }

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
          continue;
        }

        console.debug('[specs.resolved] TSOA controller candidates detected', {
          service: artifact.name,
          count: controllerCandidates.length,
        });

        const tsoaSummary = {
          hasTsoaDependency: Boolean(analysis.hasTsoaDependency),
          recommendedCommands: Array.isArray(analysis.recommendedCommands)
            ? analysis.recommendedCommands
            : [],
          configFiles: Array.isArray(analysis.configFiles) ? analysis.configFiles.slice(0, 5) : [],
          scriptsUsingTsoa: Array.isArray(analysis.scriptsUsingTsoa)
            ? analysis.scriptsUsingTsoa
            : [],
          totalTypeScriptFiles: analysis.totalTypeScriptFiles ?? 0,
        };

        const rootDisplayLabel = '/';
        const aggregatedEndpoints: Array<{ method: string; path?: string; controller?: string }> =
          [];
        const aggregatedMethods = new Set<string>();

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
              displayName: rootDisplayLabel,
              routePath: baseRoutePath,
              isBaseRoute: true,
              httpMethods: [],
              endpoints: [],
              tsoa: tsoaSummary,
            },
            displayLabel: rootDisplayLabel,
            httpMethods: [],
            endpoints: [],
          },
        ];

        let anyControllerSourceAvailable = false;

        for (const [index, candidate] of controllerCandidates.entries()) {
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

          const candidateRoots = [
            analysis.root,
            artifact.metadata?.root,
            artifact.metadata?.packageRoot,
            path.dirname(artifact.file_path || ''),
          ].filter(
            (value): value is string => typeof value === 'string' && value.trim().length > 0
          );

          const controllerAbsolute = await resolveControllerPath(candidateRoots, normalized);
          const controllerSourceAvailable = Boolean(controllerAbsolute);
          const controllerDetails = controllerAbsolute
            ? await extractControllerDetails(controllerAbsolute)
            : {
                httpMethods: [],
                endpoints: [],
                routeDecorator: undefined,
                tags: [],
                className: undefined,
              };

          if (controllerSourceAvailable) {
            anyControllerSourceAvailable = true;
          }

          controllerDetails.httpMethods.forEach(method => aggregatedMethods.add(method));
          const enrichedEndpoints = controllerDetails.endpoints.map(endpoint => ({
            ...endpoint,
            controller: displayName,
          }));
          enrichedEndpoints.forEach(endpoint => {
            aggregatedEndpoints.push(endpoint);
          });

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
              httpMethods: controllerDetails.httpMethods,
              endpoints: enrichedEndpoints,
              routeDecorator: controllerDetails.routeDecorator,
              tags: controllerDetails.tags,
              controllerClass: controllerDetails.className,
              controllerSourceAvailable,
              tsoa: {
                ...tsoaSummary,
                controllerTags: controllerDetails.tags,
                controllerClass: controllerDetails.className,
                controllerSourceAvailable,
              },
            },
            displayLabel: displayName,
            httpMethods: controllerDetails.httpMethods,
            endpoints: enrichedEndpoints,
          };
          console.debug('[specs.resolved] emitting backend route', {
            service: artifact.name,
            id: route.id,
            path: route.path,
            packageName: route.metadata.packageName,
            filePath: route.metadata.filePath,
            httpMethods: route.httpMethods,
          });
          routesForService.push(route);
        }

        routesForService[0].metadata.httpMethods = Array.from(aggregatedMethods);
        routesForService[0].metadata.endpoints = aggregatedEndpoints;
        routesForService[0].httpMethods = Array.from(aggregatedMethods);
        routesForService[0].endpoints = aggregatedEndpoints;
        routesForService[0].metadata.tsoa = {
          ...routesForService[0].metadata.tsoa,
          controllerSourceAvailable: anyControllerSourceAvailable,
        };
        routesForService[0].metadata.controllerSourceAvailable = anyControllerSourceAvailable;

        backendRoutes.push(...routesForService);
      }

      const routeMap = new Map<string, any>();
      derivedRoutes.forEach((route: any) => {
        routeMap.set(route.id, route);
      });
      backendRoutes.forEach((route: any) => {
        routeMap.set(route.id, route);
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
