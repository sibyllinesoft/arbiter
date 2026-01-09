import { MonacoEditor } from "@/components/Editor/MonacoEditor";
import { ContentTypeSelect } from "@/components/form/ContentTypeSelect";
import { MarkdownField } from "@/components/form/MarkdownField";
import Checkbox from "@/design-system/components/Checkbox";
import Input from "@/design-system/components/Input";

import {
  CHECKBOX_SURFACE_CLASSES,
  INPUT_SURFACE_CLASSES,
  JSON_EDITOR_CONTAINER_CLASSES,
} from "../constants";
import type { EndpointFormState, RequestBodyState } from "../types";

export interface RequestSectionProps {
  form: EndpointFormState;
  submitting: boolean;
  errors: Record<string, string>;
  isDarkMode: boolean;
  jsonEditorOptions: object;
  updateForm: <K extends keyof EndpointFormState>(key: K, value: EndpointFormState[K]) => void;
}

export function RequestSection({
  form,
  submitting,
  errors,
  isDarkMode,
  jsonEditorOptions,
  updateForm,
}: RequestSectionProps) {
  const monacoTheme = isDarkMode ? "vs-dark" : "vs";

  const updateRequestBody = (updates: Partial<RequestBodyState>) => {
    updateForm("requestBody", { ...form.requestBody, ...updates });
  };

  return (
    <div className="space-y-4 border-l border-graphite-200 pl-4 dark:border-graphite-700">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-graphite-500 dark:text-graphite-300">
              Content Type
            </label>
            <ContentTypeSelect
              className="w-full"
              value={form.requestBody.contentType}
              onChange={(nextValue) => updateRequestBody({ contentType: nextValue })}
              isDisabled={submitting}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              className={CHECKBOX_SURFACE_CLASSES}
              checked={form.requestBody.required}
              onChange={(event) => updateRequestBody({ required: event.target.checked })}
              disabled={submitting}
            />
            <span className="text-xs text-graphite-500 dark:text-graphite-300">Required</span>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-graphite-500 dark:text-graphite-300">
            Schema Reference
          </label>
          <Input
            className={INPUT_SURFACE_CLASSES}
            value={form.requestBody.schemaRef}
            onChange={(event) => updateRequestBody({ schemaRef: event.target.value })}
            placeholder="#/components/schemas/User"
            disabled={submitting}
          />
        </div>
      </div>

      <MarkdownField
        id="request-body-description"
        label="Description"
        value={form.requestBody.description}
        onChange={(value) => updateRequestBody({ description: value })}
        placeholder="Explain the structure, usage, or nuances of the request payload."
      />

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-graphite-500 dark:text-graphite-300">
          Example (JSON)
        </label>
        <div className={JSON_EDITOR_CONTAINER_CLASSES}>
          <MonacoEditor
            value={form.requestBody.example}
            onChange={(value) => updateRequestBody({ example: value ?? "" })}
            language="json"
            theme={monacoTheme}
            options={jsonEditorOptions}
            className="h-full"
          />
        </div>
      </div>

      {errors.requestBody && <p className="text-xs text-red-500">{errors.requestBody}</p>}
    </div>
  );
}
