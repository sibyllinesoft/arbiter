import { clsx } from "clsx";
import type { HTMLAttributes } from "react";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "neutral" | "accent";
  size?: "sm" | "md";
}

const sizeClasses: Record<NonNullable<BadgeProps["size"]>, string> = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-sm",
};

const variantClasses: Record<NonNullable<BadgeProps["variant"]>, string> = {
  neutral:
    "bg-graphite-900/60 text-graphite-200 border border-graphite-700/60 shadow-sm shadow-black/10",
  accent: "bg-blue-500/10 text-blue-300 border border-blue-500/30 shadow-sm shadow-blue-900/20",
};

export function Badge({
  variant = "neutral",
  size = "sm",
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center justify-center font-medium rounded-full",
        "backdrop-blur-sm",
        sizeClasses[size],
        variantClasses[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}

export default Badge;
