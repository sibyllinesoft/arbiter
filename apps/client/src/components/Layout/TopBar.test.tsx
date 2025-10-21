/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "react-toastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useApp, useCueFileState, useValidationState } from "../../contexts/AppContext";
import { useCurrentProject } from "../../contexts/ProjectContext";
import { apiService } from "../../services/api";
import TopBar from "./TopBar";
vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("../../services/api", () => ({
  apiService: {
    updateFragment: vi.fn(),
    validateProject: vi.fn(),
    freezeVersion: vi.fn(),
  },
}));

vi.mock("../../contexts/AppContext", () => ({
  useApp: vi.fn(),
  useCueFileState: vi.fn(),
  useValidationState: vi.fn(),
}));

vi.mock("../../contexts/ProjectContext", () => ({
  useCurrentProject: vi.fn(),
}));

const mockedApi = vi.mocked(apiService);
const mockedToast = vi.mocked(toast);
const mockUseApp = vi.mocked(useApp);
const mockUseCueFileState = vi.mocked(useCueFileState);
const mockUseValidationState = vi.mocked(useValidationState);
const mockUseCurrentProject = vi.mocked(useCurrentProject);

describe("TopBar", () => {
  const user = userEvent.setup();

  const dispatch = vi.fn();
  const setLoading = vi.fn();
  const setError = vi.fn();
  const setSelectedCueFile = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseApp.mockReturnValue({
      state: {
        unsavedChanges: new Set<string>(),
        editorContent: {},
        projects: [],
      },
      dispatch,
      setLoading,
      setError,
      setSelectedCueFile,
      isDark: false,
      toggleTheme: vi.fn(),
    });

    mockUseValidationState.mockReturnValue({
      isValidating: false,
      errors: [],
      warnings: [],
      specHash: "abc123",
    });

    mockUseCueFileState.mockReturnValue({
      selectedCueFile: null,
      availableCueFiles: ["main.cue"],
      setSelectedCueFile,
    });

    mockUseCurrentProject.mockReturnValue({
      id: "project-1",
      name: "Test Project",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    });
  });

  it("disables Save when there are no unsaved fragments", () => {
    render(<TopBar />);

    expect(screen.getByRole("button", { name: /Save/ })).toBeDisabled();
  });

  it("saves each unsaved fragment and clears the flag", async () => {
    mockUseApp.mockReturnValue({
      state: {
        unsavedChanges: new Set(["fragment-1"]),
        editorContent: { "fragment-1": "updated" },
        projects: [],
      },
      dispatch,
      setLoading,
      setError,
      setSelectedCueFile,
      isDark: false,
      toggleTheme: vi.fn(),
    });

    mockedApi.updateFragment.mockResolvedValue({
      id: "fragment-1",
      project_id: "project-1",
      path: "api/routes.cue",
      content: "updated",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    } as any);

    render(<TopBar />);

    await user.click(screen.getByRole("button", { name: /Save/ }));

    await waitFor(() => {
      expect(mockedApi.updateFragment).toHaveBeenCalledWith("project-1", "fragment-1", "updated");
      expect(dispatch).toHaveBeenCalledWith({ type: "MARK_SAVED", payload: "fragment-1" });
      expect(mockedToast.success).toHaveBeenCalled();
    });
  });

  it("validates the project and reports success", async () => {
    mockedApi.validateProject.mockResolvedValue({
      success: true,
      errors: [],
      warnings: [],
      spec_hash: "def456",
    } as any);

    render(<TopBar />);

    await user.click(screen.getByRole("button", { name: /Validate/ }));

    await waitFor(() => {
      expect(setLoading).toHaveBeenCalledWith(true);
      expect(mockedApi.validateProject).toHaveBeenCalledWith("project-1", { force: true });
      expect(mockedToast.success).toHaveBeenCalledWith(
        "Validation completed successfully",
        expect.any(Object),
      );
    });
  });

  it("cancels freezing when the dialog is dismissed", async () => {
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValueOnce(null);

    render(<TopBar />);

    await user.click(screen.getByRole("button", { name: /Freeze/ }));

    expect(mockedApi.freezeVersion).not.toHaveBeenCalled();
    promptSpy.mockRestore();
  });
});
