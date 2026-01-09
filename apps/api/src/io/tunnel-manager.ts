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

  /** Machine ID file paths for Linux */
  private static readonly MACHINE_ID_PATHS = [
    "/etc/machine-id",
    "/var/lib/dbus/machine-id",
  ] as const;

  /** Read machine ID from filesystem */
  private readMachineId(): string {
    for (const idPath of TunnelManager.MACHINE_ID_PATHS) {
      if (fs.existsSync(idPath)) {
        return fs.readFileSync(idPath, "utf8").trim();
      }
    }
    return os.hostname();
  }

  /** Generate deterministic APP_UID from machine ID + username */
  private generateAppUid(): string {
    const username = os.userInfo().username;
    const machineId = this.readMachineId();

    const hash = crypto
      .createHash("sha256")
      .update(`${machineId}-${username}`)
      .digest("hex")
      .substring(0, 8);

    return `arbiter-${hash}`;
  }

  /** Error messages for preflight checks */
  private static readonly PREFLIGHT_ERRORS = {
    notInstalled:
      "cloudflared not installed. Please install from: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/",
    notAuthenticated: "Not authenticated. Please run: cloudflared tunnel login",
  } as const;

  /** Cloudflared command configuration */
  private static readonly CLOUDFLARED_COMMANDS = {
    version: { cmd: "cloudflared version", stdio: "ignore" as const },
    tunnelList: { cmd: "cloudflared tunnel list --output json", encoding: "utf8" as const },
  } as const;

  /** Execute cloudflared command and return success status */
  private execCloudflared(command: keyof typeof TunnelManager.CLOUDFLARED_COMMANDS): boolean {
    const config = TunnelManager.CLOUDFLARED_COMMANDS[command];
    try {
      execSync(config.cmd, config);
      return true;
    } catch {
      return false;
    }
  }

  /** Check if cloudflared is installed */
  private isCloudflaredInstalled(): boolean {
    return this.execCloudflared("version");
  }

  /** Check if cloudflared is authenticated */
  private isCloudflaredAuthenticated(): boolean {
    return this.execCloudflared("tunnelList");
  }

  /** Preflight checks: verify cloudflared is installed and authenticated */
  async preflight(): Promise<{ success: boolean; error?: string; zones?: string[] }> {
    if (!this.isCloudflaredInstalled()) {
      return { success: false, error: TunnelManager.PREFLIGHT_ERRORS.notInstalled };
    }

    if (!this.isCloudflaredAuthenticated()) {
      return { success: false, error: TunnelManager.PREFLIGHT_ERRORS.notAuthenticated };
    }

    return { success: true };
  }

  /** UUID pattern for extracting tunnel IDs */
  private static readonly UUID_PATTERN =
    /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/;

  /** Find existing tunnel by name */
  private findExistingTunnel(): CloudflaredTunnel | null {
    try {
      const listOutput = execSync("cloudflared tunnel list --output json", { encoding: "utf8" });
      const tunnels: CloudflaredTunnel[] = JSON.parse(listOutput);
      const existing = tunnels.find((t) => t.name === this.appUid);
      if (existing) {
        this.logWithTimestamp(`Using existing tunnel: ${this.appUid} (${existing.id})`);
        return existing;
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logWithTimestamp(`Error listing tunnels: ${errMsg}`);
    }
    return null;
  }

  /** Create a new tunnel */
  private createNewTunnel(): CloudflaredTunnel {
    this.logWithTimestamp(`Creating new tunnel: ${this.appUid}`);
    try {
      const createOutput = execSync(`cloudflared tunnel create ${this.appUid}`, {
        encoding: "utf8",
      });
      const idMatch = createOutput.match(TunnelManager.UUID_PATTERN);
      if (!idMatch) {
        throw new Error("Could not extract tunnel ID from create output");
      }
      return { id: idMatch[1], name: this.appUid, created_at: new Date().toISOString() };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logWithTimestamp(`Failed to create tunnel: ${errMsg}`, true);
      throw new Error(`Failed to create tunnel: ${errMsg}`);
    }
  }

  /**
   * Ensure tunnel exists (create if needed)
   */
  private async ensureTunnel(): Promise<CloudflaredTunnel> {
    return this.findExistingTunnel() ?? this.createNewTunnel();
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
   * Connection success patterns for cloudflared output
   */
  private static readonly CONNECTION_PATTERNS = [
    "Registered tunnel connection",
    "Connection registered",
    "Tunnel connected",
    "INF Registered tunnel",
    "Starting tunnel",
    "Proxying to",
  ];

  /**
   * Check if output indicates successful connection
   */
  private isConnectionSuccess(output: string): boolean {
    return TunnelManager.CONNECTION_PATTERNS.some((pattern) => output.includes(pattern));
  }

  /**
   * Log message with timestamp
   */
  private logWithTimestamp(message: string, isError = false): void {
    const timestamp = new Date().toISOString();
    const formattedMessage = isError ? `ERROR: ${message}` : message;
    this.logs.push(`[${timestamp}] ${formattedMessage}`);
    this.emit(isError ? "error" : "log", message);
  }

  /**
   * Create output handler for tunnel process streams
   */
  private createOutputHandler(
    streamName: string,
    state: { resolved: boolean; outputBuffer: string },
    resolve: () => void,
  ): (data: Buffer) => void {
    return (data: Buffer) => {
      const output = data.toString();
      state.outputBuffer += output;
      this.logWithTimestamp(`[cloudflared ${streamName}] ${output.trim()}`);

      if (!state.resolved && this.isConnectionSuccess(output)) {
        state.resolved = true;
        this.logWithTimestamp("Tunnel connection detected!");
        resolve();
      }

      if (streamName === "stderr" && (output.includes("error") || output.includes("failed"))) {
        this.logWithTimestamp(`Cloudflared error: ${output}`, true);
      }
    };
  }

  /**
   * Start the tunnel process
   */
  private async startTunnelProcess(configPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = ["tunnel", "--config", configPath, "run"];

      this.logWithTimestamp(`Starting cloudflared: cloudflared ${args.join(" ")}`);
      this.logWithTimestamp(`Config path: ${configPath}`);

      this.tunnelProcess = spawn("cloudflared", args, {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, NO_AUTOUPDATE: "1" },
      });

      const state = { resolved: false, outputBuffer: "" };

      this.tunnelProcess.on("error", (error) => {
        this.logWithTimestamp(`Failed to start cloudflared: ${error.message}`, true);
        if (!state.resolved) {
          state.resolved = true;
          reject(error);
        }
      });

      this.tunnelProcess.stdout?.on("data", this.createOutputHandler("stdout", state, resolve));
      this.tunnelProcess.stderr?.on("data", this.createOutputHandler("stderr", state, resolve));

      // Fallback: resolve after short delay if process is running
      setTimeout(() => {
        if (!state.resolved && this.tunnelProcess && !this.tunnelProcess.killed) {
          this.logWithTimestamp("Tunnel process started, assuming connection successful");
          state.resolved = true;
          resolve();
        }
      }, 5000);

      // Timeout for absolute failure
      setTimeout(() => {
        if (!state.resolved) {
          const timeoutMsg = `Timeout waiting for tunnel connection. Buffer: ${state.outputBuffer.substring(0, 500)}`;
          this.logWithTimestamp(timeoutMsg, true);
          this.tunnelProcess?.kill();
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

  /** Generate hostname from config */
  private generateHostname(config: TunnelConfig): string {
    return config.subdomain
      ? `${config.subdomain}-${this.appUid}.${config.zone}`
      : `${this.appUid}.${config.zone}`;
  }

  /** Create error tunnel info */
  private createErrorTunnelInfo(error: unknown): TunnelInfo {
    return {
      tunnelId: "",
      tunnelName: this.appUid,
      hostname: "",
      url: "",
      configPath: "",
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }

  /** Stop existing tunnel if running */
  private async stopExistingTunnel(): Promise<void> {
    if (!this.tunnelProcess) return;
    this.logWithTimestamp("Stopping existing tunnel process");
    await this.stop();
  }

  /** Validate preflight checks */
  private async validatePreflight(): Promise<void> {
    const preflight = await this.preflight();
    if (!preflight.success) {
      const errMsg = preflight.error || "Preflight failed";
      this.logWithTimestamp(errMsg, true);
      throw new Error(errMsg);
    }
  }

  /**
   * Setup tunnel with all components
   */
  async setup(config: TunnelConfig): Promise<TunnelInfo> {
    await this.stopExistingTunnel();
    this.config = config;

    try {
      await this.validatePreflight();
      const tunnel = await this.ensureTunnel();
      const hostname = this.generateHostname(config);

      await this.bindDnsRoute(tunnel.id, hostname);
      const configPath = await this.writeConfig(tunnel.id, hostname, config.localPort);
      await this.startTunnelProcess(configPath);

      const url = `https://${hostname}`;
      this.tunnelInfo = {
        tunnelId: tunnel.id,
        tunnelName: this.appUid,
        hostname,
        url,
        configPath,
        status: "running",
      };

      await this.performHealthCheckWithRetries(url);
      await this.saveState();

      this.emit("ready", this.tunnelInfo);
      return this.tunnelInfo;
    } catch (error) {
      this.tunnelInfo = this.createErrorTunnelInfo(error);
      throw error;
    }
  }

  /**
   * Get current tunnel info
   */
  getInfo(): TunnelInfo | null {
    return this.tunnelInfo;
  }

  /** Wait for process to exit with timeout and force kill */
  private async waitForProcessExit(timeoutMs = 5000): Promise<void> {
    if (!this.tunnelProcess) return;

    this.tunnelProcess.kill("SIGTERM");

    await new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        if (!this.tunnelProcess || this.tunnelProcess.killed) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);

      setTimeout(() => {
        if (this.tunnelProcess && !this.tunnelProcess.killed) {
          this.tunnelProcess.kill("SIGKILL");
        }
        clearInterval(checkInterval);
        resolve();
      }, timeoutMs);
    });

    this.tunnelProcess = null;
  }

  /**
   * Stop the tunnel
   */
  async stop(): Promise<void> {
    await this.waitForProcessExit();

    if (this.tunnelInfo) {
      this.tunnelInfo.status = "stopped";
      await this.saveState();
    }

    this.emit("stopped");
    this.logWithTimestamp("Tunnel stopped");
  }

  /**
   * Perform health check with retries.
   * @param url - The URL to health check
   * @param maxRetries - Maximum number of retries (default 10)
   * @param delayMs - Delay between retries in ms (default 2000)
   */
  private async performHealthCheckWithRetries(
    url: string,
    maxRetries = 10,
    delayMs = 2000,
  ): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      if (await this.healthCheck(url)) {
        return;
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }

    this.emit("log", "Warning: Health check failed, but tunnel may still be working");
    this.logs.push(
      `[${new Date().toISOString()}] Warning: Health check failed, but tunnel may still be working`,
    );
  }

  /**
   * Teardown - remove tunnel and DNS routes
   */
  async teardown(): Promise<void> {
    await this.stop();

    if (this.tunnelInfo) {
      await this.cleanupTunnelResources();
    }

    this.tunnelInfo = null;
    this.config = null;

    this.emit("teardown-complete");
    this.logs.push(`[${new Date().toISOString()}] Teardown complete`);
  }

  /**
   * Clean up tunnel resources during teardown.
   * Deletes the tunnel, config file, and saved state.
   */
  private async cleanupTunnelResources(): Promise<void> {
    try {
      execSync(`cloudflared tunnel delete ${this.appUid}`, { stdio: "pipe" });
      this.emit("log", `Deleted tunnel: ${this.appUid}`);
      this.logs.push(`[${new Date().toISOString()}] Deleted tunnel: ${this.appUid}`);

      this.removeFileIfExists(this.tunnelInfo?.configPath);
      this.removeFileIfExists(path.join(this.configDir, `${this.appUid}.json`));
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.emit("log", `Warning during teardown: ${errMsg}`);
      this.logs.push(`[${new Date().toISOString()}] Warning during teardown: ${errMsg}`);
    }
  }

  /**
   * Remove a file if it exists.
   * @param filePath - Path to the file to remove
   */
  private removeFileIfExists(filePath: string | undefined): void {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
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

      if (this.tunnelInfo) {
        this.tunnelInfo.status = this.checkTunnelRunningStatus();
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
   * Check if the tunnel process is currently running.
   * @returns The tunnel status - "running" or "stopped"
   */
  private checkTunnelRunningStatus(): "running" | "stopped" {
    try {
      const psOutput = execSync("ps aux | grep cloudflared | grep -v grep", {
        encoding: "utf8",
      });
      return psOutput.includes(this.appUid) ? "running" : "stopped";
    } catch {
      return "stopped";
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
