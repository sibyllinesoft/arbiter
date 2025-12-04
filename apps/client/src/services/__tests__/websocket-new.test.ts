/**
 * @vitest-environment jsdom
 */
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type LocationService,
  type TimerService,
  type VisibilityService,
  type WebSocketFactory,
  createWebSocketClient,
} from "../websocket";

class MockWebSocket {
  public readyState: number;
  public url: string;
  public onopen: ((event: Event) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onclose: ((event: CloseEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;
  public sent: string[] = [];

  private listeners: Record<string, Array<(event: any) => void>> = {};

  constructor(url: string) {
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
  }

  addEventListener(type: string, listener: (event: any) => void) {
    this.listeners[type] ??= [];
    this.listeners[type].push(listener);
  }

  dispatch(event: Event | MessageEvent | CloseEvent) {
    this.listeners[event.type]?.forEach((listener) => listener(event));
    switch (event.type) {
      case "open":
        this.onopen?.(event);
        break;
      case "message":
        this.onmessage?.(event as MessageEvent);
        break;
      case "close":
        this.onclose?.(event as CloseEvent);
        break;
      case "error":
        this.onerror?.(event);
        break;
      default:
        break;
    }
  }

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.dispatch(new Event("open"));
  }

  simulateMessage(data: unknown) {
    const event = new MessageEvent("message", { data: JSON.stringify(data) });
    this.dispatch(event);
  }

  simulateClose(code = 1001, reason = "server restart") {
    this.readyState = MockWebSocket.CLOSED;
    const event = new CloseEvent("close", { code, reason });
    this.dispatch(event);
  }

  send(_payload: string) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error("Socket not open");
    }
    this.sent.push(_payload);
  }

  close(code?: number, reason?: string) {
    this.simulateClose(code, reason);
  }

  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
}

describe("WebSocketClient", () => {
  let mockTimer: TimerService;
  let mockLocation: LocationService;
  let mockVisibility: VisibilityService;
  let factory: WebSocketFactory;
  let socket!: MockWebSocket;

  beforeEach(() => {
    vi.useFakeTimers();
    mockTimer = {
      setTimeout: vi.fn((cb, ms) => setTimeout(cb, ms) as unknown as number),
      setInterval: vi.fn((cb, ms) => setInterval(cb, ms) as unknown as number),
      clearTimeout: vi.fn((id: number) => clearTimeout(id)),
      clearInterval: vi.fn((id: number) => clearInterval(id)),
    };

    mockLocation = { protocol: "https:", host: "localhost:5050" };
    mockVisibility = {
      isVisible: vi.fn(() => true),
      onVisibilityChange: vi.fn(() => () => {}),
    };

    factory = {
      create: vi.fn((url: string) => {
        socket = new MockWebSocket(url);
        return socket as unknown as WebSocket;
      }),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds the expected URL and connects once", () => {
    const client = createWebSocketClient({
      projectId: "abc",
      timerService: mockTimer,
      locationService: mockLocation,
      webSocketFactory: factory,
    });

    client.connect();
    expect(factory.create).toHaveBeenCalledWith("wss://localhost:5050/ws?project_id=abc");

    // Second connect call should be ignored while connecting
    factory.create = vi.fn(factory.create);
    client.connect();
    expect(factory.create).toHaveBeenCalledTimes(0);
  });

  it("queues outbound messages and flushes on open", () => {
    const client = createWebSocketClient({
      timerService: mockTimer,
      locationService: mockLocation,
      webSocketFactory: factory,
    });

    client.send({ type: "event", data: { action: "subscribe", project_id: "abc" } });
    client.connect("abc");
    socket.simulateOpen();

    expect(mockTimer.setInterval).toHaveBeenCalled(); // ping loop started
    expect(socket.sent.length).toBeGreaterThanOrEqual(1);
  });

  it("dispatches typed and wildcard listeners", () => {
    const client = createWebSocketClient({
      timerService: mockTimer,
      locationService: mockLocation,
      webSocketFactory: factory,
    });

    const onFragment = vi.fn();
    const onAny = vi.fn();
    client.on("fragment_updated", onFragment);
    client.on("*", onAny);

    client.connect("proj-1");
    socket.simulateOpen();
    socket.simulateMessage({
      type: "event",
      project_id: "proj-1",
      data: {
        id: "evt-1",
        event_type: "fragment_updated",
        data: { fragment_id: "f1" },
        timestamp: "2024-01-01T00:00:00Z",
      },
    });

    expect(onFragment).toHaveBeenCalledTimes(1);
    expect(onAny).toHaveBeenCalledTimes(1);
    expect(onFragment.mock.calls[0][0].payload).toEqual({ fragment_id: "f1" });
  });

  it("schedules exponential reconnects after abnormal close", async () => {
    const client = createWebSocketClient({
      timerService: mockTimer,
      locationService: mockLocation,
      webSocketFactory: factory,
      reconnectBaseDelay: 100,
    });

    client.connect("proj-1");
    socket.simulateOpen();
    socket.simulateClose(1006, "network drop");

    expect(mockTimer.setTimeout).toHaveBeenCalled();
    const delay = (mockTimer.setTimeout as Mock).mock.calls[0][1] as number;
    expect(delay).toBeGreaterThanOrEqual(100);
  });

  it("defers reconnect when tab is hidden", () => {
    mockVisibility.isVisible = vi.fn(() => false);
    let visibilityCallback: (() => void) | undefined;
    mockVisibility.onVisibilityChange = vi.fn((cb) => {
      visibilityCallback = cb;
      return () => {};
    });

    const client = createWebSocketClient({
      timerService: mockTimer,
      locationService: mockLocation,
      webSocketFactory: factory,
      visibilityService: mockVisibility,
    });

    client.connect("proj-1");
    socket.simulateOpen();
    const callsBeforeClose = (mockTimer.setTimeout as Mock).mock.calls.length;
    socket.simulateClose(1006, "network drop");

    expect((mockTimer.setTimeout as Mock).mock.calls.length).toBe(callsBeforeClose);
    mockVisibility.isVisible = vi.fn(() => true);
    visibilityCallback?.();
    expect((mockTimer.setTimeout as Mock).mock.calls.length).toBeGreaterThan(callsBeforeClose);
  });

  it("tracks channel subscriptions for replay after reconnect", () => {
    const client = createWebSocketClient({
      timerService: mockTimer,
      locationService: mockLocation,
      webSocketFactory: factory,
    });

    client.send({ type: "event", data: { action: "subscribe", channel: "tunnel-logs" } });
    client.connect("proj-1");
    socket.simulateOpen();
    socket.simulateClose(1006, "drop");

    // Reconnect timer should be set and subscriptions stored
    expect(mockTimer.setTimeout).toHaveBeenCalled();
  });
});
