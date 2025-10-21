/**
 * Design System Tokens - Professional Graphite Theme
 * Modern dark-first design for developer tools
 *
 * Semantic Role Mappings:
 * - Background: graphite-950, graphite-900
 * - Surface: graphite-800, graphite-700
 * - Border: graphite-600, graphite-500
 * - Primary: blue-600, blue-400, blue-300
 * - Secondary: purple-600, purple-400
 * - Success: green-500, Warning: gold-500, Danger: red-500
 * - Subtle: *-300, *-200 (subtle variants)
 */

export const colors = {
  // New Professional Graphite Scale
  graphite: {
    950: "#0F1115", // Deepest dark - main backgrounds
    900: "#141821", // Dark backgrounds
    800: "#1B2130", // Surface backgrounds
    700: "#242B3A", // Elevated surfaces
    600: "#2F394B", // Borders, dividers
    500: "#3B475C", // Strong borders
    400: "#50617A", // Secondary text, icons
    300: "#6B7A92", // Tertiary text
    200: "#8C97AA", // Subtle text
    100: "#B3BBC8", // Light text
    50: "#D7DCE5", // Very light text
    25: "#EEF1F5", // Almost white
  },

  // Semantic colors - Refined professional palette
  semantic: {
    // Success - Professional green scale
    success: {
      800: "#0C2E28",
      700: "#0F3B33",
      600: "#155246",
      500: "#1D6A5B",
      400: "#2A8372",
      300: "#45A190",
      200: "#79C0B0",
      100: "#B2DDD1",
      50: "#E6F4F1",
    },

    // Warning - Professional gold scale
    warning: {
      800: "#3D2E0C",
      700: "#4A3810",
      600: "#5D4614",
      500: "#725718",
      400: "#8A6A1D",
      300: "#A6842A",
      200: "#C8A656",
      100: "#E0C98D",
      50: "#FEF8E6",
    },

    // Error - Professional red scale
    error: {
      700: "#4A1B1B",
      600: "#662626",
      500: "#803131",
      400: "#9C3D3D",
      300: "#BA5956",
      200: "#D98A86",
      100: "#E8B7B3",
    },

    // Info/Primary - Professional blue scale
    info: {
      900: "#0B1F3B",
      800: "#102A4C",
      700: "#163759",
      600: "#1E466B",
      500: "#25557E",
      400: "#2F6B9A",
      300: "#3E82B6",
      200: "#6FA3C7",
      100: "#A9C7DF",
      50: "#D8E6F3",
    },

    // Secondary - Professional purple scale
    secondary: {
      900: "#1D1133",
      800: "#281845",
      700: "#31205A",
      600: "#3A2A70",
      500: "#4A378B",
      400: "#5C49A3",
      300: "#7666B9",
      200: "#A19BD2",
      100: "#C9C3E6",
      50: "#E7E6F5",
    },
  },

  // Accent colors for interactive elements (mapped to new palette)
  accent: {
    primary: "#1E466B", // Blue-600 - primary actions
    primaryHover: "#2F6B9A", // Blue-400
    primaryActive: "#3E82B6", // Blue-300
    primaryFocus: "#1E466B", // Blue-600

    secondary: "#3A2A70", // Purple-600 - secondary actions
    secondaryHover: "#5C49A3", // Purple-400
    secondaryActive: "#7666B9", // Purple-300
    secondaryFocus: "#3A2A70", // Purple-600

    ghost: "transparent", // Ghost - subtle actions
    ghostHover: "#242B3A", // Graphite-700
    ghostActive: "#2F394B", // Graphite-600
    ghostFocus: "#1E466B", // Blue-600
  },

  // Background colors (mapped to new palette)
  background: {
    primary: "#0F1115", // Graphite-950 - main dark background
    secondary: "#141821", // Graphite-900 - panel backgrounds
    tertiary: "#1B2130", // Graphite-800 - card backgrounds
    overlay: "rgba(15, 17, 21, 0.8)", // Modal overlays with new dark base
  },

  // Border colors (mapped to new palette)
  border: {
    subtle: "#2F394B", // Graphite-600 - light borders
    default: "#3B475C", // Graphite-500 - standard borders
    strong: "#50617A", // Graphite-400 - emphasized borders
    focus: "#1E466B", // Blue-600 - focus rings
    error: "#803131", // Red-500 - error borders
    success: "#1D6A5B", // Green-500 - success borders
    warning: "#725718", // Gold-500 - warning borders
    info: "#25557E", // Blue-500 - info borders
  },

  // Text colors (mapped to new palette)
  text: {
    primary: "#EEF1F5", // Graphite-25 - primary text on dark
    secondary: "#D7DCE5", // Graphite-50 - secondary text
    tertiary: "#B3BBC8", // Graphite-100 - subtle text
    quaternary: "#8C97AA", // Graphite-200 - very subtle text
    inverse: "#0F1115", // Text on light backgrounds
    link: "#2F6B9A", // Blue-400 - links
    linkHover: "#3E82B6", // Blue-300 - link hover
    success: "#45A190", // Green-300 - success text
    warning: "#A6842A", // Gold-300 - warning text
    error: "#BA5956", // Red-300 - error text
    info: "#3E82B6", // Blue-300 - info text
  },

  // Interactive state colors for advanced interactions (mapped to new palette)
  interactive: {
    // Hover overlays
    hover: {
      primary: "rgba(30, 70, 107, 0.1)", // Blue-600
      secondary: "rgba(58, 42, 112, 0.1)", // Purple-600
      ghost: "rgba(59, 71, 92, 0.05)", // Graphite-400
      danger: "rgba(128, 49, 49, 0.1)", // Red-500
    },

    // Active/pressed states
    active: {
      primary: "rgba(30, 70, 107, 0.2)", // Blue-600
      secondary: "rgba(58, 42, 112, 0.15)", // Purple-600
      ghost: "rgba(59, 71, 92, 0.1)", // Graphite-400
      danger: "rgba(128, 49, 49, 0.15)", // Red-500
    },

    // Focus ring system
    focus: {
      ring: "#1E466B", // Blue-600
      ringOffset: "#0F1115", // Graphite-950
      ringWidth: "2px",
      ringOpacity: "0.5",
    },
  },

  // Code editor specific colors (mapped to new palette)
  code: {
    background: "#0F1115", // Graphite-950
    text: "#EEF1F5", // Graphite-25
    comment: "#6B7A92", // Graphite-300
    keyword: "#2F6B9A", // Blue-400
    string: "#45A190", // Green-300
    number: "#A6842A", // Gold-300
    function: "#7666B9", // Purple-300
    variable: "#EEF1F5", // Graphite-25
    selection: "rgba(30, 70, 107, 0.3)", // Blue-600
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
