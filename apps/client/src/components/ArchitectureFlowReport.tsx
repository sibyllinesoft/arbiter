import ArchitectureFlowDiagram from "@/components/diagrams/ArchitectureFlowDiagram";
import { Shield } from "lucide-react";
import React from "react";

interface ArchitectureFlowReportProps {
  projectId: string;
  className?: string;
}

const ArchitectureFlowReport: React.FC<ArchitectureFlowReportProps> = ({
  projectId,
  className,
}) => {
  return (
    <div className={`h-full flex flex-col bg-gray-50 dark:bg-graphite-950 ${className ?? ""}`}>
      <div className="border-b border-graphite-200/60 bg-gray-100 px-6 py-6 dark:border-graphite-700/60 dark:bg-graphite-900/70">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center text-emerald-600 dark:text-emerald-200">
            <Shield className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-graphite-25">
              Architecture
            </h2>
            <p className="text-sm text-gray-600 dark:text-graphite-300">
              Dependency-aware system map with React Flow auto-layout.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-4 py-4 md:px-6 md:py-6">
        <div className="h-full rounded-xl border border-gray-200 bg-white shadow-sm dark:border-graphite-700 dark:bg-graphite-900/40">
          <ArchitectureFlowDiagram projectId={projectId} />
        </div>
      </div>
    </div>
  );
};

export default ArchitectureFlowReport;
