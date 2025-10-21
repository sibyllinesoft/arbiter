/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WsEvent } from "../../types/api";
import { LogLevel, logger } from "../../utils/logger";
import type { LocationService, TimerService, WebSocketFactory } from "../websocket";
import { createWebSocketService, wsService } from "../websocket";

// Enhanced Mock WebSocket
class MockWebSocket {
  public readyState: number = WebSocket.CONNECTING;
  public url: string;
  public onopen: ((event: Event) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onclose: ((event: CloseEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;

  private eventListeners: { [key: string]: ((event: any) => void)[] } = {};

  constructor(url: string) {
    this.url = url;
  }

  addEventListener(type: string, listener: (event: any) => void) {
    if (!this.eventListeners[type]) {
      this.eventListeners[type] = [];
    }
    this.eventListeners[type].push(listener);
  }

  removeEventListener(type: string, listener: (event: any) => void) {
    if (this.eventListeners[type]) {
      const index = this.eventListeners[type].indexOf(listener);
      if (index > -1) {
        this.eventListeners[type].splice(index, 1);
      }
    }
  }

  dispatchEvent(event: Event | MessageEvent | CloseEvent) {
    const listeners = this.eventListeners[event.type] || [];
    listeners.forEach((listener) => listener(event));

    // Also call the direct event handlers
    if (event.type === "open" && this.onopen) {
      this.onopen(event);
    } else if (event.type === "message" && this.onmessage && "data" in event) {
      this.onmessage(event as MessageEvent);
    } else if (event.type === "close" && this.onclose && "code" in event) {
      this.onclose(event as CloseEvent);
    } else if (event.type === "error" && this.onerror) {
      this.onerror(event);
    }
  }

  send(_data: string) {
    if (this.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not open");
    }
  }

  close(code?: number, reason?: string) {
    this.readyState = WebSocket.CLOSING;
    const closeEvent = new CloseEvent("close", { code: code || 1000, reason: reason || "" });
    setTimeout(() => {
      this.readyState = WebSocket.CLOSED;
      this.dispatchEvent(closeEvent);
    }, 10);
  }

  // Helper methods for tests
  simulateOpen() {
    this.readyState = WebSocket.OPEN;
    this.dispatchEvent(new Event("open"));
  }

  simulateMessage(data: any) {
    const messageEvent = new MessageEvent("message", { data: JSON.stringify(data) });
    this.dispatchEvent(messageEvent);
  }

  simulateError() {
    this.dispatchEvent(new Event("error"));
    // Trigger close event after error (this is what real WebSocket does)
    setTimeout(() => {
      this.readyState = WebSocket.CLOSED;
      this.dispatchEvent(new CloseEvent("close", { code: 1006, reason: "Connection failed" }));
    }, 5);
  }
}

// Set WebSocket constants
Object.assign(MockWebSocket, {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
});

// Set up global WebSocket
Object.assign(globalThis, {
  WebSocket: MockWebSocket,
});

describe("WebSocketService (Comprehensive)", () => {
  let mockTimerService: TimerService;
  let mockLocationService: LocationService;
  let mockWebSocketFactory: WebSocketFactory;
  let mockWebSocket: MockWebSocket;

  beforeEach(() => {
    vi.clearAllTimers();
    vi.useFakeTimers();

    // Create a new mock WebSocket instance for each test
    mockWebSocket = new MockWebSocket("wss://localhost:5050/api/ws?project_id=test-project");

    mockTimerService = {
      setTimeout: vi.fn().mockImplementation((callback: () => void, delay: number) => {
        return setTimeout(callback, delay) as unknown as number;
      }),
      setInterval: vi.fn().mockImplementation((callback: () => void, delay: number) => {
        return setInterval(callback, delay) as unknown as number;
      }),
      clearTimeout: vi.fn().mockImplementation((timerId: number) => clearTimeout(timerId)),
      clearInterval: vi.fn().mockImplementation((timerId: number) => clearInterval(timerId)),
    };

    mockLocationService = {
      protocol: "https:",
      host: "localhost:5050",
    };

    mockWebSocketFactory = {
      create: vi.fn().mockImplementation((url: string) => {
        mockWebSocket = new MockWebSocket(url);
        return mockWebSocket;
      }),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe("Service Creation and Configuration", () => {
    it("should create service with injected dependencies", () => {
      const service = createWebSocketService({
        timerService: mockTimerService,
        locationService: mockLocationService,
        webSocketFactory: mockWebSocketFactory,
      });

      expect(service).toBeDefined();
      expect(service.isConnected()).toBe(false);
      expect(service.getReconnectAttempts()).toBe(0);
    });

    it("should create service with custom options and dependencies", () => {
      const onConnect = vi.fn();
      const onDisconnect = vi.fn();
      const onError = vi.fn();

      const service = createWebSocketService({
        reconnectInterval: 1000,
        maxReconnectAttempts: 5,
        pingInterval: 10000,
        onConnect,
        onDisconnect,
        onError,
        timerService: mockTimerService,
        locationService: mockLocationService,
        webSocketFactory: mockWebSocketFactory,
      });

      expect(service).toBeDefined();
    });
  });

  describe("Connection Management", () => {
    it("should connect to WebSocket successfully", async () => {
      const onConnect = vi.fn();
      const service = createWebSocketService({
        onConnect,
        timerService: mockTimerService,
        locationService: mockLocationService,
        webSocketFactory: mockWebSocketFactory,
      });

      service.connect("test-project");

      expect(mockWebSocketFactory.create).toHaveBeenCalledWith(
        "wss://localhost:5050/ws?project_id=test-project",
      );
      expect(service.isConnected()).toBe(false); // Still connecting

      // Simulate connection opening
      mockWebSocket.simulateOpen();

      expect(service.isConnected()).toBe(true);
      expect(onConnect).toHaveBeenCalledOnce();
    });

    it("should not connect if already connected", () => {
      const service = createWebSocketService({
        timerService: mockTimerService,
        locationService: mockLocationService,
        webSocketFactory: mockWebSocketFactory,
      });

      service.connect("test-project");
      mockWebSocket.simulateOpen();

      const createSpy = vi.spyOn(mockWebSocketFactory, "create");
      createSpy.mockClear();

      // Try to connect again
      service.connect("test-project");

      expect(createSpy).not.toHaveBeenCalled();
    });

    it("should disconnect properly", () => {
      const onDisconnect = vi.fn();
      const service = createWebSocketService({
        onDisconnect,
        timerService: mockTimerService,
        locationService: mockLocationService,
        webSocketFactory: mockWebSocketFactory,
      });

      service.connect("test-project");
      mockWebSocket.simulateOpen();

      expect(service.isConnected()).toBe(true);

      service.disconnect();

      expect(service.isConnected()).toBe(false);
      expect(service.getReconnectAttempts()).toBe(0);
    });

    it("should handle connection errors", () => {
      const onError = vi.fn();
      const service = createWebSocketService({
        onError,
        timerService: mockTimerService,
        locationService: mockLocationService,
        webSocketFactory: mockWebSocketFactory,
      });

      service.connect("test-project");
      mockWebSocket.simulateError();

      expect(onError).toHaveBeenCalledOnce();
    });

    it("should handle WebSocket factory throwing error", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      mockWebSocketFactory.create = vi.fn().mockImplementation(() => {
        throw new Error("Failed to create WebSocket");
      });

      const service = createWebSocketService({
        reconnectInterval: 100,
        timerService: mockTimerService,
        locationService: mockLocationService,
        webSocketFactory: mockWebSocketFactory,
      });

      service.connect("test-project");

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to create WebSocket connection"),
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  describe("Message Handling", () => {
    let service: ReturnType<typeof createWebSocketService>;

    beforeEach(() => {
      service = createWebSocketService({
        timerService: mockTimerService,
        locationService: mockLocationService,
        webSocketFactory: mockWebSocketFactory,
      });
    });

    it("should send messages when connected", () => {
      service.connect("test-project");
      mockWebSocket.simulateOpen();

      const message = { type: "event" as const, data: { value: "hello" } };
      const sendSpy = vi.spyOn(mockWebSocket, "send");

      service.send(message);

      expect(sendSpy).toHaveBeenCalledWith(JSON.stringify(message));
    });

    it("should queue messages when not connected", () => {
      const previousLevel = logger.config.level;
      logger.setLevel(LogLevel.DEBUG);
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const message = { type: "event" as const, data: { value: "hello" } };
      service.send(message);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("WebSocket not connected"),
        message,
      );

      consoleSpy.mockRestore();
      logger.setLevel(previousLevel);
    });

    it("should send queued messages on connection", () => {
      const message1 = { type: "event" as const, data: { value: "hello1" } };
      const message2 = { type: "event" as const, data: { value: "hello2" } };

      // Send messages while disconnected
      service.send(message1);
      service.send(message2);

      // Connect
      service.connect("test-project");
      const sendSpy = vi.spyOn(mockWebSocket, "send");
      mockWebSocket.simulateOpen();

      expect(sendSpy).toHaveBeenCalledTimes(2);
      expect(sendSpy).toHaveBeenNthCalledWith(1, JSON.stringify(message1));
      expect(sendSpy).toHaveBeenNthCalledWith(2, JSON.stringify(message2));
    });

    it("should handle incoming event messages", () => {
      const handler = vi.fn();
      service.subscribe(handler);
      service.connect("test-project");
      mockWebSocket.simulateOpen();

      const wsEvent: WsEvent = {
        type: "fragment_updated",
        project_id: "test-project",
        timestamp: "2023-01-01T00:00:00Z",
        data: { fragment_id: "frag-1" } as any,
      };

      mockWebSocket.simulateMessage({
        type: "event",
        data: wsEvent,
      });

      expect(handler).toHaveBeenCalledWith(wsEvent);
    });

    it("should handle incoming error messages", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      service.connect("test-project");
      mockWebSocket.simulateOpen();

      mockWebSocket.simulateMessage({
        type: "error",
        data: { message: "Server error" },
      });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("WebSocket server error"), {
        message: "Server error",
      });

      consoleSpy.mockRestore();
    });

    it("should handle pong messages", () => {
      service.connect("test-project");
      mockWebSocket.simulateOpen();

      // Should not throw or cause errors
      expect(() => {
        mockWebSocket.simulateMessage({
          type: "pong",
          data: { timestamp: "2023-01-01T00:00:00Z" },
        });
      }).not.toThrow();
    });

    it("should handle unknown message types", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      service.connect("test-project");
      mockWebSocket.simulateOpen();

      mockWebSocket.simulateMessage({
        type: "unknown",
        data: {},
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Unknown WebSocket message type"),
        expect.objectContaining({ type: "unknown" }),
      );

      consoleSpy.mockRestore();
    });

    it("should handle invalid JSON messages", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      service.connect("test-project");
      mockWebSocket.simulateOpen();

      // Simulate invalid JSON by dispatching raw MessageEvent
      const invalidMessageEvent = new MessageEvent("message", {
        data: "invalid json",
      });
      mockWebSocket.dispatchEvent(invalidMessageEvent);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to parse WebSocket message"),
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });

    it("should validate event structure", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const handler = vi.fn();
      service.subscribe(handler);
      service.connect("test-project");
      mockWebSocket.simulateOpen();

      // Invalid event structure
      mockWebSocket.simulateMessage({
        type: "event",
        data: { type: "test" }, // Missing required fields
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Invalid WebSocket event structure"),
        expect.objectContaining({ type: "test" }),
      );
      expect(handler).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe("Event Subscription Management", () => {
    let service: ReturnType<typeof createWebSocketService>;

    beforeEach(() => {
      service = createWebSocketService({
        timerService: mockTimerService,
        locationService: mockLocationService,
        webSocketFactory: mockWebSocketFactory,
      });
    });

    it("should subscribe and unsubscribe event handlers", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const unsubscribe1 = service.subscribe(handler1);
      service.subscribe(handler2);

      service.connect("test-project");
      mockWebSocket.simulateOpen();

      const wsEvent: WsEvent = {
        type: "fragment_updated",
        project_id: "test-project",
        timestamp: "2023-01-01T00:00:00Z",
        data: { fragment_id: "frag-1" } as any,
      };

      mockWebSocket.simulateMessage({
        type: "event",
        data: wsEvent,
      });

      expect(handler1).toHaveBeenCalledWith(wsEvent);
      expect(handler2).toHaveBeenCalledWith(wsEvent);

      // Unsubscribe handler1
      unsubscribe1();

      // Send another event
      mockWebSocket.simulateMessage({
        type: "event",
        data: wsEvent,
      });

      expect(handler1).toHaveBeenCalledTimes(1); // Still only called once
      expect(handler2).toHaveBeenCalledTimes(2); // Called twice
    });

    it("should handle errors in event handlers", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const errorHandler = vi.fn().mockImplementation(() => {
        throw new Error("Handler error");
      });
      const goodHandler = vi.fn();

      service.subscribe(errorHandler);
      service.subscribe(goodHandler);

      service.connect("test-project");
      mockWebSocket.simulateOpen();

      const wsEvent: WsEvent = {
        type: "fragment_updated",
        project_id: "test-project",
        timestamp: "2023-01-01T00:00:00Z",
        data: { fragment_id: "frag-1" } as any,
      };

      mockWebSocket.simulateMessage({
        type: "event",
        data: wsEvent,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error in WebSocket event handler"),
        expect.any(Error),
      );
      expect(goodHandler).toHaveBeenCalledWith(wsEvent);

      consoleSpy.mockRestore();
    });
  });

  describe("Reconnection Logic", () => {
    it("should attempt reconnection on unexpected close", async () => {
      const onReconnect = vi.fn();
      const service = createWebSocketService({
        reconnectInterval: 100,
        maxReconnectAttempts: 3,
        onReconnect,
        timerService: mockTimerService,
        locationService: mockLocationService,
        webSocketFactory: mockWebSocketFactory,
      });

      service.connect("test-project");
      mockWebSocket.simulateOpen();

      // Simulate unexpected close
      const closeEvent = new CloseEvent("close", { code: 1001, reason: "Server restart" });
      mockWebSocket.dispatchEvent(closeEvent);

      // The reconnect attempt count is incremented when the close is handled
      expect(service.getReconnectAttempts()).toBe(1);

      // Advance time to trigger reconnection
      await vi.advanceTimersByTimeAsync(100);

      expect(onReconnect).toHaveBeenCalledWith(1);
    });

    it("should not reconnect on manual disconnect", async () => {
      const service = createWebSocketService({
        reconnectInterval: 100,
        maxReconnectAttempts: 3,
        timerService: mockTimerService,
        locationService: mockLocationService,
        webSocketFactory: mockWebSocketFactory,
      });

      service.connect("test-project");
      mockWebSocket.simulateOpen();

      // Manual disconnect
      service.disconnect();

      // Should not attempt reconnection
      await vi.advanceTimersByTimeAsync(200);
      expect(service.getReconnectAttempts()).toBe(0);
    });

    it("should not reconnect on normal close (code 1000)", async () => {
      const service = createWebSocketService({
        reconnectInterval: 100,
        maxReconnectAttempts: 3,
        timerService: mockTimerService,
        locationService: mockLocationService,
        webSocketFactory: mockWebSocketFactory,
      });

      service.connect("test-project");
      mockWebSocket.simulateOpen();

      // Normal close
      const closeEvent = new CloseEvent("close", { code: 1000, reason: "Normal closure" });
      mockWebSocket.dispatchEvent(closeEvent);

      // Should not attempt reconnection
      await vi.advanceTimersByTimeAsync(200);
      expect(service.getReconnectAttempts()).toBe(0);
    });

    it("should stop reconnecting after max attempts", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Create a factory that will cause immediate failures
      const failingFactory: WebSocketFactory = {
        create: vi.fn().mockImplementation((url) => {
          const failedWs = new MockWebSocket(url);
          // Make it fail immediately
          setTimeout(() => failedWs.simulateError(), 5);
          return failedWs;
        }),
      };

      const service = createWebSocketService({
        reconnectInterval: 50,
        maxReconnectAttempts: 2,
        timerService: mockTimerService,
        locationService: mockLocationService,
        webSocketFactory: failingFactory,
      });

      // Start the cycle of failures
      service.connect("test-project");

      // Wait for initial failure and all reconnection attempts
      // Need to wait for: initial failure (10ms) + reconnect 1 (50ms + 10ms) + reconnect 2 (50ms + 10ms) + buffer
      await vi.advanceTimersByTimeAsync(300);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Max reconnect attempts reached"),
      );

      consoleSpy.mockRestore();
    });

    it("should handle reconnection without stored URL", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const service = createWebSocketService({
        reconnectInterval: 100,
        timerService: mockTimerService,
        locationService: mockLocationService,
        webSocketFactory: mockWebSocketFactory,
      });

      // Try to reconnect without ever connecting
      (service as any).reconnect();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Cannot reconnect: no previous URL available"),
      );

      consoleSpy.mockRestore();
    });
  });

  describe("Ping/Pong Mechanism", () => {
    it("should start ping interval on connection", () => {
      const service = createWebSocketService({
        pingInterval: 1000,
        timerService: mockTimerService,
        locationService: mockLocationService,
        webSocketFactory: mockWebSocketFactory,
      });

      service.connect("test-project");
      mockWebSocket.simulateOpen();

      expect(mockTimerService.setInterval).toHaveBeenCalledWith(expect.any(Function), 1000);
    });

    it("should send ping messages at intervals", () => {
      const service = createWebSocketService({
        pingInterval: 1000,
        timerService: mockTimerService,
        locationService: mockLocationService,
        webSocketFactory: mockWebSocketFactory,
      });

      service.connect("test-project");
      mockWebSocket.simulateOpen();
      const sendSpy = vi.spyOn(mockWebSocket, "send");

      // Advance time to trigger ping
      vi.advanceTimersByTime(1000);

      expect(sendSpy).toHaveBeenCalledWith(expect.stringContaining('"type":"ping"'));
    });

    it("should stop ping interval on disconnect", () => {
      const service = createWebSocketService({
        pingInterval: 1000,
        timerService: mockTimerService,
        locationService: mockLocationService,
        webSocketFactory: mockWebSocketFactory,
      });

      service.connect("test-project");
      mockWebSocket.simulateOpen();

      service.disconnect();

      expect(mockTimerService.clearInterval).toHaveBeenCalled();
    });
  });

  describe("State Management", () => {
    it("should track connection state correctly", () => {
      const service = createWebSocketService({
        timerService: mockTimerService,
        locationService: mockLocationService,
        webSocketFactory: mockWebSocketFactory,
      });

      expect(service.isConnected()).toBe(false);
      expect(service.getReconnectAttempts()).toBe(0);

      service.connect("test-project");
      expect(service.isConnected()).toBe(false); // Still connecting

      mockWebSocket.simulateOpen();
      expect(service.isConnected()).toBe(true); // Now connected

      service.disconnect();
      expect(service.isConnected()).toBe(false); // Disconnected
    });

    it("should reset reconnect attempts on successful connection", () => {
      const service = createWebSocketService({
        timerService: mockTimerService,
        locationService: mockLocationService,
        webSocketFactory: mockWebSocketFactory,
      });

      // Simulate a scenario with failed reconnection attempts
      (service as any).reconnectAttempts = 3;

      service.connect("test-project");
      mockWebSocket.simulateOpen();

      expect(service.getReconnectAttempts()).toBe(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle WebSocket send throwing error", () => {
      const service = createWebSocketService({
        timerService: mockTimerService,
        locationService: mockLocationService,
        webSocketFactory: mockWebSocketFactory,
      });

      service.connect("test-project");
      mockWebSocket.simulateOpen();

      // Mock send to throw error
      vi.spyOn(mockWebSocket, "send").mockImplementation(() => {
        throw new Error("Send failed");
      });

      expect(() => {
        service.send({ type: "event" as const, data: {} });
      }).toThrow("Send failed");
    });

    it("should handle timer service failures gracefully", () => {
      const faultyTimerService: TimerService = {
        setTimeout: vi.fn().mockImplementation(() => {
          throw new Error("Timer failed");
        }),
        setInterval: vi.fn(),
        clearTimeout: vi.fn(),
        clearInterval: vi.fn(),
      };

      expect(() => {
        createWebSocketService({
          timerService: faultyTimerService,
          locationService: mockLocationService,
          webSocketFactory: mockWebSocketFactory,
        });
      }).not.toThrow();
    });
  });
});

describe("wsService singleton", () => {
  it("should export a singleton instance", () => {
    expect(wsService).toBeDefined();
    expect(typeof wsService.connect).toBe("function");
    expect(typeof wsService.disconnect).toBe("function");
    expect(typeof wsService.send).toBe("function");
    expect(typeof wsService.subscribe).toBe("function");
  });
});

describe("createWebSocketService factory", () => {
  it("should create new instances", () => {
    const service1 = createWebSocketService();
    const service2 = createWebSocketService();

    expect(service1).not.toBe(service2);
    expect(service1).not.toBe(wsService);
  });
});
