import { MarkdownField } from "@/components/form/MarkdownField";
import Input from "@/design-system/components/Input";
import Select from "@/design-system/components/Select";

import { HTTP_METHOD_OPTIONS, INPUT_SURFACE_CLASSES } from "../constants";
import type { EndpointFormState, HttpMethod } from "../types";

export interface EndpointSectionProps {
  form: EndpointFormState;
  submitting: boolean;
  errors: Record<string, string>;
  updateForm: <K extends keyof EndpointFormState>(key: K, value: EndpointFormState[K]) => void;
}

export function EndpointSection({ form, submitting, errors, updateForm }: EndpointSectionProps) {
  return (
    <div className="space-y-4 border-l border-graphite-200 pl-4 dark:border-graphite-700">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-100">
            HTTP Method<span className="text-red-500">*</span>
          </label>
          <Select
            className={INPUT_SURFACE_CLASSES}
            hideLabel
            options={HTTP_METHOD_OPTIONS}
            value={form.method}
            onChange={(value) => updateForm("method", value as HttpMethod)}
            disabled={submitting}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-100">
            Path<span className="text-red-500">*</span>
          </label>
          <Input
            className={INPUT_SURFACE_CLASSES}
            value={form.path}
            onChange={(event) => updateForm("path", event.target.value)}
            placeholder="/api/users/{userId}"
            required
            disabled={submitting}
          />
          {errors.path && <p className="mt-1 text-xs text-red-500">{errors.path}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-100">
            Summary
          </label>
          <Input
            className={INPUT_SURFACE_CLASSES}
            value={form.summary}
            onChange={(event) => updateForm("summary", event.target.value)}
            placeholder="Fetch a user by ID"
            disabled={submitting}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-100">
            Operation ID
          </label>
          <Input
            className={INPUT_SURFACE_CLASSES}
            value={form.operationId}
            onChange={(event) => updateForm("operationId", event.target.value)}
            placeholder="getUserById"
            disabled={submitting}
          />
        </div>
      </div>

      <MarkdownField
        id="endpoint-description"
        label="Description"
        value={form.description}
        onChange={(value) => updateForm("description", value)}
        placeholder="Document business context, side-effects, or considerations for this endpoint."
      />

      <div>
        <label className="mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-100">
          Tags
        </label>
        <Input
          className={INPUT_SURFACE_CLASSES}
          value={form.tags}
          onChange={(event) => updateForm("tags", event.target.value)}
          placeholder="Comma-separated, e.g. users,admin"
          disabled={submitting}
        />
      </div>
    </div>
  );
}
