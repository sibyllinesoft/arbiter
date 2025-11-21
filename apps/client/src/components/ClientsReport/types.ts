export interface ClientsReportProps {
  projectId: string;
  className?: string;
}

export interface ClientMetadataItem {
  label: string;
  value: string;
}

export interface NormalizedClientView {
  key: string;
  path: string;
  component?: string;
  routerType?: string;
  filePath?: string;
}

export interface NormalizedClient {
  key: string;
  identifier: string;
  displayName: string;
  description?: string;
  metadataItems: ClientMetadataItem[];
  views: NormalizedClientView[];
  hasSource: boolean;
  sourcePath?: string;
  typeLabel?: string;
  language?: string | null;
  raw: any;
}

export interface ExternalArtifactCard {
  key: string;
  name: string;
  description?: string;
  data: Record<string, unknown>;
}
