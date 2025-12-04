import { ApiClient } from "./client";

export type TunnelSetupResponse = {
  success: boolean;
  tunnel?: {
    tunnelId: string;
    tunnelName: string;
    hostname: string;
    url: string;
    configPath: string;
    status: "running" | "stopped";
    hookId?: string;
  };
  logs?: string[];
  error?: string;
};

export class TunnelService {
  constructor(private readonly client: ApiClient) {}

  async getTunnelStatus(): Promise<{
    success: boolean;
    tunnel?: {
      tunnelId: string;
      tunnelName: string;
      hostname: string;
      url: string;
      configPath: string;
      status: "running" | "stopped";
    } | null;
    error?: string;
  }> {
    return this.client.request("/api/tunnel/status");
  }

  async setupTunnel(config: {
    zone: string;
    subdomain?: string;
    localPort?: number;
  }): Promise<TunnelSetupResponse> {
    return this.client.request("/api/tunnel/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
  }

  async startTunnel(): Promise<TunnelSetupResponse> {
    return this.setupTunnel({
      zone: "sibylline.dev",
      localPort: 5050,
    });
  }

  async stopTunnel(): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    return this.client.request("/api/tunnel/stop", {
      method: "POST",
    });
  }

  async teardownTunnel(): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    return this.client.request("/api/tunnel/teardown", {
      method: "POST",
    });
  }

  async getTunnelPreflight(): Promise<{
    success: boolean;
    zones?: string[];
    error?: string;
  }> {
    return this.client.request("/api/tunnel/preflight");
  }

  async getTunnelLogs(): Promise<{
    success: boolean;
    logs?: string;
    error?: string;
  }> {
    return this.client.request("/api/tunnel/logs");
  }
}
