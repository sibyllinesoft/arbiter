import { MonacoEditor } from "@/components/Editor/MonacoEditor";
import { ContentTypeSelect } from "@/components/form/ContentTypeSelect";
import { MarkdownField } from "@/components/form/MarkdownField";
import Button from "@/design-system/components/Button";
import Checkbox from "@/design-system/components/Checkbox";
import Input from "@/design-system/components/Input";
import Modal from "@/design-system/components/Modal";
import Select, { type SelectOption } from "@/design-system/components/Select";
import { ChevronDown } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import {
  CHECKBOX_SURFACE_CLASSES,
  DEFAULT_REQUEST_BODY,
  HTTP_METHOD_OPTIONS,
  HTTP_METHOD_VALUES,
  INPUT_SURFACE_CLASSES,
  JSON_EDITOR_CONTAINER_CLASSES,
  PARAMETER_DIVIDER_VALUE,
  PARAMETER_NEW_OPTION_VALUE,
  PARAM_LOCATION_OPTIONS,
  RESPONSE_DIVIDER_VALUE,
  RESPONSE_NEW_OPTION_VALUE,
} from "./constants";
import type {
  EndpointFormState,
  EndpointModalProps,
  HttpMethod,
  ParameterFormState,
  ParameterLocation,
  ResponseFormState,
} from "./types";
import { buildSchemaObject, createParameter, createResponse, toTagArray } from "./utils";

export function EndpointModal({
  open,
  onClose,
  onSubmit,
  groupLabel,
  mode = "create",
  initialValues = null,
}: EndpointModalProps) {
  const buildInitialForm = useCallback((): EndpointFormState => {
    const initialPath =
      typeof initialValues?.path === "string" && initialValues.path.trim().length > 0
        ? initialValues.path.trim()
        : "/";
    const initialMethod =
      typeof initialValues?.method === "string" &&
      HTTP_METHOD_VALUES.includes(initialValues.method as HttpMethod)
        ? (initialValues.method as HttpMethod)
        : "GET";
    const initialSummary = typeof initialValues?.summary === "string" ? initialValues.summary : "";
    const initialDescription =
      typeof initialValues?.description === "string" ? initialValues.description : "";
    const initialOperationId =
      typeof initialValues?.operationId === "string" ? initialValues.operationId : "";
    const initialTags = Array.isArray(initialValues?.tags)
      ? (initialValues?.tags as string[]).join(", ")
      : typeof initialValues?.tags === "string"
        ? (initialValues.tags as string)
        : "";

    return {
      path: initialPath,
      method: initialMethod,
      summary: initialSummary,
      description: initialDescription,
      operationId: initialOperationId,
      tags: initialTags,
      requestBody: { ...DEFAULT_REQUEST_BODY },
      parameters: [],
      responses: [createResponse()],
    };
  }, [initialValues]);

  const [form, setForm] = useState<EndpointFormState>(buildInitialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [activeParameterId, setActiveParameterId] = useState<string | null>(null);
  const [activeResponseId, setActiveResponseId] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<
    "endpoint" | "request" | "parameters" | "responses"
  >("endpoint");
  const [isDarkMode, setIsDarkMode] = useState(() =>
    typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : false,
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setForm(buildInitialForm());
    setErrors({});
    setSubmitError(null);
    setActiveParameterId(null);
    setActiveResponseId(null);
    setExpandedSection("endpoint");
  }, [open, buildInitialForm]);

  useEffect(() => {
    if (form.parameters.length === 0) {
      setActiveParameterId(null);
      return;
    }
    const fallbackId = form.parameters[0]?.id ?? null;
    setActiveParameterId((prev) => {
      if (prev && form.parameters.some((param) => param.id === prev)) {
        return prev;
      }
      return fallbackId;
    });
  }, [form.parameters]);

  useEffect(() => {
    if (form.responses.length === 0) {
      setActiveResponseId(null);
      return;
    }
    const fallbackId = form.responses[0]?.id ?? null;
    setActiveResponseId((prev) => {
      if (prev && form.responses.some((response) => response.id === prev)) {
        return prev;
      }
      return fallbackId;
    });
  }, [form.responses]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const updateTheme = () => {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    };

    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);

  const modalTitle = useMemo(() => {
    const fallback = mode === "edit" ? "Endpoint" : "Endpoint";
    if (!groupLabel) {
      return mode === "edit" ? `Update ${fallback}` : `Add ${fallback}`;
    }
    const trimmed = groupLabel.trim();
    if (!trimmed) {
      return mode === "edit" ? `Update ${fallback}` : `Add ${fallback}`;
    }
    const singular = trimmed.endsWith("s") ? trimmed.slice(0, -1) : trimmed;
    return mode === "edit" ? `Update ${singular}` : `Add ${singular}`;
  }, [groupLabel, mode]);

  const updateForm = useCallback(
    <K extends keyof EndpointFormState>(key: K, value: EndpointFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleAddParameter = useCallback(() => {
    const newParam = createParameter();
    setForm((prev) => ({ ...prev, parameters: [...prev.parameters, newParam] }));
    setActiveParameterId(newParam.id);
    setExpandedSection("parameters");
    return newParam.id;
  }, []);

  const handleRemoveParameter = useCallback((id: string) => {
    setForm((prev) => {
      const filtered = prev.parameters.filter((param) => param.id !== id);
      setActiveParameterId((current) => {
        if (!filtered.length) {
          return null;
        }
        if (current && current !== id && filtered.some((param) => param.id === current)) {
          return current;
        }
        return filtered[0]?.id ?? null;
      });
      return { ...prev, parameters: filtered };
    });
  }, []);

  const handleAddResponse = useCallback(() => {
    const newResponse = createResponse();
    setForm((prev) => ({ ...prev, responses: [...prev.responses, newResponse] }));
    setActiveResponseId(newResponse.id);
    setExpandedSection("responses");
    return newResponse.id;
  }, []);

  const handleRemoveResponse = useCallback((id: string) => {
    setForm((prev) => {
      if (prev.responses.length === 1) {
        return prev;
      }
      const filtered = prev.responses.filter((response) => response.id !== id);
      setActiveResponseId((current) => {
        if (!filtered.length) {
          return null;
        }
        if (current && current !== id && filtered.some((response) => response.id === current)) {
          return current;
        }
        return filtered[0]?.id ?? null;
      });
      return { ...prev, responses: filtered };
    });
  }, []);

  const updateParameter = useCallback((id: string, updates: Partial<ParameterFormState>) => {
    setForm((prev) => ({
      ...prev,
      parameters: prev.parameters.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              ...updates,
            }
          : entry,
      ),
    }));
  }, []);

  const updateResponse = useCallback((id: string, updates: Partial<ResponseFormState>) => {
    setForm((prev) => ({
      ...prev,
      responses: prev.responses.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              ...updates,
            }
          : entry,
      ),
    }));
  }, []);

  const selectedParameter = useMemo(
    () => form.parameters.find((param) => param.id === activeParameterId) ?? null,
    [form.parameters, activeParameterId],
  );

  const selectedResponse = useMemo(
    () => form.responses.find((response) => response.id === activeResponseId) ?? null,
    [form.responses, activeResponseId],
  );

  const isEndpointOpen = expandedSection === "endpoint";
  const isRequestOpen = expandedSection === "request";
  const isParametersOpen = expandedSection === "parameters";
  const isResponsesOpen = expandedSection === "responses";
  const endpointSummary = `${form.method} ${form.path || "/"}`;
  const hasRequestBodyContent =
    form.requestBody.contentType.trim().length > 0 ||
    form.requestBody.description.trim().length > 0 ||
    form.requestBody.schemaRef.trim().length > 0 ||
    form.requestBody.example.trim().length > 0;
  const requestSummary = hasRequestBodyContent
    ? form.requestBody.contentType.trim() || "Optional request body"
    : "No request body";
  const parameterSummary =
    form.parameters.length === 0
      ? "No parameters yet"
      : `${form.parameters.length} ${form.parameters.length === 1 ? "parameter" : "parameters"}`;
  const responseSummary =
    form.responses.length === 0
      ? "No responses yet"
      : `${form.responses.length} ${form.responses.length === 1 ? "response" : "responses"}`;
  const jsonEditorOptions = useMemo(
    () => ({
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      glyphMargin: false,
      lineNumbers: "off" as const,
      wordWrap: "on" as const,
      readOnly: submitting,
      padding: { top: 8, bottom: 8 },
      automaticLayout: true,
    }),
    [submitting],
  );
  const monacoTheme = isDarkMode ? "vs-dark" : "vs";

  const renderAccordionHeader = (
    id: "endpoint" | "request" | "parameters" | "responses",
    title: string,
    summary: string,
    isOpen: boolean,
  ) => (
    <button
      type="button"
      onClick={() => setExpandedSection(id)}
      className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left transition hover:bg-graphite-100/70 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:hover:bg-graphite-800/60 dark:focus:ring-blue-500/40"
    >
      <div>
        <div className="text-sm font-semibold text-graphite-700 dark:text-graphite-100">
          {title}
        </div>
        <div className="text-xs text-graphite-500 dark:text-graphite-300">{summary}</div>
      </div>
      <ChevronDown
        className={`h-4 w-4 text-graphite-500 transition-transform duration-150 ${isOpen ? "rotate-180" : "rotate-0"}`}
      />
    </button>
  );

  const parameterOptions = useMemo<SelectOption[]>(() => {
    const existing = form.parameters.map((param, index) => ({
      value: param.id,
      label: param.name.trim() || `Parameter ${index + 1}`,
      description: `${param.location.toUpperCase()} • ${param.required ? "Required" : "Optional"}`,
    }));

    if (existing.length === 0) {
      return [{ value: PARAMETER_NEW_OPTION_VALUE, label: "Add new parameter" }];
    }

    return [
      ...existing,
      { value: PARAMETER_DIVIDER_VALUE, label: "────────────", disabled: true },
      { value: PARAMETER_NEW_OPTION_VALUE, label: "Add new parameter" },
    ];
  }, [form.parameters]);

  const responseOptions = useMemo<SelectOption[]>(() => {
    const existing = form.responses.map((response, index) => ({
      value: response.id,
      label: response.status.trim() || `Response ${index + 1}`,
      description: response.description.trim() || "Describe the HTTP response",
    }));

    if (existing.length === 0) {
      return [{ value: RESPONSE_NEW_OPTION_VALUE, label: "Add new response" }];
    }

    return [
      ...existing,
      { value: RESPONSE_DIVIDER_VALUE, label: "────────────", disabled: true },
      { value: RESPONSE_NEW_OPTION_VALUE, label: "Add new response" },
    ];
  }, [form.responses]);

  const parameterSelectValue =
    activeParameterId ??
    (form.parameters.length > 0 ? form.parameters[0]!.id : PARAMETER_NEW_OPTION_VALUE);
  const responseSelectValue =
    activeResponseId ??
    (form.responses.length > 0 ? form.responses[0]!.id : RESPONSE_NEW_OPTION_VALUE);

  const handleParameterSelect = useCallback(
    (value: string | string[]) => {
      if (Array.isArray(value)) {
        return;
      }
      if (value === PARAMETER_NEW_OPTION_VALUE) {
        handleAddParameter();
        return;
      }
      if (value === PARAMETER_DIVIDER_VALUE) {
        return;
      }
      setActiveParameterId(value);
    },
    [handleAddParameter],
  );

  const handleResponseSelect = useCallback(
    (value: string | string[]) => {
      if (Array.isArray(value)) {
        return;
      }
      if (value === RESPONSE_NEW_OPTION_VALUE) {
        handleAddResponse();
        return;
      }
      if (value === RESPONSE_DIVIDER_VALUE) {
        return;
      }
      setActiveResponseId(value);
    },
    [handleAddResponse],
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};

    if (!form.path.trim()) {
      nextErrors.path = "Path is required";
    }

    if (!form.responses.length) {
      nextErrors.responses = "At least one response is required";
    } else if (form.responses.some((response) => !response.status.trim())) {
      nextErrors.responses = "Each response must include a status code";
    }

    const requestBodyContentType = form.requestBody.contentType.trim();
    const requestBodyHasAdditionalFields =
      form.requestBody.description.trim().length > 0 ||
      form.requestBody.schemaRef.trim().length > 0 ||
      form.requestBody.example.trim().length > 0;
    if (requestBodyHasAdditionalFields && !requestBodyContentType) {
      nextErrors.requestBody = "Request body requires a content type";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const tags = toTagArray(form.tags);

    const parameters = form.parameters
      .filter((param) => param.name.trim())
      .map((param) => {
        const schema = buildSchemaObject(param.schemaType, param.schemaRef, param.example);
        return {
          name: param.name.trim(),
          in: param.location,
          description: param.description.trim() || undefined,
          required: param.required,
          ...(schema ? { schema } : {}),
        };
      });

    const requestBody = (() => {
      const contentType = form.requestBody.contentType.trim();
      const description = form.requestBody.description.trim();
      const schemaRef = form.requestBody.schemaRef.trim();
      const exampleValue = form.requestBody.example.trim();

      if (!contentType && !description && !schemaRef && !exampleValue) {
        return undefined;
      }

      const schema = buildSchemaObject("", form.requestBody.schemaRef, form.requestBody.example);
      const mediaObject: Record<string, unknown> = {};
      if (schema) {
        mediaObject.schema = schema;
      }
      if (exampleValue) {
        mediaObject.example = exampleValue;
      }
      return {
        description: description || undefined,
        required: form.requestBody.required,
        content: contentType
          ? {
              [contentType]: Object.keys(mediaObject).length > 0 ? mediaObject : {},
            }
          : undefined,
      };
    })();

    const responses = form.responses.reduce<Record<string, Record<string, unknown>>>(
      (acc, response) => {
        const statusKey = response.status.trim();
        if (!statusKey) {
          return acc;
        }
        const description = response.description.trim() || "Response";
        const contentType = response.contentType.trim();
        const schema = buildSchemaObject("", response.schemaRef, response.example);
        const responseObj: Record<string, unknown> = { description };
        if (contentType) {
          const media: Record<string, unknown> = {};
          if (schema) {
            media.schema = schema;
          }
          const example = response.example.trim();
          if (example) {
            media.example = example;
          }
          responseObj.content = {
            [contentType]: media,
          };
        }
        acc[statusKey] = responseObj;
        return acc;
      },
      {},
    );

    if (Object.keys(responses).length === 0) {
      setErrors({ responses: "At least one response must include a status code" });
      return;
    }

    const methodKey = form.method.toLowerCase();

    const operation: Record<string, unknown> = {
      summary: form.summary.trim() || undefined,
      description: form.description.trim() || undefined,
      operationId: form.operationId.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
      parameters: parameters.length > 0 ? parameters : undefined,
      requestBody,
      responses,
    };

    try {
      setSubmitting(true);
      setSubmitError(null);
      const normalizedPath = form.path.trim() || "/";
      const normalizedSummary = form.summary.trim();
      const normalizedDescription = form.description.trim();
      const normalizedOperationId = form.operationId.trim();
      await onSubmit({
        entityType: "route",
        values: {
          name: normalizedSummary || `${form.method} ${normalizedPath}`,
          path: normalizedPath,
          method: form.method,
          summary: normalizedSummary,
          description: normalizedDescription,
          operationId: normalizedOperationId,
          tags,
          operations: {
            [methodKey]: operation,
          },
        },
      });
      onClose();
    } catch (error) {
      const fallbackMessage =
        mode === "edit" ? "Failed to update endpoint" : "Failed to create endpoint";
      const message = error instanceof Error ? error.message : fallbackMessage;
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!submitting) {
          onClose();
        }
      }}
      title={modalTitle}
      description={
        mode === "edit"
          ? "Review and update the HTTP endpoint definition."
          : "Define the HTTP endpoint and provide request/response details for OpenAPI generation."
      }
      size="3xl"
      showDefaultFooter={false}
      className="bg-white text-graphite-900 dark:bg-graphite-900 dark:text-graphite-50 border border-graphite-200 dark:border-graphite-700 shadow-2xl dark:[&_label]:text-graphite-100 dark:[&_p]:text-graphite-300 dark:[&_h3]:text-graphite-50 dark:[&_h4]:text-graphite-100"
      containerClassName="px-4 py-6 sm:px-6"
    >
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="space-y-4 divide-y divide-graphite-200 dark:divide-graphite-700">
          <div className="space-y-3">
            {renderAccordionHeader("endpoint", "Endpoint Details", endpointSummary, isEndpointOpen)}
            {isEndpointOpen && (
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
            )}
          </div>

          <div className="space-y-3 pt-4">
            {renderAccordionHeader("request", "Request Body", requestSummary, isRequestOpen)}
            {isRequestOpen && (
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
                        onChange={(nextValue) =>
                          updateForm("requestBody", {
                            ...form.requestBody,
                            contentType: nextValue,
                          })
                        }
                        isDisabled={submitting}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        className={CHECKBOX_SURFACE_CLASSES}
                        checked={form.requestBody.required}
                        onChange={(event) =>
                          updateForm("requestBody", {
                            ...form.requestBody,
                            required: event.target.checked,
                          })
                        }
                        disabled={submitting}
                      />
                      <span className="text-xs text-graphite-500 dark:text-graphite-300">
                        Required
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-graphite-500 dark:text-graphite-300">
                      Schema Reference
                    </label>
                    <Input
                      className={INPUT_SURFACE_CLASSES}
                      value={form.requestBody.schemaRef}
                      onChange={(event) =>
                        updateForm("requestBody", {
                          ...form.requestBody,
                          schemaRef: event.target.value,
                        })
                      }
                      placeholder="#/components/schemas/User"
                      disabled={submitting}
                    />
                  </div>
                </div>

                <MarkdownField
                  id="request-body-description"
                  label="Description"
                  value={form.requestBody.description}
                  onChange={(value) =>
                    updateForm("requestBody", {
                      ...form.requestBody,
                      description: value,
                    })
                  }
                  placeholder="Explain the structure, usage, or nuances of the request payload."
                />

                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-graphite-500 dark:text-graphite-300">
                    Example (JSON)
                  </label>
                  <div className={JSON_EDITOR_CONTAINER_CLASSES}>
                    <MonacoEditor
                      value={form.requestBody.example}
                      onChange={(value) =>
                        updateForm("requestBody", {
                          ...form.requestBody,
                          example: value ?? "",
                        })
                      }
                      language="json"
                      theme={monacoTheme}
                      options={jsonEditorOptions}
                      className="h-full"
                    />
                  </div>
                </div>

                {errors.requestBody && <p className="text-xs text-red-500">{errors.requestBody}</p>}
              </div>
            )}
          </div>

          <div className="space-y-3 pt-4">
            {renderAccordionHeader("parameters", "Parameters", parameterSummary, isParametersOpen)}
            {isParametersOpen && (
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
                    Choose "Add new parameter" above to define path, query, header, or cookie
                    inputs.
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
                            updateParameter(selectedParameter.id, {
                              location: value as ParameterLocation,
                            })
                          }
                          disabled={submitting}
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-6 sm:justify-end">
                        <Checkbox
                          className={CHECKBOX_SURFACE_CLASSES}
                          checked={selectedParameter.required}
                          onChange={(event) =>
                            updateParameter(selectedParameter.id, {
                              required: event.target.checked,
                            })
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
                            updateParameter(selectedParameter.id, {
                              schemaType: event.target.value,
                            })
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
            )}
          </div>

          <div className="space-y-3 pt-4">
            {renderAccordionHeader("responses", "Responses", responseSummary, isResponsesOpen)}
            {isResponsesOpen && (
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
                          onChange={(value) =>
                            updateResponse(selectedResponse.id, { example: value ?? "" })
                          }
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
            )}
          </div>
        </div>
        {submitError && (
          <p className="text-sm text-red-500" role="alert">
            {submitError}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting
              ? mode === "edit"
                ? "Updating…"
                : "Adding…"
              : mode === "edit"
                ? "Update Endpoint"
                : "Add Endpoint"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default EndpointModal;
