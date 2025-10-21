import { clsx } from "clsx";
import {
  ArrowLeftRight,
  Folder,
  Languages,
  Package,
  Route as RouteIcon,
  Trash2,
  Workflow,
} from "lucide-react";
import React from "react";

import { LAYER_STYLE_CLASSES } from "./diagrams/ArchitectureDiagram/constants";
import { DiagramCardSurface } from "./diagrams/DiagramCardSurface";

export interface ArtifactCardMetaRow {
  key?: string;
  icon: React.ReactNode;
  content: React.ReactNode;
  className?: string;
}

export interface ArtifactCardProps {
  name: string;
  data: any;
  onClick: () => void;
  onDelete?: () => void;
  className?: string;
  description?: string | null;
  metaRows?: ArtifactCardMetaRow[];
}

const coerceDisplayValue = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase() === "unknown" ? null : trimmed;
};

const resolveLayerClass = (data: any): string => {
  const resolvedType =
    data.type || data.metadata?.type || data.metadata?.detectedType || data.metadata?.category;
  const normalizedType = typeof resolvedType === "string" ? resolvedType.toLowerCase() : "";

  const colorKey = (() => {
    switch (normalizedType) {
      case "service":
        return "service";
      case "route":
        return "route";
      case "view":
        return "view";
      case "frontend":
        return "frontend";
      case "module":
        return "module";
      case "tool":
        return "tool";
      case "infrastructure":
        return "infrastructure";
      case "database":
      case "datastore":
        return "database";
      case "backend":
        return "backend";
      default:
        if (
          data.metadata?.detectedType === "frontend" ||
          data.metadata?.type === "frontend" ||
          (Array.isArray(data.metadata?.frameworks) && data.metadata.frameworks.length > 0)
        ) {
          return "frontend";
        }
        if (data.metadata?.engine || data.metadata?.database) {
          return "database";
        }
        return "external";
    }
  })();

  const classKey = colorKey as keyof typeof LAYER_STYLE_CLASSES;
  const fallbackClass: string = LAYER_STYLE_CLASSES.external ?? "";
  const layerClass = LAYER_STYLE_CLASSES[classKey];

  if (typeof layerClass === "string" && layerClass.length > 0) {
    return layerClass;
  }

  return fallbackClass;
};

export const ArtifactCard: React.FC<ArtifactCardProps> = ({
  name,
  data,
  onClick,
  onDelete,
  className,
  description,
  metaRows,
}) => {
  const layerClass = resolveLayerClass(data);

  const metadata = data?.metadata ?? {};

  const rawDescription =
    description ?? data.description ?? metadata.description ?? metadata.summary ?? null;
  const descriptionText = typeof rawDescription === "string" ? rawDescription.trim() : null;
  const truncatedDescription =
    descriptionText && descriptionText.length > 100
      ? `${descriptionText.substring(0, 100)}...`
      : descriptionText;

  const filepath = data.filepath || data.filePath || metadata.filePath || metadata.controllerPath;
  const packageName = data.package || metadata.packageName;
  const metadataLanguage = coerceDisplayValue(metadata.language || data.language);
  const metadataFramework = coerceDisplayValue(metadata.framework || data.framework);
  const displayPath = data.path || metadata.path || metadata.routePath;
  const rawMethods = metadata.httpMethods ?? data.httpMethods;
  const methods = Array.isArray(rawMethods)
    ? rawMethods
        .map((method) => String(method).trim())
        .filter((method, index, self) => method && self.indexOf(method) === index)
    : undefined;

  const handleDeleteClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onDelete?.();
  };

  return (
    <DiagramCardSurface interactive className={clsx(layerClass, className)} onClick={onClick}>
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
            className="rounded-full p-1 text-black/40 transition-colors hover:text-rose-600 focus:outline-none focus-visible:ring focus-visible:ring-rose-500/50 dark:text-black/40 dark:hover:text-rose-300"
            aria-label={`Delete ${data.name || name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {truncatedDescription && (
        <div className="text-xs mb-2 line-clamp-2 opacity-80">{truncatedDescription}</div>
      )}

      <div className="space-y-1 text-xs mt-2 opacity-80">
        {Array.isArray(metaRows) && metaRows.length > 0 ? (
          metaRows.filter(Boolean).map((row, index) => {
            if (!row) return null;
            const { key, icon, content, className: rowClassName } = row;
            const iconElement = React.isValidElement(icon)
              ? React.cloneElement(icon, {
                  className: clsx(
                    "w-3.5 h-3.5 text-black/40 dark:text-black/40",
                    icon.props.className,
                  ),
                })
              : icon;

            return (
              <div
                key={key ?? `meta-${index}`}
                className={clsx("flex items-center gap-2", rowClassName)}
              >
                {iconElement}
                {content}
              </div>
            );
          })
        ) : (
          <>
            {displayPath && (
              <div className="flex items-center gap-2">
                <RouteIcon className="w-3.5 h-3.5 text-black/40 dark:text-black/40" />
                <span className="font-mono opacity-100">{displayPath}</span>
              </div>
            )}
            {Array.isArray(methods) && methods.length > 0 && (
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-3.5 h-3.5 text-black/40 dark:text-black/40" />
                <span className="opacity-100 text-xs tracking-wide">{methods.join(", ")}</span>
              </div>
            )}
            {filepath && (
              <div className="flex items-center gap-2">
                <Folder className="w-3.5 h-3.5 text-black/40 dark:text-black/40" />
                <span className="font-mono opacity-100">{filepath}</span>
              </div>
            )}
            {metadataLanguage && (
              <div className="flex items-center gap-2">
                <Languages className="w-3.5 h-3.5 text-black/40 dark:text-black/40" />
                <span className="opacity-100 text-xs capitalize">{metadataLanguage}</span>
              </div>
            )}
            {metadataFramework && (
              <div className="flex items-center gap-2">
                <Workflow className="w-3.5 h-3.5 text-black/40 dark:text-black/40" />
                <span className="opacity-100 text-xs capitalize">{metadataFramework}</span>
              </div>
            )}
            {packageName && (
              <div className="flex items-center gap-2">
                <Package className="w-3.5 h-3.5 text-black/40 dark:text-black/40" />
                <span className="font-mono opacity-100">{packageName}</span>
              </div>
            )}
          </>
        )}
      </div>
    </DiagramCardSurface>
  );
};

export default ArtifactCard;
