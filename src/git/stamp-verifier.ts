/**
 * Git Stamp Verifier
 * 
 * Implements git hook verification for stamped patches to prevent
 * direct CUE/spec edits without valid Arbiter tickets.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getTicketSystem, type StampedPatch } from '../server/ticket-system.js';
import { logger } from '../utils/logger.js';

const execAsync = promisify(exec);

export interface GitVerificationOptions {
  serverUrl?: string;
  strictMode: boolean;
  allowedFiles: string[]; // Files that can be edited without stamps
  protectedPaths: string[]; // Paths that require stamps
  bypassUsers: string[]; // Users who can bypass verification
}

export interface VerificationResult {
  valid: boolean;
  violations: GitViolation[];
  warnings: string[];
  summary: {
    totalFiles: number;
    protectedFiles: number;
    validStamps: number;
    invalidStamps: number;
    unstampedEdits: number;
  };
}

export interface GitViolation {
  type: 'missing_stamp' | 'invalid_stamp' | 'expired_ticket' | 'unauthorized_edit';
  file: string;
  message: string;
  severity: 'error' | 'warning';
  details?: Record<string, unknown>;
}

export interface CommitInfo {
  hash: string;
  author: string;
  message: string;
  files: string[];
  hasArbiterTrailer: boolean;
  ticketId?: string;
}

/**
 * Git hooks stamp verification system
 */
export class StampVerifier {
  private readonly options: GitVerificationOptions;
  private readonly protectedExtensions: Set<string>;

  constructor(options: Partial<GitVerificationOptions> = {}) {
    this.options = {
      strictMode: true,
      allowedFiles: [
        'README.md',
        'CHANGELOG.md', 
        '.gitignore',
        'package.json', // Version bumps
      ],
      protectedPaths: [
        'spec/',
        '*.cue',
        '*.assembly.cue',
        'arbiter.assembly.cue',
      ],
      bypassUsers: [], // Empty by default - no bypass allowed
      ...options,
    };

    // Files that require stamps
    this.protectedExtensions = new Set([
      '.cue',
      '.assembly.cue', 
    ]);
  }

  /**
   * Pre-commit hook: Verify working directory changes
   */
  async verifyPreCommit(repoPath: string = '.'): Promise<VerificationResult> {
    logger.info('Running pre-commit stamp verification');

    try {
      // Get staged files
      const stagedFiles = await this.getStagedFiles(repoPath);
      
      if (stagedFiles.length === 0) {
        return this.createSuccessResult();
      }

      // Get current repo state
      const repoSHA = await this.getCurrentCommitSHA(repoPath);
      
      // Verify each staged file
      const violations: GitViolation[] = [];
      const warnings: string[] = [];
      let validStamps = 0;
      let invalidStamps = 0;
      let unstampedEdits = 0;

      for (const file of stagedFiles) {
        const verification = await this.verifyFile(file, repoPath, repoSHA);
        
        if (verification.requiresStamp) {
          if (verification.hasValidStamp) {
            validStamps++;
          } else if (verification.hasInvalidStamp) {
            invalidStamps++;
            violations.push({
              type: 'invalid_stamp',
              file,
              message: verification.error || 'Invalid or expired stamp',
              severity: 'error',
              details: verification.details,
            });
          } else {
            unstampedEdits++;
            violations.push({
              type: 'missing_stamp',
              file,
              message: 'Protected file modified without valid Arbiter stamp',
              severity: 'error',
            });
          }
        }
      }

      const result: VerificationResult = {
        valid: violations.filter(v => v.severity === 'error').length === 0,
        violations,
        warnings,
        summary: {
          totalFiles: stagedFiles.length,
          protectedFiles: validStamps + invalidStamps + unstampedEdits,
          validStamps,
          invalidStamps,
          unstampedEdits,
        },
      };

      if (!result.valid) {
        logger.error(`Pre-commit verification failed: ${violations.length} violations`);
      } else {
        logger.info('Pre-commit verification passed');
      }

      return result;

    } catch (error) {
      logger.error('Pre-commit verification error:', error);
      throw new Error(`Verification failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Pre-receive hook: Verify pushed commits
   */
  async verifyPreReceive(
    oldRev: string,
    newRev: string,
    refName: string,
    repoPath: string = '.'
  ): Promise<VerificationResult> {
    logger.info(`Running pre-receive verification for ${refName}: ${oldRev}..${newRev}`);

    try {
      // Get commits being pushed
      const commits = await this.getCommitRange(oldRev, newRev, repoPath);
      
      const violations: GitViolation[] = [];
      const warnings: string[] = [];
      let validStamps = 0;
      let invalidStamps = 0;
      let unstampedEdits = 0;

      for (const commit of commits) {
        // Check for required Arbiter trailer
        if (!commit.hasArbiterTrailer) {
          const hasProtectedFiles = await this.commitHasProtectedFiles(commit.hash, repoPath);
          
          if (hasProtectedFiles) {
            violations.push({
              type: 'unauthorized_edit',
              file: `commit:${commit.hash}`,
              message: 'Commit modifies protected files but lacks Arbiter-Ticket trailer',
              severity: 'error',
              details: { commit: commit.hash, author: commit.author },
            });
          }
        }

        // Verify stamps in each file for this commit
        const commitFiles = await this.getCommitFiles(commit.hash, repoPath);
        
        for (const file of commitFiles) {
          const verification = await this.verifyFile(file, repoPath, commit.hash);
          
          if (verification.requiresStamp) {
            if (verification.hasValidStamp) {
              validStamps++;
            } else if (verification.hasInvalidStamp) {
              invalidStamps++;
              violations.push({
                type: 'invalid_stamp',
                file,
                message: verification.error || 'Invalid stamp in pushed commit',
                severity: 'error',
                details: { ...verification.details, commit: commit.hash },
              });
            } else {
              unstampedEdits++;
              violations.push({
                type: 'missing_stamp',
                file,
                message: 'Protected file in pushed commit lacks valid stamp',
                severity: 'error',
                details: { commit: commit.hash },
              });
            }
          }
        }
      }

      const result: VerificationResult = {
        valid: violations.filter(v => v.severity === 'error').length === 0,
        violations,
        warnings,
        summary: {
          totalFiles: commits.reduce((sum, c) => sum + c.files.length, 0),
          protectedFiles: validStamps + invalidStamps + unstampedEdits,
          validStamps,
          invalidStamps,
          unstampedEdits,
        },
      };

      if (!result.valid) {
        logger.error(`Pre-receive verification failed: ${violations.length} violations`);
      } else {
        logger.info('Pre-receive verification passed');
      }

      return result;

    } catch (error) {
      logger.error('Pre-receive verification error:', error);
      throw new Error(`Verification failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Verify a single file's stamps
   */
  private async verifyFile(
    filePath: string, 
    repoPath: string, 
    commitSHA: string
  ): Promise<{
    requiresStamp: boolean;
    hasValidStamp: boolean;
    hasInvalidStamp: boolean;
    error?: string;
    details?: Record<string, unknown>;
  }> {
    try {
      // Check if this file requires a stamp
      const requiresStamp = this.fileRequiresStamp(filePath);
      
      if (!requiresStamp) {
        return {
          requiresStamp: false,
          hasValidStamp: false,
          hasInvalidStamp: false,
        };
      }

      // Read file content
      const fullPath = path.join(repoPath, filePath);
      
      let content: string;
      try {
        content = await fs.readFile(fullPath, 'utf-8');
      } catch (error) {
        // File might be deleted
        return {
          requiresStamp: true,
          hasValidStamp: true, // Deletions are OK if the whole file is gone
          hasInvalidStamp: false,
        };
      }

      // Parse stamped blocks
      const ticketSystem = getTicketSystem();
      const patches = ticketSystem.parseStampedBlock(content);

      if (patches.length === 0) {
        return {
          requiresStamp: true,
          hasValidStamp: false,
          hasInvalidStamp: false,
          error: 'No stamped blocks found in protected file',
        };
      }

      // Verify each patch
      for (const patch of patches) {
        // For git hooks, we need to determine the planHash
        // In a real implementation, this would be extracted from commit metadata
        const planHash = await this.derivePlanHashForCommit(commitSHA, repoPath);
        
        const verification = await ticketSystem.verifyStampedPatch(
          patch,
          commitSHA,
          planHash
        );

        if (!verification.valid) {
          return {
            requiresStamp: true,
            hasValidStamp: false,
            hasInvalidStamp: true,
            error: verification.reason,
            details: {
              patchId: patch.id,
              ticketId: patch.ticketId,
            },
          };
        }
      }

      return {
        requiresStamp: true,
        hasValidStamp: true,
        hasInvalidStamp: false,
      };

    } catch (error) {
      logger.error(`File verification error for ${filePath}:`, error);
      return {
        requiresStamp: true,
        hasValidStamp: false,
        hasInvalidStamp: true,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if a file requires stamping
   */
  private fileRequiresStamp(filePath: string): boolean {
    // Check allowed files (can be edited without stamps)
    if (this.options.allowedFiles.some(allowed => filePath.endsWith(allowed))) {
      return false;
    }

    // Check protected paths
    const isProtectedPath = this.options.protectedPaths.some(pattern => {
      if (pattern.includes('*')) {
        // Simple glob matching
        const regex = pattern.replace(/\*/g, '.*');
        return new RegExp(regex).test(filePath);
      }
      return filePath.startsWith(pattern);
    });

    if (isProtectedPath) {
      return true;
    }

    // Check protected extensions
    const ext = path.extname(filePath);
    if (this.protectedExtensions.has(ext)) {
      return true;
    }

    // Check for assembly files
    if (filePath.includes('.assembly.')) {
      return true;
    }

    return false;
  }

  // Git utility methods

  private async getStagedFiles(repoPath: string): Promise<string[]> {
    try {
      const { stdout } = await execAsync('git diff --cached --name-only', { cwd: repoPath });
      return stdout.trim().split('\n').filter(line => line.length > 0);
    } catch (error) {
      logger.error('Failed to get staged files:', error);
      return [];
    }
  }

  private async getCurrentCommitSHA(repoPath: string): Promise<string> {
    try {
      const { stdout } = await execAsync('git rev-parse HEAD', { cwd: repoPath });
      return stdout.trim();
    } catch (error) {
      logger.error('Failed to get current commit SHA:', error);
      return 'unknown';
    }
  }

  private async getCommitRange(
    oldRev: string, 
    newRev: string, 
    repoPath: string
  ): Promise<CommitInfo[]> {
    try {
      const { stdout } = await execAsync(
        `git log --pretty=format:"%H|%an|%s" ${oldRev}..${newRev}`, 
        { cwd: repoPath }
      );

      const commits: CommitInfo[] = [];
      
      for (const line of stdout.trim().split('\n')) {
        if (!line) continue;
        
        const [hash, author, message] = line.split('|');
        const files = await this.getCommitFiles(hash, repoPath);
        
        // Check for Arbiter trailer
        const fullMessage = await this.getCommitMessage(hash, repoPath);
        const hasArbiterTrailer = /\nArbiter-Ticket:\s*\w+/.test(fullMessage);
        const ticketMatch = fullMessage.match(/\nArbiter-Ticket:\s*(\w+)/);

        commits.push({
          hash,
          author,
          message,
          files,
          hasArbiterTrailer,
          ticketId: ticketMatch?.[1],
        });
      }

      return commits;

    } catch (error) {
      logger.error('Failed to get commit range:', error);
      return [];
    }
  }

  private async getCommitFiles(commitHash: string, repoPath: string): Promise<string[]> {
    try {
      const { stdout } = await execAsync(
        `git diff-tree --no-commit-id --name-only -r ${commitHash}`, 
        { cwd: repoPath }
      );
      return stdout.trim().split('\n').filter(line => line.length > 0);
    } catch (error) {
      logger.error(`Failed to get files for commit ${commitHash}:`, error);
      return [];
    }
  }

  private async getCommitMessage(commitHash: string, repoPath: string): Promise<string> {
    try {
      const { stdout } = await execAsync(
        `git log -1 --pretty=format:"%B" ${commitHash}`, 
        { cwd: repoPath }
      );
      return stdout;
    } catch (error) {
      logger.error(`Failed to get commit message for ${commitHash}:`, error);
      return '';
    }
  }

  private async commitHasProtectedFiles(commitHash: string, repoPath: string): Promise<boolean> {
    const files = await this.getCommitFiles(commitHash, repoPath);
    return files.some(file => this.fileRequiresStamp(file));
  }

  private async derivePlanHashForCommit(commitSHA: string, repoPath: string): Promise<string> {
    // In a real implementation, this would:
    // 1. Look for plan metadata in commit or branch
    // 2. Hash the current assembly/spec state
    // 3. Use a default plan hash if none found
    
    // For now, return a placeholder
    return 'default-plan-hash'.padEnd(64, '0');
  }

  private createSuccessResult(): VerificationResult {
    return {
      valid: true,
      violations: [],
      warnings: [],
      summary: {
        totalFiles: 0,
        protectedFiles: 0,
        validStamps: 0,
        invalidStamps: 0,
        unstampedEdits: 0,
      },
    };
  }
}

/**
 * Install git hooks for stamp verification
 */
export async function installGitHooks(
  repoPath: string = '.',
  options: Partial<GitVerificationOptions> = {}
): Promise<void> {
  try {
    const hooksDir = path.join(repoPath, '.git', 'hooks');
    
    // Ensure hooks directory exists
    await fs.mkdir(hooksDir, { recursive: true });

    // Pre-commit hook
    const preCommitHook = `#!/bin/sh
# Arbiter stamp verification pre-commit hook
node -e "
const { StampVerifier } = require('./node_modules/@arbiter/cli/dist/git/stamp-verifier.js');
const verifier = new StampVerifier(${JSON.stringify(options)});

verifier.verifyPreCommit('.')
  .then(result => {
    if (!result.valid) {
      console.error('❌ Commit blocked by Arbiter verification:');
      result.violations.forEach(v => {
        console.error(\`  \${v.file}: \${v.message}\`);
      });
      console.error('\\nAll CUE/spec edits must be stamped. Use: arbiter edit --file <path>');
      process.exit(1);
    }
    console.log('✅ Arbiter verification passed');
  })
  .catch(error => {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  });
"
`;

    // Pre-receive hook (for server-side)
    const preReceiveHook = `#!/bin/sh
# Arbiter stamp verification pre-receive hook
while read oldrev newrev refname; do
  node -e "
  const { StampVerifier } = require('./arbiter-stamp-verifier.js');
  const verifier = new StampVerifier(${JSON.stringify({ ...options, strictMode: true })});
  
  verifier.verifyPreReceive('$oldrev', '$newrev', '$refname', '.')
    .then(result => {
      if (!result.valid) {
        console.error('❌ Push blocked by Arbiter verification:');
        result.violations.forEach(v => {
          console.error(\`  \${v.file}: \${v.message}\`);
        });
        process.exit(1);
      }
      console.log('✅ Server-side verification passed');
    })
    .catch(error => {
      console.error('❌ Server verification failed:', error.message);
      process.exit(1);
    });
  "
done
`;

    // Write hooks
    const preCommitPath = path.join(hooksDir, 'pre-commit');
    const preReceivePath = path.join(hooksDir, 'pre-receive');

    await fs.writeFile(preCommitPath, preCommitHook, { mode: 0o755 });
    await fs.writeFile(preReceivePath, preReceiveHook, { mode: 0o755 });

    logger.info('Installed Arbiter git hooks');
    logger.info(`Pre-commit: ${preCommitPath}`);
    logger.info(`Pre-receive: ${preReceivePath}`);

  } catch (error) {
    logger.error('Failed to install git hooks:', error);
    throw new Error(`Git hook installation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export { StampVerifier };