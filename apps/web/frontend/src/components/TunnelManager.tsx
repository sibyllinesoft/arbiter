/**
 * Tunnel Manager Component - Integrates cloudflare-tunnel.sh functionality
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Globe,
  Power,
  PowerOff,
  RotateCcw,
  ExternalLink,
  Copy,
  AlertCircle,
  CheckCircle,
  Clock,
  Terminal,
  Settings,
  RefreshCw,
  Play,
  Pause,
  Monitor,
} from 'lucide-react';
import { Button, Card, Input, StatusBadge, cn } from '../design-system';
import { apiService } from '../services/api';
import { toast } from 'react-toastify';

interface TunnelStatus {
  status: 'running' | 'stopped' | 'failed';
  url: string | null;
  output: string;
  error: string | null;
}

interface TunnelManagerProps {
  className?: string;
  onTunnelUrlChange?: (url: string | null) => void;
}

export function TunnelManager({ className, onTunnelUrlChange }: TunnelManagerProps) {
  const [tunnelStatus, setTunnelStatus] = useState<TunnelStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMode, setSelectedMode] = useState<'webhook-only' | 'full-api' | 'custom'>(
    'webhook-only'
  );
  const [customConfig, setCustomConfig] = useState('');
  const [logs, setLogs] = useState<string>('');
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
    if (tunnelStatus?.status === 'running') {
      setIsPolling(true);
    } else {
      setIsPolling(false);
    }
  }, [tunnelStatus?.status]);

  // Notify parent component when tunnel URL changes
  useEffect(() => {
    if (onTunnelUrlChange) {
      onTunnelUrlChange(tunnelStatus?.status === 'running' ? tunnelStatus.url : null);
    }
  }, [tunnelStatus?.status, tunnelStatus?.url, onTunnelUrlChange]);

  const refreshStatus = useCallback(async () => {
    try {
      const response = await apiService.getTunnelStatus();
      if (response.success && response.tunnel) {
        setTunnelStatus(response.tunnel);
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
      const response = await apiService.startTunnel(selectedMode);
      if (response.success && response.tunnel) {
        setTunnelStatus(response.tunnel);
        toast.success(response.message || 'Tunnel started successfully');
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
      if (response.success && response.tunnel) {
        setTunnelStatus(response.tunnel);
        toast.success(response.message || 'Tunnel stopped successfully');
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
        setLogs(response.logs);
        setShowLogs(true);
      } else {
        toast.error(response.error || 'Failed to load logs');
      }
    } catch (error) {
      toast.error('Failed to load tunnel logs');
      console.error('Logs error:', error);
    }
  };

  const copyTunnelUrl = () => {
    if (tunnelStatus?.url) {
      navigator.clipboard.writeText(tunnelStatus.url);
      toast.success('Tunnel URL copied to clipboard');
    }
  };

  const getStatusIcon = () => {
    if (isLoading) {
      return <RefreshCw className="w-5 h-5 animate-spin" />;
    }

    switch (tunnelStatus?.status) {
      case 'running':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'stopped':
      default:
        return <Power className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = () => {
    switch (tunnelStatus?.status) {
      case 'running':
        return 'success';
      case 'failed':
        return 'error';
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
        {tunnelStatus && (
          <StatusBadge variant={getStatusColor()} size="sm">
            {tunnelStatus.status.charAt(0).toUpperCase() + tunnelStatus.status.slice(1)}
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
                {tunnelStatus?.status === 'running' ? 'Tunnel Active' : 'Tunnel Inactive'}
              </h3>
              <p className="text-sm text-gray-500">
                {tunnelStatus?.status === 'running'
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
              onClick={loadLogs}
            >
              Logs
            </Button>
          </div>
        </div>

        {/* Tunnel URL Display */}
        {tunnelStatus?.url && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Tunnel URL</label>
            <div className="flex gap-2">
              <Input value={tunnelStatus.url} readOnly className="flex-1 bg-gray-50" />
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
                onClick={() => window.open(tunnelStatus.url, '_blank')}
              >
                Open
              </Button>
            </div>
          </div>
        )}

        {/* Error Display */}
        {tunnelStatus?.error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-800">
                <p className="font-medium mb-1">Tunnel Error</p>
                <p className="font-mono text-xs bg-red-100 p-2 rounded">{tunnelStatus.error}</p>
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
              { value: 'webhook-only', label: 'Webhook Only', desc: 'Secure (recommended)' },
              { value: 'full-api', label: 'Full API', desc: 'Development mode' },
              { value: 'custom', label: 'Custom', desc: 'Advanced configuration' },
            ].map(mode => (
              <button
                key={mode.value}
                onClick={() => setSelectedMode(mode.value as any)}
                disabled={tunnelStatus?.status === 'running'}
                className={cn(
                  'p-3 text-left border rounded-lg transition-colors',
                  selectedMode === mode.value
                    ? 'border-blue-300 bg-blue-50 text-blue-900'
                    : 'border-gray-200 hover:border-gray-300 text-gray-900',
                  tunnelStatus?.status === 'running' && 'opacity-50 cursor-not-allowed'
                )}
              >
                <div className="font-medium text-sm">{mode.label}</div>
                <div className="text-xs text-gray-500 mt-1">{mode.desc}</div>
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
              disabled={tunnelStatus?.status === 'running'}
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <div className="text-sm text-gray-500">
            {tunnelStatus?.status === 'running' ? (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                Tunnel is active and monitoring for connections
              </div>
            ) : (
              'Configure and start your tunnel to enable webhook connectivity'
            )}
          </div>

          <div className="flex items-center gap-2">
            {tunnelStatus?.status === 'running' ? (
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

      {/* Logs Modal/Section */}
      {showLogs && (
        <div className="mt-6 border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-gray-600" />
              <h3 className="font-medium text-gray-900">Tunnel Logs</h3>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowLogs(false)}>
              Close
            </Button>
          </div>
          <div className="p-4">
            <pre className="text-xs font-mono bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto max-h-96">
              {logs || 'No logs available'}
            </pre>
          </div>
        </div>
      )}

      {/* Information Panel */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Tunnel Information</p>
            <ul className="list-disc list-inside space-y-1 text-blue-700">
              <li>
                <strong>Webhook-only:</strong> Secure mode - only webhook endpoints exposed
              </li>
              <li>
                <strong>Full API:</strong> Development mode - all API endpoints accessible
              </li>
              <li>
                <strong>Custom:</strong> Advanced configuration with custom settings
              </li>
              <li>The tunnel automatically handles SSL/TLS certificates via Cloudflare</li>
              <li>IP filtering is enforced for webhook-only mode (GitHub/GitLab IPs only)</li>
            </ul>
          </div>
        </div>
      </div>
    </Card>
  );
}
