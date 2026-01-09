import Card from "@design-system/components/Card";
import { clsx } from "clsx";
import { type ReactNode } from "react";

interface SplitViewShowcaseProps {
  title: string;
  description?: string;
  dataPanel: ReactNode;
  diagramPanel: ReactNode;
  dataPanelTitle?: string;
  diagramPanelTitle?: string;
  className?: string;
}

/** Panel configuration for split view */
interface PanelConfig {
  title: string;
  content: ReactNode;
  indicatorColor: string;
  contentClassName?: string;
}

/** Indicator dot component */
const PanelIndicator: React.FC<{ colorClass: string }> = ({ colorClass }) => (
  <span className={clsx("inline-block w-3 h-3 rounded-full mr-2", colorClass)} />
);

/** Reusable panel component */
const Panel: React.FC<PanelConfig> = ({ title, content, indicatorColor, contentClassName }) => (
  <Card className="flex flex-col">
    <div className="border-b border-gray-200 px-4 py-3">
      <h3 className="text-lg font-semibold text-gray-900 flex items-center">
        <PanelIndicator colorClass={indicatorColor} />
        {title}
      </h3>
    </div>
    <div className={clsx("flex-1 overflow-auto p-4", contentClassName)}>{content}</div>
  </Card>
);

export function SplitViewShowcase({
  title,
  description,
  dataPanel,
  diagramPanel,
  dataPanelTitle = "Specification Data",
  diagramPanelTitle = "Generated Diagram",
  className = "",
}: SplitViewShowcaseProps) {
  return (
    <div className={clsx("w-full h-full", className)}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
        {description && <p className="text-gray-600">{description}</p>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-200px)] min-h-[600px]">
        <Panel title={dataPanelTitle} content={dataPanel} indicatorColor="bg-blue-500" />
        <Panel
          title={diagramPanelTitle}
          content={diagramPanel}
          indicatorColor="bg-green-500"
          contentClassName="bg-gray-50"
        />
      </div>
    </div>
  );
}

export default SplitViewShowcase;
