/**
 * Storybook stories for the diagram visualization components.
 * Showcases different diagram types, rendering engines, and integration patterns.
 */
import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { MermaidRenderer } from "../core/MermaidRenderer";
import { DataViewer } from "../viewers/DataViewer";
import { SplitViewShowcase } from "../viewers/SplitViewShowcase";
import {
  combinedVisualization,
  diagramTypes,
  quickStartGuideYaml,
  renderingArchitectureYaml,
  technicalFeatures,
} from "./story-data";

/** Storybook metadata configuration for the diagram showcase */
const meta = {
  title: "Diagrams/Complete Diagram Showcase",
  component: SplitViewShowcase,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof SplitViewShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Feature availability indicator */
const FeatureIndicator: React.FC<{ name: string; available: boolean }> = ({ name, available }) => (
  <div className="flex justify-between">
    <span>• {name}</span>
    <span className={available ? "text-green-600" : "text-gray-400"}>
      {available ? "✓ Available" : "○ Planned"}
    </span>
  </div>
);

/** Diagram type card for the overview */
const DiagramTypeCard: React.FC<{
  title: string;
  color: string;
  description: string;
  features: Array<{ name: string; available: boolean }>;
}> = ({ title, color, description, features }) => (
  <div className="border border-gray-200 rounded-lg p-4">
    <div className="flex items-center gap-3 mb-3">
      <div className={`w-4 h-4 ${color} rounded`} />
      <h4 className="font-semibold text-gray-900">{title}</h4>
    </div>
    <p className="text-sm text-gray-600 mb-3">{description}</p>
    <div className="text-xs space-y-1">
      {features.map((feature) => (
        <FeatureIndicator key={feature.name} name={feature.name} available={feature.available} />
      ))}
    </div>
  </div>
);

/** Technical feature card */
const TechFeatureCard: React.FC<{
  name: string;
  description: string;
  icon: string;
  color: string;
}> = ({ name, description, icon, color }) => (
  <div className="text-center">
    <div
      className={`w-12 h-12 bg-${color}-100 rounded-lg flex items-center justify-center mx-auto mb-2`}
    >
      <span className={`text-${color}-600 font-bold`}>{icon}</span>
    </div>
    <span className="font-medium">{name}</span>
    <p className="text-xs text-gray-600">{description}</p>
  </div>
);

/** Component showing all available diagram types and their features */
const DiagramTypesOverview: React.FC = () => (
  <div className="bg-white p-6 rounded-lg space-y-6">
    <div className="text-center mb-8">
      <h3 className="text-xl font-bold text-gray-900 mb-2">
        Interactive Diagram Visualization Types
      </h3>
      <p className="text-gray-600">
        Transform YAML/JSON specifications into beautiful, interactive diagrams
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {diagramTypes.map((type) => (
        <DiagramTypeCard
          key={type.id}
          title={type.title}
          color={type.color}
          description={type.description}
          features={type.features}
        />
      ))}
    </div>

    <div className="mt-8 pt-6 border-t border-gray-200">
      <h4 className="font-semibold text-gray-900 mb-4">Technical Features</h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        {technicalFeatures.map((feature) => (
          <TechFeatureCard
            key={feature.name}
            name={feature.name}
            description={feature.description}
            icon={feature.icon}
            color={feature.color}
          />
        ))}
      </div>
    </div>
  </div>
);

// Story definitions
export const DiagramShowcaseOverview: Story = {
  args: {
    title: "Complete Diagram Visualization Platform",
    description:
      "Comprehensive overview of all available diagram types and technical capabilities for developer tools.",
    dataPanelTitle: "Integration Guide (YAML)",
    diagramPanelTitle: "Available Diagram Types",
    dataPanel: (
      <DataViewer data={quickStartGuideYaml} language="yaml" title="diagram-platform-guide.yml" />
    ),
    diagramPanel: <DiagramTypesOverview />,
  },
};

export const TechnicalArchitectureOverview: Story = {
  args: {
    title: "Diagram Rendering Architecture",
    description:
      "Technical architecture showing how YAML/JSON specifications are transformed into interactive diagrams.",
    dataPanelTitle: "Architecture Overview (YAML)",
    diagramPanelTitle: "Rendering Pipeline Flow",
    dataPanel: (
      <DataViewer
        data={renderingArchitectureYaml}
        language="yaml"
        title="rendering-architecture.yml"
      />
    ),
    diagramPanel: (
      <MermaidRenderer chart={combinedVisualization} title="Diagram Rendering Pipeline" />
    ),
  },
};
