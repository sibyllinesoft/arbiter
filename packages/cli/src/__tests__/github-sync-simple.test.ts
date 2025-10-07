import { describe, expect, test } from 'bun:test';
import type { GitHubSyncConfig } from '../types.js';
import type { Epic, Task } from '../utils/sharded-storage.js';

describe('GitHub Sync Configuration', () => {
  test('should validate configuration schema', () => {
    const validConfig: GitHubSyncConfig = {
      repository: {
        owner: 'test-org',
        repo: 'test-repo',
      },
      mapping: {
        epicPrefix: '[Epic]',
        taskPrefix: '[Task]',
        defaultLabels: ['arbiter-generated'],
      },
      behavior: {
        createMilestones: true,
        autoClose: true,
        syncAcceptanceCriteria: true,
        syncAssignees: false,
      },
    };

    // Configuration should have all required fields
    expect(validConfig.repository.owner).toBe('test-org');
    expect(validConfig.repository.repo).toBe('test-repo');
    expect(validConfig.mapping?.epicPrefix).toBe('[Epic]');
    expect(validConfig.mapping?.taskPrefix).toBe('[Task]');
    expect(validConfig.behavior?.createMilestones).toBe(true);
  });

  test('should allow minimal configuration', () => {
    const minimalConfig: GitHubSyncConfig = {
      repository: {
        owner: 'test-org',
        repo: 'test-repo',
      },
      mapping: {},
      behavior: {},
    };

    expect(minimalConfig.repository.owner).toBe('test-org');
    expect(minimalConfig.repository.repo).toBe('test-repo');
    expect(minimalConfig.repository.baseUrl).toBeUndefined();
  });

  test('should support custom GitHub API URL', () => {
    const enterpriseConfig: GitHubSyncConfig = {
      repository: {
        owner: 'enterprise-org',
        repo: 'enterprise-repo',
        baseUrl: 'https://github.enterprise.com/api/v3',
      },
      mapping: {},
      behavior: {},
    };

    expect(enterpriseConfig.repository.baseUrl).toBe('https://github.enterprise.com/api/v3');
  });
});

describe('GitHub Sync Data Structures', () => {
  test('should handle epic data correctly', () => {
    const epic: Epic = {
      id: 'epic-1',
      name: 'User Authentication System',
      description: 'Complete user authentication and authorization system',
      priority: 'high',
      status: 'in_progress',
      owner: 'john-doe',
      assignee: 'jane-smith',
      estimatedHours: 40,
      dueDate: '2024-12-31',
      tasks: [],
      labels: ['auth', 'security'],
    };

    expect(epic.id).toBe('epic-1');
    expect(epic.name).toBe('User Authentication System');
    expect(epic.priority).toBe('high');
    expect(epic.status).toBe('in_progress');
    expect(epic.tasks).toHaveLength(0);
    expect(epic.labels).toContain('auth');
    expect(epic.labels).toContain('security');
  });

  test('should handle task data correctly', () => {
    const task: Task = {
      id: 'task-1',
      name: 'Implement user login',
      epicId: 'epic-1',
      description: 'Add login functionality to the app',
      type: 'feature',
      priority: 'high',
      status: 'todo',
      estimatedHours: 8,
      acceptanceCriteria: [
        'User can enter username and password',
        'Invalid credentials show error message',
        'Successful login redirects to dashboard',
      ],
    };

    expect(task.id).toBe('task-1');
    expect(task.name).toBe('Implement user login');
    expect(task.type).toBe('feature');
    expect(task.priority).toBe('high');
    expect(task.status).toBe('todo');
    expect(task.acceptanceCriteria).toHaveLength(3);
    expect(task.acceptanceCriteria?.[0]).toBe('User can enter username and password');
  });

  test('should handle epic with tasks', () => {
    const task: Task = {
      id: 'task-1',
      name: 'Create login form',
      epicId: 'epic-1',
      type: 'feature',
      priority: 'high',
      status: 'todo',
    };

    const epic: Epic = {
      id: 'epic-1',
      name: 'User Authentication',
      priority: 'high',
      status: 'in_progress',
      tasks: [task],
    };

    expect(epic.tasks).toHaveLength(1);
    expect(epic.tasks[0].name).toBe('Create login form');
    expect(epic.tasks[0].type).toBe('feature');
  });
});

describe('GitHub Sync Label Generation', () => {
  test('should generate correct epic labels', () => {
    const config: GitHubSyncConfig = {
      repository: { owner: 'test', repo: 'test' },
      mapping: {
        defaultLabels: ['arbiter-generated'],
        epicLabels: {
          high: ['priority-high'],
          critical: ['priority-critical'],
        },
      },
      behavior: {},
    };

    const epic: Epic = {
      id: 'epic-1',
      name: 'Test Epic',
      priority: 'high',
      status: 'in_progress',
      tasks: [],
      labels: ['custom-label'],
    };

    // Simulate label generation logic
    const labels: string[] = [];

    // Add default labels
    if (config.mapping?.defaultLabels) {
      labels.push(...config.mapping.defaultLabels);
    }

    // Add priority-specific labels
    if (config.mapping?.epicLabels?.[epic.priority]) {
      labels.push(...config.mapping.epicLabels[epic.priority]);
    }

    // Add status and type labels
    labels.push(`status:${epic.status}`);
    labels.push(`priority:${epic.priority}`);
    labels.push('epic');

    // Add custom labels
    if (epic.labels) {
      labels.push(...epic.labels);
    }

    const uniqueLabels = [...new Set(labels)];

    expect(uniqueLabels).toContain('arbiter-generated');
    expect(uniqueLabels).toContain('priority-high');
    expect(uniqueLabels).toContain('status:in_progress');
    expect(uniqueLabels).toContain('priority:high');
    expect(uniqueLabels).toContain('epic');
    expect(uniqueLabels).toContain('custom-label');
  });

  test('should generate correct task labels', () => {
    const config: GitHubSyncConfig = {
      repository: { owner: 'test', repo: 'test' },
      mapping: {
        defaultLabels: ['arbiter-generated'],
        taskLabels: {
          feature: ['type-feature'],
          bug: ['type-bug'],
        },
      },
      behavior: {},
    };

    const task: Task = {
      id: 'task-1',
      name: 'Test Task',
      epicId: 'epic-1',
      type: 'feature',
      priority: 'medium',
      status: 'todo',
    };

    // Simulate label generation logic
    const labels: string[] = [];

    // Add default labels
    if (config.mapping?.defaultLabels) {
      labels.push(...config.mapping.defaultLabels);
    }

    // Add type-specific labels
    if (config.mapping?.taskLabels?.[task.type]) {
      labels.push(...config.mapping.taskLabels[task.type]);
    }

    // Add status and type labels
    labels.push(`type:${task.type}`);
    labels.push(`status:${task.status}`);
    labels.push(`priority:${task.priority}`);
    labels.push('task');

    const uniqueLabels = [...new Set(labels)];

    expect(uniqueLabels).toContain('arbiter-generated');
    expect(uniqueLabels).toContain('type-feature');
    expect(uniqueLabels).toContain('type:feature');
    expect(uniqueLabels).toContain('status:todo');
    expect(uniqueLabels).toContain('priority:medium');
    expect(uniqueLabels).toContain('task');
  });
});

describe('GitHub Sync Title Generation', () => {
  test('should generate correct epic titles', () => {
    const config: GitHubSyncConfig = {
      repository: { owner: 'test', repo: 'test' },
      mapping: {
        epicPrefix: '[Epic]',
      },
      behavior: {},
    };

    const epic: Epic = {
      id: 'epic-1',
      name: 'User Authentication System',
      priority: 'high',
      status: 'in_progress',
      tasks: [],
    };

    const title = `${config.mapping?.epicPrefix || '[Epic]'} ${epic.name}`;
    expect(title).toBe('[Epic] User Authentication System');
  });

  test('should generate correct task titles', () => {
    const config: GitHubSyncConfig = {
      repository: { owner: 'test', repo: 'test' },
      mapping: {
        taskPrefix: '[Task]',
      },
      behavior: {},
    };

    const task: Task = {
      id: 'task-1',
      name: 'Implement user login',
      epicId: 'epic-1',
      type: 'feature',
      priority: 'high',
      status: 'todo',
    };

    const title = `${config.mapping?.taskPrefix || '[Task]'} ${task.name}`;
    expect(title).toBe('[Task] Implement user login');
  });

  test('should generate milestone titles', () => {
    const epic: Epic = {
      id: 'epic-1',
      name: 'User Authentication System',
      priority: 'high',
      status: 'in_progress',
      tasks: [],
    };

    const milestoneTitle = `Epic: ${epic.name}`;
    expect(milestoneTitle).toBe('Epic: User Authentication System');
  });
});

describe('GitHub Sync Body Generation', () => {
  test('should include arbiter ID in epic body', () => {
    const epic: Epic = {
      id: 'epic-1',
      name: 'Test Epic',
      description: 'Test description',
      priority: 'high',
      status: 'in_progress',
      tasks: [],
    };

    const body = `<!-- arbiter-id: ${epic.id} -->\\n\\n${epic.description || ''}\\n\\n**Status:** ${epic.status}\\n**Priority:** ${epic.priority}\\n`;

    expect(body).toContain('<!-- arbiter-id: epic-1 -->');
    expect(body).toContain('Test description');
    expect(body).toContain('**Status:** in_progress');
    expect(body).toContain('**Priority:** high');
  });

  test('should include arbiter ID in task body', () => {
    const task: Task = {
      id: 'task-1',
      name: 'Test Task',
      epicId: 'epic-1',
      description: 'Test task description',
      type: 'feature',
      priority: 'high',
      status: 'todo',
      acceptanceCriteria: ['Criteria 1', 'Criteria 2'],
    };

    const epic: Epic = {
      id: 'epic-1',
      name: 'Parent Epic',
      priority: 'high',
      status: 'in_progress',
      tasks: [task],
    };

    let body = `<!-- arbiter-id: ${task.id} -->\\n\\n`;
    if (task.description) {
      body += `${task.description}\\n\\n`;
    }
    body += `**Epic:** ${epic.name}\\n`;
    body += `**Type:** ${task.type}\\n`;

    if (task.acceptanceCriteria && task.acceptanceCriteria.length > 0) {
      body += '\\n**Acceptance Criteria:**\\n';
      for (const criteria of task.acceptanceCriteria) {
        body += `- ${criteria}\\n`;
      }
    }

    expect(body).toContain('<!-- arbiter-id: task-1 -->');
    expect(body).toContain('Test task description');
    expect(body).toContain('**Epic:** Parent Epic');
    expect(body).toContain('**Type:** feature');
    expect(body).toContain('**Acceptance Criteria:**');
    expect(body).toContain('- Criteria 1');
    expect(body).toContain('- Criteria 2');
  });

  test('should handle milestone description generation', () => {
    const epic: Epic = {
      id: 'epic-1',
      name: 'Test Epic',
      description: 'Epic description',
      priority: 'high',
      status: 'in_progress',
      tasks: [
        {
          id: 'task-1',
          name: 'Task 1',
          type: 'feature',
          priority: 'high',
          status: 'todo',
          estimatedHours: 4,
        },
        {
          id: 'task-2',
          name: 'Task 2',
          type: 'bug',
          priority: 'medium',
          status: 'todo',
          estimatedHours: 2,
        },
      ],
    };

    let description = `<!-- arbiter-id: ${epic.id} -->\\n\\n`;
    if (epic.description) {
      description += `${epic.description}\\n\\n`;
    }
    description += `Arbiter Epic: ${epic.name}\\n`;
    description += `Tasks: ${epic.tasks.length}\\n`;

    const totalEstimated = epic.tasks.reduce((sum, task) => sum + (task.estimatedHours || 0), 0);
    description += `Estimated Hours: ${totalEstimated}\\n`;

    expect(description).toContain('<!-- arbiter-id: epic-1 -->');
    expect(description).toContain('Epic description');
    expect(description).toContain('Arbiter Epic: Test Epic');
    expect(description).toContain('Tasks: 2');
    expect(description).toContain('Estimated Hours: 6');
  });
});
