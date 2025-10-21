import type { Meta, StoryObj } from "@storybook/react";
import {
  Activity,
  Bell,
  ChevronLeft,
  ChevronRight,
  Code,
  Database,
  File,
  Folder,
  FolderOpen,
  GitBranch,
  Home,
  Search,
  Settings,
  Shield,
  Users,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Sidebar, type SidebarNavItem } from "./Sidebar";

const meta: Meta<typeof Sidebar> = {
  title: "Design System/Navigation/Sidebar",
  component: Sidebar,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Professional sidebar navigation with collapsible sections, nested items, and elegant hierarchy. Perfect for developer tools and complex applications.",
      },
    },
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Sidebar>;

// Sample navigation data
const basicNavItems: SidebarNavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: <Home className="h-4 w-4" />,
    active: true,
  },
  {
    id: "projects",
    label: "Projects",
    icon: <Folder className="h-4 w-4" />,
    badge: "12",
  },
  {
    id: "files",
    label: "Files",
    icon: <File className="h-4 w-4" />,
  },
  {
    id: "team",
    label: "Team",
    icon: <Users className="h-4 w-4" />,
    badge: "3",
  },
  {
    id: "settings",
    label: "Settings",
    icon: <Settings className="h-4 w-4" />,
  },
];

const nestedNavItems: SidebarNavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: <Activity className="h-4 w-4" />,
    active: true,
  },
  {
    id: "development",
    label: "Development",
    icon: <Code className="h-4 w-4" />,
    collapsible: true,
    children: [
      {
        id: "repositories",
        label: "Repositories",
        icon: <GitBranch className="h-4 w-4" />,
        badge: "8",
      },
      {
        id: "deployments",
        label: "Deployments",
        icon: <Zap className="h-4 w-4" />,
      },
      {
        id: "databases",
        label: "Databases",
        icon: <Database className="h-4 w-4" />,
      },
    ],
  },
  {
    id: "monitoring",
    label: "Monitoring",
    icon: <Shield className="h-4 w-4" />,
    collapsible: true,
    collapsed: false,
    children: [
      {
        id: "alerts",
        label: "Alerts",
        icon: <Bell className="h-4 w-4" />,
        badge: "2",
      },
      {
        id: "metrics",
        label: "Metrics",
        icon: <Activity className="h-4 w-4" />,
      },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    icon: <Settings className="h-4 w-4" />,
  },
];

const projectExplorerItems: SidebarNavItem[] = [
  {
    id: "search",
    label: "Search",
    icon: <Search className="h-4 w-4" />,
  },
  {
    id: "src",
    label: "src",
    icon: <FolderOpen className="h-4 w-4" />,
    collapsible: true,
    collapsed: false,
    children: [
      {
        id: "components",
        label: "components",
        icon: <Folder className="h-4 w-4" />,
        collapsible: true,
        children: [
          {
            id: "button-tsx",
            label: "Button.tsx",
            icon: <File className="h-4 w-4" />,
          },
          {
            id: "input-tsx",
            label: "Input.tsx",
            icon: <File className="h-4 w-4" />,
            active: true,
          },
        ],
      },
      {
        id: "utils",
        label: "utils",
        icon: <Folder className="h-4 w-4" />,
        collapsible: true,
        collapsed: true,
        children: [
          {
            id: "helpers-ts",
            label: "helpers.ts",
            icon: <File className="h-4 w-4" />,
          },
        ],
      },
      {
        id: "app-tsx",
        label: "App.tsx",
        icon: <File className="h-4 w-4" />,
      },
    ],
  },
  {
    id: "public",
    label: "public",
    icon: <Folder className="h-4 w-4" />,
    collapsible: true,
    collapsed: true,
    children: [
      {
        id: "index-html",
        label: "index.html",
        icon: <File className="h-4 w-4" />,
      },
    ],
  },
  {
    id: "package-json",
    label: "package.json",
    icon: <File className="h-4 w-4" />,
  },
];

export const Default: Story = {
  args: {
    items: basicNavItems,
  },
  decorators: [
    (Story) => (
      <div className="h-screen bg-gray-50 p-4">
        <div className="h-full max-w-sm">
          <Story />
        </div>
      </div>
    ),
  ],
};

export const WithHeader: Story = {
  args: {
    items: basicNavItems,
    header: (
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center">
          <span className="text-white font-bold text-sm">A</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">Acme Corp</p>
          <p className="text-xs text-gray-500 truncate">acme.dev</p>
        </div>
      </div>
    ),
  },
  decorators: [
    (Story) => (
      <div className="h-screen bg-gray-50 p-4">
        <div className="h-full max-w-sm">
          <Story />
        </div>
      </div>
    ),
  ],
};

export const WithFooter: Story = {
  args: {
    items: basicNavItems,
    footer: (
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
          <span className="text-gray-600 font-medium text-sm">JD</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">John Doe</p>
          <p className="text-xs text-gray-500 truncate">john@acme.dev</p>
        </div>
        <Settings className="h-4 w-4 text-gray-400" />
      </div>
    ),
  },
  decorators: [
    (Story) => (
      <div className="h-screen bg-gray-50 p-4">
        <div className="h-full max-w-sm">
          <Story />
        </div>
      </div>
    ),
  ],
};

export const NestedNavigation: Story = {
  args: {
    items: nestedNavItems,
  },
  decorators: [
    (Story) => (
      <div className="h-screen bg-gray-50 p-4">
        <div className="h-full max-w-sm">
          <Story />
        </div>
      </div>
    ),
  ],
};

export const ProjectExplorer: Story = {
  args: {
    items: projectExplorerItems,
    header: (
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Explorer</h2>
        <button className="p-1 hover:bg-gray-100 rounded">
          <FolderOpen className="h-4 w-4 text-gray-500" />
        </button>
      </div>
    ),
  },
  decorators: [
    (Story) => (
      <div className="h-screen bg-gray-50 p-4">
        <div className="h-full max-w-sm">
          <Story />
        </div>
      </div>
    ),
  ],
};

export const CollapsibleSidebar: Story = {
  render: () => {
    const [collapsed, setCollapsed] = useState(false);

    return (
      <div className="h-screen bg-gray-50 p-4 flex">
        <div className="relative">
          <Sidebar
            items={nestedNavItems}
            collapsed={collapsed}
            header={
              !collapsed ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
                      <span className="text-white font-bold text-xs">A</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">Acme</span>
                  </div>
                  <button
                    onClick={() => setCollapsed(true)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <ChevronLeft className="h-4 w-4 text-gray-500" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setCollapsed(false)}
                  className="w-full flex justify-center p-2 hover:bg-gray-100 rounded"
                >
                  <ChevronRight className="h-4 w-4 text-gray-500" />
                </button>
              )
            }
          />
        </div>
        <div className="flex-1 p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Main Content</h1>
          <p className="text-gray-600">
            Toggle the sidebar using the chevron button to see the collapsed state.
          </p>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          "Interactive example showing how to implement a collapsible sidebar with toggle functionality.",
      },
    },
  },
};

export const SizeVariants: Story = {
  render: () => (
    <div className="h-screen bg-gray-50 p-4 flex gap-4">
      <div className="flex-1">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Small (sm)</h3>
        <Sidebar
          items={basicNavItems}
          width="sm"
          header={<div className="text-sm font-semibold">Small</div>}
        />
      </div>
      <div className="flex-1">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Medium (md) - Default</h3>
        <Sidebar
          items={basicNavItems}
          width="md"
          header={<div className="text-sm font-semibold">Medium</div>}
        />
      </div>
      <div className="flex-1">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Large (lg)</h3>
        <Sidebar
          items={basicNavItems}
          width="lg"
          header={<div className="text-sm font-semibold">Large</div>}
        />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Different width variants of the sidebar component.",
      },
    },
  },
};

export const InteractiveExample: Story = {
  render: () => {
    const [activeItem, setActiveItem] = useState("dashboard");

    const interactiveItems: SidebarNavItem[] = nestedNavItems.map((item) => ({
      ...item,
      active: item.id === activeItem,
      children: item.children
        ? item.children.map((child) => ({
            ...child,
            active: child.id === activeItem,
          }))
        : [],
    }));

    return (
      <div className="h-screen bg-gray-50 p-4 flex">
        <div className="max-w-sm">
          <Sidebar
            items={interactiveItems}
            onItemClick={(item) => setActiveItem(item.id)}
            header={
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">S</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Spec Workbench</p>
                  <p className="text-xs text-gray-500">Developer Edition</p>
                </div>
              </div>
            }
            footer={
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                  <span className="text-gray-600 font-medium text-sm">DV</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">Developer</p>
                  <p className="text-xs text-gray-500 truncate">Online</p>
                </div>
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              </div>
            }
          />
        </div>
        <div className="flex-1 p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {interactiveItems.find((item) => item.active)?.label ||
              interactiveItems
                .find((item) => item.children?.some((child) => child.active))
                ?.children?.find((child) => child.active)?.label ||
              "Select an item"}
          </h1>
          <p className="text-gray-600">
            Click on different navigation items to see the active state change. Current active item
            ID: <code className="bg-gray-100 px-2 py-1 rounded text-sm">{activeItem}</code>
          </p>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Interactive sidebar example with state management and click handling.",
      },
    },
  },
};
