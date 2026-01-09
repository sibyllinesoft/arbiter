/**
 * Tunnel Manager API Routes
 * Modern approach using named tunnels with DNS routes
 */

import type { Context } from "hono";
import { Hono } from "hono";
import { type TunnelConfig, tunnelManager } from "../../io/tunnel-manager";

/** Format error message from unknown error type */
function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Create a success JSON response */
function successResponse<T extends Record<string, unknown>>(c: Context, data: T) {
  return c.json({ success: true, ...data });
}

/** Create an error JSON response */
function errorResponse(c: Context, error: unknown) {
  return c.json({ success: false, error: formatError(error) }, 500);
}

/** Handle GET /status endpoint */
async function handleGetStatus(c: Context) {
  const savedInfo = await tunnelManager.loadState();
  return successResponse(c, { tunnel: savedInfo ?? null });
}

/** Handle GET /preflight endpoint */
async function handlePreflight(c: Context) {
  const result = await tunnelManager.preflight();
  return c.json({
    success: result.success,
    error: result.error,
    zones: result.zones,
  });
}

/** Configure tunnel logging and return log collector */
function configureTunnelLogging(): string[] {
  tunnelManager.removeAllListeners("log");
  tunnelManager.removeAllListeners("error");

  const logs: string[] = [];
  tunnelManager.on("log", (message) => {
    console.log(`[TunnelManager] ${message}`);
    logs.push(message);
  });

  tunnelManager.on("error", (error) => {
    console.error(`[TunnelManager Error] ${error}`);
    logs.push(`ERROR: ${error}`);
  });

  return logs;
}

/** Handle POST /setup endpoint */
async function handleSetup(c: Context) {
  const body = await c.req.json();
  const config: TunnelConfig = {
    zone: body.zone,
    subdomain: body.subdomain,
    localPort: body.localPort || 5050,
  };

  const logs = configureTunnelLogging();
  const info = await tunnelManager.setup(config);

  return successResponse(c, { tunnel: info, logs });
}

/** Handle POST /stop endpoint */
async function handleStop(c: Context) {
  await tunnelManager.stop();
  return successResponse(c, { message: "Tunnel stopped" });
}

/** Handle POST /teardown endpoint */
async function handleTeardown(c: Context) {
  await tunnelManager.teardown();
  return successResponse(c, { message: "Tunnel and all resources removed" });
}

/** Handle GET /logs endpoint */
function handleGetLogs(c: Context) {
  const logs = tunnelManager.getLogs();
  return successResponse(c, { logs, count: logs.length });
}

export const tunnelRoutes = new Hono();

tunnelRoutes.get("/status", async (c) => {
  try {
    return await handleGetStatus(c);
  } catch (error) {
    return errorResponse(c, error);
  }
});

tunnelRoutes.get("/preflight", async (c) => {
  try {
    return await handlePreflight(c);
  } catch (error) {
    return errorResponse(c, error);
  }
});

tunnelRoutes.post("/setup", async (c) => {
  try {
    return await handleSetup(c);
  } catch (error) {
    return errorResponse(c, error);
  }
});

tunnelRoutes.post("/stop", async (c) => {
  try {
    return await handleStop(c);
  } catch (error) {
    return errorResponse(c, error);
  }
});

tunnelRoutes.post("/teardown", async (c) => {
  try {
    return await handleTeardown(c);
  } catch (error) {
    return errorResponse(c, error);
  }
});

tunnelRoutes.get("/logs", (c) => {
  try {
    return handleGetLogs(c);
  } catch (error) {
    return c.json({ success: false, error: formatError(error), logs: [] }, 500);
  }
});

tunnelRoutes.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});
