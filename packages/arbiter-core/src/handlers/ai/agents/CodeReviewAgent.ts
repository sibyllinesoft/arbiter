import { Octokit } from '@octokit/rest';
import type { HandlerResponse, WebhookEvent } from '../../shared/utils.js';
import { createResponse } from '../../shared/utils.js';
import { GitHubPRAdapter } from '../adapters/github/GitHubPRAdapter.js';
import { GitHubPushAdapter } from '../adapters/github/GitHubPushAdapter.js';
import { GitLabMRAdapter } from '../adapters/gitlab/GitLabMRAdapter.js';
import { AIAgentHandler } from '../base/AIAgentHandler.js';
import type { AIAgentConfig, AICommand, GitHubActionIntegrationConfig } from '../base/types.js';
import { ClaudeProvider } from '../providers/ClaudeProvider.js';
import { GeminiProvider } from '../providers/GeminiProvider.js';
import { OpenAIProvider } from '../providers/OpenAIProvider.js';

/**
 * AI-powered Code Review Agent
 *
 * This agent automatically reviews pull requests and pushes, providing:
 * - Code quality analysis
 * - Security vulnerability detection
 * - Performance recommendations
 * - Best practices compliance
 * - Automated feedback via comments
 *
 * Supported commands:
 * - /review-code - Comprehensive code review
 * - /security-scan - Security-focused analysis
 * - /performance-check - Performance analysis
 * - /style-check - Code style and formatting review
 * - /architecture-review - High-level design analysis
 */
export class CodeReviewAgent extends AIAgentHandler {
  private githubClient?: Octokit;

  constructor(config: AIAgentConfig) {
    // Initialize AI provider based on config
    let provider: ClaudeProvider | OpenAIProvider | GeminiProvider;
    switch (config.provider.type) {
      case 'claude':
        provider = new ClaudeProvider(config.provider.config);
        break;
      case 'openai':
        provider = new OpenAIProvider(config.provider.config);
        break;
      case 'gemini':
        provider = new GeminiProvider(config.provider.config);
        break;
      default: {
        const exhaustiveCheck: never = config.provider;
        throw new Error(`Unsupported AI provider: ${JSON.stringify(exhaustiveCheck)}`);
      }
    }

    super(config, provider);

    // Register adapters for different platforms
    this.registerAdapter('github', 'pull_request', new GitHubPRAdapter());
    this.registerAdapter('github', 'push', new GitHubPushAdapter());
    this.registerAdapter('gitlab', 'merge_request', new GitLabMRAdapter());
  }

  /**
   * Initialize AI commands for code review
   */
  protected initializeCommands(): void {
    // Comprehensive code review command
    this.registerCommand('review-code', {
      name: 'review-code',
      description:
        'Perform comprehensive code review including quality, security, and performance analysis',
      usage: '/review-code [focus-area]',
      examples: ['/review-code', '/review-code security', '/review-code performance'],
      requiresArgs: false,
      prompt: `Perform a comprehensive code review of the changes in this pull request or push. Analyze:

1. **Code Quality**: Structure, readability, maintainability, and adherence to best practices
2. **Security**: Potential vulnerabilities, input validation, authentication/authorization issues
3. **Performance**: Efficiency concerns, resource usage, scalability considerations
4. **Architecture**: Design patterns, SOLID principles, code organization
5. **Testing**: Test coverage, test quality, edge cases
6. **Documentation**: Code comments, API documentation, README updates

For each file changed:
- Identify specific issues with line numbers when possible
- Suggest concrete improvements
- Rate the overall quality (excellent/good/needs-improvement/poor)

Provide specific, actionable feedback that will help the developer improve their code.`,
      actions: {
        postComment: true,
        addLabels: true,
      },
    });

    // Security-focused scan
    this.registerCommand('security-scan', {
      name: 'security-scan',
      description: 'Focused security analysis of code changes',
      usage: '/security-scan [severity-level]',
      examples: ['/security-scan', '/security-scan high-only', '/security-scan all'],
      requiresArgs: false,
      prompt: `Perform a thorough security analysis of the code changes. Focus on:

1. **Input Validation**: Check for proper sanitization and validation of user inputs
2. **Authentication & Authorization**: Verify access controls and permission checks
3. **Data Protection**: Look for sensitive data exposure, encryption issues
4. **Injection Attacks**: SQL injection, XSS, command injection vulnerabilities
5. **Dependencies**: Check for known vulnerabilities in third-party packages
6. **Configuration**: Identify security misconfigurations
7. **Error Handling**: Ensure errors don't leak sensitive information
8. **Cryptography**: Verify proper use of cryptographic functions

Categorize findings by severity:
- **Critical**: Immediate security risks requiring urgent attention
- **High**: Significant security concerns that should be addressed soon
- **Medium**: Security improvements that should be considered
- **Low**: Minor security enhancements

For each issue, provide:
- Clear description of the vulnerability
- Potential impact and exploit scenarios
- Specific remediation steps
- Code examples of secure alternatives when applicable`,
      actions: {
        postComment: true,
        addLabels: true,
      },
    });

    // Performance analysis
    this.registerCommand('performance-check', {
      name: 'performance-check',
      description: 'Analyze code changes for performance implications',
      usage: '/performance-check [metric]',
      examples: [
        '/performance-check',
        '/performance-check memory',
        '/performance-check cpu',
        '/performance-check database',
      ],
      requiresArgs: false,
      prompt: `Analyze the code changes for performance implications. Focus on:

1. **Algorithm Efficiency**: Time and space complexity analysis
2. **Database Operations**: Query efficiency, N+1 problems, indexing
3. **Memory Usage**: Memory leaks, unnecessary object creation, garbage collection
4. **I/O Operations**: File system, network calls, caching opportunities
5. **Concurrency**: Thread safety, race conditions, deadlocks
6. **Resource Management**: Connection pooling, resource cleanup
7. **Scalability**: How changes affect performance under load

For each performance concern:
- Identify the specific issue and location
- Estimate the performance impact (low/medium/high)
- Provide optimization recommendations
- Suggest alternative approaches when applicable
- Include benchmarking suggestions where relevant`,
      actions: {
        postComment: true,
        addLabels: true,
      },
    });

    // Code style and formatting
    this.registerCommand('style-check', {
      name: 'style-check',
      description: 'Review code style, formatting, and conventions',
      usage: '/style-check [language]',
      examples: ['/style-check', '/style-check typescript', '/style-check python'],
      requiresArgs: false,
      prompt: `Review the code changes for style, formatting, and convention compliance. Analyze:

1. **Naming Conventions**: Variables, functions, classes, files
2. **Code Organization**: File structure, imports, exports
3. **Formatting**: Indentation, spacing, line breaks
4. **Comments**: Quality, clarity, necessity
5. **Language Idioms**: Proper use of language-specific features
6. **Consistency**: Alignment with existing codebase patterns
7. **Readability**: Code clarity and self-documentation

Provide feedback on:
- Deviations from established conventions
- Opportunities to improve readability
- Inconsistencies within the codebase
- Missing or excessive comments
- Better naming suggestions

Focus on maintainability and team consistency rather than personal preferences.`,
      actions: {
        postComment: true,
        addLabels: true,
      },
    });

    // Architecture and design review
    this.registerCommand('architecture-review', {
      name: 'architecture-review',
      description: 'High-level design and architecture analysis',
      usage: '/architecture-review [aspect]',
      examples: [
        '/architecture-review',
        '/architecture-review patterns',
        '/architecture-review dependencies',
      ],
      requiresArgs: false,
      prompt: `Analyze the architectural and design aspects of the code changes. Focus on:

1. **Design Patterns**: Appropriate use of patterns, anti-patterns
2. **SOLID Principles**: Single responsibility, Open/closed, Liskov substitution, Interface segregation, Dependency inversion
3. **Separation of Concerns**: Layer separation, modularity
4. **Dependency Management**: Coupling, cohesion, dependency injection
5. **Abstraction Levels**: Appropriate abstractions, leaky abstractions
6. **Extensibility**: How easy it is to extend or modify the code
7. **Integration**: How well changes fit with existing architecture

For architectural concerns:
- Identify design issues and their implications
- Suggest better architectural approaches
- Highlight potential future maintenance problems
- Recommend refactoring opportunities
- Comment on overall system design coherence`,
      actions: {
        postComment: true,
        addLabels: true,
      },
    });
  }

  /**
   * Process standard events (automatic code review)
   */
  protected async processEvent(
    eventData: any,
    originalEvent: WebhookEvent
  ): Promise<HandlerResponse> {
    // Check if automatic review is enabled
    if (!this.config.behavior?.autoResponse) {
      return createResponse(true, 'Automatic review disabled', {
        skipped: true,
        reason: 'auto_response_disabled',
      });
    }

    // Only auto-review pull requests and pushes to protected branches
    const shouldAutoReview = eventData.pullRequest || eventData.push?.isProtectedBranch;

    if (!shouldAutoReview) {
      return createResponse(true, 'Event does not require automatic review', {
        skipped: true,
        reason: 'not_reviewable',
      });
    }

    try {
      // Perform automatic code review
      const reviewCommand = this.commands.get('review-code')!;
      const aiContext = {
        command: 'review-code',
        args: [],
        eventData,
        originalEvent,
        config: this.config,
      };

      const aiResponse = await this.provider.processCommand(reviewCommand, aiContext);

      if (!aiResponse.success) {
        return createResponse(false, `Automatic review failed: ${aiResponse.error}`);
      }

      // Execute any actions from the AI
      let actionResults = [];
      if (aiResponse.actions && aiResponse.actions.length > 0) {
        actionResults = await this.executeActions(aiResponse.actions, eventData, originalEvent);
      }

      return createResponse(true, 'Automatic code review completed', {
        review: aiResponse.data,
        actions: actionResults,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return createResponse(false, `Automatic review error: ${errorMessage}`);
    }
  }

  /**
   * Execute actions returned by the AI (post comments, add labels, etc.)
   */
  protected async executeAction(
    action: any,
    eventData: any,
    originalEvent: WebhookEvent
  ): Promise<any> {
    switch (action.type) {
      case 'comment':
        return await this.postComment(action.data, eventData, originalEvent);

      case 'label':
        return await this.addLabels(action.data, eventData, originalEvent);

      case 'assign':
        return await this.assignUsers(action.data, eventData, originalEvent);

      default:
        throw new Error(`Unsupported action type: ${action.type}`);
    }
  }

  private getGitHubIntegration(): GitHubActionIntegrationConfig | undefined {
    const integration = this.config.actionIntegrations?.github;
    if (!integration || integration.enabled === false) {
      return undefined;
    }
    return integration;
  }

  private getGitHubClient(integration: GitHubActionIntegrationConfig): Octokit | null {
    if (this.githubClient) {
      return this.githubClient;
    }

    const potentialEnvNames: string[] = [];
    if (integration.tokenEnv) {
      potentialEnvNames.push(integration.tokenEnv);
    }

    if (integration.token && /^[A-Z0-9_]+$/.test(integration.token)) {
      potentialEnvNames.push(integration.token);
    }

    const envToken = potentialEnvNames
      .map(name => process.env[name])
      .find((value): value is string => typeof value === 'string' && value.trim().length > 0);

    const explicitToken =
      integration.token && !/^[A-Z0-9_]+$/.test(integration.token) ? integration.token : undefined;

    const fallbackToken = process.env.GITHUB_TOKEN || process.env.ARBITER_GITHUB_TOKEN;
    const token = envToken || explicitToken || fallbackToken;

    if (!token) {
      return null;
    }

    const baseUrl =
      integration.apiUrl && integration.apiUrl.trim().length > 0 ? integration.apiUrl : undefined;

    this.githubClient = new Octokit({
      auth: token,
      ...(baseUrl ? { baseUrl } : {}),
      userAgent: `arbiter-ai-code-review/${this.config.version}`,
    });

    return this.githubClient;
  }

  private extractRepository(eventData: any): { owner: string; repo: string } | null {
    const repoData = eventData?.repository;
    if (!repoData) {
      return null;
    }

    const fullName: string | undefined = repoData.fullName || repoData.full_name;
    const name: string | undefined = repoData.name;
    const owner: string | undefined = repoData.owner?.login || repoData.owner?.name;

    if (fullName && fullName.includes('/')) {
      const [repoOwner, repoName] = fullName.split('/');
      return { owner: repoOwner, repo: repoName };
    }

    if (owner && name) {
      return { owner, repo: name };
    }

    return null;
  }

  private resolveGitHubAction(
    action: 'comment' | 'label' | 'assign',
    eventData: any
  ): { client: Octokit; owner: string; repo: string; issueNumber: number } | null {
    const integration = this.getGitHubIntegration();
    if (!integration) {
      return null;
    }

    const actionEnabled = integration.actions?.[action];
    if (actionEnabled === false) {
      return null;
    }

    const repo = this.extractRepository(eventData);
    const issueNumber = eventData?.pullRequest?.number ?? eventData?.issue?.number;

    if (!repo || typeof issueNumber !== 'number') {
      return null;
    }

    const client = this.getGitHubClient(integration);
    if (!client) {
      return null;
    }

    return {
      client,
      owner: repo.owner,
      repo: repo.repo,
      issueNumber,
    };
  }

  private isDryRun(): boolean {
    return this.config.behavior?.dryRun === true;
  }

  private formatGitHubError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (error && typeof error === 'object') {
      const maybeStatus = (error as any).status;
      const message = (error as any).message || (error as any).response?.data?.message;
      if (message && maybeStatus) {
        return `${message} (status ${maybeStatus})`;
      }
      if (message) {
        return message;
      }
      if (maybeStatus) {
        return `GitHub API error (status ${maybeStatus})`;
      }
    }

    return typeof error === 'string' ? error : 'Unknown GitHub API error';
  }

  /**
   * Post a comment on the PR/issue
   */
  private async postComment(
    data: { body: string },
    eventData: any,
    originalEvent: WebhookEvent
  ): Promise<any> {
    const actionContext = this.resolveGitHubAction('comment', eventData);
    const preview = data.body?.substring(0, 120) || '';

    if (!actionContext) {
      await this.logActivity({
        type: 'ai.agent.action.comment.skipped',
        timestamp: new Date().toISOString(),
        reason: 'github_integration_disabled',
        agentId: this.config.id,
        preview,
      });

      return {
        action: 'comment',
        status: 'skipped',
        reason: 'github_integration_disabled',
        preview,
      };
    }

    if (this.isDryRun()) {
      await this.logActivity({
        type: 'ai.agent.action.comment.dry_run',
        timestamp: new Date().toISOString(),
        agentId: this.config.id,
        target: `${actionContext.owner}/${actionContext.repo}#${actionContext.issueNumber}`,
        preview,
      });

      return {
        action: 'comment',
        status: 'dry-run',
        preview,
      };
    }

    try {
      const response = await actionContext.client.rest.issues.createComment({
        owner: actionContext.owner,
        repo: actionContext.repo,
        issue_number: actionContext.issueNumber,
        body: data.body,
      });

      await this.logActivity({
        type: 'ai.agent.action.comment',
        timestamp: new Date().toISOString(),
        agentId: this.config.id,
        target: `${actionContext.owner}/${actionContext.repo}#${actionContext.issueNumber}`,
        url: response.data.html_url,
        preview,
      });

      return {
        action: 'comment',
        status: 'success',
        url: response.data.html_url,
        id: response.data.id,
      };
    } catch (error) {
      const message = this.formatGitHubError(error);
      await this.logActivity({
        type: 'ai.agent.action.comment.error',
        timestamp: new Date().toISOString(),
        agentId: this.config.id,
        error: message,
      });

      throw new Error(`Failed to post GitHub comment: ${message}`);
    }
  }

  /**
   * Add labels to the PR/issue
   */
  private async addLabels(
    data: { labels: string[] },
    eventData: any,
    originalEvent: WebhookEvent
  ): Promise<any> {
    if (!data.labels || data.labels.length === 0) {
      return {
        action: 'label',
        status: 'skipped',
        reason: 'no_labels_requested',
      };
    }

    const actionContext = this.resolveGitHubAction('label', eventData);

    if (!actionContext) {
      await this.logActivity({
        type: 'ai.agent.action.label.skipped',
        timestamp: new Date().toISOString(),
        agentId: this.config.id,
        reason: 'github_integration_disabled',
        labels: data.labels,
      });

      return {
        action: 'label',
        status: 'skipped',
        reason: 'github_integration_disabled',
        labels: data.labels,
      };
    }

    if (this.isDryRun()) {
      await this.logActivity({
        type: 'ai.agent.action.label.dry_run',
        timestamp: new Date().toISOString(),
        agentId: this.config.id,
        labels: data.labels,
        target: `${actionContext.owner}/${actionContext.repo}#${actionContext.issueNumber}`,
      });

      return {
        action: 'label',
        status: 'dry-run',
        labels: data.labels,
      };
    }

    try {
      const response = await actionContext.client.rest.issues.addLabels({
        owner: actionContext.owner,
        repo: actionContext.repo,
        issue_number: actionContext.issueNumber,
        labels: data.labels,
      });

      await this.logActivity({
        type: 'ai.agent.action.label',
        timestamp: new Date().toISOString(),
        agentId: this.config.id,
        labels: data.labels,
        target: `${actionContext.owner}/${actionContext.repo}#${actionContext.issueNumber}`,
        appliedLabels: response.data.map(label => label.name),
      });

      return {
        action: 'label',
        status: 'success',
        labels: response.data.map(label => label.name),
      };
    } catch (error) {
      const message = this.formatGitHubError(error);
      await this.logActivity({
        type: 'ai.agent.action.label.error',
        timestamp: new Date().toISOString(),
        agentId: this.config.id,
        error: message,
        labels: data.labels,
      });

      throw new Error(`Failed to add GitHub labels: ${message}`);
    }
  }

  /**
   * Assign users to the PR/issue
   */
  private async assignUsers(
    data: { assignees: string[] },
    eventData: any,
    originalEvent: WebhookEvent
  ): Promise<any> {
    if (!data.assignees || data.assignees.length === 0) {
      return {
        action: 'assign',
        status: 'skipped',
        reason: 'no_assignees_provided',
      };
    }

    const actionContext = this.resolveGitHubAction('assign', eventData);

    if (!actionContext) {
      await this.logActivity({
        type: 'ai.agent.action.assign.skipped',
        timestamp: new Date().toISOString(),
        agentId: this.config.id,
        reason: 'github_integration_disabled',
        assignees: data.assignees,
      });

      return {
        action: 'assign',
        status: 'skipped',
        reason: 'github_integration_disabled',
        assignees: data.assignees,
      };
    }

    if (this.isDryRun()) {
      await this.logActivity({
        type: 'ai.agent.action.assign.dry_run',
        timestamp: new Date().toISOString(),
        agentId: this.config.id,
        assignees: data.assignees,
        target: `${actionContext.owner}/${actionContext.repo}#${actionContext.issueNumber}`,
      });

      return {
        action: 'assign',
        status: 'dry-run',
        assignees: data.assignees,
      };
    }

    try {
      const response = await actionContext.client.rest.issues.addAssignees({
        owner: actionContext.owner,
        repo: actionContext.repo,
        issue_number: actionContext.issueNumber,
        assignees: data.assignees,
      });

      await this.logActivity({
        type: 'ai.agent.action.assign',
        timestamp: new Date().toISOString(),
        agentId: this.config.id,
        assignees: data.assignees,
        target: `${actionContext.owner}/${actionContext.repo}#${actionContext.issueNumber}`,
        addedAssignees: response.data.assignees?.map(assignee => assignee.login),
      });

      return {
        action: 'assign',
        status: 'success',
        assignees: response.data.assignees?.map(assignee => assignee.login) ?? data.assignees,
      };
    } catch (error) {
      const message = this.formatGitHubError(error);
      await this.logActivity({
        type: 'ai.agent.action.assign.error',
        timestamp: new Date().toISOString(),
        agentId: this.config.id,
        error: message,
        assignees: data.assignees,
      });

      throw new Error(`Failed to assign GitHub users: ${message}`);
    }
  }
}
