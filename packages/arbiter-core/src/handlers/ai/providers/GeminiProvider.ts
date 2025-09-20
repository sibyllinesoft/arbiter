import type {
  AICommand,
  AIContext,
  AIProvider,
  AIProviderStatus,
  AIResponse,
  GeminiConfig,
} from "../base/types.js";

/**
 * Google Gemini Provider for webhook processing
 *
 * Integrates with Google's Gemini AI to provide multimodal analysis
 * of GitHub/GitLab events with support for code, images, and documents.
 */
export class GeminiProvider implements AIProvider {
  private config: GeminiConfig;
  private metrics: {
    requestCount: number;
    tokenUsage: number;
    errorCount: number;
    responseTimeSum: number;
  };

  constructor(config: GeminiConfig) {
    this.config = config;
    this.metrics = {
      requestCount: 0,
      tokenUsage: 0,
      errorCount: 0,
      responseTimeSum: 0,
    };
  }

  getName(): string {
    return "gemini";
  }

  getConfig(): GeminiConfig {
    return this.config;
  }

  /**
   * Process an AI command with Gemini
   */
  async processCommand(command: AICommand, context: AIContext): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      // Build the prompt for Gemini
      const prompt = this.buildPrompt(command, context);

      // Call Gemini API
      const response = await this.callGeminiAPI(prompt, command);

      // Parse response and generate actions
      const parsedResponse = this.parseResponse(response, command, context);

      // Update metrics
      this.updateMetrics(startTime, response.usageMetadata || {});

      return parsedResponse;
    } catch (error) {
      this.metrics.errorCount++;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      return {
        success: false,
        error: `Gemini API error: ${errorMessage}`,
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      };
    }
  }

  /**
   * Build prompt for Gemini API
   */
  private buildPrompt(command: AICommand, context: AIContext): any {
    const parts = [];

    // Add system instructions as text
    parts.push({
      text: this.buildSystemInstructions(command),
    });

    // Add context and user instructions
    parts.push({
      text: this.buildContextualPrompt(command, context),
    });

    return {
      contents: [
        {
          role: "user",
          parts,
        },
      ],
      generationConfig: {
        maxOutputTokens: command.maxTokens || this.config.maxTokens || 4000,
        temperature: command.temperature || this.config.temperature || 0.7,
        topP: 0.8,
        topK: 40,
      },
      safetySettings: this.config.safetySettings || [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
      ],
    };
  }

  /**
   * Build system instructions for Gemini
   */
  private buildSystemInstructions(command: AICommand): string {
    const roleInstructions = {
      "review-code":
        "You are an expert software engineer specializing in code review. You have extensive experience in multiple programming languages, security analysis, performance optimization, and software architecture. Your role is to provide thorough, constructive feedback that helps developers improve their code quality.",

      "analyze-issue":
        "You are a senior technical project manager with deep software development experience. You excel at understanding technical requirements, categorizing issues, assessing complexity, and providing clear guidance on issue resolution.",

      "generate-docs":
        "You are a technical documentation specialist with expertise in creating clear, comprehensive, and developer-friendly documentation. You understand how to structure information for maximum clarity and usefulness.",

      "security-scan":
        "You are a cybersecurity expert with specialized knowledge in application security, vulnerability assessment, and secure coding practices. You stay current with the latest security threats and mitigation strategies.",

      "multimodal-analysis":
        "You are a technical analyst capable of processing multiple types of content including code, documentation, images, and other files. You can provide comprehensive analysis across different media types.",
    };

    const baseInstruction =
      roleInstructions[command.name as keyof typeof roleInstructions] ||
      "You are an AI assistant specialized in analyzing software development activities and providing actionable insights.";

    return `${baseInstruction}

Your analysis should be:
- Precise and actionable
- Based on current best practices
- Structured and easy to understand
- Focused on practical improvements
- Security-conscious when relevant

Always provide specific examples and clear recommendations when possible.`;
  }

  /**
   * Build contextual prompt with event data
   */
  private buildContextualPrompt(command: AICommand, context: AIContext): string {
    const sections = [
      `## Task: ${command.name}`,
      `${command.description}`,
      "",
      this.buildEventContextSection(context),
      "",
      "## Instructions",
      command.prompt,
      "",
      this.buildOutputInstructions(command),
    ];

    return sections.join("\n");
  }

  /**
   * Build event context section
   */
  private buildEventContextSection(context: AIContext): string {
    const { eventData, originalEvent } = context;

    const sections = ["## Repository Event Analysis"];

    // Basic event info
    sections.push("**Event Details:**");
    sections.push(`- Type: ${originalEvent.eventType}`);
    sections.push(`- Platform: ${originalEvent.provider}`);
    sections.push(`- Repository: ${eventData.repository?.fullName || "Unknown"}`);
    sections.push(`- User: ${eventData.user?.login || "Unknown"}`);
    sections.push(`- Timestamp: ${originalEvent.timestamp}`);
    sections.push("");

    // Event-specific context
    if (eventData.pullRequest) {
      const pr = eventData.pullRequest;
      sections.push(`**Pull Request #${pr.number}:**`);
      sections.push(`- Title: ${pr.title}`);
      sections.push(`- State: ${pr.state} ${pr.draft ? "(Draft)" : ""}`);
      sections.push(`- Source → Target: ${pr.sourceBranch} → ${pr.targetBranch}`);
      sections.push(`- Changes: ${pr.changedFiles} files (+${pr.additions}/-${pr.deletions})`);

      if (pr.labels && pr.labels.length > 0) {
        sections.push(`- Labels: ${pr.labels.join(", ")}`);
      }

      if (pr.body?.trim()) {
        sections.push("- Description:");
        sections.push("```");
        sections.push(
          pr.body.substring(0, 1000) + (pr.body.length > 1000 ? "\n... (truncated)" : ""),
        );
        sections.push("```");
      }
      sections.push("");
    }

    if (eventData.issue) {
      const issue = eventData.issue;
      sections.push(`**Issue #${issue.number}:**`);
      sections.push(`- Title: ${issue.title}`);
      sections.push(`- State: ${issue.state}`);
      sections.push(`- Labels: ${issue.labels.length > 0 ? issue.labels.join(", ") : "None"}`);
      sections.push(
        `- Assignees: ${issue.assignees.length > 0 ? issue.assignees.join(", ") : "None"}`,
      );

      if (issue.body?.trim()) {
        sections.push("- Description:");
        sections.push("```");
        sections.push(
          issue.body.substring(0, 1000) + (issue.body.length > 1000 ? "\n... (truncated)" : ""),
        );
        sections.push("```");
      }
      sections.push("");
    }

    if (eventData.push) {
      const push = eventData.push;
      sections.push(`**Push to ${push.branch}:**`);
      sections.push(`- Commits: ${push.commitCount}`);
      sections.push(`- Branch Type: ${push.isProtectedBranch ? "Protected" : "Feature"}`);

      if (push.commits && push.commits.length > 0) {
        sections.push("- Recent Commits:");
        push.commits.slice(0, 5).forEach((commit: any) => {
          const shortMsg = commit.message.split("\n")[0];
          sections.push(`  - ${commit.id.substring(0, 7)}: ${shortMsg}`);
        });
      }
      sections.push("");
    }

    if (eventData.comment) {
      const comment = eventData.comment;
      sections.push("**Comment:**");
      sections.push(`- Author: ${comment.author}`);
      sections.push("- Content:");
      sections.push("```");
      sections.push(comment.body);
      sections.push("```");
      sections.push("");
    }

    return sections.join("\n");
  }

  /**
   * Build output format instructions
   */
  private buildOutputInstructions(command: AICommand): string {
    const outputFormats = {
      "review-code": `## Expected Output Format

Provide your code review in this structure:

### 🔍 Overview
Brief summary and overall assessment rating (🟢 Excellent / 🟡 Good / 🟠 Needs Improvement / 🔴 Poor)

### 🏗️ Architecture & Design
Comments on code structure, patterns, and design decisions

### 🔒 Security Analysis
Security considerations, vulnerabilities, and recommendations

### ⚡ Performance Review
Performance implications and optimization suggestions

### 📚 Code Quality
Readability, maintainability, and best practices compliance

### ✅ Recommendations
Specific, actionable suggestions for improvement

### 🤖 Automated Actions
If you recommend automated actions (comments, labels, assignments), list them clearly`,

      "analyze-issue": `## Expected Output Format

Structure your issue analysis as follows:

### 📋 Classification
- **Type:** (bug/feature/enhancement/documentation/question/etc.)
- **Priority:** (critical/high/medium/low)  
- **Complexity:** (trivial/easy/medium/hard/complex)

### 🎯 Analysis
Detailed breakdown of the issue and requirements

### 🏷️ Suggested Labels
Recommend appropriate labels for categorization

### 👥 Assignment Recommendation
Suggest team members or roles who should handle this

### 📝 Next Steps
Clear action items to move this issue forward

### 🤖 Automated Actions
List any automated actions to perform`,

      "generate-docs": `## Expected Output Format

### 📖 Documentation Analysis
What type of documentation is needed and why

### ✍️ Generated Content
The actual documentation content, properly formatted

### 📁 Placement Recommendation
Where this documentation should be located

### 🔗 Integration Suggestions
How this fits with existing documentation

### 🤖 Automated Actions
Any automated actions to take`,
    };

    return (
      outputFormats[command.name as keyof typeof outputFormats] ||
      "## Expected Output Format\n\nProvide a structured analysis with clear sections, specific recommendations, and list any automated actions in a dedicated section."
    );
  }

  /**
   * Call Gemini API
   */
  private async callGeminiAPI(requestBody: any, command: AICommand): Promise<any> {
    const model = command.model || this.config.model || "gemini-1.5-pro";
    const url = `${this.config.baseUrl || "https://generativelanguage.googleapis.com"}/v1beta/models/${model}:generateContent?key=${this.config.apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Gemini API request failed: ${response.status} - ${errorData.error?.message || "Unknown error"}`,
      );
    }

    return await response.json();
  }

  /**
   * Parse Gemini response
   */
  private parseResponse(response: any, command: AICommand, context: AIContext): AIResponse {
    // Extract text from Gemini response structure
    const content = response.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!content) {
      throw new Error("No content in Gemini response");
    }

    // Extract actions if present
    const actions = this.extractActions(content, command, context);

    // Parse different response types
    const data: any = { analysis: content };

    // Enhanced parsing for different command types
    switch (command.name) {
      case "review-code":
        data.codeReview = this.parseCodeReview(content);
        break;
      case "analyze-issue":
        data.issueAnalysis = this.parseIssueAnalysis(content);
        break;
      case "generate-docs":
        data.documentation = this.parseDocumentation(content);
        break;
      case "security-scan":
        data.securityScan = this.parseSecurityScan(content);
        break;
    }

    return {
      success: true,
      message: "Analysis completed successfully with Gemini",
      data,
      actions,
      usage: {
        inputTokens: response.usageMetadata?.promptTokenCount || 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: response.usageMetadata?.totalTokenCount || 0,
      },
    };
  }

  /**
   * Extract automated actions from response
   */
  private extractActions(content: string, command: AICommand, context: AIContext): any[] {
    const actions = [];

    // Look for automated actions section
    const actionSectionMatch =
      content.match(/🤖\s*Automated Actions?\s*\n(.*?)(?=\n#|$)/is) ||
      content.match(/## Automated Actions?\s*\n(.*?)(?=\n#|$)/is) ||
      content.match(/### Automated Actions?\s*\n(.*?)(?=\n#|$)/is);

    if (actionSectionMatch) {
      const actionText = actionSectionMatch[1];

      // Parse comments
      if (
        actionText.toLowerCase().includes("comment") ||
        actionText.toLowerCase().includes("post")
      ) {
        const commentMatch = actionText.match(/(?:comment|post)[:\s]*([^\n]+)/i);
        if (commentMatch) {
          actions.push({
            type: "comment",
            data: {
              body: commentMatch[1].trim().replace(/^["']|["']$/g, "") || content,
            },
          });
        }
      }

      // Parse labels
      const labelMatches = actionText.match(/(?:label|tag)[s]?[:\s]*([^\n]+)/i);
      if (labelMatches) {
        const labels = labelMatches[1]
          .split(/[,;]/)
          .map((label) => label.trim().replace(/^["']|["']$/g, ""))
          .filter((label) => label.length > 0);

        if (labels.length > 0) {
          actions.push({
            type: "label",
            data: { labels },
          });
        }
      }

      // Parse assignments
      const assignMatches = actionText.match(/assign[e]?[s]?[:\s]*([^\n]+)/i);
      if (assignMatches) {
        const assignees = assignMatches[1]
          .split(/[,;]/)
          .map((assignee) => assignee.trim().replace(/[@"']/g, ""))
          .filter((assignee) => assignee.length > 0);

        if (assignees.length > 0) {
          actions.push({
            type: "assign",
            data: { assignees },
          });
        }
      }
    }

    return actions;
  }

  /**
   * Parse code review from Gemini response
   */
  private parseCodeReview(content: string): any {
    const extractSection = (sectionName: string): string => {
      const regex = new RegExp(
        `###?\\s*[🔍🏗️🔒⚡📚✅]?\\s*${sectionName}[\\s\\n]([^#]*?)(?=\\n###?|$)`,
        "is",
      );
      const match = content.match(regex);
      return match ? match[1].trim() : "";
    };

    const extractRating = (): string => {
      if (content.includes("🟢") || content.includes("Excellent")) return "excellent";
      if (content.includes("🔴") || content.includes("Poor")) return "poor";
      if (content.includes("🟠") || content.includes("Needs Improvement"))
        return "needs-improvement";
      return "good";
    };

    return {
      overallRating: extractRating(),
      summary: extractSection("Overview"),
      architecture: extractSection("Architecture|Design"),
      security: {
        riskLevel: content.toLowerCase().includes("high risk")
          ? "high"
          : content.toLowerCase().includes("medium risk")
            ? "medium"
            : "low",
        issues: this.extractBulletPoints(extractSection("Security")),
      },
      performance: {
        concerns: this.extractBulletPoints(extractSection("Performance")),
        suggestions: this.extractBulletPoints(extractSection("Recommendations")),
      },
      maintainability: {
        score: content.includes("excellent")
          ? 9
          : content.includes("good")
            ? 7
            : content.includes("poor")
              ? 3
              : 6,
        issues: this.extractBulletPoints(extractSection("Code Quality")),
      },
    };
  }

  /**
   * Parse issue analysis
   */
  private parseIssueAnalysis(content: string): any {
    const extractValue = (field: string): string => {
      const regex = new RegExp(`\\*\\*${field}:\\*\\*\\s*([^\\n*]+)`, "i");
      const match = content.match(regex);
      return match ? match[1].trim() : "";
    };

    return {
      category: extractValue("Type"),
      priority: extractValue("Priority"),
      complexity: extractValue("Complexity"),
      analysis: this.extractSection(content, "Analysis"),
      nextSteps: this.extractSection(content, "Next Steps"),
      suggestedLabels: this.extractBulletPoints(this.extractSection(content, "Suggested Labels")),
    };
  }

  /**
   * Parse documentation
   */
  private parseDocumentation(content: string): string {
    const docSection = this.extractSection(content, "Generated Content|Documentation Content");
    return docSection || content;
  }

  /**
   * Parse security scan
   */
  private parseSecurityScan(content: string): any {
    return {
      riskLevel: content.toLowerCase().includes("high")
        ? "high"
        : content.toLowerCase().includes("medium")
          ? "medium"
          : "low",
      vulnerabilities: this.extractBulletPoints(
        this.extractSection(content, "Vulnerabilities|Security Issues"),
      ),
      recommendations: this.extractBulletPoints(this.extractSection(content, "Recommendations")),
    };
  }

  /**
   * Helper methods
   */
  private extractSection(content: string, sectionNames: string): string {
    const patterns = sectionNames.split("|");
    for (const pattern of patterns) {
      const regex = new RegExp(
        `###?\\s*[🔍🏗️🔒⚡📚✅📋🎯🏷️👥📝📖✍️📁🔗]?\\s*${pattern}[\\s\\n]([^#]*?)(?=\\n###?|$)`,
        "is",
      );
      const match = content.match(regex);
      if (match) return match[1].trim();
    }
    return "";
  }

  private extractBulletPoints(text: string): string[] {
    if (!text) return [];

    return text
      .split("\n")
      .map((line) => line.replace(/^[-*•]\s*/, "").trim())
      .filter((line) => line.length > 0);
  }

  /**
   * Update usage metrics
   */
  private updateMetrics(startTime: number, usage: any): void {
    this.metrics.requestCount++;
    this.metrics.tokenUsage += usage.promptTokenCount || 0;
    this.metrics.tokenUsage += usage.candidatesTokenCount || 0;
    this.metrics.responseTimeSum += Date.now() - startTime;
  }

  /**
   * Test connection to Gemini API
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const testPrompt = {
        contents: [
          {
            role: "user",
            parts: [{ text: 'Please respond with "Connection successful"' }],
          },
        ],
        generationConfig: {
          maxOutputTokens: 100,
          temperature: 0.1,
        },
      };

      await this.callGeminiAPI(testPrompt, {
        name: "test",
        description: "Connection test",
        usage: "",
        examples: [],
        requiresArgs: false,
        prompt: "Test connection",
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get provider status and metrics
   */
  async getStatus(): Promise<AIProviderStatus> {
    const avgResponseTime =
      this.metrics.requestCount > 0 ? this.metrics.responseTimeSum / this.metrics.requestCount : 0;

    const successRate =
      this.metrics.requestCount > 0
        ? (this.metrics.requestCount - this.metrics.errorCount) / this.metrics.requestCount
        : 1;

    return {
      name: "Gemini",
      connected: true,
      model: this.config.model || "gemini-1.5-pro",

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
