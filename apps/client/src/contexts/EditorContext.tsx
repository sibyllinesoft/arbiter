import type { Fragment } from "@/types/api";
import React, { createContext, useContext, useMemo, useReducer } from "react";

interface EditorState {
  fragments: Fragment[];
  activeFragmentId: string | null;
  selectedCueFile: string | null;
  availableCueFiles: string[];
  unsavedChanges: Set<string>;
  editorContent: Record<string, string>;
}

type EditorAction =
  | { type: "SET_FRAGMENTS"; payload: Fragment[] }
  | { type: "UPDATE_FRAGMENT"; payload: Fragment }
  | { type: "DELETE_FRAGMENT"; payload: string }
  | { type: "SET_ACTIVE_FRAGMENT"; payload: string | null }
  | { type: "SET_SELECTED_CUE_FILE"; payload: string | null }
  | { type: "SET_AVAILABLE_CUE_FILES"; payload: string[] }
  | { type: "MARK_UNSAVED"; payload: string }
  | { type: "MARK_SAVED"; payload: string }
  | { type: "SET_EDITOR_CONTENT"; payload: { fragmentId: string; content: string } };

const initialState: EditorState = {
  fragments: [],
  activeFragmentId: null,
  selectedCueFile: null,
  availableCueFiles: [],
  unsavedChanges: new Set<string>(),
  editorContent: {},
};

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "SET_FRAGMENTS":
      return { ...state, fragments: action.payload };
    case "UPDATE_FRAGMENT":
      return {
        ...state,
        fragments: state.fragments.map((f) => (f.id === action.payload.id ? action.payload : f)),
      };
    case "DELETE_FRAGMENT":
      return { ...state, fragments: state.fragments.filter((f) => f.id !== action.payload) };
    case "SET_ACTIVE_FRAGMENT":
      return { ...state, activeFragmentId: action.payload };
    case "SET_SELECTED_CUE_FILE":
      return { ...state, selectedCueFile: action.payload };
    case "SET_AVAILABLE_CUE_FILES":
      return { ...state, availableCueFiles: action.payload };
    case "MARK_UNSAVED":
      return { ...state, unsavedChanges: new Set([...state.unsavedChanges, action.payload]) };
    case "MARK_SAVED": {
      const next = new Set(state.unsavedChanges);
      next.delete(action.payload);
      return { ...state, unsavedChanges: next };
    }
    case "SET_EDITOR_CONTENT":
      return {
        ...state,
        editorContent: {
          ...state.editorContent,
          [action.payload.fragmentId]: action.payload.content,
        },
      };
    default:
      return state;
  }
}

interface EditorContextValue {
  state: EditorState;
  setFragments: (fragments: Fragment[]) => void;
  updateFragment: (fragment: Fragment) => void;
  deleteFragment: (id: string) => void;
  setActiveFragment: (id: string | null) => void;
  setSelectedCueFile: (file: string | null) => void;
  setAvailableCueFiles: (files: string[]) => void;
  updateEditorContent: (fragmentId: string, content: string) => void;
  markUnsaved: (id: string) => void;
  markSaved: (id: string) => void;
}

const EditorContext = createContext<EditorContextValue | undefined>(undefined);

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(editorReducer, initialState);

  const value = useMemo<EditorContextValue>(
    () => ({
      state,
      setFragments: (fragments) => dispatch({ type: "SET_FRAGMENTS", payload: fragments }),
      updateFragment: (fragment) => dispatch({ type: "UPDATE_FRAGMENT", payload: fragment }),
      deleteFragment: (id) => dispatch({ type: "DELETE_FRAGMENT", payload: id }),
      setActiveFragment: (id) => dispatch({ type: "SET_ACTIVE_FRAGMENT", payload: id }),
      setSelectedCueFile: (file) => dispatch({ type: "SET_SELECTED_CUE_FILE", payload: file }),
      setAvailableCueFiles: (files) =>
        dispatch({ type: "SET_AVAILABLE_CUE_FILES", payload: files }),
      updateEditorContent: (fragmentId, content) =>
        dispatch({ type: "SET_EDITOR_CONTENT", payload: { fragmentId, content } }),
      markUnsaved: (id) => dispatch({ type: "MARK_UNSAVED", payload: id }),
      markSaved: (id) => dispatch({ type: "MARK_SAVED", payload: id }),
    }),
    [state],
  );

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

export function useEditorState() {
  const context = useContext(EditorContext);
  if (!context) throw new Error("useEditorState must be used within an EditorProvider");
  return context.state;
}

export function useEditorActions() {
  const context = useContext(EditorContext);
  if (!context) throw new Error("useEditorActions must be used within an EditorProvider");
  const {
    setFragments,
    updateFragment,
    deleteFragment,
    setActiveFragment,
    setSelectedCueFile,
    setAvailableCueFiles,
    updateEditorContent,
    markUnsaved,
    markSaved,
  } = context;
  return {
    setFragments,
    updateFragment,
    deleteFragment,
    setActiveFragment,
    setSelectedCueFile,
    setAvailableCueFiles,
    updateEditorContent,
    markUnsaved,
    markSaved,
  };
}

export function useCueFileState() {
  const context = useContext(EditorContext);
  if (!context) throw new Error("useCueFileState must be used within an EditorProvider");
  return {
    selectedCueFile: context.state.selectedCueFile,
    availableCueFiles: context.state.availableCueFiles,
    setSelectedCueFile: context.setSelectedCueFile,
    setAvailableCueFiles: context.setAvailableCueFiles,
  };
}

export function useActiveFragment() {
  const context = useContext(EditorContext);
  if (!context) throw new Error("useActiveFragment must be used within an EditorProvider");
  const { state } = context;
  return state.fragments.find((f) => f.id === state.activeFragmentId) || null;
}

export function useEditorContent(fragmentId: string) {
  const context = useContext(EditorContext);
  if (!context) throw new Error("useEditorContent must be used within an EditorProvider");
  return context.state.editorContent[fragmentId] || "";
}
