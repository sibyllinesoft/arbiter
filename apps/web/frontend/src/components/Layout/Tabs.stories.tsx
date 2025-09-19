/**
 * Tabs Component Stories
 * Comprehensive documentation for the tab navigation component
 */

import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Code, FileText, Settings, Database, Globe, User, Bell, Shield } from 'lucide-react';
import Tabs from './Tabs';
import type { TabItem } from '../../types/ui';

const meta = {
  title: 'Layout/Tabs',
  component: Tabs,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'A flexible tab navigation component for organizing content into separate panels. Features badge support, disabled states, and accessible keyboard navigation.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    activeTab: {
      control: { type: 'text' },
      description: 'ID of the currently active tab',
    },
    onTabChange: {
      description: 'Callback function called when tab changes',
    },
    tabs: {
      description: 'Array of tab items with content',
    },
    className: {
      control: { type: 'text' },
      description: 'Additional CSS classes',
    },
  },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

// Sample content components
const SampleContent = ({
  title,
  icon: Icon,
  content,
}: {
  title: string;
  icon?: any;
  content: string;
}) => (
  <div className="h-64 p-6">
    <div className="flex items-center gap-2 mb-4">
      {Icon && <Icon className="h-5 w-5 text-blue-600" />}
      <h3 className="font-semibold text-lg text-gray-800">{title}</h3>
    </div>
    <p className="text-gray-600 mb-4">{content}</p>
    <div className="space-y-2">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="p-3 bg-gray-50 rounded border text-sm">
          Sample content item {i + 1} for the {title} tab
        </div>
      ))}
    </div>
  </div>
);

// Basic tabs data
const basicTabs: TabItem[] = [
  {
    id: 'overview',
    label: 'Overview',
    content: (
      <SampleContent
        title="Overview"
        content="This is the overview tab content. It provides a general introduction to the current context."
      />
    ),
  },
  {
    id: 'details',
    label: 'Details',
    content: (
      <SampleContent
        title="Details"
        content="Detailed information and specifications are displayed here. This tab contains comprehensive data."
      />
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    content: (
      <SampleContent
        title="Settings"
        content="Configuration options and preferences can be managed in this tab."
      />
    ),
  },
];

// Tabs with badges
const tabsWithBadges: TabItem[] = [
  {
    id: 'code',
    label: 'Code',
    badge: '12',
    content: (
      <SampleContent
        title="Code Files"
        icon={Code}
        content="12 code files in this project. Review and edit your source code here."
      />
    ),
  },
  {
    id: 'docs',
    label: 'Documentation',
    badge: '5',
    content: (
      <SampleContent
        title="Documentation"
        icon={FileText}
        content="5 documentation files available. Technical specifications and guides."
      />
    ),
  },
  {
    id: 'issues',
    label: 'Issues',
    badge: 'NEW',
    content: (
      <SampleContent
        title="Issues"
        content="Track bugs, feature requests, and other project issues here."
      />
    ),
  },
  {
    id: 'config',
    label: 'Config',
    content: (
      <SampleContent
        title="Configuration"
        icon={Settings}
        content="Project configuration files and settings management."
      />
    ),
  },
];

// Tabs with some disabled
const tabsWithDisabled: TabItem[] = [
  {
    id: 'database',
    label: 'Database',
    content: (
      <SampleContent
        title="Database"
        icon={Database}
        content="Database connection and management tools."
      />
    ),
  },
  {
    id: 'api',
    label: 'API',
    content: (
      <SampleContent title="API" icon={Globe} content="RESTful API endpoints and documentation." />
    ),
  },
  {
    id: 'users',
    label: 'Users',
    disabled: true,
    content: (
      <SampleContent
        title="Users"
        icon={User}
        content="User management (requires premium subscription)."
      />
    ),
  },
  {
    id: 'analytics',
    label: 'Analytics',
    disabled: true,
    content: (
      <SampleContent title="Analytics" content="Advanced analytics and reporting (coming soon)." />
    ),
  },
];

// Default tabs
export const Default: Story = {
  render: () => {
    const [activeTab, setActiveTab] = useState('overview');
    return (
      <div className="h-80 border border-gray-200 rounded-lg">
        <Tabs activeTab={activeTab} onTabChange={setActiveTab} tabs={basicTabs} />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Basic tab navigation with three simple tabs. Click tabs to switch between content panels.',
      },
    },
  },
};

// Tabs with badges
export const WithBadges: Story = {
  render: () => {
    const [activeTab, setActiveTab] = useState('code');
    return (
      <div className="h-80 border border-gray-200 rounded-lg">
        <Tabs activeTab={activeTab} onTabChange={setActiveTab} tabs={tabsWithBadges} />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Tabs can display badges for notifications, counts, or status indicators. Badges adapt their styling based on the active state.',
      },
    },
  },
};

// Tabs with disabled states
export const WithDisabledTabs: Story = {
  render: () => {
    const [activeTab, setActiveTab] = useState('database');
    return (
      <div className="h-80 border border-gray-200 rounded-lg">
        <Tabs activeTab={activeTab} onTabChange={setActiveTab} tabs={tabsWithDisabled} />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Some tabs can be disabled to indicate unavailable functionality. Disabled tabs are not clickable and have reduced opacity.',
      },
    },
  },
};

// Many tabs (scrolling behavior)
export const ManyTabs: Story = {
  render: () => {
    const [activeTab, setActiveTab] = useState('tab1');

    const manyTabs: TabItem[] = Array.from({ length: 12 }, (_, i) => ({
      id: `tab${i + 1}`,
      label: `Tab ${i + 1}`,
      badge: i > 7 ? String(Math.floor(Math.random() * 100)) : undefined,
      disabled: i > 9,
      content: (
        <SampleContent
          title={`Tab ${i + 1} Content`}
          content={`This is the content for tab number ${i + 1}. Each tab can contain different content and functionality.`}
        />
      ),
    }));

    return (
      <div className="h-80 border border-gray-200 rounded-lg">
        <Tabs activeTab={activeTab} onTabChange={setActiveTab} tabs={manyTabs} />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'When there are many tabs, they will wrap to maintain usability. The last two tabs are disabled to demonstrate mixed states.',
      },
    },
  },
};

// Developer tool tabs example
export const DeveloperToolTabs: Story = {
  render: () => {
    const [activeTab, setActiveTab] = useState('editor');

    const devTabs: TabItem[] = [
      {
        id: 'editor',
        label: 'Editor',
        content: (
          <div className="h-64 p-6 bg-gray-50">
            <div className="flex items-center gap-2 mb-4">
              <Code className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold text-lg">Code Editor</h3>
            </div>
            <div className="bg-white p-4 rounded border font-mono text-sm">
              <div className="text-purple-600">import React from 'react';</div>
              <div className="text-gray-600 mt-2">function MyComponent() {'{'}</div>
              <div className="text-gray-600 pl-4">return {'<div>Hello World</div>;'}</div>
              <div className="text-gray-600">{'}'}</div>
            </div>
          </div>
        ),
      },
      {
        id: 'console',
        label: 'Console',
        badge: '3',
        content: (
          <div className="h-64 p-6 bg-gray-900 text-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="font-semibold text-lg text-white">Console Output</h3>
            </div>
            <div className="font-mono text-sm space-y-1">
              <div className="text-blue-300">[INFO] Server started on port 3000</div>
              <div className="text-yellow-300">[WARN] Deprecated API usage detected</div>
              <div className="text-red-300">[ERROR] Failed to load module</div>
            </div>
          </div>
        ),
      },
      {
        id: 'network',
        label: 'Network',
        content: (
          <div className="h-64 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold text-lg">Network Requests</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between p-2 bg-green-50 rounded border-l-4 border-green-500">
                <span className="font-mono text-sm">GET /api/users</span>
                <span className="text-green-600 text-sm">200 OK</span>
              </div>
              <div className="flex justify-between p-2 bg-blue-50 rounded border-l-4 border-blue-500">
                <span className="font-mono text-sm">POST /api/login</span>
                <span className="text-blue-600 text-sm">201 Created</span>
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'security',
        label: 'Security',
        disabled: true,
        content: (
          <SampleContent
            title="Security"
            icon={Shield}
            content="Security analysis and vulnerability scanning (premium feature)."
          />
        ),
      },
    ];

    return (
      <div className="h-80 border border-gray-200 rounded-lg shadow-sm">
        <Tabs activeTab={activeTab} onTabChange={setActiveTab} tabs={devTabs} />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Real-world example of tabs in a developer tool interface with editor, console, network monitor, and security tabs.',
      },
    },
  },
};

// Custom styling example
export const CustomStyling: Story = {
  render: () => {
    const [activeTab, setActiveTab] = useState('notifications');

    const styledTabs: TabItem[] = [
      {
        id: 'notifications',
        label: 'Notifications',
        badge: '12',
        content: (
          <div className="h-64 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Bell className="h-5 w-5 text-yellow-600" />
              <h3 className="font-semibold text-lg">Notifications</h3>
              <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">
                12 new
              </span>
            </div>
            <div className="space-y-3">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="font-medium text-blue-800">System Update</div>
                <div className="text-sm text-blue-600 mt-1">New features available</div>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="font-medium text-yellow-800">Warning</div>
                <div className="text-sm text-yellow-600 mt-1">Disk space running low</div>
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'profile',
        label: 'Profile',
        content: (
          <div className="h-64 p-6">
            <div className="flex items-center gap-2 mb-4">
              <User className="h-5 w-5 text-green-600" />
              <h3 className="font-semibold text-lg">User Profile</h3>
            </div>
            <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg border">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-blue-500 rounded-full"></div>
                <div>
                  <div className="font-medium">John Doe</div>
                  <div className="text-sm text-gray-500">john.doe@example.com</div>
                </div>
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'settings',
        label: 'Settings',
        content: (
          <SampleContent
            title="Settings"
            icon={Settings}
            content="User preferences and application settings."
          />
        ),
      },
    ];

    return (
      <div className="h-80 border border-gray-200 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50">
        <Tabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          tabs={styledTabs}
          className="bg-white/50 backdrop-blur-sm"
        />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Example showing how tabs can be styled with custom backgrounds and integrated into designed interfaces.',
      },
    },
  },
};

// Interactive playground
export const Interactive: Story = {
  render: args => {
    const [activeTab, setActiveTab] = useState('overview');
    return (
      <div className="h-80 border border-gray-200 rounded-lg">
        <Tabs activeTab={activeTab} onTabChange={setActiveTab} tabs={basicTabs} {...args} />
      </div>
    );
  },
  args: {
    className: '',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Interactive playground to experiment with Tabs props. Use the controls panel to test different configurations.',
      },
    },
  },
};
