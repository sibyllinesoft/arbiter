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
  const app = new Hono();

  const authService = deps.auth as AuthService | undefined;
  if (authService) {
    const authMiddleware = authService.createAuthMiddleware();
    app.use("/api/*", async (c, next) => {
      const path = c.req.path;
      if (AUTH_EXCLUDED_PATHS.has(path) || path.startsWith("/api/auth/")) {
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

  // Health check at root
  app.get("/health", (c) =>
    c.json({ status: "healthy", timestamp: new Date().toISOString(), database: true }),
  );

  // Mount tunnel routes
  app.route("/api/tunnel", tunnelRoutes);

  // Mount other routers under /api
  app.route("/api", createCoreRouter(deps));
  app.route("/api", createConfigRouter(deps));
  app.route("/api", createCliRouter(deps));
  app.route("/api", createProjectsRouter(deps));
  app.route("/api", createFragmentsRouter(deps));
  app.route("/api", createSpecsRouter(deps));
  app.route("/api", createIrRouter(deps));
  app.route("/api", createEventsRouter(deps));
  app.route("/api", createAuthRouter(deps as any));
  app.route("/api/import", createImportRouter(deps));
  app.route("/api/github", createGithubRouter(deps));

  return app;
}
