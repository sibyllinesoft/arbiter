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
 * AI-powered Documentation Agent
 * 
 * This agent automatically generates and maintains documentation, providing:
 * - API documentation generation
 * - README and guide creation
 * - Code comment suggestions
 * - Changelog generation
 * - Architecture documentation
 * - Migration guides
 * 
 * Supported commands:
 * - /generate-docs - Generate comprehensive documentation
 * - /api-docs - Create API documentation
 * - /readme - Generate or update README files
 * - /changelog - Generate changelog entries
 * - /migration-guide - Create migration documentation
 * - /code-comments - Suggest code comments and documentation
 */
export class DocumentationAgent extends AIAgentHandler {
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
   * Initialize AI commands for documentation generation
   */
  protected initializeCommands(): void {
    // Comprehensive documentation generation
    this.registerCommand('generate-docs', {
      name: 'generate-docs',
      description: 'Generate comprehensive documentation for code changes',
      usage: '/generate-docs [type]',
      examples: [
        '/generate-docs',
        '/generate-docs api',
        '/generate-docs user-guide',
        '/generate-docs technical',
      ],
      requiresArgs: false,
      prompt: `Generate comprehensive documentation for the code changes in this pull request or push. Analyze the changes and create appropriate documentation including:

1. **Code Documentation**:
   - Function and class documentation with parameters, return values, and examples
   - Inline code comments for complex logic
   - Type annotations and interface documentation
   - Error handling and exception documentation

2. **API Documentation**:
   - Endpoint documentation with HTTP methods, parameters, and responses
   - Request/response examples in multiple formats (JSON, XML, etc.)
   - Authentication and authorization requirements
   - Rate limiting and error codes

3. **User Documentation**:
   - Getting started guides and tutorials
   - Configuration and setup instructions
   - Usage examples and best practices
   - Troubleshooting and FAQ sections

4. **Technical Documentation**:
   - Architecture diagrams and explanations
   - Database schema and relationships
   - Deployment and infrastructure guides
   - Performance and scalability considerations

Format the documentation appropriately for its intended use (Markdown, JSDoc, OpenAPI, etc.) and ensure it's clear, complete, and maintainable.`,
      actions: {
        postComment: true,
        createIssue: true,
      },
    });

    // API documentation generation
    this.registerCommand('api-docs', {
      name: 'api-docs',
      description: 'Generate API documentation from code changes',
      usage: '/api-docs [format]',
      examples: [
        '/api-docs',
        '/api-docs openapi',
        '/api-docs postman',
        '/api-docs swagger',
      ],
      requiresArgs: false,
      prompt: `Generate comprehensive API documentation for the endpoints and interfaces changed in this code. Include:

1. **Endpoint Documentation**:
   - HTTP methods (GET, POST, PUT, DELETE, etc.)
   - URL patterns and path parameters
   - Query parameters with types and validation rules
   - Request body schemas and examples
   - Response schemas with status codes
   - Error response formats and codes

2. **Authentication & Security**:
   - Authentication methods (API keys, OAuth, JWT, etc.)
   - Authorization requirements and scopes
   - Rate limiting policies
   - CORS and security headers

3. **Data Models**:
   - Request/response object schemas
   - Data type definitions and validation rules
   - Nested object relationships
   - Optional vs required fields

4. **Examples and Usage**:
   - cURL examples for each endpoint
   - SDK/library usage examples
   - Common use case scenarios
   - Integration patterns

5. **OpenAPI/Swagger Specification**:
   - Generate valid OpenAPI 3.0 specification
   - Include metadata, servers, and tags
   - Add operation IDs and summaries
   - Include example values and descriptions

Format as OpenAPI/Swagger specification or Markdown documentation as appropriate.`,
      actions: {
        postComment: true,
        createIssue: true,
      },
    });

    // README generation and updates
    this.registerCommand('readme', {
      name: 'readme',
      description: 'Generate or update README documentation',
      usage: '/readme [section]',
      examples: [
        '/readme',
        '/readme installation',
        '/readme usage',
        '/readme complete',
      ],
      requiresArgs: false,
      prompt: `Generate or update README documentation based on the code changes. Create a comprehensive README that includes:

1. **Project Overview**:
   - Clear project title and description
   - Key features and benefits
   - Target audience and use cases
   - Screenshots or demos if applicable

2. **Installation & Setup**:
   - System requirements and dependencies
   - Step-by-step installation instructions
   - Environment setup and configuration
   - Verification steps to confirm installation

3. **Usage Instructions**:
   - Quick start guide with basic examples
   - Common use cases and workflows
   - Command-line interface documentation
   - Configuration options and settings

4. **Development Setup**:
   - Development environment setup
   - Build and test instructions
   - Contribution guidelines
   - Code style and standards

5. **Additional Sections**:
   - API reference (brief overview)
   - Troubleshooting common issues
   - Changelog and versioning
   - License and attribution
   - Support and community links

Use clear headings, bullet points, code blocks, and examples. Make it beginner-friendly while being comprehensive for advanced users.`,
      actions: {
        postComment: true,
        createIssue: true,
      },
    });

    // Changelog generation
    this.registerCommand('changelog', {
      name: 'changelog',
      description: 'Generate changelog entries for code changes',
      usage: '/changelog [format]',
      examples: [
        '/changelog',
        '/changelog semantic',
        '/changelog traditional',
      ],
      requiresArgs: false,
      prompt: `Generate changelog entries for the code changes in this pull request or push. Follow these guidelines:

1. **Categorize Changes**:
   - **Added**: New features and functionality
   - **Changed**: Changes in existing functionality
   - **Deprecated**: Soon-to-be removed features
   - **Removed**: Features removed in this release
   - **Fixed**: Bug fixes
   - **Security**: Security vulnerability fixes

2. **Entry Format**:
   - Use clear, user-facing language (not technical jargon)
   - Start with action verbs (Added, Fixed, Improved, etc.)
   - Include relevant context and impact
   - Reference issue numbers when applicable
   - Follow semantic versioning implications

3. **Technical Details**:
   - Breaking changes should be clearly marked
   - Migration steps for breaking changes
   - Deprecation warnings and timelines
   - Performance improvements and benchmarks

4. **Examples**:
   - ✅ "Added user authentication with OAuth2 support"
   - ✅ "Fixed memory leak in file processing pipeline"
   - ✅ "**BREAKING**: Removed deprecated /v1/users endpoint"
   - ❌ "Updated UserController.js"
   - ❌ "Misc bug fixes"

Format as standard changelog (Keep a Changelog format) or release notes as appropriate.`,
      actions: {
        postComment: true,
        createIssue: true,
      },
    });

    // Migration guide generation
    this.registerCommand('migration-guide', {
      name: 'migration-guide',
      description: 'Create migration guides for breaking changes',
      usage: '/migration-guide [version]',
      examples: [
        '/migration-guide',
        '/migration-guide v2.0',
        '/migration-guide breaking-changes',
      ],
      requiresArgs: false,
      prompt: `Create a comprehensive migration guide for any breaking changes in this code. Include:

1. **Overview of Changes**:
   - Summary of what changed and why
   - Impact assessment on existing users
   - Timeline for migration
   - Support and deprecation schedule

2. **Before and After Comparisons**:
   - Code examples showing old vs new patterns
   - API endpoint changes with request/response examples
   - Configuration file updates
   - Database schema changes

3. **Step-by-Step Migration**:
   - Detailed migration steps in order
   - Code transformation examples
   - Data migration scripts if needed
   - Testing and validation procedures

4. **Common Issues and Solutions**:
   - Anticipated problems and their solutions
   - Error messages and troubleshooting
   - Performance considerations
   - Rollback procedures if needed

5. **Tools and Resources**:
   - Migration scripts and utilities
   - Automated migration tools
   - Testing frameworks and helpers
   - Community resources and support

Make the guide practical and actionable, with working code examples and clear explanations of the rationale behind changes.`,
      actions: {
        postComment: true,
        createIssue: true,
      },
    });

    // Code comment suggestions
    this.registerCommand('code-comments', {
      name: 'code-comments',
      description: 'Suggest code comments and inline documentation',
      usage: '/code-comments [style]',
      examples: [
        '/code-comments',
        '/code-comments jsdoc',
        '/code-comments inline',
        '/code-comments comprehensive',
      ],
      requiresArgs: false,
      prompt: `Analyze the code changes and suggest appropriate comments and inline documentation. Focus on:

1. **Function and Class Documentation**:
   - Purpose and behavior descriptions
   - Parameter types, constraints, and meanings
   - Return value descriptions and possible states
   - Thrown exceptions and error conditions
   - Usage examples for complex functions

2. **Inline Comments**:
   - Complex algorithm explanations
   - Business logic reasoning
   - Performance considerations
   - Security implications
   - Temporary workarounds with context

3. **Code Block Documentation**:
   - Section headers for logical code groups
   - Regular expression explanations
   - Magic number and constant explanations
   - External API integration notes

4. **Documentation Standards**:
   - Follow language-specific conventions (JSDoc, docstrings, etc.)
   - Use consistent formatting and style
   - Include @param, @returns, @throws tags as appropriate
   - Add @example blocks for complex functions

5. **What NOT to Comment**:
   - Obvious code that's self-explanatory
   - Redundant descriptions of what the code does
   - Outdated or inaccurate comments
   - Implementation details that change frequently

Provide specific suggestions with line numbers where comments should be added or improved.`,
      actions: {
        postComment: true,
      },
    });
  }

  /**
   * Process standard events (automatic documentation suggestions)
   */
  protected async processEvent(eventData: any, originalEvent: WebhookEvent): Promise<HandlerResponse> {
    // Check if automatic documentation is enabled
    if (!this.config.behavior?.autoResponse) {
      return createResponse(true, 'Automatic documentation disabled', { 
        skipped: true,
        reason: 'auto_response_disabled' 
      });
    }

    // Auto-suggest documentation for significant code changes
    const shouldSuggestDocs = this.shouldSuggestDocumentation(eventData);

    if (!shouldSuggestDocs) {
      return createResponse(true, 'Event does not require documentation suggestions', { 
        skipped: true,
        reason: 'no_documentation_needed' 
      });
    }

    try {
      // Determine the appropriate documentation command
      const docCommand = this.selectDocumentationCommand(eventData);
      const command = this.commands.get(docCommand)!;
      
      const aiContext = {
        command: docCommand,
        args: [],
        eventData,
        originalEvent,
        config: this.config,
      };

      const aiResponse = await this.provider.processCommand(command, aiContext);
      
      if (!aiResponse.success) {
        return createResponse(false, `Automatic documentation failed: ${aiResponse.error}`);
      }

      // Execute any actions from the AI
      let actionResults = [];
      if (aiResponse.actions && aiResponse.actions.length > 0) {
        actionResults = await this.executeActions(aiResponse.actions, eventData, originalEvent);
      }

      return createResponse(true, 'Automatic documentation suggestions completed', {
        documentation: aiResponse.data,
        actions: actionResults,
        command: docCommand,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return createResponse(false, `Automatic documentation error: ${errorMessage}`);
    }
  }

  /**
   * Determine if documentation should be suggested for this event
   */
  private shouldSuggestDocumentation(eventData: any): boolean {
    // Check for pull requests with significant changes
    if (eventData.pullRequest) {
      const pr = eventData.pullRequest;
      
      // Large PRs likely need documentation
      if (pr.changedFiles > 5 || pr.additions > 200) {
        return true;
      }
      
      // API changes need documentation
      if (this.hasAPIChanges(eventData)) {
        return true;
      }
      
      // New features need documentation
      if (pr.title.toLowerCase().includes('feat') || 
          pr.body.toLowerCase().includes('new feature')) {
        return true;
      }
    }

    // Check for pushes to main branches with doc-worthy changes
    if (eventData.push && eventData.push.isProtectedBranch) {
      return eventData.push.commitCount > 3 || this.hasAPIChanges(eventData);
    }

    return false;
  }

  /**
   * Check if changes include API modifications
   */
  private hasAPIChanges(eventData: any): boolean {
    // This is a simplified check - in production, you'd analyze the actual file changes
    const indicators = [
      'api', 'endpoint', 'route', 'controller',
      'swagger', 'openapi', 'schema', 'model'
    ];
    
    const searchText = (
      eventData.pullRequest?.title + ' ' +
      eventData.pullRequest?.body + ' ' +
      (eventData.push?.commits?.map((c: any) => c.message).join(' ') || '')
    ).toLowerCase();

    return indicators.some(indicator => searchText.includes(indicator));
  }

  /**
   * Select appropriate documentation command based on changes
   */
  private selectDocumentationCommand(eventData: any): string {
    if (this.hasAPIChanges(eventData)) {
      return 'api-docs';
    }
    
    if (eventData.pullRequest?.title.toLowerCase().includes('readme') ||
        eventData.push?.commits?.some((c: any) => c.message.toLowerCase().includes('readme'))) {
      return 'readme';
    }
    
    // Default to general documentation
    return 'generate-docs';
  }

  /**
   * Execute actions returned by the AI
   */
  protected async executeAction(action: any, eventData: any, originalEvent: WebhookEvent): Promise<any> {
    switch (action.type) {
      case 'comment':
        return await this.postDocumentationComment(action.data, eventData, originalEvent);
      
      case 'issue':
        return await this.createDocumentationIssue(action.data, eventData, originalEvent);
      
      case 'webhook':
        return await this.triggerDocumentationWebhook(action.data, eventData, originalEvent);
      
      default:
        throw new Error(`Unsupported action type: ${action.type}`);
    }
  }

  /**
   * Post documentation comment
   */
  private async postDocumentationComment(data: { body: string }, eventData: any, originalEvent: WebhookEvent): Promise<any> {
    await this.logActivity({
      type: 'ai.agent.action.comment',
      timestamp: new Date().toISOString(),
      agentId: this.config.id,
      action: 'documentation_comment',
      target: eventData.pullRequest ? 
        `PR #${eventData.pullRequest.number}` : 
        `Push to ${eventData.push?.branch}`,
      preview: data.body.substring(0, 100),
    });

    return {
      action: 'comment',
      status: 'success',
      message: 'Documentation comment posted successfully',
      preview: data.body.substring(0, 100),
    };
  }

  /**
   * Create documentation issue
   */
  private async createDocumentationIssue(data: { title: string; body: string; labels?: string[] }, eventData: any, originalEvent: WebhookEvent): Promise<any> {
    await this.logActivity({
      type: 'ai.agent.action.issue',
      timestamp: new Date().toISOString(),
      agentId: this.config.id,
      action: 'documentation_issue',
      title: data.title,
      labels: data.labels || ['documentation'],
    });

    return {
      action: 'create_issue',
      status: 'success',
      title: data.title,
      labels: data.labels || ['documentation'],
      message: 'Documentation issue created successfully',
    };
  }

  /**
   * Trigger documentation webhook (for external doc systems)
   */
  private async triggerDocumentationWebhook(data: { webhookUrl: string; [key: string]: any }, eventData: any, originalEvent: WebhookEvent): Promise<any> {
    await this.logActivity({
      type: 'ai.agent.action.webhook',
      timestamp: new Date().toISOString(),
      agentId: this.config.id,
      action: 'documentation_webhook',
      webhookUrl: data.webhookUrl,
    });

    return {
      action: 'webhook',
      status: 'success',
      url: data.webhookUrl,
      message: 'Documentation webhook triggered successfully',
    };
  }
}