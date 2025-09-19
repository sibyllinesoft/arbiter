/**
 * Database entity types for Arbiter Spec Workbench
 *
 * These types mirror the Drizzle schema definitions to provide
 * a consistent interface for database entities across the application.
 */

// Core database entity types
export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface NewProject {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Fragment {
  id: string;
  projectId: string;
  path: string;
  content: string;
  headRevisionId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewFragment {
  id: string;
  projectId: string;
  path: string;
  content: string;
  headRevisionId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface FragmentRevision {
  id: string;
  fragmentId: string;
  revisionNumber: number;
  content: string;
  contentHash: string;
  author?: string | null;
  message?: string | null;
  createdAt: string;
}

export interface NewFragmentRevision {
  id: string;
  fragmentId: string;
  revisionNumber: number;
  content: string;
  contentHash: string;
  author?: string | null;
  message?: string | null;
  createdAt?: string;
}

export interface Version {
  id: string;
  projectId: string;
  specHash: string;
  resolvedJson: string;
  createdAt: string;
}

export interface NewVersion {
  id: string;
  projectId: string;
  specHash: string;
  resolvedJson: string;
  createdAt?: string;
}

export interface Event {
  id: string;
  projectId: string;
  eventType: string;
  data: string; // JSON stored as string
  createdAt: string;
}

export interface NewEvent {
  id: string;
  projectId: string;
  eventType: string;
  data: string; // JSON stored as string
  createdAt?: string;
}

// Authentication and user management types
export interface User {
  id: string;
  email?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
  provider?: string | null;
  providerId?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NewUser {
  id: string;
  email?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
  provider?: string | null;
  providerId?: string | null;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthToken {
  id: string;
  userId: string;
  tokenHash: string;
  scopes: string; // JSON array stored as string
  expiresAt: string;
  lastUsedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewAuthToken {
  id: string;
  userId: string;
  tokenHash: string;
  scopes: string; // JSON array stored as string
  expiresAt: string;
  lastUsedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// OAuth types
export interface OAuthClient {
  id: string;
  clientId: string;
  clientSecret?: string | null;
  name: string;
  redirectUris: string; // JSON array stored as string
  scopes: string; // JSON array stored as string
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NewOAuthClient {
  id: string;
  clientId: string;
  clientSecret?: string | null;
  name: string;
  redirectUris: string; // JSON array stored as string
  scopes: string; // JSON array stored as string
  isPublic?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface OAuthAuthCode {
  id: string;
  code: string;
  clientId: string;
  userId: string;
  redirectUri: string;
  scopes: string; // JSON array stored as string
  codeChallenge?: string | null;
  codeChallengeMethod?: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface NewOAuthAuthCode {
  id: string;
  code: string;
  clientId: string;
  userId: string;
  redirectUri: string;
  scopes: string; // JSON array stored as string
  codeChallenge?: string | null;
  codeChallengeMethod?: string | null;
  expiresAt: string;
  createdAt?: string;
}

// Project membership types
export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export interface NewProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Helper types for roles and permissions
export type ProjectRole = "owner" | "admin" | "member" | "readonly";

export type OAuthScope =
  | "read"
  | "write"
  | "admin"
  | "projects:read"
  | "projects:write"
  | "fragments:read"
  | "fragments:write"
  | "tools:read"
  | "tools:write";
