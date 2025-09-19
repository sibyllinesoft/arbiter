import { execSync } from 'node:child_process';
import chalk from 'chalk';
import type { GitHubRepo } from '../types.js';

export interface GitRemoteInfo {
  owner: string;
  repo: string;
  url: string;
  type: 'https' | 'ssh';
}

export interface GitDetectionResult {
  detected: boolean;
  remote?: GitRemoteInfo;
  error?: string;
}

export interface RepositoryConflict {
  configRepo: GitHubRepo;
  detectedRepo: GitRemoteInfo;
  conflictType: 'owner' | 'repo' | 'both';
}

export interface ConflictResolution {
  useConfig: boolean;
  useDetected: boolean;
  updateConfig: boolean;
  selectedRepo: GitHubRepo;
}

/**
 * Auto-detect GitHub repository information from Git remote
 */
export function detectGitHubRepository(): GitDetectionResult {
  try {
    // Get the origin remote URL
    const remoteUrl = execSync('git remote get-url origin', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'], // Suppress stderr to avoid noise
    }).trim();

    // Parse GitHub URLs (both HTTPS and SSH formats)
    const remote = parseGitHubUrl(remoteUrl);

    if (!remote) {
      return {
        detected: false,
        error: 'Remote origin is not a GitHub repository',
      };
    }

    return {
      detected: true,
      remote,
    };
  } catch (error) {
    return {
      detected: false,
      error: error instanceof Error ? error.message : 'Failed to detect Git remote',
    };
  }
}

/**
 * Parse a Git URL to extract GitHub repository information
 */
export function parseGitHubUrl(url: string): GitRemoteInfo | null {
  // HTTPS format: https://github.com/owner/repo.git
  const httpsMatch = url.match(/https:\/\/github\.com\/([^/]+)\/([^/.]+)(?:\.git)?$/);
  if (httpsMatch) {
    const [, owner, repo] = httpsMatch;
    return {
      owner,
      repo,
      url,
      type: 'https',
    };
  }

  // SSH format: git@github.com:owner/repo.git
  const sshMatch = url.match(/git@github\.com:([^/]+)\/([^/.]+)(?:\.git)?$/);
  if (sshMatch) {
    const [, owner, repo] = sshMatch;
    return {
      owner,
      repo,
      url,
      type: 'ssh',
    };
  }

  return null;
}

/**
 * Check for conflicts between configured and detected repository info
 */
export function detectRepositoryConflicts(
  configRepo: GitHubRepo,
  detectedRepo: GitRemoteInfo
): RepositoryConflict | null {
  const ownerConflict = configRepo.owner !== detectedRepo.owner;
  const repoConflict = configRepo.repo !== detectedRepo.repo;

  if (!ownerConflict && !repoConflict) {
    return null; // No conflict
  }

  let conflictType: 'owner' | 'repo' | 'both';
  if (ownerConflict && repoConflict) {
    conflictType = 'both';
  } else if (ownerConflict) {
    conflictType = 'owner';
  } else {
    conflictType = 'repo';
  }

  return {
    configRepo,
    detectedRepo,
    conflictType,
  };
}

/**
 * Display a conflict resolution prompt and get user choice
 */
export function displayConflictResolution(conflict: RepositoryConflict): void {
  console.log(chalk.yellow('\n⚠️  Repository Configuration Conflict'));
  console.log(chalk.dim('Found different repository information in config vs Git remote:\n'));

  // Display comparison table
  const configInfo = `${conflict.configRepo.owner}/${conflict.configRepo.repo}`;
  const detectedInfo = `${conflict.detectedRepo.owner}/${conflict.detectedRepo.repo}`;

  console.log('┌─────────────────┬─────────────────────────────┐');
  console.log('│ Source          │ Repository                  │');
  console.log('├─────────────────┼─────────────────────────────┤');
  console.log(`│ Config file     │ ${configInfo.padEnd(27)} │`);
  console.log(`│ Git remote      │ ${detectedInfo.padEnd(27)} │`);
  console.log('└─────────────────┴─────────────────────────────┘');

  console.log(chalk.cyan('\nOptions:'));
  console.log(chalk.dim('  1. Use config file values (keep current configuration)'));
  console.log(chalk.dim('  2. Use Git remote values (auto-detected from repository)'));
  console.log(chalk.dim('  3. Use Git remote and update config file'));

  console.log(chalk.dim('\nFor non-interactive use:'));
  console.log(chalk.dim('  --use-config      Use config file values'));
  console.log(chalk.dim('  --use-git-remote  Use Git remote values'));
}

/**
 * Resolve repository selection based on options
 */
export function resolveRepositorySelection(
  conflict: RepositoryConflict,
  options: {
    useConfig?: boolean;
    useGitRemote?: boolean;
  }
): ConflictResolution {
  if (options.useConfig) {
    return {
      useConfig: true,
      useDetected: false,
      updateConfig: false,
      selectedRepo: conflict.configRepo,
    };
  }

  if (options.useGitRemote) {
    return {
      useConfig: false,
      useDetected: true,
      updateConfig: false,
      selectedRepo: {
        owner: conflict.detectedRepo.owner,
        repo: conflict.detectedRepo.repo,
        baseUrl: conflict.configRepo.baseUrl,
        tokenEnv: conflict.configRepo.tokenEnv,
      },
    };
  }

  // Default to using Git remote without updating config (safest option)
  return {
    useConfig: false,
    useDetected: true,
    updateConfig: false,
    selectedRepo: {
      owner: conflict.detectedRepo.owner,
      repo: conflict.detectedRepo.repo,
      baseUrl: conflict.configRepo.baseUrl,
      tokenEnv: conflict.configRepo.tokenEnv,
    },
  };
}

/**
 * Smart repository configuration that combines config and Git detection
 */
export function getSmartRepositoryConfig(
  configRepo?: GitHubRepo,
  options: {
    useConfig?: boolean;
    useGitRemote?: boolean;
    verbose?: boolean;
  } = {}
): { repo: GitHubRepo; source: 'config' | 'detected' | 'merged' } | null {
  const detection = detectGitHubRepository();

  // If Git detection failed
  if (!detection.detected) {
    if (options.verbose) {
      console.log(chalk.dim('Git detection failed:', detection.error));
    }

    if (configRepo) {
      if (options.verbose) {
        console.log(chalk.dim('Using repository from config file'));
      }
      return { repo: configRepo, source: 'config' };
    }

    return null;
  }

  // If no config repo, use detected
  if (!configRepo) {
    if (options.verbose) {
      console.log(
        chalk.dim(
          `Auto-detected GitHub repository: ${detection.remote?.owner}/${detection.remote?.repo}`
        )
      );
    }
    return {
      repo: {
        owner: detection.remote?.owner,
        repo: detection.remote?.repo,
      },
      source: 'detected',
    };
  }

  // Check for conflicts
  const conflict = detectRepositoryConflicts(configRepo, detection.remote!);

  if (!conflict) {
    // No conflict - config and detected match
    if (options.verbose) {
      console.log(
        chalk.dim(`Repository configuration validated: ${configRepo.owner}/${configRepo.repo}`)
      );
    }
    return { repo: configRepo, source: 'config' };
  }

  // Handle conflict
  if (options.verbose) {
    displayConflictResolution(conflict);
  }

  const resolution = resolveRepositorySelection(conflict, options);

  return {
    repo: resolution.selectedRepo,
    source: resolution.useConfig ? 'config' : 'detected',
  };
}

/**
 * Create repository configuration with intelligent defaults
 */
export function createRepositoryConfig(
  owner: string,
  repo: string,
  baseConfig?: Partial<GitHubRepo>
): GitHubRepo {
  return {
    owner,
    repo,
    baseUrl: baseConfig?.baseUrl,
    tokenEnv: baseConfig?.tokenEnv || 'GITHUB_TOKEN',
  };
}

/**
 * Validate repository configuration and suggest fixes
 */
export function validateRepositoryConfig(repo: GitHubRepo): {
  valid: boolean;
  errors: string[];
  suggestions: string[];
} {
  const errors: string[] = [];
  const suggestions: string[] = [];

  if (!repo.owner) {
    errors.push('Repository owner is required');
  }

  if (!repo.repo) {
    errors.push('Repository name is required');
  }

  if (repo.baseUrl && !repo.baseUrl.startsWith('https://')) {
    errors.push('Base URL must start with https://');
  }

  // Check for common owner/repo format issues
  if (repo.owner?.includes('/')) {
    errors.push('Owner should not contain forward slashes');
    suggestions.push(
      `Did you mean owner: "${repo.owner.split('/')[0]}", repo: "${repo.owner.split('/')[1]}"?`
    );
  }

  if (repo.repo?.includes('/')) {
    errors.push('Repository name should not contain forward slashes');
  }

  if (repo.repo?.endsWith('.git')) {
    suggestions.push(
      `Repository name should not include .git extension: "${repo.repo.replace('.git', '')}"`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    suggestions,
  };
}
