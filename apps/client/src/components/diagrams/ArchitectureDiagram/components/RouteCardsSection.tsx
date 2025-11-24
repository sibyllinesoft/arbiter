import StatusBadge from "@/design-system/components/StatusBadge";
import { clsx } from "clsx";
import React, { useEffect, useMemo, useState } from "react";
import type {
  FrontendPackage,
  RouteEndpoint,
  RouteEndpointDocumentation,
  RouteEndpointParameter,
  RouteEndpointResponse,
} from "./FrontendTree";

interface RouteCardsSectionProps {
  title: string;
  packages: FrontendPackage[];
}

const METHOD_STYLES: Record<string, string> = {
  GET: "bg-graphite-900 text-graphite-200 border border-graphite-600",
  POST: "bg-graphite-900 text-graphite-200 border border-graphite-600",
  PUT: "bg-graphite-900 text-graphite-200 border border-graphite-600",
  PATCH: "bg-graphite-900 text-graphite-200 border border-graphite-600",
  DELETE: "bg-graphite-900 text-graphite-200 border border-graphite-600",
  OPTIONS: "bg-graphite-900 text-graphite-200 border border-graphite-600",
  HEAD: "bg-graphite-900 text-graphite-200 border border-graphite-600",
};
const DEFAULT_METHOD_STYLE = "bg-graphite-900 text-graphite-200 border border-graphite-600";

const formatMethods = (methods: string[] | undefined) =>
  (methods ?? [])
    .map((method) => method.trim().toUpperCase())
    .filter((method, index, self) => method.length > 0 && self.indexOf(method) === index);

const RouteCardsSection: React.FC<RouteCardsSectionProps> = ({ title, packages }) => {
  const initialExpandedPackages = useMemo(() => {
    const defaults: Record<string, boolean> = {};
    packages.forEach((pkg) => {
      defaults[pkg.packageName] = true;
    });
    return defaults;
  }, [packages]);

  const [expandedPackages, setExpandedPackages] =
    useState<Record<string, boolean>>(initialExpandedPackages);

  useEffect(() => {
    setExpandedPackages(initialExpandedPackages);
  }, [initialExpandedPackages]);

  const togglePackage = (pkgName: string) => {
    setExpandedPackages((prev) => ({
      ...prev,
      [pkgName]: !(prev[pkgName] ?? true),
    }));
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-2 py-1 text-sm font-semibold text-gray-900 dark:text-graphite-25">
        <h3>{title}</h3>
        <StatusBadge
          variant="secondary"
          style="solid"
          size="xs"
          className="rounded-full text-[10px] px-2 py-0.5 !bg-graphite-900 !text-graphite-200 !border-graphite-600"
        >
          {packages.reduce((total, pkg) => total + (pkg.routes?.length ?? 0), 0)}
        </StatusBadge>
      </div>

      <div className="space-y-3">
        {packages.map((pkg) => {
          const packageExpanded = expandedPackages[pkg.packageName] ?? true;
          const routeCount = pkg.routes?.length ?? 0;

          if (!routeCount) {
            return null;
          }

          return (
            <div key={pkg.packageName} className="space-y-2">
              <button
                type="button"
                onClick={() => togglePackage(pkg.packageName)}
                className="w-full rounded-md px-3 py-2 flex items-center justify-between text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-graphite-200 dark:hover:bg-graphite-800"
              >
                <div className="flex flex-col items-start text-left">
                  <span className="text-sm font-medium text-gray-900 dark:text-graphite-25">
                    {pkg.packageName}
                  </span>
                  {pkg.frameworks.length > 0 && (
                    <span className="text-xs text-gray-500 dark:text-graphite-400">
                      {pkg.frameworks.join(", ")}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge
                    variant="secondary"
                    style="solid"
                    size="xs"
                    className="rounded-full text-[10px] px-2 py-0.5"
                  >
                    {routeCount}
                  </StatusBadge>
                  <svg
                    className={clsx(
                      "w-4 h-4 text-gray-400 dark:text-graphite-400 transition-transform",
                      packageExpanded ? "rotate-180" : "",
                    )}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </button>

              <div
                className={clsx(
                  "grid transition-[grid-template-rows] duration-300 ease-out",
                  packageExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
                aria-hidden={!packageExpanded}
              >
                <div
                  className={clsx(
                    "overflow-hidden transition-opacity duration-200 ease-out",
                    packageExpanded ? "opacity-100 delay-100" : "opacity-0 pointer-events-none",
                  )}
                >
                  <div className="divide-y divide-gray-100 dark:divide-graphite-800">
                    {(pkg.routes ?? []).map((route, index) => {
                      const routeKey = `${pkg.packageName}-${route.path || route.displayLabel || index}`;
                      const methods = formatMethods(
                        route.httpMethods ?? route.metadata?.httpMethods,
                      );
                      const metadata = route.metadata ?? {};
                      const endpoints: RouteEndpoint[] = Array.isArray(route.endpoints)
                        ? (route.endpoints as RouteEndpoint[])
                        : Array.isArray(metadata.endpoints)
                          ? (metadata.endpoints as RouteEndpoint[])
                          : [];
                      const configFiles: string[] = Array.isArray(metadata.tsoa?.configFiles)
                        ? (metadata.tsoa.configFiles as string[])
                        : [];
                      const controllerSourceAvailable =
                        metadata.tsoa?.controllerSourceAvailable ??
                        metadata.controllerSourceAvailable;
                      return (
                        <div key={routeKey} className="px-4 py-3 space-y-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex flex-col text-left">
                              <span className="text-sm font-medium text-gray-900 dark:text-graphite-25">
                                {route.displayLabel || route.path || "Route"}
                                {route.isBaseRoute && (
                                  <span className="ml-2 text-[11px] font-normal text-gray-500 dark:text-graphite-400">
                                    (base route)
                                  </span>
                                )}
                              </span>
                              {route.path && (
                                <span className="text-xs text-gray-500 dark:text-graphite-400 font-mono">
                                  {route.path}
                                </span>
                              )}
                              {metadata.controllerPath && (
                                <span className="text-[11px] text-gray-400 dark:text-graphite-500">
                                  {metadata.controllerPath}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1 justify-end">
                              {(methods.length ? methods : ["ANY"]).map((method) => (
                                <span
                                  key={`${routeKey}-${method}`}
                                  className={clsx(
                                    "px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase",
                                    METHOD_STYLES[method] ?? DEFAULT_METHOD_STYLE,
                                  )}
                                >
                                  {method}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-3 text-xs text-gray-600 dark:text-graphite-200">
                            <div className="grid gap-1">
                              {metadata.tsoa?.controllerClass && (
                                <div>
                                  <span className="uppercase tracking-wide text-[10px] text-gray-400 dark:text-graphite-400">
                                    Controller
                                  </span>
                                  <div className="text-[11px] text-gray-700 dark:text-graphite-200">
                                    {metadata.tsoa.controllerClass}
                                  </div>
                                </div>
                              )}
                              {Array.isArray(metadata.tags) && metadata.tags.length > 0 && (
                                <div className="flex items-center flex-wrap gap-1">
                                  <span className="uppercase tracking-wide text-[10px] text-gray-400 dark:text-graphite-400">
                                    Tags
                                  </span>
                                  {metadata.tags.map((tag: string) => (
                                    <span
                                      key={`${routeKey}-tag-${tag}`}
                                      className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-graphite-700 dark:text-graphite-200"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {endpoints.length > 0 && (
                              <div>
                                <span className="uppercase tracking-wide text-[10px] text-gray-400 dark:text-graphite-400">
                                  Endpoints
                                </span>
                                <div className="mt-1 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                                  {endpoints.map((endpoint, idx) => {
                                    const endpointMethods = formatMethods([endpoint.method]);
                                    const parameters = Array.isArray(endpoint.parameters)
                                      ? endpoint.parameters
                                      : [];
                                    const responses = Array.isArray(endpoint.responses)
                                      ? endpoint.responses
                                      : [];
                                    const documentation: RouteEndpointDocumentation =
                                      endpoint.documentation ?? {};
                                    const hasDescription = Boolean(
                                      documentation.description || documentation.summary,
                                    );

                                    return (
                                      <div
                                        key={`${routeKey}-endpoint-${idx}`}
                                        className="rounded-md border border-gray-100 dark:border-graphite-800/60 bg-gray-50/60 dark:bg-graphite-800/40 p-3 space-y-2"
                                      >
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                          <div className="flex flex-wrap items-center gap-2">
                                            {endpointMethods.map((method) => (
                                              <span
                                                key={`${routeKey}-endpoint-${idx}-${method}`}
                                                className={clsx(
                                                  "px-1.5 py-0.5 rounded-full text-[10px] font-semibold uppercase",
                                                  METHOD_STYLES[method] ?? DEFAULT_METHOD_STYLE,
                                                )}
                                              >
                                                {method}
                                              </span>
                                            ))}
                                            <span className="font-mono text-[11px] text-gray-700 dark:text-graphite-100">
                                              {endpoint.fullPath && endpoint.fullPath.length > 0
                                                ? endpoint.fullPath
                                                : endpoint.path && endpoint.path.length > 0
                                                  ? endpoint.path
                                                  : "/"}
                                            </span>
                                          </div>
                                          <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-400 dark:text-graphite-400">
                                            {endpoint.controller && (
                                              <span>{endpoint.controller}</span>
                                            )}
                                            {endpoint.handler && <span>{endpoint.handler}</span>}
                                            {endpoint.source?.line && (
                                              <span>line {endpoint.source.line}</span>
                                            )}
                                          </div>
                                        </div>

                                        {hasDescription && (
                                          <div className="space-y-1">
                                            {documentation.summary && (
                                              <div className="text-[11px] text-gray-700 dark:text-graphite-200">
                                                {documentation.summary}
                                              </div>
                                            )}
                                            {documentation.description && (
                                              <div className="text-[10px] text-gray-500 dark:text-graphite-300 whitespace-pre-line leading-relaxed">
                                                {documentation.description}
                                              </div>
                                            )}
                                          </div>
                                        )}

                                        {endpoint.signature && (
                                          <div className="font-mono text-[10px] text-gray-500 dark:text-graphite-400 break-words">
                                            {endpoint.signature}
                                          </div>
                                        )}

                                        {parameters.length > 0 && (
                                          <div className="text-[10px] text-gray-500 dark:text-graphite-300">
                                            <span className="uppercase tracking-wide text-[9px] text-gray-400 dark:text-graphite-400">
                                              Parameters
                                            </span>
                                            <ul className="mt-1 space-y-1">
                                              {parameters.map((param: RouteEndpointParameter) => (
                                                <li
                                                  key={`${routeKey}-endpoint-${idx}-param-${param.name}`}
                                                >
                                                  <div className="flex flex-wrap items-center gap-1">
                                                    <span className="font-mono text-[10px] text-gray-700 dark:text-graphite-200">
                                                      {param.name}
                                                      {param.optional ? "?" : ""}
                                                      {param.type ? `: ${param.type}` : ""}
                                                    </span>
                                                    {param.decorators?.map((dec) => (
                                                      <span
                                                        key={`${routeKey}-endpoint-${idx}-param-${param.name}-${dec}`}
                                                        className="px-1.5 py-[1px] rounded-full bg-gray-200/80 text-gray-600 dark:bg-graphite-700 dark:text-graphite-200 text-[9px] uppercase tracking-wide"
                                                      >
                                                        {dec}
                                                      </span>
                                                    ))}
                                                  </div>
                                                  {param.description && (
                                                    <div className="text-[10px] text-gray-500 dark:text-graphite-400 whitespace-pre-line">
                                                      {param.description}
                                                    </div>
                                                  )}
                                                </li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}

                                        {(documentation.returns || responses.length > 0) && (
                                          <div className="space-y-1 text-[10px] text-gray-500 dark:text-graphite-300">
                                            {documentation.returns && (
                                              <div>
                                                <span className="uppercase tracking-wide text-[9px] text-gray-400 dark:text-graphite-400">
                                                  Returns
                                                </span>
                                                <div className="mt-0.5 whitespace-pre-line">
                                                  {documentation.returns}
                                                </div>
                                              </div>
                                            )}
                                            {responses.length > 0 && (
                                              <div>
                                                <span className="uppercase tracking-wide text-[9px] text-gray-400 dark:text-graphite-400">
                                                  Responses
                                                </span>
                                                <ul className="mt-0.5 space-y-0.5">
                                                  {responses.map(
                                                    (
                                                      response: RouteEndpointResponse,
                                                      responseIdx,
                                                    ) => (
                                                      <li
                                                        key={`${routeKey}-endpoint-${idx}-response-${responseIdx}`}
                                                        className="flex items-baseline gap-1"
                                                      >
                                                        <span className="font-mono text-[10px] text-gray-700 dark:text-graphite-200">
                                                          {response.status ?? "—"}
                                                        </span>
                                                        {response.description && (
                                                          <span className="text-[10px] text-gray-500 dark:text-graphite-400">
                                                            {response.description}
                                                          </span>
                                                        )}
                                                      </li>
                                                    ),
                                                  )}
                                                </ul>
                                              </div>
                                            )}
                                          </div>
                                        )}

                                        {documentation.deprecated && (
                                          <div className="text-[10px] text-amber-600 dark:text-amber-400">
                                            Deprecated
                                            {typeof documentation.deprecated === "string"
                                              ? `: ${documentation.deprecated}`
                                              : ""}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {endpoints.length === 0 && controllerSourceAvailable === false && (
                              <div className="space-y-1">
                                <div className="text-[10px] text-gray-500 dark:text-graphite-400">
                                  Arbiter couldn't read the controller source file, so endpoint
                                  details are unavailable.
                                </div>
                              </div>
                            )}

                            {configFiles.length > 0 && (
                              <div>
                                <span className="uppercase tracking-wide text-[10px] text-gray-400 dark:text-graphite-400">
                                  TSOA Config Files
                                </span>
                                <ul className="mt-1 space-y-1">
                                  {configFiles.map((file) => (
                                    <li
                                      key={`${routeKey}-cfg-${file}`}
                                      className="font-mono text-[11px] text-gray-600 dark:text-graphite-300"
                                    >
                                      {file}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default RouteCardsSection;
