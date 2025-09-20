import { existsSync } from 'node:fs';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Generic webhook event structure
 */
export interface WebhookEvent {
  id: string;
  timestamp: string;
  provider: 'github' | 'gitlab' | 'bitbucket' | 'azure-devops';
  eventType: string;
  payload: Record<string, any>;
  headers: Record<string, string>;
  signature?: string;
}

/**
 * Handler response structure
 */
export interface HandlerResponse {
  success: boolean;
  message: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

/**
 * Payload validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Log event data
 */
export interface LogEvent {
  type: string;
  timestamp: string;
  [key: string]: any;
}

/**
 * Creates a standardized handler response
 */
export function createResponse(
  success: boolean,
  message: string,
  metadata?: Record<string, any>
): HandlerResponse {
  return {
    success,
    message,
    metadata,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Validates webhook payload has required fields
 */
export function validatePayload(payload: any, requiredFields: string[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if payload exists
  if (!payload || typeof payload !== 'object') {
    errors.push('Payload is missing or invalid');
    return { isValid: false, errors, warnings };
  }

  // Check required fields
  for (const field of requiredFields) {
    if (!(field in payload)) {
      errors.push(`Required field '${field}' is missing`);
    } else if (payload[field] === null || payload[field] === undefined) {
      errors.push(`Required field '${field}' is null or undefined`);
    }
  }

  // Check for empty objects in critical fields
  const criticalFields = ['repository', 'project', 'pull_request', 'object_attributes'];
  for (const field of criticalFields) {
    if (field in payload && typeof payload[field] === 'object') {
      const obj = payload[field];
      if (obj && Object.keys(obj).length === 0) {
        warnings.push(`Field '${field}' is an empty object`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Logs events to a file for debugging and audit purposes
 */
export async function logEvent(event: LogEvent): Promise<void> {
  try {
    const logsDir = join(process.cwd(), 'logs', 'handlers');

    // Ensure logs directory exists
    if (!existsSync(logsDir)) {
      await mkdir(logsDir, { recursive: true });
    }

    const logFile = join(logsDir, `${new Date().toISOString().split('T')[0]}.log`);
    const logEntry = `${JSON.stringify(event)}\n`;

    await appendFile(logFile, logEntry, 'utf8');
  } catch (error) {
    // Fail silently for logging errors to avoid breaking the handler
    console.error('Failed to log event:', error);
  }
}

/**
 * Validates webhook signatures (placeholder implementation)
 */
export function validateSignature(
  payload: string,
  signature: string,
  secret: string,
  provider: string
): boolean {
  // This is a placeholder implementation
  // In production, you would implement proper HMAC validation for each provider

  if (!signature || !secret) {
    return false;
  }

  // GitHub uses SHA256 with X-Hub-Signature-256
  // GitLab uses SHA256 with X-Gitlab-Token
  // Implementation would vary by provider

  console.warn(`Signature validation not implemented for ${provider}`);
  return true; // Return true for demo purposes
}

/**
 * Sanitizes sensitive data from payloads before logging
 */
export function sanitizePayload(payload: any): any {
  const sensitiveFields = [
    'token',
    'secret',
    'password',
    'key',
    'auth',
    'authorization',
    'x-hub-signature',
    'x-gitlab-token',
  ];

  function sanitizeObject(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }

    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveFields.some(field => lowerKey.includes(field))) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = sanitizeObject(value);
        }
      }
      return sanitized;
    }

    return obj;
  }

  return sanitizeObject(payload);
}

/**
 * Extracts common repository information from different providers
 */
export function extractRepositoryInfo(
  payload: any,
  provider: string
): {
  name: string;
  fullName: string;
  url: string;
} | null {
  try {
    switch (provider) {
      case 'github':
        if (payload.repository) {
          return {
            name: payload.repository.name,
            fullName: payload.repository.full_name,
            url: payload.repository.html_url,
          };
        }
        break;

      case 'gitlab':
        if (payload.project) {
          return {
            name: payload.project.name,
            fullName: payload.project.path_with_namespace,
            url: payload.project.web_url,
          };
        }
        break;

      default:
        console.warn(`Repository extraction not implemented for ${provider}`);
        return null;
    }
  } catch (error) {
    console.error('Error extracting repository info:', error);
  }

  return null;
}

/**
 * Utility to check if a branch is a protected/main branch
 */
export function isProtectedBranch(branchName: string): boolean {
  const protectedBranches = ['main', 'master', 'develop', 'staging', 'production'];
  return protectedBranches.includes(branchName.toLowerCase());
}

/**
 * Utility to check if a branch follows naming conventions
 */
export function validateBranchNaming(branchName: string): {
  isValid: boolean;
  type: string;
  errors: string[];
} {
  const errors: string[] = [];
  let type = 'unknown';
  let isValid = false;

  // Feature branches
  if (branchName.startsWith('feature/')) {
    type = 'feature';
    const pattern = /^feature\/[a-z0-9-]+$/;
    isValid = pattern.test(branchName);
    if (!isValid) {
      errors.push('Feature branches should follow pattern: feature/kebab-case-name');
    }
  }
  // Hotfix branches
  else if (branchName.startsWith('hotfix/')) {
    type = 'hotfix';
    const pattern = /^hotfix\/[a-z0-9-]+$/;
    isValid = pattern.test(branchName);
    if (!isValid) {
      errors.push('Hotfix branches should follow pattern: hotfix/kebab-case-name');
    }
  }
  // Bugfix branches
  else if (branchName.startsWith('bugfix/')) {
    type = 'bugfix';
    const pattern = /^bugfix\/[a-z0-9-]+$/;
    isValid = pattern.test(branchName);
    if (!isValid) {
      errors.push('Bugfix branches should follow pattern: bugfix/kebab-case-name');
    }
  }
  // Release branches
  else if (branchName.startsWith('release/')) {
    type = 'release';
    const pattern = /^release\/v?\d+\.\d+(\.\d+)?$/;
    isValid = pattern.test(branchName);
    if (!isValid) {
      errors.push('Release branches should follow pattern: release/v1.2.3 or release/1.2.3');
    }
  }
  // Protected branches
  else if (isProtectedBranch(branchName)) {
    type = 'protected';
    isValid = true; // Protected branches are always valid
  }
  // Unknown pattern
  else {
    errors.push('Branch does not follow any recognized naming convention');
  }

  return { isValid, type, errors };
}

/**
 * Utility to validate conventional commit messages
 */
export function validateConventionalCommit(message: string): {
  isValid: boolean;
  type: string;
  errors: string[];
} {
  const errors: string[] = [];
  const conventionalPattern =
    /^(feat|fix|docs|style|refactor|test|chore|ci|perf|revert)(\(.+\))?: .+/;
  const match = message.match(conventionalPattern);

  if (!match) {
    errors.push(
      'Commit message should follow conventional commit format: type(scope): description'
    );
    return { isValid: false, type: 'unknown', errors };
  }

  const type = match[1];
  const hasScope = !!match[2];
  const description = message.substring(match[0].length - message.split(':')[1].length + 1);

  // Additional validation
  if (description.length < 1) {
    errors.push('Commit description cannot be empty');
  }

  if (description.length > 72) {
    errors.push('Commit description should be 72 characters or less');
  }

  if (description.startsWith(' ')) {
    errors.push('Commit description should not start with a space');
  }

  if (description.endsWith('.')) {
    errors.push('Commit description should not end with a period');
  }

  return {
    isValid: errors.length === 0,
    type,
    errors,
  };
}
