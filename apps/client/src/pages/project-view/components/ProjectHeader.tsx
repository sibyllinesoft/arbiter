/**
 * ProjectHeader - Navigation header for project view
 */

import { Button } from '@/design-system';
import type { Project } from '@/types/api';
import { ArrowLeft } from 'lucide-react';

interface ProjectHeaderProps {
  project: Project;
  onNavigateBack: () => void;
}

export function ProjectHeader({ project, onNavigateBack }: ProjectHeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<ArrowLeft className="w-4 h-4" />}
              onClick={onNavigateBack}
            >
              Back to Dashboard
            </Button>

            <div className="w-px h-6 bg-gray-300" />

            <div>
              <h1 className="text-xl font-semibold text-gray-900">{project.name}</h1>
              <p className="text-sm text-gray-500">Project workspace</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
