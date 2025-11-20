import { AUTH_TOKEN_STORAGE_KEY, type ProjectStructureSettings, apiService } from "@/services/api";
import { useTheme } from "@/stores/ui-store";
import React, { createContext, useContext, useMemo, useState, useCallback } from "react";

export interface AppSettings {
  showNotifications: boolean;
  appsDirectory: string;
  packagesDirectory: string;
  servicesDirectory: string;
  docsDirectory: string;
  testsDirectory: string;
  infraDirectory: string;
  packageRelative: {
    docsDirectory: boolean;
    testsDirectory: boolean;
    infraDirectory: boolean;
  };
}

const DEFAULT_APP_SETTINGS: AppSettings = {
  showNotifications: false,
  appsDirectory: "apps",
  packagesDirectory: "packages",
  servicesDirectory: "services",
  docsDirectory: "docs",
  testsDirectory: "tests",
  infraDirectory: "infra",
  packageRelative: {
    docsDirectory: false,
    testsDirectory: false,
    infraDirectory: false,
  },
};

const PROJECT_STRUCTURE_FIELDS = [
  "appsDirectory",
  "packagesDirectory",
  "servicesDirectory",
  "docsDirectory",
  "testsDirectory",
  "infraDirectory",
] as const;

const PACKAGE_RELATIVE_FIELDS = ["docsDirectory", "testsDirectory", "infraDirectory"] as const;

const isBrowser = typeof window !== "undefined";
const STORAGE_KEYS = {
  settings: "arbiter:settings",
} as const;

type StatusState = { loading: boolean; error: string | null };

interface AppSettingsContextValue {
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;
  status: StatusState;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  isDark: boolean;
  toggleTheme: () => void;
}

const AppSettingsContext = createContext<AppSettingsContextValue | undefined>(undefined);

function readStoredJson<T>(key: string, fallback: T): T {
  if (!isBrowser) return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function createInitialSettings(): AppSettings {
  const storedSettings = readStoredJson<AppSettings>(STORAGE_KEYS.settings, DEFAULT_APP_SETTINGS);
  return {
    ...DEFAULT_APP_SETTINGS,
    ...storedSettings,
    packageRelative: {
      ...DEFAULT_APP_SETTINGS.packageRelative,
      ...(storedSettings.packageRelative ?? {}),
    },
  };
}

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(createInitialSettings);
  const [status, setStatus] = useState<StatusState>({ loading: false, error: null });
  const { isDark, toggleTheme } = useTheme();

  const persistSettings = useCallback((next: AppSettings) => {
    if (!isBrowser) return;
    try {
      window.localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(next));
    } catch (error) {
      console.warn("Failed to persist settings to localStorage", error);
    }
  }, []);

  const updateSettings = useCallback(
    (partial: Partial<AppSettings>) => {
      setSettings((prev) => {
        const nextSettings: AppSettings = {
          ...prev,
          ...partial,
          packageRelative: {
            ...prev.packageRelative,
            ...(partial.packageRelative ?? {}),
          },
        };

        persistSettings(nextSettings);

        const structureUpdates: Partial<ProjectStructureSettings> = {};
        PROJECT_STRUCTURE_FIELDS.forEach((field) => {
          const value = partial[field];
          if (typeof value === "string" && value.trim().length > 0) {
            structureUpdates[field] = value;
          }
        });

        if (partial.packageRelative) {
          const packageRelativeUpdates: Record<string, boolean> = {};
          PACKAGE_RELATIVE_FIELDS.forEach((key) => {
            const value = partial.packageRelative?.[key];
            if (typeof value === "boolean") {
              packageRelativeUpdates[key] = value;
            }
          });
          if (Object.keys(packageRelativeUpdates).length > 0) {
            structureUpdates.packageRelative = {
              ...prev.packageRelative,
              ...packageRelativeUpdates,
            };
          }
        }

        if (Object.keys(structureUpdates).length > 0) {
          void apiService.updateProjectStructureSettings(structureUpdates).catch((error) => {
            console.warn("Failed to persist project structure settings", error);
          });
        }

        return nextSettings;
      });
    },
    [persistSettings],
  );

  const setLoading = (loading: boolean) => setStatus((prev) => ({ ...prev, loading }));
  const setError = (error: string | null) => setStatus((prev) => ({ ...prev, error }));

  const value = useMemo<AppSettingsContextValue>(
    () => ({ settings, updateSettings, status, setLoading, setError, isDark, toggleTheme }),
    [settings, status, isDark, toggleTheme, updateSettings],
  );

  // restore auth token for apiService
  if (isBrowser) {
    const storedToken = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    if (storedToken) {
      apiService.setAuthToken(storedToken);
    }
  }

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext);
  if (!context) throw new Error("useAppSettings must be used within AppSettingsProvider");
  return { settings: context.settings, updateSettings: context.updateSettings };
}

export function useStatus() {
  const context = useContext(AppSettingsContext);
  if (!context) throw new Error("useStatus must be used within AppSettingsProvider");
  return {
    loading: context.status.loading,
    error: context.status.error,
    setLoading: context.setLoading,
    setError: context.setError,
  };
}

export function useThemeControls() {
  const context = useContext(AppSettingsContext);
  if (!context) throw new Error("useThemeControls must be used within AppSettingsProvider");
  return { isDark: context.isDark, toggleTheme: context.toggleTheme };
}
