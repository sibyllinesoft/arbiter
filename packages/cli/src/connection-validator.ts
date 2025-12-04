import { COMMON_PORTS } from "@/config.js";
import type { CLIConfig } from "@/types.js";

/**
 * Connection validation and auto-discovery utility
 */
export class ConnectionValidator {
  constructor(private config: CLIConfig) {}

  /**
   * Validate server connection with auto-discovery fallback
   */
  async validateConnection(): Promise<{
    success: boolean;
    url?: string;
    port?: number;
    error?: string;
    suggestions?: string[];
    dnsResolved?: boolean;
    tlsHandshake?: boolean;
    latencyMs?: number;
  }> {
    const baseUrl = new URL(this.config.apiUrl);
    const hostname = baseUrl.hostname;
    const protocol = baseUrl.protocol;
    const configuredPort = Number.parseInt(baseUrl.port, 10) || (protocol === "https:" ? 443 : 80);

    // First try configured URL
    const configuredResult = await this.testConnection(
      `${protocol}//${hostname}:${configuredPort}`,
    );
    if (configuredResult.success) {
      return {
        success: true,
        url: `${protocol}//${hostname}:${configuredPort}`,
        port: configuredPort,
      };
    }

    // Try common ports for auto-discovery
    const suggestions: string[] = [];
    for (const port of COMMON_PORTS) {
      const testUrl = `${protocol}//${hostname}:${port}`;
      const result = await this.testConnection(testUrl);

      if (result.success) {
        return {
          success: true,
          url: testUrl,
          port: port,
        };
      }

      if (result.partialSuccess) {
        suggestions.push(`Port ${port}: ${result.error}`);
      }
    }

    return {
      success: false,
      error: `No Arbiter server found at ${hostname}`,
      suggestions: [
        `Tried ports: ${COMMON_PORTS.join(", ")}`,
        'Start the API stack via "bun run dev:full" (see the repo README) or use your deployed server URL.',
        'If you rely on Docker, run "docker compose up api" from the repo root or follow docs/deploy instructions.',
        "Make sure ARBITER_URL/--api-url matches the environment that is actually running.",
        ...suggestions,
      ],
    };
  }

  /**
   * Test connection to a specific URL
   */
  private async testConnection(url: string): Promise<{
    success: boolean;
    partialSuccess: boolean;
    error?: string;
  }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${url}/health`, {
        signal: controller.signal,
        method: "GET",
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        // Verify it's actually an Arbiter server
        if (data.status && typeof data.timestamp === "string") {
          return { success: true, partialSuccess: true };
        }
      }

      return {
        success: false,
        partialSuccess: true,
        error: `Server responded with ${response.status}`,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          return {
            success: false,
            partialSuccess: true,
            error: "Connection timeout",
          };
        }

        if (error.message.includes("ECONNREFUSED")) {
          return {
            success: false,
            partialSuccess: false,
            error: "Connection refused",
          };
        }
      }

      return {
        success: false,
        partialSuccess: false,
        error: "Network error",
      };
    }
  }

  /**
   * Get diagnostic information for troubleshooting
   */
  async getDiagnostics(): Promise<{
    configuredUrl: string;
    commonPorts: readonly number[];
    networkTests: Array<{
      port: number;
      status: "success" | "timeout" | "refused" | "error";
      responseTime?: number;
      error?: string;
    }>;
  }> {
    const baseUrl = new URL(this.config.apiUrl);
    const hostname = baseUrl.hostname;
    const protocol = baseUrl.protocol;

    const networkTests = await Promise.all(
      COMMON_PORTS.map(async (port) => {
        const startTime = Date.now();
        const testUrl = `${protocol}//${hostname}:${port}`;

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000);

          const response = await fetch(`${testUrl}/health`, {
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          const responseTime = Date.now() - startTime;

          return {
            port,
            status: response.ok ? ("success" as const) : ("error" as const),
            responseTime,
            error: response.ok ? undefined : `HTTP ${response.status}`,
          };
        } catch (error) {
          const responseTime = Date.now() - startTime;

          if (error instanceof Error) {
            if (error.name === "AbortError") {
              return { port, status: "timeout" as const, responseTime };
            }

            if (error.message.includes("ECONNREFUSED")) {
              return { port, status: "refused" as const, responseTime };
            }
          }

          return {
            port,
            status: "error" as const,
            responseTime,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      }),
    );

    return {
      configuredUrl: this.config.apiUrl,
      commonPorts: COMMON_PORTS,
      networkTests,
    };
  }
}
