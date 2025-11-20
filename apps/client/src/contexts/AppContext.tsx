// Aggregator provider that composes focused contexts.
import React from "react";
import { AppSettingsProvider, useStatus, useThemeControls } from "./AppSettingsContext";
import {
  EditorProvider,
  useActiveFragment,
  useCueFileState,
  useEditorActions,
  useEditorContent,
  useEditorState,
} from "./EditorContext";
import { GitHubProvider, useGitHubState } from "./GitHubContext";
import { UIProvider, useUIState } from "./UIContext";
import { ValidationProvider, useValidationActions, useValidationState } from "./ValidationContext";

export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <AppSettingsProvider>
      <UIProvider>
        <ValidationProvider>
          <GitHubProvider>
            <EditorProvider>{children}</EditorProvider>
          </GitHubProvider>
        </ValidationProvider>
      </UIProvider>
    </AppSettingsProvider>
  );
}

// Re-exports for convenience
export { useUIState } from "./UIContext";
export { useGitHubState } from "./GitHubContext";
export { useValidationState, useValidationActions } from "./ValidationContext";
export {
  useEditorState,
  useEditorActions,
  useCueFileState,
  useActiveFragment,
  useEditorContent,
} from "./EditorContext";
export { useAppSettings, useStatus, useThemeControls } from "./AppSettingsContext";
export type { AppSettings } from "./AppSettingsContext";
