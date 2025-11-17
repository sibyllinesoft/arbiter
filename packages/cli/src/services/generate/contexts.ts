import type { ClientConfig } from "@arbiter/shared-types/cli";

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

export interface ClientGenerationTarget {
  key: string;
  slug: string;
  relativeRoot: string;
  config?: ClientConfig;
  context: ClientGenerationContext;
}
