/**
 * Unit tests for EndpointModal utility functions.
 */
import { describe, expect, it } from "vitest";
import type {
  EndpointFormState,
  ParameterFormState,
  RequestBodyState,
  ResponseFormState,
} from "./types";
import {
  buildNormalizedParameter,
  buildNormalizedParameters,
  buildRequestBody,
  buildResponsesObject,
  buildSchemaObject,
  computeEndpointSummary,
  computeModalTitle,
  computeParameterSummary,
  computeRequestSummary,
  computeResponseSummary,
  createParameter,
  createResponse,
  hasRequestBodyContent,
  toTagArray,
  validateEndpointForm,
} from "./utils";

describe("createParameter", () => {
  it("creates a parameter with default values", () => {
    const param = createParameter();
    expect(param.id).toMatch(/^param-/);
    expect(param.name).toBe("");
    expect(param.location).toBe("path");
    expect(param.required).toBe(true);
    expect(param.schemaType).toBe("string");
  });

  it("applies overrides", () => {
    const param = createParameter({ name: "userId", location: "query", required: false });
    expect(param.name).toBe("userId");
    expect(param.location).toBe("query");
    expect(param.required).toBe(false);
  });
});

describe("createResponse", () => {
  it("creates a response with default values", () => {
    const response = createResponse();
    expect(response.id).toMatch(/^response-/);
    expect(response.status).toBe("200");
    expect(response.description).toBe("Successful response");
    expect(response.contentType).toBe("application/json");
  });

  it("applies overrides", () => {
    const response = createResponse({ status: "404", description: "Not found" });
    expect(response.status).toBe("404");
    expect(response.description).toBe("Not found");
  });
});

describe("toTagArray", () => {
  it("splits comma-separated tags", () => {
    expect(toTagArray("users, accounts, auth")).toEqual(["users", "accounts", "auth"]);
  });

  it("trims whitespace from tags", () => {
    expect(toTagArray("  users  ,  accounts  ")).toEqual(["users", "accounts"]);
  });

  it("filters empty tags", () => {
    expect(toTagArray("users,,accounts")).toEqual(["users", "accounts"]);
  });

  it("returns empty array for empty string", () => {
    expect(toTagArray("")).toEqual([]);
  });
});

describe("buildSchemaObject", () => {
  it("returns undefined for empty inputs", () => {
    expect(buildSchemaObject("", "", "")).toBeUndefined();
  });

  it("builds schema with $ref when schemaRef is provided", () => {
    expect(buildSchemaObject("", "#/components/schemas/User")).toEqual({
      $ref: "#/components/schemas/User",
    });
  });

  it("builds schema with type when schemaType is provided", () => {
    expect(buildSchemaObject("string", "")).toEqual({ type: "string" });
  });

  it("prefers $ref over type when both provided", () => {
    const result = buildSchemaObject("string", "#/components/schemas/User");
    expect(result?.$ref).toBe("#/components/schemas/User");
    expect(result?.type).toBeUndefined();
  });

  it("includes example when provided", () => {
    expect(buildSchemaObject("string", "", "example value")).toEqual({
      type: "string",
      example: "example value",
    });
  });
});

describe("buildNormalizedParameter", () => {
  it("returns null for parameter without name", () => {
    const param = createParameter({ name: "  " });
    expect(buildNormalizedParameter(param)).toBeNull();
  });

  it("builds normalized parameter object", () => {
    const param = createParameter({
      name: "userId",
      location: "path",
      description: "User ID",
      required: true,
      schemaType: "string",
    });
    const result = buildNormalizedParameter(param);
    expect(result).toEqual({
      name: "userId",
      in: "path",
      description: "User ID",
      required: true,
      schema: { type: "string" },
    });
  });

  it("omits undefined description", () => {
    const param = createParameter({ name: "id", description: "" });
    const result = buildNormalizedParameter(param);
    expect(result?.description).toBeUndefined();
  });
});

describe("buildNormalizedParameters", () => {
  it("filters out invalid parameters", () => {
    const params = [
      createParameter({ name: "valid" }),
      createParameter({ name: "" }),
      createParameter({ name: "alsoValid" }),
    ];
    const result = buildNormalizedParameters(params);
    expect(result).toHaveLength(2);
    expect(result[0]!.name).toBe("valid");
    expect(result[1]!.name).toBe("alsoValid");
  });

  it("returns empty array for no valid parameters", () => {
    expect(buildNormalizedParameters([])).toEqual([]);
  });
});

describe("buildRequestBody", () => {
  it("returns undefined for empty request body", () => {
    const body: RequestBodyState = {
      contentType: "",
      description: "",
      schemaRef: "",
      example: "",
      required: false,
    };
    expect(buildRequestBody(body)).toBeUndefined();
  });

  it("builds request body with content type", () => {
    const body: RequestBodyState = {
      contentType: "application/json",
      description: "Request payload",
      schemaRef: "#/components/schemas/User",
      example: "",
      required: true,
    };
    const result = buildRequestBody(body);
    expect(result).toEqual({
      description: "Request payload",
      required: true,
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/User" },
        },
      },
    });
  });

  it("includes example in media object", () => {
    const body: RequestBodyState = {
      contentType: "application/json",
      description: "",
      schemaRef: "",
      example: "example data",
      required: false,
    };
    const result = buildRequestBody(body);
    expect(result?.content?.["application/json"]?.example).toBe("example data");
  });
});

describe("buildResponsesObject", () => {
  it("returns empty object for empty array", () => {
    expect(buildResponsesObject([])).toEqual({});
  });

  it("skips responses without status", () => {
    const responses = [createResponse({ status: "" })];
    expect(buildResponsesObject(responses)).toEqual({});
  });

  it("builds responses keyed by status", () => {
    const responses = [
      createResponse({ status: "200", description: "Success" }),
      createResponse({ status: "404", description: "Not found" }),
    ];
    const result = buildResponsesObject(responses);
    expect(Object.keys(result)).toEqual(["200", "404"]);
    expect(result["200"]!.description).toBe("Success");
    expect(result["404"]!.description).toBe("Not found");
  });

  it("includes content when contentType is provided", () => {
    const responses = [
      createResponse({
        status: "200",
        contentType: "application/json",
        schemaRef: "#/components/schemas/User",
      }),
    ];
    const result = buildResponsesObject(responses);
    expect(result["200"]!.content).toEqual({
      "application/json": {
        schema: { $ref: "#/components/schemas/User" },
      },
    });
  });
});

describe("validateEndpointForm", () => {
  const baseForm: EndpointFormState = {
    path: "/users",
    method: "GET",
    summary: "",
    description: "",
    operationId: "",
    tags: "",
    requestBody: {
      contentType: "",
      description: "",
      schemaRef: "",
      example: "",
      required: false,
    },
    parameters: [],
    responses: [createResponse()],
  };

  it("returns empty errors for valid form", () => {
    expect(validateEndpointForm(baseForm)).toEqual({});
  });

  it("validates path is required", () => {
    const errors = validateEndpointForm({ ...baseForm, path: "" });
    expect(errors.path).toBe("Path is required");
  });

  it("validates at least one response is required", () => {
    const errors = validateEndpointForm({ ...baseForm, responses: [] });
    expect(errors.responses).toBe("At least one response is required");
  });

  it("validates response status codes are required", () => {
    const errors = validateEndpointForm({
      ...baseForm,
      responses: [createResponse({ status: "" })],
    });
    expect(errors.responses).toBe("Each response must include a status code");
  });

  it("validates request body requires content type when fields are set", () => {
    const errors = validateEndpointForm({
      ...baseForm,
      requestBody: {
        ...baseForm.requestBody,
        description: "Request body description",
        contentType: "",
      },
    });
    expect(errors.requestBody).toBe("Request body requires a content type");
  });
});

describe("computeModalTitle", () => {
  it("returns default title for undefined groupLabel", () => {
    expect(computeModalTitle(undefined, "create")).toBe("Add Endpoint");
    expect(computeModalTitle(undefined, "edit")).toBe("Update Endpoint");
  });

  it("singularizes group label ending in s", () => {
    expect(computeModalTitle("Routes", "create")).toBe("Add Route");
    expect(computeModalTitle("Endpoints", "edit")).toBe("Update Endpoint");
  });

  it("handles label without s ending", () => {
    expect(computeModalTitle("Endpoint", "create")).toBe("Add Endpoint");
  });

  it("handles empty string as undefined", () => {
    expect(computeModalTitle("", "create")).toBe("Add Endpoint");
    expect(computeModalTitle("  ", "create")).toBe("Add Endpoint");
  });
});

describe("hasRequestBodyContent", () => {
  const emptyBody: RequestBodyState = {
    contentType: "",
    description: "",
    schemaRef: "",
    example: "",
    required: false,
  };

  it("returns false for empty request body", () => {
    expect(hasRequestBodyContent(emptyBody)).toBe(false);
  });

  it("returns true when contentType is set", () => {
    expect(hasRequestBodyContent({ ...emptyBody, contentType: "application/json" })).toBe(true);
  });

  it("returns true when description is set", () => {
    expect(hasRequestBodyContent({ ...emptyBody, description: "Body description" })).toBe(true);
  });

  it("returns true when schemaRef is set", () => {
    expect(hasRequestBodyContent({ ...emptyBody, schemaRef: "#/components/schemas/User" })).toBe(
      true,
    );
  });

  it("returns true when example is set", () => {
    expect(hasRequestBodyContent({ ...emptyBody, example: "example" })).toBe(true);
  });
});

describe("computeEndpointSummary", () => {
  it("returns method and path", () => {
    expect(computeEndpointSummary("GET", "/users")).toBe("GET /users");
  });

  it("uses default path when empty", () => {
    expect(computeEndpointSummary("POST", "")).toBe("POST /");
  });
});

describe("computeRequestSummary", () => {
  const emptyBody: RequestBodyState = {
    contentType: "",
    description: "",
    schemaRef: "",
    example: "",
    required: false,
  };

  it("returns no request body for empty body", () => {
    expect(computeRequestSummary(emptyBody)).toBe("No request body");
  });

  it("returns content type when set", () => {
    expect(computeRequestSummary({ ...emptyBody, contentType: "application/json" })).toBe(
      "application/json",
    );
  });

  it("returns optional request body when fields set without content type", () => {
    expect(computeRequestSummary({ ...emptyBody, description: "Something" })).toBe(
      "Optional request body",
    );
  });
});

describe("computeParameterSummary", () => {
  it("returns no parameters for zero count", () => {
    expect(computeParameterSummary(0)).toBe("No parameters yet");
  });

  it("returns singular for one parameter", () => {
    expect(computeParameterSummary(1)).toBe("1 parameter");
  });

  it("returns plural for multiple parameters", () => {
    expect(computeParameterSummary(3)).toBe("3 parameters");
  });
});

describe("computeResponseSummary", () => {
  it("returns no responses for zero count", () => {
    expect(computeResponseSummary(0)).toBe("No responses yet");
  });

  it("returns singular for one response", () => {
    expect(computeResponseSummary(1)).toBe("1 response");
  });

  it("returns plural for multiple responses", () => {
    expect(computeResponseSummary(5)).toBe("5 responses");
  });
});
