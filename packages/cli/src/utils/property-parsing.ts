/**
 * Enhanced property parsing utilities for CLI arguments
 * Supports comma-separated values and various input formats
 */

export interface ParsedProperties {
  [key: string]: any;
}

/**
 * Parse properties from various formats with enhanced ergonomics
 * Supports:
 * - Comma-separated: "intent,size,loading"
 * - Key=value pairs: "intent=primary,size=lg,loading=true"
 * - JSON: '{"intent":"primary","size":"lg"}'
 * - Mixed: "intent,size=lg,loading"
 */
export function parseProperties(input: string): ParsedProperties {
  if (!input || input.trim() === '') {
    return {};
  }

  const trimmed = input.trim();

  // Try to parse as JSON first
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      throw new Error(`Invalid JSON format: ${error.message}`);
    }
  }

  // Parse as comma-separated list with optional key=value pairs
  return parseCommaDelimitedProperties(trimmed);
}

/**
 * Parse comma-delimited properties supporting both simple names and key=value pairs
 */
function parseCommaDelimitedProperties(input: string): ParsedProperties {
  const properties: ParsedProperties = {};

  // Split by comma, but respect quoted values
  const parts = smartSplit(input, ',');

  for (const part of parts) {
    const trimmedPart = part.trim();
    if (!trimmedPart) continue;

    if (trimmedPart.includes('=')) {
      // Key=value pair
      const [key, ...valueParts] = trimmedPart.split('=');
      const value = valueParts.join('='); // Handle cases where value contains '='

      if (!key.trim()) {
        throw new Error(`Invalid property format: "${trimmedPart}" (missing key)`);
      }

      properties[key.trim()] = parsePropertyValue(value);
    } else {
      // Simple property name (boolean true)
      properties[trimmedPart] = true;
    }
  }

  return properties;
}

/**
 * Parse a property value with type inference
 */
function parsePropertyValue(value: string): any {
  const trimmed = value.trim();

  // Remove surrounding quotes if present
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  // Boolean values
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;

  // Null/undefined
  if (trimmed === 'null') return null;
  if (trimmed === 'undefined') return undefined;

  // Numbers
  if (/^-?\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }
  if (/^-?\d*\.\d+$/.test(trimmed)) {
    return parseFloat(trimmed);
  }

  // Arrays (simple format: [item1,item2,item3])
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // Fallback: split by comma
      const inner = trimmed.slice(1, -1);
      return smartSplit(inner, ',').map(item => parsePropertyValue(item));
    }
  }

  // Objects (JSON format)
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      throw new Error(`Invalid object format: ${error.message}`);
    }
  }

  // Default: return as string
  return trimmed;
}

/**
 * Smart split that respects quoted strings and nested structures
 */
function smartSplit(input: string, delimiter: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';
  let depth = 0;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (!inQuotes && (char === '"' || char === "'")) {
      inQuotes = true;
      quoteChar = char;
      current += char;
    } else if (inQuotes && char === quoteChar) {
      inQuotes = false;
      quoteChar = '';
      current += char;
    } else if (!inQuotes && (char === '{' || char === '[')) {
      depth++;
      current += char;
    } else if (!inQuotes && (char === '}' || char === ']')) {
      depth--;
      current += char;
    } else if (!inQuotes && depth === 0 && char === delimiter) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

/**
 * Parse list-based options (e.g., --exports, --functions)
 * Supports comma-separated values with enhanced ergonomics
 */
export function parseListOption(input: string | undefined): string[] {
  if (!input || input.trim() === '') {
    return [];
  }

  return smartSplit(input.trim(), ',')
    .map(item => item.trim())
    .filter(item => item.length > 0);
}

/**
 * Format properties for display
 */
export function formatProperties(properties: ParsedProperties): string {
  const entries = Object.entries(properties);

  if (entries.length === 0) {
    return '(none)';
  }

  return entries
    .map(([key, value]) => {
      if (typeof value === 'string') {
        return `${key}: "${value}"`;
      }
      return `${key}: ${JSON.stringify(value)}`;
    })
    .join(', ');
}

/**
 * Validate property names against allowed patterns
 */
export function validatePropertyNames(
  properties: ParsedProperties,
  allowedPatterns: string[] = []
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const key of Object.keys(properties)) {
    // Check for valid identifier pattern
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
      errors.push(`Invalid property name: "${key}" (must be a valid identifier)`);
    }

    // Check against allowed patterns if provided
    if (allowedPatterns.length > 0) {
      const matches = allowedPatterns.some(pattern => {
        if (pattern.includes('*')) {
          const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
          return regex.test(key);
        }
        return pattern === key;
      });

      if (!matches) {
        errors.push(
          `Property "${key}" not allowed. Allowed patterns: ${allowedPatterns.join(', ')}`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Merge multiple property sources with precedence
 * Later sources override earlier ones
 */
export function mergeProperties(...sources: ParsedProperties[]): ParsedProperties {
  return Object.assign({}, ...sources);
}

/**
 * Convert properties to different formats
 */
export const PropertyFormatters = {
  /**
   * Convert to JSON string
   */
  toJSON(properties: ParsedProperties): string {
    return JSON.stringify(properties, null, 2);
  },

  /**
   * Convert to key=value format
   */
  toKeyValue(properties: ParsedProperties): string {
    return Object.entries(properties)
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
      .join(',');
  },

  /**
   * Convert to simple comma-separated list (for boolean properties)
   */
  toSimpleList(properties: ParsedProperties): string {
    return Object.entries(properties)
      .filter(([_, value]) => value === true)
      .map(([key]) => key)
      .join(',');
  },

  /**
   * Convert to CLI arguments format
   */
  toCLIArgs(properties: ParsedProperties): string[] {
    const args: string[] = [];

    for (const [key, value] of Object.entries(properties)) {
      if (value === true) {
        args.push(`--${key}`);
      } else if (value === false) {
        args.push(`--no-${key}`);
      } else {
        args.push(`--${key}`, String(value));
      }
    }

    return args;
  },
};
