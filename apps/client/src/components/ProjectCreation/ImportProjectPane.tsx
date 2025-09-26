/**
 * ImportProjectPane - Right pane for importing projects from Git URL or GitHub
 */

import { useUIState } from '@contexts/AppContext';
import { cn } from '@design-system';
import { GitBranch as GitIcon, Upload } from 'lucide-react';
import React from 'react';
import { GitHubProjectsImport } from './GitHubProjectsImport';
import { GitUrlImport } from './GitUrlImport';

interface ImportProjectPaneProps {
  onClose: () => void;
  onNavigateToProject: (project: any) => void;
}

export function ImportProjectPane({ onClose, onNavigateToProject }: ImportProjectPaneProps) {
  const { modalTab, setModalTab } = useUIState();

  return (
    <div className="flex h-full flex-col overflow-hidden p-6">
      <div className="flex-shrink-0">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
          <Upload className="w-5 h-5" />
          Import Project
        </h3>

        <div className="mb-6">
          <div className="mb-4 flex border-b border-gray-200 dark:border-graphite-700">
            <button
              onClick={() => setModalTab('git')}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px',
                modalTab === 'git'
                  ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-300'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-graphite-300 dark:hover:text-graphite-100'
              )}
            >
              <GitIcon className="w-4 h-4 inline mr-2" />
              Git URL
            </button>
            <button
              onClick={() => setModalTab('github')}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px',
                modalTab === 'github'
                  ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-300'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-graphite-300 dark:hover:text-graphite-100'
              )}
            >
              <GitIcon className="w-4 h-4 inline mr-2" />
              GitHub Projects
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {modalTab === 'git' && <GitUrlImport onClose={onClose} />}
        {modalTab === 'github' && <GitHubProjectsImport onClose={onClose} />}
      </div>
    </div>
  );
}
