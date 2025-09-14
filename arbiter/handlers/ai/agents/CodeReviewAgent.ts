import type { WebhookEvent, HandlerResponse } from '../../shared/utils.js';
import type { AIAgentConfig, AICommand } from '../base/types.js';
import { AIAgentHandler } from '../base/AIAgentHandler.js';
import { ClaudeProvider } from '../providers/ClaudeProvider.js';
import { OpenAIProvider } from '../providers/OpenAIProvider.js';
import { GeminiProvider } from '../providers/GeminiProvider.js';
import { GitHubPRAdapter } from '../adapters/github/GitHubPRAdapter.js';
import { GitHubPushAdapter } from '../adapters/github/GitHubPushAdapter.js';
import { GitLabMRAdapter } from '../adapters/gitlab/GitLabMRAdapter.js';
import { createResponse } from '../../shared/utils.js';

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
  constructor(config: AIAgentConfig) {
    // Initialize AI provider based on config
    let provider;
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
      default:
        throw new Error(`Unsupported AI provider: ${config.provider.type}`);
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
      description: 'Perform comprehensive code review including quality, security, and performance analysis',
      usage: '/review-code [focus-area]',
      examples: [
        '/review-code',
        '/review-code security',
        '/review-code performance',
      ],
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
      examples: [
        '/security-scan',
        '/security-scan high-only',
        '/security-scan all',
      ],
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
      examples: [
        '/style-check',
        '/style-check typescript',
        '/style-check python',
      ],
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
  protected async processEvent(eventData: any, originalEvent: WebhookEvent): Promise<HandlerResponse> {
    // Check if automatic review is enabled
    if (!this.config.behavior?.autoResponse) {
      return createResponse(true, 'Automatic review disabled', { 
        skipped: true,
        reason: 'auto_response_disabled' 
      });
    }

    // Only auto-review pull requests and pushes to protected branches
    const shouldAutoReview = eventData.pullRequest || 
      (eventData.push && eventData.push.isProtectedBranch);

    if (!shouldAutoReview) {
      return createResponse(true, 'Event does not require automatic review', { 
        skipped: true,
        reason: 'not_reviewable' 
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
  protected async executeAction(action: any, eventData: any, originalEvent: WebhookEvent): Promise<any> {
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

  /**
   * Post a comment on the PR/issue
   */
  private async postComment(data: { body: string }, eventData: any, originalEvent: WebhookEvent): Promise<any> {
    // This is a stub implementation
    // In production, you would integrate with GitHub/GitLab APIs
    
    await this.logActivity({
      type: 'ai.agent.action.comment',
      timestamp: new Date().toISOString(),
      agentId: this.config.id,
      action: 'comment',
      target: eventData.pullRequest ? 
        `PR #${eventData.pullRequest.number}` : 
        `Issue #${eventData.issue?.number}`,
      preview: data.body.substring(0, 100),
    });

    return {
      action: 'comment',
      status: 'success',
      message: 'Comment posted successfully',
      preview: data.body.substring(0, 100),
    };
  }

  /**
   * Add labels to the PR/issue
   */
  private async addLabels(data: { labels: string[] }, eventData: any, originalEvent: WebhookEvent): Promise<any> {
    await this.logActivity({
      type: 'ai.agent.action.label',
      timestamp: new Date().toISOString(),
      agentId: this.config.id,
      action: 'label',
      labels: data.labels,
    });

    return {
      action: 'label',
      status: 'success',
      labels: data.labels,
      message: `Added labels: ${data.labels.join(', ')}`,
    };
  }

  /**
   * Assign users to the PR/issue
   */
  private async assignUsers(data: { assignees: string[] }, eventData: any, originalEvent: WebhookEvent): Promise<any> {
    await this.logActivity({
      type: 'ai.agent.action.assign',
      timestamp: new Date().toISOString(),
      agentId: this.config.id,
      action: 'assign',
      assignees: data.assignees,
    });

    return {
      action: 'assign',
      status: 'success',
      assignees: data.assignees,
      message: `Assigned to: ${data.assignees.join(', ')}`,
    };
  }
}