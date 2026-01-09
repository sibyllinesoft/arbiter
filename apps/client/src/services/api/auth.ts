import { ApiClient } from "./client";

export const AUTH_TOKEN_STORAGE_KEY = "arbiter:authToken";
export const AUTH_TOKEN_EPOCH_STORAGE_KEY = "arbiter:authTokenEpoch";

/** Default OAuth scopes */
const DEFAULT_OAUTH_SCOPES = ["read", "write"] as const;

/** Default OAuth client ID */
const DEFAULT_CLIENT_ID = "dev-cli";

/** Default redirect URI when window is unavailable */
const DEFAULT_REDIRECT_URI = "http://localhost:3000/oauth/callback";

/** Safe localStorage removal helper */
const safeStorageRemove = (key: string): void => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore storage errors
  }
};

/** Safe sessionStorage setter helper */
const safeSessionStorageSet = (key: string, value: string): void => {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // ignore storage errors
  }
};

/** Check if running in browser environment */
const isBrowser = (): boolean => typeof window !== "undefined";

export interface AuthMetadataResponse {
  enabled: boolean;
  provider?: string | null;
  authorizationEndpoint?: string | null;
  tokenEndpoint?: string | null;
  clientId?: string | null;
  scopes?: string[];
  redirectUri?: string | null;
  reason?: string;
  tokenEpoch?: string | null;
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  scope?: string;
  refresh_token?: string;
  user_id?: string;
}

export interface OAuthTokenExchangeResponse {
  success: boolean;
  message?: string;
  token: OAuthTokenResponse;
  authContext?: {
    user_id?: string | null;
    project_access?: string[];
  } | null;
}

export class AuthService {
  static readonly OAUTH_PENDING_STORAGE_KEY = "arbiter:oauthPending";

  private authMetadata?: AuthMetadataResponse | null;
  private authMetadataPromise: Promise<AuthMetadataResponse | null> | null = null;
  private readonly client: ApiClient;

  constructor(client: ApiClient) {
    this.client = client;
    this.client.setUnauthorizedHandler(() => this.handleAuthRedirect());
  }

  setAuthToken(token: string) {
    this.client.setAuthToken(token);
  }

  clearAuthToken() {
    this.client.clearAuthToken();
  }

  async exchangeOAuthCode(
    code: string,
    options: { redirectUri?: string; codeVerifier?: string } = {},
  ): Promise<OAuthTokenExchangeResponse> {
    const body = {
      code,
      redirectUri: options.redirectUri,
      codeVerifier: options.codeVerifier,
    };

    return this.client.request<OAuthTokenExchangeResponse>("/api/auth/token", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async startOAuthFlow(): Promise<void> {
    if (!isBrowser()) return;

    const metadata = await this.getAuthMetadata();
    if (!metadata?.enabled) throw new Error("OAuth is not enabled.");
    if (!metadata.authorizationEndpoint)
      throw new Error("OAuth authorization endpoint unavailable.");

    safeSessionStorageSet(AuthService.OAUTH_PENDING_STORAGE_KEY, "1");
    window.location.href = this.buildAuthorizeUrl(metadata);
  }

  async loadAuthMetadata(options: { force?: boolean } = {}): Promise<AuthMetadataResponse | null> {
    if (options.force) {
      this.authMetadata = null;
      this.authMetadataPromise = null;
    }
    return this.getAuthMetadata();
  }

  private buildAuthorizeUrl(metadata: AuthMetadataResponse): string {
    const authorizeUrl = new URL(metadata.authorizationEndpoint!);
    authorizeUrl.searchParams.set("client_id", metadata.clientId ?? DEFAULT_CLIENT_ID);

    const redirectUri =
      metadata.redirectUri ??
      (isBrowser() ? `${window.location.origin}/oauth/callback` : DEFAULT_REDIRECT_URI);
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("response_type", "code");

    const scopes = metadata.scopes?.length ? metadata.scopes : DEFAULT_OAUTH_SCOPES;
    authorizeUrl.searchParams.set("scope", scopes.join(" "));

    const statePayload = {
      returnTo: isBrowser() ? window.location.href : "/",
      timestamp: Date.now(),
    };
    const stateEncoded =
      isBrowser() && window.btoa
        ? window.btoa(JSON.stringify(statePayload))
        : JSON.stringify(statePayload);
    authorizeUrl.searchParams.set("state", stateEncoded);

    return authorizeUrl.toString();
  }

  private async handleAuthRedirect(): Promise<void> {
    if (!isBrowser()) return;
    if (window.location.pathname.startsWith("/oauth/callback")) return;

    try {
      const metadata = await this.getAuthMetadata();
      if (!metadata?.enabled || !metadata.authorizationEndpoint) return;

      safeSessionStorageSet(AuthService.OAUTH_PENDING_STORAGE_KEY, "1");
      safeStorageRemove(AUTH_TOKEN_STORAGE_KEY);
      safeStorageRemove(AUTH_TOKEN_EPOCH_STORAGE_KEY);
      this.clearAuthToken();

      window.location.href = this.buildAuthorizeUrl(metadata);
    } catch (error) {
      console.warn("Failed to initiate OAuth redirect", error);
    }
  }

  private async getAuthMetadata(): Promise<AuthMetadataResponse | null> {
    if (this.authMetadata) {
      return this.authMetadata;
    }

    if (this.authMetadataPromise) {
      return this.authMetadataPromise;
    }

    this.authMetadataPromise = (async () => {
      try {
        const response = await fetch(`${this.client.getBaseUrl()}/api/auth/metadata`, {
          headers: { "Content-Type": "application/json", Accept: "application/json" },
        });

        if (!response.ok) {
          return null;
        }

        const metadata = (await response.json()) as AuthMetadataResponse;
        this.authMetadata = metadata;
        return metadata;
      } catch (error) {
        console.warn("Failed to fetch auth metadata", error);
        return null;
      } finally {
        this.authMetadataPromise = null;
      }
    })();

    return this.authMetadataPromise;
  }
}
