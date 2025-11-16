import Button from "@/design-system/components/Button";
import Input from "@/design-system/components/Input";
import clsx from "clsx";
import { Plus, Trash2 } from "lucide-react";
import React from "react";

export interface KeyValueEntry {
  key: string;
  value: string;
}

export interface KeyValueEditorProps {
  pairs?: KeyValueEntry[];
  onChange: (pairs: KeyValueEntry[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  addLabel?: string;
  className?: string;
}

const normalizePairs = (pairs?: KeyValueEntry[]): KeyValueEntry[] => {
  if (!Array.isArray(pairs)) return [];
  return pairs.map((pair) => ({
    key: typeof pair?.key === "string" ? pair.key : "",
    value: typeof pair?.value === "string" ? pair.value : "",
  }));
};

const KeyValueEditor: React.FC<KeyValueEditorProps> = ({
  pairs,
  onChange,
  keyPlaceholder = "KEY",
  valuePlaceholder = "Value",
  addLabel = "Add variable",
  className,
}) => {
  const normalized = normalizePairs(pairs);

  const handleUpdate = (index: number, field: "key" | "value", value: string) => {
    const next = normalized.map((pair, pairIndex) =>
      pairIndex === index ? { ...pair, [field]: value } : pair,
    );
    onChange(next);
  };

  const handleRemove = (index: number) => {
    const next = normalized.filter((_, pairIndex) => pairIndex !== index);
    onChange(next);
  };

  const handleAdd = () => {
    onChange([...normalized, { key: "", value: "" }]);
  };

  return (
    <div className={clsx("space-y-3", className)}>
      <div className="space-y-2">
        {normalized.length === 0 && (
          <p className="rounded-md border border-dashed border-graphite-300 bg-white px-3 py-2 text-xs text-graphite-500 dark:border-graphite-700 dark:bg-graphite-950 dark:text-graphite-300">
            No variables defined. Add a key/value pair to capture runtime configuration.
          </p>
        )}
        {normalized.map((pair, index) => (
          <div
            key={`kv-${index}`}
            className="flex items-center gap-3 rounded-md border border-graphite-200/80 bg-white px-3 py-2 dark:border-graphite-700/60 dark:bg-graphite-900/40"
          >
            <Input
              label="Key"
              hideLabel
              placeholder={keyPlaceholder}
              value={pair.key}
              onChange={(event) => handleUpdate(index, "key", event.target.value)}
              className="bg-transparent"
            />
            <Input
              label="Value"
              hideLabel
              placeholder={valuePlaceholder}
              value={pair.value}
              onChange={(event) => handleUpdate(index, "value", event.target.value)}
              className="bg-transparent"
            />
            <button
              type="button"
              className="rounded-md p-2 text-graphite-400 transition-colors hover:bg-graphite-100 hover:text-graphite-700 dark:hover:bg-graphite-800"
              onClick={() => handleRemove(index)}
              aria-label="Remove variable"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="secondary"
        leftIcon={<Plus className="h-4 w-4" />}
        onClick={handleAdd}
      >
        {addLabel}
      </Button>
    </div>
  );
};

export default KeyValueEditor;
