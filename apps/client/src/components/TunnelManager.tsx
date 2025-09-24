/**
 * Tunnel Manager Component - Integrates cloudflare-tunnel.sh functionality
 */

import {
  AlertCircle,
  CheckCircle,
  Copy,
  ExternalLink,
  Globe,
  Power,
  PowerOff,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
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

  // Poll tunnel status every 5 seconds when running
  useEffect(() => {
    if (isPolling) {
      const interval = setInterval(refreshStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [isPolling]);

  // Start polling when tunnel is running
  useEffect(() => {
    if (tunnelInfo?.status === 'running') {
      setIsPolling(true);
    } else {
      setIsPolling(false);
    }
  }, [tunnelInfo?.status]);

  // Notify parent component when tunnel URL changes
  useEffect(() => {
    if (onTunnelUrlChange) {
      onTunnelUrlChange(tunnelInfo?.status === 'running' ? tunnelInfo.url : null);
    }
  }, [tunnelInfo?.status, tunnelInfo?.url, onTunnelUrlChange]);

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
      if (response.success && response.logs) {
        setLogs(response.logs.split('\n'));
        if (!showLogs) setShowLogs(true);
      } else {
        toast.error(response.error || 'Failed to load logs');
      }
    } catch (error) {
      toast.error('Failed to load tunnel logs');
      console.error('Logs error:', error);
    }
  };

  const copyTunnelUrl = () => {
    if (tunnelInfo?.url) {
      navigator.clipboard.writeText(tunnelInfo.url);
      toast.success('Tunnel URL copied to clipboard');
    }
  };

  const getStatusIcon = () => {
    if (isLoading) {
      return <RefreshCw className="w-5 h-5 animate-spin" />;
    }

    switch (tunnelInfo?.status) {
      case 'running':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'stopped':
      default:
        return <Power className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = () => {
    switch (tunnelInfo?.status) {
      case 'running':
        return 'success';
      case 'stopped':
      default:
        return 'neutral';
    }
  };

  return (
    <Card className={cn('p-6', className)}>
      <div className="flex items-center gap-3 mb-6">
        <Globe className="w-6 h-6 text-gray-600" />
        <h2 className="text-xl font-semibold text-gray-900">Cloudflare Tunnel</h2>
        {tunnelInfo && (
          <StatusBadge variant={getStatusColor()} size="sm">
            {tunnelInfo.status.charAt(0).toUpperCase() + tunnelInfo.status.slice(1)}
          </StatusBadge>
        )}
      </div>

      {/* Tunnel Status Section */}
      <div className="border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <div>
              <h3 className="font-medium text-gray-900">
                {tunnelInfo?.status === 'running' ? 'Tunnel Active' : 'Tunnel Inactive'}
              </h3>
              <p className="text-sm text-gray-500">
                {tunnelInfo?.status === 'running'
                  ? 'Your tunnel is running and accepting connections'
                  : 'Start a tunnel to enable webhook connectivity'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<RefreshCw className="w-4 h-4" />}
              onClick={refreshStatus}
              disabled={isLoading}
            >
              Refresh
            </Button>

            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Terminal className="w-4 h-4" />}
              onClick={() => setShowLogs(!showLogs)}
            >
              {showLogs ? 'Hide Logs' : 'Show Logs'}
            </Button>
          </div>
        </div>

        {/* Tunnel URL Display */}
        {tunnelInfo?.url && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Tunnel URL</label>
            <div className="flex gap-2">
              <Input value={tunnelInfo.url} readOnly className="flex-1 bg-gray-50" />
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Copy className="w-4 h-4" />}
                onClick={copyTunnelUrl}
              >
                Copy
              </Button>
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<ExternalLink className="w-4 h-4" />}
                onClick={() => window.open(tunnelInfo.url, '_blank')}
              >
                Open
              </Button>
            </div>
          </div>
        )}

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
                disabled={tunnelInfo?.status === 'running'}
                title={mode.title}
                className={cn(
                  'p-3 text-left border rounded-lg transition-colors',
                  selectedMode === mode.value
                    ? 'border-blue-300 bg-blue-50 text-blue-900'
                    : 'border-gray-200 hover:border-gray-300 text-gray-900',
                  tunnelInfo?.status === 'running' && 'opacity-50 cursor-not-allowed'
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
              disabled={tunnelInfo?.status === 'running'}
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <div className="text-sm text-gray-500">
            {tunnelInfo?.status === 'running' ? (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                Tunnel is active and monitoring for connections
              </div>
            ) : (
              'Configure and start your tunnel to enable webhook connectivity'
            )}
          </div>

          <div className="flex items-center gap-2">
            {tunnelInfo?.status === 'running' ? (
              <Button
                variant="secondary"
                leftIcon={<PowerOff className="w-4 h-4" />}
                onClick={stopTunnel}
                disabled={isLoading}
              >
                {isLoading ? 'Stopping...' : 'Stop Tunnel'}
              </Button>
            ) : (
              <Button
                variant="primary"
                leftIcon={<Power className="w-4 h-4" />}
                onClick={startTunnel}
                disabled={isLoading}
              >
                {isLoading ? 'Starting...' : 'Start Tunnel'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Logs Section - Collapsible */}
      <div className="mt-6 border border-gray-200 rounded-lg">
        <div
          className="flex items-center justify-between p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50"
          onClick={() => setShowLogs(!showLogs)}
        >
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-gray-600" />
            <h3 className="font-medium text-gray-900">Tunnel Logs</h3>
            {logs.length > 0 && (
              <StatusBadge variant="info" size="xs">
                {logs.length} entries
              </StatusBadge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={e => {
              e.stopPropagation();
              loadLogs();
            }}
            className="mr-2"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
        {showLogs && (
          <div className="p-4 max-h-96 overflow-auto">
            {logs.length > 0 ? (
              <pre className="text-xs font-mono bg-gray-900 text-green-400 p-4 rounded-lg whitespace-pre-wrap">
                {logs.join('\n')}
              </pre>
            ) : (
              <p className="text-sm text-gray-500 italic">Click refresh to load logs</p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
