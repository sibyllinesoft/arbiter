/**
 * Ticket System Implementation - Hard Rails for Mutation Control
 * Based on arbiter.assembly.cue specification and TODO.md Section 1
 */

import { randomUUID } from 'crypto';
import { createHmac } from 'crypto';
import { Database } from 'bun:sqlite';

// Configuration from specification
const TICKET_CONFIG = {
  hmacKeyLength: 64,  // 512 bits
  defaultExpiration: '1h',
  maxExpiration: '24h',
  minExpiration: '5m',
  cleanupInterval: 3600000, // 1 hour in ms
};

// Load HMAC key from environment (required for production)
const HMAC_KEY = process.env.ARBITER_HMAC_KEY || 'dev-key-change-in-production-' + '0'.repeat(32);

if (HMAC_KEY.length < 32) {
  throw new Error('ARBITER_HMAC_KEY must be at least 32 characters');
}

// Ticket interface matching specification
export interface Ticket {
  id: string;
  planHash: string;
  expiresAt: Date;
  createdAt: Date;
  used: boolean;
}

// Stamp interface for HMAC verification
export interface Stamp {
  id: string;
  ticketId: string;
  repoSHA: string;
  planHash: string;
  filePath: string;
  stamp: string; // Base64 encoded HMAC
  createdAt: Date;
}

// Request/Response types
export interface TicketRequest {
  scope: string; // Plan hash (64 hex chars)
  expires?: string; // Duration like "1h", "30m", "24h"
}

export interface TicketResponse {
  ticketId: string;
  expiresAt: Date;
  planHash: string;
}

export interface VerifyStampRequest {
  stamp: string;      // Base64 encoded HMAC
  repoSHA: string;    // Git commit hash (40 hex chars)
  planHash: string;   // Plan hash (64 hex chars)
  ticketId: string;   // Ticket ID
  fileContent?: string; // Optional: content being verified
}

export interface VerifyStampResponse {
  valid: boolean;
  message: string;
  violationId?: string;
}

export class TicketSystem {
  private db: Database;
  private cleanupTimer?: Timer;

  constructor(db: Database) {
    this.db = db;
    this.initializeTables();
    this.startCleanupTimer();
  }

  /**
   * Initialize database tables for tickets and stamps
   */
  private initializeTables(): void {
    // Tickets table (active tickets only)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS active_tickets (
        id TEXT PRIMARY KEY,
        plan_hash TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        used BOOLEAN DEFAULT FALSE
      );
      
      CREATE INDEX IF NOT EXISTS idx_tickets_plan_hash ON active_tickets(plan_hash);
      CREATE INDEX IF NOT EXISTS idx_tickets_expires ON active_tickets(expires_at);
    `);

    // Stamp history (permanent record)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS stamp_history (
        id TEXT PRIMARY KEY,
        ticket_id TEXT NOT NULL,
        repo_sha TEXT NOT NULL,
        plan_hash TEXT NOT NULL,
        file_path TEXT NOT NULL,
        stamp TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_stamps_ticket ON stamp_history(ticket_id);
      CREATE INDEX IF NOT EXISTS idx_stamps_repo_sha ON stamp_history(repo_sha);
    `);
  }

  /**
   * Start periodic cleanup of expired tickets
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredTickets();
    }, TICKET_CONFIG.cleanupInterval);
  }

  /**
   * Issue a new mutation ticket
   */
  async issueTicket(request: TicketRequest): Promise<TicketResponse> {
    // Validate plan hash format
    if (!request.scope || !/^[a-f0-9]{64}$/.test(request.scope)) {
      throw new Error('Invalid plan hash format. Must be 64 hex characters.');
    }

    // Parse expiration duration
    const expirationMs = this.parseDuration(request.expires || TICKET_CONFIG.defaultExpiration);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expirationMs);

    // Validate expiration bounds
    const maxExpiration = this.parseDuration(TICKET_CONFIG.maxExpiration);
    const minExpiration = this.parseDuration(TICKET_CONFIG.minExpiration);
    
    if (expirationMs > maxExpiration) {
      throw new Error(`Expiration too long. Maximum: ${TICKET_CONFIG.maxExpiration}`);
    }
    if (expirationMs < minExpiration) {
      throw new Error(`Expiration too short. Minimum: ${TICKET_CONFIG.minExpiration}`);
    }

    // Generate ticket
    const ticketId = 'tkn_' + randomUUID().replace(/-/g, '').substring(0, 16);
    
    // Store ticket in database
    const stmt = this.db.prepare(`
      INSERT INTO active_tickets (id, plan_hash, expires_at, created_at)
      VALUES (?, ?, ?, ?)
    `);
    
    stmt.run(ticketId, request.scope, expiresAt.toISOString(), now.toISOString());

    return {
      ticketId,
      expiresAt,
      planHash: request.scope
    };
  }

  /**
   * Generate HMAC stamp for content
   */
  generateStamp(
    repoSHA: string, 
    planHash: string, 
    ticketId: string, 
    fileContent: string
  ): string {
    // Input validation
    if (!/^[a-f0-9]{40}$/.test(repoSHA)) {
      throw new Error('Invalid repoSHA format. Must be 40 hex characters.');
    }
    if (!/^[a-f0-9]{64}$/.test(planHash)) {
      throw new Error('Invalid planHash format. Must be 64 hex characters.');
    }
    if (!/^tkn_[a-zA-Z0-9]{16}$/.test(ticketId)) {
      throw new Error('Invalid ticketId format.');
    }

    // Create HMAC input as specified in the profile
    const hmacInput = JSON.stringify({
      repoSHA,
      planHash,
      ticketId,
      fileContent
    });

    // Generate HMAC-SHA256 signature
    const hmac = createHmac('sha256', HMAC_KEY);
    hmac.update(hmacInput);
    
    return hmac.digest('base64');
  }

  /**
   * Verify HMAC stamp
   */
  async verifyStamp(request: VerifyStampRequest): Promise<VerifyStampResponse> {
    try {
      // Check if ticket exists and is valid
      const ticketStmt = this.db.prepare(`
        SELECT * FROM active_tickets 
        WHERE id = ? AND plan_hash = ? AND expires_at > CURRENT_TIMESTAMP
      `);
      const ticket = ticketStmt.get(request.ticketId, request.planHash) as Ticket | undefined;

      if (!ticket) {
        return {
          valid: false,
          message: 'Invalid or expired ticket',
          violationId: `violation_${Date.now()}_invalid_ticket`
        };
      }

      // Generate expected stamp
      const expectedStamp = this.generateStamp(
        request.repoSHA,
        request.planHash,
        request.ticketId,
        request.fileContent || ''
      );

      // Compare stamps (timing-safe comparison)
      const valid = this.constantTimeEquals(request.stamp, expectedStamp);

      if (valid) {
        // Record successful verification in stamp history
        const stampId = randomUUID().replace(/-/g, '').substring(0, 8);
        const historyStmt = this.db.prepare(`
          INSERT INTO stamp_history (id, ticket_id, repo_sha, plan_hash, file_path, stamp, created_at)
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);
        historyStmt.run(
          stampId,
          request.ticketId,
          request.repoSHA,
          request.planHash,
          'unknown', // file_path would be provided in real implementation
          request.stamp
        );

        return {
          valid: true,
          message: 'Stamp verified successfully'
        };
      } else {
        return {
          valid: false,
          message: 'Invalid HMAC stamp',
          violationId: `violation_${Date.now()}_invalid_hmac`
        };
      }

    } catch (error) {
      return {
        valid: false,
        message: error instanceof Error ? error.message : 'Verification failed',
        violationId: `violation_${Date.now()}_verification_error`
      };
    }
  }

  /**
   * Apply stamped mutations (mock implementation)
   */
  async applyMutations(
    ticketId: string,
    mutations: Array<{
      file: string;
      operation: 'create' | 'update' | 'delete';
      content?: string;
    }>
  ): Promise<{
    success: boolean;
    stamps: Array<{
      file: string;
      stamp: string;
      stampId: string;
    }>;
    errors?: string[];
  }> {
    const stamps: Array<{ file: string; stamp: string; stampId: string; }> = [];
    const errors: string[] = [];

    try {
      // Verify ticket is still valid
      const ticketStmt = this.db.prepare(`
        SELECT * FROM active_tickets 
        WHERE id = ? AND expires_at > CURRENT_TIMESTAMP AND used = FALSE
      `);
      const ticket = ticketStmt.get(ticketId) as Ticket | undefined;

      if (!ticket) {
        return {
          success: false,
          stamps: [],
          errors: ['Invalid or expired ticket']
        };
      }

      // Process each mutation
      for (const mutation of mutations) {
        try {
          // Generate stamp for this mutation
          const repoSHA = 'a'.repeat(40); // Mock - would be actual git SHA
          const stampId = randomUUID().replace(/-/g, '').substring(0, 8);
          
          const stamp = this.generateStamp(
            repoSHA,
            ticket.plan_hash,
            ticketId,
            mutation.content || ''
          );

          // In a real implementation, this would write the stamped content to file:
          // // ARBITER:BEGIN <stampId> stamp=<stamp>
          // <content>
          // // ARBITER:END <stampId>

          stamps.push({
            file: mutation.file,
            stamp,
            stampId
          });

          // Record in stamp history
          const historyStmt = this.db.prepare(`
            INSERT INTO stamp_history (id, ticket_id, repo_sha, plan_hash, file_path, stamp, created_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `);
          historyStmt.run(stampId, ticketId, repoSHA, ticket.plan_hash, mutation.file, stamp);

        } catch (error) {
          errors.push(`Failed to process ${mutation.file}: ${error}`);
        }
      }

      // Mark ticket as used
      const updateStmt = this.db.prepare('UPDATE active_tickets SET used = TRUE WHERE id = ?');
      updateStmt.run(ticketId);

      return {
        success: errors.length === 0,
        stamps,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      return {
        success: false,
        stamps: [],
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Parse duration string (e.g., "1h", "30m", "24h") to milliseconds
   */
  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smh])$/);
    if (!match) {
      throw new Error('Invalid duration format. Use format like "1h", "30m", "5s"');
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      default: throw new Error('Invalid duration unit');
    }
  }

  /**
   * Timing-safe string comparison to prevent timing attacks
   */
  private constantTimeEquals(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Clean up expired tickets
   */
  private cleanupExpiredTickets(): void {
    const stmt = this.db.prepare(`
      DELETE FROM active_tickets 
      WHERE expires_at < datetime('now', '-1 hour')
    `);
    const result = stmt.run();
    
    if (result.changes > 0) {
      console.log(`🧹 Cleaned up ${result.changes} expired tickets`);
    }
  }

  /**
   * Get ticket statistics
   */
  getStats(): {
    activeTickets: number;
    stampHistory: number;
    oldestTicket?: Date;
  } {
    const activeStmt = this.db.prepare('SELECT COUNT(*) as count FROM active_tickets WHERE expires_at > CURRENT_TIMESTAMP');
    const activeResult = activeStmt.get() as { count: number };

    const historyStmt = this.db.prepare('SELECT COUNT(*) as count FROM stamp_history');
    const historyResult = historyStmt.get() as { count: number };

    const oldestStmt = this.db.prepare('SELECT MIN(created_at) as oldest FROM active_tickets');
    const oldestResult = oldestStmt.get() as { oldest: string | null };

    return {
      activeTickets: activeResult.count,
      stampHistory: historyResult.count,
      oldestTicket: oldestResult.oldest ? new Date(oldestResult.oldest) : undefined
    };
  }

  /**
   * Cleanup on shutdown
   */
  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }
}

// Export for use in server
export default TicketSystem;