/**
 * Config Screen - Webhook and handler configuration
 */

import {
  AlertCircle,
  ArrowLeft,
  Code,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Save,
  Settings,
  Trash2,
  Webhook,
} from 'lucide-react';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { TunnelManager } from '../components/TunnelManager';
import { WebhookAutomation } from '../components/WebhookAutomation';
import { useApp, useAppSettings } from '../contexts/AppContext';
import { Button, Card, Checkbox, Input, StatusBadge, cn } from '../design-system';
import { useHandlers } from '../hooks/api-hooks';
import { apiService } from '../services/api';

interface WebhookConfig {
  url: string;
  secret: string;
  enabled: boolean;
  events: string[];
}

export function ConfigScreen({
  isModal = false,
  onClose,
}: {
  isModal?: boolean;
  onClose?: () => void;
}) {
  const navigate = useNavigate();
  const { data: handlers, isLoading: handlersLoading, refetch: refetchHandlers } = useHandlers();
  const { settings, updateSettings } = useAppSettings();
  const { isDark, toggleTheme } = useApp();

  const [webhookConfigs, setWebhookConfigs] = useState<Record<string, WebhookConfig>>({
    github: {
      url: 'http://localhost:3001/webhooks/github',
      secret: '',
      enabled: true,
      events: ['push', 'pull_request', 'issues'],
    },
    gitlab: {
      url: 'http://localhost:3001/webhooks/gitlab',
      secret: '',
      enabled: false,
      events: ['push', 'merge_requests', 'issues'],
    },
  });

  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [tunnelUrl, setTunnelUrl] = useState<string | null>(null);

  // Load webhook configurations from localStorage or defaults
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const saved = window.localStorage.getItem('webhookConfigs');
      if (saved) {
        setWebhookConfigs(JSON.parse(saved));
      }
    } catch (error) {
      console.warn('Failed to load webhookConfigs from localStorage', error);
      try {
        window.localStorage.removeItem('webhookConfigs');
      } catch (removeError) {
        console.warn('Failed to remove webhookConfigs from localStorage', removeError);
      }
    }
  }, []);

  const handleWebhookConfigChange = (provider: string, field: string, value: any) => {
    setWebhookConfigs(prev => {
      const current = prev[provider] || { url: '', secret: '', enabled: false, events: [] };
      return {
        ...prev,
        [provider]: {
          ...current,
          [field]: value,
        },
      };
    });
  };

  const handleEventToggle = (provider: string, event: string) => {
    setWebhookConfigs(prev => {
      const currentConfig = prev[provider] || { url: '', secret: '', enabled: false, events: [] };
      const currentEvents = currentConfig.events || [];
      const newEvents = currentEvents.includes(event)
        ? currentEvents.filter(e => e !== event)
        : [...currentEvents, event];

      return {
        ...prev,
        [provider]: {
          ...currentConfig,
          events: newEvents,
        },
      };
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
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
        timestamp: new Date().toISOString(),
      };

      // Provider-specific headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (provider === 'github') {
        headers['X-GitHub-Event'] = 'ping';
        headers['X-Hub-Signature-256'] = 'sha256=test';
      } else if (provider === 'gitlab') {
        headers['X-Gitlab-Event'] = 'System Hook';
      }

      const response = await fetch(config.url, {
        method: 'POST',
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
        `Failed to test ${provider} webhook: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };

  const saveConfiguration = async () => {
    setIsSaving(true);
    try {
      // Persist to localStorage (in real app, save to API via apiService.updateWebhookConfigs)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('webhookConfigs', JSON.stringify(webhookConfigs));
      }
      toast.success('Configuration saved successfully');
    } catch (error) {
      toast.error('Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleHandler = async (handlerId: string, enabled: boolean) => {
    try {
      await apiService.toggleHandler(handlerId, enabled);
      toast.success(`Handler ${enabled ? 'enabled' : 'disabled'}`);
      refetchHandlers();
    } catch (error) {
      toast.error('Failed to toggle handler');
    }
  };

  const deleteHandler = async (handlerId: string) => {
    if (!confirm('Are you sure you want to delete this handler?')) return;

    try {
      await apiService.deleteHandler(handlerId);
      toast.success('Handler deleted');
      refetchHandlers();
    } catch (error) {
      toast.error('Failed to delete handler');
    }
  };

  return (
    <div
      className={
        !isModal
          ? 'min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-graphite-900 dark:to-graphite-950'
          : ''
      }
    >
      {!isModal && (
        <>
          {/* Header */}
          <header className="bg-white dark:bg-graphite-900 border-b border-gray-200 dark:border-graphite-700 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <div className="flex items-center gap-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<ArrowLeft className="w-4 h-4" />}
                    onClick={() => navigate('/')}
                  >
                    Back to Dashboard
                  </Button>

                  <div className="w-px h-6 bg-gray-300 dark:bg-graphite-600" />

                  <div className="flex items-center gap-3">
                    <Settings className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                    <div>
                      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                        Configuration
                      </h1>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Webhook and handler settings
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Save className="w-4 h-4" />}
                  onClick={saveConfiguration}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </header>
        </>
      )}

      {/* Main Content */}
      <main
        className={`max-w-${isModal ? '6' : '7'}xl mx-auto px-4 sm:px-6 lg:px-8 ${isModal ? 'py-0' : 'py-8'}`}
      >
        <div className="space-y-8">
          {/* UI Settings */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Settings className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                UI Settings
              </h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Show Async Notifications
                  </h3>
                </div>
                <div className="flex items-center gap-6">
                  <Checkbox
                    checked={settings.showNotifications}
                    onChange={e => updateSettings({ showNotifications: e.target.checked })}
                    label={settings.showNotifications ? 'Enabled' : 'Disabled'}
                  />
                  <button
                    onClick={toggleTheme}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-graphite-700 transition-colors"
                    title="Toggle theme"
                  >
                    {isDark ? (
                      <Sun className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    ) : (
                      <Moon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </Card>

          {/* Tunnel Management */}
          <TunnelManager onTunnelUrlChange={setTunnelUrl} />

          {/* Webhook Automation */}
          <WebhookAutomation tunnelUrl={tunnelUrl || ''} />

          {/* Webhook Configuration */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Webhook className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Webhook Configuration
              </h2>
            </div>

            <div className="grid gap-6">
              {Object.entries(webhookConfigs).map(([provider, config]) => (
                <div
                  key={provider}
                  className="border border-gray-200 dark:border-graphite-700 rounded-lg p-6 bg-white dark:bg-graphite-800"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 capitalize">
                        {provider}
                      </h3>
                      <StatusBadge variant={config.enabled ? 'success' : 'neutral'} size="sm">
                        {config.enabled ? 'Enabled' : 'Disabled'}
                      </StatusBadge>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<Play className="w-4 h-4" />}
                        onClick={() => testWebhook(provider)}
                      >
                        Test
                      </Button>

                      <Button
                        variant={config.enabled ? 'secondary' : 'primary'}
                        size="sm"
                        leftIcon={
                          config.enabled ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )
                        }
                        onClick={() =>
                          handleWebhookConfigChange(provider, 'enabled', !config.enabled)
                        }
                      >
                        {config.enabled ? 'Disable' : 'Enable'}
                      </Button>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Webhook URL
                      </label>
                      <div className="flex gap-2">
                        <Input
                          value={config.url}
                          onChange={e => handleWebhookConfigChange(provider, 'url', e.target.value)}
                          className="flex-1"
                          disabled={!config.enabled}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<Copy className="w-4 h-4" />}
                          onClick={() => copyToClipboard(config.url)}
                        >
                          Copy
                        </Button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Secret
                      </label>
                      <div className="flex gap-2">
                        <Input
                          type={showSecrets[provider] ? 'text' : 'password'}
                          value={config.secret}
                          onChange={e =>
                            handleWebhookConfigChange(provider, 'secret', e.target.value)
                          }
                          placeholder="Enter webhook secret..."
                          className="flex-1"
                          disabled={!config.enabled}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={
                            showSecrets[provider] ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )
                          }
                          onClick={() =>
                            setShowSecrets(prev => ({ ...prev, [provider]: !prev[provider] }))
                          }
                        >
                          {showSecrets[provider] ? 'Hide' : 'Show'}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Events
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {['push', 'pull_request', 'merge_requests', 'issues', 'releases'].map(
                        event => (
                          <button
                            key={event}
                            onClick={() => handleEventToggle(provider, event)}
                            disabled={!config.enabled}
                            className={cn(
                              'px-3 py-1 text-sm rounded-full border transition-colors',
                              (config.events || []).includes(event)
                                ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300'
                                : 'bg-gray-100 dark:bg-graphite-700 border-gray-300 dark:border-graphite-600 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-graphite-600',
                              !config.enabled && 'opacity-50 cursor-not-allowed'
                            )}
                          >
                            {event.replace('_', ' ')}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-medium mb-1">Webhook Setup Instructions</p>
                  <ol className="list-decimal list-inside space-y-1 text-blue-700 dark:text-blue-300">
                    <li>Copy the webhook URL for your provider</li>
                    <li>Go to your repository settings → Webhooks</li>
                    <li>Add a new webhook with the copied URL</li>
                    <li>Set the secret and select events to monitor</li>
                    <li>Test the webhook to ensure it's working</li>
                  </ol>
                </div>
              </div>
            </div>
          </Card>

          {/* Handler Management */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Code className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Webhook Handlers
                </h2>
                <StatusBadge variant="info" size="sm">
                  {handlers?.length || 0} handlers
                </StatusBadge>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<RefreshCw className="w-4 h-4" />}
                  onClick={() => refetchHandlers()}
                  disabled={handlersLoading}
                >
                  Refresh
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="w-4 h-4" />}
                  onClick={() => navigate('/handlers/new')}
                >
                  New Handler
                </Button>
              </div>
            </div>

            {handlersLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
                <p className="text-gray-500 dark:text-gray-400">Loading handlers...</p>
              </div>
            ) : handlers && handlers.length > 0 ? (
              <div className="space-y-4">
                {handlers.map(handler => (
                  <div
                    key={handler.id}
                    className="border border-gray-200 dark:border-graphite-700 rounded-lg p-4 bg-white dark:bg-graphite-800"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <StatusBadge variant={handler.enabled ? 'success' : 'neutral'} size="sm">
                          {handler.enabled ? 'Active' : 'Inactive'}
                        </StatusBadge>

                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">
                            {handler.name || handler.id}
                          </h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {handler.description || 'No description provided'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<ExternalLink className="w-4 h-4" />}
                        >
                          View
                        </Button>

                        <Button
                          variant={handler.enabled ? 'secondary' : 'primary'}
                          size="sm"
                          leftIcon={
                            handler.enabled ? (
                              <Pause className="w-4 h-4" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )
                          }
                          onClick={() => toggleHandler(handler.id, !handler.enabled)}
                        >
                          {handler.enabled ? 'Disable' : 'Enable'}
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<Trash2 className="w-4 h-4" />}
                          onClick={() => deleteHandler(handler.id)}
                          className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>

                    {handler.metadata && (
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-graphite-700">
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Events:</span>
                            <span className="ml-2 text-gray-900 dark:text-gray-100">
                              {handler.events?.join(', ') || 'All'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Timeout:</span>
                            <span className="ml-2 text-gray-900 dark:text-gray-100">
                              {handler.timeout || 30}s
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Retries:</span>
                            <span className="ml-2 text-gray-900 dark:text-gray-100">
                              {handler.retries || 2}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <Code className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                <p className="text-lg font-medium mb-2">No Handlers Configured</p>
                <p className="text-sm mb-4">Create your first webhook handler to get started</p>
                <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />}>
                  Create Handler
                </Button>
              </div>
            )}
          </Card>
        </div>
      </main>
      {isModal && (
        <div className="bg-white dark:bg-graphite-900 border-t border-gray-200 dark:border-graphite-700 p-6 flex justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Save className="w-4 h-4" />}
            onClick={saveConfiguration}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      )}
    </div>
  );
}
