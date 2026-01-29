/**
 * Architecture Flow Diagram component using ReactFlow.
 * Renders an interactive service dependency graph with deployment grouping.
 * Supports multi-tier C4-like navigation: System → Container → Module → Code
 *
 * C4 mapping for Arbiter:
 * - System: Groups (deployment groups, compose stacks, k8s clusters)
 * - Container: Packages, Services, Clouds
 * - Module: Endpoints, Views, Infrastructure inside containers
 * - Code: Future expansion (not currently implemented)
 */
import { ArtifactCard } from "@/components/core/ArtifactCard";
import { LAYER_STYLE_CLASSES } from "@/components/diagrams/ArchitectureDiagram/constants";
import { useDiagramPositions } from "@/hooks/useDiagramPositions";
import { apiService } from "@/services/api";
import {
  CELL_HEIGHT,
  CELL_WIDTH,
  type DependencyEdge,
  type DependencyNode,
  type DeploymentGroup,
  PARENT_HEADER_HEIGHT as GRID_HEADER_HEIGHT,
  MIN_CONTAINER_HEIGHT as GRID_MIN_CONTAINER_HEIGHT,
  PARENT_PADDING as GRID_PADDING,
  type GridSizeContext,
  MAX_COLS,
  MIN_CONTAINER_WIDTH,
  TOP_LEVEL_CELL_HEIGHT,
  TOP_LEVEL_CELL_WIDTH,
  TOP_LEVEL_GAP,
  TOP_LEVEL_MAX_COLS,
  buildArchitectureFlowGraph,
  calculateGridLayout,
  calculateParentDimensions,
  calculateTopLevelGridLayout,
} from "@/utils/diagramTransformers";
import { clsx } from "clsx";
import {
  ArrowLeft,
  Box,
  ChevronDown,
  ChevronRight,
  Cloud,
  Code,
  Expand,
  Layers,
  Package,
  Plus,
  Shrink,
  Trash2,
  User,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Connection, EdgeProps, Node, NodeTypes } from "reactflow";
import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  addEdge,
  getBezierPath,
  useEdgesState,
  useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";

/** C4 abstraction levels adapted for Arbiter */
type C4Level = "system" | "container" | "module" | "code";

/** Navigation breadcrumb item */
interface BreadcrumbItem {
  level: C4Level;
  id: string;
  name: string;
  data?: Record<string, unknown> | undefined;
}

/** Selected entity for metadata display */
interface SelectedEntity {
  id: string;
  name: string;
  type: string;
  description?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
  level: C4Level;
}

/** Generic artifact record type */
type ArtifactLike = Record<string, unknown> | undefined;

/** Props for the ArchitectureFlowDiagram component */
interface ArchitectureFlowDiagramProps {
  projectId: string;
  /** Initial C4 level to display */
  initialLevel?: C4Level;
}

/** C4 level display configuration */
const C4_LEVEL_CONFIG: Record<C4Level, { label: string; icon: typeof Layers; color: string }> = {
  system: { label: "System", icon: Layers, color: "#7c3aed" },
  container: { label: "Container", icon: Package, color: "#059669" },
  module: { label: "Module", icon: Box, color: "#2563eb" },
  code: { label: "Code", icon: Code, color: "#dc2626" },
};

/** Get the next level down in the C4 hierarchy */
const getNextLevel = (current: C4Level): C4Level | null => {
  const hierarchy: C4Level[] = ["system", "container", "module", "code"];
  const idx = hierarchy.indexOf(current);
  return idx < hierarchy.length - 1 ? hierarchy[idx + 1]! : null;
};

/** Get the previous level up in the C4 hierarchy */
const getPreviousLevel = (current: C4Level): C4Level | null => {
  const hierarchy: C4Level[] = ["system", "container", "module", "code"];
  const idx = hierarchy.indexOf(current);
  return idx > 0 ? hierarchy[idx - 1]! : null;
};

/** Determine which C4 level an artifact belongs to */
const getArtifactLevel = (artifactType: string): C4Level => {
  const type = artifactType.toLowerCase();
  // System level: deployment groups, compose stacks, k8s clusters
  if (type.includes("group") || type.includes("cluster") || type.includes("stack")) {
    return "system";
  }
  // Container level: packages, services, databases, clouds
  if (
    type.includes("service") ||
    type.includes("package") ||
    type.includes("database") ||
    type.includes("cloud") ||
    type.includes("frontend") ||
    type === "api"
  ) {
    return "container";
  }
  // Module level: endpoints, views, infrastructure
  if (
    type.includes("endpoint") ||
    type.includes("view") ||
    type.includes("route") ||
    type.includes("infra")
  ) {
    return "module";
  }
  // Default to container level for backwards compatibility
  return "container";
};

/** Metadata Ribbon Component - displays selected entity information */
const MetadataRibbon: React.FC<{
  selected: SelectedEntity | null;
  breadcrumbs: BreadcrumbItem[];
  currentLevel: C4Level;
  onNavigateBack: () => void;
  onBreadcrumbClick: (index: number) => void;
}> = ({ selected, breadcrumbs, currentLevel, onNavigateBack, onBreadcrumbClick }) => {
  const levelConfig = C4_LEVEL_CONFIG[currentLevel];
  const LevelIcon = levelConfig.icon;
  const canGoBack = breadcrumbs.length > 0;

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-graphite-900 border-b border-gray-200 dark:border-graphite-700">
      {/* Back Arrow */}
      <button
        onClick={onNavigateBack}
        disabled={!canGoBack}
        className={clsx(
          "flex items-center justify-center w-8 h-8 rounded-lg transition-colors",
          canGoBack
            ? "hover:bg-gray-100 dark:hover:bg-graphite-800 text-gray-700 dark:text-graphite-200 cursor-pointer"
            : "text-gray-300 dark:text-graphite-600 cursor-not-allowed",
        )}
        title={canGoBack ? "Go back" : "At top level"}
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1 text-sm min-w-0">
        <button
          onClick={() => onBreadcrumbClick(-1)}
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-graphite-800 text-gray-600 dark:text-graphite-300 whitespace-nowrap"
        >
          <Layers className="w-4 h-4" />
          <span>All Systems</span>
        </button>
        {breadcrumbs.map((crumb, idx) => {
          const CrumbIcon = C4_LEVEL_CONFIG[crumb.level].icon;
          return (
            <React.Fragment key={`${idx}-${crumb.id}`}>
              <ChevronRight className="w-4 h-4 text-gray-400 dark:text-graphite-500 flex-shrink-0" />
              <button
                onClick={() => onBreadcrumbClick(idx)}
                className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-graphite-800 text-gray-600 dark:text-graphite-300 whitespace-nowrap"
              >
                <CrumbIcon className="w-4 h-4" />
                <span>{crumb.name}</span>
              </button>
            </React.Fragment>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="h-6 w-px bg-gray-200 dark:bg-graphite-700" />

      {/* Current Level Indicator */}
      <div
        className="flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium"
        style={{ backgroundColor: `${levelConfig.color}20`, color: levelConfig.color }}
      >
        <LevelIcon className="w-4 h-4" />
        <span>{levelConfig.label} View</span>
      </div>

      {/* Selected Entity Metadata */}
      {selected && (
        <>
          <div className="h-6 w-px bg-gray-200 dark:bg-graphite-700" />
          <div className="flex-1 flex items-center gap-3 min-w-0">
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-gray-900 dark:text-graphite-100 truncate">
                {selected.name}
              </span>
              <span className="text-xs text-gray-500 dark:text-graphite-400 truncate">
                {selected.type}
                {selected.description && ` • ${selected.description}`}
              </span>
            </div>
            {selected.metadata && Object.keys(selected.metadata).length > 0 && (
              <div className="hidden lg:flex items-center gap-2 text-xs">
                {selected.metadata.language ? (
                  <span className="px-2 py-0.5 bg-gray-100 dark:bg-graphite-800 rounded text-gray-600 dark:text-graphite-300">
                    {String(selected.metadata.language)}
                  </span>
                ) : null}
                {selected.metadata.framework ? (
                  <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 rounded text-blue-700 dark:text-blue-300">
                    {String(selected.metadata.framework)}
                  </span>
                ) : null}
                {selected.metadata.version ? (
                  <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 rounded text-green-700 dark:text-green-300">
                    v{String(selected.metadata.version)}
                  </span>
                ) : null}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

/** Command palette action definition */
interface PaletteAction {
  id: string;
  label: string;
  icon: typeof Plus;
  category: "create" | "delete" | "connect";
  entityType?: string | undefined;
  /** Subtype for classification (e.g., "web", "android" for frontend) */
  subtype?: string | undefined;
  disabled?: boolean | undefined;
  tooltip?: string | undefined;
}

/** Dropdown group with multiple actions */
interface PaletteDropdown {
  id: string;
  label: string;
  icon: typeof Plus;
  items: PaletteAction[];
}

import {
  type DropdownConfig,
  type EntityTypeConfig,
  getRibbonConfigForEntity,
} from "./ribbonConfig";

/** Convert ribbon config to palette actions */
const configToButtons = (configs: EntityTypeConfig[]): PaletteAction[] =>
  configs.map((c) => ({
    id: `create-${c.id}`,
    label: c.label,
    icon: c.icon,
    category: "create" as const,
    entityType: c.entityType,
    tooltip: c.description,
    subtype: c.subtype,
  }));

/** Convert ribbon dropdown config to palette dropdown */
const configToDropdown = (config: DropdownConfig): PaletteDropdown => ({
  id: config.id,
  label: config.label,
  icon: config.icon,
  items: configToButtons(config.items),
});

/** Get single-click buttons based on selected entity context */
const getButtonsForContext = (selectedEntity: SelectedEntity | null): PaletteAction[] => {
  const ribbonConfig = getRibbonConfigForEntity(selectedEntity?.type ?? null);
  return configToButtons(ribbonConfig.buttons);
};

/** Get dropdowns based on selected entity context */
const getDropdownsForContext = (selectedEntity: SelectedEntity | null): PaletteDropdown[] => {
  const ribbonConfig = getRibbonConfigForEntity(selectedEntity?.type ?? null);
  return ribbonConfig.dropdowns.map(configToDropdown);
};

/** Dropdown Button Component */
const DropdownButton: React.FC<{
  dropdown: PaletteDropdown;
  onAction: (action: PaletteAction) => void;
}> = ({ dropdown, onAction }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as globalThis.Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors",
          isOpen
            ? "bg-gray-200 dark:bg-graphite-700 text-gray-900 dark:text-white"
            : "text-gray-700 dark:text-graphite-200 hover:bg-gray-200 dark:hover:bg-graphite-700",
        )}
      >
        <dropdown.icon className="w-3.5 h-3.5" />
        <span>{dropdown.label}</span>
        <ChevronDown className={clsx("w-3 h-3 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 py-1 bg-white dark:bg-graphite-800 border border-gray-200 dark:border-graphite-600 rounded-lg shadow-lg z-50 min-w-[160px]">
          {dropdown.items.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onAction(item);
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-gray-700 dark:text-graphite-200 hover:bg-gray-100 dark:hover:bg-graphite-700 transition-colors"
            >
              <item.icon className="w-4 h-4 text-gray-500 dark:text-graphite-400" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/** Command Palette Component - shows available actions for current context */
const CommandPalette: React.FC<{
  selectedEntity: SelectedEntity | null;
  onAction: (action: PaletteAction) => void;
}> = ({ selectedEntity, onAction }) => {
  const buttons = useMemo(() => getButtonsForContext(selectedEntity), [selectedEntity]);
  const dropdowns = useMemo(() => getDropdownsForContext(selectedEntity), [selectedEntity]);

  // Context label for the ribbon
  const contextLabel = useMemo(() => {
    if (!selectedEntity) return "Canvas";
    const type = selectedEntity.type.toLowerCase();
    if (type === "system" || type.includes("cloud")) return `${selectedEntity.name}`;
    return selectedEntity.name;
  }, [selectedEntity]);

  return (
    <div className="flex items-center gap-1 px-4 py-2 bg-gray-50 dark:bg-graphite-900/50 border-b border-gray-200 dark:border-graphite-700">
      {/* Context indicator */}
      <span className="text-xs font-medium text-gray-500 dark:text-graphite-400 mr-1">
        {selectedEntity ? `Add to ${contextLabel}:` : "Add:"}
      </span>

      {/* Single-click buttons */}
      <div className="flex items-center gap-1">
        {buttons.map((btn) => {
          const BtnIcon = btn.icon;
          return (
            <button
              key={btn.id}
              onClick={() => onAction(btn)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors text-gray-700 dark:text-graphite-200 hover:bg-gray-200 dark:hover:bg-graphite-700"
            >
              <BtnIcon className="w-3.5 h-3.5" />
              <span>{btn.label}</span>
            </button>
          );
        })}
      </div>

      {/* Dropdown groups */}
      <div className="flex items-center gap-1">
        {dropdowns.map((dropdown) => (
          <DropdownButton key={dropdown.id} dropdown={dropdown} onAction={onAction} />
        ))}
      </div>

      {/* Hint when actor is selected (no add actions) */}
      {selectedEntity && buttons.length === 0 && dropdowns.length === 0 && (
        <span className="text-xs text-gray-400 dark:text-graphite-500 italic">
          No child entities for this type
        </span>
      )}

      {/* Divider before selection actions */}
      {selectedEntity && (
        <>
          <div className="h-5 w-px bg-gray-300 dark:bg-graphite-600 mx-2" />

          {/* Delete action */}
          <button
            onClick={() =>
              onAction({ id: "delete", label: "Delete", icon: Trash2, category: "delete" })
            }
            title={`Delete ${selectedEntity.name}`}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </>
      )}

      {/* Hint text when nothing selected */}
      {!selectedEntity && (
        <span className="ml-auto text-xs text-gray-400 dark:text-graphite-500 italic">
          Click a node to add children, drag handles to connect
        </span>
      )}
    </div>
  );
};

/** Default node dimensions for layout calculations */
const NODE_WIDTH = 280;
const NODE_HEIGHT = 140;

/** Get CSS class for a layer based on artifact type */
const layerColorForType = (type: string): string => {
  const normalized = type.toLowerCase();
  const colorKey =
    normalized === "database" || normalized === "datastore"
      ? "database"
      : normalized === "frontend" || normalized === "client"
        ? "frontend"
        : normalized === "service"
          ? "service"
          : normalized === "infrastructure"
            ? "infrastructure"
            : "external";
  return LAYER_STYLE_CLASSES[colorKey as keyof typeof LAYER_STYLE_CLASSES] ?? "";
};

/** Handle styles for connection points - larger hit area for easier clicking */
const handleStyle: React.CSSProperties = {
  width: 12,
  height: 12,
  background: "#9ca3af",
  border: "2px solid white",
  cursor: "crosshair",
};

/** Handle styles for system-level nodes - blue to match border */
const systemHandleStyle: React.CSSProperties = {
  width: 12,
  height: 12,
  background: "#60a5fa", // blue-400
  border: "2px solid #3b82f6", // blue-500
  cursor: "crosshair",
};

/** Get icon component for system-level entity types */
const getSystemLevelIcon = (type: string): typeof User | null => {
  const t = type.toLowerCase();
  if (t === "actor") return User;
  if (t === "system") return Box;
  if (t.includes("cloud")) return Cloud;
  return null;
};

/** Check if type is a system-level entity (actor, system, or cloud) */
const isSystemLevelType = (type: string): boolean => {
  const t = type.toLowerCase();
  return t === "actor" || t === "system" || t.includes("cloud");
};

/** Check if a type can contain children (expandable) */
const isExpandableType = (type: string): boolean => {
  const t = type.toLowerCase();
  // Actors can't contain children, everything else that's system-level can
  if (t === "actor") return false;
  // Systems, clouds, services, frontends, databases, etc. can all be expanded
  return (
    t === "system" ||
    t.includes("cloud") ||
    t.includes("service") ||
    t.includes("frontend") ||
    t.includes("api") ||
    t.includes("package") ||
    t.includes("database") ||
    t.includes("cache") ||
    t.includes("queue") ||
    t.includes("storage")
  );
};

/** Editable label component for node names */
const EditableLabel: React.FC<{
  value: string;
  onSave: ((newValue: string) => void) | undefined;
  className?: string;
}> = ({ value, onSave, className }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== value && onSave) {
      onSave(trimmed);
    } else {
      setEditValue(value); // Reset if empty or unchanged
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      setEditValue(value);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        className={clsx(
          "bg-transparent border-b border-current outline-none text-center w-full",
          className,
        )}
      />
    );
  }

  return (
    <span
      onClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      className={clsx(
        "cursor-text hover:bg-black/10 dark:hover:bg-white/10 px-1 rounded transition-colors",
        className,
      )}
      title="Click to edit"
    >
      {value}
    </span>
  );
};

/** ReactFlow node component for displaying service artifacts */
const ArchitectureFlowNode: React.FC<{ data: DependencyNode["data"]; selected?: boolean }> = ({
  data,
  selected,
}) => {
  const artifactType = data?.artifactType ?? data?.artifact?.type ?? "external";
  const layerClass = layerColorForType(artifactType);
  const isExpanded = data?.isExpanded ?? false;

  // System-level entities (actors, clouds, systems) get special icon-based rendering
  if (isSystemLevelType(artifactType)) {
    const IconComponent = getSystemLevelIcon(artifactType);
    const isActor = artifactType.toLowerCase() === "actor";

    // Shared handles for both states
    const handles = (
      <>
        <Handle
          id="top"
          type="target"
          position={Position.Top}
          style={{ ...systemHandleStyle, top: -6 }}
          className="hover:!ring-2 hover:!ring-blue-300 hover:!ring-offset-1 transition-shadow !rounded-full"
        />
        <Handle
          id="bottom"
          type="source"
          position={Position.Bottom}
          style={{ ...systemHandleStyle, bottom: -6 }}
          className="hover:!ring-2 hover:!ring-blue-300 hover:!ring-offset-1 transition-shadow !rounded-full"
        />
        <Handle
          id="left"
          type="target"
          position={Position.Left}
          style={{ ...systemHandleStyle, left: -6 }}
          className="hover:!ring-2 hover:!ring-blue-300 hover:!ring-offset-1 transition-shadow !rounded-full"
        />
        <Handle
          id="right"
          type="source"
          position={Position.Right}
          style={{ ...systemHandleStyle, right: -6 }}
          className="hover:!ring-2 hover:!ring-blue-300 hover:!ring-offset-1 transition-shadow !rounded-full"
        />
      </>
    );

    // Expanded state: render as a container window (children are real ReactFlow nodes positioned inside)
    if (isExpanded && !isActor) {
      return (
        <div
          className={clsx(
            "relative flex flex-col rounded-2xl border-2 bg-gray-50/80 dark:bg-graphite-900/80 shadow-lg transition-all duration-300 ease-out w-full h-full min-w-[300px] min-h-[200px]",
            selected ? "border-blue-300 ring-2 ring-blue-300/50" : "border-blue-400",
          )}
        >
          {handles}
          {/* Window title bar */}
          <div className="flex items-center justify-between px-3 py-2 bg-blue-500/20 dark:bg-blue-600/30 rounded-t-xl border-b border-blue-400/50">
            <div className="flex items-center gap-2">
              <button
                className="p-1.5 rounded hover:bg-blue-500/30 dark:hover:bg-blue-400/30 transition-colors"
                title="Collapse"
                onClick={(e) => {
                  e.stopPropagation();
                  data.onCollapse?.();
                }}
              >
                <Shrink className="w-4 h-4 text-blue-600 dark:text-blue-300" />
              </button>
              {IconComponent && (
                <IconComponent className="w-5 h-5 text-blue-600 dark:text-blue-300" />
              )}
              <EditableLabel
                value={data.title}
                onSave={data.onRename}
                className="text-sm font-semibold text-blue-700 dark:text-blue-200"
              />
            </div>
            <button
              className="p-1.5 rounded hover:bg-blue-500/30 dark:hover:bg-blue-400/30 transition-colors"
              title="Delete"
              onClick={(e) => {
                e.stopPropagation();
                data.onDelete?.();
              }}
            >
              <Trash2 className="w-4 h-4 text-blue-600 dark:text-blue-300" />
            </button>
          </div>
          {/* Container area - children are rendered as separate ReactFlow nodes inside */}
          <div className="flex-1 rounded-b-xl" />
        </div>
      );
    }

    // Collapsed state: render as icon node with smooth transition
    return (
      <div
        className={clsx(
          "relative flex flex-col items-center justify-center w-36 h-36 rounded-2xl border-2 bg-blue-500/20 dark:bg-blue-600/30 px-3 py-4 transition-all duration-300 ease-out",
          selected ? "border-blue-300 ring-2 ring-blue-300/50" : "border-blue-400",
        )}
      >
        {handles}
        {/* Top-left expand button - only for expandable types (not actors) */}
        {!isActor && (
          <button
            className="absolute top-2 left-2 p-1.5 rounded hover:bg-blue-500/30 dark:hover:bg-blue-400/30 transition-colors"
            title="Expand"
            onClick={(e) => {
              e.stopPropagation();
              data.onExpand?.();
            }}
          >
            <Expand className="w-4 h-4 text-blue-600 dark:text-blue-300" />
          </button>
        )}
        {/* Top-right trash button */}
        <button
          className="absolute top-2 right-2 p-1.5 rounded hover:bg-blue-500/30 dark:hover:bg-blue-400/30 transition-colors"
          title="Delete"
          onClick={(e) => {
            e.stopPropagation();
            data.onDelete?.();
          }}
        >
          <Trash2 className="w-4 h-4 text-blue-600 dark:text-blue-300" />
        </button>
        {/* Large centered icon */}
        {IconComponent && <IconComponent className="w-14 h-14 text-blue-600 dark:text-blue-300" />}
        {/* Label */}
        <div className="mt-2 text-sm font-semibold text-blue-700 dark:text-blue-200 text-center max-w-[120px]">
          <EditableLabel value={data.title} onSave={data.onRename} />
        </div>
      </div>
    );
  }

  // Icon-based rendering for container/module level entities (services, frontends, etc.)
  // Use different colors based on type - includes handle colors to match borders
  const getTypeColor = (type: string) => {
    const t = type.toLowerCase();
    if (
      t.includes("frontend") ||
      t.includes("client") ||
      t.includes("web") ||
      t.includes("mobile")
    ) {
      return {
        border: "border-emerald-400",
        selectedBorder: "border-emerald-300 ring-2 ring-emerald-300/50",
        bg: "bg-emerald-500/20 dark:bg-emerald-600/30",
        text: "text-emerald-600 dark:text-emerald-300",
        handle: { background: "#34d399", border: "2px solid #10b981" }, // emerald-400/500
      };
    }
    if (t.includes("service") || t.includes("api") || t.includes("worker")) {
      return {
        border: "border-violet-400",
        selectedBorder: "border-violet-300 ring-2 ring-violet-300/50",
        bg: "bg-violet-500/20 dark:bg-violet-600/30",
        text: "text-violet-600 dark:text-violet-300",
        handle: { background: "#a78bfa", border: "2px solid #8b5cf6" }, // violet-400/500
      };
    }
    if (
      t.includes("database") ||
      t.includes("cache") ||
      t.includes("queue") ||
      t.includes("storage")
    ) {
      return {
        border: "border-amber-400",
        selectedBorder: "border-amber-300 ring-2 ring-amber-300/50",
        bg: "bg-amber-500/20 dark:bg-amber-600/30",
        text: "text-amber-600 dark:text-amber-300",
        handle: { background: "#fbbf24", border: "2px solid #f59e0b" }, // amber-400/500
      };
    }
    return {
      border: "border-gray-400",
      selectedBorder: "border-gray-300 ring-2 ring-gray-300/50",
      bg: "bg-gray-500/20 dark:bg-gray-600/30",
      text: "text-gray-600 dark:text-gray-300",
      handle: { background: "#9ca3af", border: "2px solid #6b7280" }, // gray-400/500
    };
  };

  const colors = getTypeColor(artifactType);
  const canExpand = isExpandableType(artifactType);

  // Expanded container for services/frontends/etc.
  if (isExpanded && canExpand) {
    const coloredHandleStyle = { ...handleStyle, ...colors.handle };
    return (
      <div
        className={clsx(
          "relative flex flex-col rounded-2xl border-2 bg-gray-50/80 dark:bg-graphite-900/80 shadow-lg transition-all duration-300 ease-out w-full h-full min-w-[300px] min-h-[200px]",
          selected ? colors.selectedBorder : colors.border,
        )}
      >
        <Handle
          id="top"
          type="target"
          position={Position.Top}
          style={{ ...coloredHandleStyle, top: -6 }}
          className="hover:!ring-2 hover:!ring-offset-1 transition-shadow !rounded-full"
        />
        <Handle
          id="bottom"
          type="source"
          position={Position.Bottom}
          style={{ ...coloredHandleStyle, bottom: -6 }}
          className="hover:!ring-2 hover:!ring-offset-1 transition-shadow !rounded-full"
        />
        <Handle
          id="left"
          type="target"
          position={Position.Left}
          style={{ ...coloredHandleStyle, left: -6 }}
          className="hover:!ring-2 hover:!ring-offset-1 transition-shadow !rounded-full"
        />
        <Handle
          id="right"
          type="source"
          position={Position.Right}
          style={{ ...coloredHandleStyle, right: -6 }}
          className="hover:!ring-2 hover:!ring-offset-1 transition-shadow !rounded-full"
        />
        {/* Title bar */}
        <div
          className={clsx(
            "flex items-center justify-between px-3 py-2 rounded-t-xl border-b",
            colors.bg,
            colors.border.replace("border-", "border-b-"),
          )}
        >
          <div className="flex items-center gap-2">
            <button
              className={clsx("p-1.5 rounded hover:bg-black/10 transition-colors", colors.text)}
              title="Collapse"
              onClick={(e) => {
                e.stopPropagation();
                data.onCollapse?.();
              }}
            >
              <Shrink className="w-4 h-4" />
            </button>
            <EditableLabel
              value={data.title}
              onSave={data.onRename}
              className={clsx("text-sm font-semibold", colors.text)}
            />
          </div>
          <button
            className={clsx("p-1.5 rounded hover:bg-black/10 transition-colors", colors.text)}
            title="Delete"
            onClick={(e) => {
              e.stopPropagation();
              data.onDelete?.();
            }}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 rounded-b-xl" />
      </div>
    );
  }

  // Collapsed icon-style node for container/module entities
  const coloredHandleStyle = { ...handleStyle, ...colors.handle };
  return (
    <div
      className={clsx(
        "relative flex flex-col items-center justify-center w-36 h-36 rounded-2xl border-2 px-3 py-4 transition-all duration-300 ease-out",
        selected ? colors.selectedBorder : colors.border,
        colors.bg,
      )}
    >
      <Handle
        id="top"
        type="target"
        position={Position.Top}
        style={{ ...coloredHandleStyle, top: -6 }}
        className="hover:!ring-2 hover:!ring-offset-1 transition-shadow !rounded-full"
      />
      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        style={{ ...coloredHandleStyle, bottom: -6 }}
        className="hover:!ring-2 hover:!ring-offset-1 transition-shadow !rounded-full"
      />
      <Handle
        id="left"
        type="target"
        position={Position.Left}
        style={{ ...coloredHandleStyle, left: -6 }}
        className="hover:!ring-2 hover:!ring-offset-1 transition-shadow !rounded-full"
      />
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        style={{ ...coloredHandleStyle, right: -6 }}
        className="hover:!ring-2 hover:!ring-offset-1 transition-shadow !rounded-full"
      />
      {canExpand && (
        <button
          className={clsx(
            "absolute top-2 left-2 p-1.5 rounded hover:bg-black/10 transition-colors",
            colors.text,
          )}
          title="Expand"
          onClick={(e) => {
            e.stopPropagation();
            data.onExpand?.();
          }}
        >
          <Expand className="w-4 h-4" />
        </button>
      )}
      <button
        className={clsx(
          "absolute top-2 right-2 p-1.5 rounded hover:bg-black/10 transition-colors",
          colors.text,
        )}
        title="Delete"
        onClick={(e) => {
          e.stopPropagation();
          data.onDelete?.();
        }}
      >
        <Trash2 className="w-4 h-4" />
      </button>
      {/* Icon based on type */}
      <Package className={clsx("w-14 h-14", colors.text)} />
      <div className={clsx("mt-2 text-sm font-semibold text-center max-w-[120px]", colors.text)}>
        <EditableLabel value={data.title} onSave={data.onRename} />
      </div>
    </div>
  );
};

/** Normalize file path separators to forward slashes */
const normalizePath = (value: string | undefined | null): string | null => {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\\/g, "/");
};

/** Color palette for deployment group borders */
const groupColors: Record<DeploymentGroup["kind"], string> = {
  compose: "#059669", // emerald-600
  kubernetes: "#7c3aed", // violet-600
};

/** Check if an artifact represents a deployment container (infrastructure type) */
const looksLikeDeploymentContainer = (
  artifact: ArtifactLike,
  artifactType: string,
  deploymentGroup: DeploymentGroup | null,
): boolean => {
  if (!deploymentGroup) return false;
  const rawType = (
    artifactType ||
    (artifact && typeof artifact === "object" ? (artifact as { type?: unknown }).type : "") ||
    ""
  )
    .toString()
    .toLowerCase();
  return rawType.includes("infra");
};

/** Data structure for deployment group nodes */
type GroupNodeData = {
  label: string;
  kind: DeploymentGroup["kind"];
  artifact?: ArtifactLike;
  artifactType?: string;
};

/** ReactFlow node component for rendering deployment group boundaries */
const GroupNode: React.FC<{ data: GroupNodeData }> = ({ data }) => {
  const color = groupColors[data.kind] ?? "transparent";
  const overlayBg = `${color}14`; // ~8% opacity
  const artifactData = data.artifact
    ? {
        ...(data.artifact as Record<string, unknown>),
        type: data.artifactType ?? (data.artifact as Record<string, unknown>)?.type,
      }
    : null;
  const title =
    typeof (artifactData as Record<string, unknown> | null)?.name === "string"
      ? ((artifactData as Record<string, unknown>).name as string)
      : data.label;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        boxSizing: "border-box",
        borderWidth: 2,
        borderStyle: "dashed",
        borderColor: color,
        borderRadius: 14,
        backgroundColor: `${color}12`, // very light tint, ensures no gray
        boxShadow: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 8,
          left: 8,
          maxWidth: 260,
          padding: "8px 12px",
          background: overlayBg,
          borderRadius: 10,
          color: "#0b1f1a",
          fontSize: 11,
          lineHeight: 1.4,
          boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 2 }}>{title}</div>
        <div style={{ opacity: 0.82 }}>{data.label}</div>
      </div>
    </div>
  );
};

/** Custom edge component with editable label */
const EditableEdge: React.FC<
  EdgeProps<{ label?: string; description?: string; onLabelChange?: (newLabel: string) => void }>
> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
  style,
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const label = data?.label || data?.description || "";

  return (
    <>
      <BaseEdge id={id} path={edgePath} {...(markerEnd ? { markerEnd } : {})} style={style ?? {}} />
      {(label || data?.onLabelChange) && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
            }}
            className="nodrag nopan"
          >
            <EditableLabel
              value={label || "click to add label"}
              onSave={data?.onLabelChange}
              className={clsx(
                "text-xs px-2 py-0.5 rounded bg-white/90 dark:bg-graphite-800/90 shadow-sm border border-gray-200 dark:border-graphite-600",
                !label && "text-gray-400 dark:text-graphite-500 italic",
              )}
            />
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

/** Node type registry for ReactFlow */
// Cast needed due to exactOptionalPropertyTypes conflict with ReactFlow's NodeProps
const nodeTypesWithGroups: NodeTypes = {
  card: ArchitectureFlowNode,
  group: GroupNode,
} as unknown as NodeTypes;

/** Edge type registry for ReactFlow */
const edgeTypes = { editable: EditableEdge };

/** Extract compose file path from artifact metadata */
const extractComposeFile = (meta: Record<string, unknown>, artifact: ArtifactLike): string | null =>
  normalizePath(
    (meta as any).composeFile ||
      (meta as any).compose_file ||
      (artifact?.filePath as string | null),
  );

/** Extract kubernetes cluster name from artifact metadata */
const extractKubernetesCluster = (meta: Record<string, unknown>): string | null => {
  const cluster =
    (meta as any).cluster || (meta as any).kubeCluster || (meta as any).kubernetesCluster;
  return cluster && typeof cluster === "string" ? cluster : null;
};

/** Build a compose deployment group */
const buildComposeGroup = (composeFile: string | null, artifact: ArtifactLike): DeploymentGroup => {
  const artifactType =
    typeof (artifact as any)?.type === "string" ? ((artifact as any).type as string) : undefined;
  const label = composeFile ? `Compose: ${composeFile.split("/").pop()}` : "Compose stack";
  return {
    key: composeFile || "compose-stack",
    label,
    kind: "compose",
    ...(artifact ? { artifact: artifact as Record<string, unknown> } : {}),
    ...(artifactType ? { artifactType } : {}),
    members: [],
  };
};

/** Build a kubernetes deployment group */
const buildKubernetesGroup = (cluster: string): DeploymentGroup => ({
  key: `k8s:${cluster}`,
  label: `Cluster: ${cluster}`,
  kind: "kubernetes",
  members: [],
});

/** Extract deployment group info from artifact metadata (compose or kubernetes) */
const deriveDeploymentGroup = (artifact: ArtifactLike): DeploymentGroup | null => {
  const meta = (artifact?.metadata as Record<string, unknown>) ?? {};
  const composeFile = extractComposeFile(meta, artifact);

  if ((meta as any).compose || composeFile) {
    return buildComposeGroup(composeFile, artifact);
  }

  const cluster = extractKubernetesCluster(meta);
  if (cluster) {
    return buildKubernetesGroup(cluster);
  }

  return null;
};

/** Build the dependency graph from resolved spec data */
const buildGraph = (
  resolved: Record<string, unknown> | null | undefined,
): {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  groups: Record<string, DeploymentGroup>;
} =>
  buildArchitectureFlowGraph(resolved, {
    deriveDeploymentGroup,
    looksLikeDeploymentContainer,
  });

/** Filter graph to only include service-type nodes and their connections */
const filterGraphToServices = ({
  nodes,
  edges,
  groups,
}: {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  groups: Record<string, DeploymentGroup>;
}) => {
  const isServiceNode = (node: DependencyNode) => {
    const artifactType = (node.data?.artifactType ?? "").toString().toLowerCase();
    if (artifactType.includes("service") || artifactType === "api" || artifactType === "job") {
      return true;
    }
    const prefix = node.id.split(":")[0]?.toLowerCase();
    return prefix === "service" || prefix === "api" || prefix === "job";
  };

  const serviceNodeIds = new Set(nodes.filter(isServiceNode).map((n) => n.id));

  const filteredNodes = nodes.filter((n) => serviceNodeIds.has(n.id));
  const filteredEdges = edges.filter(
    (e) => serviceNodeIds.has(e.source) && serviceNodeIds.has(e.target),
  );

  const filteredGroups = Object.entries(groups).reduce<Record<string, DeploymentGroup>>(
    (acc, [key, group]) => {
      const members = group.members.filter((id) => serviceNodeIds.has(id));
      if (members.length === 0) return acc;
      acc[key] = { ...group, members };
      return acc;
    },
    {},
  );

  return { nodes: filteredNodes, edges: filteredEdges, groups: filteredGroups };
};

/** Group node padding in pixels */
const GROUP_PADDING = 60;

/** Calculate bounding box for a set of nodes */
const calculateNodesBoundingBox = (
  memberNodes: Array<{ position: { x: number; y: number } }>,
  nodeWidth: number,
  nodeHeight: number,
  padding: number,
): { minX: number; minY: number; maxX: number; maxY: number } => ({
  minX: Math.min(...memberNodes.map((n) => n.position.x)) - padding,
  minY: Math.min(...memberNodes.map((n) => n.position.y)) - padding,
  maxX: Math.max(...memberNodes.map((n) => n.position.x + nodeWidth)) + padding,
  maxY: Math.max(...memberNodes.map((n) => n.position.y + nodeHeight)) + padding,
});

/** Build a group node for a deployment group */
const buildGroupNode = (
  group: DeploymentGroup,
  memberNodes: Array<{ position: { x: number; y: number } }>,
): Node | null => {
  if (!memberNodes.length) return null;

  const { minX, minY, maxX, maxY } = calculateNodesBoundingBox(
    memberNodes,
    NODE_WIDTH,
    NODE_HEIGHT,
    GROUP_PADDING,
  );

  return {
    id: `group-${group.key}`,
    type: "group",
    position: { x: minX, y: minY },
    data: {
      label: group.label,
      kind: group.kind,
      artifact: group.artifact,
      artifactType: group.artifactType,
    },
    style: {
      width: maxX - minX,
      height: maxY - minY,
      zIndex: 0,
      background: "transparent",
      pointerEvents: "none",
    },
    draggable: false,
    selectable: false,
  } as Node;
};

/** Loading state overlay component */
const LoadingOverlay = () => (
  <div className="flex h-full items-center justify-center text-sm text-gray-600 dark:text-graphite-200">
    Loading architecture…
  </div>
);

/** Error state overlay component */
const ErrorOverlay = ({ message }: { message: string }) => (
  <div className="flex h-full items-center justify-center text-sm text-red-600 dark:text-red-300">
    {message}
  </div>
);

/** Filter nodes for the current C4 level and parent context */
const filterNodesForLevel = (
  allNodes: DependencyNode[],
  currentLevel: C4Level,
  parentId: string | null,
  groups: Record<string, DeploymentGroup>,
): DependencyNode[] => {
  if (currentLevel === "system") {
    // At system level, show actors, systems, and clouds (C4 context diagram level)
    return allNodes.filter((node) => {
      const type = (node.data?.artifactType ?? "").toLowerCase();
      return type === "actor" || type === "system" || type.includes("cloud");
    });
  }

  if (currentLevel === "container") {
    // At container level, show containers and data stores (C4 container diagram level)
    // If parentId is set, filter to items within that group/system
    const containerTypes = [
      "service",
      "package",
      "database",
      "frontend",
      "api",
      "mobile",
      "cli",
      "worker",
      "kubernetes",
      "cache",
      "queue",
      "storage",
    ];
    let nodes = allNodes.filter((node) => {
      const type = (node.data?.artifactType ?? "").toLowerCase();
      return containerTypes.some((ct) => type.includes(ct));
    });

    if (parentId) {
      // Check if parent is a deployment group (compose stack, k8s cluster)
      const group = groups[parentId];
      if (group) {
        nodes = nodes.filter((n) => group.members.includes(n.id));
      } else {
        // Parent might be a system - filter by systemId/parentId in artifact metadata
        nodes = nodes.filter((n) => {
          const artifact = n.data?.artifact as Record<string, unknown> | undefined;
          const metadata = artifact?.metadata as Record<string, unknown> | undefined;
          const nodeSystemId =
            metadata?.systemId ?? metadata?.system ?? artifact?.systemId ?? artifact?.parentId;
          return nodeSystemId === parentId;
        });
      }
    }

    return nodes;
  }

  if (currentLevel === "module") {
    // At module level, show endpoints, views, routes within a container
    return allNodes.filter((node) => {
      const type = (node.data?.artifactType ?? "").toLowerCase();
      // If we have a parent, filter to items related to that parent
      if (parentId) {
        // Check if this node is a child of the parent container
        const nodeParent =
          (node.data?.artifact as Record<string, unknown>)?.parentId ??
          (node.data?.artifact as Record<string, unknown>)?.packageName;
        if (nodeParent && nodeParent !== parentId) {
          return false;
        }
      }
      return (
        type.includes("endpoint") ||
        type.includes("view") ||
        type.includes("route") ||
        type.includes("infra")
      );
    });
  }

  // Code level - future expansion
  return [];
};

/**
 * Interactive architecture diagram showing service dependencies.
 * Fetches resolved spec and renders a ReactFlow graph with deployment grouping.
 * Supports multi-tier C4-like navigation.
 */
const ArchitectureFlowDiagram: React.FC<ArchitectureFlowDiagramProps> = ({
  projectId,
  initialLevel = "container",
}) => {
  const [resolved, setResolved] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Desktop metaphor state - track which nodes are expanded as windows
  // expandedNodes now comes from useDiagramPositions hook
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity | null>(null);

  // Legacy state for compatibility during refactor (will be removed)
  const currentLevel: C4Level = "system";
  const breadcrumbs: BreadcrumbItem[] = [];

  // Refs for node action callbacks (to avoid circular dependencies)
  const nodeExpandRef = useRef<(nodeId: string) => void>(() => {});
  const nodeDeleteRef = useRef<(nodeId: string) => void>(() => {});
  const nodeCollapseRef = useRef<(nodeId: string) => void>(() => {});
  const nodeRenameRef = useRef<(nodeId: string, newName: string) => void>(() => {});
  const edgeLabelChangeRef = useRef<(edgeId: string, newLabel: string) => void>(() => {});

  // Track node positions to preserve them across data refreshes
  const nodePositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Persist node positions to IndexedDB
  const {
    positions: savedPositions,
    expandedNodes,
    isLoaded: positionsLoaded,
    updatePosition: persistPosition,
    setNodeExpanded,
    collapseAllNodes,
  } = useDiagramPositions(projectId, 500);

  // Sync saved positions to nodePositionsRef when loaded or projectId changes
  useEffect(() => {
    // Clear old positions when project changes
    nodePositionsRef.current.clear();
    // Load saved positions
    if (positionsLoaded) {
      savedPositions.forEach((pos, id) => {
        nodePositionsRef.current.set(id, pos);
      });
    }
  }, [projectId, positionsLoaded, savedPositions]);

  // Skip sync effect after palette action
  // Use a counter instead of boolean to handle multiple effect runs from batched state updates
  const skipSyncEffectCountRef = useRef(0);

  // Store intended dimensions from handlePaletteAction to ensure they're never lost
  // This acts as a "floor" for dimensions that the sync effect must respect
  const intendedDimensionsRef = useRef<Map<string, { width: number; height: number }>>(new Map());

  // Track UI-added children per parent (for sizing before backend sync)
  const [uiChildrenCount, setUiChildrenCount] = useState<Map<string, number>>(new Map());

  // Reset state when projectId changes
  // Note: expandedNodes is reset by useDiagramPositions hook
  useEffect(() => {
    setResolved(null);
    setError(null);
    setSelectedEntity(null);
    setUiChildrenCount(new Map());
  }, [projectId]);

  const {
    nodes: allNodes,
    edges: rawEdges,
    groups,
  } = useMemo(() => buildGraph(resolved), [resolved]);

  // Helper to get parent ID from a node
  const getNodeParentId = useCallback((node: DependencyNode): string | null => {
    const artifact = node.data?.artifact as Record<string, unknown> | undefined;
    const metadata = artifact?.metadata as Record<string, unknown> | undefined;
    const parentId =
      metadata?.systemId ?? metadata?.parentId ?? artifact?.systemId ?? artifact?.parentId;
    return parentId ? String(parentId) : null;
  }, []);

  // Get children for a specific parent node
  const getChildrenForNode = useCallback(
    (parentId: string) => {
      return allNodes.filter((node) => getNodeParentId(node) === parentId);
    },
    [allNodes, getNodeParentId],
  );

  // Desktop metaphor: show top-level nodes + children of expanded nodes as real ReactFlow nodes
  const filteredData = useMemo(() => {
    // Get all top-level nodes (actors, systems, clouds - items without a parent)
    const topLevelNodes = allNodes.filter((node) => {
      const type = (node.data?.artifactType ?? "").toLowerCase();
      const parentId = getNodeParentId(node);
      // Top-level if it's a system-type OR has no parent
      return type === "actor" || type === "system" || type.includes("cloud") || !parentId;
    });

    // Collect all visible nodes and their children recursively
    const visibleNodes: DependencyNode[] = [...topLevelNodes];
    const visibleIds = new Set(topLevelNodes.map((n) => n.id));

    // Add children of expanded nodes (recursively)
    const addChildrenRecursively = (parentId: string) => {
      const children = getChildrenForNode(parentId);
      for (const child of children) {
        if (!visibleIds.has(child.id)) {
          visibleNodes.push(child);
          visibleIds.add(child.id);
          // If this child is also expanded, add its children too
          if (expandedNodes.has(child.id)) {
            addChildrenRecursively(child.id);
          }
        }
      }
    };

    // Add children for each expanded node
    expandedNodes.forEach((parentId) => {
      addChildrenRecursively(parentId);
    });

    // Include edges where both source and target are visible
    const visibleEdges = rawEdges.filter(
      (e) => visibleIds.has(e.source) && visibleIds.has(e.target),
    );

    return {
      nodes: visibleNodes,
      edges: visibleEdges,
      groups: {},
    };
  }, [allNodes, rawEdges, expandedNodes, getNodeParentId, getChildrenForNode]);

  // Use grid layout constants (imported from gridLayout.ts)
  const CHILD_NODE_SIZE = CELL_WIDTH - 24; // 144px, cell includes padding
  const PARENT_HEADER_HEIGHT = GRID_HEADER_HEIGHT;
  const PARENT_PADDING = GRID_PADDING;
  const MIN_CONTAINER_HEIGHT = GRID_MIN_CONTAINER_HEIGHT;

  // Grid size context for calculating child positions
  const gridSizeContext: GridSizeContext = useMemo(
    () => ({
      expandedNodes,
      getChildrenOf: (nodeId: string) => getChildrenForNode(nodeId) as Node[],
      uiChildrenCount, // Include UI-added children for expanded node size calculation
    }),
    [expandedNodes, getChildrenForNode, uiChildrenCount],
  );

  // Layout children within a parent using virtual grid layout
  const layoutChildrenInParent = useCallback(
    (parentId: string, childNodes: DependencyNode[]) => {
      if (childNodes.length === 0)
        return { nodes: [], width: MIN_CONTAINER_WIDTH, height: MIN_CONTAINER_HEIGHT };

      // Use declarative grid layout - calculates positions based on grid cells
      const gridLayout = calculateGridLayout(childNodes as Node[], gridSizeContext, MAX_COLS);

      // Create positioned child nodes using grid-calculated positions and dimensions
      const positionedNodes = childNodes.map((n) => {
        const pos = gridLayout.nodePositions.get(n.id);
        const isExpanded = gridSizeContext.expandedNodes.has(n.id);
        return {
          ...n,
          position: pos
            ? { x: pos.x, y: pos.y }
            : { x: PARENT_PADDING, y: PARENT_HEADER_HEIGHT + PARENT_PADDING },
          // Apply grid-calculated dimensions for expanded children (nested containers)
          ...(pos && isExpanded ? { width: pos.width, height: pos.height } : {}),
        };
      });

      return {
        nodes: positionedNodes,
        width: gridLayout.dimensions.width,
        height: gridLayout.dimensions.height,
      };
    },
    [gridSizeContext],
  );

  // Calculate parent dimensions based on children (from both allNodes and UI-added children)
  const parentDimensions = useMemo(() => {
    const dims = new Map<string, { width: number; height: number }>();

    expandedNodes.forEach((parentId) => {
      // Get children from the resolved data
      const resolvedChildren = getChildrenForNode(parentId);
      let { width, height } = calculateParentDimensions(
        parentId,
        resolvedChildren as Node[],
        gridSizeContext,
      );

      // Also account for UI-added children that haven't synced yet
      const uiChildren = uiChildrenCount.get(parentId) ?? 0;
      const totalChildren = resolvedChildren.length + uiChildren;
      if (totalChildren > resolvedChildren.length) {
        // Recalculate with virtual extra children for sizing
        // Create placeholder nodes for dimension calculation
        const cols = Math.min(MAX_COLS, totalChildren);
        const rows = Math.ceil(totalChildren / MAX_COLS);
        const minWidth = PARENT_PADDING * 2 + cols * CELL_WIDTH;
        const minHeight = PARENT_HEADER_HEIGHT + PARENT_PADDING * 2 + rows * CELL_HEIGHT;
        width = Math.max(width, minWidth);
        height = Math.max(height, minHeight);
      }

      dims.set(parentId, { width, height });
    });

    return dims;
  }, [expandedNodes, getChildrenForNode, gridSizeContext, uiChildrenCount]);

  // Layout: first layout top-level nodes, then position children within parents
  // Include all node data (callbacks, isExpanded) directly in useMemo to avoid effect dependency issues
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => {
    // Separate top-level and child nodes
    const topLevelNodes = filteredData.nodes.filter((n) => !getNodeParentId(n));
    const childNodesByParent = new Map<string, DependencyNode[]>();

    filteredData.nodes.forEach((n) => {
      const parentId = getNodeParentId(n);
      if (parentId) {
        if (!childNodesByParent.has(parentId)) {
          childNodesByParent.set(parentId, []);
        }
        childNodesByParent.get(parentId)?.push(n);
      }
    });

    // Layout top-level nodes using grid-based bin-packing
    // This properly handles expanded nodes that span multiple grid cells
    const gridLayoutResult = calculateTopLevelGridLayout(
      topLevelNodes as Node[],
      expandedNodes,
      parentDimensions,
      savedPositions,
      TOP_LEVEL_MAX_COLS,
    );

    // Apply grid layout positions and dimensions to nodes
    const layoutedTopLevel: DependencyNode[] = topLevelNodes.map((n) => {
      const dims = parentDimensions.get(n.id);
      const gridPos = gridLayoutResult.nodePositions.get(n.id);
      const savedPos = savedPositions.get(n.id);
      // Prefer saved position, fall back to grid layout
      const position = savedPos ?? gridPos ?? { x: 0, y: 0 };
      return {
        ...n,
        position,
        ...(dims ? { width: dims.width, height: dims.height } : {}),
      };
    });

    const allEdges = filteredData.edges;

    // Augment top-level nodes with callbacks and expanded state
    const augmentNode = (n: DependencyNode, isChild: boolean): DependencyNode => {
      const isExpanded = expandedNodes.has(n.id);
      const dims = parentDimensions.get(n.id);
      // For expanded nodes, use calculated dims or a reasonable minimum
      const expandedDims = isExpanded
        ? (dims ?? { width: 300, height: MIN_CONTAINER_HEIGHT })
        : null;
      return {
        ...n,
        // Set dimensions for expanded nodes (ReactFlow needs both direct props and style)
        ...(expandedDims ? { width: expandedDims.width, height: expandedDims.height } : {}),
        style: {
          ...(n.style ?? {}),
          zIndex: isChild ? 2 : 1,
          // Also set dimensions in style for ReactFlow to properly size the container
          ...(expandedDims ? { width: expandedDims.width, height: expandedDims.height } : {}),
        },
        data: {
          ...n.data,
          isExpanded,
          onExpand: () => nodeExpandRef.current(n.id),
          onCollapse: () => nodeCollapseRef.current(n.id),
          onDelete: () => nodeDeleteRef.current(n.id),
          onRename: (newName: string) => nodeRenameRef.current(n.id, newName),
        },
      };
    };

    // Now position children within their parents
    const allNodes: DependencyNode[] = layoutedTopLevel.map((n) => augmentNode(n, false));

    childNodesByParent.forEach((children, parentId) => {
      const { nodes: positionedChildren } = layoutChildrenInParent(parentId, children);

      // Add parentNode property and extent to children
      positionedChildren.forEach((child) => {
        allNodes.push(
          augmentNode(
            {
              ...child,
              parentNode: parentId,
              extent: "parent" as const,
            } as DependencyNode,
            true,
          ),
        );
      });
    });

    return { nodes: allNodes, edges: allEdges };
  }, [
    filteredData,
    getNodeParentId,
    parentDimensions,
    layoutChildrenInParent,
    expandedNodes,
    savedPositions,
  ]);

  // Compute final nodes with preserved positions and z-index for proper layering
  const nodesWithPositions = useMemo(() => {
    return layoutedNodes.map((n) => {
      const isChild = !!(n as any).parentNode;
      const savedPos = !isChild ? nodePositionsRef.current.get(n.id) : undefined;
      const artifactType = n.data?.artifactType ?? "";
      const isParentType = isExpandableType(artifactType);
      const isExpanded = expandedNodes.has(n.id);

      // Z-index layering:
      // - Expanded parent containers: 0 (lowest, edges render above their background)
      // - Child nodes inside containers: 1000 (highest, above everything)
      // - Regular top-level nodes: 100 (middle, edges can cross them)
      let zIndex = 100;
      if (isChild) {
        zIndex = 1000;
      } else if (isParentType && isExpanded) {
        zIndex = 0;
      }

      const baseNode = savedPos ? { ...n, position: savedPos } : n;
      return { ...baseNode, zIndex };
    });
  }, [layoutedNodes, expandedNodes]);

  // Augment edges with callbacks and editable type
  const edgesWithCallbacks = useMemo(() => {
    // Build a set of child node IDs for z-index calculation
    const childNodeIds = new Set(
      layoutedNodes.filter((n) => (n as any).parentNode).map((n) => n.id),
    );

    return layoutedEdges.map((e) => {
      // Edges involving child nodes should render above parent containers
      const involvesChild = childNodeIds.has(e.source) || childNodeIds.has(e.target);
      return {
        ...e,
        type: "editable",
        zIndex: involvesChild ? 10 : 5, // Higher z-index for edges inside containers
        data: {
          ...e.data,
          onLabelChange: (newLabel: string) => edgeLabelChangeRef.current(e.id, newLabel),
        },
      };
    });
  }, [layoutedEdges, layoutedNodes]);

  const [nodes, setNodes, baseOnNodesChange] = useNodesState(nodesWithPositions);
  const [edges, setEdges, onEdgesChange] = useEdgesState(edgesWithCallbacks);

  // Clear ReactFlow state when projectId changes
  const prevProjectIdRef = useRef(projectId);
  useEffect(() => {
    if (prevProjectIdRef.current !== projectId) {
      setNodes([]);
      setEdges([]);
      prevProjectIdRef.current = projectId;
    }
  }, [projectId, setNodes, setEdges]);

  // Track recently expanded nodes to ignore position changes for them
  const recentlyExpandedRef = useRef<Set<string>>(new Set());

  // Track last position during drag for persistence (ReactFlow sends undefined position on drag end)
  const lastDragPositionRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Custom onNodesChange that filters out position changes for recently expanded nodes
  // and saves positions for persistence
  const onNodesChange = useCallback(
    // Debug logging

    (changes: Parameters<typeof baseOnNodesChange>[0]) => {
      const filteredChanges = changes.filter((change) => {
        if (change.type === "position") {
          console.log(
            "[onNodesChange] position change:",
            change.id,
            "dragging:",
            change.dragging,
            "position:",
            change.position,
          );
        }
        // Allow all non-position changes
        if (change.type !== "position") return true;
        // Block position changes for recently expanded nodes
        if (recentlyExpandedRef.current.has(change.id)) return false;
        // Track position during drag
        if (change.dragging === true && change.position) {
          lastDragPositionRef.current.set(change.id, change.position);
        }
        // Save position for persistence when dragging ends
        if (change.dragging === false) {
          const lastPos = lastDragPositionRef.current.get(change.id);
          if (lastPos) {
            persistPosition(change.id, lastPos);
            nodePositionsRef.current.set(change.id, lastPos);
            lastDragPositionRef.current.delete(change.id);
          }
        }
        return true;
      });
      if (filteredChanges.length > 0) {
        baseOnNodesChange(filteredChanges);
      }
    },
    [baseOnNodesChange, persistPosition],
  );

  // Sync nodes/edges when layout changes (without causing loops)
  const prevLayoutRef = useRef<{ topLevelIds: string; edgeCount: number } | null>(null);
  useEffect(() => {
    // Skip if we just added a child via palette action (to prevent overwriting dimensions)
    // Use counter to handle multiple effect runs from batched state updates (expandedNodes, uiChildrenCount, nodes)
    if (skipSyncEffectCountRef.current > 0) {
      skipSyncEffectCountRef.current--;
      return;
    }

    // Only consider top-level nodes for structure comparison
    // Children appearing in expanded parents shouldn't reset top-level positions
    const topLevelNodes = nodesWithPositions.filter((n) => !(n as any).parentNode);
    const topLevelIds = topLevelNodes
      .map((n) => n.id)
      .sort()
      .join(",");
    const prev = prevLayoutRef.current;

    // Structure changed only if top-level nodes were added/removed
    const structureChanged = !prev || prev.topLevelIds !== topLevelIds;
    const edgesChanged = !prev || prev.edgeCount !== edgesWithCallbacks.length;

    // Helper to check if a node should be kept as UI-added
    // Only keep nodes whose parent is still expanded (or top-level nodes)
    const shouldKeepUiNode = (node: Node) => {
      const parentId = node.parentNode;
      if (!parentId) return true; // Top-level nodes are always kept
      // Only keep if parent is expanded
      return expandedNodes.has(parentId);
    };

    if (structureChanged) {
      // Save positions for all top-level nodes so they persist
      topLevelNodes.forEach((n) => {
        if (!savedPositions.has(n.id)) {
          nodePositionsRef.current.set(n.id, n.position);
        }
      });
      prevLayoutRef.current = { topLevelIds, edgeCount: edgesWithCallbacks.length };
      // Merge with UI-added nodes that aren't in the layout yet (but whose parent is still expanded)
      // Also preserve larger dimensions from current nodes
      setNodes((currentNodes) => {
        const layoutIds = new Set(nodesWithPositions.map((n) => n.id));
        const uiAddedNodes = currentNodes.filter(
          (n) => !layoutIds.has(n.id) && shouldKeepUiNode(n),
        );

        // Recalculate positions for UI-added child nodes using grid layout
        const uiAddedByParent = new Map<string, Node[]>();
        uiAddedNodes.forEach((n) => {
          const parentId = (n as any).parentNode;
          if (parentId) {
            if (!uiAddedByParent.has(parentId)) {
              uiAddedByParent.set(parentId, []);
            }
            uiAddedByParent.get(parentId)!.push(n);
          }
        });

        const repositionedUiNodes = uiAddedNodes.map((n) => {
          const parentId = (n as any).parentNode;
          if (!parentId) return n;

          const layoutChildren = nodesWithPositions.filter(
            (ln) => (ln as any).parentNode === parentId,
          );
          const uiChildren = uiAddedByParent.get(parentId) ?? [];
          const allChildren = [...layoutChildren, ...uiChildren] as Node[];
          const gridLayout = calculateGridLayout(allChildren, gridSizeContext, MAX_COLS);
          const newPos = gridLayout.nodePositions.get(n.id);

          if (!newPos) return n;
          const isExpanded = gridSizeContext.expandedNodes.has(n.id);
          return {
            ...n,
            position: { x: newPos.x, y: newPos.y },
            // Apply dimensions for expanded UI-added children
            ...(isExpanded ? { width: newPos.width, height: newPos.height } : {}),
          };
        });

        // Build map of current dimensions
        const currentDimensions = new Map<string, { width?: number; height?: number }>();
        currentNodes.forEach((n) => {
          if ((n as any).width !== undefined || (n as any).height !== undefined) {
            currentDimensions.set(n.id, { width: (n as any).width, height: (n as any).height });
          }
        });

        // Merge dimensions - use larger of current, layout, or intended dimensions
        const mergedLayoutNodes = nodesWithPositions.map((node) => {
          const currentDims = currentDimensions.get(node.id);
          const intendedDims = intendedDimensionsRef.current.get(node.id);

          const layoutWidth = (node as any).width ?? 0;
          const layoutHeight = (node as any).height ?? 0;
          let finalWidth = Math.max(currentDims?.width ?? 0, layoutWidth);
          let finalHeight = Math.max(currentDims?.height ?? 0, layoutHeight);

          // Also respect intended dimensions from handlePaletteAction
          if (intendedDims) {
            finalWidth = Math.max(finalWidth, intendedDims.width);
            finalHeight = Math.max(finalHeight, intendedDims.height);
          }

          if (!currentDims && !intendedDims) return node;

          // Set in both top-level and style for ReactFlow compatibility
          return {
            ...node,
            ...(finalWidth ? { width: finalWidth } : {}),
            ...(finalHeight ? { height: finalHeight } : {}),
            ...(finalWidth || finalHeight
              ? {
                  style: {
                    ...(node.style || {}),
                    ...(finalWidth ? { width: finalWidth } : {}),
                    ...(finalHeight ? { height: finalHeight } : {}),
                  },
                }
              : {}),
          };
        });

        return [...mergedLayoutNodes, ...repositionedUiNodes];
      });
      setEdges(edgesWithCallbacks);
    } else if (edgesChanged) {
      prevLayoutRef.current = { ...prev!, edgeCount: edgesWithCallbacks.length };
      setEdges(edgesWithCallbacks);
    } else {
      // Expand state or children changed - update nodes without resetting top-level positions
      setNodes((currentNodes) => {
        // Build map of current positions for top-level nodes
        const currentPositions = new Map<string, { x: number; y: number }>();
        currentNodes.forEach((n) => {
          if (!n.parentNode) {
            currentPositions.set(n.id, n.position);
          }
        });

        // Find UI-added nodes that aren't in the layout yet (but whose parent is still expanded)
        const layoutIds = new Set(nodesWithPositions.map((n) => n.id));
        const uiAddedNodes = currentNodes.filter(
          (n) => !layoutIds.has(n.id) && shouldKeepUiNode(n),
        );

        // Recalculate positions for UI-added child nodes using grid layout
        // Group by parent, calculate combined grid, then update positions
        const uiAddedByParent = new Map<string, Node[]>();
        uiAddedNodes.forEach((n) => {
          const parentId = (n as any).parentNode;
          if (parentId) {
            if (!uiAddedByParent.has(parentId)) {
              uiAddedByParent.set(parentId, []);
            }
            uiAddedByParent.get(parentId)!.push(n);
          }
        });

        // Recalculate positions for UI-added children
        const repositionedUiNodes = uiAddedNodes.map((n) => {
          const parentId = (n as any).parentNode;
          if (!parentId) return n; // Top-level nodes keep their position

          // Get all children for this parent (layout + UI-added)
          const layoutChildren = nodesWithPositions.filter(
            (ln) => (ln as any).parentNode === parentId,
          );
          const uiChildren = uiAddedByParent.get(parentId) ?? [];
          const allChildren = [...layoutChildren, ...uiChildren] as Node[];

          // Calculate grid layout for all children
          const gridLayout = calculateGridLayout(allChildren, gridSizeContext, MAX_COLS);
          const newPos = gridLayout.nodePositions.get(n.id);

          if (newPos) {
            const isExpanded = gridSizeContext.expandedNodes.has(n.id);
            return {
              ...n,
              position: { x: newPos.x, y: newPos.y },
              // Apply dimensions for expanded UI-added children
              ...(isExpanded ? { width: newPos.width, height: newPos.height } : {}),
            };
          }
          return n;
        });

        // Build map of current dimensions for nodes (in case UI updated them)
        const currentDimensions = new Map<string, { width?: number; height?: number }>();
        currentNodes.forEach((n) => {
          if ((n as any).width !== undefined || (n as any).height !== undefined) {
            currentDimensions.set(n.id, {
              width: (n as any).width,
              height: (n as any).height,
            });
          }
        });

        // Merge: keep current positions for existing top-level nodes, use layout for new/children
        // Also preserve larger dimensions for ALL nodes (in case UI set them before layout caught up)
        const mergedNodes = nodesWithPositions.map((node) => {
          const isChild = !!(node as any).parentNode;
          const currentDims = currentDimensions.get(node.id);
          const layoutWidth = (node as any).width ?? 0;
          const layoutHeight = (node as any).height ?? 0;

          // Use the larger of current, layout, or intended dimensions (to prevent shrinking from UI updates)
          // intendedDimensionsRef stores dimensions set by handlePaletteAction as a floor
          const intendedDims = intendedDimensionsRef.current.get(node.id);
          let finalWidth = currentDims?.width
            ? Math.max(currentDims.width, layoutWidth)
            : layoutWidth;
          let finalHeight = currentDims?.height
            ? Math.max(currentDims.height, layoutHeight)
            : layoutHeight;
          if (intendedDims) {
            finalWidth = Math.max(finalWidth, intendedDims.width);
            finalHeight = Math.max(finalHeight, intendedDims.height);
          }

          if (isChild) {
            // Children use positions from layout, but preserve dimensions
            // Set in both top-level and style for ReactFlow compatibility
            return {
              ...node,
              ...(finalWidth ? { width: finalWidth } : {}),
              ...(finalHeight ? { height: finalHeight } : {}),
              ...(finalWidth || finalHeight
                ? {
                    style: {
                      ...(node.style || {}),
                      ...(finalWidth ? { width: finalWidth } : {}),
                      ...(finalHeight ? { height: finalHeight } : {}),
                    },
                  }
                : {}),
            };
          }

          // Top-level nodes keep their current position and dimensions
          const currentPos = currentPositions.get(node.id);
          return {
            ...node,
            ...(currentPos ? { position: currentPos } : {}),
            ...(finalWidth ? { width: finalWidth } : {}),
            ...(finalHeight ? { height: finalHeight } : {}),
            ...(finalWidth || finalHeight
              ? {
                  style: {
                    ...(node.style || {}),
                    ...(finalWidth ? { width: finalWidth } : {}),
                    ...(finalHeight ? { height: finalHeight } : {}),
                  },
                }
              : {}),
          };
        });

        // Append UI-added nodes (with recalculated positions for children)
        return [...mergedNodes, ...repositionedUiNodes];
      });
    }
  }, [nodesWithPositions, edgesWithCallbacks, setNodes, setEdges, expandedNodes, gridSizeContext]);

  // Fetch resolved spec data
  const fetchResolved = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiService.getResolvedSpec(projectId);
      setResolved(response.resolved);
      // Clear UI children count since backend now has the data
      setUiChildrenCount(new Map());
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load architecture");
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchResolved();
  }, [fetchResolved]);

  // Navigation handlers (simplified for desktop metaphor - no level navigation)
  const handleNavigateBack = useCallback(() => {
    // Collapse all expanded nodes
    collapseAllNodes();
    setSelectedEntity(null);
  }, [collapseAllNodes]);

  const handleBreadcrumbClick = useCallback(
    (_index: number) => {
      // Reset to top level (collapse all)
      collapseAllNodes();
      setSelectedEntity(null);
    },
    [collapseAllNodes],
  );

  // Check if an artifact is drillable (container or system level)
  const isDrillable = useCallback((artifactType: string): boolean => {
    const level = getArtifactLevel(artifactType);
    return level === "system" || level === "container";
  }, []);

  // Select a node (update metadata ribbon)
  const handleNodeClick = useCallback(
    (nodeId: string) => {
      const node = layoutedNodes.find((n) => n.id === nodeId);
      if (!node) return;

      const artifactType = node.data?.artifactType ?? "";
      const artifact = node.data?.artifact;
      const metadata = (artifact?.metadata ?? {}) as Record<string, unknown>;

      // Update selected entity for metadata ribbon
      const entity: SelectedEntity = {
        id: nodeId,
        name: node.data?.title ?? nodeId,
        type: artifactType,
        description: node.data?.description ?? undefined,
        metadata,
        level: getArtifactLevel(artifactType),
      };
      setSelectedEntity(entity);
    },
    [layoutedNodes],
  );

  // Expand a node (open as window to show children)
  const handleNodeExpand = useCallback(
    (nodeId: string) => {
      setNodeExpanded(nodeId, true);
    },
    [setNodeExpanded],
  );

  // Collapse a node (close window back to icon)
  const handleNodeCollapse = useCallback(
    (nodeId: string) => {
      setNodeExpanded(nodeId, false);
    },
    [setNodeExpanded],
  );

  // Keep refs in sync
  useEffect(() => {
    nodeExpandRef.current = handleNodeExpand;
  }, [handleNodeExpand]);

  useEffect(() => {
    nodeCollapseRef.current = handleNodeCollapse;
  }, [handleNodeCollapse]);

  // Delete a node
  const handleNodeDelete = useCallback(
    async (nodeId: string) => {
      // Store current state for potential rollback
      const deletedNode = nodes.find((n) => n.id === nodeId);
      const deletedEdges = edges.filter((e) => e.source === nodeId || e.target === nodeId);
      const wasSelected = selectedEntity?.id === nodeId;

      // Get the raw artifact ID (without type prefix) for API calls
      const artifact = (deletedNode?.data as any)?.artifact as Record<string, unknown> | undefined;
      const artifactId = artifact?.id ?? artifact?.artifactId ?? artifact?.artifact_id;

      // Optimistically update UI
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      if (wasSelected) {
        setSelectedEntity(null);
      }

      // Only persist to backend if we have an artifact ID
      if (!artifactId) return;

      try {
        await apiService.deleteProjectEntity(projectId, String(artifactId));
      } catch (err) {
        console.error("Failed to delete entity:", err);
        // Rollback on error
        if (deletedNode) {
          setNodes((nds) => [...nds, deletedNode as any]);
        }
        if (deletedEdges.length > 0) {
          setEdges((eds) => [...eds, ...deletedEdges]);
        }
        if (wasSelected && deletedNode) {
          const artifactType = (deletedNode.data as any)?.artifactType ?? "";
          setSelectedEntity({
            id: nodeId,
            name: (deletedNode.data as any)?.title ?? nodeId,
            type: artifactType,
            level: getArtifactLevel(artifactType),
          });
        }
      }
    },
    [projectId, selectedEntity, nodes, edges, setNodes, setEdges],
  );

  // Keep ref in sync
  useEffect(() => {
    nodeDeleteRef.current = handleNodeDelete;
  }, [handleNodeDelete]);

  // Delete edges (called when user presses Delete key with edges selected)
  const handleEdgesDelete = useCallback(
    async (deletedEdges: typeof edges) => {
      // Process each deleted edge
      for (const edge of deletedEdges) {
        const relationshipId = (edge.data as any)?.relationshipId;

        // If edge has a backend relationship entity, delete it
        if (relationshipId) {
          try {
            await apiService.deleteProjectEntity(projectId, String(relationshipId));
          } catch (err) {
            console.error("Failed to delete relationship entity:", err);
            // Rollback: re-add the edge
            setEdges((eds) => [...eds, edge]);
          }
        }
      }
    },
    [projectId, setEdges],
  );

  // Rename a node
  const handleNodeRename = useCallback(
    async (nodeId: string, newName: string) => {
      // Find the node to get its type and current name for potential rollback
      const targetNode = nodes.find((n) => n.id === nodeId);
      if (!targetNode) return;

      const entityType = (targetNode.data as any)?.artifactType ?? "service";
      const previousName = (targetNode.data as any)?.title ?? "";
      // Get the raw artifact ID (without type prefix) for API calls
      const artifact = (targetNode.data as any)?.artifact as Record<string, unknown> | undefined;
      const artifactId = artifact?.id ?? artifact?.artifactId ?? artifact?.artifact_id;

      // Optimistically update local state for immediate UI feedback
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  title: newName,
                  artifact: n.data?.artifact ? { ...n.data.artifact, name: newName } : undefined,
                },
              }
            : n,
        ),
      );

      // Update selected entity if it's the renamed node
      if (selectedEntity?.id === nodeId) {
        setSelectedEntity((prev) => (prev ? { ...prev, name: newName } : null));
      }

      // Only persist to backend if we have an artifact ID
      if (!artifactId) return;

      try {
        await apiService.updateProjectEntity(projectId, String(artifactId), {
          type: entityType,
          values: { name: newName },
        });
      } catch (err) {
        console.error("Failed to rename entity:", err);
        // Rollback on error
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    title: previousName,
                    artifact: n.data?.artifact
                      ? { ...n.data.artifact, name: previousName }
                      : undefined,
                  },
                }
              : n,
          ),
        );
        if (selectedEntity?.id === nodeId) {
          setSelectedEntity((prev) => (prev ? { ...prev, name: previousName } : null));
        }
      }
    },
    [projectId, selectedEntity, nodes, setNodes],
  );

  // Keep ref in sync
  useEffect(() => {
    nodeRenameRef.current = handleNodeRename;
  }, [handleNodeRename]);

  // Handle palette actions
  const handlePaletteAction = useCallback(
    async (action: PaletteAction) => {
      if (action.category === "create" && action.entityType) {
        // Generate unique ID and default name
        const entityType = action.entityType;
        const timestamp = Date.now();
        const tempId = `${entityType}:new-${timestamp}`;

        // Count existing nodes of this type to make name unique
        const existingCount = nodes.filter((n) => {
          const nodeType = (n.data as any)?.artifactType?.toLowerCase() ?? "";
          return nodeType === entityType.toLowerCase();
        }).length;
        const suffix = existingCount > 0 ? ` ${existingCount + 1}` : "";
        const defaultName = `New ${action.label}${suffix}`;

        let newId = tempId;

        // Get parent system if we're creating inside a selected container
        let parentSystemId: string | null = null;
        if (selectedEntity) {
          const selectedType = selectedEntity.type.toLowerCase();
          if (
            selectedType === "system" ||
            selectedType.includes("cloud") ||
            selectedType.includes("service") ||
            selectedType.includes("frontend") ||
            selectedType.includes("api") ||
            selectedType.includes("package") ||
            selectedType.includes("database") ||
            selectedType.includes("cache") ||
            selectedType.includes("queue") ||
            selectedType.includes("storage")
          ) {
            parentSystemId = selectedEntity.id;
            // Set skip count EARLY, before any state updates, to prevent sync effect
            // from running during setNodeExpanded/setUiChildrenCount and overwriting dimensions
            skipSyncEffectCountRef.current = 5;
            // Auto-expand the parent when adding a child
            setNodeExpanded(selectedEntity.id, true);
            // Track UI-added children for sizing
            setUiChildrenCount((prev) => {
              const next = new Map(prev);
              next.set(selectedEntity.id, (prev.get(selectedEntity.id) ?? 0) + 1);
              return next;
            });
          }
        }

        // Get subtype if provided (e.g., "web", "android" for frontend)
        const subtype = action.subtype;

        // Try to persist to backend
        let persistedSuccessfully = false;
        let rawArtifactId: string | null = null;
        try {
          const result = await apiService.createProjectEntity(projectId, {
            type: entityType,
            values: {
              name: defaultName,
              description: "",
              ...(parentSystemId ? { systemId: parentSystemId } : {}),
              ...(subtype ? { subtype } : {}),
            },
          });
          // Use the returned artifact ID if available
          const artifact = (result as { artifact?: { id?: string } })?.artifact;
          rawArtifactId = artifact?.id ?? null;
          // Use prefixed ID format for consistency with graph builder (type:uuid)
          newId = rawArtifactId ? `${entityType}:${rawArtifactId}` : tempId;
          persistedSuccessfully = true;
        } catch (err) {
          // API doesn't support this entity type yet - continue with local-only node
          console.warn(
            `Entity type "${entityType}" not supported by API, adding locally only:`,
            err,
          );
        }

        // Add to nodes state immediately for responsiveness
        // Grid layout will calculate proper position on next render
        setNodes((currentNodes) => {
          // Calculate position based on context using grid layout
          let calcPosition = { x: 100, y: 100 };

          if (parentSystemId) {
            // Get existing children to calculate next grid position
            const existingChildren = currentNodes.filter(
              (n) => (n as any).parentNode === parentSystemId,
            );

            // Create a temporary placeholder node to calculate where it should go
            const placeholderNode = { id: newId, position: { x: 0, y: 0 } } as Node;
            const childrenWithPlaceholder = [...existingChildren, placeholderNode];

            // Use grid layout to calculate positions for all children including the new one
            const gridLayout = calculateGridLayout(
              childrenWithPlaceholder,
              gridSizeContext,
              MAX_COLS,
            );
            const newNodePosition = gridLayout.nodePositions.get(newId);

            if (newNodePosition) {
              calcPosition = { x: newNodePosition.x, y: newNodePosition.y };
            } else {
              // Fallback: first child position
              calcPosition = {
                x: PARENT_PADDING,
                y: PARENT_HEADER_HEIGHT + PARENT_PADDING,
              };
            }
          } else {
            // Position as top-level node
            const topLevelNodes = currentNodes.filter((n) => !(n as any).parentNode);
            const existingPositions = topLevelNodes.map((n) => n.position);
            const maxX =
              existingPositions.length > 0 ? Math.max(...existingPositions.map((p) => p.x)) : 0;
            const avgY =
              existingPositions.length > 0
                ? existingPositions.reduce((sum, p) => sum + p.y, 0) / existingPositions.length
                : 200;
            calcPosition = { x: maxX + NODE_WIDTH + 80, y: avgY };
          }

          // Create new node
          const newNode: Node = {
            id: newId,
            type: "card",
            position: calcPosition,
            data: {
              title: defaultName,
              description: "",
              artifactType: entityType,
              artifact: {
                // Store raw artifact ID for API calls (update/delete)
                ...(rawArtifactId ? { id: rawArtifactId } : {}),
                name: defaultName,
                type: entityType,
                metadata: {
                  ...(parentSystemId ? { systemId: parentSystemId } : {}),
                  ...(subtype ? { subtype } : {}),
                },
              },
              // Add callbacks for the new node
              isExpanded: false,
              onExpand: () => nodeExpandRef.current(newId),
              onCollapse: () => nodeCollapseRef.current(newId),
              onDelete: () => nodeDeleteRef.current(newId),
              onRename: (newName: string) => nodeRenameRef.current(newId, newName),
            },
            style: { zIndex: parentSystemId ? 1000 : 100 },
            // If child of a parent, set parentNode and extent
            ...(parentSystemId ? { parentNode: parentSystemId, extent: "parent" as const } : {}),
          };

          // If adding to a parent, update parent dimensions using grid calculation
          if (parentSystemId) {
            const existingChildren = currentNodes.filter(
              (n) => (n as any).parentNode === parentSystemId,
            );
            const childrenWithNew = [...existingChildren, newNode] as Node[];

            // Use grid layout to calculate parent dimensions
            const gridLayout = calculateGridLayout(childrenWithNew, gridSizeContext, MAX_COLS);
            const { width: newWidth, height: newHeight } = gridLayout.dimensions;

            // Update parent dimensions
            const updatedNodes = currentNodes.map((n) => {
              if (n.id === parentSystemId) {
                return {
                  ...n,
                  width: newWidth,
                  height: newHeight,
                  style: { ...(n.style || {}), width: newWidth, height: newHeight },
                };
              }
              return n;
            });

            // Store intended parent dimensions as a floor for sync effect
            intendedDimensionsRef.current.set(parentSystemId, {
              width: newWidth,
              height: newHeight,
            });

            // Refresh skip count to ensure we have enough skips after setNodes completes
            skipSyncEffectCountRef.current = Math.max(skipSyncEffectCountRef.current, 3);
            return updatedNodes.concat(newNode);
          }

          return [...currentNodes, newNode];
        });

        // Keep parent selected when adding children (so user can add more)
        // Only select the new entity if it's a top-level node
        if (!parentSystemId) {
          setSelectedEntity({
            id: newId,
            name: defaultName,
            type: entityType,
            level: currentLevel,
          });
        }
        // If adding a child, keep the parent selected so user can add more children

        // Refetch to sync with backend (ensures persistence across navigation)
        if (persistedSuccessfully) {
          fetchResolved();
        }
      } else if (action.category === "delete" && selectedEntity) {
        // Use the shared delete handler (handles API call and rollback)
        handleNodeDelete(selectedEntity.id);
      }
    },
    [
      projectId,
      currentLevel,
      selectedEntity,
      nodes,
      setNodes,
      setEdges,
      fetchResolved,
      handleNodeDelete,
      gridSizeContext,
    ],
  );

  // Handle edge label changes
  const handleEdgeLabelChange = useCallback(
    async (edgeId: string, newLabel: string) => {
      // Find the edge to get source/target info
      const edge = edges.find((e) => e.id === edgeId);

      // Update local state immediately
      setEdges((eds) =>
        eds.map((e) => {
          if (e.id !== edgeId) return e;
          return {
            ...e,
            data: {
              ...e.data,
              label: newLabel,
              onLabelChange:
                e.data?.onLabelChange ?? ((l: string) => edgeLabelChangeRef.current(e.id, l)),
            },
          };
        }),
      );

      // Persist to backend as relationship entity
      if (edge) {
        const relationshipId = (edge.data as any)?.relationshipId;
        try {
          if (relationshipId) {
            // Update existing relationship
            await apiService.updateProjectEntity(projectId, relationshipId, {
              type: "relationship",
              values: {
                source: edge.source,
                target: edge.target,
                label: newLabel,
                name: newLabel || `${edge.source} → ${edge.target}`,
              },
            });
          } else {
            // Create new relationship entity
            const result = await apiService.createProjectEntity(projectId, {
              type: "relationship",
              values: {
                source: edge.source,
                target: edge.target,
                label: newLabel,
                name: newLabel || `${edge.source} → ${edge.target}`,
              },
            });
            // Store relationship ID on the edge for future updates
            const artifact = (result as { artifact?: { id?: string } })?.artifact;
            if (artifact?.id) {
              setEdges((eds) =>
                eds.map((e) =>
                  e.id === edgeId
                    ? {
                        ...e,
                        data: {
                          ...e.data,
                          relationshipId: artifact.id,
                          onLabelChange:
                            e.data?.onLabelChange ??
                            ((l: string) => edgeLabelChangeRef.current(e.id, l)),
                        },
                      }
                    : e,
                ),
              );
            }
          }
        } catch (err) {
          console.error("Failed to persist edge label:", err);
        }
      }
    },
    [projectId, edges, setEdges],
  );

  // Keep ref in sync
  useEffect(() => {
    edgeLabelChangeRef.current = handleEdgeLabelChange;
  }, [handleEdgeLabelChange]);

  // Handle new connections created by dragging between handles
  const handleConnect = useCallback(
    async (connection: Connection) => {
      const edgeId = `reactflow__edge-${connection.source}${connection.sourceHandle || ""}-${connection.target}${connection.targetHandle || ""}`;

      // Create relationship entity in backend
      let relationshipId: string | undefined;
      try {
        const result = await apiService.createProjectEntity(projectId, {
          type: "relationship",
          values: {
            source: connection.source,
            target: connection.target,
            label: "",
            name: `${connection.source} → ${connection.target}`,
          },
        });
        const artifact = (result as { artifact?: { id?: string } })?.artifact;
        relationshipId = artifact?.id;
      } catch (err) {
        console.warn("Failed to persist new edge:", err);
      }

      // Check if either node is a child to determine z-index
      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);
      const involvesChild = !!(sourceNode?.parentNode || targetNode?.parentNode);

      const newEdge = {
        ...connection,
        type: "editable",
        animated: true,
        zIndex: involvesChild ? 10 : 5,
        data: {
          label: "",
          relationshipId,
          onLabelChange: (newLabel: string) => {
            handleEdgeLabelChange(edgeId, newLabel);
          },
        },
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [projectId, nodes, setEdges, handleEdgeLabelChange],
  );

  // Ref to measure header height - must be before early returns
  const headerRef = React.useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(88);

  useEffect(() => {
    if (headerRef.current) {
      const height = headerRef.current.getBoundingClientRect().height;
      if (height > 0) setHeaderHeight(height);
    }
  });

  if (isLoading) {
    return <LoadingOverlay />;
  }

  if (error) {
    return <ErrorOverlay message={error} />;
  }

  if (!resolved || filteredData.nodes.length === 0) {
    return (
      <div className="absolute inset-0">
        {/* Header */}
        <div
          ref={headerRef}
          className="absolute top-0 left-0 right-0 z-[100] bg-white dark:bg-graphite-900 shadow-md"
        >
          <MetadataRibbon
            selected={null}
            breadcrumbs={breadcrumbs}
            currentLevel={currentLevel}
            onNavigateBack={handleNavigateBack}
            onBreadcrumbClick={handleBreadcrumbClick}
          />
          <CommandPalette selectedEntity={null} onAction={handlePaletteAction} />
        </div>
        {/* Content */}
        <div
          className="absolute left-0 right-0 bottom-0 flex items-center justify-center text-sm text-gray-600 dark:text-graphite-200"
          style={{ top: headerHeight }}
        >
          {currentLevel === "system"
            ? "No system context yet. Add an actor or cloud to get started."
            : currentLevel === "container"
              ? "No containers yet. Add a service or database to see the graph."
              : "No components at this level."}
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      {/* Header */}
      <div
        ref={headerRef}
        className="absolute top-0 left-0 right-0 z-[100] bg-white dark:bg-graphite-900 shadow-md"
      >
        <MetadataRibbon
          selected={selectedEntity}
          breadcrumbs={breadcrumbs}
          currentLevel={currentLevel}
          onNavigateBack={handleNavigateBack}
          onBreadcrumbClick={handleBreadcrumbClick}
        />
        <CommandPalette selectedEntity={selectedEntity} onAction={handlePaletteAction} />
      </div>
      {/* ReactFlow */}
      <div className="absolute left-0 right-0 bottom-0" style={{ top: headerHeight }}>
        <style>{`
          .architecture-flow-diagram .react-flow__edges {
            z-index: 500 !important;
            pointer-events: none;
          }
          .architecture-flow-diagram .react-flow__edge {
            pointer-events: all;
          }
          .architecture-flow-diagram .react-flow__edgelabel-renderer {
            z-index: 1001 !important;
          }
        `}</style>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypesWithGroups}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={handleConnect}
          onNodeClick={(_, node) => handleNodeClick(node.id)}
          deleteKeyCode="Delete"
          onEdgesDelete={handleEdgesDelete}
          onNodesDelete={(deletedNodes) => deletedNodes.forEach((n) => handleNodeDelete(n.id))}
          fitView
          fitViewOptions={{ maxZoom: 1, padding: 0.2 }}
          onlyRenderVisibleElements={false}
          className="bg-gray-50 dark:bg-graphite-950 architecture-flow-diagram"
        >
          <Background gap={16} size={1} />
          <MiniMap pannable zoomable />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
};

export default ArchitectureFlowDiagram;
