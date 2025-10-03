import { URL } from 'node:url';

import type {
  CloudflareDurableObjectHandlerConfig,
  CloudflareHandlerConfig,
  CloudflareWorkerHandlerConfig,
  EnhancedWebhookPayload,
  HandlerContext,
  HandlerResult,
  Logger,
} from '../types.js';

interface RepositoryContext {
  name: string | null;
  fullName: string | null;
  owner: string | null;
  httpUrl: string | null;
  sshUrl: string | null;
  htmlUrl: string | null;
  branch: string | null;
  defaultBranch: string | null;
  commit: string | null;
  ref: string | null;
}

interface InvokeOptions {
  endpoint: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  timeoutMs?: number;
}

/**
 * Adapter responsible for executing webhook handlers running on Cloudflare.
 * Supports Workers as well as Durable Object containers.
 */
export class CloudflareHandlerAdapter {
  constructor(private logger: Logger) {}

  async execute(
    config: CloudflareHandlerConfig,
    payload: EnhancedWebhookPayload,
    context: HandlerContext
  ): Promise<HandlerResult> {
    if (config.type === 'worker') {
      return this.executeWorker(config, payload, context);
    }
    return this.executeDurableObject(config, payload, context);
  }

  private async executeWorker(
    config: CloudflareWorkerHandlerConfig,
    payload: EnhancedWebhookPayload,
    context: HandlerContext
  ): Promise<HandlerResult> {
    const url = this.interpolateEndpoint(config.endpoint, context, config.route);
    const method = (config.method ?? 'POST').toUpperCase();

    const requestBody = this.createRequestBody(config, payload, context);
    const headers = this.prepareHeaders(config.headers);

    this.logger.info('Dispatching Cloudflare Worker handler', {
      endpoint: url,
      method,
      handlerRuntime: 'cloudflare-worker',
      projectId: context.projectId,
      provider: context.provider,
      event: context.event,
    });

    return this.dispatch({
      endpoint: url,
      method,
      headers,
      body: JSON.stringify(requestBody),
      timeoutMs: config.timeoutMs ?? context.config.timeout,
    });
  }

  private async executeDurableObject(
    config: CloudflareDurableObjectHandlerConfig,
    payload: EnhancedWebhookPayload,
    context: HandlerContext
  ): Promise<HandlerResult> {
    const targetId = config.objectId ?? context.projectId;
    const url = this.interpolateEndpoint(config.endpoint, context, undefined, targetId);
    const method = (config.method ?? 'POST').toUpperCase();

    const requestBody = this.createRequestBody(config, payload, context, targetId);
    const headers = this.prepareHeaders(config.headers);

    this.logger.info('Dispatching Cloudflare Durable Object handler', {
      endpoint: url,
      method,
      handlerRuntime: 'cloudflare-durable-object',
      projectId: context.projectId,
      provider: context.provider,
      event: context.event,
      targetId,
      namespace: config.namespace,
    });

    return this.dispatch({
      endpoint: url,
      method,
      headers,
      body: JSON.stringify(requestBody),
      timeoutMs: config.timeoutMs ?? context.config.timeout,
    });
  }

  private prepareHeaders(custom?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };

    if (custom) {
      for (const [key, value] of Object.entries(custom)) {
        headers[key.toLowerCase()] = value;
      }
    }

    return headers;
  }

  private interpolateEndpoint(
    endpoint: string,
    context: HandlerContext,
    route?: string,
    durableObjectId?: string
  ): string {
    const url = new URL(endpoint);

    if (route) {
      url.pathname = route.startsWith('/') ? route : `/${route}`;
    }

    const replacements: Record<string, string> = {
      ':projectId': context.projectId,
      ':provider': context.provider,
      ':event': context.event,
    };

    if (durableObjectId) {
      replacements[':objectId'] = durableObjectId;
    }

    let pathname = url.pathname;
    for (const [token, value] of Object.entries(replacements)) {
      pathname = pathname.replaceAll(token, encodeURIComponent(value));
    }
    url.pathname = pathname;

    return url.toString();
  }

  private createRequestBody(
    config: CloudflareHandlerConfig,
    payload: EnhancedWebhookPayload,
    context: HandlerContext,
    durableObjectId?: string
  ): Record<string, unknown> {
    const forwardedSecrets = this.collectForwardedSecrets(config, context);
    const repository = this.extractRepositoryContext(payload);
    const environmentHints = this.buildEnvironmentHints(repository);

    return {
      timestamp: new Date().toISOString(),
      payload,
      context: {
        projectId: context.projectId,
        provider: context.provider,
        event: context.event,
        metadata: context.metadata,
        environment: context.config.environment,
      },
      adapter: {
        type: config.type,
        worker: config.type === 'worker' ? this.describeWorkerConfig(config) : undefined,
        durableObject:
          config.type === 'durable-object'
            ? this.describeDurableObjectConfig(config, durableObjectId)
            : undefined,
      },
      repository,
      git: repository,
      environmentHints,
      secrets: forwardedSecrets,
    } satisfies Record<string, unknown>;
  }

  private describeWorkerConfig(config: CloudflareWorkerHandlerConfig): Record<string, unknown> {
    return {
      endpoint: config.endpoint,
      workerName: config.workerName,
      accountId: config.accountId,
      route: config.route,
    };
  }

  private describeDurableObjectConfig(
    config: CloudflareDurableObjectHandlerConfig,
    targetId?: string
  ): Record<string, unknown> {
    return {
      endpoint: config.endpoint,
      objectName: config.objectName,
      objectId: targetId ?? config.objectId,
      namespace: config.namespace,
      container: config.container,
    };
  }

  private extractRepositoryContext(payload: EnhancedWebhookPayload): RepositoryContext {
    const source =
      (payload as Record<string, any>).repository ?? (payload as Record<string, any>).project ?? {};
    const parsed = (payload.parsed?.repository ?? {}) as Record<string, unknown>;
    const raw = source as Record<string, unknown>;

    const fromList = (record: Record<string, unknown>, keys: string[]): string | null => {
      for (const key of keys) {
        const value = record?.[key];
        if (typeof value === 'string' && value.trim().length > 0) {
          return value;
        }
      }
      return null;
    };

    const ownerValue = parsed.owner ?? raw.owner;
    let owner: string | null = null;
    if (typeof ownerValue === 'string') {
      owner = ownerValue;
    } else if (ownerValue && typeof ownerValue === 'object') {
      const ownerRecord = ownerValue as Record<string, unknown>;
      const candidate = ownerRecord['login'] ?? ownerRecord['name'] ?? ownerRecord['username'];
      owner = typeof candidate === 'string' ? candidate : null;
    }

    const refValue = (payload as Record<string, any>).ref;
    const branch = this.extractBranch(payload);
    const defaultBranch =
      fromList(parsed, ['defaultBranch']) ?? fromList(raw, ['default_branch', 'defaultBranch']);

    return {
      name: fromList(parsed, ['name']) ?? fromList(raw, ['name']),
      fullName:
        fromList(parsed, ['fullName']) ??
        fromList(raw, ['full_name', 'path_with_namespace', 'path']) ??
        null,
      owner,
      httpUrl: fromList(raw, ['clone_url', 'http_url', 'git_http_url', 'url']) ?? null,
      sshUrl: fromList(raw, ['ssh_url', 'git_ssh_url', 'ssh_url_to_repo']) ?? null,
      htmlUrl: fromList(raw, ['html_url', 'web_url']) ?? null,
      branch,
      defaultBranch: defaultBranch ?? null,
      commit: this.extractCommitSha(payload),
      ref: typeof refValue === 'string' ? refValue : null,
    };
  }

  private extractBranch(payload: EnhancedWebhookPayload): string | null {
    const parsed = payload.parsed;
    const pullHead = parsed?.pullRequest?.headBranch ?? null;
    const ref = (payload as Record<string, any>).ref ?? null;
    const defaultBranch = parsed?.repository?.defaultBranch ?? null;

    return (
      this.normalizeRef(pullHead) ?? this.normalizeRef(ref) ?? this.normalizeRef(defaultBranch)
    );
  }

  private extractCommitSha(payload: EnhancedWebhookPayload): string | null {
    const raw =
      (payload as Record<string, any>).after ??
      (payload as Record<string, any>).checkout_sha ??
      (payload as Record<string, any>).head_commit?.id ??
      null;

    if (raw) {
      return String(raw);
    }

    const commits = payload.parsed?.commits;
    if (Array.isArray(commits) && commits.length > 0) {
      const lastCommit = commits[commits.length - 1];
      return lastCommit?.sha ?? null;
    }

    return null;
  }

  private buildEnvironmentHints(repository: RepositoryContext): Record<string, string> {
    const env: Record<string, string> = {};

    const setIfString = (key: string, value: unknown) => {
      if (typeof value === 'string' && value.trim().length > 0) {
        env[key] = value;
      }
    };

    setIfString('ARBITER_REPO_HTTP_URL', repository.httpUrl);
    setIfString('ARBITER_REPO_SSH_URL', repository.sshUrl);
    setIfString('ARBITER_REPO_HTML_URL', repository.htmlUrl);
    setIfString('ARBITER_REPO_FULL_NAME', repository.fullName);
    setIfString('ARBITER_REPO_NAME', repository.name);
    setIfString('ARBITER_REPO_BRANCH', repository.branch);
    setIfString('ARBITER_REPO_DEFAULT_BRANCH', repository.defaultBranch);
    setIfString('ARBITER_COMMIT_SHA', repository.commit);

    return env;
  }

  private normalizeRef(ref?: string | null): string | null {
    if (!ref) return null;

    if (ref.startsWith('refs/heads/')) {
      return ref.substring('refs/heads/'.length);
    }

    return ref;
  }

  private collectForwardedSecrets(
    config: CloudflareHandlerConfig,
    context: HandlerContext
  ): Record<string, string> {
    const forwarded: Record<string, string> = {};
    const keys = config.forwardSecrets ?? [];

    for (const key of keys) {
      const secretValue = context.config.secrets[key];
      if (secretValue) {
        forwarded[key] = secretValue;
      } else {
        this.logger.warn('Requested secret not available for Cloudflare handler', {
          key,
          handlerRuntime: config.type,
          projectId: context.projectId,
        });
      }
    }

    return forwarded;
  }

  private async dispatch(options: InvokeOptions): Promise<HandlerResult> {
    const { endpoint, method, headers, body, timeoutMs } = options;
    const controller = new AbortController();
    const timeout = timeoutMs ?? 30000;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(endpoint, {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      const rawText = await response.text();
      const parsed = this.parseResponseBody(rawText);

      if (!response.ok) {
        this.logger.error('Cloudflare handler invocation failed', undefined, {
          endpoint,
          status: response.status,
          statusText: response.statusText,
        });

        return {
          success: false,
          message: `Cloudflare handler responded with ${response.status}`,
          data: {
            endpoint,
            status: response.status,
            statusText: response.statusText,
            response: parsed,
          },
        };
      }

      if (this.isHandlerResult(parsed)) {
        return parsed;
      }

      return {
        success: true,
        message: 'Cloudflare handler executed successfully',
        data: {
          endpoint,
          status: response.status,
          response: parsed,
        },
      };
    } catch (error) {
      this.logger.error('Cloudflare handler invocation threw', error as Error, {
        endpoint,
        method,
      });

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown Cloudflare handler error',
        errors: [
          {
            code: 'CLOUDFLARE_HANDLER_ERROR',
            message: error instanceof Error ? error.message : String(error),
          },
        ],
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private parseResponseBody(rawText: string): unknown {
    if (!rawText) return undefined;

    try {
      return JSON.parse(rawText);
    } catch (error) {
      this.logger.debug('Unable to parse Cloudflare handler response as JSON', {
        error: error instanceof Error ? error.message : String(error),
      });
      return rawText;
    }
  }

  private isHandlerResult(value: unknown): value is HandlerResult {
    return (
      typeof value === 'object' &&
      value !== null &&
      'success' in value &&
      typeof (value as { success?: unknown }).success === 'boolean' &&
      'message' in value &&
      typeof (value as { message?: unknown }).message === 'string'
    );
  }
}
