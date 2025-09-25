import type { Meta, StoryObj } from '@storybook/react';
import {
  AlertTriangle,
  CheckCircle,
  Download,
  Info,
  LogOut,
  RefreshCw,
  Settings,
  Shield,
  Trash,
  Upload,
  XCircle,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import Button from './Button';
import { AlertDialog, ConfirmDialog, Dialog, useDialog } from './Dialog';

const meta: Meta<typeof Dialog> = {
  title: 'Design System/Overlays/Dialog',
  component: Dialog,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Simple confirmation and alert dialogs with predefined actions. Perfect for quick confirmations, alerts, and simple user interactions.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: { type: 'select' },
      options: ['default', 'confirmation', 'destructive', 'success', 'warning', 'error', 'info'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Dialog>;

export const Default: Story = {
  render: () => {
    const [open, setOpen] = useState(false);

    return (
      <div className="p-8">
        <Button onClick={() => setOpen(true)}>Open Dialog</Button>

        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          title="Confirm Action"
          description="Are you sure you want to proceed with this action? This cannot be undone."
        />
      </div>
    );
  },
};

export const ConfirmationDialog: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    const [result, setResult] = useState<string>('');

    const handleConfirm = () => {
      setResult('Confirmed!');
      setOpen(false);
      setTimeout(() => setResult(''), 3000);
    };

    return (
      <div className="p-8">
        <Button onClick={() => setOpen(true)} variant="secondary">
          Save Changes
        </Button>

        {result && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">{result}</p>
          </div>
        )}

        <ConfirmDialog
          open={open}
          onClose={() => setOpen(false)}
          onConfirm={handleConfirm}
          title="Save Changes"
          description="Save your changes to the specification? This will create a new revision."
          confirmLabel="Save"
          type="confirmation"
        />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Confirmation dialog for save actions with custom labels and callbacks.',
      },
    },
  },
};

export const DestructiveDialog: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<string>('');

    const handleDelete = async () => {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 2000));
      setLoading(false);
      setResult('Item deleted successfully');
      setOpen(false);
      setTimeout(() => setResult(''), 3000);
    };

    return (
      <div className="p-8">
        <Button onClick={() => setOpen(true)} variant="danger" icon={<Trash className="h-4 w-4" />}>
          Delete Project
        </Button>

        {result && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{result}</p>
          </div>
        )}

        <ConfirmDialog
          open={open}
          onClose={() => setOpen(false)}
          onConfirm={handleDelete}
          title="Delete Project"
          description="Are you sure you want to delete 'Spec Workbench'? This action cannot be undone and will permanently remove all specifications, configurations, and history."
          confirmLabel="Delete Project"
          type="destructive"
          loading={loading}
        />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Destructive dialog for dangerous actions like deletion, with loading state.',
      },
    },
  },
};

export const AlertDialogs: Story = {
  render: () => {
    const [successOpen, setSuccessOpen] = useState(false);
    const [warningOpen, setWarningOpen] = useState(false);
    const [errorOpen, setErrorOpen] = useState(false);
    const [infoOpen, setInfoOpen] = useState(false);

    return (
      <div className="p-8 space-x-4">
        <Button onClick={() => setSuccessOpen(true)} variant="secondary">
          Success Alert
        </Button>
        <Button onClick={() => setWarningOpen(true)} variant="secondary">
          Warning Alert
        </Button>
        <Button onClick={() => setErrorOpen(true)} variant="secondary">
          Error Alert
        </Button>
        <Button onClick={() => setInfoOpen(true)} variant="secondary">
          Info Alert
        </Button>

        <AlertDialog
          open={successOpen}
          onClose={() => setSuccessOpen(false)}
          type="success"
          title="Deployment Complete"
          description="Your specification has been successfully deployed to production."
        >
          <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm text-green-800">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>Build #1847 deployed in 2m 34s</span>
            </div>
          </div>
        </AlertDialog>

        <AlertDialog
          open={warningOpen}
          onClose={() => setWarningOpen(false)}
          type="warning"
          title="Validation Warning"
          description="Some fields may not meet the recommended specifications."
        >
          <div className="mt-4 space-y-2 text-sm text-graphite-600">
            <p>The following issues were detected:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Field 'description' is missing in 3 entities</li>
              <li>Some enum values exceed recommended length</li>
              <li>Consider adding validation constraints</li>
            </ul>
          </div>
        </AlertDialog>

        <AlertDialog
          open={errorOpen}
          onClose={() => setErrorOpen(false)}
          type="error"
          title="Build Failed"
          description="The specification build encountered critical errors that prevent deployment."
        >
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium text-red-900">Syntax Error</div>
                <div className="text-red-800 mt-1 font-mono text-xs">
                  spec-schema.cue:42:8 - Invalid regex pattern
                </div>
              </div>
            </div>
          </div>
        </AlertDialog>

        <AlertDialog
          open={infoOpen}
          onClose={() => setInfoOpen(false)}
          type="info"
          title="System Update"
          description="A new version of Spec Workbench is available with improved CUE validation."
        >
          <div className="mt-4 space-y-3">
            <div className="text-sm text-graphite-600">
              <strong>What's New:</strong>
            </div>
            <ul className="text-sm text-graphite-600 space-y-1">
              <li className="flex items-center gap-2">
                <Zap className="h-3 w-3 text-blue-500" />
                Faster validation engine
              </li>
              <li className="flex items-center gap-2">
                <Shield className="h-3 w-3 text-blue-500" />
                Enhanced security features
              </li>
              <li className="flex items-center gap-2">
                <Settings className="h-3 w-3 text-blue-500" />
                Improved collaboration tools
              </li>
            </ul>
          </div>
        </AlertDialog>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Different types of alert dialogs for various notification scenarios.',
      },
    },
  },
};

export const CustomActionsDialog: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    const [result, setResult] = useState<string>('');

    const actions = [
      {
        label: 'Save Draft',
        variant: 'secondary' as const,
        onClick: () => {
          setResult('Saved as draft');
          setOpen(false);
          setTimeout(() => setResult(''), 3000);
        },
      },
      {
        label: 'Discard',
        variant: 'ghost' as const,
        onClick: () => {
          setResult('Changes discarded');
          setOpen(false);
          setTimeout(() => setResult(''), 3000);
        },
      },
      {
        label: 'Publish',
        variant: 'primary' as const,
        onClick: () => {
          setResult('Published successfully');
          setOpen(false);
          setTimeout(() => setResult(''), 3000);
        },
      },
    ];

    return (
      <div className="p-8">
        <Button onClick={() => setOpen(true)}>Publish Specification</Button>

        {result && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">{result}</p>
          </div>
        )}

        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          title="Publish Specification"
          description="Choose how you want to handle your specification changes."
          type="info"
          actions={actions}
          showCancel={false}
        >
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Changes Summary</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• 3 schema definitions updated</li>
                <li>• 2 validation rules added</li>
                <li>• 1 deprecated field removed</li>
              </ul>
            </div>
            <div className="text-sm text-graphite-600">
              <strong>Note:</strong> Publishing will make these changes available to all team
              members.
            </div>
          </div>
        </Dialog>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Dialog with custom action buttons for complex workflows.',
      },
    },
  },
};

export const SystemDialogs: Story = {
  render: () => {
    const [logoutOpen, setLogoutOpen] = useState(false);
    const [updateOpen, setUpdateOpen] = useState(false);
    const [resetOpen, setResetOpen] = useState(false);

    return (
      <div className="p-8 space-y-4">
        <div className="space-x-4">
          <Button
            onClick={() => setLogoutOpen(true)}
            variant="secondary"
            icon={<LogOut className="h-4 w-4" />}
          >
            Sign Out
          </Button>
          <Button
            onClick={() => setUpdateOpen(true)}
            variant="secondary"
            icon={<Download className="h-4 w-4" />}
          >
            Install Update
          </Button>
          <Button
            onClick={() => setResetOpen(true)}
            variant="secondary"
            icon={<RefreshCw className="h-4 w-4" />}
          >
            Reset Settings
          </Button>
        </div>

        <ConfirmDialog
          open={logoutOpen}
          onClose={() => setLogoutOpen(false)}
          onConfirm={() => {
            setLogoutOpen(false);
            alert('Signed out!');
          }}
          title="Sign Out"
          description="Are you sure you want to sign out? Any unsaved changes will be lost."
          confirmLabel="Sign Out"
          type="confirmation"
        />

        <Dialog
          open={updateOpen}
          onClose={() => setUpdateOpen(false)}
          title="Install System Update"
          description="Version 2.1.0 is ready to install. The application will restart after installation."
          type="info"
          actions={[
            {
              label: 'Install Later',
              variant: 'secondary',
              onClick: () => setUpdateOpen(false),
            },
            {
              label: 'Install Now',
              variant: 'primary',
              onClick: () => {
                setUpdateOpen(false);
                alert('Installing update...');
              },
            },
          ]}
          showCancel={false}
        >
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-900 mb-2">Release Notes</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Improved CUE validation performance</li>
                <li>• Enhanced real-time collaboration</li>
                <li>• Bug fixes and security improvements</li>
              </ul>
            </div>
            <div className="text-xs text-graphite-500">
              Update size: 12.3 MB • Estimated time: 2-3 minutes
            </div>
          </div>
        </Dialog>

        <ConfirmDialog
          open={resetOpen}
          onClose={() => setResetOpen(false)}
          onConfirm={() => {
            setResetOpen(false);
            alert('Settings reset!');
          }}
          title="Reset All Settings"
          description="This will restore all settings to their default values. Your projects and data will not be affected."
          confirmLabel="Reset Settings"
          type="destructive"
        />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Common system dialogs for logout, updates, and settings reset.',
      },
    },
  },
};

export const ImperativeDialogHook: Story = {
  render: () => {
    const { confirm, alert, dialog } = useDialog();
    const [result, setResult] = useState<string>('');

    const handleConfirmExample = async () => {
      const confirmed = await confirm({
        title: 'Delete File',
        description: 'Are you sure you want to delete "spec-schema.cue"? This cannot be undone.',
        confirmLabel: 'Delete',
        type: 'destructive',
      });

      setResult(confirmed ? 'File deleted' : 'Delete cancelled');
      setTimeout(() => setResult(''), 3000);
    };

    const handleAlertExample = async () => {
      await alert({
        title: 'Operation Complete',
        description: 'Your specification has been validated successfully.',
        type: 'success',
      });

      setResult('Alert dismissed');
      setTimeout(() => setResult(''), 3000);
    };

    const handleCustomDialog = async () => {
      await dialog({
        title: 'Custom Dialog',
        description: 'This dialog was created imperatively using the useDialog hook.',
        type: 'info',
        actions: [
          {
            label: 'Option A',
            variant: 'secondary',
            onClick: () => {
              setResult('Selected Option A');
              setTimeout(() => setResult(''), 3000);
            },
          },
          {
            label: 'Option B',
            variant: 'primary',
            onClick: () => {
              setResult('Selected Option B');
              setTimeout(() => setResult(''), 3000);
            },
          },
        ],
        showCancel: true,
      });
    };

    return (
      <div className="p-8 space-y-4">
        <div className="space-x-4">
          <Button onClick={handleConfirmExample} variant="secondary">
            Confirm Dialog
          </Button>
          <Button onClick={handleAlertExample} variant="secondary">
            Alert Dialog
          </Button>
          <Button onClick={handleCustomDialog} variant="secondary">
            Custom Dialog
          </Button>
        </div>

        {result && (
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-sm text-gray-800">Result: {result}</p>
          </div>
        )}
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Imperative dialog usage with the useDialog hook for programmatic control.',
      },
    },
  },
};
