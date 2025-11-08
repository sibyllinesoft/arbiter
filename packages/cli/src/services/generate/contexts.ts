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
}
