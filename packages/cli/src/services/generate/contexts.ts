import type { ClientConfig, ServiceEndpointSpec } from "@arbiter/shared-types/cli";

export interface ClientGenerationContext {
  slug: string;
  root: string;
  routesDir: string;
  testsDir: string;
  relativeRoot: string;
  config?: ClientConfig;
}

export interface ServiceGenerationContext {
  name: string;
  root: string;
  routesDir: string;
  testsDir: string;
  language: string;
  originalName?: string;
  endpoints?: Record<string, ServiceEndpointSpec>;
}
