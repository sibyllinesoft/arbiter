import { clsx } from 'clsx';
import { ArrowLeftRight, Folder, Package, Route as RouteIcon } from 'lucide-react';
import React from 'react';
import { LAYER_STYLE_CLASSES } from '../constants';

interface ComponentCardProps {
  name: string;
  data: any;
  onClick: () => void;
}

export const ComponentCard: React.FC<ComponentCardProps> = ({ name, data, onClick }) => {
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
      case 'frontend':
        return 'frontend';
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
  const metadataLanguage = data.metadata?.language || data.language;
  const metadataFramework = data.metadata?.framework || data.framework;
  const displayPath = data.path || data.metadata?.path || data.metadata?.routePath;
  const rawMethods = data.metadata?.httpMethods ?? data.httpMethods;
  const methods = Array.isArray(rawMethods)
    ? rawMethods
        .map(method => String(method).trim())
        .filter((method, index, self) => method && self.indexOf(method) === index)
    : undefined;

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
            <span className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-graphite-400">
              Language
            </span>
            <span className="opacity-100 text-xs">{String(metadataLanguage)}</span>
          </div>
        )}
        {metadataFramework && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-graphite-400">
              Framework
            </span>
            <span className="opacity-100 text-xs">{String(metadataFramework)}</span>
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
