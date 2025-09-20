import { describe, expect, it } from "bun:test";
import type { WebhookEvent } from "../../shared/utils.ts";
import { CodeReviewAgent } from "../agents/CodeReviewAgent.ts";
import type {
  AIAgentConfig,
  AICommand,
  AIContext,
  AIProvider,
  AIProviderConfig,
  AIProviderStatus,
  AIResponse,
} from "../base/types.ts";

class FakeProvider implements AIProvider {
  public calls: Array<{ command: AICommand; context: AIContext }> = [];

  constructor(private readonly response: AIResponse) {}

  getName(): string {
    return "fake";
  }

  getConfig(): AIProviderConfig {
    return { apiKey: "test" };
  }

  async processCommand(command: AICommand, context: AIContext): Promise<AIResponse> {
    this.calls.push({ command, context });
    return this.response;
  }

  async testConnection() {
    return { success: true };
  }

  async getStatus(): Promise<AIProviderStatus> {
    return {
      name: "fake",
      connected: true,
      model: "fake-model",
      usage: {
        requestsToday: 0,
        tokensToday: 0,
      },
      performance: {
        averageResponseTime: 0,
        successRate: 1,
        errorRate: 0,
      },
    };
  }
}

class TestableCodeReviewAgent extends CodeReviewAgent {
  public comments: any[] = [];
  public labels: any[] = [];
  public assignments: any[] = [];
  public activities: any[] = [];

  constructor(config: AIAgentConfig, provider: AIProvider) {
    super(config);
    this.provider = provider;
  }

  async invokeCommand(commandName: string, eventData: any, originalEvent: WebhookEvent) {
    const command = this.commands.get(commandName);
    if (!command) {
      throw new Error(`Command ${commandName} is not registered`);
    }

    const context = {
      command: commandName,
      source: "test",
      eventData,
    };

    return await (this as any).executeAICommand(command, [], context, eventData, originalEvent);
  }

  protected async postComment(data: { body: string }): Promise<any> {
    this.comments.push(data);
    return { action: "comment", body: data.body };
  }

  protected async addLabels(data: { labels: string[] }): Promise<any> {
    this.labels.push(data);
    return { action: "label", labels: data.labels };
  }

  protected async assignUsers(data: { assignees: string[] }): Promise<any> {
    this.assignments.push(data);
    return { action: "assign", assignees: data.assignees };
  }

  protected async logActivity(data: any): Promise<void> {
    this.activities.push(data);
  }
}

const baseConfig: AIAgentConfig = {
  id: "code-review",
  type: "code-review",
  name: "Code Review Agent",
  description: "Automated code reviewer",
  enabled: true,
  version: "1.0.0",
  provider: {
    type: "openai",
    config: { apiKey: "test-key" },
  },
  commands: {
    enabled: ["review-code"],
    disabled: [],
  },
  behavior: {
    autoResponse: false,
    verboseLogging: false,
    dryRun: false,
  },
};

const pullRequestEvent: WebhookEvent = {
  id: "evt-1",
  timestamp: new Date().toISOString(),
  provider: "github",
  eventType: "pull_request",
  headers: {},
  payload: {
    action: "opened",
    pull_request: {
      number: 42,
      title: "Improve documentation",
      body: "This PR adds docs. /review-code",
      state: "open",
      draft: false,
      html_url: "https://github.com/example/repo/pull/42",
      head: {
        ref: "feature/docs",
        sha: "abc123",
        repo: {
          full_name: "example/repo",
        },
      },
      base: {
        ref: "main",
        sha: "def456",
        repo: {
          full_name: "example/repo",
        },
      },
      user: {
        login: "octocat",
        name: "Mona Octocat",
        avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
      },
      commits: 1,
      additions: 10,
      deletions: 2,
      changed_files: 1,
      labels: [],
      assignees: [],
      requested_reviewers: [],
      review_comments: 0,
      comments: 0,
    },
    repository: {
      id: 1,
      name: "repo",
      full_name: "example/repo",
      default_branch: "main",
      html_url: "https://github.com/example/repo",
      owner: {
        login: "example",
      },
    },
    sender: {
      login: "octocat",
    },
  },
};

describe("CodeReviewAgent", () => {
  it("processes /review-code command and executes AI suggested actions", async () => {
    const fakeProvider = new FakeProvider({
      success: true,
      data: {
        summary: "Automated review",
      },
      actions: [
        {
          type: "comment",
          data: { body: "Great work! Consider adding more tests." },
        },
        {
          type: "label",
          data: { labels: ["ai-reviewed"] },
        },
      ],
    });

    const agent = new TestableCodeReviewAgent(baseConfig, fakeProvider);

    const eventData = {
      repository: {
        name: "repo",
        fullName: "example/repo",
        url: "https://github.com/example/repo",
        defaultBranch: "main",
      },
      user: {
        login: "octocat",
      },
      pullRequest: {
        number: 42,
        title: "Improve documentation",
        body: "This PR adds docs. /review-code",
        state: "open" as const,
        draft: false,
        sourceBranch: "feature/docs",
        targetBranch: "main",
        url: "https://github.com/example/repo/pull/42",
      },
    };

    const response = await agent.invokeCommand("review-code", eventData, pullRequestEvent);

    expect(response.success).toBe(true);
    expect(fakeProvider.calls).toHaveLength(1);
    expect(fakeProvider.calls[0].command.name).toBe("review-code");
    expect(fakeProvider.calls[0].context.command).toBe("review-code");
    expect(agent.comments).toHaveLength(1);
    expect(agent.comments[0].body).toContain("Great work!");
    expect(agent.labels[0].labels).toContain("ai-reviewed");
    expect(response.metadata?.actions).toHaveLength(2);
    expect(response.metadata?.actions?.[0]?.success).toBe(true);
  });

  it("automatically reviews pull requests when autoResponse is enabled", async () => {
    const autoConfig: AIAgentConfig = {
      ...baseConfig,
      behavior: {
        ...baseConfig.behavior,
        autoResponse: true,
      },
    };

    const event: WebhookEvent = JSON.parse(JSON.stringify(pullRequestEvent));
    event.payload.pull_request.body = "Routine update";

    const provider = new FakeProvider({ success: true, actions: [] });
    const agent = new TestableCodeReviewAgent(autoConfig, provider);

    const response = await agent.handleEvent(event);

    expect(response.success).toBe(true);
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0].context.command).toBe("review-code");
  });
});
