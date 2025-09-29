/**
 * TypeScript Language Plugin - React + Vite + Next.js support with template overrides
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  BuildConfig,
  ComponentConfig,
  GeneratedFile,
  GenerationResult,
  LanguagePlugin,
  LanguagePluginConfigureOptions,
  ProjectConfig,
  ServiceConfig,
} from './index.js';
import { TemplateResolver } from './template-resolver.js';

type FrameworkOption = 'vite' | 'nextjs';
type StylingOption = 'css-modules' | 'tailwind' | 'styled-components';
type TestRunnerOption = 'vitest' | 'jest';

interface TypeScriptRuntimeOptions {
  framework: FrameworkOption;
  styling: StylingOption;
  stateManagement?: string;
  testRunner: TestRunnerOption;
  templateResolver: TemplateResolver;
}

interface ComponentTemplateContext extends Record<string, unknown> {
  componentName: string;
  componentDescription: string;
  propsImport: string;
  cssImport: string;
  propsParam: string;
  containerClass: string;
  propsInterface: string;
  testProps: string;
  hasProps: boolean;
}

interface ServiceTemplateContext extends Record<string, unknown> {
  serviceName: string;
  routerName: string;
  serviceInstanceName: string;
  handlerInstanceName: string;
}

interface ViteProjectTemplateContext extends Record<string, unknown> {
  packageJson: string;
  tsconfig: string;
  tsconfigBuild: string;
  projectName: string;
  projectDescription: string;
  devServerPort: number;
  additionalBuildConfig: string;
}

interface NextProjectTemplateContext extends Record<string, unknown> {
  packageJson: string;
  tsconfig: string;
  projectName: string;
  projectDescription: string;
}

export class TypeScriptPlugin implements LanguagePlugin {
  readonly name = 'TypeScript Plugin';
  readonly language = 'typescript';
  readonly version = '1.1.0';
  readonly description = 'Modern TypeScript with React, Vite, and Next.js support';
  readonly supportedFeatures = [
    'components',
    'hooks',
    'api',
    'routing',
    'state-management',
    'testing',
    'styling',
    'build-optimization',
    'type-safety',
  ];
  readonly capabilities = {
    components: true,
    services: true,
    testing: true,
    api: true,
  } as const;

  private runtime: TypeScriptRuntimeOptions;

  constructor() {
    const templateResolver = new TemplateResolver({
      language: 'typescript',
      defaultDirectories: TypeScriptPlugin.resolveDefaultTemplateDirectories(),
    });

    this.runtime = {
      framework: 'vite',
      styling: 'css-modules',
      testRunner: 'vitest',
      templateResolver,
    };
  }

  configure(options: LanguagePluginConfigureOptions): void {
    const overrides = Array.isArray(options.templateOverrides)
      ? options.templateOverrides
      : options.templateOverrides
        ? [options.templateOverrides]
        : [];

    this.runtime.templateResolver.setOverrideDirectories(overrides);

    const pluginConfig = (options.pluginConfig ?? {}) as Record<string, unknown>;
    this.runtime.framework = this.normalizeFramework(pluginConfig);
    this.runtime.styling = this.normalizeStyling(pluginConfig);
    this.runtime.stateManagement = this.normalizeStateManagement(pluginConfig);
    this.runtime.testRunner = this.normalizeTestRunner(pluginConfig);
  }

  async generateComponent(config: ComponentConfig): Promise<GenerationResult> {
    const files: GeneratedFile[] = [];
    const dependencies: string[] = [];

    const context = this.buildComponentContext(config);

    const componentContent = await this.runtime.templateResolver.renderTemplate(
      'component.tsx.tpl',
      context,
      this.getDefaultComponentTemplate(context)
    );

    files.push({
      path: `src/components/${config.name}/${config.name}.tsx`,
      content: componentContent,
    });

    const typesContent = await this.runtime.templateResolver.renderTemplate(
      'component.types.ts.tpl',
      context,
      this.getDefaultComponentTypesTemplate(context)
    );

    files.push({
      path: `src/components/${config.name}/types.ts`,
      content: typesContent,
    });

    if (config.styles) {
      const stylesContent = await this.runtime.templateResolver.renderTemplate(
        'component.module.css.tpl',
        context,
        this.getDefaultComponentStylesTemplate(context)
      );
      files.push({
        path: `src/components/${config.name}/${config.name}.module.css`,
        content: stylesContent,
      });
    }

    if (config.tests) {
      const testContent = await this.runtime.templateResolver.renderTemplate(
        'component.test.tsx.tpl',
        context,
        this.getDefaultComponentTestTemplate(context)
      );
      files.push({
        path: `src/components/${config.name}/${config.name}.test.tsx`,
        content: testContent,
      });
      dependencies.push('@testing-library/react', '@testing-library/jest-dom');
    }

    files.push({
      path: `src/components/${config.name}/index.ts`,
      content: `export { ${config.name} } from './${config.name}';\nexport type { ${config.name}Props } from './types';`,
    });

    return {
      files,
      dependencies,
      instructions: [
        `Component ${config.name} created successfully`,
        `Import with: import { ${config.name} } from "./components/${config.name}";`,
      ],
    };
  }

  async generateService(config: ServiceConfig): Promise<GenerationResult> {
    const files: GeneratedFile[] = [];
    const dependencies: string[] = ['express', '@types/express'];

    const context = this.buildServiceContext(config);

    switch (config.type) {
      case 'api': {
        const apiContent = await this.runtime.templateResolver.renderTemplate(
          'service.api.ts.tpl',
          context,
          this.getDefaultApiServiceTemplate(context)
        );
        files.push({ path: `src/api/${config.name}.ts`, content: apiContent });
        break;
      }
      case 'service': {
        const serviceContent = await this.runtime.templateResolver.renderTemplate(
          'service.class.ts.tpl',
          context,
          this.getDefaultBusinessServiceTemplate(context)
        );
        files.push({ path: `src/services/${config.name}.service.ts`, content: serviceContent });
        break;
      }
      case 'handler': {
        const handlerContent = await this.runtime.templateResolver.renderTemplate(
          'service.handler.ts.tpl',
          context,
          this.getDefaultHandlerTemplate(context)
        );
        files.push({ path: `src/handlers/${config.name}.handler.ts`, content: handlerContent });
        break;
      }
      default:
        break;
    }

    if (config.validation) {
      const schemaContent = await this.runtime.templateResolver.renderTemplate(
        'service.schema.ts.tpl',
        context,
        this.getDefaultSchemaTemplate(context)
      );
      files.push({ path: `src/schemas/${config.name}.schema.ts`, content: schemaContent });
      dependencies.push('zod');
    }

    return { files, dependencies };
  }

  async initializeProject(config: ProjectConfig): Promise<GenerationResult> {
    if (this.runtime.framework === 'nextjs') {
      return this.initializeNextProject(config);
    }

    return this.initializeViteProject(config);
  }

  async generateBuildConfig(config: BuildConfig): Promise<GenerationResult> {
    if (this.runtime.framework === 'nextjs') {
      const nextConfig = await this.runtime.templateResolver.renderTemplate(
        'project/nextjs/next.config.js.tpl',
        {},
        `/** @type {import('next').NextConfig} */\nconst nextConfig = {\n  reactStrictMode: true,\n  experimental: {\n    appDir: true,\n  },\n};\n\nexport default nextConfig;\n`
      );

      return {
        files: [
          {
            path: 'next.config.js',
            content: nextConfig,
          },
        ],
      };
    }

    const additional = config.optimization
      ? `\n    rollupOptions: {\n      output: {\n        manualChunks: {\n          vendor: ['react', 'react-dom'],\n        },\n      },\n    },`
      : '';

    const templateContext: ViteProjectTemplateContext = {
      packageJson: '',
      tsconfig: '',
      tsconfigBuild: '',
      projectName: '',
      projectDescription: '',
      devServerPort: 3000,
      additionalBuildConfig: additional
        ? `\n    minify: '${config.target === 'production' ? 'terser' : 'esbuild'}',${additional}`
        : `\n    minify: '${config.target === 'production' ? 'terser' : 'esbuild'}',`,
    };

    const content = await this.runtime.templateResolver.renderTemplate(
      'project/vite/vite.config.ts.tpl',
      templateContext,
      `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\n\nexport default defineConfig({\n  plugins: [react()],\n  server: {\n    port: 3000,\n  },\n  build: {\n    target: 'es2022',\n    sourcemap: true${templateContext.additionalBuildConfig}\n  },\n  test: {\n    globals: true,\n    environment: 'jsdom',\n    setupFiles: ['./src/test-setup.ts'],\n  },\n});\n`
    );

    const files: GeneratedFile[] = [{ path: 'vite.config.ts', content }];

    if (config.target === 'production') {
      const tsconfigBuild = await this.runtime.templateResolver.renderTemplate(
        'project/vite/tsconfig.build.json.tpl',
        {
          packageJson: '',
          tsconfig: '',
          tsconfigBuild: JSON.stringify(
            {
              extends: './tsconfig.json',
              compilerOptions: {
                noEmit: false,
                declaration: true,
                outDir: './dist',
              },
              exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
            },
            null,
            2
          ),
          projectName: '',
          projectDescription: '',
          devServerPort: 3000,
          additionalBuildConfig: '',
        },
        JSON.stringify(
          {
            extends: './tsconfig.json',
            compilerOptions: {
              noEmit: false,
              declaration: true,
              outDir: './dist',
            },
            exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
          },
          null,
          2
        )
      );

      files.push({ path: 'tsconfig.build.json', content: tsconfigBuild });
    }

    return { files };
  }

  private static resolveDefaultTemplateDirectories(): string[] {
    const moduleDir = path.dirname(fileURLToPath(import.meta.url));
    return [
      path.resolve(moduleDir, '../templates/typescript'),
      path.resolve(moduleDir, '../../templates/typescript'),
    ];
  }

  private buildComponentContext(config: ComponentConfig): ComponentTemplateContext {
    const hasProps = Array.isArray(config.props) && config.props.length > 0;
    const propsInterface = hasProps
      ? config
          .props!.map(prop => `  ${prop.name}${prop.required ? '' : '?'}: ${prop.type};`)
          .join('\n')
      : '  // No props defined';

    return {
      componentName: config.name,
      componentDescription: config.type === 'page' ? 'Page component' : 'Reusable UI component',
      propsImport: hasProps ? `import type { ${config.name}Props } from './types';` : '',
      cssImport: config.styles ? `import styles from './${config.name}.module.css';` : '',
      propsParam: hasProps ? `props: ${config.name}Props` : '',
      containerClass: config.styles ? ' className={styles.container}' : '',
      propsInterface,
      testProps: '',
      hasProps,
    };
  }

  private getDefaultComponentTemplate(context: ComponentTemplateContext): string {
    const imports = [context.propsImport, context.cssImport].filter(Boolean).join('\n');
    const importBlock = imports ? `${imports}\n\n` : '';
    const signature = context.hasProps ? `(${context.propsParam})` : '()';

    return `${importBlock}/**\n * ${context.componentName} Component\n * ${context.componentDescription}\n */\nexport function ${context.componentName}${signature} {\n  return (\n    <div${context.containerClass}>\n      <h1>${context.componentName}</h1>\n      {/* Component content */}\n    </div>\n  );\n}\n\n${context.componentName}.displayName = '${context.componentName}';\n`;
  }

  private getDefaultComponentTypesTemplate(context: ComponentTemplateContext): string {
    return `export interface ${context.componentName}Props {\n${context.propsInterface}\n}\n`;
  }

  private getDefaultComponentStylesTemplate(context: ComponentTemplateContext): string {
    return `.container {\n  /* ${context.componentName} component styles */\n  display: flex;\n  flex-direction: column;\n  gap: 1rem;\n}\n`;
  }

  private getDefaultComponentTestTemplate(context: ComponentTemplateContext): string {
    return `import { render, screen } from '@testing-library/react';\nimport { ${context.componentName} } from './${context.componentName}';\n\ndescribe('${context.componentName}', () => {\n  it('renders successfully', () => {\n    render(<${context.componentName} ${context.testProps}/>);\n    expect(screen.getByText('${context.componentName}')).toBeInTheDocument();\n  });\n});\n`;
  }

  private buildServiceContext(config: ServiceConfig): ServiceTemplateContext {
    const serviceName = config.name;
    const camel = serviceName.charAt(0).toLowerCase() + serviceName.slice(1);

    return {
      serviceName,
      routerName: `${serviceName}Router`,
      serviceInstanceName: `${camel}Service`,
      handlerInstanceName: `${camel}Handler`,
    };
  }

  private getDefaultApiServiceTemplate(context: ServiceTemplateContext): string {
    return `import express from 'express';\nimport type { Request, Response, NextFunction } from 'express';\n\nconst router = express.Router();\n\n/**\n * ${context.serviceName} API Routes\n * Handles all ${context.serviceName} related endpoints\n */\n\nrouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {\n  try {\n    res.json({ message: '${context.serviceName} API working' });\n  } catch (error) {\n    next(error);\n  }\n});\n\nrouter.post('/', async (_req: Request, res: Response, next: NextFunction) => {\n  try {\n    res.status(201).json({ message: '${context.serviceName} created' });\n  } catch (error) {\n    next(error);\n  }\n});\n\nexport { router as ${context.routerName} };\n`;
  }

  private getDefaultBusinessServiceTemplate(context: ServiceTemplateContext): string {
    return `/**\n * ${context.serviceName} Service\n * Business logic for ${context.serviceName} operations\n */\n\nexport class ${context.serviceName}Service {\n  async findAll(): Promise<any[]> {\n    throw new Error('Not implemented');\n  }\n\n  async findById(id: string): Promise<any> {\n    throw new Error('Not implemented');\n  }\n\n  async create(data: any): Promise<any> {\n    throw new Error('Not implemented');\n  }\n\n  async update(id: string, data: any): Promise<any> {\n    throw new Error('Not implemented');\n  }\n\n  async delete(id: string): Promise<void> {\n    throw new Error('Not implemented');\n  }\n}\n\nexport const ${context.serviceInstanceName} = new ${context.serviceName}Service();\n`;
  }

  private getDefaultHandlerTemplate(context: ServiceTemplateContext): string {
    return `import type { Request, Response, NextFunction } from 'express';\n\n/**\n * ${context.serviceName} Handler\n * HTTP request handlers for ${context.serviceName}\n */\n\nexport class ${context.serviceName}Handler {\n  async handleGet(_req: Request, res: Response, next: NextFunction) {\n    try {\n      res.json({ message: 'GET ${context.serviceName}' });\n    } catch (error) {\n      next(error);\n    }\n  }\n\n  async handlePost(_req: Request, res: Response, next: NextFunction) {\n    try {\n      res.status(201).json({ message: 'POST ${context.serviceName}' });\n    } catch (error) {\n      next(error);\n    }\n  }\n\n  async handlePut(_req: Request, res: Response, next: NextFunction) {\n    try {\n      res.json({ message: 'PUT ${context.serviceName}' });\n    } catch (error) {\n      next(error);\n    }\n  }\n\n  async handleDelete(_req: Request, res: Response, next: NextFunction) {\n    try {\n      res.status(204).send();\n    } catch (error) {\n      next(error);\n    }\n  }\n}\n\nexport const ${context.handlerInstanceName} = new ${context.serviceName}Handler();\n`;
  }

  private getDefaultSchemaTemplate(context: ServiceTemplateContext): string {
    return `import { z } from 'zod';\n\n/**\n * ${context.serviceName} Validation Schemas\n */\n\nexport const ${context.serviceName}Schema = z.object({\n  id: z.string().uuid().optional(),\n});\n\nexport const Create${context.serviceName}Schema = ${context.serviceName}Schema.omit({ id: true });\nexport const Update${context.serviceName}Schema = ${context.serviceName}Schema.partial();\n\nexport type ${context.serviceName} = z.infer<typeof ${context.serviceName}Schema>;\nexport type Create${context.serviceName} = z.infer<typeof Create${context.serviceName}Schema>;\nexport type Update${context.serviceName} = z.infer<typeof Update${context.serviceName}Schema>;\n`;
  }

  private async initializeViteProject(config: ProjectConfig): Promise<GenerationResult> {
    const files: GeneratedFile[] = [];
    const dependencies = this.collectViteDependencies();

    const packageJson = this.createVitePackageJson(config);
    const tsconfig = JSON.stringify(this.createViteTsconfig(), null, 2);
    const tsconfigBuild = JSON.stringify(this.createViteBuildTsconfig(), null, 2);

    const context: ViteProjectTemplateContext = {
      packageJson,
      tsconfig,
      tsconfigBuild,
      projectName: config.name,
      projectDescription: config.description || `A modern TypeScript project: ${config.name}`,
      devServerPort: 3000,
      additionalBuildConfig: '',
    };

    const packageContent = await this.runtime.templateResolver.renderTemplate(
      'project/vite/package.json.tpl',
      context,
      packageJson
    );
    files.push({ path: 'package.json', content: packageContent });

    const viteConfig = await this.runtime.templateResolver.renderTemplate(
      'project/vite/vite.config.ts.tpl',
      context,
      `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\n\nexport default defineConfig({\n  plugins: [react()],\n  server: {\n    port: 3000,\n  },\n  build: {\n    target: 'es2022',\n    sourcemap: true${context.additionalBuildConfig}\n  },\n  test: {\n    globals: true,\n    environment: 'jsdom',\n    setupFiles: ['./src/test-setup.ts'],\n  },\n});\n`
    );
    files.push({ path: 'vite.config.ts', content: viteConfig });

    const tsconfigContent = await this.runtime.templateResolver.renderTemplate(
      'project/vite/tsconfig.json.tpl',
      context,
      tsconfig
    );
    files.push({ path: 'tsconfig.json', content: tsconfigContent });

    const tsconfigBuildContent = await this.runtime.templateResolver.renderTemplate(
      'project/vite/tsconfig.build.json.tpl',
      context,
      tsconfigBuild
    );
    files.push({ path: 'tsconfig.build.json', content: tsconfigBuildContent });

    const appContent = await this.runtime.templateResolver.renderTemplate(
      'project/vite/App.tsx.tpl',
      context,
      `import { BrowserRouter } from 'react-router-dom';\nimport { Suspense } from 'react';\nimport { routes } from './routes';\nimport { AppRoutes } from './routes/AppRoutes';\nimport './App.css';\n\nexport function App() {\n  return (\n    <BrowserRouter>\n      <Suspense fallback={<div>Loading...</div>}>\n        <AppRoutes routes={routes} />\n      </Suspense>\n    </BrowserRouter>\n  );\n}\n\nexport default App;\n`
    );
    files.push({ path: 'src/App.tsx', content: appContent });

    const mainContent = await this.runtime.templateResolver.renderTemplate(
      'project/vite/main.tsx.tpl',
      context,
      `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport { App } from './App';\nimport './index.css';\n\nReactDOM.createRoot(document.getElementById('root')!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);\n`
    );
    files.push({ path: 'src/main.tsx', content: mainContent });

    const indexHtml = await this.runtime.templateResolver.renderTemplate(
      'project/vite/index.html.tpl',
      context,
      `<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <link rel="icon" type="image/svg+xml" href="/vite.svg" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>${config.name}</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.tsx"></script>\n  </body>\n</html>\n`
    );
    files.push({ path: 'index.html', content: indexHtml });

    files.push({ path: 'src/vite-env.d.ts', content: '/// <reference types="vite/client" />' });

    const testSetup = await this.runtime.templateResolver.renderTemplate(
      'project/vite/test-setup.ts.tpl',
      context,
      `import '@testing-library/jest-dom';\n`
    );
    files.push({ path: 'src/test-setup.ts', content: testSetup });

    const appCss = await this.runtime.templateResolver.renderTemplate(
      'project/vite/App.css.tpl',
      context,
      `:root {\n  color-scheme: light dark;\n  font-family: system-ui, sans-serif;\n}\n\nbody {\n  margin: 0;\n}\n`
    );
    files.push({ path: 'src/App.css', content: appCss });

    const indexCss = await this.runtime.templateResolver.renderTemplate(
      'project/vite/index.css.tpl',
      context,
      `:root {\n  color-scheme: light dark;\n  font-family: system-ui, sans-serif;\n}\n\nbody {\n  margin: 0;\n}\n`
    );
    files.push({ path: 'src/index.css', content: indexCss });

    return {
      files,
      dependencies,
      scripts: this.createViteScripts(),
    };
  }

  private async initializeNextProject(config: ProjectConfig): Promise<GenerationResult> {
    const files: GeneratedFile[] = [];
    const dependencies = this.collectNextDependencies();

    const packageJson = JSON.stringify(this.createNextPackageJson(config), null, 2);
    const tsconfig = JSON.stringify(this.createNextTsconfig(), null, 2);

    const context: NextProjectTemplateContext = {
      packageJson,
      tsconfig,
      projectName: config.name,
      projectDescription: config.description || `A Next.js project: ${config.name}`,
    };

    const packageContent = await this.runtime.templateResolver.renderTemplate(
      'project/nextjs/package.json.tpl',
      context,
      packageJson
    );
    files.push({ path: 'package.json', content: packageContent });

    const nextConfig = await this.runtime.templateResolver.renderTemplate(
      'project/nextjs/next.config.js.tpl',
      context,
      `/** @type {import('next').NextConfig} */\nconst nextConfig = {\n  reactStrictMode: true,\n  experimental: {\n    appDir: true,\n  },\n};\n\nexport default nextConfig;\n`
    );
    files.push({ path: 'next.config.js', content: nextConfig });

    const tsconfigContent = await this.runtime.templateResolver.renderTemplate(
      'project/nextjs/tsconfig.json.tpl',
      context,
      tsconfig
    );
    files.push({ path: 'tsconfig.json', content: tsconfigContent });

    const nextEnv = await this.runtime.templateResolver.renderTemplate(
      'project/nextjs/next-env.d.ts.tpl',
      context,
      `/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n\n// NOTE: This file should not be edited\n// see https://nextjs.org/docs/basic-features/typescript for more information.\n`
    );
    files.push({ path: 'next-env.d.ts', content: nextEnv });

    const layoutContent = await this.runtime.templateResolver.renderTemplate(
      'project/nextjs/app/layout.tsx.tpl',
      context,
      `import './globals.css';\nimport type { Metadata } from 'next';\n\nexport const metadata: Metadata = {\n  title: '${context.projectName}',\n  description: '${context.projectDescription}',\n};\n\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (\n    <html lang="en">\n      <body>{children}</body>\n    </html>\n  );\n}\n`
    );
    files.push({ path: 'app/layout.tsx', content: layoutContent });

    const pageContent = await this.runtime.templateResolver.renderTemplate(
      'project/nextjs/app/page.tsx.tpl',
      context,
      `export default function Home() {\n  return (\n    <main>\n      <h1>${context.projectName}</h1>\n      <p>Welcome to your Next.js project generated by Arbiter.</p>\n    </main>\n  );\n}\n`
    );
    files.push({ path: 'app/page.tsx', content: pageContent });

    const globalsCss = await this.runtime.templateResolver.renderTemplate(
      'project/nextjs/app/globals.css.tpl',
      context,
      `:root {\n  color-scheme: light dark;\n  font-family: system-ui, sans-serif;\n  margin: 0;\n  padding: 0;\n}\n\nbody {\n  margin: 0;\n}\n`
    );
    files.push({ path: 'app/globals.css', content: globalsCss });

    return {
      files,
      dependencies,
      scripts: this.createNextScripts(),
    };
  }

  private collectViteDependencies(): string[] {
    const deps = new Set<string>([
      'react',
      'react-dom',
      '@types/react',
      '@types/react-dom',
      'typescript',
      'vite',
      '@vitejs/plugin-react',
      'react-router-dom',
      '@types/react-router-dom',
    ]);

    if (this.runtime.testRunner === 'vitest') {
      deps.add('vitest');
      deps.add('@testing-library/react');
      deps.add('@testing-library/jest-dom');
    } else {
      deps.add('jest');
      deps.add('@types/jest');
      deps.add('ts-jest');
    }

    switch (this.runtime.styling) {
      case 'tailwind':
        deps.add('tailwindcss');
        deps.add('postcss');
        deps.add('autoprefixer');
        break;
      case 'styled-components':
        deps.add('styled-components');
        deps.add('@types/styled-components');
        break;
      default:
        break;
    }

    if (this.runtime.stateManagement) {
      const lower = this.runtime.stateManagement.toLowerCase();
      if (lower === 'redux') {
        deps.add('@reduxjs/toolkit');
        deps.add('react-redux');
      } else if (lower === 'zustand') {
        deps.add('zustand');
      }
    }

    return Array.from(deps);
  }

  private collectNextDependencies(): string[] {
    const deps = new Set<string>([
      'next',
      'react',
      'react-dom',
      'typescript',
      '@types/react',
      '@types/node',
      'eslint',
    ]);

    if (this.runtime.testRunner === 'jest') {
      deps.add('jest');
      deps.add('@types/jest');
      deps.add('ts-jest');
    } else {
      deps.add('vitest');
      deps.add('@testing-library/react');
      deps.add('@testing-library/jest-dom');
    }

    if (this.runtime.styling === 'styled-components') {
      deps.add('styled-components');
      deps.add('@types/styled-components');
    } else if (this.runtime.styling === 'tailwind') {
      deps.add('tailwindcss');
      deps.add('postcss');
      deps.add('autoprefixer');
    }

    if (this.runtime.stateManagement) {
      const lower = this.runtime.stateManagement.toLowerCase();
      if (lower === 'redux') {
        deps.add('@reduxjs/toolkit');
        deps.add('react-redux');
      } else if (lower === 'zustand') {
        deps.add('zustand');
      }
    }

    return Array.from(deps);
  }

  private createVitePackageJson(config: ProjectConfig): string {
    const scripts = this.createViteScripts();

    const packageJson = pruneUndefined({
      name: config.name,
      private: true,
      version: '0.0.0',
      type: 'module',
      description: config.description || `A modern TypeScript project: ${config.name}`,
      scripts,
      dependencies: {},
      devDependencies: {},
      engines: {
        node: '>=18.0.0',
      },
    });

    return JSON.stringify(packageJson, null, 2);
  }

  private createNextPackageJson(config: ProjectConfig): Record<string, unknown> {
    return pruneUndefined({
      name: config.name,
      private: true,
      version: '0.0.0',
      description: config.description || `A Next.js project: ${config.name}`,
      scripts: this.createNextScripts(),
      dependencies: {},
      devDependencies: {},
    });
  }

  private createViteTsconfig(): Record<string, unknown> {
    return {
      compilerOptions: {
        target: 'ES2022',
        lib: ['ES2023', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        skipLibCheck: true,
        moduleResolution: 'bundler',
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: 'react-jsx',
        strict: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noFallthroughCasesInSwitch: true,
      },
      include: ['src'],
      references: [{ path: './tsconfig.node.json' }],
    };
  }

  private createViteBuildTsconfig(): Record<string, unknown> {
    return {
      extends: './tsconfig.json',
      compilerOptions: {
        noEmit: false,
        declaration: true,
        outDir: './dist',
      },
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    };
  }

  private createNextTsconfig(): Record<string, unknown> {
    return {
      compilerOptions: {
        target: 'ES2022',
        lib: ['DOM', 'DOM.Iterable', 'ESNext'],
        allowJs: false,
        skipLibCheck: true,
        strict: true,
        forceConsistentCasingInFileNames: true,
        noEmit: true,
        module: 'ESNext',
        moduleResolution: 'Bundler',
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: 'preserve',
        incremental: true,
        plugins: [{ name: 'next' }],
      },
      include: ['next-env.d.ts', '**/*.ts', '**/*.tsx'],
      exclude: ['node_modules'],
    };
  }

  private createViteScripts(): Record<string, string | undefined> {
    return pruneUndefined({
      dev: 'vite',
      build: 'tsc && vite build',
      preview: 'vite preview',
      test: this.runtime.testRunner === 'vitest' ? 'vitest' : 'jest',
      'test:ui': this.runtime.testRunner === 'vitest' ? 'vitest --ui' : undefined,
      lint: 'eslint src --ext ts,tsx --report-unused-disable-directives --max-warnings 0',
      'type-check': 'tsc --noEmit',
    });
  }

  private createNextScripts(): Record<string, string | undefined> {
    return pruneUndefined({
      dev: 'next dev',
      build: 'next build',
      start: 'next start',
      lint: 'next lint',
      test:
        this.runtime.testRunner === 'jest' ? 'jest' : 'vitest --run --environment=jsdom --globals',
    });
  }

  private normalizeFramework(config: Record<string, unknown>): FrameworkOption {
    const value = typeof config.framework === 'string' ? config.framework.toLowerCase() : '';
    if (value === 'next' || value === 'nextjs') {
      return 'nextjs';
    }
    return 'vite';
  }

  private normalizeStyling(config: Record<string, unknown>): StylingOption {
    const value = typeof config.styling === 'string' ? config.styling.toLowerCase() : '';
    if (value === 'tailwind') return 'tailwind';
    if (value === 'styled-components' || value === 'styledcomponents') {
      return 'styled-components';
    }
    return 'css-modules';
  }

  private normalizeStateManagement(config: Record<string, unknown>): string | undefined {
    const value = typeof config.stateManagement === 'string' ? config.stateManagement.trim() : '';
    return value ? value : undefined;
  }

  private normalizeTestRunner(config: Record<string, unknown>): TestRunnerOption {
    const value = typeof config.testRunner === 'string' ? config.testRunner.toLowerCase() : '';
    return value === 'jest' ? 'jest' : 'vitest';
  }
}

function pruneUndefined<T extends Record<string, unknown>>(input: T): T {
  for (const key of Object.keys(input)) {
    if (input[key] === undefined) {
      delete input[key];
    }
  }
  return input;
}
