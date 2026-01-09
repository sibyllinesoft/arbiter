import { describe, expect, test } from "bun:test";
import type { GitHubSyncConfig } from "@/types.js";
import type { Group, Task } from "@/utils/github/sharded-storage.js";

describe("GitHub Sync Configuration", () => {
  test("should validate configuration schema", () => {
    const validConfig: GitHubSyncConfig = {
      repository: {
        owner: "test-org",
        repo: "test-repo",
      },
      prefixes: {
        group: "[Group]",
        task: "[Task]",
      },
      labels: {
        default: ["arbiter-generated"],
      },
      automation: {
        createMilestones: true,
        autoClose: true,
        syncAcceptanceCriteria: true,
        syncAssignees: false,
      },
    };

    // Configuration should have all required fields
    expect(validConfig.repository.owner).toBe("test-org");
    expect(validConfig.repository.repo).toBe("test-repo");
    expect(validConfig.prefixes?.group).toBe("[Group]");
    expect(validConfig.prefixes?.task).toBe("[Task]");
    expect(validConfig.automation?.createMilestones).toBe(true);
  });

  test("should allow minimal configuration", () => {
    const minimalConfig: GitHubSyncConfig = {
      repository: {
        owner: "test-org",
        repo: "test-repo",
      },
      labels: {},
      prefixes: {},
      automation: {},
    };

    expect(minimalConfig.repository.owner).toBe("test-org");
    expect(minimalConfig.repository.repo).toBe("test-repo");
    expect(minimalConfig.repository.baseUrl).toBeUndefined();
  });

  test("should support custom GitHub API URL", () => {
    const enterpriseConfig: GitHubSyncConfig = {
      repository: {
        owner: "enterprise-org",
        repo: "enterprise-repo",
        baseUrl: "https://github.enterprise.com/api/v3",
      },
      labels: {},
      prefixes: {},
      automation: {},
    };

    expect(enterpriseConfig.repository.baseUrl).toBe("https://github.enterprise.com/api/v3");
  });
});

describe("GitHub Sync Data Structures", () => {
  test("should handle group data correctly", () => {
    const group: Group = {
      id: "group-1",
      name: "User Authentication System",
      description: "Complete user authentication and authorization system",
      priority: "high",
      status: "in_progress",
      owner: "john-doe",
      assignee: "jane-smith",
      estimatedHours: 40,
      dueDate: "2024-12-31",
      tasks: [],
      labels: ["auth", "security"],
    };

    expect(group.id).toBe("group-1");
    expect(group.name).toBe("User Authentication System");
    expect(group.priority).toBe("high");
    expect(group.status).toBe("in_progress");
    expect(group.tasks).toHaveLength(0);
    expect(group.labels).toContain("auth");
    expect(group.labels).toContain("security");
  });

  test("should handle task data correctly", () => {
    const task: Task = {
      id: "task-1",
      name: "Implement user login",
      groupId: "group-1",
      description: "Add login functionality to the app",
      type: "feature",
      priority: "high",
      status: "todo",
      estimatedHours: 8,
      acceptanceCriteria: [
        "User can enter username and password",
        "Invalid credentials show error message",
        "Successful login redirects to dashboard",
      ],
    };

    expect(task.id).toBe("task-1");
    expect(task.name).toBe("Implement user login");
    expect(task.type).toBe("feature");
    expect(task.priority).toBe("high");
    expect(task.status).toBe("todo");
    expect(task.acceptanceCriteria).toHaveLength(3);
    expect(task.acceptanceCriteria?.[0]).toBe("User can enter username and password");
  });

  test("should handle group with tasks", () => {
    const task: Task = {
      id: "task-1",
      name: "Create login form",
      groupId: "group-1",
      type: "feature",
      priority: "high",
      status: "todo",
    };

    const group: Group = {
      id: "group-1",
      name: "User Authentication",
      priority: "high",
      status: "in_progress",
      tasks: [task],
    };

    expect(group.tasks).toHaveLength(1);
    expect(group.tasks[0].name).toBe("Create login form");
    expect(group.tasks[0].type).toBe("feature");
  });
});

describe("GitHub Sync Label Generation", () => {
  test("should generate correct group labels", () => {
    const config: GitHubSyncConfig = {
      repository: { owner: "test", repo: "test" },
      labels: {
        default: ["arbiter-generated"],
        groups: {
          high: ["priority-high"],
          critical: ["priority-critical"],
        },
      },
      automation: {},
    };

    const group: Group = {
      id: "group-1",
      name: "Test Group",
      priority: "high",
      status: "in_progress",
      tasks: [],
      labels: ["custom-label"],
    };

    // Simulate label generation logic
    const labels: string[] = [];

    // Add default labels
    if (config.labels?.default) {
      labels.push(...config.labels.default);
    }

    // Add priority-specific labels
    if (config.labels?.groups?.[group.priority]) {
      labels.push(...config.labels.groups[group.priority]);
    }

    // Add status and type labels
    labels.push(`status:${group.status}`);
    labels.push(`priority:${group.priority}`);
    labels.push("group");

    // Add custom labels
    if (group.labels) {
      labels.push(...group.labels);
    }

    const uniqueLabels = [...new Set(labels)];

    expect(uniqueLabels).toContain("arbiter-generated");
    expect(uniqueLabels).toContain("priority-high");
    expect(uniqueLabels).toContain("status:in_progress");
    expect(uniqueLabels).toContain("priority:high");
    expect(uniqueLabels).toContain("group");
    expect(uniqueLabels).toContain("custom-label");
  });

  test("should generate correct task labels", () => {
    const config: GitHubSyncConfig = {
      repository: { owner: "test", repo: "test" },
      labels: {
        default: ["arbiter-generated"],
        tasks: {
          feature: ["type-feature"],
          bug: ["type-bug"],
        },
      },
      automation: {},
    };

    const task: Task = {
      id: "task-1",
      name: "Test Task",
      groupId: "group-1",
      type: "feature",
      priority: "medium",
      status: "todo",
    };

    // Simulate label generation logic
    const labels: string[] = [];

    // Add default labels
    if (config.labels?.default) {
      labels.push(...config.labels.default);
    }

    // Add type-specific labels
    if (config.labels?.tasks?.[task.type]) {
      labels.push(...config.labels.tasks[task.type]);
    }

    // Add status and type labels
    labels.push(`type:${task.type}`);
    labels.push(`status:${task.status}`);
    labels.push(`priority:${task.priority}`);
    labels.push("task");

    const uniqueLabels = [...new Set(labels)];

    expect(uniqueLabels).toContain("arbiter-generated");
    expect(uniqueLabels).toContain("type-feature");
    expect(uniqueLabels).toContain("type:feature");
    expect(uniqueLabels).toContain("status:todo");
    expect(uniqueLabels).toContain("priority:medium");
    expect(uniqueLabels).toContain("task");
  });
});

describe("GitHub Sync Title Generation", () => {
  test("should generate correct group titles", () => {
    const config: GitHubSyncConfig = {
      repository: { owner: "test", repo: "test" },
      prefixes: {
        group: "[Group]",
      },
      automation: {},
    };

    const group: Group = {
      id: "group-1",
      name: "User Authentication System",
      priority: "high",
      status: "in_progress",
      tasks: [],
    };

    const title = `${config.prefixes?.group || "[Group]"} ${group.name}`;
    expect(title).toBe("[Group] User Authentication System");
  });

  test("should generate correct task titles", () => {
    const config: GitHubSyncConfig = {
      repository: { owner: "test", repo: "test" },
      prefixes: {
        task: "[Task]",
      },
      automation: {},
    };

    const task: Task = {
      id: "task-1",
      name: "Implement user login",
      groupId: "group-1",
      type: "feature",
      priority: "high",
      status: "todo",
    };

    const title = `${config.prefixes?.task || "[Task]"} ${task.name}`;
    expect(title).toBe("[Task] Implement user login");
  });

  test("should generate milestone titles", () => {
    const group: Group = {
      id: "group-1",
      name: "User Authentication System",
      priority: "high",
      status: "in_progress",
      tasks: [],
    };

    const milestoneTitle = `Group: ${group.name}`;
    expect(milestoneTitle).toBe("Group: User Authentication System");
  });
});

describe("GitHub Sync Body Generation", () => {
  test("should include arbiter ID in group body", () => {
    const group: Group = {
      id: "group-1",
      name: "Test Group",
      description: "Test description",
      priority: "high",
      status: "in_progress",
      tasks: [],
    };

    const body = `<!-- arbiter-id: ${group.id} -->\\n\\n${group.description || ""}\\n\\n**Status:** ${group.status}\\n**Priority:** ${group.priority}\\n`;

    expect(body).toContain("<!-- arbiter-id: group-1 -->");
    expect(body).toContain("Test description");
    expect(body).toContain("**Status:** in_progress");
    expect(body).toContain("**Priority:** high");
  });

  test("should include arbiter ID in task body", () => {
    const task: Task = {
      id: "task-1",
      name: "Test Task",
      groupId: "group-1",
      description: "Test task description",
      type: "feature",
      priority: "high",
      status: "todo",
      acceptanceCriteria: ["Criteria 1", "Criteria 2"],
    };

    const group: Group = {
      id: "group-1",
      name: "Parent Group",
      priority: "high",
      status: "in_progress",
      tasks: [task],
    };

    let body = `<!-- arbiter-id: ${task.id} -->\\n\\n`;
    if (task.description) {
      body += `${task.description}\\n\\n`;
    }
    body += `**Group:** ${group.name}\\n`;
    body += `**Type:** ${task.type}\\n`;

    if (task.acceptanceCriteria && task.acceptanceCriteria.length > 0) {
      body += "\\n**Acceptance Criteria:**\\n";
      for (const criteria of task.acceptanceCriteria) {
        body += `- ${criteria}\\n`;
      }
    }

    expect(body).toContain("<!-- arbiter-id: task-1 -->");
    expect(body).toContain("Test task description");
    expect(body).toContain("**Group:** Parent Group");
    expect(body).toContain("**Type:** feature");
    expect(body).toContain("**Acceptance Criteria:**");
    expect(body).toContain("- Criteria 1");
    expect(body).toContain("- Criteria 2");
  });

  test("should handle milestone description generation", () => {
    const group: Group = {
      id: "group-1",
      name: "Test Group",
      description: "Group description",
      priority: "high",
      status: "in_progress",
      tasks: [
        {
          id: "task-1",
          name: "Task 1",
          type: "feature",
          priority: "high",
          status: "todo",
          estimatedHours: 4,
        },
        {
          id: "task-2",
          name: "Task 2",
          type: "bug",
          priority: "medium",
          status: "todo",
          estimatedHours: 2,
        },
      ],
    };

    let description = `<!-- arbiter-id: ${group.id} -->\\n\\n`;
    if (group.description) {
      description += `${group.description}\\n\\n`;
    }
    description += `Arbiter Group: ${group.name}\\n`;
    description += `Tasks: ${group.tasks.length}\\n`;

    const totalEstimated = group.tasks.reduce((sum, task) => sum + (task.estimatedHours || 0), 0);
    description += `Estimated Hours: ${totalEstimated}\\n`;

    expect(description).toContain("<!-- arbiter-id: group-1 -->");
    expect(description).toContain("Group description");
    expect(description).toContain("Arbiter Group: Test Group");
    expect(description).toContain("Tasks: 2");
    expect(description).toContain("Estimated Hours: 6");
  });
});
