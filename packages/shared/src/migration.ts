/**
 * Migration management types and utilities
 */

export interface MigrationPath {
  fromVersion: string;
  toVersion: string;
  steps: MigrationStep[];
  estimatedDuration: number;
}

export interface MigrationStep {
  id: string;
  description: string;
  type: 'schema' | 'data' | 'config' | 'file';
  required: boolean;
  risk: 'low' | 'medium' | 'high';
}

export function getAvailableMigrationPaths(_component: string): string[] {
  // Stub implementation
  return [`${_component}: v1.0.0 -> v2.0.0`];
}

export function hasMigrationPath(
  _component: string,
  _fromVersion: string,
  _toVersion: string
): boolean {
  // Stub implementation
  return true;
}

export function estimateMigrationDuration(
  _component: string,
  _fromVersion: string,
  _toVersion: string
): number {
  // Stub implementation - return milliseconds
  return 60000; // 1 minute default
}
