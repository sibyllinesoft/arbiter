import { type ReactNode } from 'react';
import Card from '../../design-system/components/Card';

interface SplitViewShowcaseProps {
  title: string;
  description?: string;
  dataPanel: ReactNode;
  diagramPanel: ReactNode;
  dataPanelTitle?: string;
  diagramPanelTitle?: string;
  className?: string;
}

export function SplitViewShowcase({
  title,
  description,
  dataPanel,
  diagramPanel,
  dataPanelTitle = 'Specification Data',
  diagramPanelTitle = 'Generated Diagram',
  className = '',
}: SplitViewShowcaseProps) {
  return (
    <div className={`w-full h-full ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
        {description && <p className="text-gray-600">{description}</p>}
      </div>

      {/* Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-200px)] min-h-[600px]">
        {/* Data Panel */}
        <Card className="flex flex-col">
          <div className="border-b border-gray-200 px-4 py-3">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <span className="inline-block w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
              {dataPanelTitle}
            </h3>
          </div>
          <div className="flex-1 overflow-auto p-4">{dataPanel}</div>
        </Card>

        {/* Diagram Panel */}
        <Card className="flex flex-col">
          <div className="border-b border-gray-200 px-4 py-3">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <span className="inline-block w-3 h-3 bg-green-500 rounded-full mr-2"></span>
              {diagramPanelTitle}
            </h3>
          </div>
          <div className="flex-1 overflow-auto p-4 bg-gray-50">{diagramPanel}</div>
        </Card>
      </div>
    </div>
  );
}

export default SplitViewShowcase;
