import type { Meta, StoryObj } from '@storybook/react';
import {
  Bell,
  Bookmark,
  ChevronRight,
  Download,
  Edit,
  ExternalLink,
  Eye,
  File,
  Folder,
  Heart,
  Home,
  MessageSquare,
  Plus,
  Search,
  Settings,
  Share,
  Star,
  Trash,
  Users,
} from 'lucide-react';
import React from 'react';
import { NavGroup, NavItem } from './NavItem';

const meta: Meta<typeof NavItem> = {
  title: 'Design System/Navigation/NavItem',
  component: NavItem,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Flexible navigation item component for various navigation contexts. Supports different variants, sizes, and interactive states.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'subtle', 'ghost'],
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof NavItem>;

export const Default: Story = {
  args: {
    children: 'Dashboard',
    icon: <Home className="h-4 w-4" />,
  },
  decorators: [
    Story => (
      <div className="w-64 p-4 bg-white rounded-lg border">
        <Story />
      </div>
    ),
  ],
};

export const Active: Story = {
  args: {
    children: 'Dashboard',
    icon: <Home className="h-4 w-4" />,
    active: true,
  },
  decorators: [
    Story => (
      <div className="w-64 p-4 bg-white rounded-lg border">
        <Story />
      </div>
    ),
  ],
};

export const WithBadge: Story = {
  args: {
    children: 'Notifications',
    icon: <Bell className="h-4 w-4" />,
    badge: '12',
  },
  decorators: [
    Story => (
      <div className="w-64 p-4 bg-white rounded-lg border">
        <Story />
      </div>
    ),
  ],
};

export const WithEndIcon: Story = {
  args: {
    children: 'Settings',
    icon: <Settings className="h-4 w-4" />,
    endIcon: <ChevronRight className="h-4 w-4" />,
  },
  decorators: [
    Story => (
      <div className="w-64 p-4 bg-white rounded-lg border">
        <Story />
      </div>
    ),
  ],
};

export const WithShortcut: Story = {
  args: {
    children: 'Search',
    icon: <Search className="h-4 w-4" />,
    shortcut: '⌘K',
  },
  decorators: [
    Story => (
      <div className="w-64 p-4 bg-white rounded-lg border">
        <Story />
      </div>
    ),
  ],
};

export const ExternalLinkExample: Story = {
  args: {
    children: 'Documentation',
    icon: <ExternalLink className="h-4 w-4" />,
    href: 'https://docs.example.com',
    external: true,
  },
  decorators: [
    Story => (
      <div className="w-64 p-4 bg-white rounded-lg border">
        <Story />
      </div>
    ),
  ],
};

export const Disabled: Story = {
  args: {
    children: 'Admin Panel',
    icon: <Settings className="h-4 w-4" />,
    disabled: true,
    badge: 'Pro',
  },
  decorators: [
    Story => (
      <div className="w-64 p-4 bg-white rounded-lg border">
        <Story />
      </div>
    ),
  ],
};

export const Variants: Story = {
  render: () => (
    <div className="w-80 space-y-6">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-700">Default Variant</h3>
        <div className="p-4 bg-white rounded-lg border space-y-2">
          <NavItem icon={<Home className="h-4 w-4" />} variant="default">
            Dashboard
          </NavItem>
          <NavItem icon={<Users className="h-4 w-4" />} variant="default" active>
            Team
          </NavItem>
          <NavItem icon={<Settings className="h-4 w-4" />} variant="default" badge="New">
            Settings
          </NavItem>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-700">Subtle Variant</h3>
        <div className="p-4 bg-white rounded-lg border space-y-2">
          <NavItem icon={<Home className="h-4 w-4" />} variant="subtle">
            Dashboard
          </NavItem>
          <NavItem icon={<Users className="h-4 w-4" />} variant="subtle" active>
            Team
          </NavItem>
          <NavItem icon={<Settings className="h-4 w-4" />} variant="subtle" badge="New">
            Settings
          </NavItem>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-700">Ghost Variant</h3>
        <div className="p-4 bg-white rounded-lg border space-y-2">
          <NavItem icon={<Home className="h-4 w-4" />} variant="ghost">
            Dashboard
          </NavItem>
          <NavItem icon={<Users className="h-4 w-4" />} variant="ghost" active>
            Team
          </NavItem>
          <NavItem icon={<Settings className="h-4 w-4" />} variant="ghost" badge="New">
            Settings
          </NavItem>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Different visual variants of the NavItem component.',
      },
    },
  },
};

export const SizeVariants: Story = {
  render: () => (
    <div className="w-80 space-y-6">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-700">Small (sm)</h3>
        <div className="p-4 bg-white rounded-lg border space-y-1">
          <NavItem icon={<Home className="h-3.5 w-3.5" />} size="sm" shortcut="⌘1">
            Dashboard
          </NavItem>
          <NavItem icon={<Users className="h-3.5 w-3.5" />} size="sm" badge="3">
            Team
          </NavItem>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-700">Medium (md) - Default</h3>
        <div className="p-4 bg-white rounded-lg border space-y-2">
          <NavItem icon={<Home className="h-4 w-4" />} size="md" shortcut="⌘1">
            Dashboard
          </NavItem>
          <NavItem icon={<Users className="h-4 w-4" />} size="md" badge="3">
            Team
          </NavItem>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-700">Large (lg)</h3>
        <div className="p-4 bg-white rounded-lg border space-y-2">
          <NavItem icon={<Home className="h-5 w-5" />} size="lg" shortcut="⌘1">
            Dashboard
          </NavItem>
          <NavItem icon={<Users className="h-5 w-5" />} size="lg" badge="3">
            Team
          </NavItem>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Different size variants of the NavItem component.',
      },
    },
  },
};

export const NavigationGroups: Story = {
  render: () => (
    <div className="w-80 space-y-6">
      <div className="p-4 bg-white rounded-lg border">
        <NavGroup title="Main Navigation">
          <NavItem icon={<Home className="h-4 w-4" />} active>
            Dashboard
          </NavItem>
          <NavItem icon={<Users className="h-4 w-4" />} badge="12">
            Team Members
          </NavItem>
          <NavItem icon={<Folder className="h-4 w-4" />}>Projects</NavItem>
        </NavGroup>

        <NavGroup title="Tools" className="mt-6">
          <NavItem icon={<Search className="h-4 w-4" />} shortcut="⌘K">
            Search
          </NavItem>
          <NavItem icon={<Bell className="h-4 w-4" />} badge="3">
            Notifications
          </NavItem>
          <NavItem icon={<Settings className="h-4 w-4" />}>Settings</NavItem>
        </NavGroup>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Using NavGroup to organize related navigation items with section headers.',
      },
    },
  },
};

export const CollapsibleGroups: Story = {
  render: () => (
    <div className="w-80 space-y-6">
      <div className="p-4 bg-white rounded-lg border">
        <NavGroup title="Main Navigation" collapsible>
          <NavItem icon={<Home className="h-4 w-4" />} active>
            Dashboard
          </NavItem>
          <NavItem icon={<Users className="h-4 w-4" />}>Team</NavItem>
          <NavItem icon={<Folder className="h-4 w-4" />}>Projects</NavItem>
        </NavGroup>

        <NavGroup title="Administration" collapsible defaultCollapsed className="mt-6">
          <NavItem icon={<Settings className="h-4 w-4" />}>System Settings</NavItem>
          <NavItem icon={<Users className="h-4 w-4" />}>User Management</NavItem>
          <NavItem icon={<Bell className="h-4 w-4" />}>Notifications</NavItem>
        </NavGroup>

        <NavGroup title="Help & Support" collapsible defaultCollapsed className="mt-6">
          <NavItem icon={<File className="h-4 w-4" />} external href="#">
            Documentation
          </NavItem>
          <NavItem icon={<MessageSquare className="h-4 w-4" />}>Support Chat</NavItem>
        </NavGroup>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Collapsible navigation groups that can be expanded and collapsed by users.',
      },
    },
  },
};

export const ActionItems: Story = {
  render: () => (
    <div className="w-80 space-y-6">
      <div className="p-4 bg-white rounded-lg border">
        <NavGroup title="Quick Actions">
          <NavItem icon={<Plus className="h-4 w-4" />} variant="default">
            New Project
          </NavItem>
          <NavItem icon={<Download className="h-4 w-4" />} badge="Ready">
            Export Data
          </NavItem>
          <NavItem icon={<Share className="h-4 w-4" />}>Share Workspace</NavItem>
        </NavGroup>

        <NavGroup title="File Operations" className="mt-6">
          <NavItem icon={<Edit className="h-4 w-4" />} shortcut="⌘E">
            Edit
          </NavItem>
          <NavItem icon={<Eye className="h-4 w-4" />} shortcut="Space">
            Preview
          </NavItem>
          <NavItem icon={<Trash className="h-4 w-4" />} shortcut="Del">
            Delete
          </NavItem>
        </NavGroup>

        <NavGroup title="Favorites" className="mt-6">
          <NavItem icon={<Star className="h-4 w-4" />} badge="New">
            Starred Items
          </NavItem>
          <NavItem icon={<Heart className="h-4 w-4" />}>Liked Projects</NavItem>
          <NavItem icon={<Bookmark className="h-4 w-4" />}>Bookmarks</NavItem>
        </NavGroup>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'NavItem used for various action-oriented navigation scenarios.',
      },
    },
  },
};

export const InteractiveExample: Story = {
  render: () => {
    const [activeItem, setActiveItem] = React.useState('dashboard');

    const handleItemClick = (id: string) => {
      setActiveItem(id);
      alert(`Clicked: ${id}`);
    };

    return (
      <div className="w-80">
        <div className="p-4 bg-white rounded-lg border">
          <NavGroup title="Interactive Demo">
            <NavItem
              icon={<Home className="h-4 w-4" />}
              active={activeItem === 'dashboard'}
              onClick={() => handleItemClick('dashboard')}
            >
              Dashboard
            </NavItem>
            <NavItem
              icon={<Users className="h-4 w-4" />}
              badge="12"
              active={activeItem === 'team'}
              onClick={() => handleItemClick('team')}
            >
              Team
            </NavItem>
            <NavItem
              icon={<Folder className="h-4 w-4" />}
              active={activeItem === 'projects'}
              onClick={() => handleItemClick('projects')}
            >
              Projects
            </NavItem>
            <NavItem
              icon={<Search className="h-4 w-4" />}
              shortcut="⌘K"
              active={activeItem === 'search'}
              onClick={() => handleItemClick('search')}
            >
              Search
            </NavItem>
            <NavItem
              icon={<Settings className="h-4 w-4" />}
              endIcon={<ChevronRight className="h-4 w-4" />}
              active={activeItem === 'settings'}
              onClick={() => handleItemClick('settings')}
            >
              Settings
            </NavItem>
          </NavGroup>

          <div className="mt-6 p-3 bg-gray-50 rounded-md">
            <p className="text-sm text-gray-600">
              Active item: <code className="bg-white px-2 py-1 rounded text-xs">{activeItem}</code>
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Click any item to see the state change and callback.
            </p>
          </div>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Interactive NavItem example with state management and click handling.',
      },
    },
  },
};
