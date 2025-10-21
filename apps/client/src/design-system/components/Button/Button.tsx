/**
 * Button Component - Design System
 * Professional button with comprehensive variants and states
 */

import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from "react";
import { buttonVariants, cn, sizeVariants } from "../../variants";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "size"> {
  /** Button variant determines the visual style */
  variant?: "primary" | "secondary" | "ghost" | "danger";

  /** Button size affects padding and font size */
  size?: "xs" | "sm" | "md" | "lg" | "xl";

  /** Legacy shorthand icon prop (defaults to left side) */
  icon?: ReactNode;

  /** Position for legacy icon prop */
  iconPosition?: "left" | "right";

  /** Whether the button should take full width of container */
  fullWidth?: boolean;

  /** Icon to display before the text */
  leftIcon?: ReactNode;

  /** Icon to display after the text */
  rightIcon?: ReactNode;

  /** Whether the button is in a loading state */
  loading?: boolean;

  /** Custom className for additional styling */
  className?: string;

  /** Button content */
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      icon,
      iconPosition = "left",
      fullWidth = false,
      leftIcon,
      rightIcon,
      loading = false,
      disabled,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const resolvedLeftIcon = leftIcon ?? (icon && iconPosition !== "right" ? icon : undefined);
    const resolvedRightIcon = rightIcon ?? (icon && iconPosition === "right" ? icon : undefined);

    const variantKey =
      variant === "primary" ? "default" : variant === "danger" ? "destructive" : variant;

    const isIconOnly = !children && (resolvedLeftIcon || resolvedRightIcon);
    const buttonClasses = cn(
      // Base styles
      "inline-flex items-center justify-center",
      isIconOnly ? "gap-0 px-2" : "gap-2",
      "font-medium",
      "rounded-md",
      "transition-all duration-150 ease-in-out",
      "focus:outline-none focus:ring-2 focus:ring-offset-2",
      "disabled:pointer-events-none disabled:opacity-60",

      // Variant styles
      buttonVariants[variantKey],

      // Size styles
      sizeVariants.button[size],

      // Full width
      fullWidth && "w-full",

      // Loading state
      loading && "relative text-transparent",

      // Custom className
      className,
    );

    return (
      <button ref={ref} className={buttonClasses} disabled={disabled || loading} {...props}>
        {/* Loading spinner */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          </div>
        )}

        {/* Left icon */}
        {!loading && resolvedLeftIcon && (
          <span
            className={cn("flex-shrink-0", sizeVariants.icon[size], isIconOnly && "text-inherit")}
          >
            {resolvedLeftIcon}
          </span>
        )}

        {/* Button text */}
        {children && <span>{children}</span>}

        {/* Right icon */}
        {!loading && resolvedRightIcon && (
          <span
            className={cn("flex-shrink-0", sizeVariants.icon[size], isIconOnly && "text-inherit")}
          >
            {resolvedRightIcon}
          </span>
        )}
      </button>
    );
  },
);

Button.displayName = "Button";

export default Button;
