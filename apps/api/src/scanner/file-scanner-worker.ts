/**
 * File Scanner Worker - Worker thread for parallel file scanning and analysis
 */

import { promises as fs } from "fs";
import { join } from "path";
import { Worker, isMainThread, parentPort, workerData } from "worker_threads";
import {
  type FileInfo,
  analyzeFileContent,
  analyzeFileInfo,
  getExtension,
  isProjectDirectory,
  shouldSkipEntry,
} from "./file-analysis";

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

  async function processEntry(
    entry: string,
    dirPath: string,
    relativePath: string,
  ): Promise<FileInfo | null> {
    if (shouldSkipEntry(entry)) return null;

    const fullPath = join(dirPath, entry);
    const relativeFilePath = relativePath ? join(relativePath, entry) : entry;

    try {
      const stats = await fs.stat(fullPath);

      const fileInfo: FileInfo = {
        path: fullPath,
        relativePath: relativeFilePath,
        isDirectory: stats.isDirectory(),
        size: stats.size,
        extension: getExtension(entry),
        isImportable: false,
        projectIndicators: [],
      };

      if (stats.isDirectory()) {
        if (isProjectDirectory(entry)) {
          fileInfo.isImportable = true;
          fileInfo.projectIndicators.push("project-directory");
        }
      } else {
        analyzeFileInfo(fileInfo, entry);
      }

      return fileInfo;
    } catch {
      return null;
    }
  }

  async function scanDirectory(taskData: ScanDirectoryTask): Promise<FileInfo[]> {
    const { dirPath, relativePath, maxDepth, currentDepth } = taskData;

    if (currentDepth >= maxDepth) return [];

    try {
      const entries = await fs.readdir(dirPath);
      const batchSize = 20;
      const files: FileInfo[] = [];

      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);
        const batchPromises = batch.map((entry) => processEntry(entry, dirPath, relativePath));
        const batchResults = await Promise.all(batchPromises);
        files.push(...batchResults.filter((result): result is FileInfo => result !== null));
      }

      return files;
    } catch (error) {
      console.warn(`Failed to scan directory ${dirPath}:`, error);
      return [];
    }
  }

  const MAX_CONTENT_SIZE = 50000; // 50KB limit for content analysis

  async function analyzeFile(taskData: AnalyzeFileTask): Promise<FileInfo> {
    const { filePath, relativePath } = taskData;
    const stats = await fs.stat(filePath);
    const fileName = filePath.split("/").pop() || "";

    const fileInfo: FileInfo = {
      path: filePath,
      relativePath,
      isDirectory: false,
      size: stats.size,
      extension: getExtension(fileName),
      isImportable: false,
      projectIndicators: [],
    };

    analyzeFileInfo(fileInfo, fileName);

    if (stats.size < MAX_CONTENT_SIZE) {
      try {
        const content = await fs.readFile(filePath, "utf-8");
        analyzeFileContent(fileInfo, content);
      } catch {
        // Skip content analysis if file can't be read as text
      }
    }

    return fileInfo;
  }
}

/** Task info stored while a task is executing */
interface ActiveTaskInfo {
  resolve: Function;
  reject: Function;
  startTime: number;
  workerId: number;
}

/** Queued task waiting for a worker */
interface QueuedTask {
  task: WorkerTask;
  resolve: Function;
  reject: Function;
  priority: number;
}

/** Worker statistics */
interface WorkerStatistics {
  tasksCompleted: number;
  totalTime: number;
  errors: number;
}

/** Generate a unique task ID */
function generateTaskId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/** Find worker index with minimum load */
function findMinLoadWorkerIndex(workerLoad: number[]): number {
  let minLoad = workerLoad[0];
  let selectedWorker = 0;

  for (let i = 1; i < workerLoad.length; i++) {
    if (workerLoad[i] < minLoad) {
      minLoad = workerLoad[i];
      selectedWorker = i;
    }
  }

  return selectedWorker;
}

/** Default number of workers based on CPU count */
function getDefaultWorkerCount(): number {
  return Math.max(2, Math.min(8, require("os").cpus().length));
}

/** Maximum concurrent tasks per worker */
const MAX_TASKS_PER_WORKER = 3;

/** Task timeout in milliseconds */
const TASK_TIMEOUT_MS = 30000;

/** Heartbeat check interval in milliseconds */
const HEARTBEAT_INTERVAL_MS = 5000;

// Main thread worker pool management
export class FileWorkerPool {
  private workers: Worker[] = [];
  private taskQueue: QueuedTask[] = [];
  private activeTasks = new Map<string, ActiveTaskInfo>();
  private workerLoad: number[] = [];
  private workerStats: WorkerStatistics[] = [];
  private readonly maxWorkers: number;
  private heartbeatInterval?: NodeJS.Timeout;

  constructor(maxWorkers: number = getDefaultWorkerCount()) {
    this.maxWorkers = maxWorkers;
    this.initializeWorkers();
    this.startHeartbeat();
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.checkTimeouts();
    }, HEARTBEAT_INTERVAL_MS);
  }

  private checkTimeouts(): void {
    for (const [taskId, taskInfo] of this.activeTasks.entries()) {
      const elapsed = Date.now() - taskInfo.startTime;
      if (elapsed > TASK_TIMEOUT_MS) {
        console.warn(`Task ${taskId} timed out after ${elapsed}ms`);
        this.handleTaskTimeout(taskId, taskInfo);
      }
    }
  }

  private handleTaskTimeout(taskId: string, taskInfo: ActiveTaskInfo): void {
    taskInfo.reject(new Error(`Task timeout after ${Date.now() - taskInfo.startTime}ms`));
    this.activeTasks.delete(taskId);
    this.workerStats[taskInfo.workerId].errors++;
    this.workerLoad[taskInfo.workerId] = Math.max(0, this.workerLoad[taskInfo.workerId] - 1);
    this.processNextTask();
  }

  private initializeWorkers(): void {
    for (let i = 0; i < this.maxWorkers; i++) {
      this.createWorker(i);
    }
  }

  private createWorker(index: number): void {
    const worker = new Worker(__filename);

    this.workerLoad[index] = 0;
    this.workerStats[index] = { tasksCompleted: 0, totalTime: 0, errors: 0 };

    worker.on("message", (result: WorkerResult) => this.handleWorkerMessage(result));
    worker.on("error", (error) => this.handleWorkerError(index, error));
    worker.on("exit", (code) => this.handleWorkerExit(index, code));

    this.workers[index] = worker;
  }

  private handleWorkerMessage(result: WorkerResult): void {
    const taskInfo = this.activeTasks.get(result.id);

    if (taskInfo) {
      this.completeTask(result, taskInfo);
    }

    this.processNextTask();
  }

  private completeTask(result: WorkerResult, taskInfo: ActiveTaskInfo): void {
    const { resolve, reject, startTime, workerId } = taskInfo;
    const taskTime = Date.now() - startTime;

    this.activeTasks.delete(result.id);
    this.workerLoad[workerId] = Math.max(0, this.workerLoad[workerId] - 1);

    this.workerStats[workerId].tasksCompleted++;
    this.workerStats[workerId].totalTime += taskTime;

    if (result.success) {
      resolve(result.data);
    } else {
      this.workerStats[workerId].errors++;
      reject(new Error(result.error));
    }
  }

  private handleWorkerError(index: number, error: Error): void {
    console.error(`Worker ${index} error:`, error);
    this.workerStats[index].errors++;
    this.restartWorker(index);
  }

  private handleWorkerExit(index: number, code: number): void {
    if (code !== 0) {
      console.error(`Worker ${index} stopped with exit code ${code}`);
      this.restartWorker(index);
    }
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

    this.taskQueue.sort((a, b) => b.priority - a.priority);

    const { task, resolve, reject } = this.taskQueue.shift()!;
    this.dispatchTask(task, resolve, reject);
  }

  private dispatchTask(task: WorkerTask, resolve: Function, reject: Function): void {
    const workerIndex = findMinLoadWorkerIndex(this.workerLoad);

    this.activeTasks.set(task.id, {
      resolve,
      reject,
      startTime: Date.now(),
      workerId: workerIndex,
    });
    this.workerLoad[workerIndex]++;

    this.workers[workerIndex].postMessage(task);
  }

  async executeTask(type: string, data: any, priority: number = 1): Promise<any> {
    const taskId = generateTaskId();
    const task: WorkerTask = { id: taskId, type: type as any, data };

    return new Promise((resolve, reject) => {
      const minLoad = Math.min(...this.workerLoad);
      if (minLoad < MAX_TASKS_PER_WORKER) {
        this.dispatchTask(task, resolve, reject);
      } else {
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

export type { FileInfo } from "./file-analysis";
export type { ScanDirectoryTask, AnalyzeFileTask };
