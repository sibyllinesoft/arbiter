/**
 * Design System Tokens - Graphite Theme
 * Professional minimal design for developer tools
 */

export const colors = {
  // Graphite scale - Primary brand colors
  graphite: {
    50: "#f8fafc", // Almost white, subtle bg
    100: "#f1f5f9", // Light bg, panels
    200: "#e2e8f0", // Subtle borders
    300: "#cbd5e1", // Light borders, disabled text
    400: "#94a3b8", // Placeholder text, icons
    500: "#64748b", // Body text, secondary elements
    600: "#475569", // Headers, strong text
    700: "#334155", // Primary text, headings
    800: "#1e293b", // Dark text, strong emphasis
    900: "#0f172a", // Darkest, high contrast
  },

  // Semantic colors - Complete scales for professional UI
  semantic: {
    // Success - Emerald scale
    success: {
      50: "#ecfdf5",
      100: "#d1fae5",
      200: "#a7f3d0",
      300: "#6ee7b7",
      400: "#34d399",
      500: "#10b981",
      600: "#059669",
      700: "#047857",
      800: "#065f46",
      900: "#064e3b",
    },

    // Warning - Amber scale
    warning: {
      50: "#fffbeb",
      100: "#fef3c7",
      200: "#fde68a",
      300: "#fcd34d",
      400: "#fbbf24",
      500: "#f59e0b",
      600: "#d97706",
      700: "#b45309",
      800: "#92400e",
      900: "#78350f",
    },

    // Error - Red scale
    error: {
      50: "#fef2f2",
      100: "#fee2e2",
      200: "#fecaca",
      300: "#fca5a5",
      400: "#f87171",
      500: "#ef4444",
      600: "#dc2626",
      700: "#b91c1c",
      800: "#991b1b",
      900: "#7f1d1d",
    },

    // Info - Blue scale
    info: {
      50: "#eff6ff",
      100: "#dbeafe",
      200: "#bfdbfe",
      300: "#93c5fd",
      400: "#60a5fa",
      500: "#3b82f6",
      600: "#2563eb",
      700: "#1d4ed8",
      800: "#1e40af",
      900: "#1e3a8a",
    },
  },

  // Accent colors for interactive elements
  accent: {
    primary: "#3b82f6", // Blue - primary actions
    primaryHover: "#2563eb",
    primaryActive: "#1d4ed8",
    primaryFocus: "#3b82f6",

    secondary: "#64748b", // Graphite - secondary actions
    secondaryHover: "#475569",
    secondaryActive: "#334155",
    secondaryFocus: "#64748b",

    ghost: "transparent", // Ghost - subtle actions
    ghostHover: "#f1f5f9",
    ghostActive: "#e2e8f0",
    ghostFocus: "#3b82f6",
  },

  // Background colors
  background: {
    primary: "#ffffff", // Main background
    secondary: "#f8fafc", // Panel backgrounds
    tertiary: "#f1f5f9", // Card backgrounds
    overlay: "rgba(15, 23, 42, 0.4)", // Modal overlays
  },

  // Border colors
  border: {
    subtle: "#e2e8f0", // Light borders
    default: "#cbd5e1", // Standard borders
    strong: "#94a3b8", // Emphasized borders
    focus: "#3b82f6", // Focus rings
    error: "#f87171", // Error borders
    success: "#34d399", // Success borders
    warning: "#fbbf24", // Warning borders
    info: "#60a5fa", // Info borders
  },

  // Text colors
  text: {
    primary: "#0f172a", // Primary text
    secondary: "#334155", // Secondary text
    tertiary: "#64748b", // Subtle text
    quaternary: "#94a3b8", // Very subtle text
    inverse: "#ffffff", // Text on dark backgrounds
    link: "#3b82f6", // Links
    linkHover: "#2563eb", // Link hover
    success: "#047857", // Success text
    warning: "#b45309", // Warning text
    error: "#b91c1c", // Error text
    info: "#1d4ed8", // Info text
  },

  // Interactive state colors for advanced interactions
  interactive: {
    // Hover overlays
    hover: {
      primary: "rgba(59, 130, 246, 0.1)",
      secondary: "rgba(100, 116, 139, 0.1)",
      ghost: "rgba(100, 116, 139, 0.05)",
      danger: "rgba(239, 68, 68, 0.1)",
    },

    // Active/pressed states
    active: {
      primary: "rgba(59, 130, 246, 0.2)",
      secondary: "rgba(100, 116, 139, 0.15)",
      ghost: "rgba(100, 116, 139, 0.1)",
      danger: "rgba(239, 68, 68, 0.15)",
    },

    // Focus ring system
    focus: {
      ring: "#3b82f6",
      ringOffset: "#ffffff",
      ringWidth: "2px",
      ringOpacity: "0.5",
    },
  },

  // Code editor specific colors
  code: {
    background: "#0f172a",
    text: "#f8fafc",
    comment: "#64748b",
    keyword: "#3b82f6",
    string: "#10b981",
    number: "#f59e0b",
    function: "#8b5cf6",
    variable: "#f8fafc",
    selection: "rgba(59, 130, 246, 0.3)",
  },
} as const;

export const typography = {
  fontFamily: {
    sans: [
      "ui-sans-serif",
      "system-ui",
      "-apple-system",
      "BlinkMacSystemFont",
      '"Segoe UI"',
      "Roboto",
      '"Helvetica Neue"',
      "Arial",
      "sans-serif",
    ].join(", "),
    mono: [
      "ui-monospace",
      "SFMono-Regular",
      '"SF Mono"',
      "Monaco",
      "Inconsolata",
      '"Liberation Mono"',
      '"Fira Code"',
      '"Roboto Mono"',
      "monospace",
    ].join(", "),
  },

  fontSize: {
    xs: ["0.75rem", { lineHeight: "1rem" }], // 12px
    sm: ["0.875rem", { lineHeight: "1.25rem" }], // 14px
    base: ["1rem", { lineHeight: "1.5rem" }], // 16px
    lg: ["1.125rem", { lineHeight: "1.75rem" }], // 18px
    xl: ["1.25rem", { lineHeight: "1.75rem" }], // 20px
    "2xl": ["1.5rem", { lineHeight: "2rem" }], // 24px
    "3xl": ["1.875rem", { lineHeight: "2.25rem" }], // 30px
    "4xl": ["2.25rem", { lineHeight: "2.5rem" }], // 36px
  },

  fontWeight: {
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
} as const;

export const spacing = {
  px: "1px",
  0: "0",
  0.5: "0.125rem", // 2px
  1: "0.25rem", // 4px
  1.5: "0.375rem", // 6px
  2: "0.5rem", // 8px
  2.5: "0.625rem", // 10px
  3: "0.75rem", // 12px
  3.5: "0.875rem", // 14px
  4: "1rem", // 16px
  5: "1.25rem", // 20px
  6: "1.5rem", // 24px
  7: "1.75rem", // 28px
  8: "2rem", // 32px
  10: "2.5rem", // 40px
  12: "3rem", // 48px
  16: "4rem", // 64px
  20: "5rem", // 80px
  24: "6rem", // 96px
} as const;

export const borderRadius = {
  none: "0",
  sm: "0.125rem", // 2px
  DEFAULT: "0.25rem", // 4px
  md: "0.375rem", // 6px
  lg: "0.5rem", // 8px
  xl: "0.75rem", // 12px
  "2xl": "1rem", // 16px
  full: "9999px",
} as const;

export const shadows = {
  sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  DEFAULT: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
  md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
  inner: "inset 0 2px 4px 0 rgb(0 0 0 / 0.05)",
  none: "none",
} as const;

export const zIndex = {
  auto: "auto",
  0: "0",
  10: "10",
  20: "20",
  30: "30",
  40: "40",
  50: "50",
  dropdown: "1000",
  sticky: "1020",
  fixed: "1030",
  modal: "1040",
  popover: "1050",
  tooltip: "1060",
  toast: "1070",
} as const;

export const breakpoints = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
} as const;

export const transitions = {
  all: "all 150ms cubic-bezier(0.4, 0, 0.2, 1)",
  colors:
    "color 150ms cubic-bezier(0.4, 0, 0.2, 1), background-color 150ms cubic-bezier(0.4, 0, 0.2, 1), border-color 150ms cubic-bezier(0.4, 0, 0.2, 1)",
  opacity: "opacity 150ms cubic-bezier(0.4, 0, 0.2, 1)",
  shadow: "box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1)",
  transform: "transform 150ms cubic-bezier(0.4, 0, 0.2, 1)",
} as const;
