/**
 * TypeScript Language Plugin - React + Vite + Modern Stack
 * Supports: React 18+, Vite 5+, TypeScript 5+, Tailwind CSS, Vitest
 */

import type {
  BuildConfig,
  ComponentConfig,
  GeneratedFile,
  GenerationResult,
  LanguagePlugin,
  ProjectConfig,
  ServiceConfig,
} from './index.js';

export class TypeScriptPlugin implements LanguagePlugin {
  readonly name = 'TypeScript Plugin';
  readonly language = 'typescript';
  readonly version = '1.0.0';
  readonly description = 'Modern TypeScript with React, Vite, and best practices';
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
  };

  async generateComponent(config: ComponentConfig): Promise<GenerationResult> {
    const files: GeneratedFile[] = [];
    const dependencies: string[] = [];

    // Component file
    files.push({
      path: `src/components/${config.name}/${config.name}.tsx`,
      content: this.generateComponentContent(config),
    });

    // Props type definition
    files.push({
      path: `src/components/${config.name}/types.ts`,
      content: this.generateComponentTypes(config),
    });

    // Styles (if requested)
    if (config.styles) {
      files.push({
        path: `src/components/${config.name}/${config.name}.module.css`,
        content: this.generateComponentStyles(config),
      });
    }

    // Tests (if requested)
    if (config.tests) {
      files.push({
        path: `src/components/${config.name}/${config.name}.test.tsx`,
        content: this.generateComponentTest(config),
      });
      dependencies.push('@testing-library/react', '@testing-library/jest-dom');
    }

    // Index file for clean imports
    files.push({
      path: `src/components/${config.name}/index.ts`,
      content: `export { ${config.name} } from './${config.name}';
export type { ${config.name}Props } from './types';`,
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

    switch (config.type) {
      case 'api':
        files.push({
          path: `src/api/${config.name}.ts`,
          content: this.generateAPIService(config),
        });
        break;
      case 'service':
        files.push({
          path: `src/services/${config.name}.service.ts`,
          content: this.generateBusinessService(config),
        });
        break;
      case 'handler':
        files.push({
          path: `src/handlers/${config.name}.handler.ts`,
          content: this.generateHandler(config),
        });
        break;
    }

    if (config.validation) {
      dependencies.push('zod');
      files.push({
        path: `src/schemas/${config.name}.schema.ts`,
        content: this.generateValidationSchema(config),
      });
    }

    return { files, dependencies };
  }

  async initializeProject(config: ProjectConfig): Promise<GenerationResult> {
    const files: GeneratedFile[] = [];
    const dependencies = [
      'react',
      'react-dom',
      '@types/react',
      '@types/react-dom',
      'typescript',
      'vite',
      '@vitejs/plugin-react',
    ];

    // Package.json
    files.push({
      path: 'package.json',
      content: this.generatePackageJson(config),
    });

    // Vite config
    files.push({
      path: 'vite.config.ts',
      content: this.generateViteConfig(config),
    });

    // TypeScript config
    files.push({
      path: 'tsconfig.json',
      content: this.generateTSConfig(),
    });

    // Main App component
    files.push({
      path: 'src/App.tsx',
      content: this.generateMainApp(config),
    });

    // Main entry point
    files.push({
      path: 'src/main.tsx',
      content: this.generateMainEntry(config),
    });

    // Index HTML
    files.push({
      path: 'index.html',
      content: this.generateIndexHTML(config),
    });

    // Environment types
    files.push({
      path: 'src/vite-env.d.ts',
      content: '/// <reference types="vite/client" />',
    });

    // Additional features
    if (config.features.includes('routing')) {
      dependencies.push('react-router-dom', '@types/react-router-dom');
    }
    if (config.features.includes('state-management')) {
      dependencies.push('@reduxjs/toolkit', 'react-redux');
    }
    if (config.features.includes('styling')) {
      dependencies.push('tailwindcss', 'autoprefixer', 'postcss');
    }
    if (config.testing) {
      dependencies.push('vitest', '@testing-library/react', '@testing-library/jest-dom');
    }

    return {
      files,
      dependencies,
      scripts: {
        dev: 'vite',
        build: 'tsc && vite build',
        preview: 'vite preview',
        test: 'vitest',
        'test:ui': 'vitest --ui',
      },
    };
  }

  async generateBuildConfig(config: BuildConfig): Promise<GenerationResult> {
    const files: GeneratedFile[] = [];

    files.push({
      path: 'vite.config.ts',
      content: this.generateOptimizedViteConfig(config),
    });

    if (config.target === 'production') {
      files.push({
        path: 'tsconfig.build.json',
        content: this.generateBuildTSConfig(),
      });
    }

    return { files };
  }

  private generateComponentContent(config: ComponentConfig): string {
    const hasProps = config.props && config.props.length > 0;
    const propsImport = hasProps ? `import type { ${config.name}Props } from './types';` : '';
    const propsParam = hasProps ? `props: ${config.name}Props` : '';
    const cssImport = config.styles ? `import styles from './${config.name}.module.css';` : '';

    return `${propsImport}
${cssImport}

/**
 * ${config.name} Component
 * ${config.type === 'page' ? 'Page component' : 'Reusable UI component'}
 */
export function ${config.name}(${propsParam}) {
  return (
    <div${config.styles ? ' className={styles.container}' : ''}>
      <h1>${config.name}</h1>
      {/* Component content */}
    </div>
  );
}

${config.name}.displayName = '${config.name}';
`;
  }

  private generateComponentTypes(config: ComponentConfig): string {
    const props =
      config.props && config.props.length > 0
        ? config.props
            .map(prop => `  ${prop.name}${prop.required ? '' : '?'}: ${prop.type};`)
            .join('\n')
        : '  // No props defined';

    return `export interface ${config.name}Props {
${props}
}
`;
  }

  private generateComponentStyles(config: ComponentConfig): string {
    return `.container {
  /* ${config.name} component styles */
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
`;
  }

  private generateComponentTest(config: ComponentConfig): string {
    return `import { render, screen } from '@testing-library/react';
import { ${config.name} } from './${config.name}';

describe('${config.name}', () => {
  it('renders successfully', () => {
    render(<${config.name} />);
    expect(screen.getByText('${config.name}')).toBeInTheDocument();
  });

  // Add more tests as needed
});
`;
  }

  private generateAPIService(config: ServiceConfig): string {
    return `import express from 'express';
import type { Request, Response, NextFunction } from 'express';

const router = express.Router();

/**
 * ${config.name} API Routes
 * Handles all ${config.name} related endpoints
 */

// GET endpoint
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Implementation here
    res.json({ message: '${config.name} API working' });
  } catch (error) {
    next(error);
  }
});

// POST endpoint
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Implementation here
    res.status(201).json({ message: '${config.name} created' });
  } catch (error) {
    next(error);
  }
});

export { router as ${config.name}Router };
`;
  }

  private generateBusinessService(config: ServiceConfig): string {
    return `/**
 * ${config.name} Service
 * Business logic for ${config.name} operations
 */

export class ${config.name}Service {
  async findAll(): Promise<any[]> {
    // Implementation here
    throw new Error('Not implemented');
  }

  async findById(id: string): Promise<any> {
    // Implementation here
    throw new Error('Not implemented');
  }

  async create(data: any): Promise<any> {
    // Implementation here
    throw new Error('Not implemented');
  }

  async update(id: string, data: any): Promise<any> {
    // Implementation here
    throw new Error('Not implemented');
  }

  async delete(id: string): Promise<void> {
    // Implementation here
    throw new Error('Not implemented');
  }
}

export const ${config.name.toLowerCase()}Service = new ${config.name}Service();
`;
  }

  private generateHandler(config: ServiceConfig): string {
    return `import type { Request, Response, NextFunction } from 'express';

/**
 * ${config.name} Handler
 * HTTP request handlers for ${config.name}
 */

export class ${config.name}Handler {
  async handleGet(req: Request, res: Response, next: NextFunction) {
    try {
      // Implementation here
      res.json({ message: 'GET ${config.name}' });
    } catch (error) {
      next(error);
    }
  }

  async handlePost(req: Request, res: Response, next: NextFunction) {
    try {
      // Implementation here
      res.status(201).json({ message: 'POST ${config.name}' });
    } catch (error) {
      next(error);
    }
  }

  async handlePut(req: Request, res: Response, next: NextFunction) {
    try {
      // Implementation here
      res.json({ message: 'PUT ${config.name}' });
    } catch (error) {
      next(error);
    }
  }

  async handleDelete(req: Request, res: Response, next: NextFunction) {
    try {
      // Implementation here
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

export const ${config.name.toLowerCase()}Handler = new ${config.name}Handler();
`;
  }

  private generateValidationSchema(config: ServiceConfig): string {
    return `import { z } from 'zod';

/**
 * ${config.name} Validation Schemas
 */

export const ${config.name}Schema = z.object({
  id: z.string().uuid().optional(),
  // Add your schema properties here
});

export const Create${config.name}Schema = ${config.name}Schema.omit({ id: true });

export const Update${config.name}Schema = ${config.name}Schema.partial();

export type ${config.name} = z.infer<typeof ${config.name}Schema>;
export type Create${config.name} = z.infer<typeof Create${config.name}Schema>;
export type Update${config.name} = z.infer<typeof Update${config.name}Schema>;
`;
  }

  private generatePackageJson(config: ProjectConfig): string {
    return JSON.stringify(
      {
        name: config.name,
        private: true,
        version: '0.0.0',
        type: 'module',
        description: config.description || `A modern TypeScript project: ${config.name}`,
        scripts: {
          dev: 'vite',
          build: 'tsc && vite build',
          preview: 'vite preview',
          test: config.testing ? 'vitest' : undefined,
          'test:ui': config.testing ? 'vitest --ui' : undefined,
          lint: 'eslint src --ext ts,tsx --report-unused-disable-directives --max-warnings 0',
          'type-check': 'tsc --noEmit',
        },
        dependencies: {},
        devDependencies: {},
        engines: {
          node: '>=18.0.0',
        },
      },
      null,
      2
    );
  }

  private generateViteConfig(config: ProjectConfig): string {
    return `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
});
`;
  }

  private generateOptimizedViteConfig(config: BuildConfig): string {
    const optimizations = config.optimization
      ? `
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        },
      },
    },`
      : '';

    return `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    minify: '${config.target === 'production' ? 'terser' : 'esbuild'}',
    sourcemap: ${config.target !== 'production'},${optimizations}
  },
});
`;
  }

  private generateTSConfig(): string {
    return JSON.stringify(
      {
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
      },
      null,
      2
    );
  }

  private generateBuildTSConfig(): string {
    return JSON.stringify(
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
    );
  }

  private generateMainApp(config: ProjectConfig): string {
    const routing = config.features.includes('routing');
    const routingImport = routing
      ? "import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';"
      : '';
    const routingWrapper = routing
      ? '<Router>\n      <Routes>\n        <Route path="/" element={<h1>Welcome to {name}</h1>} />\n      </Routes>\n    </Router>'
      : '<h1>Welcome to {name}</h1>';

    return `${routingImport}
import './App.css';

function App() {
  const name = '${config.name}';

  return (
    <div className="App">
      ${routingWrapper}
    </div>
  );
}

export default App;
`;
  }

  private generateMainEntry(config: ProjectConfig): string {
    return `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`;
  }

  private generateIndexHTML(config: ProjectConfig): string {
    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${config.name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
  }
}
