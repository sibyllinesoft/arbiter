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
  if (!input || input.trim() === "") {
    return {};
  }

  const trimmed = input.trim();

  // Try to parse as JSON first
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
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
  const parts = smartSplit(input, ",");

  for (const part of parts) {
    const trimmedPart = part.trim();
    if (!trimmedPart) continue;

    if (trimmedPart.includes("=")) {
      // Key=value pair
      const [key, ...valueParts] = trimmedPart.split("=");
      const value = valueParts.join("="); // Handle cases where value contains '='

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
 * Value parser definition for property parsing
 */
type ValueParser = (value: string) => { matched: boolean; result?: any };

/**
 * Try to strip surrounding quotes from a value
 */
function tryParseQuotedString(value: string): { matched: boolean; result?: string } {
  const isDoubleQuoted = value.startsWith('"') && value.endsWith('"');
  const isSingleQuoted = value.startsWith("'") && value.endsWith("'");
  if (isDoubleQuoted || isSingleQuoted) {
    return { matched: true, result: value.slice(1, -1) };
  }
  return { matched: false };
}

/**
 * Try to parse as a literal keyword (true, false, null, undefined)
 */
function tryParseLiteral(value: string): { matched: boolean; result?: any } {
  const literals: Record<string, any> = {
    true: true,
    false: false,
    null: null,
    undefined: undefined,
  };
  if (value in literals) {
    return { matched: true, result: literals[value] };
  }
  return { matched: false };
}

/**
 * Try to parse as an integer
 */
function tryParseInteger(value: string): { matched: boolean; result?: number } {
  if (/^-?\d+$/.test(value)) {
    return { matched: true, result: parseInt(value, 10) };
  }
  return { matched: false };
}

/**
 * Try to parse as a float
 */
function tryParseFloat(value: string): { matched: boolean; result?: number } {
  if (/^-?\d*\.\d+$/.test(value)) {
    return { matched: true, result: parseFloat(value) };
  }
  return { matched: false };
}

/**
 * Try to parse as an array
 */
function tryParseArray(value: string): { matched: boolean; result?: any[] } {
  if (!value.startsWith("[") || !value.endsWith("]")) {
    return { matched: false };
  }
  try {
    return { matched: true, result: JSON.parse(value) };
  } catch {
    // Fallback: split by comma and recursively parse
    const inner = value.slice(1, -1);
    return {
      matched: true,
      result: smartSplit(inner, ",").map((item) => parsePropertyValue(item)),
    };
  }
}

/**
 * Try to parse as an object
 */
function tryParseObject(value: string): { matched: boolean; result?: any } {
  if (!value.startsWith("{") || !value.endsWith("}")) {
    return { matched: false };
  }
  try {
    return { matched: true, result: JSON.parse(value) };
  } catch (error: any) {
    throw new Error(`Invalid object format: ${error.message}`);
  }
}

/**
 * Ordered list of value parsers to try
 */
const VALUE_PARSERS: ValueParser[] = [
  tryParseQuotedString,
  tryParseLiteral,
  tryParseInteger,
  tryParseFloat,
  tryParseArray,
  tryParseObject,
];

/**
 * Parse a property value with type inference
 */
function parsePropertyValue(value: string): any {
  const trimmed = value.trim();

  for (const parser of VALUE_PARSERS) {
    const result = parser(trimmed);
    if (result.matched) {
      return result.result;
    }
  }

  // Default: return as string
  return trimmed;
}

/**
 * State for the smart split parser
 */
interface SplitParserState {
  parts: string[];
  current: string;
  inQuotes: boolean;
  quoteChar: string;
  depth: number;
}

/**
 * Smart split that respects quoted strings and nested structures
 */
function smartSplit(input: string, delimiter: string): string[] {
  const state: SplitParserState = {
    parts: [],
    current: "",
    inQuotes: false,
    quoteChar: "",
    depth: 0,
  };

  for (const char of input) {
    processChar(char, delimiter, state);
  }

  if (state.current) {
    state.parts.push(state.current);
  }

  return state.parts;
}

/**
 * Process a single character in the smart split parser
 */
function processChar(char: string, delimiter: string, state: SplitParserState): void {
  if (handleQuoteStart(char, state)) return;
  if (handleQuoteEnd(char, state)) return;
  if (handleNestingOpen(char, state)) return;
  if (handleNestingClose(char, state)) return;
  if (handleDelimiter(char, delimiter, state)) return;

  state.current += char;
}

function handleQuoteStart(char: string, state: SplitParserState): boolean {
  if (!state.inQuotes && (char === '"' || char === "'")) {
    state.inQuotes = true;
    state.quoteChar = char;
    state.current += char;
    return true;
  }
  return false;
}

function handleQuoteEnd(char: string, state: SplitParserState): boolean {
  if (state.inQuotes && char === state.quoteChar) {
    state.inQuotes = false;
    state.quoteChar = "";
    state.current += char;
    return true;
  }
  return false;
}

function handleNestingOpen(char: string, state: SplitParserState): boolean {
  if (!state.inQuotes && (char === "{" || char === "[")) {
    state.depth++;
    state.current += char;
    return true;
  }
  return false;
}

function handleNestingClose(char: string, state: SplitParserState): boolean {
  if (!state.inQuotes && (char === "}" || char === "]")) {
    state.depth--;
    state.current += char;
    return true;
  }
  return false;
}

function handleDelimiter(char: string, delimiter: string, state: SplitParserState): boolean {
  if (!state.inQuotes && state.depth === 0 && char === delimiter) {
    state.parts.push(state.current);
    state.current = "";
    return true;
  }
  return false;
}

/**
 * Parse list-based options (e.g., --exports, --functions)
 * Supports comma-separated values with enhanced ergonomics
 */
export function parseListOption(input: string | undefined): string[] {
  if (!input || input.trim() === "") {
    return [];
  }

  return smartSplit(input.trim(), ",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/**
 * Format properties for display
 */
export function formatProperties(properties: ParsedProperties): string {
  const entries = Object.entries(properties);

  if (entries.length === 0) {
    return "(none)";
  }

  return entries
    .map(([key, value]) => {
      if (typeof value === "string") {
        return `${key}: "${value}"`;
      }
      return `${key}: ${JSON.stringify(value)}`;
    })
    .join(", ");
}

/**
 * Validate property names against allowed patterns
 */
export function validatePropertyNames(
  properties: ParsedProperties,
  allowedPatterns: string[] = [],
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const key of Object.keys(properties)) {
    // Check for valid identifier pattern
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
      errors.push(`Invalid property name: "${key}" (must be a valid identifier)`);
    }

    // Check against allowed patterns if provided
    if (allowedPatterns.length > 0) {
      const matches = allowedPatterns.some((pattern) => {
        if (pattern.includes("*")) {
          const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
          return regex.test(key);
        }
        return pattern === key;
      });

      if (!matches) {
        errors.push(
          `Property "${key}" not allowed. Allowed patterns: ${allowedPatterns.join(", ")}`,
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
      .join(",");
  },

  /**
   * Convert to simple comma-separated list (for boolean properties)
   */
  toSimpleList(properties: ParsedProperties): string {
    return Object.entries(properties)
      .filter(([_, value]) => value === true)
      .map(([key]) => key)
      .join(",");
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
