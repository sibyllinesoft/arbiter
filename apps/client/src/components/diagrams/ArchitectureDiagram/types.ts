export interface ArchitectureDiagramProps {
  projectId: string;
  className?: string;
}

export interface Component {
  id: string;
  name: string;
  type: 'frontend' | 'backend' | 'tool' | 'data' | 'external';
  description: string;
  technologies: string[];
  position: { x: number; y: number };
  size: { width: number; height: number };
  ports?: { id: string; position: { x: number; y: number } }[];
}

export interface Connection {
  from: { componentId: string; portId?: string };
  to: { componentId: string; portId?: string };
  type: 'api' | 'websocket' | 'file' | 'data';
  label?: string;
  bidirectional?: boolean;
}
