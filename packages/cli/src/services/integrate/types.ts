export interface BuildMatrix {
  versions: string[];
  os: string[];
  arch: string[];
}

export interface ProjectLanguage {
  name: string;
  detected: boolean;
  files: string[];
  framework?: string;
}

export interface AssemblyConfig {
  buildMatrix?: BuildMatrix;
  language?: string;
  profile?: string;
}
