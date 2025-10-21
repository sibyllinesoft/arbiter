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
import { AuthService } from "./auth";
import { loadConfig } from "./config";
import { SpecWorkbenchDB } from "./db";
import { EventService } from "./events";
import { HandlerAPIController } from "./handlers/api.js";
import { SpecEngine } from "./specEngine";
import { tunnelManager } from "./tunnel-manager";
import type { ServerConfig } from "./types.ts";
import { createProblemDetails, getCurrentTimestamp, logger } from "./utils";
import { WebhookService } from "./webhooks";

import { createMcpApp } from "./mcp";
// Import modular components
import { type Dependencies, createApiRouter } from "./routes/index";
import { StaticFileHandler } from "./static/index";
import { WebSocketHandler } from "./websocket/index";

export class SpecWorkbenchServer {
  private db: SpecWorkbenchDB;
  private auth: AuthService;
  private specEngine: SpecEngine;
  private events: EventService;
  private webhooks: WebhookService;
  private handlersApi: HandlerAPIController;

  // Modular components
  private apiRouter: ReturnType<typeof createApiRouter>;
  private httpApp: Hono;
  private wsHandler: WebSocketHandler;
  private mcpApp: ReturnType<typeof createMcpApp>;
  private staticHandler: StaticFileHandler;

  constructor(
    private config: ServerConfig,
    db: SpecWorkbenchDB,
  ) {
    // Initialize core services
    this.db = db;
    this.auth = new AuthService(config);
    this.specEngine = new SpecEngine(config);
    this.events = new EventService(config, this.db);
    this.webhooks = new WebhookService(config, this.events, this.db);
    this.handlersApi = new HandlerAPIController(this.webhooks.getHandlerManager());

    // Listen to tunnel manager logs and broadcast to global subscribers
    tunnelManager.on("log", (message: string) => {
      this.events
        .broadcastGlobal({
          type: "event",
          data: {
            event_type: "tunnel_log",
            log: message,
            timestamp: getCurrentTimestamp(),
          },
        })
        .catch((error) => {
          logger.error("Failed to broadcast tunnel log", error);
        });
    });

    tunnelManager.on("error", (error: string) => {
      this.events
        .broadcastGlobal({
          type: "event",
          data: {
            event_type: "tunnel_error",
            log: `ERROR: ${error}`,
            timestamp: getCurrentTimestamp(),
          },
        })
        .catch((error) => {
          logger.error("Failed to broadcast tunnel error", error);
        });
    });

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
    this.wsHandler = new WebSocketHandler(this.auth, this.events, this.config.websocket);
    this.mcpApp = createMcpApp();
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

    this.httpApp.route("/", this.mcpApp);

    this.httpApp.all("/webhooks/*", async (c) => {
      const corsHeaders = this.getCorsHeaders();
      const path = new URL(c.req.url).pathname;
      const provider = path.split("/")[2] as "github" | "gitlab";

      if (provider !== "github" && provider !== "gitlab") {
        return new Response(JSON.stringify({ error: "Invalid webhook provider" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const event = c.req.header("X-GitHub-Event") || c.req.header("X-GitLab-Event") || "unknown";
      const signature = c.req.header("X-Hub-Signature-256") || c.req.header("X-GitLab-Token");
      const payload = await c.req.json();
      const headers = Object.fromEntries(c.req.raw.headers.entries());

      const result = await this.webhooks.processWebhook(
        provider,
        event,
        signature,
        payload,
        headers,
      );

      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

      async fetch(request: Request, server: any) {
        console.log("[FETCH] Request received:", request.method, request.url);

        // Check for WebSocket upgrade requests explicitly
        const url = new URL(request.url);
        if (
          url.pathname === "/events" &&
          request.headers.get("upgrade")?.toLowerCase() === "websocket"
        ) {
          logger.info("[SERVER] WebSocket upgrade request detected", {
            pathname: url.pathname,
            headers: {
              upgrade: request.headers.get("upgrade"),
              connection: request.headers.get("connection"),
              origin: request.headers.get("origin"),
            },
          });

          // Handle authentication here before upgrade
          const authContext = await self.auth.authenticateRequest(request.headers);

          logger.info("[SERVER] WebSocket auth result", {
            hasAuth: !!authContext,
            authContext: authContext || "NO_AUTH",
          });

          if (!authContext) {
            logger.warn("[SERVER] WebSocket auth failed - rejecting upgrade");
            return new Response("Unauthorized", { status: 401 });
          }

          // Perform the upgrade with auth context
          const upgraded = server.upgrade(request, {
            data: {
              connectionId: "",
              authContext,
            },
          });

          logger.info("[SERVER] WebSocket upgrade result", {
            upgraded: upgraded ? "SUCCESS" : "FAILED",
          });

          if (!upgraded) {
            return new Response("WebSocket upgrade failed", { status: 400 });
          }

          return undefined; // Successful upgrade, no response needed
        }

        return await self.handleRequest(request, server);
      },

      websocket: {
        message: async (ws: ServerWebSocket, message: string | Uint8Array) => {
          await self.wsHandler.handleMessage(
            ws as any,
            typeof message === "string" ? message : message.toString(),
          );
        },

        open: (ws: ServerWebSocket) => {
          self.wsHandler.handleOpen(ws as any);
        },

        close: (ws: ServerWebSocket) => {
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
   * Main request handler - routes to appropriate modules
   */
  private async handleRequest(request: Request, server: any): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    const pathname = url.pathname;

    try {
      logger.info("[SERVER] Request received", {
        method,
        pathname,
        url: url.toString(),
        requestHeaders: {
          upgrade: request.headers.get("upgrade"),
          connection: request.headers.get("connection"),
          origin: request.headers.get("origin"),
          userAgent: request.headers.get("user-agent"),
        },
      });

      const corsHeaders = this.getCorsHeaders();

      if (method === "OPTIONS") {
        logger.info("[SERVER] Handling OPTIONS preflight");
        return this.handlePreflightRequest(corsHeaders);
      }

      logger.info("[SERVER] Checking if WebSocket upgrade...");
      if (this.wsHandler.isWebSocketUpgrade(pathname, request)) {
        logger.info("[SERVER] WebSocket upgrade detected - calling handleUpgrade");
        const upgradeResult = await this.wsHandler.handleUpgrade(request, server);
        logger.info("[SERVER] Upgrade result", {
          hasResponse: !!upgradeResult.response,
          result: upgradeResult.response ? "Response returned" : "Success",
        });
        return upgradeResult.response || new Response("WebSocket upgrade successful");
      }

      logger.info("[SERVER] Not a WebSocket upgrade - proceeding to app routing");

      logger.info("[SERVER] Passing to httpApp.fetch");
      return await this.httpApp.fetch(request);
    } catch (error) {
      console.log("[SERVER] Error in handleRequest:", error);
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

      logger.info("Server shutdown complete");
    } catch (error) {
      logger.error("Error during shutdown", error instanceof Error ? error : undefined);
    }
  }
}

// Export for external usage
export { createApiRouter, WebSocketHandler, StaticFileHandler };

// Enhanced process monitoring and error handling
class ProcessMonitor {
  private memoryWarningThreshold = 500 * 1024 * 1024; // 500MB
  private errorCount = 0;
  private lastMemoryCheck = Date.now();
  private isShuttingDown = false;
  private healthInterval?: NodeJS.Timeout;
  private memoryInterval?: NodeJS.Timeout;

  constructor(private server: SpecWorkbenchServer) {
    this.setupProcessMonitoring();
    this.setupMemoryMonitoring();
    this.setupUncaughtExceptionHandling();
  }

  private setupProcessMonitoring() {
    // Log process health every 10 seconds
    this.healthInterval = setInterval(() => {
      if (!this.isShuttingDown) {
        this.logProcessHealth();
      }
    }, 10000);
  }

  private setupMemoryMonitoring() {
    // Check memory usage every 10 seconds
    this.memoryInterval = setInterval(() => {
      if (!this.isShuttingDown) {
        this.checkMemoryUsage();
      }
    }, 10000);
  }

  private setupUncaughtExceptionHandling() {
    // Handle uncaught exceptions
    process.on("uncaughtException", (error) => {
      this.errorCount++;
      logger.error("❌ UNCAUGHT EXCEPTION", error, {
        errorCount: this.errorCount,
        processUptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        pid: process.pid,
      });

      // If we get too many errors, shutdown gracefully
      if (this.errorCount > 5) {
        logger.error("🚨 Too many uncaught exceptions, initiating shutdown");
        this.gracefulShutdown("uncaught-exceptions");
      }
    });

    // Handle unhandled promise rejections
    process.on("unhandledRejection", (reason, promise) => {
      this.errorCount++;
      logger.error("❌ UNHANDLED PROMISE REJECTION", reason instanceof Error ? reason : undefined, {
        reason: reason,
        promise: promise,
        errorCount: this.errorCount,
        processUptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        pid: process.pid,
      });

      // If we get too many errors, shutdown gracefully
      if (this.errorCount > 10) {
        logger.error("🚨 Too many unhandled rejections, initiating shutdown");
        this.gracefulShutdown("unhandled-rejections");
      }
    });

    // Handle warnings
    process.on("warning", (warning) => {
      logger.warn("⚠️ Node.js Warning", {
        name: warning.name,
        message: warning.message,
        stack: warning.stack,
      });
    });

    // Handle exit events
    process.on("beforeExit", (code) => {
      if (!this.isShuttingDown) {
        logger.info("🔄 Process beforeExit event", { code });
      }
    });

    process.on("exit", (code) => {
      console.log(`🔚 Process exit with code: ${code}`);
    });
  }

  private logProcessHealth() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    logger.info("📊 Process Health Check", {
      uptime: Math.floor(process.uptime()),
      pid: process.pid,
      nodeVersion: process.version,
      platform: process.platform,
      errorCount: this.errorCount,
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024) + "MB",
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + "MB",
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + "MB",
        external: Math.round(memUsage.external / 1024 / 1024) + "MB",
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
    });
  }

  private checkMemoryUsage() {
    const memUsage = process.memoryUsage();

    if (memUsage.heapUsed > this.memoryWarningThreshold) {
      logger.warn("⚠️ High memory usage detected", {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + "MB",
        threshold: Math.round(this.memoryWarningThreshold / 1024 / 1024) + "MB",
        recommendation: "Consider garbage collection or restart",
      });

      // Force garbage collection if available
      if (global.gc) {
        logger.info("🗑️ Running garbage collection");
        global.gc();
      }
    }
  }

  async gracefulShutdown(reason: string) {
    if (this.isShuttingDown) {
      logger.warn("⚠️ Shutdown already in progress, ignoring duplicate request");
      return;
    }

    // Clear intervals
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
      this.healthInterval = undefined;
    }
    if (this.memoryInterval) {
      clearInterval(this.memoryInterval);
      this.memoryInterval = undefined;
    }

    this.isShuttingDown = true;
    logger.info(`🔸 Graceful shutdown initiated: ${reason}`);

    try {
      // Set a timeout for shutdown
      const shutdownTimeout = setTimeout(() => {
        logger.error("🚨 Shutdown timeout exceeded, forcing exit");
        process.exit(1);
      }, 10000); // 10 second timeout

      await this.server.shutdown();
      clearTimeout(shutdownTimeout);

      logger.info("✅ Graceful shutdown completed");
      process.exit(0);
    } catch (error) {
      logger.error("❌ Error during graceful shutdown", error instanceof Error ? error : undefined);
      process.exit(1);
    }
  }
}

let config: ServerConfig;

try {
  config = loadConfig();
} catch (error) {
  logger.error("Failed to load server configuration", error instanceof Error ? error : undefined);
  process.exit(1);
}

// Start the server
const db = await SpecWorkbenchDB.create(config);
const server = new SpecWorkbenchServer(config, db);
const monitor = new ProcessMonitor(server);

// Handle graceful shutdown signals
process.on("SIGINT", async () => {
  console.log("\n🔸 Received SIGINT signal");
  await monitor.gracefulShutdown("SIGINT");
});

process.on("SIGTERM", async () => {
  console.log("\n🔸 Received SIGTERM signal");
  await monitor.gracefulShutdown("SIGTERM");
});

// Enhanced startup with retry logic
async function startServerWithRetry(maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`🚀 Starting server (attempt ${attempt}/${maxRetries})`);
      await server.start();
      logger.info("✅ Server started successfully");
      return;
    } catch (error) {
      logger.error(
        `❌ Server startup failed (attempt ${attempt}/${maxRetries})`,
        error instanceof Error ? error : undefined,
      );

      if (attempt === maxRetries) {
        logger.error("🚨 All startup attempts failed, exiting");
        process.exit(1);
      }

      // Wait before retry
      const delay = attempt * 2000; // 2s, 4s, 6s
      logger.info(`⏳ Waiting ${delay}ms before retry...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// Start the server with retry logic when executed directly
if (import.meta.main) {
  await startServerWithRetry();
}
