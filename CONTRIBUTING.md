# Contributing to Arbiter

Thank you for your interest in contributing to Arbiter! This guide will help you get started with development and understand our contribution process.

## Table of Contents

- [Quick Start](#quick-start)
- [Development Environment](#development-environment)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Testing Strategy](#testing-strategy)
- [Code Standards](#code-standards)
- [Pull Request Process](#pull-request-process)
- [Issue Guidelines](#issue-guidelines)
- [Security Guidelines](#security-guidelines)

## Quick Start

### Prerequisites

Before you begin, ensure you have the following installed:

- **Bun** >= 1.0.0 ([Installation Guide](https://bun.sh/docs/installation))
- **Node.js** >= 18.0.0 (for compatibility testing)
- **CUE CLI** >= 0.8.0 ([Installation Guide](https://cuelang.org/docs/install/))
- **Git** >= 2.30.0
- **Docker** >= 20.10.0 (optional, for containerized development)

### Setup Instructions

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/your-username/arbiter.git
   cd arbiter
   ```

2. **Install dependencies:**
   ```bash
   bun install
   ```

3. **Verify installation:**
   ```bash
   bun --version    # Should show Bun version
   cue version      # Should show CUE version
   bun run typecheck # Should pass without errors
   ```

4. **Start development servers:**
   ```bash
   bun run dev      # Starts both API (3001) and Web (5173)
   ```

5. **Verify everything works:**
   - Open http://localhost:5173
   - Create a new project
   - Write some CUE configuration
   - Verify real-time analysis works

## Development Environment

### Recommended IDE Setup

**Visual Studio Code** with these extensions:
- TypeScript and JavaScript Language Features (built-in)
- Prettier - Code formatter
- ESLint
- CUE Language Support
- Docker (if using containers)

**Configuration files included:**
- `.vscode/settings.json` - VS Code workspace settings
- `.vscode/extensions.json` - Recommended extensions

### Environment Variables

Create a `.env` file in the root directory:

```bash
# Development environment variables
NODE_ENV=development
PORT=3001
DB_PATH=./data/arbiter.db

# Frontend environment (automatically loaded by Vite)
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

### Database Setup

The SQLite database is created automatically on first run. For development:

```bash
# Database files are stored in ./data/
ls -la data/
# arbiter.db - Main database
# *.db-wal   - Write-ahead log files
# *.db-shm   - Shared memory files

# To reset database (development only)
rm -rf data/
# Restart server to recreate
```

## Project Structure

### Monorepo Organization

```
arbiter/
├── apps/
│   ├── api/                    # Bun HTTP+WebSocket server
│   │   ├── server.ts          # Main server implementation
│   │   ├── package.json       # API dependencies
│   │   └── tests/             # API-specific tests
│   └── web/                   # React frontend
│       ├── src/
│       │   ├── App.tsx        # Main application component
│       │   ├── components/    # React components
│       │   └── hooks/         # Custom React hooks
│       ├── package.json       # Web dependencies
│       └── tests/             # Frontend tests
├── packages/
│   └── shared/                # Shared types and schemas
│       ├── src/
│       │   ├── schemas.ts     # Zod validation schemas
│       │   └── types.ts       # TypeScript interfaces
│       └── package.json       # Shared package config
├── docs/                      # Documentation
│   ├── protocol.md           # WebSocket protocol spec
│   └── ADR-0001-runtime.md   # Architecture decisions
├── examples/                  # Sample CUE files
└── tests/                     # End-to-end tests
```

### Key Technologies

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Runtime** | Bun | Fast JavaScript/TypeScript runtime |
| **Frontend** | React + Vite | Modern UI development |
| **Editor** | Monaco Editor | Code editing with syntax highlighting |
| **Collaboration** | Y.js | CRDT for real-time document sync |
| **Validation** | Zod | Runtime type validation |
| **Database** | SQLite | Lightweight data storage |
| **Analysis** | CUE CLI | Configuration validation engine |
| **Testing** | Vitest | Unit and integration testing |
| **E2E Testing** | Playwright | Browser automation testing |

## Development Workflow

### Branch Strategy

We use a simplified Git flow:

1. **Main branch** (`main`) - Production-ready code
2. **Feature branches** (`feature/description`) - New features
3. **Bug fix branches** (`fix/description`) - Bug fixes
4. **Hotfix branches** (`hotfix/description`) - Critical production fixes

### Creating a Feature Branch

```bash
# Update main branch
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/add-user-authentication

# Make your changes...
git add .
git commit -m "feat: add user authentication system"

# Push branch
git push origin feature/add-user-authentication
```

### Commit Message Format

We follow the [Conventional Commits](https://conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or modifying tests
- `chore`: Build process or auxiliary tool changes

**Examples:**
```bash
feat(api): add rate limiting to analysis endpoint
fix(web): resolve cursor synchronization issue
docs: update API documentation with new endpoints
test(shared): add validation tests for project schema
```

### Development Commands

```bash
# Development servers
bun run dev                    # Start both API and web servers
bun run --cwd apps/api dev     # Start API server only
bun run --cwd apps/web dev     # Start web server only

# Building
bun run build                  # Build all packages
bun run --cwd packages/shared build # Build shared package only

# Code quality
bun run typecheck             # Type check all packages
bun run lint                  # Lint all packages
bun run format                # Format code with Prettier

# Testing
bun run test                  # Run all unit tests
bun run --cwd apps/api test   # Run API tests only
bun run --cwd apps/web test   # Run web tests only
bun run e2e                   # Run end-to-end tests

# Database management
rm -rf data/                  # Reset development database
```

## Testing Strategy

### Testing Philosophy

- **Unit tests** for individual functions and components
- **Integration tests** for API endpoints and database operations
- **End-to-end tests** for complete user workflows
- **Component tests** for React components with user interactions

### Test Coverage Goals

| Package | Coverage Target | Current Coverage |
|---------|----------------|------------------|
| `shared` | 95% | ~90% |
| `api` | 90% | ~85% |
| `web` | 85% | ~80% |
| `e2e` | Critical paths | All major flows |

### Running Tests

```bash
# All tests
bun run test

# Watch mode
bun run --cwd apps/api test --watch

# Coverage report
bun run --cwd apps/web test --coverage

# E2E tests
bun run e2e

# E2E tests with UI (for debugging)
bun run e2e --ui
```

### Writing Tests

#### Unit Test Example (API)

```typescript
// apps/api/tests/analysis.test.ts
import { describe, expect, it } from 'bun:test';
import { analyzeCue } from '../server';

describe('CUE Analysis', () => {
  it('should parse valid CUE configuration', async () => {
    const result = await analyzeCue(
      'package config\nname: "test"',
      'test-123'
    );
    
    expect(result.errors).toEqual([]);
    expect(result.value).toEqual({ name: 'test' });
    expect(result.requestId).toBe('test-123');
  });

  it('should return errors for invalid CUE', async () => {
    const result = await analyzeCue(
      'invalid cue syntax [[[',
      'test-456'
    );
    
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.value).toBeUndefined();
  });
});
```

#### Component Test Example (Web)

```typescript
// apps/web/src/components/__tests__/ProjectList.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectList } from '../ProjectList';

describe('ProjectList', () => {
  it('should display projects and handle creation', async () => {
    const user = userEvent.setup();
    
    render(<ProjectList />);
    
    // Wait for projects to load
    await waitFor(() => {
      expect(screen.getByText('My Project')).toBeInTheDocument();
    });
    
    // Test project creation
    await user.click(screen.getByText('New Project'));
    await user.type(screen.getByPlaceholderText('Project name'), 'Test Project');
    await user.click(screen.getByText('Create'));
    
    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });
  });
});
```

#### E2E Test Example

```typescript
// tests/e2e/collaboration.spec.ts
import { test, expect } from '@playwright/test';

test('multiple users can collaborate on a project', async ({ context }) => {
  // Create two browser contexts (simulate two users)
  const page1 = await context.newPage();
  const page2 = await context.newPage();
  
  // User 1 creates project
  await page1.goto('http://localhost:5173');
  await page1.click('text=New Project');
  await page1.fill('[placeholder="Project name"]', 'Collaboration Test');
  await page1.click('text=Create');
  
  // User 2 joins the same project
  await page2.goto(page1.url());
  
  // User 1 types in editor
  await page1.click('.monaco-editor');
  await page1.type('.monaco-editor textarea', 'name: "shared-config"');
  
  // User 2 should see the changes
  await expect(page2.locator('.monaco-editor')).toContainText('shared-config');
});
```

## Code Standards

### TypeScript Configuration

We use strict TypeScript configuration:

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true
  }
}
```

### ESLint Rules

Key linting rules we enforce:

- No unused variables or imports
- Consistent code formatting
- Proper TypeScript types (no `any`)
- React best practices
- Security-focused rules

### Code Style Guidelines

#### General Principles

1. **Prefer explicit over implicit**
2. **Use TypeScript types everywhere**
3. **Write self-documenting code**
4. **Handle errors explicitly**
5. **Optimize for readability**

#### Naming Conventions

```typescript
// Files: kebab-case
user-service.ts
project-list.component.tsx

// Variables and functions: camelCase
const userName = 'alice';
function createProject() { }

// Types and interfaces: PascalCase
interface UserProfile { }
type ProjectStatus = 'active' | 'inactive';

// Constants: SCREAMING_SNAKE_CASE
const MAX_FILE_SIZE = 1024 * 1024;
const DEFAULT_TIMEOUT = 5000;

// Components: PascalCase
export function ProjectEditor() { }
```

#### Function Guidelines

```typescript
// Good: Pure functions with explicit types
function calculateTotal(
  items: Array<{ price: number; quantity: number }>
): number {
  return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

// Good: Error handling with Result types
type Result<T, E> = { success: true; data: T } | { success: false; error: E };

function parseConfig(text: string): Result<Config, ParseError> {
  try {
    const config = JSON.parse(text);
    return { success: true, data: config };
  } catch (error) {
    return { 
      success: false, 
      error: { message: 'Invalid JSON', details: error } 
    };
  }
}

// Good: Async functions with proper error handling
async function fetchProjects(): Promise<Project[]> {
  try {
    const response = await fetch('/api/projects');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch projects:', error);
    throw error;
  }
}
```

#### React Component Guidelines

```typescript
// Good: Functional component with proper types
interface ProjectCardProps {
  project: Project;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ProjectCard({ project, onEdit, onDelete }: ProjectCardProps) {
  const handleEdit = useCallback(() => {
    onEdit(project.id);
  }, [project.id, onEdit]);

  const handleDelete = useCallback(() => {
    onDelete(project.id);
  }, [project.id, onDelete]);

  return (
    <div className="project-card">
      <h3>{project.name}</h3>
      <p>{project.description}</p>
      <button onClick={handleEdit}>Edit</button>
      <button onClick={handleDelete}>Delete</button>
    </div>
  );
}
```

### Security Guidelines

#### Input Validation

```typescript
import { z } from 'zod';

// Always validate external input with Zod
const CreateProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
});

function createProject(input: unknown) {
  const validated = CreateProjectSchema.parse(input);
  // Safe to use validated data
  return createProjectInternal(validated);
}
```

#### CUE Analysis Security

```typescript
// Never execute untrusted code directly
// Always use sandboxed execution with timeouts
async function analyzeCue(text: string): Promise<AnalysisResult> {
  // Block dangerous imports
  if (text.includes('import')) {
    throw new Error('Imports not allowed');
  }
  
  // Use temporary directory isolation
  const tempDir = await mkdtemp(join(tmpdir(), 'cue-analysis-'));
  
  try {
    // Write to isolated file
    await writeFile(join(tempDir, 'doc.cue'), text, 'utf8');
    
    // Execute with timeout
    const proc = spawn(['cue', 'export', 'doc.cue'], {
      cwd: tempDir,
      timeout: 750,
    });
    
    return await processResult(proc);
  } finally {
    // Always cleanup
    await rm(tempDir, { recursive: true, force: true });
  }
}
```

## Pull Request Process

### Before Submitting

1. **Ensure all tests pass:**
   ```bash
   bun run test
   bun run e2e
   bun run typecheck
   bun run lint
   ```

2. **Update documentation if needed:**
   - API changes → Update `API.md`
   - Architecture changes → Update `ARCHITECTURE.md`
   - New features → Update `README.md` and `USER_GUIDE.md`

3. **Add appropriate tests:**
   - New features require tests
   - Bug fixes require regression tests
   - API changes require integration tests

### PR Template

When creating a PR, use this template:

```markdown
## Description
Brief description of changes and motivation.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] Unit tests pass locally
- [ ] Integration tests pass locally
- [ ] E2E tests pass locally
- [ ] Added new tests for new functionality

## Checklist
- [ ] My code follows the project's style guidelines
- [ ] I have performed a self-review of my code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] Any dependent changes have been merged and published

## Screenshots (if applicable)
Include screenshots for UI changes.
```

### Review Process

1. **Automated checks** must pass (CI/CD pipeline)
2. **Code review** by at least one maintainer
3. **Manual testing** for significant changes
4. **Documentation review** for API or feature changes

### Merging

- We use **Squash and Merge** for feature branches
- **Rebase and Merge** for hotfixes
- **Merge commits** for release branches

## Issue Guidelines

### Bug Reports

Use the bug report template:

```markdown
**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected behavior**
A clear and concise description of what you expected to happen.

**Screenshots**
If applicable, add screenshots to help explain your problem.

**Environment:**
- OS: [e.g. macOS 12.0]
- Browser: [e.g. chrome 95]
- Bun version: [e.g. 1.0.0]
- CUE version: [e.g. 0.8.0]

**Additional context**
Add any other context about the problem here.
```

### Feature Requests

Use the feature request template:

```markdown
**Is your feature request related to a problem? Please describe.**
A clear and concise description of what the problem is.

**Describe the solution you'd like**
A clear and concise description of what you want to happen.

**Describe alternatives you've considered**
A clear and concise description of any alternative solutions or features you've considered.

**Additional context**
Add any other context or screenshots about the feature request here.
```

### Issue Labels

We use these labels for organization:

- `bug` - Something isn't working
- `enhancement` - New feature or request
- `documentation` - Improvements or additions to documentation
- `good first issue` - Good for newcomers
- `help wanted` - Extra attention is needed
- `question` - Further information is requested
- `wontfix` - This will not be worked on

## Security Guidelines

### Reporting Security Issues

**Do not** report security issues publicly. Instead:

1. Email security@arbiter-project.com
2. Include detailed description and reproduction steps
3. Allow 90 days for response and fixing
4. Coordinate disclosure timing

### Security Best Practices

1. **Input validation** - All user input must be validated
2. **Output encoding** - Prevent XSS attacks
3. **Authentication** - Secure session management (coming in v1)
4. **Authorization** - Proper access controls (coming in v1)
5. **Rate limiting** - Prevent abuse and DoS attacks
6. **Dependency scanning** - Regular security audits

### Common Security Pitfalls

❌ **Don't do:**
```typescript
// Dangerous: Direct execution of user input
eval(userInput);
exec(userCommand);

// Dangerous: SQL injection
db.query(`SELECT * FROM users WHERE id = ${userId}`);

// Dangerous: XSS vulnerability
element.innerHTML = userContent;
```

✅ **Do:**
```typescript
// Safe: Sandboxed execution with validation
const result = validateAndExecute(userInput);

// Safe: Parameterized queries
db.query('SELECT * FROM users WHERE id = ?', [userId]);

// Safe: Text content only
element.textContent = userContent;
```

## Getting Help

### Community Resources

- **Documentation**: Check existing docs in `/docs/` folder
- **Issues**: Search existing GitHub issues
- **Discussions**: Use GitHub Discussions for questions
- **Discord**: Join our Discord server (link in README)

### Development Help

For development questions:

1. Check this contributing guide
2. Look at existing code for patterns
3. Run `bun run dev` and examine the working system
4. Create an issue with the `question` label

### Common Problems

#### Development Server Won't Start

```bash
# Check if ports are already in use
lsof -i :3001
lsof -i :5173

# Kill processes if needed
kill -9 <PID>

# Check for dependency issues
rm -rf node_modules
bun install
```

#### CUE CLI Not Found

```bash
# Verify CUE is installed
which cue
cue version

# Install CUE if missing (macOS)
brew install cue-lang/tap/cue

# Install CUE if missing (Linux)
curl -L https://github.com/cue-lang/cue/releases/download/v0.8.2/cue_v0.8.2_linux_amd64.tar.gz | tar -xz
sudo mv cue /usr/local/bin/
```

#### Type Errors

```bash
# Generate types from schemas
bun run --cwd packages/shared build

# Check TypeScript configuration
bun run typecheck
```

Thank you for contributing to Arbiter! Your efforts help make real-time collaborative configuration editing better for everyone.