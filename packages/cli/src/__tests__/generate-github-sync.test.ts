import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import fs from "fs-extra";
import path from "node:path";
import { generateCommand } from "../commands/generate.js";
import type { GenerateOptions } from "../commands/generate.js";
import type { CLIConfig } from "../types.js";

// Mock dependencies
mock.module("../api-client.js", () => ({
  ApiClient: class MockApiClient {
    async analyzeAssembly() {
      return { valid: true, output: {}, executionTime: 100 };
    }
  }
}));

// Mock FileBasedTemplateManager first
mock.module("../utils/file-based-template-manager.js", () => ({
  FileBasedTemplateManager: class MockFileBasedTemplateManager {
    constructor(config: any) {
      this.config = config;
    }
    
    async generateEpicTemplate(epic: any, options: any = {}) {
      return {
        title: `[Epic] ${epic.name}`,
        body: `<!-- arbiter-id: ${epic.id} -->\n\n${epic.description || ""}\n\n**Status:** ${epic.status}\n**Priority:** ${epic.priority}\n`,
        labels: ["epic", `priority-${epic.priority}`],
        assignee: epic.assignee,
        milestone: options.milestoneNumber,
        dueDate: epic.dueDate
      };
    }
    
    async generateTaskTemplate(task: any, epic: any, options: any = {}) {
      return {
        title: `[Task] ${task.name}`,
        body: `<!-- arbiter-id: ${task.id} -->\n\n${task.description || ""}\n\n**Epic:** ${epic.name}\n**Type:** ${task.type}\n`,
        labels: ["task"],
        assignee: task.assignee,
        milestone: options.milestoneNumber
      };
    }
    
    async generateMilestoneTemplate(epic: any) {
      return {
        title: `Epic: ${epic.name}`,
        description: `<!-- arbiter-id: ${epic.id} -->\n\n${epic.description || ""}\n\nArbiter Epic: ${epic.name}\n`,
        dueDate: epic.dueDate
      };
    }
  }
}));

mock.module("../utils/github-sync.js", () => ({
  GitHubSyncClient: class MockGitHubSyncClient {
    constructor(config: any) {
      this.config = config;
    }
    
    async generateSyncPreview(epics: any[]) {
      return {
        epics: {
          create: epics,
          update: [],
          close: []
        },
        tasks: {
          create: epics.flatMap(e => e.tasks),
          update: [],
          close: []
        },
        milestones: {
          create: this.config.behavior?.createMilestones ? epics : [],
          update: [],
          close: []
        }
      };
    }
    
    async syncToGitHub(epics: any[], dryRun: boolean) {
      if (dryRun) {
        return epics.flatMap(epic => [
          {
            action: "created",
            type: "epic",
            itemId: epic.id,
            details: `Would create epic: ${epic.name}`
          },
          ...epic.tasks.map((task: any) => ({
            action: "created",
            type: "task",
            itemId: task.id,
            details: `Would create task: ${task.name}`
          }))
        ]);
      }
      
      return epics.flatMap(epic => [
        {
          action: "created",
          type: "epic",
          itemId: epic.id,
          githubNumber: 123,
          details: `Created GitHub issue #123`
        },
        ...epic.tasks.map((task: any, index: number) => ({
          action: "created",
          type: "task",
          itemId: task.id,
          githubNumber: 124 + index,
          details: `Created GitHub issue #${124 + index}`
        }))
      ]);
    }
  }
}));

mock.module("../utils/sharded-storage.js", () => ({
  shardedStorage: {
    listEpics: async () => [
      {
        id: "epic-1",
        name: "User Authentication",
        description: "Implement user login and registration",
        priority: "high",
        status: "in_progress",
        tasks: [
          {
            id: "task-1",
            name: "Create login form",
            type: "feature",
            priority: "high",
            status: "todo"
          },
          {
            id: "task-2",
            name: "Add password validation",
            type: "feature",
            priority: "medium",
            status: "todo"
          }
        ]
      }
    ]
  }
}));

describe("Generate Command with GitHub Sync", () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(path.join(import.meta.dir, "temp-generate-sync-"));
    process.chdir(tempDir);

    // Create basic project structure
    await fs.ensureDir(".arbiter");
    await fs.writeFile(".arbiter/assembly.cue", `
app: {
  name: "test-app"
  version: "1.0.0"
  
  routes: [
    {
      path: "/api/users"
      method: "GET"
      handler: "users.list"
    }
  ]
}
`);

    // Create config with GitHub settings and templates
    await fs.writeJson(".arbiter/config.json", {
      github: {
        repository: {
          owner: "test-org",
          repo: "test-repo",
          token: "test-token"
        },
        mapping: {
          epicPrefix: "[Epic]",
          taskPrefix: "[Task]",
          defaultLabels: ["arbiter-generated"]
        },
        behavior: {
          createMilestones: true,
          autoClose: true,
          syncAcceptanceCriteria: true,
          syncAssignees: false
        },
        templates: {
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
        }
      }
    });
    
    // Create template directory structure
    await fs.ensureDir(".arbiter/templates/github");
    
    // Create basic template files for testing
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
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.remove(tempDir);
  });

  test("should generate files and sync to GitHub", async () => {
    const options: GenerateOptions = {
      syncGithub: true,
      verbose: true,
      force: true // Force generation despite warnings
    };

    const config: CLIConfig = {
      apiUrl: "http://localhost:5050",
      timeout: 5000,
      format: "table",
      color: false,
      projectDir: tempDir,
      github: {
        repository: {
          owner: "test-org",
          repo: "test-repo",
          token: "test-token"
        },
        mapping: {
          epicPrefix: "[Epic]",
          taskPrefix: "[Task]",
          defaultLabels: ["arbiter-generated"]
        },
        behavior: {
          createMilestones: true,
          autoClose: true,
          syncAcceptanceCriteria: true,
          syncAssignees: false
        },
        templates: {
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
        }
      }
    };

    const exitCode = await generateCommand(options, config);
    expect(exitCode).toBe(0);
  });

  test("should show GitHub sync preview with dry run", async () => {
    const options: GenerateOptions = {
      githubDryRun: true,
      verbose: true,
      force: true
    };

    const config: CLIConfig = {
      apiUrl: "http://localhost:5050",
      timeout: 5000,
      format: "table",
      color: false,
      projectDir: tempDir,
      github: {
        repository: {
          owner: "test-org",
          repo: "test-repo",
          token: "test-token"
        },
        mapping: {
          epicPrefix: "[Epic]",
          taskPrefix: "[Task]",
          defaultLabels: ["arbiter-generated"]
        },
        behavior: {
          createMilestones: true,
          autoClose: true,
          syncAcceptanceCriteria: true,
          syncAssignees: false
        },
        templates: {
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
        }
      }
    };

    const exitCode = await generateCommand(options, config);
    expect(exitCode).toBe(0);
  });

  test("should handle missing GitHub config gracefully", async () => {
    const options: GenerateOptions = {
      syncGithub: true,
      force: true
    };

    const config: CLIConfig = {
      apiUrl: "http://localhost:5050",
      timeout: 5000,
      format: "table",
      color: false,
      projectDir: tempDir
      // No GitHub config
    };

    const exitCode = await generateCommand(options, config);
    expect(exitCode).toBe(0); // Should still succeed, just skip GitHub sync
  });

  test("should handle combined dry run and GitHub sync", async () => {
    const options: GenerateOptions = {
      dryRun: true, // General dry run
      syncGithub: true, // But still sync to GitHub
      verbose: true,
      force: true
    };

    const config: CLIConfig = {
      apiUrl: "http://localhost:5050",
      timeout: 5000,
      format: "table",
      color: false,
      projectDir: tempDir,
      github: {
        repository: {
          owner: "test-org",
          repo: "test-repo",
          token: "test-token"
        },
        mapping: {
          epicPrefix: "[Epic]",
          taskPrefix: "[Task]",
          defaultLabels: ["arbiter-generated"]
        },
        behavior: {
          createMilestones: true,
          autoClose: true,
          syncAcceptanceCriteria: true,
          syncAssignees: false
        },
        templates: {
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
        }
      }
    };

    const exitCode = await generateCommand(options, config);
    expect(exitCode).toBe(0);
  });

  test("should handle GitHub sync when no epics exist", async () => {
    // Mock listEpics to return empty array
    mock.module("../utils/sharded-storage.js", () => ({
      shardedStorage: {
        listEpics: async () => []
      }
    }));

    const options: GenerateOptions = {
      syncGithub: true,
      verbose: true,
      force: true
    };

    const config: CLIConfig = {
      apiUrl: "http://localhost:5050",
      timeout: 5000,
      format: "table",
      color: false,
      projectDir: tempDir,
      github: {
        repository: {
          owner: "test-org",
          repo: "test-repo",
          token: "test-token"
        },
        mapping: {
          epicPrefix: "[Epic]",
          taskPrefix: "[Task]",
          defaultLabels: ["arbiter-generated"]
        },
        behavior: {
          createMilestones: true,
          autoClose: true,
          syncAcceptanceCriteria: true,
          syncAssignees: false
        },
        templates: {
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
        }
      }
    };

    const exitCode = await generateCommand(options, config);
    expect(exitCode).toBe(0); // Should succeed but warn about no epics
  });

  test("should work without GitHub sync options", async () => {
    const options: GenerateOptions = {
      verbose: true,
      force: true
      // No GitHub sync options
    };

    const config: CLIConfig = {
      apiUrl: "http://localhost:5050",
      timeout: 5000,
      format: "table",
      color: false,
      projectDir: tempDir,
      github: {
        repository: {
          owner: "test-org",
          repo: "test-repo",
          token: "test-token"
        },
        mapping: {
          epicPrefix: "[Epic]",
          taskPrefix: "[Task]",
          defaultLabels: ["arbiter-generated"]
        },
        behavior: {
          createMilestones: true,
          autoClose: true,
          syncAcceptanceCriteria: true,
          syncAssignees: false
        },
        templates: {
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
        }
      }
    };

    const exitCode = await generateCommand(options, config);
    expect(exitCode).toBe(0); // Should succeed and not sync to GitHub
  });
});