import { ChevronDown } from "lucide-react";
import type { SectionId } from "../types";

export interface AccordionHeaderProps {
  id: SectionId;
  title: string;
  summary: string;
  isOpen: boolean;
  onToggle: (id: SectionId) => void;
}

export function AccordionHeader({ id, title, summary, isOpen, onToggle }: AccordionHeaderProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(id)}
      className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left transition hover:bg-graphite-100/70 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:hover:bg-graphite-800/60 dark:focus:ring-blue-500/40"
    >
      <div>
        <div className="text-sm font-semibold text-graphite-700 dark:text-graphite-100">
          {title}
        </div>
        <div className="text-xs text-graphite-500 dark:text-graphite-300">{summary}</div>
      </div>
      <ChevronDown
        className={`h-4 w-4 text-graphite-500 transition-transform duration-150 ${isOpen ? "rotate-180" : "rotate-0"}`}
      />
    </button>
  );
}
