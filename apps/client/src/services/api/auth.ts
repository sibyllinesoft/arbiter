import { ApiClient } from "./client";

export const AUTH_TOKEN_STORAGE_KEY = "arbiter:authToken";
export const AUTH_TOKEN_EPOCH_STORAGE_KEY = "arbiter:authTokenEpoch";

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

  constructor(private readonly client: ApiClient) {
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
    if (typeof window === "undefined") {
      return;
    }

    const metadata = await this.getAuthMetadata();
    if (!metadata?.enabled) {
      throw new Error("OAuth is not enabled.");
    }

    if (!metadata.authorizationEndpoint) {
      throw new Error("OAuth authorization endpoint unavailable.");
    }

    try {
      window.sessionStorage.setItem(AuthService.OAUTH_PENDING_STORAGE_KEY, "1");
    } catch {
      // ignore
    }

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
    const clientId = metadata.clientId ?? "dev-cli";
    authorizeUrl.searchParams.set("client_id", clientId);

    const redirectUri =
      metadata.redirectUri ??
      (typeof window !== "undefined"
        ? `${window.location.origin}/oauth/callback`
        : "http://localhost:3000/oauth/callback");
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("response_type", "code");

    const scopes =
      metadata.scopes && metadata.scopes.length > 0 ? metadata.scopes : ["read", "write"];
    authorizeUrl.searchParams.set("scope", scopes.join(" "));

    const statePayload = {
      returnTo: typeof window !== "undefined" ? window.location.href : "/",
      timestamp: Date.now(),
    };
    const stateEncoded =
      typeof window !== "undefined" && typeof window.btoa === "function"
        ? window.btoa(JSON.stringify(statePayload))
        : JSON.stringify(statePayload);
    authorizeUrl.searchParams.set("state", stateEncoded);

    return authorizeUrl.toString();
  }

  private async handleAuthRedirect(): Promise<void> {
    if (typeof window === "undefined") {
      return;
    }

    try {
      if (window.location.pathname.startsWith("/oauth/callback")) {
        return;
      }

      const metadata = await this.getAuthMetadata();
      if (!metadata?.enabled || !metadata.authorizationEndpoint) {
        return;
      }

      try {
        window.sessionStorage.setItem(AuthService.OAUTH_PENDING_STORAGE_KEY, "1");
      } catch {
        // ignore
      }

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
