/**
 * GitHub template validation utilities.
 * Extracted from unified-github-template-manager.ts for modularity.
 */

import type { GitHubFieldValidation } from "@/types.js";

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

/**
 * Check if a value is empty (undefined, null, or empty string)
 */
function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

/**
 * Validate that a required field has a value
 */
function validateRequired(rule: GitHubFieldValidation, value: unknown): ValidationError | null {
  if (!rule.required || !isEmpty(value)) {
    return null;
  }
  return {
    field: rule.field,
    message: rule.errorMessage || `${rule.field} is required`,
    value,
  };
}

/**
 * Validate minimum length constraint
 */
function validateMinLength(rule: GitHubFieldValidation, value: unknown): ValidationError | null {
  if (!rule.minLength || typeof value !== "string") {
    return null;
  }
  if (value.length >= rule.minLength) {
    return null;
  }
  return {
    field: rule.field,
    message: rule.errorMessage || `${rule.field} must be at least ${rule.minLength} characters`,
    value,
  };
}

/**
 * Validate maximum length constraint
 */
function validateMaxLength(rule: GitHubFieldValidation, value: unknown): ValidationError | null {
  if (!rule.maxLength || typeof value !== "string") {
    return null;
  }
  if (value.length <= rule.maxLength) {
    return null;
  }
  return {
    field: rule.field,
    message: rule.errorMessage || `${rule.field} must be no more than ${rule.maxLength} characters`,
    value,
  };
}

/**
 * Validate enum constraint
 */
function validateEnum(rule: GitHubFieldValidation, value: unknown): ValidationError | null {
  if (!rule.enum || rule.enum.includes(value as string)) {
    return null;
  }
  return {
    field: rule.field,
    message: rule.errorMessage || `${rule.field} must be one of: ${rule.enum.join(", ")}`,
    value,
  };
}

/**
 * Validate individual field against rules
 */
export function validateField(rule: GitHubFieldValidation, value: unknown): ValidationError[] {
  // Check required first and return early if missing
  const requiredError = validateRequired(rule, value);
  if (requiredError) {
    return [requiredError];
  }

  // Skip other validations if value is empty
  if (isEmpty(value)) {
    return [];
  }

  // Run all constraint validators and collect errors
  const validators = [validateMinLength, validateMaxLength, validateEnum];
  const errors: ValidationError[] = [];

  for (const validator of validators) {
    const error = validator(rule, value);
    if (error) {
      errors.push(error);
    }
  }

  return errors;
}

/**
 * Validate template data against configuration validation rules
 */
export function validateTemplateDataAgainstRules(
  data: any,
  validationRules: GitHubFieldValidation[],
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const rule of validationRules) {
    const value = data[rule.field];
    const fieldErrors = validateField(rule, value);
    errors.push(...fieldErrors);
  }

  return errors;
}

/**
 * Throw validation error if any errors exist
 */
export function throwIfValidationErrors(errors: ValidationError[]): void {
  if (errors.length > 0) {
    const errorMessages = errors.map((e) => `${e.field}: ${e.message}`);
    throw new Error(`Template validation failed: ${errorMessages.join(", ")}`);
  }
}
