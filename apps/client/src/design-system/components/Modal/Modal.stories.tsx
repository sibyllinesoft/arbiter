import type { Meta, StoryObj } from '@storybook/react';
import { Bell, Code, Database, Download, FileText, Settings, Shield, User } from 'lucide-react';
import { useState } from 'react';
import Button from '../Button';
import Checkbox from '../Checkbox';
import Input from '../Input';
import Select from '../Select';
import { Modal } from './Modal';

const meta: Meta<typeof Modal> = {
  title: 'Design System/Overlays/Modal',
  component: Modal,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Professional modal dialog component with comprehensive variants, accessibility features, and elegant animations. Perfect for complex forms, settings panels, and detailed content.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'success', 'warning', 'error', 'info'],
    },
    size: {
      control: { type: 'select' },
      options: ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', 'full'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Modal>;

export const Default: Story = {
  render: () => {
    const [open, setOpen] = useState(false);

    return (
      <div className="p-8">
        <Button onClick={() => setOpen(true)}>Open Modal</Button>

        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title="Welcome to Spec Workbench"
          description="Configure your workspace settings to get started with collaborative specification editing."
        >
          <div className="space-y-4">
            <p className="text-sm text-graphite-600">
              This is your first time using Spec Workbench. Let's set up your workspace for optimal
              collaboration and productivity.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-900 mb-2">Getting Started Tips</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Create your first specification project</li>
                <li>• Invite team members to collaborate</li>
                <li>• Set up real-time sync preferences</li>
              </ul>
            </div>
          </div>
        </Modal>
      </div>
    );
  },
};

export const WithVariants: Story = {
  render: () => {
    const [successOpen, setSuccessOpen] = useState(false);
    const [warningOpen, setWarningOpen] = useState(false);
    const [errorOpen, setErrorOpen] = useState(false);
    const [infoOpen, setInfoOpen] = useState(false);

    return (
      <div className="p-8 space-x-4">
        <Button onClick={() => setSuccessOpen(true)} variant="secondary">
          Success Modal
        </Button>
        <Button onClick={() => setWarningOpen(true)} variant="secondary">
          Warning Modal
        </Button>
        <Button onClick={() => setErrorOpen(true)} variant="secondary">
          Error Modal
        </Button>
        <Button onClick={() => setInfoOpen(true)} variant="secondary">
          Info Modal
        </Button>

        <Modal
          open={successOpen}
          onClose={() => setSuccessOpen(false)}
          variant="success"
          title="Deployment Successful"
          description="Your specification has been successfully deployed to production."
        >
          <div className="space-y-4">
            <div className="bg-green-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-green-900 mb-2">Deployment Summary</h4>
              <dl className="text-sm text-green-800 space-y-1">
                <div className="flex justify-between">
                  <dt>Environment:</dt>
                  <dd className="font-medium">Production</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Build ID:</dt>
                  <dd className="font-mono">#1847</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Duration:</dt>
                  <dd>2m 34s</dd>
                </div>
              </dl>
            </div>
          </div>
        </Modal>

        <Modal
          open={warningOpen}
          onClose={() => setWarningOpen(false)}
          variant="warning"
          title="Unsaved Changes"
          description="You have unsaved changes that will be lost if you continue."
        >
          <div className="space-y-4">
            <p className="text-sm text-graphite-600">The following files have been modified:</p>
            <ul className="text-sm space-y-2">
              <li className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-yellow-500" />
                <span>spec-schema.cue</span>
                <span className="text-xs text-graphite-500">(3 changes)</span>
              </li>
              <li className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-yellow-500" />
                <span>validation-rules.cue</span>
                <span className="text-xs text-graphite-500">(1 change)</span>
              </li>
            </ul>
          </div>
        </Modal>

        <Modal
          open={errorOpen}
          onClose={() => setErrorOpen(false)}
          variant="error"
          title="Build Failed"
          description="The specification build encountered critical errors."
        >
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-red-900 mb-2">Error Details</h4>
              <pre className="text-xs text-red-800 bg-red-100 rounded p-2 overflow-x-auto">
                {`Error: validation failed at line 42
  --> spec-schema.cue:42:8
   |
42 | name: string & =~"[a-zA-Z]+"
   |        ^^^^^^
   | 
Expected valid regex pattern`}
              </pre>
            </div>
          </div>
        </Modal>

        <Modal
          open={infoOpen}
          onClose={() => setInfoOpen(false)}
          variant="info"
          title="System Maintenance"
          description="Scheduled maintenance will begin in 30 minutes."
        >
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-900 mb-2">Maintenance Schedule</h4>
              <dl className="text-sm text-blue-800 space-y-1">
                <div className="flex justify-between">
                  <dt>Start Time:</dt>
                  <dd>2:00 AM UTC</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Duration:</dt>
                  <dd>~2 hours</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Impact:</dt>
                  <dd>Read-only mode</dd>
                </div>
              </dl>
            </div>
          </div>
        </Modal>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Modal variants with semantic colors and icons for different message types.',
      },
    },
  },
};

export const SizeVariants: Story = {
  render: () => {
    const [sizes, setSizes] = useState<Record<string, boolean>>({});

    const toggleSize = (size: string) => {
      setSizes(prev => ({ ...prev, [size]: !prev[size] }));
    };

    const sizeOptions = [
      { key: 'xs', label: 'Extra Small (xs)' },
      { key: 'sm', label: 'Small (sm)' },
      { key: 'md', label: 'Medium (md)' },
      { key: 'lg', label: 'Large (lg)' },
      { key: 'xl', label: 'Extra Large (xl)' },
      { key: '2xl', label: '2X Large (2xl)' },
      { key: '3xl', label: '3X Large (3xl)' },
    ];

    return (
      <div className="p-8 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {sizeOptions.map(({ key, label }) => (
            <Button key={key} onClick={() => toggleSize(key)} variant="secondary" size="sm">
              {label}
            </Button>
          ))}
        </div>

        {sizeOptions.map(({ key, label }) => (
          <Modal
            key={key}
            open={sizes[key] || false}
            onClose={() => toggleSize(key)}
            size={key as any}
            title={`${label} Modal`}
            description={`This is a ${label.toLowerCase()} modal demonstrating the size variant.`}
          >
            <div className="space-y-4">
              <p className="text-sm text-graphite-600">
                Modal content scales appropriately with the size variant. This allows you to choose
                the right modal size based on your content requirements.
              </p>
              {key === '3xl' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Left Column</label>
                    <Input placeholder="Input field" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Right Column</label>
                    <Select options={[{ value: 'option1', label: 'Option 1' }]} />
                  </div>
                </div>
              )}
            </div>
          </Modal>
        ))}
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Different size variants of the modal component for various content requirements.',
      },
    },
  },
};

export const SettingsModal: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSave = async () => {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 2000));
      setLoading(false);
      setOpen(false);
    };

    const footer = (
      <div className="flex items-center justify-between w-full">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Reset to Defaults
        </Button>
        <div className="space-x-3">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={loading}>
            Save Settings
          </Button>
        </div>
      </div>
    );

    return (
      <div className="p-8">
        <Button onClick={() => setOpen(true)} leftIcon={<Settings className="h-4 w-4" />}>
          Open Settings
        </Button>

        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title="Workspace Settings"
          description="Configure your Spec Workbench workspace preferences and collaboration settings."
          size="2xl"
          footer={footer}
          loading={loading}
        >
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-graphite-900 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Profile Settings
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-graphite-700 mb-1">
                      Display Name
                    </label>
                    <Input placeholder="Your display name" defaultValue="Developer" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-graphite-700 mb-1">
                      Email
                    </label>
                    <Input type="email" placeholder="your.email@company.com" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-graphite-700 mb-1">
                      Time Zone
                    </label>
                    <Select
                      options={[
                        { value: 'utc', label: 'UTC' },
                        { value: 'pst', label: 'Pacific Standard Time' },
                        { value: 'est', label: 'Eastern Standard Time' },
                      ]}
                      defaultValue="utc"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-graphite-900 flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Notification Settings
                </h3>
                <div className="space-y-3">
                  <Checkbox label="Email notifications for mentions" defaultChecked />
                  <Checkbox label="Desktop notifications for comments" defaultChecked />
                  <Checkbox label="Weekly activity digest" />
                  <Checkbox label="Security alerts" defaultChecked />
                </div>
              </div>
            </div>

            <div className="border-t border-graphite-200 pt-6">
              <h3 className="text-sm font-semibold text-graphite-900 flex items-center gap-2 mb-4">
                <Shield className="h-4 w-4" />
                Security & Privacy
              </h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Checkbox label="Two-factor authentication" />
                  <Checkbox label="Session timeout after 1 hour" defaultChecked />
                  <Checkbox label="Require password for sensitive actions" defaultChecked />
                </div>
                <div className="space-y-3">
                  <Checkbox label="Share usage analytics" />
                  <Checkbox label="Allow crash reporting" defaultChecked />
                  <Checkbox label="Beta feature access" />
                </div>
              </div>
            </div>
          </div>
        </Modal>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Complex settings modal with form controls, loading states, and custom footer actions.',
      },
    },
  },
};

export const DataExportModal: Story = {
  render: () => {
    const [open, setOpen] = useState(false);

    const footer = (
      <div className="flex items-center justify-between w-full">
        <div className="text-xs text-graphite-500">
          Export includes all specifications and metadata
        </div>
        <div className="space-x-3">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button leftIcon={<Download className="h-4 w-4" />}>Start Export</Button>
        </div>
      </div>
    );

    return (
      <div className="p-8">
        <Button onClick={() => setOpen(true)} leftIcon={<Database className="h-4 w-4" />}>
          Export Data
        </Button>

        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title="Export Workspace Data"
          description="Choose the format and scope of your data export."
          size="lg"
          footer={footer}
        >
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-graphite-900 mb-3">Export Format</h3>
              <div className="grid grid-cols-3 gap-3">
                {['JSON', 'YAML', 'CUE'].map(format => (
                  <label key={format} className="relative">
                    <input
                      type="radio"
                      name="format"
                      value={format}
                      defaultChecked={format === 'JSON'}
                      className="sr-only peer"
                    />
                    <div className="p-3 border border-graphite-200 rounded-lg cursor-pointer peer-checked:border-blue-500 peer-checked:bg-blue-50">
                      <div className="text-sm font-medium text-graphite-900">{format}</div>
                      <div className="text-xs text-graphite-500 mt-1">
                        {format === 'JSON' && 'Standard JSON format'}
                        {format === 'YAML' && 'Human-readable YAML'}
                        {format === 'CUE' && 'Native CUE format'}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-graphite-900 mb-3">Include in Export</h3>
              <div className="space-y-2">
                <Checkbox label="Specification files" defaultChecked />
                <Checkbox label="Configuration settings" defaultChecked />
                <Checkbox label="User permissions and roles" />
                <Checkbox label="Revision history" />
                <Checkbox label="Comments and annotations" />
                <Checkbox label="Integration configurations" />
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-yellow-900">Privacy Note</h4>
                  <p className="text-xs text-yellow-800 mt-1">
                    Sensitive data like API keys and passwords will be excluded from the export for
                    security.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Data export modal with complex form controls and informational content.',
      },
    },
  },
};

export const LoadingModal: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleOpen = () => {
      setOpen(true);
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
      }, 3000);
    };

    return (
      <div className="p-8">
        <Button onClick={handleOpen}>Open Loading Modal</Button>

        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title="Processing Request"
          description="Please wait while we process your specification validation."
          size="md"
          loading={loading}
          closeOnBackdropClick={false}
          closeOnEscape={false}
        >
          <div className="space-y-4">
            <div className="text-center py-8">
              <div className="mx-auto mb-4 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Code className="h-6 w-6 text-blue-600" />
              </div>
              <h4 className="text-sm font-medium text-graphite-900 mb-2">
                Validating Specifications
              </h4>
              <p className="text-xs text-graphite-600">
                Running validation rules against your CUE specifications...
              </p>
            </div>
          </div>
        </Modal>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Modal with loading overlay that prevents interaction until the operation completes.',
      },
    },
  },
};
