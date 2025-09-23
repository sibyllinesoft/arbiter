/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { toast } from 'react-toastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiService } from '../../services/api';
import type { Fragment } from '../../types/api';
import FileTree from './FileTree';

// Mock dependencies
vi.mock('react-toastify', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../services/api', () => ({
  apiService: {
    createFragment: vi.fn(),
    deleteFragment: vi.fn(),
  },
}));

vi.mock('../../contexts/AppContext', () => ({
  useApp: vi.fn(),
}));

vi.mock('../../contexts/ProjectContext', () => ({
  useCurrentProject: vi.fn(),
}));

// Import mocked context hooks
import { useApp } from '../../contexts/AppContext';
import { useCurrentProject } from '../../contexts/ProjectContext';

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  File: () => <div data-testid="file-icon" />,
  Folder: () => <div data-testid="folder-icon" />,
  FolderOpen: () => <div data-testid="folder-open-icon" />,
  Plus: () => <div data-testid="plus-icon" />,
  MoreHorizontal: () => <div data-testid="more-horizontal-icon" />,
  Trash2: () => <div data-testid="trash-icon" />,
  Edit: () => <div data-testid="edit-icon" />,
  ChevronRight: () => <div data-testid="chevron-right-icon" />,
  ChevronDown: () => <div data-testid="chevron-down-icon" />,
  FileText: () => <div data-testid="file-text-icon" />,
  Code: () => <div data-testid="code-icon" />,
  Settings: () => <div data-testid="settings-icon" />,
  Database: () => <div data-testid="database-icon" />,
  Image: () => <div data-testid="image-icon" />,
  Archive: () => <div data-testid="archive-icon" />,
}));

// Mock design system components
vi.mock('../../design-system', () => ({
  Button: ({ children, onClick, disabled, className, size, variant, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
      data-size={size}
      data-variant={variant}
      {...props}
    >
      {children}
    </button>
  ),
  Input: ({
    value,
    onChange,
    onKeyDown,
    placeholder,
    className,
    autoFocus,
    size,
    ...props
  }: any) => (
    <input
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      className={className}
      autoFocus={autoFocus}
      data-size={size}
      data-testid="file-tree-input"
      {...props}
    />
  ),
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

// Mock project data
const mockProject = {
  id: 'project-1',
  name: 'Test Project',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  description: 'A test project',
};

// Mock fragments data
const mockFragments: Fragment[] = [
  {
    id: 'fragment-1',
    project_id: 'project-1',
    path: 'api/routes.cue',
    content: 'package api\nroutes: {}',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'fragment-2',
    project_id: 'project-1',
    path: 'api/middleware/auth.cue',
    content: 'package middleware\nauth: {}',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'fragment-3',
    project_id: 'project-1',
    path: 'config/database.cue',
    content: 'package config\ndb: {}',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'fragment-4',
    project_id: 'project-1',
    path: 'types.json',
    content: '{"types": {}}',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

// Mock app state
const mockAppState = {
  fragments: mockFragments,
  unsavedChanges: new Set(['fragment-1']),
  activeFragmentId: 'fragment-1',
};

// Mock context return values
const mockUseApp = useApp as any;
const mockUseCurrentProject = useCurrentProject as any;

describe('FileTree', () => {
  const user = userEvent.setup();
  const mockDispatch = vi.fn();
  const mockSetActiveFragment = vi.fn();
  const mockSetError = vi.fn();

  beforeEach(() => {
    // Setup default mock returns
    mockUseApp.mockReturnValue({
      state: mockAppState,
      dispatch: mockDispatch,
      setActiveFragment: mockSetActiveFragment,
      setError: mockSetError,
    });

    mockUseCurrentProject.mockReturnValue(mockProject);

    // Mock window.confirm
    global.confirm = vi.fn(() => true);

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders file tree header', () => {
      render(<FileTree />);

      expect(screen.getByText('Explorer')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument(); // fragment count badge
      expect(screen.getByTestId('folder-icon')).toBeInTheDocument();
      expect(screen.getByTestId('plus-icon')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<FileTree className="custom-file-tree" />);

      const container = screen.getByText('Explorer').closest('.custom-file-tree');
      expect(container).toBeInTheDocument();
    });

    it('builds hierarchical tree structure from fragments', () => {
      render(<FileTree />);

      // Should show folders and files in hierarchy
      expect(screen.getByText('api')).toBeInTheDocument();
      expect(screen.getByText('config')).toBeInTheDocument();
      expect(screen.getByText('routes.cue')).toBeInTheDocument();
      expect(screen.getByText('database.cue')).toBeInTheDocument();
      expect(screen.getByText('types.json')).toBeInTheDocument();
    });

    it('shows correct file type icons', () => {
      render(<FileTree />);

      // Should have code icons for .cue files and other icons for different types
      expect(screen.getAllByTestId('code-icon')).toHaveLength(3); // .cue files
      expect(screen.getByTestId('file-text-icon')).toBeInTheDocument(); // .json file
    });

    it('displays unsaved changes indicator', () => {
      render(<FileTree />);

      // Fragment 1 has unsaved changes, should show indicator
      const routesFile = screen.getByText('routes.cue').closest('[role="button"]');
      expect(routesFile).toHaveClass('bg-amber-50/50');
    });

    it('highlights active fragment', () => {
      render(<FileTree />);

      const activeFile = screen.getByText('routes.cue').closest('[role="button"]');
      expect(activeFile).toHaveClass('from-blue-50');
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no fragments', () => {
      mockUseApp.mockReturnValue({
        state: { ...mockAppState, fragments: [] },
        dispatch: mockDispatch,
        setActiveFragment: mockSetActiveFragment,
        setError: mockSetError,
      });

      render(<FileTree />);

      expect(screen.getByText('No fragments yet')).toBeInTheDocument();
      expect(screen.getByText(/Create your first CUE fragment/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Create Fragment/i })).toBeInTheDocument();
    });

    it('allows creating first fragment from empty state', async () => {
      mockUseApp.mockReturnValue({
        state: { ...mockAppState, fragments: [] },
        dispatch: mockDispatch,
        setActiveFragment: mockSetActiveFragment,
        setError: mockSetError,
      });

      const mockCreateFragment = apiService.createFragment as any;
      mockCreateFragment.mockResolvedValue({
        id: 'new-fragment',
        path: 'new-file.cue',
        created_at: '2024-01-01T00:00:00Z',
      });

      render(<FileTree />);

      await user.click(screen.getByRole('button', { name: /Create Fragment/i }));

      // Should show create form
      expect(screen.getByTestId('file-tree-input')).toBeInTheDocument();
    });
  });

  describe('Folder Navigation', () => {
    it('expands and collapses folders on click', async () => {
      render(<FileTree />);

      const apiFolder = screen.getByText('api');

      // Initially collapsed, middleware folder not visible
      expect(screen.queryByText('middleware')).not.toBeInTheDocument();

      await user.click(apiFolder);

      // Should expand and show nested content
      expect(screen.getByText('middleware')).toBeInTheDocument();
      expect(screen.getByTestId('chevron-down-icon')).toBeInTheDocument();

      await user.click(apiFolder);

      // Should collapse again
      expect(screen.queryByText('middleware')).not.toBeInTheDocument();
    });

    it('shows appropriate chevron icons for folder state', async () => {
      render(<FileTree />);

      const apiFolder = screen.getByText('api');

      // Collapsed folder should show right chevron
      expect(screen.getByTestId('chevron-right-icon')).toBeInTheDocument();

      await user.click(apiFolder);

      // Expanded folder should show down chevron
      expect(screen.getByTestId('chevron-down-icon')).toBeInTheDocument();
    });

    it('shows folder open icon when expanded', async () => {
      render(<FileTree />);

      const apiFolder = screen.getByText('api');
      await user.click(apiFolder);

      expect(screen.getByTestId('folder-open-icon')).toBeInTheDocument();
    });
  });

  describe('File Selection', () => {
    it('calls setActiveFragment when file is clicked', async () => {
      render(<FileTree />);

      const routesFile = screen.getByText('routes.cue');
      await user.click(routesFile);

      expect(mockSetActiveFragment).toHaveBeenCalledWith('fragment-1');
    });

    it('does not call setActiveFragment when folder is clicked', async () => {
      render(<FileTree />);

      const apiFolder = screen.getByText('api');
      await user.click(apiFolder);

      expect(mockSetActiveFragment).not.toHaveBeenCalled();
    });

    it('handles nested file selection', async () => {
      render(<FileTree />);

      // First expand the api folder
      const apiFolder = screen.getByText('api');
      await user.click(apiFolder);

      // Then expand middleware folder
      const middlewareFolder = screen.getByText('middleware');
      await user.click(middlewareFolder);

      // Then select auth.cue file
      const authFile = screen.getByText('auth.cue');
      await user.click(authFile);

      expect(mockSetActiveFragment).toHaveBeenCalledWith('fragment-2');
    });
  });

  describe('Create Fragment', () => {
    it('toggles create form when plus button is clicked', async () => {
      render(<FileTree />);

      const plusButton = screen.getByTestId('plus-icon').closest('button');
      await user.click(plusButton!);

      expect(screen.getByTestId('file-tree-input')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('api/routes.cue')).toBeInTheDocument();
    });

    it('creates new fragment when form is submitted', async () => {
      const mockCreateFragment = apiService.createFragment as any;
      mockCreateFragment.mockResolvedValue({
        id: 'new-fragment',
        path: 'new-file.cue',
        created_at: '2024-01-01T00:00:00Z',
      });

      render(<FileTree />);

      const plusButton = screen.getByTestId('plus-icon').closest('button');
      await user.click(plusButton!);

      const input = screen.getByTestId('file-tree-input');
      await user.type(input, 'services/user.cue');

      const createButton = screen.getByRole('button', { name: /Create Fragment/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(mockCreateFragment).toHaveBeenCalledWith('project-1', {
          path: 'services/user.cue',
          content: '// New CUE fragment\n',
        });
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'UPDATE_FRAGMENT',
        payload: expect.objectContaining({
          id: 'new-fragment',
          path: 'services/user.cue',
        }),
      });

      expect(mockSetActiveFragment).toHaveBeenCalledWith('new-fragment');
      expect(toast.success).toHaveBeenCalledWith(
        'Created fragment: new-file.cue',
        expect.any(Object)
      );
    });

    it('creates fragment with Enter key', async () => {
      const mockCreateFragment = apiService.createFragment as any;
      mockCreateFragment.mockResolvedValue({
        id: 'new-fragment',
        path: 'test.cue',
        created_at: '2024-01-01T00:00:00Z',
      });

      render(<FileTree />);

      const plusButton = screen.getByTestId('plus-icon').closest('button');
      await user.click(plusButton!);

      const input = screen.getByTestId('file-tree-input');
      await user.type(input, 'test.cue');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockCreateFragment).toHaveBeenCalled();
      });
    });

    it('cancels create form with Escape key', async () => {
      render(<FileTree />);

      const plusButton = screen.getByTestId('plus-icon').closest('button');
      await user.click(plusButton!);

      const input = screen.getByTestId('file-tree-input');
      await user.type(input, 'test.cue');
      await user.keyboard('{Escape}');

      expect(screen.queryByTestId('file-tree-input')).not.toBeInTheDocument();
    });

    it('cancels create form with cancel button', async () => {
      render(<FileTree />);

      const plusButton = screen.getByTestId('plus-icon').closest('button');
      await user.click(plusButton!);

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);

      expect(screen.queryByTestId('file-tree-input')).not.toBeInTheDocument();
    });

    it('disables create button when input is empty', async () => {
      render(<FileTree />);

      const plusButton = screen.getByTestId('plus-icon').closest('button');
      await user.click(plusButton!);

      const createButton = screen.getByRole('button', { name: /Create Fragment/i });
      expect(createButton).toBeDisabled();

      const input = screen.getByTestId('file-tree-input');
      await user.type(input, 'test.cue');

      expect(createButton).not.toBeDisabled();
    });

    it('handles create fragment API error', async () => {
      const mockCreateFragment = apiService.createFragment as any;
      mockCreateFragment.mockRejectedValue(new Error('API Error'));

      render(<FileTree />);

      const plusButton = screen.getByTestId('plus-icon').closest('button');
      await user.click(plusButton!);

      const input = screen.getByTestId('file-tree-input');
      await user.type(input, 'test.cue');

      const createButton = screen.getByRole('button', { name: /Create Fragment/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(mockSetError).toHaveBeenCalledWith('API Error');
        expect(toast.error).toHaveBeenCalled();
      });
    });
  });

  describe('Delete Fragment', () => {
    it('shows delete button on file hover', async () => {
      render(<FileTree />);

      const routesFile = screen.getByText('routes.cue').closest('[role="button"]');
      await user.hover(routesFile!);

      expect(screen.getByTestId('trash-icon')).toBeInTheDocument();
    });

    it('deletes fragment when delete button is clicked', async () => {
      const mockDeleteFragment = apiService.deleteFragment as any;
      mockDeleteFragment.mockResolvedValue({ success: true });

      render(<FileTree />);

      const routesFile = screen.getByText('routes.cue').closest('[role="button"]');
      await user.hover(routesFile!);

      const deleteButton = screen.getByTestId('trash-icon').closest('button');
      await user.click(deleteButton!);

      await waitFor(() => {
        expect(mockDeleteFragment).toHaveBeenCalledWith('project-1', 'fragment-1');
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'DELETE_FRAGMENT',
        payload: 'fragment-1',
      });

      expect(toast.success).toHaveBeenCalledWith(
        'Deleted fragment: api/routes.cue',
        expect.any(Object)
      );
    });

    it('requires confirmation before deletion', async () => {
      global.confirm = vi.fn(() => false); // User cancels

      const mockDeleteFragment = apiService.deleteFragment as any;

      render(<FileTree />);

      const routesFile = screen.getByText('routes.cue').closest('[role="button"]');
      await user.hover(routesFile!);

      const deleteButton = screen.getByTestId('trash-icon').closest('button');
      await user.click(deleteButton!);

      expect(global.confirm).toHaveBeenCalledWith(
        'Are you sure you want to delete "api/routes.cue"?'
      );
      expect(mockDeleteFragment).not.toHaveBeenCalled();
    });

    it('handles delete API error', async () => {
      const mockDeleteFragment = apiService.deleteFragment as any;
      mockDeleteFragment.mockRejectedValue(new Error('Delete failed'));

      render(<FileTree />);

      const routesFile = screen.getByText('routes.cue').closest('[role="button"]');
      await user.hover(routesFile!);

      const deleteButton = screen.getByTestId('trash-icon').closest('button');
      await user.click(deleteButton!);

      await waitFor(() => {
        expect(mockSetError).toHaveBeenCalledWith('Delete failed');
        expect(toast.error).toHaveBeenCalled();
      });
    });

    it('does not show delete button for directories', async () => {
      render(<FileTree />);

      const apiFolder = screen.getByText('api').closest('[role="button"]');
      await user.hover(apiFolder!);

      expect(screen.queryByTestId('trash-icon')).not.toBeInTheDocument();
    });
  });

  describe('File Type Icons', () => {
    it('shows correct icons for different file types', () => {
      const fragments: Fragment[] = [
        { ...mockFragments[0], id: 'frag-1', path: 'schema.cue' },
        { ...mockFragments[0], id: 'frag-2', path: 'config.json' },
        { ...mockFragments[0], id: 'frag-3', path: 'readme.md' },
        { ...mockFragments[0], id: 'frag-4', path: 'settings.yaml' },
        { ...mockFragments[0], id: 'frag-5', path: 'image.png' },
        { ...mockFragments[0], id: 'frag-6', path: 'archive.zip' },
        { ...mockFragments[0], id: 'frag-7', path: 'query.sql' },
      ];

      mockUseApp.mockReturnValue({
        state: { ...mockAppState, fragments },
        dispatch: mockDispatch,
        setActiveFragment: mockSetActiveFragment,
        setError: mockSetError,
      });

      render(<FileTree />);

      expect(screen.getByTestId('code-icon')).toBeInTheDocument(); // .cue
      expect(screen.getByTestId('file-text-icon')).toBeInTheDocument(); // .json, .md
      expect(screen.getByTestId('settings-icon')).toBeInTheDocument(); // .yaml
      expect(screen.getByTestId('image-icon')).toBeInTheDocument(); // .png
      expect(screen.getByTestId('archive-icon')).toBeInTheDocument(); // .zip
      expect(screen.getByTestId('database-icon')).toBeInTheDocument(); // .sql
    });

    it('shows generic file icon for unknown extensions', () => {
      const fragments: Fragment[] = [{ ...mockFragments[0], path: 'unknown.xyz' }];

      mockUseApp.mockReturnValue({
        state: { ...mockAppState, fragments },
        dispatch: mockDispatch,
        setActiveFragment: mockSetActiveFragment,
        setError: mockSetError,
      });

      render(<FileTree />);

      expect(screen.getByTestId('file-icon')).toBeInTheDocument();
    });

    it('shows CUE badge for CUE files', () => {
      render(<FileTree />);

      const cueBadges = screen.getAllByText('CUE');
      expect(cueBadges.length).toBeGreaterThan(0);
    });
  });

  describe('Accessibility', () => {
    it('provides proper ARIA attributes', () => {
      render(<FileTree />);

      const apiFolder = screen.getByText('api').closest('[role="button"]');
      expect(apiFolder).toHaveAttribute('aria-expanded', 'false');
      expect(apiFolder).toHaveAttribute('aria-label', 'Folder api');

      const routesFile = screen.getByText('routes.cue').closest('[role="button"]');
      expect(routesFile).toHaveAttribute('aria-label', 'File routes.cue');
    });

    it('updates aria-expanded when folders are toggled', async () => {
      render(<FileTree />);

      const apiFolder = screen.getByText('api').closest('[role="button"]');
      expect(apiFolder).toHaveAttribute('aria-expanded', 'false');

      await user.click(apiFolder!);
      expect(apiFolder).toHaveAttribute('aria-expanded', 'true');
    });

    it('supports keyboard navigation', async () => {
      render(<FileTree />);

      const routesFile = screen.getByText('routes.cue').closest('[role="button"]');
      routesFile!.focus();
      expect(routesFile).toHaveFocus();

      await user.keyboard(' '); // Space key
      expect(mockSetActiveFragment).toHaveBeenCalledWith('fragment-1');
    });

    it('provides focus outline for keyboard users', () => {
      render(<FileTree />);

      const files = screen.getAllByRole('button');
      files.forEach(file => {
        expect(file).toHaveClass('focus:outline-none', 'focus:ring-2');
      });
    });
  });

  describe('Performance', () => {
    it('handles large file tree efficiently', () => {
      const manyFragments: Fragment[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `fragment-${i}`,
        project_id: 'project-1',
        path: `folder${Math.floor(i / 100)}/file${i}.cue`,
        content: `// File ${i}`,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      }));

      mockUseApp.mockReturnValue({
        state: { ...mockAppState, fragments: manyFragments },
        dispatch: mockDispatch,
        setActiveFragment: mockSetActiveFragment,
        setError: mockSetError,
      });

      const startTime = performance.now();
      render(<FileTree />);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(200);
    });

    it('virtualizes folder expansion efficiently', async () => {
      render(<FileTree />);

      const apiFolder = screen.getByText('api');

      const startTime = performance.now();
      await user.click(apiFolder);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(50);
    });
  });

  describe('Edge Cases', () => {
    it('handles fragments with no project', () => {
      mockUseCurrentProject.mockReturnValue(null);

      render(<FileTree />);

      expect(screen.getByText('Explorer')).toBeInTheDocument();
    });

    it('handles empty fragment paths', () => {
      const fragmentsWithEmptyPaths: Fragment[] = [{ ...mockFragments[0], path: '' }];

      mockUseApp.mockReturnValue({
        state: { ...mockAppState, fragments: fragmentsWithEmptyPaths },
        dispatch: mockDispatch,
        setActiveFragment: mockSetActiveFragment,
        setError: mockSetError,
      });

      expect(() => {
        render(<FileTree />);
      }).not.toThrow();
    });

    it('handles fragments with special characters in paths', () => {
      const specialCharFragments: Fragment[] = [
        { ...mockFragments[0], path: 'folder with spaces/file-with-dashes.cue' },
        { ...mockFragments[0], path: 'folder_with_underscores/file.with.dots.cue' },
      ];

      mockUseApp.mockReturnValue({
        state: { ...mockAppState, fragments: specialCharFragments },
        dispatch: mockDispatch,
        setActiveFragment: mockSetActiveFragment,
        setError: mockSetError,
      });

      render(<FileTree />);

      expect(screen.getByText('folder with spaces')).toBeInTheDocument();
      expect(screen.getByText('folder_with_underscores')).toBeInTheDocument();
    });

    it('handles deep nested folder structures', () => {
      const deepFragments: Fragment[] = [
        { ...mockFragments[0], path: 'a/very/deeply/nested/folder/structure/file.cue' },
      ];

      mockUseApp.mockReturnValue({
        state: { ...mockAppState, fragments: deepFragments },
        dispatch: mockDispatch,
        setActiveFragment: mockSetActiveFragment,
        setError: mockSetError,
      });

      render(<FileTree />);

      expect(screen.getByText('a')).toBeInTheDocument();
    });
  });
});
