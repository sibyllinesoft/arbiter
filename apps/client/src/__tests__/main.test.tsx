/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRender = vi.fn();
const createRootMock = vi.fn(() => ({ render: mockRender }));

vi.mock("react-dom/client", () => ({
  createRoot: createRootMock,
}));

vi.mock("../App", () => ({
  default: () => "App Component",
}));

vi.mock("../minimal.css", () => ({}));

describe("main entrypoint", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    createRootMock.mockImplementation(() => ({ render: mockRender }));
    document.body.innerHTML = '<div id="root"></div>';
  });

  it("mounts the React application into the root element", async () => {
    const { createRoot } = await import("react-dom/client");

    await import("../main");

    expect(createRoot).toHaveBeenCalledWith(document.getElementById("root"));
    expect(mockRender).toHaveBeenCalledOnce();
  });

  it("throws when the root element is missing", async () => {
    document.body.innerHTML = "";

    await expect(import("../main")).rejects.toThrow(/root/i);
  });

  it("propagates errors thrown by createRoot", async () => {
    createRootMock.mockImplementation(() => {
      throw new Error("Failed to create root");
    });

    await expect(import("../main")).rejects.toThrow("Failed to create root");
  });
});
