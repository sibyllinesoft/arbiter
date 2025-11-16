import { GherkinEditor } from "@/components/Editor/GherkinEditor";
import { MarkdownField } from "@/components/form/MarkdownField";
import Button from "@/design-system/components/Button";
import Input from "@/design-system/components/Input";
import Modal from "@/design-system/components/Modal";
import React, { useEffect, useMemo, useState } from "react";
import type { FieldValue } from "./entityTypes";

interface CapabilityModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    entityType: string;
    values: Record<string, FieldValue>;
  }) => Promise<void> | void;
  groupLabel?: string;
}

interface CapabilityFormState {
  name: string;
  owner: string;
  description: string;
  gherkin: string;
}

const buildDefaultSpec = (name: string) =>
  `Feature: ${name || "Describe capability behaviour"}
  Scenario: Provide a meaningful outcome
    Given a relevant precondition
    When an action occurs
    Then the capability delivers value
`;

export function CapabilityModal({ open, onClose, onSubmit, groupLabel }: CapabilityModalProps) {
  const [form, setForm] = useState<CapabilityFormState>(() => ({
    name: "",
    owner: "",
    description: "",
    gherkin: buildDefaultSpec("New Capability"),
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setForm({
      name: "",
      owner: "",
      description: "",
      gherkin: buildDefaultSpec("New Capability"),
    });
    setErrors({});
    setSubmitError(null);
  }, [open]);

  const modalTitle = useMemo(() => {
    if (!groupLabel) {
      return "Add Capability";
    }
    return `Add ${groupLabel.endsWith("s") ? groupLabel.slice(0, -1) : groupLabel}`;
  }, [groupLabel]);

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, name: value }));
  };

  const handleOwnerChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, owner: event.target.value }));
  };

  const handleDescriptionChange = (value: string) => {
    setForm((prev) => ({ ...prev, description: value }));
  };

  const handleGherkinChange = (value: string) => {
    setForm((prev) => ({ ...prev, gherkin: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};

    if (!form.name.trim()) {
      nextErrors.name = "Name is required";
    }

    const gherkinSpec = form.gherkin.trim();
    if (!gherkinSpec) {
      nextErrors.gherkin = "Gherkin specification is required";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const values: Record<string, FieldValue> = {
      name: form.name.trim(),
    };

    if (form.owner.trim()) {
      values.owner = form.owner.trim();
    }
    if (form.description.trim()) {
      values.description = form.description.trim();
    }
    values.gherkin = gherkinSpec;

    try {
      setSubmitting(true);
      setSubmitError(null);
      await onSubmit({ entityType: "capability", values });
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save capability";
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
      description="Define the capability and capture its expected behaviour with Gherkin scenarios."
      size="xl"
      showDefaultFooter={false}
      className="bg-white text-graphite-900 dark:bg-graphite-900 dark:text-graphite-50 border border-gray-200 dark:border-graphite-700 shadow-2xl"
      containerClassName="px-4 py-6 sm:px-6"
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="capability-name"
              className="mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-100"
            >
              Name<span className="text-red-500">*</span>
            </label>
            <Input
              id="capability-name"
              value={form.name}
              onChange={handleNameChange}
              placeholder="Authentication"
              required
              disabled={submitting}
            />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
          </div>

          <div>
            <label
              htmlFor="capability-owner"
              className="mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-100"
            >
              Owner
            </label>
            <Input
              id="capability-owner"
              value={form.owner}
              onChange={handleOwnerChange}
              placeholder="backend-team"
              disabled={submitting}
            />
          </div>
        </div>

        <MarkdownField
          id="capability-description"
          label="Description"
          value={form.description}
          onChange={handleDescriptionChange}
          placeholder="Explain the capability, supporting systems, and desired outcomes."
          description="Optional: provide additional context for implementers."
          {...(errors.description ? { error: errors.description } : {})}
        />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-graphite-700 dark:text-graphite-100">
              Gherkin Specification<span className="text-red-500">*</span>
            </label>
            <span className="text-xs text-graphite-500 dark:text-graphite-300">
              Use Given/When/Then steps to describe expected behaviour.
            </span>
          </div>
          <div className="rounded-md border border-gray-200 dark:border-graphite-700 bg-white dark:bg-graphite-900">
            <GherkinEditor
              value={form.gherkin}
              onChange={handleGherkinChange}
              height={260}
              readOnly={submitting}
              className="[&_.monaco-editor]:rounded-md"
            />
          </div>
          {errors.gherkin && <p className="text-xs text-red-500">{errors.gherkin}</p>}
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
            {submitting ? "Saving…" : "Save Capability"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default CapabilityModal;
