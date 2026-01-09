declare module "@hono/zod-validator" {
  import type { ZodSchema, ZodTypeAny } from "zod";
  import type { MiddlewareHandler, Context } from "hono";

  export type InferOutput<T extends ZodTypeAny> = T extends ZodSchema<infer O> ? O : never;

  // Overload used as zValidator("json", schema)
  export function zValidator<T extends ZodTypeAny, K extends string = string>(
    target: K,
    schema: T,
  ): MiddlewareHandler<{ Variables: { valid: Record<K, InferOutput<T>> } }>;

  // Overload used as zValidator(schema)
  export function zValidator<T extends ZodTypeAny>(
    schema: T,
  ): MiddlewareHandler<{ Variables: { valid: InferOutput<T> } }>;
}
