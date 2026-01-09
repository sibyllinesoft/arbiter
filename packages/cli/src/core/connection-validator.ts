/**
 * @packageDocumentation
 * API server connection validation and diagnostics.
 *
 * Provides utilities for validating Arbiter API server connections,
 * testing common ports, and generating diagnostic information.
 */

import { COMMON_PORTS } from "@/io/config/config.js";
import type { CLIConfig } from "@/types.js";

/** Status of a network connection test. */
type ConnectionStatus = "success" | "timeout" | "refused" | "error";

/** Result of a connection test attempt. */
interface TestResult {
  success: boolean;
  partialSuccess: boolean;
  error?: string;
}

/** Result of a connection validation. */
interface ValidationResult {
  success: boolean;
  url?: string;
  port?: number;
  error?: string;
  suggestions?: string[];
  dnsResolved?: boolean;
  tlsHandshake?: boolean;
  latencyMs?: number;
}

/** Result of a network port test. */
interface NetworkTest {
  port: number;
  status: ConnectionStatus;
  responseTime?: number;
  error?: string;
}

/**
 * Get the default port for a protocol.
 * @param protocol - URL protocol string
 * @returns Default port number (443 for HTTPS, 80 otherwise)
 */
function getDefaultPort(protocol: string): number {
  return protocol === "https:" ? 443 : 80;
}

/**
 * Parse a URL into its component parts.
 * @param url - URL string to parse
 * @returns Object with hostname, protocol, and port
 */
function parseUrlParts(url: string): { hostname: string; protocol: string; port: number } {
  const baseUrl = new URL(url);
  return {
    hostname: baseUrl.hostname,
    protocol: baseUrl.protocol,
    port: Number.parseInt(baseUrl.port, 10) || getDefaultPort(baseUrl.protocol),
  };
}

/**
 * Build a URL string from components.
 * @param protocol - URL protocol
 * @param hostname - Server hostname
 * @param port - Port number
 * @returns Constructed URL string
 */
function buildUrl(protocol: string, hostname: string, port: number): string {
  return `${protocol}//${hostname}:${port}`;
}

/**
 * Create a successful validation result.
 * @param url - Connected URL
 * @param port - Connected port
 * @returns Success ValidationResult
 */
function createSuccessResult(url: string, port: number): ValidationResult {
  return { success: true, url, port };
}

/**
 * Create a failure validation result with suggestions.
 * @param hostname - Attempted hostname
 * @param suggestions - Additional suggestions from port tests
 * @returns Failure ValidationResult
 */
function createFailureResult(hostname: string, suggestions: string[]): ValidationResult {
  return {
    success: false,
    error: `No Arbiter server found at ${hostname}`,
    suggestions: [
      `Tried ports: ${COMMON_PORTS.join(", ")}`,
      'Start the API stack via "bun run dev:full" (see the repo README) or use your deployed server URL.',
      'If you rely on Docker, run "docker compose up api" from the repo root or follow docs/deploy instructions.',
      "Make sure --api-url or config.apiUrl matches the server that is actually running.",
      ...suggestions,
    ],
  };
}

/**
 * Classify a network error into a test result.
 * @param error - Error that occurred
 * @returns TestResult with appropriate status
 */
function classifyError(error: unknown): TestResult {
  if (!(error instanceof Error)) {
    return { success: false, partialSuccess: false, error: "Network error" };
  }
  if (error.name === "AbortError") {
    return { success: false, partialSuccess: true, error: "Connection timeout" };
  }
  if (error.message.includes("ECONNREFUSED")) {
    return { success: false, partialSuccess: false, error: "Connection refused" };
  }
  return { success: false, partialSuccess: false, error: "Network error" };
}

/**
 * Classify a network error for a specific port test.
 * @param error - Error that occurred
 * @param responseTime - Time elapsed before error
 * @param port - Port being tested
 * @returns NetworkTest with status information
 */
function classifyNetworkError(error: unknown, responseTime: number, port: number): NetworkTest {
  if (!(error instanceof Error)) {
    return { port, status: "error", responseTime, error: "Unknown error" };
  }
  if (error.name === "AbortError") {
    return { port, status: "timeout", responseTime };
  }
  if (error.message.includes("ECONNREFUSED")) {
    return { port, status: "refused", responseTime };
  }
  return { port, status: "error", responseTime, error: error.message };
}

/**
 * Fetch a URL with a timeout.
 * @param url - URL to fetch
 * @param timeout - Timeout in milliseconds
 * @returns Promise resolving to Response
 */
async function fetchWithTimeout(url: string, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { signal: controller.signal, method: "GET" });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Check if a response is a valid Arbiter server response.
 * @param data - Response data to check
 * @returns True if response has Arbiter server structure
 */
function isValidArbiterResponse(data: unknown): boolean {
  return (
    !!data &&
    typeof data === "object" &&
    "status" in data &&
    typeof (data as { timestamp?: unknown }).timestamp === "string"
  );
}

/**
 * Validator for Arbiter API server connections.
 */
export class ConnectionValidator {
  /**
   * Create a new ConnectionValidator.
   * @param config - CLI configuration with API URL
   */
  constructor(private config: CLIConfig) {}

  /**
   * Validate connection to the configured API server.
   * @returns Promise resolving to ValidationResult
   */
  async validateConnection(): Promise<ValidationResult> {
    const { hostname, protocol, port: configuredPort } = parseUrlParts(this.config.apiUrl);
    const configuredUrl = buildUrl(protocol, hostname, configuredPort);

    const configuredResult = await this.testConnection(configuredUrl);
    if (configuredResult.success) {
      return createSuccessResult(configuredUrl, configuredPort);
    }

    const suggestions: string[] = [];
    for (const port of COMMON_PORTS) {
      const testUrl = buildUrl(protocol, hostname, port);
      const result = await this.testConnection(testUrl);

      if (result.success) return createSuccessResult(testUrl, port);
      if (result.partialSuccess) suggestions.push(`Port ${port}: ${result.error}`);
    }

    return createFailureResult(hostname, suggestions);
  }

  /**
   * Test connection to a specific URL.
   * @param url - URL to test
   * @returns Promise resolving to TestResult
   */
  private async testConnection(url: string): Promise<TestResult> {
    try {
      const response = await fetchWithTimeout(`${url}/health`, 3000);
      if (!response.ok) {
        return {
          success: false,
          partialSuccess: true,
          error: `Server responded with ${response.status}`,
        };
      }
      const data = await response.json();
      return isValidArbiterResponse(data)
        ? { success: true, partialSuccess: true }
        : { success: false, partialSuccess: true, error: "Not an Arbiter server" };
    } catch (error) {
      return classifyError(error);
    }
  }

  /**
   * Get diagnostic information about connection attempts.
   * @returns Promise resolving to diagnostic data
   */
  async getDiagnostics(): Promise<{
    configuredUrl: string;
    commonPorts: readonly number[];
    networkTests: NetworkTest[];
  }> {
    const { hostname, protocol } = parseUrlParts(this.config.apiUrl);

    const networkTests = await Promise.all(
      COMMON_PORTS.map((port) => this.testPort(protocol, hostname, port)),
    );

    return { configuredUrl: this.config.apiUrl, commonPorts: COMMON_PORTS, networkTests };
  }

  /**
   * Test a specific port for connectivity.
   * @param protocol - URL protocol
   * @param hostname - Server hostname
   * @param port - Port to test
   * @returns Promise resolving to NetworkTest result
   */
  private async testPort(protocol: string, hostname: string, port: number): Promise<NetworkTest> {
    const startTime = Date.now();
    const testUrl = buildUrl(protocol, hostname, port);

    try {
      const response = await fetchWithTimeout(`${testUrl}/health`, 2000);
      const responseTime = Date.now() - startTime;
      return {
        port,
        status: response.ok ? "success" : "error",
        responseTime,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (error) {
      return classifyNetworkError(error, Date.now() - startTime, port);
    }
  }
}
