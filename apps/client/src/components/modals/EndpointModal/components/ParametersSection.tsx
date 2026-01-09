import Button from "@/design-system/components/Button";
import Checkbox from "@/design-system/components/Checkbox";
import Input from "@/design-system/components/Input";
import Select from "@/design-system/components/Select";

import {
  CHECKBOX_SURFACE_CLASSES,
  INPUT_SURFACE_CLASSES,
  PARAMETER_DIVIDER_VALUE,
  PARAMETER_NEW_OPTION_VALUE,
  PARAM_LOCATION_OPTIONS,
} from "../constants";
import type { EndpointFormState, ParameterFormState, ParameterLocation } from "../types";

export interface ParametersSectionProps {
  form: EndpointFormState;
  submitting: boolean;
  activeParameterId: string | null;
  selectedParameter: ParameterFormState | null;
  parameterOptions: Array<{
    value: string;
    label: string;
    description?: string;
    disabled?: boolean;
  }>;
  parameterSelectValue: string;
  handleParameterSelect: (value: string | string[]) => void;
  handleRemoveParameter: (id: string) => void;
  updateParameter: (id: string, updates: Partial<ParameterFormState>) => void;
}

export function ParametersSection({
  form,
  submitting,
  selectedParameter,
  parameterOptions,
  parameterSelectValue,
  handleParameterSelect,
  handleRemoveParameter,
  updateParameter,
}: ParametersSectionProps) {
  return (
    <div className="space-y-4 border-l border-graphite-200 pl-4 dark:border-graphite-700">
      <Select
        className={INPUT_SURFACE_CLASSES}
        hideLabel
        options={parameterOptions}
        value={parameterSelectValue}
        onChange={handleParameterSelect}
        placeholder="Select a parameter..."
        disabled={submitting}
      />

      {form.parameters.length === 0 ? (
        <p className="text-xs text-graphite-500 dark:text-graphite-300">
          Choose "Add new parameter" above to define path, query, header, or cookie inputs.
        </p>
      ) : selectedParameter ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h4 className="text-sm font-semibold text-graphite-700 dark:text-graphite-100">
              Editing {selectedParameter.name.trim() || "Parameter"}
            </h4>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleRemoveParameter(selectedParameter.id)}
              disabled={submitting}
              className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
            >
              Remove
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-graphite-500 dark:text-graphite-300">
                Name
              </label>
              <Input
                className={INPUT_SURFACE_CLASSES}
                value={selectedParameter.name}
                onChange={(event) =>
                  updateParameter(selectedParameter.id, { name: event.target.value })
                }
                placeholder="userId"
                disabled={submitting}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-graphite-500 dark:text-graphite-300">
                Location
              </label>
              <Select
                className={INPUT_SURFACE_CLASSES}
                hideLabel
                value={selectedParameter.location}
                options={PARAM_LOCATION_OPTIONS}
                onChange={(value) =>
                  updateParameter(selectedParameter.id, { location: value as ParameterLocation })
                }
                disabled={submitting}
              />
            </div>
            <div className="flex items-center gap-2 pt-6 sm:justify-end">
              <Checkbox
                className={CHECKBOX_SURFACE_CLASSES}
                checked={selectedParameter.required}
                onChange={(event) =>
                  updateParameter(selectedParameter.id, { required: event.target.checked })
                }
                disabled={submitting}
              />
              <span className="text-xs font-medium uppercase tracking-wide text-graphite-500 dark:text-graphite-300">
                Required
              </span>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-graphite-500 dark:text-graphite-300">
              Description
            </label>
            <textarea
              value={selectedParameter.description}
              onChange={(event) =>
                updateParameter(selectedParameter.id, { description: event.target.value })
              }
              className="w-full rounded-md border border-graphite-500 bg-graphite-200 text-sm text-graphite-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-graphite-700 dark:bg-graphite-950 dark:text-graphite-100 dark:focus:border-blue-400 dark:focus:ring-blue-500/40"
              disabled={submitting}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-graphite-500 dark:text-graphite-300">
                Schema Type
              </label>
              <Input
                className={INPUT_SURFACE_CLASSES}
                value={selectedParameter.schemaType}
                onChange={(event) =>
                  updateParameter(selectedParameter.id, { schemaType: event.target.value })
                }
                placeholder="string"
                disabled={submitting}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-graphite-500 dark:text-graphite-300">
                Schema Reference
              </label>
              <Input
                className={INPUT_SURFACE_CLASSES}
                value={selectedParameter.schemaRef}
                onChange={(event) =>
                  updateParameter(selectedParameter.id, { schemaRef: event.target.value })
                }
                placeholder="#/components/schemas/UserQuery"
                disabled={submitting}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-graphite-500 dark:text-graphite-300">
              Example
            </label>
            <Input
              className={INPUT_SURFACE_CLASSES}
              value={selectedParameter.example}
              onChange={(event) =>
                updateParameter(selectedParameter.id, { example: event.target.value })
              }
              placeholder="12345"
              disabled={submitting}
            />
          </div>
        </div>
      ) : (
        <p className="text-xs text-graphite-500 dark:text-graphite-300">
          Select a parameter to edit its details.
        </p>
      )}
    </div>
  );
}
