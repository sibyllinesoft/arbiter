import type { SecurityScanResult, SecurityGate, SecurityGateResult } from './types';

export interface SecurityGatesEvaluation {
  passed: SecurityGateResult[];
  failed: SecurityGateResult[];
  score: number;
  hasBlockingFailures: boolean;
}

export class SecurityGates {
  private gates: SecurityGate[];

  constructor(gates: SecurityGate[]) {
    this.gates = gates;
  }

  async evaluate(scanResults: SecurityScanResult[]): Promise<SecurityGatesEvaluation> {
    const passed: SecurityGateResult[] = [];
    const failed: SecurityGateResult[] = [];

    console.log('🚧 Evaluating Security Gates...');

    for (const gate of this.gates) {
      const result = this.evaluateGate(gate, scanResults);
      
      if (result.passed) {
        passed.push(result);
        console.log(`  ✅ ${result.name}: ${result.actual_count}/${result.max_allowed} ${result.severity} issues`);
      } else {
        failed.push(result);
        const blockingText = result.blocking ? ' (BLOCKING)' : '';
        console.log(`  ❌ ${result.name}: ${result.actual_count}/${result.max_allowed} ${result.severity} issues${blockingText}`);
      }
    }

    // Calculate overall score (0-100)
    const score = Math.round((passed.length / this.gates.length) * 100);

    // Check for blocking failures
    const hasBlockingFailures = failed.some(gate => gate.blocking);

    console.log(`\\n📊 Security Gates Summary: ${passed.length}/${this.gates.length} passed (${score}%)`);

    return {
      passed,
      failed,
      score,
      hasBlockingFailures,
    };
  }

  private evaluateGate(gate: SecurityGate, scanResults: SecurityScanResult[]): SecurityGateResult {
    // Filter scan results by scanner if specified
    const relevantScans = gate.scanner ? 
      scanResults.filter(scan => scan.scanner === gate.scanner) : 
      scanResults;

    // Count vulnerabilities matching the gate criteria
    let actualCount = 0;
    const details: Array<{ id: string; title: string; file?: string }> = [];

    for (const scan of relevantScans) {
      for (const vuln of scan.vulnerabilities) {
        // Check if vulnerability matches gate criteria
        const severityMatch = vuln.severity === gate.severity;
        const categoryMatch = !gate.category || vuln.category === gate.category;

        if (severityMatch && categoryMatch) {
          actualCount++;
          
          // Collect details for reporting
          if (details.length < 10) { // Limit details to first 10 for brevity
            details.push({
              id: vuln.id,
              title: vuln.title,
              file: vuln.file,
            });
          }
        }
      }
    }

    const passed = actualCount <= gate.max_count;

    return {
      name: gate.name,
      passed,
      actual_count: actualCount,
      max_allowed: gate.max_count,
      severity: gate.severity,
      blocking: gate.blocking,
      details: details.length > 0 ? details : undefined,
    };
  }

  // Add or modify gates dynamically
  addGate(gate: SecurityGate): void {
    this.gates.push(gate);
  }

  removeGate(name: string): void {
    this.gates = this.gates.filter(g => g.name !== name);
  }

  getGates(): SecurityGate[] {
    return [...this.gates];
  }

  // Get gates by severity for reporting
  getGatesBySeverity(severity: 'low' | 'medium' | 'high' | 'critical'): SecurityGate[] {
    return this.gates.filter(gate => gate.severity === severity);
  }

  // Get blocking gates
  getBlockingGates(): SecurityGate[] {
    return this.gates.filter(gate => gate.blocking);
  }

  // Update gate thresholds (e.g., for different environments)
  updateGateThreshold(name: string, newMaxCount: number): boolean {
    const gate = this.gates.find(g => g.name === name);
    if (gate) {
      gate.max_count = newMaxCount;
      return true;
    }
    return false;
  }

  // Create environment-specific gate configurations
  static createForEnvironment(environment: 'development' | 'staging' | 'production'): SecurityGate[] {
    const baseGates: SecurityGate[] = [
      {
        name: 'No Critical Vulnerabilities',
        severity: 'critical',
        max_count: 0,
        blocking: true,
      },
      {
        name: 'No Secrets in Code',
        severity: 'high',
        max_count: 0,
        scanner: 'secrets',
        blocking: true,
      },
    ];

    switch (environment) {
      case 'production':
        return [
          ...baseGates,
          {
            name: 'Limited High Severity Issues',
            severity: 'high',
            max_count: 0, // Zero tolerance in production
            blocking: true,
          },
          {
            name: 'Limited Medium Severity Issues',
            severity: 'medium',
            max_count: 5,
            blocking: true,
          },
        ];

      case 'staging':
        return [
          ...baseGates,
          {
            name: 'Limited High Severity Issues',
            severity: 'high',
            max_count: 3,
            blocking: true,
          },
          {
            name: 'Limited Medium Severity Issues',
            severity: 'medium',
            max_count: 10,
            blocking: false,
          },
        ];

      case 'development':
      default:
        return [
          ...baseGates,
          {
            name: 'Limited High Severity Issues',
            severity: 'high',
            max_count: 10,
            blocking: false,
          },
          {
            name: 'Medium Severity Monitoring',
            severity: 'medium',
            max_count: 50,
            blocking: false,
          },
        ];
    }
  }

  // Validate gate configuration
  static validateGateConfiguration(gates: SecurityGate[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for duplicate gate names
    const names = gates.map(g => g.name);
    const duplicateNames = names.filter((name, index) => names.indexOf(name) !== index);
    if (duplicateNames.length > 0) {
      errors.push(`Duplicate gate names found: ${duplicateNames.join(', ')}`);
    }

    // Validate individual gates
    for (const gate of gates) {
      if (!gate.name || gate.name.trim().length === 0) {
        errors.push('Gate name cannot be empty');
      }

      if (gate.max_count < 0) {
        errors.push(`Gate "${gate.name}" has negative max_count: ${gate.max_count}`);
      }

      if (!['low', 'medium', 'high', 'critical'].includes(gate.severity)) {
        errors.push(`Gate "${gate.name}" has invalid severity: ${gate.severity}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}