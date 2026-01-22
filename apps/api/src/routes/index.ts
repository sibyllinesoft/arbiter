import type { Context, Next } from "hono";
import { Hono } from "hono";
import type { AuthService } from "../auth";
// core routes
import { createEventsRouter } from "./core/events";
import { createImportRouter } from "./core/import";
import { createIrRouter } from "./core/ir";
// io routes
import { createConfigRouter } from "./io/config";
import { createEntitiesRouter } from "./io/entities";
import { createFragmentsRouter } from "./io/fragments";
import { createProjectsRouter } from "./io/projects";
import { createSpecsRouter } from "./io/specs";
// util routes
import { createAuthRouter } from "./util/auth";
import { createCliRouter } from "./util/cli";
import { createCoreRouter } from "./util/core";
import { createGithubRouter } from "./util/github";
import { tunnelRoutes } from "./util/tunnel";

export type Dependencies = Record<string, unknown>;

const AUTH_EXCLUDED_PATHS = new Set<string>(["/api/auth/metadata", "/api/auth/token", "/health"]);

// Re-exports
export { tunnelRoutes } from "./util/tunnel";
export { createCoreRouter } from "./util/core";
export { createConfigRouter } from "./io/config";
export { createCliRouter } from "./util/cli";
export { createProjectsRouter } from "./io/projects";
export { createSpecsRouter } from "./io/specs";
export { createIrRouter } from "./core/ir";
export { createImportRouter } from "./core/import";
export { createGithubRouter } from "./util/github";
export { createEventsRouter } from "./core/events";
export { createAuthRouter } from "./util/auth";
export { createEntitiesRouter } from "./io/entities";
export { createFragmentsRouter } from "./io/fragments";

function buildOAuthRedirectUrl(config: any, requestUrl: string): string {
  const authorizationEndpoint = config.oauth.authorization_endpoint;
  const clientId = config.oauth.clientId ?? "dev-cli";
  const redirectUri = config.oauth.redirectUri || "http://localhost:3000/oauth/callback";
  const scopes = (config.oauth.requiredScopes ?? ["read", "write"]).join(" ");

  const authorizeUrl = new URL(authorizationEndpoint);
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", scopes);
  authorizeUrl.searchParams.set("state", Buffer.from(requestUrl, "utf-8").toString("base64url"));

  return authorizeUrl.toString();
}

function createUnauthorizedResponse(c: Context) {
  return c.json(
    {
      type: "https://httpstatuses.com/401",
      title: "Unauthorized",
      status: 401,
      detail: "Valid bearer token required",
    },
    401,
  );
}

function mountRouters(api: Hono, deps: Dependencies) {
  api.route("/", createCoreRouter(deps));
  api.route("/", createConfigRouter(deps));
  api.route("/", createCliRouter(deps));
  api.route("/", createProjectsRouter(deps));
  api.route("/", createFragmentsRouter(deps));
  api.route("/", createEntitiesRouter(deps));
  api.route("/", createSpecsRouter(deps));
  api.route("/", createIrRouter(deps));
  api.route("/", createEventsRouter(deps));
  api.route("/import", createImportRouter(deps));
  api.route("/github", createGithubRouter(deps));
  api.route("/tunnel", tunnelRoutes);
}

export function createApiRouter(deps: Dependencies) {
  const root = new Hono();

  root.get("/health", (c) =>
    c.json({ status: "healthy", timestamp: new Date().toISOString(), database: true }),
  );
  root.route("/api/auth", createAuthRouter(deps as any));

  const api = new Hono();
  const authService = deps.auth as AuthService | undefined;

  if (authService) {
    const authMiddleware = authService.createAuthMiddleware();

    api.use("/*", async (c, next) => {
      const fullPath = `/api${c.req.path}`;
      if (AUTH_EXCLUDED_PATHS.has(fullPath)) return next();

      const result = await authMiddleware(c.req.raw);
      if (result.authorized) return next();

      const prefersHtml = (c.req.header("accept") ?? "").includes("text/html");
      const config = deps.config as any;

      if (prefersHtml && config?.oauth?.authorization_endpoint) {
        return c.redirect(buildOAuthRedirectUrl(config, c.req.url), 302);
      }

      return result.response ?? createUnauthorizedResponse(c);
    });
  }

  mountRouters(api, deps);
  root.route("/api", api);
  return root;
}
