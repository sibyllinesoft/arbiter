/**
 * Main Bun HTTP server with WebSocket support
 */
import type { ServerWebSocket } from "bun";
import type {
  ServerConfig,
  AuthContext,
  CreateFragmentRequest,
  ValidationRequest,
  FreezeRequest,
  IRKind,
  WebSocketMessage,
  ProblemDetails,
  Fragment
} from "./types.ts";
import { SpecWorkbenchDB } from "./db.ts";
import { AuthService } from "./auth.ts";
import { SpecEngine } from "./specEngine.ts";
import { IRGenerator } from "./ir.ts";
import { EventService } from "./events.ts";
import {
  generateId,
  createProblemDetails,
  TokenBucket,
  validatePath,
  getCurrentTimestamp,
  logger,
  safeJsonParse
} from "./utils.ts";

export class SpecWorkbenchServer {
  private db: SpecWorkbenchDB;
  private auth: AuthService;
  private specEngine: SpecEngine;
  private irGenerator: IRGenerator;
  private events: EventService;
  private rateLimiter: TokenBucket;

  constructor(private config: ServerConfig) {
    this.db = new SpecWorkbenchDB(config);
    this.auth = new AuthService(config);
    this.specEngine = new SpecEngine(config);
    this.irGenerator = new IRGenerator();
    this.events = new EventService(config);
    this.rateLimiter = new TokenBucket(
      config.rate_limit.max_tokens,
      config.rate_limit.refill_rate,
      config.rate_limit.window_ms
    );

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
    
    const server = Bun.serve({
      port: this.config.port,
      hostname: this.config.host,
      
      async fetch(request, server) {
        return await self.handleRequest(request, server);
      },

      websocket: {
        message: async (ws, message) => {
          await self.handleWebSocketMessage(ws as any, typeof message === 'string' ? message : message.toString());
        },
        
        open: (ws) => {
          self.handleWebSocketOpen(ws as any);
        },
        
        close: (ws) => {
          self.handleWebSocketClose(ws as any);
        }
      }
    });

    logger.info("Spec Workbench server started", {
      host: this.config.host,
      port: this.config.port,
      authRequired: this.config.auth_required,
      databasePath: this.config.database_path
    });

    logger.info("Server started successfully");
  }

  /**
   * Handle HTTP requests
   */
  private async handleRequest(
    request: Request, 
    server: any
  ): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    const pathname = url.pathname;

    try {
      // Add CORS headers
      const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400"
      };

      // Handle preflight requests
      if (method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      // Rate limiting
      const clientId = this.getClientId(request);
      if (!this.rateLimiter.consume(clientId)) {
        return this.createErrorResponse(
          createProblemDetails(429, "Too Many Requests", "Rate limit exceeded"),
          corsHeaders
        );
      }

      // WebSocket upgrade
      if (pathname === "/ws" && request.headers.get("upgrade") === "websocket") {
        return await this.handleWebSocketUpgrade(request, server);
      }

      // API routes
      if (pathname.startsWith("/api/")) {
        return await this.handleApiRequest(request, corsHeaders);
      }

      // Health check
      if (pathname === "/health") {
        return await this.handleHealthCheck(corsHeaders);
      }

      // Not found
      return this.createErrorResponse(
        createProblemDetails(404, "Not Found", `Route ${pathname} not found`),
        corsHeaders
      );

    } catch (error) {
      logger.error("Request handling error", error instanceof Error ? error : undefined, {
        method,
        pathname
      });

      return this.createErrorResponse(
        createProblemDetails(500, "Internal Server Error", "An unexpected error occurred"),
        { "Access-Control-Allow-Origin": "*" }
      );
    }
  }

  /**
   * Handle WebSocket upgrade
   */
  private async handleWebSocketUpgrade(
    request: Request,
    server: any
  ): Promise<Response> {
    // Authenticate WebSocket connection
    const authContext = await this.auth.authenticateRequest(request.headers);
    
    if (!authContext) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Check connection limit
    const stats = this.events.getStats();
    if (stats.totalConnections >= this.config.websocket.max_connections) {
      return new Response("Too Many Connections", { status: 503 });
    }

    // Upgrade to WebSocket
    const upgraded = server.upgrade(request, {
      data: { authContext }
    });

    return upgraded ? undefined! : new Response("Upgrade failed", { status: 400 });
  }

  /**
   * Handle WebSocket connection open
   */
  private handleWebSocketOpen(
    ws: ServerWebSocket<{ connectionId?: string; authContext: AuthContext }>
  ): void {
    if (!ws.data.authContext) {
      logger.error("WebSocket opened without auth context");
      ws.close();
      return;
    }
    const connectionId = this.events.handleConnection(ws as any, ws.data.authContext);
    ws.data.connectionId = connectionId;
  }

  /**
   * Handle WebSocket connection close
   */
  private handleWebSocketClose(
    ws: ServerWebSocket<{ connectionId?: string; authContext: AuthContext }>
  ): void {
    if (ws.data.connectionId) {
      this.events.handleDisconnection(ws.data.connectionId);
    }
  }

  /**
   * Handle WebSocket messages
   */
  private async handleWebSocketMessage(
    ws: ServerWebSocket<{ connectionId?: string; authContext: AuthContext }>,
    message: string
  ): Promise<void> {
    if (!ws.data.connectionId) {
      logger.warn("WebSocket message from connection without ID");
      return;
    }

    try {
      const parsedMessage = safeJsonParse<WebSocketMessage>(message);
      
      if (!parsedMessage.success) {
        logger.warn("Invalid WebSocket message", { error: parsedMessage.error });
        return;
      }

      await this.events.handleMessage(ws.data.connectionId, parsedMessage.data);
    } catch (error) {
      logger.error("WebSocket message handling error", error instanceof Error ? error : undefined);
    }
  }

  /**
   * Handle API requests
   */
  private async handleApiRequest(
    request: Request,
    corsHeaders: Record<string, string>
  ): Promise<Response> {
    // Authentication middleware
    const authResult = await this.auth.createAuthMiddleware()(request);
    
    if (!authResult.authorized) {
      return authResult.response!;
    }

    const authContext = authResult.authContext!;
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;

    // Route to specific API handlers
    if (pathname.startsWith("/api/fragments")) {
      return await this.handleFragmentsApi(request, authContext, corsHeaders);
    }
    
    if (pathname === "/api/resolved") {
      return await this.handleResolvedApi(request, authContext, corsHeaders);
    }
    
    if (pathname === "/api/validate") {
      return await this.handleValidateApi(request, authContext, corsHeaders);
    }
    
    if (pathname === "/api/gaps") {
      return await this.handleGapsApi(request, authContext, corsHeaders);
    }
    
    if (pathname.startsWith("/api/ir/")) {
      return await this.handleIRApi(request, authContext, corsHeaders);
    }
    
    if (pathname === "/api/freeze") {
      return await this.handleFreezeApi(request, authContext, corsHeaders);
    }
    
    if (pathname === "/api/projects") {
      return await this.handleProjectsApi(request, authContext, corsHeaders);
    }

    return this.createErrorResponse(
      createProblemDetails(404, "Not Found", `API endpoint ${pathname} not found`),
      corsHeaders
    );
  }

  /**
   * Handle fragments API (POST /api/fragments)
   */
  private async handleFragmentsApi(
    request: Request,
    authContext: AuthContext,
    corsHeaders: Record<string, string>
  ): Promise<Response> {
    if (request.method !== "POST") {
      return this.createErrorResponse(
        createProblemDetails(405, "Method Not Allowed", "Only POST is supported"),
        corsHeaders
      );
    }

    try {
      const body = await request.json() as CreateFragmentRequest & { 
        project_id?: string;
        projectId?: string;
        filename?: string;
        author?: string;
        message?: string;
        replace?: boolean;
      };
      
      // Support both parameter naming conventions for compatibility
      const projectId = body.projectId || body.project_id;
      
      if (!projectId || !body.path || !body.content) {
        return this.createErrorResponse(
          createProblemDetails(400, "Bad Request", "projectId, path, and content are required"),
          corsHeaders
        );
      }

      // Check project access
      const accessCheck = this.auth.createProjectAccessMiddleware()(authContext, projectId);
      if (!accessCheck.authorized) {
        return accessCheck.response!;
      }

      // Validate path
      if (!validatePath(body.path)) {
        return this.createErrorResponse(
          createProblemDetails(400, "Bad Request", "Invalid path format"),
          corsHeaders
        );
      }

      // Format CUE content
      const formatResult = await this.specEngine.formatFragment(body.content);
      const content = formatResult.success ? formatResult.formatted : body.content;

      // Create or update fragment using upsert logic
      let fragment: Fragment;
      const fragmentId = generateId();
      
      try {
        // Try to update existing fragment first
        fragment = await this.db.updateFragment(projectId, body.path, content);
      } catch (updateError) {
        // If update fails (fragment not found), create new fragment
        try {
          fragment = await this.db.createFragment(fragmentId, projectId, body.path, content);
        } catch (createError) {
          logger.error("Failed to create fragment after update failed", { updateError, createError });
          throw new Error("Failed to create or update fragment");
        }
      }

      // Run validation pipeline after fragment update
      const validationResult = await this.specEngine.validateProject(projectId);

      // Broadcast event
      await this.events.broadcastToProject(projectId, {
        project_id: projectId,
        event_type: 'fragment_updated',
        data: {
          fragment_path: body.path,
          user_id: authContext.user_id,
          filename: body.filename || `${body.path}.cue`,
          author: body.author || authContext.user_id,
          message: body.message || "Updated fragment"
        }
      });

      // Return response matching specification
      return new Response(
        JSON.stringify({
          fragmentId: fragment.id,
          specHash: validationResult.success ? validationResult.specHash : "invalid",
          warnings: formatResult.success ? [] : ["CUE formatting failed"],
          ran: { vet: validationResult.success, export: validationResult.success }
        }),
        {
          status: body.replace === false && fragment ? 200 : 201,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        }
      );

    } catch (error) {
      logger.error("Fragments API error", error instanceof Error ? error : undefined);
      
      return this.createErrorResponse(
        createProblemDetails(500, "Internal Server Error", "Failed to create fragment"),
        corsHeaders
      );
    }
  }

  /**
   * Handle resolved API (GET /api/resolved)
   */
  private async handleResolvedApi(
    request: Request,
    authContext: AuthContext,
    corsHeaders: Record<string, string>
  ): Promise<Response> {
    if (request.method !== "GET") {
      return this.createErrorResponse(
        createProblemDetails(405, "Method Not Allowed", "Only GET is supported"),
        corsHeaders
      );
    }

    try {
      const url = new URL(request.url);
      // Support both projectId (primary) and project_id (backward compatibility)
      const projectId = url.searchParams.get("projectId") || url.searchParams.get("project_id");

      if (!projectId) {
        return this.createErrorResponse(
          createProblemDetails(400, "Bad Request", "projectId parameter is required"),
          corsHeaders
        );
      }

      // Check project access
      const accessCheck = this.auth.createProjectAccessMiddleware()(authContext, projectId);
      if (!accessCheck.authorized) {
        return accessCheck.response!;
      }

      // Get latest version
      const version = await this.db.getLatestVersion(projectId);
      
      if (!version) {
        return this.createErrorResponse(
          createProblemDetails(404, "Not Found", "No resolved specification found"),
          corsHeaders
        );
      }

      const resolved = JSON.parse(version.resolved_json);

      return new Response(
        JSON.stringify({
          projectId,
          specHash: version.spec_hash,
          updatedAt: version.created_at,
          json: resolved
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        }
      );

    } catch (error) {
      logger.error("Resolved API error", error instanceof Error ? error : undefined);
      
      return this.createErrorResponse(
        createProblemDetails(500, "Internal Server Error", "Failed to get resolved specification"),
        corsHeaders
      );
    }
  }

  /**
   * Handle validate API (POST /api/validate)
   */
  private async handleValidateApi(
    request: Request,
    authContext: AuthContext,
    corsHeaders: Record<string, string>
  ): Promise<Response> {
    if (request.method !== "POST") {
      return this.createErrorResponse(
        createProblemDetails(405, "Method Not Allowed", "Only POST is supported"),
        corsHeaders
      );
    }

    try {
      const body = await request.json() as ValidationRequest & { projectId?: string; project_id?: string };
      
      // Support both projectId (primary) and project_id (backward compatibility)
      const projectId = body.projectId || body.project_id;
      
      if (!projectId) {
        return this.createErrorResponse(
          createProblemDetails(400, "Bad Request", "projectId is required"),
          corsHeaders
        );
      }

      // Check project access
      const accessCheck = this.auth.createProjectAccessMiddleware()(authContext, projectId);
      if (!accessCheck.authorized) {
        return accessCheck.response!;
      }

      // Get project fragments
      const fragments = await this.db.listFragments(projectId);

      // Broadcast validation started
      await this.events.broadcastToProject(projectId, {
        project_id: projectId,
        event_type: 'validation_started',
        data: {
          user_id: authContext.user_id,
          fragment_count: fragments.length
        }
      });

      // Run validation
      const validationResult = await this.specEngine.validateProject(projectId, fragments);

      // Store version if validation succeeded
      if (validationResult.success && validationResult.resolved) {
        const versionId = generateId();
        await this.db.createVersion(
          versionId,
          projectId,
          validationResult.specHash,
          JSON.stringify(validationResult.resolved)
        );
      }

      // Broadcast validation completed
      await this.events.broadcastToProject(projectId, {
        project_id: projectId,
        event_type: validationResult.success ? 'validation_completed' : 'validation_failed',
        data: {
          user_id: authContext.user_id,
          spec_hash: validationResult.specHash,
          error_count: validationResult.errors.length,
          warning_count: validationResult.warnings.length
        }
      });

      return new Response(
        JSON.stringify({
          success: validationResult.success,
          spec_hash: validationResult.specHash,
          errors: validationResult.errors,
          warnings: validationResult.warnings
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        }
      );

    } catch (error) {
      logger.error("Validate API error", error instanceof Error ? error : undefined);
      
      return this.createErrorResponse(
        createProblemDetails(500, "Internal Server Error", "Validation failed"),
        corsHeaders
      );
    }
  }

  /**
   * Handle gaps API (GET /api/gaps)
   */
  private async handleGapsApi(
    request: Request,
    authContext: AuthContext,
    corsHeaders: Record<string, string>
  ): Promise<Response> {
    if (request.method !== "GET") {
      return this.createErrorResponse(
        createProblemDetails(405, "Method Not Allowed", "Only GET is supported"),
        corsHeaders
      );
    }

    try {
      const url = new URL(request.url);
      // Support both projectId (primary) and project_id (backward compatibility)
      const projectId = url.searchParams.get("projectId") || url.searchParams.get("project_id");

      if (!projectId) {
        return this.createErrorResponse(
          createProblemDetails(400, "Bad Request", "projectId parameter is required"),
          corsHeaders
        );
      }

      // Check project access
      const accessCheck = this.auth.createProjectAccessMiddleware()(authContext, projectId);
      if (!accessCheck.authorized) {
        return accessCheck.response!;
      }

      // Get latest version
      const version = await this.db.getLatestVersion(projectId);
      
      if (!version) {
        return this.createErrorResponse(
          createProblemDetails(404, "Not Found", "No resolved specification found"),
          corsHeaders
        );
      }

      const resolved = JSON.parse(version.resolved_json);
      const gapSet = await this.specEngine.generateGapSet(resolved);

      return new Response(
        JSON.stringify(gapSet),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        }
      );

    } catch (error) {
      logger.error("Gaps API error", error instanceof Error ? error : undefined);
      
      return this.createErrorResponse(
        createProblemDetails(500, "Internal Server Error", "Failed to generate gap analysis"),
        corsHeaders
      );
    }
  }

  /**
   * Handle IR API (GET /api/ir/:kind)
   */
  private async handleIRApi(
    request: Request,
    authContext: AuthContext,
    corsHeaders: Record<string, string>
  ): Promise<Response> {
    if (request.method !== "GET") {
      return this.createErrorResponse(
        createProblemDetails(405, "Method Not Allowed", "Only GET is supported"),
        corsHeaders
      );
    }

    try {
      const url = new URL(request.url);
      const pathname = url.pathname;
      const kind = pathname.split('/').pop() as IRKind;
      // Support both projectId (primary) and project_id (backward compatibility)
      const projectId = url.searchParams.get("projectId") || url.searchParams.get("project_id");

      if (!projectId) {
        return this.createErrorResponse(
          createProblemDetails(400, "Bad Request", "projectId parameter is required"),
          corsHeaders
        );
      }

      if (!['flow', 'fsm', 'view', 'site'].includes(kind)) {
        return this.createErrorResponse(
          createProblemDetails(400, "Bad Request", `Invalid IR kind: ${kind}`),
          corsHeaders
        );
      }

      // Check project access
      const accessCheck = this.auth.createProjectAccessMiddleware()(authContext, projectId);
      if (!accessCheck.authorized) {
        return accessCheck.response!;
      }

      // Get latest version
      const version = await this.db.getLatestVersion(projectId);
      
      if (!version) {
        return this.createErrorResponse(
          createProblemDetails(404, "Not Found", "No resolved specification found"),
          corsHeaders
        );
      }

      const resolved = JSON.parse(version.resolved_json);
      const ir = await this.irGenerator.generateIR(kind, resolved);

      return new Response(
        JSON.stringify(ir),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        }
      );

    } catch (error) {
      logger.error("IR API error", error instanceof Error ? error : undefined);
      
      return this.createErrorResponse(
        createProblemDetails(500, "Internal Server Error", "Failed to generate IR"),
        corsHeaders
      );
    }
  }

  /**
   * Handle freeze API (POST /api/freeze)
   */
  private async handleFreezeApi(
    request: Request,
    authContext: AuthContext,
    corsHeaders: Record<string, string>
  ): Promise<Response> {
    if (request.method !== "POST") {
      return this.createErrorResponse(
        createProblemDetails(405, "Method Not Allowed", "Only POST is supported"),
        corsHeaders
      );
    }

    try {
      const body = await request.json() as FreezeRequest & { projectId?: string; project_id?: string; tag?: string };
      
      // Support both projectId (primary) and project_id (backward compatibility)
      const projectId = body.projectId || body.project_id;
      const tag = body.tag || body.version_name;
      
      if (!projectId || !tag) {
        return this.createErrorResponse(
          createProblemDetails(400, "Bad Request", "projectId and tag are required"),
          corsHeaders
        );
      }

      // Check project access
      const accessCheck = this.auth.createProjectAccessMiddleware()(authContext, projectId);
      if (!accessCheck.authorized) {
        return accessCheck.response!;
      }

      // Get latest version to freeze
      const version = await this.db.getLatestVersion(projectId);
      
      if (!version) {
        return this.createErrorResponse(
          createProblemDetails(404, "Not Found", "No version to freeze"),
          corsHeaders
        );
      }

      // Create immutable version record (implementation would depend on requirements)
      // For now, just use the existing version system
      
      // Broadcast freeze event
      await this.events.broadcastToProject(projectId, {
        project_id: projectId,
        event_type: 'version_frozen',
        data: {
          version_name: tag,
          spec_hash: version.spec_hash,
          user_id: authContext.user_id,
          description: body.description
        }
      });

      return new Response(
        JSON.stringify({
          versionId: version.id,
          tag,
          specHash: version.spec_hash,
          manifest: { files: [] } // TODO: implement manifest generation
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        }
      );

    } catch (error) {
      logger.error("Freeze API error", error instanceof Error ? error : undefined);
      
      return this.createErrorResponse(
        createProblemDetails(500, "Internal Server Error", "Failed to freeze version"),
        corsHeaders
      );
    }
  }

  /**
   * Handle projects API (GET /api/projects)
   */
  private async handleProjectsApi(
    request: Request,
    authContext: AuthContext,
    corsHeaders: Record<string, string>
  ): Promise<Response> {
    if (request.method !== "GET") {
      return this.createErrorResponse(
        createProblemDetails(405, "Method Not Allowed", "Only GET is supported"),
        corsHeaders
      );
    }

    try {
      const projects = await this.db.listProjects();
      
      return new Response(JSON.stringify(projects), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });

    } catch (error) {
      logger.error("Projects API error", error instanceof Error ? error : undefined);
      
      return this.createErrorResponse(
        createProblemDetails(500, "Internal Server Error", "Failed to get projects"),
        corsHeaders
      );
    }
  }

  /**
   * Handle health check
   */
  private async handleHealthCheck(corsHeaders: Record<string, string>): Promise<Response> {
    try {
      const dbHealthy = await this.db.healthCheck();
      const stats = this.events.getStats();

      const health = {
        status: dbHealthy ? "healthy" : "unhealthy",
        timestamp: getCurrentTimestamp(),
        database: dbHealthy,
        connections: stats.totalConnections,
        projects: stats.totalProjects
      };

      return new Response(
        JSON.stringify(health),
        {
          status: dbHealthy ? 200 : 503,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        }
      );

    } catch (error) {
      return new Response(
        JSON.stringify({ status: "unhealthy", error: "Health check failed" }),
        {
          status: 503,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        }
      );
    }
  }

  /**
   * Get client identifier for rate limiting
   */
  private getClientId(request: Request): string {
    const forwarded = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const remoteAddr = forwarded?.split(',')[0] || realIp || "unknown";
    
    return remoteAddr;
  }

  /**
   * Create error response with proper headers
   */
  private createErrorResponse(
    problemDetails: ProblemDetails,
    additionalHeaders: Record<string, string> = {}
  ): Response {
    return new Response(
      JSON.stringify(problemDetails),
      {
        status: problemDetails.status,
        headers: {
          "Content-Type": "application/problem+json",
          ...additionalHeaders
        }
      }
    );
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    logger.info("Shutting down server...");
    
    this.events.cleanup();
    this.db.close();
    
    logger.info("Server shutdown complete");
  }
}

// Default configuration
const defaultConfig: ServerConfig = {
  port: parseInt(process.env.PORT || "3000"),
  host: process.env.HOST || "localhost",
  database_path: process.env.DATABASE_PATH || "./spec_workbench.db",
  spec_workdir: process.env.SPEC_WORKDIR || "./workdir",
  cue_binary_path: process.env.CUE_BINARY || "cue",
  jq_binary_path: process.env.JQ_BINARY || "jq",
  auth_required: process.env.AUTH_REQUIRED !== "false",
  rate_limit: {
    max_tokens: parseInt(process.env.RATE_LIMIT_TOKENS || "10"),
    refill_rate: parseFloat(process.env.RATE_LIMIT_REFILL || "1"),
    window_ms: parseInt(process.env.RATE_LIMIT_WINDOW || "10000")
  },
  external_tool_timeout_ms: parseInt(process.env.EXTERNAL_TOOL_TIMEOUT || "10000"),
  websocket: {
    max_connections: parseInt(process.env.WS_MAX_CONNECTIONS || "1000"),
    ping_interval_ms: parseInt(process.env.WS_PING_INTERVAL || "30000")
  }
};

// Start server if this is the main module
if (import.meta.main) {
  const server = new SpecWorkbenchServer(defaultConfig);
  
  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    await server.shutdown();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await server.shutdown();
    process.exit(0);
  });

  server.start().catch((error) => {
    logger.error("Failed to start server", error instanceof Error ? error : undefined);
    process.exit(1);
  });
}