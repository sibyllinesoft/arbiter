/**
 * Action Log - Displays service activities and operational events
 */

import { Button, Card, StatusBadge, cn } from "@design-system";
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  Database,
  Filter,
  GitCommit,
  Info,
  Layers,
  RefreshCw,
  Server,
  Settings,
} from "lucide-react";
import React, { useState, useEffect, useRef } from "react";

interface ActionLogEntry {
  id: string;
  timestamp: string;
  type: "service" | "database" | "infrastructure" | "validation" | "deployment";
  action: string;
  details: string;
  status: "success" | "warning" | "error" | "info";
  metadata?: Record<string, any>;
}

interface ActionLogProps {
  projectId: string | null;
  lastWebSocketMessage?: any;
  className?: string;
}

export function ActionLog({ projectId, lastWebSocketMessage, className }: ActionLogProps) {
  const [entries, setEntries] = useState<ActionLogEntry[]>([]);
  const [filter, setFilter] = useState<"all" | ActionLogEntry["type"]>("all");
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Initialize with empty entries - only show real WebSocket messages
  useEffect(() => {
    setEntries([]);
  }, [projectId]);

  // Add new entries from WebSocket messages
  useEffect(() => {
    if (!lastWebSocketMessage || !projectId) return;

    const { type, payload, timestamp } = lastWebSocketMessage;

    let newEntry: ActionLogEntry | null = null;

    switch (type) {
      case "validation_completed":
        newEntry = {
          id: `ws_${Date.now()}`,
          timestamp,
          type: "validation",
          action: "Validation Completed",
          details: `Specification validation ${payload.success ? "passed" : "failed"}`,
          status: payload.success ? "success" : "error",
          metadata: payload,
        };
        break;

      case "service_added":
        newEntry = {
          id: `ws_${Date.now()}`,
          timestamp,
          type: "service",
          action: "Service Added",
          details: `Service "${payload.name}" added to specification`,
          status: "success",
          metadata: payload,
        };
        break;

      case "database_added":
        newEntry = {
          id: `ws_${Date.now()}`,
          timestamp,
          type: "database",
          action: "Database Added",
          details: `Database "${payload.name}" configured`,
          status: "success",
          metadata: payload,
        };
        break;
    }

    if (newEntry) {
      setEntries((prev) => [newEntry!, ...prev]);
    }
  }, [lastWebSocketMessage, projectId]);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = 0; // Scroll to top since we prepend new entries
    }
  }, [entries, autoScroll]);

  const getTypeIcon = (type: ActionLogEntry["type"]) => {
    switch (type) {
      case "service":
        return <Server className="w-4 h-4" />;
      case "database":
        return <Database className="w-4 h-4" />;
      case "infrastructure":
        return <Layers className="w-4 h-4" />;
      case "validation":
        return <CheckCircle className="w-4 h-4" />;
      case "deployment":
        return <GitCommit className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  const getStatusIcon = (status: ActionLogEntry["status"]) => {
    switch (status) {
      case "success":
        return <CheckCircle className="w-4 h-4" />;
      case "error":
        return <AlertCircle className="w-4 h-4" />;
      case "warning":
        return <AlertCircle className="w-4 h-4" />;
      case "info":
        return <Info className="w-4 h-4" />;
      default:
        return <Info className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: ActionLogEntry["type"]) => {
    switch (type) {
      case "service":
        return "text-blue-600 bg-blue-50";
      case "database":
        return "text-green-600 bg-green-50";
      case "infrastructure":
        return "text-purple-600 bg-purple-50";
      case "validation":
        return "text-indigo-600 bg-indigo-50";
      case "deployment":
        return "text-red-600 bg-red-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const filteredEntries =
    filter === "all" ? entries : entries.filter((entry) => entry.type === filter);

  const clearLog = () => {
    setEntries([]);
  };

  return (
    <Card className={cn("h-full", className)}>
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Action Log</h2>
            <StatusBadge variant="info" size="sm">
              {filteredEntries.length} {filter === "all" ? "activities" : `${filter} activities`}
            </StatusBadge>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Activities</option>
              <option value="service">Services</option>
              <option value="database">Databases</option>
              <option value="infrastructure">Infrastructure</option>
              <option value="validation">Validation</option>
              <option value="deployment">Deployment</option>
            </select>

            <Button
              variant="ghost"
              size="sm"
              leftIcon={<RefreshCw className="w-4 h-4" />}
              onClick={clearLog}
            >
              Clear
            </Button>
          </div>
        </div>
      </div>

      <div ref={logContainerRef} className="flex-1 overflow-y-auto p-6 max-h-96">
        {!projectId ? (
          <div className="text-center py-12 text-gray-500">
            <Activity className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium mb-2">No Project Selected</p>
            <p className="text-sm">Select a project to view activity logs</p>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Activity className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium mb-2">No Activities Yet</p>
            <p className="text-sm">Activities will appear here as you work with your project</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className={cn("p-2 rounded-lg", getTypeColor(entry.type))}>
                  {getTypeIcon(entry.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-gray-900">{entry.action}</h4>
                    <StatusBadge variant={entry.status} size="sm">
                      {entry.status}
                    </StatusBadge>
                  </div>

                  <p className="text-sm text-gray-600 mb-2">{entry.details}</p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      {formatTimestamp(entry.timestamp)}
                    </div>

                    {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                      <div className="text-xs text-gray-400">
                        {Object.entries(entry.metadata)
                          .slice(0, 2)
                          .map(([key, value]) => (
                            <span key={key} className="mr-2">
                              {key}: {String(value)}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-gray-400">{getStatusIcon(entry.status)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
