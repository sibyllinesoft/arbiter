/**
 * Integrated Cloudflare Tunnel Service
 * Manages named Cloudflare tunnel lifecycle within the application
 */

import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';
import os from 'os';
import path from 'path';
import fs from 'fs-extra';

export interface TunnelInfo {
  id: string;
  name: string;
  status: string;
  created: string;
}

export interface TunnelStatus {
  status: 'running' | 'stopped' | 'failed';
  url: string | null;
  output: string;
  error: string | null;
  pid?: number;
  startTime?: number;
  tunnelId?: string;
  tunnelName?: string;
}

export interface TunnelConfig {
  mode: 'webhook-only' | 'full-api' | 'custom';
  port: number;
  tunnelName?: string;
  domain?: string;
  customConfig?: string;
}

class CloudflareTunnelService extends EventEmitter {
  private tunnelProcess: ChildProcess | null = null;
  private status: TunnelStatus = {
    status: 'stopped',
    url: null,
    output: '',
    error: null,
  };
  private logBuffer: string[] = [];
  private config: TunnelConfig | null = null;
  private configDir: string;
  private credentialsDir: string;

  private readonly defaultTunnelName = 'arbiter-dev';
  private readonly defaultDomain = 'your-domain.com';

  constructor() {
    super();

    // Set up cloudflared configuration directory
    this.configDir = path.join(os.homedir(), '.cloudflared');
    this.credentialsDir = path.join(this.configDir, 'credentials');

    // Ensure directories exist
    this.ensureDirectories();

    // Handle process cleanup on exit
    process.on('SIGINT', () => this.cleanup());
    process.on('SIGTERM', () => this.cleanup());
    process.on('exit', () => this.cleanup());
  }

  /**
   * Get current tunnel status
   */
  getStatus(): TunnelStatus {
    return { ...this.status };
  }

  /**
   * Get tunnel logs
   */
  getLogs(): string {
    return this.logBuffer.join('\n');
  }

  /**
   * Start tunnel with configuration
   */
  async startTunnel(config: TunnelConfig): Promise<TunnelStatus> {
    if (this.tunnelProcess) {
      throw new Error('Tunnel is already running');
    }

    this.config = config;
    this.logBuffer = [];

    try {
      await this.spawnTunnelProcess();
      await this.waitForConnection();
      return this.getStatus();
    } catch (error) {
      await this.handleStartError(error);
      throw error;
    }
  }

  /**
   * Stop the tunnel
   */
  async stopTunnel(): Promise<TunnelStatus> {
    if (!this.tunnelProcess) {
      this.status.status = 'stopped';
      return this.getStatus();
    }

    return new Promise(resolve => {
      const cleanup = () => {
        this.tunnelProcess = null;
        this.status = {
          status: 'stopped',
          url: null,
          output: this.status.output,
          error: null,
        };
        this.emit('stopped');
        resolve(this.getStatus());
      };

      this.tunnelProcess!.on('exit', cleanup);

      // Graceful shutdown
      this.tunnelProcess!.kill('SIGTERM');

      // Force kill after 5 seconds
      setTimeout(() => {
        if (this.tunnelProcess) {
          this.tunnelProcess.kill('SIGKILL');
        }
      }, 5000);
    });
  }

  /**
   * Restart tunnel with same configuration
   */
  async restartTunnel(): Promise<TunnelStatus> {
    if (!this.config) {
      throw new Error('No configuration available for restart');
    }

    await this.stopTunnel();
    return this.startTunnel(this.config);
  }

  /**
   * Check if tunnel is healthy
   */
  isHealthy(): boolean {
    return this.status.status === 'running' && this.status.url !== null;
  }

  /**
   * List all available tunnels
   */
  async listTunnels(): Promise<TunnelInfo[]> {
    return new Promise((resolve, reject) => {
      const process = spawn('cloudflared', ['tunnel', 'list'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let output = '';
      let error = '';

      process.stdout?.on('data', data => {
        output += data.toString();
      });

      process.stderr?.on('data', data => {
        error += data.toString();
      });

      process.on('exit', code => {
        if (code === 0) {
          const tunnels = this.parseTunnelList(output);
          resolve(tunnels);
        } else {
          reject(new Error(`Failed to list tunnels: ${error}`));
        }
      });

      process.on('error', err => {
        reject(new Error(`Failed to execute cloudflared: ${err.message}`));
      });
    });
  }

  /**
   * Create a new named tunnel
   */
  async createTunnel(name: string = this.defaultTunnelName): Promise<string> {
    return new Promise((resolve, reject) => {
      this.log(`Creating new tunnel: ${name}`);

      const process = spawn('cloudflared', ['tunnel', 'create', name], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let output = '';
      let error = '';

      process.stdout?.on('data', data => {
        output += data.toString();
      });

      process.stderr?.on('data', data => {
        error += data.toString();
      });

      process.on('exit', code => {
        if (code === 0) {
          // Extract tunnel UUID from output
          const uuidMatch = output.match(
            /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/
          );
          if (uuidMatch) {
            const tunnelId = uuidMatch[1];
            this.log(`Created tunnel: ${name} (UUID: ${tunnelId})`);
            resolve(tunnelId);
          } else {
            reject(new Error('Could not extract tunnel UUID from output'));
          }
        } else {
          reject(new Error(`Failed to create tunnel: ${error}`));
        }
      });

      process.on('error', err => {
        reject(new Error(`Failed to execute cloudflared: ${err.message}`));
      });
    });
  }

  /**
   * Delete a tunnel by name or ID
   */
  async deleteTunnel(nameOrId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.log(`Deleting tunnel: ${nameOrId}`);

      const process = spawn('cloudflared', ['tunnel', 'delete', nameOrId], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let error = '';

      process.stderr?.on('data', data => {
        error += data.toString();
      });

      process.on('exit', code => {
        if (code === 0) {
          this.log(`Deleted tunnel: ${nameOrId}`);
          resolve();
        } else {
          reject(new Error(`Failed to delete tunnel: ${error}`));
        }
      });

      process.on('error', err => {
        reject(new Error(`Failed to execute cloudflared: ${err.message}`));
      });
    });
  }

  /**
   * Get or create a tunnel for the given name
   */
  async ensureTunnel(name: string = this.defaultTunnelName): Promise<string> {
    try {
      const tunnels = await this.listTunnels();
      const existingTunnel = tunnels.find(t => t.name === name);

      if (existingTunnel) {
        this.log(`Using existing tunnel: ${name} (${existingTunnel.id})`);
        return existingTunnel.id;
      } else {
        this.log(`Creating new tunnel: ${name}`);
        return await this.createTunnel(name);
      }
    } catch (error) {
      throw new Error(
        `Failed to ensure tunnel: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async spawnTunnelProcess(): Promise<void> {
    // Ensure we have a tunnel and configuration
    const tunnelName = this.config!.tunnelName || this.defaultTunnelName;
    const tunnelId = await this.ensureTunnel(tunnelName);

    // Generate configuration file
    await this.generateTunnelConfig(tunnelId, tunnelName);

    const args = this.buildTunnelArgs(tunnelId);

    this.log(`Starting cloudflared with args: ${args.join(' ')}`);

    this.tunnelProcess = spawn('cloudflared', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // Disable auto-update for stability
        NO_AUTOUPDATE: '1',
      },
    });

    this.status = {
      status: 'running',
      url: null,
      output: '',
      error: null, // Clear any previous errors when starting successfully
      pid: this.tunnelProcess.pid,
      startTime: Date.now(),
      tunnelId,
      tunnelName,
    };

    this.setupProcessHandlers();
  }

  private buildTunnelArgs(tunnelId: string): string[] {
    const configFile = path.join(this.configDir, 'config.yml');

    // Use named tunnel with configuration file
    return ['tunnel', '--config', configFile, '--no-autoupdate', 'run', tunnelId];
  }

  /**
   * Generate tunnel configuration file based on mode
   */
  private async generateTunnelConfig(tunnelId: string, tunnelName: string): Promise<void> {
    const configFile = path.join(this.configDir, 'config.yml');
    const credentialsFile = path.join(this.configDir, `${tunnelId}.json`);

    this.log(`Generating tunnel configuration for mode: ${this.config!.mode}`);

    let configContent = '';

    switch (this.config!.mode) {
      case 'webhook-only':
        configContent = this.generateWebhookOnlyConfig(tunnelId, credentialsFile);
        break;
      case 'full-api':
        configContent = this.generateFullApiConfig(tunnelId, credentialsFile);
        break;
      case 'custom':
        configContent = this.generateCustomConfig(tunnelId, credentialsFile);
        break;
      default:
        throw new Error(`Unknown tunnel mode: ${this.config!.mode}`);
    }

    await fs.writeFile(configFile, configContent, 'utf8');
    this.log(`Configuration created at: ${configFile}`);
  }

  private generateWebhookOnlyConfig(tunnelId: string, credentialsFile: string): string {
    const domain = this.config!.domain || this.defaultDomain;
    const tunnelName = this.config!.tunnelName || this.defaultTunnelName;

    this.log('Creating webhook-only configuration (secure mode)');

    return `tunnel: ${tunnelId}
credentials-file: ${credentialsFile}

# Webhook-only secure configuration
# Only webhook endpoints exposed with filtering proxy
ingress:
  - hostname: ${tunnelName}.${domain}
    service: http://localhost:8080  # Proxy port with filtering
  - service: http_status:404
`;
  }

  private generateFullApiConfig(tunnelId: string, credentialsFile: string): string {
    const domain = this.config!.domain || this.defaultDomain;
    const tunnelName = this.config!.tunnelName || this.defaultTunnelName;

    this.log('Creating full API configuration - ALL endpoints will be exposed!');
    this.log('Use webhook-only mode for production environments');

    return `tunnel: ${tunnelId}
credentials-file: ${credentialsFile}

ingress:
  - hostname: ${tunnelName}.${domain}
    service: http://localhost:${this.config!.port}
  - service: http_status:404
`;
  }

  private generateCustomConfig(tunnelId: string, credentialsFile: string): string {
    const domain = this.config!.domain || this.defaultDomain;
    const tunnelName = this.config!.tunnelName || this.defaultTunnelName;

    this.log('Creating custom configuration...');

    if (this.config!.customConfig) {
      return this.config!.customConfig;
    }

    return `tunnel: ${tunnelId}
credentials-file: ${credentialsFile}

# Custom configuration - edit as needed
ingress:
  - hostname: ${tunnelName}.${domain}
    service: http://localhost:${this.config!.port}
  - service: http_status:404
`;
  }

  private setupProcessHandlers(): void {
    if (!this.tunnelProcess) return;

    this.tunnelProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      this.status.output += output;
      this.log(`[STDOUT] ${output.trim()}`);

      // Extract tunnel URL
      this.extractTunnelUrl(output);
    });

    this.tunnelProcess.stderr?.on('data', (data: Buffer) => {
      const stderr = data.toString();
      this.log(`[STDERR] ${stderr.trim()}`);

      // Don't treat stderr as errors - cloudflared sends normal info to stderr
      // We'll handle actual errors via process exit codes

      // Check stderr for tunnel URL (cloudflared sometimes outputs there)
      this.extractTunnelUrl(stderr);
    });

    this.tunnelProcess.on('exit', (code: number, signal: string) => {
      this.log(`[PROCESS] Tunnel exited with code ${code} (signal: ${signal})`);
      this.tunnelProcess = null;

      if (code === 0) {
        this.status.status = 'stopped';
      } else {
        this.status.status = 'failed';
        this.status.error = this.status.error || `Process exited with code ${code}`;
      }

      this.emit('exit', { code, signal });
    });

    this.tunnelProcess.on('error', (error: Error) => {
      this.log(`[ERROR] ${error.message}`);
      this.status.status = 'failed';
      this.status.error = error.message;
      this.emit('error', error);
    });
  }

  private extractTunnelUrl(output: string): void {
    // For named tunnels, construct URL from configuration once connected
    if (this.status.tunnelId && !this.status.url) {
      // Check if tunnel is connected (look for connection messages)
      if (
        output.includes('Registered tunnel connection') ||
        output.includes('Connection registered')
      ) {
        const domain = this.config?.domain || this.defaultDomain;
        const tunnelName = this.config?.tunnelName || this.defaultTunnelName;
        this.status.url = `https://${tunnelName}.${domain}`;
        this.log(`Tunnel URL: ${this.status.url}`);
        this.emit('url', this.status.url);
        return;
      }
    }

    // Only look for URLs if we don't have a tunnel ID (quick tunnel mode)
    if (!this.status.tunnelId) {
      // Look for trycloudflare.com URLs specifically
      const urlMatch = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
      if (urlMatch && !this.status.url) {
        this.status.url = urlMatch[0];
        this.log(`Tunnel URL detected: ${this.status.url}`);
        this.emit('url', this.status.url);
      }
    }
  }

  private async waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for tunnel connection'));
      }, 30000);

      const checkConnection = () => {
        if (this.status.url) {
          clearTimeout(timeout);
          this.log('Tunnel connected successfully');
          resolve();
        } else if (this.status.status === 'failed') {
          clearTimeout(timeout);
          reject(new Error(this.status.error || 'Tunnel failed to start'));
        } else {
          // Check again in 1 second
          setTimeout(checkConnection, 1000);
        }
      };

      checkConnection();
    });
  }

  private async handleStartError(error: any): Promise<void> {
    this.status = {
      status: 'failed',
      url: null,
      output: this.status.output,
      error: error instanceof Error ? error.message : 'Unknown error',
    };

    if (this.tunnelProcess) {
      this.tunnelProcess.kill('SIGKILL');
      this.tunnelProcess = null;
    }

    this.emit('error', error);
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;

    this.logBuffer.push(logMessage);

    // Keep only last 1000 log entries
    if (this.logBuffer.length > 1000) {
      this.logBuffer = this.logBuffer.slice(-1000);
    }

    // Emit log event for real-time monitoring
    this.emit('log', logMessage);

    // Also log to console for debugging
    console.log(`[TunnelService] ${message}`);
  }

  private cleanup(): void {
    if (this.tunnelProcess) {
      this.log('Cleaning up tunnel process');
      this.tunnelProcess.kill('SIGKILL');
      this.tunnelProcess = null;
    }
  }

  /**
   * Ensure configuration directories exist
   */
  private async ensureDirectories(): Promise<void> {
    try {
      await fs.ensureDir(this.configDir);
      await fs.ensureDir(this.credentialsDir);
    } catch (error) {
      this.log(
        `Warning: Could not create directories: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Parse tunnel list output into structured data
   */
  private parseTunnelList(output: string): TunnelInfo[] {
    const lines = output.split('\n');
    const tunnels: TunnelInfo[] = [];

    for (const line of lines) {
      // Parse cloudflared tunnel list output format
      // Expected format: ID NAME CREATED CONNECTIONS
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 3 && parts[0].match(/^[a-f0-9-]{36}$/)) {
        tunnels.push({
          id: parts[0],
          name: parts[1],
          created: parts[2] || 'unknown',
          status: parts[3] || 'inactive',
        });
      }
    }

    return tunnels;
  }

  /**
   * Get tunnel URL from configuration
   */
  getTunnelUrl(): string | null {
    if (this.status.url) {
      return this.status.url;
    }

    if (this.status.tunnelId && this.config) {
      const domain = this.config.domain || this.defaultDomain;
      const tunnelName = this.config.tunnelName || this.defaultTunnelName;
      return `https://${tunnelName}.${domain}`;
    }

    return null;
  }
}

// Export singleton instance
export const tunnelService = new CloudflareTunnelService();
