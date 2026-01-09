import type {
  EndpointFormState,
  ParameterFormState,
  RequestBodyState,
  ResponseFormState,
} from "./types";

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

/** Build a normalized parameter object for submission */
export function buildNormalizedParameter(
  param: ParameterFormState,
): Record<string, unknown> | null {
  if (!param.name.trim()) return null;
  const schema = buildSchemaObject(param.schemaType, param.schemaRef, param.example);
  return {
    name: param.name.trim(),
    in: param.location,
    description: param.description.trim() || undefined,
    required: param.required,
    ...(schema ? { schema } : {}),
  };
}

/** Build normalized parameters array for submission */
export function buildNormalizedParameters(
  parameters: ParameterFormState[],
): Record<string, unknown>[] {
  return parameters
    .map(buildNormalizedParameter)
    .filter((p): p is Record<string, unknown> => p !== null);
}

/** Build request body object for submission */
export function buildRequestBody(
  requestBody: RequestBodyState,
): Record<string, unknown> | undefined {
  const contentType = requestBody.contentType.trim();
  const description = requestBody.description.trim();
  const schemaRef = requestBody.schemaRef.trim();
  const exampleValue = requestBody.example.trim();

  if (!contentType && !description && !schemaRef && !exampleValue) {
    return undefined;
  }

  const schema = buildSchemaObject("", requestBody.schemaRef, requestBody.example);
  const mediaObject: Record<string, unknown> = {};
  if (schema) {
    mediaObject.schema = schema;
  }
  if (exampleValue) {
    mediaObject.example = exampleValue;
  }

  return {
    description: description || undefined,
    required: requestBody.required,
    content: contentType
      ? { [contentType]: Object.keys(mediaObject).length > 0 ? mediaObject : {} }
      : undefined,
  };
}

/** Build a single response object for submission */
function buildSingleResponse(response: ResponseFormState): Record<string, unknown> {
  const description = response.description.trim() || "Response";
  const contentType = response.contentType.trim();
  const schema = buildSchemaObject("", response.schemaRef, response.example);
  const responseObj: Record<string, unknown> = { description };

  if (contentType) {
    const media: Record<string, unknown> = {};
    if (schema) {
      media.schema = schema;
    }
    const example = response.example.trim();
    if (example) {
      media.example = example;
    }
    responseObj.content = { [contentType]: media };
  }

  return responseObj;
}

/** Build responses object for submission */
export function buildResponsesObject(
  responses: ResponseFormState[],
): Record<string, Record<string, unknown>> {
  return responses.reduce<Record<string, Record<string, unknown>>>((acc, response) => {
    const statusKey = response.status.trim();
    if (!statusKey) return acc;
    acc[statusKey] = buildSingleResponse(response);
    return acc;
  }, {});
}

/** Validate endpoint form and return errors */
export function validateEndpointForm(form: EndpointFormState): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!form.path.trim()) {
    errors.path = "Path is required";
  }

  if (!form.responses.length) {
    errors.responses = "At least one response is required";
  } else if (form.responses.some((r) => !r.status.trim())) {
    errors.responses = "Each response must include a status code";
  }

  const contentType = form.requestBody.contentType.trim();
  const hasAdditionalFields =
    form.requestBody.description.trim().length > 0 ||
    form.requestBody.schemaRef.trim().length > 0 ||
    form.requestBody.example.trim().length > 0;
  if (hasAdditionalFields && !contentType) {
    errors.requestBody = "Request body requires a content type";
  }

  return errors;
}

/** Compute modal title based on group label and mode */
export function computeModalTitle(groupLabel: string | undefined, mode: "create" | "edit"): string {
  const fallback = "Endpoint";
  if (!groupLabel) {
    return mode === "edit" ? `Update ${fallback}` : `Add ${fallback}`;
  }
  const trimmed = groupLabel.trim();
  if (!trimmed) {
    return mode === "edit" ? `Update ${fallback}` : `Add ${fallback}`;
  }
  const singular = trimmed.endsWith("s") ? trimmed.slice(0, -1) : trimmed;
  return mode === "edit" ? `Update ${singular}` : `Add ${singular}`;
}

/** Check if request body has any content */
export function hasRequestBodyContent(requestBody: RequestBodyState): boolean {
  return (
    requestBody.contentType.trim().length > 0 ||
    requestBody.description.trim().length > 0 ||
    requestBody.schemaRef.trim().length > 0 ||
    requestBody.example.trim().length > 0
  );
}

/** Compute endpoint summary string */
export function computeEndpointSummary(method: string, path: string): string {
  return `${method} ${path || "/"}`;
}

/** Compute request body summary string */
export function computeRequestSummary(requestBody: RequestBodyState): string {
  const hasContent = hasRequestBodyContent(requestBody);
  return hasContent ? requestBody.contentType.trim() || "Optional request body" : "No request body";
}

/** Compute parameters summary string */
export function computeParameterSummary(count: number): string {
  if (count === 0) return "No parameters yet";
  return `${count} ${count === 1 ? "parameter" : "parameters"}`;
}

/** Compute responses summary string */
export function computeResponseSummary(count: number): string {
  if (count === 0) return "No responses yet";
  return `${count} ${count === 1 ? "response" : "responses"}`;
}

/** Build the complete endpoint submission payload */
export function buildEndpointPayload(form: EndpointFormState): {
  entityType: string;
  values: Record<string, unknown>;
} | null {
  const tags = toTagArray(form.tags);
  const parameters = buildNormalizedParameters(form.parameters);
  const requestBody = buildRequestBody(form.requestBody);
  const responses = buildResponsesObject(form.responses);

  if (Object.keys(responses).length === 0) {
    return null;
  }

  const methodKey = form.method.toLowerCase();
  const operation: Record<string, unknown> = {
    summary: form.summary.trim() || undefined,
    description: form.description.trim() || undefined,
    operationId: form.operationId.trim() || undefined,
    tags: tags.length > 0 ? tags : undefined,
    parameters: parameters.length > 0 ? parameters : undefined,
    requestBody,
    responses,
  };

  const normalizedPath = form.path.trim() || "/";
  const normalizedSummary = form.summary.trim();
  const normalizedDescription = form.description.trim();
  const normalizedOperationId = form.operationId.trim();

  return {
    entityType: "route",
    values: {
      name: normalizedSummary || `${form.method} ${normalizedPath}`,
      path: normalizedPath,
      method: form.method,
      summary: normalizedSummary,
      description: normalizedDescription,
      operationId: normalizedOperationId,
      tags,
      operations: { [methodKey]: operation },
    },
  };
}
