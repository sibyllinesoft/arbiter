# WebSocket Protocol Documentation

This document describes the WebSocket protocol used by Arbiter for real-time collaboration and analysis.

## Connection

Connect to the WebSocket endpoint:
```
ws://localhost:3001
```

The server will automatically send a hello message upon connection.

## Message Format

All messages are JSON objects with a `type` field that determines the message structure.

## Message Types

### Hello Messages

#### Client → Server: Hello
```json
{
  "type": "hello",
  "version": "1.0"
}
```

#### Server → Client: Hello Response
```json
{
  "type": "hello",
  "clientId": "client-abc123",
  "version": "1.0"
}
```

### Session Management

#### Client → Server: Join Project
Join a collaborative editing session for a specific project.

```json
{
  "type": "join",
  "projectId": "project-uuid",
  "user": {
    "id": "user-123",
    "name": "Alice",
    "color": "#ff0000"
  }
}
```

**Fields:**
- `projectId`: UUID of the project to join
- `user.id`: Unique identifier for the user
- `user.name`: Display name for the user
- `user.color`: Hex color for user's cursor/selection (format: `#RRGGBB`)

#### Server → Client: Join Confirmation
```json
{
  "type": "joined",
  "projectId": "project-uuid"
}
```

#### Server → Client: User Joined Notification
Sent to other users when someone joins the project.

```json
{
  "type": "user-joined",
  "user": {
    "id": "user-123",
    "name": "Alice",
    "color": "#ff0000"
  }
}
```

#### Client → Server: Leave Project
```json
{
  "type": "leave",
  "projectId": "project-uuid"
}
```

#### Server → Client: User Left Notification
```json
{
  "type": "user-left",
  "user": {
    "id": "user-123",
    "name": "Alice",
    "color": "#ff0000"
  }
}
```

### Presence (Cursor Tracking)

#### Client → Server: Cursor Position
Share cursor position with other users.

```json
{
  "type": "cursor",
  "projectId": "project-uuid",
  "position": {
    "line": 5,
    "column": 10,
    "selectionStart": {
      "line": 5,
      "column": 10
    },
    "selectionEnd": {
      "line": 5,
      "column": 20
    }
  }
}
```

**Fields:**
- `position.line`: Line number (1-based)
- `position.column`: Column number (1-based)
- `position.selectionStart`: Start of text selection (optional)
- `position.selectionEnd`: End of text selection (optional)

#### Server → Client: Cursor Update
Broadcast cursor position to other users.

```json
{
  "type": "cursor",
  "user": {
    "id": "user-123",
    "name": "Alice",
    "color": "#ff0000"
  },
  "position": {
    "line": 5,
    "column": 10,
    "selectionStart": {
      "line": 5,
      "column": 10
    },
    "selectionEnd": {
      "line": 5,
      "column": 20
    }
  }
}
```

### Document Synchronization (Y.js CRDT)

#### Client ↔ Server: Sync Update
Synchronize document changes using Y.js update format.

```json
{
  "type": "sync",
  "projectId": "project-uuid",
  "update": "base64-encoded-yjs-update"
}
```

**Fields:**
- `update`: Base64-encoded Y.js update containing document changes

**Note:** Y.js updates are also sent as binary messages over the WebSocket connection. The server will relay these binary updates to all connected clients in the same project.

### Analysis Requests

#### Client → Server: Request Analysis
Request CUE analysis of the current document.

```json
{
  "type": "analyze",
  "projectId": "project-uuid",
  "requestId": "analysis-123"
}
```

**Fields:**
- `requestId`: Unique identifier for tracking the analysis request

#### Server → Client: Analysis Result
Broadcast analysis results to all users in the project.

```json
{
  "type": "analysis",
  "requestId": "analysis-123",
  "errors": [
    {
      "message": "field not allowed",
      "line": 5,
      "column": 10,
      "filename": "doc.cue"
    }
  ],
  "value": {
    "name": "example",
    "version": "1.0.0"
  },
  "graph": [
    {
      "id": "name",
      "label": "name",
      "type": "value"
    },
    {
      "id": "version",
      "label": "version", 
      "type": "value"
    }
  ]
}
```

**Fields:**
- `errors`: Array of CUE validation errors
- `value`: Parsed CUE value (if no errors)
- `graph`: Simplified graph representation of the configuration structure

### Error Messages

#### Server → Client: Error
```json
{
  "type": "error",
  "message": "Invalid message format"
}
```

## Connection Lifecycle

1. **Connect**: Client establishes WebSocket connection
2. **Hello**: Server sends hello message with client ID
3. **Join**: Client joins a project session
4. **Collaborate**: Client sends/receives cursor updates, document changes, and analysis requests
5. **Leave**: Client leaves project (optional)
6. **Disconnect**: WebSocket connection is closed

## Security Considerations

- All input is validated using Zod schemas
- Project access is currently open (authentication to be added later)
- Document content is limited to 64KB per analysis request
- Rate limiting: 1 analysis request per second per client
- Temporary files are isolated and cleaned up after analysis

## Performance Notes

- Analysis requests have a 750ms timeout
- Large configurations (>200 nodes) are summarized in graph representation
- Y.js updates are persisted to SQLite for session recovery
- WebSocket connections are cleaned up automatically on disconnect

## Example Session

```javascript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:3001');

// Send hello
ws.send(JSON.stringify({
  type: 'hello',
  version: '1.0'
}));

// Join project
ws.send(JSON.stringify({
  type: 'join',
  projectId: 'my-project-id',
  user: {
    id: 'user-123',
    name: 'Alice',
    color: '#ff0000'
  }
}));

// Send cursor position
ws.send(JSON.stringify({
  type: 'cursor',
  projectId: 'my-project-id',
  position: {
    line: 1,
    column: 1
  }
}));

// Request analysis
ws.send(JSON.stringify({
  type: 'analyze',
  projectId: 'my-project-id',
  requestId: 'analysis-' + Date.now()
}));
```