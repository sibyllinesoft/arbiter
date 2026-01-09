/**
 * @module auth/SupertokensOAuthAdapter
 * OAuth adapter implementation for SuperTokens integration.
 */

import { Buffer } from "node:buffer";
import {
  type JWTPayload,
  type JWTVerifyOptions,
  type JWTVerifyResult,
  createRemoteJWKSet,
  jwtVerify,
} from "jose";
import { logger } from "../io/utils";
import type { ServerConfig } from "../util/types";
import type {
  AuthorizationServer,
  OAuthIntegrationAdapter,
  OAuthProvider,
  OAuthService,
  OAuthToken,
  OidcMetadata,
  ProtectedResourceMetadata,
} from "./types";

/**
 * SuperTokens OAuth adapter implementing the OAuthIntegrationAdapter interface.
 */
export class SupertokensOAuthAdapter implements OAuthIntegrationAdapter {
  public readonly name = "supertokens";

  private metadataPromise: Promise<OidcMetadata> | null = null;
  private metadataCache: OidcMetadata | null = null;
  private remoteJwkSet: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor(private readonly config: NonNullable<ServerConfig["oauth"]>) {}

  async initialize(): Promise<void> {
    await this.ensureMetadataReady();
  }

  async stop(): Promise<void> {
    this.metadataPromise = null;
    this.metadataCache = null;
    this.remoteJwkSet = null;
  }

  createOAuthService(): OAuthService {
    const adapter = this;

    return {
      async validateToken(token: string): Promise<OAuthToken | null> {
        const verification = await adapter.verifyOAuthJwt(token);
        if (!verification) {
          return null;
        }

        const {
          result: { payload },
        } = verification;

        const scope = adapter.extractScopeFromPayload(payload);
        const userId = adapter.extractUserIdFromPayload(payload);
        const tokenType = typeof payload.token_type === "string" ? payload.token_type : "Bearer";

        return {
          access_token: token,
          token_type: tokenType,
          expires_in: adapter.computeExpiresIn(payload),
          scope,
          user_id: userId,
          issued_at: typeof payload.iat === "number" ? payload.iat : undefined,
        };
      },

      async introspectToken(token: string): Promise<any> {
        const verification = await adapter.verifyOAuthJwt(token);
        if (!verification) {
          return {
            active: false,
            tokenPrefix: token.substring(0, 8),
          };
        }

        const { result, metadata } = verification;
        const { payload, protectedHeader } = result;

        const scope = adapter.extractScopeFromPayload(payload);
        const userId = adapter.extractUserIdFromPayload(payload);
        const tokenType = typeof payload.token_type === "string" ? payload.token_type : "Bearer";

        return {
          active: true,
          scope,
          token_type: tokenType,
          client_id: typeof payload.client_id === "string" ? payload.client_id : undefined,
          username: userId,
          sub: typeof payload.sub === "string" ? payload.sub : undefined,
          iss: payload.iss ?? metadata.issuer,
          aud: payload.aud,
          exp: payload.exp,
          iat: payload.iat,
          nbf: payload.nbf,
          header: protectedHeader,
          claims: payload,
        };
      },

      async getTokenInfo(token: string): Promise<any> {
        const verification = await adapter.verifyOAuthJwt(token);
        if (!verification) {
          return null;
        }

        const { result, metadata } = verification;
        return {
          issuer: metadata.issuer,
          payload: result.payload,
          header: result.protectedHeader,
        };
      },
    };
  }

  createAuthorizationServer(): AuthorizationServer | null {
    if (!this.config.enableAuthServer) {
      return null;
    }

    const adapter = this;

    return {
      async issueToken(clientId: string, scope: string): Promise<OAuthToken> {
        const resolvedClientId = adapter.resolveClientId(clientId);
        if (!resolvedClientId) {
          throw new Error("OAuth client ID is required to issue tokens");
        }

        const clientSecret = adapter.resolveClientSecret(resolvedClientId);
        if (!clientSecret) {
          throw new Error(`Missing OAuth client secret for ${resolvedClientId}`);
        }

        const metadata = await adapter.getOidcMetadata();
        if (!metadata.token_endpoint) {
          throw new Error("OAuth token endpoint not available in discovery document");
        }

        const params = new URLSearchParams({
          grant_type: "client_credentials",
          scope,
        });

        const headers: Record<string, string> = {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${resolvedClientId}:${clientSecret}`, "utf-8").toString("base64")}`,
        };

        const response = await fetch(metadata.token_endpoint, {
          method: "POST",
          headers,
          body: params.toString(),
        });

        if (!response.ok) {
          const errorBody = (await response.text()).slice(0, 500);
          logger.error("SuperTokens client credentials grant failed", undefined, {
            status: response.status,
            statusText: response.statusText,
            clientId: resolvedClientId,
            scope,
            body: errorBody,
          });
          throw new Error(`Failed to issue OAuth token: ${response.status} ${response.statusText}`);
        }

        const json = await response.json();
        return adapter.normalizeTokenResponse(json, scope);
      },

      async validateClient(clientId: string, clientSecret: string): Promise<boolean> {
        const expected = adapter.resolveClientSecret(clientId);
        if (expected) {
          return expected === clientSecret;
        }

        try {
          const metadata = await adapter.getOidcMetadata();
          if (!metadata.token_endpoint) {
            return false;
          }

          const params = new URLSearchParams({
            grant_type: "client_credentials",
            scope: "validate",
          });

          const headers: Record<string, string> = {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`, "utf-8").toString("base64")}`,
          };

          const response = await fetch(metadata.token_endpoint, {
            method: "POST",
            headers,
            body: params.toString(),
          });

          return response.ok;
        } catch (error) {
          logger.warn("SuperTokens client validation failed", {
            clientId,
            error: error instanceof Error ? error.message : String(error),
          });
          return false;
        }
      },

      async revokeToken(token: string): Promise<boolean> {
        try {
          const metadata = await adapter.getOidcMetadata();
          if (!metadata.revocation_endpoint) {
            logger.warn("SuperTokens metadata missing revocation endpoint");
            return false;
          }

          const clientId = adapter.resolveClientId();
          const clientSecret = adapter.resolveClientSecret(clientId ?? undefined);

          const params = new URLSearchParams({
            token,
            token_type_hint: "access_token",
          });

          const headers: Record<string, string> = {
            "Content-Type": "application/x-www-form-urlencoded",
          };

          if (clientId && clientSecret) {
            headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`, "utf-8").toString("base64")}`;
          }

          const response = await fetch(metadata.revocation_endpoint, {
            method: "POST",
            headers,
            body: params.toString(),
          });

          return response.ok;
        } catch (error) {
          logger.warn("SuperTokens token revocation failed", {
            tokenPrefix: token.substring(0, 8),
            error: error instanceof Error ? error.message : String(error),
          });
          return false;
        }
      },
    };
  }

  createOAuthProvider(): OAuthProvider | null {
    const adapter = this;

    return {
      async authorize(params: any): Promise<string> {
        const metadata = await adapter.getOidcMetadata();
        if (!metadata.authorization_endpoint) {
          throw new Error("OAuth authorization endpoint not available in discovery document");
        }

        const query = new URLSearchParams();
        const entries = params && typeof params === "object" ? Object.entries(params) : [];
        for (const [key, value] of entries) {
          if (value === undefined || value === null) {
            continue;
          }
          query.set(key, String(value));
        }

        if (!query.has("response_type")) {
          query.set("response_type", "code");
        }

        if (!query.has("client_id")) {
          const clientId = adapter.resolveClientId();
          if (clientId) {
            query.set("client_id", clientId);
          }
        }

        if (!query.has("scope")) {
          const requiredScopes = adapter.config.requiredScopes;
          if (Array.isArray(requiredScopes) && requiredScopes.length) {
            query.set("scope", requiredScopes.join(" "));
          }
        }

        const endpoint = new URL(metadata.authorization_endpoint);
        endpoint.search = query.toString();

        logger.debug("Generated SuperTokens authorization URL", {
          endpoint: metadata.authorization_endpoint,
          hasState: query.has("state"),
        });

        return endpoint.toString();
      },

      async getTokenFromCode(
        code: string,
        clientId: string,
        clientSecret: string,
      ): Promise<OAuthToken> {
        const metadata = await adapter.getOidcMetadata();
        if (!metadata.token_endpoint) {
          throw new Error("OAuth token endpoint not available in discovery document");
        }

        const resolvedClientId = adapter.resolveClientId(clientId);
        const resolvedSecret = adapter.resolveClientSecret(
          resolvedClientId ?? undefined,
          clientSecret,
        );

        const headers: Record<string, string> = {
          "Content-Type": "application/x-www-form-urlencoded",
        };

        const params = new URLSearchParams({
          grant_type: "authorization_code",
          code,
        });

        const redirectUri = adapter.getRedirectUri();
        if (redirectUri) {
          params.set("redirect_uri", redirectUri);
        }

        if (resolvedClientId && resolvedSecret) {
          headers.Authorization = `Basic ${Buffer.from(`${resolvedClientId}:${resolvedSecret}`, "utf-8").toString("base64")}`;
        } else if (resolvedClientId) {
          params.set("client_id", resolvedClientId);
          if (resolvedSecret) {
            params.set("client_secret", resolvedSecret);
          }
        }

        const response = await fetch(metadata.token_endpoint, {
          method: "POST",
          headers,
          body: params.toString(),
        });

        if (!response.ok) {
          const errorBody = (await response.text()).slice(0, 500);
          throw new Error(
            `Failed to exchange authorization code: ${response.status} ${response.statusText} ${errorBody}`,
          );
        }

        const json = await response.json();
        return adapter.normalizeTokenResponse(json);
      },

      async refreshToken(refreshToken: string): Promise<OAuthToken> {
        const metadata = await adapter.getOidcMetadata();
        if (!metadata.token_endpoint) {
          throw new Error("OAuth token endpoint not available in discovery document");
        }

        const clientId = adapter.resolveClientId();
        const clientSecret = adapter.resolveClientSecret(clientId ?? undefined);

        const headers: Record<string, string> = {
          "Content-Type": "application/x-www-form-urlencoded",
        };

        const params = new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        });

        if (clientId && clientSecret) {
          headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`, "utf-8").toString("base64")}`;
        } else if (clientId) {
          params.set("client_id", clientId);
          if (clientSecret) {
            params.set("client_secret", clientSecret);
          }
        }

        const response = await fetch(metadata.token_endpoint, {
          method: "POST",
          headers,
          body: params.toString(),
        });

        if (!response.ok) {
          const errorBody = (await response.text()).slice(0, 500);
          throw new Error(
            `Failed to refresh OAuth token: ${response.status} ${response.statusText} ${errorBody}`,
          );
        }

        const json = await response.json();
        return adapter.normalizeTokenResponse(json);
      },
    };
  }

  getProtectedResourceMetadata(): ProtectedResourceMetadata | null {
    if (!this.config.enabled) {
      return null;
    }

    const cached = this.metadataCache;
    if (cached) {
      return {
        issuer: cached.issuer,
        authorization_endpoint: cached.authorization_endpoint ?? `${cached.issuer}/oauth/authorize`,
        token_endpoint: cached.token_endpoint ?? `${cached.issuer}/oauth/token`,
        scopes_supported:
          cached.scopes_supported && cached.scopes_supported.length > 0
            ? cached.scopes_supported
            : this.config.requiredScopes || ["read", "write"],
        response_types_supported:
          cached.response_types_supported && cached.response_types_supported.length > 0
            ? cached.response_types_supported
            : ["code", "token"],
        grant_types_supported:
          cached.grant_types_supported && cached.grant_types_supported.length > 0
            ? cached.grant_types_supported
            : ["authorization_code", "client_credentials", "refresh_token"],
      };
    }

    return {
      issuer: this.config.authServerUrl,
      authorization_endpoint: `${this.config.authServerUrl}/oauth/authorize`,
      token_endpoint: `${this.config.authServerUrl}/oauth/token`,
      scopes_supported: this.config.requiredScopes || ["read", "write"],
      response_types_supported: ["code", "token"],
      grant_types_supported: ["authorization_code", "client_credentials", "refresh_token"],
    };
  }

  private async ensureMetadataReady(): Promise<void> {
    await this.getOidcMetadata();
    await this.getRemoteJwkSet();
  }

  private resolveIssuerUrl(): string {
    const candidate =
      process.env.SUPERTOKENS_OIDC_ISSUER?.trim() ||
      process.env.SUPERTOKENS_AUTH_SERVER_URL?.trim() ||
      this.config.issuerOverride?.trim() ||
      this.config.authServerUrl?.trim();

    if (!candidate) {
      throw new Error(
        "OAuth issuer URL is not configured. Set SUPERTOKENS_OIDC_ISSUER or oauth.authServerUrl",
      );
    }

    return candidate.replace(/\/+$/, "");
  }

  private getDiscoveryPath(): string {
    const fromEnv = process.env.SUPERTOKENS_OIDC_DISCOVERY_PATH;
    const fromConfig = this.config.discoveryPath;
    const path = fromEnv?.trim() || fromConfig?.trim() || ".well-known/openid-configuration";
    return path.startsWith("/") ? path.slice(1) : path;
  }

  private getExpectedAudiences(): string[] | undefined {
    const configAudience = Array.isArray(this.config.audience) ? [...this.config.audience] : [];

    const envAudienceRaw =
      process.env.SUPERTOKENS_OIDC_AUDIENCE ?? process.env.OAUTH_EXPECTED_AUDIENCE ?? "";
    const envAudience = envAudienceRaw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    const combined = [...configAudience, ...envAudience];
    if (!combined.length) {
      return undefined;
    }

    return Array.from(new Set(combined));
  }

  private async getOidcMetadata(): Promise<OidcMetadata> {
    if (!this.config.enabled) {
      throw new Error("OAuth is not enabled");
    }

    if (this.metadataPromise) {
      return this.metadataPromise;
    }

    const issuer = this.resolveIssuerUrl();
    const discoveryPath = this.getDiscoveryPath();
    const base = issuer.endsWith("/") ? issuer : `${issuer}/`;
    const discoveryUrl = new URL(discoveryPath, base);

    const loadPromise = (async () => {
      const response = await fetch(discoveryUrl, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        const body = (await response.text()).slice(0, 256);
        throw new Error(
          `Failed to fetch OAuth discovery document: ${response.status} ${response.statusText} ${body}`,
        );
      }

      const data = (await response.json()) as Partial<OidcMetadata> & Record<string, unknown>;

      if (!data.issuer || !data.jwks_uri) {
        throw new Error("OAuth discovery document missing issuer or jwks_uri");
      }

      const metadata: OidcMetadata = {
        issuer: data.issuer,
        jwks_uri: data.jwks_uri,
        authorization_endpoint: data.authorization_endpoint,
        token_endpoint: data.token_endpoint,
        introspection_endpoint: data.introspection_endpoint,
        userinfo_endpoint: data.userinfo_endpoint,
        revocation_endpoint: data.revocation_endpoint,
        scopes_supported: Array.isArray(data.scopes_supported) ? data.scopes_supported : undefined,
        response_types_supported: Array.isArray(data.response_types_supported)
          ? data.response_types_supported
          : undefined,
        grant_types_supported: Array.isArray(data.grant_types_supported)
          ? data.grant_types_supported
          : undefined,
      };

      this.metadataCache = metadata;

      logger.debug("Loaded SuperTokens OIDC metadata", {
        issuer: metadata.issuer,
        jwksUri: metadata.jwks_uri,
        tokenEndpoint: metadata.token_endpoint,
      });

      return metadata;
    })();

    this.metadataPromise = loadPromise.catch((error) => {
      this.metadataPromise = null;
      throw error;
    });

    return this.metadataPromise;
  }

  private async getRemoteJwkSet(): Promise<ReturnType<typeof createRemoteJWKSet>> {
    if (!this.config.enabled) {
      throw new Error("OAuth is not enabled");
    }

    if (this.remoteJwkSet) {
      return this.remoteJwkSet;
    }

    const metadata = await this.getOidcMetadata();

    try {
      this.remoteJwkSet = createRemoteJWKSet(new URL(metadata.jwks_uri));
      return this.remoteJwkSet;
    } catch (error) {
      this.remoteJwkSet = null;
      throw error instanceof Error
        ? new Error(`Failed to initialize remote JWKS: ${error.message}`)
        : error;
    }
  }

  private async verifyOAuthJwt(
    token: string,
  ): Promise<{ result: JWTVerifyResult; metadata: OidcMetadata } | null> {
    if (!this.config.enabled) {
      return null;
    }

    try {
      const metadata = await this.getOidcMetadata();
      const jwkSet = await this.getRemoteJwkSet();

      const verifyOptions: JWTVerifyOptions = {
        issuer: metadata.issuer,
        clockTolerance: 5,
      };

      const audiences = this.getExpectedAudiences();
      if (audiences && audiences.length > 0) {
        verifyOptions.audience = audiences.length === 1 ? audiences[0] : audiences;
      }

      const result = await jwtVerify(token, jwkSet, verifyOptions);
      return { result, metadata };
    } catch (error) {
      logger.warn("SuperTokens OAuth token verification failed", {
        reason: error instanceof Error ? error.message : String(error),
        tokenPrefix: token.substring(0, 8),
      });
      return null;
    }
  }

  private extractScopeFromPayload(payload: JWTPayload): string {
    if (typeof payload.scope === "string" && payload.scope.length > 0) {
      return payload.scope;
    }

    const anyPayload = payload as Record<string, unknown>;

    if (Array.isArray(anyPayload.scope)) {
      const values = (anyPayload.scope as unknown[]).filter(
        (value): value is string => typeof value === "string",
      );
      if (values.length) {
        return values.join(" ");
      }
    }

    if (Array.isArray(anyPayload.scp)) {
      const values = (anyPayload.scp as unknown[]).filter(
        (value): value is string => typeof value === "string",
      );
      if (values.length) {
        return values.join(" ");
      }
    }

    if (Array.isArray(anyPayload.permissions)) {
      const values = (anyPayload.permissions as unknown[]).filter(
        (value): value is string => typeof value === "string",
      );
      if (values.length) {
        return values.join(" ");
      }
    }

    if (typeof anyPayload.scp === "string" && anyPayload.scp.length > 0) {
      return anyPayload.scp;
    }

    if (typeof anyPayload.permissions === "string" && anyPayload.permissions.length > 0) {
      return anyPayload.permissions;
    }

    const requiredScopes = this.config.requiredScopes;
    if (Array.isArray(requiredScopes) && requiredScopes.length > 0) {
      return requiredScopes.join(" ");
    }

    return "";
  }

  private extractUserIdFromPayload(payload: JWTPayload): string | undefined {
    if (typeof payload.sub === "string" && payload.sub.length > 0) {
      return payload.sub;
    }

    const anyPayload = payload as Record<string, unknown>;

    for (const key of ["user_id", "userId", "uid", "sessionHandle"]) {
      const value = anyPayload[key];
      if (typeof value === "string" && value.length > 0) {
        return value;
      }
    }

    return undefined;
  }

  private computeExpiresIn(payload: JWTPayload): number {
    if (typeof payload.exp !== "number") {
      return 0;
    }

    const milliseconds = payload.exp * 1000 - Date.now();
    if (milliseconds <= 0) {
      return 0;
    }

    return Math.floor(milliseconds / 1000);
  }

  private normalizeTokenResponse(response: any, fallbackScope?: string): OAuthToken {
    if (!response || typeof response !== "object") {
      throw new Error("Invalid OAuth token response");
    }

    const record = response as Record<string, any>;
    const accessToken = record.access_token;
    if (typeof accessToken !== "string" || accessToken.length === 0) {
      throw new Error("OAuth token response missing access_token");
    }

    const tokenType =
      typeof record.token_type === "string" && record.token_type.length > 0
        ? record.token_type
        : "Bearer";

    const expiresRaw = record.expires_in;
    const expiresIn =
      typeof expiresRaw === "number"
        ? expiresRaw
        : typeof expiresRaw === "string"
          ? Number.parseInt(expiresRaw, 10) || 0
          : 0;

    const scopeValue = record.scope;
    let scope = "";

    if (typeof scopeValue === "string") {
      scope = scopeValue;
    } else if (Array.isArray(scopeValue)) {
      scope = scopeValue
        .filter((value: unknown): value is string => typeof value === "string")
        .join(" ");
    } else if (fallbackScope) {
      scope = fallbackScope;
    } else {
      const requiredScopes = this.config.requiredScopes;
      if (Array.isArray(requiredScopes) && requiredScopes.length > 0) {
        scope = requiredScopes.join(" ");
      }
    }

    const userId =
      typeof record.user_id === "string"
        ? record.user_id
        : typeof record.sub === "string"
          ? record.sub
          : undefined;

    return {
      access_token: accessToken,
      token_type: tokenType,
      expires_in: expiresIn,
      scope,
      user_id: userId,
      issued_at:
        typeof record.issued_at === "number" ? record.issued_at : Math.floor(Date.now() / 1000),
    };
  }

  private resolveClientId(candidate?: string): string | undefined {
    if (candidate && candidate.length > 0) {
      return candidate;
    }

    if (this.config.clientId && this.config.clientId.length > 0) {
      return this.config.clientId;
    }

    const envClientId =
      process.env.SUPERTOKENS_CLIENT_ID ?? process.env.OAUTH_CLIENT_ID ?? process.env.CLIENT_ID;

    if (envClientId && envClientId.length > 0) {
      return envClientId;
    }

    return undefined;
  }

  private resolveClientSecret(clientId?: string, explicitSecret?: string | null): string | null {
    if (explicitSecret && explicitSecret.length > 0) {
      return explicitSecret;
    }

    if (clientId && clientId.length > 0) {
      const envKey = `OAUTH_CLIENT_${clientId.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase()}_SECRET`;
      const keyedSecret = process.env[envKey];
      if (keyedSecret && keyedSecret.length > 0) {
        return keyedSecret;
      }

      if (this.config.clientId === clientId && this.config.clientSecret) {
        return this.config.clientSecret;
      }

      if (process.env.SUPERTOKENS_CLIENT_ID === clientId && process.env.SUPERTOKENS_CLIENT_SECRET) {
        return process.env.SUPERTOKENS_CLIENT_SECRET;
      }
    }

    if (this.config.clientSecret) {
      return this.config.clientSecret;
    }

    const envSecret =
      process.env.SUPERTOKENS_CLIENT_SECRET ??
      process.env.OAUTH_CLIENT_SECRET ??
      process.env.CLIENT_SECRET;

    return envSecret && envSecret.length > 0 ? envSecret : null;
  }

  private getRedirectUri(): string | null {
    const candidate =
      process.env.SUPERTOKENS_REDIRECT_URI ??
      process.env.OAUTH_REDIRECT_URI ??
      this.config.redirectUri;
    return candidate && candidate.length > 0 ? candidate : null;
  }
}
