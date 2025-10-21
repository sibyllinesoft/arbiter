import { Hono } from "hono";

type Dependencies = Record<string, unknown>;

export function createWebhooksRouter(deps: Dependencies) {
  const router = new Hono();

  // Setup webhook
  router.post("/github/setup", async (c) => {
    const { repoOwner, repoName, events, tunnelUrl } = await c.req.json();

    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return c.json(
        {
          success: false,
          error: "GITHUB_TOKEN environment variable not set",
        },
        400,
      );
    }

    try {
      // Create webhook on GitHub
      const webhookUrl =
        tunnelUrl || process.env.TUNNEL_URL || "https://your-tunnel.cfargotunnel.com";
      const webhookPayload = {
        name: "web",
        active: true,
        events: events || ["push", "pull_request"],
        config: {
          url: `${webhookUrl}/webhooks/github`,
          content_type: "json",
          secret: process.env.GITHUB_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET,
          insecure_ssl: "0",
        },
      };

      const response = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/hooks`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(webhookPayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return c.json(
          {
            success: false,
            error: `GitHub API error: ${errorData.message}`,
            details: errorData,
          },
          400,
        );
      }

      const webhookData = await response.json();

      return c.json({
        success: true,
        webhook: {
          id: webhookData.id,
          url: webhookData.config.url,
          events: webhookData.events,
          active: webhookData.active,
          created_at: webhookData.created_at,
          updated_at: webhookData.updated_at,
        },
        message: `Webhook created successfully for ${repoOwner}/${repoName}`,
      });
    } catch (error) {
      console.error("Failed to create GitHub webhook:", error);
      return c.json(
        {
          success: false,
          error: "Failed to create webhook",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  });

  // List webhooks
  router.get("/github/list/:owner/:repo", async (c) => {
    const owner = c.req.param("owner");
    const repo = c.req.param("repo");

    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return c.json(
        {
          success: false,
          error: "GITHUB_TOKEN environment variable not set",
        },
        400,
      );
    }

    try {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/hooks`, {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        return c.json(
          {
            success: false,
            error: `GitHub API error: ${errorData.message}`,
          },
          400,
        );
      }

      const webhooks = await response.json();

      return c.json({
        success: true,
        webhooks: webhooks.map((hook: any) => ({
          id: hook.id,
          name: hook.name,
          url: hook.config?.url,
          events: hook.events,
          active: hook.active,
          created_at: hook.created_at,
          updated_at: hook.updated_at,
        })),
      });
    } catch (error) {
      console.error("Failed to list GitHub webhooks:", error);
      return c.json(
        {
          success: false,
          error: "Failed to list webhooks",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  });

  // Delete webhook
  router.delete("/github/:owner/:repo/:hookId", async (c) => {
    const owner = c.req.param("owner");
    const repo = c.req.param("repo");
    const hookId = c.req.param("hookId");

    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return c.json(
        {
          success: false,
          error: "GITHUB_TOKEN environment variable not set",
        },
        400,
      );
    }

    try {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/hooks/${hookId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        return c.json(
          {
            success: false,
            error: `GitHub API error: ${errorData.message}`,
          },
          400,
        );
      }

      return c.json({
        success: true,
        message: `Webhook ${hookId} deleted successfully from ${owner}/${repo}`,
      });
    } catch (error) {
      console.error("Failed to delete GitHub webhook:", error);
      return c.json(
        {
          success: false,
          error: "Failed to delete webhook",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  });

  return router;
}
