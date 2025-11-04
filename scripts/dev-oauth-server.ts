import { createHash, randomBytes } from "node:crypto";
import { SignJWT, exportJWK, generateKeyPair } from "jose";

/**
 * Dev OAuth helper
 *
 * Two operating modes:
 *  - Remote proxy: Set OAUTH_DEV_REMOTE_ISSUER (or SUPERTOKENS_OIDC_ISSUER) to tunnel to a real
 *    SuperTokens OIDC provider. The script simply proxies discovery/token requests and redirects
 *    the browser to the remote authorization endpoint.
 *  - Local fallback: When no remote issuer is supplied, we emulate a basic OAuth server so the
 *    end-to-end flow still works without external dependencies.
 */

const PORT = Number(process.env.OAUTH_DEV_PORT || 4571);
const ISSUER = process.env.OAUTH_DEV_ISSUER || `http://localhost:${PORT}`;
const CLIENT_ID = process.env.OAUTH_DEV_CLIENT_ID || "dev-cli";
const REDIRECT_URI = process.env.OAUTH_DEV_REDIRECT_URI || "urn:ietf:wg:oauth:2.0:oob";
const DEFAULT_SCOPE = process.env.OAUTH_DEV_SCOPE || "read write";
const AUTO_APPROVE = process.env.OAUTH_DEV_AUTO_APPROVE === "1";

const REMOTE_ISSUER_RAW =
  process.env.OAUTH_DEV_REMOTE_ISSUER || process.env.SUPERTOKENS_OIDC_ISSUER || "";
const REMOTE_ISSUER = REMOTE_ISSUER_RAW.trim().replace(/\/+$/, "");
const USE_REMOTE = REMOTE_ISSUER.length > 0;

const { publicKey, privateKey } = await generateKeyPair("RS256");
const jwk = await exportJWK(publicKey);
(jwk as any).kid = "dev-oauth-key";
(jwk as any).alg = "RS256";

interface PendingCode {
  clientId: string;
  redirectUri: string;
  scope: string;
  state?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  createdAt: number;
}

const codeStore = new Map<string, PendingCode>();

function base64Url(buffer: Buffer): string {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function createCode(): string {
  return base64Url(randomBytes(24));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function htmlPage(title: string, body: string): Response {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8" /><title>${title}</title>
    <style>
      body{font-family:system-ui;margin:2rem auto;line-height:1.6;max-width:720px;padding:0 1.5rem;background:#f8fafc;color:#0f172a}
      h1{font-size:1.8rem;margin-bottom:0.5rem}
      code{background:#e2e8f0;padding:0.2rem 0.4rem;border-radius:4px}
      .actions{display:flex;gap:1rem;margin-top:1.5rem;flex-wrap:wrap}
      button{padding:0.6rem 1.4rem;font-size:1rem;border-radius:6px;border:none;cursor:pointer}
      button.primary{background:#2563eb;color:#fff}
      button.secondary{background:#e5e7eb;color:#111827}
    </style>
    </head><body>${body}</body></html>`,
    {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );
}

async function proxyFetch(
  request: Request,
  targetPath: string,
  init: RequestInit = {},
): Promise<Response> {
  if (!USE_REMOTE) {
    throw new Error("proxyFetch called in local mode");
  }

  const targetUrl = new URL(targetPath, `${REMOTE_ISSUER}/`);

  const proxiedHeaders = new Headers(init.headers || request.headers);
  proxiedHeaders.delete("host");
  proxiedHeaders.delete("content-length");

  const body =
    init.body !== undefined
      ? init.body
      : request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await request.arrayBuffer();

  const response = await fetch(targetUrl, {
    method: init.method ?? request.method,
    body,
    headers: proxiedHeaders,
    redirect: "manual",
  });

  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete("content-length");
  responseHeaders.set("access-control-allow-origin", "*");
  responseHeaders.set("access-control-allow-credentials", "false");

  return new Response(response.body, { status: response.status, headers: responseHeaders });
}

async function proxyAuthorize(url: URL): Promise<Response> {
  const target = new URL("/oauth/authorize", `${REMOTE_ISSUER}/`);
  target.search = url.search;
  console.log(
    `[dev-oauth] redirecting to remote issuer for consent`,
    JSON.stringify({
      clientId: url.searchParams.get("client_id"),
      scope: url.searchParams.get("scope"),
    }),
  );
  return Response.redirect(target.toString(), 302);
}

async function proxyMetadata(): Promise<Response> {
  const response = await fetch(new URL("/.well-known/openid-configuration", `${REMOTE_ISSUER}/`), {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const text = (await response.text()).slice(0, 512);
    throw new Error(
      `[dev-oauth] failed to fetch remote discovery: ${response.status} ${response.statusText} ${text}`,
    );
  }

  const openidMetadata = (await response.json()) as Record<string, any>;

  return Response.json({
    enabled: true,
    provider: "supertokens",
    authorizationEndpoint: openidMetadata.authorization_endpoint,
    tokenEndpoint: openidMetadata.token_endpoint,
    clientId: CLIENT_ID,
    scopes:
      Array.isArray(openidMetadata.scopes_supported) && openidMetadata.scopes_supported.length
        ? openidMetadata.scopes_supported
        : DEFAULT_SCOPE.split(" "),
    redirectUri: openidMetadata.redirect_uri ?? REDIRECT_URI,
  });
}

function verifyPkce(entry: PendingCode, verifier?: string): boolean {
  if (!entry.codeChallenge) {
    return true;
  }

  if (!verifier) {
    return false;
  }

  if (entry.codeChallengeMethod === "S256") {
    const hashed = base64Url(createHash("sha256").update(verifier).digest());
    return hashed === entry.codeChallenge;
  }

  if (entry.codeChallengeMethod === "plain") {
    return verifier === entry.codeChallenge;
  }

  return true;
}

async function handleAuthorize(url: URL): Promise<Response> {
  if (USE_REMOTE) {
    return proxyAuthorize(url);
  }

  const clientId = url.searchParams.get("client_id") || "";
  const redirectUri = url.searchParams.get("redirect_uri") || "";
  const scope = url.searchParams.get("scope") || DEFAULT_SCOPE;
  const state = url.searchParams.get("state") || "";
  const codeChallenge = url.searchParams.get("code_challenge") || undefined;
  const codeChallengeMethod = url.searchParams.get("code_challenge_method") || undefined;

  if (!clientId || clientId !== CLIENT_ID) {
    return htmlPage("OAuth Error", "<h1>Invalid client_id</h1>");
  }

  if (!redirectUri) {
    return htmlPage("OAuth Error", "<h1>Missing redirect_uri</h1>");
  }

  const code = createCode();
  codeStore.set(code, {
    clientId,
    redirectUri,
    scope,
    state: state || undefined,
    codeChallenge,
    codeChallengeMethod,
    createdAt: Date.now(),
  });

  if (redirectUri === "urn:ietf:wg:oauth:2.0:oob") {
    return htmlPage(
      "Arbiter Dev OAuth",
      `<h1>Arbiter Dev OAuth</h1>
       <p>Copy the following authorization code back into the CLI:</p>
       <h2><code>${code}</code></h2>
       <p>Scopes granted: <code>${escapeHtml(scope)}</code></p>`,
    );
  }

  if (!AUTO_APPROVE) {
    return htmlPage(
      "Arbiter Dev OAuth Consent",
      `<h1>Authorize ${escapeHtml(clientId)}</h1>
       <p>This application is requesting access with the following scopes:</p>
       <p><code>${escapeHtml(scope)}</code></p>
       <form method="post" action="/oauth/consent">
         <input type="hidden" name="code" value="${escapeHtml(code)}" />
         <input type="hidden" name="redirect_uri" value="${escapeHtml(redirectUri)}" />
         <input type="hidden" name="state" value="${escapeHtml(state)}" />
         <div class="actions">
           <button class="primary" type="submit" name="decision" value="approve">Authorize</button>
           <button class="secondary" type="submit" name="decision" value="deny">Deny</button>
         </div>
       </form>
       <p style="margin-top:1.5rem;color:#6b7280">Tip: set <code>OAUTH_DEV_AUTO_APPROVE=1</code> to restore automatic redirects.</p>`,
    );
  }

  const redirect = new URL(redirectUri);
  redirect.searchParams.set("code", code);
  if (state) {
    redirect.searchParams.set("state", state);
  }

  return Response.redirect(redirect.toString(), 302);
}

async function handleToken(request: Request): Promise<Response> {
  if (USE_REMOTE) {
    return proxyFetch(request, "/oauth/token");
  }

  const body = await request.text();
  const params = new URLSearchParams(body);

  const grantType = params.get("grant_type");
  if (grantType !== "authorization_code") {
    return new Response("unsupported_grant_type", { status: 400 });
  }

  const code = params.get("code") || "";
  const verifier = params.get("code_verifier") || undefined;
  const redirectUri = params.get("redirect_uri") || "";

  const entry = codeStore.get(code);
  if (!entry) {
    return new Response("invalid_grant", { status: 400 });
  }

  if (entry.redirectUri !== redirectUri) {
    return new Response("invalid_redirect_uri", { status: 400 });
  }

  if (!verifyPkce(entry, verifier)) {
    return new Response("invalid_pkce", { status: 400 });
  }

  codeStore.delete(code);

  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 3600;
  const payload = {
    scope: entry.scope,
    sub: "dev-user",
    iss: ISSUER,
  };

  const accessToken = await new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256", kid: "dev-oauth-key", typ: "JWT" })
    .setIssuer(ISSUER)
    .setAudience("arbiter-cli")
    .setSubject("dev-user")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);

  const responseBody = {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: expiresIn,
    scope: entry.scope,
    refresh_token: base64Url(randomBytes(24)),
    issued_at: now,
  };

  return new Response(JSON.stringify(responseBody), {
    headers: { "Content-Type": "application/json" },
  });
}

async function handleMetadata(): Promise<Response> {
  if (USE_REMOTE) {
    return proxyMetadata();
  }

  return Response.json({
    enabled: true,
    provider: "dev-oauth",
    authorizationEndpoint: `${ISSUER}/oauth/authorize`,
    tokenEndpoint: `${ISSUER}/oauth/token`,
    clientId: CLIENT_ID,
    scopes: DEFAULT_SCOPE.split(" "),
    redirectUri: REDIRECT_URI,
  });
}

async function handleConsent(request: Request): Promise<Response> {
  if (USE_REMOTE) {
    return htmlPage(
      "OAuth Consent",
      "<p>Consent handling is managed by the remote issuer. Restart the flow to continue.</p>",
    );
  }

  if (request.method !== "POST") {
    return htmlPage("OAuth Consent", "<p>Submit the consent form to continue.</p>");
  }

  const formData = await request.formData();
  const code = String(formData.get("code") ?? "");
  const redirectUri = String(formData.get("redirect_uri") ?? "");
  const state = String(formData.get("state") ?? "");
  const decision = String(formData.get("decision") ?? "deny");

  if (!code || !redirectUri) {
    return htmlPage(
      "OAuth Error",
      "<h1>Invalid consent submission</h1><p>Missing code or redirect URI.</p>",
    );
  }

  const entry = codeStore.get(code);
  if (!entry) {
    return htmlPage(
      "OAuth Error",
      "<h1>Authorization request expired</h1><p>Please restart the sign-in flow.</p>",
    );
  }

  let redirect: URL;
  try {
    redirect = new URL(redirectUri);
  } catch {
    return htmlPage("OAuth Error", "<h1>Invalid redirect URI</h1>");
  }

  if (decision === "deny") {
    codeStore.delete(code);
    redirect.searchParams.set("error", "access_denied");
    redirect.searchParams.set("error_description", "The resource owner denied the request.");
    if (state) {
      redirect.searchParams.set("state", state);
    }
    return Response.redirect(redirect.toString(), 302);
  }

  redirect.searchParams.set("code", code);
  if (state) {
    redirect.searchParams.set("state", state);
  }

  return Response.redirect(redirect.toString(), 302);
}

function cleanupExpiredCodes() {
  const now = Date.now();
  for (const [code, entry] of codeStore.entries()) {
    if (now - entry.createdAt > 5 * 60 * 1000) {
      codeStore.delete(code);
    }
  }
}

setInterval(cleanupExpiredCodes, 60 * 1000).unref();

Bun.serve({
  port: PORT,
  hostname: "0.0.0.0",
  fetch: async (request) => {
    const url = new URL(request.url);

    if (url.pathname === "/.well-known/openid-configuration") {
      return handleMetadata();
    }

    if (url.pathname === "/jwks.json") {
      if (USE_REMOTE) {
        return proxyFetch(request, "/jwks.json");
      }
      return new Response(JSON.stringify({ keys: [jwk] }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/oauth/authorize") {
      return handleAuthorize(url);
    }

    if (url.pathname === "/oauth/token") {
      if (request.method !== "POST") {
        return new Response("method_not_allowed", { status: 405 });
      }
      return handleToken(request);
    }

    if (url.pathname === "/oauth/revoke") {
      if (USE_REMOTE) {
        return proxyFetch(request, "/oauth/revoke");
      }
      return new Response("", { status: 200 });
    }

    if (url.pathname === "/oauth/consent") {
      return handleConsent(request);
    }

    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok", issuer: ISSUER, remote: USE_REMOTE }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (USE_REMOTE) {
      // Fallback proxy to support additional remote paths.
      return proxyFetch(request, url.pathname + url.search, { method: request.method });
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Dev OAuth server listening on ${ISSUER}`);
console.log(`  Authorization Endpoint: ${ISSUER}/oauth/authorize`);
console.log(`  Token Endpoint:         ${ISSUER}/oauth/token`);
console.log(`  JWKS Endpoint:          ${ISSUER}/jwks.json`);
console.log(`  Client ID:              ${CLIENT_ID}`);
console.log(`  Default Redirect URI:   ${REDIRECT_URI}`);
console.log(`  Auto-approve enabled:   ${AUTO_APPROVE ? "yes" : "no"}`);
if (USE_REMOTE) {
  console.log(`  Remote issuer proxy:    ${REMOTE_ISSUER}`);
} else {
  console.log(
    "  Remote issuer proxy:    disabled (set OAUTH_DEV_REMOTE_ISSUER to proxy to SuperTokens)",
  );
}
console.log("Press Ctrl+C to stop.");
