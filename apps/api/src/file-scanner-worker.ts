/**
 * File Scanner Worker - Worker thread for parallel file scanning and analysis
 */

import { promises as fs } from "fs";
import { join } from "path";
import { Worker, isMainThread, parentPort, workerData } from "worker_threads";

interface WorkerTask {
  id: string;
  type: "scan-directory" | "analyze-file";
  data: any;
}

interface WorkerResult {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
}

interface ScanDirectoryTask {
  dirPath: string;
  relativePath: string;
  maxDepth: number;
  currentDepth: number;
}

interface AnalyzeFileTask {
  filePath: string;
  relativePath: string;
  basePath: string;
}

interface FileInfo {
  path: string;
  relativePath: string;
  isDirectory: boolean;
  size: number;
  extension: string;
  isImportable: boolean;
  projectIndicators: string[];
}

// Worker thread code
if (!isMainThread) {
  parentPort?.on("message", async (task: WorkerTask) => {
    try {
      let result: any;

      switch (task.type) {
        case "scan-directory":
          result = await scanDirectory(task.data as ScanDirectoryTask);
          break;
        case "analyze-file":
          result = await analyzeFile(task.data as AnalyzeFileTask);
          break;
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }

      const response: WorkerResult = {
        id: task.id,
        success: true,
        data: result,
      };

      parentPort?.postMessage(response);
    } catch (error) {
      const response: WorkerResult = {
        id: task.id,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };

      parentPort?.postMessage(response);
    }
  });

  async function scanDirectory(taskData: ScanDirectoryTask): Promise<FileInfo[]> {
    const { dirPath, relativePath, maxDepth, currentDepth } = taskData;
    const files: FileInfo[] = [];

    if (currentDepth >= maxDepth) {
      return files;
    }

    try {
      const entries = await fs.readdir(dirPath);

      // Process entries in parallel batches
      const batchSize = 20;
      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);
        const batchPromises = batch.map(async (entry) => {
          // Skip hidden files and common ignore patterns
          if (
            entry.startsWith(".") ||
            entry === "node_modules" ||
            entry === "dist" ||
            entry === "build" ||
            entry === "target" ||
            entry === "__pycache__" ||
            entry === ".git"
          ) {
            return null;
          }

          const fullPath = join(dirPath, entry);
          const relativeFilePath = relativePath ? join(relativePath, entry) : entry;

          try {
            const stats = await fs.stat(fullPath);

            const fileInfo: FileInfo = {
              path: fullPath,
              relativePath: relativeFilePath,
              isDirectory: stats.isDirectory(),
              size: stats.size,
              extension: entry.includes(".") ? entry.split(".").pop()?.toLowerCase() || "" : "",
              isImportable: false,
              projectIndicators: [],
            };

            if (stats.isDirectory()) {
              // Mark as importable if it's a common project directory
              if (
                ["src", "lib", "config", "configs", "schemas", "spec", "specs"].includes(
                  entry.toLowerCase(),
                )
              ) {
                fileInfo.isImportable = true;
                fileInfo.projectIndicators.push("project-directory");
              }
            } else {
              // Analyze file for importability and project indicators
              analyzeFileInfo(fileInfo, entry);
            }

            return fileInfo;
          } catch (error) {
            // Skip files that can't be accessed
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        files.push(...batchResults.filter((result): result is FileInfo => result !== null));
      }
    } catch (error) {
      // If we can't read the directory, return empty array
      console.warn(`Failed to scan directory ${dirPath}:`, error);
    }

    return files;
  }

  async function analyzeFile(taskData: AnalyzeFileTask): Promise<FileInfo> {
    const { filePath, relativePath, basePath } = taskData;

    const stats = await fs.stat(filePath);
    const fileName = filePath.split("/").pop() || "";

    const fileInfo: FileInfo = {
      path: filePath,
      relativePath,
      isDirectory: false,
      size: stats.size,
      extension: fileName.includes(".") ? fileName.split(".").pop()?.toLowerCase() || "" : "",
      isImportable: false,
      projectIndicators: [],
    };

    analyzeFileInfo(fileInfo, fileName);

    // For small files, try to analyze content for additional context
    if (stats.size < 50000) {
      // 50KB limit for content analysis
      try {
        const content = await fs.readFile(filePath, "utf-8");
        analyzeFileContent(fileInfo, content, fileName);
      } catch (error) {
        // Skip content analysis if file can't be read as text
      }
    }

    return fileInfo;
  }

  function analyzeFileInfo(fileInfo: FileInfo, fileName: string): void {
    const lowerFileName = fileName.toLowerCase();
    const { extension } = fileInfo;

    // Check for project indicator files
    const projectFiles = [
      "package.json",
      "cargo.toml",
      "dockerfile",
      "docker-compose.yml",
      "docker-compose.yaml",
      "requirements.txt",
      "pyproject.toml",
      "setup.py",
      "go.mod",
      "makefile",
      "tsconfig.json",
      "jsconfig.json",
      "webpack.config.js",
      "rollup.config.js",
      "vite.config.js",
      "vite.config.ts",
      ".gitignore",
      "readme.md",
    ];

    if (projectFiles.includes(lowerFileName)) {
      fileInfo.isImportable = true;
      fileInfo.projectIndicators.push("project-config");
    }

    // Check for importable file types
    const importableExtensions = [
      "cue",
      "json",
      "yaml",
      "yml",
      "toml",
      "ts",
      "js",
      "tsx",
      "jsx",
      "py",
      "rs",
      "go",
      "dockerfile",
      "md",
      "txt",
    ];

    if (importableExtensions.includes(extension)) {
      fileInfo.isImportable = true;

      // Categorize by extension
      if (["cue", "json", "yaml", "yml", "toml"].includes(extension)) {
        fileInfo.projectIndicators.push("config-file");
      } else if (["ts", "js", "tsx", "jsx"].includes(extension)) {
        fileInfo.projectIndicators.push("typescript-javascript");
      } else if (extension === "py") {
        fileInfo.projectIndicators.push("python");
      } else if (extension === "rs") {
        fileInfo.projectIndicators.push("rust");
      } else if (extension === "go") {
        fileInfo.projectIndicators.push("golang");
      }
    }

    // Check for Kubernetes files
    if (["yaml", "yml"].includes(extension)) {
      const k8sKeywords = ["deployment", "service", "configmap", "secret", "ingress", "namespace"];
      if (k8sKeywords.some((keyword) => lowerFileName.includes(keyword))) {
        fileInfo.projectIndicators.push("kubernetes");
      }
    }
  }

  function analyzeFileContent(fileInfo: FileInfo, content: string, fileName: string): void {
    const lowerContent = content.toLowerCase();

    // Look for framework indicators in content
    if (lowerContent.includes("apiversion:") && lowerContent.includes("kind:")) {
      fileInfo.projectIndicators.push("kubernetes-manifest");
    }

    if (lowerContent.includes("package:") && fileInfo.extension === "cue") {
      fileInfo.projectIndicators.push("cue-package");
    }

    if (
      lowerContent.includes("import") &&
      ["ts", "js", "tsx", "jsx"].includes(fileInfo.extension)
    ) {
      fileInfo.projectIndicators.push("module-file");
    }

    if (
      lowerContent.includes("def ") ||
      (lowerContent.includes("class ") && fileInfo.extension === "py")
    ) {
      fileInfo.projectIndicators.push("python-module");
    }
  }
}

// Main thread worker pool management
export class FileWorkerPool {
  private workers: Worker[] = [];
  private taskQueue: Array<{
    task: WorkerTask;
    resolve: Function;
    reject: Function;
    priority: number;
  }> = [];
  private activeTasks = new Map<
    string,
    { resolve: Function; reject: Function; startTime: number; workerId: number }
  >();
  private workerLoad: number[] = []; // Track load per worker
  private workerStats: Array<{ tasksCompleted: number; totalTime: number; errors: number }> = [];
  private readonly maxWorkers: number;
  private readonly taskTimeout: number = 30000; // 30 second timeout
  private heartbeatInterval?: NodeJS.Timeout;

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const [taskId, taskInfo] of this.activeTasks.entries()) {
        const elapsed = Date.now() - taskInfo.startTime;
        if (elapsed > this.taskTimeout) {
          console.warn(`Task ${taskId} timed out after ${elapsed}ms`);
          taskInfo.reject(new Error(`Task timeout after ${elapsed}ms`));
          this.activeTasks.delete(taskId);
          this.workerStats[taskInfo.workerId].errors++;
          this.workerLoad[taskInfo.workerId] = Math.max(0, this.workerLoad[taskInfo.workerId] - 1);
          this.processNextTask();
        }
      }
    }, 5000);
  }

  constructor(maxWorkers: number = Math.max(2, Math.min(8, require("os").cpus().length))) {
    this.maxWorkers = maxWorkers;
    this.initializeWorkers();
    this.startHeartbeat();
  }

  private initializeWorkers(): void {
    for (let i = 0; i < this.maxWorkers; i++) {
      this.createWorker(i);
    }
  }

  private createWorker(index: number): void {
    const worker = new Worker(__filename);

    // Initialize worker stats
    this.workerLoad[index] = 0;
    this.workerStats[index] = { tasksCompleted: 0, totalTime: 0, errors: 0 };

    worker.on("message", (result: WorkerResult) => {
      const taskInfo = this.activeTasks.get(result.id);

      if (taskInfo) {
        const { resolve, reject, startTime, workerId } = taskInfo;
        const taskTime = Date.now() - startTime;

        this.activeTasks.delete(result.id);
        this.workerLoad[workerId] = Math.max(0, this.workerLoad[workerId] - 1);

        // Update stats
        this.workerStats[workerId].tasksCompleted++;
        this.workerStats[workerId].totalTime += taskTime;

        if (result.success) {
          resolve(result.data);
        } else {
          this.workerStats[workerId].errors++;
          reject(new Error(result.error));
        }
      }

      // Process next task in queue
      this.processNextTask();
    });

    worker.on("error", (error) => {
      console.error(`Worker ${index} error:`, error);
      this.workerStats[index].errors++;
      this.restartWorker(index);
    });

    worker.on("exit", (code) => {
      if (code !== 0) {
        console.error(`Worker ${index} stopped with exit code ${code}`);
        this.restartWorker(index);
      }
    });

    this.workers[index] = worker;
  }

  private restartWorker(index: number): void {
    if (this.workers[index]) {
      this.workers[index].terminate();
    }

    setTimeout(() => {
      this.createWorker(index);
    }, 1000);
  }

  private processNextTask(): void {
    if (this.taskQueue.length === 0) return;

    // Sort by priority (higher numbers = higher priority)
    this.taskQueue.sort((a, b) => b.priority - a.priority);

    const { task, resolve, reject, priority } = this.taskQueue.shift()!;
    const workerIndex = this.getNextWorkerIndex();
    const worker = this.workers[workerIndex];

    this.activeTasks.set(task.id, {
      resolve,
      reject,
      startTime: Date.now(),
      workerId: workerIndex,
    });
    this.workerLoad[workerIndex]++;

    worker.postMessage(task);
  }

  private getNextWorkerIndex(): number {
    // Find worker with lowest load
    let minLoad = this.workerLoad[0];
    let selectedWorker = 0;

    for (let i = 1; i < this.workerLoad.length; i++) {
      if (this.workerLoad[i] < minLoad) {
        minLoad = this.workerLoad[i];
        selectedWorker = i;
      }
    }

    return selectedWorker;
  }

  private getNextWorker(): Worker {
    return this.workers[this.getNextWorkerIndex()];
  }

  async executeTask(type: string, data: any, priority: number = 1): Promise<any> {
    const taskId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const task: WorkerTask = { id: taskId, type: type as any, data };

    return new Promise((resolve, reject) => {
      // If there are available workers with low load, execute immediately
      const minLoad = Math.min(...this.workerLoad);
      if (minLoad < 3) {
        // Allow up to 3 concurrent tasks per worker
        const workerIndex = this.getNextWorkerIndex();
        this.activeTasks.set(taskId, {
          resolve,
          reject,
          startTime: Date.now(),
          workerId: workerIndex,
        });
        this.workerLoad[workerIndex]++;
        this.workers[workerIndex].postMessage(task);
      } else {
        // Queue the task with priority
        this.taskQueue.push({ task, resolve, reject, priority });
      }
    });
  }

  async scanDirectory(
    dirPath: string,
    relativePath: string = "",
    maxDepth: number = 10,
    currentDepth: number = 0,
  ): Promise<FileInfo[]> {
    return this.executeTask("scan-directory", {
      dirPath,
      relativePath,
      maxDepth,
      currentDepth,
    });
  }

  async analyzeFile(filePath: string, relativePath: string, basePath: string): Promise<FileInfo> {
    return this.executeTask("analyze-file", {
      filePath,
      relativePath,
      basePath,
    });
  }

  async terminate(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }

    await Promise.all(this.workers.map((worker) => worker.terminate()));
    this.workers = [];
    this.activeTasks.clear();
    this.taskQueue = [];
    this.workerLoad = [];
    this.workerStats = [];
  }

  getStats() {
    return {
      workers: this.workers.length,
      activeTasks: this.activeTasks.size,
      queuedTasks: this.taskQueue.length,
      workerLoad: [...this.workerLoad],
      workerStats: this.workerStats.map((stats) => ({
        tasksCompleted: stats.tasksCompleted,
        averageTaskTime: stats.tasksCompleted > 0 ? stats.totalTime / stats.tasksCompleted : 0,
        errors: stats.errors,
        errorRate: stats.tasksCompleted > 0 ? stats.errors / stats.tasksCompleted : 0,
      })),
    };
  }
}

export type { FileInfo, ScanDirectoryTask, AnalyzeFileTask };
