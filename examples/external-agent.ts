#!/usr/bin/env bun
/**
 * Example external agent that subscribes to spec events via NATS
 * This demonstrates how AI agents can react to specification changes
 */
import { type NatsConnection, connect } from 'nats';

interface NatsSpecEvent {
  topic: string;
  projectId: string;
  event: {
    project_id: string;
    event_type: string;
    data: Record<string, unknown>;
  };
  metadata: {
    timestamp: string;
    specHash?: string;
    sequence: number;
  };
}

class SpecAnalysisAgent {
  private connection: NatsConnection | null = null;
  private name: string;

  constructor(name = 'SpecAnalysisAgent') {
    this.name = name;
  }

  /**
   * Connect to NATS and start listening for spec events
   */
  async start(natsUrl = 'nats://localhost:4222'): Promise<void> {
    try {
      console.log(`🤖 ${this.name} connecting to NATS at ${natsUrl}...`);

      this.connection = await connect({
        servers: [natsUrl],
        reconnectTimeWait: 2000,
        maxReconnectAttempts: 10,
      });

      console.log(`✅ ${this.name} connected to NATS server`);

      // Subscribe to all spec events for all projects
      // In production, you might want to filter by specific projects
      const subscription = this.connection.subscribe('spec.*.*.updated');

      console.log(`🔍 ${this.name} listening for spec events...`);

      // Process incoming events
      for await (const message of subscription) {
        try {
          const event: NatsSpecEvent = JSON.parse(message.data.toString());
          await this.processSpecEvent(event);
        } catch (error) {
          console.error('❌ Error processing message:', error);
        }
      }
    } catch (error) {
      console.error(`❌ ${this.name} failed to connect to NATS:`, error);
      process.exit(1);
    }
  }

  /**
   * Process a spec event and provide AI analysis
   */
  private async processSpecEvent(event: NatsSpecEvent): Promise<void> {
    const { topic, projectId, event: specEvent, metadata } = event;

    console.log(`\n📨 ${this.name} received event:`);
    console.log(`   Topic: ${topic}`);
    console.log(`   Project: ${projectId}`);
    console.log(`   Type: ${specEvent.event_type}`);
    console.log(`   Sequence: ${metadata.sequence}`);
    console.log(`   Timestamp: ${metadata.timestamp}`);

    // Example analysis based on event type
    switch (specEvent.event_type) {
      case 'fragment_updated':
        await this.analyzeFragmentUpdate(projectId, specEvent);
        break;

      case 'validation_failed':
        await this.analyzeValidationFailure(projectId, specEvent);
        break;

      case 'validation_completed':
        await this.analyzeValidationSuccess(projectId, specEvent);
        break;

      case 'version_frozen':
        await this.analyzeVersionFreeze(projectId, specEvent);
        break;

      default:
        console.log(`   📋 No specific analysis for event type: ${specEvent.event_type}`);
    }
  }

  /**
   * Analyze fragment updates for potential issues or improvements
   */
  private async analyzeFragmentUpdate(projectId: string, event: any): Promise<void> {
    console.log(`🔍 Analyzing fragment update in project ${projectId}...`);

    // Simulate AI analysis delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Example analysis outputs
    const fragmentPath = event.data.path || 'unknown';
    const insights = [
      'Fragment structure appears consistent with domain patterns',
      'Consider adding validation constraints for better error messages',
      'This change might benefit from additional test coverage',
    ];

    console.log(`   📊 Analysis for ${fragmentPath}:`);
    insights.forEach(insight => console.log(`      • ${insight}`));

    // In a real agent, you might:
    // - Send analysis back via NATS to another topic
    // - Store insights in a database
    // - Generate automated recommendations
    // - Trigger other automated workflows
  }

  /**
   * Analyze validation failures and suggest fixes
   */
  private async analyzeValidationFailure(projectId: string, event: any): Promise<void> {
    console.log(`❌ Analyzing validation failure in project ${projectId}...`);

    await new Promise(resolve => setTimeout(resolve, 150));

    const errors = event.data.errors || [];
    const suggestions = [
      'Check for circular dependencies in fragment imports',
      'Ensure all required fields are properly defined',
      'Validate CUE syntax and type constraints',
    ];

    console.log(`   🔧 Failure analysis (${errors.length} errors):`);
    suggestions.forEach(suggestion => console.log(`      • ${suggestion}`));

    // Real agent might publish back remediation suggestions
    if (this.connection) {
      const remediation = {
        projectId,
        agentName: this.name,
        type: 'validation_remediation',
        suggestions,
        timestamp: new Date().toISOString(),
        originalEventSequence: event.data.sequence,
      };

      this.connection.publish(`agent.${projectId}.remediation`, JSON.stringify(remediation));
      console.log(`   📤 Published remediation suggestions to agent.${projectId}.remediation`);
    }
  }

  /**
   * Analyze successful validations for quality insights
   */
  private async analyzeValidationSuccess(projectId: string, event: any): Promise<void> {
    console.log(`✅ Analyzing validation success in project ${projectId}...`);

    await new Promise(resolve => setTimeout(resolve, 80));

    const specHash = event.data.spec_hash;
    console.log(`   🎯 Validation passed for spec ${specHash}`);
    console.log('      • Spec structure is valid and consistent');
    console.log('      • All constraints are properly satisfied');
    console.log('      • Ready for potential version freeze');
  }

  /**
   * Analyze version freezes for historical tracking
   */
  private async analyzeVersionFreeze(projectId: string, event: any): Promise<void> {
    console.log(`🔒 Analyzing version freeze in project ${projectId}...`);

    const versionId = event.data.version_id;
    const specHash = event.data.spec_hash;

    console.log(`   📚 Version ${versionId} frozen with spec ${specHash}`);
    console.log('      • Milestone reached - spec locked for stability');
    console.log('      • Consider generating documentation snapshot');
    console.log('      • Good time for comprehensive testing');
  }

  /**
   * Cleanup and disconnect
   */
  async stop(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      console.log(`👋 ${this.name} disconnected from NATS`);
    }
  }
}

// Main execution
if (import.meta.main) {
  const agentName = process.argv[2] || 'SpecAnalysisAgent';
  const natsUrl = process.env.NATS_URL || 'nats://localhost:4222';

  const agent = new SpecAnalysisAgent(agentName);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down agent...');
    await agent.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down agent...');
    await agent.stop();
    process.exit(0);
  });

  // Start the agent
  agent.start(natsUrl).catch(error => {
    console.error('Failed to start agent:', error);
    process.exit(1);
  });
}

export { SpecAnalysisAgent };
