/**
 * FileTree Component Stories
 * Comprehensive documentation for the file tree browser component
 */

import type { Meta, StoryObj } from "@storybook/react";
import { useEffect } from "react";
import { AppProvider, useEditorActions, useStatus } from "../../contexts/AppContext";
import type { Fragment, Project } from "../../types/api";
import FileTree from "./FileTree";

// Sample project data
const mockProject: Project = {
  id: "demo-project",
  name: "Demo Project",
  created_at: "2024-01-15T10:00:00Z",
  updated_at: "2024-01-15T10:00:00Z",
};

// Enhanced mock fragments using our realistic data generator
const mockFragments: Fragment[] = [
  {
    id: "1",
    project_id: "demo-project",
    path: "config.cue",
    content:
      '// Main configuration\npackage main\n\napp: {\n  name: "demo-project"\n  version: "1.0.0"\n}',
    created_at: "2024-01-15T10:00:00Z",
    updated_at: "2024-01-15T10:00:00Z",
  },
  {
    id: "2",
    project_id: "demo-project",
    path: "api/routes.cue",
    content:
      '// API routes specification\npackage api\n\nroutes: {\n  users: "/api/users"\n  products: "/api/products"\n}',
    created_at: "2024-01-15T10:00:00Z",
    updated_at: "2024-01-15T10:00:00Z",
  },
  {
    id: "3",
    project_id: "demo-project",
    path: "api/auth.cue",
    content:
      '// Authentication configuration\npackage api\n\nauth: {\n  method: "JWT"\n  expiry: "24h"\n}',
    created_at: "2024-01-15T10:00:00Z",
    updated_at: "2024-01-15T10:00:00Z",
  },
  {
    id: "4",
    project_id: "demo-project",
    path: "database/schema.cue",
    content:
      "// Database schema\npackage database\n\nschema: {\n  users: {\n    id: string\n    email: string\n  }\n}",
    created_at: "2024-01-15T10:00:00Z",
    updated_at: "2024-01-15T10:00:00Z",
  },
  {
    id: "5",
    project_id: "demo-project",
    path: "docs/README.md",
    content:
      "# Demo Project\n\nThis is a demonstration of the file tree component with various file types.",
    created_at: "2024-01-15T10:00:00Z",
    updated_at: "2024-01-15T10:00:00Z",
  },
];

// Story context initializer component
interface StoryContextInitializerProps {
  children: React.ReactNode;
  project?: Project | null;
  fragments?: Fragment[];
  activeFragmentId?: string | null;
  unsavedChanges?: Set<string>;
  editorContent?: Record<string, string>;
  isLoading?: boolean;
  error?: string | null;
}

const StoryContextInitializer = ({
  children,
  project = mockProject,
  fragments = mockFragments,
  activeFragmentId = null,
  unsavedChanges = new Set(),
  editorContent = {},
  isLoading = false,
  error = null,
}: StoryContextInitializerProps) => {
  const { setFragments, setActiveFragment, updateEditorContent, markUnsaved, markSaved } =
    useEditorActions();
  const { setError, setLoading } = useStatus();

  useEffect(() => {
    if (fragments) {
      setFragments(fragments);
    }
    if (activeFragmentId) {
      setActiveFragment(activeFragmentId);
    }

    if (error) {
      setError(error);
    }

    if (isLoading) {
      setLoading(isLoading);
    }

    // Set up editor content
    Object.entries(editorContent).forEach(([fragmentId, content]) => {
      updateEditorContent(fragmentId, content);
    });

    // Set up unsaved changes
    unsavedChanges.forEach((id) => {
      markUnsaved(id);
    });
  }, [
    project,
    fragments,
    activeFragmentId,
    editorContent,
    unsavedChanges,
    isLoading,
    error,
    setFragments,
    setActiveFragment,
    updateEditorContent,
    markUnsaved,
    setError,
    setLoading,
  ]);

  return <>{children}</>;
};

const meta = {
  title: "Editor/FileTree",
  component: FileTree,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A hierarchical file tree browser for navigating project fragments. Features drag-and-drop organization, inline editing, file type icons, and real-time unsaved change indicators.",
      },
    },
  },
  tags: ["autodocs"],
  decorators: [
    (Story, context) => (
      <AppProvider>
        <StoryContextInitializer {...(context.args.mockContext || {})}>
          <div className="h-96 w-80">
            <Story />
          </div>
        </StoryContextInitializer>
      </AppProvider>
    ),
  ],
  argTypes: {
    className: {
      control: { type: "text" },
      description: "Additional CSS classes",
    },
  },
} satisfies Meta<typeof FileTree>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default file tree
export const Default: Story = {
  args: {
    mockContext: {
      project: mockProject,
      fragments: mockFragments,
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          "Default file tree with a typical project structure. Shows folders, CUE files, and other file types with appropriate icons.",
      },
    },
  },
};

// With active file selected
export const WithActiveFile: Story = {
  args: {
    mockContext: {
      project: mockProject,
      fragments: mockFragments,
      activeFragmentId: "2", // api/routes.cue
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          "File tree with an active file selected (api/routes.cue). The active file is highlighted with a blue background.",
      },
    },
  },
};

// With unsaved changes
export const WithUnsavedChanges: Story = {
  args: {
    mockContext: {
      project: mockProject,
      fragments: mockFragments,
      activeFragmentId: "1",
      unsavedChanges: new Set(["1", "3"]), // config.cue and api/auth.cue
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          "File tree showing unsaved changes indicators. Files with unsaved changes display an amber dot and have an amber background tint.",
      },
    },
  },
};

// Empty project
export const EmptyProject: Story = {
  args: {
    mockContext: {
      project: mockProject,
      fragments: [],
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          "File tree in an empty project state. Shows a helpful empty state with a call-to-action to create the first fragment.",
      },
    },
  },
};

// Large project structure
export const LargeProject: Story = {
  args: {
    mockContext: {
      project: {
        ...mockProject,
        name: "Large Project",
      },
      fragments: [
        ...mockFragments,
        {
          id: "9",
          project_id: "demo-project",
          path: "api/middleware/auth.cue",
          content: "// Auth middleware",
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
        {
          id: "10",
          project_id: "demo-project",
          path: "api/middleware/cors.cue",
          content: "// CORS middleware",
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
        {
          id: "11",
          project_id: "demo-project",
          path: "api/handlers/users.cue",
          content: "// User handlers",
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
        {
          id: "12",
          project_id: "demo-project",
          path: "api/handlers/auth.cue",
          content: "// Auth handlers",
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
        {
          id: "13",
          project_id: "demo-project",
          path: "frontend/pages/home.cue",
          content: "// Home page spec",
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
        {
          id: "14",
          project_id: "demo-project",
          path: "frontend/pages/login.cue",
          content: "// Login page spec",
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
        {
          id: "15",
          project_id: "demo-project",
          path: "config/environments/dev.cue",
          content: "// Development config",
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
        {
          id: "16",
          project_id: "demo-project",
          path: "config/environments/prod.cue",
          content: "// Production config",
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
        {
          id: "17",
          project_id: "demo-project",
          path: "docs/api/README.md",
          content: "# API Documentation",
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
        {
          id: "18",
          project_id: "demo-project",
          path: "docs/deployment.md",
          content: "# Deployment Guide",
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
      ],
      activeFragmentId: "11",
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          "File tree with a larger, more complex project structure. Demonstrates deep nesting and folder organization.",
      },
    },
  },
};

// Different file types
export const DifferentFileTypes: Story = {
  args: {
    mockContext: {
      project: {
        ...mockProject,
        name: "Multi-Type Project",
      },
      fragments: [
        {
          id: "1",
          project_id: "demo-project",
          path: "config.cue",
          content: "// CUE config",
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
        {
          id: "2",
          project_id: "demo-project",
          path: "package.json",
          content: '{"name": "demo"}',
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
        {
          id: "3",
          project_id: "demo-project",
          path: "config.yaml",
          content: "name: demo",
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
        {
          id: "4",
          project_id: "demo-project",
          path: "README.md",
          content: "# Documentation",
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
        {
          id: "5",
          project_id: "demo-project",
          path: "schema.sql",
          content: "CREATE TABLE users...",
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
        {
          id: "6",
          project_id: "demo-project",
          path: "assets/logo.png",
          content: "binary data",
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
        {
          id: "7",
          project_id: "demo-project",
          path: "backup.zip",
          content: "binary archive",
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
      ],
      activeFragmentId: "1",
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          "File tree showing different file types with their corresponding icons: CUE files, JSON, YAML, Markdown, SQL, images, and archives.",
      },
    },
  },
};

// Flat structure (no folders)
export const FlatStructure: Story = {
  args: {
    mockContext: {
      project: {
        ...mockProject,
        name: "Flat Structure Project",
      },
      fragments: [
        {
          id: "1",
          project_id: "demo-project",
          path: "main.cue",
          content: "// Main file",
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
        {
          id: "2",
          project_id: "demo-project",
          path: "config.cue",
          content: "// Configuration",
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
        {
          id: "3",
          project_id: "demo-project",
          path: "types.cue",
          content: "// Type definitions",
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
        {
          id: "4",
          project_id: "demo-project",
          path: "validation.cue",
          content: "// Validation rules",
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
      ],
      activeFragmentId: "2",
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          "File tree with a flat structure (no folders). All files are displayed at the root level.",
      },
    },
  },
};

// With custom styling
export const CustomStyling: Story = {
  args: {
    mockContext: {
      project: mockProject,
      fragments: mockFragments,
      activeFragmentId: "2",
      unsavedChanges: new Set(["1"]),
    },
    className: "border-2 border-blue-200 bg-blue-50/30 rounded-xl",
  },
  parameters: {
    docs: {
      description: {
        story:
          "File tree with custom styling applied via className prop. Shows how the component can be themed for different design contexts.",
      },
    },
  },
};

// Interactive demo
export const Interactive: Story = {
  render: (args) => {
    return (
      <AppProvider>
        <StoryContextInitializer
          project={mockProject}
          fragments={mockFragments}
          activeFragmentId="1"
          unsavedChanges={new Set(["3"])}
        >
          <div className="h-96 w-80">
            <FileTree {...args} />
          </div>
        </StoryContextInitializer>
      </AppProvider>
    );
  },
  args: {
    className: "",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Interactive file tree demo. Try clicking on files to select them, expand/collapse folders, and observe the active state changes.",
      },
    },
  },
};

// Real-world example with mixed states
export const RealWorldExample: Story = {
  args: {
    mockContext: {
      project: {
        ...mockProject,
        id: "ecommerce-api",
        name: "E-commerce API",
      },
      fragments: [
        {
          id: "1",
          project_id: "ecommerce-api",
          path: "main.cue",
          content: "// Main application config",
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
        {
          id: "2",
          project_id: "ecommerce-api",
          path: "api/products.cue",
          content: "// Product API specification",
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
        {
          id: "3",
          project_id: "ecommerce-api",
          path: "api/orders.cue",
          content: "// Order management API",
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
        {
          id: "4",
          project_id: "ecommerce-api",
          path: "api/payments/stripe.cue",
          content: "// Stripe payment integration",
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
        {
          id: "5",
          project_id: "ecommerce-api",
          path: "api/payments/paypal.cue",
          content: "// PayPal integration",
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
        {
          id: "6",
          project_id: "ecommerce-api",
          path: "database/models/user.cue",
          content: "// User data model",
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
        {
          id: "7",
          project_id: "ecommerce-api",
          path: "database/models/product.cue",
          content: "// Product data model",
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
        {
          id: "8",
          project_id: "ecommerce-api",
          path: "config/environments/staging.cue",
          content: "// Staging environment config",
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
        {
          id: "9",
          project_id: "ecommerce-api",
          path: "config/environments/production.cue",
          content: "// Production environment config",
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
        {
          id: "10",
          project_id: "ecommerce-api",
          path: "docs/openapi.yaml",
          content: "# OpenAPI specification",
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
      ],
      activeFragmentId: "4", // api/payments/stripe.cue
      unsavedChanges: new Set(["2", "6", "8"]), // Multiple files with unsaved changes
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          "Real-world e-commerce API project structure with multiple levels of nesting, mixed file types, active selection, and several files with unsaved changes.",
      },
    },
  },
};
