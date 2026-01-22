/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEditorActions, useEditorState, useStatus } from "../../../contexts/AppContext";
import { useCurrentProject } from "../../../contexts/ProjectContext";
import type { Fragment } from "../../../types/api";
import FileTree from "../FileTree";

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../services/api", () => ({
  apiService: {
    createFragment: vi.fn(),
    deleteFragment: vi.fn(),
  },
}));

vi.mock("../../contexts/AppContext", () => ({
  useEditorState: vi.fn(),
  useEditorActions: vi.fn(),
  useStatus: vi.fn(),
}));

vi.mock("../../contexts/ProjectContext", () => ({
  useCurrentProject: vi.fn(),
}));

const mockFragments: Fragment[] = [
  {
    id: "fragment-1",
    project_id: "project-1",
    path: "api/routes.cue",
    content: "package api",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "fragment-2",
    project_id: "project-1",
    path: "api/middleware/auth.cue",
    content: "package middleware",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
];

const mockUseEditorState = vi.mocked(useEditorState);
const mockUseEditorActions = vi.mocked(useEditorActions);
const mockUseStatus = vi.mocked(useStatus);
const mockUseCurrentProject = vi.mocked(useCurrentProject);

describe("FileTree", () => {
  const user = userEvent.setup();

  const setActiveFragment = vi.fn();
  const setFragments = vi.fn();
  const deleteFragment = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseEditorState.mockReturnValue({
      fragments: mockFragments,
      activeFragmentId: mockFragments[0]?.id ?? null,
      selectedCueFile: null,
      availableCueFiles: [],
      unsavedChanges: new Set<string>(),
      editorContent: {},
    });

    mockUseEditorActions.mockReturnValue({
      setActiveFragment,
      setFragments,
      deleteFragment,
      setSelectedCueFile: vi.fn(),
      setAvailableCueFiles: vi.fn(),
      updateEditorContent: vi.fn(),
      markUnsaved: vi.fn(),
      markSaved: vi.fn(),
    } as any);

    mockUseStatus.mockReturnValue({
      loading: false,
      error: null,
      setLoading: vi.fn(),
      setError: vi.fn(),
    });

    mockUseCurrentProject.mockReturnValue({
      id: "project-1",
      name: "Example",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    });
  });

  it("renders a tree with fragments grouped by directory", () => {
    render(<FileTree />);

    expect(screen.getByText("Explorer")).toBeInTheDocument();
    expect(screen.getByText("routes.cue")).toBeInTheDocument();
    expect(screen.getByText("auth.cue")).toBeInTheDocument();
  });

  it("selects a fragment when a file entry is clicked", async () => {
    render(<FileTree />);

    await user.click(screen.getByText("auth.cue"));
    expect(setActiveFragment).toHaveBeenCalledWith("fragment-2");
  });
});
