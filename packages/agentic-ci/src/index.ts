/**
 * Agentic CI - AI-powered CI/CD automation with auto-merge capabilities
 * 
 * Main entry point for the agentic CI system, providing intelligent
 * failure analysis, risk assessment, and automated merge decisions.
 */

// Core components
export { Orchestrator } from './core/orchestrator.js';

// AI Agents
export { FailureAnalyzer } from './agents/failure-analyzer.js';
export { RiskAssessor } from './agents/risk-assessor.js';
export { RemediationAgent } from './agents/remediation-agent.js';
export { DecisionMaker } from './agents/decision-maker.js';

// Safety and monitoring
export { SafetyController } from './safety/safety-controller.js';
export { MetricsCollector } from './monitoring/metrics-collector.js';
export { AuditLogger } from './governance/audit-logger.js';

// Integration components
export { GitHubWebhookHandler } from './integration/github-webhook-handler.js';
export { GitHubActionsIntegration } from './integration/github-actions-integration.js';

// Configuration
export { ConfigManager, AgenticCIConfig, AgenticCIConfigSchema } from './config/agentic-ci-config.js';

// Types
export * from './types/index.js';

// Quick start function for easy setup
export async function createAgenticCI(config: AgenticCIConfig) {
  const { ConfigManager } = await import('./config/agentic-ci-config.js');
  const { Orchestrator } = await import('./core/orchestrator.js');
  const { AuditLogger } = await import('./governance/audit-logger.js');
  const { MetricsCollector } = await import('./monitoring/metrics-collector.js');
  const { SafetyController } = await import('./safety/safety-controller.js');
  const { GitHubWebhookHandler } = await import('./integration/github-webhook-handler.js');
  
  // Create components
  const auditLogger = new AuditLogger();
  const metricsCollector = new MetricsCollector();
  const safetyController = new SafetyController(config.safety);
  
  const orchestrator = new Orchestrator(
    config,
    auditLogger,
    metricsCollector,
    safetyController
  );
  
  const webhookHandler = new GitHubWebhookHandler(
    config.github.webhookSecret,
    orchestrator
  );
  
  return {
    orchestrator,
    webhookHandler,
    auditLogger,
    metricsCollector,
    safetyController,
    
    async start() {
      await Promise.all([
        auditLogger.start(),
        metricsCollector.start(),
        safetyController.start(),
        orchestrator.start(),
        webhookHandler.start(),
      ]);
    },
    
    async stop() {
      await Promise.all([
        webhookHandler.stop(),
        orchestrator.stop(),
        safetyController.stop(),
        metricsCollector.stop(),
        auditLogger.stop(),
      ]);
    },
  };
}