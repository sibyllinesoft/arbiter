import type { EnvironmentMap } from "@/utils/environment";
import type { LucideIcon } from "lucide-react";

export interface ServicesReportProps {
  projectId: string;
  className?: string;
}

export interface ServiceMetadataItem {
  label: string;
  value: string;
  icon: LucideIcon;
}

export interface NormalizedEndpointCard {
  key: string;
  name: string;
  data: Record<string, unknown>;
}

export interface NormalizedService {
  key: string;
  identifier: string;
  displayName: string;
  description?: string;
  metadataItems: ServiceMetadataItem[];
  endpoints: NormalizedEndpointCard[];
  hasSource: boolean;
  typeLabel?: string;
  raw: Record<string, unknown> | null;
  sourcePath?: string;
  artifactId?: string | null;
  environment?: EnvironmentMap;
}

export interface ExternalArtifactCard {
  key: string;
  name: string;
  data: Record<string, unknown>;
}
