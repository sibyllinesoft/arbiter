/**
 * ArchitectureReport - Standalone architecture diagram report component
 */

import clsx from "clsx";
import { Shield } from "lucide-react";
import React, { useCallback, useMemo, useState } from "react";
import { ArchitectureDiagram } from "./diagrams";
import type { ArchitectureEntityModalRequest } from "./diagrams/ArchitectureDiagram/types";
import { AddEntityModal, type FieldValue } from "./modals/AddEntityModal";
import { CapabilityModal } from "./modals/CapabilityModal";
import EndpointModal from "./modals/EndpointModal";

interface ArchitectureReportProps {
  projectId: string;
  className?: string;
}

export function ArchitectureReport({ projectId, className }: ArchitectureReportProps) {
  const [modalRequest, setModalRequest] = useState<ArchitectureEntityModalRequest | null>(null);

  const handleOpenEntityModal = useCallback((request: ArchitectureEntityModalRequest) => {
    setModalRequest(request);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalRequest(null);
  }, []);

  const handleSubmit = useCallback(
    async (payload: { entityType: string; values: Record<string, FieldValue> }) => {
      if (!modalRequest) {
        return;
      }
      await modalRequest.onSubmit(payload);
    },
    [modalRequest],
  );

  const modalContent = useMemo(() => {
    if (!modalRequest) {
      return null;
    }

    if (modalRequest.type === "capability") {
      return (
        <CapabilityModal
          open
          onClose={handleCloseModal}
          onSubmit={async (payload) => {
            await handleSubmit(payload);
          }}
          groupLabel={modalRequest.label}
        />
      );
    }

    if (modalRequest.type === "route") {
      return (
        <EndpointModal
          open
          onClose={handleCloseModal}
          onSubmit={async (payload) => {
            await handleSubmit(payload);
          }}
          groupLabel={modalRequest.label}
          mode={modalRequest.mode ?? "create"}
          initialValues={modalRequest.initialValues ?? null}
        />
      );
    }

    return (
      <AddEntityModal
        open
        entityType={modalRequest.type}
        groupLabel={modalRequest.label}
        optionCatalog={modalRequest.optionCatalog ?? { epicTaskOptions: [] }}
        onClose={handleCloseModal}
        {...(modalRequest.initialValues ? { initialValues: modalRequest.initialValues } : {})}
        {...(modalRequest.titleOverride ? { titleOverride: modalRequest.titleOverride } : {})}
        {...(modalRequest.descriptionOverride
          ? { descriptionOverride: modalRequest.descriptionOverride }
          : {})}
        mode={modalRequest.mode ?? "create"}
        onSubmit={async (payload) => {
          await handleSubmit(payload);
        }}
      />
    );
  }, [modalRequest, handleCloseModal, handleSubmit]);

  return (
    <div className={clsx("h-full flex flex-col bg-gray-50 dark:bg-graphite-950", className)}>
      <div className="border-b border-graphite-200/60 bg-gray-100 px-6 py-6 dark:border-graphite-700/60 dark:bg-graphite-900/70">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center text-emerald-600 dark:text-emerald-200">
              <Shield className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-graphite-25">
                System Architecture
              </h2>
              <p className="text-sm text-gray-600 dark:text-graphite-300">
                Visualize services, data stores, and infrastructure relationships across your
                project.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-6 py-6">
        <div className="h-full rounded-xl bg-white/60 shadow-sm dark:bg-graphite-900/40">
          <ArchitectureDiagram projectId={projectId} onOpenEntityModal={handleOpenEntityModal} />
        </div>
      </div>

      {modalContent}
    </div>
  );
}
