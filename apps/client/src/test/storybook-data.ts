/**
 * Comprehensive Storybook Data Generator
 * Professional developer tool content and realistic mock data
 */

import type {
  CoverageGap,
  Duplicate,
  FlowEdge,
  FlowIR,
  FlowNode,
  Fragment,
  FsmIR,
  GapSet,
  Project,
  SiteIR,
  TokenReference,
  ValidationError,
  ValidationWarning,
  ViewConnection,
  ViewIR,
  ViewToken,
} from '../types/api';

// =============================================================================
// CORE DATA GENERATORS
// =============================================================================

/**
 * Generate realistic user data for developer teams
 */
export const generateUsers = () => ({
  currentUser: {
    id: 'user-sarah-chen',
    name: 'Sarah Chen',
    email: 'sarah.chen@company.com',
    avatar:
      'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
    role: 'Senior Frontend Developer',
    status: 'online',
    location: 'San Francisco, CA',
  },
  teamMembers: [
    {
      id: 'user-alex-kim',
      name: 'Alex Kim',
      email: 'alex.kim@company.com',
      avatar:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
      role: 'Backend Engineer',
      status: 'online',
      location: 'Seattle, WA',
    },
    {
      id: 'user-maria-gonzalez',
      name: 'María González',
      email: 'maria.gonzalez@company.com',
      avatar:
        'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
      role: 'DevOps Engineer',
      status: 'away',
      location: 'Austin, TX',
    },
    {
      id: 'user-james-wilson',
      name: 'James Wilson',
      email: 'james.wilson@company.com',
      avatar:
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
      role: 'Product Manager',
      status: 'offline',
      location: 'New York, NY',
    },
    {
      id: 'user-priya-patel',
      name: 'Priya Patel',
      email: 'priya.patel@company.com',
      avatar:
        'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&h=150&fit=crop&crop=face',
      role: 'QA Engineer',
      status: 'online',
      location: 'London, UK',
    },
  ],
});

/**
 * Generate realistic project data for different types of software projects
 */
export const generateProjects = (): Project[] => [
  {
    id: 'project-ecommerce-api',
    name: 'E-commerce API Platform',
    created_at: '2024-01-15T10:30:00Z',
    updated_at: '2024-01-20T14:45:00Z',
  },
  {
    id: 'project-user-dashboard',
    name: 'User Analytics Dashboard',
    created_at: '2024-01-10T09:15:00Z',
    updated_at: '2024-01-19T16:20:00Z',
  },
  {
    id: 'project-mobile-checkout',
    name: 'Mobile Checkout Flow',
    created_at: '2024-01-12T11:00:00Z',
    updated_at: '2024-01-18T13:30:00Z',
  },
  {
    id: 'project-auth-service',
    name: 'Authentication Microservice',
    created_at: '2024-01-08T08:45:00Z',
    updated_at: '2024-01-17T12:15:00Z',
  },
];

/**
 * Generate realistic code fragments and specifications
 */
export const generateFragments = (projectId: string): Fragment[] => [
  {
    id: 'fragment-user-auth',
    project_id: projectId,
    path: '/specs/authentication.yml',
    content: `# User Authentication Specification

## Capabilities
- C1: User Registration
  - REQ1.1: Email validation required
  - REQ1.2: Password strength requirements
  - REQ1.3: Email verification process

- C2: User Login
  - REQ2.1: Multi-factor authentication support
  - REQ2.2: Session management
  - REQ2.3: Failed login attempt tracking

## Test Scenarios
- T1: Valid user registration flow
- T2: Invalid email format handling
- T3: Weak password rejection
- T4: Successful login with MFA
- T5: Account lockout after failed attempts`,
    created_at: '2024-01-15T10:30:00Z',
    updated_at: '2024-01-20T14:45:00Z',
  },
  {
    id: 'fragment-api-endpoints',
    project_id: projectId,
    path: '/specs/api-endpoints.yml',
    content: `# API Endpoints Specification

## Capabilities
- C3: User Management API
  - REQ3.1: CRUD operations for users
  - REQ3.2: User profile management
  - REQ3.3: Role-based access control

- C4: Product Catalog API
  - REQ4.1: Product search and filtering
  - REQ4.2: Inventory management
  - REQ4.3: Price management

## Data Models
- User: { id, email, profile, roles }
- Product: { id, name, price, inventory, categories }

## Test Coverage
- API endpoint availability: 95%
- Error handling: 85%
- Performance benchmarks: 90%`,
    created_at: '2024-01-16T09:15:00Z',
    updated_at: '2024-01-19T11:30:00Z',
  },
  {
    id: 'fragment-database-schema',
    project_id: projectId,
    path: '/specs/database.yml',
    content: `# Database Schema Specification

## Capabilities
- C5: Data Persistence Layer
  - REQ5.1: User data storage
  - REQ5.2: Product catalog storage
  - REQ5.3: Transaction logging

## Tables
- users: Primary user information
- products: Product catalog
- orders: Order transactions
- audit_logs: System activity tracking

## Relationships
- users -> orders (one-to-many)
- products -> order_items (many-to-many)
- orders -> order_items (one-to-many)

## Constraints
- Email uniqueness
- Foreign key integrity
- Data validation rules`,
    created_at: '2024-01-14T14:20:00Z',
    updated_at: '2024-01-18T16:45:00Z',
  },
];

/**
 * Generate realistic validation errors and warnings
 */
export const generateValidationResults = () => ({
  errors: [
    {
      type: 'schema' as const,
      message: 'Missing required capability definition for user registration',
      location: '/specs/authentication.yml:line 15',
      details: { expected: 'capability', found: 'requirement' },
    },
    {
      type: 'assertion' as const,
      message: 'Test case T3 references undefined requirement REQ1.4',
      location: '/specs/authentication.yml:line 28',
      details: { referenced: 'REQ1.4', available: ['REQ1.1', 'REQ1.2', 'REQ1.3'] },
    },
    {
      type: 'custom' as const,
      message: 'API endpoint missing error response specification',
      location: '/specs/api-endpoints.yml:line 42',
      details: { endpoint: '/api/users', missing: 'error_responses' },
    },
  ] as ValidationError[],

  warnings: [
    {
      type: 'orphan_token' as const,
      message: 'Token REQ2.4 defined but not referenced in any test',
      location: '/specs/authentication.yml:line 22',
    },
    {
      type: 'coverage' as const,
      message: 'Low test coverage for capability C4 (60%)',
      location: '/specs/api-endpoints.yml',
    },
    {
      type: 'duplicate' as const,
      message: 'Requirement REQ3.1 appears to duplicate REQ1.1',
      location: '/specs/api-endpoints.yml:line 18',
    },
  ] as ValidationWarning[],
});

/**
 * Generate comprehensive gap analysis data
 */
export const generateGapAnalysis = (): GapSet => ({
  missing_capabilities: [
    'Password reset functionality',
    'Account deletion process',
    'Data export compliance',
    'Rate limiting implementation',
  ],

  orphaned_tokens: [
    {
      token: 'REQ2.4',
      defined_in: ['/specs/authentication.yml'],
      referenced_in: [],
    },
    {
      token: 'T6',
      defined_in: ['/specs/api-endpoints.yml'],
      referenced_in: [],
    },
  ] as TokenReference[],

  coverage_gaps: [
    {
      capability: 'User Authentication',
      expected_coverage: 95,
      actual_coverage: 78,
      missing_scenarios: [
        'Edge case: Concurrent login attempts',
        'Performance: Login under high load',
        'Security: SQL injection prevention',
      ],
    },
    {
      capability: 'API Rate Limiting',
      expected_coverage: 90,
      actual_coverage: 45,
      missing_scenarios: [
        'Rate limit exceeded handling',
        'Distributed rate limiting',
        'Rate limit configuration',
      ],
    },
  ] as CoverageGap[],

  duplicates: [
    {
      type: 'requirement' as const,
      name: 'Email validation',
      locations: ['/specs/authentication.yml:REQ1.1', '/specs/api-endpoints.yml:REQ3.2'],
    },
    {
      type: 'test_case' as const,
      name: 'User creation test',
      locations: ['/specs/authentication.yml:T1', '/specs/api-endpoints.yml:T7'],
    },
  ] as Duplicate[],
});

/**
 * Generate realistic file tree structure for code editor
 */
export const generateFileTree = () => ({
  name: 'ecommerce-platform',
  type: 'directory' as const,
  children: [
    {
      name: 'src',
      type: 'directory' as const,
      children: [
        {
          name: 'components',
          type: 'directory' as const,
          children: [
            {
              name: 'UserAuth.tsx',
              type: 'file' as const,
              size: '2.4 KB',
              modified: '2 hours ago',
            },
            {
              name: 'ProductList.tsx',
              type: 'file' as const,
              size: '5.1 KB',
              modified: '1 day ago',
            },
            {
              name: 'CheckoutForm.tsx',
              type: 'file' as const,
              size: '3.8 KB',
              modified: '3 hours ago',
            },
            { name: 'Header.tsx', type: 'file' as const, size: '1.2 KB', modified: '5 days ago' },
          ],
        },
        {
          name: 'hooks',
          type: 'directory' as const,
          children: [
            { name: 'useAuth.ts', type: 'file' as const, size: '1.8 KB', modified: '6 hours ago' },
            { name: 'useApi.ts', type: 'file' as const, size: '2.1 KB', modified: '2 days ago' },
            { name: 'useCart.ts', type: 'file' as const, size: '3.2 KB', modified: '1 hour ago' },
          ],
        },
        {
          name: 'services',
          type: 'directory' as const,
          children: [
            {
              name: 'authService.ts',
              type: 'file' as const,
              size: '4.5 KB',
              modified: '4 hours ago',
            },
            { name: 'apiClient.ts', type: 'file' as const, size: '6.7 KB', modified: '1 day ago' },
            {
              name: 'localStorage.ts',
              type: 'file' as const,
              size: '0.9 KB',
              modified: '1 week ago',
            },
          ],
        },
        {
          name: 'types',
          type: 'directory' as const,
          children: [
            { name: 'user.ts', type: 'file' as const, size: '1.1 KB', modified: '3 days ago' },
            { name: 'product.ts', type: 'file' as const, size: '0.8 KB', modified: '5 days ago' },
            { name: 'api.ts', type: 'file' as const, size: '2.9 KB', modified: '2 hours ago' },
          ],
        },
      ],
    },
    {
      name: 'specs',
      type: 'directory' as const,
      children: [
        {
          name: 'authentication.yml',
          type: 'file' as const,
          size: '3.2 KB',
          modified: '1 hour ago',
        },
        {
          name: 'api-endpoints.yml',
          type: 'file' as const,
          size: '5.8 KB',
          modified: '2 hours ago',
        },
        { name: 'database.yml', type: 'file' as const, size: '2.1 KB', modified: '1 day ago' },
        {
          name: 'ui-components.yml',
          type: 'file' as const,
          size: '4.3 KB',
          modified: '3 hours ago',
        },
      ],
    },
    {
      name: 'tests',
      type: 'directory' as const,
      children: [
        {
          name: '__tests__',
          type: 'directory' as const,
          children: [
            {
              name: 'auth.test.ts',
              type: 'file' as const,
              size: '2.7 KB',
              modified: '4 hours ago',
            },
            { name: 'api.test.ts', type: 'file' as const, size: '3.9 KB', modified: '1 day ago' },
            {
              name: 'components.test.tsx',
              type: 'file' as const,
              size: '5.4 KB',
              modified: '2 days ago',
            },
          ],
        },
        { name: 'setup.ts', type: 'file' as const, size: '0.5 KB', modified: '1 week ago' },
      ],
    },
    { name: 'package.json', type: 'file' as const, size: '1.8 KB', modified: '3 days ago' },
    { name: 'README.md', type: 'file' as const, size: '4.2 KB', modified: '1 week ago' },
    { name: 'tsconfig.json', type: 'file' as const, size: '0.7 KB', modified: '2 weeks ago' },
  ],
});

/**
 * Generate realistic code content for editor
 */
export const generateCodeContent = () => ({
  typescript: `import React, { useState, useCallback } from 'react';
import { User, AuthCredentials, LoginResponse } from '../types/auth';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

interface LoginFormProps {
  onSuccess: (user: User) => void;
  onError: (error: string) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess, onError }) => {
  const [credentials, setCredentials] = useState<AuthCredentials>({
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response: LoginResponse = await login(credentials);
      onSuccess(response.user);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  }, [credentials, login, onSuccess, onError]);

  const handleInputChange = useCallback((field: keyof AuthCredentials) => 
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setCredentials(prev => ({
        ...prev,
        [field]: e.target.value,
      }));
    }, []
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md mx-auto">
      <div>
        <Input
          type="email"
          placeholder="Enter your email"
          value={credentials.email}
          onChange={handleInputChange('email')}
          disabled={isLoading}
          required
        />
      </div>
      
      <div>
        <Input
          type="password"
          placeholder="Enter your password"
          value={credentials.password}
          onChange={handleInputChange('password')}
          disabled={isLoading}
          required
        />
      </div>
      
      <Button
        type="submit"
        variant="primary"
        fullWidth
        loading={isLoading}
        disabled={!credentials.email || !credentials.password}
      >
        {isLoading ? 'Signing in...' : 'Sign In'}
      </Button>
    </form>
  );
};`,

  yaml: `# User Authentication Specification
# Version: 2.1.0
# Last Updated: 2024-01-20

metadata:
  title: "User Authentication System"
  version: "2.1.0"
  owner: "Authentication Team"
  reviewers:
    - "sarah.chen@company.com"
    - "alex.kim@company.com"

capabilities:
  - id: C1
    name: "User Registration"
    description: "New user account creation process"
    requirements:
      - id: REQ1.1
        description: "Email validation required"
        acceptance_criteria:
          - Valid email format check
          - Domain whitelist validation
          - Duplicate email prevention
        
      - id: REQ1.2
        description: "Password strength requirements"
        acceptance_criteria:
          - Minimum 8 characters
          - At least one uppercase letter
          - At least one number
          - At least one special character
          
      - id: REQ1.3
        description: "Email verification process"
        acceptance_criteria:
          - Verification email sent within 5 seconds
          - Verification link expires after 24 hours
          - Account activation on verification

  - id: C2
    name: "User Login"
    description: "Existing user authentication"
    requirements:
      - id: REQ2.1
        description: "Multi-factor authentication support"
        acceptance_criteria:
          - SMS-based 2FA option
          - TOTP authenticator support
          - Backup codes generation
          
      - id: REQ2.2
        description: "Session management"
        acceptance_criteria:
          - JWT token expiration (24 hours)
          - Refresh token rotation
          - Concurrent session handling
          
      - id: REQ2.3
        description: "Failed login attempt tracking"
        acceptance_criteria:
          - Account lockout after 5 failed attempts
          - Lockout duration: 15 minutes
          - Notification to user email

test_scenarios:
  - id: T1
    name: "Valid user registration flow"
    description: "Test complete registration process"
    steps:
      - Submit valid registration form
      - Verify email sent
      - Click verification link
      - Confirm account activation
    expected_result: "User successfully registered and activated"
    covers: [REQ1.1, REQ1.2, REQ1.3]
    
  - id: T2
    name: "Invalid email format handling"
    description: "Test email validation"
    steps:
      - Submit form with invalid email
      - Verify error message displayed
    expected_result: "Clear error message shown"
    covers: [REQ1.1]`,

  json: `{
  "name": "@company/ecommerce-platform",
  "version": "1.2.4",
  "description": "Modern e-commerce platform with React and TypeScript",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "preview": "vite preview",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.8.1",
    "axios": "^1.3.4",
    "zustand": "^4.3.6",
    "react-hook-form": "^7.43.5",
    "zod": "^3.20.6",
    "@hookform/resolvers": "^2.9.11",
    "lucide-react": "^0.320.0",
    "clsx": "^1.2.1",
    "tailwind-merge": "^1.10.0"
  },
  "devDependencies": {
    "@types/react": "^18.0.28",
    "@types/react-dom": "^18.0.11",
    "@typescript-eslint/eslint-plugin": "^5.57.0",
    "@typescript-eslint/parser": "^5.57.0",
    "@vitejs/plugin-react": "^3.1.0",
    "eslint": "^8.37.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.3.4",
    "typescript": "^4.9.3",
    "vite": "^4.2.0",
    "vitest": "^0.29.3",
    "@storybook/react": "^6.5.16"
  }
}`,
});

/**
 * Generate workflow and process states
 */
export const generateWorkflowStates = () => ({
  buildStatus: {
    status: 'success' as const,
    duration: '2m 34s',
    timestamp: '2024-01-20T15:30:00Z',
    steps: [
      { name: 'Install dependencies', status: 'success', duration: '45s' },
      { name: 'Type checking', status: 'success', duration: '23s' },
      { name: 'Linting', status: 'success', duration: '12s' },
      { name: 'Unit tests', status: 'success', duration: '1m 8s' },
      { name: 'Build application', status: 'success', duration: '6s' },
    ],
  },

  deploymentStatus: {
    environment: 'staging',
    status: 'deploying' as const,
    progress: 75,
    currentStep: 'Running database migrations',
    estimatedCompletion: '2024-01-20T15:35:00Z',
  },

  testResults: {
    total: 247,
    passed: 243,
    failed: 3,
    skipped: 1,
    coverage: {
      lines: 89.2,
      functions: 92.1,
      branches: 85.7,
      statements: 89.8,
    },
    duration: '12.4s',
  },
});

/**
 * Generate notification and toast data
 */
export const generateNotifications = () => [
  {
    id: 'notif-1',
    type: 'success' as const,
    title: 'Deployment Successful',
    message: 'Your application has been deployed to staging environment',
    timestamp: '2024-01-20T15:30:00Z',
    read: false,
  },
  {
    id: 'notif-2',
    type: 'warning' as const,
    title: 'Low Test Coverage',
    message: 'Test coverage dropped to 85.7% in the latest build',
    timestamp: '2024-01-20T14:45:00Z',
    read: false,
  },
  {
    id: 'notif-3',
    type: 'info' as const,
    title: 'Code Review Requested',
    message: 'Sarah Chen requested review on PR #234',
    timestamp: '2024-01-20T13:20:00Z',
    read: true,
  },
  {
    id: 'notif-4',
    type: 'error' as const,
    title: 'Build Failed',
    message: 'TypeScript compilation failed in authentication module',
    timestamp: '2024-01-20T12:15:00Z',
    read: true,
  },
];

/**
 * Generate diagram IR data for different visualization types
 */
export const generateDiagramData = () => ({
  flowDiagram: {
    nodes: [
      { id: 'start', label: 'User Login Request', type: 'start' },
      { id: 'validate', label: 'Validate Credentials', type: 'process' },
      { id: 'check-mfa', label: 'MFA Required?', type: 'decision' },
      { id: 'mfa-prompt', label: 'Request MFA Code', type: 'process' },
      { id: 'verify-mfa', label: 'Verify MFA Code', type: 'process' },
      { id: 'create-session', label: 'Create User Session', type: 'process' },
      { id: 'success', label: 'Login Successful', type: 'end' },
      { id: 'error', label: 'Login Failed', type: 'end' },
    ] as FlowNode[],
    edges: [
      { from: 'start', to: 'validate', type: 'normal' },
      { from: 'validate', to: 'check-mfa', type: 'normal' },
      { from: 'check-mfa', to: 'mfa-prompt', label: 'Yes', type: 'conditional' },
      { from: 'check-mfa', to: 'create-session', label: 'No', type: 'conditional' },
      { from: 'mfa-prompt', to: 'verify-mfa', type: 'normal' },
      { from: 'verify-mfa', to: 'create-session', type: 'normal' },
      { from: 'verify-mfa', to: 'error', type: 'error' },
      { from: 'validate', to: 'error', type: 'error' },
      { from: 'create-session', to: 'success', type: 'normal' },
    ] as FlowEdge[],
  } as FlowIR,

  siteDiagram: {
    routes: [
      {
        id: 'route-login',
        path: '/auth/login',
        method: 'POST',
        handler: 'authController.login',
        dependencies: ['db', 'redis'],
      },
      {
        id: 'route-register',
        path: '/auth/register',
        method: 'POST',
        handler: 'authController.register',
        dependencies: ['db', 'email'],
      },
      {
        id: 'route-profile',
        path: '/api/profile',
        method: 'GET',
        handler: 'userController.getProfile',
        dependencies: ['db', 'auth'],
      },
      {
        id: 'route-products',
        path: '/api/products',
        method: 'GET',
        handler: 'productController.list',
        dependencies: ['db', 'cache'],
      },
    ],
    dependencies: [
      { from: 'route-login', to: 'db', type: 'data' },
      { from: 'route-login', to: 'redis', type: 'service' },
      { from: 'route-profile', to: 'auth', type: 'auth' },
      { from: 'route-products', to: 'cache', type: 'service' },
    ],
  } as SiteIR,

  fsmDiagram: {
    states: [
      { id: 'idle', label: 'Idle', type: 'initial' },
      { id: 'loading', label: 'Loading', type: 'normal' },
      { id: 'authenticated', label: 'Authenticated', type: 'normal' },
      { id: 'error', label: 'Error', type: 'normal' },
      { id: 'locked', label: 'Account Locked', type: 'final' },
    ],
    transitions: [
      { from: 'idle', to: 'loading', event: 'SUBMIT_LOGIN', action: 'validateCredentials' },
      { from: 'loading', to: 'authenticated', event: 'LOGIN_SUCCESS', action: 'createSession' },
      {
        from: 'loading',
        to: 'error',
        event: 'LOGIN_FAILED',
        guard: 'attempts < 5',
        action: 'incrementAttempts',
      },
      {
        from: 'loading',
        to: 'locked',
        event: 'LOGIN_FAILED',
        guard: 'attempts >= 5',
        action: 'lockAccount',
      },
      { from: 'error', to: 'idle', event: 'RETRY', action: 'clearError' },
      { from: 'authenticated', to: 'idle', event: 'LOGOUT', action: 'destroySession' },
    ],
    initial: 'idle',
    final: ['locked'],
  } as FsmIR,

  viewDiagram: {
    tokens: [
      { id: 'c1', label: 'User Registration', type: 'capability', position: { x: 100, y: 50 } },
      { id: 'req1.1', label: 'Email Validation', type: 'requirement', position: { x: 50, y: 150 } },
      {
        id: 'req1.2',
        label: 'Password Strength',
        type: 'requirement',
        position: { x: 150, y: 150 },
      },
      { id: 't1', label: 'Registration Test', type: 'test', position: { x: 100, y: 250 } },
      { id: 'user-data', label: 'User Profile Data', type: 'data', position: { x: 250, y: 150 } },
    ] as ViewToken[],
    connections: [
      { from: 'c1', to: 'req1.1', type: 'implements' },
      { from: 'c1', to: 'req1.2', type: 'implements' },
      { from: 'req1.1', to: 't1', type: 'tests' },
      { from: 'req1.2', to: 't1', type: 'tests' },
      { from: 'c1', to: 'user-data', type: 'provides' },
    ] as ViewConnection[],
    layout: { width: 400, height: 300, padding: 20 },
  } as ViewIR,
});

/**
 * Generate different data loading states for components
 */
export const generateLoadingStates = () => ({
  loading: {
    projects: [],
    isLoading: true,
    error: null,
  },

  error: {
    projects: [],
    isLoading: false,
    error: {
      type: 'network_error',
      title: 'Connection Failed',
      status: 500,
      detail:
        'Unable to connect to the server. Please check your internet connection and try again.',
      instance: '/api/projects',
    },
  },

  empty: {
    projects: [],
    isLoading: false,
    error: null,
    message: 'No projects found. Create your first project to get started.',
  },

  populated: {
    projects: generateProjects(),
    isLoading: false,
    error: null,
  },
});

/**
 * Generate realistic API response data
 */
export const generateApiResponses = () => ({
  success: {
    status: 200,
    data: generateProjects(),
    message: 'Projects retrieved successfully',
    timestamp: '2024-01-20T15:30:00Z',
  },

  validationResponse: {
    success: false,
    spec_hash: 'sha256:a1b2c3d4e5f6...',
    errors: generateValidationResults().errors,
    warnings: generateValidationResults().warnings,
  },

  websocketEvent: {
    type: 'fragment_updated' as const,
    project_id: 'project-ecommerce-api',
    data: {
      fragment: generateFragments('project-ecommerce-api')[0],
      operation: 'updated' as const,
    },
    timestamp: '2024-01-20T15:30:00Z',
    user: 'sarah.chen@company.com',
  },
});

// =============================================================================
// EXPORT ALL DATA GENERATORS
// =============================================================================

export const storybookData = {
  users: generateUsers(),
  projects: generateProjects(),
  fragments: generateFragments('project-ecommerce-api'),
  validation: generateValidationResults(),
  gaps: generateGapAnalysis(),
  fileTree: generateFileTree(),
  code: generateCodeContent(),
  workflow: generateWorkflowStates(),
  notifications: generateNotifications(),
  diagrams: generateDiagramData(),
  loadingStates: generateLoadingStates(),
  apiResponses: generateApiResponses(),
};

// Individual exports for convenience
export const {
  users,
  projects,
  fragments,
  validation,
  gaps,
  fileTree,
  code,
  workflow,
  notifications,
  diagrams,
  loadingStates,
  apiResponses,
} = storybookData;

export default storybookData;
