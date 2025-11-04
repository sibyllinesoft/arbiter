/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useApp } from "../../contexts/AppContext";
import type { AppContextState } from "../../contexts/AppContext";
import { useCurrentProject } from "../../contexts/ProjectContext";
import type { Fragment } from "../../types/api";
import FileTree from "./FileTree";

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
  useApp: vi.fn(),
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

const mockUseApp = vi.mocked(useApp);
const mockUseCurrentProject = vi.mocked(useCurrentProject);

const defaultAppSettings = {
  showNotifications: false,
  appsDirectory: "apps",
  packagesDirectory: "packages",
  servicesDirectory: "services",
  testsDirectory: "tests",
  infraDirectory: "infra",
  endpointDirectory: "apps/api/src/endpoints",
};

function buildAppState(): AppContextState {
  const state: AppContextState = {
    projects: [],
    fragments: mockFragments,
    activeFragmentId: mockFragments[0]?.id ?? null,
    isConnected: true,
    reconnectAttempts: 0,
    lastSync: null,
    isValidating: false,
    errors: [],
    warnings: [],
    specHash: null,
    lastValidation: null,
    selectedCueFile: null,
    availableCueFiles: [],
    unsavedChanges: new Set<string>(),
    editorContent: {},
    loading: false,
    error: null,
    settings: { ...defaultAppSettings },
    activeTab: "source",
    currentView: "dashboard",
    gitUrl: "",
    modalTab: "git",
    gitHubRepos: [],
    gitHubOrgs: [],
    selectedRepos: new Set<number>(),
    reposByOwner: {},
    isLoadingGitHub: false,
  };
  return state;
}

describe("FileTree", () => {
  const user = userEvent.setup();

  const setActiveFragment = vi.fn();
  const dispatch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    const state = buildAppState();

    mockUseApp.mockReturnValue({
      state,
      dispatch,
      setLoading: vi.fn(),
      setActiveFragment,
      setError: vi.fn(),
      setSelectedCueFile: vi.fn(),
      updateSettings: vi.fn(),
      setActiveTab: vi.fn(),
      setCurrentView: vi.fn(),
      setGitUrl: vi.fn(),
      setModalTab: vi.fn(),
      setGitHubRepos: vi.fn(),
      setGitHubOrgs: vi.fn(),
      setSelectedRepos: vi.fn(),
      toggleRepoSelection: vi.fn(),
      setReposByOwner: vi.fn(),
      setLoadingGitHub: vi.fn(),
      updateEditorContent: vi.fn(),
      markUnsaved: vi.fn(),
      markSaved: vi.fn(),
      isDark: false,
      toggleTheme: vi.fn(),
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
