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
export declare function getAvailableMigrationPaths(_component: string): string[];
export declare function hasMigrationPath(_component: string, _fromVersion: string, _toVersion: string): boolean;
export declare function estimateMigrationDuration(_component: string, _fromVersion: string, _toVersion: string): number;
//# sourceMappingURL=migration.d.ts.map