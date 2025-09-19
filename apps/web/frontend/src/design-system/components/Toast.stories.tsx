/**
 * Toast Component Stories
 * Comprehensive documentation and examples for the Toast notification system
 * Showcasing professional notifications with sophisticated graphite theme
 */

import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import {
  Download,
  Upload,
  Trash2,
  Save,
  Copy,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
} from 'lucide-react';
import Toast, { ToastContainer, ToastManager, toast } from './Toast';
import Button from './Button';

const meta = {
  title: 'Design System/Toast',
  component: Toast,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Professional toast notification system with comprehensive variants, animations, and management features. Designed for developer tools with sophisticated graphite theme.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['success', 'warning', 'error', 'info', 'loading', 'neutral'],
      description: 'Semantic variant of the toast',
    },
    position: {
      control: { type: 'select' },
      options: [
        'top-right',
        'top-left',
        'bottom-right',
        'bottom-left',
        'top-center',
        'bottom-center',
      ],
      description: 'Position of the toast on screen',
    },
    duration: {
      control: { type: 'number' },
      description: 'Duration in milliseconds before auto-dismiss (0 for no auto-dismiss)',
    },
    showProgress: {
      control: { type: 'boolean' },
      description: 'Whether to show progress bar indicating time remaining',
    },
    dismissible: {
      control: { type: 'boolean' },
      description: 'Whether the toast can be dismissed by clicking',
    },
    closable: {
      control: { type: 'boolean' },
      description: 'Whether to show close button',
    },
  },
} satisfies Meta<typeof Toast>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default toast
export const Default: Story = {
  args: {
    variant: 'success',
    title: 'Success!',
    description: 'Your changes have been saved successfully.',
    visible: true,
    duration: 5000,
  },
  render: args => (
    <div className="relative h-screen bg-graphite-50">
      <Toast {...args} />
    </div>
  ),
};

// All variants
export const Variants: Story = {
  render: () => {
    const [visibleToasts, setVisibleToasts] = useState({
      success: true,
      warning: true,
      error: true,
      info: true,
      loading: true,
      neutral: true,
    });

    const toggleToast = (variant: keyof typeof visibleToasts) => {
      setVisibleToasts(prev => ({ ...prev, [variant]: !prev[variant] }));
    };

    return (
      <div className="relative h-screen bg-graphite-50 p-8">
        <div className="mb-8 space-y-4">
          <h3 className="text-lg font-semibold text-graphite-800">Toast Variants</h3>
          <div className="flex flex-wrap gap-2">
            {Object.keys(visibleToasts).map(variant => (
              <Button
                key={variant}
                size="sm"
                variant="secondary"
                onClick={() => toggleToast(variant as keyof typeof visibleToasts)}
              >
                Toggle {variant}
              </Button>
            ))}
          </div>
        </div>

        {visibleToasts.success && (
          <Toast
            variant="success"
            title="Deployment Successful"
            description="Your application has been deployed to production successfully."
            position="top-right"
            visible={visibleToasts.success}
            onClose={() => toggleToast('success')}
          />
        )}

        {visibleToasts.warning && (
          <Toast
            variant="warning"
            title="Build Warning"
            description="Some dependencies are outdated. Consider updating them."
            position="top-center"
            visible={visibleToasts.warning}
            onClose={() => toggleToast('warning')}
          />
        )}

        {visibleToasts.error && (
          <Toast
            variant="error"
            title="Deployment Failed"
            description="The deployment failed due to a configuration error. Please check your settings."
            position="top-left"
            visible={visibleToasts.error}
            onClose={() => toggleToast('error')}
          />
        )}

        {visibleToasts.info && (
          <Toast
            variant="info"
            title="New Update Available"
            description="A new version of the application is available for download."
            position="bottom-right"
            visible={visibleToasts.info}
            onClose={() => toggleToast('info')}
          />
        )}

        {visibleToasts.loading && (
          <Toast
            variant="loading"
            title="Processing Request"
            description="Please wait while we process your request..."
            position="bottom-center"
            visible={visibleToasts.loading}
            closable={false}
            duration={0}
            onClose={() => toggleToast('loading')}
          />
        )}

        {visibleToasts.neutral && (
          <Toast
            variant="neutral"
            title="Reminder"
            description="Don't forget to commit your changes before switching branches."
            position="bottom-left"
            visible={visibleToasts.neutral}
            onClose={() => toggleToast('neutral')}
          />
        )}
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'All semantic variants of toast notifications positioned at different locations on screen.',
      },
    },
  },
};

// With progress indicators
export const WithProgress: Story = {
  render: () => {
    const [toastVisible, setToastVisible] = useState(true);

    return (
      <div className="relative h-screen bg-graphite-50 p-8">
        <div className="mb-8 space-y-4">
          <h3 className="text-lg font-semibold text-graphite-800">Progress Indicators</h3>
          <Button onClick={() => setToastVisible(true)} disabled={toastVisible}>
            Show Progress Toast
          </Button>
        </div>

        <Toast
          variant="info"
          title="Auto-dismissing Toast"
          description="This toast will automatically dismiss in 8 seconds. Watch the progress bar!"
          visible={toastVisible}
          duration={8000}
          showProgress
          onClose={() => setToastVisible(false)}
        />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Toast with progress bar showing time remaining before auto-dismiss.',
      },
    },
  },
};

// With custom actions
export const WithActions: Story = {
  render: () => {
    const [toastVisible, setToastVisible] = useState(true);

    return (
      <div className="relative h-screen bg-graphite-50 p-8">
        <div className="mb-8 space-y-4">
          <h3 className="text-lg font-semibold text-graphite-800">Custom Actions</h3>
          <Button onClick={() => setToastVisible(true)} disabled={toastVisible}>
            Show Action Toast
          </Button>
        </div>

        <Toast
          variant="warning"
          title="Unsaved Changes"
          description="You have unsaved changes. Would you like to save them before continuing?"
          visible={toastVisible}
          duration={0}
          action={
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  console.log('Changes saved!');
                  setToastVisible(false);
                }}
              >
                Save Changes
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  console.log('Changes discarded');
                  setToastVisible(false);
                }}
              >
                Discard
              </Button>
            </div>
          }
          onClose={() => setToastVisible(false)}
        />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Toast with custom action buttons for user interaction.',
      },
    },
  },
};

// Toast manager demonstration
export const ToastManagerDemo: Story = {
  render: () => {
    const [toasts, setToasts] = useState<any[]>([]);
    const [manager] = useState(() => {
      const mgr = new ToastManager();
      mgr.subscribe(() => {
        setToasts([...mgr.getToasts()]);
      });
      return mgr;
    });

    const showToasts = () => {
      manager.success('Build Completed', 'Your project built successfully in 2.3 seconds');
      setTimeout(() => {
        manager.warning('Dependency Update', 'New version of React available');
      }, 500);
      setTimeout(() => {
        manager.info('Deployment Ready', 'Your build is ready for deployment');
      }, 1000);
      setTimeout(() => {
        manager.error('Test Failed', 'Unit tests failed. Please fix the issues before deploying.');
      }, 1500);
    };

    const showLoadingSequence = () => {
      const loadingId = manager.loading(
        'Processing...',
        'Analyzing your code for potential issues'
      );

      setTimeout(() => {
        manager.hide(loadingId);
        manager.success('Analysis Complete', 'No issues found in your codebase');
      }, 3000);
    };

    return (
      <div className="relative h-screen bg-graphite-50 p-8">
        <div className="mb-8 space-y-4">
          <h3 className="text-lg font-semibold text-graphite-800">Toast Manager</h3>
          <div className="flex flex-wrap gap-2">
            <Button onClick={showToasts}>Show Multiple Toasts</Button>
            <Button onClick={showLoadingSequence}>Show Loading Sequence</Button>
            <Button
              variant="secondary"
              onClick={() => manager.clear()}
              disabled={toasts.length === 0}
            >
              Clear All ({toasts.length})
            </Button>
          </div>
        </div>

        <ToastContainer
          toasts={toasts}
          position="top-right"
          limit={5}
          onToastClose={id => manager.hide(id)}
        />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Toast management system with automatic stacking and lifecycle management.',
      },
    },
  },
};

// Professional developer tool examples
export const DeveloperToolExamples: Story = {
  render: () => {
    const [toasts, setToasts] = useState<any[]>([]);
    const [manager] = useState(() => {
      const mgr = new ToastManager();
      mgr.subscribe(() => {
        setToasts([...mgr.getToasts()]);
      });
      return mgr;
    });

    const showBuildSuccess = () => {
      manager.success('Build Successful', 'Project built in 2.3s with 0 errors', {
        icon: <CheckCircle />,
        showProgress: true,
        action: (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost">
              View Output
            </Button>
          </div>
        ),
      });
    };

    const showDeploymentProcess = () => {
      const steps = [
        { title: 'Building...', desc: 'Compiling source code' },
        { title: 'Testing...', desc: 'Running unit tests' },
        { title: 'Deploying...', desc: 'Uploading to production server' },
        { title: 'Deployment Complete', desc: 'Your app is now live!', success: true },
      ];

      let currentStep = 0;
      const loadingId = manager.loading(steps[0].title, steps[0].desc);

      const interval = setInterval(() => {
        currentStep++;
        if (currentStep < steps.length - 1) {
          manager.hide(loadingId);
          const newLoadingId = manager.loading(steps[currentStep].title, steps[currentStep].desc);
        } else {
          manager.hide(loadingId);
          manager.success(steps[currentStep].title, steps[currentStep].desc, {
            icon: <Upload />,
            action: (
              <Button size="sm" variant="ghost">
                View Site
              </Button>
            ),
          });
          clearInterval(interval);
        }
      }, 2000);
    };

    const showFileOperations = () => {
      manager.info('File Downloaded', 'spec-config.json has been downloaded', {
        icon: <Download />,
        action: (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost">
              Open Folder
            </Button>
          </div>
        ),
      });

      setTimeout(() => {
        manager.warning('Large File Upload', 'Uploading 250MB file may take several minutes', {
          icon: <Upload />,
          duration: 8000,
          showProgress: true,
        });
      }, 1000);
    };

    const showErrorWithActions = () => {
      manager.error('Compilation Error', 'TypeScript error in src/components/Button.tsx:42', {
        icon: <AlertCircle />,
        duration: 0,
        action: (
          <div className="flex gap-2">
            <Button size="sm" variant="primary">
              View Problem
            </Button>
            <Button size="sm" variant="ghost">
              Ignore
            </Button>
          </div>
        ),
      });
    };

    const showGitOperations = () => {
      const commitId = manager.loading(
        'Committing Changes',
        'Preparing commit with 12 changed files'
      );

      setTimeout(() => {
        manager.hide(commitId);
        manager.success('Changes Committed', 'Committed 12 files to feature/new-dashboard', {
          action: (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost">
                Push to Remote
              </Button>
            </div>
          ),
        });
      }, 2000);
    };

    const showTestResults = () => {
      manager.warning('Test Suite Results', '23 passed, 2 failed, 1 skipped', {
        icon: <AlertCircle />,
        showProgress: true,
        action: (
          <div className="flex gap-2">
            <Button size="sm" variant="primary">
              View Failures
            </Button>
            <Button size="sm" variant="ghost">
              Re-run Tests
            </Button>
          </div>
        ),
      });
    };

    return (
      <div className="relative h-screen bg-graphite-50 p-8">
        <div className="space-y-8">
          <div>
            <h3 className="text-lg font-semibold text-graphite-800 mb-4">
              Developer Tool Examples
            </h3>
            <p className="text-graphite-600 mb-6">
              Real-world toast notifications commonly used in developer tools and IDEs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-3">
              <h4 className="font-medium text-graphite-700">Build & Compilation</h4>
              <div className="space-y-2">
                <Button size="sm" className="w-full" onClick={showBuildSuccess}>
                  Build Success
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full"
                  onClick={showErrorWithActions}
                >
                  Compilation Error
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-graphite-700">Deployment</h4>
              <div className="space-y-2">
                <Button size="sm" className="w-full" onClick={showDeploymentProcess}>
                  Deploy Sequence
                </Button>
                <Button size="sm" variant="secondary" className="w-full" onClick={showTestResults}>
                  Test Results
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-graphite-700">File Operations</h4>
              <div className="space-y-2">
                <Button size="sm" className="w-full" onClick={showFileOperations}>
                  File Operations
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full"
                  onClick={showGitOperations}
                >
                  Git Operations
                </Button>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-graphite-200">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => manager.clear()}
              disabled={toasts.length === 0}
            >
              Clear All Notifications ({toasts.length})
            </Button>
          </div>
        </div>

        <ToastContainer
          toasts={toasts}
          position="top-right"
          limit={6}
          onToastClose={id => manager.hide(id)}
        />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Professional examples of toast notifications in developer tools: build processes, deployment sequences, file operations, git workflows, and test results.',
      },
    },
  },
};

// Different positions
export const Positions: Story = {
  render: () => {
    const positions: Array<
      'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center'
    > = ['top-right', 'top-left', 'bottom-right', 'bottom-left', 'top-center', 'bottom-center'];

    const [visiblePositions, setVisiblePositions] = useState<Record<string, boolean>>(
      positions.reduce((acc, pos) => ({ ...acc, [pos]: false }), {})
    );

    const togglePosition = (position: string) => {
      setVisiblePositions(prev => ({ ...prev, [position]: !prev[position] }));
    };

    return (
      <div className="relative h-screen bg-graphite-50 p-8">
        <div className="mb-8 space-y-4">
          <h3 className="text-lg font-semibold text-graphite-800">Toast Positions</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {positions.map(position => (
              <Button
                key={position}
                size="sm"
                variant="secondary"
                onClick={() => togglePosition(position)}
              >
                {position}
              </Button>
            ))}
          </div>
        </div>

        {positions.map(
          position =>
            visiblePositions[position] && (
              <Toast
                key={position}
                variant="info"
                title={`Toast at ${position}`}
                description="This toast demonstrates positioning"
                position={position}
                visible={visiblePositions[position]}
                onClose={() => togglePosition(position)}
              />
            )
        )}
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Toast notifications positioned at different locations on the screen.',
      },
    },
  },
};

// Interactive playground
export const Interactive: Story = {
  args: {
    variant: 'info',
    title: 'Interactive Toast',
    description: 'This is a customizable toast notification.',
    visible: true,
    duration: 5000,
    position: 'top-right',
    showProgress: false,
    dismissible: false,
    closable: true,
  },
  render: args => (
    <div className="relative h-screen bg-graphite-50">
      <Toast {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Interactive playground to experiment with all toast props. Use the controls panel below to test different combinations.',
      },
    },
  },
};
