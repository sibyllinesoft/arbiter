/**
 * Type definitions for AI Agent Handler system
 */

/**
 * Configuration for an AI Agent
 */
export interface AIAgentConfig {
  id: string;
  type: string;
  name: string;
  description: string;
  enabled: boolean;
  version: string;

  // AI Provider settings
  provider: {
    type: 'claude' | 'openai' | 'gemini';
    config: AIProviderConfig;
  };

  // Command settings
  commands: {
    enabled: string[];
    disabled: string[];
    customPrompts?: Record<string, string>;
  };

  // Event filtering
  eventFilters?: string[]; // Array of "provider.eventType" strings
  
  // Rate limiting
  rateLimits?: {
    enabled: boolean;
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
  };

  // Security settings
  security?: {
    requireUserMention: boolean; // Only respond when @mentioned
    allowedUsers?: string[];     // Restrict to specific users
    allowedRepos?: string[];     // Restrict to specific repositories
  };

  // Behavior settings
  behavior?: {
    autoResponse: boolean;       // Respond automatically without commands
    verboseLogging: boolean;     // Enable detailed logging
    dryRun: boolean;            // Don't perform actions, just analyze
  };
}

/**
 * Base configuration for AI providers
 */
export interface AIProviderConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

/**
 * Claude-specific configuration
 */
export interface ClaudeConfig extends AIProviderConfig {
  model: 'claude-3-5-sonnet-20241022' | 'claude-3-haiku-20240307' | 'claude-3-opus-20240229';
  systemPrompt?: string;
}

/**
 * OpenAI-specific configuration
 */
export interface OpenAIConfig extends AIProviderConfig {
  model: 'gpt-4-0125-preview' | 'gpt-4-turbo' | 'gpt-3.5-turbo' | 'gpt-4o';
  organizationId?: string;
}

/**
 * Gemini-specific configuration
 */
export interface GeminiConfig extends AIProviderConfig {
  model: 'gemini-1.5-pro' | 'gemini-1.5-flash' | 'gemini-1.0-pro';
  safetySettings?: Array<{
    category: string;
    threshold: string;
  }>;
}

/**
 * AI Command definition
 */
export interface AICommand {
  name: string;
  description: string;
  usage: string;
  examples: string[];
  
  // Command behavior
  requiresArgs: boolean;
  minArgs?: number;
  maxArgs?: number;
  
  // AI processing settings
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  
  // Command permissions
  permissions?: {
    requiredRole?: 'admin' | 'maintainer' | 'contributor';
    allowedUsers?: string[];
    allowedRepos?: string[];
  };

  // Post-processing actions
  actions?: {
    postComment?: boolean;
    createIssue?: boolean;
    updatePR?: boolean;
    assignUsers?: boolean;
    addLabels?: boolean;
  };
}

/**
 * AI Provider interface
 */
export interface AIProvider {
  getName(): string;
  getConfig(): AIProviderConfig;
  
  /**
   * Process an AI command with context
   */
  processCommand(command: AICommand, context: AIContext): Promise<AIResponse>;
  
  /**
   * Test the provider connection and configuration
   */
  testConnection(): Promise<{ success: boolean; error?: string }>;
  
  /**
   * Get provider status and usage metrics
   */
  getStatus(): Promise<AIProviderStatus>;
}

/**
 * Context passed to AI providers for processing
 */
export interface AIContext {
  command: string;
  args: string[];
  eventData: any;
  originalEvent: any;
  config: AIAgentConfig;
  
  // Additional context
  repository?: {
    name: string;
    fullName: string;
    url: string;
    defaultBranch: string;
  };
  
  user?: {
    login: string;
    name?: string;
    email?: string;
  };
  
  metadata?: Record<string, any>;
}

/**
 * Response from AI provider
 */
export interface AIResponse {
  success: boolean;
  message?: string;
  error?: string;
  
  // AI-generated content
  data?: {
    analysis?: string;
    recommendations?: string[];
    codeReview?: CodeReviewResult;
    documentation?: string;
    summary?: string;
  };
  
  // Actions to execute
  actions?: AIAction[];
  
  // Usage metrics
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost?: number;
  };
}

/**
 * AI-generated action to execute
 */
export interface AIAction {
  type: 'comment' | 'issue' | 'label' | 'assign' | 'merge' | 'close' | 'webhook';
  
  // Action-specific data
  data: {
    body?: string;           // For comments/issues
    title?: string;          // For issues
    labels?: string[];       // For labeling
    assignees?: string[];    // For assignments
    webhookUrl?: string;     // For webhook calls
    [key: string]: any;
  };
  
  // Action conditions
  conditions?: {
    requiresApproval?: boolean;
    onlyIfChecksPass?: boolean;
    onlyIfNoConflicts?: boolean;
  };
}

/**
 * Code review result structure
 */
export interface CodeReviewResult {
  overallRating: 'excellent' | 'good' | 'needs-improvement' | 'poor';
  summary: string;
  
  files: Array<{
    path: string;
    rating: 'excellent' | 'good' | 'needs-improvement' | 'poor';
    issues: Array<{
      line?: number;
      type: 'error' | 'warning' | 'suggestion' | 'style';
      message: string;
      suggestion?: string;
    }>;
  }>;
  
  security: {
    riskLevel: 'low' | 'medium' | 'high';
    issues: string[];
  };
  
  performance: {
    concerns: string[];
    suggestions: string[];
  };
  
  maintainability: {
    score: number; // 1-10
    issues: string[];
  };
}

/**
 * AI Provider status
 */
export interface AIProviderStatus {
  name: string;
  connected: boolean;
  model: string;
  
  usage: {
    requestsToday: number;
    tokensToday: number;
    costToday?: number;
    rateLimitRemaining?: number;
  };
  
  performance: {
    averageResponseTime: number;
    successRate: number;
    errorRate: number;
  };
}

/**
 * Webhook event data extracted by adapters
 */
export interface WebhookEventData {
  success: boolean;
  error?: string;
  
  data: {
    // Common fields
    repository: {
      name: string;
      fullName: string;
      url: string;
      defaultBranch: string;
    };
    
    user: {
      login: string;
      name?: string;
      email?: string;
      avatarUrl?: string;
    };
    
    // Event-specific data
    pullRequest?: {
      number: number;
      title: string;
      body: string;
      state: 'open' | 'closed' | 'merged';
      draft: boolean;
      sourceBranch: string;
      targetBranch: string;
      url: string;
      commits: number;
      additions: number;
      deletions: number;
      changedFiles: number;
    };
    
    issue?: {
      number: number;
      title: string;
      body: string;
      state: 'open' | 'closed';
      labels: string[];
      assignees: string[];
      url: string;
    };
    
    push?: {
      branch: string;
      commits: Array<{
        id: string;
        message: string;
        author: string;
        url: string;
      }>;
      before: string;
      after: string;
    };
    
    comment?: {
      id: number;
      body: string;
      author: string;
      url: string;
      created: string;
    };
    
    // Raw event data for advanced processing
    raw?: any;
  };
}