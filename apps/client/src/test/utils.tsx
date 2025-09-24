import type { RenderOptions } from '@testing-library/react';
import { render } from '@testing-library/react';
import { type ReactElement } from 'react';
import { vi } from 'vitest';

// Mock contexts that might be needed for component testing
const MockAppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

const customRender = (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
  render(ui, {
    wrapper: MockAppProvider,
    ...options,
  });

export * from '@testing-library/react';
export { customRender as render };

// Common test utilities
export const mockWebSocket = () => {
  class MockWebSocketClass {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    constructor() {
      return {
        send: vi.fn(),
        close: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        readyState: MockWebSocketClass.OPEN,
      } as any;
    }
  }

  global.WebSocket = MockWebSocketClass as any;
  return new MockWebSocketClass();
};

export const mockMonacoEditor = () => {
  return {
    getValue: vi.fn(() => ''),
    setValue: vi.fn(),
    getModel: vi.fn(),
    setModel: vi.fn(),
    dispose: vi.fn(),
    onDidChangeModelContent: vi.fn(),
    focus: vi.fn(),
  };
};

// Mock for react-toastify
export const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  dismiss: vi.fn(),
};
