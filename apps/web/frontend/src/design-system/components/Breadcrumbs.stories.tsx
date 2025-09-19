import type { Meta, StoryObj } from '@storybook/react';
import { Breadcrumbs, breadcrumbIcons, type BreadcrumbItem } from './Breadcrumbs';
import {
  Home,
  Folder,
  File,
  Database,
  Settings,
  Users,
  Code,
  GitBranch,
  FolderOpen,
} from 'lucide-react';

const meta: Meta<typeof Breadcrumbs> = {
  title: 'Design System/Navigation/Breadcrumbs',
  component: Breadcrumbs,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Professional breadcrumb navigation for hierarchical content. Supports collapsing, custom separators, and various size variants.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    separator: {
      control: { type: 'select' },
      options: ['chevron', 'slash', 'dot'],
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Breadcrumbs>;

// Sample breadcrumb data
const basicItems: BreadcrumbItem[] = [
  {
    id: 'home',
    label: 'Home',
    href: '/',
  },
  {
    id: 'projects',
    label: 'Projects',
    href: '/projects',
  },
  {
    id: 'spec-workbench',
    label: 'Spec Workbench',
    href: '/projects/spec-workbench',
  },
  {
    id: 'components',
    label: 'Components',
    current: true,
  },
];

const fileSystemItems: BreadcrumbItem[] = [
  {
    id: 'home',
    label: 'Home',
    icon: <Home className="h-4 w-4" />,
    href: '/',
  },
  {
    id: 'projects',
    label: 'Projects',
    icon: <Folder className="h-4 w-4" />,
    href: '/projects',
  },
  {
    id: 'spec-workbench',
    label: 'Spec Workbench',
    icon: <FolderOpen className="h-4 w-4" />,
    href: '/projects/spec-workbench',
  },
  {
    id: 'src',
    label: 'src',
    icon: <Folder className="h-4 w-4" />,
    href: '/projects/spec-workbench/src',
  },
  {
    id: 'components',
    label: 'components',
    icon: <Folder className="h-4 w-4" />,
    href: '/projects/spec-workbench/src/components',
  },
  {
    id: 'button-tsx',
    label: 'Button.tsx',
    icon: <File className="h-4 w-4" />,
    current: true,
  },
];

const deepNestedItems: BreadcrumbItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <Home className="h-4 w-4" />,
    href: '/dashboard',
  },
  {
    id: 'development',
    label: 'Development',
    icon: <Code className="h-4 w-4" />,
    href: '/dashboard/development',
  },
  {
    id: 'repositories',
    label: 'Repositories',
    icon: <GitBranch className="h-4 w-4" />,
    href: '/dashboard/development/repositories',
  },
  {
    id: 'spec-workbench',
    label: 'Spec Workbench',
    icon: <Folder className="h-4 w-4" />,
    href: '/dashboard/development/repositories/spec-workbench',
  },
  {
    id: 'frontend',
    label: 'frontend',
    icon: <Folder className="h-4 w-4" />,
    href: '/dashboard/development/repositories/spec-workbench/frontend',
  },
  {
    id: 'src',
    label: 'src',
    icon: <Folder className="h-4 w-4" />,
    href: '/dashboard/development/repositories/spec-workbench/frontend/src',
  },
  {
    id: 'design-system',
    label: 'design-system',
    icon: <Folder className="h-4 w-4" />,
    href: '/dashboard/development/repositories/spec-workbench/frontend/src/design-system',
  },
  {
    id: 'components',
    label: 'components',
    icon: <Folder className="h-4 w-4" />,
    href: '/dashboard/development/repositories/spec-workbench/frontend/src/design-system/components',
  },
  {
    id: 'breadcrumbs-tsx',
    label: 'Breadcrumbs.tsx',
    icon: <File className="h-4 w-4" />,
    current: true,
  },
];

const adminPanelItems: BreadcrumbItem[] = [
  {
    id: 'admin',
    label: 'Admin Panel',
    icon: <Settings className="h-4 w-4" />,
    href: '/admin',
  },
  {
    id: 'users',
    label: 'User Management',
    icon: <Users className="h-4 w-4" />,
    href: '/admin/users',
  },
  {
    id: 'database',
    label: 'Database',
    icon: <Database className="h-4 w-4" />,
    href: '/admin/users/database',
  },
  {
    id: 'migrations',
    label: 'Migrations',
    current: true,
  },
];

export const Default: Story = {
  args: {
    items: basicItems,
  },
  decorators: [
    Story => (
      <div className="w-full max-w-4xl p-8 bg-white rounded-lg border">
        <Story />
      </div>
    ),
  ],
};

export const WithIcons: Story = {
  args: {
    items: fileSystemItems,
    showHomeIcon: true,
  },
  decorators: [
    Story => (
      <div className="w-full max-w-4xl p-8 bg-white rounded-lg border">
        <Story />
      </div>
    ),
  ],
};

export const ChevronSeparator: Story = {
  args: {
    items: basicItems,
    separator: 'chevron',
  },
  decorators: [
    Story => (
      <div className="w-full max-w-4xl p-8 bg-white rounded-lg border">
        <Story />
      </div>
    ),
  ],
};

export const SlashSeparator: Story = {
  args: {
    items: fileSystemItems,
    separator: 'slash',
  },
  decorators: [
    Story => (
      <div className="w-full max-w-4xl p-8 bg-white rounded-lg border">
        <Story />
      </div>
    ),
  ],
};

export const DotSeparator: Story = {
  args: {
    items: adminPanelItems,
    separator: 'dot',
  },
  decorators: [
    Story => (
      <div className="w-full max-w-4xl p-8 bg-white rounded-lg border">
        <Story />
      </div>
    ),
  ],
};

export const CustomSeparator: Story = {
  args: {
    items: basicItems,
    separator: <span className="text-blue-500 font-bold">→</span>,
  },
  decorators: [
    Story => (
      <div className="w-full max-w-4xl p-8 bg-white rounded-lg border">
        <Story />
      </div>
    ),
  ],
};

export const CollapsedBreadcrumbs: Story = {
  args: {
    items: deepNestedItems,
    maxItems: 4,
  },
  decorators: [
    Story => (
      <div className="w-full max-w-4xl p-8 bg-white rounded-lg border">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story:
          'When there are too many items, breadcrumbs automatically collapse with an expandable "..." indicator. Click the dots to expand all items.',
      },
    },
  },
};

export const SizeVariants: Story = {
  render: () => (
    <div className="w-full max-w-4xl space-y-8">
      <div className="p-6 bg-white rounded-lg border">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Small (sm)</h3>
        <Breadcrumbs items={fileSystemItems} size="sm" showHomeIcon={true} />
      </div>
      <div className="p-6 bg-white rounded-lg border">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Medium (md) - Default</h3>
        <Breadcrumbs items={fileSystemItems} size="md" showHomeIcon={true} />
      </div>
      <div className="p-6 bg-white rounded-lg border">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Large (lg)</h3>
        <Breadcrumbs items={fileSystemItems} size="lg" showHomeIcon={true} />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Different size variants of the breadcrumb component.',
      },
    },
  },
};

export const InteractiveExample: Story = {
  render: () => {
    const handleItemClick = (item: BreadcrumbItem) => {
      alert(`Navigated to: ${item.label} (${item.href || 'current page'})`);
    };

    return (
      <div className="w-full max-w-4xl space-y-8">
        <div className="p-6 bg-white rounded-lg border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">File Explorer Navigation</h3>
          <Breadcrumbs items={fileSystemItems} onItemClick={handleItemClick} showHomeIcon={true} />
          <p className="text-sm text-gray-600 mt-4">
            Click on any breadcrumb item to see the navigation callback.
          </p>
        </div>

        <div className="p-6 bg-white rounded-lg border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Deep Nested Path (Auto-collapsed)
          </h3>
          <Breadcrumbs
            items={deepNestedItems}
            maxItems={5}
            onItemClick={handleItemClick}
            showHomeIcon={true}
          />
          <p className="text-sm text-gray-600 mt-4">
            Deep paths are automatically collapsed. Click the "..." to expand all items.
          </p>
        </div>

        <div className="p-6 bg-white rounded-lg border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Admin Panel Navigation</h3>
          <Breadcrumbs items={adminPanelItems} separator="dot" onItemClick={handleItemClick} />
          <p className="text-sm text-gray-600 mt-4">
            Different separator styles for different contexts.
          </p>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Interactive breadcrumbs with click handlers and different configurations for various use cases.',
      },
    },
  },
};

export const ResponsiveBreadcrumbs: Story = {
  render: () => (
    <div className="w-full space-y-8">
      <div className="max-w-xs p-4 bg-white rounded-lg border">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Mobile Width (maxItems: 2)</h3>
        <Breadcrumbs items={deepNestedItems} maxItems={2} size="sm" />
      </div>
      <div className="max-w-md p-4 bg-white rounded-lg border">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Tablet Width (maxItems: 4)</h3>
        <Breadcrumbs items={deepNestedItems} maxItems={4} size="md" />
      </div>
      <div className="max-w-4xl p-6 bg-white rounded-lg border">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Desktop Width (No limit)</h3>
        <Breadcrumbs items={deepNestedItems} size="lg" />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Responsive breadcrumb behavior with different maxItems values for different screen sizes.',
      },
    },
  },
};
