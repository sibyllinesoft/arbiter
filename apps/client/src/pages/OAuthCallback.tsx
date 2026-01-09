import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AUTH_TOKEN_EPOCH_STORAGE_KEY,
  AUTH_TOKEN_STORAGE_KEY,
  ApiService,
  apiService,
} from "../services/api";

interface OAuthStatePayload {
  returnTo?: string;
  timestamp?: number;
}

function decodeState(state?: string | null): OAuthStatePayload | null {
  if (!state) return null;
  try {
    const decoded =
      typeof window !== "undefined" && typeof window.atob === "function"
        ? window.atob(state)
        : state;
    return JSON.parse(decoded) as OAuthStatePayload;
  } catch {
    return null;
  }
}

function safeStorageRemove(storage: Storage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // Storage access may fail in certain contexts
  }
}

function parseDestination(target: string | undefined): string {
  if (!target) return "/";
  try {
    const url = new URL(target, window.location.origin);
    return `${url.pathname}${url.search}${url.hash}` || "/";
  } catch {
    return target;
  }
}

async function loadAndStoreTokenEpoch(): Promise<void> {
  try {
    const metadata = await apiService.loadAuthMetadata({ force: import.meta.env.DEV });
    const tokenEpoch = metadata?.tokenEpoch ?? null;
    if (tokenEpoch) {
      window.localStorage.setItem(AUTH_TOKEN_EPOCH_STORAGE_KEY, tokenEpoch);
    } else {
      window.localStorage.removeItem(AUTH_TOKEN_EPOCH_STORAGE_KEY);
    }
  } catch {
    // Metadata loading failure is non-critical
  }
}

function cleanupPendingOAuth(): void {
  safeStorageRemove(window.sessionStorage, ApiService.OAUTH_PENDING_STORAGE_KEY);
}

function cleanupOnError(): void {
  cleanupPendingOAuth();
  safeStorageRemove(window.localStorage, AUTH_TOKEN_EPOCH_STORAGE_KEY);
}

function LoadingState() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-graphite-950">
      <div className="bg-white dark:bg-graphite-900 rounded-lg shadow px-6 py-8 text-center max-w-md">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-graphite-25 mb-2">
          Signing you in…
        </h1>
        <p className="text-sm text-gray-600 dark:text-graphite-400">
          Completing the OAuth flow. You will be redirected automatically.
        </p>
      </div>
    </div>
  );
}

interface ErrorStateProps {
  error: string;
  onReturnHome: () => void;
}

function ErrorState({ error, onReturnHome }: ErrorStateProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-red-50 dark:bg-red-950/40">
      <div className="bg-white dark:bg-graphite-900 rounded-lg shadow px-6 py-8 text-center max-w-md">
        <h1 className="text-lg font-semibold text-red-700 dark:text-red-300 mb-2">
          OAuth Sign-in Failed
        </h1>
        <p className="text-sm text-red-600 dark:text-red-200 mb-4">{error}</p>
        <button
          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          onClick={onReturnHome}
        >
          Return Home
        </button>
      </div>
    </div>
  );
}

export function OAuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(true);

  const { code, state } = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      code: params.get("code"),
      state: params.get("state"),
    };
  }, []);

  useEffect(() => {
    if (!code) {
      setError("Authorization code missing from callback.");
      setProcessing(false);
      return;
    }

    const handleOAuthExchange = async () => {
      const statePayload = decodeState(state);
      const redirectUri = `${window.location.origin}/oauth/callback`;

      try {
        const response = await apiService.exchangeOAuthCode(code, { redirectUri });
        if (!response.success) {
          throw new Error(response.message ?? "OAuth exchange was not successful.");
        }

        apiService.setAuthToken(response.token.access_token);
        window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, response.token.access_token);

        cleanupPendingOAuth();
        await loadAndStoreTokenEpoch();

        const destination = parseDestination(statePayload?.returnTo);
        navigate(destination, { replace: true });
      } catch (err) {
        cleanupOnError();
        setError(err instanceof Error ? err.message : "OAuth exchange failed.");
        setProcessing(false);
      }
    };

    void handleOAuthExchange();
  }, [code, state, navigate]);

  if (processing && !error) {
    return <LoadingState />;
  }

  return (
    <ErrorState
      error={error ?? "Unknown error"}
      onReturnHome={() => navigate("/", { replace: true })}
    />
  );
}

export default OAuthCallback;
