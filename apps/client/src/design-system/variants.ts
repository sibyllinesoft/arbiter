import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

export const inputVariants = {
  default:
    'border border-graphite-300 bg-white text-graphite-900 focus:border-graphite-500 focus:ring-2 focus:ring-graphite-200',
  error:
    'border-red-500 bg-red-50/50 text-red-900 focus:border-red-500 focus:ring-2 focus:ring-red-200',
  success:
    'border-green-500 bg-green-50/50 text-green-900 focus:border-green-500 focus:ring-2 focus:ring-green-200',
  warning:
    'border-amber-500 bg-amber-50/50 text-amber-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-200',
} as const;

export const sizeVariants = {
  input: {
    sm: 'h-9 px-3 py-2 text-sm',
    md: 'h-10 px-4 py-2',
    lg: 'h-12 px-4 py-3 text-base',
  },
  icon: {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  },
  button: {
    sm: 'h-9 px-3',
    md: 'h-10 px-4',
    lg: 'h-11 px-8',
  },
} as const;

// Add more variants as needed for other components
export const modalVariants = {
  default: '',
  success: 'border-l-4 border-green-500',
  warning: 'border-l-4 border-amber-500',
  error: 'border-l-4 border-red-500',
  info: 'border-l-4 border-blue-500',
} as const;

export const statusVariants = {
  success: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-700',
    icon: 'text-green-500',
    dot: 'bg-green-500',
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

export const buttonVariants = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  ghost: 'hover:bg-accent hover:text-accent-foreground',
  link: 'text-primary underline-offset-4 hover:underline',
} as const;
