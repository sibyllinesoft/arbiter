# Webhook Handlers UI

A comprehensive web interface for managing webhook handlers with code editing,
execution monitoring, and performance analytics.

## Features

### 🎯 Core Functionality

- **Handler Management**: Full CRUD operations for webhook handlers
- **Code Editor**: Monaco Editor with TypeScript/JavaScript syntax highlighting
- **Execution Stats**: Real-time metrics and execution history
- **Provider Support**: GitHub, GitLab, Bitbucket, Slack, Discord, and custom
  webhooks
- **Live Testing**: Test handlers with sample payloads before deployment

### 🛡️ Quality & Reliability

- **Error Boundaries**: Graceful error handling with recovery options
- **Loading States**: Comprehensive loading indicators and skeleton screens
- **Form Validation**: Real-time code validation and syntax checking
- **Responsive Design**: Mobile-friendly interface with adaptive layouts
- **Accessibility**: WCAG 2.1 AA compliant with keyboard navigation

### ⚡ Performance

- **Data Caching**: Efficient data management with the useHandlers hook
- **Monaco Integration**: Optimized code editor with syntax highlighting
- **Lazy Loading**: Components load on demand for better performance
- **Debounced Search**: Efficient filtering and search capabilities

## Component Architecture

```
components/Handlers/
├── Handlers.tsx                 # Main container component
├── HandlersList.tsx            # List view with filtering & management
├── HandlerEditor.tsx           # Code editor with Monaco integration
├── HandlerStats.tsx            # Execution metrics and history
├── HandlersErrorBoundary.tsx   # Error handling and recovery
├── index.ts                    # Component exports
└── README.md                   # This documentation
```

## API Integration

### Endpoints

- `GET /api/handlers` - List all handlers
- `POST /api/handlers` - Create new handler
- `PUT /api/handlers/:id` - Update handler
- `DELETE /api/handlers/:id` - Delete handler
- `POST /api/handlers/:id/toggle` - Enable/disable handler
- `GET /api/handlers/:id/stats` - Get execution statistics
- `GET /api/handlers/:id/executions` - Get execution history
- `POST /api/handlers/:id/test` - Test handler with payload

### Data Types

```typescript
interface WebhookHandler {
  id: string;
  name: string;
  provider: WebhookProvider;
  event_type: string;
  enabled: boolean;
  code: string;
  created_at: string;
  updated_at: string;
  last_execution?: string;
  execution_count: number;
  success_count: number;
  error_count: number;
}

type WebhookProvider =
  | 'github'
  | 'gitlab'
  | 'bitbucket'
  | 'slack'
  | 'discord'
  | 'custom';
```

## Usage Example

```tsx
import { Handlers } from './components/Handlers';

function App() {
  return (
    <div className="h-screen">
      <Handlers />
    </div>
  );
}
```

## Handler Code Template

The editor provides a default handler template:

```javascript
async function handler(payload, context) {
  // Access webhook data
  console.log('Received payload:', payload);

  // Access context information
  console.log('Handler context:', {
    handlerId: context.handlerId,
    provider: context.provider,
    eventType: context.eventType,
    timestamp: context.timestamp,
  });

  // TODO: Implement your handler logic here

  // Return result (optional)
  return {
    success: true,
    message: 'Handler executed successfully',
    processedAt: new Date().toISOString(),
  };
}

module.exports = handler;
```

## Features in Detail

### HandlersList Component

- **Grid/Table View**: Display handlers in cards or table format
- **Real-time Filtering**: Search by name, provider, or event type
- **Bulk Operations**: Enable/disable multiple handlers
- **Status Indicators**: Visual status badges for each handler
- **Quick Actions**: Test, edit, delete, and view stats

### HandlerEditor Component

- **Monaco Editor**: Full-featured code editor with:
  - Syntax highlighting for TypeScript/JavaScript
  - Auto-completion and IntelliSense
  - Error highlighting and validation
  - Code formatting and linting
- **Configuration Panel**: Handler settings and metadata
- **Live Testing**: Test handler code with sample payloads
- **Template System**: Provider-specific code templates

### HandlerStats Component

- **Execution Metrics**: Success rate, average duration, error counts
- **History Timeline**: Detailed execution history with status
- **Performance Charts**: Visual representation of handler performance
- **Error Analysis**: Detailed error messages and stack traces

## Customization

### Styling

The components use the Graphite Design System with Tailwind CSS:

```tsx
// Custom theme example
const customTheme = {
  colors: {
    primary: '#3B82F6',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
  },
};
```

### Provider Configuration

Add new webhook providers:

```typescript
const PROVIDER_EVENT_TYPES: Record<WebhookProvider, string[]> = {
  // Add new provider
  newProvider: ['event1', 'event2', 'event3'],
};

const PROVIDER_ICONS: Record<WebhookProvider, string> = {
  // Add provider icon
  newProvider: '🔧',
};
```

## Error Handling

### Error Boundary

All handler components are wrapped in an error boundary that:

- Catches component errors gracefully
- Provides recovery options (retry, reload)
- Shows detailed error information in development
- Logs errors for debugging

### API Error Handling

- Network errors are caught and displayed to users
- Retry mechanisms for failed requests
- Toast notifications for all operations
- Detailed error messages with actionable advice

## Performance Considerations

### Code Editor

- Monaco Editor is loaded asynchronously
- Syntax highlighting is optimized for performance
- Code validation runs with debouncing
- Large files are handled efficiently

### Data Management

- Handlers are cached locally after fetching
- Real-time updates via WebSocket (if available)
- Pagination for large handler lists
- Optimized re-rendering with React.memo

## Browser Support

- Chrome 88+
- Firefox 85+
- Safari 14+
- Edge 88+

## Dependencies

Core dependencies:

- `@monaco-editor/react` - Code editor
- `lucide-react` - Icons
- `react-toastify` - Notifications
- Design system components

## Contributing

When adding new features:

1. Follow the existing component patterns
2. Add proper TypeScript types
3. Include error handling and loading states
4. Add accessibility attributes
5. Test with different screen sizes
6. Update this documentation

## Testing

```bash
# Run component tests
npm test src/components/Handlers/

# Run integration tests
npm run test:integration

# Run accessibility tests
npm run test:a11y
```
