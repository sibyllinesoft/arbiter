/**
 * Component Variant Patterns
 * Consistent styling patterns for different component states and variants
 */

import { clsx } from 'clsx';

// Base component classes
export const baseClasses = {
  // Focus ring for interactive elements
  focusRing: 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',

  // Transitions
  transition: 'transition-all duration-150 ease-in-out',

  // Typography
  text: {
    xs: 'text-xs',
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
  },

  // Spacing
  spacing: {
    xs: 'px-2 py-1',
    sm: 'px-3 py-1.5',
    md: 'px-4 py-2',
    lg: 'px-6 py-3',
    xl: 'px-8 py-4',
  },

  // Border radius
  rounded: {
    none: 'rounded-none',
    sm: 'rounded-sm',
    md: 'rounded',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    full: 'rounded-full',
  },
} as const;

// Button variants
export const buttonVariants = {
  // Primary button - main actions
  primary: clsx(
    'bg-blue-600 hover:bg-blue-700 active:bg-blue-800',
    'text-white font-medium',
    'border border-transparent',
    'disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed',
    baseClasses.transition,
    baseClasses.focusRing
  ),

  // Secondary button - secondary actions
  secondary: clsx(
    'bg-graphite-100 hover:bg-graphite-200 active:bg-graphite-300',
    'text-graphite-700 font-medium',
    'border border-graphite-300',
    'disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed',
    baseClasses.transition,
    baseClasses.focusRing
  ),

  // Ghost button - subtle actions
  ghost: clsx(
    'bg-transparent hover:bg-graphite-100 active:bg-graphite-200',
    'text-graphite-600 hover:text-graphite-700',
    'border border-transparent',
    'disabled:text-gray-400 disabled:cursor-not-allowed',
    baseClasses.transition,
    baseClasses.focusRing
  ),

  // Danger button - destructive actions
  danger: clsx(
    'bg-red-600 hover:bg-red-700 active:bg-red-800',
    'text-white font-medium',
    'border border-transparent',
    'disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed',
    baseClasses.transition,
    baseClasses.focusRing
  ),
} as const;

// Input variants
export const inputVariants = {
  // Default input
  default: clsx(
    'bg-white border border-graphite-300',
    'text-graphite-900 placeholder:text-graphite-400',
    'hover:border-graphite-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
    'disabled:bg-graphite-50 disabled:text-graphite-500 disabled:cursor-not-allowed disabled:border-graphite-200',
    'outline-none transition-all duration-150'
  ),

  // Error state
  error: clsx(
    'bg-white border border-red-300',
    'text-graphite-900 placeholder:text-graphite-400',
    'hover:border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500',
    'disabled:bg-red-50 disabled:text-red-300 disabled:cursor-not-allowed disabled:border-red-200',
    'outline-none transition-all duration-150'
  ),

  // Warning state
  warning: clsx(
    'bg-white border border-amber-300',
    'text-graphite-900 placeholder:text-graphite-400',
    'hover:border-amber-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500',
    'disabled:bg-amber-50 disabled:text-amber-300 disabled:cursor-not-allowed disabled:border-amber-200',
    'outline-none transition-all duration-150'
  ),

  // Success state
  success: clsx(
    'bg-white border border-emerald-300',
    'text-graphite-900 placeholder:text-graphite-400',
    'hover:border-emerald-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500',
    'disabled:bg-emerald-50 disabled:text-emerald-300 disabled:cursor-not-allowed disabled:border-emerald-200',
    'outline-none transition-all duration-150'
  ),
} as const;

// Card variants
export const cardVariants = {
  // Default card
  default: clsx(
    'bg-white border border-graphite-200',
    'shadow-sm hover:shadow-md',
    'transition-shadow duration-150'
  ),

  // Interactive card (clickable)
  interactive: clsx(
    'bg-white border border-graphite-200',
    'shadow-sm hover:shadow-md hover:border-graphite-300',
    'cursor-pointer transition-all duration-150',
    baseClasses.focusRing
  ),

  // Elevated card
  elevated: clsx(
    'bg-white border border-graphite-200',
    'shadow-md hover:shadow-lg',
    'transition-shadow duration-150'
  ),

  // Outlined card
  outlined: clsx(
    'bg-transparent border-2 border-graphite-300',
    'hover:border-graphite-400 hover:bg-graphite-50',
    'transition-all duration-150'
  ),

  // Ghost card
  ghost: clsx(
    'bg-transparent border-0 shadow-none',
    'hover:bg-graphite-50',
    'transition-colors duration-150'
  ),
} as const;

// Status indicator variants
export const statusVariants = {
  success: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    icon: 'text-emerald-500',
    dot: 'bg-emerald-500',
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    icon: 'text-amber-500',
    dot: 'bg-amber-500',
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    icon: 'text-red-500',
    dot: 'bg-red-500',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    icon: 'text-blue-500',
    dot: 'bg-blue-500',
  },
  neutral: {
    bg: 'bg-graphite-50',
    border: 'border-graphite-200',
    text: 'text-graphite-700',
    icon: 'text-graphite-500',
    dot: 'bg-graphite-500',
  },
} as const;

// Size variants
export const sizeVariants = {
  button: {
    xs: clsx(baseClasses.spacing.xs, baseClasses.text.xs, baseClasses.rounded.sm),
    sm: clsx(baseClasses.spacing.sm, baseClasses.text.sm, baseClasses.rounded.md),
    md: clsx(baseClasses.spacing.md, baseClasses.text.base, baseClasses.rounded.md),
    lg: clsx(baseClasses.spacing.lg, baseClasses.text.lg, baseClasses.rounded.lg),
    xl: clsx(baseClasses.spacing.xl, baseClasses.text.xl, baseClasses.rounded.lg),
  },

  input: {
    sm: clsx('px-3 py-1.5', baseClasses.text.sm, baseClasses.rounded.md),
    md: clsx('px-3 py-2', baseClasses.text.base, baseClasses.rounded.md),
    lg: clsx('px-4 py-3', baseClasses.text.lg, baseClasses.rounded.lg),
  },

  icon: {
    xs: 'h-3 w-3',
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
    xl: 'h-8 w-8',
  },
} as const;

// Animation variants
export const animationVariants = {
  fadeIn: 'animate-in fade-in duration-200',
  fadeOut: 'animate-out fade-out duration-200',
  slideInFromTop: 'animate-in slide-in-from-top-2 duration-200',
  slideInFromBottom: 'animate-in slide-in-from-bottom-2 duration-200',
  slideInFromLeft: 'animate-in slide-in-from-left-2 duration-200',
  slideInFromRight: 'animate-in slide-in-from-right-2 duration-200',
  scaleIn: 'animate-in zoom-in-95 duration-200',
  scaleOut: 'animate-out zoom-out-95 duration-200',
} as const;

// Utility function to create variant classes
export function createVariant(
  base: string,
  variants: Record<string, string>,
  defaultVariant = 'default'
) {
  return (variant?: string) => clsx(base, variants[variant || defaultVariant]);
}

// Utility function to merge classes with variants
export function cn(...classes: (string | undefined | null | false)[]): string {
  return clsx(...classes);
}
