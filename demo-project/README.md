# Demo Project

**A complete example of an Arbiter-generated application**

This project demonstrates how Arbiter transforms a single CUE specification into
a fully functional web application. It serves as both a learning example and a
reference implementation for new users.

## What This Demo Shows

- **Specification-Driven Development**: Everything starts from the
  `arbiter.assembly.cue` file
- **Generated Application Structure**: TypeScript/Vite frontend with proper
  tooling
- **UI Route Management**: How Arbiter handles routing and page components
- **Component Generation**: Automated React component creation from
  specifications
- **Testing Setup**: Built-in testing infrastructure with Vitest
- **Build Configuration**: Production-ready build pipeline

## Project Structure

```
demo-project/
├── arbiter.assembly.cue     # The source specification
├── src/                     # Generated application code
├── package.json            # Generated dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── vite.config.ts          # Build configuration
└── index.html              # Entry point
```

## Understanding the Specification

The `arbiter.assembly.cue` file defines:

- **Product Goals**: What the application aims to accomplish
- **UI Routes**: Available pages and their capabilities
- **Components**: React components to be generated
- **Locators**: Test selectors for automation
- **Configuration**: Build and deployment settings

## Running the Demo

### Prerequisites

- Node.js 18+ or Bun
- Arbiter CLI installed

### Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:5173 to view the application
```

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run test         # Run tests with Vitest
npm run test:ui      # Run tests with UI
npm run lint         # Lint TypeScript code
npm run type-check   # Type check without emitting
```

## How This Was Generated

This entire project structure was created from the specification using:

```bash
# From the demo-project directory
arbiter generate
```

The specification defines:

- A route at `/plotService` with viewing capabilities
- A `PlotservicePage` component to handle the route
- TypeScript as the target language
- Vite as the build tool

## Modifying the Demo

To see Arbiter in action:

1. **Edit the specification**: Modify `arbiter.assembly.cue`
2. **Regenerate**: Run `arbiter generate`
3. **Observe changes**: See how the application code updates

### Example: Adding a New Route

```cue
ui: {
    routes: [
        // Existing route
        {
            id:   "plotService:main"
            path: "/plotService"
            capabilities: ["view"]
            components: ["PlotservicePage"]
        },
        // Add this new route
        {
            id:   "dashboard:main"
            path: "/dashboard"
            capabilities: ["view", "edit"]
            components: ["DashboardPage"]
        }
    ]
}
```

Then regenerate with `arbiter generate` to see the new route and component
created.

## Next Steps

- **Explore the Code**: Look at the generated TypeScript files in `src/`
- **Modify the Spec**: Try adding new routes, components, or capabilities
- **Run Tests**: See how Arbiter generates test infrastructure
- **Check the Build**: Run `npm run build` to see the production output

## Learn More

- **[Arbiter Documentation](../docs/)** - Complete guides and references
- **[CUE Language](https://cuelang.org/)** - Understanding the specification
  language
- **[Core Concepts](../docs/core-concepts.md)** - Arbiter's architecture
  principles

---

_This demo project is automatically maintained and regenerated as part of
Arbiter's development process._
