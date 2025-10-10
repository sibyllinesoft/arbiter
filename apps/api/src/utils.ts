/**
 * Utility functions for Spec Workbench backend
 */
import { createHash } from 'node:crypto';
import { isAbsolute, normalize, resolve, sep } from 'node:path';
import type { ExternalToolResult, ProblemDetails, RateLimitBucket } from './types.ts';

/**
 * Generate a unique ID using crypto.randomUUID()
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Compute SHA256 hash of a string
 */
export function computeSpecHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Execute external command with timeout and proper error handling
 */
export async function executeCommand(
  command: string,
  args: string[],
  options: {
    cwd?: string;
    timeout?: number;
    env?: Record<string, string>;
  } = {}
): Promise<ExternalToolResult> {
  const startTime = Date.now();
  const timeoutMs = options.timeout ?? 10000; // 10s default

  try {
    const proc = Bun.spawn([command, ...args], {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdout: 'pipe',
      stderr: 'pipe',
    });

    // Set up timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        proc.kill();
        reject(new Error(`Command timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    // Wait for process to complete or timeout
    const _result = await Promise.race([proc.exited, timeoutPromise]);

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = proc.exitCode ?? 1;
    const duration = Date.now() - startTime;

    return {
      success: exitCode === 0,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode,
      durationMs: duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      stdout: '',
      stderr: error instanceof Error ? error.message : 'Unknown error',
      exitCode: -1,
      durationMs: duration,
    };
  }
}

/**
 * Format CUE content using cue fmt command
 */
export async function formatCUE(
  content: string,
  cueBinaryPath = 'cue'
): Promise<{ formatted: string; success: boolean; error?: string }> {
  // Write content to temporary file
  const tempFile = `/tmp/temp_${generateId()}.cue`;

  try {
    await Bun.write(tempFile, content);

    const result = await executeCommand(cueBinaryPath, ['fmt', tempFile], {
      timeout: 5000,
    });

    if (result.success) {
      const formatted = await Bun.file(tempFile).text();
      return { formatted, success: true };
    }
    return {
      formatted: content,
      success: false,
      error: result.stderr || 'Failed to format CUE content',
    };
  } catch (error) {
    return {
      formatted: content,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    // Clean up temp file
    try {
      (await Bun.file(tempFile).exists()) && (await Bun.write(tempFile, ''));
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Create RFC 7807 Problem Details error response
 */
export function createProblemDetails(
  status: number,
  title: string,
  detail?: string,
  type?: string,
  instance?: string,
  extensions?: Record<string, unknown>
): ProblemDetails {
  return {
    type: type ?? `https://httpstatuses.com/${status}`,
    title,
    status,
    ...(detail && { detail }),
    ...(instance && { instance }),
    ...extensions,
  };
}

/**
 * Token bucket rate limiter implementation
 */
export class TokenBucket {
  private buckets = new Map<string, RateLimitBucket>();

  constructor(
    private maxTokens = 10,
    private refillRate = 1, // tokens per second
    private windowMs = 10000 // 10 seconds
  ) {}

  /**
   * Check if request is allowed and consume a token
   */
  consume(identifier: string): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(identifier);

    if (!bucket) {
      bucket = {
        tokens: this.maxTokens - 1, // consume one token
        last_refill: now,
        max_tokens: this.maxTokens,
        refill_rate: this.refillRate,
      };
      this.buckets.set(identifier, bucket);
      return true;
    }

    // Calculate tokens to add based on time passed
    const timePassed = now - bucket.last_refill;
    const tokensToAdd = Math.floor((timePassed / 1000) * this.refillRate);

    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(bucket.max_tokens, bucket.tokens + tokensToAdd);
      bucket.last_refill = now;
    }

    // Check if we have tokens available
    if (bucket.tokens > 0) {
      bucket.tokens--;
      return true;
    }

    return false;
  }

  /**
   * Get current token count for identifier
   */
  getTokenCount(identifier: string): number {
    const bucket = this.buckets.get(identifier);
    if (!bucket) return this.maxTokens;

    // Calculate current tokens
    const now = Date.now();
    const timePassed = now - bucket.last_refill;
    const tokensToAdd = Math.floor((timePassed / 1000) * this.refillRate);

    return Math.min(bucket.max_tokens, bucket.tokens + tokensToAdd);
  }

  /**
   * Clean up old buckets to prevent memory leaks
   */
  cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.windowMs * 2; // Keep buckets for 2x window size

    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.last_refill < cutoff) {
        this.buckets.delete(key);
      }
    }
  }
}

/**
 * Ensure directory exists, create if it doesn't
 */
export async function ensureDir(path: string): Promise<void> {
  try {
    const stat = await Bun.file(path).exists();
    if (!stat) {
      await Bun.spawn(['mkdir', '-p', path]).exited;
    }
  } catch (error) {
    throw new Error(`Failed to create directory ${path}: ${error}`);
  }
}

/**
 * Safe JSON parsing with error handling
 */
export function safeJsonParse<T = any>(
  json: string
): { success: true; data: T } | { success: false; error: string } {
  try {
    const data = JSON.parse(json);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Invalid JSON',
    };
  }
}

/**
 * Validate that a string is a valid file path (security check)
 */
export function validatePath(targetPath: string, baseDir: string = process.cwd()): boolean {
  if (!targetPath) {
    return false;
  }

  if (targetPath.includes('\0')) {
    return false;
  }

  const sanitised = targetPath.replace(/\\+/g, '/');
  const normalisedInput = normalize(sanitised).replace(/\\+/g, '/');

  // Reject absolute paths or attempts to traverse up the directory tree
  if (
    isAbsolute(normalisedInput) ||
    normalisedInput.startsWith('..') ||
    normalisedInput.includes('/../')
  ) {
    return false;
  }

  // Only allow a conservative character set
  const pathRegex = /^[a-zA-Z0-9._/\-]+$/;
  if (!pathRegex.test(normalisedInput)) {
    return false;
  }

  const resolvedBase = resolve(baseDir);
  const resolvedTarget = resolve(resolvedBase, normalisedInput);
  const baseWithSep = resolvedBase.endsWith(sep) ? resolvedBase : `${resolvedBase}${sep}`;

  return resolvedTarget === resolvedBase || resolvedTarget.startsWith(baseWithSep);
}

/**
 * Get current timestamp in ISO format
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Simple logger with structured output
 */
export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => {
    console.log(
      JSON.stringify({
        level: 'info',
        message,
        timestamp: getCurrentTimestamp(),
        ...meta,
      })
    );
  },

  warn: (message: string, meta?: Record<string, unknown>) => {
    console.warn(
      JSON.stringify({
        level: 'warn',
        message,
        timestamp: getCurrentTimestamp(),
        ...meta,
      })
    );
  },

  error: (message: string, error?: Error, meta?: Record<string, unknown>) => {
    console.error(
      JSON.stringify({
        level: 'error',
        message,
        error: error?.message,
        stack: error?.stack,
        timestamp: getCurrentTimestamp(),
        ...meta,
      })
    );
  },

  debug: (message: string, meta?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(
        JSON.stringify({
          level: 'debug',
          message,
          timestamp: getCurrentTimestamp(),
          ...meta,
        })
      );
    }
  },
};

/**
 * Parse bearer token from Authorization header
 */
export function parseBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7).trim();
}

const COMPLETED_STATUS_TOKENS = new Set([
  'done',
  'complete',
  'completed',
  'closed',
  'resolved',
  'shipped',
]);

const AFFIRMATIVE_TOKENS = new Set(['true', 'yes', 'y', '1', 'complete', 'completed', 'done']);
const NEGATIVE_TOKENS = new Set(['false', 'no', 'n', '0']);

const slugifyValue = (value: string | undefined | null, fallback: string): string => {
  const base = value ?? '';
  const source = base.trim().length > 0 ? base : fallback;
  const sanitized = source
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');

  if (sanitized.length > 0) {
    return sanitized;
  }

  const fallbackSanitized = fallback
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');

  return fallbackSanitized.length > 0 ? fallbackSanitized : 'item';
};

const normalizeCandidate = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = slugifyValue(trimmed, trimmed);
  return normalized || null;
};

const toOptionalString = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
};

const toOptionalNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number.parseFloat(trimmed);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
};

const toOptionalBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (AFFIRMATIVE_TOKENS.has(normalized)) {
      return true;
    }
    if (NEGATIVE_TOKENS.has(normalized)) {
      return false;
    }
  }
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return undefined;
};

export const coerceStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map(item => (typeof item === 'string' ? item.trim() : ''))
      .filter((item): item is string => item.length > 0);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map(item => item.trim())
      .filter((item): item is string => item.length > 0);
  }

  return [];
};

const collectAliasKeys = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map(entry => (typeof entry === 'string' ? entry.trim() : ''))
      .filter((entry): entry is string => entry.length > 0);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map(entry => entry.trim())
      .filter((entry): entry is string => entry.length > 0);
  }
  return [];
};

const sortTasks = (a: any, b: any): number => {
  const nameA = toOptionalString(a.name) ?? '';
  const nameB = toOptionalString(b.name) ?? '';
  return nameA.localeCompare(nameB);
};

const registerKeys = (
  map: Map<string, any>,
  keys: Array<string | undefined | null>,
  target: any
) => {
  keys.forEach(key => {
    const normalized = normalizeCandidate(key ?? undefined);
    if (normalized && !map.has(normalized)) {
      map.set(normalized, target);
    }
  });
};

export function buildEpicTaskSpec(artifacts: any[]): { epics: any[]; tasks: any[] } {
  const epicArtifacts = artifacts.filter(
    (artifact: any) => artifact && typeof artifact === 'object' && artifact.type === 'epic'
  );
  const taskArtifacts = artifacts.filter(
    (artifact: any) => artifact && typeof artifact === 'object' && artifact.type === 'task'
  );

  const epics: any[] = [];
  const tasks: any[] = [];
  const epicMatchMap = new Map<string, any>();
  const taskMatchMap = new Map<string, any>();

  epicArtifacts.forEach((artifact: any) => {
    const metadata: Record<string, unknown> = {
      ...(artifact.metadata ?? {}),
    };

    const slug = slugifyValue(
      toOptionalString(metadata.slug) ?? artifact.name,
      `epic-${artifact.id}`
    );
    const id = toOptionalString(metadata.id) ?? slug;

    metadata.id = id;
    metadata.slug = slug;
    metadata.artifactId = artifact.id;

    const status = toOptionalString(metadata.status);
    const priority = toOptionalString(metadata.priority);
    const owner = toOptionalString(metadata.owner ?? metadata.assignee);
    const referencedTasks = Array.isArray(metadata.tasks)
      ? metadata.tasks
          .map(task => (typeof task === 'string' ? task.trim() : ''))
          .filter((task): task is string => task.length > 0)
      : coerceStringArray(metadata.tasks);

    const epic = {
      id,
      slug,
      artifactId: artifact.id,
      name: artifact.name,
      ...(artifact.description ? { description: artifact.description } : {}),
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(owner ? { owner } : {}),
      metadata,
      tasks: [] as any[],
    };

    epics.push(epic);

    registerKeys(
      epicMatchMap,
      [id, slug, artifact.name, metadata.slug as string, metadata.id as string],
      epic
    );
    registerKeys(epicMatchMap, collectAliasKeys(metadata.aliases), epic);
    registerKeys(epicMatchMap, referencedTasks, epic);
  });

  taskArtifacts.forEach((artifact: any) => {
    const metadata: Record<string, unknown> = {
      ...(artifact.metadata ?? {}),
    };

    const slug = slugifyValue(
      toOptionalString(metadata.slug) ?? artifact.name,
      `task-${artifact.id}`
    );
    const id = toOptionalString(metadata.id) ?? slug;

    metadata.id = id;
    metadata.slug = slug;
    metadata.artifactId = artifact.id;

    const status = toOptionalString(metadata.status);
    const assignee = toOptionalString(metadata.assignee ?? metadata.owner);
    const priority = toOptionalString(metadata.priority);
    const dependencyCandidates = [
      metadata.dependsOn,
      metadata.depends_on,
      metadata.dependencies,
      metadata.blockedBy,
      metadata.blocked_by,
    ];

    const dependsOn = Array.from(
      new Set(
        dependencyCandidates
          .flatMap(entry => coerceStringArray(entry))
          .filter((dep): dep is string => dep.length > 0)
      )
    );

    const epicCandidates = [
      toOptionalString(metadata.epicId),
      toOptionalString(metadata.epic),
      toOptionalString(metadata.epicSlug),
      toOptionalString(metadata.parentEpic),
    ].filter((candidate): candidate is string => Boolean(candidate));

    const epicName = toOptionalString(metadata.epicName) ?? epicCandidates[0];

    const completedFlag =
      toOptionalBoolean(metadata.completed ?? metadata.done ?? metadata.isCompleted) ??
      (status ? COMPLETED_STATUS_TOKENS.has(status.toLowerCase()) : undefined);

    const task = {
      id,
      slug,
      artifactId: artifact.id,
      name: artifact.name,
      ...(artifact.description ? { description: artifact.description } : {}),
      ...(status ? { status } : {}),
      ...(assignee ? { assignee } : {}),
      ...(priority ? { priority } : {}),
      ...(dependsOn.length ? { dependsOn } : {}),
      ...(epicCandidates[0] ? { epicId: epicCandidates[0] } : {}),
      ...(epicName ? { epicName } : {}),
      ...(completedFlag !== undefined ? { completed: completedFlag } : {}),
      metadata,
    };

    tasks.push(task);

    registerKeys(
      taskMatchMap,
      [
        id,
        slug,
        artifact.name,
        metadata.slug as string,
        metadata.id as string,
        epicName,
        ...epicCandidates,
      ],
      task
    );
    if ('order' in metadata) {
      delete metadata.order;
    }
    registerKeys(taskMatchMap, collectAliasKeys(metadata.aliases), task);
  });

  tasks.forEach(task => {
    const metadata = (task.metadata ?? {}) as Record<string, unknown>;
    const candidates = [
      task.epicId,
      task.epicName,
      toOptionalString(metadata.epicId),
      toOptionalString(metadata.epic),
      toOptionalString(metadata.epicSlug),
      toOptionalString(metadata.parentEpic),
    ].filter((candidate): candidate is string => Boolean(candidate));

    for (const candidate of candidates) {
      const normalized = normalizeCandidate(candidate);
      if (normalized && epicMatchMap.has(normalized)) {
        const epic = epicMatchMap.get(normalized);
        if (!epic.tasks.some((existing: any) => existing.id === task.id)) {
          epic.tasks.push(task);
        }
        if (!task.epicId) {
          task.epicId = epic.id;
        }
        if (!task.epicName) {
          task.epicName = epic.name;
        }
        break;
      }
    }
  });

  const taskMatchKeys = new Map<string, any>();
  tasks.forEach(task => {
    const keys = [task.id, task.slug, task.name, task.epicId, task.epicName];
    keys.forEach(key => {
      const normalized = normalizeCandidate(key);
      if (normalized && !taskMatchKeys.has(normalized)) {
        taskMatchKeys.set(normalized, task);
      }
    });
    const metadata = (task.metadata ?? {}) as Record<string, unknown>;
    registerKeys(taskMatchKeys, collectAliasKeys(metadata.aliases), task);
  });

  epics.forEach(epic => {
    const metadata = (epic.metadata ?? {}) as Record<string, unknown>;
    const referenced = Array.isArray(metadata.tasks)
      ? metadata.tasks
          .map(task => (typeof task === 'string' ? task.trim() : ''))
          .filter((task): task is string => task.length > 0)
      : coerceStringArray(metadata.tasks);

    referenced.forEach(ref => {
      const normalized = normalizeCandidate(ref);
      if (!normalized) return;
      const task = taskMatchKeys.get(normalized) ?? taskMatchMap.get(normalized);
      if (task && !epic.tasks.some((existing: any) => existing.id === task.id)) {
        epic.tasks.push(task);
        if (!task.epicId) {
          task.epicId = epic.id;
        }
        if (!task.epicName) {
          task.epicName = epic.name;
        }
      }
    });

    epic.tasks.sort(sortTasks);
  });

  epics.sort((a, b) => {
    const nameA = toOptionalString(a.name) ?? '';
    const nameB = toOptionalString(b.name) ?? '';
    return nameA.localeCompare(nameB);
  });

  tasks.sort(sortTasks);

  return { epics, tasks };
}
