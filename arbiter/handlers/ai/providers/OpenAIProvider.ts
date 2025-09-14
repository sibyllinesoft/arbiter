import type { 
  AIProvider, 
  AICommand, 
  AIContext, 
  AIResponse, 
  AIProviderStatus,
  OpenAIConfig 
} from '../base/types.js';

/**
 * OpenAI Provider for webhook processing
 * 
 * Integrates with OpenAI's GPT models to provide AI-powered analysis
 * of GitHub/GitLab events with optimized prompts for code understanding.
 */
export class OpenAIProvider implements AIProvider {
  private config: OpenAIConfig;
  private metrics: {
    requestCount: number;
    tokenUsage: number;
    errorCount: number;
    responseTimeSum: number;
  };

  constructor(config: OpenAIConfig) {
    this.config = config;
    this.metrics = {
      requestCount: 0,
      tokenUsage: 0,
      errorCount: 0,
      responseTimeSum: 0,
    };
  }

  getName(): string {
    return 'openai';
  }

  getConfig(): OpenAIConfig {
    return this.config;
  }

  /**
   * Process an AI command with OpenAI GPT
   */
  async processCommand(command: AICommand, context: AIContext): Promise<AIResponse> {
    const startTime = Date.now();
    
    try {
      // Build the prompt with context
      const messages = this.buildMessages(command, context);
      
      // Call OpenAI API
      const response = await this.callOpenAIAPI(messages, command);
      
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
        error: `OpenAI API error: ${errorMessage}`,
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      };
    }
  }

  /**
   * Build messages array for OpenAI Chat API
   */
  private buildMessages(command: AICommand, context: AIContext): any[] {
    const messages = [];

    // System message with role definition
    messages.push({
      role: 'system',
      content: this.buildSystemPrompt(command)
    });

    // User message with event context and instructions
    messages.push({
      role: 'user',
      content: this.buildUserPrompt(command, context)
    });

    return messages;
  }

  /**
   * Build system prompt for OpenAI
   */
  private buildSystemPrompt(command: AICommand): string {
    const rolePrompts = {
      'review-code': `You are a senior software engineer and code reviewer with expertise in multiple programming languages, security best practices, and software architecture. You excel at identifying bugs, security vulnerabilities, performance issues, and opportunities for improvement.`,
      
      'analyze-issue': `You are a technical product manager and issue triager with deep experience in software development. You're skilled at understanding requirements, categorizing issues, estimating complexity, and providing actionable next steps.`,
      
      'generate-docs': `You are a technical writer and documentation specialist with expertise in creating clear, comprehensive, and user-friendly documentation. You understand developer workflows and can create docs that truly help users.`,
      
      'security-scan': `You are a cybersecurity expert specializing in application security, vulnerability assessment, and secure coding practices. You have deep knowledge of OWASP guidelines, common attack vectors, and security best practices.`,
      
      'commit-analysis': `You are a Git expert and development workflow specialist. You understand branching strategies, commit message conventions, and can analyze development patterns to provide insights and recommendations.`,
    };

    const baseRole = rolePrompts[command.name as keyof typeof rolePrompts] || 
      'You are an AI assistant specialized in analyzing software development activities and providing actionable insights.';

    return `${baseRole}

Your task is to analyze the provided Git repository event and provide structured, actionable feedback. Be specific, precise, and helpful in your analysis. Focus on practical recommendations that can improve code quality, security, or development processes.

Always structure your responses clearly with appropriate headings and provide specific examples when possible.`;
  }

  /**
   * Build user prompt with context
   */
  private buildUserPrompt(command: AICommand, context: AIContext): string {
    const sections = [
      // Command-specific instructions
      `Task: ${command.name}`,
      `Description: ${command.description}`,
      '',
      
      // Event context
      this.buildEventContext(context),
      
      // Command-specific prompt
      command.prompt,
      
      // Output format requirements
      this.buildOutputFormat(command),
    ];

    return sections.join('\n');
  }

  /**
   * Build event context section
   */
  private buildEventContext(context: AIContext): string {
    const { eventData, originalEvent } = context;
    
    let contextStr = `## Event Information\n`;
    contextStr += `- Event Type: ${originalEvent.eventType}\n`;
    contextStr += `- Provider: ${originalEvent.provider}\n`;
    contextStr += `- Repository: ${eventData.repository?.fullName}\n`;
    contextStr += `- User: ${eventData.user?.login}\n`;
    contextStr += `- Timestamp: ${originalEvent.timestamp}\n\n`;

    // Add specific event data
    if (eventData.pullRequest) {
      const pr = eventData.pullRequest;
      contextStr += `### Pull Request Context\n`;
      contextStr += `- PR #${pr.number}: ${pr.title}\n`;
      contextStr += `- State: ${pr.state} ${pr.draft ? '(Draft)' : ''}\n`;
      contextStr += `- Branch: ${pr.sourceBranch} → ${pr.targetBranch}\n`;
      contextStr += `- Changes: ${pr.changedFiles} files, +${pr.additions}/-${pr.deletions}\n`;
      
      if (pr.body && pr.body.trim()) {
        contextStr += `- Description: ${pr.body.substring(0, 500)}${pr.body.length > 500 ? '...' : ''}\n`;
      }
      contextStr += '\n';
    }

    if (eventData.issue) {
      const issue = eventData.issue;
      contextStr += `### Issue Context\n`;
      contextStr += `- Issue #${issue.number}: ${issue.title}\n`;
      contextStr += `- State: ${issue.state}\n`;
      contextStr += `- Labels: ${issue.labels.length ? issue.labels.join(', ') : 'None'}\n`;
      contextStr += `- Assignees: ${issue.assignees.length ? issue.assignees.join(', ') : 'None'}\n`;
      
      if (issue.body && issue.body.trim()) {
        contextStr += `- Description: ${issue.body.substring(0, 500)}${issue.body.length > 500 ? '...' : ''}\n`;
      }
      contextStr += '\n';
    }

    if (eventData.push) {
      const push = eventData.push;
      contextStr += `### Push Context\n`;
      contextStr += `- Branch: ${push.branch}\n`;
      contextStr += `- Commits: ${push.commitCount}\n`;
      contextStr += `- Type: ${push.isProtectedBranch ? 'Protected branch' : 'Regular branch'}\n`;
      
      if (push.commits && push.commits.length > 0) {
        contextStr += `- Recent commits:\n`;
        push.commits.slice(0, 3).forEach((commit: any, i: number) => {
          contextStr += `  ${i + 1}. ${commit.id.substring(0, 7)}: ${commit.message.split('\n')[0]}\n`;
        });
      }
      contextStr += '\n';
    }

    return contextStr;
  }

  /**
   * Build output format requirements
   */
  private buildOutputFormat(command: AICommand): string {
    const formats = {
      'review-code': `## Response Format

Please structure your response as follows:

### Overall Assessment
Provide a brief summary and overall rating (Excellent/Good/Needs Improvement/Poor).

### Key Findings
List the most important observations.

### Code Quality Analysis
- Structure and organization
- Readability and maintainability  
- Best practices adherence

### Security Review
- Potential vulnerabilities
- Security best practices
- Risk assessment

### Performance Considerations
- Performance implications
- Optimization opportunities

### Recommendations
Provide specific, actionable suggestions for improvement.

### Actions
If you recommend automated actions (comments, labels, etc.), list them clearly.`,

      'analyze-issue': `## Response Format

### Issue Classification
- Type: (bug/feature/enhancement/documentation/question/etc.)
- Priority: (critical/high/medium/low)
- Complexity: (trivial/easy/medium/hard/complex)

### Analysis
Detailed analysis of the issue.

### Recommended Labels
Suggest appropriate labels for this issue.

### Assignment Recommendation  
Suggest who should work on this (if clear from context).

### Next Steps
Outline what should happen next to move this forward.

### Actions
List any automated actions to take.`,

      'generate-docs': `## Response Format

### Documentation Analysis
What type of documentation is needed and why.

### Generated Documentation
Provide the actual documentation content, properly formatted.

### Placement Recommendations
Where this documentation should be located in the repository.

### Additional Suggestions
Any related documentation improvements.

### Actions
Any automated actions to take.`,
    };

    return formats[command.name as keyof typeof formats] || 
      `## Response Format\n\nPlease provide a structured analysis with clear sections and actionable recommendations. If you suggest any automated actions, include them in a clear "Actions" section.`;
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAIAPI(messages: any[], command: AICommand): Promise<any> {
    const requestBody = {
      model: command.model || this.config.model || 'gpt-4-0125-preview',
      messages,
      max_tokens: command.maxTokens || this.config.maxTokens || 4000,
      temperature: command.temperature || this.config.temperature || 0.7,
      stream: false,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
    };

    if (this.config.organizationId) {
      headers['OpenAI-Organization'] = this.config.organizationId;
    }

    const response = await fetch(`${this.config.baseUrl || 'https://api.openai.com'}/v1/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API request failed: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    return await response.json();
  }

  /**
   * Parse OpenAI response
   */
  private parseResponse(response: any, command: AICommand, context: AIContext): AIResponse {
    const content = response.choices?.[0]?.message?.content || '';
    
    // Extract actions if present
    const actions = this.extractActions(content, command, context);
    
    // Parse different response types
    let data: any = { analysis: content };

    if (command.name === 'review-code') {
      data.codeReview = this.parseCodeReview(content);
    } else if (command.name === 'analyze-issue') {
      data.issueAnalysis = this.parseIssueAnalysis(content);
    } else if (command.name === 'generate-docs') {
      data.documentation = content;
    }

    return {
      success: true,
      message: 'Analysis completed successfully',
      data,
      actions,
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
    };
  }

  /**
   * Extract actions from response (similar to Claude implementation)
   */
  private extractActions(content: string, command: AICommand, context: AIContext): any[] {
    const actions = [];
    
    // Look for action sections
    const actionMatch = content.match(/## Actions?\s*\n(.*?)(?=\n##|\n$|$)/is) ||
                       content.match(/### Actions?\s*\n(.*?)(?=\n##|\n###|\n$|$)/is);
    
    if (actionMatch) {
      const actionText = actionMatch[1];
      
      // Parse different action types
      if (actionText.toLowerCase().includes('comment') || actionText.toLowerCase().includes('add comment')) {
        actions.push({
          type: 'comment',
          data: {
            body: this.extractActionValue(actionText, 'comment') || content,
          },
        });
      }
      
      if (actionText.toLowerCase().includes('label')) {
        const labels = this.extractLabels(actionText);
        if (labels.length > 0) {
          actions.push({
            type: 'label',
            data: { labels },
          });
        }
      }
      
      if (actionText.toLowerCase().includes('assign')) {
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
   * Helper methods for parsing (similar to Claude implementation)
   */
  private parseCodeReview(content: string): any {
    return {
      overallRating: this.extractRating(content),
      summary: this.extractSection(content, 'Overall Assessment|Key Findings') || content.substring(0, 200),
      security: {
        riskLevel: this.extractSecurityRisk(content),
        issues: this.extractBulletPoints(content, 'Security'),
      },
      performance: {
        concerns: this.extractBulletPoints(content, 'Performance'),
        suggestions: this.extractBulletPoints(content, 'Recommendations|Suggestions'),
      },
    };
  }

  private parseIssueAnalysis(content: string): any {
    return {
      category: this.extractValue(content, 'Type'),
      priority: this.extractValue(content, 'Priority'),
      complexity: this.extractValue(content, 'Complexity'),
      nextSteps: this.extractSection(content, 'Next Steps'),
    };
  }

  private extractRating(content: string): string {
    const ratingMatch = content.match(/(excellent|good|needs.?improvement|poor)/i);
    return ratingMatch ? ratingMatch[1].toLowerCase().replace(/\s+/g, '-') : 'good';
  }

  private extractSecurityRisk(content: string): string {
    const riskMatch = content.match(/risk[:\s]*(low|medium|high|critical)/i);
    return riskMatch ? riskMatch[1].toLowerCase() : 'low';
  }

  private extractSection(content: string, sectionNames: string): string {
    const patterns = sectionNames.split('|');
    for (const pattern of patterns) {
      const regex = new RegExp(`##?#?\\s*${pattern}[:\\s]*\\n([^#]*?)(?=\\n##|\\n###|$)`, 'is');
      const match = content.match(regex);
      if (match) return match[1].trim();
    }
    return '';
  }

  private extractValue(content: string, field: string): string {
    const regex = new RegExp(`${field}[:\\s]*([^\\n]+)`, 'i');
    const match = content.match(regex);
    return match ? match[1].trim().replace(/[()]/g, '') : '';
  }

  private extractBulletPoints(content: string, section: string): string[] {
    const sectionContent = this.extractSection(content, section);
    if (!sectionContent) return [];
    
    return sectionContent
      .split('\n')
      .map(line => line.replace(/^[-*•]\s*/, '').trim())
      .filter(line => line.length > 0);
  }

  private extractLabels(text: string): string[] {
    const labelMatches = text.match(/label[s]?[:\s]*([^\n]+)/im);
    if (labelMatches) {
      return labelMatches[1]
        .split(/[,;]/)
        .map(label => label.trim().replace(/["`']/g, ''))
        .filter(label => label.length > 0);
    }
    return [];
  }

  private extractAssignees(text: string): string[] {
    const assigneeMatches = text.match(/assign[e]?[s]?[:\s]*([^\n]+)/im);
    if (assigneeMatches) {
      return assigneeMatches[1]
        .split(/[,;]/)
        .map(assignee => assignee.trim().replace(/[@"`']/g, ''))
        .filter(assignee => assignee.length > 0);
    }
    return [];
  }

  private extractActionValue(text: string, actionType: string): string | null {
    const match = text.match(new RegExp(`${actionType}[:\\s]*["']?(.*?)["']?$`, 'im'));
    return match ? match[1].trim() : null;
  }

  /**
   * Update usage metrics
   */
  private updateMetrics(startTime: number, usage: any): void {
    this.metrics.requestCount++;
    this.metrics.tokenUsage += usage.prompt_tokens || 0;
    this.metrics.tokenUsage += usage.completion_tokens || 0;
    this.metrics.responseTimeSum += Date.now() - startTime;
  }

  /**
   * Test connection to OpenAI API
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const messages = [{
        role: 'user' as const,
        content: 'Please respond with "Connection successful"'
      }];
      
      await this.callOpenAIAPI(messages, {
        name: 'test',
        description: 'Connection test',
        usage: '',
        examples: [],
        requiresArgs: false,
        prompt: 'Test connection',
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
      name: 'OpenAI',
      connected: true,
      model: this.config.model || 'gpt-4-0125-preview',
      
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