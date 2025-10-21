import { Webhook } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";

import { type TabItem, Tabs } from "../design-system";
import { apiService } from "../services/api";
import { ARTIFACT_PANEL_CLASS } from "./ArtifactPanel";
import { Handlers } from "./Handlers/Handlers";
import { WebhookAutomation } from "./WebhookAutomation";

interface WebhooksReportProps {
  projectId: string;
}

type RuntimeEnvironment = "unknown" | "cloudflare" | "node";

export function WebhooksReport({ projectId }: WebhooksReportProps) {
  const [environment, setEnvironment] = useState<RuntimeEnvironment>("unknown");
  const [tunnelUrl, setTunnelUrl] = useState("");
  const [activeTab, setActiveTab] = useState<"automation" | "handlers">("automation");

  useEffect(() => {
    let cancelled = false;

    apiService
      .getEnvironmentInfo()
      .then((info) => {
        if (!cancelled) {
          setEnvironment(info.runtime);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEnvironment("node");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshTunnelStatus = useCallback(async () => {
    try {
      const status = await apiService.getTunnelStatus();
      if (status.success && status.tunnel?.url) {
        setTunnelUrl(status.tunnel.url);
      }
    } catch (_error) {
      // Tunnel status may be unavailable in some environments; ignore failures.
    }
  }, []);

  useEffect(() => {
    refreshTunnelStatus().catch(() => undefined);
  }, [refreshTunnelStatus, projectId]);

  const isCloudflare = environment === "cloudflare";

  const automationTabContent = (
    <div className="space-y-6">
      <WebhookAutomation tunnelUrl={tunnelUrl} />
      {isCloudflare && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-700 shadow-sm backdrop-blur-sm dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          Cloudflare runtime detected. Webhooks require an external tunnel or gateway for inbound
          traffic.
        </div>
      )}
    </div>
  );

  const handlersTabContent = (
    <div className={`${ARTIFACT_PANEL_CLASS} p-6`}>
      <Handlers />
    </div>
  );

  const sectionTabs: TabItem[] = [
    { id: "automation", label: "Automation", content: automationTabContent },
    { id: "handlers", label: "Handlers", content: handlersTabContent },
  ];

  const handleTabChange = (tabId: string) => {
    if (tabId === "automation" || tabId === "handlers") {
      setActiveTab(tabId);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-50 dark:bg-graphite-950">
      <div className="border-b border-gray-200 bg-white px-6 py-6 dark:border-graphite-800 dark:bg-graphite-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-sm dark:bg-blue-900/30">
              <Webhook className="h-5 w-5" />
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-graphite-25">
                Webhook Automation
              </h2>
              <p className="text-sm text-gray-600 dark:text-graphite-300">
                Configure GitHub automation and manage webhook handlers for this project.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-baseline gap-3">
            {tunnelUrl ? (
              <div className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 shadow-sm dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
                Tunnel Active
              </div>
            ) : (
              <div className="rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-sm font-medium text-gray-600 shadow-sm dark:border-graphite-700 dark:bg-graphite-800/60 dark:text-graphite-300">
                Waiting for tunnel connection
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-6 py-6">
        <Tabs
          items={sectionTabs}
          activeTab={activeTab}
          onChange={handleTabChange}
          variant="underline"
          contentClassName="mt-6"
        />
      </div>
    </div>
  );
}

export default WebhooksReport;
