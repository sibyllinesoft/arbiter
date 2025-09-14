import type { 
  AIProvider, 
  AICommand, 
  AIContext, 
  AIResponse, 
  AIProviderStatus,
  ClaudeConfig 
} from '../base/types.js';

/**
 * Claude AI Provider for webhook processing
 * 
 * Integrates with Anthropic's Claude API to provide AI-powered analysis
 * of GitHub/GitLab events with specialized prompts for different tasks.
 */
export class ClaudeProvider implements AIProvider {
  private config: ClaudeConfig;
  private metrics: {
    requestCount: number;
    tokenUsage: number;
    errorCount: number;
    responseTimeSum: number;
  };

  constructor(config: ClaudeConfig) {
    this.config = config;
    this.metrics = {
      requestCount: 0,
      tokenUsage: 0,
      errorCount: 0,
      responseTimeSum: 0,
    };
  }

  getName(): string {
    return 'claude';
  }

  getConfig(): ClaudeConfig {
    return this.config;
  }

  /**
   * Process an AI command with Claude
   */
  async processCommand(command: AICommand, context: AIContext): Promise<AIResponse> {
    const startTime = Date.now();
    
    try {
      // Build the prompt with context
      const prompt = this.buildPrompt(command, context);
      
      // Call Claude API
      const response = await this.callClaudeAPI(prompt, command);
      
      // Parse response and generate actions
      const parsedResponse = this.parseResponse(response, command, context);
      
      // Update metrics
      this.updateMetrics(startTime, response.usage || {});
      
      return parsedResponse;

    } catch (error) {
      this.metrics.errorCount++;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        success: false,
        error: `Claude API error: ${errorMessage}`,
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      };
    }
  }

  /**
   * Build a comprehensive prompt with context
   */
  private buildPrompt(command: AICommand, context: AIContext): string {
    const basePrompt = command.prompt;
    
    // Build context sections
    const sections = [
      // System context
      this.buildSystemContext(command),
      
      // Event context
      this.buildEventContext(context),
      
      // Repository context
      this.buildRepositoryContext(context),
      
      // User context
      this.buildUserContext(context),
      
      // Command-specific instructions
      basePrompt,
      
      // Output format instructions
      this.buildOutputFormatInstructions(command),
    ];

    return sections.filter(section => section.length > 0).join('\n\n');
  }

  /**
   * Build system context for Claude
   */
  private buildSystemContext(command: AICommand): string {
    return `You are an AI assistant specialized in analyzing Git repository events and providing actionable insights. You have expertise in:

- Code review and quality assessment
- Security vulnerability detection
- Documentation generation and improvement
- Issue categorization and prioritization
- Commit message analysis
- Branch and workflow management

Current task: ${command.name}
Description: ${command.description}

Please provide precise, actionable, and helpful analysis based on the provided context.`;
  }

  /**
   * Build event-specific context
   */
  private buildEventContext(context: AIContext): string {
    const { eventData, originalEvent } = context;
    
    let contextStr = `## Event Context\n`;
    contextStr += `Event Type: ${originalEvent.eventType}\n`;
    contextStr += `Provider: ${originalEvent.provider}\n`;
    contextStr += `Timestamp: ${originalEvent.timestamp}\n`;

    // Add event-specific details
    if (eventData.pullRequest) {
      const pr = eventData.pullRequest;
      contextStr += `\n### Pull Request Details\n`;
      contextStr += `Number: #${pr.number}\n`;
      contextStr += `Title: ${pr.title}\n`;
      contextStr += `State: ${pr.state}\n`;
      contextStr += `Draft: ${pr.draft}\n`;
      contextStr += `Source Branch: ${pr.sourceBranch}\n`;
      contextStr += `Target Branch: ${pr.targetBranch}\n`;
      contextStr += `Files Changed: ${pr.changedFiles}\n`;
      contextStr += `Additions: +${pr.additions}, Deletions: -${pr.deletions}\n`;
      
      if (pr.body) {
        contextStr += `\nDescription:\n${pr.body}\n`;
      }
    }

    if (eventData.issue) {
      const issue = eventData.issue;
      contextStr += `\n### Issue Details\n`;
      contextStr += `Number: #${issue.number}\n`;
      contextStr += `Title: ${issue.title}\n`;
      contextStr += `State: ${issue.state}\n`;
      contextStr += `Labels: ${issue.labels.join(', ')}\n`;
      contextStr += `Assignees: ${issue.assignees.join(', ')}\n`;
      
      if (issue.body) {
        contextStr += `\nDescription:\n${issue.body}\n`;
      }
    }

    if (eventData.push) {
      const push = eventData.push;
      contextStr += `\n### Push Details\n`;
      contextStr += `Branch: ${push.branch}\n`;
      contextStr += `Commit Count: ${push.commitCount}\n`;
      contextStr += `Is Protected Branch: ${push.isProtectedBranch}\n`;
      contextStr += `Is Force Push: ${push.isForcePush}\n`;
      
      if (push.commits && push.commits.length > 0) {
        contextStr += `\n### Recent Commits\n`;
        push.commits.slice(0, 5).forEach((commit: any, i: number) => {
          contextStr += `${i + 1}. ${commit.id.substring(0, 7)} - ${commit.message}\n`;
        });
      }
    }

    return contextStr;
  }

  /**
   * Build repository context
   */
  private buildRepositoryContext(context: AIContext): string {
    const { repository } = context.eventData;
    if (!repository) return '';

    return `## Repository Context\n` +
           `Name: ${repository.name}\n` +
           `Full Name: ${repository.fullName}\n` +
           `Default Branch: ${repository.defaultBranch}\n` +
           `URL: ${repository.url}`;
  }

  /**
   * Build user context
   */
  private buildUserContext(context: AIContext): string {
    const { user } = context.eventData;
    if (!user) return '';

    return `## User Context\n` +
           `Username: ${user.login}\n` +
           `Name: ${user.name || 'Not provided'}\n` +
           `Email: ${user.email || 'Not provided'}`;
  }

  /**
   * Build output format instructions
   */
  private buildOutputFormatInstructions(command: AICommand): string {
    let instructions = `## Output Requirements\n`;
    instructions += `Please structure your response as follows:\n\n`;

    switch (command.name) {
      case 'review-code':
        instructions += `1. **Overall Assessment**: Provide a summary rating and key findings
2. **Code Quality**: Comment on structure, readability, and best practices
3. **Security**: Identify any security concerns or vulnerabilities
4. **Performance**: Note any performance implications
5. **Suggestions**: Provide specific, actionable improvement recommendations
6. **Actions**: If you recommend any automated actions (comments, labels, etc.), specify them clearly`;
        break;

      case 'analyze-issue':
        instructions += `1. **Category**: Classify the issue type (bug, feature, enhancement, question, etc.)
2. **Priority**: Suggest priority level (low, medium, high, critical)
3. **Complexity**: Estimate implementation complexity
4. **Labels**: Recommend appropriate labels
5. **Assignee**: Suggest who should handle this (if clear from context)
6. **Next Steps**: Outline what should happen next`;
        break;

      case 'generate-docs':
        instructions += `1. **Documentation Type**: Identify what type of documentation is needed
2. **Content**: Provide the actual documentation content
3. **Suggestions**: Recommend where this documentation should be placed
4. **Additional**: Suggest any related documentation improvements`;
        break;

      case 'security-scan':
        instructions += `1. **Risk Level**: Overall security risk assessment (low/medium/high)
2. **Vulnerabilities**: List any identified security issues
3. **Dependencies**: Check for vulnerable dependencies
4. **Best Practices**: Note any security best practices violations
5. **Recommendations**: Provide specific remediation steps`;
        break;

      default:
        instructions += `Please provide a structured analysis with clear sections and actionable recommendations.`;
    }

    instructions += `\n\nIf you recommend any automated actions (posting comments, adding labels, creating issues, etc.), please specify them in a clear "ACTIONS" section at the end of your response.`;

    return instructions;
  }

  /**
   * Call Claude API with retry logic
   */
  private async callClaudeAPI(prompt: string, command: AICommand): Promise<any> {
    const requestBody = {
      model: command.model || this.config.model,
      max_tokens: command.maxTokens || this.config.maxTokens || 4000,
      temperature: command.temperature || this.config.temperature || 0.7,
      system: this.config.systemPrompt || "You are a helpful AI assistant specialized in code analysis and repository management.",
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    };

    const response = await fetch(`${this.config.baseUrl || 'https://api.anthropic.com'}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API request failed: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Parse Claude's response and extract actions
   */
  private parseResponse(response: any, command: AICommand, context: AIContext): AIResponse {
    const content = response.content?.[0]?.text || '';
    
    // Extract actions if present
    const actions = this.extractActions(content, command, context);
    
    // Parse different response types
    let data: any = { analysis: content };

    if (command.name === 'review-code') {
      data.codeReview = this.parseCodeReview(content);
    } else if (command.name === 'analyze-issue') {
      data.issueAnalysis = this.parseIssueAnalysis(content);
    } else if (command.name === 'generate-docs') {
      data.documentation = this.parseDocumentation(content);
    } else if (command.name === 'security-scan') {
      data.securityScan = this.parseSecurityScan(content);
    }

    return {
      success: true,
      message: 'Analysis completed successfully',
      data,
      actions,
      usage: {
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
        totalTokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
      },
    };
  }

  /**
   * Extract actions from Claude's response
   */
  private extractActions(content: string, command: AICommand, context: AIContext): any[] {
    const actions = [];
    
    // Look for action sections in the response
    const actionMatch = content.match(/## ACTIONS?\s*\n(.*?)(?=\n##|\n$|$)/is);
    if (actionMatch) {
      const actionText = actionMatch[1];
      
      // Parse common action patterns
      if (actionText.includes('comment') || actionText.includes('Comment')) {
        actions.push({
          type: 'comment',
          data: {
            body: this.extractCommentBody(actionText, content),
          },
        });
      }
      
      if (actionText.includes('label') || actionText.includes('Label')) {
        const labels = this.extractLabels(actionText);
        if (labels.length > 0) {
          actions.push({
            type: 'label',
            data: { labels },
          });
        }
      }
      
      if (actionText.includes('assign') || actionText.includes('Assign')) {
        const assignees = this.extractAssignees(actionText);
        if (assignees.length > 0) {
          actions.push({
            type: 'assign',
            data: { assignees },
          });
        }
      }
    }

    return actions;
  }

  /**
   * Extract comment body from action text
   */
  private extractCommentBody(actionText: string, fullContent: string): string {
    // Try to extract a specific comment, or use the full analysis
    const commentMatch = actionText.match(/comment[:\s]*["']?(.*?)["']?$/im);
    return commentMatch ? commentMatch[1] : fullContent;
  }

  /**
   * Extract labels from action text
   */
  private extractLabels(actionText: string): string[] {
    const labelMatches = actionText.match(/label[s]?[:\s]*([^\n]+)/im);
    if (labelMatches) {
      return labelMatches[1]
        .split(/[,;]/)
        .map(label => label.trim().replace(/["']/g, ''))
        .filter(label => label.length > 0);
    }
    return [];
  }

  /**
   * Extract assignees from action text
   */
  private extractAssignees(actionText: string): string[] {
    const assigneeMatches = actionText.match(/assign[e]?[s]?[:\s]*([^\n]+)/im);
    if (assigneeMatches) {
      return assigneeMatches[1]
        .split(/[,;]/)
        .map(assignee => assignee.trim().replace(/[@"']/g, ''))
        .filter(assignee => assignee.length > 0);
    }
    return [];
  }

  /**
   * Parse code review from Claude's response
   */
  private parseCodeReview(content: string): any {
    // This is a simplified parser - in production, you'd want more robust parsing
    return {
      overallRating: this.extractRating(content),
      summary: this.extractSection(content, 'Overall Assessment') || content.substring(0, 200),
      security: {
        riskLevel: this.extractSecurityRisk(content),
        issues: this.extractList(content, 'Security'),
      },
      performance: {
        concerns: this.extractList(content, 'Performance'),
        suggestions: this.extractList(content, 'Suggestions'),
      },
      maintainability: {
        score: 8, // Default score
        issues: this.extractList(content, 'Code Quality'),
      },
    };
  }

  /**
   * Parse issue analysis from Claude's response
   */
  private parseIssueAnalysis(content: string): any {
    return {
      category: this.extractValue(content, 'Category'),
      priority: this.extractValue(content, 'Priority'),
      complexity: this.extractValue(content, 'Complexity'),
      labels: this.extractLabels(content),
      nextSteps: this.extractSection(content, 'Next Steps'),
    };
  }

  /**
   * Parse documentation from Claude's response
   */
  private parseDocumentation(content: string): any {
    return {
      type: this.extractValue(content, 'Documentation Type'),
      content: this.extractSection(content, 'Content') || content,
      suggestions: this.extractSection(content, 'Suggestions'),
    };
  }

  /**
   * Parse security scan from Claude's response
   */
  private parseSecurityScan(content: string): any {
    return {
      riskLevel: this.extractSecurityRisk(content),
      vulnerabilities: this.extractList(content, 'Vulnerabilities'),
      recommendations: this.extractList(content, 'Recommendations'),
    };
  }

  /**
   * Helper methods for parsing
   */
  private extractRating(content: string): string {
    const ratingMatch = content.match(/(excellent|good|needs-improvement|poor)/i);
    return ratingMatch ? ratingMatch[1].toLowerCase() : 'good';
  }

  private extractSecurityRisk(content: string): string {
    const riskMatch = content.match(/risk[:\s]*(low|medium|high)/i);
    return riskMatch ? riskMatch[1].toLowerCase() : 'low';
  }

  private extractSection(content: string, sectionName: string): string {
    const regex = new RegExp(`##?\\s*${sectionName}[:\\s]*\\n([^#]*?)(?=\\n##|$)`, 'is');
    const match = content.match(regex);
    return match ? match[1].trim() : '';
  }

  private extractValue(content: string, field: string): string {
    const regex = new RegExp(`${field}[:\\s]*([^\\n]+)`, 'i');
    const match = content.match(regex);
    return match ? match[1].trim() : '';
  }

  private extractList(content: string, section: string): string[] {
    const sectionContent = this.extractSection(content, section);
    if (!sectionContent) return [];
    
    return sectionContent
      .split('\n')
      .map(line => line.replace(/^[-*]\s*/, '').trim())
      .filter(line => line.length > 0);
  }

  /**
   * Update usage metrics
   */
  private updateMetrics(startTime: number, usage: any): void {
    this.metrics.requestCount++;
    this.metrics.tokenUsage += usage.input_tokens || 0;
    this.metrics.tokenUsage += usage.output_tokens || 0;
    this.metrics.responseTimeSum += Date.now() - startTime;
  }

  /**
   * Test connection to Claude API
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.callClaudeAPI('Test connection', {
        name: 'test',
        description: 'Connection test',
        usage: '',
        examples: [],
        requiresArgs: false,
        prompt: 'Please respond with "Connection successful"',
      });
      
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get provider status and metrics
   */
  async getStatus(): Promise<AIProviderStatus> {
    const avgResponseTime = this.metrics.requestCount > 0 
      ? this.metrics.responseTimeSum / this.metrics.requestCount 
      : 0;

    const successRate = this.metrics.requestCount > 0
      ? (this.metrics.requestCount - this.metrics.errorCount) / this.metrics.requestCount
      : 1;

    return {
      name: 'Claude',
      connected: true,
      model: this.config.model,
      
      usage: {
        requestsToday: this.metrics.requestCount,
        tokensToday: this.metrics.tokenUsage,
      },
      
      performance: {
        averageResponseTime: avgResponseTime,
        successRate: successRate,
        errorRate: this.metrics.errorCount / Math.max(this.metrics.requestCount, 1),
      },
    };
  }
}