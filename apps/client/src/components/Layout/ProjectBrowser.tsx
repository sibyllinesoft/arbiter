// @ts-nocheck
/**
 * Project browser with elegant card-based layout - Enhanced with Graphite Design System
 */

import { clsx } from "clsx";
import {
  Activity,
  AlertCircle,
  Archive,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Edit3,
  Eye,
  FileText,
  Filter,
  FolderOpen,
  GitBranch,
  MoreVertical,
  Plus,
  Search,
  Settings,
  Star,
  StarOff,
  Trash2,
  Users,
} from "lucide-react";
import React, { useState, useCallback } from "react";
import { Button, Card, Input, StatusBadge, cn } from "../../design-system";
import type { Project } from "../../types/api";

export interface ProjectBrowserProps {
  className?: string;
  projects: Project[];
  selectedProject?: Project;
  onSelectProject?: (project: Project) => void;
  onCreateProject?: () => void;
  onEditProject?: (project: Project) => void;
  onDeleteProject?: (project: Project) => void;
  onToggleStar?: (project: Project) => void;
  loading?: boolean;
}

export function ProjectBrowser({
  className,
  projects = [],
  selectedProject,
  onSelectProject,
  onCreateProject,
  onEditProject,
  onDeleteProject,
  onToggleStar,
  loading = false,
}: ProjectBrowserProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Filter projects based on search and status
  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      !searchQuery ||
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = filterStatus === "all" || project.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const handleProjectClick = useCallback(
    (project: Project) => {
      onSelectProject?.(project);
    },
    [onSelectProject],
  );

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "active":
        return "active";
      case "draft":
        return "warning";
      case "archived":
        return "inactive";
      case "error":
        return "error";
      default:
        return "neutral";
    }
  };

  const getValidationIcon = (status: string) => {
    switch (status) {
      case "valid":
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case "warnings":
        return <AlertCircle className="w-4 h-4 text-amber-500" />;
      case "errors":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case "pending":
        return <Activity className="w-4 h-4 text-blue-500 animate-pulse" />;
      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${Math.floor(diffInHours)}h ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  if (loading) {
    return (
      <div className={cn("h-full flex items-center justify-center bg-graphite-25", className)}>
        <div className="text-center p-8">
          <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
            <Activity className="w-6 h-6 text-blue-600 animate-pulse" />
          </div>
          <p className="text-graphite-600">Loading projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("h-full flex flex-col bg-graphite-25", className)}>
      {/* Header */}
      <div className="flex-none p-6 bg-white border-b border-graphite-200">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-graphite-900 tracking-tight">Projects</h1>
            <p className="text-graphite-600 mt-1">
              {projects.length} specification{projects.length !== 1 ? "s" : ""} workspace
            </p>
          </div>
          <Button
            variant="primary"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={onCreateProject}
            className="shadow-sm border-none"
          >
            New Project
          </Button>
        </div>

        {/* Search and filters */}
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-graphite-400" />
            <Input
              placeholder="Search projects, descriptions, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 bg-white border border-graphite-300 rounded-lg text-sm text-graphite-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
              <option value="error">Error</option>
            </select>

            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Filter className="w-4 h-4" />}
              className="px-2"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {filteredProjects.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            {searchQuery || filterStatus !== "all" ? (
              // No results state
              <div className="text-center p-8 max-w-md">
                <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-graphite-100 to-graphite-200 flex items-center justify-center">
                  <Search className="w-8 h-8 text-graphite-400" />
                </div>
                <h3 className="text-lg font-semibold text-graphite-800 mb-3">No projects found</h3>
                <p className="text-graphite-600 mb-6">
                  Try adjusting your search terms or filters to find what you're looking for.
                </p>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearchQuery("");
                    setFilterStatus("all");
                  }}
                >
                  Clear filters
                </Button>
              </div>
            ) : (
              // Empty state
              <div className="text-center p-8 max-w-lg">
                <div className="w-20 h-20 mx-auto mb-8 rounded-3xl bg-gradient-to-br from-purple-100 via-blue-100 to-indigo-100 flex items-center justify-center shadow-sm">
                  <FolderOpen className="w-10 h-10 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold text-graphite-800 mb-4">
                  Welcome to Spec Workbench
                </h3>
                <p className="text-graphite-600 leading-relaxed mb-8">
                  Create your first specification project to get started with CUE language editing,
                  validation, and collaborative development workflows.
                </p>
                <Button
                  variant="primary"
                  size="lg"
                  leftIcon={<Plus className="w-5 h-5" />}
                  onClick={onCreateProject}
                  className="shadow-sm"
                >
                  Create Your First Project
                </Button>
              </div>
            )}
          </div>
        ) : (
          // Projects grid
          <div className="h-full overflow-auto p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProjects.map((project) => (
                <Card
                  key={project.id}
                  className={cn(
                    "group cursor-pointer transition-all duration-200",
                    "hover:shadow-lg hover:shadow-graphite-200/50 hover:-translate-y-1",
                    "border-2 hover:border-blue-200",
                    selectedProject?.id === project.id && "ring-2 ring-blue-500 border-blue-300",
                  )}
                  onClick={() => handleProjectClick(project)}
                >
                  {/* Card header */}
                  <div className="p-4 pb-3 border-b border-graphite-100">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-sm">
                          <GitBranch className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex items-center gap-1">
                          {getValidationIcon(project.validationStatus)}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleStar?.(project);
                          }}
                          className="p-1 rounded-md hover:bg-graphite-100 transition-colors"
                        >
                          {project.starred ? (
                            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                          ) : (
                            <StarOff className="w-4 h-4 text-graphite-400 group-hover:text-graphite-600" />
                          )}
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // Show context menu
                          }}
                          className="p-1 rounded-md hover:bg-graphite-100 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <MoreVertical className="w-4 h-4 text-graphite-400" />
                        </button>
                      </div>
                    </div>

                    <h3 className="font-semibold text-graphite-900 group-hover:text-blue-700 transition-colors truncate">
                      {project.name}
                    </h3>

                    {project.description && (
                      <p className="text-sm text-graphite-600 mt-1 line-clamp-2 leading-relaxed">
                        {project.description}
                      </p>
                    )}
                  </div>

                  {/* Card body */}
                  <div className="p-4 pt-3 space-y-3">
                    {/* Status and stats */}
                    <div className="flex items-center justify-between">
                      <StatusBadge
                        variant={getStatusVariant(project.status)}
                        size="sm"
                        className="font-medium"
                      >
                        {project.status}
                      </StatusBadge>

                      <div className="flex items-center gap-3 text-xs text-graphite-500">
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {project.fragmentCount}
                        </span>
                        {project.collaborators.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {project.collaborators.length}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Tags */}
                    {project.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {project.tags.slice(0, 3).map((tag, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-graphite-100 text-graphite-700 text-xs rounded-md font-medium"
                          >
                            {tag}
                          </span>
                        ))}
                        {project.tags.length > 3 && (
                          <span className="px-2 py-1 bg-graphite-100 text-graphite-500 text-xs rounded-md">
                            +{project.tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Last modified */}
                    <div className="flex items-center justify-between pt-2 border-t border-graphite-100">
                      <div className="flex items-center gap-1.5 text-xs text-graphite-500">
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(project.lastModified)}</span>
                      </div>

                      <ChevronRight className="w-4 h-4 text-graphite-400 group-hover:text-graphite-600 transition-colors" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProjectBrowser;
// @ts-nocheck
