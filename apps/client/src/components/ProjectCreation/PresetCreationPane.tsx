/**
 * PresetCreationPane - Left pane for creating projects from presets
 */

import { useSetCurrentProject } from "@contexts/ProjectContext";
import { Button, cn } from "@design-system";
import { useProjects } from "@hooks/api-hooks";
import { apiService } from "@services/api";
import { Component, FileText, Globe, Server, Smartphone } from "lucide-react";
import React, { useState } from "react";
import { toast } from "react-toastify";

interface PresetCreationPaneProps {
  onClose: () => void;
}

const presets = [
  {
    id: "web-app",
    name: "Web Application",
    description: "Full-stack web application with React frontend and Node.js backend",
    icon: Globe,
    color: "blue",
    features: ["React Frontend", "Node.js API", "Database", "Authentication"],
  },
  {
    id: "mobile-app",
    name: "Mobile Application",
    description: "Cross-platform mobile app with React Native",
    icon: Smartphone,
    color: "green",
    features: ["React Native", "Push Notifications", "Offline Support", "App Store Ready"],
  },
  {
    id: "api-service",
    name: "API Service",
    description: "RESTful API service with database integration",
    icon: Server,
    color: "purple",
    features: ["REST API", "Database Schema", "Documentation", "Testing"],
  },
  {
    id: "microservice",
    name: "Microservice",
    description: "Containerized microservice with monitoring",
    icon: Component,
    color: "orange",
    features: ["Docker", "Health Checks", "Metrics", "Service Discovery"],
  },
];

export function PresetCreationPane({ onClose }: PresetCreationPaneProps) {
  const { refetch: refetchProjects } = useProjects();
  const setCurrentProject = useSetCurrentProject();
  const [selectedPreset, setSelectedPreset] = useState<any>(null);
  const [projectName, setProjectName] = useState("");
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  const handleCreateProjectFromPreset = async (preset: any, projectName: string) => {
    setIsCreatingProject(true);
    try {
      const newProject = await apiService.createProject(projectName, undefined, preset.id);
      setCurrentProject(newProject);
      refetchProjects();
      onClose();
      toast.success(`Project "${newProject.name}" created from ${preset.name} preset`);
    } catch (error) {
      toast.error("Failed to create project");
      console.error("Failed to create project:", error);
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handlePresetSelect = (preset: any) => {
    setSelectedPreset(preset);
    setProjectName(preset.name.replace(/\s+/g, "-").toLowerCase());
  };

  const handleCreateFromPreset = () => {
    if (selectedPreset && projectName.trim()) {
      handleCreateProjectFromPreset(selectedPreset, projectName.trim());
    }
  };

  return (
    <div className="border-r border-gray-200 p-6 dark:border-graphite-700">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
        <FileText className="w-5 h-5" />
        Create from Preset
      </h3>

      <div className="mb-6 space-y-3">
        {presets.map((preset) => (
          <div
            key={preset.id}
            onClick={() => handlePresetSelect(preset)}
            className={cn(
              "cursor-pointer rounded-lg border p-4 transition-all",
              selectedPreset?.id === preset.id
                ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500 dark:border-blue-400 dark:bg-blue-500/10 dark:ring-blue-400"
                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50 dark:border-graphite-700 dark:hover:border-graphite-600 dark:hover:bg-graphite-800",
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "rounded-lg p-2",
                  preset.color === "blue" &&
                    "bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300",
                  preset.color === "green" &&
                    "bg-green-100 text-green-600 dark:bg-green-500/10 dark:text-green-300",
                  preset.color === "purple" &&
                    "bg-purple-100 text-purple-600 dark:bg-purple-500/10 dark:text-purple-300",
                  preset.color === "orange" &&
                    "bg-orange-100 text-orange-600 dark:bg-orange-500/10 dark:text-orange-300",
                )}
              >
                <preset.icon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 dark:text-gray-100">{preset.name}</h4>
                <p className="mt-1 text-sm text-gray-600 dark:text-graphite-300">
                  {preset.description}
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {preset.features.map((feature) => (
                    <span
                      key={feature}
                      className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600 dark:bg-graphite-800 dark:text-graphite-300"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedPreset && (
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-graphite-200">
              Project Name
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-graphite-600 dark:bg-graphite-800 dark:text-gray-100 dark:placeholder:text-graphite-400 dark:focus:ring-blue-400"
              placeholder="Enter project name..."
            />
          </div>
          <Button
            variant="primary"
            onClick={handleCreateFromPreset}
            disabled={!projectName.trim() || isCreatingProject}
            className="w-full"
          >
            {isCreatingProject ? "Creating..." : `Create ${selectedPreset.name}`}
          </Button>
        </div>
      )}
    </div>
  );
}
