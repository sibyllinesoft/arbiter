// Minimal shared types for CLI - copied to avoid workspace dependencies on EXFAT
export interface AnalyzeRequest {
  text: string;
  projectId?: string;
  timeout?: number;
}

export interface AnalysisResult {
  valid: boolean;
  errors: Array<{
    message: string;
    path?: string;
    line?: number;
    column?: number;
  }>;
  output?: any;
  executionTime: number;
}

export interface CreateProject {
  name: string;
  description?: string;
}

export interface ProjectResponse {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}