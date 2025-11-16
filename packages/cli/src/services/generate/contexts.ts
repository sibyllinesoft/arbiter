import type { ServiceEndpointSpec } from "@arbiter/shared-types/cli";

export interface ClientGenerationContext {
  slug: string;
  root: string;
  routesDir: string;
}

export interface ServiceGenerationContext {
  name: string;
  root: string;
  routesDir: string;
  language: string;
  originalName?: string;
  endpoints?: Record<string, ServiceEndpointSpec>;
}
