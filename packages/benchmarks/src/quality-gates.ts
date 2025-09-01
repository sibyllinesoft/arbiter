import type { BenchmarkResult, PerformanceGate } from './types';

export interface QualityGateResult {
  name: string;
  passed: boolean;
  threshold: number;
  actual: number;
  reason: string;
  severity: 'error' | 'warning' | 'info';
}

export interface QualityGatesEvaluation {
  passed: QualityGateResult[];
  failed: QualityGateResult[];
  hasRegression: boolean;
  securityIssues: number;
  score: number;
}

export class QualityGates {
  private gates: PerformanceGate[] = [
    // API Performance Gates
    {
      name: 'API Response Time P95',
      metric: 'p95_latency_ms',
      operator: 'lt',
      threshold: 500, // < 500ms p95 response time
      baseline_comparison: false,
    },
    {
      name: 'API Throughput RPS',
      metric: 'total_rps',
      operator: 'gt',
      threshold: 100, // > 100 requests per second
      baseline_comparison: false,
    },
    {
      name: 'API Error Rate',
      metric: 'error_count',
      operator: 'eq',
      threshold: 0, // Zero errors expected
      baseline_comparison: false,
    },

    // WebSocket Performance Gates
    {
      name: 'WebSocket Message Latency P95',
      metric: 'p95_message_latency_ms',
      operator: 'lt',
      threshold: 100, // < 100ms message latency
      baseline_comparison: false,
    },
    {
      name: 'WebSocket Message Delivery Rate',
      metric: 'message_delivery_rate_percent',
      operator: 'gte',
      threshold: 99, // >= 99% message delivery
      baseline_comparison: false,
    },
    {
      name: 'WebSocket Connection Success Rate',
      metric: 'connections_established',
      operator: 'gte',
      threshold: 45, // At least 90% of 50 connections
      baseline_comparison: false,
    },

    // CUE Analysis Performance Gates
    {
      name: 'CUE Analysis Success Rate',
      metric: 'success_rate_percent',
      operator: 'gte',
      threshold: 95, // >= 95% success rate
      baseline_comparison: false,
    },
    {
      name: 'CUE Analysis Average Time',
      metric: 'avg_execution_time_ms',
      operator: 'lt',
      threshold: 300, // < 300ms average execution
      baseline_comparison: false,
    },
    {
      name: 'CUE Analysis P95 Time',
      metric: 'p95_execution_time_ms',
      operator: 'lt',
      threshold: 750, // < 750ms p95 execution (matches timeout)
      baseline_comparison: false,
    },

    // Memory Performance Gates
    {
      name: 'Memory Growth',
      metric: 'total_memory_delta_mb',
      operator: 'lt',
      threshold: 50, // < 50MB total growth
      baseline_comparison: false,
    },
    {
      name: 'Memory Leaks',
      metric: 'potential_leaks',
      operator: 'eq',
      threshold: 0, // Zero potential leaks
      baseline_comparison: false,
    },
    {
      name: 'Memory Efficiency',
      metric: 'memory_efficiency_score',
      operator: 'gte',
      threshold: 75, // >= 75% efficiency score
      baseline_comparison: false,
    },

    // Bundle Size Gates
    {
      name: 'Total Bundle Size',
      metric: 'total_bundle_size_kb',
      operator: 'lt',
      threshold: 2000, // < 2MB total bundle
      baseline_comparison: true,
      regression_threshold: 0.25, // 25% growth limit
    },
    {
      name: 'Web Bundle Size',
      metric: 'web_bundle_size_kb',
      operator: 'lt',
      threshold: 1500, // < 1.5MB web bundle
      baseline_comparison: true,
      regression_threshold: 0.25,
    },
    {
      name: 'Build Performance',
      metric: 'build_time_ms',
      operator: 'lt',
      threshold: 30000, // < 30 seconds build time
      baseline_comparison: true,
      regression_threshold: 0.5, // 50% slower limit
    },

    // Regression Detection Gates
    {
      name: 'API Performance Regression',
      metric: 'p95_latency_ms',
      operator: 'lt',
      threshold: 0, // Will be set based on baseline
      baseline_comparison: true,
      regression_threshold: 0.2, // 20% slower limit
    },
    {
      name: 'WebSocket Performance Regression',
      metric: 'p95_message_latency_ms',
      operator: 'lt',
      threshold: 0,
      baseline_comparison: true,
      regression_threshold: 0.2,
    },
    {
      name: 'CUE Analysis Performance Regression',
      metric: 'avg_execution_time_ms',
      operator: 'lt',
      threshold: 0,
      baseline_comparison: true,
      regression_threshold: 0.2,
    },
  ];

  async evaluate(results: BenchmarkResult[], baseline?: BenchmarkResult): Promise<QualityGatesEvaluation> {
    const passed: QualityGateResult[] = [];
    const failed: QualityGateResult[] = [];
    let hasRegression = false;

    console.log('🚧 Evaluating Quality Gates...');

    for (const gate of this.gates) {
      const result = await this.evaluateGate(gate, results, baseline);
      
      if (result.passed) {
        passed.push(result);
        console.log(`  ✅ ${result.name}: ${result.actual} (threshold: ${result.threshold})`);
      } else {
        failed.push(result);
        console.log(`  ❌ ${result.name}: ${result.actual} (threshold: ${result.threshold}) - ${result.reason}`);
        
        if (gate.baseline_comparison && result.reason.includes('regression')) {
          hasRegression = true;
        }
      }
    }

    // Calculate overall score (0-100)
    const score = Math.round((passed.length / this.gates.length) * 100);

    // Count security issues (would be populated by security scanner)
    const securityIssues = 0; // TODO: Integrate with security scanner results

    console.log(`\\n📊 Quality Gates Summary: ${passed.length}/${this.gates.length} passed (${score}%)`);

    return {
      passed,
      failed,
      hasRegression,
      securityIssues,
      score,
    };
  }

  private async evaluateGate(
    gate: PerformanceGate,
    results: BenchmarkResult[],
    baseline?: BenchmarkResult
  ): Promise<QualityGateResult> {
    // Find the relevant benchmark result by type
    const benchmarkTypeMap: Record<string, string> = {
      'p95_latency_ms': 'api',
      'total_rps': 'api',
      'error_count': 'api',
      'p95_message_latency_ms': 'websocket',
      'message_delivery_rate_percent': 'websocket',
      'connections_established': 'websocket',
      'success_rate_percent': 'cue',
      'avg_execution_time_ms': 'cue',
      'p95_execution_time_ms': 'cue',
      'total_memory_delta_mb': 'memory',
      'potential_leaks': 'memory',
      'memory_efficiency_score': 'memory',
      'total_bundle_size_kb': 'bundle',
      'web_bundle_size_kb': 'bundle',
      'build_time_ms': 'bundle',
    };

    const benchmarkType = benchmarkTypeMap[gate.metric];
    const result = results.find(r => r.type === benchmarkType);

    if (!result) {
      return {
        name: gate.name,
        passed: false,
        threshold: gate.threshold,
        actual: -1,
        reason: `Benchmark result not found for metric ${gate.metric}`,
        severity: 'error',
      };
    }

    const actualValue = Number(result.metrics[gate.metric]);
    
    if (isNaN(actualValue)) {
      return {
        name: gate.name,
        passed: false,
        threshold: gate.threshold,
        actual: -1,
        reason: `Metric ${gate.metric} not found or invalid`,
        severity: 'error',
      };
    }

    // Handle baseline comparison
    let threshold = gate.threshold;
    let reason = '';

    if (gate.baseline_comparison && baseline) {
      const baselineValue = Number(baseline.metrics[gate.metric]);
      
      if (!isNaN(baselineValue)) {
        // Calculate regression threshold based on baseline
        const regressionThreshold = baselineValue * (1 + gate.regression_threshold);
        
        if (gate.operator === 'lt' && actualValue > regressionThreshold) {
          return {
            name: gate.name,
            passed: false,
            threshold: regressionThreshold,
            actual: actualValue,
            reason: `Performance regression detected: ${Math.round(((actualValue - baselineValue) / baselineValue) * 100)}% worse than baseline`,
            severity: 'error',
          };
        }
        
        // Use stricter of baseline-based or absolute threshold
        if (gate.operator === 'lt') {
          threshold = Math.min(threshold || Infinity, regressionThreshold);
        }
      }
    }

    // Evaluate gate condition
    let passed = false;
    
    switch (gate.operator) {
      case 'lt':
        passed = actualValue < threshold;
        reason = passed ? 'Within threshold' : `Exceeds threshold by ${Math.round(actualValue - threshold)}`;
        break;
      case 'lte':
        passed = actualValue <= threshold;
        reason = passed ? 'Within threshold' : `Exceeds threshold by ${Math.round(actualValue - threshold)}`;
        break;
      case 'gt':
        passed = actualValue > threshold;
        reason = passed ? 'Above threshold' : `Below threshold by ${Math.round(threshold - actualValue)}`;
        break;
      case 'gte':
        passed = actualValue >= threshold;
        reason = passed ? 'Above threshold' : `Below threshold by ${Math.round(threshold - actualValue)}`;
        break;
      case 'eq':
        passed = actualValue === threshold;
        reason = passed ? 'Equals threshold' : `Differs from threshold by ${Math.round(actualValue - threshold)}`;
        break;
    }

    return {
      name: gate.name,
      passed,
      threshold,
      actual: actualValue,
      reason,
      severity: passed ? 'info' : (gate.baseline_comparison ? 'error' : 'warning'),
    };
  }

  // Add or modify gates dynamically
  addGate(gate: PerformanceGate): void {
    this.gates.push(gate);
  }

  removeGate(name: string): void {
    this.gates = this.gates.filter(g => g.name !== name);
  }

  getGates(): PerformanceGate[] {
    return [...this.gates];
  }
}