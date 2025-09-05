/**
 * Skald Survey Integration for Arbiter CLI
 *
 * Provides seamless integration with the skald survey library to collect
 * usage metrics and feedback from CLI operations. Configured for maximum
 * verbosity and always-report mode.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import chalk from "chalk";
import { v4 as uuidv4 } from "uuid";

/**
 * Skald survey configuration for maximum verbosity
 */
interface SkaldConfig {
  enabled: boolean;
  storePath: string;
  invitePolicy: {
    error: boolean;
    timeout: boolean;
    p95_ms: number;
    large_output_kb: number;
  };
  sampleNeutral: number;
  ttlHours: number;
  maxVerbosity: boolean;
  alwaysReport: boolean;
}

/**
 * Tool execution metadata for skald
 */
interface ToolExecution {
  traceId: string;
  toolName: string;
  startTime: number;
  endTime?: number;
  status: "success" | "error" | "timeout";
  args: Record<string, unknown>;
  output?: string;
  errorMessage?: string;
  latencyMs?: number;
  outputBytes?: number;
}

/**
 * Survey data collected by skald
 */
interface SurveyData {
  trace_id: string;
  helpfulness: number;
  fit: number;
  clarity: number;
  confidence: number;
  better_alternative?: string;
  suggestions: string[];
  notes: string;
}

/**
 * Skald integration class for Arbiter CLI
 */
export class SkaldIntegration {
  private config: SkaldConfig;
  private activeExecutions: Map<string, ToolExecution> = new Map();
  private skaldPath: string;
  private enabled: boolean = false;

  constructor(private workDir: string = process.cwd()) {
    this.skaldPath = resolve(dirname(workDir), "skald");
    this.config = this.loadConfig();
    this.initialize();
  }

  /**
   * Load skald configuration with maximum verbosity defaults
   */
  private loadConfig(): SkaldConfig {
    const configPath = join(this.workDir, ".arbiter", "skald-config.json");

    // Default configuration for maximum verbosity
    const defaultConfig: SkaldConfig = {
      enabled: true,
      storePath: join(this.workDir, ".arbiter", "survey", "skald_feedback.db"),
      invitePolicy: {
        error: true,
        timeout: true,
        p95_ms: 100.0, // Very low threshold to capture almost everything
        large_output_kb: 0.1, // Very low threshold to capture almost everything
      },
      sampleNeutral: 1.0, // Always collect feedback (maximum verbosity)
      ttlHours: 168, // 7 days retention
      maxVerbosity: true,
      alwaysReport: true,
    };

    if (existsSync(configPath)) {
      try {
        const userConfig = JSON.parse(readFileSync(configPath, "utf8"));
        return { ...defaultConfig, ...userConfig };
      } catch (_error) {
        console.warn(chalk.yellow("⚠️  Failed to load skald config, using defaults"));
        return defaultConfig;
      }
    }

    return defaultConfig;
  }

  /**
   * Initialize skald integration
   */
  private initialize(): void {
    // Check if skald library exists
    if (!existsSync(this.skaldPath)) {
      console.warn(
        chalk.yellow("⚠️  Skald library not found at ../skald, survey collection disabled"),
      );
      this.enabled = false;
      return;
    }

    // Create survey directory
    const surveyDir = dirname(this.config.storePath);
    if (!existsSync(surveyDir)) {
      mkdirSync(surveyDir, { recursive: true });
    }

    // Save config for future use
    this.saveConfig();

    this.enabled = this.config.enabled;

    if (this.enabled) {
      console.log(chalk.dim("📊 Skald survey collection enabled (maximum verbosity)"));
    }
  }

  /**
   * Save current configuration
   */
  private saveConfig(): void {
    const configPath = join(this.workDir, ".arbiter", "skald-config.json");
    const configDir = dirname(configPath);

    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    writeFileSync(configPath, JSON.stringify(this.config, null, 2));
  }

  /**
   * Start tracking a tool execution
   */
  public startExecution(toolName: string, args: Record<string, unknown>): string {
    if (!this.enabled) return "";

    const traceId = uuidv4();
    const execution: ToolExecution = {
      traceId,
      toolName,
      startTime: Date.now(),
      status: "success", // Default to success until we know otherwise
      args,
    };

    this.activeExecutions.set(traceId, execution);

    // Log start for maximum verbosity
    if (this.config.maxVerbosity) {
      console.log(chalk.dim(`📊 Starting survey collection for ${toolName} (${traceId})`));
    }

    return traceId;
  }

  /**
   * Complete a tool execution with success
   */
  public completeExecution(traceId: string, output?: string): void {
    if (!this.enabled || !traceId) return;

    const execution = this.activeExecutions.get(traceId);
    if (!execution) return;

    execution.endTime = Date.now();
    execution.latencyMs = execution.endTime - execution.startTime;
    execution.output = output;
    execution.outputBytes = output ? Buffer.byteLength(output, "utf8") : 0;

    this.recordExecution(execution);
    this.activeExecutions.delete(traceId);
  }

  /**
   * Complete a tool execution with error
   */
  public errorExecution(traceId: string, error: Error | string): void {
    if (!this.enabled || !traceId) return;

    const execution = this.activeExecutions.get(traceId);
    if (!execution) return;

    execution.endTime = Date.now();
    execution.latencyMs = execution.endTime - execution.startTime;
    execution.status = "error";
    execution.errorMessage = error instanceof Error ? error.message : error;
    execution.outputBytes = 0;

    this.recordExecution(execution);
    this.activeExecutions.delete(traceId);
  }

  /**
   * Record execution to skald storage
   */
  private async recordExecution(execution: ToolExecution): Promise<void> {
    if (!this.enabled) return;

    try {
      // Create Python script to record execution
      const pythonScript = this.createRecordingScript(execution);
      const tempScriptPath = join(dirname(this.config.storePath), `record_${execution.traceId}.py`);

      writeFileSync(tempScriptPath, pythonScript);

      // Execute Python script
      const _result = await this.executePython(tempScriptPath);

      // Clean up temp script
      try {
        const fs = await import("fs-extra");
        await fs.remove(tempScriptPath);
      } catch {
        // Ignore cleanup errors
      }

      if (this.config.maxVerbosity) {
        console.log(
          chalk.dim(`📊 Recorded execution: ${execution.toolName} (${execution.latencyMs}ms)`),
        );
      }

      // Auto-report if enabled
      if (this.config.alwaysReport && this.shouldInviteFeedback(execution)) {
        await this.autoReport(execution);
      }
    } catch (error) {
      if (this.config.maxVerbosity) {
        console.warn(chalk.yellow(`⚠️  Failed to record skald execution: ${error}`));
      }
    }
  }

  /**
   * Create Python script for recording execution
   */
  private createRecordingScript(execution: ToolExecution): string {
    return `#!/usr/bin/env python3
import sys
import os
import asyncio
from pathlib import Path

# Add skald to path
skald_path = "${this.skaldPath}"
sys.path.insert(0, skald_path)

try:
    from skald.storage.sqlite import SQLiteStorage
    from skald.schema.models import ToolRunMetadata, ToolStatus
    from datetime import datetime, timezone
    import json

    async def record_execution():
        storage = SQLiteStorage("${this.config.storePath}")
        await storage.initialize()
        
        metadata = ToolRunMetadata(
            trace_id="${execution.traceId}",
            timestamp=datetime.fromtimestamp(${execution.startTime / 1000}, timezone.utc),
            agent_id="arbiter-cli",
            tool_name="${execution.toolName}",
            status=ToolStatus.${execution.status.toUpperCase()},
            latency_ms=${execution.latencyMs || 0},
            output_bytes=${execution.outputBytes || 0},
            invite_feedback=${this.shouldInviteFeedback(execution) ? "True" : "False"},
            opt_out=False,
            args_redacted=${JSON.stringify(this.redactSensitiveArgs(execution.args))}
        )
        
        await storage.store_tool_run(metadata)
        await storage.close()
        print(f"Recorded execution: ${execution.traceId}")

    if __name__ == "__main__":
        asyncio.run(record_execution())
        
except ImportError as e:
    print(f"Skald import error: {e}", file=sys.stderr)
    sys.exit(1)
except Exception as e:
    print(f"Recording error: {e}", file=sys.stderr)
    sys.exit(1)
`;
  }

  /**
   * Determine if feedback should be invited based on execution
   */
  private shouldInviteFeedback(execution: ToolExecution): boolean {
    const { invitePolicy, sampleNeutral } = this.config;

    // Always invite on errors
    if (invitePolicy.error && execution.status === "error") {
      return true;
    }

    // Always invite on timeouts
    if (invitePolicy.timeout && execution.status === "timeout") {
      return true;
    }

    // Invite on high latency
    if (execution.latencyMs && execution.latencyMs > invitePolicy.p95_ms) {
      return true;
    }

    // Invite on large output
    if (execution.outputBytes && execution.outputBytes > invitePolicy.large_output_kb * 1024) {
      return true;
    }

    // Sample neutral calls (with max verbosity, this is 100%)
    if (execution.status === "success") {
      return Math.random() < sampleNeutral;
    }

    return false;
  }

  /**
   * Auto-report with default positive feedback for successful operations
   */
  private async autoReport(execution: ToolExecution): Promise<void> {
    if (!this.config.alwaysReport) return;

    // Generate intelligent feedback based on execution
    const surveyData: SurveyData = this.generateAutoFeedback(execution);

    try {
      const reportScript = this.createReportingScript(surveyData);
      const tempScriptPath = join(dirname(this.config.storePath), `report_${execution.traceId}.py`);

      writeFileSync(tempScriptPath, reportScript);
      await this.executePython(tempScriptPath);

      // Clean up
      try {
        const fs = await import("fs-extra");
        await fs.remove(tempScriptPath);
      } catch {
        // Ignore cleanup errors
      }

      if (this.config.maxVerbosity) {
        console.log(chalk.dim(`📊 Auto-reported feedback for ${execution.toolName}`));
      }
    } catch (error) {
      if (this.config.maxVerbosity) {
        console.warn(chalk.yellow(`⚠️  Failed to auto-report: ${error}`));
      }
    }
  }

  /**
   * Generate intelligent auto-feedback based on execution results
   */
  private generateAutoFeedback(execution: ToolExecution): SurveyData {
    let helpfulness = 4;
    let fit = 4;
    let clarity = 4;
    let confidence = 0.8;
    let notes = `Auto-generated feedback for ${execution.toolName}`;
    const suggestions: string[] = [];

    // Adjust based on performance
    if (execution.latencyMs) {
      if (execution.latencyMs < 100) {
        helpfulness = 5;
        fit = 5;
        notes += " - Very fast execution";
      } else if (execution.latencyMs > 5000) {
        helpfulness = 3;
        suggestions.push("Consider performance optimization");
        notes += " - Slow execution";
      }
    }

    // Adjust based on status
    if (execution.status === "error") {
      helpfulness = 2;
      fit = 2;
      clarity = 2;
      confidence = 0.9;
      suggestions.push("Error handling could be improved");
      notes += " - Execution failed";
    }

    // Adjust based on output size
    if (execution.outputBytes) {
      if (execution.outputBytes > 10000) {
        clarity = 3;
        suggestions.push("Consider output formatting");
      }
    }

    return {
      trace_id: execution.traceId,
      helpfulness,
      fit,
      clarity,
      confidence,
      better_alternative: execution.status === "error" ? "manual_intervention" : undefined,
      suggestions,
      notes,
    };
  }

  /**
   * Create Python script for reporting feedback
   */
  private createReportingScript(surveyData: SurveyData): string {
    return `#!/usr/bin/env python3
import sys
import asyncio
from pathlib import Path

# Add skald to path
skald_path = "${this.skaldPath}"
sys.path.insert(0, skald_path)

try:
    from skald.storage.sqlite import SQLiteStorage
    from skald.schema.models import FeedbackReport
    import json

    async def submit_feedback():
        storage = SQLiteStorage("${this.config.storePath}")
        await storage.initialize()
        
        feedback_data = ${JSON.stringify(surveyData)}
        feedback = FeedbackReport(**feedback_data)
        
        await storage.store_feedback(feedback, "arbiter-cli")
        await storage.close()
        print(f"Submitted feedback: ${surveyData.trace_id}")

    if __name__ == "__main__":
        asyncio.run(submit_feedback())
        
except ImportError as e:
    print(f"Skald import error: {e}", file=sys.stderr)
    sys.exit(1)
except Exception as e:
    print(f"Feedback error: {e}", file=sys.stderr)
    sys.exit(1)
`;
  }

  /**
   * Execute Python script
   */
  private executePython(scriptPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const pythonCmd = process.platform === "win32" ? "python" : "python3";
      const child = spawn(pythonCmd, [scriptPath], {
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, PYTHONPATH: this.skaldPath },
      });

      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(`Python script failed: ${stderr || stdout}`));
        }
      });

      child.on("error", (error) => {
        reject(error);
      });
    });
  }

  /**
   * Redact sensitive arguments
   */
  private redactSensitiveArgs(args: Record<string, unknown>): Record<string, unknown> {
    const redacted = { ...args };
    const sensitiveKeys = ["password", "token", "key", "secret", "credential", "api_key", "auth"];

    for (const key of Object.keys(redacted)) {
      if (sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))) {
        redacted[key] = "[REDACTED]";
      }
    }

    return redacted;
  }

  /**
   * Query stored survey data
   */
  public async querySurveyData(limit: number = 50): Promise<any[]> {
    if (!this.enabled) return [];

    try {
      const queryScript = `#!/usr/bin/env python3
import sys
import asyncio
from pathlib import Path

# Add skald to path
skald_path = "${this.skaldPath}"
sys.path.insert(0, skald_path)

try:
    from skald.storage.sqlite import SQLiteStorage
    import json

    async def query_data():
        storage = SQLiteStorage("${this.config.storePath}")
        await storage.initialize()
        
        tool_runs = await storage.list_tool_runs(limit=${limit})
        results = []
        
        for run in tool_runs:
            feedback = await storage.get_feedback(run.trace_id)
            result = {
                "trace_id": run.trace_id,
                "tool_name": run.tool_name,
                "status": run.status.value,
                "latency_ms": run.latency_ms,
                "timestamp": run.timestamp.isoformat(),
                "feedback": None
            }
            
            if feedback:
                result["feedback"] = {
                    "helpfulness": feedback.helpfulness,
                    "fit": feedback.fit,
                    "clarity": feedback.clarity,
                    "confidence": feedback.confidence,
                    "notes": feedback.notes
                }
            
            results.append(result)
        
        await storage.close()
        print(json.dumps(results, indent=2))

    if __name__ == "__main__":
        asyncio.run(query_data())
        
except ImportError as e:
    print("[]", file=sys.stderr)
    sys.exit(0)
except Exception as e:
    print("[]", file=sys.stderr)
    sys.exit(0)
`;

      const tempScriptPath = join(dirname(this.config.storePath), "query_data.py");
      writeFileSync(tempScriptPath, queryScript);

      const result = await this.executePython(tempScriptPath);

      // Clean up
      try {
        const fs = await import("fs-extra");
        await fs.remove(tempScriptPath);
      } catch {
        // Ignore cleanup errors
      }

      return JSON.parse(result || "[]");
    } catch (error) {
      if (this.config.maxVerbosity) {
        console.warn(chalk.yellow(`⚠️  Failed to query survey data: ${error}`));
      }
      return [];
    }
  }

  /**
   * Generate survey report
   */
  public async generateReport(): Promise<string> {
    if (!this.enabled) return "Survey collection is disabled";

    try {
      const data = await this.querySurveyData(100);

      if (data.length === 0) {
        return "No survey data available yet";
      }

      const stats = {
        totalExecutions: data.length,
        successfulExecutions: data.filter((d) => d.status === "success").length,
        errorExecutions: data.filter((d) => d.status === "error").length,
        averageLatency: data.reduce((acc, d) => acc + d.latency_ms, 0) / data.length,
        feedbackCount: data.filter((d) => d.feedback).length,
        averageHelpfulness: 0,
        averageFit: 0,
        averageClarity: 0,
        averageConfidence: 0,
      };

      const feedbackData = data.filter((d) => d.feedback).map((d) => d.feedback!);
      if (feedbackData.length > 0) {
        stats.averageHelpfulness =
          feedbackData.reduce((acc, f) => acc + f.helpfulness, 0) / feedbackData.length;
        stats.averageFit = feedbackData.reduce((acc, f) => acc + f.fit, 0) / feedbackData.length;
        stats.averageClarity =
          feedbackData.reduce((acc, f) => acc + f.clarity, 0) / feedbackData.length;
        stats.averageConfidence =
          feedbackData.reduce((acc, f) => acc + f.confidence, 0) / feedbackData.length;
      }

      let report = chalk.bold("📊 Skald Survey Report\n");
      report += `${chalk.gray("═".repeat(50))}\n\n`;

      report += chalk.cyan("Execution Statistics:\n");
      report += `  Total Executions: ${stats.totalExecutions}\n`;
      report += `  Successful: ${stats.successfulExecutions} (${((stats.successfulExecutions / stats.totalExecutions) * 100).toFixed(1)}%)\n`;
      report += `  Errors: ${stats.errorExecutions} (${((stats.errorExecutions / stats.totalExecutions) * 100).toFixed(1)}%)\n`;
      report += `  Average Latency: ${stats.averageLatency.toFixed(1)}ms\n\n`;

      if (stats.feedbackCount > 0) {
        report += chalk.cyan("Feedback Statistics:\n");
        report += `  Feedback Responses: ${stats.feedbackCount} (${((stats.feedbackCount / stats.totalExecutions) * 100).toFixed(1)}%)\n`;
        report += `  Average Helpfulness: ${stats.averageHelpfulness.toFixed(1)}/5\n`;
        report += `  Average Fit: ${stats.averageFit.toFixed(1)}/5\n`;
        report += `  Average Clarity: ${stats.averageClarity.toFixed(1)}/5\n`;
        report += `  Average Confidence: ${(stats.averageConfidence * 100).toFixed(1)}%\n\n`;
      }

      // Tool usage breakdown
      const toolStats = new Map<string, number>();
      data.forEach((d) => {
        toolStats.set(d.tool_name, (toolStats.get(d.tool_name) || 0) + 1);
      });

      report += chalk.cyan("Tool Usage:\n");
      Array.from(toolStats.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .forEach(([tool, count]) => {
          report += `  ${tool}: ${count} executions\n`;
        });

      return report;
    } catch (error) {
      return `Failed to generate report: ${error}`;
    }
  }

  /**
   * Cleanup expired survey data
   */
  public async cleanup(): Promise<number> {
    if (!this.enabled) return 0;

    try {
      const cleanupScript = `#!/usr/bin/env python3
import sys
import asyncio
from pathlib import Path

# Add skald to path  
skald_path = "${this.skaldPath}"
sys.path.insert(0, skald_path)

try:
    from skald.storage.sqlite import SQLiteStorage

    async def cleanup_data():
        storage = SQLiteStorage("${this.config.storePath}")
        await storage.initialize()
        
        cleaned = await storage.cleanup_expired(${this.config.ttlHours})
        await storage.close()
        print(cleaned)

    if __name__ == "__main__":
        asyncio.run(cleanup_data())
        
except ImportError as e:
    print("0", file=sys.stderr)
    sys.exit(0)
except Exception as e:
    print("0", file=sys.stderr)
    sys.exit(0)
`;

      const tempScriptPath = join(dirname(this.config.storePath), "cleanup_data.py");
      writeFileSync(tempScriptPath, cleanupScript);

      const result = await this.executePython(tempScriptPath);

      // Clean up
      try {
        const fs = await import("fs-extra");
        await fs.remove(tempScriptPath);
      } catch {
        // Ignore cleanup errors
      }

      return parseInt(result.trim() || "0", 10);
    } catch (error) {
      if (this.config.maxVerbosity) {
        console.warn(chalk.yellow(`⚠️  Failed to cleanup survey data: ${error}`));
      }
      return 0;
    }
  }

  /**
   * Check if skald is available and working
   */
  public async isHealthy(): Promise<boolean> {
    if (!this.enabled) return false;

    try {
      const testScript = `#!/usr/bin/env python3
import sys
from pathlib import Path

# Add skald to path
skald_path = "${this.skaldPath}"
sys.path.insert(0, skald_path)

try:
    import skald
    from skald.storage.sqlite import SQLiteStorage
    print("healthy")
    sys.exit(0)
except ImportError as e:
    print(f"unhealthy: {e}", file=sys.stderr)
    sys.exit(1)
except Exception as e:
    print(f"unhealthy: {e}", file=sys.stderr)
    sys.exit(1)
`;

      const tempScriptPath = join(dirname(this.config.storePath), "health_check.py");
      writeFileSync(tempScriptPath, testScript);

      await this.executePython(tempScriptPath);

      // Clean up
      try {
        const fs = await import("fs-extra");
        await fs.remove(tempScriptPath);
      } catch {
        // Ignore cleanup errors
      }

      return true;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Enable/disable survey collection
   */
  public setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    this.enabled = enabled;
    this.saveConfig();

    if (enabled) {
      console.log(chalk.green("✅ Skald survey collection enabled"));
    } else {
      console.log(chalk.gray("❌ Skald survey collection disabled"));
    }
  }

  /**
   * Get current status
   */
  public getStatus(): {
    enabled: boolean;
    healthy: boolean;
    storePath: string;
    activeExecutions: number;
    config: SkaldConfig;
  } {
    return {
      enabled: this.enabled,
      healthy: existsSync(this.skaldPath),
      storePath: this.config.storePath,
      activeExecutions: this.activeExecutions.size,
      config: this.config,
    };
  }
}

/**
 * Global skald integration instance
 */
let skaldIntegration: SkaldIntegration | null = null;

/**
 * Get or create the global skald integration instance
 */
export function getSkaldIntegration(workDir?: string): SkaldIntegration {
  if (!skaldIntegration) {
    skaldIntegration = new SkaldIntegration(workDir);
  }
  return skaldIntegration;
}

/**
 * Convenience functions for CLI integration
 */
export function startSurvey(toolName: string, args: Record<string, unknown>): string {
  return getSkaldIntegration().startExecution(toolName, args);
}

export function completeSurvey(traceId: string, output?: string): void {
  getSkaldIntegration().completeExecution(traceId, output);
}

export function errorSurvey(traceId: string, error: Error | string): void {
  getSkaldIntegration().errorExecution(traceId, error);
}

export async function getSurveyReport(): Promise<string> {
  return await getSkaldIntegration().generateReport();
}

export async function cleanupSurveyData(): Promise<number> {
  return await getSkaldIntegration().cleanup();
}

export async function checkSurveyHealth(): Promise<boolean> {
  return await getSkaldIntegration().isHealthy();
}
