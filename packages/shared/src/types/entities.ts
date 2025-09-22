import { z } from 'zod';

/**
 * Component types that can be detected and imported
 */
export const ComponentTypeSchema = z.enum([
  'service',
  'library',
  'cli',
  'frontend',
  'database',
  'external',
]);

export type ComponentType = z.infer<typeof ComponentTypeSchema>;

/**
 * Entity counts for a project
 * These represent the actual detected/imported components
 */
export const ProjectEntityCountsSchema = z.object({
  services: z.number().int().min(0),
  libraries: z.number().int().min(0),
  clis: z.number().int().min(0),
  frontends: z.number().int().min(0),
  databases: z.number().int().min(0),
  external: z.number().int().min(0).optional(),
});

export type ProjectEntityCounts = z.infer<typeof ProjectEntityCountsSchema>;

/**
 * CUE specification entities (architectural concepts)
 * These are different from imported components
 */
export const CueSpecEntitiesSchema = z.object({
  routes: z.number().int().min(0).optional(),
  flows: z.number().int().min(0).optional(),
  capabilities: z.number().int().min(0).optional(),
  endpoints: z.number().int().min(0).optional(),
});

export type CueSpecEntities = z.infer<typeof CueSpecEntitiesSchema>;

/**
 * Complete project entities combining imported components and CUE concepts
 */
export const ProjectEntitiesSchema = ProjectEntityCountsSchema.merge(CueSpecEntitiesSchema);

export type ProjectEntities = z.infer<typeof ProjectEntitiesSchema>;

/**
 * Component/artifact definition
 */
export const ComponentSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: ComponentTypeSchema,
  language: z.string().optional(),
  framework: z.string().optional(),
  version: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  sourceFile: z.string().optional(),
  filePath: z.string().optional(),
});

export type Component = z.infer<typeof ComponentSchema>;

/**
 * Project with properly typed entities
 */
export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['active', 'archived', 'draft']).default('active'),
  entities: ProjectEntitiesSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  lastActivity: z.string().optional(),
});

export type Project = z.infer<typeof ProjectSchema>;

/**
 * Helper to count components by type
 */
export function countComponentsByType(components: Component[]): ProjectEntityCounts {
  const counts: ProjectEntityCounts = {
    services: 0,
    libraries: 0,
    clis: 0,
    frontends: 0,
    databases: 0,
    external: 0,
  };

  for (const component of components) {
    // Normalize types - binary should be cli
    let type = component.type;
    if (type === 'binary') type = 'cli';

    switch (type) {
      case 'service':
        counts.services++;
        break;
      case 'library':
        counts.libraries++;
        break;
      case 'cli':
        counts.clis++;
        break;
      case 'frontend':
        counts.frontends++;
        break;
      case 'database':
        counts.databases++;
        break;
      default:
        counts.external = (counts.external || 0) + 1;
        break;
    }
  }

  return counts;
}
