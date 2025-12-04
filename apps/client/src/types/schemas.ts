import { z } from "zod";

export const websocketEnvelopeSchema = z.object({
  type: z.enum(["event", "error", "ping", "pong"]),
  project_id: z.string().optional(),
  data: z.unknown(),
});

export const websocketEventSchema = z
  .object({
    event_type: z.string(),
    project_id: z.string().optional(),
    timestamp: z.string().optional(),
    data: z.unknown().optional(),
    channel: z.string().optional(),
    connection_id: z.string().optional(),
  })
  .passthrough();

export const websocketErrorSchema = z
  .object({
    error: z.string().optional(),
    message: z.string().optional(),
    project_id: z.string().optional(),
  })
  .passthrough();

export type WebsocketEnvelope = z.infer<typeof websocketEnvelopeSchema>;
export type WebsocketEvent = z.infer<typeof websocketEventSchema>;
