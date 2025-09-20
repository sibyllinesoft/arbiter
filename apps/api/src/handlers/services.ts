/**
 * Handler Services - Provide secure, sandboxed services for custom handlers
 */

import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { logger as defaultLogger } from '../utils.js';
import { HandlerSandbox } from './sandbox.js';
import type {
  FileDiff,
  GitService,
  HttpClient,
  HttpResponse,
  Logger,
  NotificationService,
  RequestOptions,
  SlackMessage,
} from './types.js';

type EmailMode = 'disabled' | 'log' | 'smtp';

export interface HandlerEmailConfig {
  mode?: EmailMode;
  from?: string;
  smtp?: {
    host?: string;
    port?: number;
    secure?: boolean;
    user?: string;
    pass?: string;
  };
}

/**
 * HTTP Client for handlers with built-in security and rate limiting
 */
export class HandlerHttpClient implements HttpClient {
  private requestCounts = new Map<string, { count: number; resetTime: number }>();
  private readonly maxRequestsPerMinute = 60;
  private readonly allowedDomains = new Set([
    'api.github.com',
    'gitlab.com',
    'hooks.slack.com',
    'api.slack.com',
    'discord.com',
    'api.trello.com',
    'api.atlassian.com',
  ]);

  constructor(private logger: Logger) {}

  async get(url: string, options: RequestOptions = {}): Promise<HttpResponse> {
    return this.makeRequest('GET', url, undefined, options);
  }

  async post(url: string, data?: unknown, options: RequestOptions = {}): Promise<HttpResponse> {
    return this.makeRequest('POST', url, data, options);
  }

  async put(url: string, data?: unknown, options: RequestOptions = {}): Promise<HttpResponse> {
    return this.makeRequest('PUT', url, data, options);
  }

  async delete(url: string, options: RequestOptions = {}): Promise<HttpResponse> {
    return this.makeRequest('DELETE', url, undefined, options);
  }

  private async makeRequest(
    method: string,
    url: string,
    data?: unknown,
    options: RequestOptions = {}
  ): Promise<HttpResponse> {
    // Validate URL
    this.validateUrl(url);

    // Rate limiting
    this.checkRateLimit();

    const { timeout = 10000, retries = 0 } = options;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const requestOptions: RequestInit = {
          method,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Arbiter-Webhook-Handler/1.0',
            ...options.headers,
          },
          signal: controller.signal,
        };

        if (data && (method === 'POST' || method === 'PUT')) {
          requestOptions.body = JSON.stringify(data);
        }

        this.logger.debug('Making HTTP request', { method, url, attempt });

        const response = await fetch(url, requestOptions);
        clearTimeout(timeoutId);

        let responseData: unknown;
        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
          responseData = await response.json();
        } else {
          responseData = await response.text();
        }

        const result: HttpResponse = {
          status: response.status,
          statusText: response.statusText,
          data: responseData,
          headers: Object.fromEntries(response.headers.entries()),
        };

        // Log result
        this.logger.info('HTTP request completed', {
          method,
          url: this.sanitizeUrl(url),
          status: response.status,
          attempt,
        });

        return result;
      } catch (error) {
        lastError = error as Error;

        if (attempt === retries) {
          this.logger.error('HTTP request failed', lastError, {
            method,
            url: this.sanitizeUrl(url),
            attempt,
          });
          throw lastError;
        }

        // Exponential backoff for retries
        const delay = Math.min(1000 * 2 ** attempt, 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error('HTTP request failed');
  }

  private validateUrl(url: string): void {
    try {
      const parsedUrl = new URL(url);

      // Only allow HTTPS (except localhost for development)
      if (parsedUrl.protocol !== 'https:' && !parsedUrl.hostname.includes('localhost')) {
        throw new Error('Only HTTPS URLs are allowed');
      }

      // Check allowed domains
      if (
        !this.allowedDomains.has(parsedUrl.hostname) &&
        !parsedUrl.hostname.includes('localhost')
      ) {
        throw new Error(`Domain not allowed: ${parsedUrl.hostname}`);
      }

      // Prevent SSRF attacks
      if (parsedUrl.hostname.includes('metadata') || parsedUrl.hostname.includes('169.254')) {
        throw new Error('Blocked URL pattern detected');
      }
    } catch (error) {
      throw new Error(`Invalid URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private checkRateLimit(): void {
    const now = Date.now();
    const minute = Math.floor(now / 60000);

    const current = this.requestCounts.get(String(minute)) || { count: 0, resetTime: minute };

    if (current.count >= this.maxRequestsPerMinute) {
      throw new Error('Rate limit exceeded: too many HTTP requests');
    }

    current.count++;
    this.requestCounts.set(String(minute), current);

    // Clean up old entries
    for (const [key, value] of this.requestCounts) {
      if (value.resetTime < minute - 5) {
        // Keep last 5 minutes
        this.requestCounts.delete(key);
      }
    }
  }

  private sanitizeUrl(url: string): string {
    try {
      const parsedUrl = new URL(url);
      return `${parsedUrl.protocol}//${parsedUrl.hostname}${parsedUrl.pathname}`;
    } catch {
      return '[invalid-url]';
    }
  }
}

/**
 * Notification service for handlers
 */
export class HandlerNotificationService implements NotificationService {
  private emailMode: EmailMode;
  private emailFrom?: string;
  private transporter?: Transporter;

  constructor(private logger: Logger, private emailConfig: HandlerEmailConfig = {}) {
    this.emailMode = this.resolveEmailMode(emailConfig.mode);
    this.emailFrom = emailConfig.from ?? process.env.HANDLER_EMAIL_FROM;

    if (this.emailMode === 'smtp') {
      this.configureSmtpTransport(emailConfig.smtp);
    }
  }

  async sendSlack(webhookUrl: string, message: SlackMessage): Promise<void> {
    if (!webhookUrl.includes('hooks.slack.com')) {
      throw new Error('Invalid Slack webhook URL');
    }

    const payload = {
      text: message.text,
      blocks: message.blocks,
      channel: message.channel,
      username: message.username || 'Arbiter Webhook',
      icon_emoji: message.iconEmoji || ':robot_face:',
    };

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Slack webhook failed: ${response.status} ${response.statusText}`);
      }

      this.logger.info('Slack notification sent successfully');
    } catch (error) {
      this.logger.error('Failed to send Slack notification', error as Error);
      throw error;
    }
  }

  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    const sanitizedTo = this.sanitizeEmail(to);

    if (this.emailMode === 'disabled') {
      const message =
        'Email notifications are disabled. Set HANDLER_EMAIL_MODE=log or smtp to enable.';
      this.logger.warn(message, { to: sanitizedTo });
      throw new Error(message);
    }

    if (this.emailMode === 'log') {
      this.logger.info('Email notification logged (log mode)', {
        to: sanitizedTo,
        subject,
      });
      return;
    }

    if (!this.transporter || !this.emailFrom) {
      const message = 'Email transporter not configured. Check SMTP credentials and from address.';
      this.logger.error(message, undefined, { to: sanitizedTo });
      throw new Error(message);
    }

    try {
      await this.transporter.sendMail({
        from: this.emailFrom,
        to,
        subject,
        text: body,
        html: this.renderEmailHtml(subject, body),
      });

      this.logger.info('Email notification sent successfully', { to: sanitizedTo, subject });
    } catch (error) {
      this.logger.error('Failed to send email notification', error as Error, {
        to: sanitizedTo,
      });
      throw error;
    }
  }

  async sendWebhook(url: string, payload: unknown): Promise<void> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Arbiter-Webhook-Handler/1.0',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
      }

      this.logger.info('Webhook notification sent successfully', {
        url: this.sanitizeUrl(url),
      });
    } catch (error) {
      this.logger.error('Failed to send webhook notification', error as Error, {
        url: this.sanitizeUrl(url),
      });
      throw error;
    }
  }

  private resolveEmailMode(override?: EmailMode): EmailMode {
    if (override) return override;

    const fromEnv = (process.env.HANDLER_EMAIL_MODE || '').toLowerCase();
    if (fromEnv === 'smtp' || fromEnv === 'log') {
      return fromEnv;
    }
    return 'disabled';
  }

  private configureSmtpTransport(smtpConfig?: HandlerEmailConfig['smtp']): void {
    const host = smtpConfig?.host ?? process.env.HANDLER_EMAIL_SMTP_HOST;
    const port = smtpConfig?.port ?? Number(process.env.HANDLER_EMAIL_SMTP_PORT || 587);
    const secure = smtpConfig?.secure ?? process.env.HANDLER_EMAIL_SMTP_SECURE === 'true';
    const user = smtpConfig?.user ?? process.env.HANDLER_EMAIL_SMTP_USER;
    const pass = smtpConfig?.pass ?? process.env.HANDLER_EMAIL_SMTP_PASS;

    if (!host || !user || !pass) {
      this.logger.error('SMTP email mode enabled but configuration is incomplete', undefined, {
        missing: {
          host: !host,
          user: !user,
          pass: !pass,
        },
      });
      this.emailMode = 'disabled';
      return;
    }

    if (!this.emailFrom) {
      this.logger.warn('SMTP email mode enabled but HANDLER_EMAIL_FROM is not set. Using user.');
      this.emailFrom = user;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: secure ?? port === 465,
      auth: {
        user,
        pass,
      },
    });
  }

  private renderEmailHtml(subject: string, body: string): string {
    const safeSubject = this.escapeHtml(subject);
    const safeBody = this.escapeHtml(body);
    return `<!doctype html><html><head><meta charset="utf-8"><title>${safeSubject}</title></head><body><pre style="font-family: monospace; white-space: pre-wrap;">${safeBody}</pre></body></html>`;
  }

  private sanitizeEmail(email: string): string {
    const parts = email.split('@');
    if (parts.length !== 2) return '[invalid-email]';
    return `${parts[0].substring(0, 2)}***@${parts[1]}`;
  }

  private sanitizeUrl(url: string): string {
    try {
      const parsedUrl = new URL(url);
      return `${parsedUrl.protocol}//${parsedUrl.hostname}${parsedUrl.pathname}`;
    } catch {
      return '[invalid-url]';
    }
  }

  private escapeHtml(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

/**
 * Git service for handlers (limited read-only operations)
 */
export class HandlerGitService implements GitService {
  private readonly baseDir: string;

  constructor(private logger: Logger) {
    this.baseDir = process.env.HANDLER_GIT_ROOT ?? '/tmp/arbiter-handler-git';
  }

  async cloneRepository(url: string, target: string): Promise<void> {
    const validatedUrl = this.validateRepoUrl(url);
    const targetPath = await this.resolveTargetPath(target);

    await this.runGit(['clone', '--depth', '1', validatedUrl, targetPath], process.cwd());
    this.logger.info('Repository cloned for handler', {
      url: this.sanitizeUrl(validatedUrl),
      target: targetPath,
    });
  }

  async getCommitDiff(sha: string): Promise<FileDiff[]> {
    const repoPath = this.resolveRepoPath();
    const output = await this.runGitOutput(
      ['diff', `${sha}^`, sha, '--name-status', '--stat'],
      repoPath
    );

    return this.parseDiff(output.stdout);
  }

  async getFileContent(path: string, ref = 'HEAD'): Promise<string> {
    const repoPath = this.resolveRepoPath();
    const result = await this.runGitOutput(['show', `${ref}:${path}`], repoPath);
    return result.stdout;
  }

  async createBranch(name: string, from = 'HEAD'): Promise<void> {
    const repoPath = this.resolveRepoPath();
    await this.runGit(['branch', name, from], repoPath);
    this.logger.info('Created branch for handler', { name, from });
  }

  async createPullRequest(): Promise<unknown> {
    throw new Error('Pull request creation requires provider integration');
  }

  private resolveRepoPath(): string {
    return process.env.HANDLER_GIT_REPO_PATH ?? process.cwd();
  }

  private async resolveTargetPath(target: string): Promise<string> {
    const absolute = path.isAbsolute(target) ? target : path.join(this.baseDir, target);
    if (!absolute.startsWith(this.baseDir)) {
      throw new Error('Target path outside allowed git directory');
    }
    await mkdir(path.dirname(absolute), { recursive: true });
    return absolute;
  }

  private validateRepoUrl(url: string): string {
    try {
      const parsed = new URL(url);
      if (!['https:', 'git:'].includes(parsed.protocol)) {
        throw new Error('Only HTTPS/GIT URLs are allowed');
      }
      return parsed.toString();
    } catch (error) {
      throw new Error(`Invalid repository URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async runGit(args: string[], cwd: string): Promise<void> {
    const result = Bun.spawnSync(['git', ...args], { cwd, stderr: 'pipe', stdout: 'pipe' });
    if (result.exitCode !== 0) {
      const error = new TextDecoder().decode(result.stderr);
      throw new Error(error || `git ${args.join(' ')} failed`);
    }
  }

  private async runGitOutput(args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
    const result = Bun.spawnSync(['git', ...args], { cwd, stderr: 'pipe', stdout: 'pipe' });
    const stdout = new TextDecoder().decode(result.stdout).trim();
    const stderr = new TextDecoder().decode(result.stderr).trim();
    if (result.exitCode !== 0) {
      throw new Error(stderr || `git ${args.join(' ')} failed`);
    }
    return { stdout, stderr };
  }

  private parseDiff(output: string): FileDiff[] {
    const diffs: FileDiff[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      if (!line || !/^[AMDCRTU]/.test(line)) continue;
      const [status, filePath] = line.split(/\s+/);
      diffs.push({
        path: filePath,
        status: this.mapStatus(status),
        additions: 0,
        deletions: 0,
      });
    }

    return diffs;
  }

  private mapStatus(status: string): FileDiff['status'] {
    switch (status[0]) {
      case 'A':
        return 'added';
      case 'D':
        return 'deleted';
      case 'R':
        return 'renamed';
      default:
        return 'modified';
    }
  }

  private sanitizeUrl(url: string): string {
    try {
      const parsedUrl = new URL(url);
      return `${parsedUrl.protocol}//${parsedUrl.hostname}${parsedUrl.pathname}`;
    } catch {
      return '[invalid-url]';
    }
  }
}

/**
 * Security validator for handler services
 */
export class HandlerSecurityValidator {
  static validateHandlerCode(code: string, logger: Logger = defaultLogger): {
    safe: boolean;
    violations: string[];
  } {
    const sandbox = new HandlerSandbox(logger);
    return sandbox.validate(code);
  }

  static sanitizeEnvironment(env: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const allowedKeys = ['NODE_ENV', 'LOG_LEVEL'];

    for (const [key, value] of Object.entries(env)) {
      if (allowedKeys.includes(key) || key.startsWith('HANDLER_')) {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  static validateSecrets(secrets: Record<string, string>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const [key, value] of Object.entries(secrets)) {
      if (!key.startsWith('HANDLER_')) {
        errors.push(`Secret key must start with 'HANDLER_': ${key}`);
      }

      if (value.length < 10) {
        errors.push(`Secret value too short: ${key}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
