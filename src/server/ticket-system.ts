/**
 * Ticketed Mutation System with HMAC Stamps
 * 
 * Implements the Rails & Guarantees security model where all mutations
 * must go through server-issued tickets to prevent direct CUE/spec edits.
 */

import * as crypto from 'crypto';
import { logger } from '../utils/logger.js';

export interface MutationTicket {
  ticketId: string;
  expiresAt: string; // ISO datetime
  planHash: string; // SHA256 of the plan being modified
  repoSHA?: string; // Current repo state
  scopes: string[]; // Which operations this ticket allows
  issuedAt: string;
}

export interface StampedPatch {
  id: string;
  stamp: string; // Base64-encoded HMAC
  content: string;
  ticketId: string;
  operation: string; // 'create' | 'update' | 'delete'
  filePath: string;
}

export interface TicketVerificationResult {
  valid: boolean;
  reason?: string;
  ticket?: MutationTicket;
  timestamp: string;
}

export interface StampVerificationResult {
  valid: boolean;
  reason?: string;
  computedStamp?: string;
  timestamp: string;
}

/**
 * Server-side ticket issuance and verification system
 */
export class TicketSystem {
  private readonly serverKey: string;
  private readonly ticketTTL: number; // milliseconds
  private readonly activeTickets: Map<string, MutationTicket>;

  constructor(serverKey?: string, ttlMinutes: number = 30) {
    this.serverKey = serverKey || this.generateServerKey();
    this.ticketTTL = ttlMinutes * 60 * 1000;
    this.activeTickets = new Map();
  }

  /**
   * Issue a new mutation ticket for a specific plan
   */
  async issueTicket(
    planHash: string,
    repoSHA: string,
    scopes: string[] = ['write', 'execute'],
    requestMetadata?: Record<string, unknown>
  ): Promise<MutationTicket> {
    try {
      const ticketId = this.generateTicketId();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.ticketTTL);

      const ticket: MutationTicket = {
        ticketId,
        expiresAt: expiresAt.toISOString(),
        planHash,
        repoSHA,
        scopes,
        issuedAt: now.toISOString(),
      };

      // Store ticket for server-side validation
      this.activeTickets.set(ticketId, ticket);

      // Schedule cleanup
      setTimeout(() => {
        this.activeTickets.delete(ticketId);
      }, this.ticketTTL);

      logger.info(`Issued ticket ${ticketId} for plan ${planHash.substring(0, 8)}...`);
      logger.debug('Ticket details:', { ticket, requestMetadata });

      return ticket;

    } catch (error) {
      logger.error('Failed to issue ticket:', error);
      throw new Error(`Ticket issuance failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Verify a mutation ticket is valid
   */
  async verifyTicket(ticketId: string, planHash: string): Promise<TicketVerificationResult> {
    const timestamp = new Date().toISOString();

    try {
      // Check if ticket exists
      const ticket = this.activeTickets.get(ticketId);
      if (!ticket) {
        return {
          valid: false,
          reason: 'Ticket not found or expired',
          timestamp,
        };
      }

      // Check expiration
      const now = Date.now();
      const expiresAt = new Date(ticket.expiresAt).getTime();
      if (now > expiresAt) {
        this.activeTickets.delete(ticketId);
        return {
          valid: false,
          reason: 'Ticket expired',
          timestamp,
        };
      }

      // Check plan hash matches
      if (ticket.planHash !== planHash) {
        return {
          valid: false,
          reason: 'Plan hash mismatch',
          timestamp,
        };
      }

      logger.debug(`Ticket ${ticketId} verified successfully`);
      return {
        valid: true,
        ticket,
        timestamp,
      };

    } catch (error) {
      logger.error('Ticket verification error:', error);
      return {
        valid: false,
        reason: `Verification error: ${error instanceof Error ? error.message : String(error)}`,
        timestamp,
      };
    }
  }

  /**
   * Generate HMAC stamp for a patch
   */
  createStamp(ticketId: string, repoSHA: string, planHash: string, content: string): string {
    try {
      const message = `${repoSHA}:${planHash}:${ticketId}:${content}`;
      const hmac = crypto.createHmac('sha256', this.serverKey);
      hmac.update(message);
      const stamp = hmac.digest('base64');

      logger.debug(`Created stamp for ticket ${ticketId}`);
      return stamp;

    } catch (error) {
      logger.error('Stamp creation error:', error);
      throw new Error(`Failed to create stamp: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Verify HMAC stamp for a patch
   */
  verifyStamp(
    stamp: string,
    ticketId: string,
    repoSHA: string,
    planHash: string,
    content: string
  ): StampVerificationResult {
    const timestamp = new Date().toISOString();

    try {
      const computedStamp = this.createStamp(ticketId, repoSHA, planHash, content);

      // Constant-time comparison to prevent timing attacks
      const isValid = crypto.timingSafeEqual(
        Buffer.from(stamp, 'base64'),
        Buffer.from(computedStamp, 'base64')
      );

      if (isValid) {
        logger.debug(`Stamp verification successful for ticket ${ticketId}`);
        return {
          valid: true,
          computedStamp,
          timestamp,
        };
      } else {
        logger.warn(`Stamp verification failed for ticket ${ticketId}`);
        return {
          valid: false,
          reason: 'HMAC signature mismatch',
          computedStamp,
          timestamp,
        };
      }

    } catch (error) {
      logger.error('Stamp verification error:', error);
      return {
        valid: false,
        reason: `Verification error: ${error instanceof Error ? error.message : String(error)}`,
        timestamp,
      };
    }
  }

  /**
   * Create a complete stamped patch
   */
  async createStampedPatch(
    ticketId: string,
    operation: string,
    filePath: string,
    content: string,
    repoSHA: string,
    planHash: string
  ): Promise<StampedPatch> {
    try {
      // Verify ticket is still valid
      const ticketVerification = await this.verifyTicket(ticketId, planHash);
      if (!ticketVerification.valid) {
        throw new Error(`Invalid ticket: ${ticketVerification.reason}`);
      }

      // Create HMAC stamp
      const stamp = this.createStamp(ticketId, repoSHA, planHash, content);

      const patch: StampedPatch = {
        id: this.generatePatchId(),
        stamp,
        content,
        ticketId,
        operation,
        filePath,
      };

      logger.info(`Created stamped patch ${patch.id} for ${filePath}`);
      return patch;

    } catch (error) {
      logger.error('Stamped patch creation error:', error);
      throw new Error(`Failed to create stamped patch: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Verify a complete stamped patch
   */
  async verifyStampedPatch(
    patch: StampedPatch,
    repoSHA: string,
    planHash: string
  ): Promise<StampVerificationResult> {
    try {
      // First verify the ticket
      const ticketVerification = await this.verifyTicket(patch.ticketId, planHash);
      if (!ticketVerification.valid) {
        return {
          valid: false,
          reason: `Invalid ticket: ${ticketVerification.reason}`,
          timestamp: new Date().toISOString(),
        };
      }

      // Then verify the stamp
      const stampVerification = this.verifyStamp(
        patch.stamp,
        patch.ticketId,
        repoSHA,
        planHash,
        patch.content
      );

      if (!stampVerification.valid) {
        return {
          valid: false,
          reason: `Invalid stamp: ${stampVerification.reason}`,
          timestamp: stampVerification.timestamp,
        };
      }

      logger.info(`Verified stamped patch ${patch.id} successfully`);
      return {
        valid: true,
        timestamp: stampVerification.timestamp,
      };

    } catch (error) {
      logger.error('Stamped patch verification error:', error);
      return {
        valid: false,
        reason: `Verification error: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Generate formatted stamped block for insertion into files
   */
  formatStampedBlock(patch: StampedPatch): string {
    return `// ARBITER:BEGIN ${patch.id} stamp=${patch.stamp}
${patch.content}
// ARBITER:END ${patch.id}`;
  }

  /**
   * Parse stamped block from file content
   */
  parseStampedBlock(content: string): StampedPatch[] {
    const patches: StampedPatch[] = [];
    const blockRegex = /\/\/ ARBITER:BEGIN (\S+) stamp=(\S+)\n([\s\S]*?)\n\/\/ ARBITER:END \1/g;

    let match;
    while ((match = blockRegex.exec(content)) !== null) {
      const [, id, stamp, blockContent] = match;
      
      patches.push({
        id,
        stamp,
        content: blockContent,
        ticketId: 'unknown', // Would need to be looked up
        operation: 'unknown',
        filePath: 'unknown',
      });
    }

    return patches;
  }

  /**
   * Get ticket statistics
   */
  getTicketStats(): {
    activeTickets: number;
    totalIssued: number;
    oldestTicket?: string;
    newestTicket?: string;
  } {
    const tickets = Array.from(this.activeTickets.values());
    
    let oldestTicket: string | undefined;
    let newestTicket: string | undefined;
    
    if (tickets.length > 0) {
      tickets.sort((a, b) => new Date(a.issuedAt).getTime() - new Date(b.issuedAt).getTime());
      oldestTicket = tickets[0].issuedAt;
      newestTicket = tickets[tickets.length - 1].issuedAt;
    }

    return {
      activeTickets: this.activeTickets.size,
      totalIssued: this.activeTickets.size, // In a real system, this would be persisted
      oldestTicket,
      newestTicket,
    };
  }

  /**
   * Revoke a ticket (emergency use)
   */
  revokeTicket(ticketId: string, reason: string): boolean {
    const existed = this.activeTickets.has(ticketId);
    this.activeTickets.delete(ticketId);
    
    if (existed) {
      logger.warn(`Revoked ticket ${ticketId}: ${reason}`);
    }
    
    return existed;
  }

  /**
   * Clean up expired tickets
   */
  cleanupExpiredTickets(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [ticketId, ticket] of this.activeTickets.entries()) {
      const expiresAt = new Date(ticket.expiresAt).getTime();
      if (now > expiresAt) {
        this.activeTickets.delete(ticketId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} expired tickets`);
    }

    return cleaned;
  }

  // Private helper methods

  private generateServerKey(): string {
    const key = crypto.randomBytes(32).toString('hex');
    logger.warn('Generated new server key - this should be persisted in production');
    return key;
  }

  private generateTicketId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private generatePatchId(): string {
    return crypto.randomBytes(8).toString('hex');
  }
}

/**
 * Singleton instance for the application
 */
let globalTicketSystem: TicketSystem | null = null;

export function getTicketSystem(): TicketSystem {
  if (!globalTicketSystem) {
    globalTicketSystem = new TicketSystem();
  }
  return globalTicketSystem;
}

export function initializeTicketSystem(serverKey: string, ttlMinutes?: number): TicketSystem {
  globalTicketSystem = new TicketSystem(serverKey, ttlMinutes);
  return globalTicketSystem;
}

export { TicketSystem };