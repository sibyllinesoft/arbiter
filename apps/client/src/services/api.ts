/**
 * @module api
 * Unified API service for the Arbiter client application.
 * Aggregates all service modules (projects, fragments, auth, etc.)
 * and provides a single interface for API operations.
 */
import type {
  CreateFragmentRequest,
  CreateFragmentResponse,
  Fragment,
  FreezeRequest,
  FreezeResponse,
  IRKind,
  IRResponse,
  ProblemDetails,
  Project,
  ResolvedSpecResponse,
  ValidationRequest,
  ValidationResponse,
} from "@/types/api";
import type { UIOptionCatalog } from "@arbiter/shared";
import {
  AUTH_TOKEN_EPOCH_STORAGE_KEY,
  AUTH_TOKEN_STORAGE_KEY,
  type AuthMetadataResponse,
  AuthService,
  type OAuthTokenExchangeResponse,
  type OAuthTokenResponse,
} from "./api/auth";
import { ApiClient, ApiError, type ApiServiceOptions } from "./api/client";
import { FragmentService } from "./api/fragments";
import { GitHubService } from "./api/github";
import { ImportService } from "./api/imports";
import {
  type ProjectEventsResponse,
  ProjectService,
  type RevertEventsResponse,
  type SetEventHeadResponse,
} from "./api/projects";
import { SpecService } from "./api/spec";
import {
  type EnvironmentInfo,
  type ProjectStructureResponse,
  type ProjectStructureSettings,
  SystemService,
} from "./api/system";
import { TunnelService, type TunnelSetupResponse } from "./api/tunnels";

export class ApiService {
  static readonly OAUTH_PENDING_STORAGE_KEY = AuthService.OAUTH_PENDING_STORAGE_KEY;
  readonly client: ApiClient;
  readonly auth: AuthService;
  readonly projects: ProjectService;
  readonly fragments: FragmentService;
  readonly spec: SpecService;
  readonly tunnels: TunnelService;
  readonly imports: ImportService;
  readonly github: GitHubService;
  readonly system: SystemService;

  constructor(options: ApiServiceOptions = {}) {
    this.client = new ApiClient(options);
    this.auth = new AuthService(this.client);
    this.projects = new ProjectService(this.client);
    this.fragments = new FragmentService(this.client);
    this.spec = new SpecService(this.client);
    this.tunnels = new TunnelService(this.client);
    this.imports = new ImportService(this.client);
    this.github = new GitHubService(this.client);
    this.system = new SystemService(this.client);
  }

  // Compatibility wrappers
  getProjects(): Promise<Project[]> {
    return this.projects.getProjects();
  }

  getProject(projectId: string): Promise<Project> {
    return this.projects.getProject(projectId);
  }

  getProjectEvents(
    projectId: string,
    options: { limit?: number; includeDangling?: boolean; since?: string } = {},
  ): Promise<ProjectEventsResponse> {
    return this.projects.getProjectEvents(projectId, options);
  }

  setProjectEventHead(
    projectId: string,
    headEventId: string | null,
  ): Promise<SetEventHeadResponse> {
    return this.projects.setProjectEventHead(projectId, headEventId);
  }

  revertProjectEvents(projectId: string, eventIds: string[]): Promise<RevertEventsResponse> {
    return this.projects.revertProjectEvents(projectId, eventIds);
  }

  createProject(name: string, path?: string, presetId?: string): Promise<Project> {
    return this.projects.createProject(name, path, presetId);
  }

  deleteProject(projectId: string): Promise<void> {
    return this.projects.deleteProject(projectId);
  }

  createProjectEntity(
    projectId: string,
    payload: { type: string; values: Record<string, unknown> },
  ) {
    return this.projects.createProjectEntity(projectId, payload);
  }

  updateProjectEntity(
    projectId: string,
    artifactId: string,
    payload: { type: string; values: Record<string, unknown> },
  ) {
    return this.projects.updateProjectEntity(projectId, artifactId, payload);
  }

  deleteProjectEntity(projectId: string, artifactId: string): Promise<void> {
    return this.projects.deleteProjectEntity(projectId, artifactId);
  }

  restoreProjectEntity(
    projectId: string,
    artifactId: string,
    payload: { snapshot: Record<string, unknown>; eventId?: string | null },
  ): Promise<void> {
    return this.projects.restoreProjectEntity(projectId, artifactId, payload);
  }

  getFragments(projectId: string): Promise<Fragment[]> {
    return this.fragments.getFragments(projectId);
  }

  getFragment(projectId: string, fragmentId: string): Promise<Fragment> {
    return this.fragments.getFragment(projectId, fragmentId);
  }

  createFragment(
    projectId: string,
    request: CreateFragmentRequest,
  ): Promise<CreateFragmentResponse> {
    return this.fragments.createFragment(projectId, request);
  }

  updateFragment(projectId: string, fragmentId: string, content: string): Promise<Fragment> {
    return this.fragments.updateFragment(projectId, fragmentId, content);
  }

  deleteFragment(projectId: string, fragmentId: string): Promise<void> {
    return this.fragments.deleteFragment(projectId, fragmentId);
  }

  validateProject(projectId: string, request: ValidationRequest = {}): Promise<ValidationResponse> {
    return this.spec.validateProject(projectId, request);
  }

  getResolvedSpec(projectId: string): Promise<ResolvedSpecResponse> {
    return this.spec.getResolvedSpec(projectId);
  }

  getIR(projectId: string, kind: IRKind): Promise<IRResponse> {
    return this.spec.getIR(projectId, kind);
  }

  getAllIRs(projectId: string): Promise<Record<IRKind, IRResponse>> {
    return this.spec.getAllIRs(projectId);
  }

  freezeVersion(projectId: string, request: FreezeRequest): Promise<FreezeResponse> {
    return this.spec.freezeVersion(projectId, request);
  }

  getEnvironmentInfo(): Promise<EnvironmentInfo> {
    return this.system.getEnvironmentInfo();
  }

  getProjectStructureSettings(): Promise<ProjectStructureResponse> {
    return this.system.getProjectStructureSettings();
  }

  updateProjectStructureSettings(
    settings: Partial<ProjectStructureSettings>,
  ): Promise<ProjectStructureResponse> {
    return this.system.updateProjectStructureSettings(settings);
  }

  getUiOptionCatalog(): Promise<UIOptionCatalog> {
    return this.system.getUiOptionCatalog();
  }

  healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.system.healthCheck();
  }

  getTunnelStatus(): Promise<{
    success: boolean;
    tunnel?: {
      tunnelId: string;
      tunnelName: string;
      hostname: string;
      url: string;
      configPath: string;
      status: "running" | "stopped";
    } | null;
    error?: string;
  }> {
    return this.tunnels.getTunnelStatus();
  }

  setupTunnel(config: {
    zone: string;
    subdomain?: string;
    localPort?: number;
  }): Promise<TunnelSetupResponse> {
    return this.tunnels.setupTunnel(config);
  }

  startTunnel(): Promise<TunnelSetupResponse> {
    return this.tunnels.startTunnel();
  }

  stopTunnel(): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    return this.tunnels.stopTunnel();
  }

  teardownTunnel(): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    return this.tunnels.teardownTunnel();
  }

  getTunnelPreflight(): Promise<{
    success: boolean;
    zones?: string[];
    error?: string;
  }> {
    return this.tunnels.getTunnelPreflight();
  }

  getTunnelLogs(): Promise<{
    success: boolean;
    logs?: string;
    error?: string;
  }> {
    return this.tunnels.getTunnelLogs();
  }

  scanGitUrl(gitUrl: string): Promise<{
    success: boolean;
    tempPath?: string;
    files?: string[];
    projectStructure?: {
      hasPackageJson: boolean;
      hasCargoToml: boolean;
      hasDockerfile: boolean;
      hasCueFiles: boolean;
      hasYamlFiles: boolean;
      hasJsonFiles: boolean;
      importableFiles: string[];
    };
    gitUrl?: string;
    projectName?: string;
    error?: string;
  }> {
    return this.imports.scanGitUrl(gitUrl);
  }

  scanLocalPath(directoryPath: string): Promise<{
    success: boolean;
    path?: string;
    files?: string[];
    projectStructure?: {
      hasPackageJson: boolean;
      hasCargoToml: boolean;
      hasDockerfile: boolean;
      hasCueFiles: boolean;
      hasYamlFiles: boolean;
      hasJsonFiles: boolean;
      importableFiles: string[];
    };
    error?: string;
  }> {
    return this.imports.scanLocalPath(directoryPath);
  }

  cleanupImport(tempId: string): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    return this.imports.cleanupImport(tempId);
  }

  getGitHubUserRepos(): Promise<{
    success: boolean;
    repositories?: Array<{
      id: number;
      name: string;
      full_name: string;
      description: string | null;
      private: boolean;
      clone_url: string;
      ssh_url: string;
      html_url: string;
      language: string | null;
      stargazers_count: number;
      forks_count: number;
      updated_at: string;
      owner: {
        login: string;
        type: "User" | "Organization";
        avatar_url: string;
      };
    }>;
    error?: string;
  }> {
    return this.github.getGitHubUserRepos();
  }

  getGitHubUserOrgs(): Promise<{
    success: boolean;
    organizations?: Array<{
      login: string;
      id: number;
      description: string | null;
      avatar_url: string;
      public_repos: number;
    }>;
    error?: string;
  }> {
    return this.github.getGitHubUserOrgs();
  }

  getGitHubOrgRepos(org: string): Promise<{
    success: boolean;
    repositories?: Array<{
      id: number;
      name: string;
      full_name: string;
      description: string | null;
      private: boolean;
      clone_url: string;
      ssh_url: string;
      html_url: string;
      language: string | null;
      stargazers_count: number;
      forks_count: number;
      updated_at: string;
      owner: {
        login: string;
        type: "User" | "Organization";
        avatar_url: string;
      };
    }>;
    error?: string;
  }> {
    return this.github.getGitHubOrgRepos(org);
  }

  setAuthToken(token: string) {
    this.auth.setAuthToken(token);
  }

  clearAuthToken() {
    this.auth.clearAuthToken();
  }

  exchangeOAuthCode(
    code: string,
    options: { redirectUri?: string; codeVerifier?: string } = {},
  ): Promise<OAuthTokenExchangeResponse> {
    return this.auth.exchangeOAuthCode(code, options);
  }

  startOAuthFlow(): Promise<void> {
    return this.auth.startOAuthFlow();
  }

  loadAuthMetadata(options: { force?: boolean } = {}): Promise<AuthMetadataResponse | null> {
    return this.auth.loadAuthMetadata(options);
  }
}

export const apiService = new ApiService();

export const api = {
  auth: apiService.auth,
  projects: apiService.projects,
  fragments: apiService.fragments,
  spec: apiService.spec,
  tunnels: apiService.tunnels,
  imports: apiService.imports,
  github: apiService.github,
  system: apiService.system,
};

export type { ApiServiceOptions };
export type { AuthMetadataResponse, OAuthTokenExchangeResponse, OAuthTokenResponse };
export type { ProjectEventsResponse, RevertEventsResponse, SetEventHeadResponse };
export type { EnvironmentInfo, ProjectStructureSettings, ProjectStructureResponse };
export type { TunnelSetupResponse };
export type { ProblemDetails };
export { ApiError, AUTH_TOKEN_STORAGE_KEY, AUTH_TOKEN_EPOCH_STORAGE_KEY };
