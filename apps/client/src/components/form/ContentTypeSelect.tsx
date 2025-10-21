import { useMemo } from "react";
import type { SingleValue } from "react-select";

import { BaseCreatableSelect } from "./BaseSelect";

const COMMON_CONTENT_TYPES = [
  "application/json",
  "application/xml",
  "text/plain",
  "text/html",
  "application/x-www-form-urlencoded",
  "multipart/form-data",
  "application/octet-stream",
  "application/vnd.api+json",
  "application/ld+json",
  "application/problem+json",
  "application/vnd.apple.property-list",
];

export interface ContentTypeSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isDisabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}

interface Option {
  value: string;
  label: string;
}

export function ContentTypeSelect({
  value,
  onChange,
  placeholder = "Select content type…",
  isDisabled = false,
  autoFocus = false,
  className,
}: ContentTypeSelectProps) {
  const options = useMemo<Option[]>(() => {
    const base = COMMON_CONTENT_TYPES.map((type) => ({ value: type, label: type }));
    if (value && !COMMON_CONTENT_TYPES.includes(value)) {
      return [{ value, label: value }, ...base];
    }
    return base;
  }, [value]);

  return (
    <BaseCreatableSelect<Option>
      autoFocus={autoFocus}
      isDisabled={isDisabled}
      isClearable
      isSearchable
      className={className ?? ""}
      options={options}
      value={value ? { value, label: value } : null}
      onChange={(option: SingleValue<Option>) => onChange(option?.value ?? "")}
      onCreateOption={(inputValue: string) => onChange(inputValue)}
      placeholder={placeholder}
      menuPlacement="auto"
      menuPosition="fixed"
    />
  );
}

export default ContentTypeSelect;
