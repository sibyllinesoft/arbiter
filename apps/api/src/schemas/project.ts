import { z } from "zod";

export const createProjectSchema = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().min(1, "Project name is required"),
  presetId: z.string().trim().optional(),
  path: z.string().trim().optional(),
});

export type CreateProjectDto = z.infer<typeof createProjectSchema>;
