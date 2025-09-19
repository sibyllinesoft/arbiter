/**
 * Handler Services - Provide secure, sandboxed services for custom handlers
 */

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
  constructor(private logger: Logger) {}

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
    // Email functionality would require additional configuration
    // For now, log the attempt
    this.logger.info('Email notification requested', {
      to: this.sanitizeEmail(to),
      subject,
    });

    throw new Error('Email notifications not configured');
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
}

/**
 * Git service for handlers (limited read-only operations)
 */
export class HandlerGitService implements GitService {
  constructor(private logger: Logger) {}

  async cloneRepository(url: string, path: string): Promise<void> {
    // Repository cloning requires careful security considerations
    // For now, this is not implemented
    this.logger.warn('Repository cloning not implemented for security reasons', {
      url: this.sanitizeUrl(url),
      path,
    });

    throw new Error('Repository cloning not supported in handlers');
  }

  async getCommitDiff(sha: string): Promise<FileDiff[]> {
    // This would integrate with Git APIs to fetch commit diffs
    this.logger.info('Commit diff requested', { sha });

    // Placeholder implementation
    return [];
  }

  async getFileContent(path: string, ref?: string): Promise<string> {
    // This would integrate with Git APIs to fetch file content
    this.logger.info('File content requested', { path, ref });

    throw new Error('File content access not implemented');
  }

  async createBranch(name: string, from?: string): Promise<void> {
    this.logger.info('Branch creation requested', { name, from });

    throw new Error('Branch creation not supported in handlers');
  }

  async createPullRequest(
    title: string,
    body: string,
    base: string,
    head: string
  ): Promise<unknown> {
    this.logger.info('Pull request creation requested', { title, base, head });

    throw new Error('Pull request creation not supported in handlers');
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
  private static readonly DANGEROUS_PATTERNS = [
    /eval\s*\(/,
    /Function\s*\(/,
    /require\s*\(/,
    /import\s*\(/,
    /process\./,
    /__dirname/,
    /__filename/,
    /fs\./,
    /child_process/,
    /spawn/,
    /exec/,
  ];

  static validateHandlerCode(code: string): { safe: boolean; violations: string[] } {
    const violations: string[] = [];

    for (const pattern of HandlerSecurityValidator.DANGEROUS_PATTERNS) {
      if (pattern.test(code)) {
        violations.push(`Dangerous pattern detected: ${pattern.source}`);
      }
    }

    return {
      safe: violations.length === 0,
      violations,
    };
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
