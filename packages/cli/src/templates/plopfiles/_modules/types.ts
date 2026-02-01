/**
 * Module Types for Composable Templates
 *
 * Each module exports a function that returns plop actions,
 * plus metadata about dependencies and scripts.
 */

import type { ActionType } from "node-plop";

/**
 * Context passed from Arbiter CUE spec to template modules
 */
export interface ModuleContext {
  // From CUE spec
  name: string;
  language?: string;
  framework?: string;
  sourceDirectory?: string;

  // Service-specific
  serviceType?: string;
  platform?: string;
  ports?: Array<{ name: string; port: number; targetPort?: number }>;

  // Database-specific
  infrastructureType?: string;
  image?: string;
  attachTo?: string;

  // Computed paths
  projectDir: string;
  backendDir?: string;
  frontendDir?: string;

  // User selections for composition
  backend?: string;
  frontend?: string;
  database?: string;
  infra?: string[];

  // Additional impl options
  impl?: Record<string, unknown>;

  // Allow arbitrary additional fields from spec
  [key: string]: unknown;
}

/**
 * Package.json dependency entries
 */
export interface Dependencies {
  [packageName: string]: string;
}

/**
 * Package.json script entries
 */
export interface Scripts {
  [scriptName: string]: string;
}

/**
 * Module definition - what each module.js exports
 */
export interface TemplateModule {
  /** Returns plop actions for this module */
  default: (data: ModuleContext) => ActionType[];

  /** Runtime dependencies to merge into package.json */
  dependencies?: Dependencies;

  /** Dev dependencies to merge into package.json */
  devDependencies?: Dependencies;

  /** Scripts to merge into package.json */
  scripts?: Scripts;

  /** Environment variables this module needs */
  envVars?: Record<string, string>;

  /** Other modules this depends on (for ordering) */
  requires?: string[];

  /** Human-readable description */
  description?: string;
}

/**
 * Manifest for a composed project
 */
export interface ComposedManifest {
  name: string;
  modules: string[];
  dependencies: Dependencies;
  devDependencies: Dependencies;
  scripts: Scripts;
  envVars: Record<string, string>;
}
