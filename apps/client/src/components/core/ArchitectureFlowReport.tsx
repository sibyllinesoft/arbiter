import ArchitectureFlowDiagram from "@/components/diagrams/core/ArchitectureFlowDiagram";
import React from "react";

interface ArchitectureFlowReportProps {
  projectId: string;
  className?: string;
}

/**
 * Architecture Flow Report - wrapper for the multi-tier C4 architecture diagram.
 * The diagram now has its own MetadataRibbon and CommandPalette for navigation.
 */
const ArchitectureFlowReport: React.FC<ArchitectureFlowReportProps> = ({
  projectId,
  className,
}) => {
  return (
    <div className={`h-full w-full relative ${className ?? ""}`}>
      <ArchitectureFlowDiagram projectId={projectId} />
    </div>
  );
};

export default ArchitectureFlowReport;
