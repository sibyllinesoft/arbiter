#!/usr/bin/env node

/**
 * Basic AI Agent Setup Example
 *
 * This script demonstrates how to set up and use AI agents for webhook processing.
 * It includes configuration, initialization, and basic usage examples.
 */

import { join } from "node:path";
import { AgentManager } from "../AgentManager.js";

// Mock webhook events for testing
const mockPullRequestEvent = {
  id: "test-pr-001",
  timestamp: new Date().toISOString(),
  provider: "github",
  eventType: "pull_request",
  payload: {
    action: "opened",
    pull_request: {
      number: 123,
      title: "feat(auth): implement OAuth2 authentication",
      body: "This PR implements OAuth2 authentication using industry best practices.\n\n/review-code security\n\nPlease review for security vulnerabilities and code quality.",
      state: "open",
      draft: false,
      head: { ref: "feature/oauth2-auth" },
      base: { ref: "main" },
      html_url: "https://github.com/example/repo/pull/123",
      commits: 5,
      additions: 250,
      deletions: 30,
      changed_files: 8,
      user: {
        login: "developer1",
        name: "Alice Developer",
      },
    },
    repository: {
      name: "example-app",
      full_name: "example/example-app",
      html_url: "https://github.com/example/example-app",
      default_branch: "main",
    },
    sender: {
      login: "developer1",
    },
  },
  headers: {
    "x-github-event": "pull_request",
  },
};

const mockIssueEvent = {
  id: "test-issue-001",
  timestamp: new Date().toISOString(),
  provider: "github",
  eventType: "issues",
  payload: {
    action: "opened",
    issue: {
      number: 456,
      title: "Login page shows 500 error on invalid credentials",
      body: "When users enter invalid credentials on the login page, they see a generic 500 error instead of a helpful message.\n\nSteps to reproduce:\n1. Go to /login\n2. Enter invalid credentials\n3. Submit form\n4. See 500 error page\n\nExpected: User-friendly error message\nActual: Generic 500 error page",
      state: "open",
      labels: [],
      assignees: [],
      user: {
        login: "user123",
        name: "Bob User",
      },
    },
    repository: {
      name: "example-app",
      full_name: "example/example-app",
      html_url: "https://github.com/example/example-app",
    },
  },
  headers: {
    "x-github-event": "issues",
  },
};

async function demonstrateBasicSetup() {
  console.log("🤖 AI Agent Basic Setup Demonstration\n");

  try {
    // Initialize the agent manager
    console.log("1. Initializing AgentManager...");
    const configPath = join(
      process.cwd(),
      "packages/arbiter-core/src/handlers/ai/config/ai-agents.json",
    );
    const agentManager = new AgentManager(configPath);

    // Note: In a real setup, you'd have a proper configuration file
    console.log("   📄 Loading configuration from:", configPath);
    console.log("   ⚠️  Make sure to configure your API keys in the config file!\n");

    await agentManager.initialize();
    console.log("   ✅ AgentManager initialized successfully\n");

    // Check status
    console.log("2. Checking agent status...");
    const status = agentManager.getStatus();
    console.log("   📊 Status:", {
      initialized: status.initialized,
      agentCount: status.agentCount,
      enabledAgents: status.enabledAgents,
    });

    if (status.agentCount === 0) {
      console.log(
        "   ⚠️  No agents enabled. Enable agents in the configuration file to see them in action.\n",
      );
      return;
    }

    console.log("   📈 Metrics:", status.metrics);
    console.log("");

    // Process a pull request event
    console.log("3. Processing Pull Request event...");
    console.log("   📝 PR Title:", mockPullRequestEvent.payload.pull_request.title);
    console.log("   🔍 Looking for AI commands in PR description...");

    const prResult = await agentManager.processEvent(mockPullRequestEvent);
    console.log("   📤 Result:", {
      success: prResult.success,
      message: prResult.message,
      agentsProcessed: prResult.metadata?.agentsProcessed || 0,
    });
    console.log("");

    // Process a command directly
    console.log("4. Processing AI command directly...");
    const commandResult = await agentManager.processCommand(
      "review-code",
      ["security"],
      mockPullRequestEvent,
      { source: "manual_test" },
    );
    console.log("   🎯 Command Result:", {
      success: commandResult.success,
      message: commandResult.message,
      agentId: commandResult.metadata?.agentId,
    });
    console.log("");

    // Process an issue event
    console.log("5. Processing Issue event...");
    console.log("   🐛 Issue Title:", mockIssueEvent.payload.issue.title);

    const issueResult = await agentManager.processEvent(mockIssueEvent);
    console.log("   📤 Result:", {
      success: issueResult.success,
      message: issueResult.message,
    });
    console.log("");

    // Test provider connectivity
    console.log("6. Testing AI provider connectivity...");
    const providerResults = await agentManager.testProviders();
    console.log("   🔌 Provider Status:", providerResults);
    console.log("");

    // Final status check
    console.log("7. Final status check...");
    const finalStatus = agentManager.getStatus();
    console.log("   📊 Final Metrics:", finalStatus.metrics);
    console.log("");

    console.log("✅ Basic setup demonstration completed successfully!\n");

    // Usage examples
    printUsageExamples();
  } catch (error) {
    console.error("❌ Error during demonstration:", error.message);

    if (error.message.includes("Configuration file not found")) {
      console.log("\n💡 To fix this:");
      console.log("1. Copy the example configuration:");
      console.log(
        "   cp packages/arbiter-core/src/handlers/ai/config/ai-agents.json.example packages/arbiter-core/src/handlers/ai/config/ai-agents.json",
      );
      console.log("2. Configure your AI provider API keys");
      console.log('3. Enable desired agents by setting "enabled": true');
    }
  }
}

function printUsageExamples() {
  console.log("🎯 Usage Examples:\n");

  console.log("📝 **Pull Request Commands:**");
  console.log("   Add these commands to PR comments or descriptions:");
  console.log("   • /review-code                 - Comprehensive code review");
  console.log("   • /security-scan critical      - Security vulnerability scan");
  console.log("   • /performance-check memory    - Performance analysis");
  console.log("   • /style-check typescript      - Code style review");
  console.log("   • /generate-docs api           - API documentation\n");

  console.log("🐛 **Issue Commands:**");
  console.log("   Add these commands to issue comments:");
  console.log("   • /analyze-issue               - Comprehensive issue analysis");
  console.log("   • /categorize                  - Categorize and label");
  console.log("   • /estimate                    - Complexity estimation");
  console.log("   • /triage                      - Priority assessment");
  console.log("   • /suggest-assignee            - Assignment recommendations\n");

  console.log("🔒 **Security Commands:**");
  console.log("   • /vulnerability-check injection  - Check for injection vulnerabilities");
  console.log("   • /dependency-audit               - Audit third-party dependencies");
  console.log("   • /auth-review oauth              - Review authentication implementation");
  console.log("   • /data-privacy gdpr              - GDPR compliance check\n");

  console.log("📚 **Documentation Commands:**");
  console.log("   • /readme                      - Generate or update README");
  console.log("   • /changelog                   - Generate changelog entries");
  console.log("   • /migration-guide v2.0        - Create migration documentation");
  console.log("   • /code-comments jsdoc         - Suggest code comments\n");

  console.log("🔧 **Configuration Tips:**");
  console.log('   • Enable "autoResponse": true for automatic processing');
  console.log("   • Set appropriate rate limits to control costs");
  console.log("   • Use eventFilters to limit which events trigger agents");
  console.log("   • Configure custom prompts for specific use cases\n");

  console.log("📊 **Monitoring:**");
  console.log("   • Health check: GET /health/ai");
  console.log("   • Metrics: GET /metrics/ai");
  console.log("   • Logs: Check application logs for detailed information\n");
}

// Run the demonstration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateBasicSetup().catch(console.error);
}

export { demonstrateBasicSetup, mockPullRequestEvent, mockIssueEvent };
