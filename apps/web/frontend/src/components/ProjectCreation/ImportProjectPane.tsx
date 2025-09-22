/**
 * ImportProjectPane - Right pane for importing projects from Git URL or GitHub
 */

import React from 'react';
import { Upload, GitBranch as GitIcon } from 'lucide-react';
import { cn } from '@design-system';
import { useUIState } from '@contexts/AppContext';
import { GitUrlImport } from './GitUrlImport';
import { GitHubProjectsImport } from './GitHubProjectsImport';

interface ImportProjectPaneProps {
  onClose: () => void;
  onNavigateToProject: (project: any) => void;
}

export function ImportProjectPane({ onClose, onNavigateToProject }: ImportProjectPaneProps) {
  const { modalTab, setModalTab } = useUIState();

  return (
    <div className="p-6 flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Import Project
        </h3>

        <div className="mb-6">
          <div className="flex border-b border-gray-200 mb-4">
            <button
              onClick={() => setModalTab('git')}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px',
                modalTab === 'git'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
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
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
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
