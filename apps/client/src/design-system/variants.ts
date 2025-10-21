import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

export const inputVariants = {
  default: cn(
    "border border-gray-200 dark:border-gray-700",
    "bg-white dark:bg-graphite-950",
    "text-gray-900 dark:text-graphite-50",
    "hover:border-graphite-400 dark:hover:border-graphite-500",
    "focus:border-blue-500 dark:focus:border-blue-400",
    "focus:ring-blue-500 dark:focus:ring-blue-400",
  ),
  error: cn(
    "border border-red-300 dark:border-red-400",
    "bg-white dark:bg-graphite-950",
    "text-gray-900 dark:text-graphite-50",
    "hover:border-red-400 dark:hover:border-red-500",
    "focus:border-red-500 dark:focus:border-red-400",
    "focus:ring-red-500 dark:focus:ring-red-400",
  ),
  success: cn(
    "border border-emerald-300 dark:border-emerald-400",
    "bg-white dark:bg-graphite-950",
    "text-gray-900 dark:text-graphite-50",
    "hover:border-emerald-400 dark:hover:border-emerald-500",
    "focus:border-emerald-500 dark:focus:border-emerald-400",
    "focus:ring-emerald-500 dark:focus:ring-emerald-400",
  ),
  warning: cn(
    "border border-amber-300 dark:border-amber-400",
    "bg-white dark:bg-graphite-950",
    "text-gray-900 dark:text-graphite-50",
    "hover:border-amber-400 dark:hover:border-amber-500",
    "focus:border-amber-500 dark:focus:border-amber-400",
    "focus:ring-amber-500 dark:focus:ring-amber-400",
  ),
} as const;

export const sizeVariants = {
  input: {
    sm: "h-9 px-3 py-1.5 text-sm rounded-md",
    md: "h-10 px-3 py-2 rounded-md",
    lg: "h-12 px-4 py-3 text-base rounded-lg",
  },
  icon: {
    xs: "h-3 w-3",
    sm: "h-3.5 w-3.5",
    md: "h-5 w-5",
    lg: "h-6 w-6",
    xl: "h-7 w-7",
  },
  button: {
    xs: "h-8 px-2 text-xs",
    sm: "h-10 px-4 text-sm",
    md: "h-10 px-4 text-sm",
    lg: "h-11 px-8 text-base",
    xl: "h-12 px-10 text-lg",
  },
} as const;

// Add more variants as needed for other components
export const modalVariants = {
  default: "",
  success: "border-l-4 border-green-500",
  warning: "border-l-4 border-amber-500",
  error: "border-l-4 border-red-500",
  info: "border-l-4 border-blue-500",
} as const;

export const statusVariants = {
  success: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    icon: "text-emerald-500",
    dot: "bg-emerald-500",
  },
  warning: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    icon: "text-amber-500",
    dot: "bg-amber-500",
  },
  error: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
    icon: "text-red-500",
    dot: "bg-red-500",
  },
  info: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
    icon: "text-blue-500",
    dot: "bg-blue-500",
  },
  neutral: {
    bg: "bg-graphite-50",
    border: "border-graphite-200",
    text: "text-graphite-700",
    icon: "text-graphite-500",
    dot: "bg-graphite-500",
  },
} as const;

export const buttonVariants = {
  default:
    "bg-blue-600 text-white hover:bg-blue-700/90 dark:bg-blue-500 dark:text-white dark:hover:bg-blue-600/90",
  destructive: "bg-red-600 dark:bg-red-500 text-white hover:bg-red-700/90 dark:hover:bg-red-600/90",
  outline:
    "border border-input bg-background hover:bg-accent hover:text-accent-foreground dark:border-graphite-700 dark:bg-graphite-950 dark:hover:bg-graphite-700 dark:text-graphite-50",
  secondary:
    "bg-secondary text-secondary-foreground hover:bg-secondary/80 dark:bg-graphite-700 dark:text-graphite-50 dark:hover:bg-graphite-600",
  ghost:
    "text-gray-900 dark:text-graphite-50 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-graphite-800 dark:hover:text-graphite-100",
  link: "text-primary underline-offset-4 hover:underline dark:text-blue-400",
} as const;
