/**
 * Design System Utilities
 * Common utilities for the design system components
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * cn - ClassName utility function
 * Combines class names using clsx and twMerge for Tailwind CSS
 * @param inputs - Class values to merge
 * @returns Merged class name string
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
