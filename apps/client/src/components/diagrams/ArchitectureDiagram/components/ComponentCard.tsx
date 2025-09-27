import { clsx } from 'clsx';
import React from 'react';
import { LAYER_STYLE_CLASSES } from '../constants';

interface ComponentCardProps {
  name: string;
  data: any;
  onClick: () => void;
}

export const ComponentCard: React.FC<ComponentCardProps> = ({ name, data, onClick }) => {
  const normalizedType = (data.type || data.metadata?.type || '').toLowerCase();

  const colorKey = (() => {
    switch (normalizedType) {
      case 'service':
        return 'service';
      case 'route':
        return 'route';
      case 'view':
        return 'frontend';
      case 'module':
        return 'module';
      case 'tool':
        return 'tool';
      case 'infrastructure':
        return 'infrastructure';
      case 'database':
        return 'database';
      case 'frontend':
        return 'frontend';
      case 'backend':
        return 'backend';
      default:
        return 'external';
    }
  })();

  const rawDescription =
    data.description ?? data.metadata?.description ?? data.metadata?.summary ?? null;
  const descriptionText = typeof rawDescription === 'string' ? rawDescription.trim() : null;
  const truncatedDescription =
    descriptionText && descriptionText.length > 100
      ? `${descriptionText.substring(0, 100)}...`
      : descriptionText;

  const layerClass = LAYER_STYLE_CLASSES[colorKey as keyof typeof LAYER_STYLE_CLASSES]
    ? LAYER_STYLE_CLASSES[colorKey as keyof typeof LAYER_STYLE_CLASSES]
    : LAYER_STYLE_CLASSES.external;

  return (
    <div
      className={clsx(
        'p-3 border rounded-lg hover:shadow-sm transition-all cursor-pointer relative overflow-hidden',
        layerClass
      )}
      onClick={onClick}
    >
      {/* Component Name */}
      <h4 className="font-medium text-sm mb-1 relative">{data.name || name}</h4>

      {/* Component Description */}
      {truncatedDescription && (
        <div className="text-xs mb-2 line-clamp-2 opacity-80">{truncatedDescription}</div>
      )}

      {/* Filepath and Package */}
      <div className="space-y-1 text-xs mt-2 opacity-80">
        {data.filepath && (
          <div>
            <span className="font-semibold opacity-100">📁 Filepath:</span>{' '}
            <span className="font-mono opacity-100">{data.filepath}</span>
          </div>
        )}
        {data.package && (
          <div>
            <span className="font-semibold opacity-100">📦 Package:</span>{' '}
            <span className="font-mono opacity-100">{data.package}</span>
          </div>
        )}
      </div>
    </div>
  );
};
