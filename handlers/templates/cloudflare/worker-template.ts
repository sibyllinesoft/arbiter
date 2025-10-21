/**
 * Cloudflare Worker template for Arbiter Durable Object containers.
 *
 * This script proxies incoming requests to a container-based Durable Object
 * runtime. The generated Wrangler configuration injects environment variables
 * such as `ARBITER_HANDLER_NAMESPACE`, `ARBITER_HANDLER_OBJECT`, and
 * `ARBITER_HANDLER_PORT` which are used here to look up the bound Durable
 * Object namespace and forward traffic to the container port.
 *
 * The template is intentionally conservative; customise the list of forwarded
 * environment variables or request transformation logic to suit your handler.
 */

import type {
  Container,
  DurableObjectNamespace,
  DurableObjectState,
  ExecutionContext,
  Fetcher,
} from "@cloudflare/workers-types";

interface ArbiterEnv extends Record<string, string> {
  ARBITER_HANDLER_ENDPOINT: string;
  ARBITER_HANDLER_NAMESPACE: string;
  ARBITER_HANDLER_OBJECT: string;
  ARBITER_HANDLER_IMAGE: string;
  ARBITER_HANDLER_PORT?: string;
  ARBITER_HANDLER_ENTRYPOINT?: string;
  ARBITER_CONTAINER_FORWARD_ENV?: string;
  ARBITER_CONTAINER_ENABLE_INTERNET?: string;
}

const DEFAULT_CONTAINER_PORT = 8787;

export default {
  async fetch(request: Request, env: ArbiterEnv, _ctx: ExecutionContext): Promise<Response> {
    const namespaceBinding = env.ARBITER_HANDLER_NAMESPACE || "${BINDING_NAME}";
    const durableNamespace = (
      env as unknown as Record<string, DurableObjectNamespace | undefined>
    )[namespaceBinding];

    if (!durableNamespace) {
      return new Response(
        `Durable Object namespace "${namespaceBinding}" is not bound in this deployment.`,
        { status: 500 },
      );
    }

    const objectName = env.ARBITER_HANDLER_OBJECT || "${OBJECT_NAME}";
    const id = durableNamespace.idFromName(objectName);
    const stub = durableNamespace.get(id);
    return stub.fetch(request);
  },
};

export class ${CLASS_NAME} {
  private readonly state: DurableObjectState;
  private readonly env: ArbiterEnv;

  constructor(state: DurableObjectState, env: ArbiterEnv) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const container = await this.ensureContainer();
    const fetcher: Fetcher = container.getTcpPort(this.resolvePort());
    const { method } = request;
    const init: RequestInit = {
      method,
      headers: new Headers(request.headers),
    };

    if (this.shouldForwardBody(method)) {
      const clone = request.clone();
      init.body = await clone.arrayBuffer();
    }

    return fetcher.fetch(request.url, init);
  }

  private shouldForwardBody(method: string): boolean {
    const upper = method.toUpperCase();
    return upper !== "GET" && upper !== "HEAD" && upper !== "OPTIONS";
  }

  private resolvePort(): number {
    const raw = this.env.ARBITER_HANDLER_PORT;
    if (raw) {
      const parsed = Number.parseInt(raw, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
    return DEFAULT_CONTAINER_PORT;
  }

  private async ensureContainer(): Promise<Container> {
    const existing = this.state.container;
    if (existing?.running) {
      return existing;
    }

    return this.state.blockConcurrencyWhile(async () => {
      const current = this.state.container;
      if (!current) {
        throw new Error(
          "Container runtime is unavailable for this Durable Object in the current region.",
        );
      }

      if (!current.running) {
        const entrypoint = this.env.ARBITER_HANDLER_ENTRYPOINT
          ? this.env.ARBITER_HANDLER_ENTRYPOINT.split(/\s+/).filter((token) => token.length > 0)
          : undefined;

        current.start({
          entrypoint,
          enableInternet: this.env.ARBITER_CONTAINER_ENABLE_INTERNET !== "0",
          env: this.collectContainerEnv(),
        });

        this.state.waitUntil(
          current.monitor().catch((error) => {
            console.error("Arbiter Durable Object container exited", error);
          }),
        );
      }

      return current;
    });
  }

  private collectContainerEnv(): Record<string, string> {
    const forwarded = new Map<string, string>();
    const forwardList = (this.env.ARBITER_CONTAINER_FORWARD_ENV ?? "")
      .split(",")
      .map((token) => token.trim())
      .filter((token) => token.length > 0);

    forwarded.set("ARBITER_HANDLER_ENDPOINT", this.env.ARBITER_HANDLER_ENDPOINT);
    forwarded.set("ARBITER_HANDLER_NAMESPACE", this.env.ARBITER_HANDLER_NAMESPACE);
    forwarded.set("ARBITER_HANDLER_OBJECT", this.env.ARBITER_HANDLER_OBJECT);
    forwarded.set("ARBITER_HANDLER_IMAGE", this.env.ARBITER_HANDLER_IMAGE);

    for (const key of forwardList) {
      const value = this.env[key];
      if (typeof value === "string") {
        forwarded.set(key, value);
      }
    }

    return Object.fromEntries(forwarded);
  }
}
