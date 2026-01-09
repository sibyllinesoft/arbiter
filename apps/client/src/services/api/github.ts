/**
 * @module GitHubService
 * API service for GitHub integration operations.
 * Handles repository listing, imports, and sync operations.
 */
import { ApiClient } from "./client";

/**
 * Service class for GitHub integration.
 * Provides methods for accessing user repositories and importing projects.
 */
export class GitHubService {
  private readonly client: ApiClient;

  constructor(client: ApiClient) {
    this.client = client;
  }

  async getGitHubUserRepos(): Promise<{
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
    return this.client.request("/api/github/user/repos");
  }

  async getGitHubUserOrgs(): Promise<{
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
    return this.client.request("/api/github/user/orgs");
  }

  async getGitHubOrgRepos(org: string): Promise<{
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
    return this.client.request(`/api/github/orgs/${org}/repos`);
  }
}
