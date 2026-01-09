/**
 * Config Screen - Global configuration for UI preferences and handler management
 */

import { ArrowLeft, Code, Settings } from "lucide-react";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TunnelManager } from "../components/io/TunnelManager";
import { type AppSettings, useAppSettings, useThemeControls } from "../contexts/AppContext";
import { Button, Card, Checkbox, Input } from "../design-system";
import { apiService } from "../services/api";

interface LocalEnvironmentInfo {
  runtime: "cloudflare" | "node";
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
  const { isDark, toggleTheme } = useThemeControls();
  const [environment, setEnvironment] = useState<"unknown" | "cloudflare" | "node">("unknown");

  const setPackageRelative = (
    field: keyof AppSettings["packageRelative"],
    value: boolean,
  ): void => {
    updateSettings({
      packageRelative: {
        ...settings.packageRelative,
        [field]: value,
      },
    });
  };

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
          setEnvironment("node");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const isCloudflare = environment === "cloudflare";

  return (
    <div
      className={
        isModal
          ? "bg-white dark:bg-graphite-900"
          : "min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-graphite-900 dark:to-graphite-950"
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
                  onClick={() => navigate("/")}
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
        className={`max-w-${isModal ? "6" : "7"}xl mx-auto px-4 sm:px-6 lg:px-8 ${isModal ? "py-0" : "py-8"} scrollbar-transparent`}
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
                    onChange={(e) => updateSettings({ showNotifications: e.target.checked })}
                    label={settings.showNotifications ? "Enabled" : "Disabled"}
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
                onChange={(event) => updateSettings({ appsDirectory: event.target.value })}
                helperText="Location for frontends or operational apps."
              />
              <Input
                label="Packages directory"
                placeholder="packages"
                value={settings.packagesDirectory}
                onChange={(event) => updateSettings({ packagesDirectory: event.target.value })}
                helperText="Primary workspace for shared libraries and reusable packages."
              />
              <Input
                label="Services directory"
                placeholder="services"
                value={settings.servicesDirectory}
                onChange={(event) => updateSettings({ servicesDirectory: event.target.value })}
                helperText="Default location for backend or API services."
              />
              <Input
                label="Docs directory"
                placeholder="docs"
                value={settings.docsDirectory}
                onChange={(event) => updateSettings({ docsDirectory: event.target.value })}
                helperText="Where generated documentation (overview, specs) should live."
              />
              <Input
                label="Tests directory"
                placeholder="tests"
                value={settings.testsDirectory}
                onChange={(event) => updateSettings({ testsDirectory: event.target.value })}
                helperText="Where generated integration and scenario tests should live."
              />
              <Input
                label="Infrastructure directory"
                placeholder="infra"
                value={settings.infraDirectory}
                onChange={(event) => updateSettings({ infraDirectory: event.target.value })}
                helperText="Folder containing Terraform, Pulumi, or other infrastructure code."
              />
            </div>

            <div className="mt-6 border-t border-gray-200 pt-6 dark:border-graphite-700">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                Package-relative storage
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Control whether Arbiter writes docs, tests, or infra assets next to the owning
                service/client or into global folders.
              </p>
              <div className="grid gap-4 md:grid-cols-3">
                <Checkbox
                  label="Docs stay with package"
                  description="Place docs inside each package directory."
                  checked={settings.packageRelative.docsDirectory}
                  onChange={(event) => setPackageRelative("docsDirectory", event.target.checked)}
                />
                <Checkbox
                  label="Package-relative tests"
                  description="Group generated tests with the owning service or client."
                  checked={settings.packageRelative.testsDirectory}
                  onChange={(event) => setPackageRelative("testsDirectory", event.target.checked)}
                />
                <Checkbox
                  label="Package-relative infra"
                  description="Write infra artifacts next to each package when possible."
                  checked={settings.packageRelative.infraDirectory}
                  onChange={(event) => setPackageRelative("infraDirectory", event.target.checked)}
                />
              </div>
            </div>
          </Card>

          {!isCloudflare && <TunnelManager />}
        </div>
      </main>
    </div>
  );
}

export default ConfigScreen;
