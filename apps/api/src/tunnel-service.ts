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
    // Check if there's an external cloudflared process running
    this.checkExternalTunnel();
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
    // First check if there's an external tunnel running
    this.checkExternalTunnel();

    // If we detect an external tunnel but don't manage it, try to stop it
    if (this.status.status === 'running' && !this.tunnelProcess) {
      try {
        const { execSync } = require('child_process');

        // Try to stop the external cloudflared process
        this.log('Attempting to stop external cloudflared process');
        execSync('pkill cloudflared', { encoding: 'utf8' });

        // Wait a bit for the process to stop
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Update status
        this.status = {
          status: 'stopped',
          url: null,
          output: 'External tunnel stopped',
          error: null,
        };
        this.emit('stopped');
        return this.getStatus();
      } catch (error) {
        // If pkill fails (no process found or permission denied)
        this.log('Failed to stop external tunnel: ' + error);
        this.status.error = 'Failed to stop external tunnel';
        return this.getStatus();
      }
    }

    // Handle internally managed tunnel
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
   * Check for externally managed cloudflared process
   */
  private checkExternalTunnel(): void {
    try {
      const { execSync } = require('child_process');

      // Step 1: Check if cloudflared is running
      const psOutput = execSync('ps aux | grep cloudflared | grep -v grep', {
        encoding: 'utf8',
      });

      if (!psOutput || !psOutput.includes('cloudflared tunnel')) {
        if (!this.tunnelProcess) {
          this.status.status = 'stopped';
          this.status.url = null;
        }
        return;
      }

      // Extract tunnel config file or ID from the process
      // Look for config file first, then tunnel ID
      let tunnelId: string | null = null;
      let configPath: string | null = null;

      const configMatch = psOutput.match(/--config\s+([^\s]+\.yml)/);
      if (configMatch) {
        configPath = configMatch[1];
        // Read the config to get the tunnel ID
        try {
          const configContent = require('fs').readFileSync(configPath, 'utf8');
          const tunnelMatch = configContent.match(
            /tunnel:\s*([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/
          );
          if (tunnelMatch) {
            tunnelId = tunnelMatch[1];
          }

          // Also extract hostname directly from config
          const hostnameMatch = configContent.match(/hostname:\s*([^\s]+)/);
          if (hostnameMatch && !hostnameMatch[1].includes('cfargotunnel.com')) {
            const hostname = hostnameMatch[1];
            this.status.url = hostname.startsWith('http') ? hostname : `https://${hostname}`;
            this.log(`Found tunnel URL from config: ${this.status.url}`);
          }
        } catch (e) {
          this.log('Could not read tunnel config: ' + e);
        }
      }

      // Fallback to extracting tunnel ID from process args
      if (!tunnelId) {
        const tunnelIdMatch = psOutput.match(
          /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/
        );
        if (tunnelIdMatch) {
          tunnelId = tunnelIdMatch[1];
        }
      }

      if (!tunnelId) {
        // Quick tunnel detected (no tunnel ID)
        if (psOutput.includes('--url')) {
          this.status.status = 'running';
          this.status.error = 'Quick tunnel detected. Cannot determine URL from quick tunnels.';
        }
        return;
      }

      // If we detect an external tunnel, update the status
      if (!this.tunnelProcess) {
        this.status.status = 'running';
        this.status.tunnelId = tunnelId;
        this.status.error = null; // Clear any previous errors

        try {
          // Step 2: Get tunnel info using JSON output
          const tunnelInfoJson = execSync(
            `cloudflared tunnel info ${tunnelId} --output json 2>/dev/null`,
            {
              encoding: 'utf8',
            }
          );

          const tunnelInfo = JSON.parse(tunnelInfoJson);
          this.status.tunnelName = tunnelInfo.name || this.status.tunnelName;

          // Step 3: Extract hostnames from ingress configuration
          const hostnames = new Set<string>();

          // Check ingress rules in the tunnel config
          if (tunnelInfo.config?.config?.ingress) {
            for (const rule of tunnelInfo.config.config.ingress) {
              if (rule.hostname && !rule.hostname.includes('cfargotunnel.com')) {
                hostnames.add(rule.hostname);
              }
            }
          }

          // Alternative: check the raw config if available
          if (tunnelInfo.config?.src?.content?.ingress) {
            for (const rule of tunnelInfo.config.src.content.ingress) {
              if (rule.hostname && !rule.hostname.includes('cfargotunnel.com')) {
                hostnames.add(rule.hostname);
              }
            }
          }

          // Step 4: Get DNS routes to find additional hostnames
          try {
            const routesJson = execSync(
              'cloudflared tunnel route dns --list --output json 2>/dev/null',
              {
                encoding: 'utf8',
              }
            );

            const routes = JSON.parse(routesJson);
            for (const route of routes) {
              if (route.tunnel_id === tunnelId && route.hostname) {
                hostnames.add(route.hostname);
              }
            }
          } catch (e) {
            // DNS route listing might fail if not configured
            this.log('Could not list DNS routes: ' + e);
          }

          // Step 5: Set the URL from discovered hostnames (if not already set)
          if (!this.status.url && hostnames.size > 0) {
            // Use the first non-cfargotunnel hostname
            const hostname = Array.from(hostnames)[0];
            this.status.url = hostname.startsWith('http') ? hostname : `https://${hostname}`;
            this.status.error = null;
            this.log(`Found tunnel URL: ${this.status.url}`);
          } else if (!this.status.url) {
            this.log('Warning: Tunnel is running but no hostname configured');
            this.status.error =
              'Tunnel is running but no DNS route configured. Use "cloudflared tunnel route dns" to set up a route.';
          }
        } catch (e) {
          // Only set error if we don't already have a URL
          if (!this.status.url) {
            this.log('Error getting tunnel info: ' + e);
            this.status.error = 'Could not determine tunnel configuration';
          } else {
            // We have the URL from config, so just log the issue
            this.log('Could not get additional tunnel info via CLI: ' + e);
          }
        }
      }
    } catch (error) {
      // If ps command fails, assume no tunnel is running
      if (!this.tunnelProcess) {
        this.status.status = 'stopped';
        this.status.url = null;
      }
    }
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

    // Try to get existing tunnel hostname configuration
    const tunnelInfo = await this.getTunnelInfo(tunnelId);
    if (tunnelInfo?.hostname) {
      this.log(`Found existing tunnel hostname from info: ${tunnelInfo.hostname}`);
      // Update config with actual hostname if found
      const hostnameMatch = tunnelInfo.hostname.match(/^([^.]+)\.(.+)$/);
      if (hostnameMatch) {
        this.config!.domain = hostnameMatch[2];
      }
    }

    // Also try to get configured DNS route
    const dnsRoute = await this.getTunnelRoute(tunnelId);
    if (dnsRoute) {
      this.log(`Found configured DNS route: ${dnsRoute}`);
      // Extract domain from the route
      const routeMatch = dnsRoute.match(/^([^.]+)\.(.+)$/);
      if (routeMatch) {
        this.config!.tunnelName = routeMatch[1];
        this.config!.domain = routeMatch[2];
      }
    }

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
    // Skip if we already have a URL
    if (this.status.url) {
      return;
    }

    // First try to extract the actual hostname from cloudflared output
    // Cloudflared typically outputs something like:
    // "INF | Registered tunnel connection" followed by connection details
    // or "INF | +----------------------------+------------------------------------------------------------+"
    // followed by the hostname in a table format
    // or directly shows the URL being served
    // or "INF Starting tunnel with hostname: arbiter-dev.example.com"

    // Look for hostname announcements in various formats
    const hostnamePatterns = [
      /hostname:\s*([a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+[a-zA-Z]{2,})/i,
      /serving\s+(?:on|at)\s+([a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+[a-zA-Z]{2,})/i,
      /available\s+at\s+([a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+[a-zA-Z]{2,})/i,
      /ingress\s+rule\s+.*?([a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+[a-zA-Z]{2,})/i,
      /dns\s+record\s+.*?([a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+[a-zA-Z]{2,})/i,
      /route\s+(?:to|dns)\s+([a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+[a-zA-Z]{2,})/i,
      /tunnel\s+.*?([a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+[a-zA-Z]{2,})\s+(?:created|configured)/i,
      /\|\s*([a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+[a-zA-Z]{2,})\s*\|/i, // Table format
      /config.*hostname.*?([a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+[a-zA-Z]{2,})/i, // Config output
    ];

    for (const pattern of hostnamePatterns) {
      const match = output.match(pattern);
      if (match && match[1]) {
        // Ensure it's a full URL
        const hostname = match[1].startsWith('http') ? match[1] : `https://${match[1]}`;
        this.status.url = hostname;
        this.log(`Tunnel hostname detected from output: ${this.status.url}`);
        this.emit('url', this.status.url);
        return;
      }
    }

    // Look for any complete HTTPS URL in the output
    const httpsUrlMatch = output.match(/https:\/\/[a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+[a-zA-Z]{2,}/g);
    if (httpsUrlMatch) {
      // Filter out known false positives - only accept actual tunnel URLs
      const validUrl = httpsUrlMatch.find(
        url =>
          !url.includes('github.com') &&
          !url.includes('cloudflare.com/docs') &&
          !url.includes('quic-go') &&
          !url.includes('wiki') &&
          // Only accept trycloudflare URLs or URLs that cloudflared specifically outputs
          (url.includes('.trycloudflare.com') ||
            output.includes(`Serving at ${url}`) ||
            output.includes(`Available at ${url}`) ||
            output.includes(`Your tunnel is available at: ${url}`))
      );

      if (validUrl) {
        this.status.url = validUrl;
        this.log(`Tunnel URL detected from output: ${this.status.url}`);
        this.emit('url', this.status.url);
        return;
      }
    }

    // For named tunnels, if connected but no URL found, log warning
    if (this.status.tunnelId) {
      // Check if tunnel is connected (look for connection messages)
      if (
        output.includes('Registered tunnel connection') ||
        output.includes('Connection registered') ||
        output.includes('tunnel connected') ||
        output.includes('Serving HTTP traffic')
      ) {
        // Tunnel is connected but we haven't found a URL
        if (!this.status.url) {
          this.log('Warning: Tunnel connected but no URL found in output');
          this.status.error =
            'Tunnel is connected but URL cannot be determined from cloudflared output.';
        }
      }
    }

    // For quick tunnels (no tunnel ID), look for trycloudflare.com URLs
    if (!this.status.tunnelId) {
      const trycloudflareMatch = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
      if (trycloudflareMatch) {
        this.status.url = trycloudflareMatch[0];
        this.log(`Quick tunnel URL detected: ${this.status.url}`);
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
   * Get tunnel URL from status
   */
  getTunnelUrl(): string | null {
    return this.status.url;
  }

  /**
   * Get tunnel info including configured hostname
   */
  async getTunnelInfo(tunnelId: string): Promise<{ hostname?: string } | null> {
    return new Promise((resolve, reject) => {
      const process = spawn('cloudflared', ['tunnel', 'info', tunnelId], {
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
          // Parse output for hostname
          const hostnameMatch = output.match(
            /hostname:\s*([a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+[a-zA-Z]{2,})/i
          );
          if (hostnameMatch && hostnameMatch[1]) {
            resolve({ hostname: hostnameMatch[1] });
          } else {
            resolve(null);
          }
        } else {
          // Don't reject, just return null if info command fails
          this.log(`Could not get tunnel info: ${error}`);
          resolve(null);
        }
      });

      process.on('error', err => {
        this.log(`Could not execute cloudflared info: ${err.message}`);
        resolve(null);
      });
    });
  }

  /**
   * Get configured DNS route for a tunnel
   */
  async getTunnelRoute(tunnelId: string): Promise<string | null> {
    return new Promise(resolve => {
      // Try to list routes for this tunnel
      const process = spawn('cloudflared', ['tunnel', 'route', 'list'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let output = '';

      process.stdout?.on('data', data => {
        output += data.toString();
      });

      process.on('exit', () => {
        // Parse output for routes matching this tunnel ID
        const lines = output.split('\n');
        for (const line of lines) {
          if (line.includes(tunnelId)) {
            // Extract hostname from route (format: HOSTNAME UUID TYPE)
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 1 && parts[0].includes('.')) {
              this.log(`Found configured DNS route: ${parts[0]}`);
              resolve(parts[0]);
              return;
            }
          }
        }
        resolve(null);
      });

      process.on('error', () => {
        resolve(null);
      });
    });
  }
}

// Export singleton instance
export const tunnelService = new CloudflareTunnelService();
