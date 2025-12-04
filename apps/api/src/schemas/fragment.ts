import { z } from "zod";

export const createFragmentSchema = z.object({
  projectId: z.string().trim().min(1).optional(),
  project_id: z.string().trim().min(1).optional(),
  path: z.string().trim().min(1),
  content: z.string().min(1),
  author: z.string().trim().optional(),
  message: z.string().trim().optional(),
});

export type CreateFragmentDto = z.infer<typeof createFragmentSchema>;
