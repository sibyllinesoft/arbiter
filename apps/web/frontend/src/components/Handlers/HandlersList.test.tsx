/**
 * Tests for HandlersList component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { toast } from 'react-toastify';
import { apiService } from '../../services/api';
import HandlersList from './HandlersList';
import type { WebhookHandler } from '../../types/api';

// Mock dependencies
jest.mock('../../services/api');
jest.mock('react-toastify');

const mockApiService = apiService as jest.Mocked<typeof apiService>;
const mockToast = toast as jest.Mocked<typeof toast>;

// Sample test data
const mockHandlers: WebhookHandler[] = [
  {
    id: '1',
    name: 'GitHub Push Handler',
    provider: 'github',
    event_type: 'push',
    enabled: true,
    code: 'function handler() {}',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    execution_count: 10,
    success_count: 8,
    error_count: 2,
    last_execution: '2024-01-01T12:00:00Z',
  },
  {
    id: '2',
    name: 'Slack Message Handler',
    provider: 'slack',
    event_type: 'message',
    enabled: false,
    code: 'function handler() {}',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    execution_count: 5,
    success_count: 5,
    error_count: 0,
    last_execution: '2024-01-01T10:00:00Z',
  },
];

// Mock props
const mockProps = {
  onEditHandler: jest.fn(),
  onViewStats: jest.fn(),
  onCreateHandler: jest.fn(),
};

describe('HandlersList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiService.getHandlers.mockResolvedValue(mockHandlers);
  });

  it('renders loading state initially', async () => {
    render(<HandlersList {...mockProps} />);

    expect(screen.getByText('Loading handlers...')).toBeInTheDocument();
  });

  it('renders handlers list after loading', async () => {
    render(<HandlersList {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('GitHub Push Handler')).toBeInTheDocument();
      expect(screen.getByText('Slack Message Handler')).toBeInTheDocument();
    });
  });

  it('displays correct handler information', async () => {
    render(<HandlersList {...mockProps} />);

    await waitFor(() => {
      // Check first handler
      expect(screen.getByText('GitHub Push Handler')).toBeInTheDocument();
      expect(screen.getByText('github')).toBeInTheDocument();
      expect(screen.getByText('push')).toBeInTheDocument();
      expect(screen.getByText('Enabled')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument(); // Execution count
      expect(screen.getByText('80%')).toBeInTheDocument(); // Success rate

      // Check second handler
      expect(screen.getByText('Slack Message Handler')).toBeInTheDocument();
      expect(screen.getByText('slack')).toBeInTheDocument();
      expect(screen.getByText('message')).toBeInTheDocument();
      expect(screen.getByText('Disabled')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument(); // Execution count
      expect(screen.getByText('100%')).toBeInTheDocument(); // Success rate
    });
  });

  it('filters handlers by search query', async () => {
    render(<HandlersList {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('GitHub Push Handler')).toBeInTheDocument();
      expect(screen.getByText('Slack Message Handler')).toBeInTheDocument();
    });

    // Search for GitHub
    const searchInput = screen.getByPlaceholderText('Search handlers...');
    fireEvent.change(searchInput, { target: { value: 'github' } });

    expect(screen.getByText('GitHub Push Handler')).toBeInTheDocument();
    expect(screen.queryByText('Slack Message Handler')).not.toBeInTheDocument();
  });

  it('filters handlers by provider', async () => {
    render(<HandlersList {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('GitHub Push Handler')).toBeInTheDocument();
      expect(screen.getByText('Slack Message Handler')).toBeInTheDocument();
    });

    // Filter by Slack
    const providerSelect = screen.getByDisplayValue('All Providers');
    fireEvent.change(providerSelect, { target: { value: 'slack' } });

    expect(screen.queryByText('GitHub Push Handler')).not.toBeInTheDocument();
    expect(screen.getByText('Slack Message Handler')).toBeInTheDocument();
  });

  it('calls onEditHandler when edit button is clicked', async () => {
    render(<HandlersList {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('GitHub Push Handler')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]);

    expect(mockProps.onEditHandler).toHaveBeenCalledWith(mockHandlers[0]);
  });

  it('calls onViewStats when stats button is clicked', async () => {
    render(<HandlersList {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('GitHub Push Handler')).toBeInTheDocument();
    });

    const statsButtons = screen.getAllByText('Stats');
    fireEvent.click(statsButtons[0]);

    expect(mockProps.onViewStats).toHaveBeenCalledWith(mockHandlers[0]);
  });

  it('toggles handler status when power button is clicked', async () => {
    const toggledHandler = { ...mockHandlers[0], enabled: false };
    mockApiService.toggleHandler.mockResolvedValue(toggledHandler);

    render(<HandlersList {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('GitHub Push Handler')).toBeInTheDocument();
    });

    // Find and click the power button for the first handler
    const powerButtons = screen.getAllByTitle(/enable|disable/i);
    fireEvent.click(powerButtons[0]);

    await waitFor(() => {
      expect(mockApiService.toggleHandler).toHaveBeenCalledWith('1', false);
      expect(mockToast.success).toHaveBeenCalledWith('Handler disabled successfully');
    });
  });

  it('deletes handler when delete button is confirmed', async () => {
    // Mock window.confirm
    const originalConfirm = window.confirm;
    window.confirm = jest.fn(() => true);

    mockApiService.deleteHandler.mockResolvedValue();

    render(<HandlersList {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('GitHub Push Handler')).toBeInTheDocument();
    });

    // Find and click delete button
    const deleteButtons = screen.getAllByTitle('Delete handler');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockApiService.deleteHandler).toHaveBeenCalledWith('1');
      expect(mockToast.success).toHaveBeenCalledWith('Handler deleted successfully');
    });

    // Restore original confirm
    window.confirm = originalConfirm;
  });

  it('tests handler when test button is clicked', async () => {
    const testResult = {
      status: 'success' as const,
      result: { message: 'Test passed' },
      duration_ms: 123,
    };
    mockApiService.testHandler.mockResolvedValue(testResult);

    render(<HandlersList {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('GitHub Push Handler')).toBeInTheDocument();
    });

    // Find and click test button
    const testButtons = screen.getAllByTitle('Test handler');
    fireEvent.click(testButtons[0]); // Click on enabled handler

    await waitFor(() => {
      expect(mockApiService.testHandler).toHaveBeenCalledWith('1', expect.any(Object));
      expect(mockToast.success).toHaveBeenCalledWith('Handler test completed in 123ms');
    });
  });

  it('handles API errors gracefully', async () => {
    const errorMessage = 'Failed to load handlers';
    mockApiService.getHandlers.mockRejectedValue(new Error(errorMessage));

    render(<HandlersList {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load handlers')).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
      expect(mockToast.error).toHaveBeenCalledWith(errorMessage);
    });
  });

  it('shows empty state when no handlers exist', async () => {
    mockApiService.getHandlers.mockResolvedValue([]);

    render(<HandlersList {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('No handlers yet')).toBeInTheDocument();
      expect(
        screen.getByText('Create your first webhook handler to start automating your workflows.')
      ).toBeInTheDocument();
    });
  });

  it('shows no results state when filters match nothing', async () => {
    render(<HandlersList {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('GitHub Push Handler')).toBeInTheDocument();
    });

    // Search for something that doesn't exist
    const searchInput = screen.getByPlaceholderText('Search handlers...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

    expect(screen.getByText('No matching handlers')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your filters or search terms.')).toBeInTheDocument();
  });
});
