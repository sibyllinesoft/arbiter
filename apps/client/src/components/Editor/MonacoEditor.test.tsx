/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MonacoEditor from "./MonacoEditor";

const hoisted = vi.hoisted(() => {
  const editorMock = {
    addCommand: vi.fn(),
    getModel: vi.fn(() => ({
      onDidChangeContent: vi.fn(),
    })),
    focus: vi.fn(),
  };

  const monacoMock = {
    KeyMod: { CtrlCmd: 1 },
    KeyCode: { KeyS: 2 },
  };

  return { editorMock, monacoMock };
});

const mockEditor = hoisted.editorMock;
const mockMonaco = hoisted.monacoMock;

vi.mock("monaco-editor", () => ({
  editor: {},
  KeyMod: hoisted.monacoMock.KeyMod,
  KeyCode: hoisted.monacoMock.KeyCode,
}));

vi.mock("@monaco-editor/react", () => ({
  __esModule: true,
  default: ({ value, onChange, onMount }: any) => {
    React.useEffect(() => {
      onMount?.(mockEditor, mockMonaco);
    }, [onMount]);

    return (
      <div data-testid="monaco-editor">
        <textarea
          data-testid="editor-input"
          value={value ?? ""}
          onChange={(event) => onChange?.(event.target.value)}
        />
      </div>
    );
  },
}));

describe("MonacoEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEditor.getModel.mockImplementation(() => ({
      onDidChangeContent: vi.fn(),
    }));
  });

  it("forwards value changes through onChange", async () => {
    const handleChange = vi.fn();
    render(<MonacoEditor value="initial" onChange={handleChange} />);

    const textarea = screen.getByTestId("editor-input");
    fireEvent.change(textarea, { target: { value: "initial updated" } });

    expect(handleChange).toHaveBeenCalledWith("initial updated");
  });

  it("registers save command when onSave is supplied", () => {
    const handleSave = vi.fn();
    render(<MonacoEditor value="test" onChange={vi.fn()} onSave={handleSave} />);

    const expectedKey = mockMonaco.KeyMod.CtrlCmd | mockMonaco.KeyCode.KeyS;
    expect(mockEditor.addCommand).toHaveBeenCalledWith(expectedKey, expect.any(Function));

    const [, saveCallback] = mockEditor.addCommand.mock.calls[0]!;
    saveCallback();
    expect(handleSave).toHaveBeenCalled();
  });

  it("notifies when editor is ready", () => {
    const handleReady = vi.fn();
    render(<MonacoEditor value="" onChange={vi.fn()} onEditorReady={handleReady} />);

    expect(handleReady).toHaveBeenCalledWith(mockEditor);
  });
});
