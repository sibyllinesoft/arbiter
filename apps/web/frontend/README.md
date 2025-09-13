# Arbiter Web Frontend

**Interactive web interface for visual specification editing and system architecture visualization**

A sophisticated React + TypeScript frontend that provides a visual layer for Arbiter's specification-driven development workflow. Built with modern tools and featuring a comprehensive design system called "Graphite."

## What This Frontend Provides

🎨 **Visual Specification Editing**: Interactive editors for CUE specifications  
📊 **Interactive Diagrams**: Transform specifications into beautiful, live diagrams  
🔍 **Real-time Validation**: Instant feedback as you edit specifications  
📱 **Responsive Design**: Works seamlessly across desktop, tablet, and mobile  
🎭 **Storybook Integration**: Comprehensive component documentation and testing  
⚡ **Performance Optimized**: Fast loading and smooth interactions  

## Architecture Overview

### Technology Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for lightning-fast development
- **Styling**: Tailwind CSS with custom design tokens
- **State Management**: React hooks and context
- **Testing**: Playwright for E2E, Vitest for unit tests
- **Documentation**: Storybook for component showcase
- **Code Quality**: ESLint, TypeScript strict mode

### Key Features

#### 1. Split-View Architecture
- **Left Panel**: Specification editor with syntax highlighting
- **Right Panel**: Live-rendered interactive diagrams
- **Synchronized Updates**: Changes reflect immediately across views
- **Copy-to-Clipboard**: Easy specification sharing

#### 2. Interactive Diagram Types
- **Flow Diagrams**: CI/CD pipelines, authentication flows, microservices
- **State Machines**: Order processing, user sessions, approval workflows
- **Site Architecture**: System topology and component relationships
- **CUE Visualization**: Native CUE language structure visualization

#### 3. Graphite Design System
- **Consistent Theming**: Professional dark/light mode support
- **Component Library**: Reusable UI components with variants
- **Design Tokens**: Centralized colors, typography, and spacing
- **Accessibility**: WCAG 2.1 AA compliant components

## Getting Started

### Prerequisites

- **Node.js 18+** or **Bun**
- **Arbiter API server** running (see root README)

### Development Setup

```bash
# Install dependencies
npm install
# or
bun install

# Start development server
npm run dev
# or  
bun run dev

# Open http://localhost:5173
```

### Available Scripts

```bash
# Development
npm run dev              # Start dev server with hot reload
npm run build            # Build for production
npm run preview          # Preview production build

# Code Quality
npm run lint             # ESLint code analysis
npm run typecheck        # TypeScript type checking

# Testing
npm run test             # Unit tests with Vitest
npm run test:e2e         # E2E tests with Playwright
npm run test:e2e:ui      # E2E tests with UI
npm run test:e2e:debug   # Debug E2E tests
npm run test:cue-stories # Test CUE-specific stories

# Documentation
npm run storybook        # Start Storybook on port 6007
npm run build-storybook  # Build Storybook static site
npm run storybook:test   # Run tests against Storybook
```

## Project Structure

```
src/
├── components/          # React components
│   ├── diagrams/       # Diagram visualization components
│   ├── editors/        # Code/spec editors
│   ├── layout/         # Layout and navigation
│   └── ui/            # Design system components
├── contexts/           # React context providers
├── hooks/             # Custom React hooks
├── types/             # TypeScript type definitions
├── utils/             # Utility functions
├── stories/           # Storybook stories
└── tests/             # Test files
```

### Key Components

- **`CueVisualization`**: Interactive CUE specification viewer
- **`FlowDiagram`**: Dynamic flow chart rendering
- **`FsmDiagram`**: Finite state machine visualization
- **`SiteDiagram`**: System architecture diagrams
- **`SpecEditor`**: Code editor with CUE syntax highlighting

## Environment Configuration

Create a `.env.development` file:

```bash
# API Configuration
VITE_API_URL=http://localhost:5050
VITE_API_TIMEOUT=30000

# Feature Flags
VITE_ENABLE_DEBUG_MODE=true
VITE_ENABLE_ANALYTICS=false

# Development Settings
VITE_HOT_RELOAD=true
```

## Testing Strategy

### Unit Testing (Vitest)
- Component logic testing
- Hook behavior validation
- Utility function verification

### E2E Testing (Playwright)
- Full user workflow testing
- Cross-browser compatibility
- Visual regression testing
- Storybook component testing

### Test Commands
```bash
# Run all tests
npm run test

# E2E tests with specific focus
npm run test:cue-stories      # CUE-specific functionality
npm run test:comprehensive    # Full application workflows

# Test with coverage
npm run test -- --coverage
```

## Storybook Integration

The frontend includes comprehensive Storybook documentation:

```bash
# Start Storybook
npm run storybook

# View at http://localhost:6007
```

**Available Stories:**
- **Components**: All UI components with variants
- **Diagrams**: Interactive diagram examples
- **Layouts**: Page layout combinations
- **Themes**: Design system showcase

## API Integration

The frontend connects to the Arbiter API server for:

- **Specification Validation**: Real-time CUE validation
- **Code Generation**: Preview generated code
- **Project Management**: Save and load specifications
- **Health Monitoring**: API connectivity status

### API Client Configuration

```typescript
// API client automatically configured via environment
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5050';
const timeout = import.meta.env.VITE_API_TIMEOUT || 30000;
```

## Performance Optimization

### Build Optimizations
- **Code Splitting**: Automatic route-based splitting
- **Tree Shaking**: Unused code elimination
- **Asset Optimization**: Image and font optimization
- **Minification**: Production bundle compression

### Runtime Performance
- **Lazy Loading**: Components loaded on demand
- **Memoization**: Expensive computations cached
- **Debounced Updates**: Reduced API calls during editing
- **Virtual Scrolling**: Efficient rendering of large lists

## Deployment

### Production Build
```bash
# Create optimized production build
npm run build

# Output in dist/ directory
```

### Static Hosting
The built frontend can be deployed to any static hosting service:
- **Vercel**: `vercel deploy`
- **Netlify**: Drag & drop `dist/` folder
- **AWS S3**: Upload `dist/` contents
- **GitHub Pages**: Use built-in GitHub Actions

### Environment Variables for Production
```bash
VITE_API_URL=https://api.your-domain.com
VITE_API_TIMEOUT=30000
VITE_ENABLE_ANALYTICS=true
```

## Contributing

### Code Style
- **ESLint**: Enforced code quality rules
- **Prettier**: Automatic code formatting
- **TypeScript**: Strict type checking enabled
- **Component Structure**: Consistent patterns across components

### Adding New Components
1. Create component in appropriate `src/components/` subdirectory
2. Add TypeScript types in `src/types/`
3. Create Storybook story in `.stories.tsx` file
4. Add tests in `tests/` directory
5. Export from appropriate index file

### Testing New Features
1. Write unit tests for logic
2. Create Storybook stories for UI
3. Add E2E tests for user workflows
4. Test across different screen sizes
5. Verify accessibility compliance

## Troubleshooting

### Common Issues

1. **API Connection Errors**
   - Ensure API server is running on port 5050
   - Check `VITE_API_URL` environment variable
   - Verify CORS configuration

2. **Build Failures**
   - Run `npm run typecheck` to identify TypeScript errors
   - Clear node_modules and reinstall dependencies
   - Check for missing environment variables

3. **Storybook Issues**
   - Ensure port 6007 is available
   - Clear Storybook cache: `rm -rf .storybook-cache`
   - Check for component import errors

### Development Tips

- **Hot Reload**: Changes should reflect immediately
- **Error Overlay**: Vite shows helpful error information
- **Network Tab**: Monitor API calls in browser DevTools
- **React DevTools**: Inspect component state and props

## Related Documentation

- **[Storybook Stories](./stories/)** - Interactive component documentation
- **[Testing Guide](./TESTING_GUIDE.md)** - Comprehensive testing strategy
- **[Diagram Showcase](./DIAGRAM_SHOWCASE_README.md)** - Visualization capabilities
- **[Arbiter API Documentation](../../api/README.md)** - Backend API reference

---

*The Arbiter web frontend transforms complex specifications into intuitive visual experiences, making system architecture accessible to both technical and non-technical stakeholders.*