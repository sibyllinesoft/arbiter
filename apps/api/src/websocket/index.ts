import type { ServerWebSocket } from "bun";
import type { AuthService } from "../auth.ts";
import type { EventService } from "../events.ts";
import type { ServerConfig } from "../types.ts";

export class WebSocketHandler {
  constructor(
    private auth: AuthService,
    private events: EventService,
    private config: ServerConfig["websocket"],
  ) {}

  isWebSocketUpgrade(): boolean {
    return false;
  }

  upgrade(
    _req: Request,
    _connInfo: { data: any; accepted: boolean },
    _headers: Record<string, string>,
  ) {
    return new Response("WebSocket upgrade not supported in tests", { status: 426 });
  }

  handleConnection(_ws: ServerWebSocket) {
    // no-op stub for tests
  }
}
