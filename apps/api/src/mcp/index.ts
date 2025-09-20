import type { Request } from "bun";
import type { AuthService } from "../auth.ts";
import type { McpCliIntegration } from "../mcp-cli-integration.ts";

export class McpService {
  constructor(
    private auth: AuthService,
    private cli: McpCliIntegration,
  ) {}

  async handleRequest(request: Request, headers: Record<string, string>): Promise<Response> {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return new Response("Unauthorized", { status: 401, headers });
    }

    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
}
