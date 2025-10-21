/**
 * Shared GitHub type definitions used across the client.
 */

export interface GitHubOwner {
  login: string;
  type: "User" | "Organization";
  avatar_url: string;
}

export interface GitHubRepository {
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
  owner: GitHubOwner;
}

export interface GitHubOrganization {
  login: string;
  id: number;
  description: string | null;
  avatar_url: string;
  public_repos: number;
}

export type GitHubReposByOwner = Record<string, GitHubRepository[]>;
