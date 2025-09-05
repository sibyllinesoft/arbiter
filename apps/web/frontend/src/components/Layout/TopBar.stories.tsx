/**
 * TopBar Component Stories
 * Showcase of the enhanced TopBar with Graphite Design System
 */

import type { Meta, StoryObj } from '@storybook/react';
import { TopBar } from './TopBar';

const meta = {
  title: 'Components/TopBar',
  component: TopBar,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Enhanced top navigation bar for the Spec Workbench application. Features project selector, connection status, validation state, and action buttons with professional graphite styling.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof TopBar>;

export default meta;
type Story = StoryObj<typeof meta>;

// Mock the required context providers
const mockContextValue = {
  state: {
    projects: [
      { id: '1', name: 'Sample Project', description: 'A sample project' },
    ],
    currentProjectId: '1',
    fragments: [
      { id: '1', path: 'api/routes.cue', content: 'package api', project_id: '1', created_at: '', updated_at: '' },
      { id: '2', path: 'schemas/user.cue', content: 'package schemas', project_id: '1', created_at: '', updated_at: '' },
    ],
    unsavedChanges: new Set(['1']),
    activeFragmentId: '1',
    editorContent: {},
    loading: false,
    error: null,
    connectionStatus: {
      isConnected: true,
      reconnectAttempts: 0,
      lastSync: new Date().toISOString(),
    },
    validationState: {
      errors: [],
      warnings: [],
      isValidating: false,
      lastValidation: null,
      specHash: null,
    }
  },
  dispatch: () => {},
  setActiveFragment: () => {},
  setLoading: () => {},
  setError: () => {},
};

// Default state - connected and valid
export const Default: Story = {
  decorators: [
    (Story) => (
      <div className="min-h-screen bg-gray-50">
        <Story />
      </div>
    ),
  ],
};

// With unsaved changes
export const WithUnsavedChanges: Story = {
  decorators: [
    (Story) => (
      <div className="min-h-screen bg-gray-50">
        <Story />
      </div>
    ),
  ],
};

// Disconnected state
export const Disconnected: Story = {
  decorators: [
    (Story) => (
      <div className="min-h-screen bg-gray-50">
        <Story />
      </div>
    ),
  ],
};

// Validation errors
export const WithValidationErrors: Story = {
  decorators: [
    (Story) => (
      <div className="min-h-screen bg-gray-50">
        <Story />
      </div>
    ),
  ],
};

// Loading/validating state
export const Validating: Story = {
  decorators: [
    (Story) => (
      <div className="min-h-screen bg-gray-50">
        <Story />
      </div>
    ),
  ],
};

// No project selected
export const NoProject: Story = {
  decorators: [
    (Story) => (
      <div className="min-h-screen bg-gray-50">
        <Story />
      </div>
    ),
  ],
};

// Note: The TopBar component requires React context providers that aren't available in Storybook stories. 
// In a real implementation, you would need to wrap these stories with mock providers or create a 
// standalone version of the TopBar for Storybook that doesn't depend on context.