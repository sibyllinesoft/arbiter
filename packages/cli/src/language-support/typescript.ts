/**
 * TypeScript Language Plugin - React + Vite + Next.js support with template overrides
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  BuildConfig,
  ComponentConfig,
  GeneratedFile,
  GenerationResult,
  LanguagePlugin,
  LanguagePluginConfigureOptions,
  LanguageTestingConfig,
  ProjectConfig,
  ServiceConfig,
} from "@/language-support/index.js";
import { TemplateResolver } from "@/language-support/template-resolver.js";

type FrameworkOption = "vite" | "nextjs";
type StylingOption = "css-modules" | "tailwind" | "styled-components";
type TestRunnerOption = "vitest" | "jest";

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
  tsconfigNode?: string;
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

const VITE_DEPENDENCY_VERSIONS: Record<string, string> = {
  react: "^18.2.0",
  "react-dom": "^18.2.0",
  "react-router-dom": "^6.26.2",
  "@reduxjs/toolkit": "^1.9.7",
  "react-redux": "^8.1.3",
  zustand: "^4.5.2",
  "styled-components": "^5.3.11",
};

const VITE_DEV_DEPENDENCY_VERSIONS: Record<string, string> = {
  typescript: "^5.5.4",
  vite: "^5.1.6",
  "@vitejs/plugin-react": "^4.2.1",
  "@types/react": "^18.3.5",
  "@types/react-dom": "^18.3.0",
  eslint: "^8.57.1",
  "@typescript-eslint/parser": "^7.18.0",
  "@typescript-eslint/eslint-plugin": "^7.18.0",
  "eslint-plugin-react": "^7.35.0",
  "eslint-plugin-react-hooks": "^4.6.2",
  vitest: "^1.2.2",
  "@testing-library/react": "^14.1.2",
  "@testing-library/jest-dom": "^6.4.2",
  jsdom: "^24.1.0",
  jest: "^29.7.0",
  "@types/jest": "^29.5.5",
  "ts-jest": "^29.2.5",
  tailwindcss: "^3.4.14",
  postcss: "^8.4.38",
  autoprefixer: "^10.4.20",
  "@types/styled-components": "^5.1.34",
};

export class TypeScriptPlugin implements LanguagePlugin {
  readonly name = "TypeScript Plugin";
  readonly language = "typescript";
  readonly version = "1.1.0";
  readonly description = "Modern TypeScript with React, Vite, and Next.js support";
  readonly supportedFeatures = [
    "components",
    "hooks",
    "api",
    "routing",
    "state-management",
    "testing",
    "styling",
    "build-optimization",
    "type-safety",
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
      language: "typescript",
      defaultDirectories: TypeScriptPlugin.resolveDefaultTemplateDirectories(),
    });

    this.runtime = {
      framework: "vite",
      styling: "css-modules",
      testRunner: "vitest",
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
    const rawTesting = (pluginConfig as any)?.testing as LanguageTestingConfig | undefined;
    const testingConfig = options.testing ?? rawTesting;
    this.runtime.framework = this.normalizeFramework(pluginConfig);
    this.runtime.styling = this.normalizeStyling(pluginConfig);
    this.runtime.stateManagement = this.normalizeStateManagement(pluginConfig);
    this.runtime.testRunner = testingConfig?.framework
      ? this.normalizeTestRunner({ testRunner: testingConfig.framework })
      : this.normalizeTestRunner(pluginConfig);
  }

  async generateComponent(config: ComponentConfig): Promise<GenerationResult> {
    const files: GeneratedFile[] = [];
    const dependencies: string[] = [];

    const context = this.buildComponentContext(config);

    const componentContent = await this.runtime.templateResolver.renderTemplate(
      "component.tsx.tpl",
      context,
    );

    files.push({
      path: `src/components/${config.name}/${config.name}.tsx`,
      content: componentContent,
    });

    const typesContent = await this.runtime.templateResolver.renderTemplate(
      "component.types.ts.tpl",
      context,
    );

    files.push({
      path: `src/components/${config.name}/types.ts`,
      content: typesContent,
    });

    if (config.styles) {
      const stylesContent = await this.runtime.templateResolver.renderTemplate(
        "component.module.css.tpl",
        context,
      );
      files.push({
        path: `src/components/${config.name}/${config.name}.module.css`,
        content: stylesContent,
      });
    }

    if (config.tests) {
      const testContent = await this.runtime.templateResolver.renderTemplate(
        "component.test.tsx.tpl",
        context,
      );
      files.push({
        path: `src/components/${config.name}/${config.name}.test.tsx`,
        content: testContent,
      });
      dependencies.push("@testing-library/react", "@testing-library/jest-dom");
    }

    files.push({
      path: `src/components/${config.name}/index.ts`,
      content: `export { ${config.name} } from '@/language-support/${config.name}';\nexport type { ${config.name}Props } from '@/language-support/types';`,
    });

    return {
      files,
      dependencies,
      instructions: [
        `Component ${config.name} created successfully`,
        `Import with: import { ${config.name} } from "@/language-support/components/${config.name}";`,
      ],
    };
  }

  async generateService(config: ServiceConfig): Promise<GenerationResult> {
    const files: GeneratedFile[] = [];
    const dependencies: string[] = ["express", "@types/express"];

    const context = this.buildServiceContext(config);

    switch (config.type) {
      case "api": {
        const apiContent = await this.runtime.templateResolver.renderTemplate(
          "service.api.ts.tpl",
          context,
        );
        files.push({ path: `src/api/${config.name}.ts`, content: apiContent });
        break;
      }
      case "service": {
        const serviceContent = await this.runtime.templateResolver.renderTemplate(
          "service.class.ts.tpl",
          context,
        );
        files.push({ path: `src/services/${config.name}.service.ts`, content: serviceContent });
        break;
      }
      case "handler": {
        const handlerContent = await this.runtime.templateResolver.renderTemplate(
          "service.handler.ts.tpl",
          context,
        );
        files.push({ path: `src/handlers/${config.name}.handler.ts`, content: handlerContent });
        break;
      }
      default:
        break;
    }

    if (config.validation) {
      const schemaContent = await this.runtime.templateResolver.renderTemplate(
        "service.schema.ts.tpl",
        context,
      );
      files.push({ path: `src/schemas/${config.name}.schema.ts`, content: schemaContent });
      dependencies.push("zod");
    }

    return { files, dependencies };
  }

  async initializeProject(config: ProjectConfig): Promise<GenerationResult> {
    if (this.runtime.framework === "nextjs") {
      return this.initializeNextProject(config);
    }

    return this.initializeViteProject(config);
  }

  async generateBuildConfig(config: BuildConfig): Promise<GenerationResult> {
    if (this.runtime.framework === "nextjs") {
      const nextConfig = await this.runtime.templateResolver.renderTemplate(
        "project/nextjs/next.config.js.tpl",
        {},
        `/** @type {import('next').NextConfig} */\nconst nextConfig = {\n  reactStrictMode: true,\n  experimental: {\n    appDir: true,\n  },\n};\n\nexport default nextConfig;\n`,
      );

      return {
        files: [
          {
            path: "next.config.js",
            content: nextConfig,
          },
        ],
      };
    }

    const additional = config.optimization
      ? `\n    rollupOptions: {\n      output: {\n        manualChunks: {\n          vendor: ['react', 'react-dom'],\n        },\n      },\n    },`
      : "";

    const templateContext: ViteProjectTemplateContext = {
      packageJson: "",
      tsconfig: "",
      tsconfigBuild: "",
      projectName: "",
      projectDescription: "",
      devServerPort: 3000,
      additionalBuildConfig: additional
        ? `\n    minify: '${config.target === "production" ? "terser" : "esbuild"}',${additional}`
        : `\n    minify: '${config.target === "production" ? "terser" : "esbuild"}',`,
    };

    const content = await this.runtime.templateResolver.renderTemplate(
      "project/vite/vite.config.ts.tpl",
      templateContext,
      `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\n\nexport default defineConfig({\n  plugins: [react()],\n  server: {\n    port: 3000,\n  },\n  build: {\n    target: 'es2022',\n    sourcemap: true${templateContext.additionalBuildConfig}\n  },\n  test: {\n    globals: true,\n    environment: 'jsdom',\n    setupFiles: ['@/language-support/src/test-setup.ts'],\n  },\n});\n`,
    );

    const files: GeneratedFile[] = [{ path: "vite.config.ts", content }];

    if (config.target === "production") {
      const tsconfigBuild = await this.runtime.templateResolver.renderTemplate(
        "project/vite/tsconfig.build.json.tpl",
        {
          packageJson: "",
          tsconfig: "",
          tsconfigBuild: JSON.stringify(
            {
              extends: "@/language-support/tsconfig.json",
              compilerOptions: {
                noEmit: false,
                declaration: true,
                outDir: "@/language-support/dist",
              },
              exclude: ["src/**/*.test.ts", "src/**/*.test.tsx"],
            },
            null,
            2,
          ),
          projectName: "",
          projectDescription: "",
          devServerPort: 3000,
          additionalBuildConfig: "",
        },
        JSON.stringify(
          {
            extends: "@/language-support/tsconfig.json",
            compilerOptions: {
              noEmit: false,
              declaration: true,
              outDir: "@/language-support/dist",
            },
            exclude: ["src/**/*.test.ts", "src/**/*.test.tsx"],
          },
          null,
          2,
        ),
      );

      files.push({ path: "tsconfig.build.json", content: tsconfigBuild });
    }

    return { files };
  }

  private static resolveDefaultTemplateDirectories(): string[] {
    const moduleDir = path.dirname(fileURLToPath(import.meta.url));
    return [
      path.resolve(moduleDir, "@/templates/typescript"),
      path.resolve(moduleDir, "../../templates/typescript"),
    ];
  }

  private buildComponentContext(config: ComponentConfig): ComponentTemplateContext {
    const hasProps = Array.isArray(config.props) && config.props.length > 0;
    const propsInterface = hasProps
      ? config
          .props!.map((prop) => `  ${prop.name}${prop.required ? "" : "?"}: ${prop.type};`)
          .join("\n")
      : "  // No props defined";

    return {
      componentName: config.name,
      componentDescription: config.type === "page" ? "Page component" : "Reusable UI component",
      propsImport: hasProps
        ? `import type { ${config.name}Props } from '@/language-support/types';`
        : "",
      cssImport: config.styles
        ? `import styles from '@/language-support/${config.name}.module.css';`
        : "",
      propsParam: hasProps ? `props: ${config.name}Props` : "",
      containerClass: config.styles ? " className={styles.container}" : "",
      propsInterface,
      testProps: "",
      hasProps,
    };
  }

  private getDefaultComponentTemplate(context: ComponentTemplateContext): string {
    return ""; // external template handles rendering
  }

  private getDefaultComponentTypesTemplate(context: ComponentTemplateContext): string {
    return "";
  }

  private getDefaultComponentStylesTemplate(context: ComponentTemplateContext): string {
    return "";
  }

  private getDefaultComponentTestTemplate(context: ComponentTemplateContext): string {
    return "";
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

  private async initializeViteProject(config: ProjectConfig): Promise<GenerationResult> {
    const files: GeneratedFile[] = [];
    const { dependencies, devDependencies } = this.collectViteDependencies();

    const packageJson = this.createVitePackageJson(config, dependencies, devDependencies);
    const tsconfig = JSON.stringify(this.createViteTsconfig(), null, 2);
    const tsconfigBuild = JSON.stringify(this.createViteBuildTsconfig(), null, 2);
    const tsconfigNode = JSON.stringify(this.createViteNodeTsconfig(), null, 2);

    const context: ViteProjectTemplateContext = {
      packageJson,
      tsconfig,
      tsconfigBuild,
      tsconfigNode,
      projectName: config.name,
      projectDescription: config.description || `A modern TypeScript project: ${config.name}`,
      devServerPort: 3000,
      additionalBuildConfig: "",
    };

    const packageContent = await this.runtime.templateResolver.renderTemplate(
      "project/vite/package.json.tpl",
      context,
      packageJson,
    );
    files.push({ path: "package.json", content: packageContent });

    const viteConfig = await this.runtime.templateResolver.renderTemplate(
      "project/vite/vite.config.ts.tpl",
      context,
    );

    files.push({ path: "vite.config.ts", content: viteConfig });

    const tsconfigContent = await this.runtime.templateResolver.renderTemplate(
      "project/vite/tsconfig.json.tpl",
      context,
    );
    files.push({ path: "tsconfig.json", content: tsconfigContent });

    const tsconfigBuildContent = await this.runtime.templateResolver.renderTemplate(
      "project/vite/tsconfig.build.json.tpl",
      context,
    );
    files.push({ path: "tsconfig.build.json", content: tsconfigBuildContent });

    const tsconfigNodeContent = await this.runtime.templateResolver.renderTemplate(
      "project/vite/tsconfig.node.json.tpl",
      context,
    );
    files.push({ path: "tsconfig.node.json", content: tsconfigNodeContent });

    files.push({ path: ".eslintrc.cjs", content: this.createViteEslintConfig() });

    const appContent = await this.runtime.templateResolver.renderTemplate(
      "project/vite/App.tsx.tpl",
      context,
    );
    files.push({ path: "src/App.tsx", content: appContent });

    const mainContent = await this.runtime.templateResolver.renderTemplate(
      "project/vite/main.tsx.tpl",
      context,
    );
    files.push({ path: "src/main.tsx", content: mainContent });

    const indexHtml = await this.runtime.templateResolver.renderTemplate(
      "project/vite/index.html.tpl",
      context,
    );
    files.push({ path: "index.html", content: indexHtml });

    files.push({ path: "src/vite-env.d.ts", content: '/// <reference types="vite/client" />' });

    const testSetup = await this.runtime.templateResolver.renderTemplate(
      "project/vite/test-setup.ts.tpl",
      context,
    );
    files.push({ path: "src/test-setup.ts", content: testSetup });

    const appCss = await this.runtime.templateResolver.renderTemplate(
      "project/vite/App.css.tpl",
      context,
    );
    files.push({ path: "src/App.css", content: appCss });

    const indexCss = await this.runtime.templateResolver.renderTemplate(
      "project/vite/index.css.tpl",
      context,
    );
    files.push({ path: "src/index.css", content: indexCss });

    const dependencyList = [
      ...dependencies.map(([name, version]) => `${name}@${version}`),
      ...devDependencies.map(([name, version]) => `${name}@${version}`),
    ];

    return {
      files,
      dependencies: dependencyList,
      scripts: this.createViteScripts(),
    };

    return {
      files,
      dependencies: dependencyList,
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
      "project/nextjs/package.json.tpl",
      context,
      packageJson,
    );
    files.push({ path: "package.json", content: packageContent });

    const nextConfig = await this.runtime.templateResolver.renderTemplate(
      "project/nextjs/next.config.js.tpl",
      context,
      `/** @type {import('next').NextConfig} */\nconst nextConfig = {\n  reactStrictMode: true,\n  experimental: {\n    appDir: true,\n  },\n};\n\nexport default nextConfig;\n`,
    );
    files.push({ path: "next.config.js", content: nextConfig });

    const tsconfigContent = await this.runtime.templateResolver.renderTemplate(
      "project/nextjs/tsconfig.json.tpl",
      context,
      tsconfig,
    );
    files.push({ path: "tsconfig.json", content: tsconfigContent });

    const nextEnv = await this.runtime.templateResolver.renderTemplate(
      "project/nextjs/next-env.d.ts.tpl",
      context,
      `/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n\n// NOTE: This file should not be edited\n// see https://nextjs.org/docs/basic-features/typescript for more information.\n`,
    );
    files.push({ path: "next-env.d.ts", content: nextEnv });

    const layoutContent = await this.runtime.templateResolver.renderTemplate(
      "project/nextjs/app/layout.tsx.tpl",
      context,
      `import '@/language-support/globals.css';\nimport type { Metadata } from 'next';\n\nexport const metadata: Metadata = {\n  title: '${context.projectName}',\n  description: '${context.projectDescription}',\n};\n\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (\n    <html lang="en">\n      <body>{children}</body>\n    </html>\n  );\n}\n`,
    );
    files.push({ path: "app/layout.tsx", content: layoutContent });

    const pageContent = await this.runtime.templateResolver.renderTemplate(
      "project/nextjs/app/page.tsx.tpl",
      context,
      `export default function Home() {\n  return (\n    <main>\n      <h1>${context.projectName}</h1>\n      <p>Welcome to your Next.js project generated by Arbiter.</p>\n    </main>\n  );\n}\n`,
    );
    files.push({ path: "app/page.tsx", content: pageContent });

    const globalsCss = await this.runtime.templateResolver.renderTemplate(
      "project/nextjs/app/globals.css.tpl",
      context,
      `:root {\n  color-scheme: light dark;\n  font-family: system-ui, sans-serif;\n  margin: 0;\n  padding: 0;\n}\n\nbody {\n  margin: 0;\n}\n`,
    );
    files.push({ path: "app/globals.css", content: globalsCss });

    if (this.runtime.testRunner === "jest") {
      const babelConfig = await this.runtime.templateResolver.renderTemplate(
        "project/nextjs/babel.config.js.tpl",
        context,
        `module.exports = {
  presets: ['next/babel'],
  env: {
    test: {
      plugins: ['babel-plugin-dynamic-import-node'],
    },
  },
};
`,
      );
      files.push({ path: "babel.config.js", content: babelConfig });

      const jestConfig = await this.runtime.templateResolver.renderTemplate(
        "project/nextjs/jest.config.js.tpl",
        context,
        `const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './' });

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jsdom',
};

module.exports = createJestConfig(customJestConfig);
`,
      );
      files.push({ path: "jest.config.js", content: jestConfig });

      const jestSetup = await this.runtime.templateResolver.renderTemplate(
        "project/nextjs/jest.setup.ts.tpl",
        context,
        `import '@testing-library/jest-dom/extend-expect';
import preloadAll from 'jest-next-dynamic';

beforeAll(async () => {
  await preloadAll();
});
`,
      );
      files.push({ path: "jest.setup.ts", content: jestSetup });
    }

    return {
      files,
      dependencies,
      scripts: this.createNextScripts(),
    };
  }

  private collectViteDependencies(): {
    dependencies: Array<[string, string]>;
    devDependencies: Array<[string, string]>;
  } {
    const deps = new Map<string, string>();
    const devDeps = new Map<string, string>();

    const addDep = (name: string) => deps.set(name, VITE_DEPENDENCY_VERSIONS[name] ?? "latest");
    const addDevDep = (name: string) =>
      devDeps.set(name, VITE_DEV_DEPENDENCY_VERSIONS[name] ?? "latest");

    addDep("react");
    addDep("react-dom");
    addDep("react-router-dom");
    addDevDep("@types/react");
    addDevDep("@types/react-dom");
    addDevDep("jsdom");
    addDevDep("typescript");
    addDevDep("vite");
    addDevDep("@vitejs/plugin-react");
    addDevDep("eslint");
    addDevDep("@typescript-eslint/parser");
    addDevDep("@typescript-eslint/eslint-plugin");
    addDevDep("eslint-plugin-react");
    addDevDep("eslint-plugin-react-hooks");

    if (this.runtime.testRunner === "vitest") {
      addDevDep("vitest");
      addDevDep("@testing-library/react");
      addDevDep("@testing-library/jest-dom");
    } else {
      addDevDep("jest");
      addDevDep("@types/jest");
      addDevDep("ts-jest");
    }

    switch (this.runtime.styling) {
      case "tailwind":
        addDevDep("tailwindcss");
        addDevDep("postcss");
        addDevDep("autoprefixer");
        break;
      case "styled-components":
        addDep("styled-components");
        addDevDep("@types/styled-components");
        break;
      default:
        break;
    }

    if (this.runtime.stateManagement) {
      const lower = this.runtime.stateManagement.toLowerCase();
      if (lower === "redux") {
        addDep("@reduxjs/toolkit");
        addDep("react-redux");
      } else if (lower === "zustand") {
        addDep("zustand");
      }
    }

    return {
      dependencies: Array.from(deps.entries()),
      devDependencies: Array.from(devDeps.entries()),
    };
  }

  private collectNextDependencies(): string[] {
    const deps = new Set<string>([
      "next",
      "react",
      "react-dom",
      "typescript",
      "@types/react",
      "@types/node",
      "eslint",
    ]);

    if (this.runtime.testRunner === "jest") {
      deps.add("jest");
      deps.add("@types/jest");
      deps.add("@testing-library/react");
      deps.add("@testing-library/jest-dom");
      deps.add("babel-plugin-dynamic-import-node");
      deps.add("jest-next-dynamic");
    } else {
      deps.add("vitest");
      deps.add("@testing-library/react");
      deps.add("@testing-library/jest-dom");
    }

    if (this.runtime.styling === "styled-components") {
      deps.add("styled-components");
      deps.add("@types/styled-components");
    } else if (this.runtime.styling === "tailwind") {
      deps.add("tailwindcss");
      deps.add("postcss");
      deps.add("autoprefixer");
    }

    if (this.runtime.stateManagement) {
      const lower = this.runtime.stateManagement.toLowerCase();
      if (lower === "redux") {
        deps.add("@reduxjs/toolkit");
        deps.add("react-redux");
      } else if (lower === "zustand") {
        deps.add("zustand");
      }
    }

    return Array.from(deps);
  }

  private createVitePackageJson(
    config: ProjectConfig,
    dependencies: Array<[string, string]>,
    devDependencies: Array<[string, string]>,
  ): string {
    const scripts = this.createViteScripts();

    const packageJson = pruneUndefined({
      name: config.name,
      private: true,
      version: "0.0.0",
      type: "module",
      description: config.description || `A modern TypeScript project: ${config.name}`,
      scripts,
      dependencies: Object.fromEntries(dependencies),
      devDependencies: Object.fromEntries(devDependencies),
      engines: {
        node: ">=18.0.0",
      },
    });

    return JSON.stringify(packageJson, null, 2);
  }

  private createViteEslintConfig(): string {
    return `module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  settings: {
    react: {
      version: 'detect',
    },
  },
  ignorePatterns: ['dist', 'node_modules'],
  rules: {
    'react/react-in-jsx-scope': 'off',
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
  },
  overrides: [
    {
      files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
      env: {
        browser: false,
        node: true,
      },
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        vi: 'readonly',
      },
    },
  ],
};\n`;
  }

  private createNextPackageJson(config: ProjectConfig): Record<string, unknown> {
    return pruneUndefined({
      name: config.name,
      private: true,
      version: "0.0.0",
      description: config.description || `A Next.js project: ${config.name}`,
      scripts: this.createNextScripts(),
      dependencies: {},
      devDependencies: {},
    });
  }

  private createViteTsconfig(): Record<string, unknown> {
    return {
      compilerOptions: {
        target: "ES2022",
        lib: ["ES2023", "DOM", "DOM.Iterable"],
        module: "ESNext",
        skipLibCheck: true,
        moduleResolution: "bundler",
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: "react-jsx",
        strict: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noFallthroughCasesInSwitch: true,
      },
      include: ["src"],
      references: [{ path: "@/language-support/tsconfig.node.json" }],
    };
  }

  private createViteBuildTsconfig(): Record<string, unknown> {
    return {
      extends: "@/language-support/tsconfig.json",
      compilerOptions: {
        noEmit: false,
        declaration: true,
        outDir: "@/language-support/dist",
      },
      exclude: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    };
  }

  private createViteNodeTsconfig(): Record<string, unknown> {
    return {
      compilerOptions: {
        composite: true,
        module: "ESNext",
        moduleResolution: "bundler",
        resolveJsonModule: true,
        isolatedModules: true,
        types: ["vitest/importMeta"],
      },
      include: ["vite.config.ts"],
    };
  }

  private createNextTsconfig(): Record<string, unknown> {
    return {
      compilerOptions: {
        target: "ES2022",
        lib: ["DOM", "DOM.Iterable", "ESNext"],
        allowJs: false,
        skipLibCheck: true,
        strict: true,
        forceConsistentCasingInFileNames: true,
        noEmit: true,
        module: "ESNext",
        moduleResolution: "Bundler",
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: "preserve",
        incremental: true,
        plugins: [{ name: "next" }],
      },
      include: ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
      exclude: ["node_modules"],
    };
  }

  private createViteScripts(): Record<string, string | undefined> {
    return pruneUndefined({
      dev: "vite",
      build: "tsc && vite build",
      preview: "vite preview",
      test: this.runtime.testRunner === "vitest" ? "vitest run --passWithNoTests" : "jest",
      "test:ui": this.runtime.testRunner === "vitest" ? "vitest --ui" : undefined,
      lint: "eslint src --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
      "type-check": "tsc --noEmit",
    });
  }

  private createNextScripts(): Record<string, string | undefined> {
    return pruneUndefined({
      dev: "next dev",
      build: "next build",
      start: "next start",
      lint: "next lint",
      test:
        this.runtime.testRunner === "jest" ? "jest" : "vitest --run --environment=jsdom --globals",
    });
  }

  private normalizeFramework(config: Record<string, unknown>): FrameworkOption {
    const value = typeof config.framework === "string" ? config.framework.toLowerCase() : "";
    if (value === "next" || value === "nextjs") {
      return "nextjs";
    }
    return "vite";
  }

  private normalizeStyling(config: Record<string, unknown>): StylingOption {
    const value = typeof config.styling === "string" ? config.styling.toLowerCase() : "";
    if (value === "tailwind") return "tailwind";
    if (value === "styled-components" || value === "styledcomponents") {
      return "styled-components";
    }
    return "css-modules";
  }

  private normalizeStateManagement(config: Record<string, unknown>): string | undefined {
    const value = typeof config.stateManagement === "string" ? config.stateManagement.trim() : "";
    return value ? value : undefined;
  }

  private normalizeTestRunner(config: Record<string, unknown>): TestRunnerOption {
    const value = typeof config.testRunner === "string" ? config.testRunner.toLowerCase() : "";
    return value === "jest" ? "jest" : "vitest";
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
