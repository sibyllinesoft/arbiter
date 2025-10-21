/**
 * Resizable split pane component
 */

import { clsx } from "clsx";
import React, { useState, useRef, useEffect, useCallback } from "react";
import type { SplitPaneProps } from "../../types/ui";

export function SplitPane({
  children,
  defaultSize = "50%",
  minSize = "200px",
  maxSize = "80%",
  allowResize = true,
  split = "vertical",
  className,
  resizerStyle,
}: SplitPaneProps) {
  const [size, setSize] = useState<string>(
    typeof defaultSize === "string" ? defaultSize : `${defaultSize}px`,
  );
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const resizerRef = useRef<HTMLDivElement>(null);

  // Convert size to pixels for calculations
  const getPixelSize = useCallback((sizeStr: string, containerSize: number): number => {
    if (sizeStr.endsWith("%")) {
      return (parseFloat(sizeStr) / 100) * containerSize;
    }
    return parseFloat(sizeStr);
  }, []);

  // Handle mouse down on resizer
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!allowResize) return;

      e.preventDefault();
      setIsDragging(true);
    },
    [allowResize],
  );

  // Handle mouse move during drag
  useEffect(() => {
    if (!isDragging || !containerRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const containerSize = split === "vertical" ? containerRect.width : containerRect.height;
      const offset =
        split === "vertical" ? e.clientX - containerRect.left : e.clientY - containerRect.top;

      // Calculate percentage
      const percentage = (offset / containerSize) * 100;

      // Apply constraints
      const minPixels = getPixelSize(
        typeof minSize === "string" ? minSize : `${minSize}px`,
        containerSize,
      );
      const maxPixels = getPixelSize(
        typeof maxSize === "string" ? maxSize : `${maxSize}px`,
        containerSize,
      );
      const minPercentage = (minPixels / containerSize) * 100;
      const maxPercentage = (maxPixels / containerSize) * 100;

      const clampedPercentage = Math.max(minPercentage, Math.min(maxPercentage, percentage));
      setSize(`${clampedPercentage}%`);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = split === "vertical" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging, split, getPixelSize, minSize, maxSize]);

  const isVertical = split === "vertical";
  const [leftPane, rightPane] = children;

  return (
    <div
      ref={containerRef}
      className={clsx(
        "flex h-full w-full overflow-hidden",
        isVertical ? "flex-row" : "flex-col",
        className,
      )}
    >
      {/* First pane */}
      <div
        className="relative overflow-hidden"
        style={{
          [isVertical ? "width" : "height"]: size,
          [isVertical ? "height" : "width"]: "100%",
        }}
      >
        {leftPane}
      </div>

      {/* Resizer */}
      {allowResize && (
        <div
          ref={resizerRef}
          className={clsx(
            "bg-gray-300 hover:bg-gray-400 transition-colors duration-150 flex-shrink-0",
            isVertical ? "w-1 cursor-col-resize hover:w-2" : "h-1 cursor-row-resize hover:h-2",
            isDragging && (isVertical ? "w-2 bg-blue-500" : "h-2 bg-blue-500"),
          )}
          style={resizerStyle}
          onMouseDown={handleMouseDown}
        />
      )}

      {/* Second pane */}
      <div
        className="flex-1 overflow-hidden"
        style={{
          [isVertical ? "width" : "height"]: `calc(100% - ${size} - 4px)`,
        }}
      >
        {rightPane}
      </div>
    </div>
  );
}

export default SplitPane;
