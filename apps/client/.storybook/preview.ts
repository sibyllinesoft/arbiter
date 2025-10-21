import type { Preview } from "@storybook/react";
import "../src/index.css";

// Import design tokens for consistent theming
import { colors } from "../src/design-system/tokens";

// Import decorators
import { DesignSystemDecorator } from "./decorators";

const preview: Preview = {
  parameters: {
    // Enhanced action detection
    actions: {
      argTypesRegex: "^on[A-Z].*",
      handles: ["mouseover", "click .btn"],
    },

    // Improved controls configuration
    controls: {
      expanded: true,
      sort: "requiredFirst",
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    // Enhanced documentation
    docs: {
      toc: {
        contentsSelector: ".sbdocs-content",
        headingSelector: "h1, h2, h3",
        ignoreSelector: "#primary",
        title: "Table of Contents",
        disable: false,
        unsafeTocbotOptions: {
          orderedList: false,
        },
      },
      source: {
        state: "open",
        excludeDecorators: true,
      },
    },

    // Comprehensive background options using design tokens
    backgrounds: {
      default: "light",
      grid: {
        cellSize: 20,
        opacity: 0.1,
        cellAmount: 5,
      },
      values: [
        { name: "Pure White", value: "#ffffff" },
        { name: "Graphite 25", value: colors.graphite[25] },
        { name: "Graphite 50", value: colors.graphite[50] },
        { name: "Graphite 100", value: colors.graphite[100] },
        { name: "Graphite 200", value: colors.graphite[200] },
        { name: "Graphite 800", value: colors.graphite[800] },
        { name: "Graphite 900", value: colors.graphite[900] },
        { name: "Blue Tint", value: colors.semantic.info[50] },
        { name: "Purple Tint", value: "#f3f4f6" },
        { name: "Dark Mode", value: colors.graphite[900] },
      ],
    },

    // Responsive viewport configurations
    viewport: {
      viewports: {
        // Mobile devices
        mobile1: {
          name: "Small Mobile",
          styles: { width: "320px", height: "568px" },
          type: "mobile",
        },
        mobile2: {
          name: "Mobile",
          styles: { width: "375px", height: "667px" },
          type: "mobile",
        },
        mobile3: {
          name: "Large Mobile",
          styles: { width: "414px", height: "896px" },
          type: "mobile",
        },

        // Tablets
        tablet: {
          name: "Tablet",
          styles: { width: "768px", height: "1024px" },
          type: "tablet",
        },
        tabletLandscape: {
          name: "Tablet Landscape",
          styles: { width: "1024px", height: "768px" },
          type: "tablet",
        },

        // Desktop
        laptop: {
          name: "Laptop",
          styles: { width: "1366px", height: "768px" },
          type: "desktop",
        },
        desktop: {
          name: "Desktop",
          styles: { width: "1920px", height: "1080px" },
          type: "desktop",
        },
        desktopLarge: {
          name: "Large Desktop",
          styles: { width: "2560px", height: "1440px" },
          type: "desktop",
        },

        // Developer-specific viewports
        specWorkbench: {
          name: "Spec Workbench",
          styles: { width: "1440px", height: "900px" },
          type: "desktop",
        },
      },
      defaultViewport: "specWorkbench",
    },

    // Enhanced accessibility testing configuration
    a11y: {
      config: {
        rules: [
          // WCAG 2.1 AA compliance rules
          { id: "color-contrast", enabled: true },
          { id: "keyboard-navigation", enabled: true },
          { id: "focus-management", enabled: true },
          { id: "aria-labels", enabled: true },
          { id: "heading-order", enabled: true },
          { id: "landmark-roles", enabled: true },
          { id: "list-structure", enabled: true },
          { id: "image-alt", enabled: true },
          { id: "form-labels", enabled: true },
          { id: "link-purpose", enabled: true },

          // Disable problematic rules for design system components
          { id: "color-contrast-enhanced", enabled: false }, // AAA level - optional for design system
          { id: "focus-order-semantics", enabled: false }, // May conflict with custom focus management
        ],
      },
      options: {
        checks: { "color-contrast": { options: { noScroll: true } } },
        restoreScroll: true,
      },
      // Run accessibility tests automatically
      manual: false,
    },

    // Layout configuration
    layout: "centered",

    // Custom toolbars for design system testing
    toolbars: {
      designSystem: {
        title: "Design System",
        description: "Design system utilities",
        defaultValue: "default",
        toolbar: {
          icon: "paintbrush",
          items: [
            { value: "default", title: "Default Theme" },
            { value: "compact", title: "Compact Spacing" },
            { value: "comfortable", title: "Comfortable Spacing" },
            { value: "high-contrast", title: "High Contrast" },
          ],
        },
      },
      colorScheme: {
        title: "Color Scheme",
        description: "Color scheme preference",
        defaultValue: "light",
        toolbar: {
          icon: "mirror",
          items: [
            { value: "light", title: "Light Mode" },
            { value: "dark", title: "Dark Mode" },
            { value: "auto", title: "System Preference" },
          ],
        },
      },
    },

    // Story sorting and organization
    options: {
      storySort: {
        order: [
          "Design System",
          ["Overview", "Tokens", "Colors", "Typography", "Spacing"],
          "Components",
          ["Form", "Display", "Feedback", "Navigation", "Layout"],
          "Layout",
          "Editor",
          "*",
        ],
      },
    },

    // Performance monitoring
    test: {
      // Configure interaction tests
      interactions: { debugger: true },
      // Performance budgets for stories
      performance: {
        allowedMetrics: ["fcp", "lcp", "cls"],
        budgets: {
          fcp: 1000,
          lcp: 2000,
          cls: 0.1,
        },
      },
    },
  },

  // Global decorators
  decorators: [DesignSystemDecorator],

  // Global types for custom toolbars
  globalTypes: {
    designSystem: {
      name: "Design System",
      description: "Design system theme variant",
      defaultValue: "default",
      toolbar: {
        icon: "paintbrush",
        items: ["default", "compact", "comfortable", "high-contrast"],
      },
    },
    colorScheme: {
      name: "Color Scheme",
      description: "Color scheme preference",
      defaultValue: "light",
      toolbar: {
        icon: "mirror",
        items: ["light", "dark", "auto"],
      },
    },
  },
};

export default preview;
