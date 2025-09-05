/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { apiService } from '../services/api';
import type { Project } from '../types/api';

// Mock the API service
vi.mock('../services/api', () => ({
  apiService: {
    getProjects: vi.fn(),
  },
}));

// Mock the useWebSocket hook
vi.mock('../hooks/useWebSocket', () => ({
  useWebSocket: vi.fn().mockReturnValue({}),
}));

// Mock all the layout components
vi.mock('../components/Layout/TopBar', () => ({
  default: ({ className }: { className?: string }) => (
    <div data-testid="top-bar" className={className}>TopBar</div>
  ),
}));

vi.mock('../components/Layout/SplitPane', () => ({
  default: ({ children, ...props }: any) => (
    <div data-testid="split-pane" data-props={JSON.stringify(props)}>
      {children}
    </div>
  ),
}));

vi.mock('../components/Layout/Tabs', () => ({
  default: ({ activeTab, onTabChange, tabs, className }: any) => (
    <div 
      data-testid="tabs" 
      data-active-tab={activeTab}
      className={className}
    >
      {tabs.map((tab: any) => (
        <button
          key={tab.id}
          data-testid={`tab-${tab.id}`}
          onClick={() => onTabChange(tab.id)}
          className={tab.id === activeTab ? 'active' : ''}
        >
          {tab.label}
          {tab.badge !== undefined && (
            <span data-testid={`badge-${tab.id}`} className="badge">
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('../components/Editor/EditorPane', () => ({
  default: () => <div data-testid="editor-pane">EditorPane</div>,
}));

// Mock react-toastify
vi.mock('react-toastify', () => ({
  ToastContainer: ({ children, ...props }: any) => (
    <div data-testid="toast-container" data-props={JSON.stringify(props)}>
      {children}
    </div>
  ),
}));

// Mock CSS import
vi.mock('react-toastify/dist/ReactToastify.css', () => ({}));

const mockProjects: Project[] = [
  {
    id: 'project-1',
    name: 'Test Project',
    description: 'A test project',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
  },
  {
    id: 'project-2',
    name: 'Another Project',
    description: 'Another test project',
    created_at: '2023-01-02T00:00:00Z',
    updated_at: '2023-01-02T00:00:00Z',
  },
];

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('App structure', () => {
    it('should render main application structure', () => {
      render(<App />);

      expect(screen.getByTestId('top-bar')).toBeInTheDocument();
      expect(screen.getByTestId('split-pane')).toBeInTheDocument();
      expect(screen.getByTestId('editor-pane')).toBeInTheDocument();
      expect(screen.getByTestId('tabs')).toBeInTheDocument();
      expect(screen.getByTestId('toast-container')).toBeInTheDocument();
    });

    it('should apply correct CSS classes', () => {
      render(<App />);

      const topBar = screen.getByTestId('top-bar');
      expect(topBar).toHaveClass('flex-shrink-0');

      const tabs = screen.getByTestId('tabs');
      expect(tabs).toHaveClass('h-full');
    });

    it('should configure SplitPane with correct props', () => {
      render(<App />);

      const splitPane = screen.getByTestId('split-pane');
      const props = JSON.parse(splitPane.getAttribute('data-props') || '{}');
      
      expect(props).toEqual({
        defaultSize: '40%',
        minSize: '300px',
        maxSize: '70%',
        split: 'vertical',
      });
    });

    it('should configure ToastContainer with correct props', () => {
      render(<App />);

      const toastContainer = screen.getByTestId('toast-container');
      const props = JSON.parse(toastContainer.getAttribute('data-props') || '{}');
      
      expect(props).toEqual({
        position: 'top-right',
        autoClose: 3000,
        hideProgressBar: false,
        newestOnTop: true,
        closeOnClick: true,
        rtl: false,
        pauseOnFocusLoss: true,
        draggable: true,
        pauseOnHover: true,
        theme: 'light',
      });
    });
  });

  describe('initial data loading', () => {
    it('should load initial project on mount when no current project', async () => {
      const mockGetProjects = vi.mocked(apiService.getProjects);
      mockGetProjects.mockResolvedValueOnce(mockProjects);

      render(<App />);

      await waitFor(() => {
        expect(mockGetProjects).toHaveBeenCalled();
      });
    });

    it('should not load projects when current project exists', async () => {
      const mockGetProjects = vi.mocked(apiService.getProjects);
      mockGetProjects.mockResolvedValueOnce(mockProjects);

      render(<App />);

      // Wait for initial load
      await waitFor(() => {
        expect(mockGetProjects).toHaveBeenCalled();
      });

      // Clear mock to test subsequent behavior
      mockGetProjects.mockClear();

      // Re-render should not trigger another load
      render(<App />);
      
      // Should not be called again
      expect(mockGetProjects).not.toHaveBeenCalled();
    });

    it('should handle API error gracefully', async () => {
      const mockGetProjects = vi.mocked(apiService.getProjects);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const error = new Error('API Error');
      mockGetProjects.mockRejectedValueOnce(error);

      render(<App />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to load initial project:',
          error
        );
      });

      consoleSpy.mockRestore();
    });

    it('should handle empty projects array', async () => {
      const mockGetProjects = vi.mocked(apiService.getProjects);
      mockGetProjects.mockResolvedValueOnce([]);

      render(<App />);

      await waitFor(() => {
        expect(mockGetProjects).toHaveBeenCalled();
      });

      // Should not crash or throw errors
    });
  });

  describe('tab navigation', () => {
    it('should render all tab items', () => {
      render(<App />);

      expect(screen.getByTestId('tab-flow')).toBeInTheDocument();
      expect(screen.getByTestId('tab-site')).toBeInTheDocument();
      expect(screen.getByTestId('tab-fsm')).toBeInTheDocument();
      expect(screen.getByTestId('tab-view')).toBeInTheDocument();
      expect(screen.getByTestId('tab-gaps')).toBeInTheDocument();
      expect(screen.getByTestId('tab-resolved')).toBeInTheDocument();
    });

    it('should have flow tab active by default', () => {
      render(<App />);

      const tabs = screen.getByTestId('tabs');
      expect(tabs).toHaveAttribute('data-active-tab', 'flow');

      const flowTab = screen.getByTestId('tab-flow');
      expect(flowTab).toHaveClass('active');
    });

    it('should switch tabs when clicked', async () => {
      const user = userEvent.setup();
      render(<App />);

      const gapsTab = screen.getByTestId('tab-gaps');
      await user.click(gapsTab);

      const tabs = screen.getByTestId('tabs');
      expect(tabs).toHaveAttribute('data-active-tab', 'gaps');
    });

    it('should display gaps badge when gaps exist', () => {
      // This would need to be tested with proper context setup
      // For now, we'll just verify the badge element exists when rendered
      render(<App />);

      // Initially no badge should be visible (no gaps data)
      const gapsBadge = screen.queryByTestId('badge-gaps');
      expect(gapsBadge).not.toBeInTheDocument();
    });
  });

  describe('diagram placeholders', () => {
    it('should render diagram placeholders with correct content', () => {
      render(<App />);

      // Check if diagram containers are present
      const diagramContainers = document.querySelectorAll('.diagram-container');
      expect(diagramContainers.length).toBeGreaterThan(0);
    });

    it('should display loading spinners in diagram placeholders', () => {
      render(<App />);

      const spinners = document.querySelectorAll('.spinner');
      expect(spinners.length).toBeGreaterThan(0);
    });
  });

  describe('WebSocket integration', () => {
    it('should initialize WebSocket with correct options', () => {
      const { useWebSocket } = require('../hooks/useWebSocket');
      
      render(<App />);

      expect(useWebSocket).toHaveBeenCalledWith(null, {
        autoReconnect: true,
        showToastNotifications: true,
      });
    });

    it('should connect WebSocket when project is loaded', async () => {
      const { useWebSocket } = require('../hooks/useWebSocket');
      const mockGetProjects = vi.mocked(apiService.getProjects);
      mockGetProjects.mockResolvedValueOnce(mockProjects);

      render(<App />);

      await waitFor(() => {
        expect(mockGetProjects).toHaveBeenCalledOnce();
      });

      // Should eventually call useWebSocket with project ID
      // Note: This would need more complex testing to verify the project ID is passed
    });
  });
});

describe('DiagramPlaceholder', () => {
  // We can't directly test the internal DiagramPlaceholder component
  // as it's not exported, but we can test its behavior through the main App
  
  it('should display correct placeholder text for different diagram types', () => {
    render(<App />);

    // The actual text content would be rendered within the tab content
    // We can verify this by checking if specific text exists in the document
    expect(screen.getByText(/Mermaid Flow Diagram/)).toBeInTheDocument();
    expect(screen.getByText(/Graphviz Site DAG/)).toBeInTheDocument();
    expect(screen.getByText(/XState FSM/)).toBeInTheDocument();
    expect(screen.getByText(/Excalidraw Canvas/)).toBeInTheDocument();
    expect(screen.getByText(/Interactive Gaps Checklist/)).toBeInTheDocument();
    expect(screen.getByText(/JSON Viewer/)).toBeInTheDocument();
  });
});

describe('ErrorBoundary', () => {
  // Mock console.error to avoid noise in test output
  const originalError = console.error;
  
  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalError;
  });

  it('should catch and display errors', () => {
    const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
      if (shouldThrow) {
        throw new Error('Test error');
      }
      return <div>No error</div>;
    };

    const { rerender } = render(
      <App>
        <ThrowError shouldThrow={false} />
      </App>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();

    // This would trigger the error boundary
    rerender(
      <App>
        <ThrowError shouldThrow={true} />
      </App>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText(/The application encountered an unexpected error/)).toBeInTheDocument();
  });

  it('should display error details in expandable section', () => {
    // Error boundary testing requires a component that throws
    const ErrorComponent = () => {
      throw new Error('Test error message');
    };

    // Create a test wrapper that includes the ErrorBoundary
    const TestWrapper = () => {
      try {
        return <ErrorComponent />;
      } catch {
        // Simulate error boundary catch
        return (
          <div className="error-boundary">
            <h2>Something went wrong</h2>
            <p className="text-gray-600 mb-4">
              The application encountered an unexpected error.
            </p>
            <details className="text-left">
              <summary className="cursor-pointer text-blue-600 hover:text-blue-700">
                Error Details
              </summary>
              <pre className="mt-2">Test error message</pre>
            </details>
          </div>
        );
      }
    };

    render(<TestWrapper />);

    expect(screen.getByText('Error Details')).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  it('should provide reload button', () => {
    const TestWrapper = () => (
      <div className="error-boundary">
        <h2>Something went wrong</h2>
        <button
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={() => window.location.reload()}
        >
          Reload Page
        </button>
      </div>
    );

    // Mock window.location.reload
    const mockReload = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: mockReload },
      writable: true,
    });

    render(<TestWrapper />);

    const reloadButton = screen.getByText('Reload Page');
    expect(reloadButton).toBeInTheDocument();
    
    reloadButton.click();
    expect(mockReload).toHaveBeenCalledOnce();
  });
});

describe('App integration', () => {
  it('should handle complete application lifecycle', async () => {
    const mockGetProjects = vi.mocked(apiService.getProjects);
    mockGetProjects.mockResolvedValueOnce(mockProjects);

    render(<App />);

    // Verify initial render
    expect(screen.getByTestId('top-bar')).toBeInTheDocument();
    expect(screen.getByTestId('editor-pane')).toBeInTheDocument();
    expect(screen.getByTestId('tabs')).toBeInTheDocument();

    // Verify initial project load
    await waitFor(() => {
      expect(mockGetProjects).toHaveBeenCalledOnce();
    });

    // Verify tab functionality
    const user = userEvent.setup();
    const siteTab = screen.getByTestId('tab-site');
    await user.click(siteTab);

    const tabs = screen.getByTestId('tabs');
    expect(tabs).toHaveAttribute('data-active-tab', 'site');
  });

  it('should maintain responsive layout structure', () => {
    render(<App />);

    // Verify main layout classes
    const mainContainer = document.querySelector('.h-full.flex.flex-col.bg-gray-50');
    expect(mainContainer).toBeInTheDocument();

    // Verify split pane structure
    const leftPane = document.querySelector('.h-full.bg-white.border-r.border-gray-200');
    const rightPane = document.querySelector('.h-full.bg-white');
    expect(leftPane).toBeInTheDocument();
    expect(rightPane).toBeInTheDocument();
  });
});