import Button from "@/design-system/components/Button";
import Modal from "@/design-system/components/Modal";
import { getHighlightedCode, normalizeSyntaxLanguage } from "@/utils/syntaxHighlight";
import {
  Database,
  Eye,
  Layout,
  Component as ModuleIcon,
  Navigation,
  Package,
  Server,
  Shield,
  Terminal,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import React, { Fragment } from "react";
import yaml from "yaml";

type TreeMode = "components" | "routes";

interface GroupedComponentItem {
  name: string;
  data: any;
}

interface GroupedComponentGroup {
  key: string;
  label: string;
  type: string;
  layout: "grid" | "tree";
  treeMode?: TreeMode;
  items: GroupedComponentItem[];
}

interface SelectedDetailsProps {
  selectedComponent: string | null;
  groupedComponents: GroupedComponentGroup[];
  onClose: () => void;
}

const surfaceClasses =
  "bg-white dark:bg-graphite-900 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2";

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
      .filter(Boolean)
      .join(", ");
  }
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
};

const renderCodeBlock = (value: string, language?: string, extraClasses = "") => {
  const highlighted = getHighlightedCode(value, language);
  const normalized = normalizeSyntaxLanguage(language);
  const baseClasses = `text-xs font-mono whitespace-pre-wrap break-words ${surfaceClasses}`;
  const composed = `${baseClasses} ${extraClasses}`.trim();

  if (highlighted) {
    return (
      <pre className={`syntax-highlight ${composed}`} data-language={normalized}>
        <code dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
    );
  }

  return <pre className={composed}>{value}</pre>;
};

const buildDetail = (
  label: string,
  rawValue: unknown,
  options: { code?: boolean; language?: string; codeClasses?: string } = {},
): React.ReactNode => {
  const value = formatValue(rawValue);
  if (!value) return null;
  const baseValueClasses = `whitespace-pre-wrap break-words ${surfaceClasses}`;
  const valueClassName = `text-sm text-gray-700 dark:text-graphite-200 ${baseValueClasses}`;
  return (
    <div key={label}>
      <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-graphite-300 mb-1">
        {label}
      </h5>
      {options.code ? (
        renderCodeBlock(value, options.language, options.codeClasses)
      ) : (
        <div className={valueClassName}>{value}</div>
      )}
    </div>
  );
};

export const SelectedDetails: React.FC<SelectedDetailsProps> = ({
  selectedComponent,
  groupedComponents,
  onClose,
}) => {
  if (!selectedComponent) return null;

  // Find the selected component in the grouped data
  const selectedData = (() => {
    for (const group of groupedComponents) {
      const found = group.items.find(
        (item: GroupedComponentItem) => item.name === selectedComponent,
      );
      if (found) {
        return { ...found };
      }
    }
    return null;
  })();

  if (!selectedData) return null;

  const metadata = selectedData.data.metadata ?? {};
  const language = formatValue(metadata.language).trim();
  const framework = formatValue(metadata.framework).trim();
  const detectedType =
    selectedData.data.type || metadata.detectedType || metadata.type || metadata.category;

  const filePath =
    formatValue(
      metadata.filePath ||
        metadata.controllerPath ||
        selectedData.data.filePath ||
        selectedData.data.path,
    ) || "";

  const displayName = selectedData.data.name || selectedData.name;
  const description = selectedData.data.description || metadata.description || "";

  const isPackageJson = (() => {
    const name = (displayName || "").toLowerCase();
    const metaName = formatValue(metadata.displayLabel || metadata.packageJsonPath).toLowerCase();
    const file = filePath.toLowerCase();
    return (
      name.includes("package.json") ||
      metaName.includes("package.json") ||
      file.endsWith("package.json")
    );
  })();

  const infoBadges: Array<{ label: string; value: string }> = [];
  if (language && language !== "unknown") {
    infoBadges.push({ label: "Language", value: language });
  }
  if (framework && framework !== "unknown") {
    infoBadges.push({ label: "Framework", value: framework });
  }

  const iconMap: Record<string, LucideIcon> = {
    service: Server,
    module: ModuleIcon,
    tool: Terminal,
    route: Navigation,
    view: Eye,
    database: Database,
    infrastructure: Shield,
    frontend: Layout,
    package: Package,
  };

  const normalizedType = String(detectedType || "").toLowerCase();
  const typeKey = isPackageJson ? "package" : normalizedType;
  const TypeIcon = iconMap[typeKey] ?? null;

  const details: React.ReactNode[] = [];

  if (description) {
    details.push(
      <div key="description">
        <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-graphite-300 mb-1">
          Description
        </h5>
        <p
          className={`text-sm text-gray-700 dark:text-graphite-200 whitespace-pre-wrap break-words ${surfaceClasses}`}
        >
          {description}
        </p>
      </div>,
    );
  }

  const gherkinSpec =
    selectedData.data.gherkin || metadata.gherkin || metadata.gherkinSpec || metadata.feature;

  if (typeof gherkinSpec === "string" && gherkinSpec.trim().length > 0) {
    details.push(
      <div key="gherkin">
        <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-graphite-300 mb-1">
          Gherkin Specification
        </h5>
        {renderCodeBlock(gherkinSpec, "gherkin", "max-h-80 overflow-auto")}
      </div>,
    );
  }

  const operationsSource =
    (selectedData.data.operations as Record<string, unknown>) ||
    (metadata.operations as Record<string, unknown>);

  if (operationsSource && typeof operationsSource === "object") {
    Object.entries(operationsSource).forEach(([method, operationValue]) => {
      if (!operationValue || typeof operationValue !== "object") {
        return;
      }
      const operation = operationValue as Record<string, unknown>;
      const summary = typeof operation.summary === "string" ? operation.summary : undefined;
      const descriptionValue =
        typeof operation.description === "string" ? operation.description : undefined;
      const tags = Array.isArray(operation.tags)
        ? operation.tags.filter((tag): tag is string => typeof tag === "string")
        : undefined;
      const parameters = Array.isArray(operation.parameters)
        ? (operation.parameters as Array<Record<string, unknown>>)
        : [];
      const requestBody = (operation.requestBody as Record<string, unknown>) || undefined;
      const responses = (operation.responses as Record<string, unknown>) || undefined;

      const parameterNodes = parameters.map((param, index) => {
        const description =
          param && typeof param.description === "string" ? param.description : undefined;

        return (
          <li key={`param-${method}-${index}`} className="space-y-1">
            <div className="text-xs font-medium text-graphite-600 dark:text-graphite-300">
              {String(param.name ?? `param-${index + 1}`)} ({String(param["in"] ?? "unknown")})
            </div>
            {description && (
              <p className="text-xs text-graphite-500 dark:text-graphite-300">{description}</p>
            )}
          </li>
        );
      });

      details.push(
        <div key={`operation-${method}`} className="space-y-2">
          <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-graphite-300">
            {method.toUpperCase()} Operation
          </h5>
          {summary && (
            <p
              className={`text-sm font-medium text-gray-800 dark:text-graphite-100 ${surfaceClasses}`}
            >
              {summary}
            </p>
          )}
          {descriptionValue && (
            <p
              className={`text-sm text-gray-700 dark:text-graphite-200 whitespace-pre-wrap break-words ${surfaceClasses}`}
            >
              {descriptionValue}
            </p>
          )}
          {tags && tags.length > 0 && (
            <div className="text-xs text-graphite-500 dark:text-graphite-300">
              Tags: {tags.join(", ")}
            </div>
          )}
          {parameters.length > 0 && (
            <div>
              <h6 className="text-[11px] font-semibold uppercase tracking-wide text-graphite-500 dark:text-graphite-300 mb-1">
                Parameters
              </h6>
              <ul className="space-y-2">{parameterNodes}</ul>
            </div>
          )}
          {requestBody && Object.keys(requestBody).length > 0 && (
            <div className="space-y-1">
              <h6 className="text-[11px] font-semibold uppercase tracking-wide text-graphite-500 dark:text-graphite-300">
                Request Body
              </h6>
              <pre className={`text-xs whitespace-pre-wrap break-words ${surfaceClasses}`}>
                {JSON.stringify(requestBody, null, 2)}
              </pre>
            </div>
          )}
          {responses && Object.keys(responses).length > 0 && (
            <div className="space-y-1">
              <h6 className="text-[11px] font-semibold uppercase tracking-wide text-graphite-500 dark:text-graphite-300">
                Responses
              </h6>
              <pre className={`text-xs whitespace-pre-wrap break-words ${surfaceClasses}`}>
                {JSON.stringify(responses, null, 2)}
              </pre>
            </div>
          )}
        </div>,
      );
    });
  }

  if (filePath) {
    const detail = buildDetail("File Path", filePath, { code: true });
    if (detail) {
      details.push(detail);
    }
  }

  if (isPackageJson) {
    const packageFields: Array<React.ReactNode> = [];
    const packageName = metadata.packageName || displayName;
    if (packageName && packageName !== displayName) {
      const detail = buildDetail("Package Name", packageName);
      if (detail) packageFields.push(detail);
    }

    const packageContentSource =
      metadata.packageJson ??
      metadata.package ??
      metadata.manifest ??
      metadata.contents ??
      metadata.content ??
      selectedData.data.content;

    const packageContent = packageContentSource
      ? typeof packageContentSource === "string"
        ? packageContentSource
        : JSON.stringify(packageContentSource, null, 2)
      : "";

    if (packageContent) {
      packageFields.push(
        <div key="package-contents">
          <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-graphite-300 mb-1">
            Package Contents
          </h5>
          {renderCodeBlock(packageContent, "json", "max-h-64 overflow-auto scrollbar-transparent")}
        </div>,
      );
    }

    details.push(...packageFields);
  } else {
    const httpMethods = metadata.httpMethods || selectedData.data.httpMethods;
    const routePath = metadata.routePath || selectedData.data.path;
    const routeBase = metadata.routeBasePath;
    const controllerPath = metadata.controllerPath;
    const tags = metadata.tags;
    const packageName = metadata.packageName;
    const packageRoot = metadata.packageRoot;
    const rawDockerMetadata =
      (metadata.docker && typeof metadata.docker === "object"
        ? (metadata.docker as Record<string, unknown>)
        : null) ||
      (selectedData.data.docker && typeof selectedData.data.docker === "object"
        ? (selectedData.data.docker as Record<string, unknown>)
        : null);

    const dockerMetadata: Record<string, unknown> = rawDockerMetadata
      ? { ...rawDockerMetadata }
      : {};

    if (
      typeof metadata.composeServiceYaml === "string" &&
      dockerMetadata["composeServiceYaml"] === undefined
    ) {
      dockerMetadata["composeServiceYaml"] = metadata.composeServiceYaml;
    }
    if (
      metadata.composeService &&
      typeof metadata.composeService === "object" &&
      dockerMetadata["composeService"] === undefined
    ) {
      dockerMetadata["composeService"] = metadata.composeService as Record<string, unknown>;
    }
    if (
      typeof metadata.composeServiceName === "string" &&
      dockerMetadata["composeServiceName"] === undefined
    ) {
      dockerMetadata["composeServiceName"] = metadata.composeServiceName;
    }
    if (typeof metadata.composeFile === "string" && dockerMetadata["composeFile"] === undefined) {
      dockerMetadata["composeFile"] = metadata.composeFile;
    }
    if (
      typeof metadata.dockerfileContent === "string" &&
      dockerMetadata["dockerfile"] === undefined
    ) {
      dockerMetadata["dockerfile"] = metadata.dockerfileContent;
    }
    if (
      typeof metadata.dockerfilePath === "string" &&
      dockerMetadata["dockerfilePath"] === undefined
    ) {
      dockerMetadata["dockerfilePath"] = metadata.dockerfilePath;
    }
    if (typeof metadata.buildContext === "string" && dockerMetadata["buildContext"] === undefined) {
      dockerMetadata["buildContext"] = metadata.buildContext;
    }

    const composeFileYaml = (() => {
      const candidates: Array<unknown> = [
        metadata.composeYaml,
        selectedData.data.composeYaml,
        dockerMetadata["composeYaml"],
      ];

      for (const candidate of candidates) {
        if (typeof candidate !== "string") continue;
        const trimmed = candidate.trim();
        if (trimmed) {
          return trimmed;
        }
      }

      return "";
    })();

    const dockerfileContent = (() => {
      const candidates: Array<unknown> = [
        dockerMetadata["dockerfileContent"],
        dockerMetadata["dockerfile"],
        metadata.dockerfileContent,
        metadata.dockerfile,
        selectedData.data.dockerfileContent,
        selectedData.data.dockerfile,
      ];

      for (const candidate of candidates) {
        if (typeof candidate !== "string") continue;
        const trimmed = candidate.trim();
        if (!trimmed) continue;
        if (trimmed.includes("\n") || /^\s*(FROM|ARG|ENV|RUN|CMD|ENTRYPOINT)\b/i.test(trimmed)) {
          return trimmed;
        }
      }
      return "";
    })();

    const composeServiceYaml = (() => {
      const yamlCandidates: Array<unknown> = [
        dockerMetadata["composeServiceYaml"],
        metadata.composeServiceYaml,
        selectedData.data.composeServiceYaml,
      ];

      for (const candidate of yamlCandidates) {
        if (typeof candidate !== "string") continue;
        const trimmed = candidate.trim();
        if (!trimmed) continue;
        if (trimmed.includes("\n") || trimmed.includes(":")) {
          return trimmed;
        }
      }

      const serviceCandidates: Array<unknown> = [
        dockerMetadata["composeService"],
        metadata.composeService,
        selectedData.data.composeService,
      ];

      for (const candidate of serviceCandidates) {
        if (!candidate || typeof candidate !== "object") continue;
        try {
          const rendered = yaml.stringify(candidate, { indent: 2 }).trim();
          if (rendered) return rendered;
        } catch (error) {
          console.warn("Failed to stringify compose service metadata", error);
        }
      }

      return "";
    })();

    const containerImage =
      metadata.containerImage ?? dockerMetadata?.image ?? dockerMetadata?.containerImage;

    const allowedAdditionalDetails = [
      buildDetail("Package", packageName),
      buildDetail("Route Path", routePath, { code: true }),
      buildDetail("Route Base Path", routeBase, { code: true }),
      buildDetail("HTTP Methods", httpMethods),
      buildDetail("Controller Path", controllerPath, { code: true }),
      buildDetail("Tags", tags),
      buildDetail("Docker Image", containerImage),
    ].filter(Boolean) as React.ReactNode[];

    details.push(...allowedAdditionalDetails);

    // Include selected props metadata if present
    const props = metadata.props || selectedData.data.props;
    if (props) {
      const formattedProps = typeof props === "string" ? props : JSON.stringify(props, null, 2);
      details.push(
        <div key="props">
          <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-graphite-300 mb-1">
            Props
          </h5>
          {renderCodeBlock(formattedProps, "json")}
        </div>,
      );
    }

    if (composeFileYaml) {
      details.push(
        <div key="docker-compose-file">
          <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-graphite-300 mb-1">
            Docker Compose File
          </h5>
          {renderCodeBlock(
            composeFileYaml,
            "yaml",
            "max-h-64 overflow-auto scrollbar-transparent whitespace-pre",
          )}
        </div>,
      );
    }

    if (composeServiceYaml && composeServiceYaml !== composeFileYaml) {
      details.push(
        <div key="docker-compose-service">
          <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-graphite-300 mb-1">
            Docker Compose Service
          </h5>
          {renderCodeBlock(
            composeServiceYaml,
            "yaml",
            "max-h-64 overflow-auto scrollbar-transparent whitespace-pre",
          )}
        </div>,
      );
    }

    if (dockerfileContent) {
      details.push(
        <div key="dockerfile">
          <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-graphite-300 mb-1">
            Dockerfile
          </h5>
          {renderCodeBlock(
            dockerfileContent,
            "dockerfile",
            "max-h-64 overflow-auto scrollbar-transparent whitespace-pre",
          )}
        </div>,
      );
    }
  }

  return (
    <Modal
      open={Boolean(selectedComponent)}
      onClose={onClose}
      size="2xl"
      containerClassName="px-4"
      className="bg-white dark:bg-graphite-800 text-left shadow-2xl border border-graphite-25 dark:border-graphite-700"
      showDefaultFooter={false}
      showCloseButton={false}
    >
      <div className="space-y-6 text-gray-900 dark:text-graphite-100">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            {TypeIcon && (
              <TypeIcon className="h-5 w-5 text-graphite-700 dark:text-graphite-200 mt-0.5" />
            )}
            <div>
              <h2 className="text-lg font-semibold text-graphite-900 dark:text-graphite-25">
                {displayName}
              </h2>
              {normalizedType && !isPackageJson && (
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-graphite-400">
                  {normalizedType}
                </p>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full text-gray-500 hover:text-gray-700 dark:text-graphite-300 dark:hover:text-gray-100"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {infoBadges.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {infoBadges.map((info) => (
              <span
                key={info.label}
                className="text-xs font-semibold uppercase tracking-wide bg-gray-100 dark:bg-graphite-800 text-gray-600 dark:text-graphite-200 px-2 py-1 rounded-full"
              >
                {info.label}: {info.value}
              </span>
            ))}
          </div>
        )}

        <div className="space-y-5">
          {details.length > 0 ? (
            details.map((detail, index) => <Fragment key={index}>{detail}</Fragment>)
          ) : (
            <p className="text-sm text-gray-600 dark:text-graphite-300">
              No additional metadata available for this item.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
};
