/**
 * Tests for epic and task management functionality
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import { type Epic, ShardedCUEStorage, type Task } from "../utils/sharded-storage.js";

describe("Epic and Task Management", () => {
  let tempDir: string;
  let storage: ShardedCUEStorage;
  const PROJECT_ROOT = path.resolve(__dirname, "../../../..");

  beforeEach(async () => {
    // Create temporary directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "arbiter-epic-test-"));
    process.chdir(tempDir);

    // Initialize sharded storage
    storage = new ShardedCUEStorage({
      baseDir: ".arbiter/epics",
      manifestFile: ".arbiter/shard-manifest.cue",
      maxEpicsPerShard: 3, // Small for testing
    });

    await storage.initialize();
  });

  afterEach(async () => {
    await storage.close();
    process.chdir(PROJECT_ROOT);
    // Clean up temporary directory
    await fs.remove(tempDir);
  });

  describe("Epic Management", () => {
    test("should create and retrieve an epic", async () => {
      const epic: Epic = {
        id: "test-epic",
        name: "Test Epic",
        description: "A test epic for validation",
        priority: "high",
        status: "planning",
        owner: "test-owner",
        assignee: "test-assignee",
        tasks: [],
      };

      // Add epic to storage
      const shardId = await storage.addEpic(epic);
      expect(shardId).toBeTruthy();

      // Retrieve epic
      const retrieved = await storage.getEpic("test-epic");
      expect(retrieved).toBeTruthy();
      expect(retrieved?.name).toBe("Test Epic");
      expect(retrieved?.priority).toBe("high");
      expect(retrieved?.status).toBe("planning");
      expect(retrieved?.arbiter?.shard).toBe(shardId);
    });

    test("should list epics across shards", async () => {
      const epics: Epic[] = [
        {
          id: "epic-1",
          name: "Epic One",
          priority: "high",
          status: "planning",
          tasks: [],
        },
        {
          id: "epic-2",
          name: "Epic Two",
          priority: "medium",
          status: "in_progress",
          tasks: [],
        },
      ];

      // Add epics
      for (const epic of epics) {
        await storage.addEpic(epic);
      }

      // List all epics
      const allEpics = await storage.listEpics();
      expect(allEpics.length).toBe(2);

      // Filter by status
      const planningEpics = await storage.listEpics("planning");
      expect(planningEpics.length).toBe(1);
      expect(planningEpics[0].name).toBe("Epic One");

      const inProgressEpics = await storage.listEpics("in_progress");
      expect(inProgressEpics.length).toBe(1);
      expect(inProgressEpics[0].name).toBe("Epic Two");
    });

    test("should create multiple shards when needed", async () => {
      const epics: Epic[] = [];

      // Create 5 epics (should create 2 shards with maxEpicsPerShard=3)
      for (let i = 0; i < 5; i++) {
        epics.push({
          id: `epic-${i}`,
          name: `Epic ${i}`,
          priority: "medium",
          status: "planning",
          tasks: [],
        });
      }

      // Add all epics
      for (const epic of epics) {
        await storage.addEpic(epic);
      }

      // Verify all epics are retrievable
      const allEpics = await storage.listEpics();
      expect(allEpics.length).toBe(5);

      // Check storage stats
      const stats = await storage.getStats();
      expect(stats.totalEpics).toBe(5);
      expect(stats.totalShards).toBe(2); // Should have created 2 shards
    });
  });

  describe("Task Management", () => {
    test("should manage tasks within epics with dependency-based ordering", async () => {
      const epic: Epic = {
        id: "task-test-epic",
        name: "Task Test Epic",
        priority: "medium",
        status: "planning",
        tasks: [],
      };

      await storage.addEpic(epic);

      // Add tasks with dependencies
      const tasks: Task[] = [
        {
          id: "task-3",
          name: "Third Task",
          epicId: "task-test-epic",
          type: "feature",
          priority: "medium",
          status: "todo",
          dependsOn: ["task-2"], // Depends on second task
        },
        {
          id: "task-1",
          name: "First Task",
          epicId: "task-test-epic",
          type: "feature",
          priority: "high",
          status: "todo",
          // No dependencies - should come first
        },
        {
          id: "task-2",
          name: "Second Task",
          epicId: "task-test-epic",
          type: "test",
          priority: "medium",
          status: "todo",
          dependsOn: ["task-1"], // Depends on first task
        },
      ];

      // Add tasks to epic
      epic.tasks = tasks;
      await storage.updateEpic(epic);

      // Retrieve and verify dependency-based ordering
      const retrieved = await storage.getEpic("task-test-epic");
      expect(retrieved?.tasks?.length).toBe(3);

      // Get tasks in dependency order using topological sort
      const orderedTasks = await storage.getOrderedTasks("task-test-epic");
      expect(orderedTasks.length).toBe(3);
      expect(orderedTasks[0].name).toBe("First Task"); // No dependencies
      expect(orderedTasks[1].name).toBe("Second Task"); // Depends on task-1
      expect(orderedTasks[2].name).toBe("Third Task"); // Depends on task-2

      // Verify dependencies
      expect(orderedTasks[1].dependsOn).toContain("task-1");
      expect(orderedTasks[2].dependsOn).toContain("task-2");
    });

    test("should get dependency-ordered tasks across all epics", async () => {
      // Create two epics with tasks
      const epic1: Epic = {
        id: "epic-alpha",
        name: "Epic Alpha",
        priority: "high",
        status: "planning",
        tasks: [
          {
            id: "alpha-task-1",
            name: "Alpha Task 1",
            epicId: "epic-alpha",
            type: "feature",
            priority: "high",
            status: "todo",
            // No dependencies - will be first
          },
          {
            id: "alpha-task-2",
            name: "Alpha Task 2",
            epicId: "epic-alpha",
            type: "test",
            priority: "medium",
            status: "todo",
            dependsOn: ["alpha-task-1"], // Depends on first task
          },
        ],
      };

      const epic2: Epic = {
        id: "epic-beta",
        name: "Epic Beta",
        priority: "medium",
        status: "planning",
        tasks: [
          {
            id: "beta-task-1",
            name: "Beta Task 1",
            epicId: "epic-beta",
            type: "docs",
            priority: "low",
            status: "todo",
            // No dependencies - could be first or run in parallel
          },
        ],
      };

      await storage.addEpic(epic1);
      await storage.addEpic(epic2);

      // Get all ordered tasks
      const allTasks = await storage.getOrderedTasks();
      expect(allTasks.length).toBe(3);

      // Tasks with no dependencies should come before dependent tasks
      const taskNames = allTasks.map((t) => t.name);
      const alphaTask1Index = taskNames.indexOf("Alpha Task 1");
      const alphaTask2Index = taskNames.indexOf("Alpha Task 2");

      // Alpha Task 1 should come before Alpha Task 2 due to dependency
      expect(alphaTask1Index).toBeLessThan(alphaTask2Index);

      // Get tasks for specific epic
      const epicTasks = await storage.getOrderedTasks("epic-alpha");
      expect(epicTasks.length).toBe(2);
      expect(epicTasks[0].name).toBe("Alpha Task 1");
      expect(epicTasks[1].name).toBe("Alpha Task 2");

      // Verify dependency
      expect(epicTasks[1].dependsOn).toContain("alpha-task-1");
    });
  });

  describe("Storage Statistics", () => {
    test("should provide accurate storage statistics", async () => {
      // Initially empty
      let stats = await storage.getStats();
      expect(stats.totalShards).toBe(0);
      expect(stats.totalEpics).toBe(0);
      expect(stats.totalTasks).toBe(0);

      // Add some epics with tasks
      const epic1: Epic = {
        id: "stats-epic-1",
        name: "Stats Epic 1",
        priority: "high",
        status: "planning",
        tasks: [
          {
            id: "t1",
            name: "T1",
            epicId: "stats-epic-1",
            type: "feature",
            priority: "medium",
            status: "todo",
          },
          {
            id: "t2",
            name: "T2",
            epicId: "stats-epic-1",
            type: "test",
            priority: "medium",
            status: "todo",
            dependsOn: ["t1"],
          },
        ],
      };

      const epic2: Epic = {
        id: "stats-epic-2",
        name: "Stats Epic 2",
        priority: "medium",
        status: "in_progress",
        tasks: [
          {
            id: "t3",
            name: "T3",
            epicId: "stats-epic-2",
            type: "docs",
            priority: "low",
            status: "todo",
          },
        ],
      };

      await storage.addEpic(epic1);
      await storage.addEpic(epic2);

      // Check updated stats
      stats = await storage.getStats();
      expect(stats.totalShards).toBe(1); // Should fit in one shard
      expect(stats.totalEpics).toBe(2);
      expect(stats.avgEpicsPerShard).toBe(2);
      expect(stats.shardUtilization).toBeCloseTo(66.67, 1); // 2/3 of maxEpicsPerShard
    });
  });

  describe("CUE Validation", () => {
    test("should create valid CUE files", async () => {
      const epic: Epic = {
        id: "cue-validation-epic",
        name: "CUE Validation Epic",
        description: "Epic for testing CUE validation",
        priority: "medium",
        status: "planning",
        tasks: [
          {
            id: "validate-task",
            name: "Validation Task",
            epicId: "cue-validation-epic",
            description: "Test task for CUE validation",
            type: "test",
            priority: "high",
            status: "todo",
            acceptanceCriteria: ["CUE validates correctly", "Schema is correct"],
          },
        ],
      };

      await storage.addEpic(epic);

      // Verify the CUE file was created and is readable
      const manifestPath = ".arbiter/shard-manifest.cue";
      expect(await fs.pathExists(manifestPath)).toBe(true);

      const manifestContent = await fs.readFile(manifestPath, "utf-8");
      expect(manifestContent).toContain("package epics");
      expect(manifestContent).toContain("shardManifests");

      // Verify shard file exists
      const shardFiles = await fs.readdir(".arbiter/epics");
      expect(shardFiles.length).toBe(1);
      expect(shardFiles[0]).toMatch(/epic-shard-\d+\.cue/);

      const shardPath = path.join(".arbiter/epics", shardFiles[0]);
      const shardContent = await fs.readFile(shardPath, "utf-8");
      expect(shardContent).toContain("package epics");
      expect(shardContent).toContain("cue-validation-epic");
      expect(shardContent).toContain("Validation Task");
    });
  });
});
