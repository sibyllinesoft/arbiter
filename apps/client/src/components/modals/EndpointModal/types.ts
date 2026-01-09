import type { FieldValue } from "../entityTypes";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type ParameterLocation = "path" | "query" | "header" | "cookie";
export type SectionId = "endpoint" | "request" | "parameters" | "responses";

export interface EndpointModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    entityType: string;
    values: Record<string, FieldValue>;
  }) => Promise<void> | void;
  groupLabel?: string;
  mode?: "create" | "edit";
  initialValues?: Record<string, FieldValue> | null;
}

export interface ParameterFormState {
  id: string;
  name: string;
  location: ParameterLocation;
  description: string;
  required: boolean;
  schemaType: string;
  schemaRef: string;
  example: string;
}

export interface ResponseFormState {
  id: string;
  status: string;
  description: string;
  contentType: string;
  schemaRef: string;
  example: string;
}

export interface RequestBodyState {
  description: string;
  required: boolean;
  contentType: string;
  schemaRef: string;
  example: string;
}

export interface EndpointFormState {
  path: string;
  method: HttpMethod;
  summary: string;
  description: string;
  operationId: string;
  tags: string;
  requestBody: RequestBodyState;
  parameters: ParameterFormState[];
  responses: ResponseFormState[];
}
