/**
 * Tunnel Manager API Routes
 * Modern approach using named tunnels with DNS routes
 */

import { Hono } from "hono";
import { TunnelConfig, tunnelManager } from "../tunnel-manager";

export const tunnelRoutes = new Hono();

// Get tunnel status
tunnelRoutes.get("/status", async (c) => {
  try {
    // Try to load saved state first
    const savedInfo = await tunnelManager.loadState();

    if (savedInfo) {
      return c.json({
        success: true,
        tunnel: savedInfo,
      });
    }

    return c.json({
      success: true,
      tunnel: null,
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

// Preflight check
tunnelRoutes.get("/preflight", async (c) => {
  try {
    const result = await tunnelManager.preflight();
    return c.json({
      success: result.success,
      error: result.error,
      zones: result.zones,
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

// Setup tunnel
tunnelRoutes.post("/setup", async (c) => {
  try {
    const body = await c.req.json();
    const config: TunnelConfig = {
      zone: body.zone,
      subdomain: body.subdomain,
      localPort: body.localPort || 5050,
    };

    // Setup event listeners for logging
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

    const info = await tunnelManager.setup(config);

    return c.json({
      success: true,
      tunnel: info,
      logs,
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

// Stop tunnel
tunnelRoutes.post("/stop", async (c) => {
  try {
    await tunnelManager.stop();
    return c.json({
      success: true,
      message: "Tunnel stopped",
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

// Teardown tunnel (complete removal)
tunnelRoutes.post("/teardown", async (c) => {
  try {
    await tunnelManager.teardown();
    return c.json({
      success: true,
      message: "Tunnel and all resources removed",
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

// Get logs (for debugging)
tunnelRoutes.get("/logs", (c) => {
  try {
    const logs = tunnelManager.getLogs();
    return c.json({
      success: true,
      logs,
      count: logs.length,
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        logs: [],
      },
      500,
    );
  }
});

// Health check endpoint (for the tunnel to call)
tunnelRoutes.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});
