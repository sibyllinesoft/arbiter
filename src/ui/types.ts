/**
 * UI Scaffolding System Types
 * 
 * Type definitions for the arbiter UI scaffolding engine that generates
 * platform-specific code from Profile.ui specifications defined in CUE files.
 */

import { z } from 'zod';

// Base Types
export type Platform = 'web' | 'cli' | 'tui' | 'desktop';
export type ComponentType = 'form' | 'list' | 'detail' | 'navigation' | 'layout';
export type ValidationRule = 'required' | 'email' | 'min' | 'max' | 'pattern';

// Route Definition Schema
export const RouteSchema = z.object({
  path: z.string(),
  component: z.string(),
  props: z.record(z.any()).optional(),
  capabilities: z.array(z.string()).optional(),
  guards: z.array(z.string()).optional(),
  layout: z.string().optional(),
});

export type Route = z.infer<typeof RouteSchema>;

// Form Field Definition Schema
export const FormFieldSchema = z.object({
  name: z.string(),
  type: z.enum(['text', 'email', 'password', 'number', 'select', 'checkbox', 'textarea', 'date']),
  label: z.string(),
  required: z.boolean().default(false),
  placeholder: z.string().optional(),
  validation: z.record(z.any()).optional(),
  options: z.array(z.object({
    label: z.string(),
    value: z.string(),
  })).optional(),
});

export type FormField = z.infer<typeof FormFieldSchema>;

// Form Definition Schema
export const FormSchema = z.object({
  name: z.string(),
  fields: z.array(FormFieldSchema),
  validation: z.record(z.any()).optional(),
  onSubmit: z.string().optional(),
  layout: z.enum(['vertical', 'horizontal', 'grid']).default('vertical'),
});

export type Form = z.infer<typeof FormSchema>;

// Component Definition Schema
export const ComponentSchema = z.object({
  name: z.string(),
  type: z.enum(['form', 'list', 'detail', 'navigation', 'layout']),
  props: z.record(z.any()).optional(),
  children: z.array(z.string()).optional(),
  events: z.record(z.string()).optional(),
  styling: z.record(z.string()).optional(),
});

export type Component = z.infer<typeof ComponentSchema>;

// Test Scenario Schema
export const TestScenarioSchema = z.object({
  name: z.string(),
  description: z.string(),
  steps: z.array(z.object({
    action: z.enum(['click', 'fill', 'expect', 'navigate']),
    target: z.string(),
    value: z.string().optional(),
    assertion: z.string().optional(),
  })),
  platform: z.enum(['web', 'cli', 'tui', 'desktop']).optional(),
});

export type TestScenario = z.infer<typeof TestScenarioSchema>;

// Test Definition Schema
export const TestDefinitionSchema = z.object({
  scenarios: z.array(TestScenarioSchema),
  coverage: z.string().default('90%'),
  timeout: z.number().default(30000),
  retries: z.number().default(0),
});

export type TestDefinition = z.infer<typeof TestDefinitionSchema>;

// Profile UI Configuration Schema
export const ProfileUISchema = z.object({
  platform: z.enum(['web', 'cli', 'tui', 'desktop']),
  routes: z.record(RouteSchema),
  forms: z.record(FormSchema).optional(),
  components: z.record(ComponentSchema).optional(),
  tests: TestDefinitionSchema.optional(),
  theme: z.record(z.string()).optional(),
  config: z.record(z.any()).optional(),
});

export type ProfileUI = z.infer<typeof ProfileUISchema>;

// Generator Options
export interface GeneratorOptions {
  platform: Platform;
  outputDir: string;
  templateDir?: string;
  overwrite?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
}

// Generated Artifact
export interface GeneratedArtifact {
  type: 'route' | 'component' | 'form' | 'test' | 'config';
  filename: string;
  path: string;
  content: string;
  dependencies?: string[];
  platform: Platform;
}

// Generator Interface
export interface UIGenerator {
  platform: Platform;
  generate(ui: ProfileUI, options: GeneratorOptions): Promise<GeneratedArtifact[]>;
  generateRoute(route: Route, options: GeneratorOptions): Promise<GeneratedArtifact>;
  generateComponent(component: Component, options: GeneratorOptions): Promise<GeneratedArtifact>;
  generateForm(form: Form, options: GeneratorOptions): Promise<GeneratedArtifact>;
  generateTests(tests: TestDefinition, options: GeneratorOptions): Promise<GeneratedArtifact[]>;
  validateOptions(options: GeneratorOptions): boolean;
}

// Scaffolder Interface
export interface UIScaffolder {
  addGenerator(generator: UIGenerator): void;
  removeGenerator(platform: Platform): void;
  scaffold(ui: ProfileUI, options: GeneratorOptions): Promise<ScaffoldResult>;
  parseCUE(cuePath: string): Promise<ProfileUI>;
  validate(ui: ProfileUI): ValidationResult;
}

// Scaffolding Result
export interface ScaffoldResult {
  success: boolean;
  artifacts: GeneratedArtifact[];
  errors: string[];
  warnings: string[];
  stats: {
    routesGenerated: number;
    componentsGenerated: number;
    formsGenerated: number;
    testsGenerated: number;
    duration: number;
  };
}

// Validation Result
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  path: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  path: string;
  message: string;
  code: string;
}

// Template Context for Code Generation
export interface TemplateContext {
  platform: Platform;
  component?: Component;
  form?: Form;
  route?: Route;
  tests?: TestDefinition;
  config: Record<string, any>;
  imports: string[];
  exports: string[];
}

// Platform-specific Generator Configuration
export interface WebGeneratorConfig {
  framework: 'react' | 'vue' | 'svelte';
  typescript: boolean;
  cssFramework: 'tailwind' | 'styled-components' | 'css-modules';
  testing: 'jest' | 'vitest' | 'playwright';
  routing: 'react-router' | 'next-router' | 'vue-router';
}

export interface CLIGeneratorConfig {
  framework: 'commander' | 'yargs' | 'oclif';
  typescript: boolean;
  testing: 'jest' | 'vitest' | 'tap';
}

export interface TUIGeneratorConfig {
  framework: 'blessed' | 'ink' | 'terminal-kit';
  typescript: boolean;
  testing: 'jest' | 'vitest';
}

export interface DesktopGeneratorConfig {
  framework: 'electron' | 'tauri' | 'neutralino';
  frontend: 'react' | 'vue' | 'svelte' | 'vanilla';
  typescript: boolean;
  testing: 'jest' | 'vitest' | 'playwright';
}

// Error Classes
export class UIScaffoldError extends Error {
  constructor(
    message: string,
    public code: string,
    public platform?: Platform,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'UIScaffoldError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public path: string,
    public rule: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class GeneratorError extends Error {
  constructor(
    message: string,
    public platform: Platform,
    public artifact?: string
  ) {
    super(message);
    this.name = 'GeneratorError';
  }
}

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Constants
export const SUPPORTED_PLATFORMS: readonly Platform[] = ['web', 'cli', 'tui', 'desktop'] as const;

export const DEFAULT_GENERATOR_OPTIONS: Partial<GeneratorOptions> = {
  overwrite: false,
  dryRun: false,
  verbose: false,
} as const;

export const COMPONENT_TEMPLATES = {
  web: {
    react: 'react-component.tsx.template',
    vue: 'vue-component.vue.template',
    svelte: 'svelte-component.svelte.template',
  },
  cli: {
    commander: 'cli-command.ts.template',
    yargs: 'yargs-command.ts.template',
  },
  tui: {
    blessed: 'blessed-component.ts.template',
    ink: 'ink-component.tsx.template',
  },
  desktop: {
    electron: 'electron-component.tsx.template',
    tauri: 'tauri-component.tsx.template',
  },
} as const;

// Shared Utility Functions
/**
 * Common validation logic for generator options
 * Eliminates duplication across all platform generators
 */
export function validateGeneratorOptions(options: GeneratorOptions, expectedPlatform: Platform): boolean {
  if (options.platform !== expectedPlatform) {
    return false;
  }

  if (!options.outputDir) {
    return false;
  }

  return true;
}