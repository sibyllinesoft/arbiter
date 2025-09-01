/**
 * Web Platform Generator
 * 
 * Generates React components with TypeScript, routing setup, forms with validation,
 * and component tests for web applications.
 */

import path from 'path';

import {
  UIGenerator,
  ProfileUI,
  GeneratorOptions,
  GeneratedArtifact,
  Route,
  Component,
  Form,
  TestDefinition,
  WebGeneratorConfig,
  TemplateContext,
  GeneratorError,
} from '../types.js';

/**
 * Web Platform Generator Implementation
 * 
 * Generates modern React applications with:
 * - TypeScript components and routing
 * - Form validation with Zod
 * - Component tests with Vitest/React Testing Library
 * - Tailwind CSS styling
 * - React Router navigation
 */
export class WebGenerator implements UIGenerator {
  readonly platform = 'web' as const;
  private config: WebGeneratorConfig;

  constructor(config?: Partial<WebGeneratorConfig>) {
    this.config = {
      framework: 'react',
      typescript: true,
      cssFramework: 'tailwind',
      testing: 'vitest',
      routing: 'react-router',
      ...config,
    };
  }

  /**
   * Generate all web artifacts from Profile.ui
   */
  async generate(ui: ProfileUI, options: GeneratorOptions): Promise<GeneratedArtifact[]> {
    const artifacts: GeneratedArtifact[] = [];

    try {
      // Generate routing configuration
      if (ui.routes) {
        const routingArtifact = await this.generateRouting(ui.routes, options);
        artifacts.push(routingArtifact);

        // Generate individual route components
        for (const [routePath, route] of Object.entries(ui.routes)) {
          const routeArtifact = await this.generateRoute(route, options);
          artifacts.push(routeArtifact);
        }
      }

      // Generate components
      if (ui.components) {
        for (const [componentName, component] of Object.entries(ui.components)) {
          const componentArtifact = await this.generateComponent(component, options);
          artifacts.push(componentArtifact);
        }
      }

      // Generate forms
      if (ui.forms) {
        for (const [formName, form] of Object.entries(ui.forms)) {
          const formArtifact = await this.generateForm(form, options);
          artifacts.push(formArtifact);
        }
      }

      // Generate tests
      if (ui.tests) {
        const testArtifacts = await this.generateTests(ui.tests, options);
        artifacts.push(...testArtifacts);
      }

      // Generate additional configuration files
      const configArtifacts = await this.generateConfigFiles(ui, options);
      artifacts.push(...configArtifacts);

    } catch (error) {
      throw new GeneratorError(
        `Failed to generate web artifacts: ${error instanceof Error ? error.message : String(error)}`,
        'web',
        'generation'
      );
    }

    return artifacts;
  }

  /**
   * Generate a single route component
   */
  async generateRoute(route: Route, options: GeneratorOptions): Promise<GeneratedArtifact> {
    const componentName = route.component || this.getComponentNameFromPath(route.path);
    const filename = `${componentName}.tsx`;
    const relativePath = path.join('pages', filename);

    const content = this.generateReactComponent({
      platform: 'web',
      route,
      config: this.config,
      imports: this.getRouteImports(route),
      exports: [componentName],
    });

    return {
      type: 'route',
      filename,
      path: relativePath,
      content,
      dependencies: this.getRouteDependencies(route),
      platform: 'web',
    };
  }

  /**
   * Generate a reusable component
   */
  async generateComponent(component: Component, options: GeneratorOptions): Promise<GeneratedArtifact> {
    const filename = `${component.name}.tsx`;
    const relativePath = path.join('components', filename);

    const content = this.generateReactComponent({
      platform: 'web',
      component,
      config: this.config,
      imports: this.getComponentImports(component),
      exports: [component.name],
    });

    return {
      type: 'component',
      filename,
      path: relativePath,
      content,
      dependencies: this.getComponentDependencies(component),
      platform: 'web',
    };
  }

  /**
   * Generate a form component with validation
   */
  async generateForm(form: Form, options: GeneratorOptions): Promise<GeneratedArtifact> {
    const filename = `${form.name}Form.tsx`;
    const relativePath = path.join('forms', filename);

    const content = this.generateFormComponent({
      platform: 'web',
      form,
      config: this.config,
      imports: this.getFormImports(form),
      exports: [`${form.name}Form`],
    });

    return {
      type: 'form',
      filename,
      path: relativePath,
      content,
      dependencies: this.getFormDependencies(form),
      platform: 'web',
    };
  }

  /**
   * Generate test files
   */
  async generateTests(tests: TestDefinition, options: GeneratorOptions): Promise<GeneratedArtifact[]> {
    const artifacts: GeneratedArtifact[] = [];

    for (const scenario of tests.scenarios) {
      const filename = `${scenario.name.replace(/\s+/g, '-').toLowerCase()}.test.tsx`;
      const relativePath = path.join('__tests__', filename);

      const content = this.generateTestFile({
        platform: 'web',
        tests,
        config: this.config,
        imports: this.getTestImports(tests),
        exports: [],
      }, scenario);

      artifacts.push({
        type: 'test',
        filename,
        path: relativePath,
        content,
        dependencies: this.getTestDependencies(),
        platform: 'web',
      });
    }

    return artifacts;
  }

  /**
   * Validate generator options
   */
  validateOptions(options: GeneratorOptions): boolean {
    if (options.platform !== 'web') {
      return false;
    }

    if (!options.outputDir) {
      return false;
    }

    return true;
  }

  // Private helper methods

  private async generateRouting(routes: Record<string, Route>, options: GeneratorOptions): Promise<GeneratedArtifact> {
    const content = `/**
 * Generated Routing Configuration
 * Auto-generated from Profile.ui specification
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';

// Lazy load components for better performance
${Object.entries(routes).map(([path, route]) => {
  const componentName = route.component || this.getComponentNameFromPath(path);
  return `const ${componentName} = lazy(() => import('../pages/${componentName}'));`;
}).join('\n')}

export function AppRoutes() {
  return (
    <Router>
      <Suspense fallback={<div>Loading...</div>}>
        <Routes>
${Object.entries(routes).map(([path, route]) => {
  const componentName = route.component || this.getComponentNameFromPath(path);
  return `          <Route path="${path}" element={<${componentName} />} />`;
}).join('\n')}
        </Routes>
      </Suspense>
    </Router>
  );
}

export default AppRoutes;
`;

    return {
      type: 'route',
      filename: 'AppRoutes.tsx',
      path: 'routing/AppRoutes.tsx',
      content,
      dependencies: ['react', 'react-router-dom'],
      platform: 'web',
    };
  }

  private generateReactComponent(context: TemplateContext): string {
    const { route, component } = context;
    const name = route?.component || component?.name || 'UnknownComponent';

    return `/**
 * ${name} Component
 * Auto-generated from Profile.ui specification
 */

import React from 'react';
import { cn } from '../utils/cn';

interface ${name}Props {
  className?: string;
${route?.props ? Object.entries(route.props).map(([key, value]) => 
  `  ${key}?: ${this.getTypeFromValue(value)};`
).join('\n') : ''}
${component?.props ? Object.entries(component.props).map(([key, value]) => 
  `  ${key}?: ${this.getTypeFromValue(value)};`
).join('\n') : ''}
}

export function ${name}({ className, ...props }: ${name}Props) {
  return (
    <div className={cn("${this.getComponentClasses(component?.type || 'detail')}", className)}>
      <h1 className="text-2xl font-bold mb-4">${name}</h1>
      {/* Component content will be implemented here */}
      <div className="space-y-4">
        <p className="text-gray-600">
          This component was auto-generated from Profile.ui specification.
        </p>
${this.generateComponentContent(component, route)}
      </div>
    </div>
  );
}

export default ${name};
`;
  }

  private generateFormComponent(context: TemplateContext): string {
    const { form } = context;
    if (!form) throw new GeneratorError('Form context required', 'web', 'form');

    const formName = `${form.name}Form`;

    return `/**
 * ${formName} Component
 * Auto-generated from Profile.ui specification
 */

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '../utils/cn';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Textarea';

// Form validation schema
const ${form.name}Schema = z.object({
${form.fields.map(field => {
  let schema = 'z.string()';
  
  if (field.type === 'email') schema = 'z.string().email()';
  else if (field.type === 'number') schema = 'z.number()';
  else if (!field.required) schema += '.optional()';
  
  return `  ${field.name}: ${schema}${field.required ? '' : '.optional()'},`;
}).join('\n')}
});

type ${form.name}Data = z.infer<typeof ${form.name}Schema>;

interface ${formName}Props {
  className?: string;
  onSubmit?: (data: ${form.name}Data) => void | Promise<void>;
  defaultValues?: Partial<${form.name}Data>;
}

export function ${formName}({ className, onSubmit, defaultValues }: ${formName}Props) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<${form.name}Data>({
    resolver: zodResolver(${form.name}Schema),
    defaultValues,
  });

  const handleFormSubmit = async (data: ${form.name}Data) => {
    try {
      await onSubmit?.(data);
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  return (
    <form 
      onSubmit={handleSubmit(handleFormSubmit)}
      className={cn("space-y-6 max-w-md mx-auto", className)}
    >
${form.fields.map(field => this.generateFormField(field)).join('\n\n')}
      
      <Button 
        type="submit" 
        disabled={isSubmitting}
        className="w-full"
      >
        {isSubmitting ? 'Submitting...' : 'Submit'}
      </Button>
    </form>
  );
}

export default ${formName};
`;
  }

  private generateTestFile(context: TemplateContext, scenario: any): string {
    const { tests } = context;
    if (!tests) throw new GeneratorError('Test context required', 'web', 'test');

    return `/**
 * ${scenario.name} Test
 * Auto-generated from Profile.ui specification
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';

// Import components to test
${this.getTestComponentImports(scenario)}

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('${scenario.name}', () => {
  it('${scenario.description}', async () => {
    const user = userEvent.setup();
    
    ${this.generateTestSteps(scenario.steps)}
  });
  
  // Additional test cases can be added here
  it('handles error states correctly', async () => {
    // Error handling test implementation
    expect(true).toBe(true); // Placeholder
  });
  
  it('meets accessibility standards', async () => {
    // Accessibility test implementation
    expect(true).toBe(true); // Placeholder
  });
});
`;
  }

  private async generateConfigFiles(ui: ProfileUI, options: GeneratorOptions): Promise<GeneratedArtifact[]> {
    const artifacts: GeneratedArtifact[] = [];

    // Generate TypeScript config
    artifacts.push({
      type: 'config',
      filename: 'tsconfig.json',
      path: 'tsconfig.json',
      content: this.generateTsConfig(),
      platform: 'web',
    });

    // Generate Tailwind config
    if (this.config.cssFramework === 'tailwind') {
      artifacts.push({
        type: 'config',
        filename: 'tailwind.config.js',
        path: 'tailwind.config.js',
        content: this.generateTailwindConfig(),
        platform: 'web',
      });
    }

    // Generate Vite config
    artifacts.push({
      type: 'config',
      filename: 'vite.config.ts',
      path: 'vite.config.ts',
      content: this.generateViteConfig(),
      platform: 'web',
    });

    return artifacts;
  }

  // Utility methods

  private getComponentNameFromPath(path: string): string {
    return path
      .split('/')
      .pop()
      ?.replace(/[^a-zA-Z0-9]/g, '')
      ?.replace(/^./, (str) => str.toUpperCase()) || 'UnknownComponent';
  }

  private getTypeFromValue(value: any): string {
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (Array.isArray(value)) return 'any[]';
    return 'any';
  }

  private getComponentClasses(type: string): string {
    const baseClasses = 'p-6 bg-white rounded-lg shadow-sm';
    
    switch (type) {
      case 'form': return `${baseClasses} max-w-md mx-auto`;
      case 'list': return `${baseClasses} space-y-2`;
      case 'detail': return `${baseClasses}`;
      case 'navigation': return 'bg-gray-50 border-b p-4';
      default: return baseClasses;
    }
  }

  private generateComponentContent(component?: Component, route?: Route): string {
    if (component?.type === 'list') {
      return `        <div className="space-y-2">
          {/* List items will be rendered here */}
        </div>`;
    }
    
    if (component?.type === 'form') {
      return `        <form className="space-y-4">
          {/* Form fields will be rendered here */}
        </form>`;
    }
    
    return `        <div>
          {/* Component content */}
        </div>`;
  }

  private generateFormField(field: any): string {
    const fieldName = field.name;
    const fieldType = field.type;
    
    if (fieldType === 'select' && field.options) {
      return `      <div>
        <label className="block text-sm font-medium mb-2">${field.label}</label>
        <Select
          {...register('${fieldName}')}
          placeholder="${field.placeholder || `Select ${field.label.toLowerCase()}`}"
        >
${field.options.map((option: any) => 
  `          <option value="${option.value}">${option.label}</option>`
).join('\n')}
        </Select>
        {errors.${fieldName} && (
          <p className="text-red-500 text-sm mt-1">{errors.${fieldName}?.message}</p>
        )}
      </div>`;
    }
    
    if (fieldType === 'textarea') {
      return `      <div>
        <label className="block text-sm font-medium mb-2">${field.label}</label>
        <Textarea
          {...register('${fieldName}')}
          placeholder="${field.placeholder || ''}"
          required={${field.required}}
        />
        {errors.${fieldName} && (
          <p className="text-red-500 text-sm mt-1">{errors.${fieldName}?.message}</p>
        )}
      </div>`;
    }
    
    return `      <div>
        <label className="block text-sm font-medium mb-2">${field.label}</label>
        <Input
          type="${fieldType}"
          {...register('${fieldName}')}
          placeholder="${field.placeholder || ''}"
          required={${field.required}}
        />
        {errors.${fieldName} && (
          <p className="text-red-500 text-sm mt-1">{errors.${fieldName}?.message}</p>
        )}
      </div>`;
  }

  private generateTestSteps(steps: any[]): string {
    return steps.map(step => {
      switch (step.action) {
        case 'click':
          return `    await user.click(screen.getByTestId('${step.target}'));`;
        case 'fill':
          return `    await user.type(screen.getByLabelText('${step.target}'), '${step.value}');`;
        case 'expect':
          return `    expect(screen.getByText('${step.assertion}')).toBeInTheDocument();`;
        case 'navigate':
          return `    // Navigation to ${step.target} would be tested here`;
        default:
          return `    // ${step.action} step implementation`;
      }
    }).join('\n    ');
  }

  // Import and dependency helpers

  private getRouteImports(route: Route): string[] {
    return ['React'];
  }

  private getComponentImports(component: Component): string[] {
    return ['React'];
  }

  private getFormImports(form: Form): string[] {
    return ['React', 'react-hook-form', '@hookform/resolvers/zod', 'zod'];
  }

  private getTestImports(tests: TestDefinition): string[] {
    return ['vitest', '@testing-library/react', '@testing-library/user-event'];
  }

  private getTestComponentImports(scenario: any): string {
    // This would dynamically import the components being tested
    return `// Component imports would be generated based on the test scenario`;
  }

  private getRouteDependencies(route: Route): string[] {
    return ['react', 'react-router-dom'];
  }

  private getComponentDependencies(component: Component): string[] {
    const deps = ['react'];
    if (component.type === 'form') {
      deps.push('react-hook-form', '@hookform/resolvers/zod', 'zod');
    }
    return deps;
  }

  private getFormDependencies(form: Form): string[] {
    return ['react', 'react-hook-form', '@hookform/resolvers/zod', 'zod'];
  }

  private getTestDependencies(): string[] {
    return ['vitest', '@testing-library/react', '@testing-library/user-event'];
  }

  // Config file generators

  private generateTsConfig(): string {
    return `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}`;
  }

  private generateTailwindConfig(): string {
    return `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`;
  }

  private generateViteConfig(): string {
    return `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})`;
  }
}