/**
 * WebSocket connection handler for real-time event streaming
 */
import type { ServerWebSocket } from "bun";
import type { AuthService } from "../auth";
import type { EventService } from "../io/events";
import { logger } from "../io/utils";
import type { ServerConfig, WebSocketMessage } from "../util/types";

/** WebSocket connection data attached during upgrade */
interface WSData {
  connectionId: string;
  authContext: any;
  upgradeTime?: string;
}

/** Create a unique WebSocket connection ID */
function generateConnectionId(): string {
  return `ws_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/** Validate WebSocket upgrade headers */
function validateUpgradeHeaders(
  request: Request,
): { valid: true } | { valid: false; message: string } {
  const secWebSocketKey = request.headers.get("sec-websocket-key");
  const secWebSocketVersion = request.headers.get("sec-websocket-version");

  if (!secWebSocketKey) {
    return { valid: false, message: "Missing Sec-WebSocket-Key" };
  }
  if (secWebSocketVersion !== "13") {
    return { valid: false, message: "Unsupported WebSocket version" };
  }
  return { valid: true };
}

/** Create timeout promise for async operations */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(message)), ms),
  );
  return Promise.race([promise, timeoutPromise]);
}

/** Send JSON error response to WebSocket client */
function sendError(ws: ServerWebSocket<WSData>, error: string, details?: string): void {
  try {
    ws.send(
      JSON.stringify({
        type: "error",
        error,
        ...(details && { details }),
        timestamp: new Date().toISOString(),
      }),
    );
  } catch (sendError) {
    logger.error(
      "[WS] Failed to send error response",
      sendError instanceof Error ? sendError : undefined,
    );
  }
}

/** Log upgrade request headers */
function logUpgradeHeaders(request: Request): void {
  logger.info("[WS] handleUpgrade called", {
    url: request.url,
    method: request.method,
    timestamp: new Date().toISOString(),
    upgradeHeaders: {
      upgrade: request.headers.get("upgrade"),
      connection: request.headers.get("connection"),
      "sec-websocket-key": request.headers.get("sec-websocket-key"),
      "sec-websocket-version": request.headers.get("sec-websocket-version"),
      "sec-websocket-protocol": request.headers.get("sec-websocket-protocol"),
      origin: request.headers.get("origin"),
      userAgent: request.headers.get("user-agent"),
    },
  });
}

/** Determine error response status based on error type */
function getErrorResponse(error: unknown): Response {
  if (error instanceof Error) {
    if (error.message.includes("timeout")) {
      return new Response("WebSocket upgrade timeout", { status: 408 });
    }
    if (error.message.includes("auth")) {
      return new Response("WebSocket authentication error", { status: 401 });
    }
  }
  return new Response("WebSocket upgrade error", { status: 500 });
}

/** Validate WebSocket data object */
function validateWsData(ws: ServerWebSocket<WSData>): boolean {
  if (!ws.data) {
    logger.error("[WS] WebSocket opened without data object");
    ws.close(1002, "Invalid connection data");
    return false;
  }

  if (!ws.data.authContext) {
    logger.error("[WS] WebSocket opened without auth context");
    ws.close(1002, "Missing authentication");
    return false;
  }

  return true;
}

/** Parse and validate WebSocket message */
function parseMessage(message: string, connectionId: string): WebSocketMessage | null {
  if (message.length > 64 * 1024) {
    logger.warn("[WS] Message too large", {
      connectionId,
      messageLength: message.length,
      limit: 64 * 1024,
    });
    return null;
  }

  try {
    const parsed = JSON.parse(message);
    if (!parsed || typeof parsed !== "object") {
      logger.warn("[WS] Invalid message structure", { connectionId });
      return null;
    }
    return parsed;
  } catch (parseError) {
    logger.warn("[WS] Invalid JSON message received", {
      connectionId,
      messageLength: message.length,
      error: parseError instanceof Error ? parseError.message : "Unknown parse error",
    });
    return null;
  }
}

export class WebSocketHandler {
  constructor(
    private auth: AuthService,
    private events: EventService,
    private config: ServerConfig["websocket"],
  ) {}

  /**
   * Check if request is a WebSocket upgrade for /events endpoint
   */
  isWebSocketUpgrade(pathname: string, request: Request): boolean {
    const upgradeHeader = request.headers.get("upgrade");
    const connectionHeader = request.headers.get("connection");

    const isEventsPath = pathname === "/events" || pathname === "/ws";

    const isUpgrade =
      isEventsPath &&
      upgradeHeader?.toLowerCase() === "websocket" &&
      connectionHeader?.toLowerCase().includes("upgrade");

    logger.info("[WS] isWebSocketUpgrade called", {
      pathname,
      upgradeHeader,
      connectionHeader,
      userAgent: request.headers.get("user-agent"),
      origin: request.headers.get("origin"),
      result: isUpgrade,
    });

    return !!isUpgrade;
  }

  /**
   * Handle WebSocket upgrade request
   */
  async handleUpgrade(request: Request, server: any): Promise<{ response?: Response }> {
    const startTime = Date.now();
    let connectionId: string | undefined;

    try {
      logUpgradeHeaders(request);

      const headerValidation = validateUpgradeHeaders(request);
      if (!headerValidation.valid) {
        logger.warn(`[WS] ${headerValidation.message}`);
        return {
          response: new Response(`Bad Request: ${headerValidation.message}`, { status: 400 }),
        };
      }

      const authContext = await this.authenticateUpgrade(request, startTime);
      if (!authContext) {
        return { response: new Response("Unauthorized", { status: 401 }) };
      }

      connectionId = generateConnectionId();
      return this.performUpgrade(server, request, connectionId, authContext, startTime);
    } catch (error) {
      logger.error("[WS] WebSocket upgrade error", error instanceof Error ? error : undefined, {
        connectionId,
        duration: Date.now() - startTime,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        requestHeaders: Object.fromEntries(request.headers.entries()),
      });

      return { response: getErrorResponse(error) };
    }
  }

  private async authenticateUpgrade(request: Request, startTime: number): Promise<any | null> {
    logger.info("[WS] Authenticating request...");
    const authContext = await withTimeout(
      this.auth.authenticateRequest(request.headers),
      5000,
      "Authentication timeout",
    );

    logger.info("[WS] Auth context result", {
      authResult: authContext ? "OK" : "FAILED",
      hasContext: !!authContext,
      authDuration: Date.now() - startTime,
    });

    if (!authContext) {
      logger.warn("[WS] Auth failed - returning 401");
    }

    return authContext;
  }

  private performUpgrade(
    server: any,
    request: Request,
    connectionId: string,
    authContext: any,
    startTime: number,
  ): { response?: Response } {
    logger.info("[WS] Attempting server.upgrade...");

    try {
      const upgraded = server.upgrade(request, {
        data: { connectionId, authContext, upgradeTime: new Date().toISOString() },
      });

      logger.info("[WS] Upgrade result", {
        upgraded: upgraded ? "SUCCESS" : "FAILED",
        connectionId,
        duration: Date.now() - startTime,
      });

      if (!upgraded) {
        logger.warn("[WS] Upgrade failed - returning 400", { connectionId });
        return { response: new Response("WebSocket upgrade failed", { status: 400 }) };
      }

      logger.info("[WS] Upgrade successful - no response needed", {
        connectionId,
        totalDuration: Date.now() - startTime,
      });
      return {};
    } catch (upgradeError) {
      logger.error(
        "[WS] Server upgrade threw exception",
        upgradeError instanceof Error ? upgradeError : undefined,
        {
          connectionId,
          duration: Date.now() - startTime,
        },
      );
      return { response: new Response("WebSocket upgrade internal error", { status: 500 }) };
    }
  }

  /**
   * Handle WebSocket connection opened
   */
  handleOpen(ws: ServerWebSocket<WSData>): void {
    const startTime = Date.now();

    logger.info("[WS] Connection opened - handleOpen called", {
      hasData: !!ws.data,
      hasAuthContext: !!ws.data?.authContext,
      upgradeTime: ws.data?.upgradeTime,
    });

    if (!validateWsData(ws)) return;

    const connectionId = ws.data.connectionId || generateConnectionId();
    if (!ws.data.connectionId) {
      ws.data.connectionId = connectionId;
      logger.info("[WS] Generated connection ID", { connectionId });
    }

    this.registerConnection(ws, connectionId, startTime);
  }

  private registerConnection(
    ws: ServerWebSocket<WSData>,
    connectionId: string,
    startTime: number,
  ): void {
    withTimeout(
      this.events.handleConnection(ws, ws.data.authContext),
      3000,
      "Connection registration timeout",
    )
      .then((registeredId: unknown) => {
        const id = registeredId as string;
        if (id !== connectionId) {
          logger.info("[WS] Connection ID updated by events service", {
            original: connectionId,
            updated: id,
          });
          ws.data.connectionId = id;
        }

        logger.info("[WS] Connection established successfully", {
          connectionId: id,
          duration: Date.now() - startTime,
          authUser: ws.data.authContext?.user_id || "anonymous",
        });
      })
      .catch((error) => {
        logger.error(
          "[WS] Failed to register connection with events service",
          error instanceof Error ? error : undefined,
          {
            connectionId,
            duration: Date.now() - startTime,
          },
        );
        ws.close(1011, "Connection registration failed");
      });
  }

  /**
   * Handle WebSocket message received
   */
  async handleMessage(ws: ServerWebSocket<WSData>, message: string): Promise<void> {
    const startTime = Date.now();
    const connectionId = ws.data?.connectionId;

    logger.debug("[WS] Message received", {
      connectionId,
      messageLength: message.length,
      messagePreview: message.length > 100 ? message.substring(0, 100) + "..." : message,
    });

    if (!connectionId) {
      logger.warn("[WS] Received message from connection without ID", {
        hasData: !!ws.data,
        messageLength: message.length,
      });
      sendError(ws, "Connection not properly initialized");
      return;
    }

    const parsedMessage = parseMessage(message, connectionId);
    if (!parsedMessage) {
      sendError(ws, "Invalid message format");
      return;
    }

    try {
      await withTimeout(
        this.events.handleMessage(connectionId, parsedMessage),
        10000,
        "Message handling timeout",
      );
      logger.debug("[WS] Message handled successfully", {
        connectionId,
        messageType: parsedMessage.type || "unknown",
        duration: Date.now() - startTime,
      });
    } catch (error) {
      logger.error("[WS] WebSocket message error", error instanceof Error ? error : undefined, {
        connectionId,
        duration: Date.now() - startTime,
        messageLength: message.length,
      });
      sendError(
        ws,
        "Message processing failed",
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  /**
   * Handle WebSocket connection closed
   */
  handleClose(ws: ServerWebSocket<WSData>, code?: number, reason?: string): void {
    const startTime = Date.now();
    const connectionId = ws.data?.connectionId;

    logger.info("[WS] Connection closing", { connectionId, code, reason, hasData: !!ws.data });

    if (connectionId) {
      setImmediate(() => {
        try {
          this.events.handleDisconnection(connectionId);
          logger.debug("[WS] WebSocket connection cleanup initiated", {
            connectionId,
            code,
            reason,
            duration: Date.now() - startTime,
          });
        } catch {
          logger.debug("[WS] Disconnection cleanup completed", {
            connectionId,
            duration: Date.now() - startTime,
          });
        }
      });
    } else {
      logger.warn("[WS] Connection closed without ID", { code, reason, hasData: !!ws.data });
    }
  }
}
