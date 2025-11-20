import { z } from 'zod';

/**
 * {{serviceName}} Validation Schemas
 */

export const {{serviceName}}Schema = z.object({
  id: z.string().uuid().optional(),
});

export const Create{{serviceName}}Schema = {{serviceName}}Schema.omit({ id: true });
export const Update{{serviceName}}Schema = {{serviceName}}Schema.partial();

export type {{serviceName}} = z.infer<typeof {{serviceName}}Schema>;
export type Create{{serviceName}} = z.infer<typeof Create{{serviceName}}Schema>;
export type Update{{serviceName}} = z.infer<typeof Update{{serviceName}}Schema>;
