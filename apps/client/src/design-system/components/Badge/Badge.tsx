/**
 * Badge Component - Design System
 * Versatile badge for status, tags, and metrics with dark mode support
 */
import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "../../utils";

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  /** Badge variant determines color scheme */
  variant?: "default" | "secondary" | "destructive" | "outline";
  /** Badge size affects padding and font size */
  size?: "xs" | "sm" | "md" | "lg";
  /** Whether badge is clickable */
  clickable?: boolean;
  /** Custom className for additional styling */
  className?: string;
}

const variantStyles = {
  default:
    "bg-primary text-primary-foreground/70 hover:bg-primary/90 dark:bg-primary/80 dark:text-primary-foreground/70",
  secondary:
    "bg-secondary text-secondary-foreground/70 hover:bg-secondary/80 dark:bg-secondary/80 dark:text-secondary-foreground/70",
  destructive:
    "bg-destructive text-destructive-foreground/70 hover:bg-destructive/90 dark:bg-destructive/80 dark:text-destructive-foreground/70",
  outline: "text-foreground/70 border dark:border-graphite-600 dark:text-foreground/70",
};

const sizeStyles = {
  xs: "text-xs px-1.5 py-0.5",
  sm: "text-xs px-2 py-1",
  md: "text-sm px-2.5 py-1",
  lg: "text-base px-3 py-1.5",
};

export const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = "default", size = "sm", clickable = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-md border font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          sizeStyles[size],
          variant !== "outline" && "border-transparent",
          variantStyles[variant],
          clickable && "cursor-pointer hover:opacity-80",
          className,
        )}
        {...props}
      />
    );
  },
);

Badge.displayName = "Badge";

export default Badge;
