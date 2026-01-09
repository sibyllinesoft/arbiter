import { MonacoEditor } from "@/components/Editor/MonacoEditor";
import { ContentTypeSelect } from "@/components/form/ContentTypeSelect";
import Button from "@/design-system/components/Button";
import Input from "@/design-system/components/Input";
import Select from "@/design-system/components/Select";

import { INPUT_SURFACE_CLASSES, JSON_EDITOR_CONTAINER_CLASSES } from "../constants";
import type { EndpointFormState, ResponseFormState } from "../types";

export interface ResponsesSectionProps {
  form: EndpointFormState;
  submitting: boolean;
  errors: Record<string, string>;
  isDarkMode: boolean;
  jsonEditorOptions: object;
  selectedResponse: ResponseFormState | null;
  responseOptions: Array<{
    value: string;
    label: string;
    description?: string;
    disabled?: boolean;
  }>;
  responseSelectValue: string;
  handleResponseSelect: (value: string | string[]) => void;
  handleRemoveResponse: (id: string) => void;
  updateResponse: (id: string, updates: Partial<ResponseFormState>) => void;
}

export function ResponsesSection({
  form,
  submitting,
  errors,
  isDarkMode,
  jsonEditorOptions,
  selectedResponse,
  responseOptions,
  responseSelectValue,
  handleResponseSelect,
  handleRemoveResponse,
  updateResponse,
}: ResponsesSectionProps) {
  const monacoTheme = isDarkMode ? "vs-dark" : "vs";

  return (
    <div className="space-y-4 border-l border-graphite-200 pl-4 dark:border-graphite-700">
      <Select
        className={INPUT_SURFACE_CLASSES}
        hideLabel
        options={responseOptions}
        value={responseSelectValue}
        onChange={handleResponseSelect}
        placeholder="Select a response..."
        disabled={submitting}
      />

      {form.responses.length === 0 ? (
        <p className="text-xs text-graphite-500 dark:text-graphite-300">
          Add at least one response to complete the endpoint definition.
        </p>
      ) : selectedResponse ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h4 className="text-sm font-semibold text-graphite-700 dark:text-graphite-100">
              Editing {selectedResponse.status.trim() || "Response"}
            </h4>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleRemoveResponse(selectedResponse.id)}
              disabled={submitting || form.responses.length === 1}
              className="text-red-500 hover:text-red-600 disabled:text-graphite-400 disabled:hover:text-graphite-400 dark:text-red-400 dark:hover:text-red-300 dark:disabled:text-graphite-500 dark:disabled:hover:text-graphite-500"
            >
              Remove
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-graphite-500 dark:text-graphite-300">
                Status Code
              </label>
              <Input
                className={INPUT_SURFACE_CLASSES}
                value={selectedResponse.status}
                onChange={(event) =>
                  updateResponse(selectedResponse.id, { status: event.target.value })
                }
                placeholder="200"
                disabled={submitting}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-graphite-500 dark:text-graphite-300">
                Description
              </label>
              <Input
                className={INPUT_SURFACE_CLASSES}
                value={selectedResponse.description}
                onChange={(event) =>
                  updateResponse(selectedResponse.id, { description: event.target.value })
                }
                placeholder="Successful response"
                disabled={submitting}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-graphite-500 dark:text-graphite-300">
                Content Type
              </label>
              <ContentTypeSelect
                className="w-full"
                value={selectedResponse.contentType}
                onChange={(nextValue) =>
                  updateResponse(selectedResponse.id, { contentType: nextValue })
                }
                placeholder="Select content type..."
                isDisabled={submitting}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-graphite-500 dark:text-graphite-300">
                Schema Reference
              </label>
              <Input
                className={INPUT_SURFACE_CLASSES}
                value={selectedResponse.schemaRef}
                onChange={(event) =>
                  updateResponse(selectedResponse.id, { schemaRef: event.target.value })
                }
                placeholder="#/components/schemas/User"
                disabled={submitting}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-graphite-500 dark:text-graphite-300">
              Example (JSON)
            </label>
            <div className={JSON_EDITOR_CONTAINER_CLASSES}>
              <MonacoEditor
                value={selectedResponse.example}
                onChange={(value) => updateResponse(selectedResponse.id, { example: value ?? "" })}
                language="json"
                theme={monacoTheme}
                options={jsonEditorOptions}
                className="h-full"
              />
            </div>
          </div>

          {errors.responses && <p className="text-xs text-red-500">{errors.responses}</p>}
        </div>
      ) : (
        <p className="text-xs text-graphite-500 dark:text-graphite-300">
          Select a response to edit its details.
        </p>
      )}
    </div>
  );
}
