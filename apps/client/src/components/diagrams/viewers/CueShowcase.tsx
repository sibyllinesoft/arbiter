import {
  assemblySpecCue,
  basicRequirementsCue,
  complexTypescriptProjectCue,
  rustMicroserviceCue,
  sampleResolvedData,
  validationErrorsCue,
} from "@/test/cue-samples";
import { Card } from "@design-system/components/Card";
import { StatusBadge, type StatusVariant } from "@design-system/components/StatusBadge";
import { Tabs } from "@design-system/components/Tabs";
import React, { useState } from "react";
import { CueViewer } from "./CueViewer";
import { DataViewer } from "./DataViewer";

interface CueShowcaseProps {
  className?: string;
}

interface CueExample {
  id: string;
  title: string;
  description: string;
  cueSource: string;
  resolvedData?: any;
  validationErrors?: Array<{
    line: number;
    column: number;
    message: string;
    severity: "error" | "warning" | "info";
  }>;
  type: "requirements" | "assembly" | "validation" | "project" | "service";
  status: "implemented" | "draft" | "planned" | "error";
}

const CUE_EXAMPLES: CueExample[] = [
  {
    id: "requirements",
    title: "Requirements Specification",
    description: "Security, performance, and compliance requirements for user authentication",
    cueSource: basicRequirementsCue,
    resolvedData: {
      security_requirements: 2,
      performance_requirements: 1,
      compliance_requirements: 1,
      total_requirements: 4,
      implementation_status: "partial",
    },
    type: "requirements",
    status: "implemented",
  },
  {
    id: "assembly",
    title: "System Assembly",
    description: "Microservices architecture definition with infrastructure and deployment",
    cueSource: assemblySpecCue,
    resolvedData: sampleResolvedData.resolved,
    type: "assembly",
    status: "implemented",
  },
  {
    id: "validation-errors",
    title: "Validation Errors Demo",
    description: "CUE file with various validation errors to demonstrate error handling",
    cueSource: validationErrorsCue,
    validationErrors: [
      {
        line: 6,
        column: 10,
        message: 'Cannot unify int 12345 and string "user123"',
        severity: "error",
      },
      {
        line: 9,
        column: 6,
        message: "Value 150 exceeds maximum allowed age of 120",
        severity: "error",
      },
      {
        line: 23,
        column: 1,
        message: 'Missing required field "email"',
        severity: "error",
      },
      {
        line: 24,
        column: 1,
        message: 'Missing required field "age"',
        severity: "error",
      },
      {
        line: 30,
        column: 15,
        message: "Cannot unify string and int 12345",
        severity: "error",
      },
      {
        line: 34,
        column: 10,
        message:
          'String "invalid-email" does not match pattern "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"',
        severity: "error",
      },
      {
        line: 38,
        column: 9,
        message: "Value -50 is below minimum allowed value 0",
        severity: "error",
      },
      {
        line: 52,
        column: 12,
        message: '"PATCH" is not a valid method. Must be one of: "GET", "POST", "PUT", "DELETE"',
        severity: "error",
      },
      {
        line: 62,
        column: 14,
        message: '"unknown" is not in the list of valid statuses',
        severity: "error",
      },
    ],
    type: "validation",
    status: "error",
  },
  {
    id: "typescript-project",
    title: "TypeScript Project Spec",
    description: "Advanced TypeScript trading platform with performance requirements",
    cueSource: complexTypescriptProjectCue,
    resolvedData: {
      project_name: "Advanced TypeScript Microservice",
      version: "v3.2.1",
      performance_targets: {
        api_latency_p99: "<=100ms",
        throughput_orders: ">=10000/sec",
        memory_limit: "<=2GB",
      },
      architecture_layers: 4,
      test_coverage_target: 90,
      deployment_replicas: 20,
    },
    type: "project",
    status: "implemented",
  },
  {
    id: "rust-service",
    title: "Rust High-Performance Service",
    description: "Ultra-low latency trading engine with microsecond performance targets",
    cueSource: rustMicroserviceCue,
    resolvedData: {
      project_name: "High-Frequency Trading Engine",
      version: "v1.5.0",
      performance_targets: {
        order_processing: "<=100μs",
        market_data_ingestion: "<=50μs",
        throughput: ">=1,000,000 orders/sec",
      },
      memory_management: {
        zero_copy: true,
        heap_allocations_per_order: "<=5",
        gc_pauses: 0,
      },
      safety_guarantees: ["memory_safety", "thread_safety"],
    },
    type: "service",
    status: "implemented",
  },
];

export const CueShowcase: React.FC<CueShowcaseProps> = ({ className = "" }) => {
  const [selectedExample, setSelectedExample] = useState<CueExample>(() => CUE_EXAMPLES[0]!);
  const [viewMode, setViewMode] = useState<"overview" | "source" | "resolved" | "split">(
    "overview",
  );

  const getStatusColor = (status: CueExample["status"]): StatusVariant => {
    switch (status) {
      case "implemented":
        return "success";
      case "draft":
        return "warning";
      case "planned":
        return "info";
      case "error":
        return "error";
      default:
        return "neutral";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "requirements":
        return "📋";
      case "assembly":
        return "🏗️";
      case "validation":
        return "⚠️";
      case "project":
        return "📦";
      case "service":
        return "⚡";
      default:
        return "📄";
    }
  };

  const OverviewPanel = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Example Selection */}
      <div className="lg:col-span-1">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">CUE Examples</h3>
        <div className="space-y-3">
          {CUE_EXAMPLES.map((example) => (
            <button
              key={example.id}
              onClick={() => setSelectedExample(example)}
              className={`w-full text-left p-4 rounded-lg border transition-all ${
                selectedExample.id === example.id
                  ? "border-blue-500 bg-blue-50 shadow-sm"
                  : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{getTypeIcon(example.type)}</span>
                  <span className="font-medium text-sm text-gray-900">{example.title}</span>
                </div>
                <StatusBadge variant={getStatusColor(example.status)} size="sm">
                  {example.status}
                </StatusBadge>
              </div>
              <p className="text-xs text-gray-600">{example.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className="lg:col-span-2">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{selectedExample.title}</h3>
          <p className="text-sm text-gray-600 mb-4">{selectedExample.description}</p>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <StatusBadge variant={getStatusColor(selectedExample.status)}>
                {selectedExample.status}
              </StatusBadge>
              <span className="text-xs text-gray-500 uppercase font-medium tracking-wide">
                {selectedExample.type.replace("_", " ")}
              </span>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={() => setViewMode("source")}
                className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
              >
                View Source
              </button>
              {selectedExample.resolvedData && (
                <button
                  onClick={() => setViewMode("resolved")}
                  className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors"
                >
                  View Resolved
                </button>
              )}
              {selectedExample.resolvedData && (
                <button
                  onClick={() => setViewMode("split")}
                  className="px-3 py-1 text-xs bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 transition-colors"
                >
                  Split View
                </button>
              )}
            </div>
          </div>
        </div>

        <Card className="h-96">
          <CueViewer
            cueSource={selectedExample.cueSource}
            {...(selectedExample.validationErrors
              ? { validationErrors: selectedExample.validationErrors }
              : {})}
            resolvedData={selectedExample.resolvedData}
            mode="view"
            className="h-full"
          />
        </Card>
      </div>
    </div>
  );

  const SourcePanel = () => (
    <CueViewer
      title={`${selectedExample.title} - CUE Source`}
      cueSource={selectedExample.cueSource}
      {...(selectedExample.validationErrors
        ? { validationErrors: selectedExample.validationErrors }
        : {})}
      mode="view"
      className="h-full"
    />
  );

  const ResolvedPanel = () => (
    <div className="h-full">
      {selectedExample.resolvedData ? (
        <DataViewer
          title={`${selectedExample.title} - Resolved Data`}
          data={selectedExample.resolvedData}
          language="json"
          className="h-full"
        />
      ) : (
        <div className="flex items-center justify-center h-64 text-gray-500">
          <p>No resolved data available for this example</p>
        </div>
      )}
    </div>
  );

  const SplitPanel = () => (
    <CueViewer
      title={`${selectedExample.title} - Split View`}
      cueSource={selectedExample.cueSource}
      {...(selectedExample.validationErrors
        ? { validationErrors: selectedExample.validationErrors }
        : {})}
      resolvedData={selectedExample.resolvedData}
      mode="split"
      className="h-full"
    />
  );

  const tabItems = [
    { id: "overview", label: "Overview", content: <OverviewPanel /> },
    { id: "source", label: "CUE Source", content: <SourcePanel /> },
    { id: "resolved", label: "Resolved Data", content: <ResolvedPanel /> },
    { id: "split", label: "Split View", content: <SplitPanel /> },
  ];

  return (
    <div className={`space-y-6 ${className}`}>
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">CUE Visualization Showcase</h2>
        <p className="text-gray-600">
          Interactive examples demonstrating CUE file visualization, validation, and resolved data
          display.
        </p>
      </div>

      <Tabs
        items={tabItems}
        activeTab={viewMode}
        onChange={(tab) => setViewMode(tab as typeof viewMode)}
        className="h-full"
      />
    </div>
  );
};

export default CueShowcase;
