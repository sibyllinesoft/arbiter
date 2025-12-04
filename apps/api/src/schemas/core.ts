import { z } from "zod";

export const searchSchema = z.object({
  query: z.string().min(1, "query is required"),
  type: z.enum(["all", "specs", "docs"]).optional().default("all"),
  limit: z.number().int().positive().max(200).optional().default(10),
});

export const fetchSchema = z.object({
  path: z.string().min(1, "path is required"),
  encoding: z.string().optional().default("utf-8"),
});
