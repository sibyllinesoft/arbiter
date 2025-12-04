import { Hono } from "hono";
import type { AuthService } from "../auth.js";
import { createAuthRouter } from "./auth";
import { createCliRouter } from "./cli";
import { createConfigRouter } from "./config";
import { createCoreRouter } from "./core";
import { createEventsRouter } from "./events";
import { createFragmentsRouter } from "./fragments";
import { createGithubRouter } from "./github";
import { createImportRouter } from "./import";
import { createIrRouter } from "./ir";
import { createProjectsRouter } from "./projects";
import { createSpecsRouter } from "./specs";
import { tunnelRoutes } from "./tunnel";

export type Dependencies = Record<string, unknown>;

const AUTH_EXCLUDED_PATHS = new Set<string>(["/api/auth/metadata", "/api/auth/token", "/health"]);

export { tunnelRoutes } from "./tunnel";
export { createCoreRouter } from "./core";
export { createConfigRouter } from "./config";
export { createCliRouter } from "./cli";
export { createProjectsRouter } from "./projects";
export { createSpecsRouter } from "./specs";
export { createIrRouter } from "./ir";
export { createImportRouter } from "./import";
export { createGithubRouter } from "./github";
export { createEventsRouter } from "./events";
export { createAuthRouter } from "./auth";
export { createFragmentsRouter } from "./fragments";

export function createApiRouter(deps: Dependencies) {
  const root = new Hono();

  // Public endpoints
  root.get("/health", (c) =>
    c.json({ status: "healthy", timestamp: new Date().toISOString(), database: true }),
  );
  root.route("/api/auth", createAuthRouter(deps as any));

  const api = new Hono();

  const authService = deps.auth as AuthService | undefined;
  if (authService) {
    const authMiddleware = authService.createAuthMiddleware();
    api.use("/*", async (c, next) => {
      // normalize full path for exclusions
      const fullPath = `/api${c.req.path}`;
      if (AUTH_EXCLUDED_PATHS.has(fullPath)) {
        return next();
      }

      const result = await authMiddleware(c.req.raw);
      if (!result.authorized) {
        const accept = c.req.header("accept") ?? "";
        const prefersHtml = accept.includes("text/html");
        if (prefersHtml && deps.config && (deps.config as any).oauth?.authorization_endpoint) {
          const authorizationEndpoint = (deps.config as any).oauth.authorization_endpoint;
          const clientId = (deps.config as any).oauth.clientId;
          const redirectUri =
            (deps.config as any).oauth.redirectUri || "http://localhost:3000/oauth/callback";
          const authorizeUrl = new URL(authorizationEndpoint);
          authorizeUrl.searchParams.set("client_id", clientId ?? "dev-cli");
          authorizeUrl.searchParams.set("redirect_uri", redirectUri);
          authorizeUrl.searchParams.set("response_type", "code");
          authorizeUrl.searchParams.set(
            "scope",
            ((deps.config as any).oauth.requiredScopes ?? ["read", "write"]).join(" "),
          );
          const stateParam = c.req.url;
          authorizeUrl.searchParams.set(
            "state",
            Buffer.from(stateParam, "utf-8").toString("base64url"),
          );
          return c.redirect(authorizeUrl.toString(), 302);
        }
        return (
          result.response ??
          c.json(
            {
              type: "https://httpstatuses.com/401",
              title: "Unauthorized",
              status: 401,
              detail: "Valid bearer token required",
            },
            401,
          )
        );
      }

      await next();
    });
  }

  // Mount routers under the secured api group
  api.route("/", createCoreRouter(deps));
  api.route("/", createConfigRouter(deps));
  api.route("/", createCliRouter(deps));
  api.route("/", createProjectsRouter(deps));
  api.route("/", createFragmentsRouter(deps));
  api.route("/", createSpecsRouter(deps));
  api.route("/", createIrRouter(deps));
  api.route("/", createEventsRouter(deps));
  api.route("/import", createImportRouter(deps));
  api.route("/github", createGithubRouter(deps));
  api.route("/tunnel", tunnelRoutes);

  // Attach secured api under /api
  root.route("/api", api);
  return root;
}
