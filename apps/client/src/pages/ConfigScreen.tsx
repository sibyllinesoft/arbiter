/**
 * Config Screen - Global configuration for UI preferences and handler management
 */

import { ArrowLeft, Code, Settings } from 'lucide-react';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TunnelManager } from '../components/TunnelManager';
import { useApp, useAppSettings } from '../contexts/AppContext';
import { Button, Card, Checkbox, Input } from '../design-system';
import { apiService } from '../services/api';

interface LocalEnvironmentInfo {
  runtime: 'cloudflare' | 'node';
  cloudflareTunnelSupported: boolean;
}

export function ConfigScreen({
  isModal = false,
  onClose: _onClose,
}: {
  isModal?: boolean;
  onClose?: () => void;
}) {
  const navigate = useNavigate();
  const { settings, updateSettings } = useAppSettings();
  const { isDark, toggleTheme } = useApp();
  const [environment, setEnvironment] = useState<'unknown' | 'cloudflare' | 'node'>('unknown');

  void _onClose;

  useEffect(() => {
    let cancelled = false;

    apiService
      .getEnvironmentInfo()
      .then((info: LocalEnvironmentInfo) => {
        if (!cancelled) {
          setEnvironment(info.runtime);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEnvironment('node');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const isCloudflare = environment === 'cloudflare';

  return (
    <div
      className={
        isModal
          ? 'bg-white dark:bg-graphite-900'
          : 'min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-graphite-900 dark:to-graphite-950'
      }
    >
      {!isModal && (
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
                      Global settings and handler management
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>
      )}

      <main
        className={`max-w-${isModal ? '6' : '7'}xl mx-auto px-4 sm:px-6 lg:px-8 ${isModal ? 'py-0' : 'py-8'} scrollbar-transparent`}
      >
        <div className="space-y-8">
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
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Enable toast notifications for background tasks
                  </p>
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

          <Card className="p-6">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <Code className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    Default Project Structure
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Configure the directories Arbiter should use when generating code and assets.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Apps directory"
                placeholder="apps"
                value={settings.appsDirectory}
                onChange={event => updateSettings({ appsDirectory: event.target.value })}
                helperText="Location for frontends or operational apps."
              />
              <Input
                label="Packages directory"
                placeholder="packages"
                value={settings.packagesDirectory}
                onChange={event => updateSettings({ packagesDirectory: event.target.value })}
                helperText="Primary workspace for shared libraries and reusable modules."
              />
              <Input
                label="Services directory"
                placeholder="services"
                value={settings.servicesDirectory}
                onChange={event => updateSettings({ servicesDirectory: event.target.value })}
                helperText="Default location for backend or API services."
              />
              <Input
                label="Tests directory"
                placeholder="tests"
                value={settings.testsDirectory}
                onChange={event => updateSettings({ testsDirectory: event.target.value })}
                helperText="Where generated integration and scenario tests should live."
              />
              <Input
                label="Infrastructure directory"
                placeholder="infra"
                value={settings.infraDirectory}
                onChange={event => updateSettings({ infraDirectory: event.target.value })}
                helperText="Folder containing Terraform, Pulumi, or other infrastructure code."
              />
              <Input
                label="Default endpoint folder"
                placeholder="apps/api/src/endpoints"
                value={settings.endpointDirectory ?? ''}
                onChange={event => updateSettings({ endpointDirectory: event.target.value })}
                helperText="Base folder where generated API endpoint fragments should be written."
              />
            </div>
          </Card>

          {!isCloudflare && <TunnelManager />}
        </div>
      </main>
    </div>
  );
}

export default ConfigScreen;
