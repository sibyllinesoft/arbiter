import type { SelectOption } from "@/design-system/components/Select";
/**
 * Endpoint form hook for managing form state and handlers.
 * Provides complete state management for endpoint creation and editing.
 */
import { useCallback, useEffect, useMemo, useState } from "react";

import type { FieldValue } from "../entityTypes";
import {
  DEFAULT_REQUEST_BODY,
  HTTP_METHOD_VALUES,
  PARAMETER_DIVIDER_VALUE,
  PARAMETER_NEW_OPTION_VALUE,
  RESPONSE_DIVIDER_VALUE,
  RESPONSE_NEW_OPTION_VALUE,
} from "./constants";
import type {
  EndpointFormState,
  HttpMethod,
  ParameterFormState,
  ResponseFormState,
  SectionId,
} from "./types";
import { createParameter, createResponse } from "./utils";

/** Options for the endpoint form hook */
export interface UseEndpointFormOptions {
  /** Whether the form modal is open */
  open: boolean;
  /** Initial form values for editing */
  initialValues: Record<string, FieldValue> | null | undefined;
}

/**
 * Hook for managing endpoint form state.
 * Handles parameters, responses, validation, and submission.
 * @param options - Form configuration options
 * @returns Form state and handler functions
 */
export function useEndpointForm({ open, initialValues }: UseEndpointFormOptions) {
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
  const [expandedSection, setExpandedSection] = useState<SectionId>("endpoint");

  // Reset form when modal opens
  useEffect(() => {
    if (!open) return;
    setForm(buildInitialForm());
    setErrors({});
    setSubmitError(null);
    setActiveParameterId(null);
    setActiveResponseId(null);
    setExpandedSection("endpoint");
  }, [open, buildInitialForm]);

  // Sync active parameter when parameters change
  useEffect(() => {
    if (form.parameters.length === 0) {
      setActiveParameterId(null);
      return;
    }
    const fallbackId = form.parameters[0]?.id ?? null;
    setActiveParameterId((prev) => {
      if (prev && form.parameters.some((param) => param.id === prev)) return prev;
      return fallbackId;
    });
  }, [form.parameters]);

  // Sync active response when responses change
  useEffect(() => {
    if (form.responses.length === 0) {
      setActiveResponseId(null);
      return;
    }
    const fallbackId = form.responses[0]?.id ?? null;
    setActiveResponseId((prev) => {
      if (prev && form.responses.some((response) => response.id === prev)) return prev;
      return fallbackId;
    });
  }, [form.responses]);

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
        if (!filtered.length) return null;
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
      if (prev.responses.length === 1) return prev;
      const filtered = prev.responses.filter((response) => response.id !== id);
      setActiveResponseId((current) => {
        if (!filtered.length) return null;
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
        entry.id === id ? { ...entry, ...updates } : entry,
      ),
    }));
  }, []);

  const updateResponse = useCallback((id: string, updates: Partial<ResponseFormState>) => {
    setForm((prev) => ({
      ...prev,
      responses: prev.responses.map((entry) =>
        entry.id === id ? { ...entry, ...updates } : entry,
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
      if (Array.isArray(value)) return;
      if (value === PARAMETER_NEW_OPTION_VALUE) {
        handleAddParameter();
        return;
      }
      if (value === PARAMETER_DIVIDER_VALUE) return;
      setActiveParameterId(value);
    },
    [handleAddParameter],
  );

  const handleResponseSelect = useCallback(
    (value: string | string[]) => {
      if (Array.isArray(value)) return;
      if (value === RESPONSE_NEW_OPTION_VALUE) {
        handleAddResponse();
        return;
      }
      if (value === RESPONSE_DIVIDER_VALUE) return;
      setActiveResponseId(value);
    },
    [handleAddResponse],
  );

  return {
    form,
    errors,
    setErrors,
    submitting,
    setSubmitting,
    submitError,
    setSubmitError,
    expandedSection,
    setExpandedSection,
    updateForm,
    handleAddParameter,
    handleRemoveParameter,
    handleAddResponse,
    handleRemoveResponse,
    updateParameter,
    updateResponse,
    selectedParameter,
    selectedResponse,
    parameterOptions,
    responseOptions,
    parameterSelectValue,
    responseSelectValue,
    handleParameterSelect,
    handleResponseSelect,
    activeParameterId,
    activeResponseId,
  };
}
