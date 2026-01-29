/**
 * @packageDocumentation
 * Generation context types and builders.
 *
 * Provides context objects for different generation targets:
 * - Client generation context
 * - Service generation context
 * - Package generation context
 */

import type { PackageConfig } from "@arbiter/shared-types/cli";

export interface ClientGenerationContext {
  root: string;
  routesDir: string;
  testsDir: string;
}

export interface ServiceGenerationContext {
  root: string;
  routesDir: string;
  testsDir: string;
}

export interface PackageGenerationContext {
  root: string;
  srcDir: string;
  testsDir: string;
}

export interface ToolGenerationContext {
  root: string;
  srcDir: string;
  testsDir: string;
}

export interface ClientGenerationTarget {
  key: string;
  slug: string;
  relativeRoot: string;
  config?: PackageConfig;
  context: ClientGenerationContext;
  reporter?: import("../util/types.js").GenerationReporter;
}

export interface ServiceGenerationTarget {
  key: string;
  slug: string;
  relativeRoot: string;
  language: string;
  config: PackageConfig | Record<string, unknown>;
  context: ServiceGenerationContext;
  reporter?: import("../util/types.js").GenerationReporter;
}

export interface PackageGenerationTarget {
  key: string;
  slug: string;
  relativeRoot: string;
  language: string;
  config: PackageConfig;
  context: PackageGenerationContext;
  reporter?: import("../util/types.js").GenerationReporter;
}

export interface ToolGenerationTarget {
  key: string;
  slug: string;
  relativeRoot: string;
  language: string;
  config: PackageConfig;
  context: ToolGenerationContext;
  reporter?: import("../util/types.js").GenerationReporter;
}
