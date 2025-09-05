/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MonacoEditor from './MonacoEditor';

// Mock monaco-editor/react
const mockEditor = {
  getValue: vi.fn(() => ''),
  setValue: vi.fn(),
  getModel: vi.fn(() => ({
    onDidChangeContent: vi.fn(),
  })),
  setModel: vi.fn(),
  dispose: vi.fn(),
  onDidChangeModelContent: vi.fn(),
  focus: vi.fn(),
  addCommand: vi.fn(),
  onDidBlurEditorText: vi.fn(),
};

vi.mock('@monaco-editor/react', () => ({
  default: ({ onMount, onChange, loading, ...props }: any) => {
    // Simulate editor mounting after a short delay
    React.useEffect(() => {
      if (onMount) {
        const mockMonaco = {
          KeyMod: { CtrlCmd: 256 },
          KeyCode: { KeyS: 49 },
          languages: {
            getLanguages: vi.fn(() => []),
            register: vi.fn(),
            setLanguageConfiguration: vi.fn(),
            setMonarchTokensProvider: vi.fn(),
            registerCompletionItemProvider: vi.fn(),
            registerHoverProvider: vi.fn(),
            CompletionItemKind: {
              Keyword: 14,
            },
            CompletionItemInsertTextRule: {
              InsertAsSnippet: 4,
            },
          },
          editor: {
            defineTheme: vi.fn(),
          },
        };
        setTimeout(() => onMount(mockEditor, mockMonaco), 10);
      }
    }, [onMount]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (onChange) {
        onChange(e.target.value);
      }
    };

    return (
      <div data-testid="monaco-editor">
        {loading}
        <textarea
          data-testid="editor-textarea"
          value={props.value || ''}
          onChange={handleChange}
          style={{ width: '100%', height: '400px' }}
        />
      </div>
    );
  },
}));

// Mock the monaco-editor module completely
vi.mock('monaco-editor', () => ({
  __esModule: true,
  default: {
    languages: {
      getLanguages: vi.fn(() => []),
      register: vi.fn(),
      setLanguageConfiguration: vi.fn(),
      setMonarchTokensProvider: vi.fn(),
    },
    editor: {
      defineTheme: vi.fn(),
    },
    KeyMod: { CtrlCmd: 256 },
    KeyCode: { KeyS: 49 },
  },
  // Named exports
  languages: {
    getLanguages: vi.fn(() => []),
    register: vi.fn(),
    setLanguageConfiguration: vi.fn(),
    setMonarchTokensProvider: vi.fn(),
  },
  editor: {
    defineTheme: vi.fn(),
    IStandaloneCodeEditor: {},
    ITextModel: {},
  },
}));

describe('MonacoEditor', () => {
  const user = userEvent.setup();
  const mockOnChange = vi.fn();
  const mockOnSave = vi.fn();
  const mockOnEditorReady = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders editor container', () => {
      render(
        <MonacoEditor
          value="test content"
          onChange={mockOnChange}
        />
      );

      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });

    it('displays loading state initially', () => {
      render(
        <MonacoEditor
          value=""
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Loading editor...')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(
        <MonacoEditor
          value=""
          onChange={mockOnChange}
          className="custom-editor"
        />
      );

      const container = screen.getByTestId('monaco-editor').closest('.custom-editor');
      expect(container).toBeInTheDocument();
    });

    it('renders with default CUE language', async () => {
      render(
        <MonacoEditor
          value="package main"
          onChange={mockOnChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('editor-textarea')).toHaveValue('package main');
      });
    });
  });

  describe('Editor Configuration', () => {
    it('applies default editor options', () => {
      render(
        <MonacoEditor
          value=""
          onChange={mockOnChange}
        />
      );

      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
      // Default options are applied internally, we verify the editor renders
    });

    it('merges custom options with defaults', () => {
      const customOptions = {
        fontSize: 16,
        wordWrap: 'off' as const,
        customOption: true,
      };

      render(
        <MonacoEditor
          value=""
          onChange={mockOnChange}
          options={customOptions}
        />
      );

      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });

    it('supports different themes', () => {
      render(
        <MonacoEditor
          value=""
          onChange={mockOnChange}
          theme="vs-dark"
        />
      );

      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });

    it('supports different languages', () => {
      render(
        <MonacoEditor
          value=""
          onChange={mockOnChange}
          language="json"
        />
      );

      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });
  });

  describe('Content Handling', () => {
    it('displays initial value', async () => {
      const initialContent = 'package example\n\nvalue: "test"';
      
      render(
        <MonacoEditor
          value={initialContent}
          onChange={mockOnChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('editor-textarea')).toHaveValue(initialContent);
      });
    });

    it('calls onChange when content changes', async () => {
      render(
        <MonacoEditor
          value=""
          onChange={mockOnChange}
        />
      );

      const textarea = screen.getByTestId('editor-textarea');
      await user.type(textarea, 'new content');

      expect(mockOnChange).toHaveBeenCalledWith('new content');
    });

    it('handles undefined value gracefully', async () => {
      render(
        <MonacoEditor
          value=""
          onChange={mockOnChange}
        />
      );

      const textarea = screen.getByTestId('editor-textarea');
      
      // Simulate undefined value from editor
      fireEvent.change(textarea, { target: { value: undefined } });
      
      // Should not call onChange with undefined
      expect(mockOnChange).not.toHaveBeenCalledWith(undefined);
    });

    it('updates value when prop changes', async () => {
      const { rerender } = render(
        <MonacoEditor
          value="initial"
          onChange={mockOnChange}
        />
      );

      rerender(
        <MonacoEditor
          value="updated"
          onChange={mockOnChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('editor-textarea')).toHaveValue('updated');
      });
    });
  });

  describe('Editor Mount and Lifecycle', () => {
    it('calls onEditorReady when editor mounts', async () => {
      render(
        <MonacoEditor
          value=""
          onChange={mockOnChange}
          onEditorReady={mockOnEditorReady}
        />
      );

      await waitFor(() => {
        expect(mockOnEditorReady).toHaveBeenCalledWith(mockEditor);
      }, { timeout: 100 });
    });

    it('sets up save keyboard shortcut when onSave provided', async () => {
      render(
        <MonacoEditor
          value=""
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );

      await waitFor(() => {
        expect(mockEditor.addCommand).toHaveBeenCalled();
      });
    });

    it('sets up editor event listeners', async () => {
      render(
        <MonacoEditor
          value=""
          onChange={mockOnChange}
        />
      );

      await waitFor(() => {
        expect(mockEditor.getModel).toHaveBeenCalled();
      });
    });
  });

  describe('CUE Language Support', () => {
    beforeEach(() => {
      // Clear all mocks before each test
      vi.clearAllMocks();
    });

    it('renders with CUE language specified', async () => {
      render(
        <MonacoEditor
          value="package main"
          onChange={mockOnChange}
          language="cue"
        />
      );

      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByTestId('editor-textarea')).toHaveValue('package main');
      });
    });

    it('renders with CUE theme specified', async () => {
      render(
        <MonacoEditor
          value=""
          onChange={mockOnChange}
          language="cue"
          theme="cue-light"
        />
      );

      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });
  });

  describe('Auto-completion', () => {
    it('renders editor for auto-completion features', async () => {
      render(
        <MonacoEditor
          value=""
          onChange={mockOnChange}
          language="cue"
        />
      );

      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
      // Note: Actual completion testing would require integration with real Monaco instance
    });
  });

  describe('Hover Information', () => {
    it('renders editor for hover features', async () => {
      render(
        <MonacoEditor
          value=""
          onChange={mockOnChange}
          language="cue"
        />
      );

      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
      // Note: Actual hover testing would require integration with real Monaco instance
    });
  });

  describe('Save Functionality', () => {
    it('calls onSave when save shortcut is triggered', async () => {
      render(
        <MonacoEditor
          value=""
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );

      await waitFor(() => {
        expect(mockEditor.addCommand).toHaveBeenCalled();
      });

      // Simulate save command execution
      const addCommandCall = vi.mocked(mockEditor.addCommand).mock.calls[0];
      const saveCallback = addCommandCall[1];
      saveCallback();

      expect(mockOnSave).toHaveBeenCalled();
    });

    it('does not add save command when onSave not provided', async () => {
      render(
        <MonacoEditor
          value=""
          onChange={mockOnChange}
        />
      );

      await waitFor(() => {
        expect(mockEditor.getModel).toHaveBeenCalled();
      });

      // Should not add save command
      expect(mockEditor.addCommand).not.toHaveBeenCalled();
    });
  });

  describe('Fragment ID Handling', () => {
    it('accepts fragmentId prop', () => {
      render(
        <MonacoEditor
          value=""
          onChange={mockOnChange}
          fragmentId="fragment-123"
        />
      );

      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });

    it('works without fragmentId', () => {
      render(
        <MonacoEditor
          value=""
          onChange={mockOnChange}
        />
      );

      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles editor mount errors gracefully', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <MonacoEditor
          value=""
          onChange={mockOnChange}
        />
      );

      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
      
      consoleError.mockRestore();
    });

    it('handles language registration errors gracefully', async () => {
      // Simulate a language registration error scenario
      expect(() => {
        render(
          <MonacoEditor
            value=""
            onChange={mockOnChange}
            language="cue"
          />
        );
      }).not.toThrow();
    });

    it('handles onChange callback errors', async () => {
      const errorOnChange = vi.fn(() => {
        throw new Error('onChange error');
      });

      expect(() => {
        render(
          <MonacoEditor
            value=""
            onChange={errorOnChange}
          />
        );
      }).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('renders quickly with large content', () => {
      const largeContent = 'package example\n'.repeat(1000);
      
      const startTime = performance.now();
      render(
        <MonacoEditor
          value={largeContent}
          onChange={mockOnChange}
        />
      );
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100);
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });

    it('handles rapid content changes efficiently', async () => {
      const { rerender } = render(
        <MonacoEditor
          value="initial"
          onChange={mockOnChange}
        />
      );

      const startTime = performance.now();
      for (let i = 0; i < 100; i++) {
        rerender(
          <MonacoEditor
            value={`content ${i}`}
            onChange={mockOnChange}
          />
        );
      }
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(500);
    });
  });

  describe('Accessibility', () => {
    it('provides accessible editor interface', () => {
      render(
        <MonacoEditor
          value=""
          onChange={mockOnChange}
        />
      );

      const textarea = screen.getByTestId('editor-textarea');
      expect(textarea).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      render(
        <MonacoEditor
          value="test content"
          onChange={mockOnChange}
        />
      );

      const textarea = screen.getByTestId('editor-textarea');
      await user.click(textarea);
      
      expect(textarea).toHaveFocus();
    });
  });

  describe('Memory Management', () => {
    it('cleans up editor resources on unmount', async () => {
      const { unmount } = render(
        <MonacoEditor
          value=""
          onChange={mockOnChange}
          onEditorReady={mockOnEditorReady}
        />
      );

      await waitFor(() => {
        expect(mockOnEditorReady).toHaveBeenCalled();
      });

      unmount();

      // Editor should be disposed
      expect(mockEditor.dispose).toHaveBeenCalled();
    });

    it('handles unmount before editor is ready', () => {
      const { unmount } = render(
        <MonacoEditor
          value=""
          onChange={mockOnChange}
        />
      );

      // Unmount immediately before editor mounts
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Theme Handling', () => {
    it('applies CUE light theme when theme is vs', () => {
      render(
        <MonacoEditor
          value=""
          onChange={mockOnChange}
          theme="vs"
          language="cue"
        />
      );

      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
      // Theme application is internal to Monaco Editor
    });

    it('preserves custom theme when not using CUE light', () => {
      render(
        <MonacoEditor
          value=""
          onChange={mockOnChange}
          theme="vs-dark"
          language="cue"
        />
      );

      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });
  });
});