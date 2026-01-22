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
  description?: string | undefined;
  metadataItems: ServiceMetadataItem[];
  endpoints: NormalizedEndpointCard[];
  hasSource: boolean;
  typeLabel?: string | undefined;
  raw: Record<string, unknown> | null;
  sourcePath?: string | undefined;
  artifactId?: string | null | undefined;
  environment?: EnvironmentMap | undefined;
}

export interface ExternalArtifactCard {
  key: string;
  name: string;
  data: Record<string, unknown>;
}
