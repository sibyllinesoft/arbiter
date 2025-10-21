import type { ServerWebSocket } from "bun";
import type { AuthService } from "../auth";
import type { EventService } from "../events";
import type { ServerConfig, WebSocketMessage } from "../types";
import { logger } from "../utils";

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

    const isUpgrade =
      pathname === "/events" &&
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

      // Validate WebSocket headers
      const secWebSocketKey = request.headers.get("sec-websocket-key");
      const secWebSocketVersion = request.headers.get("sec-websocket-version");

      if (!secWebSocketKey) {
        logger.warn("[WS] Missing Sec-WebSocket-Key header");
        return {
          response: new Response("Bad Request: Missing Sec-WebSocket-Key", { status: 400 }),
        };
      }

      if (secWebSocketVersion !== "13") {
        logger.warn("[WS] Unsupported WebSocket version", { version: secWebSocketVersion });
        return {
          response: new Response("Bad Request: Unsupported WebSocket version", { status: 400 }),
        };
      }

      // Get auth context with timeout
      logger.info("[WS] Authenticating request...");
      const authPromise = this.auth.authenticateRequest(request.headers);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Authentication timeout")), 5000),
      );

      const authContext = (await Promise.race([authPromise, timeoutPromise])) as any;

      logger.info("[WS] Auth context result", {
        authResult: authContext ? "OK" : "FAILED",
        hasContext: !!authContext,
        authDuration: Date.now() - startTime,
      });

      if (!authContext) {
        logger.warn("[WS] Auth failed - returning 401");
        return {
          response: new Response("Unauthorized", { status: 401 }),
        };
      }

      logger.info("[WS] Attempting server.upgrade...");

      // Generate connection ID before upgrade
      connectionId = `ws_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

      // Upgrade the connection with enhanced error handling
      let upgraded: boolean;
      try {
        upgraded = server.upgrade(request, {
          data: {
            connectionId,
            authContext,
            upgradeTime: new Date().toISOString(),
          },
        });
      } catch (upgradeError) {
        logger.error(
          "[WS] Server upgrade threw exception",
          upgradeError instanceof Error ? upgradeError : undefined,
          {
            connectionId,
            duration: Date.now() - startTime,
          },
        );
        return {
          response: new Response("WebSocket upgrade internal error", { status: 500 }),
        };
      }

      logger.info("[WS] Upgrade result", {
        upgraded: upgraded ? "SUCCESS" : "FAILED",
        connectionId,
        duration: Date.now() - startTime,
      });

      if (!upgraded) {
        logger.warn("[WS] Upgrade failed - returning 400", {
          connectionId,
          possibleCauses: [
            "Connection already established",
            "Invalid headers",
            "Server resource constraints",
            "Network conditions",
          ],
        });
        return {
          response: new Response("WebSocket upgrade failed", { status: 400 }),
        };
      }

      logger.info("[WS] Upgrade successful - no response needed", {
        connectionId,
        totalDuration: Date.now() - startTime,
      });
      return {}; // Success, no response needed
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("[WS] WebSocket upgrade error", error instanceof Error ? error : undefined, {
        connectionId,
        duration,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        isTimeout: error instanceof Error && error.message.includes("timeout"),
        isAuthError: error instanceof Error && error.message.includes("auth"),
        requestHeaders: Object.fromEntries(request.headers.entries()),
      });

      // Return appropriate error response based on error type
      if (error instanceof Error) {
        if (error.message.includes("timeout")) {
          return {
            response: new Response("WebSocket upgrade timeout", { status: 408 }),
          };
        }
        if (error.message.includes("auth")) {
          return {
            response: new Response("WebSocket authentication error", { status: 401 }),
          };
        }
      }

      return {
        response: new Response("WebSocket upgrade error", { status: 500 }),
      };
    }
  }

  /**
   * Handle WebSocket connection opened
   */
  handleOpen(
    ws: ServerWebSocket<{ connectionId: string; authContext: any; upgradeTime?: string }>,
  ): void {
    const startTime = Date.now();
    let connectionId: string | undefined;

    try {
      logger.info("[WS] Connection opened - handleOpen called", {
        hasData: !!ws.data,
        hasAuthContext: !!ws.data?.authContext,
        upgradeTime: ws.data?.upgradeTime,
      });

      // Validate WebSocket data
      if (!ws.data) {
        logger.error("[WS] WebSocket opened without data object");
        ws.close(1002, "Invalid connection data");
        return;
      }

      if (!ws.data.authContext) {
        logger.error("[WS] WebSocket opened without auth context");
        ws.close(1002, "Missing authentication");
        return;
      }

      // Generate connection ID if not present
      if (!ws.data.connectionId) {
        connectionId = `ws_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        ws.data.connectionId = connectionId;
        logger.info("[WS] Generated connection ID", { connectionId });
      } else {
        connectionId = ws.data.connectionId;
      }

      // Register with events service with timeout
      const connectionPromise = this.events.handleConnection(ws, ws.data.authContext);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Connection registration timeout")), 3000),
      );

      Promise.race([connectionPromise, timeoutPromise])
        .then((value: unknown) => {
          const registeredId = value as string;
          if (registeredId !== connectionId) {
            logger.info("[WS] Connection ID updated by events service", {
              original: connectionId,
              updated: registeredId,
            });
            ws.data.connectionId = registeredId;
            connectionId = registeredId;
          }

          logger.info("[WS] Connection established successfully", {
            connectionId,
            duration: Date.now() - startTime,
            authUser: ws.data.authContext?.user_id || "anonymous",
          });

          logger.debug("WebSocket connection opened", { connectionId });
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
    } catch (error) {
      logger.error("[WS] Error in handleOpen", error instanceof Error ? error : undefined, {
        connectionId,
        duration: Date.now() - startTime,
        hasWebSocketData: !!ws.data,
      });

      try {
        ws.close(1011, "Connection setup failed");
      } catch (closeError) {
        logger.error(
          "[WS] Failed to close WebSocket after error",
          closeError instanceof Error ? closeError : undefined,
        );
      }
    }
  }

  /**
   * Handle WebSocket message received
   */
  async handleMessage(
    ws: ServerWebSocket<{ connectionId: string; authContext: any }>,
    message: string,
  ): Promise<void> {
    const startTime = Date.now();
    let connectionId: string | undefined;

    try {
      connectionId = ws.data?.connectionId;

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
        ws.send(
          JSON.stringify({
            type: "error",
            error: "Connection not properly initialized",
            timestamp: new Date().toISOString(),
          }),
        );
        return;
      }

      // Validate message size
      if (message.length > 64 * 1024) {
        // 64KB limit
        logger.warn("[WS] Message too large", {
          connectionId,
          messageLength: message.length,
          limit: 64 * 1024,
        });
        ws.send(
          JSON.stringify({
            type: "error",
            error: "Message too large",
            maxSize: 64 * 1024,
            timestamp: new Date().toISOString(),
          }),
        );
        return;
      }

      let parsedMessage: WebSocketMessage;
      try {
        parsedMessage = JSON.parse(message);
      } catch (parseError) {
        logger.warn("[WS] Invalid JSON message received", {
          connectionId,
          messageLength: message.length,
          error: parseError instanceof Error ? parseError.message : "Unknown parse error",
        });
        ws.send(
          JSON.stringify({
            type: "error",
            error: "Invalid JSON format",
            timestamp: new Date().toISOString(),
          }),
        );
        return;
      }

      // Validate message structure
      if (!parsedMessage || typeof parsedMessage !== "object") {
        logger.warn("[WS] Invalid message structure", { connectionId });
        ws.send(
          JSON.stringify({
            type: "error",
            error: "Invalid message structure",
            timestamp: new Date().toISOString(),
          }),
        );
        return;
      }

      // Handle message with timeout
      const messagePromise = this.events.handleMessage(connectionId, parsedMessage);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Message handling timeout")), 10000),
      );

      await Promise.race([messagePromise, timeoutPromise]);

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
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        isTimeout: error instanceof Error && error.message.includes("timeout"),
      });

      // Send error response to client
      try {
        ws.send(
          JSON.stringify({
            type: "error",
            error: "Message processing failed",
            details: error instanceof Error ? error.message : "Unknown error",
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
  }

  /**
   * Handle WebSocket connection closed
   */
  handleClose(
    ws: ServerWebSocket<{ connectionId: string; authContext: any }>,
    code?: number,
    reason?: string,
  ): void {
    const startTime = Date.now();
    let connectionId: string | undefined;

    try {
      connectionId = ws.data?.connectionId;

      logger.info("[WS] Connection closing", {
        connectionId,
        code,
        reason,
        hasData: !!ws.data,
      });

      if (connectionId) {
        const safeConnectionId = connectionId;
        // Fire-and-forget disconnection handling - don't wait for completion
        setImmediate(() => {
          try {
            this.events.handleDisconnection(safeConnectionId);
            logger.debug("[WS] WebSocket connection cleanup initiated", {
              connectionId: safeConnectionId,
              code,
              reason,
              duration: Date.now() - startTime,
            });
          } catch (error) {
            // Ignore disconnection errors - they're common during rapid reconnects
            logger.debug("[WS] Disconnection cleanup completed", {
              connectionId: safeConnectionId,
              duration: Date.now() - startTime,
              note: "Cleanup completed, any errors are expected during rapid cycles",
            });
          }
        });
      } else {
        logger.warn("[WS] Connection closed without ID", {
          code,
          reason,
          hasData: !!ws.data,
        });
      }
    } catch (error) {
      logger.error("[WS] WebSocket close error", error instanceof Error ? error : undefined, {
        connectionId,
        code,
        reason,
        duration: Date.now() - startTime,
      });
    }
  }
}
