import { render, screen } from '@testing-library/react';
import { afterEach, expect } from 'vitest';

import { cleanup } from '@testing-library/react';

// Run cleanup after each test to avoid memory leaks
afterEach(() => {
  cleanup();
});

// Extend expect with custom matchers if needed
expect.extend({});

// Re-export utilities for convenience
export * from '@testing-library/react';
export { render, screen };
