import { AlertCircle, Copy, Eye, EyeOff, Play, Webhook } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { Button, Card, Input, StatusBadge, type TabItem, Tabs, cn } from "../design-system";
import { apiService } from "../services/api";
import { WebhookAutomation } from "./WebhookAutomation";

interface WebhookConfig {
  url: string;
  secret: string;
  enabled: boolean;
  events: string[];
}

interface WebhooksReportProps {
  projectId: string;
}

interface EnvironmentInfo {
  runtime: "cloudflare" | "node";
  cloudflareTunnelSupported: boolean;
}

interface TunnelStatusResponse {
  success: boolean;
  tunnel?: {
    tunnelId: string;
    tunnelName: string;
    hostname: string;
    url: string;
    status: "running" | "stopped";
    hookId?: string;
  } | null;
  error?: string;
}

const DEFAULT_EVENTS = ["push", "pull_request", "merge_requests", "issues", "releases"];

function createDefaultConfigs(): Record<string, WebhookConfig> {
  return {
    github: {
      url: "",
      secret: "",
      enabled: true,
      events: ["push", "pull_request", "issues"],
    },
    gitlab: {
      url: "",
      secret: "",
      enabled: false,
      events: ["push", "merge_requests", "issues"],
    },
  };
}

const STORAGE_KEY_PREFIX = "webhookConfigs:";

export function WebhooksReport({ projectId }: WebhooksReportProps) {
  const [webhookConfigs, setWebhookConfigs] = useState<Record<string, WebhookConfig>>(
    createDefaultConfigs(),
  );
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [environment, setEnvironment] = useState<"unknown" | "cloudflare" | "node">("unknown");
  const [tunnelUrl, setTunnelUrl] = useState<string>("");
  const [loadingTunnel, setLoadingTunnel] = useState(false);
  const [activeSection, setActiveSection] = useState<"automation" | "providers">("providers");
  const [activeProvider, setActiveProvider] = useState<string>(() => {
    const defaultKeys = Object.keys(createDefaultConfigs());
    return defaultKeys[0] ?? "";
  });

  const storageKey = useMemo(() => `${STORAGE_KEY_PREFIX}${projectId}`, [projectId]);

  // Load environment info
  useEffect(() => {
    let cancelled = false;

    apiService
      .getEnvironmentInfo()
      .then((info: EnvironmentInfo) => {
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

  // Load tunnel status
  const refreshTunnelStatus = useCallback(async () => {
    try {
      setLoadingTunnel(true);
      const status: TunnelStatusResponse = await apiService.getTunnelStatus();
      if (status.success && status.tunnel && status.tunnel.url) {
        setTunnelUrl(status.tunnel.url);
      }
    } catch (error) {
      // Non-critical
    } finally {
      setLoadingTunnel(false);
    }
  }, []);

  useEffect(() => {
    refreshTunnelStatus().catch(() => []);
  }, [refreshTunnelStatus]);

  // Load stored configs for project
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, WebhookConfig>;
        setWebhookConfigs({ ...createDefaultConfigs(), ...parsed });
      } else {
        setWebhookConfigs(createDefaultConfigs());
      }
    } catch (error) {
      console.warn("Failed to load webhook configs", error);
      setWebhookConfigs(createDefaultConfigs());
    }

    setShowSecrets({});
  }, [storageKey]);

  // Persist configs when they change
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(webhookConfigs));
    } catch (error) {
      console.warn("Failed to persist webhook configs", error);
    }
  }, [storageKey, webhookConfigs]);

  const handleWebhookConfigChange = (
    provider: string,
    field: keyof WebhookConfig,
    value: unknown,
  ) => {
    setWebhookConfigs((prev) => {
      const current = prev[provider] ?? { ...createDefaultConfigs().github };
      return {
        ...prev,
        [provider]: {
          ...current,
          [field]: value,
        } as WebhookConfig,
      };
    });
  };

  const handleEventToggle = (provider: string, event: string) => {
    const current = webhookConfigs[provider] ?? { ...createDefaultConfigs().github };
    const events = current.events ?? [];
    const nextEvents = events.includes(event)
      ? events.filter((e) => e !== event)
      : [...events, event];
    handleWebhookConfigChange(provider, "events", nextEvents);
  };

  const testWebhook = async (provider: string) => {
    const config = webhookConfigs[provider];
    if (!config) {
      toast.error(`No configuration found for ${provider}`);
      return;
    }
    if (!config.url) {
      toast.error(`No URL configured for ${provider}`);
      return;
    }

    try {
      const testPayload = {
        test: true,
        provider,
        projectId,
        timestamp: new Date().toISOString(),
      };

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (provider === "github") {
        headers["X-GitHub-Event"] = "ping";
        headers["X-Hub-Signature-256"] = "sha256=test";
      } else if (provider === "gitlab") {
        headers["X-Gitlab-Event"] = "System Hook";
      }

      const response = await fetch(config.url, {
        method: "POST",
        headers,
        body: JSON.stringify(testPayload),
      });

      if (response.ok) {
        toast.success(`${provider} webhook test successful`);
      } else {
        toast.error(`${provider} webhook test failed`);
      }
    } catch (error) {
      toast.error(
        `Failed to test ${provider} webhook: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  };

  const copyToClipboard = useCallback((text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      toast.success("Copied to clipboard");
    });
  }, []);

  const providerEntries = Object.entries(webhookConfigs);
  const providerKeys = providerEntries.map(([provider]) => provider);

  useEffect(() => {
    if (providerKeys.length === 0) {
      if (activeProvider !== "") {
        setActiveProvider("");
      }
      return;
    }

    if (!activeProvider || !providerKeys.includes(activeProvider)) {
      const nextProvider = providerKeys[0];
      if (nextProvider && nextProvider !== activeProvider) {
        setActiveProvider(nextProvider);
      }
    }
  }, [activeProvider, providerKeys]);

  const formatProviderLabel = (value: string) =>
    value.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

  const providerTabs: TabItem[] = providerEntries.map(([provider, config]) => {
    const label = formatProviderLabel(provider);
    const enabled = config.enabled !== false;
    const events = Array.isArray(config.events) ? config.events : [];
    const secretVisible = Boolean(showSecrets[provider]);
    return {
      id: provider,
      label,
      content: (
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-graphite-700 dark:bg-graphite-900">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h4 className="text-lg font-medium capitalize text-gray-900 dark:text-graphite-50">
                {label}
              </h4>
              <StatusBadge variant={enabled ? "success" : "neutral"} size="sm">
                {enabled ? "Enabled" : "Disabled"}
              </StatusBadge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={enabled ? "secondary" : "primary"}
                size="sm"
                leftIcon={enabled ? <EyeOff className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                onClick={() => handleWebhookConfigChange(provider, "enabled", !enabled)}
              >
                {enabled ? "Disable" : "Enable"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Play className="h-4 w-4" />}
                onClick={() => testWebhook(provider)}
              >
                Test
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-graphite-300">
                Webhook URL
              </label>
              <div className="flex gap-2">
                <Input
                  value={config.url}
                  onChange={(event) =>
                    handleWebhookConfigChange(provider, "url", event.target.value)
                  }
                  disabled={!enabled}
                  placeholder="https://example.com/webhook"
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Copy className="h-4 w-4" />}
                  onClick={() => copyToClipboard(config.url)}
                  disabled={!config.url}
                >
                  Copy
                </Button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-graphite-300">
                Secret
              </label>
              <div className="flex gap-2">
                <Input
                  type={secretVisible ? "text" : "password"}
                  value={config.secret}
                  onChange={(event) =>
                    handleWebhookConfigChange(provider, "secret", event.target.value)
                  }
                  placeholder="Enter webhook secret"
                  disabled={!enabled}
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={
                    secretVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />
                  }
                  onClick={() =>
                    setShowSecrets((prev) => ({ ...prev, [provider]: !prev[provider] }))
                  }
                >
                  {secretVisible ? "Hide" : "Show"}
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-graphite-300">
              Events
            </label>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_EVENTS.map((event) => (
                <button
                  key={event}
                  type="button"
                  onClick={() => handleEventToggle(provider, event)}
                  disabled={!enabled}
                  className={cn(
                    "cursor-pointer rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                    events.includes(event)
                      ? "border-blue-300 bg-blue-100 text-blue-700 dark:border-blue-600 dark:bg-blue-900/40 dark:text-blue-200"
                      : "border-gray-300 bg-gray-100 text-gray-600 dark:border-graphite-600 dark:bg-graphite-800 dark:text-graphite-300",
                    !enabled && "cursor-not-allowed opacity-60",
                  )}
                >
                  {event.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>
        </div>
      ),
    };
  });

  const resolvedActiveTab =
    providerKeys.includes(activeProvider) && activeProvider
      ? activeProvider
      : providerTabs.length > 0
        ? (providerTabs[0]?.id ?? "")
        : "";

  const isCloudflare = environment === "cloudflare";

  const automationTabContent = (
    <div className="space-y-6">
      <Card className="p-6">
        <WebhookAutomation tunnelUrl={tunnelUrl} />
      </Card>
    </div>
  );

  const providersTabContent = (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-graphite-50">
              Provider Configuration
            </h3>
            <p className="text-sm text-gray-600 dark:text-graphite-300">
              Manage webhook endpoints, secrets, and subscribed events for each provider.
            </p>
          </div>
        </div>

        {providerTabs.length > 0 ? (
          <Tabs
            items={providerTabs}
            activeTab={resolvedActiveTab}
            onChange={(tabId) => setActiveProvider(tabId)}
            variant="pills"
            contentClassName="mt-6"
          />
        ) : (
          <div className="rounded-lg border border-dashed border-gray-200 p-6 text-sm text-gray-600 dark:border-graphite-700 dark:text-graphite-300">
            No webhook providers configured yet.
          </div>
        )}

        <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
          <div className="flex gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-blue-600 dark:text-blue-400" />
            <div className="text-sm text-blue-700 dark:text-blue-200">
              <p className="font-medium">Webhook Setup Tips</p>
              <ol className="mt-1 list-inside list-decimal space-y-1">
                <li>Ensure your tunnel is running and accessible from GitHub.</li>
                <li>Copy the generated URL into your repository webhook settings.</li>
                <li>Use a strong secret and store it securely.</li>
                <li>Select events relevant to this project only.</li>
                <li>Run the webhook test to confirm delivery.</li>
              </ol>
            </div>
          </div>
        </div>
      </Card>

      {isCloudflare && (
        <div className="text-sm text-amber-600 dark:text-amber-400">
          Cloudflare runtime detected. Webhooks require an external tunnel or gateway.
        </div>
      )}
    </div>
  );

  const sectionTabs: TabItem[] = [
    { id: "automation", label: "Automation", content: automationTabContent },
    { id: "providers", label: "Providers", content: providersTabContent },
  ];

  const handleSectionChange = (tabId: string) => {
    if (tabId === "automation" || tabId === "providers") {
      setActiveSection(tabId);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white dark:bg-graphite-950">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-6 dark:border-graphite-800">
        <div className="flex items-center gap-3">
          <Webhook className="h-6 w-6 text-blue-600" />
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-graphite-50">
              Webhook Automation
            </h2>
            <span className="text-sm text-gray-600 dark:text-graphite-300">
              Configure project-specific webhooks and event subscriptions.
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-6">
        <Tabs
          items={sectionTabs}
          activeTab={activeSection}
          onChange={handleSectionChange}
          variant="underline"
          contentClassName="mt-6"
        />
      </div>
    </div>
  );
}

export default WebhooksReport;
