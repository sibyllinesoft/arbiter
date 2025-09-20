/**
 * Migration management types and utilities
 */
export function getAvailableMigrationPaths(_component) {
    // Stub implementation
    return [`${_component}: v1.0.0 -> v2.0.0`];
}
export function hasMigrationPath(_component, _fromVersion, _toVersion) {
    // Stub implementation
    return true;
}
export function estimateMigrationDuration(_component, _fromVersion, _toVersion) {
    // Stub implementation - return milliseconds
    return 60000; // 1 minute default
}
