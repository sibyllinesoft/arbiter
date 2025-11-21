import type { ParameterFormState, ResponseFormState } from "./types";

export const createId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

export const createParameter = (
  overrides: Partial<ParameterFormState> = {},
): ParameterFormState => ({
  id: createId("param"),
  name: "",
  location: "path",
  description: "",
  required: true,
  schemaType: "string",
  schemaRef: "",
  example: "",
  ...overrides,
});

export const createResponse = (overrides: Partial<ResponseFormState> = {}): ResponseFormState => ({
  id: createId("response"),
  status: "200",
  description: "Successful response",
  contentType: "application/json",
  schemaRef: "",
  example: "",
  ...overrides,
});

export function toTagArray(tags: string): string[] {
  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

export function buildSchemaObject(schemaType: string, schemaRef: string, example?: string) {
  const schema: Record<string, unknown> = {};
  if (schemaRef.trim()) {
    schema.$ref = schemaRef.trim();
  } else if (schemaType.trim()) {
    schema.type = schemaType.trim();
  }
  if (example && example.trim()) {
    schema.example = example.trim();
  }
  return Object.keys(schema).length > 0 ? schema : undefined;
}
