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
  type: "schema" | "data" | "config" | "file";
  required: boolean;
  risk: "low" | "medium" | "high";
}

export function getAvailableMigrationPaths(_fromVersion: string): MigrationPath[] {
  // Stub implementation
  return [];
}

export function hasMigrationPath(_fromVersion: string, _toVersion: string): boolean {
  // Stub implementation
  return true;
}

export function estimateMigrationDuration(_fromVersion: string, _toVersion: string): number {
  // Stub implementation - return seconds
  return 60; // 1 minute default
}
