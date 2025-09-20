/**
 * Version compatibility and management types
 */
export interface VersionSet {
  arbiter: string;
  cue: string;
  node?: string;
  [key: string]: string | undefined;
}
export interface CompatibilityResult {
  compatible: boolean;
  issues: Array<{
    component: string;
    currentVersion: string;
    requiredVersion: string;
    severity: "error" | "warning" | "info";
    message: string;
  }>;
  recommendations?: string[];
  version_mismatches?: Array<{
    component: string;
    expected: string;
    actual: string;
    [key: string]: any;
  }>;
  migration_required?: boolean;
  migration_path?: {
    fromVersion: string;
    toVersion: string;
    steps: string[];
  };
  timestamp?: string;
}
export declare const CURRENT_VERSIONS: VersionSet;
export declare function checkCompatibility(
  _versions: Partial<VersionSet>,
  _allowCompat?: boolean,
): Promise<CompatibilityResult>;
export declare function executeMigration(
  _component: string,
  _fromVersion: string,
  _toVersion: string,
): Promise<{
  success: boolean;
  operations_performed: string[];
  warnings: string[];
  timestamp: string;
}>;
export declare function getRuntimeVersionInfo(): {
  versions: VersionSet;
  build_info: {
    timestamp: string;
    commit_hash?: string;
    deterministic: boolean;
    reproducible: boolean;
  };
  compatibility: {
    strict_mode: boolean;
    allow_compat_flag: boolean;
    migration_support: boolean;
  };
};
export declare function validateVersionSet(versions: VersionSet): boolean;
//# sourceMappingURL=version.d.ts.map
