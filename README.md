# Arbiter

_Real-time collaborative specification development with live visualization_

Arbiter is a modern specification workbench that combines the power of CUE (Configure, Unify, Execute) with real-time collaboration features. Build, validate, and visualize specifications collaboratively with live feedback and instant validation.

## ✨ Features

### 🚀 Real-time Collaboration
- **Live editing** with WebSocket-based collaboration
- **Instant validation** as you type
- **Conflict resolution** with operational transforms
- **Multi-user sessions** with role-based permissions

### 📊 Interactive Visualization  
- **Live spec diagrams** that update as you edit
- **Data flow visualization** showing relationships and dependencies
- **Interactive charts** and graphs from your specifications
- **Export capabilities** for documentation and presentations

### 🛠️ Powerful CUE Integration
- **Full CUE language support** with syntax highlighting
- **Schema validation** with detailed error reporting
- **Type inference** and auto-completion
- **Import/export** from JSON, YAML, and other formats

### 🎨 Modern Developer Experience
- **Monaco editor** with CUE language support
- **Component-based UI** built with React and TypeScript
- **Design system** with comprehensive Storybook documentation
- **Performance optimized** with Bun runtime

## 🏗️ Architecture

```
┌─────────────────┐    WebSocket    ┌─────────────────┐
│  React Frontend │ ←────────────→  │ Bun Backend     │
│                 │                 │                 │
│ • Monaco Editor │                 │ • CUE Engine    │
│ • Visualization │                 │ • SQLite DB     │
│ • Design System │                 │ • NATS Messaging│
└─────────────────┘                 └─────────────────┘
```

**Frontend Stack:**
- React 18 with TypeScript
- Monaco Editor for code editing
- Mermaid for diagram rendering
- Tailwind CSS + Design System
- Vite for development and building
- Comprehensive test suite with Vitest

**Backend Stack:**  
- Bun runtime for maximum performance
- TypeScript for type safety
- WebSocket for real-time updates
- SQLite for data persistence
- NATS for event streaming
- Docker for containerization

## 🚀 Quick Start

### Prerequisites
- [Bun](https://bun.sh/) v1.0.0 or later
- [Node.js](https://nodejs.org/) v18+ (for frontend)
- Docker (optional, for containerized development)

### Development Setup

1. **Clone and setup dependencies:**
   ```bash
   git clone <repository-url>
   cd arbiter
   bun install
   ```

2. **Start the backend:**
   ```bash
   bun dev
   ```

3. **Start the frontend (in a new terminal):**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. **Access the application:**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000
   - WebSocket: ws://localhost:3000/ws

### Using Docker

```bash
# Build and start all services
docker-compose up --build

# Development with hot reload
docker-compose -f docker-compose.yml up
```

## 📖 Usage

### Creating a New Specification

1. Open Arbiter in your browser
2. Click "New Specification" 
3. Start writing CUE definitions in the Monaco editor
4. Watch real-time validation and visualization update as you type

### Collaborative Editing

1. Share your specification URL with team members
2. Multiple users can edit simultaneously
3. Changes are synchronized in real-time
4. Conflicts are automatically resolved

### Visualization Features

- **Flow Diagrams**: Automatically generated from your CUE structure
- **Data Relationships**: Visual representation of constraints and dependencies  
- **Schema Browser**: Navigate complex specifications with an interactive tree
- **Export Options**: Save diagrams as PNG, SVG, or embed in documentation

## 🧪 Development

### Running Tests

```bash
# Backend tests
bun test

# Frontend tests  
cd frontend
npm test

# End-to-end tests
npm run test:e2e
```

### Building for Production

```bash
# Build backend
bun run build

# Build frontend
cd frontend
npm run build

# Build Docker image
docker build -t arbiter .
```

### Code Quality

```bash
# Type checking
bun run typecheck

# Linting
bun run lint
cd frontend && npm run lint

# Formatting
bun run format
cd frontend && npm run format
```

## 📁 Project Structure

```
arbiter/
├── src/                    # Backend TypeScript source
│   ├── server.ts          # Main server with WebSocket
│   ├── specEngine.ts      # CUE validation engine  
│   ├── db.ts              # SQLite database layer
│   └── types.ts           # Shared type definitions
├── frontend/              # React frontend application
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── design-system/ # Reusable UI components
│   │   └── services/      # API and WebSocket clients
├── spec/                  # Example CUE specifications
├── doc/                   # CUE language documentation
└── examples/              # Usage examples
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes with tests
4. Ensure all tests pass: `bun test && cd frontend && npm test`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built on the powerful [CUE language](https://cuelang.org/)
- Inspired by collaborative editing tools like Figma and Notion  
- Thanks to the CUE community for excellent documentation and examples

