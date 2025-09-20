#!/usr/bin/env node

/**
 * Custom Agent Example
 * 
 * This example demonstrates how to create a custom AI agent that extends
 * the base AIAgentHandler class. This agent specializes in performance
 * analysis and optimization recommendations.
 */

import { AIAgentHandler } from '../base/AIAgentHandler.js';
import { ClaudeProvider } from '../providers/ClaudeProvider.js';
import { GitHubPRAdapter } from '../adapters/github/GitHubPRAdapter.js';
import { createResponse } from '../../shared/utils.js';

/**
 * Custom Performance Analysis Agent
 * 
 * This agent focuses specifically on performance-related analysis:
 * - Database query optimization
 * - Memory usage analysis  
 * - CPU bottleneck identification
 * - Caching opportunity detection
 * - Load testing recommendations
 */
class PerformanceAnalysisAgent extends AIAgentHandler {
  constructor(config) {
    // Initialize with Claude provider (optimized for performance analysis)
    const provider = new ClaudeProvider({
      ...config.provider.config,
      systemPrompt: `You are a senior performance engineer with expertise in:
        - Database optimization and query performance
        - Memory management and garbage collection
        - CPU profiling and bottleneck identification
        - Caching strategies and CDN optimization
        - Load balancing and scalability patterns
        
        Focus on providing specific, measurable recommendations with clear implementation steps.`
    });

    super(config, provider);
    
    // Register adapters for GitHub events
    this.registerAdapter('github', 'pull_request', new GitHubPRAdapter());
  }

  /**
   * Initialize performance-specific AI commands
   */
  protected initializeCommands() {
    // Database performance analysis
    this.registerCommand('analyze-db-performance', {
      name: 'analyze-db-performance',
      description: 'Analyze database queries and suggest optimizations',
      usage: '/analyze-db-performance [database-type]',
      examples: [
        '/analyze-db-performance',
        '/analyze-db-performance postgresql',
        '/analyze-db-performance mongodb'
      ],
      requiresArgs: false,
      prompt: `Analyze the database-related code changes for performance issues:

1. **Query Analysis:**
   - Identify potentially slow queries (N+1 problems, missing indexes, full table scans)
   - Check for proper use of database indexes
   - Look for opportunities to use query optimization techniques
   - Analyze JOIN operations and suggest improvements

2. **Connection Management:**
   - Review database connection pooling configuration
   - Check for connection leaks or excessive connections
   - Suggest optimal connection pool sizes

3. **Data Access Patterns:**
   - Identify inefficient data fetching patterns
   - Suggest batch operations where appropriate
   - Look for caching opportunities

4. **Database Schema:**
   - Review any schema changes for performance implications
   - Suggest normalization/denormalization improvements
   - Identify missing or redundant indexes

Provide specific recommendations with:
- Query rewrites or optimizations
- Index creation suggestions
- Configuration improvements
- Performance benchmarking approaches`,
      actions: {
        postComment: true,
        addLabels: true,
      },
    });

    // Memory analysis
    this.registerCommand('analyze-memory-usage', {
      name: 'analyze-memory-usage',
      description: 'Analyze memory usage patterns and identify leaks',
      usage: '/analyze-memory-usage [language]',
      examples: [
        '/analyze-memory-usage',
        '/analyze-memory-usage javascript',
        '/analyze-memory-usage python',
        '/analyze-memory-usage java'
      ],
      requiresArgs: false,
      prompt: `Analyze the code changes for memory usage and potential memory leaks:

1. **Memory Allocation Patterns:**
   - Identify excessive object creation or large data structures
   - Look for inefficient string operations or concatenation
   - Check for proper resource cleanup (file handles, database connections)

2. **Memory Leaks:**
   - Identify potential memory leaks (event listeners, timers, closures)
   - Check for circular references that prevent garbage collection
   - Look for growing caches without cleanup mechanisms

3. **Optimization Opportunities:**
   - Suggest object pooling or reuse strategies
   - Identify opportunities for lazy loading
   - Recommend memory-efficient data structures

4. **Language-Specific Issues:**
   - JavaScript: Check for DOM leaks, closure issues, WeakMap usage
   - Python: Look for reference cycles, generator usage
   - Java: Check for unnecessary object retention, proper collection usage

Provide specific recommendations with code examples and profiling suggestions.`,
      actions: {
        postComment: true,
        addLabels: true,
      },
    });

    // CPU bottleneck analysis
    this.registerCommand('analyze-cpu-bottlenecks', {
      name: 'analyze-cpu-bottlenecks',
      description: 'Identify CPU-intensive operations and bottlenecks',
      usage: '/analyze-cpu-bottlenecks [focus-area]',
      examples: [
        '/analyze-cpu-bottlenecks',
        '/analyze-cpu-bottlenecks algorithms',
        '/analyze-cpu-bottlenecks io-operations'
      ],
      requiresArgs: false,
      prompt: `Analyze the code changes for CPU performance issues and bottlenecks:

1. **Algorithm Analysis:**
   - Review time complexity of algorithms (O(n), O(n²), etc.)
   - Identify inefficient loops or recursive operations
   - Suggest more efficient algorithms or data structures

2. **I/O Operations:**
   - Check for synchronous I/O operations that block execution
   - Identify opportunities for async/await patterns
   - Look for unnecessary file system operations

3. **Computational Efficiency:**
   - Find expensive operations inside loops
   - Identify redundant calculations that can be cached
   - Look for opportunities to parallelize operations

4. **Framework-Specific Issues:**
   - Check for inefficient ORM usage
   - Identify heavy serialization/deserialization operations
   - Look for excessive middleware or filter chains

Provide specific optimization recommendations with:
- Algorithm improvements
- Caching strategies
- Async operation patterns
- Profiling and benchmarking approaches`,
      actions: {
        postComment: true,
        addLabels: true,
      },
    });

    // Caching analysis
    this.registerCommand('analyze-caching-opportunities', {
      name: 'analyze-caching-opportunities',
      description: 'Identify caching opportunities and strategies',
      usage: '/analyze-caching-opportunities [layer]',
      examples: [
        '/analyze-caching-opportunities',
        '/analyze-caching-opportunities database',
        '/analyze-caching-opportunities api',
        '/analyze-caching-opportunities frontend'
      ],
      requiresArgs: false,
      prompt: `Analyze the code for caching opportunities and strategies:

1. **Data Caching:**
   - Identify frequently accessed data that could be cached
   - Suggest appropriate cache storage (Redis, in-memory, CDN)
   - Recommend cache invalidation strategies

2. **Computation Caching:**
   - Find expensive calculations that could be memoized
   - Identify results that can be pre-computed
   - Suggest caching layers for API responses

3. **Resource Caching:**
   - Look for static assets that need better caching headers
   - Identify opportunities for CDN usage
   - Suggest browser caching strategies

4. **Cache Architecture:**
   - Recommend multi-level caching strategies
   - Suggest cache warming approaches
   - Identify cache stampede prevention needs

Provide specific implementation recommendations with:
- Cache key design patterns
- TTL (Time To Live) suggestions
- Cache invalidation strategies
- Performance impact estimates`,
      actions: {
        postComment: true,
        addLabels: true,
      },
    });

    // Load testing recommendations
    this.registerCommand('recommend-load-testing', {
      name: 'recommend-load-testing',
      description: 'Suggest load testing strategies for performance changes',
      usage: '/recommend-load-testing [scenario]',
      examples: [
        '/recommend-load-testing',
        '/recommend-load-testing api-endpoints',
        '/recommend-load-testing database-changes'
      ],
      requiresArgs: false,
      prompt: `Based on the code changes, recommend load testing strategies:

1. **Test Scenarios:**
   - Identify critical user journeys to test
   - Suggest realistic load patterns (ramp-up, steady-state, peak)
   - Recommend stress testing scenarios

2. **Performance Metrics:**
   - Define key performance indicators (KPIs) to monitor
   - Set acceptable response time thresholds
   - Establish error rate limits

3. **Test Environment:**
   - Recommend test environment specifications
   - Suggest data volume requirements
   - Identify external dependencies to mock

4. **Testing Tools and Scripts:**
   - Suggest appropriate load testing tools (JMeter, Artillery, k6)
   - Provide example test scripts
   - Recommend monitoring and alerting setup

Provide actionable load testing recommendations with:
- Specific test scenarios and scripts
- Performance baseline expectations
- Monitoring and alerting configuration
- Continuous performance testing integration`,
      actions: {
        postComment: true,
        createIssue: true,
      },
    });
  }

  /**
   * Process events automatically (performance analysis on significant changes)
   */
  protected async processEvent(eventData, originalEvent) {
    // Only auto-analyze if enabled and changes are significant
    if (!this.config.behavior?.autoResponse) {
      return createResponse(true, 'Automatic performance analysis disabled', {
        skipped: true,
        reason: 'auto_response_disabled'
      });
    }

    // Analyze PRs with performance-related changes
    if (eventData.pullRequest && this.hasPerformanceRelevantChanges(eventData)) {
      try {
        const analysisCommand = this.commands.get('analyze-db-performance');
        const aiContext = {
          command: 'analyze-db-performance',
          args: [],
          eventData,
          originalEvent,
          config: this.config,
        };

        const aiResponse = await this.provider.processCommand(analysisCommand, aiContext);
        
        if (aiResponse.success) {
          const actionResults = await this.executeActions(
            aiResponse.actions || [], 
            eventData, 
            originalEvent
          );

          return createResponse(true, 'Automatic performance analysis completed', {
            analysis: aiResponse.data,
            actions: actionResults,
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return createResponse(false, `Performance analysis error: ${errorMessage}`);
      }
    }

    return createResponse(true, 'No performance analysis needed', {
      skipped: true,
      reason: 'no_performance_changes'
    });
  }

  /**
   * Check if changes are performance-relevant
   */
  private hasPerformanceRelevantChanges(eventData) {
    const performanceKeywords = [
      'database', 'query', 'sql', 'index', 'cache', 'redis',
      'memory', 'cpu', 'performance', 'optimization', 'slow',
      'bottleneck', 'scalability', 'load', 'concurrent',
      'async', 'await', 'promise', 'thread', 'process'
    ];

    const searchText = (
      eventData.pullRequest?.title + ' ' +
      eventData.pullRequest?.body
    ).toLowerCase();

    return performanceKeywords.some(keyword => searchText.includes(keyword));
  }

  /**
   * Execute performance-specific actions
   */
  protected async executeAction(action, eventData, originalEvent) {
    switch (action.type) {
      case 'comment':
        return await this.postPerformanceComment(action.data, eventData);
      
      case 'label':
        return await this.addPerformanceLabels(action.data, eventData);
      
      case 'issue':
        return await this.createPerformanceIssue(action.data, eventData);
      
      default:
        throw new Error(`Unsupported action type: ${action.type}`);
    }
  }

  private async postPerformanceComment(data, eventData) {
    await this.logActivity({
      type: 'ai.agent.action.comment',
      timestamp: new Date().toISOString(),
      agentId: this.config.id,
      action: 'performance_comment',
      target: `PR #${eventData.pullRequest?.number}`,
      preview: data.body.substring(0, 100),
    });

    return {
      action: 'comment',
      status: 'success',
      type: 'performance_analysis',
      message: 'Performance analysis comment posted',
      preview: data.body.substring(0, 100),
    };
  }

  private async addPerformanceLabels(data, eventData) {
    const performanceLabels = data.labels.map(label => 
      label.startsWith('performance') ? label : `performance:${label}`
    );

    await this.logActivity({
      type: 'ai.agent.action.label',
      timestamp: new Date().toISOString(),
      agentId: this.config.id,
      action: 'performance_label',
      labels: performanceLabels,
    });

    return {
      action: 'label',
      status: 'success',
      type: 'performance_labels',
      labels: performanceLabels,
      message: `Added performance labels: ${performanceLabels.join(', ')}`,
    };
  }

  private async createPerformanceIssue(data, eventData) {
    await this.logActivity({
      type: 'ai.agent.action.issue',
      timestamp: new Date().toISOString(),
      agentId: this.config.id,
      action: 'performance_issue',
      title: data.title,
      labels: ['performance', ...(data.labels || [])],
    });

    return {
      action: 'create_issue',
      status: 'success',
      type: 'performance_issue',
      title: data.title,
      message: 'Performance issue created successfully',
    };
  }
}

// Example usage and configuration
async function demonstrateCustomAgent() {
  console.log('🚀 Custom Performance Analysis Agent Demo\n');

  // Example configuration for the custom agent
  const customAgentConfig = {
    id: 'performance-analysis-agent',
    type: 'performance-analysis',
    name: 'Performance Analysis Agent',
    description: 'Specialized agent for performance analysis and optimization',
    enabled: true,
    version: '1.0.0',
    
    provider: {
      type: 'claude',
      config: {
        apiKey: process.env.CLAUDE_API_KEY || 'your-claude-api-key',
        model: 'claude-3-5-sonnet-20241022',
        maxTokens: 6000,
        temperature: 0.2, // Lower temperature for more focused technical analysis
      },
    },

    commands: {
      enabled: [
        'analyze-db-performance',
        'analyze-memory-usage',
        'analyze-cpu-bottlenecks',
        'analyze-caching-opportunities',
        'recommend-load-testing'
      ],
      disabled: [],
      customPrompts: {},
    },

    eventFilters: [
      'github.pull_request',
      'gitlab.merge_request'
    ],

    behavior: {
      autoResponse: false,
      verboseLogging: true,
      dryRun: false,
    },

    rateLimits: {
      enabled: true,
      requestsPerMinute: 5,
      requestsPerHour: 50,
      requestsPerDay: 200,
    },
  };

  try {
    // Initialize the custom agent
    console.log('1. Initializing custom Performance Analysis Agent...');
    const agent = new PerformanceAnalysisAgent(customAgentConfig);
    console.log('   ✅ Agent initialized successfully\n');

    // Show agent status
    console.log('2. Agent Status:');
    const status = agent.getStatus();
    console.log('   📊', status);
    console.log('');

    // Example performance analysis event
    const performancePREvent = {
      id: 'perf-pr-001',
      timestamp: new Date().toISOString(),
      provider: 'github',
      eventType: 'pull_request',
      payload: {
        action: 'opened',
        pull_request: {
          number: 789,
          title: 'optimize: improve database query performance in user search',
          body: `This PR optimizes the user search functionality by:

1. Adding database indexes for commonly queried fields
2. Implementing query result caching with Redis
3. Reducing N+1 query problems in the user profile loading

/analyze-db-performance postgresql

Performance improvements expected:
- Search response time: 2.5s → 200ms
- Database CPU usage: -60%
- Cache hit ratio: 0% → 85%

Load testing results show 10x improvement in concurrent user capacity.`,
          state: 'open',
          head: { ref: 'optimize/user-search-performance' },
          base: { ref: 'main' },
          changed_files: 5,
          additions: 120,
          deletions: 80,
        },
        repository: {
          name: 'user-service',
          full_name: 'company/user-service',
          html_url: 'https://github.com/company/user-service',
        },
      },
      headers: {}
    };

    // Process the performance-related PR
    console.log('3. Processing performance-related PR...');
    console.log('   📝 PR Title:', performancePREvent.payload.pull_request.title);
    console.log('   🔍 AI Command found: /analyze-db-performance postgresql\n');

    const result = await agent.handleEvent(performancePREvent);
    console.log('   📤 Result:', {
      success: result.success,
      message: result.message,
    });

    if (result.metadata?.actions) {
      console.log('   🎯 Actions taken:', result.metadata.actions.length);
    }
    console.log('');

    // Demonstrate custom commands
    console.log('4. Available Performance Commands:');
    const commands = [
      'analyze-db-performance',
      'analyze-memory-usage', 
      'analyze-cpu-bottlenecks',
      'analyze-caching-opportunities',
      'recommend-load-testing'
    ];

    commands.forEach(cmd => {
      console.log(`   • /${cmd}`);
    });
    console.log('');

    console.log('✅ Custom agent demonstration completed!\n');

    // Usage recommendations
    printCustomAgentUsage();

  } catch (error) {
    console.error('❌ Error in custom agent demo:', error.message);
  }
}

function printCustomAgentUsage() {
  console.log('🎯 Custom Performance Agent Usage:\n');

  console.log('📊 **Database Performance Analysis:**');
  console.log('   /analyze-db-performance postgresql');
  console.log('   → Analyzes queries, indexes, and connection usage\n');

  console.log('💾 **Memory Usage Analysis:**');
  console.log('   /analyze-memory-usage javascript');
  console.log('   → Identifies memory leaks and optimization opportunities\n');

  console.log('⚡ **CPU Bottleneck Detection:**');
  console.log('   /analyze-cpu-bottlenecks algorithms');
  console.log('   → Reviews algorithm complexity and computational efficiency\n');

  console.log('🗄️ **Caching Strategy Recommendations:**');
  console.log('   /analyze-caching-opportunities api');
  console.log('   → Suggests caching layers and invalidation strategies\n');

  console.log('📈 **Load Testing Recommendations:**');
  console.log('   /recommend-load-testing api-endpoints');
  console.log('   → Provides load testing scenarios and scripts\n');

  console.log('🔧 **Integration Tips:**');
  console.log('   • Add to your ai-agents.json configuration');
  console.log('   • Set appropriate rate limits for cost control');
  console.log('   • Enable autoResponse for automatic analysis');
  console.log('   • Use eventFilters to focus on performance-related PRs\n');

  console.log('📋 **Configuration Example:**');
  console.log(`   {
     "performance-analysis-agent": {
       "enabled": true,
       "type": "performance-analysis",
       "provider": { "type": "claude" },
       "behavior": { "autoResponse": true },
       "eventFilters": ["github.pull_request"]
     }
   }\n`);
}

// Run demo if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateCustomAgent().catch(console.error);
}

export { PerformanceAnalysisAgent, demonstrateCustomAgent };