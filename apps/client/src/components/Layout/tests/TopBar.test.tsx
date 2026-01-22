/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TopBar from "../TopBar";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@/hooks/api-hooks", () => ({
  useProjects: vi.fn(() => ({ data: [{ id: "p1", name: "Project One" }], isLoading: false })),
}));

vi.mock("@/services/api", () => ({
  apiService: {
    updateFragment: vi.fn(),
    validateProject: vi.fn(),
    freezeVersion: vi.fn(),
  },
}));

vi.mock("../../contexts/AppContext", () => ({
  useCueFileState: vi.fn(() => ({
    selectedCueFile: null,
    availableCueFiles: [],
    setSelectedCueFile: vi.fn(),
    setAvailableCueFiles: vi.fn(),
  })),
  useValidationState: vi.fn(() => ({
    isValidating: false,
    errors: [],
    warnings: [],
    specHash: null,
    lastValidation: null,
  })),
  useValidationActions: vi.fn(() => ({ setValidationState: vi.fn() })),
  useEditorState: vi.fn(() => ({
    fragments: [],
    activeFragmentId: null,
    selectedCueFile: null,
    availableCueFiles: [],
    unsavedChanges: new Set<string>(),
    editorContent: {},
  })),
  useEditorActions: vi.fn(() => ({
    setActiveFragment: vi.fn(),
    setSelectedCueFile: vi.fn(),
    setAvailableCueFiles: vi.fn(),
    updateEditorContent: vi.fn(),
    markUnsaved: vi.fn(),
    markSaved: vi.fn(),
    setFragments: vi.fn(),
  })),
  useStatus: vi.fn(() => ({
    loading: false,
    error: null,
    setLoading: vi.fn(),
    setError: vi.fn(),
  })),
  useThemeControls: vi.fn(() => ({ isDark: false, toggleTheme: vi.fn() })),
}));

vi.mock("../../contexts/ProjectContext", () => ({
  useCurrentProject: vi.fn(() => ({ id: "p1", name: "Project One" })),
}));

describe("TopBar", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders project selector and actions", async () => {
    render(<TopBar />);
    expect(screen.getByText("Project One")).toBeInTheDocument();
    expect(screen.getByText("Validate")).toBeInTheDocument();
    await user.click(screen.getByText("Validate"));
  });
});
