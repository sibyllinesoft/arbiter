/**
 * DiagramPlaceholder - Loading placeholder for diagrams
 */

interface DiagramPlaceholderProps {
  type: string;
}

export function DiagramPlaceholder({ type }: DiagramPlaceholderProps) {
  return (
    <div className="diagram-container">
      <div className="diagram-loading">
        <div className="text-center">
          <div className="spinner h-8 w-8 mb-4 mx-auto"></div>
          <p>{type} coming soon...</p>
          <p className="text-sm text-gray-400 mt-2">
            This will render interactive diagrams from the backend IR
          </p>
        </div>
      </div>
    </div>
  );
}
