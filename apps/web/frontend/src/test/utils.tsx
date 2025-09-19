import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';

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
  const mockWs = {
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    readyState: WebSocket.OPEN,
  };

  global.WebSocket = vi.fn().mockImplementation(() => mockWs);
  return mockWs;
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
