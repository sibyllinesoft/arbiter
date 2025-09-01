import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Arbiter end-to-end tests
 * Configured for deterministic testing with stable fonts, viewport, and seeded randomness
 */
export default defineConfig({
  testDir: './e2e',
  
  /* Run tests in files in parallel */
  fullyParallel: true,
  
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  
  /* Reporter to use */
  reporter: process.env.CI ? [['list'], ['html']] : [['list']],
  
  /* Shared settings for all projects */
  use: {
    /* Base URL for relative navigation */
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    
    /* Collect trace on failure */
    trace: 'on-first-retry',
    
    /* Collect screenshot on failure */
    screenshot: 'only-on-failure',
    
    /* Collect video on failure */
    video: 'retain-on-failure',
    
    /* Ignore HTTPS errors */
    ignoreHTTPSErrors: true,
    
    /* Global timeout */
    actionTimeout: 10000,
    navigationTimeout: 15000,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Force consistent viewport for deterministic tests
        viewport: { width: 1280, height: 720 },
        // Use stable fonts for consistent visual testing
        fontFamily: 'monospace',
        // Seed randomness for reproducible tests
        launchOptions: {
          args: [
            '--font-render-hinting=none',
            '--disable-font-subpixel-positioning',
            '--disable-dev-shm-usage',
          ],
        },
      },
    },
    
    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'],
        viewport: { width: 1280, height: 720 },
      },
    },
    
    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
        viewport: { width: 1280, height: 720 },
      },
    },
    
    /* Mobile viewports for responsive testing */
    {
      name: 'Mobile Chrome',
      use: { 
        ...devices['Pixel 5'],
      },
    },
    
    {
      name: 'Mobile Safari',
      use: { 
        ...devices['iPhone 12'],
      },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
  
  /* Global setup */
  globalSetup: './e2e/global-setup.ts',
  
  /* Test match patterns */
  testMatch: '**/*.spec.ts',
  
  /* Expect timeout */
  expect: {
    timeout: 5000,
  },
  
  /* Output directory */
  outputDir: 'test-results',
  
  /* Metadata */
  metadata: {
    'test-environment': process.env.NODE_ENV || 'test',
    'arbiter-version': process.env.npm_package_version || 'dev',
  },
});