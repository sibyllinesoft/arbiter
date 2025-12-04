import path from "node:path";
import type { EndpointConfig } from "@/cue/index.js";

export interface EndpointOptions {
  service?: string;
  method?: string;
  returns?: string;
  accepts?: string;
  summary?: string;
  description?: string;
  implements?: string;
  handlerModule?: string;
  handlerFn?: string;
  endpointId?: string;
  [key: string]: any;
}

export async function addEndpoint(
  manipulator: any,
  content: string,
  endpoint: string,
  options: EndpointOptions,
): Promise<string> {
  const {
    service = "api",
    method = "GET",
    returns,
    accepts,
    summary,
    description,
    implements: contractRef,
    handlerModule,
    handlerFn,
    endpointId,
  } = options;

  try {
    const ast = await manipulator.parse(content);
    if (!ast.services || !ast.services[service]) {
      throw new Error(
        `Service "${service}" not found. Add it first with: arbiter add service ${service}`,
      );
    }
  } catch {
    if (!content.includes(`${service}:`)) {
      throw new Error(
        `Service "${service}" not found. Add it first with: arbiter add service ${service}`,
      );
    }
  }

  const endpointConfig: EndpointConfig = {
    service,
    path: endpoint,
    method,
    summary,
    description,
    implements: contractRef,
    endpointId: endpointId ?? generateEndpointIdentifier(method, endpoint),
    handler: buildEndpointHandlerDescriptor(service, handlerModule, handlerFn, method, endpoint),
    ...(accepts && { request: { $ref: `#/components/schemas/${accepts}` } }),
    ...(returns && { response: { $ref: `#/components/schemas/${returns}` } }),
  };

  let updatedContent = await manipulator.addEndpoint(content, endpointConfig);

  if (endpoint === "/health" || endpoint.endsWith("/health")) {
    const healthCheck = {
      path: endpoint,
      port: 3000,
    };

    try {
      const ast = await manipulator.parse(updatedContent);
      if (!ast.services[service].healthCheck) {
        ast.services[service].healthCheck = healthCheck;
        updatedContent = await manipulator.serialize(ast, updatedContent);
      }
    } catch {
      console.warn("Could not add health check via AST, health endpoint added to paths only");
    }
  }

  return updatedContent;
}

function generateEndpointIdentifier(method: string, endpoint: string): string {
  const normalizedPath = endpoint.replace(/^\//, "").replace(/[{}]/g, "");
  const segments = normalizedPath
    .split(/[\/_-]+/)
    .filter(Boolean)
    .map((segment) => segment.toLowerCase());
  const methodLower = method.toLowerCase();
  const base = segments.length > 0 ? segments.join("-") : "root";
  return `${methodLower}-${base}`.replace(/-+/g, "-");
}

function buildEndpointHandlerDescriptor(
  service: string,
  modulePath: string | undefined,
  functionName: string | undefined,
  method: string,
  endpoint: string,
) {
  const resolvedModule =
    modulePath ?? path.posix.join(service.replace(/\\/g, "/"), "handlers", "routes");
  const resolvedFunction = functionName ?? generateHandlerFunctionName(method, endpoint, service);
  return {
    type: "module" as const,
    module: resolvedModule,
    function: resolvedFunction,
  };
}

function generateHandlerFunctionName(method: string, endpoint: string, service: string): string {
  const sanitized = endpoint
    .replace(/^\//, "")
    .replace(/[{}]/g, "")
    .split(/[\/_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join("");
  const suffix = sanitized || "Root";
  const prefix = service.replace(/[^a-zA-Z0-9]/g, "");
  return `${method.toLowerCase()}${prefix ? prefix[0].toUpperCase() + prefix.slice(1) : ""}${suffix}`;
}
