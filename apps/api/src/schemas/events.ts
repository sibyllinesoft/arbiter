import { z } from "zod";

export const setHeadSchema = z.object({
  head_event_id: z.string().trim().min(1).nullable().optional(),
  headEventId: z.string().trim().min(1).nullable().optional(),
});

export const revertEventsSchema = z.object({
  event_ids: z.array(z.string().trim().min(1)),
});
