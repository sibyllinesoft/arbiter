import type { SelectOption } from "@/design-system/components/Select";
import type { HttpMethod, ParameterLocation, RequestBodyState } from "./types";

export const HTTP_METHOD_VALUES: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];
export const HTTP_METHOD_OPTIONS: SelectOption[] = HTTP_METHOD_VALUES.map((method) => ({
  value: method,
  label: method,
}));

export const PARAM_LOCATION_VALUES: ParameterLocation[] = ["path", "query", "header", "cookie"];
export const PARAM_LOCATION_OPTIONS: SelectOption[] = PARAM_LOCATION_VALUES.map((location) => ({
  value: location,
  label: location,
}));

export const DEFAULT_REQUEST_BODY: RequestBodyState = {
  description: "",
  required: false,
  contentType: "application/json",
  schemaRef: "",
  example: "",
};

export const INPUT_SURFACE_CLASSES =
  "bg-graphite-200 border-graphite-500 dark:bg-graphite-950 dark:border-graphite-700";
export const CHECKBOX_SURFACE_CLASSES =
  "bg-graphite-200 border-graphite-500 dark:bg-graphite-950 dark:border-graphite-700";
export const JSON_EDITOR_CONTAINER_CLASSES =
  "h-40 rounded-md border border-graphite-500 bg-graphite-200 dark:border-graphite-700 dark:bg-graphite-950 overflow-hidden shadow-inner";

export const PARAMETER_NEW_OPTION_VALUE = "__new-parameter__";
export const PARAMETER_DIVIDER_VALUE = "__parameter-divider__";
export const RESPONSE_NEW_OPTION_VALUE = "__new-response__";
export const RESPONSE_DIVIDER_VALUE = "__response-divider__";
