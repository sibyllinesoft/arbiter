/**
 * Tunnel Manager Component - Integrates cloudflare-tunnel.sh functionality
 */

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
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Button, Card, Input, StatusBadge, cn } from '../design-system';
import { apiService } from '../services/api';

interface TunnelInfo {
  tunnelId: string;
  tunnelName: string;
  hostname: string;
  url: string;
  configPath: string;
  status: 'running' | 'stopped';
  hookId?: string;
}

interface TunnelManagerProps {
  className?: string;
  onTunnelUrlChange?: (url: string | null) => void;
}

export function TunnelManager({ className, onTunnelUrlChange }: TunnelManagerProps) {
  const [tunnelInfo, setTunnelInfo] = useState<TunnelInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMode, setSelectedMode] = useState<'webhook-only' | 'full-api' | 'custom'>(
    'webhook-only'
  );
  const [customConfig, setCustomConfig] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000;

  const isTunnelRunning = tunnelInfo?.status === 'running';

  const refreshStatus = useCallback(async () => {
    try {
      const response = await apiService.getTunnelStatus();
      if (response.success) {
        setTunnelInfo(response.tunnel || null);
      }
    } catch (error) {
      console.error('Failed to refresh tunnel status:', error);
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
      console.error('Failed to load tunnel status:', error);
      toast.error('Failed to load tunnel status');
    } finally {
      setIsLoading(false);
    }
  }, [refreshStatus]);

  // Load initial status
  useEffect(() => {
    loadInitialStatus();
  }, [loadInitialStatus]);

  // WebSocket for real-time tunnel logs
  useEffect(() => {
    if (!tunnelInfo || tunnelInfo.status !== 'running') {
      // Close WS if not needed
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setWs(null);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      reconnectAttemptsRef.current = 0;
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/events`;

    const connect = () => {
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;
      setWs(socket);

      socket.onopen = () => {
        console.log('Tunnel logs WS connected');
        reconnectAttemptsRef.current = 0;
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }

        // Subscribe to tunnel logs
        const subscriptionMessage = {
          type: 'event',
          data: {
            action: 'subscribe',
            channel: 'tunnel-logs',
          },
        };
        socket.send(JSON.stringify(subscriptionMessage));
      };

      socket.onmessage = event => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'event' && message.data.event_type === 'tunnel_log') {
            setLogs(prev => [...prev, message.data.log]);
          } else if (message.type === 'event' && message.data.event_type === 'tunnel_error') {
            setLogs(prev => [...prev, message.data.log]);
          }
        } catch (e) {
          console.error('Failed to parse WS message', e);
        }
      };

      socket.onclose = event => {
        console.log('Tunnel logs WS closed', event.code, event.reason);
        wsRef.current = null;
        setWs(null);

        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current);
          reconnectAttemptsRef.current++;
          console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        }
      };

      socket.onerror = error => {
        console.error('Tunnel logs WS error', error);
        socket.close();
      };
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [tunnelInfo?.status]);

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
        zone: 'sibylline.dev',
        localPort: 5050,
      });
      if (response.success && response.tunnel) {
        setTunnelInfo(response.tunnel);
        toast.success('Tunnel started successfully');
      } else {
        toast.error(response.error || 'Failed to start tunnel');
      }
    } catch (error) {
      toast.error('Failed to start tunnel');
      console.error('Tunnel start error:', error);
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
        toast.success(response.message || 'Tunnel stopped successfully');
        // Refresh status after stopping
        await refreshStatus();
      } else {
        toast.error(response.error || 'Failed to stop tunnel');
      }
    } catch (error) {
      toast.error('Failed to stop tunnel');
      console.error('Tunnel stop error:', error);
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
          : typeof response.logs === 'string'
            ? response.logs.split('\n')
            : [];
        setLogs(rawLogs.filter(line => line.trim().length > 0));
      } else if (response.error) {
        console.warn('Failed to load tunnel logs:', response.error);
      }
    } catch (error) {
      console.error('Failed to load tunnel logs:', error);
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
      toast.success('Tunnel URL copied to clipboard');
    }
  };

  const getStatusIcon = () => {
    if (isLoading) {
      return <RefreshCw className="w-5 h-5 animate-spin text-gray-500 dark:text-graphite-300" />;
    }

    switch (tunnelInfo?.status) {
      case 'running':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'stopped':
      default:
        return <Power className="w-5 h-5 text-gray-400" />;
    }
  };

  return (
    <Card className={cn('p-6', className)}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Globe className="w-6 h-6 text-gray-600" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Cloudflare Tunnel
          </h2>
        </div>
        <Button
          variant={isTunnelRunning ? 'secondary' : 'primary'}
          leftIcon={
            isTunnelRunning ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />
          }
          onClick={isTunnelRunning ? stopTunnel : startTunnel}
          disabled={isLoading}
        >
          {isLoading
            ? isTunnelRunning
              ? 'Stopping...'
              : 'Starting...'
            : isTunnelRunning
              ? 'Stop Tunnel'
              : 'Start Tunnel'}
        </Button>
      </div>

      {/* Tunnel Status Section */}
      <div className="border border-gray-200 dark:border-graphite-700 rounded-lg p-4 mb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <div className="flex items-center gap-3 flex-1">
            {getStatusIcon()}
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100">
                {isTunnelRunning ? 'Tunnel Active' : 'Tunnel Inactive'}
              </h3>
              <p className="text-sm text-gray-500">
                {isTunnelRunning
                  ? 'Your tunnel is running and accepting connections'
                  : 'Start a tunnel to enable webhook connectivity'}
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

      {/* Tunnel Controls */}
      <div className="space-y-4">
        {/* Mode Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tunnel Mode</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              {
                value: 'webhook-only',
                label: 'Webhook Only',
                title: 'Secure mode - only webhook endpoints exposed (recommended)',
              },
              {
                value: 'full-api',
                label: 'Full API',
                title: 'Development mode - all API endpoints accessible',
              },
              {
                value: 'custom',
                label: 'Custom',
                title: 'Advanced configuration with custom settings',
              },
            ].map(mode => (
              <button
                key={mode.value}
                onClick={() => setSelectedMode(mode.value as any)}
                disabled={isTunnelRunning}
                title={mode.title}
                className={cn(
                  'p-3 text-left border rounded-lg transition-colors',
                  selectedMode === mode.value
                    ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-300'
                    : 'border-gray-200 dark:border-graphite-700 hover:border-gray-300 dark:hover:border-graphite-600 text-gray-900 dark:text-gray-100',
                  isTunnelRunning && 'opacity-50 cursor-not-allowed'
                )}
              >
                <div className="font-medium text-sm">{mode.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Configuration */}
        {selectedMode === 'custom' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Custom Configuration
            </label>
            <textarea
              value={customConfig}
              onChange={e => setCustomConfig(e.target.value)}
              placeholder="Enter custom tunnel configuration..."
              className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
              disabled={isTunnelRunning}
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-start pt-4 border-t border-gray-200 dark:border-graphite-700">
          <div className="text-sm text-gray-500">
            Configure the tunnel mode and options above as needed before starting.
          </div>
        </div>
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
                  {logs.join('\n')}
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
