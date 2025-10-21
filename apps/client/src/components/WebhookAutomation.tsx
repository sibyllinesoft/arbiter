/**
 * Webhook Automation Component - Automated GitHub webhook setup
 */

import {
  AlertCircle,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  GitBranch,
  Github,
  Loader,
  RefreshCw,
  Trash2,
  Zap,
} from "lucide-react";
import { useCallback, useState } from "react";
import type { SingleValue } from "react-select";
import { toast } from "react-toastify";
import { Button, Input, StatusBadge, cn } from "../design-system";
import { apiService } from "../services/api";
import type { GitHubOrganization, GitHubRepository } from "../types/github";
import { ARTIFACT_PANEL_BODY_CLASS, ARTIFACT_PANEL_CLASS } from "./ArtifactPanel";
import { BaseCreatableSelect } from "./form/BaseSelect";

interface GitHubWebhook {
  id: number;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface WebhookAutomationProps {
  className?: string;
  tunnelUrl?: string;
}

export function WebhookAutomation({ className, tunnelUrl }: WebhookAutomationProps) {
  const [repoOwner, setRepoOwner] = useState("");
  const [repoName, setRepoName] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(["push", "pull_request"]);
  const [showSecret, setShowSecret] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [existingWebhooks, setExistingWebhooks] = useState<GitHubWebhook[]>([]);
  const [showExisting, setShowExisting] = useState(false);

  const [gitHubRepos, setGitHubRepos] = useState<GitHubRepository[]>([]);
  const [, setGitHubOrgs] = useState<GitHubOrganization[]>([]);
  const [isLoadingGitHub, setIsLoadingGitHub] = useState(false);

  const availableEvents = [
    { value: "push", label: "Push", description: "Code pushed to repository" },
    { value: "pull_request", label: "Pull Request", description: "PR opened, closed, or updated" },
    { value: "issues", label: "Issues", description: "Issues opened, closed, or updated" },
    { value: "release", label: "Release", description: "Release published or updated" },
    { value: "deployment", label: "Deployment", description: "Deployment created" },
    {
      value: "workflow_run",
      label: "Workflow Run",
      description: "GitHub Actions workflow completed",
    },
  ];

  const toggleEvent = (event: string) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  };

  const listExistingWebhooks = useCallback(async () => {
    if (!repoOwner || !repoName) {
      toast.error("Please enter repository owner and name");
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiService.listGitHubWebhooks(repoOwner, repoName);
      if (response.success && response.webhooks) {
        setExistingWebhooks(response.webhooks);
        setShowExisting(true);
        toast.success(`Found ${response.webhooks.length} existing webhooks`);
      } else {
        toast.error(response.error || "Failed to list webhooks");
      }
    } catch (error) {
      toast.error("Failed to list webhooks");
      console.error("List webhooks error:", error);
    } finally {
      setIsLoading(false);
    }
  }, [repoOwner, repoName]);

  const createWebhook = async () => {
    if (!repoOwner || !repoName) {
      toast.error("Please enter repository owner and name");
      return;
    }

    if (!tunnelUrl) {
      toast.error("Tunnel must be running to create webhook");
      return;
    }

    if (selectedEvents.length === 0) {
      toast.error("Please select at least one event");
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiService.setupGitHubWebhook({
        repoOwner,
        repoName,
        events: selectedEvents,
        tunnelUrl,
      });

      if (response.success && response.webhook) {
        toast.success(response.message || "Webhook created successfully!");

        if (showExisting) {
          await listExistingWebhooks();
        }
      } else {
        toast.error(response.error || "Failed to create webhook");
      }
    } catch (error) {
      toast.error("Failed to create webhook");
      console.error("Create webhook error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteWebhook = async (webhookId: number) => {
    if (!confirm("Are you sure you want to delete this webhook?")) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiService.deleteGitHubWebhook(repoOwner, repoName, webhookId);
      if (response.success) {
        toast.success(response.message || "Webhook deleted successfully");
        await listExistingWebhooks();
      } else {
        toast.error(response.error || "Failed to delete webhook");
      }
    } catch (error) {
      toast.error("Failed to delete webhook");
      console.error("Delete webhook error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const copyWebhookUrl = () => {
    if (tunnelUrl) {
      const webhookUrl = `${tunnelUrl}/webhooks/github`;
      navigator.clipboard.writeText(webhookUrl);
      toast.success("Webhook URL copied to clipboard");
    }
  };

  const generateRandomSecret = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setWebhookSecret(result);
    toast.success("Random secret generated");
  };

  const handleLoadGitHubProjects = async () => {
    setIsLoadingGitHub(true);
    try {
      const [reposResult, orgsResult] = await Promise.all([
        apiService.getGitHubUserRepos(),
        apiService.getGitHubUserOrgs(),
      ]);

      const aggregatedRepos: GitHubRepository[] = [];

      if (reposResult.success && reposResult.repositories) {
        aggregatedRepos.push(...reposResult.repositories);
      }

      if (orgsResult.success) {
        const organizations: GitHubOrganization[] = orgsResult.organizations ?? [];
        setGitHubOrgs(organizations);

        for (const org of organizations) {
          try {
            const orgReposResult = await apiService.getGitHubOrgRepos(org.login);
            if (orgReposResult.success && orgReposResult.repositories) {
              aggregatedRepos.push(...orgReposResult.repositories);
            }
          } catch (error) {
            console.warn(`Failed to load repos for org ${org.login}:`, error);
          }
        }
      }

      setGitHubRepos(aggregatedRepos);

      if (!reposResult.success) {
        toast.error(reposResult.error || "Failed to load GitHub repositories");
      } else {
        toast.success(`Loaded ${aggregatedRepos.length} repositories`);
      }
    } catch (error) {
      console.error("Failed to load GitHub projects:", error);
      toast.error("Failed to load GitHub projects");
    } finally {
      setIsLoadingGitHub(false);
    }
  };

  return (
    <div className={cn(ARTIFACT_PANEL_CLASS, "space-y-6 p-6", className)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-sm dark:bg-blue-900/30">
            <Zap className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-graphite-25">
              Webhook Automation
            </h2>
            <p className="text-sm text-gray-600 dark:text-graphite-300">
              Generate GitHub webhooks, manage secrets, and keep repository events in sync.
            </p>
          </div>
          <StatusBadge variant={tunnelUrl ? "success" : "neutral"} size="sm">
            {tunnelUrl ? "Tunnel ready" : "Waiting for tunnel"}
          </StatusBadge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={handleLoadGitHubProjects}
            disabled={isLoadingGitHub}
            size="sm"
            variant="secondary"
            className="flex items-center gap-2"
          >
            {isLoadingGitHub ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                Loading…
              </>
            ) : (
              <>
                <GitBranch className="h-4 w-4" />
                Load Projects
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Repository Owner
            </label>
            <BaseCreatableSelect<{ value: string; label: string }>
              value={repoOwner ? { value: repoOwner, label: repoOwner } : null}
              onChange={(option: SingleValue<{ value: string; label: string }>) => {
                setRepoOwner(option?.value ?? "");
                setRepoName("");
              }}
              onCreateOption={(inputValue: string) => {
                setRepoOwner(inputValue);
                setRepoName("");
              }}
              options={Array.from(new Set(gitHubRepos.map((r) => r.owner.login))).map((owner) => ({
                value: owner,
                label: owner,
              }))}
              isSearchable
              isClearable
              placeholder="Select or type owner..."
              className="react-select-container"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Repository Name
            </label>
            <BaseCreatableSelect<{ value: string; label: string }>
              value={repoName ? { value: repoName, label: repoName } : null}
              onChange={(option: SingleValue<{ value: string; label: string }>) => {
                setRepoName(option?.value ?? "");
              }}
              onCreateOption={(inputValue: string) => {
                setRepoName(inputValue);
              }}
              options={gitHubRepos
                .filter((r) => !repoOwner || r.owner.login === repoOwner)
                .map((r) => ({ value: r.name, label: r.name }))}
              isSearchable
              isClearable
              isDisabled={!repoOwner}
              placeholder={repoOwner ? "Select or type repository…" : "Select owner first…"}
              className="react-select-container"
            />
            {gitHubRepos.length > 0 && (
              <p className="mt-1 text-sm text-gray-500 dark:text-graphite-300/80">
                {gitHubRepos.length} repositories loaded
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Webhook Secret
            </label>
            <div className="flex gap-2">
              <Input
                type={showSecret ? "text" : "password"}
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                placeholder="Enter or generate a secure secret..."
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="sm"
                leftIcon={showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                onClick={() => setShowSecret((value) => !value)}
              >
                {showSecret ? "Hide" : "Show"}
              </Button>
              <Button variant="secondary" size="sm" onClick={generateRandomSecret}>
                Generate
              </Button>
            </div>
          </div>

          {tunnelUrl && (
            <div className="space-y-2">
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Webhook URL (auto-generated)
              </label>
              <div className="flex gap-2">
                <Input value={`${tunnelUrl}/webhooks/github`} readOnly className="flex-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Copy className="h-4 w-4" />}
                  onClick={copyWebhookUrl}
                >
                  Copy
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Events to Monitor
        </label>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {availableEvents.map((event) => (
            <button
              key={event.value}
              type="button"
              onClick={() => toggleEvent(event.value)}
              className={cn(
                "rounded-lg border px-3 py-3 text-left transition-colors shadow-sm backdrop-blur-sm",
                selectedEvents.includes(event.value)
                  ? "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-600 dark:bg-blue-900/20 dark:text-blue-200"
                  : "border-gray-200 bg-white/80 text-gray-900 hover:border-gray-300 dark:border-graphite-700 dark:bg-graphite-900/40 dark:hover:border-graphite-600 dark:text-graphite-50",
              )}
            >
              <div className="text-sm font-medium">{event.label}</div>
              <div className="mt-1 text-xs text-gray-500 dark:text-graphite-300">
                {event.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-4 text-sm text-blue-800 shadow-sm dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-200">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="h-4 w-4" />
            Tunnel Status
          </div>
          <p className="mt-2 text-xs leading-relaxed text-blue-700/80 dark:text-blue-200/80">
            Ensure your tunnel remains active to receive webhook callbacks from GitHub. Refresh the
            status if you recently restarted the tunnel service.
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white/80 p-4 text-sm text-gray-700 shadow-sm dark:border-graphite-700 dark:bg-graphite-900/40 dark:text-graphite-200">
          <div className="flex items-center gap-2 font-medium">
            <Github className="h-4 w-4" />
            Repository Guidance
          </div>
          <p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-graphite-300/80">
            Select the repository owner and name that should receive the automation webhook. Load
            projects from GitHub to browse available repositories.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4 dark:border-graphite-700">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            leftIcon={<RefreshCw className="h-4 w-4" />}
            onClick={listExistingWebhooks}
            disabled={isLoading || !repoOwner || !repoName}
          >
            List Existing
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            leftIcon={<Github className="h-4 w-4" />}
            onClick={createWebhook}
            disabled={isLoading || !tunnelUrl || !repoOwner || !repoName}
          >
            {isLoading ? "Creating…" : "Create Webhook"}
          </Button>
        </div>
      </div>

      {showExisting && (
        <div
          className={cn(
            ARTIFACT_PANEL_BODY_CLASS,
            "rounded-lg border border-gray-200/70 p-4 dark:border-graphite-700/60",
          )}
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-gray-900 dark:text-graphite-50">
                Existing Webhooks
              </h3>
              <p className="text-xs text-gray-500 dark:text-graphite-300">
                {existingWebhooks.length} webhook{existingWebhooks.length === 1 ? "" : "s"} found
                for
                {repoOwner ? ` ${repoOwner}/${repoName || ""}` : " this repository"}.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowExisting(false)}>
                Hide
              </Button>
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<RefreshCw className="h-4 w-4" />}
                onClick={listExistingWebhooks}
              >
                Refresh
              </Button>
            </div>
          </div>

          {existingWebhooks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300/70 bg-gray-50/70 p-4 text-sm text-gray-600 dark:border-graphite-700/60 dark:bg-graphite-900/40 dark:text-graphite-300">
              No webhooks found for this repository.
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-graphite-700">
              {existingWebhooks.map((webhook) => (
                <div
                  key={webhook.id}
                  className="flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-graphite-50">
                        {webhook.name || `Webhook ${webhook.id}`}
                      </span>
                      <StatusBadge variant={webhook.active ? "success" : "neutral"} size="xs">
                        {webhook.active ? "Active" : "Disabled"}
                      </StatusBadge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-graphite-300">
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span className="truncate">{webhook.url}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-graphite-300">
                      {webhook.events.map((event) => (
                        <span
                          key={event}
                          className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 dark:border-blue-600/70 dark:bg-blue-900/30"
                        >
                          {event}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<Copy className="h-4 w-4" />}
                      onClick={() => navigator.clipboard.writeText(webhook.url)}
                    >
                      Copy URL
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<Trash2 className="h-4 w-4" />}
                      onClick={() => deleteWebhook(webhook.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default WebhookAutomation;
