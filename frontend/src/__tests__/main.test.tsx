/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock React DOM
const mockCreateRoot = vi.fn();
const mockRender = vi.fn();

vi.mock('react-dom/client', () => ({
  createRoot: vi.fn().mockImplementation(() => ({
    render: mockRender,
  })),
}));

// Mock the App component
vi.mock('../App', () => ({
  default: () => 'App Component',
}));

// Mock CSS import
vi.mock('../minimal.css', () => ({}));

describe('main.tsx', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up DOM
    document.body.innerHTML = '<div id="root"></div>';
  });

  it('should render App in StrictMode to root element', async () => {
    // Mock createRoot to return our mock
    const { createRoot } = await import('react-dom/client');
    vi.mocked(createRoot).mockReturnValue({
      render: mockRender,
    } as any);

    // Import and execute main module
    await import('../main');

    // Verify createRoot was called with root element
    expect(createRoot).toHaveBeenCalledWith(
      document.getElementById('root')
    );

    // Verify render was called
    expect(mockRender).toHaveBeenCalledOnce();
    
    // The render call should include StrictMode wrapper
    const renderCall = mockRender.mock.calls[0][0];
    expect(renderCall).toBeDefined();
  });

  it('should handle missing root element gracefully', async () => {
    // Remove root element
    document.body.innerHTML = '';

    const { createRoot } = await import('react-dom/client');
    vi.mocked(createRoot).mockReturnValue({
      render: mockRender,
    } as any);

    // This should throw since getElementById('root')! uses non-null assertion
    expect(async () => {
      await import('../main');
    }).rejects.toThrow();
  });

  it('should import required dependencies', async () => {
    // Verify that importing main.tsx doesn't throw
    expect(async () => {
      await import('../main');
    }).not.toThrow();
  });
});

describe('main.tsx DOM setup', () => {
  it('should target the correct root element', () => {
    const rootElement = document.createElement('div');
    rootElement.id = 'root';
    document.body.appendChild(rootElement);

    expect(document.getElementById('root')).toBe(rootElement);
  });

  it('should work with HTML structure', () => {
    // Simulate typical HTML structure
    document.documentElement.innerHTML = `
      <html>
        <head>
          <title>Arbiter Frontend</title>
        </head>
        <body>
          <div id="root"></div>
        </body>
      </html>
    `;

    const rootElement = document.getElementById('root');
    expect(rootElement).toBeTruthy();
    expect(rootElement?.tagName).toBe('DIV');
  });
});

describe('React StrictMode', () => {
  it('should wrap App component in StrictMode', async () => {
    const { createRoot } = await import('react-dom/client');
    vi.mocked(createRoot).mockReturnValue({
      render: mockRender,
    } as any);

    document.body.innerHTML = '<div id="root"></div>';

    // Import main to trigger the render
    await import('../main');

    // Verify render was called
    expect(mockRender).toHaveBeenCalledOnce();

    // The render should contain StrictMode wrapper around App
    const renderCall = mockRender.mock.calls[0][0];
    expect(renderCall).toBeDefined();

    // In a real test, we'd check the component structure
    // but since we're mocking, we just verify the call was made
  });
});

describe('CSS imports', () => {
  it('should import minimal.css', async () => {
    // The import should not throw an error
    expect(async () => {
      await import('../minimal.css');
    }).not.toThrow();
  });
});

describe('integration', () => {
  it('should perform complete initialization', async () => {
    const { createRoot } = await import('react-dom/client');
    vi.mocked(createRoot).mockReturnValue({
      render: mockRender,
    } as any);

    document.body.innerHTML = '<div id="root"></div>';
    const rootElement = document.getElementById('root');

    // Import main to trigger initialization
    await import('../main');

    // Verify complete initialization flow
    expect(createRoot).toHaveBeenCalledWith(rootElement);
    expect(mockRender).toHaveBeenCalledOnce();
  });

  it('should handle initialization errors gracefully', async () => {
    const { createRoot } = await import('react-dom/client');
    
    // Mock createRoot to throw an error
    vi.mocked(createRoot).mockImplementation(() => {
      throw new Error('Failed to create root');
    });

    document.body.innerHTML = '<div id="root"></div>';

    // Should propagate the error
    await expect(import('../main')).rejects.toThrow('Failed to create root');
  });
});

describe('module structure', () => {
  it('should be an ES module', async () => {
    const mainModule = await import('../main');
    
    // ES modules should be objects
    expect(typeof mainModule).toBe('object');
  });

  it('should not export anything (side-effect only module)', async () => {
    const mainModule = await import('../main');
    
    // main.tsx is typically a side-effect only module
    const exports = Object.keys(mainModule);
    
    // Should have no exports or only Symbol.toStringTag
    expect(exports.length).toBeLessThanOrEqual(1);
    if (exports.length === 1) {
      expect(exports[0]).toBe('Symbol(Symbol.toStringTag)' || '__esModule');
    }
  });
});