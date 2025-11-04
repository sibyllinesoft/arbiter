/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "react-toastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiService } from "../../services/api";
import type { WebhookHandler } from "../../types/api";
import HandlersList from "./HandlersList";

vi.mock("../../services/api", () => ({
  apiService: {
    getHandlers: vi.fn(),
    toggleHandler: vi.fn(),
    deleteHandler: vi.fn(),
  },
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockHandlers: WebhookHandler[] = [
  {
    id: "1",
    name: "GitHub Push Handler",
    provider: "github",
    event_type: "push",
    enabled: true,
    code: "function handler() {}",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    execution_count: 10,
    success_count: 8,
    error_count: 2,
    last_execution: "2024-01-01T12:00:00Z",
  },
  {
    id: "2",
    name: "Slack Message Handler",
    provider: "slack",
    event_type: "message",
    enabled: false,
    code: "function handler() {}",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    execution_count: 5,
    success_count: 5,
    error_count: 0,
    last_execution: "2024-01-01T10:00:00Z",
  },
];

const mockedApi = vi.mocked(apiService);
const mockedToast = vi.mocked(toast);

describe("HandlersList", () => {
  const user = userEvent.setup();

  const baseProps = {
    onEditHandler: vi.fn(),
    onViewStats: vi.fn(),
    onCreateHandler: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.getHandlers.mockResolvedValue([...mockHandlers]);
  });

  it("renders handlers after loading data", async () => {
    render(<HandlersList {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByText("GitHub Push Handler")).toBeInTheDocument();
      expect(screen.getByText("Slack Message Handler")).toBeInTheDocument();
    });
  });

  it("toggles handler status and updates list", async () => {
    const updatedHandler: WebhookHandler = { ...mockHandlers[0]!, enabled: false };
    mockedApi.toggleHandler.mockResolvedValue(updatedHandler);

    render(<HandlersList {...baseProps} />);

    const toggleButton = await screen.findByTitle("Disable handler");
    await user.click(toggleButton);

    await waitFor(() => {
      expect(mockedApi.toggleHandler).toHaveBeenCalledWith("1", false);
      expect(mockedToast.success).toHaveBeenCalledWith("Handler disabled successfully");
    });
  });

  it("confirms and deletes a handler", async () => {
    mockedApi.deleteHandler.mockResolvedValue(undefined);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<HandlersList {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByText("GitHub Push Handler")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle("Delete handler");
    const deleteButton = deleteButtons[0]!;
    await user.click(deleteButton);

    await waitFor(() => {
      expect(mockedApi.deleteHandler).toHaveBeenCalledWith("1");
      expect(mockedToast.success).toHaveBeenCalledWith("Handler deleted successfully");
    });

    confirmSpy.mockRestore();
  });
});
