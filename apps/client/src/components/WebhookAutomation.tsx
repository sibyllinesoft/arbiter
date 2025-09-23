/**
 * Webhook Automation Component - Automated GitHub webhook setup
 */

import {
  AlertCircle,
  CheckCircle,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  GitBranch,
  Github,
  Loader,
  Play,
  RefreshCw,
  Settings,
  Trash2,
  Zap,
} from 'lucide-react';
import React, { useState, useCallback } from 'react';
import CreatableSelect from 'react-select/creatable';
import { toast } from 'react-toastify';
import { Button, Card, Input, StatusBadge, cn } from '../design-system';
import { apiService } from '../services/api';

interface GitHubWebhook {
  id: number;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
  };
  clone_url: string;
  description: string | null;
  private: boolean;
}

interface GitHubOrg {
  login: string;
  id: number;
  description: string | null;
}

interface WebhookAutomationProps {
  className?: string;
  tunnelUrl?: string;
}

export function WebhookAutomation({ className, tunnelUrl }: WebhookAutomationProps) {
  const [repoOwner, setRepoOwner] = useState('');
  const [repoName, setRepoName] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['push', 'pull_request']);
  const [showSecret, setShowSecret] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [existingWebhooks, setExistingWebhooks] = useState<GitHubWebhook[]>([]);
  const [showExisting, setShowExisting] = useState(false);

  // GitHub projects state
  const [gitHubRepos, setGitHubRepos] = useState<GitHubRepo[]>([]);
  const [gitHubOrgs, setGitHubOrgs] = useState<GitHubOrg[]>([]);
  const [isLoadingGitHub, setIsLoadingGitHub] = useState(false);

  const availableEvents = [
    { value: 'push', label: 'Push', description: 'Code pushed to repository' },
    { value: 'pull_request', label: 'Pull Request', description: 'PR opened, closed, or updated' },
    { value: 'issues', label: 'Issues', description: 'Issues opened, closed, or updated' },
    { value: 'release', label: 'Release', description: 'Release published or updated' },
    { value: 'deployment', label: 'Deployment', description: 'Deployment created' },
    {
      value: 'workflow_run',
      label: 'Workflow Run',
      description: 'GitHub Actions workflow completed',
    },
  ];

  const toggleEvent = (event: string) => {
    setSelectedEvents(prev =>
      prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
    );
  };

  const listExistingWebhooks = useCallback(async () => {
    if (!repoOwner || !repoName) {
      toast.error('Please enter repository owner and name');
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
        toast.error(response.error || 'Failed to list webhooks');
      }
    } catch (error) {
      toast.error('Failed to list webhooks');
      console.error('List webhooks error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [repoOwner, repoName]);

  const createWebhook = async () => {
    if (!repoOwner || !repoName) {
      toast.error('Please enter repository owner and name');
      return;
    }

    if (!tunnelUrl) {
      toast.error('Tunnel must be running to create webhook');
      return;
    }

    if (selectedEvents.length === 0) {
      toast.error('Please select at least one event');
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
        toast.success(response.message || 'Webhook created successfully!');

        // Auto-refresh the existing webhooks list
        if (showExisting) {
          await listExistingWebhooks();
        }
      } else {
        toast.error(response.error || 'Failed to create webhook');
      }
    } catch (error) {
      toast.error('Failed to create webhook');
      console.error('Create webhook error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteWebhook = async (webhookId: number) => {
    if (!confirm('Are you sure you want to delete this webhook?')) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiService.deleteGitHubWebhook(repoOwner, repoName, webhookId);
      if (response.success) {
        toast.success(response.message || 'Webhook deleted successfully');
        // Refresh the list
        await listExistingWebhooks();
      } else {
        toast.error(response.error || 'Failed to delete webhook');
      }
    } catch (error) {
      toast.error('Failed to delete webhook');
      console.error('Delete webhook error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const copyWebhookUrl = () => {
    if (tunnelUrl) {
      const webhookUrl = `${tunnelUrl}/webhooks/github`;
      navigator.clipboard.writeText(webhookUrl);
      toast.success('Webhook URL copied to clipboard');
    }
  };

  const generateRandomSecret = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setWebhookSecret(result);
    toast.success('Random secret generated');
  };

  const handleLoadGitHubProjects = async () => {
    setIsLoadingGitHub(true);
    try {
      const [reposResult, orgsResult] = await Promise.all([
        apiService.getGitHubUserRepos(),
        apiService.getGitHubUserOrgs(),
      ]);

      let allRepos: GitHubRepo[] = [];

      if (reposResult.success && reposResult.repositories) {
        allRepos = [...(reposResult.repositories as GitHubRepo[])];
      }

      if (orgsResult.success && orgsResult.organizations) {
        setGitHubOrgs(orgsResult.organizations as GitHubOrg[]);

        // Load repos for each org
        for (const org of orgsResult.organizations) {
          try {
            const orgReposResult = await apiService.getGitHubOrgRepos(org.login);
            if (orgReposResult.success && orgReposResult.repositories) {
              allRepos = [...allRepos, ...(orgReposResult.repositories as GitHubRepo[])];
            }
          } catch (error) {
            console.warn(`Failed to load repos for org ${org.login}:`, error);
          }
        }
      }

      setGitHubRepos(allRepos);

      if (!reposResult.success) {
        toast.error(reposResult.error || 'Failed to load GitHub repositories');
      } else {
        toast.success(`Loaded ${allRepos.length} repositories`);
      }
    } catch (error) {
      console.error('Failed to load GitHub projects:', error);
      toast.error('Failed to load GitHub projects');
    } finally {
      setIsLoadingGitHub(false);
    }
  };

  return (
    <Card className={cn('p-6', className)}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Zap className="w-6 h-6 text-gray-600" />
          <h2 className="text-xl font-semibold text-gray-900">Webhook Automation</h2>
          <StatusBadge variant={tunnelUrl ? 'success' : 'neutral'} size="sm">
            {tunnelUrl ? 'Ready' : 'Waiting for tunnel'}
          </StatusBadge>
        </div>
        <Button
          onClick={handleLoadGitHubProjects}
          disabled={isLoadingGitHub}
          size="sm"
          variant="outline"
        >
          {isLoadingGitHub ? (
            <>
              <Loader className="w-4 h-4 mr-2 animate-spin" />
              Loading...
            </>
          ) : (
            <>
              <GitBranch className="w-4 h-4 mr-2" />
              Load Projects
            </>
          )}
        </Button>
      </div>

      {/* Repository Configuration */}
      <div className="space-y-4 mb-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Repository Owner</label>
            <CreatableSelect
              value={repoOwner ? { value: repoOwner, label: repoOwner } : null}
              onChange={option => {
                setRepoOwner(option?.value || '');
                setRepoName(''); // Reset repo name when owner changes
              }}
              onCreateOption={inputValue => {
                setRepoOwner(inputValue);
                setRepoName('');
              }}
              options={Array.from(new Set(gitHubRepos.map(r => r.owner.login))).map(owner => ({
                value: owner,
                label: owner,
              }))}
              isSearchable
              isClearable
              placeholder="Select or type owner..."
              className="react-select-container"
              classNamePrefix="react-select"
              styles={{
                control: base => ({
                  ...base,
                  minHeight: '36px',
                  backgroundColor: 'white',
                  borderColor: '#e5e7eb',
                  '&:hover': {
                    borderColor: '#d1d5db',
                  },
                }),
                menu: base => ({
                  ...base,
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                }),
                option: (base, state) => ({
                  ...base,
                  backgroundColor: state.isFocused ? '#f3f4f6' : 'transparent',
                  '&:hover': {
                    backgroundColor: '#f3f4f6',
                  },
                }),
              }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Repository Name</label>
            <CreatableSelect
              value={repoName ? { value: repoName, label: repoName } : null}
              onChange={option => {
                setRepoName(option?.value || '');
              }}
              onCreateOption={inputValue => {
                setRepoName(inputValue);
              }}
              options={gitHubRepos
                .filter(r => !repoOwner || r.owner.login === repoOwner)
                .map(r => ({ value: r.name, label: r.name }))}
              isSearchable
              isClearable
              isDisabled={!repoOwner}
              placeholder={repoOwner ? 'Select or type repository...' : 'Select owner first...'}
              className="react-select-container"
              classNamePrefix="react-select"
              styles={{
                control: (base, state) => ({
                  ...base,
                  minHeight: '36px',
                  backgroundColor: 'white',
                  borderColor: '#e5e7eb',
                  opacity: state.isDisabled ? 0.5 : 1,
                  '&:hover': {
                    borderColor: '#d1d5db',
                  },
                }),
                menu: base => ({
                  ...base,
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                }),
                option: (base, state) => ({
                  ...base,
                  backgroundColor: state.isFocused ? '#f3f4f6' : 'transparent',
                  '&:hover': {
                    backgroundColor: '#f3f4f6',
                  },
                }),
              }}
            />
            {gitHubRepos.length > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                {gitHubRepos.length} repositories loaded
              </p>
            )}
          </div>
        </div>

        {/* Webhook Secret */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Webhook Secret</label>
          <div className="flex gap-2">
            <Input
              type={showSecret ? 'text' : 'password'}
              value={webhookSecret}
              onChange={e => setWebhookSecret(e.target.value)}
              placeholder="Enter or generate a secure secret..."
              className="flex-1"
            />
            <Button
              variant="ghost"
              size="sm"
              leftIcon={showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              onClick={() => setShowSecret(!showSecret)}
            >
              {showSecret ? 'Hide' : 'Show'}
            </Button>
            <Button variant="secondary" size="sm" onClick={generateRandomSecret}>
              Generate
            </Button>
          </div>
        </div>

        {/* Webhook URL Preview */}
        {tunnelUrl && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Webhook URL (auto-generated)
            </label>
            <div className="flex gap-2">
              <Input
                value={`${tunnelUrl}/webhooks/github`}
                readOnly
                className="flex-1 bg-gray-50"
              />
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Copy className="w-4 h-4" />}
                onClick={copyWebhookUrl}
              >
                Copy
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Event Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">Events to Monitor</label>
        <div className="grid md:grid-cols-2 gap-2">
          {availableEvents.map(event => (
            <button
              key={event.value}
              onClick={() => toggleEvent(event.value)}
              className={cn(
                'p-3 text-left border rounded-lg transition-colors',
                selectedEvents.includes(event.value)
                  ? 'border-blue-300 bg-blue-50 text-blue-900'
                  : 'border-gray-200 hover:border-gray-300 text-gray-900'
              )}
            >
              <div className="font-medium text-sm">{event.label}</div>
              <div className="text-xs text-gray-500 mt-1">{event.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between mb-6 pt-4 border-t border-gray-200">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            leftIcon={<RefreshCw className="w-4 h-4" />}
            onClick={listExistingWebhooks}
            disabled={isLoading || !repoOwner || !repoName}
          >
            List Existing
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            leftIcon={<Github className="w-4 h-4" />}
            onClick={createWebhook}
            disabled={isLoading || !tunnelUrl || !repoOwner || !repoName}
          >
            {isLoading ? 'Creating...' : 'Create Webhook'}
          </Button>
        </div>
      </div>

      {/* Status Messages */}
      {!tunnelUrl && (
        <div className="mb-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium mb-1">Tunnel Required</p>
              <p>Start the Cloudflare tunnel above to enable webhook creation.</p>
            </div>
          </div>
        </div>
      )}

      {/* Existing Webhooks */}
      {showExisting && existingWebhooks.length > 0 && (
        <div className="border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h3 className="font-medium text-gray-900">Existing Webhooks</h3>
            <StatusBadge variant="info" size="sm">
              {existingWebhooks.length} found
            </StatusBadge>
          </div>
          <div className="space-y-0">
            {existingWebhooks.map((webhook, index) => (
              <div
                key={webhook.id}
                className={cn(
                  'p-4 flex items-center justify-between',
                  index < existingWebhooks.length - 1 && 'border-b border-gray-200'
                )}
              >
                <div className="flex items-center gap-3">
                  <StatusBadge variant={webhook.active ? 'success' : 'neutral'} size="sm">
                    {webhook.active ? 'Active' : 'Inactive'}
                  </StatusBadge>
                  <div>
                    <div className="font-medium text-sm text-gray-900">
                      {webhook.name || `Webhook ${webhook.id}`}
                    </div>
                    <div className="text-xs text-gray-500">Events: {webhook.events.join(', ')}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      Created: {new Date(webhook.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<ExternalLink className="w-4 h-4" />}
                    onClick={() => window.open(webhook.url, '_blank')}
                  >
                    View
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<Trash2 className="w-4 h-4" />}
                    onClick={() => deleteWebhook(webhook.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showExisting && existingWebhooks.length === 0 && (
        <div className="text-center py-8 text-gray-500 border border-gray-200 rounded-lg">
          <Github className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No existing webhooks found for this repository</p>
        </div>
      )}

      {/* Information Panel */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Automated Setup</p>
            <ul className="list-disc list-inside space-y-1 text-blue-700">
              <li>Requires a GitHub token in your environment (GITHUB_TOKEN)</li>
              <li>Creates webhook automatically using GitHub's REST API</li>
              <li>Configures proper payload URL and content type</li>
              <li>Sets up HMAC SHA-256 signature verification</li>
              <li>You can manage webhooks here or in GitHub repository settings</li>
            </ul>
          </div>
        </div>
      </div>
    </Card>
  );
}
