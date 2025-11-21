import type { FileTreeItem } from "@/types/ui";
import { clsx } from "clsx";
import { ChevronDown, ChevronRight, Folder, FolderOpen, Trash2 } from "lucide-react";
import React, { useState } from "react";
import { cn } from "../../../../design-system";
import { getFileIcon } from "../utils";

interface FileTreeItemProps {
  item: FileTreeItem;
  level: number;
  expandedFolders: Set<string>;
  activeFragmentId: string | null;
  selectedFiles: Set<string>;
  multiSelect: boolean;
  onToggleFolder: (path: string) => void;
  onFileSelect: (fragmentId: string, event?: React.MouseEvent) => void;
  onDeleteFragment: (fragmentId: string, fragmentPath: string) => void;
}

export function FileTreeItem({
  item,
  level,
  expandedFolders,
  activeFragmentId,
  selectedFiles,
  multiSelect,
  onToggleFolder,
  onFileSelect,
  onDeleteFragment,
}: FileTreeItemProps) {
  const isExpanded = expandedFolders.has(item.path);
  const isActive = item.type === "file" && activeFragmentId === item.id;
  const isSelected = item.type === "file" && selectedFiles.has(item.id);
  const [showActions, setShowActions] = useState(false);

  const handleClick = (event: React.MouseEvent) => {
    if (item.type === "directory") {
      onToggleFolder(item.path);
    } else {
      onFileSelect(item.id, event);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteFragment(item.id, item.path);
  };

  const fileName = item.path.split("/").pop() || item.path;
  const FileIcon = item.type === "file" ? getFileIcon(fileName) : null;

  // Enhanced indentation with connecting lines
  const indentationElements = [];
  for (let i = 0; i < level; i++) {
    indentationElements.push(
      <div
        key={i}
        className="w-4 flex justify-center"
        style={{ marginLeft: i === 0 ? "0px" : "0px" }}
      >
        <div className="w-px bg-graphite-200 h-full"></div>
      </div>,
    );
  }

  return (
    <>
      <div
        className={cn(
          "group relative flex items-center gap-1.5 py-1 px-2 text-sm cursor-pointer rounded-lg",
          "hover:bg-graphite-50 active:bg-graphite-100",
          "transition-all duration-200 ease-out",
          "focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-graphite-50",
          // Active state for files (editing)
          isActive && [
            "bg-gradient-to-r from-blue-50 to-blue-50/30",
            "border border-blue-200/60",
            "shadow-sm shadow-blue-100/50",
            "text-blue-700",
          ],
          // Selected state for files (multi-select)
          multiSelect &&
            isSelected &&
            !isActive && [
              "bg-gradient-to-r from-green-50 to-green-50/30",
              "border border-green-200/60",
              "shadow-sm shadow-green-100/50",
              "text-green-700",
            ],
          // Directory styling
          item.type === "directory" && "font-medium",
          // Unsaved changes styling
          item.hasUnsavedChanges && "bg-amber-50/50 border border-amber-200/50",
        )}
        onClick={handleClick}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
        tabIndex={0}
        role="button"
        aria-expanded={item.type === "directory" ? isExpanded : undefined}
        aria-label={`${item.type === "directory" ? "Folder" : "File"} ${fileName}`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        {/* Hierarchy connector line */}
        {level > 0 && (
          <div className="absolute left-0 top-0 bottom-0 flex">{indentationElements}</div>
        )}

        {/* Expand/collapse chevron for directories */}
        {item.type === "directory" && (
          <div className="flex-shrink-0 p-0.5 rounded transition-transform duration-200">
            {isExpanded ? (
              <ChevronDown className="h-3 w-3 text-graphite-500" />
            ) : (
              <ChevronRight className="h-3 w-3 text-graphite-500" />
            )}
          </div>
        )}

        {/* Icon */}
        <div
          className={cn(
            "flex-shrink-0 transition-all duration-200",
            item.type === "directory" ? "text-graphite-600" : "text-graphite-500",
          )}
        >
          {item.type === "directory" ? (
            isExpanded ? (
              <FolderOpen className={cn("h-4 w-4", isExpanded && "text-blue-600")} />
            ) : (
              <Folder className="h-4 w-4" />
            )
          ) : (
            FileIcon && (
              <FileIcon
                className={cn(
                  "h-4 w-4",
                  isActive ? "text-blue-600" : "text-graphite-500",
                  // Special styling for CUE files
                  fileName.endsWith(".cue") && "text-purple-500",
                )}
              />
            )
          )}
        </div>

        {/* Name */}
        <span
          className={cn(
            "flex-1 truncate transition-colors duration-200",
            isActive ? "text-blue-800 font-medium" : "text-graphite-700",
            item.type === "directory" && "font-medium",
            item.hasUnsavedChanges && "text-amber-800 font-semibold",
          )}
        >
          {fileName}
        </span>

        {/* Multi-select checkbox */}
        {multiSelect && item.type === "file" && (
          <div className="flex-shrink-0 flex items-center mr-2">
            <div
              className={cn(
                "w-4 h-4 border-2 rounded transition-all duration-200 flex items-center justify-center",
                isSelected
                  ? "bg-green-500 border-green-500 text-white"
                  : "border-graphite-300 hover:border-green-400",
              )}
            >
              {isSelected && (
                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>
          </div>
        )}

        {/* Unsaved changes indicator */}
        {item.hasUnsavedChanges && (
          <div className="flex-shrink-0 flex items-center gap-1">
            <div className="w-2 h-2 bg-amber-500 rounded-full shadow-sm"></div>
          </div>
        )}

        {/* Actions */}
        {item.type === "file" && (
          <div
            className={cn(
              "flex-shrink-0 flex items-center gap-0.5 transition-all duration-200",
              showActions ? "opacity-100 translate-x-0" : "opacity-0 translate-x-2",
            )}
          >
            <button
              type="button"
              className={cn(
                "p-1.5 rounded-md transition-all duration-200",
                "text-graphite-400 hover:text-red-600 hover:bg-red-50",
                "focus:outline-none focus:ring-1 focus:ring-red-500/50",
                "shadow-sm hover:shadow",
              )}
              onClick={handleDelete}
              title="Delete fragment"
              aria-label={`Delete ${fileName}`}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* File type badge for special files */}
        {item.type === "file" && fileName.endsWith(".cue") && (
          <div className="flex-shrink-0">
            <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded">
              CUE
            </span>
          </div>
        )}
      </div>

      {/* Children with smooth animation */}
      {item.type === "directory" && item.children && (
        <div
          className={cn(
            "overflow-hidden transition-all duration-300 ease-out",
            isExpanded ? "max-h-screen opacity-100" : "max-h-0 opacity-0",
          )}
          style={{
            transitionProperty: "max-height, opacity",
          }}
        >
          <div className="space-y-0.5">
            {item.children.map((child) => (
              <FileTreeItem
                key={child.id}
                item={child}
                level={level + 1}
                expandedFolders={expandedFolders}
                activeFragmentId={activeFragmentId}
                selectedFiles={selectedFiles}
                multiSelect={multiSelect}
                onToggleFolder={onToggleFolder}
                onFileSelect={onFileSelect}
                onDeleteFragment={onDeleteFragment}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
