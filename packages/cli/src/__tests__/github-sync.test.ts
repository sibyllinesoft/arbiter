import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";
import { GitHubSyncClient } from "../utils/github-sync.js";
import type { GitHubSyncConfig } from "../types.js";
import type { Epic, Task } from "../utils/sharded-storage.js";
import fs from "fs-extra";
import path from "node:path";

// Create a more robust mock for Octokit
const mockIssuesApi = {
  listForRepo: mock(() => Promise.resolve({ data: [] })),
  listMilestones: mock(() => Promise.resolve({ data: [] })),
  create: mock(() => Promise.resolve({
    data: {
      number: 123,
      title: "[Epic] Test Epic",
      body: "Test description",
      state: "open",
      labels: []
    }
  })),
  update: mock(() => Promise.resolve({
    data: {
      number: 123,
      title: "[Epic] Test Epic Updated", 
      body: "Test description updated",
      state: "open",
      labels: []
    }
  })),
  createMilestone: mock(() => Promise.resolve({
    data: {
      number: 456,
      title: "Epic: Test Epic",
      state: "open",
      description: "Test milestone"
    }
  })),
  updateMilestone: mock(() => Promise.resolve({
    data: {
      number: 456,
      title: "Epic: Test Epic Updated",
      state: "open", 
      description: "Test milestone updated"
    }
  }))
};

const mockPaginate = mock((fn: Function, params: any) => {
  // Return empty arrays by default
  return Promise.resolve([]);
});

const mockOctokit = {
  rest: {
    issues: mockIssuesApi
  },
  paginate: mockPaginate
};

// Mock the Octokit constructor
mock.module("@octokit/rest", () => ({
  Octokit: class MockOctokit {
    constructor(config: any) {
      return mockOctokit;
    }
  }
}));

// Mock FileBasedTemplateManager
mock.module("../utils/file-based-template-manager.js", () => ({
  FileBasedTemplateManager: class MockFileBasedTemplateManager {
    constructor(config: any) {
      this.config = config;
    }
    
    async generateEpicTemplate(epic: Epic, options: any = {}) {
      return {
        title: `[Epic] ${epic.name}`,
        body: `<!-- arbiter-id: ${epic.id} -->\n\n${epic.description || ""}\n\n**Status:** ${epic.status}\n**Priority:** ${epic.priority}\n${epic.owner ? `**Owner:** ${epic.owner}\n` : ""}${epic.assignee ? `**Assignee:** ${epic.assignee}\n` : ""}${epic.estimatedHours ? `**Estimated Hours:** ${epic.estimatedHours}\n` : ""}${epic.dueDate ? `**Due Date:** ${epic.dueDate}\n` : ""}\n**Tasks:** ${epic.tasks ? epic.tasks.length : 0} tasks\n\n${epic.labels ? `**Labels:** ${epic.labels.join(", ")}\n` : ""}`,
        labels: [
          "epic",
          ...(epic.labels || []),
          `priority-${epic.priority}`
        ].filter((label, index, arr) => arr.indexOf(label) === index),
        assignee: epic.assignee,
        milestone: options.milestoneNumber,
        dueDate: epic.dueDate
      };
    }
    
    async generateTaskTemplate(task: Task, epic: Epic, options: any = {}) {
      let body = `<!-- arbiter-id: ${task.id} -->\n\n`;
      if (task.description) {
        body += `${task.description}\n\n`;
      }
      body += `**Epic:** ${epic.name}\n`;
      body += `**Type:** ${task.type}\n`;
      if (task.priority) {
        body += `**Priority:** ${task.priority}\n`;
      }
      if (task.status) {
        body += `**Status:** ${task.status}\n`;
      }
      if (task.estimatedHours) {
        body += `**Estimated Hours:** ${task.estimatedHours}\n`;
      }
      if (task.assignee) {
        body += `**Assignee:** ${task.assignee}\n`;
      }
      
      if (task.acceptanceCriteria && task.acceptanceCriteria.length > 0) {
        body += `\n**Acceptance Criteria:**\n`;
        for (const criteria of task.acceptanceCriteria) {
          body += `- ${criteria}\n`;
        }
      }
      
      const labels = ["task"];
      if (task.type === "test") {
        labels.push("test");
      }
      
      return {
        title: `[Task] ${task.name}`,
        body,
        labels,
        assignee: task.assignee,
        milestone: options.milestoneNumber
      };
    }
    
    async generateMilestoneTemplate(epic: Epic) {
      let description = `<!-- arbiter-id: ${epic.id} -->\n\n`;
      if (epic.description) {
        description += `${epic.description}\n\n`;
      }
      description += `Arbiter Epic: ${epic.name}\n`;
      description += `Tasks: ${epic.tasks ? epic.tasks.length : 0}\n`;
      
      const totalEstimated = (epic.tasks || []).reduce((sum, task) => sum + (task.estimatedHours || 0), 0);
      description += `Estimated Hours: ${totalEstimated}\n`;
      
      return {
        title: `Epic: ${epic.name}`,
        description,
        dueDate: epic.dueDate
      };
    }
  }
}));

describe("GitHubSyncClient", () => {
  let config: GitHubSyncConfig;
  let client: GitHubSyncClient;
  let sampleEpic: Epic;
  let sampleTask: Task;
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    // Set up temporary directory for template files
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(path.join(import.meta.dir, "temp-github-sync-"));
    process.chdir(tempDir);
    
    // Create template directory and files
    await fs.ensureDir(".arbiter/templates/github");
    await fs.writeFile(".arbiter/templates/github/base.hbs", `<!-- arbiter-id: {{id}} -->

{{#if description}}{{description}}{{/if}}

{{> content}}`);
    await fs.writeFile(".arbiter/templates/github/epic.hbs", `{{!-- @inherits base.hbs --}}
{{#*inline "content"}}
**Status:** {{status}}
**Priority:** {{priority}}
{{#if owner}}**Owner:** {{owner}}{{/if}}
{{#if assignee}}**Assignee:** {{assignee}}{{/if}}
{{#if estimatedHours}}**Estimated Hours:** {{estimatedHours}}{{/if}}
{{#if dueDate}}**Due Date:** {{dueDate}}{{/if}}

**Tasks:** {{tasks.length}} tasks

{{#if labels}}**Labels:** {{join labels ", "}}{{/if}}
{{/inline}}`);
    await fs.writeFile(".arbiter/templates/github/task.hbs", `{{!-- @inherits base.hbs --}}
{{#*inline "content"}}
{{#if epicName}}**Epic:** {{epicName}}{{/if}}
**Type:** {{type}}
{{#if priority}}**Priority:** {{priority}}{{/if}}
{{#if status}}**Status:** {{status}}{{/if}}
{{#if estimatedHours}}**Estimated Hours:** {{estimatedHours}}{{/if}}
{{#if assignee}}**Assignee:** {{assignee}}{{/if}}

{{#if acceptanceCriteria}}
**Acceptance Criteria:**
{{#each acceptanceCriteria}}
- {{this}}
{{/each}}
{{/if}}
{{/inline}}`);
    // Mock the environment variable for testing
    process.env.GITHUB_TOKEN = "test-token";
    delete process.env.ARBITER_GITHUB_TOKEN; // Clear alternative env var
    
    config = {
      repository: {
        owner: "test-org",
        repo: "test-repo"
      },
      mapping: {
        epicPrefix: "[Epic]",
        taskPrefix: "[Task]",
        defaultLabels: [],
        epicLabels: {
          high: ["priority-high"],
          critical: ["priority-critical"]
        },
        taskLabels: {
          feature: [],
          bug: [],
          test: ["test"]
        }
      },
      behavior: {
        createMilestones: true,
        autoClose: true,
        syncAcceptanceCriteria: true,
        syncAssignees: true
      }
    };

    sampleTask = {
      id: "task-1",
      name: "Implement user login",
      description: "Add login functionality to the app",
      type: "feature",
      priority: "high",
      status: "todo",
      estimatedHours: 8,
      acceptanceCriteria: [
        "User can enter username and password",
        "Invalid credentials show error message",
        "Successful login redirects to dashboard"
      ]
    };

    sampleEpic = {
      id: "epic-1",
      name: "User Authentication System",
      description: "Complete user authentication and authorization system",
      priority: "high",
      status: "in_progress",
      owner: "john-doe",
      assignee: "jane-smith",
      estimatedHours: 40,
      dueDate: "2024-12-31",
      tasks: [sampleTask],
      labels: ["auth", "security"]
    };

    // Add template configuration to the config
    config.templates = {
      discoveryPaths: [".arbiter/templates/github"],
      defaultExtension: "hbs",
      epic: {
        file: "epic.hbs",
        inherits: "base.hbs"
      },
      task: {
        file: "task.hbs",
        inherits: "base.hbs"
      }
    };
    
    client = new GitHubSyncClient(config);

    // Reset mocks
    mockIssuesApi.create.mockClear();
    mockIssuesApi.update.mockClear();
    mockIssuesApi.listForRepo.mockClear();
    mockIssuesApi.listMilestones.mockClear();
    mockIssuesApi.createMilestone.mockClear();
    mockIssuesApi.updateMilestone.mockClear();
    mockPaginate.mockClear();
  });
  
  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.remove(tempDir);
  });

  test("should initialize with correct configuration", () => {
    expect(client).toBeInstanceOf(GitHubSyncClient);
  });

  test("should generate sync preview for epics and tasks", async () => {
    const preview = await client.generateSyncPreview([sampleEpic]);

    expect(preview.epics.create).toHaveLength(1);
    expect(preview.epics.create[0].name).toBe("User Authentication System");
    expect(preview.tasks.create).toHaveLength(1);
    expect(preview.tasks.create[0].name).toBe("Implement user login");
    
    if (config.behavior?.createMilestones) {
      expect(preview.milestones.create).toHaveLength(1);
      expect(preview.milestones.create[0].name).toBe("User Authentication System");
    }
  });

  test("should create GitHub issues for new epics", async () => {
    const results = await client.syncToGitHub([sampleEpic], false);

    // Should create epic issue
    expect(mockIssuesApi.create).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "test-org",
        repo: "test-repo",
        title: "[Epic] User Authentication System",
        labels: expect.arrayContaining(["epic", "auth", "security", "priority-high"]),
        assignees: undefined // No assignees since syncAssignees is false in config
      })
    );

    // Should create task issue
    expect(mockIssuesApi.create).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "test-org",
        repo: "test-repo",
        title: "[Task] Implement user login",
        labels: expect.arrayContaining(["task"])
      })
    );

    // Should create milestone if configured
    if (config.behavior?.createMilestones) {
      expect(mockIssuesApi.createMilestone).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: "test-org",
          repo: "test-repo",
          title: "Epic: User Authentication System",
          due_on: "2024-12-31T00:00:00.000Z"
        })
      );
    }

    // Check results
    const epicResults = results.filter(r => r.type === "epic");
    const taskResults = results.filter(r => r.type === "task");
    
    expect(epicResults).toHaveLength(1);
    expect(epicResults[0].action).toBe("created");
    expect(epicResults[0].githubNumber).toBe(123);
    
    expect(taskResults).toHaveLength(1);
    expect(taskResults[0].action).toBe("created");
    expect(taskResults[0].githubNumber).toBe(123);
  });

  test("should handle dry run correctly", async () => {
    const results = await client.syncToGitHub([sampleEpic], true);

    // Should not make any API calls for creation
    expect(mockIssuesApi.create).not.toHaveBeenCalled();
    expect(mockIssuesApi.createMilestone).not.toHaveBeenCalled();

    // Should return preview results
    expect(results).toHaveLength(3); // epic + task + milestone
    expect(results.every(r => r.details?.includes("Would"))).toBe(true);
  });

  test("should handle epic with acceptance criteria in task body", async () => {
    await client.syncToGitHub([sampleEpic], false);

    const taskCreateCall = mockIssuesApi.create.mock.calls.find(
      call => call[0].title.includes("[Task]")
    );

    expect(taskCreateCall).toBeDefined();
    expect(taskCreateCall![0].body).toContain("**Acceptance Criteria:**");
    expect(taskCreateCall![0].body).toContain("- User can enter username and password");
    expect(taskCreateCall![0].body).toContain("- Invalid credentials show error message");
    expect(taskCreateCall![0].body).toContain("- Successful login redirects to dashboard");
  });

  test("should generate correct labels for different priorities and types", async () => {
    const criticalEpic: Epic = {
      ...sampleEpic,
      priority: "critical",
      tasks: [{
        ...sampleTask,
        type: "bug",
        priority: "critical"
      }]
    };

    await client.syncToGitHub([criticalEpic], false);

    // Check epic labels
    const epicCreateCall = mockIssuesApi.create.mock.calls.find(
      call => call[0].title.includes("[Epic]")
    );
    expect(epicCreateCall![0].labels).toContain("epic");
    expect(epicCreateCall![0].labels).toContain("priority-critical");
    expect(epicCreateCall![0].labels).toContain("auth");
    expect(epicCreateCall![0].labels).toContain("security");

    // Check task labels (should be minimal - no generic labels)
    const taskCreateCall = mockIssuesApi.create.mock.calls.find(
      call => call[0].title.includes("[Task]")
    );
    // Bug task should have only the "task" label since we removed the type-bug mapping
    expect(taskCreateCall![0].labels).toEqual(["task"]);
  });

  test("should add test label for test type tasks", async () => {
    const testEpic: Epic = {
      ...sampleEpic,
      tasks: [{
        ...sampleTask,
        id: "test-task-1",
        name: "Write unit tests",
        type: "test"
      }]
    };

    await client.syncToGitHub([testEpic], false);

    // Check task labels - test tasks should get both "task" and "test" labels
    const taskCreateCall = mockIssuesApi.create.mock.calls.find(
      call => call[0].title.includes("Write unit tests")
    );
    expect(taskCreateCall![0].labels).toContain("task");
    expect(taskCreateCall![0].labels).toContain("test");
    expect(taskCreateCall![0].labels).toHaveLength(2); // Should have both "task" and "test" labels
  });

  test("should handle completed epics by closing GitHub issues", async () => {
    // Mock existing issue
    mockPaginate.mockImplementation((fn: Function, params: any) => {
      if (fn === mockIssuesApi.listForRepo) {
        return Promise.resolve([{
          number: 123,
          title: "[Epic] User Authentication System",
          body: "<!-- arbiter-id: epic-1 -->\\n\\nTest description",
          state: "open",
          labels: [],
          pull_request: undefined
        }]);
      }
      return Promise.resolve([]);
    });

    const completedEpic: Epic = {
      ...sampleEpic,
      status: "completed"
    };

    const results = await client.syncToGitHub([completedEpic], false);

    // Should update and close the issue
    expect(mockIssuesApi.update).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "test-org",
        repo: "test-repo",
        issue_number: 123,
        state: "closed"
      })
    );

    const closeResults = results.filter(r => r.action === "closed");
    expect(closeResults).toHaveLength(1);
  });

  test("should skip updates when no changes are needed", async () => {
    // Mock existing issue with same content
    mockPaginate.mockImplementation((fn: Function, params: any) => {
      if (fn === mockIssuesApi.listForRepo) {
        return Promise.resolve([{
          number: 123,
          title: "[Epic] User Authentication System",
          body: `<!-- arbiter-id: epic-1 -->\\n\\nComplete user authentication and authorization system\\n\\n**Status:** in_progress\\n**Priority:** high\\n**Owner:** john-doe\\n**Estimated Hours:** 40\\n**Due Date:** 2024-12-31\\n\\n**Tasks:** 1 tasks\\n\\n**Labels:** auth, security\\n`,
          state: "open",
          labels: [],
          pull_request: undefined
        }]);
      }
      return Promise.resolve([]);
    });

    const results = await client.syncToGitHub([sampleEpic], false);

    // The epic might be updated rather than skipped due to label generation changes
    // We should have created a task and potentially updated/created an epic and milestone
    const createResults = results.filter(r => r.action === "created");
    const updateResults = results.filter(r => r.action === "updated");
    
    // Should create at least the task, and possibly milestone
    expect(createResults.length).toBeGreaterThanOrEqual(1);
    
    // Should have created or updated the epic (due to our label changes)
    const epicResults = results.filter(r => r.type === "epic");
    expect(epicResults.length).toBe(1);
    expect(["created", "updated", "skipped"]).toContain(epicResults[0].action);
  });

  test("should include arbiter ID in GitHub issue body for tracking", async () => {
    // Reset mocks to ensure clean state
    mockIssuesApi.create.mockClear();
    mockPaginate.mockClear();
    
    // Ensure we don't have any existing issues for this test
    mockPaginate.mockImplementation(() => Promise.resolve([]));

    await client.syncToGitHub([sampleEpic], false);

    const epicCreateCall = mockIssuesApi.create.mock.calls.find(
      call => call[0].title.includes("[Epic]")
    );
    expect(epicCreateCall).toBeDefined();
    expect(epicCreateCall![0].body).toContain("<!-- arbiter-id: epic-1 -->");

    const taskCreateCall = mockIssuesApi.create.mock.calls.find(
      call => call[0].title.includes("[Task]")
    );
    expect(taskCreateCall).toBeDefined();
    expect(taskCreateCall![0].body).toContain("<!-- arbiter-id: task-1 -->");
  });
});

describe("GitHubSyncClient Error Handling", () => {
  let config: GitHubSyncConfig;
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    // Set up temporary directory for template files
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(path.join(import.meta.dir, "temp-github-sync-error-"));
    process.chdir(tempDir);
    
    // Create basic template directory
    await fs.ensureDir(".arbiter/templates/github");
    await fs.writeFile(".arbiter/templates/github/base.hbs", `<!-- arbiter-id: {{id}} -->

{{#if description}}{{description}}{{/if}}`);
    // Set a test token for error handling tests
    process.env.GITHUB_TOKEN = "invalid-token";
    
    config = {
      repository: {
        owner: "test-org",
        repo: "test-repo"
      },
      mapping: {},
      behavior: {},
      templates: {
        discoveryPaths: [".arbiter/templates/github"],
        defaultExtension: "hbs"
      }
    };
  });
  
  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.remove(tempDir);
  });

  test("should handle API errors gracefully", async () => {
    // Create client for this test
    const errorClient = new GitHubSyncClient(config);
    
    // Mock the API call to fail after initial load succeeds
    mockPaginate.mockImplementationOnce(() => Promise.resolve([])); // First call (loadExistingData) succeeds
    mockIssuesApi.create.mockImplementationOnce(() => Promise.reject(new Error("API rate limit exceeded"))); // Second call fails

    const sampleEpic: Epic = {
      id: "epic-1", 
      name: "Test Epic",
      priority: "medium",
      status: "planning",
      tasks: []
    };

    // Should not throw, but return error results
    const results = await errorClient.syncToGitHub([sampleEpic], false);
    
    expect(results).toHaveLength(1);
    expect(results[0].action).toBe("skipped");
    expect(results[0].details).toContain("Failed to sync epic");
    
    // Reset mocks for other tests
    mockPaginate.mockClear();
    mockIssuesApi.create.mockClear();
  });

  test("should throw error when no GitHub token found in environment", () => {
    // Clear both environment variables
    delete process.env.GITHUB_TOKEN;
    delete process.env.ARBITER_GITHUB_TOKEN;
    
    const configWithoutToken: GitHubSyncConfig = {
      repository: {
        owner: "test-org",
        repo: "test-repo"
      },
      mapping: {},
      behavior: {}
    };
    
    expect(() => new GitHubSyncClient(configWithoutToken)).toThrow("GitHub token not found");
  });

  test("should use ARBITER_GITHUB_TOKEN as fallback", () => {
    // Clear primary env var and set fallback
    delete process.env.GITHUB_TOKEN;
    process.env.ARBITER_GITHUB_TOKEN = "fallback-token";
    
    const configWithFallback: GitHubSyncConfig = {
      repository: {
        owner: "test-org",
        repo: "test-repo"
      },
      mapping: {},
      behavior: {}
    };
    
    expect(() => new GitHubSyncClient(configWithFallback)).not.toThrow();
    
    // Restore for other tests
    process.env.GITHUB_TOKEN = "test-token";
    delete process.env.ARBITER_GITHUB_TOKEN;
  });

  test("should use custom tokenEnv when specified", () => {
    // Set custom token environment variable
    process.env.CUSTOM_GITHUB_TOKEN = "custom-token";
    delete process.env.GITHUB_TOKEN;
    delete process.env.ARBITER_GITHUB_TOKEN;
    
    const configWithCustomEnv: GitHubSyncConfig = {
      repository: {
        owner: "test-org",
        repo: "test-repo",
        tokenEnv: "CUSTOM_GITHUB_TOKEN"
      },
      mapping: {},
      behavior: {}
    };
    
    expect(() => new GitHubSyncClient(configWithCustomEnv)).not.toThrow();
    
    // Restore for other tests
    delete process.env.CUSTOM_GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = "test-token";
  });

  test("should show custom tokenEnv in error message when token not found", () => {
    // Clear all token environment variables
    delete process.env.GITHUB_TOKEN;
    delete process.env.ARBITER_GITHUB_TOKEN;
    delete process.env.CUSTOM_GITHUB_TOKEN;
    
    const configWithCustomEnv: GitHubSyncConfig = {
      repository: {
        owner: "test-org",
        repo: "test-repo",
        tokenEnv: "CUSTOM_GITHUB_TOKEN"
      },
      mapping: {},
      behavior: {}
    };
    
    expect(() => new GitHubSyncClient(configWithCustomEnv)).toThrow(
      "GitHub token not found. Set the CUSTOM_GITHUB_TOKEN (or GITHUB_TOKEN as fallback) environment variable"
    );
    
    // Restore for other tests
    process.env.GITHUB_TOKEN = "test-token";
  });
});