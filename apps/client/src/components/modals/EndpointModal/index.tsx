/**
 * EndpointModal component for creating and editing HTTP endpoint definitions.
 * Provides a multi-section form for method, path, parameters, request body, and responses.
 */
import Button from "@/design-system/components/Button";
import Modal from "@/design-system/components/Modal";
import React, { useEffect, useMemo, useState } from "react";

import {
  AccordionHeader,
  EndpointSection,
  ParametersSection,
  RequestSection,
  ResponsesSection,
} from "./components";
import type { EndpointModalProps, SectionId } from "./types";
import { useEndpointForm } from "./useEndpointForm";
import {
  buildEndpointPayload,
  computeEndpointSummary,
  computeModalTitle,
  computeParameterSummary,
  computeRequestSummary,
  computeResponseSummary,
  validateEndpointForm,
} from "./utils";

/**
 * Modal form for creating and editing HTTP endpoint definitions.
 * Collapsible sections for endpoint details, request body, parameters, and responses.
 */
export function EndpointModal({
  open,
  onClose,
  onSubmit,
  groupLabel,
  mode = "create",
  initialValues = null,
}: EndpointModalProps) {
  const formState = useEndpointForm({ open, initialValues });
  const {
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
    handleRemoveParameter,
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
  } = formState;

  const [isDarkMode, setIsDarkMode] = useState(() =>
    typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : false,
  );

  useEffect(() => {
    if (typeof document === "undefined") return;

    const updateTheme = () => {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    };

    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);

  const modalTitle = useMemo(() => computeModalTitle(groupLabel, mode), [groupLabel, mode]);

  const isEndpointOpen = expandedSection === "endpoint";
  const isRequestOpen = expandedSection === "request";
  const isParametersOpen = expandedSection === "parameters";
  const isResponsesOpen = expandedSection === "responses";

  const endpointSummary = computeEndpointSummary(form.method, form.path);
  const requestSummary = computeRequestSummary(form.requestBody);
  const parameterSummary = computeParameterSummary(form.parameters.length);
  const responseSummary = computeResponseSummary(form.responses.length);

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

  const handleSectionToggle = (id: SectionId) => {
    setExpandedSection(id);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationErrors = validateEndpointForm(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const payload = buildEndpointPayload(form);
    if (!payload) {
      setErrors({ responses: "At least one response must include a status code" });
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(null);
      await onSubmit({
        entityType: payload.entityType,
        values: payload.values as Record<string, import("@/types/forms").FieldValue>,
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
        if (!submitting) onClose();
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
          {/* Endpoint Details Section */}
          <div className="space-y-3">
            <AccordionHeader
              id="endpoint"
              title="Endpoint Details"
              summary={endpointSummary}
              isOpen={isEndpointOpen}
              onToggle={handleSectionToggle}
            />
            {isEndpointOpen && (
              <EndpointSection
                form={form}
                submitting={submitting}
                errors={errors}
                updateForm={updateForm}
              />
            )}
          </div>

          {/* Request Body Section */}
          <div className="space-y-3 pt-4">
            <AccordionHeader
              id="request"
              title="Request Body"
              summary={requestSummary}
              isOpen={isRequestOpen}
              onToggle={handleSectionToggle}
            />
            {isRequestOpen && (
              <RequestSection
                form={form}
                submitting={submitting}
                errors={errors}
                isDarkMode={isDarkMode}
                jsonEditorOptions={jsonEditorOptions}
                updateForm={updateForm}
              />
            )}
          </div>

          {/* Parameters Section */}
          <div className="space-y-3 pt-4">
            <AccordionHeader
              id="parameters"
              title="Parameters"
              summary={parameterSummary}
              isOpen={isParametersOpen}
              onToggle={handleSectionToggle}
            />
            {isParametersOpen && (
              <ParametersSection
                form={form}
                submitting={submitting}
                activeParameterId={activeParameterId}
                selectedParameter={selectedParameter}
                parameterOptions={parameterOptions}
                parameterSelectValue={parameterSelectValue}
                handleParameterSelect={handleParameterSelect}
                handleRemoveParameter={handleRemoveParameter}
                updateParameter={updateParameter}
              />
            )}
          </div>

          {/* Responses Section */}
          <div className="space-y-3 pt-4">
            <AccordionHeader
              id="responses"
              title="Responses"
              summary={responseSummary}
              isOpen={isResponsesOpen}
              onToggle={handleSectionToggle}
            />
            {isResponsesOpen && (
              <ResponsesSection
                form={form}
                submitting={submitting}
                errors={errors}
                isDarkMode={isDarkMode}
                jsonEditorOptions={jsonEditorOptions}
                selectedResponse={selectedResponse}
                responseOptions={responseOptions}
                responseSelectValue={responseSelectValue}
                handleResponseSelect={handleResponseSelect}
                handleRemoveResponse={handleRemoveResponse}
                updateResponse={updateResponse}
              />
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
