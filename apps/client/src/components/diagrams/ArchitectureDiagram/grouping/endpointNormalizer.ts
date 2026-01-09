/**
 * @module ArchitectureDiagram/grouping/endpointNormalizer
 * Normalizes endpoint data into properly typed RouteEndpoint structures.
 */

import type {
  RouteEndpoint,
  RouteEndpointDocumentation,
  RouteEndpointParameter,
  RouteEndpointResponse,
} from "./types";

/**
 * Normalizes parameters array from raw endpoint data.
 */
const normalizeParameters = (rawParams: unknown): RouteEndpointParameter[] => {
  if (!Array.isArray(rawParams)) return [];

  return rawParams.map((parameter: any) => {
    const param = parameter as Partial<RouteEndpointParameter> & { name?: string };
    const normalized: RouteEndpointParameter = {
      name: String(param.name ?? "").trim() || "param",
      optional: Boolean(param.optional),
    };
    if (param.type !== undefined && param.type !== null) {
      normalized.type = String(param.type);
    }
    if (param.description !== undefined && param.description !== null) {
      normalized.description = String(param.description);
    }
    if (Array.isArray(param.decorators) && param.decorators.length > 0) {
      normalized.decorators = param.decorators.map((dec: any) => String(dec));
    }
    return normalized;
  });
};

/**
 * Normalizes responses array from raw endpoint data.
 */
const normalizeResponses = (rawResponses: unknown): RouteEndpointResponse[] => {
  if (!Array.isArray(rawResponses)) return [];

  return rawResponses.map((response: any) => {
    const res = response as Partial<RouteEndpointResponse>;
    const decorator: RouteEndpointResponse["decorator"] =
      res.decorator === "SuccessResponse" ? "SuccessResponse" : "Response";
    const normalized: RouteEndpointResponse = { decorator };
    if (res.status !== undefined && res.status !== null) {
      normalized.status = String(res.status);
    }
    if (res.description !== undefined && res.description !== null) {
      normalized.description = String(res.description);
    }
    return normalized;
  });
};

/**
 * Normalizes documentation object from raw endpoint data.
 */
const normalizeDocumentation = (raw: unknown): RouteEndpointDocumentation | undefined => {
  if (!raw || typeof raw !== "object") return undefined;

  const payload: RouteEndpointDocumentation = {};
  const doc = raw as Record<string, unknown>;

  if (doc.summary !== undefined) payload.summary = String(doc.summary);
  if (doc.description !== undefined) payload.description = String(doc.description);
  if (doc.returns !== undefined) payload.returns = String(doc.returns);

  const remarks = Array.isArray(doc.remarks) ? doc.remarks.map(String) : [];
  if (remarks.length > 0) payload.remarks = remarks;

  const examples = Array.isArray(doc.examples) ? doc.examples.map(String) : [];
  if (examples.length > 0) payload.examples = examples;

  if (typeof doc.deprecated === "string") {
    payload.deprecated = doc.deprecated;
  } else if (doc.deprecated === true) {
    payload.deprecated = true;
  }

  return Object.keys(payload).length > 0 ? payload : undefined;
};

/**
 * Parses source location from raw endpoint data.
 */
const parseSource = (raw: unknown): { line: number } | undefined => {
  if (!raw || typeof raw !== "object") return undefined;

  const source = raw as { line?: unknown };
  if (typeof source.line === "number") return { line: source.line };
  if (typeof source.line === "string" && source.line.trim().length > 0) {
    const parsed = Number.parseInt(source.line, 10);
    if (!Number.isNaN(parsed)) return { line: parsed };
  }
  return undefined;
};

/**
 * Normalizes an endpoint value to a properly typed RouteEndpoint.
 */
export const normalizeEndpoint = (value: unknown): RouteEndpoint => {
  const base = (value ?? {}) as Partial<RouteEndpoint> & {
    method?: string;
    path?: string;
    controller?: string;
    fullPath?: string;
    handler?: string;
    returnType?: string;
    signature?: string;
    documentation?: unknown;
    parameters?: unknown;
    responses?: unknown;
    tags?: unknown;
    source?: unknown;
  };

  const handler = base.handler ? String(base.handler) : undefined;
  const returnType = base.returnType ? String(base.returnType) : undefined;
  const defaultSignature = `${handler ?? "handler"}()${returnType ? `: ${returnType}` : ""}`;
  const documentation = normalizeDocumentation(base.documentation);
  const tags = Array.isArray(base.tags) ? base.tags.map(String) : [];
  const source = parseSource(base.source);

  const endpoint: RouteEndpoint = {
    method: String(base.method ?? "GET").toUpperCase(),
    signature: base.signature ? String(base.signature) : defaultSignature,
    parameters: normalizeParameters(base.parameters),
    responses: normalizeResponses(base.responses),
  };

  if (base.path != null) endpoint.path = String(base.path);
  if (base.fullPath != null) endpoint.fullPath = String(base.fullPath);
  if (base.controller != null) endpoint.controller = String(base.controller);
  if (handler) endpoint.handler = handler;
  if (returnType) endpoint.returnType = returnType;
  if (documentation) endpoint.documentation = documentation;
  if (tags.length > 0) endpoint.tags = tags;
  if (source) endpoint.source = source;

  return endpoint;
};
