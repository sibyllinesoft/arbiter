/**
 * ProjectCreationModal - Main modal for creating new projects
 */

import { Button } from "@design-system";
import { X } from "lucide-react";
import React from "react";
import { ImportProjectPane } from "./ImportProjectPane";
import { PresetCreationPane } from "./PresetCreationPane";

interface ProjectCreationModalProps {
  onClose: () => void;
  onNavigateToProject: (project: any) => void;
}

export function ProjectCreationModal({ onClose, onNavigateToProject }: ProjectCreationModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm dark:bg-black/60">
      <div className="flex h-[70vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl border border-[#2f394b] dark:border-[#242b3a] dark:bg-graphite-900 dark:shadow-graphite-950/40">
        <div className="flex-shrink-0 border-b border-graphite-300 bg-white p-6 dark:border-graphite-700 dark:bg-graphite-900">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Create New Project
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              leftIcon={<X className="w-4 h-4" />}
            >
              Close
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 flex-1 overflow-hidden">
          <PresetCreationPane onClose={onClose} />
          <ImportProjectPane onClose={onClose} onNavigateToProject={onNavigateToProject} />
        </div>
      </div>
    </div>
  );
}
