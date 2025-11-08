/**
 * Modern Cloudflare Tunnel Manager
 *
 * Implements deterministic tunnel management with:
 * - Named tunnels with stable URLs
 * - DNS route management
 * - Idempotent operations
 * - Clean teardown
 */

import { ChildProcess, execSync, spawn } from "child_process";
import * as crypto from "crypto";
import { EventEmitter } from "events";
import * as os from "os";
import * as path from "path";
import * as fs from "fs-extra";
import * as yaml from "js-yaml";

export interface TunnelConfig {
  zone: string; // e.g., "example.com"
  subdomain?: string; // e.g., "hooks" -> hooks.example.com
  localPort: number; // Local port to expose
}

export interface TunnelInfo {
  tunnelId: string;
  tunnelName: string;
  hostname: string;
  url: string;
  configPath: string;
  status: "running" | "stopped" | "error";
  error?: string;
}

export interface CloudflaredTunnel {
  id: string;
  name: string;
  created_at: string;
  deleted_at?: string;
  connections?: Array<{
    id: string;
    is_pending_reconnect: boolean;
  }>;
}

export interface DNSRoute {
  hostname: string;
  tunnel_id: string;
  tunnel_name: string;
}

export class TunnelManager extends EventEmitter {
  private config: TunnelConfig | null = null;
  private tunnelProcess: ChildProcess | null = null;
  private appUid: string;
  private configDir: string;
  private tunnelInfo: TunnelInfo | null = null;
  private logs: string[] = [];
  private readonly maxLogs = 1000;

  constructor() {
    super();

    // Generate deterministic APP_UID based on machine + user
    this.appUid = this.generateAppUid();

    // Setup config directory
    this.configDir = path.join(os.homedir(), ".config", "arbiter", "cloudflared");
    fs.ensureDirSync(this.configDir);

    this.logs = [];

    // Handle cleanup on exit
    process.on("SIGINT", () => this.cleanup());
    process.on("SIGTERM", () => this.cleanup());
  }

  /**
   * Generate deterministic APP_UID from machine ID + username
   */
  private generateAppUid(): string {
    const username = os.userInfo().username;
    let machineId = "";

    try {
      // Try to get machine ID (Linux)
      if (fs.existsSync("/etc/machine-id")) {
        machineId = fs.readFileSync("/etc/machine-id", "utf8").trim();
      } else if (fs.existsSync("/var/lib/dbus/machine-id")) {
        machineId = fs.readFileSync("/var/lib/dbus/machine-id", "utf8").trim();
      } else {
        // Fallback to hostname
        machineId = os.hostname();
      }
    } catch (e) {
      machineId = os.hostname();
    }

    // Create hash of machine + user
    const hash = crypto
      .createHash("sha256")
      .update(`${machineId}-${username}`)
      .digest("hex")
      .substring(0, 8);

    return `arbiter-${hash}`;
  }

  /**
   * Preflight checks: verify cloudflared is installed and authenticated
   */
  async preflight(): Promise<{ success: boolean; error?: string; zones?: string[] }> {
    try {
      // Check cloudflared is installed
      try {
        execSync("cloudflared version", { stdio: "ignore" });
      } catch {
        return {
          success: false,
          error:
            "cloudflared not installed. Please install from: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/",
        };
      }

      // Check authentication by listing tunnels
      try {
        const output = execSync("cloudflared tunnel list --output json", { encoding: "utf8" });
        // If this succeeds, user is authenticated
      } catch (e) {
        return {
          success: false,
          error: "Not authenticated. Please run: cloudflared tunnel login",
        };
      }

      // Try to discover zones (this requires API access which basic tunnel commands don't provide)
      // For now, we'll need the user to specify the zone
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Preflight check failed: ${error}`,
      };
    }
  }

  /**
   * Ensure tunnel exists (create if needed)
   */
  private async ensureTunnel(): Promise<CloudflaredTunnel> {
    // Check if tunnel exists
    try {
      const listOutput = execSync("cloudflared tunnel list --output json", { encoding: "utf8" });
      const tunnels: CloudflaredTunnel[] = JSON.parse(listOutput);

      const existing = tunnels.find((t) => t.name === this.appUid);
      if (existing) {
        this.emit("log", `Using existing tunnel: ${this.appUid} (${existing.id})`);
        this.logs.push(
          `[${new Date().toISOString()}] Using existing tunnel: ${this.appUid} (${existing.id})`,
        );
        return existing;
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.emit("log", `Error listing tunnels: ${errMsg}`);
      this.logs.push(`[${new Date().toISOString()}] Error listing tunnels: ${errMsg}`);
    }

    // Create new tunnel
    this.emit("log", `Creating new tunnel: ${this.appUid}`);
    this.logs.push(`[${new Date().toISOString()}] Creating new tunnel: ${this.appUid}`);
    try {
      const createOutput = execSync(`cloudflared tunnel create ${this.appUid}`, {
        encoding: "utf8",
      });

      // Extract the tunnel ID from the output
      // The output typically contains: "Created tunnel <name> with id <uuid>"
      const idMatch = createOutput.match(
        /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/,
      );

      if (!idMatch) {
        throw new Error("Could not extract tunnel ID from create output");
      }

      return {
        id: idMatch[1],
        name: this.appUid,
        created_at: new Date().toISOString(),
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.emit("error", `Failed to create tunnel: ${errMsg}`);
      this.logs.push(`[${new Date().toISOString()}] ERROR: Failed to create tunnel: ${errMsg}`);
      throw new Error(`Failed to create tunnel: ${errMsg}`);
    }
  }

  /**
   * Bind DNS route to tunnel
   */
  private async bindDnsRoute(tunnelId: string, hostname: string): Promise<void> {
    this.emit("log", `Binding DNS route: ${hostname} -> ${tunnelId}`);
    this.logs.push(`[${new Date().toISOString()}] Binding DNS route: ${hostname} -> ${tunnelId}`);

    try {
      // Use --overwrite-dns to ensure proper CNAME creation
      // Use tunnelId instead of appUid to correctly reference the tunnel
      const output = execSync(
        `cloudflared tunnel route dns --overwrite-dns ${tunnelId} ${hostname}`,
        {
          encoding: "utf8",
          stdio: "pipe",
        },
      );

      this.emit("log", `DNS route created: ${hostname}`);
      this.logs.push(`[${new Date().toISOString()}] DNS route created: ${hostname}`);
    } catch (error) {
      // Route might already exist, which is fine
      const errorStr = error instanceof Error ? error.message : String(error);
      if (errorStr.includes("already exists")) {
        this.emit("log", `DNS route already exists: ${hostname}`);
        this.logs.push(`[${new Date().toISOString()}] DNS route already exists: ${hostname}`);
      } else {
        const errMsg = errorStr;
        this.emit("error", `Failed to create DNS route: ${errMsg}`);
        this.logs.push(
          `[${new Date().toISOString()}] ERROR: Failed to create DNS route: ${errMsg}`,
        );
        throw new Error(`Failed to create DNS route: ${errMsg}`);
      }
    }
  }

  /**
   * Generate and write tunnel configuration
   */
  private async writeConfig(
    tunnelId: string,
    hostname: string,
    localPort: number,
  ): Promise<string> {
    const configPath = path.join(this.configDir, `${this.appUid}.yml`);
    const credentialsPath = path.join(os.homedir(), ".cloudflared", `${tunnelId}.json`);

    const config = {
      tunnel: tunnelId,
      "credentials-file": credentialsPath,
      ingress: [
        {
          hostname: hostname,
          service: `http://127.0.0.1:${localPort}`,
        },
        {
          service: "http_status:404",
        },
      ],
    };

    await fs.writeFile(configPath, yaml.dump(config), "utf8");
    this.emit("log", `Configuration written to: ${configPath}`);
    this.logs.push(`[${new Date().toISOString()}] Configuration written to: ${configPath}`);

    return configPath;
  }

  /**
   * Start the tunnel process
   */
  private async startTunnelProcess(configPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Don't specify tunnel name/id - let config file handle it
      const args = ["tunnel", "--config", configPath, "run"];

      this.emit("log", `Starting cloudflared: cloudflared ${args.join(" ")}`);
      this.logs.push(
        `[${new Date().toISOString()}] Starting cloudflared: cloudflared ${args.join(" ")}`,
      );
      this.emit("log", `Config path: ${configPath}`);
      this.logs.push(`[${new Date().toISOString()}] Config path: ${configPath}`);

      this.tunnelProcess = spawn("cloudflared", args, {
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          NO_AUTOUPDATE: "1",
        },
      });

      let resolved = false;
      let outputBuffer = "";

      this.tunnelProcess.on("error", (error) => {
        this.emit("error", `Failed to start cloudflared: ${error.message}`);
        this.logs.push(
          `[${new Date().toISOString()}] ERROR: Failed to start cloudflared: ${error.message}`,
        );
        if (!resolved) {
          resolved = true;
          reject(error);
        }
      });

      this.tunnelProcess.stdout?.on("data", (data) => {
        const output = data.toString();
        outputBuffer += output;
        this.emit("log", `[cloudflared stdout] ${output.trim()}`);
        this.logs.push(`[${new Date().toISOString()}] [cloudflared stdout] ${output.trim()}`);

        // Check for various successful connection messages
        if (
          !resolved &&
          (output.includes("Registered tunnel connection") ||
            output.includes("Connection registered") ||
            output.includes("Tunnel connected") ||
            output.includes("INF Registered tunnel") ||
            output.includes("Starting tunnel") ||
            output.includes("Proxying to"))
        ) {
          resolved = true;
          this.emit("log", "Tunnel connection detected!");
          this.logs.push(`[${new Date().toISOString()}] Tunnel connection detected!`);
          resolve();
        }
      });

      this.tunnelProcess.stderr?.on("data", (data) => {
        const output = data.toString();
        outputBuffer += output;
        this.emit("log", `[cloudflared stderr] ${output.trim()}`);
        this.logs.push(`[${new Date().toISOString()}] [cloudflared stderr] ${output.trim()}`);

        // cloudflared often sends info to stderr
        if (
          !resolved &&
          (output.includes("Registered tunnel connection") ||
            output.includes("Connection registered") ||
            output.includes("Tunnel connected") ||
            output.includes("INF Registered tunnel") ||
            output.includes("Starting tunnel") ||
            output.includes("Proxying to"))
        ) {
          resolved = true;
          this.emit("log", "Tunnel connection detected!");
          this.logs.push(`[${new Date().toISOString()}] Tunnel connection detected!`);
          resolve();
        }

        // Check for errors
        if (output.includes("error") || output.includes("failed")) {
          this.emit("error", `Cloudflared error: ${output}`);
          this.logs.push(`[${new Date().toISOString()}] ERROR: Cloudflared error: ${output}`);
        }
      });

      // Resolve after a short delay if we see the process is running
      // This is a fallback in case the connection messages have changed
      setTimeout(() => {
        if (!resolved && this.tunnelProcess && !this.tunnelProcess.killed) {
          this.emit("log", "Tunnel process started, assuming connection successful");
          this.logs.push(
            `[${new Date().toISOString()}] Tunnel process started, assuming connection successful`,
          );
          resolved = true;
          resolve();
        }
      }, 5000);

      // Set a longer timeout for absolute failure
      setTimeout(() => {
        if (!resolved) {
          const timeoutMsg = `Timeout waiting for tunnel connection. Buffer: ${outputBuffer.substring(0, 500)}`;
          this.emit("error", timeoutMsg);
          this.logs.push(`[${new Date().toISOString()}] ERROR: ${timeoutMsg}`);
          if (this.tunnelProcess) {
            this.tunnelProcess.kill();
          }
          reject(new Error("Timeout waiting for tunnel connection"));
        }
      }, 30000);
    });
  }

  /**
   * Health check the tunnel
   */
  private async healthCheck(url: string): Promise<boolean> {
    try {
      const response = await fetch(`${url}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Setup tunnel with all components
   */
  async setup(config: TunnelConfig): Promise<TunnelInfo> {
    // Stop any existing tunnel first
    if (this.tunnelProcess) {
      this.emit("log", "Stopping existing tunnel process");
      this.logs.push(`[${new Date().toISOString()}] Stopping existing tunnel process`);
      await this.stop();
    }

    this.config = config;

    try {
      // 1. Preflight checks
      const preflight = await this.preflight();
      if (!preflight.success) {
        const errMsg = preflight.error || "Preflight failed";
        this.emit("error", errMsg);
        this.logs.push(`[${new Date().toISOString()}] ERROR: ${errMsg}`);
        throw new Error(errMsg);
      }

      // 2. Ensure tunnel exists
      const tunnel = await this.ensureTunnel();

      // 3. Generate hostname
      // Use subdomain as a prefix to the app UID if provided
      const hostname = config.subdomain
        ? `${config.subdomain}-${this.appUid}.${config.zone}`
        : `${this.appUid}.${config.zone}`;

      // 4. Bind DNS route
      await this.bindDnsRoute(tunnel.id, hostname);

      // 5. Write configuration
      const configPath = await this.writeConfig(tunnel.id, hostname, config.localPort);

      // 6. Start tunnel process
      await this.startTunnelProcess(configPath);

      // 7. Build tunnel info
      const url = `https://${hostname}`;
      this.tunnelInfo = {
        tunnelId: tunnel.id,
        tunnelName: this.appUid,
        hostname,
        url,
        configPath,
        status: "running",
      };

      // 8. Health check (with retries)
      let healthy = false;
      for (let i = 0; i < 10; i++) {
        if (await this.healthCheck(url)) {
          healthy = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }

      if (!healthy) {
        this.emit("log", "Warning: Health check failed, but tunnel may still be working");
        this.logs.push(
          `[${new Date().toISOString()}] Warning: Health check failed, but tunnel may still be working`,
        );
      }

      // 9. Save state
      await this.saveState();

      this.emit("ready", this.tunnelInfo);
      return this.tunnelInfo;
    } catch (error) {
      this.tunnelInfo = {
        tunnelId: "",
        tunnelName: this.appUid,
        hostname: "",
        url: "",
        configPath: "",
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      };

      throw error;
    }
  }

  /**
   * Get current tunnel info
   */
  getInfo(): TunnelInfo | null {
    return this.tunnelInfo;
  }

  /**
   * Stop the tunnel
   */
  async stop(): Promise<void> {
    if (this.tunnelProcess) {
      // Kill the process and wait for it to exit
      this.tunnelProcess.kill("SIGTERM");

      // Give it time to exit gracefully
      await new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.tunnelProcess || this.tunnelProcess.killed) {
            clearInterval(checkInterval);
            resolve(undefined);
          }
        }, 100);

        // Force kill after 5 seconds if it hasn't exited
        setTimeout(() => {
          if (this.tunnelProcess && !this.tunnelProcess.killed) {
            this.tunnelProcess.kill("SIGKILL");
          }
          clearInterval(checkInterval);
          resolve(undefined);
        }, 5000);
      });

      this.tunnelProcess = null;
    }

    if (this.tunnelInfo) {
      this.tunnelInfo.status = "stopped";
      await this.saveState();
    }

    this.emit("stopped");
    this.logs.push(`[${new Date().toISOString()}] Tunnel stopped`);
  }

  /**
   * Teardown - remove tunnel and DNS routes
   */
  async teardown(): Promise<void> {
    // Stop tunnel first
    await this.stop();

    if (this.tunnelInfo) {
      try {
        // Delete tunnel (this also removes DNS routes)
        execSync(`cloudflared tunnel delete ${this.appUid}`, { stdio: "pipe" });
        this.emit("log", `Deleted tunnel: ${this.appUid}`);
        this.logs.push(`[${new Date().toISOString()}] Deleted tunnel: ${this.appUid}`);

        // Clean up config file
        if (this.tunnelInfo.configPath && fs.existsSync(this.tunnelInfo.configPath)) {
          fs.unlinkSync(this.tunnelInfo.configPath);
        }

        // Clean up saved state
        const stateFile = path.join(this.configDir, `${this.appUid}.json`);
        if (fs.existsSync(stateFile)) {
          fs.unlinkSync(stateFile);
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        this.emit("log", `Warning during teardown: ${errMsg}`);
        this.logs.push(`[${new Date().toISOString()}] Warning during teardown: ${errMsg}`);
      }
    }

    this.tunnelInfo = null;
    this.config = null;

    this.emit("teardown-complete");
    this.logs.push(`[${new Date().toISOString()}] Teardown complete`);
  }

  /**
   * Save tunnel state to disk
   */
  private async saveState(): Promise<void> {
    if (!this.tunnelInfo) return;

    const stateFile = path.join(this.configDir, `${this.appUid}.json`);
    await fs.writeJson(
      stateFile,
      {
        tunnelInfo: this.tunnelInfo,
        config: this.config,
        appUid: this.appUid,
        timestamp: new Date().toISOString(),
      },
      { spaces: 2 },
    );
  }

  /**
   * Load saved state
   */
  async loadState(): Promise<TunnelInfo | null> {
    const stateFile = path.join(this.configDir, `${this.appUid}.json`);

    if (!fs.existsSync(stateFile)) {
      return null;
    }

    try {
      const state = await fs.readJson(stateFile);
      this.tunnelInfo = state.tunnelInfo;
      this.config = state.config;

      // Check if tunnel is actually running
      if (this.tunnelInfo) {
        try {
          const psOutput = execSync("ps aux | grep cloudflared | grep -v grep", {
            encoding: "utf8",
          });

          if (psOutput.includes(this.appUid)) {
            this.tunnelInfo.status = "running";
          } else {
            this.tunnelInfo.status = "stopped";
          }
        } catch {
          this.tunnelInfo.status = "stopped";
        }
      }

      return this.tunnelInfo;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.emit("log", `Failed to load state: ${errMsg}`);
      this.logs.push(`[${new Date().toISOString()}] Failed to load state: ${errMsg}`);
      return null;
    }
  }

  /**
   * Cleanup on exit
   */
  private cleanup(): void {
    if (this.tunnelProcess) {
      this.tunnelProcess.kill("SIGKILL");
      this.tunnelProcess = null;
    }
    this.logs.push(`[${new Date().toISOString()}] Cleanup performed`);
  }

  /**
   * Get recent logs
   */
  getLogs(): string[] {
    return this.logs.slice(-this.maxLogs);
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logs = [];
  }
}

// Export singleton instance
export const tunnelManager = new TunnelManager();
