import type { FieldValue, UiOptionCatalog } from "@/components/modals/AddEntityModal";

export interface ArchitectureEntityModalRequest {
  type: string;
  label: string;
  optionCatalog?: UiOptionCatalog | undefined;
  initialValues?: Record<string, FieldValue> | undefined;
  mode?: "create" | "edit";
  titleOverride?: string | undefined;
  descriptionOverride?: string | undefined;
  onSubmit: (payload: {
    entityType: string;
    values: Record<string, FieldValue>;
  }) => Promise<void> | void;
}

export interface ArchitectureDiagramProps {
  projectId: string;
  className?: string;
  onOpenEntityModal?: (request: ArchitectureEntityModalRequest) => void;
}

export interface Component {
  id: string;
  name: string;
  type: "frontend" | "backend" | "tool" | "data" | "external";
  description: string;
  technologies: string[];
  position: { x: number; y: number };
  size: { width: number; height: number };
  ports?: { id: string; position: { x: number; y: number } }[];
}

export interface Connection {
  from: { componentId: string; portId?: string };
  to: { componentId: string; portId?: string };
  type: "api" | "websocket" | "file" | "data";
  label?: string;
  bidirectional?: boolean;
}
