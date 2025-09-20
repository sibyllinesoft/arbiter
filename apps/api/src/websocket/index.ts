import type { ServerWebSocket } from 'bun';
import type { AuthService } from '../auth.ts';
import type { EventService } from '../events.ts';
import type { ServerConfig, WebSocketMessage } from '../types.ts';
import { logger } from '../utils.ts';

export class WebSocketHandler {
  constructor(
    private auth: AuthService,
    private events: EventService,
    private config: ServerConfig['websocket']
  ) {}

  /**
   * Check if request is a WebSocket upgrade for /events endpoint
   */
  isWebSocketUpgrade(pathname: string, request: Request): boolean {
    const upgradeHeader = request.headers.get('upgrade');
    const connectionHeader = request.headers.get('connection');

    const isUpgrade =
      pathname === '/events' &&
      upgradeHeader?.toLowerCase() === 'websocket' &&
      connectionHeader?.toLowerCase().includes('upgrade');

    logger.info('[WS] isWebSocketUpgrade called', {
      pathname,
      upgradeHeader,
      connectionHeader,
      userAgent: request.headers.get('user-agent'),
      origin: request.headers.get('origin'),
      result: isUpgrade,
    });

    return isUpgrade;
  }

  /**
   * Handle WebSocket upgrade request
   */
  async handleUpgrade(request: Request, server: any): Promise<{ response?: Response }> {
    try {
      logger.info('[WS] handleUpgrade called', {
        url: request.url,
        method: request.method,
        upgradeHeaders: {
          upgrade: request.headers.get('upgrade'),
          connection: request.headers.get('connection'),
          'sec-websocket-key': request.headers.get('sec-websocket-key'),
          'sec-websocket-version': request.headers.get('sec-websocket-version'),
          'sec-websocket-protocol': request.headers.get('sec-websocket-protocol'),
          origin: request.headers.get('origin'),
          userAgent: request.headers.get('user-agent'),
        },
      });

      // Get auth context - in development mode, use default auth
      const authContext = await this.auth.authenticateRequest(request.headers);

      logger.info('[WS] Auth context result', {
        authResult: authContext ? 'OK' : 'FAILED',
        hasContext: !!authContext,
      });

      if (!authContext) {
        logger.warn('[WS] Auth failed - returning 401');
        return {
          response: new Response('Unauthorized', { status: 401 }),
        };
      }

      logger.info('[WS] Attempting server.upgrade...');
      // Upgrade the connection
      const upgraded = server.upgrade(request, {
        data: {
          connectionId: '', // Will be set by events service
          authContext,
        },
      });

      logger.info('[WS] Upgrade result', { upgraded: upgraded ? 'SUCCESS' : 'FAILED' });

      if (!upgraded) {
        logger.warn('[WS] Upgrade failed - returning 400');
        return {
          response: new Response('WebSocket upgrade failed', { status: 400 }),
        };
      }

      logger.info('[WS] Upgrade successful - no response needed');
      return {}; // Success, no response needed
    } catch (error) {
      console.log('[WS] Upgrade error caught:', error);
      logger.error('WebSocket upgrade error', error instanceof Error ? error : undefined);
      return {
        response: new Response('WebSocket upgrade error', { status: 500 }),
      };
    }
  }

  /**
   * Handle WebSocket connection opened
   */
  handleOpen(ws: ServerWebSocket<{ connectionId: string; authContext: any }>): void {
    try {
      logger.info('[WS] Connection opened - handleOpen called');
      const connectionId = this.events.handleConnection(ws, ws.data.authContext);
      ws.data.connectionId = connectionId;

      logger.info('[WS] Connection established', { connectionId });
      logger.debug('WebSocket connection opened', { connectionId });
    } catch (error) {
      console.log('[WS] Error in handleOpen:', error);
      logger.error('WebSocket open error', error instanceof Error ? error : undefined);
      ws.close();
    }
  }

  /**
   * Handle WebSocket message received
   */
  async handleMessage(
    ws: ServerWebSocket<{ connectionId: string; authContext: any }>,
    message: string
  ): Promise<void> {
    try {
      const connectionId = ws.data.connectionId;

      if (!connectionId) {
        logger.warn('Received message from connection without ID');
        return;
      }

      let parsedMessage: WebSocketMessage;
      try {
        parsedMessage = JSON.parse(message);
      } catch {
        logger.warn('Invalid JSON message received', { connectionId });
        return;
      }

      await this.events.handleMessage(connectionId, parsedMessage);
    } catch (error) {
      logger.error('WebSocket message error', error instanceof Error ? error : undefined);
    }
  }

  /**
   * Handle WebSocket connection closed
   */
  handleClose(ws: ServerWebSocket<{ connectionId: string; authContext: any }>): void {
    try {
      const connectionId = ws.data.connectionId;

      if (connectionId) {
        this.events.handleDisconnection(connectionId);
        logger.debug('WebSocket connection closed', { connectionId });
      }
    } catch (error) {
      logger.error('WebSocket close error', error instanceof Error ? error : undefined);
    }
  }
}
