/**
 * Webhook Handler Statistics Component
 * Shows execution metrics, history, and performance data
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Activity,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Calendar,
  Timer,
  X,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { apiService } from '../../services/api';
import { Button, StatusBadge, Card, cn } from '../../design-system';
import type { WebhookHandler, HandlerStats as StatsData, HandlerExecution } from '../../types/api';
import { createLogger } from '../../utils/logger';

const log = createLogger('HandlerStats');

interface HandlerStatsProps {
  handler: WebhookHandler;
  onClose: () => void;
}

export function HandlerStats({ handler, onClose }: HandlerStatsProps) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [executions, setExecutions] = useState<HandlerExecution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load stats and executions
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [statsData, executionsData] = await Promise.all([
        apiService.getHandlerStats(handler.id),
        apiService.getHandlerExecutions(handler.id, 50), // Last 50 executions
      ]);

      setStats(statsData);
      setExecutions(executionsData);
      log.debug('Loaded handler stats:', { statsData, executionsData });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load handler statistics';
      setError(message);
      log.error('Failed to load handler stats:', err);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [handler.id]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Format duration
  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  // Format date
  const formatDate = (timestamp: string) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(timestamp));
  };

  // Get relative time
  const getRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  // Calculate success rate
  const getSuccessRate = () => {
    if (!stats || stats.total_executions === 0) return 0;
    return Math.round((stats.successful_executions / stats.total_executions) * 100);
  };

  // Get status icon
  const getStatusIcon = (status: HandlerExecution['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'timeout':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    }
  };

  // Get status color
  const getStatusColor = (status: HandlerExecution['status']) => {
    switch (status) {
      case 'success':
        return 'text-green-600 bg-green-50';
      case 'error':
        return 'text-red-600 bg-red-50';
      case 'timeout':
        return 'text-yellow-600 bg-yellow-50';
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="spinner h-8 w-8 mb-4 mx-auto"></div>
          <p className="text-gray-500">Loading statistics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load statistics</h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <div className="flex gap-2 justify-center">
            <Button onClick={loadData} variant="secondary">
              Try Again
            </Button>
            <Button onClick={onClose} variant="secondary">
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <Button
            onClick={onClose}
            variant="secondary"
            size="sm"
            leftIcon={<ArrowLeft className="h-4 w-4" />}
          >
            Back
          </Button>
          <div className="flex items-center gap-3">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Handler Statistics</h2>
              <p className="text-sm text-gray-600">
                {handler.name} • {handler.provider} • {handler.event_type}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge variant={handler.enabled ? 'success' : 'error'} size="sm">
            {handler.enabled ? 'Enabled' : 'Disabled'}
          </StatusBadge>

          <Button
            onClick={loadData}
            variant="secondary"
            size="sm"
            leftIcon={<RefreshCw className="h-4 w-4" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Activity className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">
                    {stats?.total_executions || 0}
                  </div>
                  <div className="text-sm text-gray-500">Total Executions</div>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{getSuccessRate()}%</div>
                  <div className="text-sm text-gray-500">Success Rate</div>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Timer className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">
                    {formatDuration(stats?.avg_duration_ms)}
                  </div>
                  <div className="text-sm text-gray-500">Avg Duration</div>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gray-100 rounded-lg">
                  <Clock className="h-6 w-6 text-gray-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">
                    {stats?.last_execution ? getRelativeTime(stats.last_execution) : 'Never'}
                  </div>
                  <div className="text-sm text-gray-500">Last Execution</div>
                </div>
              </div>
            </Card>
          </div>

          {/* Success/Failure Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Execution Breakdown</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">Successful</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-green-600">
                      {stats?.successful_executions || 0}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-medium">Failed</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-red-600">
                      {stats?.failed_executions || 0}
                    </div>
                  </div>
                </div>

                {/* Visual Progress Bar */}
                {stats && stats.total_executions > 0 && (
                  <div className="mt-4">
                    <div className="flex rounded-full overflow-hidden h-2">
                      <div
                        className="bg-green-500"
                        style={{
                          width: `${(stats.successful_executions / stats.total_executions) * 100}%`,
                        }}
                      />
                      <div
                        className="bg-red-500"
                        style={{
                          width: `${(stats.failed_executions / stats.total_executions) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Handler Information</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Provider:</span>
                  <span className="font-medium">{handler.provider}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Event Type:</span>
                  <span className="font-medium">{handler.event_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Created:</span>
                  <span className="font-medium">{formatDate(handler.created_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Last Modified:</span>
                  <span className="font-medium">{formatDate(handler.updated_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Status:</span>
                  <StatusBadge variant={handler.enabled ? 'success' : 'error'} size="sm">
                    {handler.enabled ? 'Enabled' : 'Disabled'}
                  </StatusBadge>
                </div>
              </div>
            </Card>
          </div>

          {/* Recent Executions */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Recent Executions</h3>
              <div className="text-sm text-gray-500">
                Showing last {executions.length} executions
              </div>
            </div>

            {executions.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No executions yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {executions.map((execution, index) => (
                  <div
                    key={execution.id}
                    className={cn(
                      'flex items-center justify-between p-4 rounded-lg border',
                      index < 5 ? 'bg-gray-50' : 'bg-white' // Highlight recent ones
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn('p-2 rounded-full', getStatusColor(execution.status))}>
                        {getStatusIcon(execution.status)}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">
                            {execution.status.toUpperCase()}
                          </span>
                          <span className="text-xs text-gray-500">
                            {getRelativeTime(execution.started_at)}
                          </span>
                        </div>

                        <div className="text-xs text-gray-500 mt-1">
                          Duration: {formatDuration(execution.duration_ms)}
                        </div>

                        {execution.error_message && (
                          <div className="text-xs text-red-600 mt-1 max-w-md truncate">
                            Error: {execution.error_message}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-gray-500">
                        {formatDate(execution.started_at)}
                      </div>
                      {execution.completed_at && (
                        <div className="text-xs text-gray-400">
                          to {formatDate(execution.completed_at)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

export default HandlerStats;
