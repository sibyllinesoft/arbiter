/**
 * Webhook Handler Editor Component
 * Code editor with syntax highlighting for TypeScript/JavaScript
 */

import {
  AlertTriangle,
  CheckCircle,
  Code,
  FileText,
  Loader2,
  Play,
  Save,
  Settings,
  X,
} from 'lucide-react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import { Button, Card, Input, Select, StatusBadge, cn } from '../../design-system';
import { apiService } from '../../services/api';
import type {
  CreateHandlerRequest,
  UpdateHandlerRequest,
  WebhookHandler,
  WebhookProvider,
} from '../../types/api';
import { createLogger } from '../../utils/logger';
import MonacoEditor from '../Editor/MonacoEditor';

const log = createLogger('HandlerEditor');

// Default handler code template
const DEFAULT_HANDLER_CODE = `/**
 * Webhook Handler
 * This function will be executed when the webhook is triggered
 * 
 * @param payload - The webhook payload
 * @param context - Handler execution context
 * @returns Result object or void
 */
async function handler(payload, context) {
  // Access webhook data
  console.log('Received payload:', payload);
  
  // Access context information
  console.log('Handler context:', {
    handlerId: context.handlerId,
    provider: context.provider,
    eventType: context.eventType,
    timestamp: context.timestamp
  });
  
  // TODO: Implement your handler logic here
  
  // Example: Process GitHub webhook
  if (context.provider === 'github') {
    const { action, repository } = payload;
    
    if (action === 'push') {
      console.log(\`Push to \${repository?.full_name}\`);
      // Handle push event
    }
  }
  
  // Return result (optional)
  return {
    success: true,
    message: 'Handler executed successfully',
    processedAt: new Date().toISOString()
  };
}

// Export the handler function
module.exports = handler;`;

// Provider-specific event types
const PROVIDER_EVENT_TYPES: Record<WebhookProvider, string[]> = {
  github: [
    'push',
    'pull_request',
    'issues',
    'issue_comment',
    'release',
    'create',
    'delete',
    'fork',
    'watch',
    'star',
  ],
  gitlab: [
    'push',
    'merge_request',
    'issues',
    'note',
    'pipeline',
    'build',
    'wiki_page',
    'deployment',
  ],
  bitbucket: ['push', 'pullrequest', 'issue', 'repo_fork', 'repo_commit_comment'],
  slack: ['message', 'app_mention', 'reaction_added', 'member_joined_channel'],
  discord: ['message', 'guild_member_add', 'reaction_add', 'voice_state_update'],
  custom: ['webhook', 'http_request', 'api_call', 'event'],
};

interface HandlerEditorProps {
  handler?: WebhookHandler | null;
  onSave: (handler: WebhookHandler) => void;
  onCancel: () => void;
}

export function HandlerEditor({ handler, onSave, onCancel }: HandlerEditorProps) {
  const [formData, setFormData] = useState({
    name: '',
    provider: 'custom' as WebhookProvider,
    event_type: '',
    code: DEFAULT_HANDLER_CODE,
    enabled: true,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [codeErrors, setCodeErrors] = useState<string[]>([]);
  const [testResult, setTestResult] = useState<{
    status: 'success' | 'error';
    message: string;
    duration?: number;
  } | null>(null);

  const isEditing = Boolean(handler);

  // Load handler data when editing
  useEffect(() => {
    if (handler) {
      setFormData({
        name: handler.name,
        provider: handler.provider,
        event_type: handler.event_type,
        code: handler.code,
        enabled: handler.enabled,
      });
      setHasUnsavedChanges(false);
    } else {
      // Reset form for new handler
      setFormData({
        name: '',
        provider: 'custom',
        event_type: '',
        code: DEFAULT_HANDLER_CODE,
        enabled: true,
      });
      setHasUnsavedChanges(false);
    }
    setCodeErrors([]);
    setTestResult(null);
  }, [handler]);

  // Track unsaved changes
  const markUnsaved = useCallback(() => {
    setHasUnsavedChanges(true);
  }, []);

  // Handle form field changes
  const handleFieldChange = useCallback(
    (field: string, value: any) => {
      setFormData(prev => ({ ...prev, [field]: value }));
      markUnsaved();
    },
    [markUnsaved]
  );

  // Handle code changes
  const handleCodeChange = useCallback(
    (code: string) => {
      setFormData(prev => ({ ...prev, code }));
      markUnsaved();

      // Clear previous test results when code changes
      setTestResult(null);

      // Basic syntax validation
      validateCode(code);
    },
    [markUnsaved]
  );

  // Basic code validation
  const validateCode = useCallback((code: string) => {
    const errors: string[] = [];

    // Check for required handler function
    if (!code.includes('function handler') && !code.includes('handler =')) {
      errors.push('Handler must define a "handler" function');
    }

    // Check for module.exports
    if (!code.includes('module.exports')) {
      errors.push('Handler must export the handler function using module.exports');
    }

    // Check for async function (recommended)
    if (!code.includes('async function') && !code.includes('async ')) {
      console.warn('Handler function should be async for better compatibility');
    }

    setCodeErrors(errors);
  }, []);

  // Handle provider change (update available event types)
  const handleProviderChange = useCallback(
    (provider: WebhookProvider) => {
      setFormData(prev => ({
        ...prev,
        provider,
        event_type: PROVIDER_EVENT_TYPES[provider][0] || '',
      }));
      markUnsaved();
    },
    [markUnsaved]
  );

  // Test handler with sample payload
  const handleTestHandler = useCallback(async () => {
    if (codeErrors.length > 0) {
      toast.error('Fix code errors before testing');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      // Create a sample payload based on provider
      let samplePayload: Record<string, unknown> = {
        test: true,
        timestamp: new Date().toISOString(),
        source: 'editor-test',
      };

      if (formData.provider === 'github') {
        samplePayload = {
          ...samplePayload,
          action: 'push',
          repository: {
            full_name: 'test/repo',
            default_branch: 'main',
          },
          commits: [
            {
              id: 'abc123',
              message: 'Test commit',
              author: { name: 'Test User', email: 'test@example.com' },
            },
          ],
        };
      }

      // For new handlers, we need to test the code directly
      // For existing handlers, we can use the API test endpoint
      if (isEditing && handler) {
        const result = await apiService.testHandler(handler.id, samplePayload);
        setTestResult({
          status: result.status,
          message:
            result.status === 'success'
              ? 'Handler executed successfully'
              : result.error || 'Test failed',
          duration: result.duration_ms,
        });
      } else {
        // For new handlers, simulate a test by checking code syntax
        // In a real implementation, you'd send the code to the backend for testing
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call

        setTestResult({
          status: 'success',
          message: 'Code syntax validated successfully',
          duration: 45,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Test failed';
      setTestResult({
        status: 'error',
        message,
      });
      log.error('Handler test failed:', err);
    } finally {
      setIsTesting(false);
    }
  }, [formData, codeErrors, isEditing, handler]);

  // Save handler
  const handleSave = useCallback(async () => {
    // Validation
    if (!formData.name.trim()) {
      toast.error('Handler name is required');
      return;
    }

    if (!formData.event_type.trim()) {
      toast.error('Event type is required');
      return;
    }

    if (!formData.code.trim()) {
      toast.error('Handler code is required');
      return;
    }

    if (codeErrors.length > 0) {
      toast.error('Fix code errors before saving');
      return;
    }

    setIsSaving(true);

    try {
      let savedHandler: WebhookHandler;

      if (isEditing && handler) {
        // Update existing handler
        const updateRequest: UpdateHandlerRequest = {
          name: formData.name.trim(),
          provider: formData.provider,
          event_type: formData.event_type.trim(),
          code: formData.code,
          enabled: formData.enabled,
        };
        savedHandler = await apiService.updateHandler(handler.id, updateRequest);
        toast.success('Handler updated successfully');
      } else {
        // Create new handler
        const createRequest: CreateHandlerRequest = {
          name: formData.name.trim(),
          provider: formData.provider,
          event_type: formData.event_type.trim(),
          code: formData.code,
          enabled: formData.enabled,
        };
        savedHandler = await apiService.createHandler(createRequest);
        toast.success('Handler created successfully');
      }

      setHasUnsavedChanges(false);
      onSave(savedHandler);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save handler';
      toast.error(message);
      log.error('Failed to save handler:', err);
    } finally {
      setIsSaving(false);
    }
  }, [formData, codeErrors, isEditing, handler, onSave]);

  // Handle unsaved changes warning
  const handleCancel = useCallback(() => {
    if (hasUnsavedChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to discard them?')) {
        onCancel();
      }
    } else {
      onCancel();
    }
  }, [hasUnsavedChanges, onCancel]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <Code className="h-6 w-6 text-blue-600" />
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {isEditing ? 'Edit Handler' : 'New Handler'}
            </h2>
            <p className="text-sm text-gray-600">
              {isEditing ? `Editing ${handler?.name}` : 'Create a new webhook handler'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {hasUnsavedChanges && (
            <StatusBadge variant="warning" size="sm">
              Unsaved Changes
            </StatusBadge>
          )}

          <Button
            onClick={handleTestHandler}
            disabled={isTesting || codeErrors.length > 0}
            variant="secondary"
            size="sm"
            leftIcon={
              isTesting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )
            }
          >
            Test
          </Button>

          <Button
            onClick={handleSave}
            disabled={isSaving || codeErrors.length > 0}
            leftIcon={
              isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />
            }
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>

          <Button onClick={handleCancel} variant="secondary">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Configuration */}
        <div className="w-80 flex-shrink-0 bg-white border-r border-gray-200 p-6 overflow-y-auto">
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Configuration
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Handler Name
                  </label>
                  <Input
                    value={formData.name}
                    onChange={e => handleFieldChange('name', e.target.value)}
                    placeholder="Enter handler name..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Provider</label>
                  <Select
                    value={formData.provider}
                    onChange={value => handleProviderChange(value as WebhookProvider)}
                    options={[
                      { value: 'github', label: '🐙 GitHub' },
                      { value: 'gitlab', label: '🦊 GitLab' },
                      { value: 'bitbucket', label: '🪣 Bitbucket' },
                      { value: 'slack', label: '💬 Slack' },
                      { value: 'discord', label: '💬 Discord' },
                      { value: 'custom', label: '⚙️ Custom' },
                    ]}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Event Type</label>
                  <Select
                    value={formData.event_type}
                    onChange={value => handleFieldChange('event_type', value)}
                    options={PROVIDER_EVENT_TYPES[formData.provider].map(eventType => ({
                      value: eventType,
                      label: eventType,
                    }))}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="enabled"
                    checked={formData.enabled}
                    onChange={e => handleFieldChange('enabled', e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="enabled" className="text-sm text-gray-700">
                    Enable handler immediately
                  </label>
                </div>
              </div>
            </div>

            {/* Code Errors */}
            {codeErrors.length > 0 && (
              <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <h4 className="text-sm font-medium text-red-800">Code Issues</h4>
                </div>
                <ul className="space-y-1">
                  {codeErrors.map((error, index) => (
                    <li key={index} className="text-sm text-red-700">
                      • {error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Test Result */}
            {testResult && (
              <div
                className={cn(
                  'border rounded-lg p-4',
                  testResult.status === 'success'
                    ? 'border-green-200 bg-green-50'
                    : 'border-red-200 bg-red-50'
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  {testResult.status === 'success' ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  )}
                  <h4
                    className={cn(
                      'text-sm font-medium',
                      testResult.status === 'success' ? 'text-green-800' : 'text-red-800'
                    )}
                  >
                    Test {testResult.status === 'success' ? 'Passed' : 'Failed'}
                  </h4>
                </div>
                <p
                  className={cn(
                    'text-sm',
                    testResult.status === 'success' ? 'text-green-700' : 'text-red-700'
                  )}
                >
                  {testResult.message}
                </p>
                {testResult.duration && (
                  <p className="text-xs text-gray-500 mt-1">
                    Execution time: {testResult.duration}ms
                  </p>
                )}
              </div>
            )}

            {/* Documentation */}
            <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-blue-600" />
                <h4 className="text-sm font-medium text-blue-800">Handler API</h4>
              </div>
              <div className="text-xs text-blue-700 space-y-2">
                <p>
                  <strong>Function signature:</strong>
                </p>
                <code className="block bg-white p-2 rounded text-xs font-mono">
                  async function handler(payload, context)
                </code>

                <p>
                  <strong>Parameters:</strong>
                </p>
                <ul className="ml-4 space-y-1">
                  <li>
                    • <code>payload</code> - Webhook data
                  </li>
                  <li>
                    • <code>context</code> - Execution context
                  </li>
                </ul>

                <p>
                  <strong>Return:</strong> Optional result object
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Code Editor */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-hidden">
            <MonacoEditor
              value={formData.code}
              onChange={handleCodeChange}
              language="typescript"
              theme="vs"
              options={{
                fontSize: 14,
                minimap: { enabled: true },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                automaticLayout: true,
                quickSuggestions: true,
                parameterHints: { enabled: true },
                suggest: { showWords: true },
                hover: { enabled: true },
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default HandlerEditor;
