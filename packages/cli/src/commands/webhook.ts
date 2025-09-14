/**
 * Webhook management commands
 */
import chalk from "chalk";
import { ApiClient } from "../api-client.js";
import type { CLIConfig } from "../config.js";
import { withProgress } from "../utils/progress.js";
import { formatTable, formatJson } from "../utils/formatting.js";

export interface WebhookOptions {
  projectId?: string;
  provider?: "github" | "gitlab";
  repository?: string;
  events?: string;
  enabled?: boolean;
  secret?: string;
  format: "table" | "json" | "yaml";
  dry?: boolean;
  force?: boolean;
}

export interface WebhookConfigOptions {
  show?: boolean;
  set?: boolean;
  unset?: boolean;
  list?: boolean;
}

/**
 * List webhook configurations
 */
export async function listWebhooksCommand(
  options: WebhookOptions,
  config: CLIConfig
): Promise<number> {
  const client = new ApiClient(config.apiUrl, { timeout: config.timeout });
  
  try {
    const webhooksData = await withProgress("Fetching webhooks...", async () => {
      const response = await client.request("/api/webhooks", {
        method: "GET"
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch webhooks: ${response.statusText}`);
      }
      
      return response.json();
    });

    if (options.format === "json") {
      console.log(formatJson(webhooksData));
      return 0;
    }

    // Display webhook status
    console.log(chalk.blue("\n📡 Webhook Configuration\n"));
    
    console.log(`Status: ${webhooksData.enabled ? chalk.green("Enabled") : chalk.red("Disabled")}`);
    console.log(`Providers: ${webhooksData.providers.join(", ")}`);
    
    console.log(chalk.blue("\n🔗 Endpoints:\n"));
    Object.entries(webhooksData.endpoints).forEach(([provider, endpoint]) => {
      console.log(`  ${provider}: ${config.apiUrl}${endpoint}`);
    });

    if (webhooksData.configuration) {
      console.log(chalk.blue("\n⚙️  Configuration:\n"));
      
      const configTable = [
        ["Setting", "Value"],
        ["Sync on Push", webhooksData.configuration.sync_on_push ? "Yes" : "No"],
        ["Validate on Merge", webhooksData.configuration.validate_on_merge ? "Yes" : "No"],
        ["Allowed Repos", webhooksData.configuration.allowed_repos?.length || 0],
        ["GitHub Secret", webhooksData.configuration.github_secret ? "Set" : "Not set"],
        ["GitLab Secret", webhooksData.configuration.gitlab_secret ? "Set" : "Not set"],
      ];
      
      console.log(formatTable(configTable));
    }

    return 0;
  } catch (error) {
    console.error(chalk.red("Error listing webhooks:"), error instanceof Error ? error.message : error);
    return 1;
  }
}

/**
 * Get webhook configuration for a specific project
 */
export async function getWebhookCommand(
  projectId: string,
  options: WebhookOptions,
  config: CLIConfig
): Promise<number> {
  if (!projectId) {
    console.error(chalk.red("Error: Project ID is required"));
    return 1;
  }

  const client = new ApiClient(config.apiUrl, { timeout: config.timeout });
  
  try {
    const webhookConfig = await withProgress(`Getting webhook config for ${projectId}...`, async () => {
      const response = await client.request(`/api/webhooks/${projectId}`, {
        method: "GET"
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("No webhook configuration found for this project");
        }
        throw new Error(`Failed to get webhook config: ${response.statusText}`);
      }
      
      return response.json();
    });

    if (options.format === "json") {
      console.log(formatJson(webhookConfig));
      return 0;
    }

    console.log(chalk.blue(`\n📡 Webhook Configuration - ${projectId}\n`));
    
    const configData = [
      ["Property", "Value"],
      ["Provider", webhookConfig.provider],
      ["Repository", webhookConfig.repository_url || "Not set"],
      ["Enabled", webhookConfig.enabled ? "Yes" : "No"],
      ["Events", webhookConfig.events.join(", ")],
      ["Created", new Date(webhookConfig.created_at).toLocaleString()],
      ["Updated", new Date(webhookConfig.updated_at).toLocaleString()],
    ];
    
    console.log(formatTable(configData));

    return 0;
  } catch (error) {
    console.error(chalk.red("Error getting webhook config:"), error instanceof Error ? error.message : error);
    return 1;
  }
}

/**
 * Create or update webhook configuration
 */
export async function setWebhookCommand(
  projectId: string,
  options: WebhookOptions,
  config: CLIConfig
): Promise<number> {
  if (!projectId) {
    console.error(chalk.red("Error: Project ID is required"));
    return 1;
  }

  if (!options.provider) {
    console.error(chalk.red("Error: Provider (--provider github|gitlab) is required"));
    return 1;
  }

  const client = new ApiClient(config.apiUrl, { timeout: config.timeout });
  
  try {
    const webhookConfig = {
      project_id: projectId,
      provider: options.provider,
      repository_url: options.repository || "",
      enabled: options.enabled ?? true,
      events: options.events ? options.events.split(",") : ["push"],
      secret_hash: options.secret ? Buffer.from(options.secret).toString('base64') : undefined
    };

    if (options.dry) {
      console.log(chalk.yellow("🔍 Dry run - would create/update webhook config:"));
      console.log(formatJson(webhookConfig));
      return 0;
    }

    const result = await withProgress("Creating/updating webhook config...", async () => {
      const response = await client.request("/api/webhooks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(webhookConfig)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create webhook config: ${response.statusText}`);
      }
      
      return response.json();
    });

    if (options.format === "json") {
      console.log(formatJson(result));
      return 0;
    }

    console.log(chalk.green("✅ Webhook configuration saved successfully"));
    console.log(chalk.blue(`\n📡 Configuration for ${projectId}:\n`));
    
    const configData = [
      ["Provider", result.provider],
      ["Repository", result.repository_url || "Not set"],
      ["Enabled", result.enabled ? "Yes" : "No"],
      ["Events", result.events.join(", ")],
    ];
    
    console.log(formatTable(configData));

    console.log(chalk.blue("\n🔗 Webhook URL:"));
    console.log(`${config.apiUrl}/webhooks/${result.provider}`);
    
    return 0;
  } catch (error) {
    console.error(chalk.red("Error setting webhook config:"), error instanceof Error ? error.message : error);
    return 1;
  }
}

/**
 * Delete webhook configuration
 */
export async function deleteWebhookCommand(
  projectId: string,
  options: WebhookOptions,
  config: CLIConfig
): Promise<number> {
  if (!projectId) {
    console.error(chalk.red("Error: Project ID is required"));
    return 1;
  }

  if (!options.force) {
    console.log(chalk.yellow("Warning: This will delete the webhook configuration for this project."));
    console.log(chalk.yellow("Use --force to confirm deletion."));
    return 1;
  }

  const client = new ApiClient(config.apiUrl, { timeout: config.timeout });
  
  try {
    await withProgress(`Deleting webhook config for ${projectId}...`, async () => {
      const response = await client.request(`/api/webhooks/${projectId}`, {
        method: "DELETE"
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("No webhook configuration found for this project");
        }
        throw new Error(`Failed to delete webhook config: ${response.statusText}`);
      }
      
      return response.json();
    });

    console.log(chalk.green("✅ Webhook configuration deleted successfully"));
    return 0;
  } catch (error) {
    console.error(chalk.red("Error deleting webhook config:"), error instanceof Error ? error.message : error);
    return 1;
  }
}

/**
 * Test webhook endpoint
 */
export async function testWebhookCommand(
  provider: "github" | "gitlab",
  options: WebhookOptions,
  config: CLIConfig
): Promise<number> {
  if (!provider || !["github", "gitlab"].includes(provider)) {
    console.error(chalk.red("Error: Provider must be 'github' or 'gitlab'"));
    return 1;
  }

  // Create a test payload based on provider
  const testPayload = provider === "github" ? {
    repository: {
      full_name: "test/repo",
      clone_url: "https://github.com/test/repo.git"
    },
    commits: [{
      id: "abc123",
      message: "Test commit",
      author: {
        name: "Test User",
        email: "test@example.com"
      }
    }],
    ref: "refs/heads/main"
  } : {
    repository: {
      full_name: "test/repo",
      clone_url: "https://gitlab.com/test/repo.git"
    },
    commits: [{
      id: "abc123",
      message: "Test commit",
      author: {
        name: "Test User",
        email: "test@example.com"
      }
    }],
    ref: "refs/heads/main"
  };

  const client = new ApiClient(config.apiUrl, { timeout: config.timeout });
  
  try {
    console.log(chalk.blue(`🧪 Testing ${provider} webhook endpoint...\n`));

    if (options.dry) {
      console.log(chalk.yellow("🔍 Dry run - would send test payload:"));
      console.log(formatJson(testPayload));
      return 0;
    }

    const result = await withProgress("Sending test webhook...", async () => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };

      // Add provider-specific headers
      if (provider === "github") {
        headers["x-github-event"] = "push";
        if (options.secret) {
          // For testing, we'll skip signature generation
          headers["x-hub-signature-256"] = "sha256=test";
        }
      } else {
        headers["x-gitlab-event"] = "Push Hook";
        if (options.secret) {
          headers["x-gitlab-token"] = options.secret;
        }
      }

      const response = await client.request(`/webhooks/${provider}`, {
        method: "POST",
        headers,
        body: JSON.stringify(testPayload)
      });
      
      return {
        ok: response.ok,
        status: response.status,
        data: await response.json()
      };
    });

    if (result.ok) {
      console.log(chalk.green("✅ Webhook test successful"));
      if (options.format === "json") {
        console.log(formatJson(result.data));
      } else {
        console.log(`Status: ${result.status}`);
        console.log(`Message: ${result.data.message}`);
        if (result.data.actions_taken) {
          console.log(`Actions: ${result.data.actions_taken.join(", ")}`);
        }
      }
    } else {
      console.log(chalk.red("❌ Webhook test failed"));
      console.log(`Status: ${result.status}`);
      console.log(`Error: ${result.data.message || "Unknown error"}`);
    }

    return result.ok ? 0 : 1;
  } catch (error) {
    console.error(chalk.red("Error testing webhook:"), error instanceof Error ? error.message : error);
    return 1;
  }
}

/**
 * Show webhook setup instructions
 */
export function showWebhookHelp(): void {
  console.log(chalk.blue("\n📡 Webhook Setup Guide\n"));
  
  console.log(chalk.yellow("1. Enable webhooks in your Arbiter server:"));
  console.log("   export WEBHOOKS_ENABLED=true");
  console.log("   export WEBHOOK_SECRET=your-secret-key");
  console.log("   export GITHUB_WEBHOOK_SECRET=github-specific-secret");
  console.log("   export GITLAB_WEBHOOK_SECRET=gitlab-specific-secret");
  
  console.log(chalk.yellow("\n2. Set up Cloudflare tunnel for local development:"));
  console.log("   ./scripts/cloudflare-tunnel.sh start");
  
  console.log(chalk.yellow("\n3. Configure webhook in your repository:"));
  console.log("   GitHub: Settings → Webhooks → Add webhook");
  console.log("   GitLab: Settings → Webhooks → Add webhook");
  
  console.log(chalk.yellow("\n4. Webhook configuration:"));
  console.log("   URL: https://your-tunnel.cfargotunnel.com/webhooks/github");
  console.log("   Content type: application/json");
  console.log("   Secret: (your webhook secret)");
  console.log("   Events: push, pull requests (GitHub) / push, merge requests (GitLab)");
  
  console.log(chalk.yellow("\n5. Test your webhook:"));
  console.log("   arbiter webhook test github --secret your-secret");
  
  console.log(chalk.blue("\n📚 Commands:"));
  console.log("   arbiter webhook list                     - List webhook status");
  console.log("   arbiter webhook get <project-id>         - Get webhook config");
  console.log("   arbiter webhook set <project-id> [opts]  - Set webhook config");
  console.log("   arbiter webhook delete <project-id>      - Delete webhook config");
  console.log("   arbiter webhook test <provider>          - Test webhook endpoint");
  console.log("   arbiter webhook help                     - Show this help");
}