/**
 * ArchitectureReport - Standalone architecture diagram report component
 */

import React, { useCallback, useMemo, useState } from 'react';
import { ArchitectureDiagram } from './diagrams';
import type { ArchitectureEntityModalRequest } from './diagrams/ArchitectureDiagram/types';
import { AddEntityModal, type FieldValue } from './modals/AddEntityModal';
import { CapabilityModal } from './modals/CapabilityModal';
import EndpointModal from './modals/EndpointModal';

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
    [modalRequest]
  );

  const modalContent = useMemo(() => {
    if (!modalRequest) {
      return null;
    }

    if (modalRequest.type === 'capability') {
      return (
        <CapabilityModal
          open
          onClose={handleCloseModal}
          onSubmit={async payload => {
            await handleSubmit(payload);
          }}
          groupLabel={modalRequest.label}
        />
      );
    }

    if (modalRequest.type === 'route') {
      return (
        <EndpointModal
          open
          onClose={handleCloseModal}
          onSubmit={async payload => {
            await handleSubmit(payload);
          }}
          groupLabel={modalRequest.label}
          mode={modalRequest.mode ?? 'create'}
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
        mode={modalRequest.mode ?? 'create'}
        onSubmit={async payload => {
          await handleSubmit(payload);
        }}
      />
    );
  }, [modalRequest, handleCloseModal, handleSubmit]);

  return (
    <div className={`h-full ${className || ''}`}>
      <ArchitectureDiagram projectId={projectId} onOpenEntityModal={handleOpenEntityModal} />
      {modalContent}
    </div>
  );
}
