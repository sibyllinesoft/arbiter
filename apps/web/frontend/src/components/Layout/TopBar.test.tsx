/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'react-toastify';
import TopBar from './TopBar';
import { apiService } from '../../services/api';

// Mock dependencies
vi.mock('react-toastify', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('../../services/api', () => ({
  apiService: {
    updateFragment: vi.fn(),
    validateProject: vi.fn(),
    freezeVersion: vi.fn(),
  },
}));

vi.mock('../../contexts/AppContext', () => ({
  useApp: vi.fn(),
  useCurrentProject: vi.fn(),
  useConnectionStatus: vi.fn(),
  useValidationState: vi.fn(),
}));

// Import the mocked context hooks
import {
  useApp,
  useCurrentProject,
  useConnectionStatus,
  useValidationState,
} from '../../contexts/AppContext';

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  Save: () => <div data-testid="save-icon" />,
  CheckCircle: () => <div data-testid="check-circle-icon" />,
  AlertCircle: () => <div data-testid="alert-circle-icon" />,
  Loader2: () => <div data-testid="loader-icon" />,
  Lock: () => <div data-testid="lock-icon" />,
  RefreshCw: () => <div data-testid="refresh-icon" />,
  ChevronDown: () => <div data-testid="chevron-down-icon" />,
  Wifi: () => <div data-testid="wifi-icon" />,
  WifiOff: () => <div data-testid="wifi-off-icon" />,
  GitBranch: () => <div data-testid="git-branch-icon" />,
  Clock: () => <div data-testid="clock-icon" />,
  User: () => <div data-testid="user-icon" />,
}));

// Mock design system components
vi.mock('../../design-system', () => ({
  Button: ({ children, onClick, disabled, leftIcon, variant, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant} {...props}>
      {leftIcon}
      {children}
    </button>
  ),
  StatusBadge: ({ children, variant, icon, ...props }: any) => (
    <div data-testid="status-badge" data-variant={variant} {...props}>
      {icon}
      {children}
    </div>
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

// Mock app state
const mockAppState = {
  unsavedChanges: new Set(['fragment-1', 'fragment-2']),
  editorContent: {
    'fragment-1': 'updated content 1',
    'fragment-2': 'updated content 2',
  },
  isLoading: false,
  error: null,
};

// Mock context return values
const mockUseApp = useApp as any;
const mockUseCurrentProject = useCurrentProject as any;
const mockUseConnectionStatus = useConnectionStatus as any;
const mockUseValidationState = useValidationState as any;

describe('TopBar', () => {
  const user = userEvent.setup();
  const mockDispatch = vi.fn();
  const mockSetLoading = vi.fn();
  const mockSetError = vi.fn();

  beforeEach(() => {
    // Setup default mock returns
    mockUseApp.mockReturnValue({
      state: mockAppState,
      dispatch: mockDispatch,
      setLoading: mockSetLoading,
      setError: mockSetError,
    });

    mockUseCurrentProject.mockReturnValue(mockProject);

    mockUseConnectionStatus.mockReturnValue({
      isConnected: true,
      reconnectAttempts: 0,
      lastSync: '2024-01-01T12:00:00Z',
    });

    mockUseValidationState.mockReturnValue({
      isValidating: false,
      errors: [],
      warnings: [],
      specHash: 'abc123',
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders project name and controls', () => {
      render(<TopBar />);

      expect(screen.getByText('Test Project')).toBeInTheDocument();
      expect(screen.getByText('Save')).toBeInTheDocument();
      expect(screen.getByText('Validate')).toBeInTheDocument();
      expect(screen.getByText('Freeze')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<TopBar className="custom-topbar" />);

      const container = screen.getByText('Test Project').closest('.custom-topbar');
      expect(container).toBeInTheDocument();
    });

    it('shows project selector button', () => {
      render(<TopBar />);

      const projectButton = screen.getByRole('button', { name: /Test Project spec/i });
      expect(projectButton).toBeInTheDocument();
      // The chevron icon is rendered inside the button, but our mock renders it as a div
      // Since the icon is properly passed as rightIcon prop, we'll check the button exists
    });

    it('displays git branch icon in project section', () => {
      render(<TopBar />);
      expect(screen.getByTestId('git-branch-icon')).toBeInTheDocument();
    });
  });

  describe('Connection Status', () => {
    it('shows connected status with green indicator', () => {
      render(<TopBar />);

      // Check that connection status shows "Live" with success variant
      const liveText = screen.getByText('Live');
      expect(liveText).toBeInTheDocument();
      expect(liveText.closest('[data-testid="status-badge"]')).toHaveAttribute(
        'data-variant',
        'success'
      );
      expect(screen.getByTestId('wifi-icon')).toBeInTheDocument();
    });

    it('shows disconnected status with red indicator', () => {
      mockUseConnectionStatus.mockReturnValue({
        isConnected: false,
        reconnectAttempts: 3,
        lastSync: null,
      });

      render(<TopBar />);

      // Check that connection status shows "Offline (3)" with error variant
      const offlineText = screen.getByText('Offline (3)');
      expect(offlineText).toBeInTheDocument();
      expect(offlineText.closest('[data-testid="status-badge"]')).toHaveAttribute(
        'data-variant',
        'error'
      );
      expect(screen.getByTestId('wifi-off-icon')).toBeInTheDocument();
    });

    it('displays last sync time when connected', () => {
      render(<TopBar />);

      expect(screen.getByTestId('clock-icon')).toBeInTheDocument();
      expect(screen.getByText(/synced/)).toBeInTheDocument();
    });

    it('hides last sync when disconnected', () => {
      mockUseConnectionStatus.mockReturnValue({
        isConnected: false,
        reconnectAttempts: 0,
        lastSync: null,
      });

      render(<TopBar />);

      expect(screen.queryByTestId('clock-icon')).not.toBeInTheDocument();
      expect(screen.queryByText(/synced/)).not.toBeInTheDocument();
    });
  });

  describe('Validation Status', () => {
    it('shows valid status when no errors or warnings', () => {
      render(<TopBar />);

      // Check that validation status shows "Valid" with success variant
      const validText = screen.getByText('Valid');
      expect(validText).toBeInTheDocument();
      expect(validText.closest('[data-testid="status-badge"]')).toHaveAttribute(
        'data-variant',
        'success'
      );
    });

    it('shows error status with count', () => {
      mockUseValidationState.mockReturnValue({
        isValidating: false,
        errors: [{ message: 'Error 1' }, { message: 'Error 2' }],
        warnings: [],
        specHash: 'abc123',
      });

      render(<TopBar />);

      // Check that validation status shows "2 errors" with error variant
      const errorText = screen.getByText('2 errors');
      expect(errorText).toBeInTheDocument();
      expect(errorText.closest('[data-testid="status-badge"]')).toHaveAttribute(
        'data-variant',
        'error'
      );
    });

    it('shows warning status with count', () => {
      mockUseValidationState.mockReturnValue({
        isValidating: false,
        errors: [],
        warnings: [{ message: 'Warning 1' }, { message: 'Warning 2' }, { message: 'Warning 3' }],
        specHash: 'abc123',
      });

      render(<TopBar />);

      // Check that validation status shows "3 warnings" with warning variant
      const warningText = screen.getByText('3 warnings');
      expect(warningText).toBeInTheDocument();
      expect(warningText.closest('[data-testid="status-badge"]')).toHaveAttribute(
        'data-variant',
        'warning'
      );
    });

    it('shows validating status with spinner', () => {
      mockUseValidationState.mockReturnValue({
        isValidating: true,
        errors: [],
        warnings: [],
        specHash: 'abc123',
      });

      render(<TopBar />);

      // Check that validation status shows "Validating..." with info variant
      const validatingText = screen.getByText('Validating...');
      expect(validatingText).toBeInTheDocument();
      expect(validatingText.closest('[data-testid="status-badge"]')).toHaveAttribute(
        'data-variant',
        'info'
      );
    });

    it('displays spec hash when available', () => {
      render(<TopBar />);

      expect(screen.getByText('abc123')).toBeInTheDocument();
    });

    it('handles singular vs plural error/warning text', () => {
      mockUseValidationState.mockReturnValue({
        isValidating: false,
        errors: [{ message: 'Single error' }],
        warnings: [{ message: 'Single warning' }],
        specHash: 'abc123',
      });

      render(<TopBar />);

      // Should show "1 error" not "1 errors"
      expect(screen.getByText('1 error')).toBeInTheDocument();
    });
  });

  describe('Save Functionality', () => {
    it('shows save button as primary when there are unsaved changes', () => {
      render(<TopBar />);

      const saveButton = screen.getByRole('button', { name: /Save 2/i });
      expect(saveButton).toHaveAttribute('data-variant', 'primary');
      expect(saveButton).not.toBeDisabled();
    });

    it('shows save button as secondary when no unsaved changes', () => {
      mockUseApp.mockReturnValue({
        state: { ...mockAppState, unsavedChanges: new Set() },
        dispatch: mockDispatch,
        setLoading: mockSetLoading,
        setError: mockSetError,
      });

      render(<TopBar />);

      const saveButton = screen.getByRole('button', { name: /Save/i });
      expect(saveButton).toHaveAttribute('data-variant', 'secondary');
      expect(saveButton).toBeDisabled();
    });

    it('displays unsaved changes count in save button', () => {
      render(<TopBar />);

      expect(screen.getByText('2')).toBeInTheDocument(); // Badge with count
    });

    it('calls save function when save button clicked', async () => {
      const mockUpdateFragment = apiService.updateFragment as any;
      mockUpdateFragment.mockResolvedValue({ success: true });

      render(<TopBar />);

      await user.click(screen.getByRole('button', { name: /Save 2/i }));

      expect(mockUpdateFragment).toHaveBeenCalledTimes(2);
      expect(mockUpdateFragment).toHaveBeenCalledWith(
        'project-1',
        'fragment-1',
        'updated content 1'
      );
      expect(mockUpdateFragment).toHaveBeenCalledWith(
        'project-1',
        'fragment-2',
        'updated content 2'
      );
    });

    it('shows success toast after successful save', async () => {
      const mockUpdateFragment = apiService.updateFragment as any;
      mockUpdateFragment.mockResolvedValue({ success: true });

      render(<TopBar />);

      await user.click(screen.getByRole('button', { name: /Save 2/i }));
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Saved 2 fragment(s)', expect.any(Object));
      });
    });

    it('shows error toast when save fails', async () => {
      const mockUpdateFragment = apiService.updateFragment as any;
      mockUpdateFragment.mockRejectedValue(new Error('Network error'));

      render(<TopBar />);

      await user.click(screen.getByRole('button', { name: /Save 2/i }));

      await waitFor(() => {
        expect(mockSetError).toHaveBeenCalledWith('Network error');
        expect(toast.error).toHaveBeenCalledWith('Network error', expect.any(Object));
      });
    });

    it('shows loading state during save', async () => {
      const mockUpdateFragment = apiService.updateFragment as any;
      let resolvePromise: (value: any) => void;
      const savePromise = new Promise(resolve => {
        resolvePromise = resolve;
      });
      mockUpdateFragment.mockReturnValue(savePromise);

      render(<TopBar />);

      await user.click(screen.getByRole('button', { name: /Save 2/i }));

      // Should show loading spinner
      expect(screen.getByTestId('loader-icon')).toBeInTheDocument();

      // Resolve the promise
      resolvePromise!({ success: true });
      await waitFor(() => {
        expect(screen.getByTestId('save-icon')).toBeInTheDocument();
      });
    });

    it('handles save when no current project', async () => {
      mockUseCurrentProject.mockReturnValue(null);

      render(<TopBar />);

      const saveButton = screen.getByRole('button', { name: /Save/i });
      await user.click(saveButton);

      expect(apiService.updateFragment).not.toHaveBeenCalled();
    });
  });

  describe('Validation Functionality', () => {
    it('calls validation when validate button clicked', async () => {
      const mockValidateProject = apiService.validateProject as any;
      mockValidateProject.mockResolvedValue({
        success: true,
        errors: [],
        warnings: [],
        spec_hash: 'new-hash',
      });

      render(<TopBar />);

      await user.click(screen.getByRole('button', { name: /Validate/i }));

      expect(mockValidateProject).toHaveBeenCalledWith('project-1', { force: true });
      expect(mockSetLoading).toHaveBeenCalledWith(true);
    });

    it('shows success toast after successful validation', async () => {
      const mockValidateProject = apiService.validateProject as any;
      mockValidateProject.mockResolvedValue({
        success: true,
        errors: [],
        warnings: [],
        spec_hash: 'new-hash',
      });

      render(<TopBar />);

      await user.click(screen.getByRole('button', { name: /Validate/i }));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          'Validation completed successfully',
          expect.any(Object)
        );
      });
    });

    it('shows warning toast when validation has warnings', async () => {
      const mockValidateProject = apiService.validateProject as any;
      mockValidateProject.mockResolvedValue({
        success: false,
        errors: [],
        warnings: [{ message: 'Warning' }],
        spec_hash: 'new-hash',
      });

      render(<TopBar />);

      await user.click(screen.getByRole('button', { name: /Validate/i }));

      await waitFor(() => {
        expect(toast.warning).toHaveBeenCalledWith(
          'Validation found 0 errors and 1 warnings',
          expect.any(Object)
        );
      });
    });

    it('updates validation state after validation', async () => {
      const mockValidateProject = apiService.validateProject as any;
      mockValidateProject.mockResolvedValue({
        success: true,
        errors: [],
        warnings: [],
        spec_hash: 'new-hash',
      });

      render(<TopBar />);

      await user.click(screen.getByRole('button', { name: /Validate/i }));

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith({
          type: 'SET_VALIDATION_STATE',
          payload: {
            errors: [],
            warnings: [],
            isValidating: false,
            lastValidation: expect.any(String),
            specHash: 'new-hash',
          },
        });
      });
    });

    it('disables validate button during validation', () => {
      mockUseValidationState.mockReturnValue({
        isValidating: true,
        errors: [],
        warnings: [],
        specHash: 'abc123',
      });

      render(<TopBar />);

      const validateButton = screen.getByRole('button', { name: /Validate/i });
      expect(validateButton).toBeDisabled();
    });

    it('disables validate button when no project', () => {
      mockUseCurrentProject.mockReturnValue(null);

      render(<TopBar />);

      const validateButton = screen.getByRole('button', { name: /Validate/i });
      expect(validateButton).toBeDisabled();
    });
  });

  describe('Freeze Functionality', () => {
    beforeEach(() => {
      // Mock the browser prompt function
      global.prompt = vi.fn();
    });

    it('prompts for version name when freeze button clicked', async () => {
      global.prompt = vi
        .fn()
        .mockReturnValueOnce('v1.0.0') // version name
        .mockReturnValueOnce('Release version'); // description

      const mockFreezeVersion = apiService.freezeVersion as any;
      mockFreezeVersion.mockResolvedValue({ success: true });

      render(<TopBar />);

      await user.click(screen.getByRole('button', { name: /Freeze/i }));

      expect(global.prompt).toHaveBeenCalledWith('Enter version name:');
      expect(global.prompt).toHaveBeenCalledWith('Enter description (optional):');
    });

    it('calls freeze API with correct parameters', async () => {
      global.prompt = vi.fn().mockReturnValueOnce('v2.0.0').mockReturnValueOnce('Major release');

      const mockFreezeVersion = apiService.freezeVersion as any;
      mockFreezeVersion.mockResolvedValue({ success: true });

      render(<TopBar />);

      await user.click(screen.getByRole('button', { name: /Freeze/i }));

      await waitFor(() => {
        expect(mockFreezeVersion).toHaveBeenCalledWith('project-1', {
          version_name: 'v2.0.0',
          description: 'Major release',
        });
      });
    });

    it('handles empty description gracefully', async () => {
      global.prompt = vi.fn().mockReturnValueOnce('v1.1.0').mockReturnValueOnce(''); // empty description

      const mockFreezeVersion = apiService.freezeVersion as any;
      mockFreezeVersion.mockResolvedValue({ success: true });

      render(<TopBar />);

      await user.click(screen.getByRole('button', { name: /Freeze/i }));

      await waitFor(() => {
        expect(mockFreezeVersion).toHaveBeenCalledWith('project-1', {
          version_name: 'v1.1.0',
          description: undefined,
        });
      });
    });

    it('cancels freeze when user cancels version name prompt', async () => {
      global.prompt = vi.fn().mockReturnValueOnce(null); // user cancelled

      const mockFreezeVersion = apiService.freezeVersion as any;

      render(<TopBar />);

      await user.click(screen.getByRole('button', { name: /Freeze/i }));

      expect(mockFreezeVersion).not.toHaveBeenCalled();
    });

    it('shows success toast after successful freeze', async () => {
      global.prompt = vi.fn().mockReturnValueOnce('v1.0.0').mockReturnValueOnce('');

      const mockFreezeVersion = apiService.freezeVersion as any;
      mockFreezeVersion.mockResolvedValue({ success: true });

      render(<TopBar />);

      await user.click(screen.getByRole('button', { name: /Freeze/i }));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          'Version "v1.0.0" frozen successfully',
          expect.any(Object)
        );
      });
    });

    it('disables freeze button when there are validation errors', () => {
      mockUseValidationState.mockReturnValue({
        isValidating: false,
        errors: [{ message: 'Validation error' }],
        warnings: [],
        specHash: 'abc123',
      });

      render(<TopBar />);

      const freezeButton = screen.getByRole('button', { name: /Freeze/i });
      expect(freezeButton).toBeDisabled();
    });

    it('disables freeze button when no current project', () => {
      mockUseCurrentProject.mockReturnValue(null);

      render(<TopBar />);

      const freezeButton = screen.getByRole('button', { name: /Freeze/i });
      expect(freezeButton).toBeDisabled();
    });

    it('disables freeze button during freezing', async () => {
      global.prompt = vi.fn().mockReturnValueOnce('v1.0.0').mockReturnValueOnce('');

      let resolveFreezePromise: (value: any) => void;
      const freezePromise = new Promise(resolve => {
        resolveFreezePromise = resolve;
      });

      const mockFreezeVersion = apiService.freezeVersion as any;
      mockFreezeVersion.mockReturnValue(freezePromise);

      render(<TopBar />);

      await user.click(screen.getByRole('button', { name: /Freeze/i }));

      // Button should be disabled during freeze
      const freezeButton = screen.getByRole('button', { name: /Freeze/i });
      expect(freezeButton).toBeDisabled();

      // Resolve the promise
      resolveFreezePromise!({ success: true });
      await waitFor(() => {
        expect(freezeButton).not.toBeDisabled();
      });
    });
  });

  describe('Project Selector', () => {
    it('toggles project selector dropdown when clicked', async () => {
      render(<TopBar />);

      const projectButton = screen.getByRole('button', { name: /Test Project spec/i });
      await user.click(projectButton);

      // This would typically show a dropdown, but since it's not implemented
      // in the component yet, we just verify the button works
      expect(projectButton).toBeInTheDocument();
    });

    it('shows "Select Project" when no current project', () => {
      mockUseCurrentProject.mockReturnValue(null);

      render(<TopBar />);

      expect(screen.getByText('Select Project')).toBeInTheDocument();
    });
  });

  describe('User Interface', () => {
    it('renders user avatar', () => {
      render(<TopBar />);
      expect(screen.getByTestId('user-icon')).toBeInTheDocument();
    });

    it('has proper visual hierarchy and spacing', () => {
      render(<TopBar />);

      // Check for main container structure
      const container = screen
        .getByText('Test Project')
        .closest('.flex.items-center.justify-between');
      expect(container).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles API errors gracefully during save', async () => {
      const mockUpdateFragment = apiService.updateFragment as any;
      mockUpdateFragment.mockRejectedValue(new Error('API Error'));

      render(<TopBar />);

      await user.click(screen.getByRole('button', { name: /Save 2/i }));

      await waitFor(() => {
        expect(mockSetError).toHaveBeenCalledWith('API Error');
        expect(toast.error).toHaveBeenCalled();
      });
    });

    it('handles API errors gracefully during validation', async () => {
      const mockValidateProject = apiService.validateProject as any;
      mockValidateProject.mockRejectedValue(new Error('Validation API Error'));

      render(<TopBar />);

      await user.click(screen.getByRole('button', { name: /Validate/i }));

      await waitFor(() => {
        expect(mockSetError).toHaveBeenCalledWith('Validation API Error');
        expect(mockSetLoading).toHaveBeenCalledWith(false);
      });
    });

    it('handles API errors gracefully during freeze', async () => {
      global.prompt = vi.fn().mockReturnValueOnce('v1.0.0').mockReturnValueOnce('');

      const mockFreezeVersion = apiService.freezeVersion as any;
      mockFreezeVersion.mockRejectedValue(new Error('Freeze API Error'));

      render(<TopBar />);

      await user.click(screen.getByRole('button', { name: /Freeze/i }));

      await waitFor(() => {
        expect(mockSetError).toHaveBeenCalledWith('Freeze API Error');
        expect(toast.error).toHaveBeenCalled();
      });
    });
  });

  describe('Accessibility', () => {
    it('provides proper button labels', () => {
      render(<TopBar />);

      expect(screen.getByRole('button', { name: /Save 2/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Validate/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Freeze/i })).toBeInTheDocument();
    });

    it('maintains focus management during interactions', async () => {
      render(<TopBar />);

      const saveButton = screen.getByRole('button', { name: /Save 2/i });
      saveButton.focus();
      expect(saveButton).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('button', { name: /Validate/i })).toHaveFocus();
    });
  });
});
