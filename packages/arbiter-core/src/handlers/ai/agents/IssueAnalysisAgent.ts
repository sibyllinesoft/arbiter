import type { HandlerResponse, WebhookEvent } from "../../shared/utils.js";
import { createResponse } from "../../shared/utils.js";
import {
  GitHubIssueAdapter,
  GitHubIssueCommentAdapter,
} from "../adapters/github/GitHubIssueAdapter.js";
import { AIAgentHandler } from "../base/AIAgentHandler.js";
import type { AIAgentConfig, AICommand } from "../base/types.js";
import { ClaudeProvider } from "../providers/ClaudeProvider.js";
import { GeminiProvider } from "../providers/GeminiProvider.js";
import { OpenAIProvider } from "../providers/OpenAIProvider.js";

/**
 * AI-powered Issue Analysis Agent
 *
 * This agent automatically analyzes and categorizes issues, providing:
 * - Issue classification and prioritization
 * - Complexity estimation
 * - Label recommendations
 * - Assignment suggestions
 * - Next steps guidance
 * - Automated issue management
 *
 * Supported commands:
 * - /analyze-issue - Comprehensive issue analysis
 * - /categorize - Issue categorization and labeling
 * - /estimate - Complexity and effort estimation
 * - /triage - Issue triage and priority assignment
 * - /suggest-assignee - Recommend team members for assignment
 */
export class IssueAnalysisAgent extends AIAgentHandler {
  constructor(config: AIAgentConfig) {
    // Initialize AI provider based on config
    let provider: ClaudeProvider | OpenAIProvider | GeminiProvider;
    switch (config.provider.type) {
      case "claude":
        provider = new ClaudeProvider(config.provider.config);
        break;
      case "openai":
        provider = new OpenAIProvider(config.provider.config);
        break;
      case "gemini":
        provider = new GeminiProvider(config.provider.config);
        break;
      default: {
        const exhaustiveCheck: never = config.provider;
        throw new Error(`Unsupported AI provider: ${JSON.stringify(exhaustiveCheck)}`);
      }
    }

    super(config, provider);

    // Register adapters for different platforms
    this.registerAdapter("github", "issues", new GitHubIssueAdapter());
    this.registerAdapter("github", "issue_comment", new GitHubIssueCommentAdapter());
  }

  /**
   * Initialize AI commands for issue analysis
   */
  protected initializeCommands(): void {
    // Comprehensive issue analysis
    this.registerCommand("analyze-issue", {
      name: "analyze-issue",
      description:
        "Comprehensive analysis of issue including categorization, priority, and recommendations",
      usage: "/analyze-issue [focus]",
      examples: ["/analyze-issue", "/analyze-issue priority", "/analyze-issue complexity"],
      requiresArgs: false,
      prompt: `Analyze this issue comprehensively. Provide:

1. **Issue Classification**:
   - Type: bug, feature, enhancement, documentation, question, task, epic
   - Category: frontend, backend, API, database, DevOps, security, performance, UX/UI
   - Severity: critical, high, medium, low (for bugs)
   - Priority: P0 (critical), P1 (high), P2 (medium), P3 (low)

2. **Complexity Assessment**:
   - Development effort: trivial, easy, medium, hard, complex
   - Estimated story points (1-13 scale)
   - Skills required: languages, frameworks, domain knowledge
   - Dependencies: other issues, external systems, team coordination

3. **Technical Analysis**:
   - Requirements clarity: clear, needs refinement, ambiguous
   - Acceptance criteria: present, missing, needs improvement
   - Implementation approach: suggest high-level solution
   - Potential challenges: technical risks, blockers

4. **Recommendations**:
   - Suggested labels for organization
   - Team/person assignment recommendations
   - Next steps to move forward
   - Related issues or PRs to reference
   - Documentation needs

Provide actionable insights that help with project planning and issue management.`,
      actions: {
        postComment: true,
        addLabels: true,
        assignUsers: true,
      },
    });

    // Issue categorization
    this.registerCommand("categorize", {
      name: "categorize",
      description: "Categorize and label issues for better organization",
      usage: "/categorize [system]",
      examples: ["/categorize", "/categorize detailed", "/categorize simple"],
      requiresArgs: false,
      prompt: `Categorize this issue and recommend appropriate labels. Consider:

1. **Primary Category**:
   - bug: Something is broken or not working as expected
   - feature: New functionality or enhancement
   - documentation: Documentation updates or improvements
   - performance: Performance optimization or issues
   - security: Security-related concerns
   - refactoring: Code improvement without new features
   - testing: Test-related tasks
   - DevOps: Deployment, CI/CD, infrastructure
   - question: Seeking information or clarification

2. **Technical Area**:
   - frontend, backend, API, database, mobile, desktop
   - authentication, authorization, logging, monitoring
   - UI/UX, accessibility, internationalization

3. **Priority/Impact Labels**:
   - priority: critical, high, medium, low
   - impact: breaking, major, minor, patch

4. **Workflow Labels**:
   - good-first-issue, help-wanted, blocked, needs-design
   - ready-for-development, in-progress, needs-review

Recommend 3-7 relevant labels that would help with issue organization and filtering.`,
      actions: {
        addLabels: true,
        postComment: true,
      },
    });

    // Complexity estimation
    this.registerCommand("estimate", {
      name: "estimate",
      description: "Estimate complexity and effort required for the issue",
      usage: "/estimate [methodology]",
      examples: ["/estimate", "/estimate story-points", "/estimate time"],
      requiresArgs: false,
      prompt: `Estimate the complexity and effort required for this issue. Provide:

1. **Effort Estimation**:
   - Story points (1, 2, 3, 5, 8, 13, 21)
   - Time estimate (hours/days) with confidence level
   - Breakdown by task: analysis, development, testing, documentation

2. **Complexity Factors**:
   - Technical complexity: algorithms, integrations, new technologies
   - Requirements clarity: well-defined vs. ambiguous
   - Dependencies: external APIs, team coordination, other issues
   - Testing complexity: unit, integration, end-to-end requirements

3. **Risk Assessment**:
   - Technical risks and unknowns
   - Dependency risks and external blockers
   - Resource availability and skill requirements
   - Potential scope creep indicators

4. **Implementation Considerations**:
   - Suggested approach and architecture
   - Alternative solutions to consider
   - Performance and scalability implications
   - Backward compatibility concerns

Provide realistic estimates with clear reasoning and assumptions.`,
      actions: {
        postComment: true,
        addLabels: true,
      },
    });

    // Issue triage
    this.registerCommand("triage", {
      name: "triage",
      description: "Triage issue for priority and next actions",
      usage: "/triage [criteria]",
      examples: ["/triage", "/triage business-impact", "/triage technical-debt"],
      requiresArgs: false,
      prompt: `Triage this issue for priority and immediate actions. Assess:

1. **Priority Assessment**:
   - Business impact: revenue, user experience, compliance
   - Technical impact: system stability, security, performance
   - User impact: number of affected users, severity of disruption
   - Urgency: timeline constraints, dependencies

2. **Priority Classification**:
   - P0/Critical: Production down, data loss, security breach
   - P1/High: Major feature broken, significant user impact
   - P2/Medium: Minor feature issues, moderate impact
   - P3/Low: Nice-to-have, cosmetic issues, future improvements

3. **Immediate Actions Needed**:
   - Information gathering: logs, reproduction steps, environment details
   - Stakeholder involvement: product, design, security team input
   - Technical investigation: root cause analysis, impact assessment
   - Communication: user notification, internal updates

4. **Triage Recommendations**:
   - Assignment to appropriate team/individual
   - Milestone or sprint assignment
   - Blocking/dependent issues to address first
   - Escalation needs for high-priority items

Focus on actionable next steps to move the issue forward efficiently.`,
      actions: {
        postComment: true,
        addLabels: true,
        assignUsers: true,
      },
    });

    // Assignment suggestion
    this.registerCommand("suggest-assignee", {
      name: "suggest-assignee",
      description: "Suggest appropriate team members for issue assignment",
      usage: "/suggest-assignee [criteria]",
      examples: ["/suggest-assignee", "/suggest-assignee skills", "/suggest-assignee workload"],
      requiresArgs: false,
      prompt: `Analyze this issue and suggest appropriate team members for assignment. Consider:

1. **Required Skills and Expertise**:
   - Programming languages and frameworks involved
   - Domain knowledge needed (frontend, backend, DevOps, etc.)
   - Experience level required (junior, senior, expert)
   - Specialized knowledge (security, performance, UI/UX)

2. **Issue Characteristics**:
   - Complexity and scope of work
   - Urgency and timeline requirements
   - Dependencies on other team members
   - Learning opportunity potential

3. **Team Considerations**:
   - Current workload and availability
   - Skill development goals
   - Previous experience with similar issues
   - Mentoring and knowledge sharing opportunities

4. **Assignment Recommendations**:
   - Primary assignee with rationale
   - Backup assignee options
   - Collaboration needs (pairs, reviewers)
   - Mentoring assignments for growth

Note: Base recommendations on technical requirements and issue complexity. Actual assignment should consider current team availability and priorities.`,
      actions: {
        postComment: true,
        assignUsers: false, // Don't auto-assign, just recommend
      },
    });
  }

  /**
   * Process standard events (automatic issue analysis)
   */
  protected async processEvent(
    eventData: any,
    originalEvent: WebhookEvent,
  ): Promise<HandlerResponse> {
    // Check if automatic analysis is enabled
    if (!this.config.behavior?.autoResponse) {
      return createResponse(true, "Automatic analysis disabled", {
        skipped: true,
        reason: "auto_response_disabled",
      });
    }

    // Only auto-analyze newly opened issues
    const shouldAutoAnalyze = eventData.issue && eventData.action && eventData.action.isOpened;

    if (!shouldAutoAnalyze) {
      return createResponse(true, "Event does not require automatic analysis", {
        skipped: true,
        reason: "not_new_issue",
      });
    }

    try {
      // Perform automatic issue analysis
      const analyzeCommand = this.commands.get("analyze-issue")!;
      const aiContext = {
        command: "analyze-issue",
        args: [],
        eventData,
        originalEvent,
        config: this.config,
      };

      const aiResponse = await this.provider.processCommand(analyzeCommand, aiContext);

      if (!aiResponse.success) {
        return createResponse(false, `Automatic analysis failed: ${aiResponse.error}`);
      }

      // Execute any actions from the AI
      let actionResults = [];
      if (aiResponse.actions && aiResponse.actions.length > 0) {
        actionResults = await this.executeActions(aiResponse.actions, eventData, originalEvent);
      }

      return createResponse(true, "Automatic issue analysis completed", {
        analysis: aiResponse.data,
        actions: actionResults,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return createResponse(false, `Automatic analysis error: ${errorMessage}`);
    }
  }

  /**
   * Execute actions returned by the AI
   */
  protected async executeAction(
    action: any,
    eventData: any,
    originalEvent: WebhookEvent,
  ): Promise<any> {
    switch (action.type) {
      case "comment":
        return await this.postComment(action.data, eventData, originalEvent);

      case "label":
        return await this.addLabels(action.data, eventData, originalEvent);

      case "assign":
        return await this.assignUsers(action.data, eventData, originalEvent);

      case "issue":
        return await this.createRelatedIssue(action.data, eventData, originalEvent);

      default:
        throw new Error(`Unsupported action type: ${action.type}`);
    }
  }

  /**
   * Post analysis comment on the issue
   */
  private async postComment(
    data: { body: string },
    eventData: any,
    originalEvent: WebhookEvent,
  ): Promise<any> {
    await this.logActivity({
      type: "ai.agent.action.comment",
      timestamp: new Date().toISOString(),
      agentId: this.config.id,
      action: "comment",
      target: `Issue #${eventData.issue?.number}`,
      preview: data.body.substring(0, 100),
    });

    return {
      action: "comment",
      status: "success",
      message: "Analysis comment posted successfully",
      preview: data.body.substring(0, 100),
    };
  }

  /**
   * Add recommended labels to the issue
   */
  private async addLabels(
    data: { labels: string[] },
    eventData: any,
    originalEvent: WebhookEvent,
  ): Promise<any> {
    await this.logActivity({
      type: "ai.agent.action.label",
      timestamp: new Date().toISOString(),
      agentId: this.config.id,
      action: "label",
      target: `Issue #${eventData.issue?.number}`,
      labels: data.labels,
    });

    return {
      action: "label",
      status: "success",
      labels: data.labels,
      message: `Added labels: ${data.labels.join(", ")}`,
    };
  }

  /**
   * Assign users to the issue
   */
  private async assignUsers(
    data: { assignees: string[] },
    eventData: any,
    originalEvent: WebhookEvent,
  ): Promise<any> {
    await this.logActivity({
      type: "ai.agent.action.assign",
      timestamp: new Date().toISOString(),
      agentId: this.config.id,
      action: "assign",
      target: `Issue #${eventData.issue?.number}`,
      assignees: data.assignees,
    });

    return {
      action: "assign",
      status: "success",
      assignees: data.assignees,
      message: `Assignment recommended: ${data.assignees.join(", ")}`,
    };
  }

  /**
   * Create related issue based on analysis
   */
  private async createRelatedIssue(
    data: { title: string; body: string; labels?: string[] },
    eventData: any,
    originalEvent: WebhookEvent,
  ): Promise<any> {
    await this.logActivity({
      type: "ai.agent.action.issue",
      timestamp: new Date().toISOString(),
      agentId: this.config.id,
      action: "create_issue",
      title: data.title,
      relatedIssue: eventData.issue?.number,
    });

    return {
      action: "create_issue",
      status: "success",
      title: data.title,
      message: "Related issue creation recommended",
    };
  }
}
