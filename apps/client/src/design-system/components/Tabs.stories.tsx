/**
 * Tabs Component Stories
 * Comprehensive documentation and examples for the Tabs component
 * Showcasing professional tabbed interfaces with sophisticated graphite theme
 */

import type { Meta, StoryObj } from '@storybook/react';
import {
  Activity,
  AlertTriangle,
  Bug,
  CheckCircle,
  Code,
  Database,
  FileText,
  GitBranch,
  Globe,
  Play,
  Settings,
  Shield,
  Terminal,
  Users,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import Button from './Button';
import StatusBadge from './StatusBadge';
import Tabs from './Tabs';

const meta = {
  title: 'Design System/Tabs',
  component: Tabs,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Professional tabs component with comprehensive features including scrollable tabs, closable tabs, loading states, and keyboard navigation. Designed for developer tools with sophisticated graphite theme.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['underline', 'pills', 'bordered', 'buttons'],
      description: 'Visual variant of the tabs',
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
      description: 'Size of the tabs',
    },
    fullWidth: {
      control: { type: 'boolean' },
      description: 'Whether tabs should take full width',
    },
    scrollable: {
      control: { type: 'boolean' },
      description: 'Whether tabs should be scrollable when overflowing',
    },
    showScrollButtons: {
      control: { type: 'boolean' },
      description: 'Whether to show scroll buttons',
    },
  },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

// Basic tab content components for examples
const OverviewContent = () => (
  <div className="p-6 bg-graphite-50 rounded-lg">
    <h3 className="text-lg font-semibold text-graphite-900 mb-4">Project Overview</h3>
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-white rounded-lg border border-graphite-200">
          <div className="text-sm text-graphite-600">Total Files</div>
          <div className="text-2xl font-bold text-graphite-900">1,247</div>
        </div>
        <div className="p-4 bg-white rounded-lg border border-graphite-200">
          <div className="text-sm text-graphite-600">Lines of Code</div>
          <div className="text-2xl font-bold text-graphite-900">45,231</div>
        </div>
      </div>
      <p className="text-graphite-600">
        This project contains the main application code with TypeScript, React components, and
        comprehensive test coverage.
      </p>
    </div>
  </div>
);

const CodeContent = () => (
  <div className="p-6 bg-graphite-50 rounded-lg">
    <h3 className="text-lg font-semibold text-graphite-900 mb-4">Source Code</h3>
    <div className="bg-graphite-900 rounded-lg p-4 text-sm font-mono">
      <div className="text-green-400">// Example TypeScript code</div>
      <div className="text-white">
        <span className="text-purple-400">export</span>{' '}
        <span className="text-blue-400">interface</span>{' '}
        <span className="text-yellow-400">TabItem</span> <span className="text-white">{'{'}</span>
      </div>
      <div className="text-white ml-4">
        <span className="text-cyan-400">id</span>: <span className="text-green-400">string</span>;
      </div>
      <div className="text-white ml-4">
        <span className="text-cyan-400">label</span>: <span className="text-green-400">string</span>
        ;
      </div>
      <div className="text-white">{'}'}</div>
    </div>
  </div>
);

const DatabaseContent = () => (
  <div className="p-6 bg-graphite-50 rounded-lg">
    <h3 className="text-lg font-semibold text-graphite-900 mb-4">Database Schema</h3>
    <div className="space-y-4">
      <div className="bg-white border border-graphite-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Database className="h-4 w-4 text-blue-500" />
          <span className="font-medium">users</span>
        </div>
        <div className="text-sm text-graphite-600 space-y-1">
          <div>id: UUID (Primary Key)</div>
          <div>email: VARCHAR(255)</div>
          <div>created_at: TIMESTAMP</div>
        </div>
      </div>
    </div>
  </div>
);

// Default tabs
export const Default: Story = {
  args: {
    items: [
      {
        id: 'overview',
        label: 'Overview',
        content: <OverviewContent />,
      },
      {
        id: 'code',
        label: 'Source Code',
        icon: <Code />,
        content: <CodeContent />,
      },
      {
        id: 'database',
        label: 'Database',
        icon: <Database />,
        badge: '3',
        content: <DatabaseContent />,
      },
      {
        id: 'settings',
        label: 'Settings',
        icon: <Settings />,
        content: (
          <div className="p-6 bg-graphite-50 rounded-lg">
            <h3 className="text-lg font-semibold text-graphite-900 mb-4">Project Settings</h3>
            <p className="text-graphite-600">Configure your project settings here.</p>
          </div>
        ),
      },
    ],
    activeTab: 'overview',
  },
};

// All variants
export const Variants: Story = {
  render: () => {
    const items = [
      { id: 'tab1', label: 'Overview', content: <div className="p-4">Overview content</div> },
      { id: 'tab2', label: 'Details', content: <div className="p-4">Details content</div> },
      { id: 'tab3', label: 'Settings', content: <div className="p-4">Settings content</div> },
    ];

    return (
      <div className="space-y-8">
        <div>
          <h4 className="text-sm font-medium text-graphite-700 mb-3">Underline</h4>
          <Tabs variant="underline" items={items} />
        </div>

        <div>
          <h4 className="text-sm font-medium text-graphite-700 mb-3">Pills</h4>
          <Tabs variant="pills" items={items} />
        </div>

        <div>
          <h4 className="text-sm font-medium text-graphite-700 mb-3">Bordered</h4>
          <Tabs variant="bordered" items={items} />
        </div>

        <div>
          <h4 className="text-sm font-medium text-graphite-700 mb-3">Buttons</h4>
          <Tabs variant="buttons" items={items} />
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Different visual variants of tabs: underline (default), pills, bordered, and buttons.',
      },
    },
  },
};

// Different sizes
export const Sizes: Story = {
  render: () => {
    const items = [
      {
        id: 'tab1',
        label: 'Small',
        icon: <Code />,
        content: <div className="p-4">Small tab content</div>,
      },
      {
        id: 'tab2',
        label: 'Medium',
        icon: <Database />,
        badge: '5',
        content: <div className="p-4">Medium tab content</div>,
      },
      {
        id: 'tab3',
        label: 'Large',
        icon: <Settings />,
        content: <div className="p-4">Large tab content</div>,
      },
    ];

    return (
      <div className="space-y-8">
        <div>
          <h4 className="text-sm font-medium text-graphite-700 mb-3">Small</h4>
          <Tabs size="sm" items={items} />
        </div>

        <div>
          <h4 className="text-sm font-medium text-graphite-700 mb-3">Medium</h4>
          <Tabs size="md" items={items} />
        </div>

        <div>
          <h4 className="text-sm font-medium text-graphite-700 mb-3">Large</h4>
          <Tabs size="lg" items={items} />
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Different sizes of tabs with proportional scaling.',
      },
    },
  },
};

// With icons, badges, and states
export const WithIconsAndBadges: Story = {
  render: () => {
    const items = [
      {
        id: 'files',
        label: 'Files',
        icon: <FileText />,
        badge: '24',
        content: <div className="p-4">Files and directories in your project</div>,
      },
      {
        id: 'git',
        label: 'Git Changes',
        icon: <GitBranch />,
        badge: '7',
        content: <div className="p-4">Uncommitted changes in your repository</div>,
      },
      {
        id: 'tests',
        label: 'Tests',
        icon: <Play />,
        loading: true,
        content: <div className="p-4">Test results will appear here</div>,
      },
      {
        id: 'issues',
        label: 'Issues',
        icon: <Bug />,
        badge: '2',
        disabled: true,
        content: <div className="p-4">Code analysis issues</div>,
      },
      {
        id: 'metrics',
        label: 'Metrics',
        icon: <Activity />,
        content: <div className="p-4">Performance and quality metrics</div>,
      },
    ];

    return <Tabs items={items} variant="pills" />;
  },
  parameters: {
    docs: {
      description: {
        story: 'Tabs with icons, badges, loading states, and disabled states.',
      },
    },
  },
};

// Closable tabs
export const ClosableTabs: Story = {
  render: () => {
    const [tabs, setTabs] = useState([
      {
        id: 'main.ts',
        label: 'main.ts',
        icon: <FileText />,
        closable: true,
        content: (
          <div className="p-4">
            <h4 className="font-medium mb-2">main.ts</h4>
            <p className="text-graphite-600">Main application entry point</p>
          </div>
        ),
      },
      {
        id: 'components.tsx',
        label: 'components.tsx',
        icon: <Code />,
        closable: true,
        content: (
          <div className="p-4">
            <h4 className="font-medium mb-2">components.tsx</h4>
            <p className="text-graphite-600">React components library</p>
          </div>
        ),
      },
      {
        id: 'database.sql',
        label: 'database.sql',
        icon: <Database />,
        closable: true,
        content: (
          <div className="p-4">
            <h4 className="font-medium mb-2">database.sql</h4>
            <p className="text-graphite-600">Database schema definitions</p>
          </div>
        ),
      },
      {
        id: 'config.json',
        label: 'config.json',
        icon: <Settings />,
        closable: true,
        content: (
          <div className="p-4">
            <h4 className="font-medium mb-2">config.json</h4>
            <p className="text-graphite-600">Application configuration file</p>
          </div>
        ),
      },
    ]);

    const handleTabClose = (tabId: string) => {
      setTabs(prevTabs => prevTabs.filter(tab => tab.id !== tabId));
    };

    const addNewTab = () => {
      const newTab = {
        id: `new-file-${Date.now()}`,
        label: 'untitled.ts',
        icon: <FileText />,
        closable: true,
        content: (
          <div className="p-4">
            <h4 className="font-medium mb-2">untitled.ts</h4>
            <p className="text-graphite-600">New TypeScript file</p>
          </div>
        ),
      };
      setTabs(prevTabs => [...prevTabs, newTab]);
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-graphite-700">File Tabs</h4>
          <Button size="sm" onClick={addNewTab}>
            New File
          </Button>
        </div>
        <Tabs items={tabs} variant="bordered" onTabClose={handleTabClose} />
        {tabs.length === 0 && (
          <div className="text-center py-8 text-graphite-500">
            No files open. Click "New File" to create a tab.
          </div>
        )}
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Tabs with close buttons that can be dynamically added and removed.',
      },
    },
  },
};

// Scrollable tabs
export const ScrollableTabs: Story = {
  render: () => {
    const tabs = Array.from({ length: 15 }, (_, i) => ({
      id: `file-${i + 1}`,
      label: `very-long-filename-${i + 1}.tsx`,
      icon: <FileText />,
      closable: true,
      content: (
        <div className="p-4">
          <h4 className="font-medium mb-2">File {i + 1}</h4>
          <p className="text-graphite-600">Content for file {i + 1}</p>
        </div>
      ),
    }));

    return (
      <div className="space-y-6">
        <div>
          <h4 className="text-sm font-medium text-graphite-700 mb-3">Scrollable with Buttons</h4>
          <Tabs items={tabs} variant="bordered" scrollable showScrollButtons />
        </div>

        <div>
          <h4 className="text-sm font-medium text-graphite-700 mb-3">Scrollable without Buttons</h4>
          <Tabs items={tabs} variant="pills" scrollable />
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Scrollable tabs for handling overflow with optional scroll buttons.',
      },
    },
  },
};

// Professional developer tool examples
export const DeveloperToolExamples: Story = {
  render: () => {
    const [activeSection, setActiveSection] = useState('ide');

    const ideEditorTabs = [
      {
        id: 'main.ts',
        label: 'main.ts',
        icon: <FileText />,
        closable: true,
        content: (
          <div className="p-6 bg-graphite-50 rounded-lg min-h-[300px]">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-graphite-900">main.ts</h4>
              <StatusBadge variant="success" size="xs" showDot>
                Saved
              </StatusBadge>
            </div>
            <div className="bg-graphite-900 rounded-lg p-4 text-sm font-mono text-white">
              <div className="text-green-400">// Main application entry point</div>
              <div>
                <span className="text-purple-400">import</span> {'{ App }'}{' '}
                <span className="text-purple-400">from</span>{' '}
                <span className="text-yellow-300">'./App'</span>;
              </div>
              <div>
                <span className="text-purple-400">import</span>{' '}
                <span className="text-yellow-300">'./main.css'</span>;
              </div>
              <br />
              <div>
                <span className="text-blue-400">const</span>{' '}
                <span className="text-cyan-400">app</span> ={' '}
                <span className="text-purple-400">new</span>{' '}
                <span className="text-yellow-400">App</span>();
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'app.tsx',
        label: 'App.tsx',
        icon: <Code />,
        badge: '!',
        closable: true,
        content: (
          <div className="p-6 bg-graphite-50 rounded-lg min-h-[300px]">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-graphite-900">App.tsx</h4>
              <StatusBadge variant="warning" size="xs" icon={<AlertTriangle />}>
                Unsaved Changes
              </StatusBadge>
            </div>
            <p className="text-graphite-600">
              Main React application component with routing and global state management.
            </p>
          </div>
        ),
      },
      {
        id: 'database.ts',
        label: 'database.ts',
        icon: <Database />,
        loading: true,
        content: (
          <div className="p-6 bg-graphite-50 rounded-lg min-h-[300px]">
            <h4 className="font-semibold text-graphite-900 mb-4">database.ts</h4>
            <p className="text-graphite-600">Database connection and query utilities.</p>
          </div>
        ),
      },
    ];

    const deploymentTabs = [
      {
        id: 'overview',
        label: 'Overview',
        icon: <Activity />,
        content: (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-graphite-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="h-4 w-4 text-green-500" />
                  <span className="font-medium">Production</span>
                </div>
                <StatusBadge variant="active" size="xs" showDot pulse>
                  Deployed
                </StatusBadge>
              </div>
              <div className="bg-white border border-graphite-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Terminal className="h-4 w-4 text-blue-500" />
                  <span className="font-medium">Staging</span>
                </div>
                <StatusBadge variant="pending" size="xs" showDot>
                  Building
                </StatusBadge>
              </div>
              <div className="bg-white border border-graphite-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Bug className="h-4 w-4 text-purple-500" />
                  <span className="font-medium">Testing</span>
                </div>
                <StatusBadge variant="success" size="xs" showDot>
                  Ready
                </StatusBadge>
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'logs',
        label: 'Build Logs',
        icon: <Terminal />,
        badge: '234',
        content: (
          <div className="p-6 bg-graphite-50 rounded-lg min-h-[300px]">
            <h4 className="font-semibold text-graphite-900 mb-4">Build Output</h4>
            <div className="bg-graphite-900 rounded-lg p-4 text-sm font-mono text-green-400 space-y-1">
              <div>✓ Compiled successfully in 2.3s</div>
              <div>✓ Generated static files</div>
              <div>✓ Optimized bundle size: 234.5 KB</div>
              <div>✓ Deployment complete</div>
            </div>
          </div>
        ),
      },
      {
        id: 'metrics',
        label: 'Performance',
        icon: <Zap />,
        content: (
          <div className="p-6 bg-graphite-50 rounded-lg min-h-[300px]">
            <h4 className="font-semibold text-graphite-900 mb-4">Performance Metrics</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-lg border border-graphite-200">
                <div className="text-2xl font-bold text-green-600">98</div>
                <div className="text-sm text-graphite-600">Performance Score</div>
              </div>
              <div className="bg-white p-4 rounded-lg border border-graphite-200">
                <div className="text-2xl font-bold text-blue-600">1.2s</div>
                <div className="text-sm text-graphite-600">Load Time</div>
              </div>
            </div>
          </div>
        ),
      },
    ];

    const teamTabs = [
      {
        id: 'members',
        label: 'Team Members',
        icon: <Users />,
        badge: '12',
        content: (
          <div className="p-6 space-y-4">
            <div className="space-y-3">
              {[
                { name: 'Sarah Chen', role: 'Frontend Developer', status: 'online' },
                { name: 'Marcus Johnson', role: 'Backend Engineer', status: 'away' },
                { name: 'Emily Rodriguez', role: 'DevOps Engineer', status: 'offline' },
              ].map((member, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 bg-white border border-graphite-200 rounded-lg"
                >
                  <div>
                    <div className="font-medium text-graphite-900">{member.name}</div>
                    <div className="text-sm text-graphite-600">{member.role}</div>
                  </div>
                  <StatusBadge
                    variant={
                      member.status === 'online'
                        ? 'active'
                        : member.status === 'away'
                          ? 'pending'
                          : 'inactive'
                    }
                    size="xs"
                    showDot
                    pulse={member.status === 'online'}
                  >
                    {member.status}
                  </StatusBadge>
                </div>
              ))}
            </div>
          </div>
        ),
      },
      {
        id: 'permissions',
        label: 'Permissions',
        icon: <Shield />,
        content: (
          <div className="p-6 bg-graphite-50 rounded-lg min-h-[300px]">
            <h4 className="font-semibold text-graphite-900 mb-4">Access Control</h4>
            <p className="text-graphite-600">Manage team member permissions and access levels.</p>
          </div>
        ),
      },
      {
        id: 'activity',
        label: 'Activity',
        icon: <Activity />,
        badge: '5',
        content: (
          <div className="p-6 bg-graphite-50 rounded-lg min-h-[300px]">
            <h4 className="font-semibold text-graphite-900 mb-4">Recent Activity</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <div className="text-sm">
                  <span className="font-medium">Sarah Chen</span> pushed to main branch
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <div className="text-sm">
                  <span className="font-medium">Marcus Johnson</span> created new feature branch
                </div>
              </div>
            </div>
          </div>
        ),
      },
    ];

    return (
      <div className="space-y-8">
        {/* Section selector */}
        <div className="border-b border-graphite-200 pb-4">
          <h3 className="text-lg font-semibold text-graphite-800 mb-4">Developer Tool Examples</h3>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={activeSection === 'ide' ? 'primary' : 'secondary'}
              onClick={() => setActiveSection('ide')}
            >
              IDE Editor
            </Button>
            <Button
              size="sm"
              variant={activeSection === 'deployment' ? 'primary' : 'secondary'}
              onClick={() => setActiveSection('deployment')}
            >
              Deployment
            </Button>
            <Button
              size="sm"
              variant={activeSection === 'team' ? 'primary' : 'secondary'}
              onClick={() => setActiveSection('team')}
            >
              Team Management
            </Button>
          </div>
        </div>

        {/* IDE Editor Example */}
        {activeSection === 'ide' && (
          <div>
            <h4 className="text-sm font-medium text-graphite-700 mb-4">Code Editor - File Tabs</h4>
            <Tabs items={ideEditorTabs} variant="bordered" scrollable showScrollButtons />
          </div>
        )}

        {/* Deployment Dashboard Example */}
        {activeSection === 'deployment' && (
          <div>
            <h4 className="text-sm font-medium text-graphite-700 mb-4">Deployment Dashboard</h4>
            <Tabs items={deploymentTabs} variant="underline" />
          </div>
        )}

        {/* Team Management Example */}
        {activeSection === 'team' && (
          <div>
            <h4 className="text-sm font-medium text-graphite-700 mb-4">Team Management Console</h4>
            <Tabs items={teamTabs} variant="pills" />
          </div>
        )}
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Real-world examples of tabs in developer tools: IDE file tabs, deployment dashboards, and team management interfaces.',
      },
    },
  },
};

// Interactive playground
export const Interactive: Story = {
  args: {
    variant: 'underline',
    size: 'md',
    fullWidth: false,
    scrollable: false,
    showScrollButtons: false,
    items: [
      {
        id: 'tab1',
        label: 'First Tab',
        icon: <FileText />,
        content: <div className="p-4">Content for the first tab</div>,
      },
      {
        id: 'tab2',
        label: 'Second Tab',
        icon: <Code />,
        badge: '5',
        content: <div className="p-4">Content for the second tab</div>,
      },
      {
        id: 'tab3',
        label: 'Third Tab',
        icon: <Database />,
        closable: true,
        content: <div className="p-4">Content for the third tab</div>,
      },
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Interactive playground to experiment with all tabs props. Use the controls panel below to test different combinations.',
      },
    },
  },
};
