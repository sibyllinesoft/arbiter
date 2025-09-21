/**
 * Config Screen - Webhook and handler configuration
 */

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Webhook,
  Code,
  Save,
  ArrowLeft,
  Plus,
  Trash2,
  Play,
  Pause,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Copy,
  RefreshCw,
} from 'lucide-react';
import { Button, Card, Input, StatusBadge, cn } from '../design-system';
import { useHandlers } from '../hooks/api-hooks';
import { apiService } from '../services/api';
import { toast } from 'react-toastify';
import { useAppSettings } from '../contexts/AppContext';
import { TunnelManager } from '../components/TunnelManager';
import { WebhookAutomation } from '../components/WebhookAutomation';

interface ConfigScreenProps {
  onNavigateBack: () => void;
}

interface WebhookConfig {
  url: string;
  secret: string;
  enabled: boolean;
  events: string[];
}

export function ConfigScreen({ onNavigateBack }: ConfigScreenProps) {
  const { data: handlers, isLoading: handlersLoading, refetch: refetchHandlers } = useHandlers();
  const { settings, updateSettings } = useAppSettings();

  const [webhookConfigs, setWebhookConfigs] = useState<Record<string, WebhookConfig>>({
    github: {
      url: 'https://your-tunnel.cfargotunnel.com/webhooks/github',
      secret: '',
      enabled: true,
      events: ['push', 'pull_request', 'issues'],
    },
    gitlab: {
      url: 'https://your-tunnel.cfargotunnel.com/webhooks/gitlab',
      secret: '',
      enabled: false,
      events: ['push', 'merge_requests', 'issues'],
    },
  });

  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [tunnelUrl, setTunnelUrl] = useState<string | null>(null);

  // Load webhook configurations (in real app, from API)
  useEffect(() => {
    // This would typically load from API
    // For now, we use environment-based defaults
  }, []);

  const handleWebhookConfigChange = (provider: string, field: string, value: any) => {
    setWebhookConfigs(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        [field]: value,
      },
    }));
  };

  const handleEventToggle = (provider: string, event: string) => {
    setWebhookConfigs(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        events: prev[provider].events.includes(event)
          ? prev[provider].events.filter(e => e !== event)
          : [...prev[provider].events, event],
      },
    }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const testWebhook = async (provider: string) => {
    try {
      const testPayload = {
        test: true,
        provider,
        timestamp: new Date().toISOString(),
      };

      const response = await fetch(`/webhooks/${provider}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': 'sha256=test',
        },
        body: JSON.stringify(testPayload),
      });

      if (response.ok) {
        toast.success(`${provider} webhook test successful`);
      } else {
        toast.error(`${provider} webhook test failed`);
      }
    } catch (error) {
      toast.error(`Failed to test ${provider} webhook`);
    }
  };

  const saveConfiguration = async () => {
    setIsSaving(true);
    try {
      // In real app, save to API
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<ArrowLeft className="w-4 h-4" />}
                onClick={onNavigateBack}
              >
                Back to Dashboard
              </Button>

              <div className="w-px h-6 bg-gray-300" />

              <div className="flex items-center gap-3">
                <Settings className="w-6 h-6 text-gray-600" />
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">Configuration</h1>
                  <p className="text-sm text-gray-500">Webhook and handler settings</p>
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* UI Settings */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Settings className="w-6 h-6 text-gray-600" />
              <h2 className="text-xl font-semibold text-gray-900">UI Settings</h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">Show Async Notifications</h3>
                  <p className="text-sm text-gray-500">
                    Display toast notifications for webhook events and handler executions
                  </p>
                </div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.showNotifications}
                    onChange={e => updateSettings({ showNotifications: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    {settings.showNotifications ? 'Enabled' : 'Disabled'}
                  </span>
                </label>
              </div>
            </div>
          </Card>

          {/* Tunnel Management */}
          <TunnelManager onTunnelUrlChange={setTunnelUrl} />

          {/* Webhook Automation */}
          <WebhookAutomation tunnelUrl={tunnelUrl} />

          {/* Webhook Configuration */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Webhook className="w-6 h-6 text-gray-600" />
              <h2 className="text-xl font-semibold text-gray-900">Webhook Configuration</h2>
            </div>

            <div className="grid gap-6">
              {Object.entries(webhookConfigs).map(([provider, config]) => (
                <div key={provider} className="border border-gray-200 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-medium text-gray-900 capitalize">{provider}</h3>
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">Secret</label>
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">Events</label>
                    <div className="flex flex-wrap gap-2">
                      {['push', 'pull_request', 'merge_requests', 'issues', 'releases'].map(
                        event => (
                          <button
                            key={event}
                            onClick={() => handleEventToggle(provider, event)}
                            disabled={!config.enabled}
                            className={cn(
                              'px-3 py-1 text-sm rounded-full border transition-colors',
                              config.events.includes(event)
                                ? 'bg-blue-100 border-blue-300 text-blue-700'
                                : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200',
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

            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Webhook Setup Instructions</p>
                  <ol className="list-decimal list-inside space-y-1 text-blue-700">
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
                <Code className="w-6 h-6 text-gray-600" />
                <h2 className="text-xl font-semibold text-gray-900">Webhook Handlers</h2>
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

                <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />}>
                  New Handler
                </Button>
              </div>
            </div>

            {handlersLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-500">Loading handlers...</p>
              </div>
            ) : handlers && handlers.length > 0 ? (
              <div className="space-y-4">
                {handlers.map(handler => (
                  <div key={handler.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <StatusBadge variant={handler.enabled ? 'success' : 'neutral'} size="sm">
                          {handler.enabled ? 'Active' : 'Inactive'}
                        </StatusBadge>

                        <div>
                          <h4 className="font-medium text-gray-900">
                            {handler.name || handler.id}
                          </h4>
                          <p className="text-sm text-gray-500">
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
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>

                    {handler.metadata && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Events:</span>
                            <span className="ml-2 text-gray-900">
                              {handler.events?.join(', ') || 'All'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Timeout:</span>
                            <span className="ml-2 text-gray-900">{handler.timeout || 30}s</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Retries:</span>
                            <span className="ml-2 text-gray-900">{handler.retries || 2}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Code className="w-12 h-12 mx-auto mb-4 text-gray-300" />
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
    </div>
  );
}
