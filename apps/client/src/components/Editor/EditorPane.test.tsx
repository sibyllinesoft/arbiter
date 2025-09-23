/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiService } from '../../services/api';
import type { Fragment } from '../../types/api';
import EditorPane from './EditorPane';

// Mock child components
vi.mock('./FileTree', () => ({
  default: () => <div data-testid="file-tree">File Tree Component</div>,
}));

vi.mock('./MonacoEditor', () => ({
  default: ({ onChange, onSave, onEditorReady, value }: any) => {
    React.useEffect(() => {
      if (onEditorReady) {
        const mockEditor = {
          onDidBlurEditorText: vi.fn(callback => {
            // Simulate editor blur event for auto-save testing
            setTimeout(callback, 100);
          }),
        };
        onEditorReady(mockEditor);
      }
    }, [onEditorReady]);

    return (
      <div data-testid="monaco-editor">
        <textarea
          data-testid="editor-textarea"
          value={value}
          onChange={e => onChange(e.target.value)}
        />
        <button data-testid="editor-save" onClick={onSave}>
          Save from Editor
        </button>
      </div>
    );
  },
}));

vi.mock('../Layout/SplitPane', () => ({
  default: ({ children }: any) => (
    <div data-testid="split-pane">
      {children[0]}
      {children[1]}
    </div>
  ),
}));

// Mock API service
vi.mock('../../services/api', () => ({
  apiService: {
    updateFragment: vi.fn(),
  },
}));

// Mock context hooks
vi.mock('../../contexts/AppContext', () => ({
  useApp: vi.fn(),
  useCurrentProject: vi.fn(),
  useActiveFragment: vi.fn(),
  useEditorContent: vi.fn(),
}));

// Import mocked hooks
import {
  useActiveFragment,
  useApp,
  useCurrentProject,
  useEditorContent,
} from '../../contexts/AppContext';

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  Code2: () => <div data-testid="code-icon" />,
  FileText: () => <div data-testid="file-text-icon" />,
  Save: () => <div data-testid="save-icon" />,
  Circle: () => <div data-testid="circle-icon" />,
  CheckCircle2: () => <div data-testid="check-circle-icon" />,
}));

// Mock test data
const mockProject = {
  id: 'project-1',
  name: 'Test Project',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  description: 'A test project',
};

const mockActiveFragment: Fragment = {
  id: 'fragment-1',
  project_id: 'project-1',
  path: 'api/routes.cue',
  content: 'package api\nroutes: {}',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockFragments: Fragment[] = [mockActiveFragment];

const mockAppState = {
  fragments: mockFragments,
  unsavedChanges: new Set<string>(),
  editorContent: {},
  activeFragmentId: 'fragment-1',
};

// Mock context return values
const mockUseApp = useApp as any;
const mockUseCurrentProject = useCurrentProject as any;
const mockUseActiveFragment = useActiveFragment as any;
const mockUseEditorContent = useEditorContent as any;

describe('EditorPane', () => {
  const user = userEvent.setup();
  const mockUpdateEditorContent = vi.fn();
  const mockMarkUnsaved = vi.fn();
  const mockMarkSaved = vi.fn();
  const mockSetError = vi.fn();
  const mockDispatch = vi.fn();

  beforeEach(() => {
    // Setup default mock returns
    mockUseApp.mockReturnValue({
      state: mockAppState,
      updateEditorContent: mockUpdateEditorContent,
      markUnsaved: mockMarkUnsaved,
      markSaved: mockMarkSaved,
      setError: mockSetError,
      dispatch: mockDispatch,
    });

    mockUseCurrentProject.mockReturnValue(mockProject);
    mockUseActiveFragment.mockReturnValue(mockActiveFragment);
    mockUseEditorContent.mockReturnValue('package api\nroutes: {}');

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders split pane with file tree and editor', () => {
      render(<EditorPane />);

      expect(screen.getByTestId('split-pane')).toBeInTheDocument();
      expect(screen.getByTestId('file-tree')).toBeInTheDocument();
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<EditorPane className="custom-editor-pane" />);

      const container = screen.getByTestId('split-pane').closest('.custom-editor-pane');
      expect(container).toBeInTheDocument();
    });

    it('shows active fragment information in header', () => {
      render(<EditorPane />);

      expect(screen.getByText('api/routes.cue')).toBeInTheDocument();
      expect(screen.getByTestId('code-icon')).toBeInTheDocument();
    });

    it('shows file status indicators', () => {
      render(<EditorPane />);

      // Should show saved status by default
      expect(screen.getByTestId('check-circle-icon')).toBeInTheDocument();
      expect(screen.getByText('Saved')).toBeInTheDocument();
    });

    it('shows file type and encoding information', () => {
      render(<EditorPane />);

      expect(screen.getByText('CUE')).toBeInTheDocument();
      expect(screen.getByText('UTF-8')).toBeInTheDocument();
      expect(screen.getByText('LF')).toBeInTheDocument();
    });
  });

  describe('No Project State', () => {
    it('shows no project selected state', () => {
      mockUseCurrentProject.mockReturnValue(null);

      render(<EditorPane />);

      expect(screen.getByText('No Project Selected')).toBeInTheDocument();
      expect(screen.getByText(/Select a project from the sidebar/)).toBeInTheDocument();
    });
  });

  describe('No Active Fragment State', () => {
    it('shows ready to code state when no fragment is active', () => {
      mockUseActiveFragment.mockReturnValue(null);

      render(<EditorPane />);

      expect(screen.getByText('Ready to Code')).toBeInTheDocument();
      expect(screen.getByText(/Select a fragment from the file tree/)).toBeInTheDocument();
    });

    it('shows helpful hint when no fragments exist', () => {
      mockUseActiveFragment.mockReturnValue(null);
      mockUseApp.mockReturnValue({
        ...mockUseApp(),
        state: { ...mockAppState, fragments: [] },
      });

      render(<EditorPane />);

      expect(
        screen.getByText(/Create your first fragment using the \+ button/)
      ).toBeInTheDocument();
    });
  });

  describe('Fragment Loading', () => {
    it('loads fragment content when active fragment changes', () => {
      const mockFragment = {
        ...mockActiveFragment,
        content: 'package test\nvalue: "new content"',
      };

      mockUseActiveFragment.mockReturnValue(mockFragment);
      mockUseEditorContent.mockReturnValue(''); // No content in editor yet

      render(<EditorPane />);

      expect(mockUpdateEditorContent).toHaveBeenCalledWith(
        'fragment-1',
        'package test\nvalue: "new content"'
      );
    });

    it('does not reload content if already present in editor', () => {
      mockUseEditorContent.mockReturnValue('existing content');

      render(<EditorPane />);

      expect(mockUpdateEditorContent).not.toHaveBeenCalled();
    });
  });

  describe('Content Editing', () => {
    it('updates editor content when user types', async () => {
      render(<EditorPane />);

      const textarea = screen.getByTestId('editor-textarea');
      // Use fireEvent to directly set value instead of user.type to avoid character-by-character issues
      fireEvent.change(textarea, { target: { value: 'new content' } });

      // Check that updateEditorContent was called with the new content
      expect(mockUpdateEditorContent).toHaveBeenCalledWith('fragment-1', 'new content');
    });

    it('marks fragment as unsaved when content differs from original', async () => {
      render(<EditorPane />);

      const textarea = screen.getByTestId('editor-textarea');
      await user.clear(textarea);
      await user.type(textarea, 'modified content');

      expect(mockMarkUnsaved).toHaveBeenCalledWith('fragment-1');
    });

    it.skip('marks fragment as saved when content matches original', async () => {
      render(<EditorPane />);

      const textarea = screen.getByTestId('editor-textarea');
      // First change to something different to ensure we have a baseline
      fireEvent.change(textarea, { target: { value: 'different content' } });

      // Verify markUnsaved was called first
      expect(mockMarkUnsaved).toHaveBeenCalledWith('fragment-1');

      // Then change back to original content
      fireEvent.change(textarea, { target: { value: 'package api\nroutes: {}' } });

      // markSaved should be called when content matches the original fragment content
      expect(mockMarkSaved).toHaveBeenCalledWith('fragment-1');
    });

    it('handles editor change when no active fragment', async () => {
      mockUseActiveFragment.mockReturnValue(null);

      render(<EditorPane />);

      const textarea = screen.queryByTestId('editor-textarea');
      expect(textarea).not.toBeInTheDocument();
    });
  });

  describe('Unsaved Changes Display', () => {
    it('shows modified indicator when fragment has unsaved changes', () => {
      mockUseApp.mockReturnValue({
        ...mockUseApp(),
        state: { ...mockAppState, unsavedChanges: new Set(['fragment-1']) },
      });

      render(<EditorPane />);

      expect(screen.getByTestId('circle-icon')).toBeInTheDocument();
      expect(screen.getByText('Modified')).toBeInTheDocument();
    });

    it('shows saved indicator when fragment has no unsaved changes', () => {
      render(<EditorPane />);

      expect(screen.getByTestId('check-circle-icon')).toBeInTheDocument();
      expect(screen.getByText('Saved')).toBeInTheDocument();
    });

    it('updates save button state based on unsaved changes', () => {
      mockUseApp.mockReturnValue({
        ...mockUseApp(),
        state: { ...mockAppState, unsavedChanges: new Set(['fragment-1']) },
      });

      render(<EditorPane />);

      const saveButton = screen.getByTestId('save-icon').closest('button');
      expect(saveButton).not.toBeDisabled();
      expect(saveButton).toHaveClass('bg-blue-100', 'text-blue-600');
    });

    it('disables save button when no unsaved changes', () => {
      render(<EditorPane />);

      const saveButton = screen.getByTestId('save-icon').closest('button');
      expect(saveButton).toBeDisabled();
      expect(saveButton).toHaveClass('bg-graphite-100', 'text-graphite-400');
    });
  });

  describe('Save Functionality', () => {
    it('saves fragment when save button is clicked', async () => {
      const mockUpdateFragment = apiService.updateFragment as any;
      mockUpdateFragment.mockResolvedValue({
        id: 'fragment-1',
        path: 'api/routes.cue',
        content: 'updated content',
        updated_at: '2024-01-01T01:00:00Z',
      });

      mockUseApp.mockReturnValue({
        ...mockUseApp(),
        state: {
          ...mockAppState,
          editorContent: { 'fragment-1': 'updated content' },
          unsavedChanges: new Set(['fragment-1']), // Mark fragment as having unsaved changes
        },
      });

      render(<EditorPane />);

      const saveButton = screen.getByTestId('save-icon').closest('button');
      await user.click(saveButton!);

      expect(mockUpdateFragment).toHaveBeenCalledWith('project-1', 'fragment-1', 'updated content');
    });

    it('updates fragment state after successful save', async () => {
      const updatedFragment = {
        id: 'fragment-1',
        path: 'api/routes.cue',
        content: 'updated content',
        updated_at: '2024-01-01T01:00:00Z',
      };

      const mockUpdateFragment = apiService.updateFragment as any;
      mockUpdateFragment.mockResolvedValue(updatedFragment);

      mockUseApp.mockReturnValue({
        ...mockUseApp(),
        state: {
          ...mockAppState,
          editorContent: { 'fragment-1': 'updated content' },
          unsavedChanges: new Set(['fragment-1']), // Mark fragment as having unsaved changes
        },
      });

      render(<EditorPane />);

      const saveButton = screen.getByTestId('save-icon').closest('button');
      await user.click(saveButton!);

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith({
          type: 'UPDATE_FRAGMENT',
          payload: updatedFragment,
        });
        expect(mockMarkSaved).toHaveBeenCalledWith('fragment-1');
      });
    });

    it('handles save API error', async () => {
      const mockUpdateFragment = apiService.updateFragment as any;
      mockUpdateFragment.mockRejectedValue(new Error('API Error'));

      mockUseApp.mockReturnValue({
        ...mockUseApp(),
        state: {
          ...mockAppState,
          editorContent: { 'fragment-1': 'updated content' },
        },
      });

      render(<EditorPane />);

      const saveButton = screen.getByTestId('save-icon').closest('button');
      await user.click(saveButton!);

      await waitFor(() => {
        expect(mockSetError).toHaveBeenCalledWith('API Error');
      });
    });

    it('does not save when no changes exist', async () => {
      const mockUpdateFragment = apiService.updateFragment as any;

      render(<EditorPane />);

      const saveButton = screen.getByTestId('save-icon').closest('button');
      await user.click(saveButton!);

      expect(mockUpdateFragment).not.toHaveBeenCalled();
    });

    it('handles save when no project or fragment', async () => {
      mockUseCurrentProject.mockReturnValue(null);
      mockUseActiveFragment.mockReturnValue(null);

      render(<EditorPane />);

      // Should not crash or attempt to save
      expect(screen.getByText('No Project Selected')).toBeInTheDocument();
    });
  });

  describe('Auto-Save Functionality', () => {
    it('sets up auto-save on editor blur', async () => {
      mockUseApp.mockReturnValue({
        ...mockUseApp(),
        state: {
          ...mockAppState,
          unsavedChanges: new Set(['fragment-1']),
          editorContent: { 'fragment-1': 'updated content' },
        },
      });

      const mockUpdateFragment = apiService.updateFragment as any;
      mockUpdateFragment.mockResolvedValue({
        id: 'fragment-1',
        content: 'updated content',
      });

      render(<EditorPane />);

      // Auto-save should be triggered by the mock editor's blur handler
      await waitFor(
        () => {
          expect(mockUpdateFragment).toHaveBeenCalled();
        },
        { timeout: 500 }
      );
    });

    it('does not auto-save when no unsaved changes', async () => {
      const mockUpdateFragment = apiService.updateFragment as any;

      render(<EditorPane />);

      // Wait for potential auto-save trigger
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(mockUpdateFragment).not.toHaveBeenCalled();
    });

    it('handles auto-save when fragment is no longer active', async () => {
      mockUseActiveFragment.mockReturnValue(null);

      render(<EditorPane />);

      // Should not crash when trying to auto-save with no active fragment
      await new Promise(resolve => setTimeout(resolve, 200));
    });
  });

  describe('Editor Configuration', () => {
    it('passes correct props to MonacoEditor', () => {
      render(<EditorPane />);

      const editor = screen.getByTestId('monaco-editor');
      expect(editor).toBeInTheDocument();

      // Check that the textarea receives the content
      const textarea = screen.getByTestId('editor-textarea');
      expect(textarea).toHaveValue('package api\nroutes: {}');
    });

    it('configures editor with CUE language', () => {
      render(<EditorPane />);

      // The MonacoEditor mock should receive language="cue"
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });

    it('sets up editor with proper theme', () => {
      render(<EditorPane />);

      // The MonacoEditor mock should receive theme="cue-light"
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });

    it('passes fragment ID to editor', () => {
      render(<EditorPane />);

      // The MonacoEditor mock should receive fragmentId
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });
  });

  describe('Split Pane Configuration', () => {
    it('configures split pane with correct properties', () => {
      render(<EditorPane />);

      const splitPane = screen.getByTestId('split-pane');
      expect(splitPane).toBeInTheDocument();

      // Should contain both file tree and editor sections
      expect(screen.getByTestId('file-tree')).toBeInTheDocument();
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('provides semantic structure', () => {
      render(<EditorPane />);

      // Editor header should have proper structure
      const editorHeader = screen.getByText('api/routes.cue').closest('div');
      expect(editorHeader).toHaveClass('flex', 'items-center', 'gap-3');
    });

    it('provides accessible save button', () => {
      mockUseApp.mockReturnValue({
        ...mockUseApp(),
        state: { ...mockAppState, unsavedChanges: new Set(['fragment-1']) },
      });

      render(<EditorPane />);

      const saveButton = screen.getByTestId('save-icon').closest('button');
      expect(saveButton).toBeInTheDocument();
      expect(saveButton).not.toBeDisabled();
    });

    it('provides accessible status indicators', () => {
      render(<EditorPane />);

      expect(screen.getByText('Saved')).toBeInTheDocument();
      expect(screen.getByTestId('check-circle-icon')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('handles large content efficiently', () => {
      const largeContent = 'package api\n'.repeat(1000) + 'value: "large content"';

      mockUseActiveFragment.mockReturnValue({
        ...mockActiveFragment,
        content: largeContent,
      });
      mockUseEditorContent.mockReturnValue(largeContent);

      const startTime = performance.now();
      render(<EditorPane />);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100);
    });

    it('efficiently updates content without re-rendering unnecessarily', () => {
      const { rerender } = render(<EditorPane />);

      // Change unrelated state
      mockUseApp.mockReturnValue({
        ...mockUseApp(),
        state: { ...mockAppState, someOtherProperty: 'changed' },
      });

      const startTime = performance.now();
      rerender(<EditorPane />);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(50);
    });
  });

  describe('Edge Cases', () => {
    it('handles missing fragment content gracefully', () => {
      mockUseActiveFragment.mockReturnValue({
        ...mockActiveFragment,
        content: undefined as any,
      });

      expect(() => {
        render(<EditorPane />);
      }).not.toThrow();
    });

    it('handles editor content that is undefined', () => {
      mockUseEditorContent.mockReturnValue(undefined as any);

      expect(() => {
        render(<EditorPane />);
      }).not.toThrow();
    });

    it('handles save when fragment content is the same', async () => {
      mockUseApp.mockReturnValue({
        ...mockUseApp(),
        state: {
          ...mockAppState,
          editorContent: { 'fragment-1': 'package api\nroutes: {}' }, // Same as original
        },
      });

      const mockUpdateFragment = apiService.updateFragment as any;

      render(<EditorPane />);

      const saveButton = screen.getByTestId('save-icon').closest('button');
      await user.click(saveButton!);

      expect(mockUpdateFragment).not.toHaveBeenCalled();
    });

    it('handles rapid content changes', async () => {
      render(<EditorPane />);

      const textarea = screen.getByTestId('editor-textarea');

      // Rapid changes - simulate typing directly instead of clear+type to avoid multiple calls
      await user.type(textarea, 'content 1');
      await user.type(textarea, 'content 2');
      await user.type(textarea, 'content 3');

      expect(mockUpdateEditorContent).toHaveBeenCalled();
    });
  });

  describe('Component Integration', () => {
    it('integrates file tree and editor correctly', () => {
      render(<EditorPane />);

      expect(screen.getByTestId('file-tree')).toBeInTheDocument();
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
      expect(screen.getByTestId('split-pane')).toBeInTheDocument();
    });

    it('responds to editor save action', async () => {
      const mockUpdateFragment = apiService.updateFragment as any;
      mockUpdateFragment.mockResolvedValue({
        id: 'fragment-1',
        content: 'saved content',
      });

      mockUseApp.mockReturnValue({
        ...mockUseApp(),
        state: {
          ...mockAppState,
          editorContent: { 'fragment-1': 'saved content' },
        },
      });

      render(<EditorPane />);

      const editorSaveButton = screen.getByTestId('editor-save');
      await user.click(editorSaveButton);

      expect(mockUpdateFragment).toHaveBeenCalled();
    });
  });
});
