import { clsx } from 'clsx';
import {
  ArrowLeftRight,
  Folder,
  Languages,
  Package,
  Route as RouteIcon,
  Trash2,
  Workflow,
} from 'lucide-react';
import React from 'react';
import { LAYER_STYLE_CLASSES } from '../constants';

interface ComponentCardProps {
  name: string;
  data: any;
  onClick: () => void;
  onDelete?: () => void;
}

const coerceDisplayValue = (raw: unknown): string | null => {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase() === 'unknown' ? null : trimmed;
};

export const ComponentCard: React.FC<ComponentCardProps> = ({ name, data, onClick, onDelete }) => {
  const resolvedType =
    data.type || data.metadata?.type || data.metadata?.detectedType || data.metadata?.category;
  const normalizedType = typeof resolvedType === 'string' ? resolvedType.toLowerCase() : '';

  const colorKey = (() => {
    switch (normalizedType) {
      case 'service':
        return 'service';
      case 'route':
        return 'route';
      case 'view':
        return 'view';
      case 'frontend':
        return 'frontend';
      case 'module':
        return 'module';
      case 'tool':
        return 'tool';
      case 'infrastructure':
        return 'infrastructure';
      case 'database':
      case 'datastore':
        return 'database';
      case 'backend':
        return 'backend';
      default:
        if (
          data.metadata?.detectedType === 'frontend' ||
          data.metadata?.type === 'frontend' ||
          (Array.isArray(data.metadata?.frameworks) && data.metadata.frameworks.length > 0)
        ) {
          return 'frontend';
        }
        if (data.metadata?.engine || data.metadata?.database) {
          return 'database';
        }
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

  const filepath =
    data.filepath || data.filePath || data.metadata?.filePath || data.metadata?.controllerPath;
  const packageName = data.package || data.metadata?.packageName;
  const metadataLanguage = coerceDisplayValue(data.metadata?.language || data.language);
  const metadataFramework = coerceDisplayValue(data.metadata?.framework || data.framework);
  const displayPath = data.path || data.metadata?.path || data.metadata?.routePath;
  const rawMethods = data.metadata?.httpMethods ?? data.httpMethods;
  const methods = Array.isArray(rawMethods)
    ? rawMethods
        .map(method => String(method).trim())
        .filter((method, index, self) => method && self.indexOf(method) === index)
    : undefined;

  const handleDeleteClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onDelete?.();
  };

  return (
    <div
      className={clsx(
        'p-3 border rounded-lg hover:shadow-sm transition-all cursor-pointer relative overflow-hidden',
        layerClass
      )}
      onClick={onClick}
    >
      {/* Component Name */}
      <div className="mb-1 flex items-start justify-between gap-2">
        <h4
          className="font-medium text-sm relative flex-1 text-left pr-2"
          title={data.name || name}
        >
          {data.name || name}
        </h4>
        {onDelete ? (
          <button
            type="button"
            onClick={handleDeleteClick}
            className="rounded-full p-1 text-gray-500 transition-colors hover:text-rose-600 focus:outline-none focus-visible:ring focus-visible:ring-rose-500/50 dark:text-graphite-300 dark:hover:text-rose-300"
            aria-label={`Delete ${data.name || name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {/* Component Description */}
      {truncatedDescription && (
        <div className="text-xs mb-2 line-clamp-2 opacity-80">{truncatedDescription}</div>
      )}

      {/* Filepath and Package */}
      <div className="space-y-1 text-xs mt-2 opacity-80">
        {displayPath && (
          <div className="flex items-center gap-2">
            <RouteIcon className="w-3.5 h-3.5 text-gray-500 dark:text-graphite-300" />
            <span className="font-mono opacity-100">{displayPath}</span>
          </div>
        )}
        {Array.isArray(methods) && methods.length > 0 && (
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-3.5 h-3.5 text-gray-500 dark:text-graphite-300" />
            <span className="opacity-100 text-xs tracking-wide">{methods.join(', ')}</span>
          </div>
        )}
        {filepath && (
          <div className="flex items-center gap-2">
            <Folder className="w-3.5 h-3.5 text-gray-500 dark:text-graphite-300" />
            <span className="font-mono opacity-100">{filepath}</span>
          </div>
        )}
        {Array.isArray(methods) && methods.length > 0 && (
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-3.5 h-3.5 text-gray-500 dark:text-graphite-300" />
            <span className="opacity-100 text-xs tracking-wide">{methods.join(', ')}</span>
          </div>
        )}
        {metadataLanguage && (
          <div className="flex items-center gap-2">
            <Languages className="w-3.5 h-3.5 text-gray-500 dark:text-graphite-300" />
            <span className="opacity-100 text-xs capitalize">{metadataLanguage}</span>
          </div>
        )}
        {metadataFramework && (
          <div className="flex items-center gap-2">
            <Workflow className="w-3.5 h-3.5 text-gray-500 dark:text-graphite-300" />
            <span className="opacity-100 text-xs capitalize">{metadataFramework}</span>
          </div>
        )}
        {packageName && (
          <div className="flex items-center gap-2">
            <Package className="w-3.5 h-3.5 text-gray-500 dark:text-graphite-300" />
            <span className="font-mono opacity-100">{packageName}</span>
          </div>
        )}
      </div>
    </div>
  );
};
