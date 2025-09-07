/**
 * Main Bun HTTP server with WebSocket support
 */
import type { ServerWebSocket } from "bun";
import { AuthService } from "./auth.ts";
import { SpecWorkbenchDB } from "./db.ts";
import { EventService } from "./events.ts";
import { IRGenerator } from "./ir.ts";
import { SpecEngine } from "./specEngine.ts";
import type {
  AuthContext,
  CreateFragmentRequest,
  Fragment,
  FreezeRequest,
  IRKind,
  ProblemDetails,
  ServerConfig,
  ValidationRequest,
  WebSocketMessage,
} from "./types.ts";
import {
  createProblemDetails,
  generateId,
  getCurrentTimestamp,
  logger,
  safeJsonParse,
  TokenBucket,
  validatePath,
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
      config.rate_limit.window_ms,
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

    const _server = Bun.serve({
      port: this.config.port,
      hostname: this.config.host,

      async fetch(request, server) {
        return await self.handleRequest(request, server);
      },

      websocket: {
        message: async (ws, message) => {
          await self.handleWebSocketMessage(
            ws as any,
            typeof message === "string" ? message : message.toString(),
          );
        },

        open: (ws) => {
          self.handleWebSocketOpen(ws as any);
        },

        close: (ws) => {
          self.handleWebSocketClose(ws as any);
        },
      },
    });

    logger.info("Spec Workbench server started", {
      host: this.config.host,
      port: this.config.port,
      authRequired: this.config.auth_required,
      databasePath: this.config.database_path,
    });

    logger.info(`🚀 Server running at http://${this.config.host}:${this.config.port}`);
    logger.info(`📋 Health check: http://${this.config.host}:${this.config.port}/health`);
    logger.info("Server started successfully");
  }

  /**
   * Handle HTTP requests
   */
  private async handleRequest(request: Request, server: any): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    const pathname = url.pathname;

    try {
      // Add CORS headers
      const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
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
          corsHeaders,
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

      // Status endpoint (redirect from root)
      if (pathname === "/status") {
        return await this.handleStatusCheck(corsHeaders);
      }

      // MCP endpoint
      if (pathname === "/mcp") {
        return await this.handleMcpRequest(request, corsHeaders);
      }

      // Root redirect to status
      if (pathname === "/") {
        return new Response(null, {
          status: 302,
          headers: {
            Location: "/status",
            ...corsHeaders,
          },
        });
      }

      // Not found
      return this.createErrorResponse(
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
        corsHeaders,
      );
    } catch (error) {
      logger.error("Request handling error", error instanceof Error ? error : undefined, {
        method,
        pathname,
      });

      return this.createErrorResponse(
        createProblemDetails(500, "Internal Server Error", "An unexpected error occurred"),
        { "Access-Control-Allow-Origin": "*" },
      );
    }
  }

  /**
   * Handle WebSocket upgrade
   */
  private async handleWebSocketUpgrade(request: Request, server: any): Promise<Response> {
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
      data: { authContext },
    });

    return upgraded ? undefined! : new Response("Upgrade failed", { status: 400 });
  }

  /**
   * Handle WebSocket connection open
   */
  private handleWebSocketOpen(
    ws: ServerWebSocket<{ connectionId?: string; authContext: AuthContext }>,
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
    ws: ServerWebSocket<{ connectionId?: string; authContext: AuthContext }>,
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
    message: string,
  ): Promise<void> {
    if (!ws.data.connectionId) {
      logger.warn("WebSocket message from connection without ID");
      return;
    }

    try {
      const parsedMessage = safeJsonParse<WebSocketMessage>(message);

      if (!parsedMessage.success) {
        logger.warn("Invalid WebSocket message", {
          error: parsedMessage.error,
        });
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
    corsHeaders: Record<string, string>,
  ): Promise<Response> {
    // Authentication middleware
    const authResult = await this.auth.createAuthMiddleware()(request);

    if (!authResult.authorized) {
      return authResult.response!;
    }

    const authContext = authResult.authContext!;
    const url = new URL(request.url);
    const pathname = url.pathname;
    const _method = request.method;

    // Route to specific API handlers
    if (pathname.startsWith("/api/fragments")) {
      // Handle revision routes first (more specific)
      if (pathname.match(/\/api\/fragments\/[^\/]+\/revisions/)) {
        return await this.handleFragmentRevisionsApi(request, authContext, corsHeaders);
      }
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
      corsHeaders,
    );
  }

  /**
   * Handle fragments API (GET /api/fragments and POST /api/fragments)
   */
  private async handleFragmentsApi(
    request: Request,
    authContext: AuthContext,
    corsHeaders: Record<string, string>,
  ): Promise<Response> {
    if (request.method === "GET") {
      return await this.handleFragmentsListApi(request, authContext, corsHeaders);
    } else if (request.method === "POST") {
      return await this.handleFragmentsCreateApi(request, authContext, corsHeaders);
    } else {
      return this.createErrorResponse(
        createProblemDetails(405, "Method Not Allowed", "Only GET and POST are supported"),
        corsHeaders,
      );
    }
  }

  /**
   * Handle fragment revisions API (GET /api/fragments/:fragmentId/revisions)
   */
  private async handleFragmentRevisionsApi(
    request: Request,
    authContext: AuthContext,
    corsHeaders: Record<string, string>,
  ): Promise<Response> {
    if (request.method !== "GET") {
      return this.createErrorResponse(
        createProblemDetails(405, "Method Not Allowed", "Only GET is supported"),
        corsHeaders,
      );
    }

    try {
      const url = new URL(request.url);
      const pathname = url.pathname;
      const pathParts = pathname.split('/');
      
      // Extract fragment ID from path like /api/fragments/{fragmentId}/revisions
      const fragmentId = pathParts[3];
      if (!fragmentId) {
        return this.createErrorResponse(
          createProblemDetails(400, "Bad Request", "Fragment ID is required"),
          corsHeaders,
        );
      }

      // Get fragment to check project access
      const fragment = await this.db.getFragmentById(fragmentId);
      if (!fragment) {
        return this.createErrorResponse(
          createProblemDetails(404, "Not Found", "Fragment not found"),
          corsHeaders,
        );
      }

      // Check project access
      const accessCheck = this.auth.createProjectAccessMiddleware()(authContext, fragment.project_id);
      if (!accessCheck.authorized) {
        return accessCheck.response!;
      }

      // Get revisions
      const revisions = await this.db.listFragmentRevisions(fragmentId);

      return new Response(
        JSON.stringify({
          fragmentId: fragmentId,
          path: fragment.path,
          revisions: revisions.map((r) => ({
            id: r.id,
            revision_number: r.revision_number,
            content_hash: r.content_hash,
            author: r.author,
            message: r.message,
            created_at: r.created_at,
          })),
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    } catch (error) {
      logger.error("Fragment revisions API error", error instanceof Error ? error : undefined);

      return this.createErrorResponse(
        createProblemDetails(500, "Internal Server Error", "Failed to get fragment revisions"),
        corsHeaders,
      );
    }
  }

  /**
   * Handle fragments list API (GET /api/fragments)
   */
  private async handleFragmentsListApi(
    request: Request,
    authContext: AuthContext,
    corsHeaders: Record<string, string>,
  ): Promise<Response> {
    try {
      const url = new URL(request.url);
      // Support both projectId (primary) and project_id (backward compatibility)
      const projectId = url.searchParams.get("projectId") || url.searchParams.get("project_id");

      if (!projectId) {
        return this.createErrorResponse(
          createProblemDetails(400, "Bad Request", "projectId parameter is required"),
          corsHeaders,
        );
      }

      // Check project access
      const accessCheck = this.auth.createProjectAccessMiddleware()(authContext, projectId);
      if (!accessCheck.authorized) {
        return accessCheck.response!;
      }

      // Get project fragments
      const fragments = await this.db.listFragments(projectId);

      return new Response(
        JSON.stringify(
          fragments.map((f) => ({
            id: f.id,
            path: f.path,
            content: f.content,
            created_at: f.created_at,
            updated_at: f.updated_at,
          })),
        ),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    } catch (error) {
      logger.error("Fragments list API error", error instanceof Error ? error : undefined);

      return this.createErrorResponse(
        createProblemDetails(500, "Internal Server Error", "Failed to list fragments"),
        corsHeaders,
      );
    }
  }

  /**
   * Handle fragments create API (POST /api/fragments)
   */
  private async handleFragmentsCreateApi(
    request: Request,
    authContext: AuthContext,
    corsHeaders: Record<string, string>,
  ): Promise<Response> {
    try {
      const body = (await request.json()) as CreateFragmentRequest & {
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
          corsHeaders,
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
          corsHeaders,
        );
      }

      // Format CUE content
      const formatResult = await this.specEngine.formatFragment(body.content);
      const content = formatResult.success ? formatResult.formatted : body.content;

      // Create or update fragment using upsert logic with revision tracking
      let fragment: Fragment;
      const fragmentId = generateId();
      const author = body.author || authContext.user_id;
      const message = body.message || "Updated fragment";

      try {
        // Try to update existing fragment first (this will create a revision)
        fragment = await this.db.updateFragment(projectId, body.path, content, author, message);
      } catch (updateError) {
        // If update fails (fragment not found), create new fragment with initial revision
        try {
          fragment = await this.db.createFragment(
            fragmentId, 
            projectId, 
            body.path, 
            content, 
            author, 
            "Initial fragment creation"
          );
        } catch (createError) {
          logger.error(
            "Failed to create fragment after update failed",
            createError instanceof Error ? createError : undefined,
            {
              updateError: updateError instanceof Error ? updateError.message : String(updateError),
            },
          );
          throw new Error("Failed to create or update fragment");
        }
      }

      // Run validation pipeline after fragment update
      const fragments = await this.db.listFragments(projectId);
      const validationResult = await this.specEngine.validateProject(projectId, fragments);

      // Broadcast revision event
      await this.events.broadcastToProject(projectId, {
        project_id: projectId,
        event_type: "fragment_revision_created",
        data: {
          fragment_path: body.path,
          user_id: authContext.user_id,
          filename: body.filename || `${body.path}.cue`,
          author: body.author || authContext.user_id,
          message: body.message || "Updated fragment",
          head_revision_id: fragment.head_revision_id,
        },
      });

      // Return response matching specification
      return new Response(
        JSON.stringify({
          fragmentId: fragment.id,
          specHash: validationResult.success ? validationResult.specHash : "invalid",
          warnings: formatResult.success ? [] : ["CUE formatting failed"],
          ran: {
            vet: validationResult.success,
            export: validationResult.success,
          },
        }),
        {
          status: body.replace === false && fragment ? 200 : 201,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    } catch (error) {
      logger.error("Fragments API error", error instanceof Error ? error : undefined);

      return this.createErrorResponse(
        createProblemDetails(500, "Internal Server Error", "Failed to create fragment"),
        corsHeaders,
      );
    }
  }

  /**
   * Handle resolved API (GET /api/resolved)
   */
  private async handleResolvedApi(
    request: Request,
    authContext: AuthContext,
    corsHeaders: Record<string, string>,
  ): Promise<Response> {
    if (request.method !== "GET") {
      return this.createErrorResponse(
        createProblemDetails(405, "Method Not Allowed", "Only GET is supported"),
        corsHeaders,
      );
    }

    try {
      const url = new URL(request.url);
      // Support both projectId (primary) and project_id (backward compatibility)
      const projectId = url.searchParams.get("projectId") || url.searchParams.get("project_id");

      if (!projectId) {
        return this.createErrorResponse(
          createProblemDetails(400, "Bad Request", "projectId parameter is required"),
          corsHeaders,
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
          corsHeaders,
        );
      }

      const resolved = JSON.parse(version.resolved_json);

      return new Response(
        JSON.stringify({
          projectId,
          specHash: version.spec_hash,
          updatedAt: version.created_at,
          json: resolved,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    } catch (error) {
      logger.error("Resolved API error", error instanceof Error ? error : undefined);

      return this.createErrorResponse(
        createProblemDetails(500, "Internal Server Error", "Failed to get resolved specification"),
        corsHeaders,
      );
    }
  }

  /**
   * Handle validate API (POST /api/validate)
   */
  private async handleValidateApi(
    request: Request,
    authContext: AuthContext,
    corsHeaders: Record<string, string>,
  ): Promise<Response> {
    if (request.method !== "POST") {
      return this.createErrorResponse(
        createProblemDetails(405, "Method Not Allowed", "Only POST is supported"),
        corsHeaders,
      );
    }

    try {
      const body = (await request.json()) as ValidationRequest & {
        projectId?: string;
        project_id?: string;
      };

      // Support both projectId (primary) and project_id (backward compatibility)
      const projectId = body.projectId || body.project_id;

      if (!projectId) {
        return this.createErrorResponse(
          createProblemDetails(400, "Bad Request", "projectId is required"),
          corsHeaders,
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
        event_type: "validation_started",
        data: {
          user_id: authContext.user_id,
          fragment_count: fragments.length,
        },
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
          JSON.stringify(validationResult.resolved),
        );
      }

      // Broadcast validation completed
      await this.events.broadcastToProject(projectId, {
        project_id: projectId,
        event_type: validationResult.success ? "validation_completed" : "validation_failed",
        data: {
          user_id: authContext.user_id,
          spec_hash: validationResult.specHash,
          error_count: validationResult.errors.length,
          warning_count: validationResult.warnings.length,
        },
      });

      return new Response(
        JSON.stringify({
          success: validationResult.success,
          spec_hash: validationResult.specHash,
          errors: validationResult.errors,
          warnings: validationResult.warnings,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    } catch (error) {
      logger.error("Validate API error", error instanceof Error ? error : undefined);

      return this.createErrorResponse(
        createProblemDetails(500, "Internal Server Error", "Validation failed"),
        corsHeaders,
      );
    }
  }

  /**
   * Handle gaps API (GET /api/gaps)
   */
  private async handleGapsApi(
    request: Request,
    authContext: AuthContext,
    corsHeaders: Record<string, string>,
  ): Promise<Response> {
    if (request.method !== "GET") {
      return this.createErrorResponse(
        createProblemDetails(405, "Method Not Allowed", "Only GET is supported"),
        corsHeaders,
      );
    }

    try {
      const url = new URL(request.url);
      // Support both projectId (primary) and project_id (backward compatibility)
      const projectId = url.searchParams.get("projectId") || url.searchParams.get("project_id");

      if (!projectId) {
        return this.createErrorResponse(
          createProblemDetails(400, "Bad Request", "projectId parameter is required"),
          corsHeaders,
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
          corsHeaders,
        );
      }

      const resolved = JSON.parse(version.resolved_json);
      const gapSet = await this.specEngine.generateGapSet(resolved);

      return new Response(JSON.stringify(gapSet), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    } catch (error) {
      logger.error("Gaps API error", error instanceof Error ? error : undefined);

      return this.createErrorResponse(
        createProblemDetails(500, "Internal Server Error", "Failed to generate gap analysis"),
        corsHeaders,
      );
    }
  }

  /**
   * Handle IR API (GET /api/ir/:kind)
   */
  private async handleIRApi(
    request: Request,
    authContext: AuthContext,
    corsHeaders: Record<string, string>,
  ): Promise<Response> {
    if (request.method !== "GET") {
      return this.createErrorResponse(
        createProblemDetails(405, "Method Not Allowed", "Only GET is supported"),
        corsHeaders,
      );
    }

    try {
      const url = new URL(request.url);
      const pathname = url.pathname;
      const kind = pathname.split("/").pop() as IRKind;
      // Support both projectId (primary) and project_id (backward compatibility)
      const projectId = url.searchParams.get("projectId") || url.searchParams.get("project_id");

      if (!projectId) {
        return this.createErrorResponse(
          createProblemDetails(400, "Bad Request", "projectId parameter is required"),
          corsHeaders,
        );
      }

      if (!["flow", "fsm", "view", "site"].includes(kind)) {
        return this.createErrorResponse(
          createProblemDetails(400, "Bad Request", `Invalid IR kind: ${kind}`),
          corsHeaders,
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
          corsHeaders,
        );
      }

      const resolved = JSON.parse(version.resolved_json);
      const ir = await this.irGenerator.generateIR(kind, resolved);

      return new Response(JSON.stringify(ir), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    } catch (error) {
      logger.error("IR API error", error instanceof Error ? error : undefined);

      return this.createErrorResponse(
        createProblemDetails(500, "Internal Server Error", "Failed to generate IR"),
        corsHeaders,
      );
    }
  }

  /**
   * Handle freeze API (POST /api/freeze)
   */
  private async handleFreezeApi(
    request: Request,
    authContext: AuthContext,
    corsHeaders: Record<string, string>,
  ): Promise<Response> {
    if (request.method !== "POST") {
      return this.createErrorResponse(
        createProblemDetails(405, "Method Not Allowed", "Only POST is supported"),
        corsHeaders,
      );
    }

    try {
      const body = (await request.json()) as FreezeRequest & {
        projectId?: string;
        project_id?: string;
        tag?: string;
      };

      // Support both projectId (primary) and project_id (backward compatibility)
      const projectId = body.projectId || body.project_id;
      const tag = body.tag || body.version_name;

      if (!projectId || !tag) {
        return this.createErrorResponse(
          createProblemDetails(400, "Bad Request", "projectId and tag are required"),
          corsHeaders,
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
          corsHeaders,
        );
      }

      // Create immutable version record (implementation would depend on requirements)
      // For now, just use the existing version system

      // Broadcast freeze event
      await this.events.broadcastToProject(projectId, {
        project_id: projectId,
        event_type: "version_frozen",
        data: {
          version_name: tag,
          spec_hash: version.spec_hash,
          user_id: authContext.user_id,
          description: body.description,
        },
      });

      return new Response(
        JSON.stringify({
          versionId: version.id,
          tag,
          specHash: version.spec_hash,
          manifest: { files: [] }, // TODO: implement manifest generation
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    } catch (error) {
      logger.error("Freeze API error", error instanceof Error ? error : undefined);

      return this.createErrorResponse(
        createProblemDetails(500, "Internal Server Error", "Failed to freeze version"),
        corsHeaders,
      );
    }
  }

  /**
   * Handle projects API (GET /api/projects)
   */
  private async handleProjectsApi(
    request: Request,
    _authContext: AuthContext,
    corsHeaders: Record<string, string>,
  ): Promise<Response> {
    if (request.method !== "GET") {
      return this.createErrorResponse(
        createProblemDetails(405, "Method Not Allowed", "Only GET is supported"),
        corsHeaders,
      );
    }

    try {
      const projects = await this.db.listProjects();

      return new Response(JSON.stringify(projects), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    } catch (error) {
      logger.error("Projects API error", error instanceof Error ? error : undefined);

      return this.createErrorResponse(
        createProblemDetails(500, "Internal Server Error", "Failed to get projects"),
        corsHeaders,
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
        projects: stats.totalProjects,
      };

      return new Response(JSON.stringify(health), {
        status: dbHealthy ? 200 : 503,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    } catch (_error) {
      return new Response(JSON.stringify({ status: "unhealthy", error: "Health check failed" }), {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }
  }

  /**
   * Handle status check (more detailed than health)
   */
  private async handleStatusCheck(corsHeaders: Record<string, string>): Promise<Response> {
    try {
      const dbHealthy = await this.db.healthCheck();
      const stats = this.events.getStats();

      const status = {
        service: "arbiter-lens",
        version: "1.0.0",
        status: dbHealthy ? "running" : "degraded",
        timestamp: getCurrentTimestamp(),
        uptime: process.uptime(),
        daemon: {
          healthy: dbHealthy,
          database_connected: dbHealthy,
          websocket_connections: stats.totalConnections,
          active_projects: stats.totalProjects,
        },
        system: {
          memory_usage: process.memoryUsage(),
          node_version: process.version,
          platform: process.platform,
          arch: process.arch,
        },
        endpoints: {
          health: "/health",
          status: "/status",
          mcp: "/mcp",
          api: "/api/*",
          websocket: "/ws",
        },
      };

      return new Response(JSON.stringify(status), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          service: "arbiter-lens",
          status: "error",
          error: "Status check failed",
          timestamp: getCurrentTimestamp(),
        }),
        {
          status: 503,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    }
  }

  /**
   * Handle MCP JSON-RPC requests
   */
  private async handleMcpRequest(
    request: Request,
    corsHeaders: Record<string, string>,
  ): Promise<Response> {
    if (request.method !== "POST") {
      return this.createErrorResponse(
        createProblemDetails(405, "Method Not Allowed", "MCP endpoint only supports POST requests"),
        corsHeaders,
      );
    }

    try {
      const body = await request.json();

      // Basic JSON-RPC validation
      if (!body.jsonrpc || body.jsonrpc !== "2.0" || !body.method) {
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: -32600,
              message: "Invalid Request",
            },
            id: body.id || null,
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          },
        );
      }

      // Handle MCP methods
      switch (body.method) {
        case "initialize":
          return new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              result: {
                protocolVersion: "2024-11-05",
                capabilities: {
                  roots: {
                    listChanged: true,
                  },
                  sampling: {},
                  tools: {
                    listChanged: true,
                  },
                  resources: {
                    listChanged: true,
                  },
                },
                serverInfo: {
                  name: "arbiter-lens",
                  version: "1.0.0",
                },
              },
              id: body.id,
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders,
              },
            },
          );

        case "notifications/initialized":
          return new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              result: {},
              id: body.id,
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders,
              },
            },
          );

        case "ping":
          return new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              result: {},
              id: body.id,
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders,
              },
            },
          );

        case "tools/list":
          return new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              result: {
                tools: [
                  {
                    name: "get_projects",
                    description: "List all available projects in the spec workbench",
                    inputSchema: {
                      type: "object",
                      properties: {},
                    },
                  },
                  {
                    name: "get_resolved_spec",
                    description: "Get the resolved specification for a project",
                    inputSchema: {
                      type: "object",
                      properties: {
                        projectId: { type: "string", description: "The project ID" },
                      },
                      required: ["projectId"],
                    },
                  },
                  {
                    name: "validate_project",
                    description: "Validate a project's CUE specification",
                    inputSchema: {
                      type: "object",
                      properties: {
                        projectId: { type: "string", description: "The project ID" },
                      },
                      required: ["projectId"],
                    },
                  },
                ],
              },
              id: body.id,
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders,
              },
            },
          );

        case "tools/call":
          return await this.handleMcpToolCall(body, corsHeaders);

        default:
          return new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              error: {
                code: -32601,
                message: "Method not found",
              },
              id: body.id,
            }),
            {
              status: 404,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders,
              },
            },
          );
      }
    } catch (error) {
      logger.error("MCP request handling error", error instanceof Error ? error : undefined);

      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal error",
          },
          id: null,
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    }
  }

  /**
   * Handle MCP tool call requests
   */
  private async handleMcpToolCall(
    body: any,
    corsHeaders: Record<string, string>,
  ): Promise<Response> {
    try {
      const toolName = body.params?.name;
      const args = body.params?.arguments || {};

      if (!toolName) {
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: -32602,
              message: "Invalid params - tool name required",
            },
            id: body.id,
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          },
        );
      }

      // Create a dummy auth context for MCP tool calls since we're bypassing auth
      const authContext = {
        user_id: "mcp-client",
        authorized: true,
      };

      switch (toolName) {
        case "get_projects":
          try {
            const projects = await this.db.listProjects();
            return new Response(
              JSON.stringify({
                jsonrpc: "2.0",
                result: {
                  content: [
                    {
                      type: "text",
                      text: `Found ${projects.length} projects:\n${projects.map((p) => `- ${p.id}: ${p.name || "Unnamed Project"}`).join("\n")}`,
                    },
                  ],
                  isError: false,
                },
                id: body.id,
              }),
              {
                status: 200,
                headers: {
                  "Content-Type": "application/json",
                  ...corsHeaders,
                },
              },
            );
          } catch (error) {
            return new Response(
              JSON.stringify({
                jsonrpc: "2.0",
                result: {
                  content: [
                    {
                      type: "text",
                      text: `Error listing projects: ${error instanceof Error ? error.message : String(error)}`,
                    },
                  ],
                  isError: true,
                },
                id: body.id,
              }),
              {
                status: 200,
                headers: {
                  "Content-Type": "application/json",
                  ...corsHeaders,
                },
              },
            );
          }

        case "get_resolved_spec":
          try {
            const projectId = args.projectId;
            if (!projectId) {
              return new Response(
                JSON.stringify({
                  jsonrpc: "2.0",
                  result: {
                    content: [
                      {
                        type: "text",
                        text: "Error: projectId parameter is required",
                      },
                    ],
                    isError: true,
                  },
                  id: body.id,
                }),
                {
                  status: 200,
                  headers: {
                    "Content-Type": "application/json",
                    ...corsHeaders,
                  },
                },
              );
            }

            const version = await this.db.getLatestVersion(projectId);
            if (!version) {
              return new Response(
                JSON.stringify({
                  jsonrpc: "2.0",
                  result: {
                    content: [
                      {
                        type: "text",
                        text: `No resolved specification found for project: ${projectId}`,
                      },
                    ],
                    isError: false,
                  },
                  id: body.id,
                }),
                {
                  status: 200,
                  headers: {
                    "Content-Type": "application/json",
                    ...corsHeaders,
                  },
                },
              );
            }

            const resolved = JSON.parse(version.resolved_json);
            return new Response(
              JSON.stringify({
                jsonrpc: "2.0",
                result: {
                  content: [
                    {
                      type: "text",
                      text: `Resolved specification for project ${projectId}:\n\`\`\`json\n${JSON.stringify(resolved, null, 2)}\n\`\`\``,
                    },
                  ],
                  isError: false,
                },
                id: body.id,
              }),
              {
                status: 200,
                headers: {
                  "Content-Type": "application/json",
                  ...corsHeaders,
                },
              },
            );
          } catch (error) {
            return new Response(
              JSON.stringify({
                jsonrpc: "2.0",
                result: {
                  content: [
                    {
                      type: "text",
                      text: `Error getting resolved spec: ${error instanceof Error ? error.message : String(error)}`,
                    },
                  ],
                  isError: true,
                },
                id: body.id,
              }),
              {
                status: 200,
                headers: {
                  "Content-Type": "application/json",
                  ...corsHeaders,
                },
              },
            );
          }

        case "validate_project":
          try {
            const projectId = args.projectId;
            if (!projectId) {
              return new Response(
                JSON.stringify({
                  jsonrpc: "2.0",
                  result: {
                    content: [
                      {
                        type: "text",
                        text: "Error: projectId parameter is required",
                      },
                    ],
                    isError: true,
                  },
                  id: body.id,
                }),
                {
                  status: 200,
                  headers: {
                    "Content-Type": "application/json",
                    ...corsHeaders,
                  },
                },
              );
            }

            const fragments = await this.db.listFragments(projectId);
            const validationResult = await this.specEngine.validateProject(projectId, fragments);

            let resultText = `Validation results for project ${projectId}:\n`;
            resultText += `Status: ${validationResult.success ? "✅ Valid" : "❌ Invalid"}\n`;
            resultText += `Spec Hash: ${validationResult.specHash}\n`;

            if (validationResult.errors.length > 0) {
              resultText += `\nErrors:\n${validationResult.errors.map((e) => `- ${e}`).join("\n")}`;
            }

            if (validationResult.warnings.length > 0) {
              resultText += `\nWarnings:\n${validationResult.warnings.map((w) => `- ${w}`).join("\n")}`;
            }

            return new Response(
              JSON.stringify({
                jsonrpc: "2.0",
                result: {
                  content: [
                    {
                      type: "text",
                      text: resultText,
                    },
                  ],
                  isError: !validationResult.success,
                },
                id: body.id,
              }),
              {
                status: 200,
                headers: {
                  "Content-Type": "application/json",
                  ...corsHeaders,
                },
              },
            );
          } catch (error) {
            return new Response(
              JSON.stringify({
                jsonrpc: "2.0",
                result: {
                  content: [
                    {
                      type: "text",
                      text: `Error validating project: ${error instanceof Error ? error.message : String(error)}`,
                    },
                  ],
                  isError: true,
                },
                id: body.id,
              }),
              {
                status: 200,
                headers: {
                  "Content-Type": "application/json",
                  ...corsHeaders,
                },
              },
            );
          }

        default:
          return new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              error: {
                code: -32601,
                message: `Unknown tool: ${toolName}`,
              },
              id: body.id,
            }),
            {
              status: 404,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders,
              },
            },
          );
      }
    } catch (error) {
      logger.error("MCP tool call error", error instanceof Error ? error : undefined);

      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal error",
          },
          id: body.id,
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    }
  }

  /**
   * Get client identifier for rate limiting
   */
  private getClientId(request: Request): string {
    const forwarded = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const remoteAddr = forwarded?.split(",")[0] || realIp || "unknown";

    return remoteAddr;
  }

  /**
   * Create error response with proper headers
   */
  private createErrorResponse(
    problemDetails: ProblemDetails,
    additionalHeaders: Record<string, string> = {},
  ): Response {
    return new Response(JSON.stringify(problemDetails), {
      status: problemDetails.status,
      headers: {
        "Content-Type": "application/problem+json",
        ...additionalHeaders,
      },
    });
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
  port: parseInt(process.env.PORT || "5050", 10),
  host: process.env.HOST || "localhost",
  database_path: process.env.DATABASE_PATH || "./spec_workbench.db",
  spec_workdir: process.env.SPEC_WORKDIR || "./workdir",
  cue_binary_path: process.env.CUE_BINARY || "cue",
  jq_binary_path: process.env.JQ_BINARY || "jq",
  auth_required: process.env.AUTH_REQUIRED !== "false",
  rate_limit: {
    max_tokens: parseInt(process.env.RATE_LIMIT_TOKENS || "10", 10),
    refill_rate: parseFloat(process.env.RATE_LIMIT_REFILL || "1"),
    window_ms: parseInt(process.env.RATE_LIMIT_WINDOW || "10000", 10),
  },
  external_tool_timeout_ms: parseInt(process.env.EXTERNAL_TOOL_TIMEOUT || "10000", 10),
  websocket: {
    max_connections: parseInt(process.env.WS_MAX_CONNECTIONS || "1000", 10),
    ping_interval_ms: parseInt(process.env.WS_PING_INTERVAL || "30000", 10),
  },
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
