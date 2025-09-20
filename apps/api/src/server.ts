/**
 * Refactored Bun HTTP server with modular architecture
 *
 * This version replaces the massive 111KB monolithic server with a clean,
 * modular architecture that separates concerns into dedicated modules:
 *
 * - routes/: API endpoints using Hono framework
 * - websocket/: WebSocket connection and message handling
 * - mcp/: Model Context Protocol tool handlers
 * - static/: Static file serving for frontend
 */
import type { ServerWebSocket } from "bun";
import { Hono } from "hono";
import { AuthService } from "./auth.ts";
import { loadConfig } from "./config.ts";
import { SpecWorkbenchDB } from "./db.ts";
import { EventService } from "./events.ts";
import { HandlerAPIController } from "./handlers/api.js";
import { IRGenerator } from "./ir.ts";
import { McpCliIntegration } from "./mcp-cli-integration.ts";
import { SpecEngine } from "./specEngine.ts";
import type { ServerConfig } from "./types.ts";
import { TokenBucket, createProblemDetails, logger } from "./utils.ts";
import { WebhookService } from "./webhooks.ts";

import { McpService } from "./mcp/index.ts";
// Import modular components
import { type Dependencies, createApiRouter } from "./routes/index.ts";
import { StaticFileHandler } from "./static/index.ts";
import { WebSocketHandler } from "./websocket/index.ts";

export class SpecWorkbenchServer {
  private db: SpecWorkbenchDB;
  private auth: AuthService;
  private specEngine: SpecEngine;
  private irGenerator: IRGenerator;
  private events: EventService;
  private webhooks: WebhookService;
  private handlersApi: HandlerAPIController;
  private mcpCli: McpCliIntegration;
  private rateLimiter: TokenBucket;

  // Modular components
  private apiRouter: ReturnType<typeof createApiRouter>;
  private httpApp: Hono;
  private wsHandler: WebSocketHandler;
  private mcpService: McpService;
  private staticHandler: StaticFileHandler;

  constructor(private config: ServerConfig) {
    // Initialize core services
    this.db = new SpecWorkbenchDB(config);
    this.auth = new AuthService(config);
    this.specEngine = new SpecEngine(config);
    this.irGenerator = new IRGenerator();
    this.events = new EventService(config);
    this.webhooks = new WebhookService(config, this.events, this.db);
    this.handlersApi = new HandlerAPIController(this.webhooks.getHandlerManager());
    this.mcpCli = new McpCliIntegration();
    this.rateLimiter = new TokenBucket(
      config.rate_limit.max_tokens,
      config.rate_limit.refill_rate,
      config.rate_limit.window_ms,
    );

    // Initialize modular components
    const dependencies: Dependencies = {
      db: this.db,
      specEngine: this.specEngine,
      events: this.events,
      auth: this.auth,
      webhooks: this.webhooks,
      handlersApi: this.handlersApi,
      config: this.config,
    };

    this.apiRouter = createApiRouter(dependencies);
    this.httpApp = new Hono();
    this.wsHandler = new WebSocketHandler(this.auth, this.events, config.websocket);
    this.mcpService = new McpService(this.auth, this.mcpCli);
    this.staticHandler = new StaticFileHandler();

    this.httpApp.use("*", async (c, next) => {
      await next();

      if (c.res) {
        const corsHeaders = this.getCorsHeaders();
        for (const [key, value] of Object.entries(corsHeaders)) {
          if (!c.res.headers.has(key)) {
            c.res.headers.set(key, value);
          }
        }
      }
    });

    this.httpApp.route("/", this.apiRouter);

    this.httpApp.all("/mcp", async (c) => {
      logger.info("MCP request received", {
        method: c.req.method,
        userAgent: c.req.header("user-agent"),
        contentType: c.req.header("content-type"),
      });
      const corsHeaders = this.getCorsHeaders();
      return await this.mcpService.handleRequest(c.req.raw, corsHeaders);
    });

    this.httpApp.all("/webhooks/*", async (c) => {
      const corsHeaders = this.getCorsHeaders();
      return await this.webhooks.handleRequest(c.req.raw, corsHeaders);
    });

    this.httpApp.notFound(async (c) => {
      const corsHeaders = this.getCorsHeaders();
      const pathname = new URL(c.req.url).pathname;

      if (this.staticHandler.shouldServeStaticFile(pathname)) {
        return await this.staticHandler.serveFile(pathname, corsHeaders);
      }

      return this.createNotFoundResponse(pathname, corsHeaders);
    });

    this.httpApp.onError((err, c) => {
      return this.handleRequestError(err, c.req.method, new URL(c.req.url).pathname);
    });

    // Clean up rate limiter buckets periodically
    setInterval(() => {
      this.rateLimiter.cleanup();
    }, 60000); // Every minute
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    const self = this;

    // Start OAuth service if enabled
    await this.auth.startOAuthService();

    const _server = Bun.serve({
      port: this.config.port,
      hostname: this.config.host,

      async fetch(request, server) {
        return await self.handleRequest(request, server);
      },

      websocket: {
        message: async (ws, message) => {
          await self.wsHandler.handleMessage(
            ws as any,
            typeof message === "string" ? message : message.toString(),
          );
        },

        open: (ws) => {
          self.wsHandler.handleOpen(ws as any);
        },

        close: (ws) => {
          self.wsHandler.handleClose(ws as any);
        },
      },
    });

    logger.info("🚀 Arbiter API server started", {
      port: this.config.port,
      host: this.config.host,
      environment: process.env.NODE_ENV || "development",
    });
  }

  /**
   * Get CORS headers
   */
  private getCorsHeaders(): Record<string, string> {
    return {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-Requested-With, Accept, Origin, X-API-Key, " +
        "X-GitHub-Event, X-Hub-Signature-256, X-GitLab-Event, X-GitLab-Token",
      "Access-Control-Expose-Headers": "Content-Length, X-Request-ID",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Max-Age": "86400",
    };
  }

  /**
   * Handle preflight requests
   */
  private handlePreflightRequest(corsHeaders: Record<string, string>): Response {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  /**
   * Check rate limiting
   */
  private checkRateLimit(request: Request, corsHeaders: Record<string, string>): Response | null {
    const clientId = this.getClientId(request);

    if (!this.rateLimiter.consume(clientId)) {
      return new Response(
        JSON.stringify(createProblemDetails(429, "Too Many Requests", "Rate limit exceeded")),
        {
          status: 429,
          headers: {
            "Content-Type": "application/problem+json",
            "Retry-After": "60",
            ...corsHeaders,
          },
        },
      );
    }

    return null;
  }

  /**
   * Main request handler - routes to appropriate modules
   */
  private async handleRequest(request: Request, server: any): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    const pathname = url.pathname;

    try {
      const corsHeaders = this.getCorsHeaders();

      if (method === "OPTIONS") {
        return this.handlePreflightRequest(corsHeaders);
      }

      if (this.wsHandler.isWebSocketUpgrade(pathname, request)) {
        const upgradeResult = await this.wsHandler.handleUpgrade(request, server);
        return upgradeResult.response || new Response("WebSocket upgrade successful");
      }

      const rateLimitResponse = this.checkRateLimit(request, corsHeaders);
      if (rateLimitResponse) {
        return rateLimitResponse;
      }

      return await this.httpApp.fetch(request);
    } catch (error) {
      return this.handleRequestError(error, method, pathname);
    }
  }

  /**
   * Create 404 Not Found response
   */
  private createNotFoundResponse(pathname: string, corsHeaders: Record<string, string>): Response {
    return new Response(
      JSON.stringify(
        createProblemDetails(
          404,
          "Not Found",
          `Route ${pathname} not found`,
          undefined, // type
          undefined, // instance
          {
            available_endpoints: ["/health", "/status", "/mcp", "/api/*", "/ws"],
          },
        ),
      ),
      {
        status: 404,
        headers: {
          "Content-Type": "application/problem+json",
          ...corsHeaders,
        },
      },
    );
  }

  /**
   * Handle request errors
   */
  private handleRequestError(error: unknown, method: string, pathname: string): Response {
    logger.error("Request handling error", error instanceof Error ? error : undefined, {
      method,
      pathname,
    });

    return new Response(
      JSON.stringify(
        createProblemDetails(500, "Internal Server Error", "An unexpected error occurred"),
      ),
      {
        status: 500,
        headers: {
          "Content-Type": "application/problem+json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }

  /**
   * Get client ID for rate limiting
   */
  private getClientId(request: Request): string {
    const forwarded = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const cfConnectingIp = request.headers.get("cf-connecting-ip");

    // Use the first available IP, preferring Cloudflare's
    const ip = cfConnectingIp || realIp || forwarded?.split(",")[0] || "unknown";

    // Include user agent for better rate limiting granularity
    const userAgent = request.headers.get("user-agent") || "unknown";
    const authHeader = request.headers.get("authorization");

    // If there's an auth header, use that for rate limiting (per user)
    if (authHeader) {
      return `auth:${authHeader.substring(0, 32)}`;
    }

    // Otherwise use IP + User Agent
    return `ip:${ip}:${userAgent.substring(0, 32)}`;
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info("Shutting down server...");

    try {
      // Close database connections
      await this.db.close();

      // Stop OAuth service
      await this.auth.stopOAuthService();

      // Clean up any other resources
      this.rateLimiter.cleanup();

      logger.info("Server shutdown complete");
    } catch (error) {
      logger.error("Error during shutdown", error instanceof Error ? error : undefined);
    }
  }
}

// Export for external usage
export { createApiRouter, WebSocketHandler, McpService, StaticFileHandler };

let config: ServerConfig;

try {
  config = loadConfig();
} catch (error) {
  logger.error("Failed to load server configuration", error instanceof Error ? error : undefined);
  process.exit(1);
}

// Start the server
const server = new SpecWorkbenchServer(config);

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🔸 Received SIGINT, shutting down gracefully...");
  await server.shutdown();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🔸 Received SIGTERM, shutting down gracefully...");
  await server.shutdown();
  process.exit(0);
});

// Start the server and handle startup errors
try {
  await server.start();
} catch (error) {
  logger.error("Failed to start server", error instanceof Error ? error : undefined);
  process.exit(1);
}
