/**
 * @module ArchitectureDiagram
 * Interactive architecture visualization component.
 * Displays grouped system components with create/edit capabilities.
 */
import AddEntityModal from "@/components/modals/AddEntityModal";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { clsx } from "clsx";
import {
  Component,
  Database,
  Eye,
  Flag,
  GitBranch,
  Layout,
  ListChecks,
  Navigation,
  Server,
  Shield,
  Sparkles,
  Terminal,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import React, { useState, useMemo, useCallback } from "react";
import { EmptyState } from "./components/EmptyState";
import { ErrorState } from "./components/ErrorState";
import { LoadingState } from "./components/LoadingState";
import { SourceGroup } from "./components/SourceGroup";
import { useArchitectureDiagramData, useEntityHandlers } from "./hooks";
import type { ArchitectureDiagramProps } from "./types";
import { type GroupedComponentGroup, computeGroupedComponents } from "./utils/componentGrouping";

const groupIconMap: Record<string, LucideIcon> = {
  service: Server,
  package: Component,
  tool: Terminal,
  route: Navigation,
  view: Eye,
  database: Database,
  infrastructure: Shield,
  frontend: Layout,
  flow: GitBranch,
  capability: Sparkles,
  group: Flag,
  task: ListChecks,
};

const ArchitectureDiagram: React.FC<ArchitectureDiagramProps> = ({
  projectId,
  className = "",
  onOpenEntityModal,
}) => {
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [addDialogConfig, setAddDialogConfig] = useState<{ type: string; label: string } | null>(
    null,
  );
  const [groupListRef] = useAutoAnimate<HTMLDivElement>({
    duration: 220,
    easing: "ease-in-out",
  });

  const {
    projectData,
    loading,
    error,
    setError,
    optimisticRemovals,
    toggleOptimisticRemoval,
    refreshProjectData,
    optionCatalogWithTasks,
  } = useArchitectureDiagramData(projectId);

  const { handleAddEntity, openAddDialog, handleEditComponent, handleDeleteEntity } =
    useEntityHandlers({
      projectId,
      refreshProjectData,
      setError,
      toggleOptimisticRemoval,
      optionCatalogWithTasks,
      onOpenEntityModal,
      setAddDialogConfig,
    });

  const groupedComponents = useMemo(
    () => computeGroupedComponents(projectData, optimisticRemovals),
    [projectData, optimisticRemovals],
  );

  const handleComponentClick = useCallback(
    (group: GroupedComponentGroup, componentName: string, componentData: any) => {
      handleEditComponent({ group, item: { name: componentName, data: componentData } });
    },
    [handleEditComponent],
  );

  if (loading) {
    return <LoadingState className={className} />;
  }

  if (error) {
    return (
      <ErrorState error={error} className={className} onRefresh={() => window.location.reload()} />
    );
  }

  return (
    <div
      className={clsx(
        "h-full overflow-auto px-6 py-6 bg-gray-50 dark:bg-graphite-950 scrollbar-transparent",
        className,
      )}
    >
      {groupedComponents.length === 0 ? (
        <EmptyState />
      ) : (
        <div ref={groupListRef} className="space-y-6">
          {groupedComponents.map((group) => {
            const icon = groupIconMap[group.type];
            return (
              <SourceGroup
                key={group.label}
                groupLabel={group.label}
                components={group.items}
                groupType={group.type}
                expandedSources={expandedSources}
                setExpandedSources={setExpandedSources}
                onComponentClick={({ name, data }) => handleComponentClick(group, name, data)}
                onAddClick={() => openAddDialog(group)}
                onDeleteComponent={({ artifactId, label }) => handleDeleteEntity(artifactId, label)}
                {...(icon ? { icon } : {})}
              />
            );
          })}
        </div>
      )}

      {addDialogConfig && !onOpenEntityModal && (
        <AddEntityModal
          open
          entityType={addDialogConfig.type}
          groupLabel={addDialogConfig.label}
          optionCatalog={optionCatalogWithTasks}
          onClose={() => setAddDialogConfig(null)}
          mode="create"
          onSubmit={handleAddEntity}
        />
      )}
    </div>
  );
};

export default ArchitectureDiagram;
