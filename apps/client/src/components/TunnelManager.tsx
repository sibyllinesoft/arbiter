/**
 * Tunnel Manager Component - Manages Cloudflare tunnel lifecycle
 */

import { useWebSocketEvent, useWebSocketInstance } from "@/hooks/useWebSocket";
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  Globe,
  Power,
  PowerOff,
  RefreshCw,
  Terminal,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { Button, Card, Input, StatusBadge, cn } from "../design-system";
import { apiService } from "../services/api";

interface TunnelInfo {
  tunnelId: string;
  tunnelName: string;
  hostname: string;
  url: string;
  configPath: string;
  status: "running" | "stopped";
}

interface TunnelManagerProps {
  className?: string;
  onTunnelUrlChange?: (url: string | null) => void;
}

export function TunnelManager({ className, onTunnelUrlChange }: TunnelManagerProps) {
  const [tunnelInfo, setTunnelInfo] = useState<TunnelInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const client = useWebSocketInstance();

  const isTunnelRunning = tunnelInfo?.status === "running";

  const refreshStatus = useCallback(async () => {
    try {
      const response = await apiService.getTunnelStatus();
      if (response.success) {
        setTunnelInfo(response.tunnel || null);
      }
    } catch (error) {
      console.error("Failed to refresh tunnel status:", error);
    }
  }, []);

  // Poll tunnel status every 5 seconds when running
  useEffect(() => {
    if (!isPolling) {
      return;
    }

    const interval = setInterval(refreshStatus, 5000);
    return () => clearInterval(interval);
  }, [isPolling, refreshStatus]);

  // Start polling when tunnel is running
  useEffect(() => {
    if (isTunnelRunning) {
      setIsPolling(true);
    } else {
      setIsPolling(false);
    }
  }, [isTunnelRunning]);

  // Notify parent component when tunnel URL changes
  useEffect(() => {
    if (onTunnelUrlChange) {
      onTunnelUrlChange(isTunnelRunning ? (tunnelInfo?.url ?? null) : null);
    }
  }, [isTunnelRunning, tunnelInfo?.url, onTunnelUrlChange]);

  const loadInitialStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      await refreshStatus();
    } catch (error) {
      console.error("Failed to load tunnel status:", error);
      toast.error("Failed to load tunnel status");
    } finally {
      setIsLoading(false);
    }
  }, [refreshStatus]);

  // Load initial status
  useEffect(() => {
    loadInitialStatus();
  }, [loadInitialStatus]);

  // Subscribe to real-time tunnel logs via shared WebSocket client
  useEffect(() => {
    if (tunnelInfo?.status === "running") {
      setLogs((prev) => [...prev, "Tunnel log stream connected"]);
      client.send({
        type: "event",
        data: { action: "subscribe", channel: "tunnel-logs" },
      });
      return () => {
        client.send({
          type: "event",
          data: { action: "unsubscribe", channel: "tunnel-logs" },
        });
      };
    }

    // Ensure we unsubscribe when tunnel stops
    client.send({
      type: "event",
      data: { action: "unsubscribe", channel: "tunnel-logs" },
    });
    return undefined;
  }, [client, tunnelInfo?.status]);

  const handleTunnelEvent = useCallback(
    (event: { type: string; payload: unknown }) => {
      if (tunnelInfo?.status !== "running") return;
      const payload = event.payload as Record<string, unknown>;
      const line =
        typeof payload?.log === "string"
          ? payload.log
          : typeof payload === "string"
            ? payload
            : JSON.stringify(payload ?? {});
      setLogs((prev) => [...prev, line]);
    },
    [tunnelInfo?.status],
  );

  useWebSocketEvent(["tunnel_log", "tunnel_error"], handleTunnelEvent);

  // Auto-scroll logs when new log added and visible
  const logsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (showLogs && logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logs, showLogs]);

  const startTunnel = async () => {
    setIsLoading(true);
    try {
      const response = await apiService.setupTunnel({
        zone: "sibylline.dev",
        localPort: 5050,
      });
      if (response.success && response.tunnel) {
        setTunnelInfo(response.tunnel);
        toast.success("Tunnel started successfully");
      } else {
        toast.error(response.error || "Failed to start tunnel");
      }
    } catch (error) {
      toast.error("Failed to start tunnel");
      console.error("Tunnel start error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const stopTunnel = async () => {
    setIsLoading(true);
    try {
      const response = await apiService.stopTunnel();
      if (response.success) {
        setTunnelInfo(null);
        toast.success(response.message || "Tunnel stopped successfully");
        // Refresh status after stopping
        await refreshStatus();
      } else {
        toast.error(response.error || "Failed to stop tunnel");
      }
    } catch (error) {
      toast.error("Failed to stop tunnel");
      console.error("Tunnel stop error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadLogs = async () => {
    try {
      const response = await apiService.getTunnelLogs();
      if (response.success) {
        const rawLogs = Array.isArray(response.logs)
          ? response.logs
          : typeof response.logs === "string"
            ? response.logs.split("\n")
            : [];
        setLogs(rawLogs.filter((line) => line.trim().length > 0));
      } else if (response.error) {
        console.warn("Failed to load tunnel logs:", response.error);
      }
    } catch (error) {
      console.error("Failed to load tunnel logs:", error);
    }
  };

  // Load initial logs whenever the tunnel transitions to running
  useEffect(() => {
    if (isTunnelRunning) {
      loadLogs();
    }
  }, [isTunnelRunning]);

  // Refresh logs when the panel is expanded while the tunnel is running
  useEffect(() => {
    if (showLogs && isTunnelRunning) {
      loadLogs();
    }
  }, [showLogs, isTunnelRunning]);

  const copyTunnelUrl = () => {
    if (tunnelInfo?.url) {
      navigator.clipboard.writeText(tunnelInfo.url);
      toast.success("Tunnel URL copied to clipboard");
    }
  };

  const getStatusIcon = () => {
    if (isLoading) {
      return <RefreshCw className="w-5 h-5 animate-spin text-gray-500 dark:text-graphite-300" />;
    }

    switch (tunnelInfo?.status) {
      case "running":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "stopped":
      default:
        return <Power className="w-5 h-5 text-gray-400" />;
    }
  };

  return (
    <Card className={cn("p-6", className)}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Globe className="w-6 h-6 text-gray-600" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Cloudflare Tunnel
          </h2>
        </div>
        <Button
          variant={isTunnelRunning ? "secondary" : "primary"}
          leftIcon={
            isTunnelRunning ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />
          }
          onClick={isTunnelRunning ? stopTunnel : startTunnel}
          disabled={isLoading}
        >
          {isLoading
            ? isTunnelRunning
              ? "Stopping..."
              : "Starting..."
            : isTunnelRunning
              ? "Stop Tunnel"
              : "Start Tunnel"}
        </Button>
      </div>

      {/* Tunnel Status Section */}
      <div className="border border-gray-200 dark:border-graphite-700 rounded-lg p-4 mb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <div className="flex items-center gap-3 flex-1">
            {getStatusIcon()}
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100">
                {isTunnelRunning ? "Tunnel Active" : "Tunnel Inactive"}
              </h3>
              <p className="text-sm text-gray-500">
                {isTunnelRunning
                  ? "Your tunnel is running and accepting connections"
                  : "Start a tunnel to expose your local Arbiter API"}
              </p>
            </div>
          </div>

          {tunnelInfo?.url && (
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tunnel URL
              </label>
              <div className="flex gap-2">
                <Input value={tunnelInfo.url} readOnly className="flex-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-2"
                  onClick={copyTunnelUrl}
                  aria-label="Copy tunnel URL"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Error Display */}
        {false && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-800">
                <p className="font-medium mb-1">Tunnel Error</p>
                <p className="font-mono text-xs bg-red-100 p-2 rounded">Error placeholder</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Logs Section - Collapsible */}
      <div className="mt-6 border border-gray-200 dark:border-graphite-700 rounded-lg">
        <div
          className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-graphite-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-graphite-800"
          onClick={() => setShowLogs(!showLogs)}
        >
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-gray-600" />
            <h3 className="font-medium text-gray-900 dark:text-gray-100">Tunnel Logs</h3>
          </div>
          <div className="flex items-center gap-2 text-gray-400 dark:text-graphite-300">
            <StatusBadge
              variant="neutral"
              size="xs"
              className="bg-graphite-200 dark:bg-graphite-700 text-graphite-700 dark:text-graphite-100 border-transparent"
            >
              {logs.length}
            </StatusBadge>
            {showLogs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
        {showLogs && (
          <div className="max-h-96 overflow-auto">
            {logs.length > 0 ? (
              <div ref={logsRef} className="max-h-96 overflow-auto">
                <pre className="text-xs font-mono bg-gray-900 text-green-400 rounded-lg whitespace-pre-wrap px-4 py-3">
                  {logs.join("\n")}
                </pre>
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">No logs yet.</p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
