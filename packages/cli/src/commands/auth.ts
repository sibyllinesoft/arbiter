import crypto from "node:crypto";
import { stdin as input, stdout as output } from "node:process";
import readline from "node:readline/promises";
import chalk from "chalk";
import { clearAuthSession, getAuthStorePath, saveAuthSession } from "../auth-store.js";
import type { AuthSession, CLIConfig } from "../types.js";

interface AuthCommandOptions {
  logout?: boolean;
  outputUrl?: boolean;
}

interface OAuthMetadataResponse {
  enabled: boolean;
  provider?: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  clientId?: string | null;
  scopes?: string[];
  redirectUri?: string | null;
  tokenEpoch?: string | null;
}

interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  scope?: string;
  refresh_token?: string;
}

function base64UrlEncode(data: Buffer): string {
  return data.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function generatePkcePair(): { verifier: string; challenge: string } {
  const verifier = base64UrlEncode(crypto.randomBytes(64));
  const challenge = base64UrlEncode(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

async function fetchOAuthMetadata(apiUrl: string): Promise<OAuthMetadataResponse> {
  const response = await fetch(`${apiUrl.replace(/\/+$/, "")}/api/auth/metadata`);
  if (!response.ok) {
    throw new Error(`Failed to fetch OAuth metadata: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as OAuthMetadataResponse;
}

async function exchangeAuthorizationCode(
  tokenEndpoint: string,
  data: {
    clientId: string;
    code: string;
    verifier: string;
    redirectUri: string;
    scopes: string;
  },
): Promise<OAuthTokenResponse> {
  const payload = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: data.clientId,
    code: data.code,
    redirect_uri: data.redirectUri,
    code_verifier: data.verifier,
  });

  if (data.scopes) {
    payload.set("scope", data.scopes);
  }

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: payload.toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Token exchange failed: ${response.status} ${response.statusText}\n${errorBody.slice(0, 500)}`,
    );
  }

  return (await response.json()) as OAuthTokenResponse;
}

function buildAuthorizationUrl(
  authorizationEndpoint: string,
  params: Record<string, string>,
): string {
  const url = new URL(authorizationEndpoint);
  const search = new URLSearchParams(params);
  url.search = search.toString();
  return url.toString();
}

export async function runAuthCommand(
  options: AuthCommandOptions,
  config: CLIConfig,
): Promise<void> {
  if (options.logout) {
    await clearAuthSession();
    console.log(chalk.green("Logged out of Arbiter CLI. Credentials removed."));
    console.log(chalk.dim(`Cleared credentials at ${getAuthStorePath()}`));
    return;
  }

  const apiUrl = config.apiUrl.replace(/\/+$/, "");
  const metadata = await fetchOAuthMetadata(apiUrl);

  if (!metadata.enabled) {
    console.log(chalk.yellow("OAuth is not enabled on the Arbiter server."));
    return;
  }

  if (!metadata.authorizationEndpoint || !metadata.tokenEndpoint) {
    throw new Error("OAuth metadata is incomplete. Authorization or token endpoint missing.");
  }

  const clientId = metadata.clientId?.trim();
  if (!clientId) {
    throw new Error("OAuth client ID is not configured on the server.");
  }

  const scopes = metadata.scopes && metadata.scopes.length > 0 ? metadata.scopes : ["read"];
  const scopeParam = scopes.join(" ");
  const redirectUri = metadata.redirectUri?.trim() || "urn:ietf:wg:oauth:2.0:oob";
  const state = base64UrlEncode(crypto.randomBytes(24));
  const { verifier, challenge } = generatePkcePair();

  const authorizationUrl = buildAuthorizationUrl(metadata.authorizationEndpoint, {
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopeParam,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  });

  if (options.outputUrl) {
    console.log(authorizationUrl);
    return;
  }

  console.log();
  console.log(chalk.cyan("To authenticate the Arbiter CLI:"));
  console.log(`  1. Open the following URL in your browser:\n     ${chalk.blue(authorizationUrl)}`);
  console.log("  2. Complete the sign-in flow.");
  console.log("  3. You will receive a verification code. Paste it below.");
  console.log();

  const rl = readline.createInterface({ input, output });
  try {
    const code = (await rl.question("Authorization code: ")).trim();
    if (!code) {
      throw new Error("No authorization code provided.");
    }

    const tokenResponse = await exchangeAuthorizationCode(metadata.tokenEndpoint, {
      clientId,
      code,
      verifier,
      redirectUri,
      scopes: scopeParam,
    });

    const expiresAt = tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString()
      : undefined;

    const session: AuthSession = {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      tokenType: tokenResponse.token_type,
      scope: tokenResponse.scope ?? scopeParam,
      expiresAt,
      obtainedAt: new Date().toISOString(),
      metadata: {
        tokenEndpoint: metadata.tokenEndpoint,
        authorizationEndpoint: metadata.authorizationEndpoint,
        clientId,
        redirectUri,
        provider: metadata.provider,
      },
    };

    await saveAuthSession(session);

    console.log();
    console.log(chalk.green("Authentication successful."));
    if (expiresAt) {
      console.log(`Token expires at ${new Date(expiresAt).toLocaleString()}`);
    }
    console.log("You can now run Arbiter CLI commands that require authentication.");
    console.log(chalk.dim(`Credentials stored at ${getAuthStorePath()}`));
  } finally {
    rl.close();
  }
}
