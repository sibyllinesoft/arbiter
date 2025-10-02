import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';

const PORT = Number(process.env.OAUTH_DEV_PORT || 4571);
const ISSUER = process.env.OAUTH_DEV_ISSUER || `http://localhost:${PORT}`;
const CLIENT_ID = process.env.OAUTH_DEV_CLIENT_ID || 'dev-cli';
const REDIRECT_URI = process.env.OAUTH_DEV_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob';
const DEFAULT_SCOPE = process.env.OAUTH_DEV_SCOPE || 'read write';

const { publicKey, privateKey } = await generateKeyPair('RS256');
const jwk = await exportJWK(publicKey);
(jwk as any).kid = 'dev-oauth-key';
(jwk as any).alg = 'RS256';

function base64Url(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

interface PendingCode {
  clientId: string;
  redirectUri: string;
  scope: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  createdAt: number;
}

const codeStore = new Map<string, PendingCode>();

function createCode(): string {
  return base64Url(randomBytes(24));
}

function htmlPage(title: string, body: string): Response {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8" /><title>${title}</title>
    <style>body{font-family:system-ui;margin:2rem;line-height:1.6}code{background:#f4f4f4;padding:0.2rem 0.4rem;border-radius:4px}</style>
    </head><body>${body}</body></html>`,
    {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }
  );
}

async function handleAuthorize(url: URL): Promise<Response> {
  const clientId = url.searchParams.get('client_id') || '';
  const redirectUri = url.searchParams.get('redirect_uri') || '';
  const scope = url.searchParams.get('scope') || DEFAULT_SCOPE;
  const state = url.searchParams.get('state') || '';
  const codeChallenge = url.searchParams.get('code_challenge') || undefined;
  const codeChallengeMethod = url.searchParams.get('code_challenge_method') || undefined;

  if (!clientId || clientId !== CLIENT_ID) {
    return htmlPage('OAuth Error', '<h1>Invalid client_id</h1>');
  }

  if (!redirectUri) {
    return htmlPage('OAuth Error', '<h1>Missing redirect_uri</h1>');
  }

  const code = createCode();
  codeStore.set(code, {
    clientId,
    redirectUri,
    scope,
    codeChallenge,
    codeChallengeMethod,
    createdAt: Date.now(),
  });

  if (redirectUri === 'urn:ietf:wg:oauth:2.0:oob') {
    return htmlPage(
      'Arbiter Dev OAuth',
      `<h1>Arbiter Dev OAuth</h1>
       <p>Copy the following authorization code back into the CLI:</p>
       <h2><code>${code}</code></h2>
       <p>Scopes granted: <code>${scope}</code></p>`
    );
  }

  const redirect = new URL(redirectUri);
  redirect.searchParams.set('code', code);
  if (state) {
    redirect.searchParams.set('state', state);
  }

  return Response.redirect(redirect.toString(), 302);
}

function verifyPkce(entry: PendingCode, verifier?: string): boolean {
  if (!entry.codeChallenge) {
    return true;
  }

  if (!verifier) {
    return false;
  }

  if (entry.codeChallengeMethod === 'S256') {
    const hashed = base64Url(createHash('sha256').update(verifier).digest());
    return hashed === entry.codeChallenge;
  }

  // Plain method fallback
  if (entry.codeChallengeMethod === 'plain') {
    return verifier === entry.codeChallenge;
  }

  return true;
}

async function handleToken(request: Request): Promise<Response> {
  const body = await request.text();
  const params = new URLSearchParams(body);

  const grantType = params.get('grant_type');
  if (grantType !== 'authorization_code') {
    return new Response('unsupported_grant_type', { status: 400 });
  }

  const code = params.get('code') || '';
  const verifier = params.get('code_verifier') || undefined;
  const redirectUri = params.get('redirect_uri') || '';

  const entry = codeStore.get(code);
  if (!entry) {
    return new Response('invalid_grant', { status: 400 });
  }

  if (entry.redirectUri !== redirectUri) {
    return new Response('invalid_redirect_uri', { status: 400 });
  }

  if (!verifyPkce(entry, verifier)) {
    return new Response('invalid_pkce', { status: 400 });
  }

  codeStore.delete(code);

  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 3600;
  const payload = {
    sub: 'dev-user',
    aud: 'arbiter-cli',
    iss: ISSUER,
    scope: entry.scope,
    iat: now,
  };

  const accessToken = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', kid: 'dev-oauth-key', typ: 'JWT' })
    .setIssuer(ISSUER)
    .setAudience('arbiter-cli')
    .setSubject('dev-user')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey);

  const responseBody = {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: expiresIn,
    scope: entry.scope,
    refresh_token: base64Url(randomBytes(24)),
  };

  return new Response(JSON.stringify(responseBody), {
    headers: { 'Content-Type': 'application/json' },
  });
}

function handleMetadata(): Response {
  const metadata = {
    issuer: ISSUER,
    authorization_endpoint: `${ISSUER}/oauth/authorize`,
    token_endpoint: `${ISSUER}/oauth/token`,
    revocation_endpoint: `${ISSUER}/oauth/revoke`,
    jwks_uri: `${ISSUER}/jwks.json`,
    scopes_supported: DEFAULT_SCOPE.split(' '),
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256', 'plain'],
  };

  return new Response(JSON.stringify(metadata), {
    headers: { 'Content-Type': 'application/json' },
  });
}

function handleJWKS(): Response {
  return new Response(JSON.stringify({ keys: [jwk] }), {
    headers: { 'Content-Type': 'application/json' },
  });
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
  hostname: '0.0.0.0',
  fetch: async request => {
    const url = new URL(request.url);

    if (url.pathname === '/.well-known/openid-configuration') {
      return handleMetadata();
    }

    if (url.pathname === '/jwks.json') {
      return handleJWKS();
    }

    if (url.pathname === '/oauth/authorize') {
      return handleAuthorize(url);
    }

    if (url.pathname === '/oauth/token') {
      if (request.method !== 'POST') {
        return new Response('method_not_allowed', { status: 405 });
      }
      return handleToken(request);
    }

    if (url.pathname === '/oauth/revoke') {
      return new Response('', { status: 200 });
    }

    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', issuer: ISSUER }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not Found', { status: 404 });
  },
});

console.log(`Dev OAuth server listening on ${ISSUER}`);
console.log(`  Authorization Endpoint: ${ISSUER}/oauth/authorize`);
console.log(`  Token Endpoint:         ${ISSUER}/oauth/token`);
console.log(`  JWKS Endpoint:          ${ISSUER}/jwks.json`);
console.log(`  Client ID:              ${CLIENT_ID}`);
console.log(`  Default Redirect URI:   ${REDIRECT_URI}`);
console.log('Press Ctrl+C to stop.');
