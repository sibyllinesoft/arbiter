/**
 * Unit tests for WebSocket protocol handling
 * Tests the WebSocket message routing and connection management
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { wsMessageSchema, type WSMessage } from './test-types';

// Mock WebSocket connection for testing
class MockWebSocket {
  public readyState: number = 1; // OPEN
  public sentMessages: string[] = [];
  public clientData: any = {};

  send(data: string) {
    this.sentMessages.push(data);
  }

  getLastMessage() {
    return this.sentMessages[this.sentMessages.length - 1];
  }

  getAllMessages() {
    return [...this.sentMessages];
  }

  close() {
    this.readyState = 3; // CLOSED
  }
}

// Mock connection management
interface WSConnection {
  ws: MockWebSocket;
  clientId: string;
  projectId?: string;
  user?: {
    id: string;
    name: string;
    color: string;
  };
}

class WebSocketConnectionManager {
  private connections = new Map<MockWebSocket, WSConnection>();
  private projectConnections = new Map<string, Set<WSConnection>>();

  addConnection(ws: MockWebSocket, clientId: string): WSConnection {
    const connection: WSConnection = {
      ws,
      clientId,
    };
    this.connections.set(ws, connection);
    return connection;
  }

  getConnection(ws: MockWebSocket): WSConnection | undefined {
    return this.connections.get(ws);
  }

  removeConnection(ws: MockWebSocket) {
    const connection = this.connections.get(ws);
    if (!connection) return;

    // Remove from project connections
    if (connection.projectId) {
      const projectConns = this.projectConnections.get(connection.projectId);
      if (projectConns) {
        projectConns.delete(connection);
        if (projectConns.size === 0) {
          this.projectConnections.delete(connection.projectId);
        }
      }
    }

    this.connections.delete(ws);
  }

  joinProject(ws: MockWebSocket, projectId: string, user: any): boolean {
    const connection = this.connections.get(ws);
    if (!connection) return false;

    // Leave previous project if any
    if (connection.projectId) {
      this.leaveProject(ws, connection.projectId);
    }

    // Join new project
    connection.projectId = projectId;
    connection.user = user;

    let projectConns = this.projectConnections.get(projectId);
    if (!projectConns) {
      projectConns = new Set();
      this.projectConnections.set(projectId, projectConns);
    }
    projectConns.add(connection);

    return true;
  }

  leaveProject(ws: MockWebSocket, projectId: string): boolean {
    const connection = this.connections.get(ws);
    if (!connection || connection.projectId !== projectId) return false;

    const projectConns = this.projectConnections.get(projectId);
    if (projectConns) {
      projectConns.delete(connection);
      if (projectConns.size === 0) {
        this.projectConnections.delete(projectId);
      }
    }

    connection.projectId = undefined;
    connection.user = undefined;
    return true;
  }

  broadcastToProject(projectId: string, message: any, excludeWs?: MockWebSocket): void {
    const projectConns = this.projectConnections.get(projectId);
    if (!projectConns) return;

    const messageStr = JSON.stringify(message);
    for (const conn of projectConns) {
      if (conn.ws !== excludeWs && conn.ws.readyState === 1) {
        conn.ws.send(messageStr);
      }
    }
  }

  getProjectConnections(projectId: string): WSConnection[] {
    const conns = this.projectConnections.get(projectId);
    return conns ? Array.from(conns) : [];
  }

  getTotalConnections(): number {
    return this.connections.size;
  }

  getAllProjects(): string[] {
    return Array.from(this.projectConnections.keys());
  }
}

describe('WebSocket Protocol', () => {
  let connectionManager: WebSocketConnectionManager;

  beforeEach(() => {
    connectionManager = new WebSocketConnectionManager();
  });

  describe('Message schema validation', () => {
    test('should validate hello message', () => {
      const message = { type: 'hello' };
      expect(() => wsMessageSchema.parse(message)).not.toThrow();
    });

    test('should validate join message', () => {
      const message = {
        type: 'join',
        projectId: 'project-123',
        user: {
          id: 'user-456',
          name: 'John Doe',
          color: '#ff0000',
        },
      };
      expect(() => wsMessageSchema.parse(message)).not.toThrow();
    });

    test('should validate leave message', () => {
      const message = {
        type: 'leave',
        projectId: 'project-123',
      };
      expect(() => wsMessageSchema.parse(message)).not.toThrow();
    });

    test('should validate cursor message', () => {
      const message = {
        type: 'cursor',
        projectId: 'project-123',
        position: {
          line: 5,
          column: 10,
        },
      };
      expect(() => wsMessageSchema.parse(message)).not.toThrow();
    });

    test('should validate sync message', () => {
      const message = {
        type: 'sync',
        projectId: 'project-123',
        update: 'base64-encoded-yjs-update',
      };
      expect(() => wsMessageSchema.parse(message)).not.toThrow();
    });

    test('should validate analyze message', () => {
      const message = {
        type: 'analyze',
        projectId: 'project-123',
        requestId: 'analyze-456',
      };
      expect(() => wsMessageSchema.parse(message)).not.toThrow();
    });

    test('should reject invalid message types', () => {
      const message = { type: 'invalid-type' };
      expect(() => wsMessageSchema.parse(message)).toThrow();
    });

    test('should reject messages with missing required fields', () => {
      const incompleteJoin = {
        type: 'join',
        projectId: 'project-123',
        // Missing user field
      };
      expect(() => wsMessageSchema.parse(incompleteJoin)).toThrow();
    });
  });

  describe('Connection management', () => {
    test('should add and track new connections', () => {
      const ws = new MockWebSocket();
      const connection = connectionManager.addConnection(ws, 'client-123');

      expect(connection.clientId).toBe('client-123');
      expect(connection.ws).toBe(ws);
      expect(connectionManager.getTotalConnections()).toBe(1);
    });

    test('should retrieve connections by websocket', () => {
      const ws = new MockWebSocket();
      connectionManager.addConnection(ws, 'client-123');

      const retrieved = connectionManager.getConnection(ws);
      expect(retrieved?.clientId).toBe('client-123');
    });

    test('should remove connections', () => {
      const ws = new MockWebSocket();
      connectionManager.addConnection(ws, 'client-123');

      expect(connectionManager.getTotalConnections()).toBe(1);

      connectionManager.removeConnection(ws);
      expect(connectionManager.getTotalConnections()).toBe(0);
      expect(connectionManager.getConnection(ws)).toBeUndefined();
    });

    test('should handle multiple connections', () => {
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();

      connectionManager.addConnection(ws1, 'client-1');
      connectionManager.addConnection(ws2, 'client-2');

      expect(connectionManager.getTotalConnections()).toBe(2);

      const conn1 = connectionManager.getConnection(ws1);
      const conn2 = connectionManager.getConnection(ws2);

      expect(conn1?.clientId).toBe('client-1');
      expect(conn2?.clientId).toBe('client-2');
    });
  });

  describe('Project joining and leaving', () => {
    test('should allow connection to join project', () => {
      const ws = new MockWebSocket();
      const connection = connectionManager.addConnection(ws, 'client-123');

      const user = {
        id: 'user-456',
        name: 'John Doe',
        color: '#ff0000',
      };

      const success = connectionManager.joinProject(ws, 'project-789', user);

      expect(success).toBe(true);
      expect(connection.projectId).toBe('project-789');
      expect(connection.user).toEqual(user);

      const projectConns = connectionManager.getProjectConnections('project-789');
      expect(projectConns).toHaveLength(1);
      expect(projectConns[0]).toBe(connection);
    });

    test('should allow connection to leave project', () => {
      const ws = new MockWebSocket();
      connectionManager.addConnection(ws, 'client-123');

      const user = { id: 'user-456', name: 'John Doe', color: '#ff0000' };
      connectionManager.joinProject(ws, 'project-789', user);

      const success = connectionManager.leaveProject(ws, 'project-789');

      expect(success).toBe(true);

      const connection = connectionManager.getConnection(ws);
      expect(connection?.projectId).toBeUndefined();
      expect(connection?.user).toBeUndefined();

      const projectConns = connectionManager.getProjectConnections('project-789');
      expect(projectConns).toHaveLength(0);
    });

    test('should handle switching between projects', () => {
      const ws = new MockWebSocket();
      connectionManager.addConnection(ws, 'client-123');

      const user = { id: 'user-456', name: 'John Doe', color: '#ff0000' };

      // Join first project
      connectionManager.joinProject(ws, 'project-1', user);
      expect(connectionManager.getProjectConnections('project-1')).toHaveLength(1);

      // Join second project (should leave first automatically)
      connectionManager.joinProject(ws, 'project-2', user);
      expect(connectionManager.getProjectConnections('project-1')).toHaveLength(0);
      expect(connectionManager.getProjectConnections('project-2')).toHaveLength(1);

      const connection = connectionManager.getConnection(ws);
      expect(connection?.projectId).toBe('project-2');
    });

    test('should clean up empty projects', () => {
      const ws = new MockWebSocket();
      connectionManager.addConnection(ws, 'client-123');

      const user = { id: 'user-456', name: 'John Doe', color: '#ff0000' };
      connectionManager.joinProject(ws, 'project-789', user);

      expect(connectionManager.getAllProjects()).toContain('project-789');

      connectionManager.leaveProject(ws, 'project-789');

      expect(connectionManager.getAllProjects()).not.toContain('project-789');
    });

    test('should handle multiple users in same project', () => {
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();

      connectionManager.addConnection(ws1, 'client-1');
      connectionManager.addConnection(ws2, 'client-2');

      const user1 = { id: 'user-1', name: 'Alice', color: '#ff0000' };
      const user2 = { id: 'user-2', name: 'Bob', color: '#00ff00' };

      connectionManager.joinProject(ws1, 'project-collab', user1);
      connectionManager.joinProject(ws2, 'project-collab', user2);

      const projectConns = connectionManager.getProjectConnections('project-collab');
      expect(projectConns).toHaveLength(2);

      const userNames = projectConns.map(conn => conn.user?.name);
      expect(userNames).toContain('Alice');
      expect(userNames).toContain('Bob');
    });
  });

  describe('Message broadcasting', () => {
    test('should broadcast message to all users in project', () => {
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();
      const ws3 = new MockWebSocket(); // Different project

      connectionManager.addConnection(ws1, 'client-1');
      connectionManager.addConnection(ws2, 'client-2');
      connectionManager.addConnection(ws3, 'client-3');

      const user1 = { id: 'user-1', name: 'Alice', color: '#ff0000' };
      const user2 = { id: 'user-2', name: 'Bob', color: '#00ff00' };
      const user3 = { id: 'user-3', name: 'Charlie', color: '#0000ff' };

      connectionManager.joinProject(ws1, 'project-1', user1);
      connectionManager.joinProject(ws2, 'project-1', user2);
      connectionManager.joinProject(ws3, 'project-2', user3);

      const message = {
        type: 'cursor',
        user: user1,
        position: { line: 5, column: 10 },
      };

      connectionManager.broadcastToProject('project-1', message);

      // ws1 and ws2 should receive the message (in project-1)
      expect(ws1.sentMessages).toHaveLength(1);
      expect(ws2.sentMessages).toHaveLength(1);
      
      // ws3 should not receive the message (in different project)
      expect(ws3.sentMessages).toHaveLength(0);

      const receivedMessage = JSON.parse(ws1.getLastMessage());
      expect(receivedMessage).toEqual(message);
    });

    test('should exclude sender from broadcast', () => {
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();

      connectionManager.addConnection(ws1, 'client-1');
      connectionManager.addConnection(ws2, 'client-2');

      const user1 = { id: 'user-1', name: 'Alice', color: '#ff0000' };
      const user2 = { id: 'user-2', name: 'Bob', color: '#00ff00' };

      connectionManager.joinProject(ws1, 'project-1', user1);
      connectionManager.joinProject(ws2, 'project-1', user2);

      const message = { type: 'cursor', position: { line: 5, column: 10 } };

      connectionManager.broadcastToProject('project-1', message, ws1);

      // ws1 (sender) should not receive the message
      expect(ws1.sentMessages).toHaveLength(0);
      
      // ws2 should receive the message
      expect(ws2.sentMessages).toHaveLength(1);
    });

    test('should not send to closed connections', () => {
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();

      connectionManager.addConnection(ws1, 'client-1');
      connectionManager.addConnection(ws2, 'client-2');

      const user1 = { id: 'user-1', name: 'Alice', color: '#ff0000' };
      const user2 = { id: 'user-2', name: 'Bob', color: '#00ff00' };

      connectionManager.joinProject(ws1, 'project-1', user1);
      connectionManager.joinProject(ws2, 'project-1', user2);

      // Close one connection
      ws2.close();

      const message = { type: 'cursor', position: { line: 5, column: 10 } };
      connectionManager.broadcastToProject('project-1', message);

      // Only ws1 should receive the message (ws2 is closed)
      expect(ws1.sentMessages).toHaveLength(1);
      expect(ws2.sentMessages).toHaveLength(0);
    });

    test('should handle broadcasting to empty project', () => {
      const message = { type: 'cursor', position: { line: 5, column: 10 } };
      
      // Should not throw when broadcasting to non-existent project
      expect(() => {
        connectionManager.broadcastToProject('non-existent-project', message);
      }).not.toThrow();
    });
  });

  describe('Connection cleanup', () => {
    test('should clean up project connections when connection is removed', () => {
      const ws = new MockWebSocket();
      connectionManager.addConnection(ws, 'client-123');

      const user = { id: 'user-456', name: 'John Doe', color: '#ff0000' };
      connectionManager.joinProject(ws, 'project-789', user);

      expect(connectionManager.getProjectConnections('project-789')).toHaveLength(1);

      connectionManager.removeConnection(ws);

      expect(connectionManager.getProjectConnections('project-789')).toHaveLength(0);
      expect(connectionManager.getAllProjects()).not.toContain('project-789');
    });

    test('should handle removing non-existent connection', () => {
      const ws = new MockWebSocket();
      
      expect(() => {
        connectionManager.removeConnection(ws);
      }).not.toThrow();
    });
  });

  describe('Message handling scenarios', () => {
    test('should handle user joining and leaving notifications', () => {
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();

      connectionManager.addConnection(ws1, 'client-1');
      connectionManager.addConnection(ws2, 'client-2');

      const user1 = { id: 'user-1', name: 'Alice', color: '#ff0000' };
      const user2 = { id: 'user-2', name: 'Bob', color: '#00ff00' };

      // First user joins
      connectionManager.joinProject(ws1, 'project-1', user1);

      // Second user joins - should notify first user
      connectionManager.joinProject(ws2, 'project-1', user2);
      
      const userJoinedMessage = {
        type: 'user-joined',
        user: user2,
      };
      connectionManager.broadcastToProject('project-1', userJoinedMessage, ws2);

      expect(ws1.sentMessages).toHaveLength(1);
      const receivedMessage = JSON.parse(ws1.getLastMessage());
      expect(receivedMessage.type).toBe('user-joined');
      expect(receivedMessage.user.name).toBe('Bob');
    });

    test('should handle cursor position updates', () => {
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();

      connectionManager.addConnection(ws1, 'client-1');
      connectionManager.addConnection(ws2, 'client-2');

      const user1 = { id: 'user-1', name: 'Alice', color: '#ff0000' };
      const user2 = { id: 'user-2', name: 'Bob', color: '#00ff00' };

      connectionManager.joinProject(ws1, 'project-1', user1);
      connectionManager.joinProject(ws2, 'project-1', user2);

      const cursorMessage = {
        type: 'cursor',
        user: user1,
        position: { line: 10, column: 5 },
      };

      connectionManager.broadcastToProject('project-1', cursorMessage, ws1);

      expect(ws2.sentMessages).toHaveLength(1);
      const receivedMessage = JSON.parse(ws2.getLastMessage());
      expect(receivedMessage.type).toBe('cursor');
      expect(receivedMessage.position).toEqual({ line: 10, column: 5 });
    });

    test('should handle Y.js sync messages', () => {
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();

      connectionManager.addConnection(ws1, 'client-1');
      connectionManager.addConnection(ws2, 'client-2');

      const user1 = { id: 'user-1', name: 'Alice', color: '#ff0000' };
      const user2 = { id: 'user-2', name: 'Bob', color: '#00ff00' };

      connectionManager.joinProject(ws1, 'project-1', user1);
      connectionManager.joinProject(ws2, 'project-1', user2);

      const syncMessage = {
        type: 'sync',
        projectId: 'project-1',
        update: 'base64-encoded-yjs-update-data',
      };

      connectionManager.broadcastToProject('project-1', syncMessage, ws1);

      expect(ws2.sentMessages).toHaveLength(1);
      const receivedMessage = JSON.parse(ws2.getLastMessage());
      expect(receivedMessage.type).toBe('sync');
      expect(receivedMessage.update).toBe('base64-encoded-yjs-update-data');
    });
  });

  describe('Edge cases and error handling', () => {
    test('should handle invalid WebSocket states', () => {
      const ws = new MockWebSocket();
      ws.readyState = 3; // CLOSED

      connectionManager.addConnection(ws, 'client-1');
      
      const message = { type: 'test' };
      
      // Should not send to closed connection
      expect(() => {
        connectionManager.broadcastToProject('project-1', message);
      }).not.toThrow();
    });

    test('should handle leaving project that user never joined', () => {
      const ws = new MockWebSocket();
      connectionManager.addConnection(ws, 'client-1');

      const success = connectionManager.leaveProject(ws, 'never-joined-project');
      expect(success).toBe(false);
    });

    test('should handle joining project with non-existent connection', () => {
      const ws = new MockWebSocket();
      // Don't add to connection manager

      const user = { id: 'user-1', name: 'Alice', color: '#ff0000' };
      const success = connectionManager.joinProject(ws, 'project-1', user);
      
      expect(success).toBe(false);
    });
  });
});