/**
 * HandlersReport - Standalone handlers report component
 */

import React from "react";
import { Handlers } from "./Handlers/Handlers";

interface HandlersReportProps {
  className?: string;
}

export function HandlersReport({ className }: HandlersReportProps) {
  return (
    <div className={`h-full ${className || ""}`}>
      <Handlers />
    </div>
  );
}
