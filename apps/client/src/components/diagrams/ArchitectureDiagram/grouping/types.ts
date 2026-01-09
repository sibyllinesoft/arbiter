/**
 * @module ArchitectureDiagram/grouping/types
 * Type definitions for component grouping and rendering in the architecture diagram.
 */

export type TreeMode = "components" | "routes";

export interface GroupedComponentItem {
  name: string;
  data: any;
}

export interface GroupedComponentGroup {
  key: string;
  label: string;
  type: string;
  layout: "grid" | "tree";
  treeMode?: TreeMode;
  items: GroupedComponentItem[];
}

export interface RouteEndpointParameter {
  name: string;
  type?: string;
  optional: boolean;
  description?: string;
  decorators?: string[];
}

export interface RouteEndpointResponse {
  decorator: "SuccessResponse" | "Response";
  status?: string;
  description?: string;
}

export interface RouteEndpointDocumentation {
  summary?: string;
  description?: string;
  returns?: string;
  remarks?: string[];
  examples?: string[];
  deprecated?: boolean | string;
}

export interface RouteEndpoint {
  method: string;
  path?: string;
  fullPath?: string;
  controller?: string;
  handler?: string;
  returnType?: string;
  signature: string;
  documentation?: RouteEndpointDocumentation;
  parameters: RouteEndpointParameter[];
  responses: RouteEndpointResponse[];
  tags?: string[];
  source?: { line: number };
}

export interface FrontendPackage {
  packageName: string;
  packageRoot: string;
  frameworks: string[];
  components?: Array<{
    name: string;
    filePath: string;
    framework: string;
    description?: string;
    props?: any;
  }>;
  routes?: Array<{
    path: string;
    filePath?: string;
    treePath?: string;
    routerType?: string;
    displayLabel: string;
    httpMethods: string[];
    endpoints: RouteEndpoint[];
    metadata: any;
    isBaseRoute: boolean;
  }>;
}
