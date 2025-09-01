/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act, renderHook } from '@testing-library/react';
import { 
  AppProvider, 
  useApp, 
  useCurrentProject,
  useFragments,
  useActiveFragment,
  useEditorContent,
  useHasUnsavedChanges,
  useConnectionStatus,
  useValidationState
} from '../AppContext';
import type { Project, Fragment, GapSet, IRResponse, ValidationError, ValidationWarning } from '../../types/api';
import type { DiagramTab } from '../../types/ui';

// Test data
const mockProject: Project = {
  id: 'project-1',
  name: 'Test Project',
  description: 'A test project',
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z',
};

const mockFragment: Fragment = {
  id: 'fragment-1',
  project_id: 'project-1',
  name: 'test.cue',
  content: 'package test\n\nfoo: "bar"',
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z',
};

const mockFragment2: Fragment = {
  id: 'fragment-2',
  project_id: 'project-1',
  name: 'test2.cue',
  content: 'package test2\n\nbaz: "qux"',
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z',
};

const mockGaps: GapSet = {
  missing_capabilities: [],
  orphaned_tokens: [],
  coverage_gaps: [],
  duplicates: [],
};

const mockIR: IRResponse = {
  kind: 'capabilities',
  data: { test: 'ir-data' },
  generated_at: '2023-01-01T00:00:00Z',
};

const mockValidationError: ValidationError = {
  message: 'Test error',
  location: 'test.cue:1:1',
  severity: 'error',
};

const mockValidationWarning: ValidationWarning = {
  message: 'Test warning',
  location: 'test.cue:2:1',
  severity: 'warning',
};

// Test component to access context
function TestComponent() {
  const { state, dispatch } = useApp();
  
  return (
    <div>
      <div data-testid="project-name">
        {state.currentProject?.name || 'No project'}
      </div>
      <div data-testid="fragment-count">
        {state.fragments.length}
      </div>
      <div data-testid="active-tab">
        {state.activeTab}
      </div>
      <div data-testid="is-loading">
        {state.isLoading.toString()}
      </div>
      <div data-testid="error">
        {state.error || 'No error'}
      </div>
      <div data-testid="is-connected">
        {state.isConnected.toString()}
      </div>
      <div data-testid="unsaved-count">
        {state.unsavedChanges.size}
      </div>
    </div>
  );
}

// Wrapper component for testing hooks
function renderWithProvider(component: React.ReactElement) {
  return render(
    <AppProvider>
      {component}
    </AppProvider>
  );
}

describe('AppContext', () => {
  describe('AppProvider', () => {
    it('should render children', () => {
      renderWithProvider(<div data-testid="child">Test child</div>);
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('should provide initial state', () => {
      renderWithProvider(<TestComponent />);
      
      expect(screen.getByTestId('project-name')).toHaveTextContent('No project');
      expect(screen.getByTestId('fragment-count')).toHaveTextContent('0');
      expect(screen.getByTestId('active-tab')).toHaveTextContent('flow');
      expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
      expect(screen.getByTestId('error')).toHaveTextContent('No error');
      expect(screen.getByTestId('is-connected')).toHaveTextContent('false');
      expect(screen.getByTestId('unsaved-count')).toHaveTextContent('0');
    });
  });

  describe('useApp hook', () => {
    it('should throw error when used outside provider', () => {
      // Suppress console error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        renderHook(() => useApp());
      }).toThrow('useApp must be used within an AppProvider');
      
      consoleSpy.mockRestore();
    });

    it('should provide context when used within provider', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: AppProvider,
      });

      expect(result.current.state).toBeDefined();
      expect(result.current.dispatch).toBeDefined();
      expect(result.current.setProject).toBeDefined();
      expect(result.current.setActiveFragment).toBeDefined();
      expect(result.current.setActiveTab).toBeDefined();
      expect(result.current.updateEditorContent).toBeDefined();
      expect(result.current.markUnsaved).toBeDefined();
      expect(result.current.markSaved).toBeDefined();
      expect(result.current.setError).toBeDefined();
      expect(result.current.setLoading).toBeDefined();
    });
  });

  describe('state mutations', () => {
    it('should set project', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: AppProvider,
      });

      act(() => {
        result.current.setProject(mockProject);
      });

      expect(result.current.state.currentProject).toEqual(mockProject);
      expect(result.current.state.error).toBeNull();
    });

    it('should clear project', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: AppProvider,
      });

      act(() => {
        result.current.setProject(mockProject);
      });

      act(() => {
        result.current.setProject(null);
      });

      expect(result.current.state.currentProject).toBeNull();
      expect(result.current.state.fragments).toEqual([]);
      expect(result.current.state.resolved).toBeNull();
      expect(result.current.state.gaps).toBeNull();
      expect(result.current.state.irs).toEqual({});
      expect(result.current.state.activeFragmentId).toBeNull();
    });

    it('should set fragments', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: AppProvider,
      });

      act(() => {
        result.current.dispatch({ 
          type: 'SET_FRAGMENTS', 
          payload: [mockFragment, mockFragment2] 
        });
      });

      expect(result.current.state.fragments).toHaveLength(2);
      expect(result.current.state.fragments[0]).toEqual(mockFragment);
      expect(result.current.state.fragments[1]).toEqual(mockFragment2);
    });

    it('should update fragment (existing)', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: AppProvider,
      });

      // Set initial fragments
      act(() => {
        result.current.dispatch({ 
          type: 'SET_FRAGMENTS', 
          payload: [mockFragment] 
        });
      });

      // Update existing fragment
      const updatedFragment = { ...mockFragment, content: 'updated content' };
      act(() => {
        result.current.dispatch({ 
          type: 'UPDATE_FRAGMENT', 
          payload: updatedFragment 
        });
      });

      expect(result.current.state.fragments).toHaveLength(1);
      expect(result.current.state.fragments[0].content).toBe('updated content');
    });

    it('should update fragment (new)', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: AppProvider,
      });

      // Add new fragment
      act(() => {
        result.current.dispatch({ 
          type: 'UPDATE_FRAGMENT', 
          payload: mockFragment 
        });
      });

      expect(result.current.state.fragments).toHaveLength(1);
      expect(result.current.state.fragments[0]).toEqual(mockFragment);
    });

    it('should delete fragment', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: AppProvider,
      });

      // Set initial fragments and related state
      act(() => {
        result.current.dispatch({ 
          type: 'SET_FRAGMENTS', 
          payload: [mockFragment, mockFragment2] 
        });
        result.current.dispatch({ 
          type: 'SET_ACTIVE_FRAGMENT', 
          payload: mockFragment.id 
        });
        result.current.dispatch({ 
          type: 'SET_EDITOR_CONTENT', 
          payload: { fragmentId: mockFragment.id, content: 'test content' }
        });
        result.current.dispatch({ 
          type: 'MARK_UNSAVED', 
          payload: mockFragment.id 
        });
      });

      // Delete fragment
      act(() => {
        result.current.dispatch({ 
          type: 'DELETE_FRAGMENT', 
          payload: mockFragment.id 
        });
      });

      expect(result.current.state.fragments).toHaveLength(1);
      expect(result.current.state.fragments[0]).toEqual(mockFragment2);
      expect(result.current.state.activeFragmentId).toBeNull();
      expect(result.current.state.editorContent[mockFragment.id]).toBeUndefined();
      expect(result.current.state.unsavedChanges.has(mockFragment.id)).toBe(false);
    });

    it('should set resolved spec', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: AppProvider,
      });

      const payload = {
        resolved: { test: 'resolved data' },
        specHash: 'hash123',
      };

      act(() => {
        result.current.dispatch({ 
          type: 'SET_RESOLVED', 
          payload 
        });
      });

      expect(result.current.state.resolved).toEqual(payload.resolved);
      expect(result.current.state.specHash).toBe(payload.specHash);
    });

    it('should set gaps', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: AppProvider,
      });

      act(() => {
        result.current.dispatch({ 
          type: 'SET_GAPS', 
          payload: mockGaps 
        });
      });

      expect(result.current.state.gaps).toEqual(mockGaps);
    });

    it('should set IR', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: AppProvider,
      });

      act(() => {
        result.current.dispatch({ 
          type: 'SET_IR', 
          payload: { kind: 'capabilities', data: mockIR }
        });
      });

      expect(result.current.state.irs.capabilities).toEqual(mockIR);
    });

    it('should set active fragment', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: AppProvider,
      });

      act(() => {
        result.current.setActiveFragment('fragment-1');
      });

      expect(result.current.state.activeFragmentId).toBe('fragment-1');
    });

    it('should set active tab', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: AppProvider,
      });

      act(() => {
        result.current.setActiveTab('gaps' as DiagramTab);
      });

      expect(result.current.state.activeTab).toBe('gaps');
    });

    it('should set loading state', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: AppProvider,
      });

      act(() => {
        result.current.setLoading(true);
      });

      expect(result.current.state.isLoading).toBe(true);
    });

    it('should set error state', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: AppProvider,
      });

      act(() => {
        result.current.setError('Test error');
      });

      expect(result.current.state.error).toBe('Test error');
      expect(result.current.state.isLoading).toBe(false);
    });

    it('should update editor content', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: AppProvider,
      });

      act(() => {
        result.current.updateEditorContent('fragment-1', 'test content');
      });

      expect(result.current.state.editorContent['fragment-1']).toBe('test content');
    });

    it('should mark fragment as unsaved', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: AppProvider,
      });

      act(() => {
        result.current.markUnsaved('fragment-1');
      });

      expect(result.current.state.unsavedChanges.has('fragment-1')).toBe(true);
    });

    it('should mark fragment as saved', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: AppProvider,
      });

      // First mark as unsaved
      act(() => {
        result.current.markUnsaved('fragment-1');
      });

      // Then mark as saved
      act(() => {
        result.current.markSaved('fragment-1');
      });

      expect(result.current.state.unsavedChanges.has('fragment-1')).toBe(false);
    });

    it('should set connection status', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: AppProvider,
      });

      act(() => {
        result.current.dispatch({ 
          type: 'SET_CONNECTION_STATUS', 
          payload: true 
        });
      });

      expect(result.current.state.isConnected).toBe(true);
      expect(result.current.state.error).toBeNull();
    });

    it('should increment reconnect attempts', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: AppProvider,
      });

      act(() => {
        result.current.dispatch({ type: 'INCREMENT_RECONNECT_ATTEMPTS' });
      });

      expect(result.current.state.reconnectAttempts).toBe(1);

      act(() => {
        result.current.dispatch({ type: 'INCREMENT_RECONNECT_ATTEMPTS' });
      });

      expect(result.current.state.reconnectAttempts).toBe(2);
    });

    it('should reset reconnect attempts', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: AppProvider,
      });

      // First increment
      act(() => {
        result.current.dispatch({ type: 'INCREMENT_RECONNECT_ATTEMPTS' });
      });

      // Then reset
      act(() => {
        result.current.dispatch({ type: 'RESET_RECONNECT_ATTEMPTS' });
      });

      expect(result.current.state.reconnectAttempts).toBe(0);
    });

    it('should set last sync time', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: AppProvider,
      });

      const syncTime = new Date('2023-01-01T12:00:00Z');

      act(() => {
        result.current.dispatch({ 
          type: 'SET_LAST_SYNC', 
          payload: syncTime 
        });
      });

      expect(result.current.state.lastSync).toBe(syncTime);
    });

    it('should set validation state', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: AppProvider,
      });

      const validationState = {
        errors: [mockValidationError],
        warnings: [mockValidationWarning],
        isValidating: true,
        lastValidation: new Date('2023-01-01T12:00:00Z'),
        specHash: 'hash123',
      };

      act(() => {
        result.current.dispatch({ 
          type: 'SET_VALIDATION_STATE', 
          payload: validationState 
        });
      });

      expect(result.current.state.validationErrors).toEqual([mockValidationError]);
      expect(result.current.state.validationWarnings).toEqual([mockValidationWarning]);
      expect(result.current.state.isValidating).toBe(true);
      expect(result.current.state.lastValidation).toBe(validationState.lastValidation);
      expect(result.current.state.specHash).toBe('hash123');
    });

    it('should preserve existing specHash when not provided in validation state', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: AppProvider,
      });

      // Set initial specHash
      act(() => {
        result.current.dispatch({ 
          type: 'SET_RESOLVED', 
          payload: { resolved: {}, specHash: 'original-hash' }
        });
      });

      // Update validation without specHash
      act(() => {
        result.current.dispatch({ 
          type: 'SET_VALIDATION_STATE', 
          payload: {
            errors: [],
            warnings: [],
            isValidating: false,
            lastValidation: null,
          }
        });
      });

      expect(result.current.state.specHash).toBe('original-hash');
    });
  });

  describe('selector hooks', () => {
    describe('useCurrentProject', () => {
      it('should return current project', () => {
        const { result } = renderHook(() => useCurrentProject(), {
          wrapper: AppProvider,
        });

        expect(result.current).toBeNull();

        const { result: appResult } = renderHook(() => useApp(), {
          wrapper: AppProvider,
        });

        act(() => {
          appResult.current.setProject(mockProject);
        });

        expect(result.current).toEqual(mockProject);
      });
    });

    describe('useFragments', () => {
      it('should return fragments array', () => {
        const { result } = renderHook(() => useFragments(), {
          wrapper: AppProvider,
        });

        expect(result.current).toEqual([]);

        const { result: appResult } = renderHook(() => useApp(), {
          wrapper: AppProvider,
        });

        act(() => {
          appResult.current.dispatch({ 
            type: 'SET_FRAGMENTS', 
            payload: [mockFragment] 
          });
        });

        expect(result.current).toEqual([mockFragment]);
      });
    });

    describe('useActiveFragment', () => {
      it('should return active fragment', () => {
        const { result } = renderHook(() => useActiveFragment(), {
          wrapper: AppProvider,
        });

        expect(result.current).toBeNull();

        const { result: appResult } = renderHook(() => useApp(), {
          wrapper: AppProvider,
        });

        act(() => {
          appResult.current.dispatch({ 
            type: 'SET_FRAGMENTS', 
            payload: [mockFragment] 
          });
          appResult.current.setActiveFragment(mockFragment.id);
        });

        expect(result.current).toEqual(mockFragment);
      });
    });

    describe('useEditorContent', () => {
      it('should return editor content for fragment', () => {
        const { result } = renderHook(() => useEditorContent('fragment-1'), {
          wrapper: AppProvider,
        });

        expect(result.current).toBe('');

        const { result: appResult } = renderHook(() => useApp(), {
          wrapper: AppProvider,
        });

        act(() => {
          appResult.current.updateEditorContent('fragment-1', 'test content');
        });

        expect(result.current).toBe('test content');
      });
    });

    describe('useHasUnsavedChanges', () => {
      it('should return unsaved status for fragment', () => {
        const { result } = renderHook(() => useHasUnsavedChanges('fragment-1'), {
          wrapper: AppProvider,
        });

        expect(result.current).toBe(false);

        const { result: appResult } = renderHook(() => useApp(), {
          wrapper: AppProvider,
        });

        act(() => {
          appResult.current.markUnsaved('fragment-1');
        });

        expect(result.current).toBe(true);

        act(() => {
          appResult.current.markSaved('fragment-1');
        });

        expect(result.current).toBe(false);
      });
    });

    describe('useConnectionStatus', () => {
      it('should return connection status', () => {
        const { result } = renderHook(() => useConnectionStatus(), {
          wrapper: AppProvider,
        });

        expect(result.current).toEqual({
          isConnected: false,
          reconnectAttempts: 0,
          lastSync: null,
        });

        const { result: appResult } = renderHook(() => useApp(), {
          wrapper: AppProvider,
        });

        const syncTime = new Date('2023-01-01T12:00:00Z');

        act(() => {
          appResult.current.dispatch({ 
            type: 'SET_CONNECTION_STATUS', 
            payload: true 
          });
          appResult.current.dispatch({ type: 'INCREMENT_RECONNECT_ATTEMPTS' });
          appResult.current.dispatch({ 
            type: 'SET_LAST_SYNC', 
            payload: syncTime 
          });
        });

        expect(result.current).toEqual({
          isConnected: true,
          reconnectAttempts: 1,
          lastSync: syncTime,
        });
      });
    });

    describe('useValidationState', () => {
      it('should return validation state', () => {
        const { result } = renderHook(() => useValidationState(), {
          wrapper: AppProvider,
        });

        expect(result.current).toEqual({
          errors: [],
          warnings: [],
          isValidating: false,
          lastValidation: null,
          specHash: null,
        });

        const { result: appResult } = renderHook(() => useApp(), {
          wrapper: AppProvider,
        });

        const validationTime = new Date('2023-01-01T12:00:00Z');

        act(() => {
          appResult.current.dispatch({ 
            type: 'SET_VALIDATION_STATE', 
            payload: {
              errors: [mockValidationError],
              warnings: [mockValidationWarning],
              isValidating: true,
              lastValidation: validationTime,
              specHash: 'hash123',
            }
          });
        });

        expect(result.current).toEqual({
          errors: [mockValidationError],
          warnings: [mockValidationWarning],
          isValidating: true,
          lastValidation: validationTime,
          specHash: 'hash123',
        });
      });
    });
  });

  describe('reducer edge cases', () => {
    it('should handle unknown action types', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: AppProvider,
      });

      const initialState = result.current.state;

      act(() => {
        result.current.dispatch({ 
          type: 'UNKNOWN_ACTION' as any, 
          payload: 'test' 
        });
      });

      expect(result.current.state).toEqual(initialState);
    });

    it('should handle delete fragment when fragment not active', () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: AppProvider,
      });

      act(() => {
        result.current.dispatch({ 
          type: 'SET_FRAGMENTS', 
          payload: [mockFragment, mockFragment2] 
        });
        result.current.setActiveFragment(mockFragment2.id);
      });

      act(() => {
        result.current.dispatch({ 
          type: 'DELETE_FRAGMENT', 
          payload: mockFragment.id 
        });
      });

      expect(result.current.state.fragments).toHaveLength(1);
      expect(result.current.state.fragments[0]).toEqual(mockFragment2);
      expect(result.current.state.activeFragmentId).toBe(mockFragment2.id);
    });
  });
});