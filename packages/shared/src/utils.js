/**
 * Shared utilities for Arbiter CLI and API
 */
/**
 * Format validation errors into a human-readable string
 */
export function formatValidationErrors(errors) {
    return errors
        .map(error => {
        let formatted = error.message;
        if (error.path) {
            formatted = `${error.path}: ${formatted}`;
        }
        if (error.line !== undefined) {
            formatted = `${formatted} (line ${error.line}${error.column ? `, column ${error.column}` : ''})`;
        }
        return formatted;
    })
        .join('\n');
}
/**
 * Check if a path is relative
 */
export function isRelativePath(path) {
    return !path.startsWith('/') && !path.match(/^[a-zA-Z]:\\/);
}
/**
 * Normalize path separators to forward slashes
 */
export function normalizePath(path) {
    return path.replace(/\\/g, '/');
}
/**
 * Simple debounce utility
 */
export function debounce(func, wait) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}
/**
 * Translate CUE error messages into more user-friendly messages
 */
export function translateCueErrors(errorMessage) {
    // Simple translation for common CUE error patterns
    const translations = [
        {
            pattern: /.*undefined field.*/i,
            friendlyMessage: 'This field is not defined in the schema',
            category: 'schema',
        },
        {
            pattern: /.*conflicting values.*/i,
            friendlyMessage: 'Values conflict with schema requirements',
            category: 'validation',
        },
        {
            pattern: /.*cannot unify.*/i,
            friendlyMessage: 'Cannot combine these values according to the schema',
            category: 'type',
        },
        {
            pattern: /.*incomplete value.*/i,
            friendlyMessage: 'This value is missing required information',
            category: 'validation',
        },
    ];
    for (const translation of translations) {
        if (translation.pattern.test(errorMessage)) {
            return [
                {
                    friendlyMessage: translation.friendlyMessage,
                    category: translation.category,
                },
            ];
        }
    }
    // If no pattern matches, return the original message
    return [
        {
            friendlyMessage: errorMessage,
            category: 'validation',
        },
    ];
}
