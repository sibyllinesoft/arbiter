import type { HandlerResult } from "./handlers/types.js";

export class McpCliIntegration {
  async triggerTool(_: string, __: Record<string, unknown>): Promise<HandlerResult> {
    return {
      success: true,
      message: "MCP tool execution stubbed for tests",
    };
  }
}
