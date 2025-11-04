import { type ReactNode, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "../design-system";
import {
  AUTH_TOKEN_EPOCH_STORAGE_KEY,
  AUTH_TOKEN_STORAGE_KEY,
  ApiService,
  apiService,
} from "../services/api";

type AuthStatus = "checking" | "ready" | "error";

const REQUIRE_AUTH =
  typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_REQUIRE_AUTH
    ? import.meta.env.VITE_REQUIRE_AUTH !== "false"
    : true;

export function AuthGate({ children }: { children: ReactNode }) {
  if (!REQUIRE_AUTH) {
    return <>{children}</>;
  }

  const location = useLocation();
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [error, setError] = useState<string | null>(null);
  const isDevBuild = import.meta.env.DEV;

  const clearStoredAuth = () => {
    try {
      window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    } catch {
      // ignore
    }
    try {
      window.localStorage.removeItem(AUTH_TOKEN_EPOCH_STORAGE_KEY);
    } catch {
      // ignore
    }
    try {
      window.sessionStorage.removeItem(ApiService.OAUTH_PENDING_STORAGE_KEY);
    } catch {
      // ignore
    }
    apiService.clearAuthToken();
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      setStatus("ready");
      return;
    }

    if (location.pathname.startsWith("/oauth/callback")) {
      setStatus("ready");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const storedToken = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
        const storedEpoch = window.localStorage.getItem(AUTH_TOKEN_EPOCH_STORAGE_KEY);
        const metadata = await apiService.loadAuthMetadata({ force: isDevBuild });
        if (cancelled) return;

        const currentEpoch = metadata?.tokenEpoch ?? null;
        if (currentEpoch) {
          try {
            window.localStorage.setItem(AUTH_TOKEN_EPOCH_STORAGE_KEY, currentEpoch);
          } catch {
            // ignore
          }
        } else {
          try {
            window.localStorage.removeItem(AUTH_TOKEN_EPOCH_STORAGE_KEY);
          } catch {
            // ignore
          }
        }

        if (storedToken) {
          if (isDevBuild && currentEpoch && storedEpoch !== currentEpoch) {
            clearStoredAuth();
            await apiService.startOAuthFlow();
            return;
          }

          try {
            window.sessionStorage.removeItem(ApiService.OAUTH_PENDING_STORAGE_KEY);
          } catch {
            // ignore
          }

          if (!cancelled) {
            setStatus("ready");
            setError(null);
          }
          return;
        }

        if (metadata?.enabled && metadata.authorizationEndpoint) {
          const pending = window.sessionStorage.getItem(ApiService.OAUTH_PENDING_STORAGE_KEY);
          if (pending === "1") {
            setStatus("checking");
            return;
          }
          await apiService.startOAuthFlow();
          return;
        }

        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unable to start sign-in.");
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [location.key, location.pathname]);

  const handleRetry = () => {
    setStatus("checking");
    setError(null);
    clearStoredAuth();
    void apiService.startOAuthFlow().catch((err) => {
      clearStoredAuth();
      setError(err instanceof Error ? err.message : "Unable to start sign-in.");
      setStatus("error");
    });
  };

  if (status === "ready") {
    return <>{children}</>;
  }

  if (status === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-graphite-950">
        <div className="bg-white dark:bg-graphite-900 rounded-lg shadow px-6 py-8 text-center max-w-md">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-graphite-25 mb-2">
            Checking authentication…
          </h1>
          <p className="text-sm text-gray-600 dark:text-graphite-400">
            Redirecting you to sign in if necessary.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-red-50 dark:bg-red-950/40">
      <div className="bg-white dark:bg-graphite-900 rounded-lg shadow px-6 py-8 text-center max-w-md space-y-4">
        <div>
          <h1 className="text-lg font-semibold text-red-700 dark:text-red-300 mb-2">
            Sign-in required
          </h1>
          <p className="text-sm text-gray-600 dark:text-graphite-300">
            {error ?? "You need to sign in to continue. Try again in a moment."}
          </p>
        </div>
        <Button variant="primary" onClick={handleRetry}>
          Try again
        </Button>
      </div>
    </div>
  );
}
