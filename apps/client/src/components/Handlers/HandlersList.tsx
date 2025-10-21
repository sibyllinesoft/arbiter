/**
 * Webhook Handlers List Component
 * Displays all webhook handlers with management capabilities
 */

import {
  BarChart3,
  Clock,
  Filter,
  Play,
  Plus,
  Power,
  PowerOff,
  Search,
  Settings,
  Trash2,
  XCircle,
} from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import { Button, Card, Input, Select, StatusBadge, cn } from "../../design-system";
import { apiService } from "../../services/api";
import type { WebhookHandler, WebhookProvider } from "../../types/api";
import { createLogger } from "../../utils/logger";

const log = createLogger("HandlersList");

// Provider icons mapping
const PROVIDER_ICONS: Record<WebhookProvider, string> = {
  github: "🐙",
  gitlab: "🦊",
  bitbucket: "🪣",
  slack: "💬",
  discord: "💬",
  custom: "⚙️",
};

// Provider colors for badges
const PROVIDER_COLORS: Record<WebhookProvider, string> = {
  github: "bg-gray-100 text-gray-800",
  gitlab: "bg-orange-100 text-orange-800",
  bitbucket: "bg-blue-100 text-blue-800",
  slack: "bg-purple-100 text-purple-800",
  discord: "bg-indigo-100 text-indigo-800",
  custom: "bg-green-100 text-green-800",
};

interface HandlersListProps {
  onEditHandler: (handler: WebhookHandler) => void;
  onViewStats: (handler: WebhookHandler) => void;
  onCreateHandler: () => void;
}

export function HandlersList({ onEditHandler, onViewStats, onCreateHandler }: HandlersListProps) {
  const [handlers, setHandlers] = useState<WebhookHandler[]>([]);
  const [filteredHandlers, setFilteredHandlers] = useState<WebhookHandler[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterProvider, setFilterProvider] = useState<WebhookProvider | "all">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "enabled" | "disabled">("all");

  // Load handlers from API
  const loadHandlers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const handlersData = await apiService.getHandlers();
      const safeHandlers = Array.isArray(handlersData) ? handlersData : [];
      setHandlers(safeHandlers);
      log.debug("Loaded handlers:", safeHandlers);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load handlers";
      setError(message);
      log.error("Failed to load handlers:", err);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadHandlers();
  }, [loadHandlers]);

  // Apply filters and search
  useEffect(() => {
    let filtered = handlers;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (handler) =>
          handler.name.toLowerCase().includes(query) ||
          handler.event_type.toLowerCase().includes(query) ||
          handler.provider.toLowerCase().includes(query),
      );
    }

    // Apply provider filter
    if (filterProvider !== "all") {
      filtered = filtered.filter((handler) => handler.provider === filterProvider);
    }

    // Apply status filter
    if (filterStatus !== "all") {
      filtered = filtered.filter((handler) =>
        filterStatus === "enabled" ? handler.enabled : !handler.enabled,
      );
    }

    setFilteredHandlers(filtered);
  }, [handlers, searchQuery, filterProvider, filterStatus]);

  // Toggle handler enabled/disabled
  const handleToggleHandler = useCallback(async (handler: WebhookHandler) => {
    try {
      const updatedHandler = await apiService.toggleHandler(handler.id, !handler.enabled);

      setHandlers((prev) => prev.map((h) => (h.id === handler.id ? updatedHandler : h)));

      toast.success(`Handler ${updatedHandler.enabled ? "enabled" : "disabled"} successfully`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to toggle handler";
      toast.error(message);
      log.error("Failed to toggle handler:", err);
    }
  }, []);

  // Delete handler
  const handleDeleteHandler = useCallback(async (handler: WebhookHandler) => {
    if (
      !confirm(
        `Are you sure you want to delete handler "${handler.name}"? This action cannot be undone.`,
      )
    ) {
      return;
    }

    try {
      await apiService.deleteHandler(handler.id);
      setHandlers((prev) => prev.filter((h) => h.id !== handler.id));
      toast.success("Handler deleted successfully");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete handler";
      toast.error(message);
      log.error("Failed to delete handler:", err);
    }
  }, []);

  // Test handler execution
  const handleTestHandler = useCallback(async (handler: WebhookHandler) => {
    try {
      const testPayload = {
        test: true,
        timestamp: new Date().toISOString(),
        source: "manual-test",
      };

      const result = await apiService.testHandler(handler.id, testPayload);

      if (result.status === "success") {
        toast.success(`Handler test completed in ${result.duration_ms}ms`);
      } else {
        toast.error(`Handler test failed: ${result.error}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to test handler";
      toast.error(message);
      log.error("Failed to test handler:", err);
    }
  }, []);

  // Format last execution time
  const formatLastExecution = (timestamp: string | undefined) => {
    if (!timestamp) return "Never";

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  // Calculate success rate
  const getSuccessRate = (handler: WebhookHandler) => {
    if (handler.execution_count === 0) return 0;
    return Math.round((handler.success_count / handler.execution_count) * 100);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="spinner h-8 w-8 mb-4 mx-auto"></div>
          <p className="text-gray-500">Loading handlers...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load handlers</h3>
        <p className="text-gray-500 mb-4">{error}</p>
        <Button onClick={loadHandlers} variant="secondary">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Webhook Handlers</h1>
          <p className="text-gray-600 mt-1">Manage webhook handlers for automated processing</p>
        </div>
        <Button onClick={onCreateHandler} leftIcon={<Plus className="h-4 w-4" />}>
          New Handler
        </Button>
      </div>

      {/* Filters and Search */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <Input
              placeholder="Search handlers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>

          {/* Provider filter */}
          <Select
            value={filterProvider}
            onChange={(value) => setFilterProvider(value as WebhookProvider | "all")}
            options={[
              { value: "all", label: "All Providers" },
              { value: "github", label: "🐙 GitHub" },
              { value: "gitlab", label: "🦊 GitLab" },
              { value: "bitbucket", label: "🪣 Bitbucket" },
              { value: "slack", label: "💬 Slack" },
              { value: "discord", label: "💬 Discord" },
              { value: "custom", label: "⚙️ Custom" },
            ]}
            className="w-40"
          />

          {/* Status filter */}
          <Select
            value={filterStatus}
            onChange={(value) => setFilterStatus(value as "all" | "enabled" | "disabled")}
            options={[
              { value: "all", label: "All Status" },
              { value: "enabled", label: "Enabled" },
              { value: "disabled", label: "Disabled" },
            ]}
            className="w-32"
          />
        </div>
      </Card>

      {/* Handlers Grid */}
      {filteredHandlers.length === 0 ? (
        <div className="text-center py-12">
          {handlers.length === 0 ? (
            <>
              <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No handlers yet</h3>
              <p className="text-gray-500 mb-6">
                Create your first webhook handler to start automating your workflows.
              </p>
              <Button onClick={onCreateHandler} leftIcon={<Plus className="h-4 w-4" />}>
                Create Handler
              </Button>
            </>
          ) : (
            <>
              <Filter className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No matching handlers</h3>
              <p className="text-gray-500">Try adjusting your filters or search terms.</p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredHandlers.map((handler) => (
            <Card key={handler.id} className="p-6 hover:shadow-md transition-shadow">
              {/* Handler Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">{PROVIDER_ICONS[handler.provider]}</div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">{handler.name}</h3>
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={cn(
                          "px-2 py-1 text-xs font-medium rounded-full",
                          PROVIDER_COLORS[handler.provider],
                        )}
                      >
                        {handler.provider}
                      </span>
                      <StatusBadge variant={handler.enabled ? "success" : "error"} size="sm">
                        {handler.enabled ? "Enabled" : "Disabled"}
                      </StatusBadge>
                    </div>
                    <p className="text-sm text-gray-600">{handler.event_type}</p>
                  </div>
                </div>

                {/* Toggle switch */}
                <button
                  onClick={() => handleToggleHandler(handler)}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    handler.enabled
                      ? "text-green-600 hover:bg-green-50"
                      : "text-gray-400 hover:bg-gray-50",
                  )}
                  title={handler.enabled ? "Disable handler" : "Enable handler"}
                >
                  {handler.enabled ? (
                    <Power className="h-4 w-4" />
                  ) : (
                    <PowerOff className="h-4 w-4" />
                  )}
                </button>
              </div>

              {/* Statistics */}
              <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="text-center">
                  <div className="text-lg font-semibold text-gray-900">
                    {handler.execution_count}
                  </div>
                  <div className="text-xs text-gray-500">Executions</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-green-600">
                    {getSuccessRate(handler)}%
                  </div>
                  <div className="text-xs text-gray-500">Success Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-gray-900 flex items-center justify-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span className="text-xs">{formatLastExecution(handler.last_execution)}</span>
                  </div>
                  <div className="text-xs text-gray-500">Last Run</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => onEditHandler(handler)}
                  variant="secondary"
                  size="sm"
                  leftIcon={<Settings className="h-3 w-3" />}
                  className="flex-1"
                >
                  Edit
                </Button>

                <Button
                  onClick={() => onViewStats(handler)}
                  variant="secondary"
                  size="sm"
                  leftIcon={<BarChart3 className="h-3 w-3" />}
                  className="flex-1"
                >
                  Stats
                </Button>

                <Button
                  onClick={() => handleTestHandler(handler)}
                  variant="secondary"
                  size="sm"
                  leftIcon={<Play className="h-3 w-3" />}
                  title="Test handler"
                  disabled={!handler.enabled}
                />

                <Button
                  onClick={() => handleDeleteHandler(handler)}
                  variant="secondary"
                  size="sm"
                  leftIcon={<Trash2 className="h-3 w-3" />}
                  title="Delete handler"
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default HandlersList;
