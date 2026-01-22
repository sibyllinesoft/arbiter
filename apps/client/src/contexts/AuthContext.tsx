/**
 * Authentication context provider for managing OAuth state.
 * Handles token storage, validation, and OAuth flow initiation.
 */
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useLocation } from "react-router-dom";

import {
  AUTH_TOKEN_EPOCH_STORAGE_KEY,
  AUTH_TOKEN_STORAGE_KEY,
  ApiService,
  apiService,
} from "@/services/api";

/** Authentication status during the OAuth flow */
type AuthStatus = "checking" | "ready" | "error";

/** Context value providing authentication state and actions */
interface AuthContextValue {
  requireAuth: boolean;
  status: AuthStatus;
  error: string | null;
  retry: () => Promise<void>;
  clearStoredAuth: () => void;
}

/** React context for authentication state */
const AuthContext = createContext<AuthContextValue | null>(null);

const REQUIRE_AUTH =
  typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_REQUIRE_AUTH
    ? import.meta.env.VITE_REQUIRE_AUTH !== "false"
    : true;

/** Safely set a localStorage item, ignoring errors */
function safeSetLocalStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

/** Safely remove a localStorage item, ignoring errors */
function safeRemoveLocalStorage(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** Safely remove a sessionStorage item, ignoring errors */
function safeRemoveSessionStorage(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** Clear all stored authentication data */
function clearAllStoredAuth(): void {
  safeRemoveLocalStorage(AUTH_TOKEN_STORAGE_KEY);
  safeRemoveLocalStorage(AUTH_TOKEN_EPOCH_STORAGE_KEY);
  safeRemoveSessionStorage(ApiService.OAUTH_PENDING_STORAGE_KEY);
  apiService.clearAuthToken();
}

/** Update stored epoch from metadata */
function updateStoredEpoch(currentEpoch: string | null): void {
  if (currentEpoch) {
    safeSetLocalStorage(AUTH_TOKEN_EPOCH_STORAGE_KEY, currentEpoch);
  } else {
    safeRemoveLocalStorage(AUTH_TOKEN_EPOCH_STORAGE_KEY);
  }
}

/** Check if auth should be skipped based on environment or path */
function shouldSkipAuthCheck(pathname: string): boolean {
  if (!REQUIRE_AUTH) return true;
  if (typeof window === "undefined") return true;
  return pathname.startsWith("/oauth/callback");
}

/** Handle case where stored token exists */
async function handleExistingToken(
  storedEpoch: string | null,
  currentEpoch: string | null,
  isDevBuild: boolean,
  clearStoredAuth: () => void,
  setStatus: (value: AuthStatus) => void,
  setError: (e: string | null) => void,
): Promise<boolean> {
  if (isDevBuild && currentEpoch && storedEpoch !== currentEpoch) {
    clearStoredAuth();
    await apiService.startOAuthFlow();
    return true;
  }
  safeRemoveSessionStorage(ApiService.OAUTH_PENDING_STORAGE_KEY);
  setStatus("ready");
  setError(null);
  return true;
}

/** Initiate OAuth flow if enabled and not already pending */
async function initiateOAuthIfNeeded(
  metadata: { enabled?: boolean; authorizationEndpoint?: string | null } | null,
  setStatus: (value: AuthStatus) => void,
): Promise<boolean> {
  if (!metadata?.enabled || !metadata.authorizationEndpoint) return false;

  const pending = window.sessionStorage.getItem(ApiService.OAUTH_PENDING_STORAGE_KEY);
  if (pending === "1") {
    setStatus("checking");
    return true;
  }
  await apiService.startOAuthFlow();
  return true;
}

/** Hook that manages authentication state transitions and OAuth flow */
function useAuthStateUpdater(
  setStatus: (value: AuthStatus) => void,
  setError: (e: string | null) => void,
) {
  const location = useLocation();
  const isDevBuild = import.meta.env.DEV;

  const clearStoredAuth = useCallback(() => {
    clearAllStoredAuth();
  }, []);

  const checkAuth = useCallback(async () => {
    if (shouldSkipAuthCheck(location.pathname)) {
      setStatus("ready");
      setError(null);
      return;
    }

    setStatus("checking");
    setError(null);

    try {
      const storedToken = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
      const storedEpoch = window.localStorage.getItem(AUTH_TOKEN_EPOCH_STORAGE_KEY);
      const metadata = await apiService.loadAuthMetadata({ force: isDevBuild });

      const currentEpoch = metadata?.tokenEpoch ?? null;
      updateStoredEpoch(currentEpoch);

      if (storedToken) {
        await handleExistingToken(
          storedEpoch,
          currentEpoch,
          isDevBuild,
          clearStoredAuth,
          setStatus,
          setError,
        );
        return;
      }

      if (await initiateOAuthIfNeeded(metadata, setStatus)) return;

      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start sign-in.");
      setStatus("error");
    }
  }, [clearStoredAuth, isDevBuild, location.pathname, setError, setStatus]);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth, location.key]);

  const retry = useCallback(async () => {
    setStatus("checking");
    setError(null);
    clearStoredAuth();
    await apiService.startOAuthFlow().catch((err) => {
      clearStoredAuth();
      setError(err instanceof Error ? err.message : "Unable to start sign-in.");
      setStatus("error");
    });
  }, [clearStoredAuth, setError, setStatus]);

  return { clearStoredAuth, retry, checkAuth };
}

/** Provider component that wraps the app with authentication context */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [error, setError] = useState<string | null>(null);

  const { clearStoredAuth, retry } = useAuthStateUpdater(setStatus, setError);

  const value = useMemo<AuthContextValue>(
    () => ({
      requireAuth: REQUIRE_AUTH,
      status,
      error,
      retry,
      clearStoredAuth,
    }),
    [clearStoredAuth, error, retry, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Hook to access authentication context from child components */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
