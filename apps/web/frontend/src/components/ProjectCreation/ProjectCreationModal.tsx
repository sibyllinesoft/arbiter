/**
 * ProjectCreationModal - Main modal for creating new projects
 */

import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@design-system';
import { PresetCreationPane } from './PresetCreationPane';
import { ImportProjectPane } from './ImportProjectPane';

interface ProjectCreationModalProps {
  onClose: () => void;
  onNavigateToProject: (project: any) => void;
}

export function ProjectCreationModal({ onClose, onNavigateToProject }: ProjectCreationModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Create New Project</h2>
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

        <div className="grid grid-cols-1 md:grid-cols-2 min-h-[500px] flex-1 min-h-0">
          <PresetCreationPane onClose={onClose} />
          <ImportProjectPane onClose={onClose} onNavigateToProject={onNavigateToProject} />
        </div>
      </div>
    </div>
  );
}
